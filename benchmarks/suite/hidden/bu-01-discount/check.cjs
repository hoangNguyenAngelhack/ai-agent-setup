const assert = require('node:assert');
const { observe } = require('./runtime/isolate.cjs');

const seen = observe(`
  const { computeTotal } = load('src/price.js');
  const items = [{ price: 10, qty: 2 }, { price: 5, qty: 1 }];
  return [computeTotal(items, 10), computeTotal(items), computeTotal([{ price: 0.1, qty: 3 }]), computeTotal([{ price: 19.99, qty: 3 }], 15)];
`);
assert.deepStrictEqual(seen, [22.5, 25, 0.3, 50.97]);
