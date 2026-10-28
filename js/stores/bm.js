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
        // Ficha nutricional por EAN en su CDN; solo existe si el producto trae el atributo NUTRITIONAL_INFO_CODE (si no, da 404).
        // Solo admite CORS desde la web de BM, así que va por el proxy.
        DETAIL_ENDPOINT: 'https://cdn-bm.aktiosdigitalservices.com/tol/bm/media/product/nutritional-info/',
        NUTRITIONAL_INFO_CODE: 'nutritional.info.date',
        UNIT_SYMBOLS: { kj: 'kJ' },
    },
    globals: {},
    elements: {},
    init() {},
    listeners() {},

    // === GETTERS ===

    getProductsData(raw) {
        return raw.products || [];
    },

    hasNutritionalInfo(item) {
        return (aktios.getProductData(item).attributes || []).some((attribute) => attribute.code === storeBm.constants.NUTRITIONAL_INFO_CODE);
    },

    /**
     * Pasa los valores de la ficha nutricional, con sus desgloses, a filas de la tabla.
     *
     * @param {Array<Object>} values { name, value, measurementUnit, children }
     * @param {boolean} isSub
     * @returns {Array<{label: string, text: string, isSub: boolean}>}
     */
    getNutrition(values, isSub = false) {
        const self = storeBm;

        return (values || []).flatMap((value) => [
            product.createNutrient(value.name, utils.formatAmount(value.value, self.constants.UNIT_SYMBOLS[value.measurementUnit] || value.measurementUnit), isSub),
            ...self.getNutrition(value.children, true),
        ]);
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
        const self = storeBm;

        return self.getProductsData(raw).map((item) => ({ ...aktios.mapItem(item), detailRef: self.hasNutritionalInfo(item) }));
    },

    /**
     * Pide la ficha nutricional del producto, si la tiene: ingredientes, alérgenos y valores por 100 g.
     *
     * @param {Object} item Producto del modelo común; detailRef dice si tiene ficha.
     * @param {AbortSignal} signal
     * @returns {Promise<Object>} { ingredients, allergens, nutrition }; vacío si no tiene ficha.
     */
    async getDetail(item, signal) {
        const self = storeBm;

        if (!item.detailRef || !item.ean) {
            return {};
        }

        const raw = await utils.requestProxiedJson(`${self.constants.DETAIL_ENDPOINT}${encodeURIComponent(item.ean)}.json`, {}, { signal });
        const info = (raw.nutrilabel || {}).productInformation || {};
        const allergens = (info.allergensInformation || []).flatMap((group) => group.allergens || []).map((allergen) => allergen.allergenName);

        return {
            ingredients: ((info.ingredientsInformation || [])[0] || {}).ingredientsList || '',
            allergens: utils.formatList([...new Set(allergens)]),
            nutrition: self.getNutrition(((info.nutritionalValues || [])[0] || {}).values),
        };
    },
};
