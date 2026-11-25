# Mobile list screen

`src/itemListController.js` holds the data logic of the item list screen of a React Native app.
The UI is not included. `api.fetchItems({ cursor })` resolves to `{ items, nextCursor }`;
`storage` has async `get(key)` and `set(key, value)` (strings), like AsyncStorage.
