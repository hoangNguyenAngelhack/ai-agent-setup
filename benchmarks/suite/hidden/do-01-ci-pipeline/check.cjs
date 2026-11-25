const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert');
const root = path.join(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const headings = (text) => [...text.matchAll(/^##\s+(.+?)\s*$/gm)].map((match) => match[1].toLowerCase());
const hasHeadings = (text, names) => names.forEach((name) => assert.ok(headings(text).some((heading) => heading.startsWith(name.toLowerCase())), `missing heading: ${name}`));

const dir = path.join(root, '.github', 'workflows');
const files = fs.existsSync(dir) ? fs.readdirSync(dir).filter((name) => /\.ya?ml$/.test(name)) : [];
assert.ok(files.length, 'no workflow file');
const text = files.map((name) => fs.readFileSync(path.join(dir, name), 'utf8')).join('\n');
assert.match(text, /\bpush\b/);
assert.match(text, /\bpull_request\b/);
assert.match(text, /actions\/setup-node@/);
assert.match(text, /node-version:\s*['"]?(20|\[[^\]]*20)/);
assert.match(text, /npm (ci|install)/);
assert.match(text, /npm (run )?test/);
