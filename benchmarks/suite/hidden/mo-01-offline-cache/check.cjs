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
  const items = [{ id: 'a' }, { id: 'b' }];
  const storage = memoryStorage();
  let online = true;
  const offlineError = new Error('offline');
  const api = { fetchItems: async () => {
    if (!online) throw offlineError;
    return { items, nextCursor: null };
  } };
  const controller = createItemListController({ api, storage });
  assert.deepStrictEqual(await controller.load(), { items, stale: false });
  assert.deepStrictEqual(JSON.parse(storage.data.get('items-cache')), items);
  online = false;
  assert.deepStrictEqual(await controller.load(), { items, stale: true });
  const empty = createItemListController({ api, storage: memoryStorage() });
  await assert.rejects(empty.load(), (error) => error === offlineError);
})().catch(fail);
