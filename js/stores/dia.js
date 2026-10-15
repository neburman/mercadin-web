/**
 * Adaptador de Dia: busca en la API de su tienda online.
 * Su API no envía cabeceras CORS, así que va por el proxy.
 */
const storeDia = {
    constants: {
        ID: 'dia',
        NAME: 'Dia',
        LOGO_URL: 'https://www.dia.es/resources/favicon.ico',
        MODE: 'busqueda',
        BASE_URL: 'https://www.dia.es',
        ENDPOINT: 'https://www.dia.es/api/v1/search-back/search/reduced',
        QUERY_PARAMS: {
            page: 1,
        },
    },
    globals: {},
    elements: {},
    init() {},
    listeners() {},

    // === GETTERS ===

    getItems(raw) {
        return raw.search_items || [];
    },

    getPrices(item) {
        return item.prices || {};
    },

    getImageUrl(item) {
        return item.image ? `${storeDia.constants.BASE_URL}${item.image}` : '';
    },

    getCategories(item) {
        return [item.l1_category_description, item.l2_category_description].filter(Boolean);
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
     * Lanza la búsqueda en la API de Dia.
     *
     * @param {string} term
     * @param {AbortSignal} signal
     * @returns {Promise<Object>} Respuesta cruda.
     */
    search(term, signal) {
        const { constants } = storeDia;
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
        return storeDia.getItems(raw).map((item) => storeDia.mapItem(item));
    },

    /**
     * Mapea un producto; sin rebaja, `strikethrough_price` es igual al precio y el modelo lo descarta.
     *
     * @param {Object} item
     * @returns {Object}
     */
    mapItem(item) {
        const self = storeDia;
        const prices = self.getPrices(item);

        return {
            id: item.object_id,
            name: item.display_name,
            brand: item.brand,
            imageUrl: self.getImageUrl(item),
            price: prices.price,
            previousPrice: prices.strikethrough_price,
            unitPrice: prices.price_per_unit,
            unitScale: prices.measure_unit,
            packageText: item.display_name,
            available: item.units_in_stock > 0,
            categories: self.getCategories(item),
        };
    },
};
