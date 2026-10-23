/**
 * Proxy CORS de Mercadín para Cloudflare Workers.
 *
 * Reenvía a la tienda online de cada comercio las peticiones que el navegador no puede hacer directamente
 * (sus APIs no envían cabeceras CORS) y, de paso, devuelve las respuestas comprimidas.
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
];
const ALLOWED_ORIGINS = ['https://neburman.github.io', 'null', 'http://127.0.0.1:8080', 'http://localhost:8080'];
const ALLOWED_METHODS = ['GET', 'POST'];
// Cabeceras que delatan la web de origen o llevan datos de quien navega: no se reenvían al comercio.
const BLOCKED_HEADER_PATTERN = /^(cookie|origin|referer|host|content-length|sec-|cf-|x-forwarded-|x-real-ip)/i;
// Cloudflare solo comprime los tipos que conoce: «application/mindshift.search+json» (Lidl) llegaría sin comprimir.
const JSON_TYPE_PATTERN = /[/+]json\b/i;
const JSON_TYPE = 'application/json';

export default {
    async fetch(request) {
        const origin = request.headers.get('Origin');
        const cors = {
            'Access-Control-Allow-Origin': origin,
            'Access-Control-Allow-Methods': ALLOWED_METHODS.join(', '),
            'Access-Control-Allow-Headers': request.headers.get('Access-Control-Request-Headers') || 'Content-Type',
            'Access-Control-Max-Age': '86400',
            'Vary': 'Origin, Access-Control-Request-Headers',
        };
        const reply = (body, status) => new Response(body, { status, headers: cors });

        if (!ALLOWED_ORIGINS.includes(origin)) {
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

        const headers = new Headers();

        for (const [name, value] of request.headers) {
            if (!BLOCKED_HEADER_PATTERN.test(name)) {
                headers.set(name, value);
            }
        }

        headers.set('Referer', `${target.origin}/`);

        let upstream;

        try {
            upstream = await fetch(target, {
                method: request.method,
                headers,
                body: request.method === 'POST' ? await request.text() : undefined,
                // Sin seguir redirecciones para no salir de la lista de comercios permitidos.
                redirect: 'manual',
            });
        } catch {
            return reply('El comercio no responde', 502);
        }

        const contentType = upstream.headers.get('Content-Type') || JSON_TYPE;

        return new Response(upstream.body, {
            status: upstream.status,
            headers: { ...cors, 'Content-Type': JSON_TYPE_PATTERN.test(contentType) ? JSON_TYPE : contentType },
        });
    },
};
