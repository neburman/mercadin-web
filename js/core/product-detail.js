/**
 * Ficha de producto: modal que se abre al pulsar una tarjeta, con los datos del resultado y, si se encuentran,
 * ingredientes, alérgenos, aptitud vegana y valores nutricionales (del propio comercio y de Open Food Facts).
 */
const productDetail = {
    constants: {
        workspace: '#product-detail',
        RESULTS_WORKSPACE: '#results',
        // Tamaño intrínseco de la imagen (cuadrada); reserva el hueco antes de que cargue.
        IMAGE_SIZE: 300,
        TEXTS: {
            loading: 'Buscando ingredientes e información nutricional…',
            outOfStock: 'Sin stock online',
            ingredients: 'Ingredientes',
            allergens: 'Alérgenos',
            traces: 'Puede contener',
            nutrition: 'Información nutricional',
            nutritionPer: 'Por 100 g o 100 ml.',
            dietNote: 'Calculado por Open Food Facts a partir de los ingredientes y los sellos del envase. Compruébalo siempre en el envase.',
            noEan: 'Este comercio no nos da el código de barras ni los ingredientes del producto. Consúltalos en el envase o en su web.',
            notFound: 'No hemos encontrado los ingredientes de este producto. Consúltalos en el envase o en la web del comercio.',
            sources: 'Datos:',
            offLink: 'Ver la ficha en Open Food Facts',
        },
        OFF_NAME: 'Open Food Facts',
        DIET_LABELS: {
            vegan: {
                yes: 'Apto para veganos',
                no: 'No apto para veganos',
                maybe: 'Puede ser apto para veganos',
                unknown: 'Sin datos sobre si es vegano',
            },
            vegetarian: {
                yes: 'Apto para vegetarianos',
                no: 'No apto para vegetarianos',
                maybe: 'Puede ser apto para vegetarianos',
                unknown: 'Sin datos sobre si es vegetariano',
            },
        },
        // Del HTML de los comercios solo se conservan las negritas de los alérgenos; el resto de etiquetas se quedan en su texto.
        BOLD_TAGS: ['STRONG', 'B'],
        BLOCK_TAGS: ['P', 'DIV', 'BR', 'LI', 'UL', 'OL', 'TR', 'TD', 'TH', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6'],
        SKIPPED_TAGS: ['SCRIPT', 'STYLE'],
        // Open Food Facts marca los alérgenos entre guiones bajos: «harina de _trigo_».
        OFF_BOLD_PATTERN: /_([^_]+)_/g,
    },
    globals: {
        // Ficha ya consultada de cada producto: { cartKey: info }.
        cache: new Map(),
        controller: null,
        currentKey: '',
    },
    elements: {
        dialog: '#product-detail',
        title: '#product-detail .product-detail__title',
        content: '#product-detail .product-detail__content',
        close: '#product-detail .product-detail__close',
        open: '#results .product-card__open',
    },

    /**
     * Registra los listeners.
     */
    init() {
        productDetail.listeners();
    },

    listeners() {
        const self = productDetail;
        const { elements, constants } = self;
        const dialog = document.querySelector(elements.dialog);

        utils.addListener('click', elements.open, function () {
            self.open(results.getProductByCartKey(this.dataset.productKey));
        }, constants.RESULTS_WORKSPACE);

        utils.addListener('click', elements.close, () => {
            dialog.close();
        }, constants.workspace);

        // El clic en el fondo llega al propio dialog; el contenido va en un panel que lo cubre entero.
        dialog.addEventListener('click', (event) => {
            if (event.target === dialog) {
                dialog.close();
            }
        });

        // También se cierra con Escape: la consulta en curso ya no hace falta.
        dialog.addEventListener('close', () => {
            self.abort();
        });
    },

    // === GETTERS ===

    getDietLabel(diet, state) {
        return (productDetail.constants.DIET_LABELS[diet] || {})[state] || '';
    },

    /**
     * Pasa a HTML seguro un texto del comercio dejando solo sus negritas.
     *
     * @param {string} html Puede traer párrafos, listas, entidades y negritas.
     * @returns {string}
     */
    getStoreTextHTML(html) {
        const self = productDetail;
        const doc = new DOMParser().parseFromString(String(html ?? ''), 'text/html');

        return self.getNodeHTML(doc.body).replace(/\s+/g, ' ').trim();
    },

    /**
     * Recorre un nodo y devuelve su texto escapado, con las negritas como <strong>.
     *
     * @param {Node} node
     * @returns {string}
     */
    getNodeHTML(node) {
        const self = productDetail;
        const { BOLD_TAGS, BLOCK_TAGS, SKIPPED_TAGS } = self.constants;

        if (node.nodeType === Node.TEXT_NODE) {
            return utils.escapeHtml(node.textContent);
        }

        if (node.nodeType !== Node.ELEMENT_NODE || SKIPPED_TAGS.includes(node.tagName)) {
            return '';
        }

        const content = [...node.childNodes].map((child) => self.getNodeHTML(child)).join('');

        if (BOLD_TAGS.includes(node.tagName)) {
            return `<strong>${content}</strong>`;
        }

        // Los bloques (párrafos, saltos, celdas) separan palabras que en el HTML original van pegadas.
        return BLOCK_TAGS.includes(node.tagName) ? ` ${content} ` : content;
    },

    /**
     * Pasa a HTML los ingredientes de Open Food Facts con los alérgenos en negrita.
     *
     * @param {string} text
     * @returns {string}
     */
    getOffTextHTML(text) {
        return utils.escapeHtml(text).replace(productDetail.constants.OFF_BOLD_PATTERN, '<strong>$1</strong>');
    },

    /**
     * Consulta la ficha del comercio, si la tiene, y con el código de barras la de Open Food Facts.
     * Un fallo en cualquiera de las dos solo deja sin esos datos.
     *
     * @param {Object} item Producto del modelo común.
     * @param {AbortSignal} signal
     * @returns {Promise<{ean: string, store: Object, off: Object|null, isComplete: boolean}>} isComplete es false si algo falló
     *          por un motivo pasajero (antibots, límite de peticiones, red): entonces no se guarda y se reintenta al volver a abrirla.
     */
    async fetchInfo(item, signal) {
        const store = engine.getStoreById(item.storeId);
        let isComplete = true;
        const storeDetail = store && store.getDetail ? await store.getDetail(item, signal).catch(() => {
            isComplete = false;
            return {};
        }) : {};
        const ean = item.ean || storeDetail.ean || '';
        const off = openFoodFacts.isSearchable(ean) ? await openFoodFacts.getProduct(ean, signal).catch((error) => {
            isComplete = isComplete && openFoodFacts.isNotFound(error);
            return null;
        }) : null;

        return { ean, store: storeDetail, off, isComplete };
    },

    // === ACTIONS ===

    /**
     * Abre la ficha con los datos del resultado y carga los ingredientes si aún no se habían consultado.
     *
     * @param {Object|null} item
     */
    async open(item) {
        const self = productDetail;
        const { elements, globals } = self;

        if (!item) {
            return;
        }

        const key = cart.getKey(item);

        self.abort();
        globals.currentKey = key;
        document.querySelector(elements.title).textContent = item.name;
        self.render(item, globals.cache.get(key) || null);
        document.querySelector(elements.dialog).showModal();

        if (globals.cache.has(key)) {
            return;
        }

        globals.controller = new AbortController();

        const { signal } = globals.controller;
        const info = await self.fetchInfo(item, signal);

        if (signal.aborted || globals.currentKey !== key) {
            return;
        }

        if (info.isComplete) {
            globals.cache.set(key, info);
        }

        self.render(item, info);
    },

    /**
     * Cancela la consulta en curso, si la hay.
     */
    abort() {
        const { globals } = productDetail;

        globals.controller?.abort();
        globals.controller = null;
    },

    /**
     * Pinta el contenido del modal.
     *
     * @param {Object} item
     * @param {Object|null} info null mientras se consulta.
     */
    render(item, info) {
        const self = productDetail;
        const content = document.querySelector(self.elements.content);

        content.setAttribute('aria-busy', String(!info));
        content.innerHTML = `${self.getSummaryHTML(item)}${info ? self.getInfoHTML(item, info) : self.getLoadingHTML()}`;
    },

    // === HTML ===

    /**
     * Pinta la imagen, el comercio, la marca y los precios del resultado.
     *
     * @param {Object} item
     * @returns {string}
     */
    getSummaryHTML(item) {
        const self = productDetail;
        const { IMAGE_SIZE, TEXTS } = self.constants;

        return `<div class="product-detail__summary">
            <div class="product-detail__media">${item.imageUrl ? `<img class="product-detail__image" src="${utils.escapeHtml(item.imageUrl)}" alt="" width="${IMAGE_SIZE}" height="${IMAGE_SIZE}" decoding="async">` : ''}</div>
            <div class="product-detail__facts">
                <span class="product-detail__store">${utils.escapeHtml(item.storeName)}</span>
                ${item.brand ? `<p class="product-detail__brand">${utils.escapeHtml(item.brand)}</p>` : ''}
                ${results.getPriceHTML(item)}
                <p class="product-detail__unit-price">${utils.escapeHtml(utils.formatUnitPrice(item.unitPrice, item.unit))}</p>
                ${item.available ? '' : `<span class="product-card__badge">${utils.escapeHtml(TEXTS.outOfStock)}</span>`}
            </div>
        </div>`;
    },

    getLoadingHTML() {
        return `<p class="product-detail__status" role="status">${utils.escapeHtml(productDetail.constants.TEXTS.loading)}</p>`;
    },

    /**
     * Pinta los datos encontrados; los del comercio mandan sobre los de Open Food Facts, que completa lo que falte.
     *
     * @param {Object} item
     * @param {{ean: string, store: Object, off: Object|null}} info
     * @returns {string}
     */
    getInfoHTML(item, info) {
        const self = productDetail;
        const { TEXTS } = self.constants;
        const { store, off } = info;
        const offData = off || { ingredients: '', allergens: [], traces: [], nutrition: [] };
        const ingredientsHTML = store.ingredients ? self.getStoreTextHTML(store.ingredients) : self.getOffTextHTML(offData.ingredients);
        const allergensHTML = store.allergens ? self.getStoreTextHTML(store.allergens) : utils.escapeHtml(utils.formatList(offData.allergens));
        const storeNutrition = store.nutrition || [];
        const nutrition = storeNutrition.length ? storeNutrition : offData.nutrition;

        if (!ingredientsHTML && !nutrition.length) {
            return `${off ? self.getDietsHTML(off) : ''}<p class="product-detail__status" role="status">${utils.escapeHtml(info.ean ? TEXTS.notFound : TEXTS.noEan)}</p>`;
        }

        const hasStoreData = Boolean(store.ingredients || store.allergens || storeNutrition.length);

        return `${off ? self.getDietsHTML(off) : ''}
            ${ingredientsHTML ? self.getSectionHTML(TEXTS.ingredients, `<p class="product-detail__text">${ingredientsHTML}</p>`) : ''}
            ${allergensHTML ? self.getSectionHTML(TEXTS.allergens, `<p class="product-detail__text">${allergensHTML}</p>`) : ''}
            ${offData.traces.length ? self.getSectionHTML(TEXTS.traces, `<p class="product-detail__text">${utils.escapeHtml(utils.formatList(offData.traces))}</p>`) : ''}
            ${nutrition.length ? self.getSectionHTML(TEXTS.nutrition, self.getNutritionHTML(nutrition)) : ''}
            ${self.getSourcesHTML(hasStoreData ? item.storeName : '', off)}`;
    },

    /**
     * Pinta si es apto para veganos y vegetarianos según Open Food Facts.
     *
     * @param {Object} off
     * @returns {string}
     */
    getDietsHTML(off) {
        const self = productDetail;
        const diets = ['vegan', 'vegetarian'].map((diet) => `<li class="product-detail__diet product-detail__diet--${off[diet]}">${utils.escapeHtml(self.getDietLabel(diet, off[diet]))}</li>`).join('');

        return `<div class="product-detail__diets">
            <ul class="product-detail__diet-list">${diets}</ul>
            <p class="fine-print">${utils.escapeHtml(self.constants.TEXTS.dietNote)}</p>
        </div>`;
    },

    /**
     * @param {string} title
     * @param {string} bodyHTML Ya escapado.
     * @returns {string}
     */
    getSectionHTML(title, bodyHTML) {
        return `<section class="product-detail__section">
            <h3 class="product-detail__section-title">${utils.escapeHtml(title)}</h3>
            ${bodyHTML}
        </section>`;
    },

    /**
     * Pinta la tabla de valores nutricionales; los «de los cuales» van sangrados bajo su grupo.
     *
     * @param {Array<{label: string, text: string, isSub: boolean}>} nutrition
     * @returns {string}
     */
    getNutritionHTML(nutrition) {
        const rows = nutrition.map((nutrient) => `<tr class="product-detail__nutrient${nutrient.isSub ? ' product-detail__nutrient--sub' : ''}">
            <th scope="row">${utils.escapeHtml(nutrient.label)}</th>
            <td>${utils.escapeHtml(nutrient.text)}</td>
        </tr>`).join('');

        return `<p class="fine-print">${utils.escapeHtml(productDetail.constants.TEXTS.nutritionPer)}</p>
            <table class="product-detail__nutrition"><tbody>${rows}</tbody></table>`;
    },

    /**
     * Pinta de dónde salen los datos y el enlace a la ficha de Open Food Facts.
     *
     * @param {string} storeName Vacío si el comercio no ha aportado datos.
     * @param {Object|null} off
     * @returns {string}
     */
    getSourcesHTML(storeName, off) {
        const { TEXTS, OFF_NAME } = productDetail.constants;
        const sources = [storeName, off ? OFF_NAME : ''].filter(Boolean);
        const offLink = off ? ` <a href="${utils.escapeHtml(off.url)}" target="_blank" rel="noopener">${utils.escapeHtml(TEXTS.offLink)}</a>` : '';

        return `<p class="fine-print product-detail__sources">${utils.escapeHtml(`${TEXTS.sources} ${utils.formatList(sources)}.`)}${offLink}</p>`;
    },
};
