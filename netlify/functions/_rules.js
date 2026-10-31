// Business rules shared by the order functions and exposed to the storefront.
// MIN_ORDER applies to the food subtotal, i.e. without the delivery fee.
const MIN_ORDER = 15;

const minOrderMessage = (subtotal) =>
  `Минималната поръчка е ${MIN_ORDER.toFixed(2)} € (без доставката). Добавете още ${(MIN_ORDER - subtotal).toFixed(2)} €.`;

module.exports = { MIN_ORDER, minOrderMessage };
