/**
 * Modelo común de producto: valida lo que mapea cada comercio y calcula el precio por unidad.
 */
const product = {
    constants: {
        UNIT_SCALES: {
            'ud': { unit: 'ud', factor: 1 },
            'unidad': { unit: 'ud', factor: 1 },
            'u': { unit: 'ud', factor: 1 },
            'each': { unit: 'ud', factor: 1 },
            'kg': { unit: 'kg', factor: 1 },
            'kilo': { unit: 'kg', factor: 1 },
            'kilos': { unit: 'kg', factor: 1 },
            '100-g': { unit: 'kg', factor: 10 },
            '100g': { unit: 'kg', factor: 10 },
            '100-gr': { unit: 'kg', factor: 10 },
            'g': { unit: 'kg', factor: 1000 },
            'gr': { unit: 'kg', factor: 1000 },
            'gramos': { unit: 'kg', factor: 1000 },
            'l': { unit: 'l', factor: 1 },
            'litro': { unit: 'l', factor: 1 },
            'litros': { unit: 'l', factor: 1 },
            'litre': { unit: 'l', factor: 1 },
            '100-ml': { unit: 'l', factor: 10 },
            '100ml': { unit: 'l', factor: 10 },
            'cl': { unit: 'l', factor: 100 },
            'ml': { unit: 'l', factor: 1000 },
            'm': { unit: 'm', factor: 1 },
            'm-(metro)': { unit: 'm', factor: 1 },
            'm2': { unit: 'm²', factor: 1 },
            'lavado': { unit: 'lavado', factor: 1 },
            'lv': { unit: 'lavado', factor: 1 },
            'lav': { unit: 'lavado', factor: 1 },
            'bolsita': { unit: 'bolsita', factor: 1 },
            'toallita': { unit: 'toallita', factor: 1 },
            'dc': { unit: 'docena', factor: 1 },
            'dz': { unit: 'docena', factor: 1 },
            'docena': { unit: 'docena', factor: 1 },
            'dozen': { unit: 'docena', factor: 1 },
            'dosis': { unit: 'dosis', factor: 1 },
            'capsula': { unit: 'cápsula', factor: 1 },
            'rollo': { unit: 'rollo', factor: 1 },
            'cacito': { unit: 'cacito', factor: 1 },
        },
        FALLBACK_SCALE: 'ud',
        // «1 Lv», «100 ML.»: el «1» inicial y el punto final no cambian la escala.
        SCALE_NOISE_PATTERN: /^1\s+|\.+$/g,
        // Cantidad del envase: «900 g», «1 l unidad», «pack de 8 x 125 g», «pack 12 latas 33 cl», «pack de 6 briks de 200 ml», «botella 1 litro».
        // Las unidades deben existir en UNIT_SCALES.
        PACKAGE_PATTERN: /(?:(\d+(?:[.,]\d+)?)\s*x\s*|pack\s+(?:de\s+)?(\d+)\s+(?:[a-zñ]+\s+)?(?:de\s+)?)?(\d+(?:[.,]\d+)?)\s*(kilos?|kg|litros?|ml|cl|gramos|gr|g|l)\b/,
        // En escalas pequeñas el punto es de miles («1.000 ml»); en kg o l puede ser decimal («1.5 l»), así que ahí no se toca.
        THOUSANDS_PATTERN: /^\d{1,3}(\.\d{3})+$/,
        THOUSANDS_SCALES: ['ml', 'cl', 'g', 'gr', 'gramos'],
        // Precio por unidad ya formateado: «0,83 €/l», «1,49 €/ud.».
        UNIT_PRICE_TEXT_PATTERN: /(\d+(?:[.,]\d+)?)\s*€\s*\/\s*([a-z\d\s-]+)/,
    },
    globals: {},
    elements: {},
    init() {},
    listeners() {},

    // === GETTERS ===

    /**
     * Devuelve la conversión de una escala cruda del comercio a la unidad común.
     *
     * @param {string} scale Se normaliza a minúsculas, sin tildes ni punto final, sin el «1» inicial y con guiones: «100 ML.» y «100-ml» son la misma.
     * @returns {{unit: string, factor: number}|null} null si la escala no está en la tabla.
     */
    getUnitScale(scale) {
        const { UNIT_SCALES, SCALE_NOISE_PATTERN } = product.constants;

        return UNIT_SCALES[utils.normalizeText(scale).trim().replace(SCALE_NOISE_PATTERN, '').replace(/\s+/g, '-')] || null;
    },

    isPositiveNumber(value) {
        return Number.isFinite(value) && value > 0;
    },

    parseNumber(text) {
        return Number(String(text).replace(',', '.'));
    },

    /**
     * Lee la cantidad del envase en la escala cruda en la que viene escrita.
     *
     * @param {string} text Por ejemplo, «900 g unidad», «pack de 8 x 125 g» o «pack 12 latas 33 cl».
     * @returns {{amount: number, scale: string}|null} null si el texto no trae cantidad.
     */
    parsePackage(text) {
        const self = product;
        const match = String(text ?? '').toLowerCase().match(self.constants.PACKAGE_PATTERN);

        if (!match) {
            return null;
        }

        const [, multiplier, packCount, size, scale] = match;
        const count = multiplier || packCount;

        return { amount: (count ? self.parseNumber(count) : 1) * self.parsePackageSize(size, scale), scale };
    },

    /**
     * Lee la cantidad de un envase teniendo en cuenta el punto de miles en las escalas pequeñas.
     *
     * @param {string} size Por ejemplo, «1.000» o «1,5».
     * @param {string} scale
     * @returns {number}
     */
    parsePackageSize(size, scale) {
        const self = product;
        const { THOUSANDS_PATTERN, THOUSANDS_SCALES } = self.constants;

        if (THOUSANDS_SCALES.includes(scale) && THOUSANDS_PATTERN.test(size)) {
            return Number(size.replace(/\./g, ''));
        }

        return self.parseNumber(size);
    },

    /**
     * Lee un precio por unidad que el comercio solo da como texto.
     *
     * @param {string} text Por ejemplo, «0,83 €/l» o «1,49 €/ud.».
     * @returns {{unitPrice: number|null, unitScale: string}} Escala vacía si el texto no encaja; entonces el modelo calcula con el envase.
     */
    parseUnitPriceText(text) {
        const self = product;
        const match = String(text ?? '').toLowerCase().match(self.constants.UNIT_PRICE_TEXT_PATTERN);

        return match ? { unitPrice: self.parseNumber(match[1]), unitScale: match[2] } : { unitPrice: null, unitScale: '' };
    },

    /**
     * Elige el precio de referencia: el que da el comercio; si no, el calculado con la cantidad del envase; si no, el del envase por unidad.
     *
     * @param {Object} fields Campos mapeados por el adaptador.
     * @returns {{unitPrice: number, unitScale: string}} Precio en la escala cruda, aún sin convertir.
     */
    resolveUnitPrice(fields) {
        const self = product;

        if (String(fields.unitScale ?? '').trim()) {
            return { unitPrice: fields.unitPrice, unitScale: fields.unitScale };
        }

        const pack = self.parsePackage(fields.packageText);

        if (pack && self.isPositiveNumber(pack.amount)) {
            return { unitPrice: fields.price / pack.amount, unitScale: pack.scale };
        }

        return { unitPrice: fields.price, unitScale: self.constants.FALLBACK_SCALE };
    },

    /**
     * Devuelve el precio anterior solo si es una rebaja real sobre el actual.
     *
     * @param {number|null} previousPrice
     * @param {number} price
     * @returns {number|null}
     */
    getPreviousPrice(previousPrice, price) {
        return product.isPositiveNumber(previousPrice) && previousPrice > price ? previousPrice : null;
    },

    /**
     * Devuelve la rebaja sobre el precio anterior.
     *
     * @param {number} price
     * @param {number|null} previousPrice Ya validado por getPreviousPrice().
     * @returns {number} Fracción entre 0 y 1; 0 si no hay rebaja.
     */
    getDiscount(price, previousPrice) {
        return previousPrice ? (previousPrice - price) / previousPrice : 0;
    },

    // === ACTIONS ===

    /**
     * Crea el producto común a partir de los campos que mapea un adaptador.
     *
     * @param {Object} fields { id, name, brand, imageUrl, price, previousPrice, unitPrice, unitScale, packageText, available, categories }
     *                        unitPrice y unitScale son opcionales; sin ellos se calcula con packageText.
     * @param {{storeId: string, storeName: string}} origin
     * @returns {Object|null} null si no supera la validación.
     */
    create(fields, origin) {
        const self = product;
        const { unitPrice, unitScale } = self.resolveUnitPrice(fields);
        const scale = self.getUnitScale(unitScale);

        if (!scale) {
            console.warn(`[${origin.storeId}] Escala de unidad desconocida: «${unitScale}». Añádela a UNIT_SCALES.`, fields);
            return null;
        }

        if (!fields.name || !self.isPositiveNumber(fields.price) || !self.isPositiveNumber(unitPrice)) {
            return null;
        }

        const previousPrice = self.getPreviousPrice(fields.previousPrice, fields.price);

        return {
            ...origin,
            id: String(fields.id),
            name: fields.name,
            brand: fields.brand || '',
            imageUrl: fields.imageUrl || '',
            price: fields.price,
            previousPrice,
            discount: self.getDiscount(fields.price, previousPrice),
            unitPrice: unitPrice * scale.factor,
            unit: scale.unit,
            available: Boolean(fields.available),
            categories: fields.categories || [],
        };
    },
};
