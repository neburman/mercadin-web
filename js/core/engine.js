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
        // Repetir una búsqueda o cambiar los comercios marcados no vuelve a pedir lo ya recibido: ahorra datos
        // y evita que los comercios con protección antibots (Alcampo, El Corte Inglés) bloqueen el proxy.
        CACHE_TTL_MS: 10 * 60 * 1000,
        // Con mala cobertura, un comercio colgado no debe retener los resultados de los demás.
        STORE_TIMEOUT_MS: 10 * 1000,
        NAME_COLLATOR: new Intl.Collator('es', { sensitivity: 'base' }),
    },
    globals: {
        stores: [],
        controller: null,
        cache: new Map(),
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

    /**
     * Devuelve los comercios que dan servicio en el código postal.
     *
     * @param {string} postalCode Vacío si el usuario no lo ha puesto.
     * @returns {Array<Object>}
     */
    getAvailableStores(postalCode) {
        return engine.getStores().filter((store) => store.isAvailable(postalCode));
    },

    getAvailableStoreIds(postalCode) {
        return engine.getAvailableStores(postalCode).map((store) => engine.getOrigin(store).storeId);
    },

    /**
     * Combina la cancelación de la búsqueda con el tiempo máximo de espera de un comercio.
     *
     * @param {AbortSignal} signal
     * @returns {AbortSignal} La señal original en navegadores sin AbortSignal.any.
     */
    getStoreSignal(signal) {
        return AbortSignal.any ? AbortSignal.any([signal, AbortSignal.timeout(engine.constants.STORE_TIMEOUT_MS)]) : signal;
    },

    getStoreById(storeId) {
        return engine.getStoresByIds([storeId])[0] || null;
    },

    /**
     * Devuelve los comercios que aún no han respondido.
     *
     * @param {Array<Object>} stores
     * @param {Array<Object|null>} storeResults Mismo orden que stores; null mientras el comercio no responde.
     * @returns {Array<string>} Sus identificadores.
     */
    getPendingIds(stores, storeResults) {
        return stores.filter((store, index) => !storeResults[index]).map((store) => engine.getOrigin(store).storeId);
    },

    getCacheKey(store, term) {
        return `${engine.getOrigin(store).storeId}|${term.trim().toLowerCase()}`;
    },

    /**
     * Devuelve los productos guardados de una consulta anterior si aún no han caducado.
     *
     * @param {string} cacheKey
     * @returns {Array<Object>|null}
     */
    getCachedItems(cacheKey) {
        const self = engine;
        const entry = self.globals.cache.get(cacheKey);

        if (!entry || Date.now() - entry.savedAt > self.constants.CACHE_TTL_MS) {
            self.globals.cache.delete(cacheKey);
            return null;
        }

        return entry.items;
    },

    // === SETTERS ===

    /**
     * Añade un adaptador de comercio al motor, en orden alfabético, y lo inicia.
     *
     * @param {Object} store Objeto que cumple el contrato de adaptador.
     */
    register(store) {
        const self = engine;
        const { constants, globals } = self;

        globals.stores.push(store);
        globals.stores.sort((storeA, storeB) => constants.NAME_COLLATOR.compare(self.getOrigin(storeA).storeName, self.getOrigin(storeB).storeName));
        store.init();
    },

    /**
     * Guarda los productos de una consulta que ha ido bien; las fallidas no se guardan para reintentarlas.
     *
     * @param {string} cacheKey
     * @param {Array<Object>} items
     */
    setCachedItems(cacheKey, items) {
        engine.globals.cache.set(cacheKey, { items, savedAt: Date.now() });
    },

    // === ACTIONS ===

    /**
     * Carga la zona de reparto de los comercios que la publican (los que tienen `loadCoverage()`); un fallo solo se avisa en consola.
     *
     * @returns {Promise<void>}
     */
    async loadCoverage() {
        const self = engine;
        const stores = self.getStores().filter((store) => store.loadCoverage);
        const outcomes = await Promise.allSettled(stores.map((store) => store.loadCoverage()));

        outcomes.forEach((outcome, index) => {
            if (outcome.status === 'rejected') {
                console.warn(`[${self.getOrigin(stores[index]).storeId}] No se ha podido cargar la zona de reparto.`, outcome.reason);
            }
        });
    },

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
     * Busca el término en los comercios indicados y avisa cada vez que responde uno, para pintar sin esperar al más lento.
     *
     * @param {string} term
     * @param {Array<string>} storeIds
     * @param {string|null} postalCode
     * @param {Function} onProgress Recibe (storeResults, pendingIds): los resultados recibidos hasta ahora y los comercios que faltan.
     * @returns {Promise<Array<Object>|null>} Un resultado por comercio; null si otra búsqueda la ha sustituido.
     */
    async search(term, storeIds, postalCode = null, onProgress = () => {}) {
        const self = engine;
        const stores = self.getStoresByIds(storeIds);
        const storeResults = new Array(stores.length).fill(null);

        self.abortPending();
        const controller = new AbortController();
        self.globals.controller = controller;

        await Promise.all(stores.map(async (store, index) => {
            const outcome = await self.settle(self.searchStore(store, term, postalCode, controller.signal));

            if (controller.signal.aborted) {
                return;
            }

            storeResults[index] = self.buildStoreResult(store, outcome, term);
            onProgress(storeResults.filter(Boolean), self.getPendingIds(stores, storeResults));
        }));

        if (controller.signal.aborted) {
            return null;
        }

        self.logSummary(term, storeResults);

        return storeResults;
    },

    /**
     * Espera una promesa y devuelve su resultado con la forma de Promise.allSettled.
     *
     * @param {Promise} promise
     * @returns {Promise<PromiseSettledResult>}
     */
    async settle(promise) {
        try {
            return { status: 'fulfilled', value: await promise };
        } catch (reason) {
            return { status: 'rejected', reason };
        }
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
        const self = engine;
        const { STATUS } = self.constants;

        if (!store.isAvailable(postalCode)) {
            return { status: STATUS.unavailable, items: [] };
        }

        const cacheKey = self.getCacheKey(store, term);
        const cachedItems = self.getCachedItems(cacheKey);

        if (cachedItems) {
            return { status: STATUS.ok, items: cachedItems };
        }

        const items = store.toProducts(await store.search(term, self.getStoreSignal(signal)));
        self.setCachedItems(cacheKey, items);

        return { status: STATUS.ok, items };
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
