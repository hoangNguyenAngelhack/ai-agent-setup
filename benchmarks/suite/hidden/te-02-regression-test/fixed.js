/** Parses "YYYY-MM-DD" as a UTC date. */
function parseDate(text) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
  if (!match) throw new Error(`Invalid date: ${text}`);
  const [, year, month, day] = match.map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

module.exports = { parseDate };
