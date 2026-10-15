/**
 * Cliente mínimo de Algolia para los comercios que exponen su buscador público (admite CORS).
 */
const algolia = {
    constants: {
        // Este Content-Type evita el preflight CORS; Algolia acepta el cuerpo JSON igualmente.
        HEADERS: { 'Content-Type': 'application/x-www-form-urlencoded' },
        HITS_PER_PAGE: 40,
    },
    globals: {},
    elements: {},
    init() {},
    listeners() {},

    // === GETTERS ===

    getEndpoint(source) {
        return `https://${source.appId.toLowerCase()}-dsn.algolia.net/1/indexes/${source.index}/query`;
    },

    getCredentials(source) {
        return new URLSearchParams({ 'x-algolia-application-id': source.appId, 'x-algolia-api-key': source.apiKey });
    },

    getHits(raw) {
        return raw.hits || [];
    },

    // === ACTIONS ===

    /**
     * Busca el término en un índice con la clave pública de solo búsqueda del comercio.
     *
     * @param {{appId: string, apiKey: string, index: string}} source
     * @param {string} term
     * @param {AbortSignal} signal
     * @returns {Promise<Object>} Respuesta cruda de Algolia.
     */
    query(source, term, signal) {
        const self = algolia;
        const { constants } = self;

        return utils.requestJson(`${self.getEndpoint(source)}?${self.getCredentials(source)}`, {
            method: 'POST',
            headers: constants.HEADERS,
            body: JSON.stringify({ query: term, hitsPerPage: constants.HITS_PER_PAGE }),
            signal,
        });
    },
};
