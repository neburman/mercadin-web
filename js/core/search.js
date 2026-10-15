/**
 * Formulario de búsqueda: lanza el motor al escribir (con debounce) o al enviar.
 */
const search = {
    constants: {
        workspace: '#search',
        DEBOUNCE_MS: 400,
        MIN_LENGTH: 3,
    },
    globals: {
        lastTerm: '',
        debouncedSubmit: null,
    },
    elements: {
        form: '#search .search__form',
        input: '#search .search__input',
    },

    /**
     * Prepara el envío con debounce y registra los listeners.
     */
    init() {
        const self = search;

        self.globals.debouncedSubmit = utils.debounce(() => self.submit(false), self.constants.DEBOUNCE_MS);
        self.listeners();
    },

    listeners() {
        const self = search;
        const { elements, globals, constants } = self;

        utils.addListener('submit', elements.form, (event) => {
            event.preventDefault();
            self.submit(true);
        }, constants.workspace);

        utils.addListener('input', elements.input, () => {
            globals.debouncedSubmit();
        }, constants.workspace);
    },

    // === GETTERS ===

    getTerm() {
        return document.querySelector(search.elements.input).value.trim();
    },

    /**
     * Indica si hay que buscar el término.
     *
     * @param {string} term
     * @param {boolean} isExplicit true si se ha enviado el formulario; permite repetir y términos cortos.
     * @returns {boolean}
     */
    shouldSearch(term, isExplicit) {
        const { globals, constants } = search;

        return isExplicit
            ? term.length > 0
            : term.length >= constants.MIN_LENGTH && term !== globals.lastTerm;
    },

    // === ACTIONS ===

    /**
     * Busca el término actual en los comercios elegidos y pinta el resultado; con el campo vacío vuelve al estado inicial.
     *
     * @param {boolean} isExplicit
     */
    async submit(isExplicit) {
        const self = search;
        const term = self.getTerm();
        const storeIds = storeFilter.getSelectedIds();

        if (!term) {
            self.reset();
            return;
        }

        if (!self.shouldSearch(term, isExplicit)) {
            return;
        }

        self.globals.lastTerm = term;

        if (!storeIds.length) {
            engine.abortPending();
            results.renderState('noStores');
            return;
        }

        results.renderState('loading');

        const storeResults = await engine.search(term, storeIds, postalCodeForm.getValue());

        if (storeResults) {
            results.render(storeResults);
        }
    },

    /**
     * Cancela la búsqueda en curso y vuelve al estado inicial.
     */
    reset() {
        search.globals.lastTerm = '';
        engine.abortPending();
        results.renderState('initial');
    },
};
