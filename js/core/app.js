/**
 * Entrada de la aplicación: registra los comercios e inicia los componentes.
 */
const app = {
    constants: {
        STORES: [storeAldi, storeMercadona, storeLidl, storeDia, storeCarrefour, storeConsum, storeAlcampo, storeBm, storeEroski, storeElCorteIngles, storeCostco, storeAction, storeAmazon],
        COMPONENTS: [theme, sort, view, results, cart, postalCodeForm, storeFilter, search, dropdown],
    },
    globals: {},
    elements: {},

    /**
     * Registra los comercios en el motor e inicia los componentes de la interfaz.
     */
    init() {
        const { STORES, COMPONENTS } = app.constants;

        STORES.forEach((store) => engine.register(store));
        COMPONENTS.forEach((component) => component.init());
    },

    listeners() {},
};

document.addEventListener('DOMContentLoaded', () => app.init());
