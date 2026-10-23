/**
 * Adaptador de Primor: busca en su API pública de Empathy, que permite peticiones desde otras webs, así que va directo.
 * Cada tamaño de un producto («300 ml», «Recarga 500 ml») sale como un producto aparte para poder comparar el precio por litro;
 * las variantes sin cantidad (tonos, colores) se quedan en un solo producto.
 * Primor no da el precio anterior, solo el descuento sobre el PVR, que no es una rebaja real: se deja sin precio anterior.
 */
const storePrimor = {
    constants: {
        ID: 'primor',
        NAME: 'Primor',
        LOGO_URL: 'https://cdn2.primor.eu/media/favicon/default/favicon.png',
        MODE: 'busqueda',
        ENDPOINT: 'https://api.empathy.co/search/v1/query/primor/search',
        // Empathy devuelve lo que contiene alguna palabra, ordenado por relevancia: el filtro del motor recorta el resto.
        QUERY_PARAMS: {
            lang: 'es',
            rows: 100,
            start: 0,
        },
        AVAILABLE: 'true',
    },
    globals: {},
    elements: {},
    init() {},
    listeners() {},

    // === GETTERS ===

    getItems(raw) {
        return (raw.catalog || {}).content || [];
    },

    getCategories(item) {
        return Array.isArray(item.categories) ? item.categories : [];
    },

    /**
     * Devuelve las variantes con cantidad del producto.
     *
     * @param {Object} item
     * @returns {Array<Object>} Vacío si no tiene variantes de tamaño.
     */
    getSizeVariants(item) {
        return (item.variants || []).filter((variant) => product.parsePackage(variant.variantValue));
    },

    // === CONTRACT ===

    /**
     * Indica si el comercio da servicio en el código postal.
     *
     * @returns {boolean} Siempre true: Primor envía a toda España.
     */
    isAvailable() {
        return true;
    },

    /**
     * Lanza la búsqueda en Empathy.
     *
     * @param {string} term
     * @param {AbortSignal} signal
     * @returns {Promise<Object>} Respuesta cruda.
     */
    search(term, signal) {
        const { constants } = storePrimor;
        return utils.requestJson(`${constants.ENDPOINT}?${new URLSearchParams({ ...constants.QUERY_PARAMS, query: term })}`, { signal });
    },

    /**
     * Mapea la respuesta a los campos del modelo común, sin validar.
     *
     * @param {Object} raw
     * @returns {Array<Object>}
     */
    toProducts(raw) {
        return storePrimor.getItems(raw).flatMap((item) => storePrimor.mapItem(item));
    },

    /**
     * Mapea un producto: uno por cada tamaño o, si no tiene tamaños, uno solo con los datos principales.
     *
     * @param {Object} item
     * @returns {Array<Object>}
     */
    mapItem(item) {
        const self = storePrimor;
        const variants = self.getSizeVariants(item);

        return variants.length ? variants.map((variant) => self.mapVariant(item, variant)) : [self.mapVariant(item, item)];
    },

    /**
     * Mapea una variante con el nombre, la marca y las categorías del producto.
     *
     * @param {Object} item
     * @param {Object} variant El propio producto si no tiene tamaños.
     * @returns {Object}
     */
    mapVariant(item, variant) {
        const self = storePrimor;
        const size = variant.variantValue || '';

        return {
            id: variant.variantOptionId ? `${item.productId}-${variant.variantOptionId}` : item.productId,
            name: size ? `${item.title} ${size}` : item.title,
            brand: item.brand,
            imageUrl: variant.imageLink || item.imageLink || '',
            price: Number(variant.salePrice),
            previousPrice: null,
            unitPrice: null,
            unitScale: '',
            packageText: size || item.title,
            available: variant.availability === self.constants.AVAILABLE,
            categories: self.getCategories(item),
        };
    },
};
