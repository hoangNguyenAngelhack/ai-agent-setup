const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert');

const html = fs.readFileSync(path.join(process.cwd(), 'public', 'signup.html'), 'utf8');
/** Attributes of a start tag, with any HTML quoting: double, single or none. */
const attributes = (tag) =>
  Object.fromEntries(
    [...tag.replace(/^<\w+/, '').matchAll(/([^\s"'>/=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g)].map((match) => [match[1].toLowerCase(), match[2] ?? match[3] ?? match[4] ?? '']),
  );
const tags = (name) => [...html.matchAll(new RegExp(`<${name}\\b[^>]*>`, 'gi'))].map((match) => ({ text: match[0], index: match.index, attributes: attributes(match[0]) }));
const labels = [...html.matchAll(/<label\b([^>]*)>([\s\S]*?)<\/label>/gi)].map((match) => ({ attributes: attributes(`<label${match[1]}>`), body: match[2], start: match.index, end: match.index + match[0].length }));
const hasText = (body) => /\S/.test(body.replace(/<[^>]*>/g, ''));

for (const [name, type] of [['email', 'email'], ['password', 'password'], ['confirm', 'password']]) {
  const input = tags('input').find((tag) => tag.attributes.name === name);
  assert.ok(input, `no input ${name}`);
  const { id } = input.attributes;
  // A label that points at the input, or one that wraps it.
  const labelled = labels.some((label) => hasText(label.body) && ((id && label.attributes.for === id) || (input.index > label.start && input.index < label.end)));
  assert.ok(labelled, `no label for ${name}`);
  assert.strictEqual(input.attributes.type, type, `input ${name} is not type ${type}`);
  assert.ok('required' in input.attributes, `input ${name} is not required`);
}
const all = [...html.matchAll(/<\w+\b[^>]*>/g)].map((match) => attributes(match[0]));
assert.ok(all.some((tag) => ['polite', 'assertive'].includes(tag['aria-live']) || tag.role === 'alert'), 'no live region for errors');
assert.ok(tags('button').some((tag) => tag.attributes.type === 'submit'), 'no submit button');
