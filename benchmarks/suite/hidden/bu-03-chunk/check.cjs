const assert = require('node:assert');
const { observe } = require('./runtime/isolate.cjs');

const results = observe(`
  const { chunk } = load('src/chunk.js');
  return [chunk([1, 2, 3, 4, 5], 2), chunk([1, 2, 3, 4], 2), chunk([], 3)];
`);
assert.deepStrictEqual(results, [[[1, 2], [3, 4], [5]], [[1, 2], [3, 4]], []]);
// Only once the pages are right: a size of 0 must throw at once, not loop (the original bug loops).
const zero = observe(
  `
  const { chunk } = load('src/chunk.js');
  try {
    chunk([1], 0);
    return 'no error';
  } catch (error) {
    return error instanceof RangeError ? 'RangeError' : String(error && error.name);
  }
`,
  {},
  { timeoutMs: 10000 },
);
assert.strictEqual(zero, 'RangeError');
