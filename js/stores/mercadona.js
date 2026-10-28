/**
 * Adaptador de Mercadona: busca en su índice público de Algolia, que es distinto por almacén.
 */
const storeMercadona = {
    constants: {
        ID: 'mercadona',
        NAME: 'Mercadona',
        LOGO_URL: 'https://tienda.mercadona.es/favicon.ico',
        MODE: 'busqueda',
        // Clave pública de solo búsqueda que expone la propia web de Mercadona.
        ALGOLIA_APP_ID: '7UZJKL1DJ0',
        ALGOLIA_API_KEY: '9d8f2e39e90df472b4f2e559a116fe17',
        // El almacén sale del código postal con una API de Mercadona sin CORS; hasta tener proxy, uno fijo.
        DEFAULT_WAREHOUSE: 'vlc1',
        // Ficha del producto con EAN, ingredientes y alérgenos; no envía cabeceras CORS, así que va por el proxy.
        DETAIL_ENDPOINT: 'https://tienda.mercadona.es/api/products/',
        LANGUAGE: 'es',
        SENTENCE_SEPARATOR: /(?<=\.)\s+/,
    },
    globals: {
        warehouse: '',
    },
    elements: {},

    /**
     * Parte del almacén por defecto.
     */
    init() {
        storeMercadona.globals.warehouse = storeMercadona.constants.DEFAULT_WAREHOUSE;
    },

    listeners() {},

    // === GETTERS ===

    getAlgoliaSource() {
        const { constants, globals } = storeMercadona;

        return { appId: constants.ALGOLIA_APP_ID, apiKey: constants.ALGOLIA_API_KEY, index: `products_prod_${globals.warehouse}_es` };
    },

    getPriceInstructions(hit) {
        return hit.price_instructions || {};
    },

    getCategories(hit) {
        return (hit.categories || []).map((category) => category.name);
    },

    /**
     * Quita las frases repetidas de los alérgenos: la ficha repite «Contiene leche…» por cada proveedor.
     *
     * @param {string} text
     * @returns {string}
     */
    getUniqueSentences(text) {
        return [...new Set(String(text ?? '').split(storeMercadona.constants.SENTENCE_SEPARATOR))].join(' ');
    },

    // === CONTRACT ===

    /**
     * Indica si el comercio da servicio en el código postal.
     *
     * @returns {boolean} De momento siempre true: se busca en el almacén por defecto.
     */
    isAvailable() {
        return true;
    },

    /**
     * Lanza la búsqueda en el índice del almacén actual.
     *
     * @param {string} term
     * @param {AbortSignal} signal
     * @returns {Promise<Object>} Respuesta cruda de Algolia.
     */
    search(term, signal) {
        return algolia.query(storeMercadona.getAlgoliaSource(), term, signal);
    },

    /**
     * Mapea la respuesta a los campos del modelo común, sin validar.
     *
     * @param {Object} raw
     * @returns {Array<Object>}
     */
    toProducts(raw) {
        return algolia.getHits(raw).map((hit) => storeMercadona.mapHit(hit));
    },

    /**
     * Pide la ficha del producto para sacar su código de barras, ingredientes y alérgenos.
     *
     * @param {Object} item Producto del modelo común.
     * @param {AbortSignal} signal
     * @returns {Promise<{ean: string, ingredients: string, allergens: string}>} Ingredientes y alérgenos con los alérgenos en <strong>.
     */
    async getDetail(item, signal) {
        const self = storeMercadona;
        const { constants, globals } = self;
        const raw = await utils.requestProxiedJson(`${constants.DETAIL_ENDPOINT}${encodeURIComponent(item.id)}/`, { lang: constants.LANGUAGE, wh: globals.warehouse }, { signal });
        const nutrition = raw.nutrition_information || {};

        return {
            ean: raw.ean || '',
            ingredients: nutrition.ingredients || '',
            allergens: nutrition.allergens ? self.getUniqueSentences(nutrition.allergens) : '',
        };
    },

    /**
     * Mapea un hit de Algolia; los precios llegan como texto.
     *
     * @param {Object} hit
     * @returns {Object}
     */
    mapHit(hit) {
        const self = storeMercadona;
        const instructions = self.getPriceInstructions(hit);

        return {
            id: hit.id,
            name: hit.display_name,
            brand: hit.brand,
            imageUrl: hit.thumbnail,
            price: product.parseNumber(instructions.unit_price),
            previousPrice: product.parseNumber(instructions.previous_unit_price),
            unitPrice: product.parseNumber(instructions.reference_price),
            unitScale: instructions.reference_format,
            available: hit.published && hit.limit > 0,
            categories: self.getCategories(hit),
        };
    },
};
