/**
 * Adaptador de Alcampo: busca en la API de su tienda online.
 * Su API no envía cabeceras CORS, así que va por el proxy.
 */
const storeAlcampo = {
    constants: {
        ID: 'alcampo',
        NAME: 'Alcampo',
        LOGO_URL: 'https://www.compraonline.alcampo.es/favicon.ico',
        MODE: 'busqueda',
        // Sin barra final: con ella responde con una redirección.
        ENDPOINT: 'https://www.compraonline.alcampo.es/api/webproductpagews/v6/product-pages/search',
        QUERY_PARAMS: {
            includeAdditionalPageInfo: true,
            maxPageSize: 40,
            maxProductsToDecorate: 40,
            tag: 'web',
        },
        HEADERS: {
            'ecom-request-source': 'web',
        },
        UNIT_PREFIX: 'fop.price.per.',
    },
    globals: {},
    elements: {},
    init() {},
    listeners() {},

    // === GETTERS ===

    getProductsData(raw) {
        return (raw.productGroups || []).flatMap((group) => group.decoratedProducts || []);
    },

    getUnitPrice(item) {
        return item.unitPrice || {};
    },

    /**
     * Devuelve la escala del precio por unidad sin el prefijo de Alcampo.
     *
     * @param {Object} item
     * @returns {string} Por ejemplo, «litre», «kg», «100ml» o «each».
     */
    getUnitScale(item) {
        return String(storeAlcampo.getUnitPrice(item).unit || '').replace(storeAlcampo.constants.UNIT_PREFIX, '');
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
     * Lanza la búsqueda en la API de Alcampo.
     *
     * @param {string} term
     * @param {AbortSignal} signal
     * @returns {Promise<Object>} Respuesta cruda.
     */
    search(term, signal) {
        const { constants } = storeAlcampo;
        return utils.requestProxiedJson(constants.ENDPOINT, { ...constants.QUERY_PARAMS, q: term }, { signal, headers: constants.HEADERS });
    },

    /**
     * Mapea la respuesta a los campos del modelo común, sin validar.
     *
     * @param {Object} raw
     * @returns {Array<Object>}
     */
    toProducts(raw) {
        return storeAlcampo.getProductsData(raw).map((item) => storeAlcampo.mapItem(item));
    },

    /**
     * Mapea un producto; los importes llegan como texto y sus ofertas son por volumen, sin precio anterior.
     *
     * @param {Object} item
     * @returns {Object}
     */
    mapItem(item) {
        const self = storeAlcampo;

        return {
            id: item.retailerProductId,
            name: item.name,
            brand: item.brand,
            imageUrl: (item.image || {}).src,
            price: product.parseNumber((item.price || {}).amount),
            previousPrice: null,
            unitPrice: product.parseNumber((self.getUnitPrice(item).price || {}).amount),
            unitScale: self.getUnitScale(item),
            packageText: item.packSizeDescription,
            available: item.available,
            categories: item.categoryPath || [],
        };
    },
};
