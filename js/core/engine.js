/**
 * Motor de búsqueda: consulta en paralelo los comercios registrados y normaliza sus productos.
 */
const engine = {
    constants: {
        STATUS: {
            ok: 'ok',
            error: 'error',
            unavailable: 'unavailable',
        },
    },
    globals: {
        stores: [],
        controller: null,
    },
    elements: {},
    init() {},
    listeners() {},

    // === GETTERS ===

    getStores() {
        return engine.globals.stores;
    },

    getOrigin(store) {
        return { storeId: store.constants.ID, storeName: store.constants.NAME };
    },

    getLogoUrl(store) {
        return store.constants.LOGO_URL || '';
    },

    getStoreIds() {
        return engine.getStores().map((store) => engine.getOrigin(store).storeId);
    },

    getStoresByIds(storeIds) {
        return engine.getStores().filter((store) => storeIds.includes(engine.getOrigin(store).storeId));
    },

    // === SETTERS ===

    /**
     * Añade un adaptador de comercio al motor y lo inicia.
     *
     * @param {Object} store Objeto que cumple el contrato de adaptador.
     */
    register(store) {
        engine.globals.stores.push(store);
        store.init();
    },

    // === ACTIONS ===

    /**
     * Cancela la búsqueda en curso, si la hay.
     */
    abortPending() {
        const self = engine;

        if (self.globals.controller) {
            self.globals.controller.abort();
            self.globals.controller = null;
        }
    },

    /**
     * Busca el término en los comercios indicados.
     *
     * @param {string} term
     * @param {Array<string>} storeIds
     * @param {string|null} postalCode
     * @returns {Promise<Array<Object>|null>} Un resultado por comercio; null si otra búsqueda la ha sustituido.
     */
    async search(term, storeIds, postalCode = null) {
        const self = engine;
        const stores = self.getStoresByIds(storeIds);

        self.abortPending();
        const controller = new AbortController();
        self.globals.controller = controller;

        const outcomes = await Promise.allSettled(
            stores.map((store) => self.searchStore(store, term, postalCode, controller.signal))
        );

        if (controller.signal.aborted) {
            return null;
        }

        const storeResults = outcomes.map((outcome, index) => self.buildStoreResult(stores[index], outcome, term));
        self.logSummary(term, storeResults);

        return storeResults;
    },

    /**
     * Consulta un comercio y devuelve sus campos mapeados sin validar.
     *
     * @param {Object} store
     * @param {string} term
     * @param {string|null} postalCode
     * @param {AbortSignal} signal
     * @returns {Promise<{status: string, items: Array<Object>}>}
     */
    async searchStore(store, term, postalCode, signal) {
        const { STATUS } = engine.constants;

        if (!store.isAvailable(postalCode)) {
            return { status: STATUS.unavailable, items: [] };
        }

        const raw = await store.search(term, signal);

        return { status: STATUS.ok, items: store.toProducts(raw) };
    },

    /**
     * Indica si un producto nombra lo buscado; los comercios rellenan sus resultados con artículos parecidos o sin relación.
     *
     * @param {Object} fields Campos mapeados por el adaptador.
     * @param {string} term
     * @returns {boolean}
     */
    isRelated(fields, term) {
        return utils.matchesTerm(`${fields.name || ''} ${fields.brand || ''}`, term);
    },

    /**
     * Convierte el resultado de un comercio en productos válidos y relacionados con la búsqueda, con su recuento; `rank` guarda el orden de relevancia del comercio.
     *
     * @param {Object} store
     * @param {PromiseSettledResult} outcome
     * @param {string} term
     * @returns {Object} { storeId, storeName, status, products, returned, unrelated, discarded, error }
     */
    buildStoreResult(store, outcome, term) {
        const self = engine;
        const origin = self.getOrigin(store);

        if (outcome.status === 'rejected') {
            return { ...origin, status: self.constants.STATUS.error, products: [], returned: 0, unrelated: 0, discarded: 0, error: outcome.reason.message };
        }

        const { status, items } = outcome.value;
        const relatedItems = items.filter((fields) => self.isRelated(fields, term));
        const products = relatedItems
            .map((fields) => product.create(fields, origin))
            .filter(Boolean)
            .map((item, rank) => ({ ...item, rank }));

        return {
            ...origin,
            status,
            products,
            returned: items.length,
            unrelated: items.length - relatedItems.length,
            discarded: relatedItems.length - products.length,
            error: '',
        };
    },

    /**
     * Deja en consola el resumen por comercio y los precios calculados, para las pruebas.
     *
     * @param {string} term
     * @param {Array<Object>} storeResults
     */
    logSummary(term, storeResults) {
        console.groupCollapsed(`Búsqueda «${term}»`);
        console.table(storeResults.map(({ storeId, status, returned, unrelated, discarded, error }) => ({ storeId, status, returned, unrelated, discarded, error })));
        console.table(storeResults.flatMap((result) => result.products).map(({ storeId, name, price, previousPrice, unitPrice, unit }) => ({ storeId, name, price, previousPrice, unitPrice, unit })));
        console.groupEnd();
    },
};
