/**
 * Utilidades compartidas por todos los componentes: HTTP, almacenamiento, texto, formato, escape y eventos.
 */
const utils = {
    constants: {
        CURRENCY: new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }),
        LIST_FORMAT: new Intl.ListFormat('es', { type: 'conjunction' }),
        HTML_ENTITIES: { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' },
        // Worker de Cloudflare para los comercios sin CORS; cada dominio debe estar en su lista ALLOWED_HOSTS.
        PROXY_URL: 'https://mercadin-proxy.neburman.workers.dev/',
        DIACRITICS_PATTERN: /[̀-ͯ]/g,
        WORD_SEPARATOR_PATTERN: /[^a-z0-9ñ]+/,
        // Palabras más cortas («de», «la») no sirven para decidir si un producto encaja con la búsqueda.
        MIN_TERM_WORD_LENGTH: 3,
        // Reducen singular y plural a la misma raíz: leche/leches → lech, yogur/yogures → yogur, nuez/nueces → nuec.
        STEM_RULES: [
            [/s$/, ''],
            [/([^aeiou])e$/, '$1'],
            [/z$/, 'c'],
        ],
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

    // === TEXT ===

    /**
     * Pasa un texto a minúsculas y sin tildes para compararlo.
     *
     * @param {*} text
     * @returns {string}
     */
    normalizeText(text) {
        return String(text ?? '').toLowerCase().normalize('NFD').replace(utils.constants.DIACRITICS_PATTERN, '');
    },

    /**
     * Reduce una palabra ya normalizada a su raíz, para que singular y plural coincidan.
     *
     * @param {string} word
     * @returns {string}
     */
    getWordStem(word) {
        return utils.constants.STEM_RULES.reduce((stem, [pattern, replacement]) => stem.replace(pattern, replacement), word);
    },

    /**
     * Devuelve las palabras de un texto, normalizadas.
     *
     * @param {string} text
     * @returns {Array<string>} Por ejemplo, «Aceites de Oliva» → ['aceites', 'de', 'oliva'].
     */
    getTextWords(text) {
        return utils.normalizeText(text).split(utils.constants.WORD_SEPARATOR_PATTERN).filter(Boolean);
    },

    /**
     * Devuelve las raíces de las palabras de un texto.
     *
     * @param {string} text
     * @returns {Array<string>} Por ejemplo, «Aceites de oliva» → ['aceit', 'de', 'oliva'].
     */
    getTextStems(text) {
        return utils.getTextWords(text).map((word) => utils.getWordStem(word));
    },

    /**
     * Devuelve las raíces de las palabras de una búsqueda que sirven para filtrar; si todas son cortas («té»), se usan todas.
     *
     * @param {string} term
     * @returns {Array<string>} Vacío si la búsqueda no tiene ninguna palabra.
     */
    getTermStems(term) {
        const self = utils;
        const words = self.getTextWords(term);
        const longWords = words.filter((word) => word.length >= self.constants.MIN_TERM_WORD_LENGTH);

        return (longWords.length ? longWords : words).map((word) => self.getWordStem(word));
    },

    /**
     * Indica si el texto contiene todas las palabras significativas de la búsqueda como palabras enteras, sin tener en cuenta tildes ni plurales.
     * «café» encuentra «Cafés» pero no «Cafetera»; una búsqueda sin palabras no encuentra nada.
     *
     * @param {string} text
     * @param {string} term
     * @returns {boolean}
     */
    matchesTerm(text, term) {
        const termStems = utils.getTermStems(term);
        const textStems = new Set(utils.getTextStems(text));

        return termStems.length > 0 && termStems.every((stem) => textStems.has(stem));
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

    /**
     * Une una lista de textos como en una frase.
     *
     * @param {Array<string>} items
     * @returns {string} Por ejemplo, «Aldi, Dia y Eroski».
     */
    formatList(items) {
        return utils.constants.LIST_FORMAT.format(items);
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
