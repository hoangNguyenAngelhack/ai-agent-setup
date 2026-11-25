const assert = require('node:assert');
const { observe } = require('./runtime/isolate.cjs');

const seen = observe(`
  const { createItemListController } = load('src/itemListController.js');
  const memoryStorage = () => {
    const data = new Map();
    return { data, get: async (key) => (data.has(key) ? data.get(key) : null), set: async (key, value) => void data.set(key, value) };
  };
  const calls = [];
  const pages = { undefined: { items: [{ id: 'a' }, { id: 'b' }], nextCursor: 'c1' }, c1: { items: [{ id: 'b' }, { id: 'c' }], nextCursor: null } };
  const api = { fetchItems: async ({ cursor } = {}) => {
    calls.push(cursor === undefined ? 'undefined' : cursor);
    await new Promise((resolve) => setTimeout(resolve, 10));
    return pages[String(cursor)];
  } };
  const ids = (list) => list.map((item) => item.id);
  const controller = createItemListController({ api, storage: memoryStorage() });
  const loaded = ids((await controller.load()).items);
  const hasMoreAfterLoad = controller.hasMore;
  const [first, second] = await Promise.all([controller.loadMore(), controller.loadMore()]);
  const callsAfterConcurrent = [...calls];
  const hasMoreAtEnd = controller.hasMore;
  const last = ids(await controller.loadMore());
  return { loaded, hasMoreAfterLoad, first: ids(first), second: ids(second), callsAfterConcurrent, hasMoreAtEnd, last, callCount: calls.length };
`);
assert.deepStrictEqual(seen.loaded, ['a', 'b']);
assert.strictEqual(seen.hasMoreAfterLoad, true);
assert.deepStrictEqual(seen.first, ['a', 'b', 'c']);
assert.deepStrictEqual(seen.second, ['a', 'b', 'c']);
assert.deepStrictEqual(seen.callsAfterConcurrent, ['undefined', 'c1'], 'concurrent loadMore calls did not share one request');
assert.strictEqual(seen.hasMoreAtEnd, false);
assert.deepStrictEqual(seen.last, ['a', 'b', 'c']);
assert.strictEqual(seen.callCount, 2, 'loadMore called the api with no more pages');
