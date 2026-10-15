/**
 * Pinta los resultados de búsqueda: estados, estado de cada comercio y rejilla de productos.
 */
const results = {
    constants: {
        STATES: {
            initial: { title: 'Busca un producto', text: 'Escribe lo que quieres comprar, por ejemplo «leche» o «aceite».' },
            loading: { title: 'Buscando…', text: 'Consultando los comercios.' },
            empty: { title: 'Sin resultados', text: 'Prueba con otra palabra o revisa cómo está escrita.' },
            noStores: { title: 'Ningún comercio elegido', text: 'Marca al menos un comercio para buscar.' },
        },
        STATE_DEFAULT: { title: '', text: '' },
        // Solo se etiquetan los comercios que faltan o fallan; las claves coinciden con engine.constants.STATUS, más `pending`.
        STORE_STATES: {
            pending: { modifier: 'pending', detail: 'cargando…' },
            error: { modifier: 'error', detail: 'no responde' },
            unavailable: { modifier: 'unavailable', detail: 'fuera de zona' },
        },
        STORE_STATE_DEFAULT: { modifier: '', detail: '' },
        PENDING_STATE: 'pending',
        COUNT_LABELS: { one: 'producto', other: 'productos' },
        PLURAL_RULES: new Intl.PluralRules('es'),
        // Tamaño intrínseco de las miniaturas (cuadradas); reserva el hueco antes de que carguen.
        IMAGE_SIZE: 300,
        TEXTS: {
            outOfStock: 'Sin stock online',
            storeStatusLabel: 'Comercios cargando o sin respuesta',
        },
        // Tarjetas que se añaden cada vez que el final de la rejilla se acerca a la pantalla.
        PAGE_SIZE: 24,
        // Distancia a la que se pinta el siguiente bloque, para que no se vea el corte al hacer scroll.
        SCROLL_MARGIN: '600px',
    },
    globals: {
        storeResults: [],
        pendingIds: [],
        products: [],
        shownCount: 0,
        observer: null,
    },
    elements: {
        container: '#results',
        grid: '#results .results__grid',
        sentinel: '#results .results__sentinel',
    },

    /**
     * Prepara la carga por scroll y pinta el estado inicial.
     */
    init() {
        const self = results;

        self.globals.observer = new IntersectionObserver((entries) => {
            if (entries.some((entry) => entry.isIntersecting)) {
                self.appendPage();
            }
        }, { rootMargin: self.constants.SCROLL_MARGIN });
        self.renderState('initial');
    },

    listeners() {},

    // === GETTERS ===

    getState(stateKey) {
        return results.constants.STATES[stateKey] || results.constants.STATE_DEFAULT;
    },

    getStoreState(stateKey) {
        return results.constants.STORE_STATES[stateKey] || results.constants.STORE_STATE_DEFAULT;
    },

    getStoreResult(storeResults, storeId) {
        return storeResults.find((storeResult) => storeResult.storeId === storeId) || null;
    },

    getCountLabel(count) {
        return results.constants.COUNT_LABELS[results.constants.PLURAL_RULES.select(count)];
    },

    getProducts(storeResults) {
        return storeResults.flatMap((storeResult) => storeResult.products);
    },

    getFailedStores(storeResults) {
        return storeResults.filter((storeResult) => storeResult.status !== engine.constants.STATUS.ok);
    },

    /**
     * Devuelve los comercios de la búsqueda en el orden de registro, para que sus etiquetas no cambien de sitio al responder.
     *
     * @param {Array<Object>} storeResults
     * @param {Array<string>} pendingIds
     * @returns {Array<string>}
     */
    getSearchedStoreIds(storeResults, pendingIds) {
        const searchedIds = [...pendingIds, ...storeResults.map((storeResult) => storeResult.storeId)];

        return engine.getStoreIds().filter((storeId) => searchedIds.includes(storeId));
    },

    // === SETTERS ===

    /**
     * Guarda los resultados recibidos y los comercios que aún no han respondido.
     *
     * @param {Array<Object>} storeResults
     * @param {Array<string>} pendingIds
     */
    setStoreResults(storeResults, pendingIds) {
        const { globals } = results;

        globals.storeResults = storeResults;
        globals.pendingIds = pendingIds;
    },

    /**
     * Guarda los productos ya ordenados que se irán pintando por bloques.
     *
     * @param {Array<Object>} products
     */
    setProducts(products) {
        const { globals } = results;

        globals.products = products;
        globals.shownCount = 0;
    },

    // === ACTIONS ===

    /**
     * Sustituye el contenido del contenedor y deja de vigilar el scroll del contenido anterior.
     *
     * @param {string} html
     * @param {boolean} isBusy
     */
    paint(html, isBusy = false) {
        const container = document.querySelector(results.elements.container);

        results.globals.observer.disconnect();
        container.setAttribute('aria-busy', String(isBusy));
        container.innerHTML = html;
    },

    /**
     * Añade el siguiente bloque de tarjetas; al pintar el último, quita el marcador de final.
     */
    appendPage() {
        const self = results;
        const { globals, elements, constants } = self;
        const grid = document.querySelector(elements.grid);
        const sentinel = document.querySelector(elements.sentinel);

        if (!grid || !sentinel) {
            return;
        }

        const page = globals.products.slice(globals.shownCount, globals.shownCount + constants.PAGE_SIZE);

        grid.insertAdjacentHTML('beforeend', page.map((item) => self.getProductCardHTML(item)).join(''));
        globals.shownCount += page.length;
        globals.observer.unobserve(sentinel);

        if (globals.shownCount >= globals.products.length) {
            sentinel.remove();
            return;
        }

        // Volver a observar fuerza una comprobación: en pantallas altas el marcador puede seguir visible tras añadir el bloque.
        globals.observer.observe(sentinel);
    },

    /**
     * Pinta uno de los estados de la tabla STATES.
     *
     * @param {string} stateKey
     */
    renderState(stateKey) {
        const self = results;

        sort.toggle(false);
        self.paint(self.getStateHTML(self.getState(stateKey)), stateKey === 'loading');
    },

    /**
     * Guarda los resultados recibidos de una búsqueda y los pinta; se llama cada vez que responde un comercio.
     *
     * @param {Array<Object>} storeResults Resultados recibidos hasta ahora.
     * @param {Array<string>} pendingIds Comercios que aún no han respondido.
     * @param {boolean} keepShown En las actualizaciones de una misma búsqueda, mantiene las tarjetas ya pintadas para que la página no salte.
     */
    render(storeResults, pendingIds = [], keepShown = false) {
        const self = results;

        self.setStoreResults(storeResults, pendingIds);
        self.repaint(keepShown ? self.globals.shownCount : 0);
    },

    /**
     * Vuelve a pintar el último resultado con la ordenación actual: el estado de cada comercio y los productos.
     *
     * @param {number} minShown Tarjetas que deben quedar pintadas como mínimo; por defecto, el primer bloque.
     */
    repaint(minShown = 0) {
        const self = results;
        const { storeResults, pendingIds } = self.globals;
        const products = sort.apply(self.getProducts(storeResults));
        const failedStores = self.getFailedStores(storeResults);
        const isPending = pendingIds.length > 0;

        self.setProducts(products);
        sort.toggle(products.length > 0);
        self.paint(`${self.getStoreStatusesHTML(storeResults, pendingIds)}${self.getProductsHTML(products, failedStores.length > 0, isPending)}`, isPending);
        self.appendPage();

        while (self.globals.shownCount < Math.min(minShown, products.length)) {
            self.appendPage();
        }
    },

    // === HTML ===

    /**
     * @param {{title: string, text: string}} state
     * @returns {string}
     */
    getStateHTML(state) {
        return `<div class="results__state">
            <h2 class="results__state-title">${utils.escapeHtml(state.title)}</h2>
            <p class="results__state-text">${utils.escapeHtml(state.text)}</p>
        </div>`;
    },

    /**
     * Pinta una etiqueta por cada comercio que aún está cargando, no responde o queda fuera de zona; los que han respondido desaparecen.
     *
     * @param {Array<Object>} storeResults
     * @param {Array<string>} pendingIds
     * @returns {string}
     */
    getStoreStatusesHTML(storeResults, pendingIds) {
        const self = results;
        const { PENDING_STATE, TEXTS } = self.constants;
        const items = self.getSearchedStoreIds(storeResults, pendingIds)
            .map((storeId) => ({ storeId, stateKey: (self.getStoreResult(storeResults, storeId) || { status: PENDING_STATE }).status }))
            .filter(({ stateKey }) => stateKey !== engine.constants.STATUS.ok)
            .map(({ storeId, stateKey }) => self.getStoreStatusHTML(storeId, stateKey))
            .join('');

        return items ? `<ul class="store-status-list" aria-label="${utils.escapeHtml(TEXTS.storeStatusLabel)}">${items}</ul>` : '';
    },

    /**
     * @param {string} storeId
     * @param {string} stateKey Clave de STORE_STATES.
     * @returns {string}
     */
    getStoreStatusHTML(storeId, stateKey) {
        const { modifier, detail } = results.getStoreState(stateKey);
        const { storeName } = engine.getOrigin(engine.getStoreById(storeId));

        return `<li class="store-status store-status--${modifier}">
            <span class="store-status__name">${utils.escapeHtml(storeName)}</span>
            <span class="store-status__detail">${utils.escapeHtml(detail)}</span>
        </li>`;
    },

    /**
     * Pinta el contador y la rejilla vacía con su marcador de final; las tarjetas las añade appendPage().
     * Sin productos: mientras falten comercios, nada (ya se ve cuáles faltan); al terminar, el estado vacío solo si ninguno ha fallado.
     *
     * @param {Array<Object>} products
     * @param {boolean} hasFailures
     * @param {boolean} isPending
     * @returns {string}
     */
    getProductsHTML(products, hasFailures, isPending) {
        const self = results;

        if (!products.length) {
            return hasFailures || isPending ? '' : self.getStateHTML(self.getState('empty'));
        }

        return `<p class="results__count">${products.length} ${self.getCountLabel(products.length)}</p>
            <ul class="results__grid" aria-live="off"></ul>
            <div class="results__sentinel" aria-hidden="true"></div>`;
    },

    /**
     * @param {Object} item Producto del modelo común.
     * @returns {string}
     */
    getProductCardHTML(item) {
        const self = results;
        const { TEXTS } = self.constants;

        return `<li class="product-card">
            <div class="product-card__media">${self.getImageHTML(item)}</div>
            <div class="product-card__body">
                <span class="product-card__store">${utils.escapeHtml(item.storeName)}</span>
                <h3 class="product-card__name">${utils.escapeHtml(item.name)}</h3>
                ${item.brand ? `<p class="product-card__brand">${utils.escapeHtml(item.brand)}</p>` : ''}
                ${self.getPriceHTML(item)}
                <p class="product-card__unit-price">${utils.escapeHtml(utils.formatUnitPrice(item.unitPrice, item.unit))}</p>
                ${item.available ? '' : `<span class="product-card__badge">${TEXTS.outOfStock}</span>`}
            </div>
        </li>`;
    },

    /**
     * @param {Object} item
     * @returns {string}
     */
    getImageHTML(item) {
        if (!item.imageUrl) {
            return '';
        }

        const { IMAGE_SIZE } = results.constants;

        return `<img class="product-card__image" src="${utils.escapeHtml(item.imageUrl)}" alt="" width="${IMAGE_SIZE}" height="${IMAGE_SIZE}" loading="lazy" decoding="async">`;
    },

    /**
     * Pinta el precio actual y, si hay rebaja, el anterior tachado.
     *
     * @param {Object} item
     * @returns {string}
     */
    getPriceHTML(item) {
        const isSale = item.previousPrice !== null;

        return `<p class="product-card__price">
            <span class="product-card__price-current${isSale ? ' product-card__price-current--sale' : ''}">${utils.escapeHtml(utils.formatPrice(item.price))}</span>
            ${isSale ? `<s class="product-card__price-previous">${utils.escapeHtml(utils.formatPrice(item.previousPrice))}</s>` : ''}
        </p>`;
    },
};
