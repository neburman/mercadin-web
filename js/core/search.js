/**
 * Formulario de búsqueda: lanza el motor solo al enviar (botón «Buscar» o Intro).
 */
const search = {
    constants: {
        workspace: '#search',
    },
    globals: {
        lastTerm: '',
    },
    elements: {
        form: '#search .search__form',
        input: '#search .search__input',
    },

    /**
     * Registra los listeners.
     */
    init() {
        search.listeners();
    },

    listeners() {
        const self = search;
        const { elements, constants } = self;

        utils.addListener('submit', elements.form, (event) => {
            event.preventDefault();
            self.submit();
        }, constants.workspace);
    },

    // === GETTERS ===

    getTerm() {
        return document.querySelector(search.elements.input).value.trim();
    },

    // === ACTIONS ===

    /**
     * Cierra el teclado del móvil y busca el término escrito; con el campo vacío vuelve al estado inicial.
     */
    submit() {
        const self = search;
        const term = self.getTerm();

        document.querySelector(self.elements.input).blur();

        if (!term) {
            self.reset();
            return;
        }

        self.run(term);
    },

    /**
     * Repite la última búsqueda enviada, para cuando cambian los comercios o el código postal.
     */
    refresh() {
        const { lastTerm } = search.globals;

        if (lastTerm) {
            search.run(lastTerm);
        }
    },

    /**
     * Busca el término en los comercios elegidos y pinta los resultados según responde cada comercio.
     *
     * @param {string} term
     */
    async run(term) {
        const self = search;
        const storeIds = storeFilter.getSelectedIds();
        let isFirstUpdate = true;

        self.globals.lastTerm = term;

        if (!storeIds.length) {
            engine.abortPending();
            results.renderState('noStores');
            return;
        }

        results.renderState('loading');

        const onProgress = (storeResults, pendingIds) => {
            results.render(storeResults, pendingIds, !isFirstUpdate);
            isFirstUpdate = false;
        };

        // La cuenta atrás solo cambia su etiqueta; se repinta todo si aún no hay etiquetas (ningún otro comercio ha respondido).
        await engine.search(term, storeIds, postalCodeForm.getValue(), onProgress, (storeId, secondsLeft, storeResults, pendingIds) => {
            if (!results.renderRetry(storeId, secondsLeft)) {
                onProgress(storeResults, pendingIds);
            }
        });
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
