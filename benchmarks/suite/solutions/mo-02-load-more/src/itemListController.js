/** Data logic of the item list screen, with cursor pagination. */
function createItemListController({ api }) {
  let items = [];
  let cursor = null;
  let pending = null;
  const controller = {
    hasMore: false,
    async load() {
      const page = await api.fetchItems({});
      items = page.items;
      cursor = page.nextCursor;
      controller.hasMore = cursor !== null;
      return { items };
    },
    loadMore() {
      if (!controller.hasMore) return Promise.resolve(items);
      if (pending) return pending;
      pending = api.fetchItems({ cursor }).then((page) => {
        const known = new Set(items.map((item) => item.id));
        items = [...items, ...page.items.filter((item) => !known.has(item.id))];
        cursor = page.nextCursor;
        controller.hasMore = cursor !== null;
        pending = null;
        return items;
      });
      return pending;
    },
  };
  return controller;
}

module.exports = { createItemListController };
