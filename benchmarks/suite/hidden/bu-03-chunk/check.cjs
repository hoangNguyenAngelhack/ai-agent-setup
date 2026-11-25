const assert = require('node:assert');
const { observe } = require('./runtime/isolate.cjs');

const seen = observe(`
  const { chunk } = load('src/chunk.js');
  let zero = 'no error';
  try {
    chunk([1], 0);
  } catch (error) {
    zero = error instanceof RangeError ? 'RangeError' : String(error && error.name);
  }
  return { results: [chunk([1, 2, 3, 4, 5], 2), chunk([1, 2, 3, 4], 2), chunk([], 3)], zero };
`);
assert.deepStrictEqual(seen.results, [[[1, 2], [3, 4], [5]], [[1, 2], [3, 4]], []]);
assert.strictEqual(seen.zero, 'RangeError');
