/**
 * Selector de comercios en los que buscar; recuerda la selección entre visitas.
 * Solo muestra los comercios que dan servicio en el código postal; la marca de los demás se conserva para cuando vuelvan a estar en zona.
 */
const storeFilter = {
    constants: {
        workspace: '#store-filter',
        // Se guardan los desmarcados para que un comercio nuevo aparezca marcado.
        STORAGE_KEY: 'mercadin.excludedStores',
        // Tamaño intrínseco de los favicons; reserva el hueco antes de que carguen.
        LOGO_SIZE: 48,
        // Hasta este número de comercios, el resumen los nombra; con más, solo los cuenta.
        MAX_SUMMARY_NAMES: 3,
        SUMMARY_TEXTS: {
            all: 'Todos los comercios',
            none: 'Ningún comercio',
            count: (total) => `${total} comercios`,
        },
        TOGGLE_TEXTS: {
            clear: 'Desmarcar todos',
            selectAll: 'Marcar todos',
        },
    },
    globals: {
        selectedIds: [],
    },
    elements: {
        summary: '#store-filter .store-filter__summary',
        options: '#store-filter .store-filter__options',
        checkbox: '#store-filter .store-filter__checkbox',
        toggle: '#store-filter .store-filter__toggle',
    },

    /**
     * Recupera la selección guardada, pinta el selector y registra los listeners.
     */
    init() {
        const self = storeFilter;

        self.setSelectedIds(self.getStoredSelection());
        self.refresh();
        self.listeners();
    },

    listeners() {
        const self = storeFilter;
        const { elements, constants } = self;

        utils.addListener('change', elements.checkbox, () => {
            self.applySelection(self.getCheckedIds());
        }, constants.workspace);

        utils.addListener('click', elements.toggle, () => {
            self.applySelection(self.getSelectedIds().length ? [] : self.getZoneStoreIds());
            self.renderOptions();
        }, constants.workspace);
    },

    // === GETTERS ===

    getZoneStoreIds() {
        return engine.getAvailableStoreIds(postalCodeForm.getValue());
    },

    isInZone(storeId) {
        return storeFilter.getZoneStoreIds().includes(storeId);
    },

    isSelected(storeId) {
        return storeFilter.globals.selectedIds.includes(storeId);
    },

    /**
     * Devuelve los comercios marcados que dan servicio en el código postal: son en los que se busca.
     *
     * @returns {Array<string>}
     */
    getSelectedIds() {
        return storeFilter.getZoneStoreIds().filter((storeId) => storeFilter.isSelected(storeId));
    },

    getOutOfZoneSelectedIds() {
        return storeFilter.globals.selectedIds.filter((storeId) => !storeFilter.isInZone(storeId));
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

    /**
     * Devuelve el texto del desplegable cerrado según los comercios marcados.
     *
     * @returns {string} Por ejemplo, «Todos los comercios», «Aldi, Dia y Eroski» o «7 comercios».
     */
    getSummaryText() {
        const self = storeFilter;
        const { SUMMARY_TEXTS, MAX_SUMMARY_NAMES } = self.constants;
        const selectedIds = self.getSelectedIds();

        if (!selectedIds.length) {
            return SUMMARY_TEXTS.none;
        }

        if (selectedIds.length === self.getZoneStoreIds().length) {
            return SUMMARY_TEXTS.all;
        }

        if (selectedIds.length > MAX_SUMMARY_NAMES) {
            return SUMMARY_TEXTS.count(selectedIds.length);
        }

        return utils.formatList(engine.getStoresByIds(selectedIds).map((store) => engine.getOrigin(store).storeName));
    },

    /**
     * Devuelve el texto del botón: desmarcar mientras quede alguno marcado; si no, marcar todos.
     *
     * @returns {string}
     */
    getToggleText() {
        const { TOGGLE_TEXTS } = storeFilter.constants;

        return storeFilter.getSelectedIds().length ? TOGGLE_TEXTS.clear : TOGGLE_TEXTS.selectAll;
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
     * Cambia los comercios marcados, guarda la selección, actualiza el resumen y el botón, y repite la búsqueda.
     *
     * @param {Array<string>} storeIds Marcados entre los que están en zona; los de fuera conservan su marca.
     */
    applySelection(storeIds) {
        const self = storeFilter;

        self.setSelectedIds([...self.getOutOfZoneSelectedIds(), ...storeIds]);
        self.saveSelection();
        self.renderSummary();
        self.renderToggle();
        search.refresh();
    },

    /**
     * Pinta de nuevo las opciones, el resumen y el botón de marcar o desmarcar todos; al cambiar el código postal cambian los comercios en zona.
     */
    refresh() {
        const self = storeFilter;

        self.renderOptions();
        self.renderSummary();
        self.renderToggle();
    },

    /**
     * Pinta el conmutador de marcar o desmarcar todos y una casilla por comercio en zona.
     */
    renderOptions() {
        const self = storeFilter;

        document.querySelector(self.elements.options).innerHTML = self.getToggleOptionHTML()
            + engine.getAvailableStores(postalCodeForm.getValue()).map((store) => self.getOptionHTML(store)).join('');
    },

    /**
     * Pinta el resumen de la selección en el desplegable cerrado.
     */
    renderSummary() {
        document.querySelector(storeFilter.elements.summary).textContent = storeFilter.getSummaryText();
    },

    /**
     * Pinta el texto de los conmutadores de marcar o desmarcar todos: el del título y el de la lista.
     */
    renderToggle() {
        const self = storeFilter;

        document.querySelectorAll(self.elements.toggle).forEach((toggle) => {
            toggle.textContent = self.getToggleText();
        });
    },

    // === HTML ===

    /**
     * Pinta el conmutador de marcar o desmarcar todos como primera opción de la lista; el CSS lo oculta en PC.
     *
     * @returns {string}
     */
    getToggleOptionHTML() {
        return `<button class="chip store-filter__toggle store-filter__toggle--option" type="button">${utils.escapeHtml(storeFilter.getToggleText())}</button>`;
    },

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
