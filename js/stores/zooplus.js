/**
 * Adaptador de Zooplus: no tiene API de búsqueda pública. Su página de resultados es de Next.js: con la cabecera `RSC`
 * devuelve solo los datos de la página (líneas «id:JSON»), y una de ellas trae el estado inicial con los productos. Va por el proxy.
 * Cada producto trae un solo tamaño, con su precio y su precio por kilo, litro o unidad.
 */
const storeZooplus = {
    constants: {
        ID: 'zooplus',
        NAME: 'Zooplus',
        LOGO_URL: 'https://www.zooplus.es/favicon.ico',
        MODE: 'busqueda',
        ENDPOINT: 'https://www.zooplus.es/search/results',
        HEADERS: {
            'RSC': '1',
        },
        STATE_KEY: 'initialStoreState',
        // «PRVP*» es el precio recomendado, no una rebaja real; «Precio normal» es el de los packs comprados por separado.
        PREVIOUS_PRICE_PREFIXES: ['Precio normal'],
    },
    globals: {},
    elements: {},
    init() {},
    listeners() {},

    // === GETTERS ===

    /**
     * Saca el estado inicial de la página de la línea de datos que lo contiene.
     *
     * @param {string} raw Respuesta RSC: una línea «id:JSON» por fragmento de la página.
     * @returns {Object} Vacío si la página no lo trae.
     */
    getStoreState(raw) {
        const { STATE_KEY } = storeZooplus.constants;
        const row = raw.split('\n').find((line) => line.includes(`"${STATE_KEY}"`));
        const element = row ? JSON.parse(row.slice(row.indexOf(':') + 1)) : [];

        return ((Array.isArray(element) ? element : []).find((part) => part && part[STATE_KEY]) || {})[STATE_KEY] || {};
    },

    getProducts(raw) {
        return storeZooplus.getStoreState(raw).products || [];
    },

    getVariant(item) {
        return item.variant || {};
    },

    getPrice(item) {
        return storeZooplus.getVariant(item).price || {};
    },

    /**
     * Lee el precio tachado solo si es un precio anterior y no el recomendado.
     *
     * @param {Object} item
     * @returns {number|null}
     */
    getPreviousPrice(item) {
        const price = storeZooplus.getPrice(item);

        if (!storeZooplus.constants.PREVIOUS_PRICE_PREFIXES.includes(price.beforePricePrefix)) {
            return null;
        }

        return Number(String(price.beforePrice).replace(/[^\d,]/g, '').replace(',', '.')) || null;
    },

    // === CONTRACT ===

    /**
     * Indica si el comercio da servicio en el código postal.
     *
     * @returns {boolean} Siempre true: Zooplus envía a toda España.
     */
    isAvailable() {
        return true;
    },

    /**
     * Pide los datos de la primera página de resultados.
     *
     * @param {string} term
     * @param {AbortSignal} signal
     * @returns {Promise<string>} Respuesta RSC.
     */
    async search(term, signal) {
        const { constants } = storeZooplus;
        const url = `${constants.ENDPOINT}?${new URLSearchParams({ q: term })}`;
        const response = await fetch(utils.getProxiedUrl(url), { headers: constants.HEADERS, signal });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        return response.text();
    },

    /**
     * Mapea la respuesta a los campos del modelo común, sin validar.
     *
     * @param {string} raw
     * @returns {Array<Object>}
     */
    toProducts(raw) {
        return storeZooplus.getProducts(raw).map((item) => storeZooplus.mapItem(item));
    },

    /**
     * Mapea un producto con el tamaño que muestra la búsqueda; sin precio por unidad, el modelo lo calcula con el tamaño.
     *
     * @param {Object} item
     * @returns {Object}
     */
    mapItem(item) {
        const self = storeZooplus;
        const variant = self.getVariant(item);
        const price = self.getPrice(item);
        const size = variant.description || '';

        return {
            id: variant.id || item.shopIdentifier,
            name: size ? `${item.title} - ${size}` : item.title,
            brand: '',
            imageUrl: item.picture200 || '',
            price: price.metaPropPrice,
            previousPrice: self.getPreviousPrice(item),
            unitPrice: price.unit ? price.unitPriceValue : null,
            unitScale: price.unit || '',
            packageText: size || item.title,
            available: variant.available !== false,
            categories: [],
        };
    },
};
