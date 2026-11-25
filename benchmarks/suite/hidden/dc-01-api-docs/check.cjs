const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert');
const root = path.join(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const headings = (text) => [...text.matchAll(/^##\s+(.+?)\s*$/gm)].map((match) => match[1].toLowerCase());
const hasHeadings = (text, names) => names.forEach((name) => assert.ok(headings(text).some((heading) => heading.startsWith(name.toLowerCase())), `missing heading: ${name}`));

const text = read('docs/api.md');
for (const route of ['GET /health', 'GET /users', 'GET /users/:id', 'GET /profile/:id/html', 'GET /orders', 'GET /orders/:id']) {
  assert.ok(text.includes(route), `route not documented: ${route}`);
}
assert.match(text, /Authorization/);
assert.match(text, /Bearer/);
for (const code of ['UNAUTHENTICATED', 'NOT_FOUND']) assert.ok(text.includes(code), `error code not documented: ${code}`);
