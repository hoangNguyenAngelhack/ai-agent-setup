const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert');
const root = path.join(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const headings = (text) => [...text.matchAll(/^##\s+(.+?)\s*$/gm)].map((match) => match[1].toLowerCase());
const hasHeadings = (text, names) => names.forEach((name) => assert.ok(headings(text).some((heading) => heading.startsWith(name.toLowerCase())), `missing heading: ${name}`));

const html = read('public/signup.html');
const input = (name) => (html.match(new RegExp(`<input[^>]*name="${name}"[^>]*>`)) || [])[0];
for (const [name, type] of [['email', 'email'], ['password', 'password'], ['confirm', 'password']]) {
  const tag = input(name);
  assert.ok(tag, `no input ${name}`);
  const id = (/\sid="([^"]+)"/.exec(tag) || [])[1];
  assert.ok(id, `input ${name} has no id`);
  assert.match(html, new RegExp(`<label[^>]*for="${id}"[^>]*>\\s*\\S`), `no label for ${name}`);
  assert.match(tag, new RegExp(`type="${type}"`), `input ${name} is not type ${type}`);
  assert.match(tag, /\srequired(\s|=|\/|>)/, `input ${name} is not required`);
}
assert.match(html, /aria-live="(polite|assertive)"|role="alert"/);
assert.match(html, /<button[^>]*type="submit"/);
