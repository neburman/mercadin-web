/**
 * Modo claro u oscuro: sigue al sistema hasta que el usuario elige uno con el interruptor, y lo recuerda entre visitas.
 */
const theme = {
    constants: {
        workspace: '#theme-toggle',
        STORAGE_KEY: 'mercadin.theme',
        DARK_QUERY: '(prefers-color-scheme: dark)',
        THEMES: ['light', 'dark'],
    },
    globals: {
        chosenTheme: '',
    },
    elements: {
        toggle: '#theme-toggle',
    },

    /**
     * Recupera la elección guardada y la aplica; se llama antes de pintar para que no parpadee el otro tema.
     */
    preload() {
        const self = theme;
        const storedTheme = utils.readStorage(self.constants.STORAGE_KEY, '');

        self.setChosenTheme(self.constants.THEMES.includes(storedTheme) ? storedTheme : '');
        self.applyTheme();
    },

    /**
     * Pinta el estado del interruptor y registra los listeners.
     */
    init() {
        const self = theme;

        self.renderToggle();
        self.listeners();
    },

    listeners() {
        const self = theme;
        const { elements, constants } = self;

        utils.addListener('click', elements.toggle, () => {
            self.toggle();
        }, constants.workspace);

        window.matchMedia(constants.DARK_QUERY).addEventListener('change', () => {
            self.applyTheme();
            self.renderToggle();
        });
    },

    // === GETTERS ===

    getChosenTheme() {
        return theme.globals.chosenTheme;
    },

    getSystemTheme() {
        return window.matchMedia(theme.constants.DARK_QUERY).matches ? 'dark' : 'light';
    },

    getActiveTheme() {
        return theme.getChosenTheme() || theme.getSystemTheme();
    },

    isDark() {
        return theme.getActiveTheme() === 'dark';
    },

    // === SETTERS ===

    setChosenTheme(value) {
        theme.globals.chosenTheme = value;
    },

    // === ACTIONS ===

    /**
     * Cambia al tema contrario del activo y guarda la elección.
     */
    toggle() {
        const self = theme;
        const nextTheme = self.isDark() ? 'light' : 'dark';

        self.setChosenTheme(nextTheme);
        utils.writeStorage(self.constants.STORAGE_KEY, nextTheme);
        self.applyTheme();
        self.renderToggle();
    },

    /**
     * Marca el tema activo en la raíz del documento, de donde lo leen los tokens de color.
     */
    applyTheme() {
        document.documentElement.dataset.theme = theme.getActiveTheme();
    },

    /**
     * Refleja en el interruptor si el modo oscuro está activo.
     */
    renderToggle() {
        const self = theme;

        document.querySelector(self.elements.toggle).setAttribute('aria-checked', String(self.isDark()));
    },
};

theme.preload();
