/** URL slug: lower case, words joined by single dashes, at most 60 characters. */
function slugify(text) {
  return String(text)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-+$/, '');
}

module.exports = { slugify };
