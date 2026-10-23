/**
 * Adaptador de Kiwoko: lee la rejilla de resultados de su tienda online (plataforma Iskaypet). Va por el proxy.
 */
const storeKiwoko = {
    constants: {
        ID: 'kiwoko',
        NAME: 'Kiwoko',
        LOGO_URL: 'https://www.kiwoko.com/favicon.ico',
        MODE: 'busqueda',
        ENDPOINT: 'https://www.kiwoko.com/on/demandware.store/Sites-KiwokoES-Site/default/Search-UpdateGrid',
    },
    globals: {},
    elements: {},
    init() {},
    listeners() {},

    // === CONTRACT ===

    /**
     * Indica si el comercio da servicio en el código postal.
     *
     * @returns {boolean} Siempre true: Kiwoko envía a toda España.
     */
    isAvailable() {
        return true;
    },

    /**
     * Pide la rejilla de resultados.
     *
     * @param {string} term
     * @param {AbortSignal} signal
     * @returns {Promise<string>} HTML de la rejilla.
     */
    search(term, signal) {
        return iskaypet.search(storeKiwoko.constants.ENDPOINT, term, signal);
    },

    /**
     * Mapea la respuesta a los campos del modelo común, sin validar.
     *
     * @param {string} raw
     * @returns {Array<Object>}
     */
    toProducts(raw) {
        return iskaypet.toProducts(raw);
    },
};
