const CACHE_KEY = 'items-cache';

/** Data logic of the item list screen, with an offline cache. */
function createItemListController({ api, storage }) {
  return {
    async load() {
      try {
        const page = await api.fetchItems({});
        await storage.set(CACHE_KEY, JSON.stringify(page.items));
        return { items: page.items, stale: false };
      } catch (error) {
        const cached = await storage.get(CACHE_KEY);
        if (cached === null) throw error;
        return { items: JSON.parse(cached), stale: true };
      }
    },
  };
}

module.exports = { createItemListController };
