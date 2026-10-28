/**
 * Adaptador de Alcampo: busca en la API de su tienda online.
 * Su API no envía cabeceras CORS, así que va por el proxy.
 */
const storeAlcampo = {
    constants: {
        ID: 'alcampo',
        NAME: 'Alcampo',
        LOGO_URL: 'https://www.compraonline.alcampo.es/favicon.ico',
        MODE: 'busqueda',
        // Sin barra final: con ella responde con una redirección.
        ENDPOINT: 'https://www.compraonline.alcampo.es/api/webproductpagews/v6/product-pages/search',
        QUERY_PARAMS: {
            includeAdditionalPageInfo: true,
            maxPageSize: 40,
            maxProductsToDecorate: 40,
            tag: 'web',
        },
        HEADERS: {
            'ecom-request-source': 'web',
        },
        UNIT_PREFIX: 'fop.price.per.',
        // Ficha del producto: bloques HTML de ingredientes, tabla nutricional y características (a veces con el EAN).
        DETAIL_ENDPOINT: 'https://www.compraonline.alcampo.es/api/webproductpagews/v5/products/bop',
        DETAIL_FIELDS: {
            ingredients: 'ingredients',
            nutrition: 'nutritionalData',
            features: 'features',
        },
        EAN_LABEL: 'EAN',
        // «458.0 Kcal», «15.0 g»: cifra y unidad.
        AMOUNT_PATTERN: /^(\d+(?:[.,]\d+)?)\s*(.*)$/,
    },
    globals: {},
    elements: {},
    init() {},
    listeners() {},

    // === GETTERS ===

    getProductsData(raw) {
        return (raw.productGroups || []).flatMap((group) => group.decoratedProducts || []);
    },

    getUnitPrice(item) {
        return item.unitPrice || {};
    },

    /**
     * Devuelve la escala del precio por unidad sin el prefijo de Alcampo.
     *
     * @param {Object} item
     * @returns {string} Por ejemplo, «litre», «kg», «100ml» o «each».
     */
    getUnitScale(item) {
        return String(storeAlcampo.getUnitPrice(item).unit || '').replace(storeAlcampo.constants.UNIT_PREFIX, '');
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
     * Lanza la búsqueda en la API de Alcampo.
     *
     * @param {string} term
     * @param {AbortSignal} signal
     * @returns {Promise<Object>} Respuesta cruda.
     */
    search(term, signal) {
        const { constants } = storeAlcampo;
        return utils.requestProxiedJson(constants.ENDPOINT, { ...constants.QUERY_PARAMS, q: term }, { signal, headers: constants.HEADERS });
    },

    /**
     * Mapea la respuesta a los campos del modelo común, sin validar.
     *
     * @param {Object} raw
     * @returns {Array<Object>}
     */
    toProducts(raw) {
        return storeAlcampo.getProductsData(raw).map((item) => storeAlcampo.mapItem(item));
    },

    /**
     * Pide la ficha del producto: ingredientes, valores nutricionales y, si viene, el EAN.
     *
     * @param {Object} item Producto del modelo común.
     * @param {AbortSignal} signal
     * @returns {Promise<{ean: string, ingredients: string, nutrition: Array<Object>}>}
     */
    async getDetail(item, signal) {
        const self = storeAlcampo;
        const { constants } = self;
        const raw = await utils.requestProxiedJson(constants.DETAIL_ENDPOINT, { retailerProductId: item.id }, { signal, headers: constants.HEADERS });
        const fields = Object.fromEntries((((raw.bopData || {}).fields) || []).map((field) => [field.title, field.content || '']));
        const { DETAIL_FIELDS } = constants;

        return {
            ean: self.getTableValue(fields[DETAIL_FIELDS.features], constants.EAN_LABEL),
            ingredients: self.getIngredients(fields[DETAIL_FIELDS.ingredients]),
            nutrition: self.getNutrition(fields[DETAIL_FIELDS.nutrition]),
        };
    },

    /**
     * Quita el título «Ingredientes:» del bloque, que ya lo pone el modal.
     *
     * @param {string} html
     * @returns {string}
     */
    getIngredients(html) {
        const doc = new DOMParser().parseFromString(html || '', 'text/html');

        doc.querySelectorAll('h1, h2, h3, h4, h5, h6').forEach((heading) => heading.remove());

        return doc.body.innerHTML.trim();
    },

    /**
     * Devuelve las filas de una tabla HTML de la ficha como pares [nombre, valor], sin las de cabecera.
     *
     * @param {string} html
     * @returns {Array<Array<string>>}
     */
    getTableRows(html) {
        const doc = new DOMParser().parseFromString(html || '', 'text/html');

        return [...doc.querySelectorAll('tr')]
            .map((row) => [...row.querySelectorAll('td')].map((cell) => cell.textContent.trim()))
            .filter((cells) => cells.length >= 2);
    },

    /**
     * Devuelve el valor de la fila de una tabla HTML de la ficha.
     *
     * @param {string} html
     * @param {string} label Nombre de la fila, como «EAN».
     * @returns {string} Vacío si la tabla no tiene esa fila.
     */
    getTableValue(html, label) {
        return (storeAlcampo.getTableRows(html).find(([name]) => name === label) || [])[1] || '';
    },

    /**
     * Pasa la tabla nutricional a filas del modal, con las cifras en formato español.
     *
     * @param {string} html
     * @returns {Array<{label: string, text: string, isSub: boolean}>}
     */
    getNutrition(html) {
        const self = storeAlcampo;

        return self.getTableRows(html).map(([label, value]) => {
            const match = value.match(self.constants.AMOUNT_PATTERN);

            return product.createNutrient(label, match ? utils.formatAmount(product.parseNumber(match[1]), match[2]) : value);
        });
    },

    /**
     * Mapea un producto; los importes llegan como texto y sus ofertas son por volumen, sin precio anterior.
     *
     * @param {Object} item
     * @returns {Object}
     */
    mapItem(item) {
        const self = storeAlcampo;

        return {
            id: item.retailerProductId,
            name: item.name,
            brand: item.brand,
            imageUrl: (item.image || {}).src,
            price: product.parseNumber((item.price || {}).amount),
            previousPrice: null,
            unitPrice: product.parseNumber((self.getUnitPrice(item).price || {}).amount),
            unitScale: self.getUnitScale(item),
            packageText: item.packSizeDescription,
            available: item.available,
            categories: item.categoryPath || [],
        };
    },
};
