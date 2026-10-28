/**
 * Proxy CORS de Mercadín para Cloudflare Workers.
 *
 * Reenvía a la tienda online de cada comercio las peticiones que el navegador no puede hacer directamente
 * (sus APIs no envían cabeceras CORS) y, de paso, devuelve las respuestas comprimidas y guarda 30 minutos los resultados
 * en la caché de Cloudflare, compartida por todos los visitantes. La cabecera X-Mercadin-Cache dice si la respuesta sale de ella (HIT) o no (MISS).
 *
 * Para desplegarlo en otra cuenta:
 * 1. En Cloudflare, Workers & Pages → Create → Worker, y pega este archivo como código.
 * 2. Cambia ALLOWED_ORIGINS por la dirección donde publiques la web ('null' es para abrirla con doble clic desde file://).
 * 3. Pon la URL del Worker en `PROXY_URL` de js/core/utils.js.
 *
 * Solo acepta comercios de ALLOWED_HOSTS: un comercio nuevo que vaya por el proxy debe añadirse aquí.
 */
const ALLOWED_HOSTS = [
    'www.online.bmsupermercados.es',
    'tienda.consum.es',
    'www.dia.es',
    'www.carrefour.es',
    'www.compraonline.alcampo.es',
    'supermercado.eroski.es',
    'www.elcorteingles.es',
    'www.ubereats.com',
    'www.action.com',
    'www.lidl.es',
    'www.amazon.es',
    'www.lupaonline.com',
    'eu1-search.doofinder.com',
    'www.kiwoko.com',
    'www.tiendanimal.es',
    'www.zooplus.es',
    'tienda.mercadona.es',
    'cdn-bm.aktiosdigitalservices.com',
];
// Buscadores externos que solo responden a la web de su comercio (Doofinder de Druni): se les envía como origen esa web.
const UPSTREAM_ORIGINS = {
    'eu1-search.doofinder.com': 'https://www.druni.es',
};
const ALLOWED_ORIGINS = ['https://neburman.github.io', 'null'];
// La web servida en local, en cualquier puerto: el que se use depende de cuál esté libre en cada equipo.
const LOCAL_ORIGIN_PATTERN = /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/;
const ALLOWED_METHODS = ['GET', 'POST'];
// Cabeceras que delatan la web de origen o llevan datos de quien navega: no se reenvían al comercio.
const BLOCKED_HEADER_PATTERN = /^(cookie|origin|referer|host|content-length|sec-|cf-|x-forwarded-|x-real-ip)/i;
// Cloudflare solo comprime los tipos que conoce: «application/mindshift.search+json» (Lidl) llegaría sin comprimir.
const JSON_TYPE_PATTERN = /[/+]json\b/i;
const JSON_TYPE = 'application/json';
// Caché compartida entre todos los visitantes: una búsqueda repetida no vuelve a llegar al comercio, que así bloquea menos el proxy.
const CACHE_TTL_SECONDS = 30 * 60;
const CACHE_HEADER = 'X-Mercadin-Cache';
// Estados que no pueden llevar cuerpo: con uno, aunque esté vacío, Response da error.
const NULL_BODY_STATUSES = [101, 204, 205, 304];
// Cabeceras que cambian la respuesta del comercio y entran en la clave de la caché; las del navegador (idioma, agente) no, para compartirla.
// Un comercio nuevo que envíe otra cabecera que cambie la respuesta debe añadirla aquí.
const CACHE_KEY_HEADERS = ['accept', 'content-type', 'rsc', 'ecom-request-source', 'x-requested-with', 'x-csrf-token'];
// Una página HTML con estado 200 puede ser un captcha: solo se guarda si trae la marca de que hay resultados.
// Las respuestas JSON con estado 200 se guardan siempre; los HTML de comercios sin marca, nunca.
const CACHE_HTML_MARKERS = {
    'www.amazon.es': 's-main-slot',
    'www.kiwoko.com': 'isk-product-card',
    'www.tiendanimal.es': 'isk-product-card',
    'www.zooplus.es': 'initialStoreState',
    'www.lupaonline.com': 'name="postcode"',
    // Fichas de producto.
    'www.lidl.es': 'id="__NUXT_DATA__"',
    'supermercado.eroski.es': 'product-detail-main',
};

/**
 * Construye la clave de caché de una petición: comercio, método, cuerpo y cabeceras que cambian la respuesta.
 *
 * @param {Request} request Petición al proxy.
 * @param {URL} target
 * @param {string|undefined} body
 * @returns {Promise<Request>}
 */
async function getCacheKey(request, target, body) {
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(body || ''));
    const bodyHash = [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
    const keyHeaders = CACHE_KEY_HEADERS.map((name) => `${name}=${request.headers.get(name) || ''}`).join(';');
    const params = new URLSearchParams({ url: target.href, method: request.method, body: bodyHash, headers: keyHeaders });

    return new Request(`${new URL(request.url).origin}/__cache?${params}`);
}

/**
 * Indica si la respuesta del comercio son resultados de verdad que se pueden guardar, y no un error, un bloqueo o un captcha.
 *
 * @param {URL} target
 * @param {number} status
 * @param {string} contentType Ya normalizado.
 * @param {ArrayBuffer} body
 * @returns {boolean}
 */
function isCacheable(target, status, contentType, body) {
    if (status !== 200) {
        return false;
    }

    if (contentType === JSON_TYPE) {
        return true;
    }

    const marker = CACHE_HTML_MARKERS[target.hostname];

    return Boolean(marker) && new TextDecoder().decode(body).includes(marker);
}

export default {
    async fetch(request, env, ctx) {
        const origin = request.headers.get('Origin');
        const cors = {
            'Access-Control-Allow-Origin': origin,
            'Access-Control-Allow-Methods': ALLOWED_METHODS.join(', '),
            'Access-Control-Allow-Headers': request.headers.get('Access-Control-Request-Headers') || 'Content-Type',
            'Access-Control-Max-Age': '86400',
            'Access-Control-Expose-Headers': CACHE_HEADER,
            'Vary': 'Origin, Access-Control-Request-Headers',
        };
        const reply = (body, status) => new Response(body, { status, headers: cors });

        if (!ALLOWED_ORIGINS.includes(origin) && !LOCAL_ORIGIN_PATTERN.test(origin)) {
            return new Response('Origen no permitido', { status: 403 });
        }

        if (request.method === 'OPTIONS') {
            return reply(null, 204);
        }

        if (!ALLOWED_METHODS.includes(request.method)) {
            return reply('Método no permitido', 405);
        }

        let target;

        try {
            target = new URL(new URL(request.url).searchParams.get('url'));
        } catch {
            return reply('URL no válida', 400);
        }

        if (target.protocol !== 'https:' || !ALLOWED_HOSTS.includes(target.hostname)) {
            return reply('Comercio no permitido', 403);
        }

        const body = request.method === 'POST' ? await request.text() : undefined;
        const cache = caches.default;
        const cacheKey = await getCacheKey(request, target, body);
        const cached = await cache.match(cacheKey);

        if (cached) {
            return new Response(cached.body, {
                status: cached.status,
                headers: { ...cors, 'Content-Type': cached.headers.get('Content-Type'), [CACHE_HEADER]: 'HIT' },
            });
        }

        const headers = new Headers();

        for (const [name, value] of request.headers) {
            if (!BLOCKED_HEADER_PATTERN.test(name)) {
                headers.set(name, value);
            }
        }

        const upstreamOrigin = UPSTREAM_ORIGINS[target.hostname];

        if (upstreamOrigin) {
            headers.set('Origin', upstreamOrigin);
        }

        headers.set('Referer', `${upstreamOrigin || target.origin}/`);

        let upstream;

        try {
            upstream = await fetch(target, {
                method: request.method,
                headers,
                body,
                // Sin seguir redirecciones para no salir de la lista de comercios permitidos.
                redirect: 'manual',
            });
        } catch {
            return reply('El comercio no responde', 502);
        }

        const upstreamType = upstream.headers.get('Content-Type') || JSON_TYPE;
        const contentType = JSON_TYPE_PATTERN.test(upstreamType) ? JSON_TYPE : upstreamType;
        const upstreamBody = await upstream.arrayBuffer();

        if (isCacheable(target, upstream.status, contentType, upstreamBody)) {
            ctx.waitUntil(cache.put(cacheKey, new Response(upstreamBody, {
                headers: { 'Content-Type': contentType, 'Cache-Control': `public, max-age=${CACHE_TTL_SECONDS}` },
            })));
        }

        return new Response(NULL_BODY_STATUSES.includes(upstream.status) ? null : upstreamBody, {
            status: upstream.status,
            headers: { ...cors, 'Content-Type': contentType, [CACHE_HEADER]: 'MISS' },
        });
    },
};
