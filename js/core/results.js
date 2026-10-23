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
        // Durante la cuenta atrás se ve como un fallo; al llegar a 0, como un comercio que vuelve a cargar.
        RETRY_STATES: {
            countdown: { modifier: 'error', detail: (secondsLeft) => `no responde · reintentando en ${secondsLeft}` },
            now: { modifier: 'pending', detail: () => 'reintentando…' },
        },
        COUNT_LABELS: { one: 'producto', other: 'productos' },
        PLURAL_RULES: new Intl.PluralRules('es'),
        // Tamaño intrínseco de las miniaturas (cuadradas); reserva el hueco antes de que carguen.
        IMAGE_SIZE: 300,
        LOGO_SIZE: 48,
        TEXTS: {
            outOfStock: 'Sin stock online',
            storeStatusLabel: 'Comercios cargando o sin respuesta',
            addToCart: 'Añadir a la lista',
            inCart: 'En la lista',
        },
        // Unidades que suma o resta cada control de la lista en las tarjetas.
        CART_ACTION_DELTAS: { add: 1, increase: 1, decrease: -1 },
        CART_FOCUS_FALLBACKS: { add: 'increase', decrease: 'add' },
        // Tarjetas que se añaden cada vez que el final de la rejilla se acerca a la pantalla.
        PAGE_SIZE: 24,
        // Distancia a la que se pinta el siguiente bloque, para que no se vea el corte al hacer scroll.
        SCROLL_MARGIN: '600px',
    },
    globals: {
        storeResults: [],
        pendingIds: [],
        // Segundos que faltan para reintentar cada comercio pendiente que ha fallado: { storeId: secondsLeft }.
        retries: {},
        products: [],
        shownCount: 0,
        observer: null,
    },
    elements: {
        container: '#results',
        grid: '#results .results__grid',
        sentinel: '#results .results__sentinel',
        getStoreStatus: (storeId) => `#results .store-status[data-store-id="${storeId}"]`,
        cartControl: '#results .product-card__cart',
        cartAction: '#results .product-card__cart [data-cart-action]',
        getCartAction: (action) => `[data-cart-action="${action}"]`,
    },

    /**
     * Prepara la carga por scroll, pinta el estado inicial y registra los listeners.
     */
    init() {
        const self = results;

        self.globals.observer = new IntersectionObserver((entries) => {
            if (entries.some((entry) => entry.isIntersecting)) {
                self.appendPage();
            }
        }, { rootMargin: self.constants.SCROLL_MARGIN });
        self.renderState('initial');
        self.listeners();
    },

    listeners() {
        const self = results;
        const { elements } = self;

        utils.addListener('click', elements.cartAction, function () {
            self.applyCartAction(this.closest(elements.cartControl).dataset.cartKey, this.dataset.cartAction);
        }, elements.container);
    },

    // === GETTERS ===

    getState(stateKey) {
        return results.constants.STATES[stateKey] || results.constants.STATE_DEFAULT;
    },

    getStoreState(stateKey) {
        return results.constants.STORE_STATES[stateKey] || results.constants.STORE_STATE_DEFAULT;
    },

    getRetrySeconds(storeId) {
        return results.globals.retries[storeId] ?? null;
    },

    /**
     * Devuelve cómo se ve la etiqueta de un comercio: su estado si ha respondido; si no, la cuenta atrás del reintento o «cargando…».
     *
     * @param {Array<Object>} storeResults
     * @param {string} storeId
     * @returns {{modifier: string, detail: string}}
     */
    getStoreStatusState(storeResults, storeId) {
        const self = results;
        const { PENDING_STATE, RETRY_STATES } = self.constants;
        const storeResult = self.getStoreResult(storeResults, storeId);
        const secondsLeft = self.getRetrySeconds(storeId);

        if (storeResult || secondsLeft === null) {
            return self.getStoreState(storeResult ? storeResult.status : PENDING_STATE);
        }

        const retryState = secondsLeft > 0 ? RETRY_STATES.countdown : RETRY_STATES.now;

        return { modifier: retryState.modifier, detail: retryState.detail(secondsLeft) };
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

    getProductByCartKey(cartKey) {
        return results.globals.products.find((item) => cart.getKey(item) === cartKey) || null;
    },

    getCartActionDelta(action) {
        return results.constants.CART_ACTION_DELTAS[action] || 0;
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
        storeResults.forEach(({ storeId }) => delete globals.retries[storeId]);
    },

    /**
     * Guarda los segundos que faltan para reintentar un comercio.
     *
     * @param {string} storeId
     * @param {number} secondsLeft 0 mientras se reintenta.
     */
    setRetry(storeId, secondsLeft) {
        results.globals.retries[storeId] = secondsLeft;
    },

    clearRetries() {
        results.globals.retries = {};
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
     * Suma o resta una unidad del producto de una tarjeta; al añadirlo por primera vez guarda sus datos en la lista.
     *
     * @param {string} cartKey
     * @param {string} action Clave de CART_ACTION_DELTAS.
     */
    applyCartAction(cartKey, action) {
        const self = results;
        const delta = self.getCartActionDelta(action);
        const item = self.getProductByCartKey(cartKey);

        if (delta > 0 && item) {
            cart.add(item);
            return;
        }

        if (delta < 0) {
            cart.changeQuantity(cartKey, delta);
        }
    },

    /**
     * Refleja en las tarjetas ya pintadas cuántas unidades de cada producto hay en la lista, sin repintar la rejilla.
     */
    updateCartButtons() {
        const self = results;
        const { elements, constants } = self;

        document.querySelectorAll(elements.cartControl).forEach((control) => {
            const focusedAction = control.contains(document.activeElement) ? document.activeElement.dataset.cartAction : '';

            control.innerHTML = self.getCartControlContentHTML(cart.getQuantity(control.dataset.cartKey));

            // El botón pulsado se sustituye: el foco pasa al mismo control o, si ya no está (añadir, quitar la última unidad), a su equivalente.
            if (focusedAction) {
                (control.querySelector(elements.getCartAction(focusedAction))
                    || control.querySelector(elements.getCartAction(constants.CART_FOCUS_FALLBACKS[focusedAction])))?.focus();
            }
        });
    },

    /**
     * Pinta uno de los estados de la tabla STATES.
     *
     * @param {string} stateKey
     */
    renderState(stateKey) {
        const self = results;

        self.clearRetries();
        sort.toggle(false);
        view.toggle(false);
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
     * Pinta la cuenta atrás del reintento de un comercio en su etiqueta, sin repintar los productos.
     *
     * @param {string} storeId
     * @param {number} secondsLeft
     * @returns {boolean} false si la etiqueta aún no está pintada: entonces hay que repintar los resultados.
     */
    renderRetry(storeId, secondsLeft) {
        const self = results;
        const status = document.querySelector(self.elements.getStoreStatus(storeId));

        self.setRetry(storeId, secondsLeft);

        if (!status) {
            return false;
        }

        status.outerHTML = self.getStoreStatusHTML(storeId, self.getStoreStatusState(self.globals.storeResults, storeId));

        return true;
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
        view.toggle(products.length > 0);
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
        const { TEXTS } = self.constants;
        const items = self.getSearchedStoreIds(storeResults, pendingIds)
            .filter((storeId) => (self.getStoreResult(storeResults, storeId) || {}).status !== engine.constants.STATUS.ok)
            .map((storeId) => self.getStoreStatusHTML(storeId, self.getStoreStatusState(storeResults, storeId)))
            .join('');

        return items ? `<ul class="store-status-list" aria-label="${utils.escapeHtml(TEXTS.storeStatusLabel)}">${items}</ul>` : '';
    },

    /**
     * @param {string} storeId
     * @param {{modifier: string, detail: string}} state
     * @returns {string}
     */
    getStoreStatusHTML(storeId, state) {
        const { modifier, detail } = state;
        const { storeName } = engine.getOrigin(engine.getStoreById(storeId));

        return `<li class="store-status store-status--${modifier}" data-store-id="${utils.escapeHtml(storeId)}">
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
     * Pinta la tarjeta con todos los datos; la vista elegida decide con CSS cuáles se ven.
     *
     * @param {Object} item Producto del modelo común.
     * @returns {string}
     */
    getProductCardHTML(item) {
        const self = results;
        const { TEXTS } = self.constants;

        return `<li class="product-card${item.available ? '' : ' product-card--unavailable'}">
            <div class="product-card__media">${self.getImageHTML(item)}${self.getLogoHTML(engine.getLogoUrl(engine.getStoreById(item.storeId)))}</div>
            <div class="product-card__body">
                <span class="product-card__store">${utils.escapeHtml(item.storeName)}</span>
                <h3 class="product-card__name">${utils.escapeHtml(item.name)}</h3>
                ${item.brand ? `<p class="product-card__brand">${utils.escapeHtml(item.brand)}</p>` : ''}
                ${self.getPriceHTML(item)}
                <p class="product-card__unit-price">${utils.escapeHtml(utils.formatUnitPrice(item.unitPrice, item.unit))}</p>
                ${item.available ? '' : `<span class="product-card__badge">${TEXTS.outOfStock}</span>`}
                ${self.getCartControlHTML(item)}
            </div>
        </li>`;
    },

    /**
     * Pinta el control de la lista de la compra de la tarjeta; su contenido cambia con las unidades sin repintar la tarjeta.
     *
     * @param {Object} item
     * @returns {string}
     */
    getCartControlHTML(item) {
        const cartKey = cart.getKey(item);

        return `<div class="product-card__cart" data-cart-key="${utils.escapeHtml(cartKey)}">${results.getCartControlContentHTML(cart.getQuantity(cartKey))}</div>`;
    },

    /**
     * Sin unidades, el botón de añadir; con unidades, el selector −/cantidad/+.
     *
     * @param {number} quantity Unidades del producto que ya hay en la lista.
     * @returns {string}
     */
    getCartControlContentHTML(quantity) {
        return quantity ? results.getCartStepperHTML(quantity) : results.getCartAddHTML();
    },

    /**
     * Pinta el botón de añadir; en mosaico solo se ve el icono.
     *
     * @returns {string}
     */
    getCartAddHTML() {
        const { TEXTS } = results.constants;

        return `<button class="product-card__cart-add" type="button" data-cart-action="add"><span class="product-card__cart-icon" aria-hidden="true">${cart.getIcon('cart')}</span><span class="product-card__cart-label">${utils.escapeHtml(TEXTS.addToCart)}</span></button>`;
    },

    /**
     * Pinta el selector de unidades; con una sola, restar quita el producto y lleva icono de papelera.
     *
     * @param {number} quantity
     * @returns {string}
     */
    getCartStepperHTML(quantity) {
        const { TEXTS } = results.constants;
        const decrease = cart.getDecreaseControl(quantity);

        return `<div class="product-card__cart-stepper" role="group" aria-label="${utils.escapeHtml(TEXTS.inCart)}">
            <button class="product-card__cart-step" type="button" data-cart-action="decrease" aria-label="${utils.escapeHtml(decrease.label)}">${decrease.icon}</button>
            <span class="product-card__cart-quantity">${quantity}</span>
            <button class="product-card__cart-step" type="button" data-cart-action="increase" aria-label="${utils.escapeHtml(cart.getText('increase'))}">${cart.getIcon('plus')}</button>
        </div>`;
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
     * Pinta el logo del comercio; sin texto alternativo porque el nombre ya va en la tarjeta.
     *
     * @param {string} logoUrl
     * @returns {string}
     */
    getLogoHTML(logoUrl) {
        if (!logoUrl) {
            return '';
        }

        const { LOGO_SIZE } = results.constants;

        return `<img class="product-card__logo" src="${utils.escapeHtml(logoUrl)}" alt="" width="${LOGO_SIZE}" height="${LOGO_SIZE}" loading="lazy" decoding="async">`;
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
