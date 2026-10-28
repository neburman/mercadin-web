/**
 * Adaptador de Eroski: no tiene API de catálogo, así que pide la misma página de productos que carga su web
 * al hacer scroll en los resultados (HTML dentro de un JSON) y la lee con DOMParser. Va por el proxy.
 */
const storeEroski = {
    constants: {
        ID: 'eroski',
        NAME: 'Eroski',
        LOGO_URL: 'https://supermercado.eroski.es/assets/favicon-32x32.png',
        MODE: 'busqueda',
        ENDPOINT: 'https://supermercado.eroski.es/es/search/results:loadpage',
        // Cada página trae 20 productos; la primera es la 0.
        FORM_FIELDS: {
            't:zoneid': 'productListZone',
            pageNumber: 0,
        },
        HEADERS: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'x-requested-with': 'XMLHttpRequest',
        },
        // Solo cuando el envase no es de una unidad de referencia: «1 LITRO A 4,05 €».
        UNIT_PRICE_PATTERN: /1\s+([a-z]+)\s+a\s+(\d+(?:[.,]\d+)?)/,
        SELECTORS: {
            card: '.product-item-lineal',
            title: '.product-title-link[data-metrics]',
            previousPrice: '.price-offer-before',
            unitPrice: '.quantity-text',
            image: '.product-img',
        },
        BASE_URL: 'https://supermercado.eroski.es',
        // La ficha solo existe como página HTML: ingredientes en texto y valores nutricionales en lista; no trae EAN.
        DETAIL_SELECTORS: {
            ingredients: '.feature-text-ingredients p.text',
            nutritionBlock: '.feature-list',
            nutritionTitle: '.title',
            nutritionRow: 'ul.list li',
            nutritionValue: 'span',
        },
        NUTRITION_TITLE: 'Información Nutricional',
        // La fila «Cantidad 100 gramos» es la base de la tabla, no un valor.
        NUTRITION_BASE_LABEL: 'Cantidad',
        // «458 kilocaloría it (international table)», «15 gramos»: cifra y unidad escrita entera.
        AMOUNT_PATTERN: /^(\d+(?:[.,]\d+)?)\s*([a-zá-úñ]+)/i,
        UNIT_SYMBOLS: {
            gramos: 'g',
            miligramos: 'mg',
            microgramos: 'µg',
            kilocaloría: 'kcal',
            kilocalorías: 'kcal',
            kilojulios: 'kJ',
            mililitros: 'ml',
        },
    },
    globals: {},
    elements: {},
    init() {},
    listeners() {},

    // === GETTERS ===

    /**
     * Devuelve las tarjetas de producto del HTML de la respuesta, sin banners ni anuncios.
     *
     * @param {Object} raw
     * @returns {Array<Element>}
     */
    getCards(raw) {
        const { SELECTORS } = storeEroski.constants;
        const doc = new DOMParser().parseFromString(raw.content || '', 'text/html');

        return [...doc.querySelectorAll(SELECTORS.card)].filter((card) => card.querySelector(SELECTORS.title));
    },

    getText(card, selector) {
        return (card.querySelector(selector) || {}).textContent || '';
    },

    /**
     * Lee los datos de analítica que Eroski pone en el título: id, nombre, marca y precio vigente.
     *
     * @param {Element} card
     * @returns {Object} { item_id, item_name, item_brand, price }
     */
    getMetrics(card) {
        const metrics = JSON.parse(card.querySelector(storeEroski.constants.SELECTORS.title).dataset.metrics || '{}');

        return ((metrics.ecommerce || {}).items || [])[0] || {};
    },

    /**
     * Lee el precio por unidad de la tarjeta.
     *
     * @param {Element} card
     * @returns {{unitPrice: number|null, unitScale: string}} Escala vacía si no viene; entonces el modelo calcula con el nombre.
     */
    getUnitPrice(card) {
        const self = storeEroski;
        const match = self.getText(card, self.constants.SELECTORS.unitPrice).toLowerCase().match(self.constants.UNIT_PRICE_PATTERN);

        return match ? { unitPrice: product.parseNumber(match[2]), unitScale: match[1] } : { unitPrice: null, unitScale: '' };
    },

    /**
     * Devuelve la dirección de la ficha del producto, sin el puerto que Eroski pone en sus enlaces.
     *
     * @param {Element} card
     * @returns {string} Vacío si la tarjeta no la trae.
     */
    getDetailUrl(card) {
        const href = card.querySelector(storeEroski.constants.SELECTORS.title).getAttribute('href');

        return href ? new URL(href, storeEroski.constants.BASE_URL).href : '';
    },

    /**
     * Lee la lista de valores nutricionales de la ficha y pasa cada unidad escrita entera a su símbolo.
     *
     * @param {Document} doc
     * @returns {Array<{label: string, text: string, isSub: boolean}>}
     */
    getNutrition(doc) {
        const self = storeEroski;
        const { DETAIL_SELECTORS, NUTRITION_TITLE, NUTRITION_BASE_LABEL, AMOUNT_PATTERN, UNIT_SYMBOLS } = self.constants;
        const block = [...doc.querySelectorAll(DETAIL_SELECTORS.nutritionBlock)]
            .find((entry) => self.getText(entry, DETAIL_SELECTORS.nutritionTitle).trim() === NUTRITION_TITLE);

        if (!block) {
            return [];
        }

        return [...block.querySelectorAll(DETAIL_SELECTORS.nutritionRow)]
            .map((row) => {
                const value = self.getText(row, DETAIL_SELECTORS.nutritionValue).trim();
                const label = row.textContent.replace(value, '').trim();
                const match = value.match(AMOUNT_PATTERN);
                const text = match ? utils.formatAmount(product.parseNumber(match[1]), UNIT_SYMBOLS[match[2].toLowerCase()] || match[2]) : value;

                return product.createNutrient(label, text);
            })
            .filter((nutrient) => nutrient.label !== NUTRITION_BASE_LABEL);
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
     * Pide la primera página de resultados de Eroski.
     *
     * @param {string} term
     * @param {AbortSignal} signal
     * @returns {Promise<Object>} Respuesta cruda: el HTML de los productos va en `content`.
     */
    search(term, signal) {
        const { constants } = storeEroski;
        return utils.requestProxiedJson(constants.ENDPOINT, { q: term }, { method: 'POST', headers: constants.HEADERS, body: new URLSearchParams(constants.FORM_FIELDS), signal });
    },

    /**
     * Mapea la respuesta a los campos del modelo común, sin validar.
     *
     * @param {Object} raw
     * @returns {Array<Object>}
     */
    toProducts(raw) {
        return storeEroski.getCards(raw).map((card) => storeEroski.mapCard(card));
    },

    /**
     * Pide la página del producto y lee sus ingredientes y valores nutricionales.
     *
     * @param {Object} item Producto del modelo común; detailRef es la dirección de su ficha.
     * @param {AbortSignal} signal
     * @returns {Promise<{ingredients: string, nutrition: Array<Object>}>} Vacío si no se conoce la dirección.
     */
    async getDetail(item, signal) {
        const self = storeEroski;

        if (!item.detailRef) {
            return {};
        }

        const doc = new DOMParser().parseFromString(await utils.requestProxiedText(item.detailRef, { signal }), 'text/html');

        return {
            ingredients: utils.escapeHtml(self.getText(doc, self.constants.DETAIL_SELECTORS.ingredients).trim()),
            nutrition: self.getNutrition(doc),
        };
    },

    /**
     * Mapea una tarjeta de producto.
     *
     * @param {Element} card
     * @returns {Object}
     */
    mapCard(card) {
        const self = storeEroski;
        const { SELECTORS } = self.constants;
        const metrics = self.getMetrics(card);
        const { unitPrice, unitScale } = self.getUnitPrice(card);

        return {
            id: metrics.item_id,
            name: metrics.item_name,
            brand: metrics.item_brand,
            imageUrl: (card.querySelector(SELECTORS.image) || {}).src || '',
            price: metrics.price,
            previousPrice: product.parseNumber(self.getText(card, SELECTORS.previousPrice).trim()) || null,
            unitPrice,
            unitScale,
            packageText: metrics.item_name,
            available: true,
            categories: [],
            detailRef: self.getDetailUrl(card),
        };
    },
};
