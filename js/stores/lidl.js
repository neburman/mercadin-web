/**
 * Adaptador de Lidl: busca en el catálogo de su tienda online.
 * Su API admite peticiones desde otras webs, pero responde sin comprimir (casi 500 KB por búsqueda): va por el proxy, que comprime.
 * Online vende sobre todo bazar; la alimentación de tienda apenas aparece.
 */
const storeLidl = {
    constants: {
        ID: 'lidl',
        NAME: 'Lidl',
        LOGO_URL: 'https://www.lidl.es/cdn/assets/logos/1.0.1/lidl-logo-shop-cdn.svg',
        MODE: 'busqueda',
        ENDPOINT: 'https://www.lidl.es/q/api/search',
        QUERY_PARAMS: {
            assortment: 'ES',
            locale: 'es_ES',
            version: 'v2.0.0',
            fetchsize: 40,
        },
        PRODUCT_TYPE: 'product',
        // 0 es agotado; el resto, disponible online o en tienda.
        SOLD_OUT_INDICATOR: 0,
        // La ficha no tiene ingredientes en texto (solo en fotos), pero su estado embebido trae el EAN para buscarlo en Open Food Facts.
        BASE_URL: 'https://www.lidl.es',
        NUXT_DATA_SELECTOR: 'script#__NUXT_DATA__',
        EANS_KEY: 'eans',
    },
    globals: {},
    elements: {},
    init() {},
    listeners() {},

    // === GETTERS ===

    getItems(raw) {
        return (raw.items || []).filter((item) => item.type === storeLidl.constants.PRODUCT_TYPE);
    },

    getData(item) {
        return (item.gridbox || {}).data || {};
    },

    getPrice(data) {
        return data.price || {};
    },

    getPackageText(data) {
        return `${(storeLidl.getPrice(data).packaging || {}).text || ''} ${data.fullTitle || ''}`;
    },

    isSoldOut(data) {
        return (data.stockAvailability || {}).availabilityIndicator === storeLidl.constants.SOLD_OUT_INDICATOR;
    },

    // === CONTRACT ===

    /**
     * Indica si el comercio da servicio en el código postal.
     *
     * @returns {boolean} Siempre true: el catálogo online de Lidl es nacional.
     */
    isAvailable() {
        return true;
    },

    /**
     * Lanza la búsqueda en la API de Lidl.
     *
     * @param {string} term
     * @param {AbortSignal} signal
     * @returns {Promise<Object>} Respuesta cruda.
     */
    search(term, signal) {
        const { constants } = storeLidl;
        return utils.requestProxiedJson(constants.ENDPOINT, { ...constants.QUERY_PARAMS, q: term }, { signal });
    },

    /**
     * Mapea la respuesta a los campos del modelo común, sin validar.
     *
     * @param {Object} raw
     * @returns {Array<Object>}
     */
    toProducts(raw) {
        return storeLidl.getItems(raw).map((item) => storeLidl.mapItem(item));
    },

    /**
     * Pide la página del producto para sacar su EAN.
     *
     * @param {Object} item Producto del modelo común; detailRef es la ruta de su ficha.
     * @param {AbortSignal} signal
     * @returns {Promise<{ean: string}>} Vacío si no se conoce la ruta.
     */
    async getDetail(item, signal) {
        const self = storeLidl;
        const { constants } = self;

        if (!item.detailRef) {
            return {};
        }

        const html = await utils.requestProxiedText(`${constants.BASE_URL}${item.detailRef}`, { signal });
        const script = new DOMParser().parseFromString(html, 'text/html').querySelector(constants.NUXT_DATA_SELECTOR);

        return { ean: script ? self.getNuxtEan(JSON.parse(script.textContent)) : '' };
    },

    /**
     * Lee el primer EAN del estado de Nuxt, serializado como una lista plana donde cada objeto apunta a sus valores por posición.
     *
     * @param {Array<*>} data
     * @returns {string}
     */
    getNuxtEan(data) {
        const { EANS_KEY } = storeLidl.constants;
        const holder = data.find((entry) => entry && typeof entry === 'object' && !Array.isArray(entry) && EANS_KEY in entry);
        const eanIndexes = holder ? data[holder[EANS_KEY]] : [];

        return Array.isArray(eanIndexes) && eanIndexes.length ? String(data[eanIndexes[0]] ?? '') : '';
    },

    /**
     * Mapea un producto; no trae precio de referencia, así que el modelo lo calcula con el envase.
     *
     * @param {Object} item
     * @returns {Object}
     */
    mapItem(item) {
        const self = storeLidl;
        const data = self.getData(item);
        const price = self.getPrice(data);

        return {
            id: data.erpNumber,
            name: data.fullTitle,
            brand: (data.brand || {}).name,
            imageUrl: data.image,
            price: price.price,
            previousPrice: price.oldPrice ?? null,
            packageText: self.getPackageText(data),
            available: !self.isSoldOut(data),
            categories: data.category ? [data.category] : [],
            detailRef: data.canonicalUrl,
        };
    },
};
