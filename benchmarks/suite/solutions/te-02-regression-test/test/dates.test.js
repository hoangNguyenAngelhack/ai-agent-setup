const test = require('node:test');
const assert = require('node:assert');
const { parseDate } = require('../src/dates');

test('parses the month of a date (regression: March came back as April)', () => {
  const date = parseDate('2026-03-15');
  assert.strictEqual(date.getUTCMonth(), 2);
  assert.strictEqual(date.getUTCDate(), 15);
});
