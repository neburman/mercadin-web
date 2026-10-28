/**
 * Adaptador de Costco: busca en su tienda de Uber Eats (Costco no tiene API propia de catálogo).
 * Los precios son los de Uber Eats, no los de la tienda física. Va por el proxy.
 */
const storeCostco = {
    constants: {
        ID: 'costco',
        NAME: 'Costco',
        LOGO_URL: 'https://www.costco.es/_ui/responsive/common/images/favicon.png',
        MODE: 'busqueda',
        ENDPOINT: 'https://www.ubereats.com/_p/api/getInStoreSearchV1',
        STORE_UUID: '3fe1f9ef-60bd-559d-8db1-f06d9f4511b7',
        // Uber Eats solo exige que la cabecera exista; el valor da igual.
        HEADERS: {
            'Content-Type': 'application/json',
            'x-csrf-token': 'x',
        },
        CENTS: 100,
        // Ficha del producto: código de barras e ingredientes; sin localeCode los textos llegan en inglés.
        DETAIL_ENDPOINT: 'https://www.ubereats.com/_p/api/getMenuItemV1',
        DETAIL_PARAMS: { localeCode: 'es' },
        GTIN_TYPE: 'GTIN',
        METADATA_TYPE: 'STANDARD_METADATA',
        INGREDIENTS_TYPE: 'ingredients_metadata',
        // «Ingredientes: …\n\n\nContiene: …»: lista de ingredientes y, al final, los alérgenos.
        INGREDIENTS_PREFIX_PATTERN: /^\s*(ingredientes|ingredients)\s*:\s*/i,
        ALLERGENS_SEPARATOR_PATTERN: /\n+\s*(?:contiene|contains)\s*:\s*/i,
        // El GTIN llega con 14 dígitos: el 0 inicial sobra para el EAN-13.
        GTIN_PADDING_PATTERN: /^0(?=\d{13}$)/,
    },
    globals: {},
    elements: {},
    init() {},
    listeners() {},

    // === GETTERS ===

    getItems(raw) {
        return Object.values((raw.data || {}).catalogSectionsMap || {})
            .flat()
            .flatMap((section) => ((section.payload || {}).standardItemsPayload || {}).catalogItems || []);
    },

    getBody(term) {
        return JSON.stringify({
            diningMode: 'DELIVERY',
            sectionUUIDs: null,
            storeUUIDs: [storeCostco.constants.STORE_UUID],
            userQuery: term,
            isGrocery: true,
            targetLocation: {},
            entrypointContext: 'IN_STORE_SEARCH',
        });
    },

    /**
     * Pasa un importe de céntimos a euros; Uber Eats a veces manda fracciones de céntimo en las ofertas.
     *
     * @param {number|undefined} cents
     * @returns {number|null}
     */
    toEuros(cents) {
        return Number.isFinite(cents) ? Math.round(cents) / storeCostco.constants.CENTS : null;
    },

    /**
     * Devuelve el EAN-13 del producto a partir de su GTIN-14.
     *
     * @param {Object} data Ficha del producto.
     * @returns {string}
     */
    getEan(data) {
        const { GTIN_TYPE, GTIN_PADDING_PATTERN } = storeCostco.constants;
        const gtin = ((data.productIdentifiers || []).find((identifier) => identifier.type === GTIN_TYPE) || {}).value || '';

        return gtin.replace(GTIN_PADDING_PATTERN, '');
    },

    /**
     * Devuelve el texto del bloque de ingredientes de la ficha, que acaba con los alérgenos.
     *
     * @param {Object} data
     * @returns {string}
     */
    getIngredientsText(data) {
        const { METADATA_TYPE, INGREDIENTS_TYPE } = storeCostco.constants;
        const metadata = (data.productDetailsItems || [])
            .filter((detail) => detail.type === METADATA_TYPE)
            .map((detail) => ((detail.payload || {}).standardMetadataPayload || {}).metadata || {})
            .find((entry) => entry.type === INGREDIENTS_TYPE);
        const element = ((((metadata || {}).content || {}).richTextElements) || [])[0] || {};

        return ((element.text || {}).text || {}).text || '';
    },

    // === CONTRACT ===

    /**
     * Indica si el comercio da servicio en el código postal.
     *
     * @returns {boolean} De momento siempre true.
     */
    isAvailable() {
        return true;
    },

    /**
     * Lanza la búsqueda en la tienda de Costco de Uber Eats.
     *
     * @param {string} term
     * @param {AbortSignal} signal
     * @returns {Promise<Object>} Respuesta cruda.
     */
    search(term, signal) {
        const self = storeCostco;
        const { constants } = self;

        return utils.requestProxiedJson(constants.ENDPOINT, {}, { method: 'POST', headers: constants.HEADERS, body: self.getBody(term), signal });
    },

    /**
     * Mapea la respuesta a los campos del modelo común, sin validar.
     *
     * @param {Object} raw
     * @returns {Array<Object>}
     */
    toProducts(raw) {
        return storeCostco.getItems(raw).map((item) => storeCostco.mapItem(item));
    },

    /**
     * Pide la ficha del producto en Uber Eats: código de barras, ingredientes y alérgenos.
     *
     * @param {Object} item Producto del modelo común; detailRef lleva la sección y subsección del catálogo.
     * @param {AbortSignal} signal
     * @returns {Promise<{ean: string, ingredients: string, allergens: string}>}
     */
    async getDetail(item, signal) {
        const self = storeCostco;
        const { constants } = self;
        const body = JSON.stringify({ itemRequestType: 'ITEM', storeUuid: constants.STORE_UUID, ...item.detailRef, menuItemUuid: item.id });
        const raw = await utils.requestProxiedJson(constants.DETAIL_ENDPOINT, constants.DETAIL_PARAMS, { method: 'POST', headers: constants.HEADERS, body, signal });
        const data = raw.data || {};
        const [ingredients, allergens = ''] = self.getIngredientsText(data).replace(constants.INGREDIENTS_PREFIX_PATTERN, '').split(constants.ALLERGENS_SEPARATOR_PATTERN);

        return { ean: self.getEan(data), ingredients: ingredients.trim(), allergens: allergens.trim() };
    },

    /**
     * Mapea un producto; no trae precio de referencia, así que el modelo lo calcula con el título («… (1 L)»).
     *
     * @param {Object} item
     * @returns {Object}
     */
    mapItem(item) {
        const self = storeCostco;

        return {
            id: item.uuid,
            name: item.title,
            brand: '',
            imageUrl: item.imageUrl,
            price: self.toEuros(item.price),
            previousPrice: self.toEuros(item.priceBeforeDiscount),
            packageText: item.title,
            available: item.isAvailable !== false && !item.isSoldOut,
            categories: [],
            detailRef: { sectionUuid: item.sectionUuid, subsectionUuid: item.subsectionUuid },
        };
    },
};
