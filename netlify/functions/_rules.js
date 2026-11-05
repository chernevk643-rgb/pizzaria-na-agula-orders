// Business rules shared by the order functions and exposed to the storefront.
// MIN_ORDER applies to the food subtotal, i.e. without the delivery fee.
const MIN_ORDER = 15;

// Delivery is free once the food subtotal reaches FREE_DELIVERY_FROM.
const DELIVERY_FEE = 1.99;
const FREE_DELIVERY_FROM = 40;
const deliveryFeeFor = (subtotal) => (subtotal >= FREE_DELIVERY_FROM - 0.001 ? 0 : DELIVERY_FEE);

const minOrderMessage = (subtotal) =>
  `Минималната поръчка е ${MIN_ORDER.toFixed(2)} € (без доставката). Добавете още ${(MIN_ORDER - subtotal).toFixed(2)} €.`;

module.exports = { MIN_ORDER, DELIVERY_FEE, FREE_DELIVERY_FROM, deliveryFeeFor, minOrderMessage };
