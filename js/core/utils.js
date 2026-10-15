/**
 * Utilidades compartidas por todos los componentes: HTTP, almacenamiento, formato, escape y eventos.
 */
const utils = {
    constants: {
        CURRENCY: new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }),
        HTML_ENTITIES: { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' },
        // Worker de Cloudflare para los comercios sin CORS; cada dominio debe estar en su lista ALLOWED_HOSTS.
        PROXY_URL: 'https://mercadin-proxy.neburman.workers.dev/',
    },
    globals: {},
    elements: {},
    init() {},
    listeners() {},

    // === HTTP ===

    /**
     * Hace la petición y devuelve el JSON; falla si el estado HTTP no es 2xx.
     *
     * @param {string} url
     * @param {RequestInit} options
     * @returns {Promise<Object>}
     */
    async requestJson(url, options = {}) {
        const response = await fetch(url, options);

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        return response.json();
    },

    /**
     * Devuelve la URL que pasa por el proxy, para comercios que no permiten peticiones desde otras webs.
     *
     * @param {string} url
     * @returns {string}
     */
    getProxiedUrl(url) {
        return `${utils.constants.PROXY_URL}?url=${encodeURIComponent(url)}`;
    },

    // === STORAGE ===

    /**
     * Lee un valor JSON guardado en el navegador.
     *
     * @param {string} key
     * @param {*} fallback Valor si no hay nada guardado o el navegador bloquea el almacenamiento.
     * @returns {*}
     */
    readStorage(key, fallback) {
        try {
            const value = localStorage.getItem(key);

            return value === null ? fallback : JSON.parse(value);
        } catch {
            return fallback;
        }
    },

    /**
     * Guarda un valor JSON en el navegador; si está bloqueado (modo privado, permisos), lo ignora.
     *
     * @param {string} key
     * @param {*} value
     */
    writeStorage(key, value) {
        try {
            localStorage.setItem(key, JSON.stringify(value));
        } catch {
            // Sin almacenamiento la selección solo dura hasta recargar.
        }
    },

    // === FORMAT ===

    /**
     * Escapa un valor para interpolarlo en HTML.
     *
     * @param {*} value
     * @returns {string}
     */
    escapeHtml(value) {
        return String(value ?? '').replace(/[&<>"']/g, (char) => utils.constants.HTML_ENTITIES[char]);
    },

    /**
     * Formatea un importe en euros.
     *
     * @param {number} amount
     * @returns {string} Por ejemplo, «1,03 €».
     */
    formatPrice(amount) {
        return utils.constants.CURRENCY.format(amount);
    },

    /**
     * Formatea un precio por unidad de referencia.
     *
     * @param {number} amount
     * @param {string} unit
     * @returns {string} Por ejemplo, «4,05 €/l».
     */
    formatUnitPrice(amount, unit) {
        return `${utils.formatPrice(amount)}/${unit}`;
    },

    // === EVENTS ===

    /**
     * Registra un listener delegado en el contenedor del componente.
     *
     * @param {string} event
     * @param {string} selector Elemento que dispara el evento.
     * @param {Function} handler Recibe el evento; `this` es el elemento que coincide.
     * @param {string} workspace Contenedor donde se delega.
     */
    addListener(event, selector, handler, workspace) {
        const root = document.querySelector(workspace);

        if (!root) {
            return;
        }

        root.addEventListener(event, (domEvent) => {
            const target = domEvent.target.closest(selector);

            if (target && root.contains(target)) {
                handler.call(target, domEvent);
            }
        });
    },
};
