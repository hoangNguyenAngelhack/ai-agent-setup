const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert');
const root = path.join(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const headings = (text) => [...text.matchAll(/^##\s+(.+?)\s*$/gm)].map((match) => match[1].toLowerCase());
const hasHeadings = (text, names) => names.forEach((name) => assert.ok(headings(text).some((heading) => heading.startsWith(name.toLowerCase())), `missing heading: ${name}`));

const text = read('docs/prioritised-backlog.md');
const rows = text.split('\n').filter((line) => line.trim().startsWith('|'));
const header = rows[0].split('|').map((cell) => cell.trim().toLowerCase());
for (const column of ['item', 'reach', 'impact', 'confidence', 'effort', 'score']) assert.ok(header.includes(column), `missing column ${column}`);
const body = rows.slice(2).map((line) => line.split('|').map((cell) => cell.trim()));
for (const item of ['tracking', 'reorder', 'address', 'notification', 'search', 'card']) assert.ok(body.some((row) => row.join(' ').toLowerCase().includes(item)), `missing backlog item: ${item}`);
const scores = body.map((row) => Number.parseFloat(row[header.indexOf('score')].replace(/[^0-9.]/g, '')));
assert.ok(scores.every(Number.isFinite), 'non-numeric score');
assert.ok(scores.every((score, index) => index === 0 || score <= scores[index - 1]), 'not sorted by score');
