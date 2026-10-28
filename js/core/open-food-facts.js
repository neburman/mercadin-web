/**
 * Cliente de Open Food Facts: ingredientes, alérgenos, aptitud vegana y valores nutricionales a partir del código de barras.
 * Su API pública admite CORS, así que va directa, sin proxy.
 */
const openFoodFacts = {
    constants: {
        ENDPOINT: 'https://world.openfoodfacts.org/api/v2/product/',
        PRODUCT_URL: 'https://world.openfoodfacts.org/product/',
        // Solo los campos que se pintan: la ficha completa pesa decenas de KB.
        FIELDS: 'ingredients_text_es,ingredients_text,ingredients_analysis_tags,labels_tags,allergens_tags,traces_tags,nutriments',
        LANGUAGE: 'es',
        DIET_STATES: {
            yes: 'yes',
            no: 'no',
            maybe: 'maybe',
            unknown: 'unknown',
        },
        // Los 14 alérgenos de declaración obligatoria en la UE; las etiquetas que no reconoce llegan con otro prefijo y se descartan.
        ALLERGEN_LABELS: {
            'en:gluten': 'gluten',
            'en:crustaceans': 'crustáceos',
            'en:eggs': 'huevo',
            'en:fish': 'pescado',
            'en:peanuts': 'cacahuetes',
            'en:soybeans': 'soja',
            'en:milk': 'leche',
            'en:nuts': 'frutos de cáscara',
            'en:celery': 'apio',
            'en:mustard': 'mostaza',
            'en:sesame-seeds': 'sésamo',
            'en:sulphur-dioxide-and-sulphites': 'sulfitos',
            'en:lupin': 'altramuces',
            'en:molluscs': 'moluscos',
        },
        NUTRIENTS: [
            { key: 'energy-kcal', label: 'Valor energético', unit: 'kcal' },
            { key: 'fat', label: 'Grasas', unit: 'g' },
            { key: 'saturated-fat', label: 'de las cuales saturadas', unit: 'g', isSub: true },
            { key: 'carbohydrates', label: 'Hidratos de carbono', unit: 'g' },
            { key: 'sugars', label: 'de los cuales azúcares', unit: 'g', isSub: true },
            { key: 'fiber', label: 'Fibra alimentaria', unit: 'g' },
            { key: 'proteins', label: 'Proteínas', unit: 'g' },
            { key: 'salt', label: 'Sal', unit: 'g' },
        ],
        NUTRIENT_SUFFIX: '_100g',
        // EAN-13 de uso interno de cada tienda (peso variable, marca blanca local): el mismo código puede ser otro producto en otra cadena.
        IN_STORE_EAN_PATTERN: /^2\d{12}$/,
        // Producto que no está en la base; cualquier otro fallo (límite de peticiones, red) es pasajero.
        NOT_FOUND_ERROR: 'HTTP 404',
    },
    globals: {},
    elements: {},
    init() {},
    listeners() {},

    // === GETTERS ===

    /**
     * Indica si tiene sentido buscar el código: los de uso interno de cada tienda no identifican el producto fuera de ella.
     *
     * @param {string} ean
     * @returns {boolean}
     */
    isSearchable(ean) {
        return Boolean(ean) && !openFoodFacts.constants.IN_STORE_EAN_PATTERN.test(ean);
    },

    isNotFound(error) {
        return error.message === openFoodFacts.constants.NOT_FOUND_ERROR;
    },

    getProductUrl(ean) {
        return `${openFoodFacts.constants.PRODUCT_URL}${encodeURIComponent(ean)}`;
    },

    /**
     * Traduce etiquetas de alérgenos a su nombre en español.
     *
     * @param {Array<string>} tags Por ejemplo, ['en:milk', 'en:gluten'].
     * @returns {Array<string>}
     */
    getAllergenLabels(tags) {
        const { ALLERGEN_LABELS } = openFoodFacts.constants;

        return (tags || []).map((tag) => ALLERGEN_LABELS[tag]).filter(Boolean);
    },

    /**
     * Indica si el producto es apto para una dieta: el sello del envase manda sobre el análisis de ingredientes.
     *
     * @param {Object} raw Producto de Open Food Facts.
     * @param {string} diet 'vegan' o 'vegetarian'.
     * @returns {string} Clave de DIET_STATES.
     */
    getDietState(raw, diet) {
        const { DIET_STATES } = openFoodFacts.constants;
        const analysisTags = raw.ingredients_analysis_tags || [];

        if ((raw.labels_tags || []).includes(`en:${diet}`) || analysisTags.includes(`en:${diet}`)) {
            return DIET_STATES.yes;
        }

        if (analysisTags.includes(`en:non-${diet}`)) {
            return DIET_STATES.no;
        }

        return analysisTags.includes(`en:maybe-${diet}`) ? DIET_STATES.maybe : DIET_STATES.unknown;
    },

    /**
     * Devuelve los valores nutricionales por 100 g o 100 ml que trae la ficha, en el orden de la etiqueta europea.
     *
     * @param {Object} nutriments
     * @returns {Array<{label: string, text: string, isSub: boolean}>}
     */
    getNutrition(nutriments) {
        const { NUTRIENTS, NUTRIENT_SUFFIX } = openFoodFacts.constants;
        const values = nutriments || {};

        return NUTRIENTS
            .filter((nutrient) => Number.isFinite(values[`${nutrient.key}${NUTRIENT_SUFFIX}`]))
            .map((nutrient) => product.createNutrient(nutrient.label, utils.formatAmount(values[`${nutrient.key}${NUTRIENT_SUFFIX}`], nutrient.unit), Boolean(nutrient.isSub)));
    },

    // === ACTIONS ===

    /**
     * Busca un producto por su código de barras.
     *
     * @param {string} ean
     * @param {AbortSignal} signal
     * @returns {Promise<Object|null>} { url, ingredients, allergens, traces, vegan, vegetarian, nutrition }; null si la ficha existe pero está vacía.
     *          Falla si no está en Open Food Facts o la consulta no sale.
     */
    async getProduct(ean, signal) {
        const self = openFoodFacts;
        const { ENDPOINT, FIELDS, LANGUAGE, DIET_STATES } = self.constants;
        const params = new URLSearchParams({ fields: FIELDS, lc: LANGUAGE });
        const raw = (await utils.requestJson(`${ENDPOINT}${encodeURIComponent(ean)}.json?${params}`, { signal })).product || {};
        const info = {
            url: self.getProductUrl(ean),
            ingredients: raw.ingredients_text_es || raw.ingredients_text || '',
            allergens: self.getAllergenLabels(raw.allergens_tags),
            traces: self.getAllergenLabels(raw.traces_tags),
            vegan: self.getDietState(raw, 'vegan'),
            vegetarian: self.getDietState(raw, 'vegetarian'),
            nutrition: self.getNutrition(raw.nutriments),
        };
        // Hay códigos dados de alta sin ningún dato: mostrarlos solo añadiría «Sin datos» y un enlace a una ficha vacía.
        const isEmpty = !info.ingredients && !info.nutrition.length && info.vegan === DIET_STATES.unknown && info.vegetarian === DIET_STATES.unknown;

        return isEmpty ? null : info;
    },
};
