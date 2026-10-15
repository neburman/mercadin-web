/**
 * Adaptador de Action: lanza la consulta GraphQL de búsqueda de su web.
 * Su API no envía cabeceras CORS, así que va por el proxy.
 */
const storeAction = {
    constants: {
        ID: 'action',
        NAME: 'Action',
        LOGO_URL: 'https://www.action.com/favicon.ico',
        MODE: 'busqueda',
        ENDPOINT: 'https://www.action.com/api/graphql',
        OPERATION: 'SearchProductsWithSuggestions',
        // Huella de la consulta guardada en su servidor: cambia cuando Action publica una versión nueva de su web
        // y entonces responde PersistedQueryNotFound. Se saca de la petición a /api/graphql al buscar en action.com.
        QUERY_HASH: '3acbb3bfc26cd52387028f110b0b59b7f658d11cb790ce12eb766f6b53e94348',
        LANGUAGE: 'es-ES',
        // Sin apollo-require-preflight su servidor rechaza la petición como posible CSRF.
        HEADERS: {
            'apollo-require-preflight': 'true',
            'Accept-Language': 'es-ES',
        },
    },
    globals: {},
    elements: {},
    init() {},
    listeners() {},

    // === GETTERS ===

    getItems(raw) {
        return ((((raw.data || {}).searchWithSuggestions || {}).productResults || {}).searchProducts || [])
            .map((result) => result.product || {});
    },

    getPrice(item) {
        return item.price || {};
    },

    getUrl(term) {
        const { constants } = storeAction;
        const params = new URLSearchParams({
            operationName: constants.OPERATION,
            variables: JSON.stringify({ input: { searchTerm: term } }),
            extensions: JSON.stringify({ persistedQuery: { sha256Hash: constants.QUERY_HASH, version: 1 }, headers: { 'Accept-Language': constants.LANGUAGE } }),
        });

        return `${constants.ENDPOINT}?${params}`;
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
     * Lanza la búsqueda en la API de Action.
     *
     * @param {string} term
     * @param {AbortSignal} signal
     * @returns {Promise<Object>} Respuesta cruda.
     */
    search(term, signal) {
        return utils.requestJson(utils.getProxiedUrl(storeAction.getUrl(term)), { signal, headers: storeAction.constants.HEADERS });
    },

    /**
     * Mapea la respuesta a los campos del modelo común, sin validar.
     *
     * @param {Object} raw
     * @returns {Array<Object>}
     */
    toProducts(raw) {
        return storeAction.getItems(raw).map((item) => storeAction.mapItem(item));
    },

    /**
     * Mapea un producto; el precio por unidad solo viene formateado como texto.
     *
     * @param {Object} item
     * @returns {Object}
     */
    mapItem(item) {
        const price = storeAction.getPrice(item);
        const { unitPrice, unitScale } = product.parseUnitPriceText((price.unitInfo || {}).formatted);

        return {
            id: item.id,
            name: item.title,
            brand: item.brand,
            imageUrl: item.image,
            price: (price.current || {}).amount,
            previousPrice: (price.original || {}).amount ?? null,
            unitPrice,
            unitScale,
            packageText: `${item.title || ''} ${item.description || ''}`,
            available: item.isAvailable,
            categories: [],
        };
    },
};
