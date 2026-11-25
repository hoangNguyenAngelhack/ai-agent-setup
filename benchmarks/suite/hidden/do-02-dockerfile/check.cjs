const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert');
const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const headings = (text) => [...text.matchAll(/^##\s+(.+?)\s*$/gm)].map((match) => match[1].toLowerCase());
const hasHeadings = (text, names) => names.forEach((name) => assert.ok(headings(text).some((heading) => heading.startsWith(name.toLowerCase())), `missing heading: ${name}`));

const text = read('Dockerfile');
const from = (/^FROM\s+(\S+)/m.exec(text) || [])[1] || '';
assert.match(from, /^node:20(\.|-|$)/, `base image not pinned to Node 20: ${from}`);
assert.doesNotMatch(from, /latest/);
const users = [...text.matchAll(/^USER\s+(\S+)/gm)].map((match) => match[1]);
assert.ok(users.length && !/^(root|0)$/.test(users.at(-1)), 'does not run as a non-root user');
assert.doesNotMatch(text, /SIGNING_SECRET\s*=|dev-signing-secret/);
assert.match(text, /^HEALTHCHECK\s+.*\/health/m);
