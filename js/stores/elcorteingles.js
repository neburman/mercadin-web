/**
 * Adaptador de El Corte Inglés: pide en JSON la página de resultados de su supermercado online.
 * Su web no envía cabeceras CORS, así que va por el proxy.
 */
const storeElCorteIngles = {
    constants: {
        ID: 'elcorteingles',
        NAME: 'El Corte Inglés',
        LOGO_URL: 'https://cdn.grupoelcorteingles.es/statics/front-msh2-food-eci-es/assets//stylesheets/public/favicon.ico',
        MODE: 'busqueda',
        BASE_URL: 'https://www.elcorteingles.es',
        ENDPOINT: 'https://www.elcorteingles.es/supermercado/buscar/',
        QUERY_PARAMS: {
            catalog: 'supermercado',
            stype: 'text_box',
        },
        // Sin esta cabecera devuelve la página HTML.
        HEADERS: {
            response_type: 'json',
        },
        PRODUCT_TYPE: 'item',
        // Venta «Peso o Pieza»: el precio ya es por kilo y no trae precio por unidad aparte.
        WEIGHT_SALE_TYPE: 'A',
    },
    globals: {},
    elements: {},
    init() {},
    listeners() {},

    // === GETTERS ===

    getItems(raw) {
        return (raw.products || []).filter((item) => item.type === storeElCorteIngles.constants.PRODUCT_TYPE);
    },

    getPriceSpecification(item) {
        return item.priceSpecification || {};
    },

    /**
     * Devuelve los nombres de la categoría del producto y de sus categorías padre.
     *
     * @param {Object} item
     * @returns {Array<string>} De la más concreta a la más general.
     */
    getCategories(item) {
        const names = [];
        let category = (item.categories || []).find((entry) => entry.name);

        while (category) {
            names.push(category.name);
            category = category.parent_category;
        }

        return names;
    },

    isSoldByWeight(item) {
        return (item.sale_type || {}).identifier === storeElCorteIngles.constants.WEIGHT_SALE_TYPE;
    },

    /**
     * Pasa los valores nutricionales de la ficha, con sus desgloses, a filas de la tabla.
     *
     * @param {Array<Object>} nutrients { name, value, unit: { name, symbol }, childrens }
     * @param {boolean} isSub
     * @returns {Array<{label: string, text: string, isSub: boolean}>}
     */
    getNutrition(nutrients, isSub = false) {
        return (nutrients || []).flatMap((nutrient) => [
            product.createNutrient(nutrient.name, utils.formatAmount(nutrient.value, (nutrient.unit || {}).name || (nutrient.unit || {}).symbol || ''), isSub),
            ...storeElCorteIngles.getNutrition(nutrient.childrens, true),
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
     * Lanza la búsqueda en el supermercado de El Corte Inglés.
     *
     * @param {string} term
     * @param {AbortSignal} signal
     * @returns {Promise<Object>} Respuesta cruda.
     */
    search(term, signal) {
        const { constants } = storeElCorteIngles;
        return utils.requestProxiedJson(constants.ENDPOINT, { ...constants.QUERY_PARAMS, question: term }, { signal, headers: constants.HEADERS });
    },

    /**
     * Mapea la respuesta a los campos del modelo común, sin validar.
     *
     * @param {Object} raw
     * @returns {Array<Object>}
     */
    toProducts(raw) {
        return storeElCorteIngles.getItems(raw).map((item) => storeElCorteIngles.mapItem(item));
    },

    /**
     * Pide la ficha del producto, que con la cabecera de JSON llega como datos: EAN y, si los tiene, ingredientes, alérgenos y nutrición.
     *
     * @param {Object} item Producto del modelo común; detailRef es la ruta de su ficha.
     * @param {AbortSignal} signal
     * @returns {Promise<Object>} { ean, ingredients, allergens, nutrition }; vacío si no se conoce la ruta.
     */
    async getDetail(item, signal) {
        const self = storeElCorteIngles;
        const { constants } = self;

        if (!item.detailRef) {
            return {};
        }

        const raw = await utils.requestProxiedJson(`${constants.BASE_URL}${item.detailRef}`, {}, { signal, headers: constants.HEADERS });
        const data = (raw.pdp || {}).product || {};
        const food = data.information_alimentary || {};
        const ingredientsAllergens = food.ingredientsAllergens || {};

        return {
            ean: data.ean || '',
            ingredients: (ingredientsAllergens.ingredients || []).filter(Boolean).join(' '),
            allergens: (ingredientsAllergens.allergens || []).filter(Boolean).join(', '),
            nutrition: self.getNutrition(((food.nutrients || [])[0] || {}).nutrients),
        };
    },

    /**
     * Mapea un producto; los importes llegan como texto con coma y `salePrice` es el precio vigente.
     *
     * @param {Object} item
     * @returns {Object}
     */
    mapItem(item) {
        const self = storeElCorteIngles;
        const prices = self.getPriceSpecification(item);
        const price = product.parseNumber(prices.salePrice);

        return {
            id: item.id,
            name: item.description,
            brand: (item.brand || {}).name,
            imageUrl: item.image,
            price,
            previousPrice: product.parseNumber(prices.price),
            unitPrice: self.isSoldByWeight(item) ? price : product.parseNumber(prices.measurementUnitPrice),
            unitScale: item.pum,
            packageText: item.presentation_detail_quantity || item.description,
            available: true,
            categories: self.getCategories(item),
            detailRef: item.url,
        };
    },
};
