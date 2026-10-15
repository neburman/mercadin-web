/**
 * Pinta los resultados de búsqueda: estados, avisos por comercio y rejilla de productos.
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
        STORE_STATUSES: {
            error: { text: 'Este comercio no responde ahora mismo.', modifier: 'error' },
            unavailable: { text: 'No disponible en tu zona.', modifier: 'unavailable' },
        },
        STORE_STATUS_DEFAULT: { text: '', modifier: '' },
        COUNT_LABELS: { one: 'producto', other: 'productos' },
        PLURAL_RULES: new Intl.PluralRules('es'),
        // Tamaño intrínseco de las miniaturas (cuadradas); reserva el hueco antes de que carguen.
        IMAGE_SIZE: 300,
        TEXTS: {
            outOfStock: 'Sin stock online',
        },
    },
    globals: {
        storeResults: [],
    },
    elements: {
        container: '#results',
    },

    /**
     * Pinta el estado inicial.
     */
    init() {
        results.renderState('initial');
    },

    listeners() {},

    // === GETTERS ===

    getState(stateKey) {
        return results.constants.STATES[stateKey] || results.constants.STATE_DEFAULT;
    },

    getStoreStatus(status) {
        return results.constants.STORE_STATUSES[status] || results.constants.STORE_STATUS_DEFAULT;
    },

    getCountLabel(count) {
        return results.constants.COUNT_LABELS[results.constants.PLURAL_RULES.select(count)];
    },

    getProducts(storeResults) {
        return storeResults.flatMap((storeResult) => storeResult.products);
    },

    getFailedStores(storeResults) {
        return storeResults.filter((storeResult) => results.getStoreStatus(storeResult.status).text);
    },

    // === SETTERS ===

    setStoreResults(storeResults) {
        results.globals.storeResults = storeResults;
    },

    // === ACTIONS ===

    /**
     * Sustituye el contenido del contenedor.
     *
     * @param {string} html
     * @param {boolean} isBusy
     */
    paint(html, isBusy = false) {
        const container = document.querySelector(results.elements.container);

        container.setAttribute('aria-busy', String(isBusy));
        container.innerHTML = html;
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
     * Guarda el resultado de una búsqueda y lo pinta.
     *
     * @param {Array<Object>} storeResults Resultado de engine.search().
     */
    render(storeResults) {
        const self = results;

        self.setStoreResults(storeResults);
        self.repaint();
    },

    /**
     * Vuelve a pintar el último resultado con la ordenación actual: avisos de los comercios que fallan y productos.
     */
    repaint() {
        const self = results;
        const { storeResults } = self.globals;
        const products = sort.apply(self.getProducts(storeResults));
        const failedStores = self.getFailedStores(storeResults);

        sort.toggle(products.length > 0);
        self.paint(`${self.getNoticesHTML(failedStores)}${self.getProductsHTML(products, failedStores.length > 0)}`);
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
     * @param {Array<Object>} failedStores
     * @returns {string}
     */
    getNoticesHTML(failedStores) {
        if (!failedStores.length) {
            return '';
        }

        return `<div class="results__notices">${failedStores.map((storeResult) => results.getNoticeHTML(storeResult)).join('')}</div>`;
    },

    /**
     * @param {Object} storeResult
     * @returns {string}
     */
    getNoticeHTML(storeResult) {
        const { text, modifier } = results.getStoreStatus(storeResult.status);

        return `<p class="notice notice--${modifier}" role="status"><span class="notice__title">${utils.escapeHtml(storeResult.storeName)}:</span> ${utils.escapeHtml(text)}</p>`;
    },

    /**
     * Pinta la rejilla; sin productos, el estado vacío solo si ningún comercio ha fallado.
     *
     * @param {Array<Object>} products
     * @param {boolean} hasFailures
     * @returns {string}
     */
    getProductsHTML(products, hasFailures) {
        const self = results;

        if (!products.length) {
            return hasFailures ? '' : self.getStateHTML(self.getState('empty'));
        }

        return `<p class="results__count">${products.length} ${self.getCountLabel(products.length)}</p>
            <ul class="results__grid">${products.map((item) => self.getProductCardHTML(item)).join('')}</ul>`;
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
