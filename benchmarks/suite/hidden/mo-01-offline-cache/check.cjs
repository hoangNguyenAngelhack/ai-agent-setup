const assert = require('node:assert');
const { observe } = require('./runtime/isolate.cjs');

const seen = observe(`
  const { createItemListController } = load('src/itemListController.js');
  const memoryStorage = () => {
    const data = new Map();
    return { data, get: async (key) => (data.has(key) ? data.get(key) : null), set: async (key, value) => void data.set(key, value) };
  };
  const items = [{ id: 'a' }, { id: 'b' }];
  const storage = memoryStorage();
  let online = true;
  const offlineError = new Error('offline');
  const api = { fetchItems: async () => {
    if (!online) throw offlineError;
    return { items, nextCursor: null };
  } };
  const controller = createItemListController({ api, storage });
  const fresh = await controller.load();
  const cached = JSON.parse(storage.data.get('items-cache'));
  online = false;
  const stale = await controller.load();
  const empty = createItemListController({ api, storage: memoryStorage() });
  let rejection = 'resolved';
  try {
    await empty.load();
  } catch (error) {
    rejection = error === offlineError ? 'the offline error' : 'another error';
  }
  return { fresh, cached, stale, rejection };
`);
const items = [{ id: 'a' }, { id: 'b' }];
assert.deepStrictEqual(seen.fresh, { items, stale: false });
assert.deepStrictEqual(seen.cached, items);
assert.deepStrictEqual(seen.stale, { items, stale: true });
assert.strictEqual(seen.rejection, 'the offline error');
