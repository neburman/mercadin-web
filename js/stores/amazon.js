/**
 * Adaptador de Amazon: no tiene API de búsqueda pública, así que pide la página de resultados de Alimentación y bebidas
 * y la lee con DOMParser. Va por el proxy.
 * El precio por unidad lo escribe cada vendedor: suele acertar en los packs que el título no deja leer («195 g, paquete de 4»),
 * pero a veces está mal («16.950 €/l» en una botella de 500 ml) o va por unidad en productos con peso.
 */
const storeAmazon = {
    constants: {
        ID: 'amazon',
        NAME: 'Amazon',
        LOGO_URL: 'https://www.amazon.es/favicon.ico',
        MODE: 'busqueda',
        ENDPOINT: 'https://www.amazon.es/s',
        QUERY_PARAMS: {
            i: 'grocery',
        },
        // Sin una cabecera de navegador, Amazon a veces devuelve la página sin productos.
        HEADERS: {
            'Accept': 'text/html',
        },
        // Sin resultados en Alimentación, Amazon redirige a todos los departamentos: es una búsqueda vacía.
        NO_RESULTS_STATUS: 302,
        // Sin la lista de resultados es un captcha o un desafío antibots (Akamai). Le toca a unas peticiones del proxy sí y a otras no,
        // así que se reintenta antes de dar el comercio por caído.
        RESULTS_MARKER: 's-main-slot',
        MAX_ATTEMPTS: 3,
        // «Recomendado» (PVP) y «Mediano» no son precios anteriores: darían rebajas que nunca existieron.
        PREVIOUS_PRICE_LABELS: ['antes', 'precio original'],
        // El precio por unidad de Amazon solo se usa en peso o volumen y si no multiplica por más de esto el que sale del título.
        MEASURE_UNITS: ['kg', 'l'],
        MAX_UNIT_PRICE_RATIO: 10,
        SELECTORS: {
            card: 'div[data-component-type="s-search-result"][data-asin]:not(.AdHolder)',
            title: 'h2',
            image: 'img.s-image',
            price: '[data-cy="price-recipe"] .a-price:not(.a-text-price) .a-offscreen',
            unitPrice: '[data-cy="price-recipe"] .a-price + .a-size-base',
            previousPrice: '[data-cy="price-recipe"] .a-price[data-a-strike="true"]',
            previousPriceAmount: '.a-offscreen',
        },
    },
    globals: {},
    elements: {},
    init() {},
    listeners() {},

    // === GETTERS ===

    getSearchUrl(term) {
        return `${storeAmazon.constants.ENDPOINT}?${new URLSearchParams({ ...storeAmazon.constants.QUERY_PARAMS, k: term })}`;
    },

    /**
     * Devuelve las tarjetas de producto de la página, sin los patrocinados (se repiten más abajo).
     *
     * @param {string} raw HTML de la página de resultados.
     * @returns {Array<Element>}
     */
    getCards(raw) {
        const doc = new DOMParser().parseFromString(raw, 'text/html');

        return [...doc.querySelectorAll(storeAmazon.constants.SELECTORS.card)].filter((card) => card.dataset.asin);
    },

    getText(element, selector) {
        return ((element && element.querySelector(selector)) || {}).textContent || '';
    },

    getName(card) {
        const title = card.querySelector(storeAmazon.constants.SELECTORS.title);

        return title ? (title.getAttribute('aria-label') || title.textContent).trim() : '';
    },

    /**
     * Lee un importe con formato español; el punto es siempre de miles.
     *
     * @param {string} text Por ejemplo, «1.234,56 €».
     * @returns {number|null}
     */
    parsePrice(text) {
        const amount = String(text).replace(/[^\d,]/g, '').replace(',', '.');

        return amount ? Number(amount) : null;
    },

    /**
     * Lee el precio tachado solo si su etiqueta es la de un precio anterior.
     *
     * @param {Element} card
     * @returns {number|null}
     */
    getPreviousPrice(card) {
        const self = storeAmazon;
        const { SELECTORS, PREVIOUS_PRICE_LABELS } = self.constants;
        const strike = card.querySelector(SELECTORS.previousPrice);
        const label = utils.normalizeText(strike ? strike.parentElement.textContent : '');

        if (!PREVIOUS_PRICE_LABELS.some((previousLabel) => label.includes(previousLabel))) {
            return null;
        }

        return self.parsePrice(self.getText(strike, SELECTORS.previousPriceAmount));
    },

    getAmazonUnitPrice(card) {
        return product.parseUnitPriceText(storeAmazon.getText(card, storeAmazon.constants.SELECTORS.unitPrice));
    },

    /**
     * Calcula el precio por unidad común con la cantidad que trae el título.
     *
     * @param {number|null} price
     * @param {string} name
     * @returns {number|null} null si el título no trae una cantidad reconocible.
     */
    getTitleUnitPrice(price, name) {
        const pack = product.parsePackage(name);
        const scale = pack && product.getUnitScale(pack.scale);

        return scale && product.isPositiveNumber(pack.amount) ? (price / pack.amount) * scale.factor : null;
    },

    /**
     * Elige entre el precio por unidad de Amazon y el del título.
     *
     * @param {Element} card
     * @param {number|null} price
     * @param {string} name
     * @returns {{unitPrice: number|null, unitScale: string}} Escala vacía para que el modelo calcule con el título.
     */
    getUnitPrice(card, price, name) {
        const self = storeAmazon;
        const { MEASURE_UNITS, MAX_UNIT_PRICE_RATIO } = self.constants;
        const fromTitle = { unitPrice: null, unitScale: '' };
        const amazon = self.getAmazonUnitPrice(card);
        const scale = product.getUnitScale(amazon.unitScale);
        const titleUnitPrice = self.getTitleUnitPrice(price, name);

        if (!scale || !product.isPositiveNumber(amazon.unitPrice)) {
            return fromTitle;
        }

        if (titleUnitPrice === null) {
            return amazon;
        }

        const isMeasure = MEASURE_UNITS.includes(scale.unit);
        const isPlausible = amazon.unitPrice * scale.factor <= titleUnitPrice * MAX_UNIT_PRICE_RATIO;

        return isMeasure && isPlausible ? amazon : fromTitle;
    },

    // === CONTRACT ===

    /**
     * Indica si el comercio da servicio en el código postal.
     *
     * @returns {boolean} Siempre true: Amazon envía a toda España.
     */
    isAvailable() {
        return true;
    },

    /**
     * Pide una vez la página de resultados.
     *
     * @param {string} term
     * @param {AbortSignal} signal
     * @returns {Promise<string|null>} HTML de la página; vacío si no hay resultados; null si Amazon ha bloqueado la petición.
     */
    async requestPage(term, signal) {
        const self = storeAmazon;
        const { constants } = self;
        const response = await fetch(utils.getProxiedUrl(self.getSearchUrl(term)), { headers: constants.HEADERS, signal });

        if (response.status === constants.NO_RESULTS_STATUS) {
            return '';
        }

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        const html = await response.text();

        return html.includes(constants.RESULTS_MARKER) ? html : null;
    },

    /**
     * Pide la primera página de resultados de Amazon en Alimentación y bebidas.
     *
     * @param {string} term
     * @param {AbortSignal} signal
     * @returns {Promise<string>} HTML de la página; vacío si no hay resultados.
     */
    async search(term, signal) {
        const self = storeAmazon;

        for (let attempt = 0; attempt < self.constants.MAX_ATTEMPTS; attempt++) {
            const html = await self.requestPage(term, signal);

            if (html !== null) {
                return html;
            }
        }

        throw new Error('Amazon bloquea el proxy');
    },

    /**
     * Mapea la respuesta a los campos del modelo común, sin validar.
     *
     * @param {string} raw
     * @returns {Array<Object>}
     */
    toProducts(raw) {
        return storeAmazon.getCards(raw).map((card) => storeAmazon.mapCard(card));
    },

    /**
     * Mapea una tarjeta de producto; las que no tienen precio (sin stock o solo de otros vendedores) las descarta el modelo.
     *
     * @param {Element} card
     * @returns {Object}
     */
    mapCard(card) {
        const self = storeAmazon;
        const { SELECTORS } = self.constants;
        const name = self.getName(card);
        const price = self.parsePrice(self.getText(card, SELECTORS.price));
        const { unitPrice, unitScale } = self.getUnitPrice(card, price, name);

        return {
            id: card.dataset.asin,
            name,
            brand: '',
            imageUrl: (card.querySelector(SELECTORS.image) || {}).src || '',
            price,
            previousPrice: self.getPreviousPrice(card),
            unitPrice,
            unitScale,
            packageText: name,
            available: true,
            categories: [],
        };
    },
};
