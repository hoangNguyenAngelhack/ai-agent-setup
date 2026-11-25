/**
 * Data logic of the item list screen.
 * @param {{ api: { fetchItems(options: { cursor?: string }): Promise<{ items: Array<{ id: string }>, nextCursor: string | null }> },
 *           storage: { get(key: string): Promise<string | null>, set(key: string, value: string): Promise<void> } }} deps
 */
function createItemListController({ api }) {
  return {
    async load() {
      const page = await api.fetchItems({});
      return { items: page.items };
    },
  };
}

module.exports = { createItemListController };
