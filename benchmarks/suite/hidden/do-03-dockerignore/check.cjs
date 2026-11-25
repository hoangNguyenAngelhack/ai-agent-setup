const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert');
const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const headings = (text) => [...text.matchAll(/^##\s+(.+?)\s*$/gm)].map((match) => match[1].toLowerCase());
const hasHeadings = (text, names) => names.forEach((name) => assert.ok(headings(text).some((heading) => heading.startsWith(name.toLowerCase())), `missing heading: ${name}`));

const lines = read('.dockerignore').split('\n').map((line) => line.trim().replace(/^\/|\/$/g, ''));
for (const [entry, accepted] of [['node_modules', /^(\*\*\/)?node_modules$/], ['.env', /^(\*\*\/)?\.env(\*|$)/], ['.git', /^\.git$/], ['test', /^tests?$/]]) {
  assert.ok(lines.some((line) => accepted.test(line)), `${entry} is not ignored`);
}
