/**
 * Plataforma de tienda online de Iskaypet (Salesforce Commerce Cloud), que comparten Kiwoko y Tiendanimal: misma tarjeta de producto.
 * No hay API de búsqueda pública, así que se pide el fragmento HTML con la rejilla de resultados que carga su web y se lee con DOMParser.
 * Va por el proxy.
 * Un producto con varios tamaños trae solo el rango de precios y, a veces, el precio por kilo más bajo («Desde 1.27€ / kg»),
 * que suele ser el del tamaño más grande: se toma el precio más bajo y ese precio por kilo, así que no siempre son del mismo tamaño.
 */
const iskaypet = {
    constants: {
        // Una sola página con los primeros resultados por relevancia: el filtro del motor recorta el resto.
        QUERY_PARAMS: {
            start: 0,
            sz: 48,
        },
        HEADERS: {
            'Accept': 'text/html',
        },
        CATEGORY_SEPARATOR: '/',
        SELECTORS: {
            card: '.isk-product-card[data-pid]',
            price: '.js-isk-product-card-price',
            previousPrice: '.isk-product-card__price-list',
            unitPrice: '.isk-product-card__pum [aria-hidden="true"]',
            image: 'img.isk-product-card__image',
        },
    },
    globals: {},
    elements: {},
    init() {},
    listeners() {},

    // === GETTERS ===

    getCards(raw) {
        return [...new DOMParser().parseFromString(raw, 'text/html').querySelectorAll(iskaypet.constants.SELECTORS.card)];
    },

    getText(card, selector) {
        return (card.querySelector(selector) || {}).textContent || '';
    },

    /**
     * Lee el precio tachado de antes de la rebaja.
     *
     * @param {Element} card
     * @returns {number|null} Con punto decimal: «9.99€».
     */
    getPreviousPrice(card) {
        return parseFloat(iskaypet.getText(card, iskaypet.constants.SELECTORS.previousPrice)) || null;
    },

    getCategories(card) {
        return (card.dataset.cat || '').split(iskaypet.constants.CATEGORY_SEPARATOR).filter(Boolean);
    },

    // === ACTIONS ===

    /**
     * Pide la rejilla de resultados de una búsqueda.
     *
     * @param {string} endpoint URL de Search-UpdateGrid del comercio.
     * @param {string} term
     * @param {AbortSignal} signal
     * @returns {Promise<string>} HTML de la rejilla.
     */
    async search(endpoint, term, signal) {
        const { constants } = iskaypet;
        const url = `${endpoint}?${new URLSearchParams({ ...constants.QUERY_PARAMS, q: term })}`;
        const response = await fetch(utils.getProxiedUrl(url), { headers: constants.HEADERS, signal });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        return response.text();
    },

    /**
     * Mapea la respuesta a los campos del modelo común, sin validar.
     *
     * @param {string} raw
     * @returns {Array<Object>}
     */
    toProducts(raw) {
        return iskaypet.getCards(raw).map((card) => iskaypet.mapCard(card));
    },

    /**
     * Mapea una tarjeta; sin precio por kilo en la tarjeta, el modelo lo calcula con el nombre.
     *
     * @param {Element} card
     * @returns {Object}
     */
    mapCard(card) {
        const self = iskaypet;
        const { SELECTORS } = self.constants;
        const { unitPrice, unitScale } = product.parseUnitPriceText(self.getText(card, SELECTORS.unitPrice));

        return {
            id: card.dataset.pid,
            name: card.dataset.productName,
            brand: card.dataset.brand,
            imageUrl: (card.querySelector(SELECTORS.image) || {}).src || '',
            price: Number((card.querySelector(SELECTORS.price) || { dataset: {} }).dataset.minPrice),
            previousPrice: self.getPreviousPrice(card),
            unitPrice,
            unitScale,
            packageText: card.dataset.productName,
            available: true,
            categories: self.getCategories(card),
        };
    },
};
