const assert = require('node:assert');
const { observe } = require('./runtime/isolate.cjs');

const seen = observe(`
  const { debounce } = load('src/debounce.js');
  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const calls = [];
  const search = debounce((...args) => calls.push(args), 50);
  search('a');
  search('ab');
  search('abc');
  await sleep(20);
  const early = calls.length;
  await sleep(90);
  const settled = calls.map((call) => [...call]);
  const dropped = debounce(() => calls.push(['dropped']), 50);
  dropped();
  const cancelType = typeof dropped.cancel;
  if (cancelType === 'function') dropped.cancel();
  await sleep(100);
  return { early, settled, cancelType, afterCancel: calls };
`);
assert.strictEqual(seen.early, 0, 'called before the wait');
assert.deepStrictEqual(seen.settled, [['abc']]);
assert.strictEqual(seen.cancelType, 'function');
assert.deepStrictEqual(seen.afterCancel, [['abc']]);
