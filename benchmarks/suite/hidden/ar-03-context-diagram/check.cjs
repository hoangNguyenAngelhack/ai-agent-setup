const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert');
const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const headings = (text) => [...text.matchAll(/^##\s+(.+?)\s*$/gm)].map((match) => match[1].toLowerCase());
const hasHeadings = (text, names) => names.forEach((name) => assert.ok(headings(text).some((heading) => heading.startsWith(name.toLowerCase())), `missing heading: ${name}`));

const text = read('docs/architecture.md');
const diagram = (/```mermaid\n([\s\S]*?)```/.exec(text) || [])[1];
assert.ok(diagram, 'no mermaid block');
for (const element of ['customer', 'shop', 'email']) assert.match(diagram, new RegExp(element, 'i'), `diagram lacks ${element}`);
const prose = text.replace(/```[\s\S]*?```/g, '').split(/\n\s*\n/).filter((block) => block.trim() && !block.trim().startsWith('#'));
assert.ok(prose.length >= 4, 'fewer than four paragraphs');
