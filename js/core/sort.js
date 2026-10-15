/**
 * Ordenación de los resultados; recuerda la última elegida y, si no hay ninguna, empieza por precio por kg/l.
 */
const sort = {
    constants: {
        workspace: '#sort',
        STORAGE_KEY: 'mercadin.sort',
        LOCALE: 'es',
        // `field` es la propiedad del producto, `direction` 1 ascendente y -1 descendente.
        OPTIONS: {
            relevance: { label: 'Relevancia', field: 'rank', direction: 1, groupByUnit: false },
            unitPrice: { label: 'Precio por kg/l', field: 'unitPrice', direction: 1, groupByUnit: true },
            priceAsc: { label: 'Más barato', field: 'price', direction: 1, groupByUnit: false },
            priceDesc: { label: 'Más caro', field: 'price', direction: -1, groupByUnit: false },
            discount: { label: 'Ofertas', field: 'discount', direction: -1, groupByUnit: false },
            name: { label: 'A-Z', field: 'name', direction: 1, groupByUnit: false },
        },
        OPTION_ORDER: ['relevance', 'unitPrice', 'priceAsc', 'priceDesc', 'discount', 'name'],
        DEFAULT_KEY: 'unitPrice',
    },
    globals: {
        sortKey: '',
    },
    elements: {
        dropdown: '#sort .sort__dropdown',
        summary: '#sort .sort__summary',
        options: '#sort .sort__options',
        radio: '#sort .sort__radio',
    },

    /**
     * Recupera la última ordenación guardada, pinta las opciones y el resumen del desplegable, y registra los listeners.
     */
    init() {
        const self = sort;

        self.setSortKey(utils.readStorage(self.constants.STORAGE_KEY, self.constants.DEFAULT_KEY));
        self.renderOptions();
        self.renderSummary();
        self.listeners();
    },

    listeners() {
        const self = sort;
        const { elements, constants } = self;

        utils.addListener('change', elements.radio, function () {
            self.setSortKey(this.value);
            utils.writeStorage(constants.STORAGE_KEY, self.globals.sortKey);
            self.renderSummary();
            dropdown.closeOnMobile(elements.dropdown);
            results.repaint();
        }, constants.workspace);
    },

    // === GETTERS ===

    getOption(sortKey) {
        return sort.constants.OPTIONS[sortKey] || null;
    },

    getCurrentOption() {
        return sort.getOption(sort.globals.sortKey);
    },

    /**
     * Ordena las unidades de más a menos frecuente en los resultados.
     *
     * @param {Array<Object>} products
     * @returns {Array<string>}
     */
    getUnitOrder(products) {
        const counts = products.reduce((acc, item) => ({ ...acc, [item.unit]: (acc[item.unit] || 0) + 1 }), {});

        return Object.keys(counts).sort((unitA, unitB) => counts[unitB] - counts[unitA]);
    },

    /**
     * Compara dos valores de un campo: números por diferencia y textos según el idioma.
     *
     * @param {number|string} valueA
     * @param {number|string} valueB
     * @returns {number}
     */
    compareValues(valueA, valueB) {
        return typeof valueA === 'string'
            ? valueA.localeCompare(valueB, sort.constants.LOCALE, { sensitivity: 'base' })
            : valueA - valueB;
    },

    // === SETTERS ===

    /**
     * Guarda la ordenación elegida; una clave desconocida (por ejemplo, guardada por una versión anterior) vuelve a la de por defecto.
     *
     * @param {string} sortKey
     */
    setSortKey(sortKey) {
        const self = sort;

        self.globals.sortKey = self.getOption(sortKey) ? sortKey : self.constants.DEFAULT_KEY;
    },

    // === ACTIONS ===

    /**
     * Devuelve una copia de los productos con la ordenación elegida.
     *
     * @param {Array<Object>} products
     * @returns {Array<Object>}
     */
    apply(products) {
        const self = sort;
        const { field, direction, groupByUnit } = self.getCurrentOption();
        const unitOrder = groupByUnit ? self.getUnitOrder(products) : [];

        return [...products].sort((itemA, itemB) => (
            (unitOrder.indexOf(itemA.unit) - unitOrder.indexOf(itemB.unit))
            || direction * self.compareValues(itemA[field], itemB[field])
        ));
    },

    /**
     * Muestra u oculta la ordenación según haya productos que ordenar.
     *
     * @param {boolean} isVisible
     */
    toggle(isVisible) {
        document.querySelector(sort.constants.workspace).hidden = !isVisible;
    },

    /**
     * Pinta la ordenación elegida en el desplegable cerrado.
     */
    renderSummary() {
        document.querySelector(sort.elements.summary).textContent = sort.getCurrentOption().label;
    },

    /**
     * Pinta un botón de opción por ordenación, en el orden de OPTION_ORDER.
     */
    renderOptions() {
        const self = sort;

        document.querySelector(self.elements.options).innerHTML = self.constants.OPTION_ORDER
            .map((sortKey) => self.getOptionHTML(sortKey))
            .join('');
    },

    // === HTML ===

    /**
     * @param {string} sortKey
     * @returns {string}
     */
    getOptionHTML(sortKey) {
        const isSelected = sortKey === sort.globals.sortKey;

        return `<label class="chip chip--solid">
            <input class="sort__radio visually-hidden" type="radio" name="sort" value="${utils.escapeHtml(sortKey)}"${isSelected ? ' checked' : ''}>
            ${utils.escapeHtml(sort.getOption(sortKey).label)}
        </label>`;
    },
};
