/**
 * Adaptador de Carrefour: busca en la API de su tienda online de alimentación (tienda 005290, fija).
 * Su API no envía cabeceras CORS, así que va por el proxy.
 */
const storeCarrefour = {
    constants: {
        ID: 'carrefour',
        NAME: 'Carrefour',
        LOGO_URL: 'https://www.carrefour.es/favicon.ico',
        MODE: 'busqueda',
        ENDPOINT: 'https://www.carrefour.es/search-api/query/v1/search',
        QUERY_PARAMS: {
            internal: true,
            instance: 'x-carrefour',
            env: 'https://www.carrefour.es',
            scope: 'desktop',
            lang: 'es',
            session: 'empathy',
            citrusCatalog: 'food',
            baseUrlCitrus: 'https://www.carrefour.es',
            enabled: true,
            store: '005290',
            hasConsent: false,
            siteKey: 'wFOzqveg',
            empathypoc: false,
            catalog: 'food',
            page: 1,
        },
    },
    globals: {},
    elements: {},
    init() {},
    listeners() {},

    // === GETTERS ===

    getDocs(raw) {
        return (raw.content || {}).docs || [];
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
     * Lanza la búsqueda en la API de Carrefour.
     *
     * @param {string} term
     * @param {AbortSignal} signal
     * @returns {Promise<Object>} Respuesta cruda.
     */
    search(term, signal) {
        const { constants } = storeCarrefour;
        return utils.requestProxiedJson(constants.ENDPOINT, { ...constants.QUERY_PARAMS, query: term }, { signal });
    },

    /**
     * Mapea la respuesta a los campos del modelo común, sin validar.
     *
     * @param {Object} raw
     * @returns {Array<Object>}
     */
    toProducts(raw) {
        return storeCarrefour.getDocs(raw).map((doc) => storeCarrefour.mapDoc(doc));
    },

    /**
     * Mapea un producto; el precio por unidad solo viene formateado como texto.
     *
     * @param {Object} doc
     * @returns {Object}
     */
    mapDoc(doc) {
        const { unitPrice, unitScale } = product.parseUnitPriceText(doc.price_per_unit_text);

        return {
            id: doc.product_id,
            name: doc.display_name,
            brand: doc.brand,
            imageUrl: doc.image_path,
            price: doc.active_price,
            previousPrice: doc.strikethrough_price ?? null,
            unitPrice,
            unitScale,
            packageText: doc.display_name,
            available: doc.stock > 0,
            categories: [],
        };
    },
};
