/** Splits a list into pages of `size` items; the last page may be shorter. */
function chunk(items, size) {
  if (!(size >= 1)) throw new RangeError(`size must be at least 1, got ${size}`);
  const pages = [];
  for (let start = 0; start < items.length; start += size) pages.push(items.slice(start, start + size));
  return pages;
}

module.exports = { chunk };
