const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert');
const root = path.join(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const headings = (text) => [...text.matchAll(/^##\s+(.+?)\s*$/gm)].map((match) => match[1].toLowerCase());
const hasHeadings = (text, names) => names.forEach((name) => assert.ok(headings(text).some((heading) => heading.startsWith(name.toLowerCase())), `missing heading: ${name}`));

const text = read('docs/user-stories.md');
assert.ok(headings(text).length >= 6, 'fewer than six stories');
assert.ok((text.match(/As an? [^,\n]+, I want [^,\n]+, so that \S/gi) || []).length >= 6, 'fewer than six "As a ..., I want ..., so that ..." lines');
assert.ok((text.match(/\bGiven\b/g) || []).length >= 6 && (text.match(/\bThen\b/gi) || []).length >= 6, 'acceptance criteria not in Given / When / Then');
