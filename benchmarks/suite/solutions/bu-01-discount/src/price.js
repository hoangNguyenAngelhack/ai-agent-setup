/** Order total after a percentage discount, rounded to cents. */
function computeTotal(items, discountPercent = 0) {
  const subtotal = items.reduce((sum, item) => sum + item.price * item.qty, 0);
  const discounted = subtotal - subtotal * (discountPercent / 100);
  return Math.round(discounted * 100) / 100;
}

module.exports = { computeTotal };
