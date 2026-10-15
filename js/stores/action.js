/**
 * Adaptador de Action: lanza una consulta GraphQL propia contra la API de búsqueda de su web.
 * Su API no envía cabeceras CORS, así que va por el proxy.
 */
const storeAction = {
    constants: {
        ID: 'action',
        NAME: 'Action',
        LOGO_URL: 'https://www.action.com/favicon.ico',
        MODE: 'busqueda',
        ENDPOINT: 'https://www.action.com/api/graphql',
        OPERATION: 'MercadinSearch',
        // Consulta propia enviada entera, en lugar del hash de la que usa su web, que caduca con cada versión nueva.
        // Es la búsqueda completa de su página de resultados (no la de sugerencias, que da 5) y pide solo los campos que se mapean.
        QUERY: `query MercadinSearch($input: SearchProductsInput!) {
            searchProducts(input: $input) {
                productResults {
                    searchProducts {
                        product {
                            id title description image brand isAvailable
                            price { current { amount } original { amount } unitInfo { formatted } }
                        }
                    }
                }
            }
        }`,
        // Las páginas empiezan en 0; con un límite alto llega todo en una sola petición y en el mismo orden que su web.
        // El tope solo actúa en búsquedas muy genéricas, que el filtro de relevancia del motor recorta igualmente.
        PAGINATION: { page: 0, limitPerPage: 500 },
        HEADERS: {
            'Content-Type': 'application/json',
            'Accept-Language': 'es-ES',
        },
    },
    globals: {},
    elements: {},
    init() {},
    listeners() {},

    // === GETTERS ===

    getItems(raw) {
        return ((((raw.data || {}).searchProducts || {}).productResults || {}).searchProducts || [])
            .map((result) => result.product || {});
    },

    getPrice(item) {
        return item.price || {};
    },

    getBody(term) {
        const { constants } = storeAction;

        return JSON.stringify({
            query: constants.QUERY,
            operationName: constants.OPERATION,
            variables: { input: { searchTerm: term, pagination: constants.PAGINATION } },
        });
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
        const self = storeAction;
        const { constants } = self;

        return utils.requestProxiedJson(constants.ENDPOINT, {}, { method: 'POST', headers: constants.HEADERS, body: self.getBody(term), signal });
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
