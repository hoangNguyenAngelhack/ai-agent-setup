const test = require('node:test');
const assert = require('node:assert');
const { slugify } = require('../src/slug');

test('lower case and single dashes', () => {
  assert.strictEqual(slugify('Hello   World!!'), 'hello-world');
});

test('no leading or trailing dashes', () => {
  assert.strictEqual(slugify('  --Hi there--  '), 'hi-there');
});

test('at most 60 characters', () => {
  assert.ok(slugify('word '.repeat(30)).length <= 60);
});
