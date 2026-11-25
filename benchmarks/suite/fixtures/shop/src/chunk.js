/** Splits a list into pages of `size` items. */
function chunk(items, size) {
  const pages = [];
  for (let start = 0; start + size <= items.length; start += size) pages.push(items.slice(start, start + size));
  return pages;
}

module.exports = { chunk };
