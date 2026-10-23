/**
 * Adaptador de Lupa: lanza una consulta GraphQL contra la API de Magento de Lupa Online.
 * Su API no envía cabeceras CORS, así que va por el proxy.
 * Solo reparte en parte del norte de España: con un código postal fuera de su zona de reparto, el comercio queda fuera de zona.
 */
const storeLupa = {
    constants: {
        ID: 'lupa',
        NAME: 'Lupa',
        LOGO_URL: 'https://www.lupaonline.com/media/favicon/default/lupa.png',
        MODE: 'busqueda',
        ENDPOINT: 'https://www.lupaonline.com/graphql',
        // Va por GET para que Magento la sirva desde su caché. Sin cabecera `Store` busca en la tienda de Santander:
        // las tiendas de cada zona comparten precios y solo cambian unos pocos productos del catálogo.
        QUERY: `query MercadinSearch($term: String!, $pageSize: Int!) {
            products(search: $term, pageSize: $pageSize) {
                items {
                    sku name stock_status
                    small_image { url }
                    categories { name }
                    price_range { minimum_price { regular_price { value } final_price { value } } }
                }
            }
        }`,
        // Magento devuelve todo lo que contiene alguna palabra, ordenado por relevancia: el filtro del motor recorta el resto.
        PAGE_SIZE: 100,
        IN_STOCK: 'IN_STOCK',
        // La API no publica la zona de reparto: se lee del desplegable «Zonas de reparto» del pie de su portada, que lista los códigos postales.
        COVERAGE_URL: 'https://www.lupaonline.com/',
        COVERAGE_HEADERS: {
            'Accept': 'text/html',
        },
        POSTAL_CODE_PATTERN: /^\d{5}$/,
        // Lupa abrevia a su manera («160 Grs», «1,5 Lt») y deja sin cifra el litro o el kilo («Brik Litro», «Platano Macho, Kilo», «Polvo Kg.»):
        // se reescriben en la forma que lee el modelo para no caer en el precio por unidad.
        PACKAGE_TEXT_FIXES: [
            { pattern: /(?<!\d\s*)\b(litro|lt|kilo|kg)\b/gi, replacement: '1 $1' },
            { pattern: /(\d)\s*grs\b/gi, replacement: '$1 g' },
            { pattern: /(\d)\s*lts?\b/gi, replacement: '$1 l' },
        ],
        SELECTORS: {
            postalCode: 'select[name="postcode"] option',
        },
    },
    globals: {
        // null hasta que se cargan.
        deliveryPostalCodes: null,
    },
    elements: {},
    init() {},
    listeners() {},

    // === GETTERS ===

    getDeliveryPostalCodes() {
        return storeLupa.globals.deliveryPostalCodes;
    },

    /**
     * Saca de la portada los códigos postales de reparto; el desplegable sale dos veces (pie de PC y de móvil).
     *
     * @param {string} html
     * @returns {Array<string>} Sin repetidos.
     */
    getPostalCodesFromPage(html) {
        const { SELECTORS, POSTAL_CODE_PATTERN } = storeLupa.constants;
        const doc = new DOMParser().parseFromString(html, 'text/html');
        const postalCodes = [...doc.querySelectorAll(SELECTORS.postalCode)].map((option) => option.value);

        return [...new Set(postalCodes)].filter((value) => POSTAL_CODE_PATTERN.test(value));
    },

    getItems(raw) {
        return ((raw.data || {}).products || {}).items || [];
    },

    getMinimumPrice(item) {
        return ((item.price_range || {}).minimum_price) || {};
    },

    getPackageText(name) {
        return storeLupa.constants.PACKAGE_TEXT_FIXES.reduce((text, { pattern, replacement }) => text.replace(pattern, replacement), name || '');
    },

    getParams(term) {
        const { constants } = storeLupa;

        return { query: constants.QUERY, variables: JSON.stringify({ term, pageSize: constants.PAGE_SIZE }) };
    },

    // === SETTERS ===

    setDeliveryPostalCodes(postalCodes) {
        storeLupa.globals.deliveryPostalCodes = postalCodes;
    },

    // === CONTRACT ===

    /**
     * Carga los códigos postales en los que reparte Lupa.
     *
     * @returns {Promise<void>} Falla si la portada no responde o ya no trae la lista.
     */
    async loadCoverage() {
        const self = storeLupa;
        const { constants } = self;
        const response = await fetch(utils.getProxiedUrl(constants.COVERAGE_URL), { headers: constants.COVERAGE_HEADERS });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        const postalCodes = self.getPostalCodesFromPage(await response.text());

        if (!postalCodes.length) {
            throw new Error('La portada ya no trae la lista de códigos postales');
        }

        self.setDeliveryPostalCodes(postalCodes);
    },

    /**
     * Indica si Lupa reparte en el código postal.
     *
     * @param {string} postalCode Vacío si el usuario no lo ha puesto.
     * @returns {boolean} Sin código postal, true: no se sabe la zona. Con código y sin la lista cargada, false: no se puede confirmar que reparta.
     */
    isAvailable(postalCode) {
        const postalCodes = storeLupa.getDeliveryPostalCodes();

        return !postalCode || Boolean(postalCodes && postalCodes.includes(postalCode));
    },

    /**
     * Lanza la búsqueda en la API de Lupa.
     *
     * @param {string} term
     * @param {AbortSignal} signal
     * @returns {Promise<Object>} Respuesta cruda.
     */
    search(term, signal) {
        return utils.requestProxiedJson(storeLupa.constants.ENDPOINT, storeLupa.getParams(term), { signal });
    },

    /**
     * Mapea la respuesta a los campos del modelo común, sin validar.
     *
     * @param {Object} raw
     * @returns {Array<Object>}
     */
    toProducts(raw) {
        return storeLupa.getItems(raw).map((item) => storeLupa.mapItem(item));
    },

    /**
     * Mapea un producto; no trae marca ni precio por unidad, así que el modelo lo calcula con la cantidad del nombre.
     *
     * @param {Object} item
     * @returns {Object}
     */
    mapItem(item) {
        const self = storeLupa;
        const price = self.getMinimumPrice(item);

        return {
            id: item.sku,
            name: item.name,
            brand: '',
            imageUrl: (item.small_image || {}).url || '',
            price: (price.final_price || {}).value,
            previousPrice: (price.regular_price || {}).value ?? null,
            unitPrice: null,
            unitScale: '',
            packageText: self.getPackageText(item.name),
            available: item.stock_status === self.constants.IN_STOCK,
            categories: (item.categories || []).map((category) => category.name),
        };
    },
};
