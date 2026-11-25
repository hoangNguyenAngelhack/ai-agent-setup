const test = require('node:test');
const assert = require('node:assert');
const { formatMoney } = require('../src/money');

test('symbol, thousands and cents', () => {
  assert.strictEqual(formatMoney(123456), '$1,234.56');
  assert.strictEqual(formatMoney(5), '$0.05');
});

test('negative amounts', () => {
  assert.strictEqual(formatMoney(-500), '-$5.00');
});

test('other currencies', () => {
  assert.strictEqual(formatMoney(100, 'EUR'), '€1.00');
  assert.strictEqual(formatMoney(100, 'GBP'), '£1.00');
});
