/**
 * Plataforma de tienda online de Aktios, que comparten BM y Consum: mismo formato de producto y de precios.
 */
const aktios = {
    constants: {
        PRICE_IDS: {
            regular: 'PRICE',
            offer: 'OFFER_PRICE',
        },
        AVAILABLE: '1',
    },
    globals: {},
    elements: {},
    init() {},
    listeners() {},

    // === GETTERS ===

    getProductData(item) {
        return item.productData || {};
    },

    getPriceData(item) {
        return item.priceData || {};
    },

    /**
     * Devuelve un precio de la lista por su id (PRICE u OFFER_PRICE).
     *
     * @param {Object} item
     * @param {string} priceId
     * @returns {{centAmount?: number, centUnitAmount?: number}} Pese al nombre, los importes vienen en euros.
     */
    getPrice(item, priceId) {
        return ((aktios.getPriceData(item).prices || []).find((price) => price.id === priceId) || {}).value || {};
    },

    getCategories(item) {
        return (item.categories || []).map((category) => category.name);
    },

    /**
     * Devuelve la primera imagen de la galería; `imageURL` apunta a veces a un fichero que no existe en su CDN.
     *
     * @param {Object} item
     * @returns {string}
     */
    getImageUrl(item) {
        return ((item.media || [])[0] || {}).url || aktios.getProductData(item).imageURL || '';
    },

    // === ACTIONS ===

    /**
     * Mapea un producto; con oferta, el precio vigente es OFFER_PRICE y PRICE pasa a ser el anterior.
     *
     * @param {Object} item
     * @returns {Object}
     */
    mapItem(item) {
        const self = aktios;
        const { PRICE_IDS, AVAILABLE } = self.constants;
        const data = self.getProductData(item);
        const regular = self.getPrice(item, PRICE_IDS.regular);
        const offer = self.getPrice(item, PRICE_IDS.offer);
        const current = offer.centAmount ? offer : regular;

        return {
            id: item.code,
            name: data.name,
            brand: (data.brand || {}).name,
            imageUrl: self.getImageUrl(item),
            price: current.centAmount,
            previousPrice: offer.centAmount ? regular.centAmount : null,
            unitPrice: current.centUnitAmount,
            unitScale: self.getPriceData(item).unitPriceUnitType,
            packageText: data.description || data.name,
            available: data.availability === AVAILABLE,
            categories: self.getCategories(item),
            ean: item.ean,
        };
    },
};
