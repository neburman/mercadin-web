/**
 * Adaptador de BM Supermercados: busca en el catálogo de su tienda online.
 * Su API no envía cabeceras CORS, así que desde el navegador fallará hasta tener proxy.
 */
const storeBm = {
    constants: {
        ID: 'bm',
        NAME: 'BM',
        LOGO_URL: 'https://cdn-bm.aktiosdigitalservices.com/assets/application/es/favicon.ico',
        MODE: 'busqueda',
        ENDPOINT: 'https://www.online.bmsupermercados.es/api/rest/V1.0/catalog/product',
        QUERY_PARAMS: {
            page: 1,
            limit: 40,
            offset: 0,
            orderById: 7,
            showRecommendations: false,
        },
        PRICE_IDS: {
            regular: 'PRICE',
            offer: 'OFFER_PRICE',
        },
    },
    globals: {},
    elements: {},
    init() {},
    listeners() {},

    // === GETTERS ===

    getProductsData(raw) {
        return raw.products || [];
    },

    getProductData(item) {
        return item.productData || {};
    },

    getPriceData(item) {
        return item.priceData || {};
    },

    /**
     * Devuelve un precio de la lista por su id (PRICE u OFFER_PRICE).
     *
     * @param {Object} item
     * @param {string} priceId
     * @returns {{centAmount?: number, centUnitAmount?: number}} Pese al nombre, los importes vienen en euros.
     */
    getPrice(item, priceId) {
        return ((storeBm.getPriceData(item).prices || []).find((price) => price.id === priceId) || {}).value || {};
    },

    getCategories(item) {
        return (item.categories || []).map((category) => category.name);
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
     * Lanza la búsqueda en la API de BM.
     *
     * @param {string} term
     * @param {AbortSignal} signal
     * @returns {Promise<Object>} Respuesta cruda.
     */
    search(term, signal) {
        const { constants } = storeBm;
        const params = new URLSearchParams({ ...constants.QUERY_PARAMS, q: term });

        return utils.requestJson(`${constants.ENDPOINT}?${params}`, { signal });
    },

    /**
     * Mapea la respuesta a los campos del modelo común, sin validar.
     *
     * @param {Object} raw
     * @returns {Array<Object>}
     */
    toProducts(raw) {
        return storeBm.getProductsData(raw).map((item) => storeBm.mapItem(item));
    },

    /**
     * Mapea un producto; con oferta, el precio vigente es OFFER_PRICE y PRICE pasa a ser el anterior.
     *
     * @param {Object} item
     * @returns {Object}
     */
    mapItem(item) {
        const self = storeBm;
        const { PRICE_IDS } = self.constants;
        const data = self.getProductData(item);
        const regular = self.getPrice(item, PRICE_IDS.regular);
        const offer = self.getPrice(item, PRICE_IDS.offer);
        const current = offer.centAmount ? offer : regular;

        return {
            id: item.code,
            name: data.name,
            brand: (data.brand || {}).name,
            imageUrl: data.imageURL,
            price: current.centAmount,
            previousPrice: offer.centAmount ? regular.centAmount : null,
            unitPrice: current.centUnitAmount,
            unitScale: self.getPriceData(item).unitPriceUnitType,
            packageText: data.name,
            available: data.availability === '1',
            categories: self.getCategories(item),
        };
    },
};
