const path = require('node:path');
const assert = require('node:assert');
const root = path.join(__dirname, '..');
const { createItemListController } = require(path.join(root, 'src', 'itemListController.js'));
const memoryStorage = () => {
  const data = new Map();
  return { data, get: async (key) => (data.has(key) ? data.get(key) : null), set: async (key, value) => void data.set(key, value) };
};
const fail = (error) => {
  console.error(error.message);
  process.exit(1);
};

(async () => {
  const calls = [];
  const pages = { undefined: { items: [{ id: 'a' }, { id: 'b' }], nextCursor: 'c1' }, c1: { items: [{ id: 'b' }, { id: 'c' }], nextCursor: null } };
  const api = { fetchItems: async ({ cursor } = {}) => {
    calls.push(cursor);
    await new Promise((resolve) => setTimeout(resolve, 10));
    return pages[String(cursor)];
  } };
  const controller = createItemListController({ api, storage: memoryStorage() });
  assert.deepStrictEqual((await controller.load()).items.map((item) => item.id), ['a', 'b']);
  assert.strictEqual(controller.hasMore, true);
  const [first, second] = await Promise.all([controller.loadMore(), controller.loadMore()]);
  assert.deepStrictEqual(first.map((item) => item.id), ['a', 'b', 'c']);
  assert.deepStrictEqual(second.map((item) => item.id), ['a', 'b', 'c']);
  assert.deepStrictEqual(calls, [undefined, 'c1'], 'concurrent loadMore calls did not share one request');
  assert.strictEqual(controller.hasMore, false);
  assert.deepStrictEqual((await controller.loadMore()).map((item) => item.id), ['a', 'b', 'c']);
  assert.strictEqual(calls.length, 2, 'loadMore called the api with no more pages');
})().catch(fail);
