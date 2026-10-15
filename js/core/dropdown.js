/**
 * Desplegables que en móvil y tablet se cierran para ocupar poco y en PC se muestran siempre abiertos.
 * El punto de corte vive solo en el CSS: en PC el resumen (`summary`) está oculto.
 */
const dropdown = {
    constants: {},
    globals: {
        isDesktop: null,
    },
    elements: {
        dropdown: '.dropdown',
        summary: '.dropdown__summary',
    },

    /**
     * Ajusta los desplegables al tamaño de pantalla y registra los listeners.
     */
    init() {
        dropdown.sync();
        dropdown.listeners();
    },

    listeners() {
        window.addEventListener('resize', () => dropdown.sync());
    },

    // === GETTERS ===

    isDesktopLayout() {
        return getComputedStyle(document.querySelector(dropdown.elements.summary)).display === 'none';
    },

    // === ACTIONS ===

    /**
     * Abre los desplegables en PC y los cierra en móvil y tablet, solo al cambiar de uno a otro para no deshacer lo que haga la persona.
     */
    sync() {
        const self = dropdown;
        const { elements, globals } = self;
        const isDesktop = self.isDesktopLayout();

        if (isDesktop === globals.isDesktop) {
            return;
        }

        globals.isDesktop = isDesktop;
        document.querySelectorAll(elements.dropdown).forEach((element) => {
            element.open = isDesktop;
        });
    },

    /**
     * Cierra un desplegable tras elegir una opción, salvo en PC, donde siempre está abierto.
     *
     * @param {string} selector
     */
    closeOnMobile(selector) {
        if (!dropdown.globals.isDesktop) {
            document.querySelector(selector).open = false;
        }
    },
};
