/**
 * Adaptador de BM Supermercados: busca en el catálogo de su tienda online (plataforma Aktios).
 * Su API no envía cabeceras CORS, así que va por el proxy.
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
    },
    globals: {},
    elements: {},
    init() {},
    listeners() {},

    // === GETTERS ===

    getProductsData(raw) {
        return raw.products || [];
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
        return utils.requestProxiedJson(constants.ENDPOINT, { ...constants.QUERY_PARAMS, q: term }, { signal });
    },

    /**
     * Mapea la respuesta a los campos del modelo común, sin validar.
     *
     * @param {Object} raw
     * @returns {Array<Object>}
     */
    toProducts(raw) {
        return storeBm.getProductsData(raw).map((item) => aktios.mapItem(item));
    },
};
