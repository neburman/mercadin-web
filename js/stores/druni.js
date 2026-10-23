/**
 * Adaptador de Druni: busca en su índice de Doofinder. Doofinder solo responde a peticiones que vienen de druni.es,
 * así que va por el proxy, que le envía ese origen.
 * Doofinder agrupa los tamaños de un producto: `preciofinal` y `vt_df_product_capacity` son los del tamaño que muestra la ficha,
 * mientras que `price` es el más barato del grupo y puede ser de otro tamaño.
 */
const storeDruni = {
    constants: {
        ID: 'druni',
        NAME: 'Druni',
        LOGO_URL: 'https://www.druni.es/media/favicon/stores/1/favicon.ico',
        MODE: 'busqueda',
        ENDPOINT: 'https://eu1-search.doofinder.com/5/search',
        // Identificador público del buscador que carga la propia web de Druni.
        // Doofinder devuelve lo que contiene alguna palabra, ordenado por relevancia: el filtro del motor recorta el resto.
        QUERY_PARAMS: {
            hashid: '8ed7450f44117ffe10dedbb105484e0e',
            rpp: 100,
        },
        IN_STOCK: 'in stock',
    },
    globals: {},
    elements: {},
    init() {},
    listeners() {},

    // === GETTERS ===

    getResults(raw) {
        return raw.results || [];
    },

    getCategories(item) {
        return Array.isArray(item.categories) ? item.categories : [];
    },

    /**
     * Devuelve el precio vigente del tamaño que muestra la ficha.
     *
     * @param {Object} item
     * @returns {number}
     */
    getPrice(item) {
        return Number(item.preciofinal || item.best_price || item.price);
    },

    /**
     * Devuelve el precio sin rebaja: solo hay rebaja cuando viene `sale_price`, y entonces `price` es el de antes.
     *
     * @param {Object} item
     * @returns {number|null}
     */
    getPreviousPrice(item) {
        return item.sale_price ? Number(item.price) : null;
    },

    // === CONTRACT ===

    /**
     * Indica si el comercio da servicio en el código postal.
     *
     * @returns {boolean} Siempre true: Druni envía a toda España.
     */
    isAvailable() {
        return true;
    },

    /**
     * Lanza la búsqueda en Doofinder.
     *
     * @param {string} term
     * @param {AbortSignal} signal
     * @returns {Promise<Object>} Respuesta cruda.
     */
    search(term, signal) {
        const { constants } = storeDruni;
        return utils.requestProxiedJson(constants.ENDPOINT, { ...constants.QUERY_PARAMS, query: term }, { signal });
    },

    /**
     * Mapea la respuesta a los campos del modelo común, sin validar.
     *
     * @param {Object} raw
     * @returns {Array<Object>}
     */
    toProducts(raw) {
        return storeDruni.getResults(raw).map((item) => storeDruni.mapItem(item));
    },

    /**
     * Mapea un resultado; la capacidad («250ml») da el precio por litro o por kilo.
     *
     * @param {Object} item
     * @returns {Object}
     */
    mapItem(item) {
        const self = storeDruni;
        const capacity = item.vt_df_product_capacity || '';

        return {
            id: item.id,
            name: capacity ? `${item.title} ${capacity}` : item.title,
            brand: item.brand,
            imageUrl: item.image_link || item.image || '',
            price: self.getPrice(item),
            previousPrice: self.getPreviousPrice(item),
            unitPrice: null,
            unitScale: '',
            packageText: capacity || item.title,
            available: item.availability === self.constants.IN_STOCK,
            categories: self.getCategories(item),
        };
    },
};
