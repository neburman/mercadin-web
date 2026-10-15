/**
 * Selector de comercios en los que buscar; recuerda la selección entre visitas.
 */
const storeFilter = {
    constants: {
        workspace: '#store-filter',
        // Se guardan los desmarcados para que un comercio nuevo aparezca marcado.
        STORAGE_KEY: 'mercadin.excludedStores',
        // Tamaño intrínseco de los favicons; reserva el hueco antes de que carguen.
        LOGO_SIZE: 48,
    },
    globals: {
        selectedIds: [],
    },
    elements: {
        options: '#store-filter .store-filter__options',
        checkbox: '#store-filter .store-filter__checkbox',
    },

    /**
     * Recupera la selección guardada, pinta las opciones y registra los listeners.
     */
    init() {
        const self = storeFilter;

        self.setSelectedIds(self.getStoredSelection());
        self.renderOptions();
        self.listeners();
    },

    listeners() {
        const self = storeFilter;
        const { elements, constants } = self;

        utils.addListener('change', elements.checkbox, () => {
            self.setSelectedIds(self.getCheckedIds());
            self.saveSelection();
            search.submit(true);
        }, constants.workspace);
    },

    // === GETTERS ===

    getSelectedIds() {
        return storeFilter.globals.selectedIds;
    },

    isSelected(storeId) {
        return storeFilter.getSelectedIds().includes(storeId);
    },

    /**
     * Devuelve los comercios registrados menos los que se desmarcaron en otra visita.
     *
     * @returns {Array<string>}
     */
    getStoredSelection() {
        const excludedIds = utils.readStorage(storeFilter.constants.STORAGE_KEY, []);

        return engine.getStoreIds().filter((storeId) => !excludedIds.includes(storeId));
    },

    getCheckedIds() {
        return [...document.querySelectorAll(storeFilter.elements.checkbox)]
            .filter((checkbox) => checkbox.checked)
            .map((checkbox) => checkbox.value);
    },

    // === SETTERS ===

    setSelectedIds(storeIds) {
        storeFilter.globals.selectedIds = storeIds;
    },

    /**
     * Guarda los comercios desmarcados.
     */
    saveSelection() {
        const self = storeFilter;

        utils.writeStorage(self.constants.STORAGE_KEY, engine.getStoreIds().filter((storeId) => !self.isSelected(storeId)));
    },

    // === ACTIONS ===

    /**
     * Pinta una casilla por comercio registrado.
     */
    renderOptions() {
        const self = storeFilter;

        document.querySelector(self.elements.options).innerHTML = engine.getStores()
            .map((store) => self.getOptionHTML(store))
            .join('');
    },

    // === HTML ===

    /**
     * @param {Object} store Adaptador registrado en el motor.
     * @returns {string}
     */
    getOptionHTML(store) {
        const { storeId, storeName } = engine.getOrigin(store);

        return `<label class="chip store-filter__option">
            <input class="store-filter__checkbox visually-hidden" type="checkbox" value="${utils.escapeHtml(storeId)}"${storeFilter.isSelected(storeId) ? ' checked' : ''}>
            ${storeFilter.getLogoHTML(engine.getLogoUrl(store))}
            ${utils.escapeHtml(storeName)}
        </label>`;
    },

    /**
     * @param {string} logoUrl
     * @returns {string}
     */
    getLogoHTML(logoUrl) {
        const { LOGO_SIZE } = storeFilter.constants;

        if (!logoUrl) {
            return '';
        }

        return `<img class="store-filter__logo" src="${utils.escapeHtml(logoUrl)}" alt="" width="${LOGO_SIZE}" height="${LOGO_SIZE}" loading="lazy" decoding="async">`;
    },
};
