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
        // Ficha del producto con ingredientes y valores nutricionales; no trae EAN.
        DETAIL_ENDPOINT: 'https://www.dia.es/api/v1/pdp-back/',
        DETAIL_HEADERS: {
            Accept: 'application/json, text/plain, */*',
        },
        ENERGY_LABEL: 'Valor energético',
        ENERGY_UNITS: ['kcal', 'kJ'],
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
        return utils.requestProxiedJson(constants.ENDPOINT, { ...constants.QUERY_PARAMS, q: term }, { signal });
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
     * Pide la ficha del producto: ingredientes con los alérgenos en negrita y valores por 100 g.
     *
     * @param {Object} item Producto del modelo común.
     * @param {AbortSignal} signal
     * @returns {Promise<{ingredients: string, nutrition: Array<Object>}>}
     */
    async getDetail(item, signal) {
        const self = storeDia;
        const { constants } = self;
        const raw = await utils.requestProxiedJson(`${constants.DETAIL_ENDPOINT}${encodeURIComponent(item.id)}`, {}, { signal, headers: constants.DETAIL_HEADERS });
        const data = raw.product || {};

        return {
            ingredients: (data.ingredients || {}).text || '',
            nutrition: self.getNutrition(((data.nutritional_info || {}).nutritional_values) || {}),
        };
    },

    /**
     * Pasa los valores nutricionales de la ficha a filas de la tabla: primero la energía y luego cada valor con su desglose.
     *
     * @param {Object} values { energy_value, energy_value_kj, values: [{ title, value_per_100_g, measure_unit, items }] }
     * @returns {Array<{label: string, text: string, isSub: boolean}>}
     */
    getNutrition(values) {
        const { ENERGY_LABEL, ENERGY_UNITS } = storeDia.constants;
        const [kcal, kj] = ENERGY_UNITS;
        const toRow = (value, isSub) => product.createNutrient(value.title, utils.formatAmount(value.value_per_100_g ?? value.value, value.measure_unit), isSub);
        const energy = [[values.energy_value, kcal], [values.energy_value_kj, kj]]
            .filter(([amount]) => Number.isFinite(amount))
            .map(([amount, unit]) => product.createNutrient(ENERGY_LABEL, utils.formatAmount(amount, unit), false));

        return [
            ...energy,
            ...(values.values || []).flatMap((value) => [toRow(value, false), ...(value.items || []).map((subValue) => toRow(subValue, true))]),
        ];
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
