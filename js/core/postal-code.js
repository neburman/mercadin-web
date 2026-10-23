/**
 * Código postal del usuario: lo valida, lo recuerda entre visitas y relanza la búsqueda al cambiarlo.
 */
const postalCodeForm = {
    constants: {
        workspace: '#postal-code',
        STORAGE_KEY: 'mercadin.postalCode',
        LENGTH: 5,
        // Provincias españolas: del 01 al 52.
        VALID_PATTERN: /^(0[1-9]|[1-4]\d|5[0-2])\d{3}$/,
        STATUSES: {
            saved: { text: 'Guardado', modifier: 'saved' },
            invalid: { text: 'Ese código postal no existe', modifier: 'invalid' },
        },
        STATUS_DEFAULT: { text: '', modifier: '' },
    },
    globals: {
        value: '',
    },
    elements: {
        form: '#postal-code .postal-code__form',
        input: '#postal-code .postal-code__input',
        status: '#postal-code .postal-code__status',
    },

    /**
     * Recupera el código guardado, lo muestra y registra los listeners.
     */
    init() {
        const self = postalCodeForm;
        const storedValue = utils.readStorage(self.constants.STORAGE_KEY, '');

        if (self.isValid(storedValue)) {
            self.setValue(storedValue);
            document.querySelector(self.elements.input).value = storedValue;
        }

        self.listeners();
    },

    listeners() {
        const self = postalCodeForm;
        const { elements, constants } = self;

        utils.addListener('submit', elements.form, (event) => {
            event.preventDefault();
        }, constants.workspace);

        utils.addListener('input', elements.input, function () {
            this.value = self.getDigits(this.value);
            self.update(this.value);
        }, constants.workspace);
    },

    // === GETTERS ===

    getValue() {
        return postalCodeForm.globals.value;
    },

    getStatus(statusKey) {
        return postalCodeForm.constants.STATUSES[statusKey] || postalCodeForm.constants.STATUS_DEFAULT;
    },

    getDigits(text) {
        return text.replace(/\D/g, '').slice(0, postalCodeForm.constants.LENGTH);
    },

    isValid(value) {
        return postalCodeForm.constants.VALID_PATTERN.test(String(value));
    },

    // === SETTERS ===

    setValue(value) {
        postalCodeForm.globals.value = value;
    },

    // === ACTIONS ===

    /**
     * Guarda el código cuando está completo y es válido; si se borra, lo olvida.
     *
     * @param {string} value Solo dígitos.
     */
    update(value) {
        const self = postalCodeForm;
        const { constants } = self;

        if (value.length < constants.LENGTH) {
            self.renderStatus('');
            if (!value && self.getValue()) {
                self.save('');
            }
            return;
        }

        if (!self.isValid(value)) {
            self.renderStatus('invalid');
            return;
        }

        self.save(value);
        self.renderStatus('saved');
        // Con los cinco dígitos no queda nada que escribir: se cierra el teclado del móvil.
        document.querySelector(self.elements.input).blur();
    },

    /**
     * Guarda el código, muestra solo los comercios de la nueva zona y repite la búsqueda en curso.
     *
     * @param {string} value
     */
    save(value) {
        const self = postalCodeForm;

        self.setValue(value);
        utils.writeStorage(self.constants.STORAGE_KEY, value);
        storeFilter.refresh();
        search.refresh();
    },

    /**
     * Pinta el mensaje de estado de la tabla STATUSES.
     *
     * @param {string} statusKey
     */
    renderStatus(statusKey) {
        const self = postalCodeForm;
        const { text, modifier } = self.getStatus(statusKey);
        const status = document.querySelector(self.elements.status);

        status.className = `postal-code__status${modifier ? ` postal-code__status--${modifier}` : ''}`;
        status.textContent = text;
    },
};
