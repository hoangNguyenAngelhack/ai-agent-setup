const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert');
const root = path.join(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const headings = (text) => [...text.matchAll(/^##\s+(.+?)\s*$/gm)].map((match) => match[1].toLowerCase());
const hasHeadings = (text, names) => names.forEach((name) => assert.ok(headings(text).some((heading) => heading.startsWith(name.toLowerCase())), `missing heading: ${name}`));

const text = read('docs/prd-referral.md');
hasHeadings(text, ['Goals', 'Non-goals', 'Users', 'Requirements', 'Acceptance criteria', 'Success metrics']);
const criteria = text.split(/^##\s+acceptance criteria\s*$/im)[1].split(/^##\s/m)[0];
assert.ok((criteria.match(/^\s*[-*\d]+[.)]?\s+\S/gm) || []).length >= 3, 'fewer than three acceptance criteria');
assert.match(text, /fraud|self-referr/i);
