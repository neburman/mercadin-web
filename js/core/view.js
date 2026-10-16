/**
 * Vista de los resultados: lista con todos los datos o mosaico con lo imprescindible; recuerda la última elegida.
 */
const view = {
    constants: {
        workspace: '#view',
        STORAGE_KEY: 'mercadin.view',
        VIEWS: {
            mosaic: {
                label: 'Mosaico',
                icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>',
            },
            list: {
                label: 'Lista',
                icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/></svg>',
            },
        },
        VIEW_ORDER: ['mosaic', 'list'],
        DEFAULT_KEY: 'list',
    },
    globals: {
        viewKey: '',
    },
    elements: {
        options: '#view .view__options',
        radio: '#view .view__radio',
        results: '#results',
    },

    /**
     * Recupera la última vista guardada, pinta las opciones, la aplica a los resultados y registra los listeners.
     */
    init() {
        const self = view;

        self.setViewKey(utils.readStorage(self.constants.STORAGE_KEY, self.constants.DEFAULT_KEY));
        self.renderOptions();
        self.applyView();
        self.listeners();
    },

    listeners() {
        const self = view;
        const { elements, constants } = self;

        utils.addListener('change', elements.radio, function () {
            self.setViewKey(this.value);
            utils.writeStorage(constants.STORAGE_KEY, self.globals.viewKey);
            self.applyView();
        }, constants.workspace);
    },

    // === GETTERS ===

    getView(viewKey) {
        return view.constants.VIEWS[viewKey] || null;
    },

    // === SETTERS ===

    /**
     * Guarda la vista elegida; una clave desconocida vuelve a la de por defecto.
     *
     * @param {string} viewKey
     */
    setViewKey(viewKey) {
        const self = view;

        self.globals.viewKey = self.getView(viewKey) ? viewKey : self.constants.DEFAULT_KEY;
    },

    // === ACTIONS ===

    /**
     * Marca la vista en el contenedor de resultados, de donde la leen los estilos de las tarjetas.
     */
    applyView() {
        document.querySelector(view.elements.results).dataset.view = view.globals.viewKey;
    },

    /**
     * Muestra u oculta el selector según haya productos que ver.
     *
     * @param {boolean} isVisible
     */
    toggle(isVisible) {
        document.querySelector(view.constants.workspace).hidden = !isVisible;
    },

    /**
     * Pinta una opción por vista, en el orden de VIEW_ORDER.
     */
    renderOptions() {
        const self = view;

        document.querySelector(self.elements.options).innerHTML = self.constants.VIEW_ORDER
            .map((viewKey) => self.getOptionHTML(viewKey))
            .join('');
    },

    // === HTML ===

    /**
     * @param {string} viewKey
     * @returns {string}
     */
    getOptionHTML(viewKey) {
        const { label, icon } = view.getView(viewKey);
        const isSelected = viewKey === view.globals.viewKey;

        return `<label class="view__option" title="${utils.escapeHtml(label)}">
            <input class="view__radio visually-hidden" type="radio" name="view" value="${utils.escapeHtml(viewKey)}"${isSelected ? ' checked' : ''}>
            <span class="view__icon" aria-hidden="true">${icon}</span>
            <span class="visually-hidden">${utils.escapeHtml(label)}</span>
        </label>`;
    },
};
