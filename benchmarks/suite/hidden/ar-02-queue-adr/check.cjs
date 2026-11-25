const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert');
const root = path.join(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const headings = (text) => [...text.matchAll(/^##\s+(.+?)\s*$/gm)].map((match) => match[1].toLowerCase());
const hasHeadings = (text, names) => names.forEach((name) => assert.ok(headings(text).some((heading) => heading.startsWith(name.toLowerCase())), `missing heading: ${name}`));

const text = read(process.argv[2]);
hasHeadings(text, ['Status', 'Context', 'Options', 'Decision', 'Consequences']);
assert.match(text.split(/^##\s+status/im)[1] || '', /proposed|accepted/i);
for (const term of process.argv.slice(3)) assert.match(text, new RegExp(term, 'i'), `does not discuss ${term}`);
