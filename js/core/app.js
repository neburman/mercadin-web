/**
 * Entrada de la aplicación: registra los comercios e inicia los componentes.
 */
const app = {
    constants: {
        STORES: [storeAldi, storeMercadona, storeLidl, storeDia, storeCarrefour, storeConsum, storeAlcampo, storeBm, storeEroski, storeElCorteIngles, storeCostco, storeAction, storeAmazon, storeLupa, storePrimor, storeDruni, storeKiwoko, storeTiendanimal, storeZooplus],
        COMPONENTS: [theme, sort, view, results, cart, productDetail, postalCodeForm, storeFilter, search, dropdown],
    },
    globals: {},
    elements: {},

    /**
     * Registra los comercios en el motor, inicia los componentes de la interfaz y, cuando llegan las zonas de reparto,
     * repinta los comercios en zona y repite la búsqueda si ya se había lanzado.
     */
    async init() {
        const { STORES, COMPONENTS } = app.constants;

        STORES.forEach((store) => engine.register(store));
        COMPONENTS.forEach((component) => component.init());
        await engine.loadCoverage();
        storeFilter.refresh();
        search.refresh();
    },

    listeners() {},
};

document.addEventListener('DOMContentLoaded', () => app.init());
