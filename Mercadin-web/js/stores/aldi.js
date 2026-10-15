/**
 * Adaptador de Aldi: busca en su índice público de Algolia (catálogo nacional).
 */
const storeAldi = {
    constants: {
        ID: 'aldi',
        NAME: 'Aldi',
        LOGO_URL: 'https://www.aldi.es/favicon.ico',
        MODE: 'busqueda',
        // Clave pública de solo búsqueda que expone la propia web de Aldi.
        ALGOLIA: {
            appId: 'L9KNU74IO7',
            apiKey: '83df5acd172c42ab174afa4583232b5d',
            index: 'an_prd_es_es_pen_products2',
        },
        IMAGE_PARAMS: '?wid=320&hei=320&fit=constrain',
        PRIMARY_ASSET: 'primary',
    },
    globals: {},
    elements: {},
    init() {},
    listeners() {},

    // === GETTERS ===

    getCurrentPrice(hit) {
        return hit.currentPrice || {};
    },

    getBasePrice(hit) {
        return (storeAldi.getCurrentPrice(hit).basePrice || [])[0] || {};
    },

    getStrikePrice(hit) {
        return (storeAldi.getCurrentPrice(hit).strikePrice || {}).strikePriceValue ?? null;
    },

    getPrimaryImage(hit) {
        return ((hit.assets || []).find((asset) => asset.type === storeAldi.constants.PRIMARY_ASSET) || {}).url || '';
    },

    getCategories(hit) {
        return (hit.hierarchicalCategories || {}).lvl0 || [];
    },

    getImageUrl(hit) {
        const url = storeAldi.getPrimaryImage(hit);

        return url ? `${url}${storeAldi.constants.IMAGE_PARAMS}` : '';
    },

    // === CONTRACT ===

    /**
     * Indica si el comercio da servicio en el código postal.
     *
     * @returns {boolean} Siempre true: el catálogo online de Aldi es nacional.
     */
    isAvailable() {
        return true;
    },

    /**
     * Lanza la búsqueda en Algolia.
     *
     * @param {string} term
     * @param {AbortSignal} signal
     * @returns {Promise<Object>} Respuesta cruda de Algolia.
     */
    search(term, signal) {
        return algolia.query(storeAldi.constants.ALGOLIA, term, signal);
    },

    /**
     * Mapea la respuesta a los campos del modelo común, sin validar.
     *
     * @param {Object} raw
     * @returns {Array<Object>}
     */
    toProducts(raw) {
        return algolia.getHits(raw).map((hit) => storeAldi.mapHit(hit));
    },

    /**
     * Mapea un hit de Algolia; sin precio de referencia, el modelo lo calcula con `salesUnit`.
     *
     * @param {Object} hit
     * @returns {Object}
     */
    mapHit(hit) {
        const self = storeAldi;
        const basePrice = self.getBasePrice(hit);

        return {
            id: hit.objectID,
            name: hit.name,
            brand: hit.brandName,
            imageUrl: self.getImageUrl(hit),
            price: self.getCurrentPrice(hit).priceValue,
            previousPrice: self.getStrikePrice(hit),
            unitPrice: basePrice.basePriceValue,
            unitScale: basePrice.basePriceScale,
            packageText: hit.salesUnit,
            available: hit.isAvailable,
            categories: self.getCategories(hit),
        };
    },
};
