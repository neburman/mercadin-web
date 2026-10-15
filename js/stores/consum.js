/**
 * Adaptador de Consum: busca en el catálogo de su tienda online (plataforma Aktios, como BM).
 * Su API no envía cabeceras CORS, así que va por el proxy.
 */
const storeConsum = {
    constants: {
        ID: 'consum',
        NAME: 'Consum',
        LOGO_URL: 'https://cdn-consum.aktiosdigitalservices.com/assets/application/es/favicon.ico',
        MODE: 'busqueda',
        ENDPOINT: 'https://tienda.consum.es/api/rest/V1.0/catalog/searcher/products',
        QUERY_PARAMS: {
            limit: 40,
            showRecommendations: false,
            showProducts: true,
            showRecipes: false,
        },
        PRODUCT_TYPE: 'product',
    },
    globals: {},
    elements: {},
    init() {},
    listeners() {},

    // === GETTERS ===

    getProductsData(raw) {
        return ((raw.catalog || {}).products || []).filter((item) => item.type === storeConsum.constants.PRODUCT_TYPE);
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
     * Lanza la búsqueda en la API de Consum.
     *
     * @param {string} term
     * @param {AbortSignal} signal
     * @returns {Promise<Object>} Respuesta cruda.
     */
    search(term, signal) {
        const { constants } = storeConsum;
        const params = new URLSearchParams({ ...constants.QUERY_PARAMS, q: term });

        return utils.requestJson(utils.getProxiedUrl(`${constants.ENDPOINT}?${params}`), { signal });
    },

    /**
     * Mapea la respuesta a los campos del modelo común, sin validar.
     *
     * @param {Object} raw
     * @returns {Array<Object>}
     */
    toProducts(raw) {
        return storeConsum.getProductsData(raw).map((item) => aktios.mapItem(item));
    },
};
