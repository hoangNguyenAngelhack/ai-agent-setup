const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert');
const root = path.join(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const headings = (text) => [...text.matchAll(/^##\s+(.+?)\s*$/gm)].map((match) => match[1].toLowerCase());
const hasHeadings = (text, names) => names.forEach((name) => assert.ok(headings(text).some((heading) => heading.startsWith(name.toLowerCase())), `missing heading: ${name}`));

const text = read('docs/release-notes.md');
hasHeadings(text, ['Features', 'Fixes']);
assert.match(text, /orders/i);
assert.match(text, /profile/i);
assert.match(text, /\b400\b|not a number|non-numeric/i);
assert.match(text, /Authorization|token/i);
assert.doesNotMatch(text, /bump the Node version|rename test files/i, 'chores included');
