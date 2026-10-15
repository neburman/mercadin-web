/**
 * Adaptador de Eroski: no tiene API de catálogo, así que pide la misma página de productos que carga su web
 * al hacer scroll en los resultados (HTML dentro de un JSON) y la lee con DOMParser. Va por el proxy.
 */
const storeEroski = {
    constants: {
        ID: 'eroski',
        NAME: 'Eroski',
        LOGO_URL: 'https://supermercado.eroski.es/assets/favicon-32x32.png',
        MODE: 'busqueda',
        ENDPOINT: 'https://supermercado.eroski.es/es/search/results:loadpage',
        // Cada página trae 20 productos; la primera es la 0.
        FORM_FIELDS: {
            't:zoneid': 'productListZone',
            pageNumber: 0,
        },
        HEADERS: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'x-requested-with': 'XMLHttpRequest',
        },
        // Solo cuando el envase no es de una unidad de referencia: «1 LITRO A 4,05 €».
        UNIT_PRICE_PATTERN: /1\s+([a-z]+)\s+a\s+(\d+(?:[.,]\d+)?)/,
        SELECTORS: {
            card: '.product-item-lineal',
            title: '.product-title-link[data-metrics]',
            previousPrice: '.price-offer-before',
            unitPrice: '.quantity-text',
            image: '.product-img',
        },
    },
    globals: {},
    elements: {},
    init() {},
    listeners() {},

    // === GETTERS ===

    /**
     * Devuelve las tarjetas de producto del HTML de la respuesta, sin banners ni anuncios.
     *
     * @param {Object} raw
     * @returns {Array<Element>}
     */
    getCards(raw) {
        const { SELECTORS } = storeEroski.constants;
        const doc = new DOMParser().parseFromString(raw.content || '', 'text/html');

        return [...doc.querySelectorAll(SELECTORS.card)].filter((card) => card.querySelector(SELECTORS.title));
    },

    getText(card, selector) {
        return (card.querySelector(selector) || {}).textContent || '';
    },

    /**
     * Lee los datos de analítica que Eroski pone en el título: id, nombre, marca y precio vigente.
     *
     * @param {Element} card
     * @returns {Object} { item_id, item_name, item_brand, price }
     */
    getMetrics(card) {
        const metrics = JSON.parse(card.querySelector(storeEroski.constants.SELECTORS.title).dataset.metrics || '{}');

        return ((metrics.ecommerce || {}).items || [])[0] || {};
    },

    /**
     * Lee el precio por unidad de la tarjeta.
     *
     * @param {Element} card
     * @returns {{unitPrice: number|null, unitScale: string}} Escala vacía si no viene; entonces el modelo calcula con el nombre.
     */
    getUnitPrice(card) {
        const self = storeEroski;
        const match = self.getText(card, self.constants.SELECTORS.unitPrice).toLowerCase().match(self.constants.UNIT_PRICE_PATTERN);

        return match ? { unitPrice: product.parseNumber(match[2]), unitScale: match[1] } : { unitPrice: null, unitScale: '' };
    },

    // === CONTRACT ===

    /**
     * Indica si el comercio da servicio en el código postal.
     *
     * @returns {boolean} De momento siempre true.
     */
    isAvailable() {
        return true;
    },

    /**
     * Pide la primera página de resultados de Eroski.
     *
     * @param {string} term
     * @param {AbortSignal} signal
     * @returns {Promise<Object>} Respuesta cruda: el HTML de los productos va en `content`.
     */
    search(term, signal) {
        const { constants } = storeEroski;
        const url = `${constants.ENDPOINT}?${new URLSearchParams({ q: term })}`;

        return utils.requestJson(utils.getProxiedUrl(url), { method: 'POST', headers: constants.HEADERS, body: new URLSearchParams(constants.FORM_FIELDS), signal });
    },

    /**
     * Mapea la respuesta a los campos del modelo común, sin validar.
     *
     * @param {Object} raw
     * @returns {Array<Object>}
     */
    toProducts(raw) {
        return storeEroski.getCards(raw).map((card) => storeEroski.mapCard(card));
    },

    /**
     * Mapea una tarjeta de producto.
     *
     * @param {Element} card
     * @returns {Object}
     */
    mapCard(card) {
        const self = storeEroski;
        const { SELECTORS } = self.constants;
        const metrics = self.getMetrics(card);
        const { unitPrice, unitScale } = self.getUnitPrice(card);

        return {
            id: metrics.item_id,
            name: metrics.item_name,
            brand: metrics.item_brand,
            imageUrl: (card.querySelector(SELECTORS.image) || {}).src || '',
            price: metrics.price,
            previousPrice: product.parseNumber(self.getText(card, SELECTORS.previousPrice).trim()) || null,
            unitPrice,
            unitScale,
            packageText: metrics.item_name,
            available: true,
            categories: [],
        };
    },
};
