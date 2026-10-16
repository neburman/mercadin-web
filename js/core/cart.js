/**
 * Lista de la compra: productos guardados desde los resultados, agrupados por comercio, con cantidad y marca de comprado.
 * Se guarda en el navegador con el precio que tenía cada producto al añadirlo.
 */
const cart = {
    constants: {
        workspace: '#cart',
        TOGGLE_WORKSPACE: '#cart-toggle',
        STORAGE_KEY: 'mercadin.cart',
        COUNT_LABELS: { one: 'producto pendiente', other: 'productos pendientes' },
        PLURAL_RULES: new Intl.PluralRules('es'),
        // Tamaño intrínseco de miniaturas y logos (cuadrados); reserva el hueco antes de que carguen.
        IMAGE_SIZE: 300,
        LOGO_SIZE: 48,
        TEXTS: {
            toggleLabel: 'Lista de la compra',
            emptyTitle: 'Tu lista está vacía',
            emptyText: 'Añade productos desde los resultados para tenerlos a mano en cada comercio.',
            markBought: 'Marcar como comprado',
            markStoreBought: 'Marcar todo como comprado en',
            decrease: 'Quitar una unidad',
            increase: 'Añadir una unidad',
            remove: 'Quitar de la lista',
            quantity: 'Cantidad',
            confirmClear: '¿Vaciar la lista de la compra?',
        },
        ICONS: {
            cart: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="20" r="1.5"/><circle cx="18" cy="20" r="1.5"/><path d="M2 3h3l2.6 12.4a1.5 1.5 0 0 0 1.5 1.1h8.8a1.5 1.5 0 0 0 1.5-1.1L21 7H6"/></svg>',
            minus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M5 12h14"/></svg>',
            plus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>',
            trash: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14M10 11v6M14 11v6"/></svg>',
        },
    },
    globals: {
        items: [],
    },
    elements: {
        toggle: '#cart-toggle',
        dialog: '#cart',
        content: '#cart .cart__content',
        footer: '#cart .cart__footer',
        total: '#cart .cart__total-amount',
        close: '#cart .cart__close',
        clear: '#cart .cart__clear',
        removeBought: '#cart .cart__remove-bought',
        itemCheck: '#cart .cart__item-check',
        storeCheck: '#cart .cart__store-check',
        decrease: '#cart .cart__decrease',
        increase: '#cart .cart__increase',
        remove: '#cart .cart__remove',
    },

    /**
     * Recupera la lista guardada, la pinta y registra los listeners.
     */
    init() {
        const self = cart;

        self.load();
        self.render();
        self.listeners();
    },

    listeners() {
        const self = cart;
        const { elements, constants } = self;
        const dialog = document.querySelector(elements.dialog);

        // ═══ Abrir y cerrar
        utils.addListener('click', elements.toggle, () => {
            self.open();
        }, constants.TOGGLE_WORKSPACE);

        utils.addListener('click', elements.close, () => {
            self.close();
        }, constants.workspace);

        // El clic en el fondo llega al propio dialog; el contenido va en un panel que lo cubre entero.
        dialog.addEventListener('click', (event) => {
            if (event.target === dialog) {
                self.close();
            }
        });

        // ═══ Productos
        utils.addListener('change', elements.itemCheck, function () {
            self.toggleBought(this.dataset.key, this.checked);
        }, constants.workspace);

        utils.addListener('change', elements.storeCheck, function () {
            self.toggleStoreBought(this.dataset.storeId, this.checked);
        }, constants.workspace);

        utils.addListener('click', elements.decrease, function () {
            self.changeQuantity(this.dataset.key, -1);
        }, constants.workspace);

        utils.addListener('click', elements.increase, function () {
            self.changeQuantity(this.dataset.key, 1);
        }, constants.workspace);

        utils.addListener('click', elements.remove, function () {
            self.remove(this.dataset.key);
        }, constants.workspace);

        // ═══ Acciones de la lista
        utils.addListener('click', elements.removeBought, () => {
            self.removeBought();
        }, constants.workspace);

        utils.addListener('click', elements.clear, () => {
            self.clear();
        }, constants.workspace);

        // Otra pestaña ha cambiado la lista: se adopta la suya para no pisarla al guardar.
        window.addEventListener('storage', (event) => {
            if (event.key === constants.STORAGE_KEY) {
                self.load();
                self.render();
            }
        });
    },

    // === GETTERS ===

    getItems() {
        return cart.globals.items;
    },

    getItem(key) {
        return cart.getItems().find((item) => item.key === key) || null;
    },

    getKey(item) {
        return `${item.storeId}:${item.id}`;
    },

    getQuantity(key) {
        return (cart.getItem(key) || { quantity: 0 }).quantity;
    },

    getIcon(iconKey) {
        return cart.constants.ICONS[iconKey] || '';
    },

    getText(textKey) {
        return cart.constants.TEXTS[textKey] || '';
    },

    /**
     * Devuelve el icono y el texto del botón de restar: con una sola unidad, restar quita el producto.
     *
     * @param {number} quantity
     * @returns {{icon: string, label: string}}
     */
    getDecreaseControl(quantity) {
        return quantity > 1
            ? { icon: cart.getIcon('minus'), label: cart.getText('decrease') }
            : { icon: cart.getIcon('trash'), label: cart.getText('remove') };
    },

    getStoreItems(storeId) {
        return cart.getItems().filter((item) => item.storeId === storeId);
    },

    getPendingItems(items) {
        return items.filter((item) => !item.bought);
    },

    getPendingCount() {
        return cart.getPendingItems(cart.getItems()).reduce((count, item) => count + item.quantity, 0);
    },

    getSubtotal(items) {
        return cart.getPendingItems(items).reduce((total, item) => total + item.price * item.quantity, 0);
    },

    hasBought() {
        return cart.getItems().some((item) => item.bought);
    },

    getCountLabel(count) {
        return cart.constants.COUNT_LABELS[cart.constants.PLURAL_RULES.select(count)];
    },

    /**
     * Devuelve los comercios con productos en la lista, en el orden de registro; los que ya no existen, al final.
     *
     * @returns {Array<string>}
     */
    getStoreIds() {
        const registeredIds = engine.getStoreIds();
        const getRank = (storeId) => (registeredIds.includes(storeId) ? registeredIds.indexOf(storeId) : registeredIds.length);

        return [...new Set(cart.getItems().map((item) => item.storeId))].sort((a, b) => getRank(a) - getRank(b));
    },

    /**
     * Devuelve un selector para recuperar el control del modal que tiene el foco después de repintar.
     *
     * @param {Element|null} element
     * @returns {string} Vacío si el foco no está en un control de un producto o de un comercio.
     */
    getFocusSelector(element) {
        const content = document.querySelector(cart.elements.content);

        if (!element || !content.contains(element) || !element.matches('[data-key], [data-store-id]')) {
            return '';
        }

        const [attribute, value] = element.dataset.key ? ['data-key', element.dataset.key] : ['data-store-id', element.dataset.storeId];

        return `${cart.elements.content} .${[...element.classList].join('.')}[${attribute}="${CSS.escape(value)}"]`;
    },

    /**
     * Comprueba que un item leído del navegador tiene lo necesario para pintarlo.
     *
     * @param {*} item
     * @returns {boolean}
     */
    isValidItem(item) {
        return Boolean(item)
            && typeof item.key === 'string'
            && Number.isInteger(item.quantity) && item.quantity > 0
            && Number.isFinite(item.price);
    },

    // === SETTERS ===

    setItems(items) {
        cart.globals.items = items;
    },

    /**
     * Lee la lista guardada y descarta lo que no tenga forma de item.
     */
    load() {
        const self = cart;
        const storedItems = utils.readStorage(self.constants.STORAGE_KEY, []);

        self.setItems(Array.isArray(storedItems) ? storedItems.filter((item) => self.isValidItem(item)) : []);
    },

    /**
     * Sustituye la lista, la guarda en el navegador y la vuelve a pintar.
     *
     * @param {Array<Object>} items
     */
    save(items) {
        const self = cart;

        self.setItems(items);
        utils.writeStorage(self.constants.STORAGE_KEY, items);
        self.render();
    },

    /**
     * Cambia los campos de los items que cumplen la condición y guarda la lista.
     *
     * @param {Function} predicate Recibe el item.
     * @param {Object} changes
     */
    updateItems(predicate, changes) {
        const self = cart;

        self.save(self.getItems().map((item) => (predicate(item) ? { ...item, ...changes } : item)));
    },

    // === ACTIONS ===

    /**
     * Añade una unidad de un producto de los resultados; si ya estaba, suma una y vuelve a ponerlo como pendiente.
     *
     * @param {Object} product Producto del modelo común.
     */
    add(product) {
        const self = cart;
        const key = self.getKey(product);
        const item = self.getItem(key);

        if (item) {
            self.updateItems((current) => current.key === key, { quantity: item.quantity + 1, bought: false });
            return;
        }

        self.save([...self.getItems(), {
            key,
            storeId: product.storeId,
            storeName: product.storeName,
            id: product.id,
            name: product.name,
            brand: product.brand,
            imageUrl: product.imageUrl,
            price: product.price,
            unitPrice: product.unitPrice,
            unit: product.unit,
            quantity: 1,
            bought: false,
        }]);
    },

    /**
     * Suma o resta unidades; al bajar de una, quita el producto de la lista.
     *
     * @param {string} key
     * @param {number} delta
     */
    changeQuantity(key, delta) {
        const self = cart;
        const quantity = self.getQuantity(key) + delta;

        if (quantity < 1) {
            self.remove(key);
            return;
        }

        self.updateItems((item) => item.key === key, { quantity });
    },

    /**
     * @param {string} key
     * @param {boolean} bought
     */
    toggleBought(key, bought) {
        cart.updateItems((item) => item.key === key, { bought });
    },

    /**
     * Marca o desmarca como comprados todos los productos de un comercio.
     *
     * @param {string} storeId
     * @param {boolean} bought
     */
    toggleStoreBought(storeId, bought) {
        cart.updateItems((item) => item.storeId === storeId, { bought });
    },

    /**
     * @param {string} key
     */
    remove(key) {
        cart.save(cart.getItems().filter((item) => item.key !== key));
    },

    /**
     * Quita de la lista todo lo marcado como comprado.
     */
    removeBought() {
        cart.save(cart.getPendingItems(cart.getItems()));
    },

    /**
     * Vacía la lista, previa confirmación.
     */
    clear() {
        if (window.confirm(cart.constants.TEXTS.confirmClear)) {
            cart.save([]);
        }
    },

    open() {
        document.querySelector(cart.elements.dialog).showModal();
    },

    close() {
        document.querySelector(cart.elements.dialog).close();
    },

    /**
     * Pinta el botón de la cabecera, el contenido del modal y el estado de los botones de las tarjetas.
     */
    render() {
        const self = cart;

        self.renderToggle();
        self.renderContent();
        results.updateCartButtons();
    },

    /**
     * Pinta el icono con el número de unidades pendientes.
     */
    renderToggle() {
        const self = cart;
        const toggle = document.querySelector(self.elements.toggle);
        const count = self.getPendingCount();

        toggle.innerHTML = self.getToggleHTML(count);
        toggle.setAttribute('aria-label', `${self.constants.TEXTS.toggleLabel}, ${count} ${self.getCountLabel(count)}`);
    },

    /**
     * Pinta los comercios con sus productos y el pie con el total; sin productos, el estado vacío.
     */
    renderContent() {
        const self = cart;
        const { elements } = self;
        const items = self.getItems();
        const focusSelector = self.getFocusSelector(document.activeElement);

        document.querySelector(elements.content).innerHTML = items.length
            ? self.getStoreIds().map((storeId) => self.getStoreHTML(storeId, self.getStoreItems(storeId))).join('')
            : self.getEmptyHTML();

        // Repintar sustituye el control pulsado; sin esto el foco del teclado se perdería en cada cambio.
        if (focusSelector) {
            document.querySelector(focusSelector)?.focus();
        }
        document.querySelector(elements.footer).hidden = !items.length;
        document.querySelector(elements.total).textContent = utils.formatPrice(self.getSubtotal(items));
        document.querySelector(elements.removeBought).disabled = !self.hasBought();

        // `indeterminate` no existe como atributo HTML: solo se puede fijar desde JS.
        document.querySelectorAll(elements.storeCheck).forEach((checkbox) => {
            checkbox.indeterminate = checkbox.dataset.indeterminate === 'true';
        });
    },

    // === HTML ===

    /**
     * @param {number} count
     * @returns {string}
     */
    getToggleHTML(count) {
        return `<span class="cart-button__icon" aria-hidden="true">${cart.getIcon('cart')}</span>
            <span class="cart-button__count" aria-hidden="true"${count ? '' : ' hidden'}>${count}</span>`;
    },

    /**
     * @returns {string}
     */
    getEmptyHTML() {
        const { TEXTS } = cart.constants;

        return `<div class="cart__empty">
            <p class="cart__empty-title">${utils.escapeHtml(TEXTS.emptyTitle)}</p>
            <p class="cart__empty-text">${utils.escapeHtml(TEXTS.emptyText)}</p>
        </div>`;
    },

    /**
     * Pinta un comercio: cabecera con su checkbox, logo, nombre y subtotal pendiente, y la lista de sus productos.
     *
     * @param {string} storeId
     * @param {Array<Object>} items Productos del comercio, en el orden en que se añadieron.
     * @returns {string}
     */
    getStoreHTML(storeId, items) {
        const self = cart;
        const { TEXTS } = self.constants;
        const store = engine.getStoreById(storeId);
        const storeName = store ? engine.getOrigin(store).storeName : items[0].storeName;
        const boughtCount = items.filter((item) => item.bought).length;
        const isAllBought = boughtCount === items.length;
        const isMixed = boughtCount > 0 && !isAllBought;

        return `<section class="cart__store">
            <label class="cart__store-header">
                <input class="cart__check cart__store-check" type="checkbox" data-store-id="${utils.escapeHtml(storeId)}" data-indeterminate="${isMixed}"${isAllBought ? ' checked' : ''}>
                <span class="visually-hidden">${utils.escapeHtml(`${TEXTS.markStoreBought} ${storeName}`)}</span>
                ${self.getLogoHTML(store ? engine.getLogoUrl(store) : '')}
                <span class="cart__store-name">${utils.escapeHtml(storeName)}</span>
                <span class="cart__store-subtotal">${utils.escapeHtml(utils.formatPrice(self.getSubtotal(items)))}</span>
            </label>
            <ul class="cart__items">${items.map((item) => self.getItemHTML(item)).join('')}</ul>
        </section>`;
    },

    /**
     * @param {string} logoUrl
     * @returns {string}
     */
    getLogoHTML(logoUrl) {
        if (!logoUrl) {
            return '';
        }

        const { LOGO_SIZE } = cart.constants;

        return `<img class="cart__store-logo" src="${utils.escapeHtml(logoUrl)}" alt="" width="${LOGO_SIZE}" height="${LOGO_SIZE}" loading="lazy" decoding="async">`;
    },

    /**
     * Pinta un producto: checkbox de comprado, miniatura, datos, cantidad y papelera.
     *
     * @param {Object} item
     * @returns {string}
     */
    getItemHTML(item) {
        const self = cart;
        const { TEXTS } = self.constants;
        const key = utils.escapeHtml(item.key);

        return `<li class="cart__item${item.bought ? ' cart__item--bought' : ''}">
            <label class="cart__item-main">
                <input class="cart__check cart__item-check" type="checkbox" data-key="${key}"${item.bought ? ' checked' : ''}>
                <span class="visually-hidden">${utils.escapeHtml(TEXTS.markBought)}</span>
                <span class="cart__item-media">${self.getImageHTML(item.imageUrl)}</span>
                <span class="cart__item-body">
                    <span class="cart__item-name">${utils.escapeHtml(item.name)}</span>
                    ${item.brand ? `<span class="cart__item-brand">${utils.escapeHtml(item.brand)}</span>` : ''}
                    ${self.getItemPriceHTML(item)}
                </span>
            </label>
            <div class="cart__item-actions">
                ${self.getQuantityHTML(item)}
                <button class="cart__icon-button cart__remove" type="button" data-key="${key}" aria-label="${utils.escapeHtml(TEXTS.remove)}">${self.getIcon('trash')}</button>
            </div>
        </li>`;
    },

    /**
     * @param {string} imageUrl
     * @returns {string}
     */
    getImageHTML(imageUrl) {
        if (!imageUrl) {
            return '';
        }

        const { IMAGE_SIZE } = cart.constants;

        return `<img class="cart__item-image" src="${utils.escapeHtml(imageUrl)}" alt="" width="${IMAGE_SIZE}" height="${IMAGE_SIZE}" loading="lazy" decoding="async">`;
    },

    /**
     * Pinta el importe de la línea y, debajo, el precio de cada unidad y el precio por kg/l.
     *
     * @param {Object} item
     * @returns {string}
     */
    getItemPriceHTML(item) {
        const unitText = item.unit ? ` · ${utils.formatUnitPrice(item.unitPrice, item.unit)}` : '';
        const eachText = item.quantity > 1 ? `${item.quantity} × ${utils.formatPrice(item.price)}` : '';

        return `<span class="cart__item-price">${utils.escapeHtml(utils.formatPrice(item.price * item.quantity))}</span>
            <span class="cart__item-unit-price">${utils.escapeHtml(`${eachText || utils.formatPrice(item.price)}${unitText}`)}</span>`;
    },

    /**
     * @param {Object} item
     * @returns {string}
     */
    getQuantityHTML(item) {
        const self = cart;
        const { TEXTS } = self.constants;
        const key = utils.escapeHtml(item.key);
        const decrease = self.getDecreaseControl(item.quantity);

        return `<div class="cart__quantity" role="group" aria-label="${utils.escapeHtml(TEXTS.quantity)}">
            <button class="cart__icon-button cart__decrease" type="button" data-key="${key}" aria-label="${utils.escapeHtml(decrease.label)}">${decrease.icon}</button>
            <span class="cart__quantity-value">${item.quantity}</span>
            <button class="cart__icon-button cart__increase" type="button" data-key="${key}" aria-label="${utils.escapeHtml(TEXTS.increase)}">${self.getIcon('plus')}</button>
        </div>`;
    },
};
