const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert');
const { spawnSubject } = require('./runtime/isolate.cjs');

const root = process.cwd();
const sources = fs.readdirSync(path.join(root, 'src')).filter((name) => name.endsWith('.js'));
for (const name of sources) assert.doesNotMatch(fs.readFileSync(path.join(root, 'src', name), 'utf8'), /dev-signing-secret/, `secret still in src/${name}`);
const load = (secret) => spawnSubject(process.execPath, ['-e', "console.log(require('./src/config.js').SIGNING_SECRET)"], { cwd: root, env: { SIGNING_SECRET: secret } });
const withSecret = load('from-the-environment');
assert.strictEqual(withSecret.stdout.trim(), 'from-the-environment');
assert.notStrictEqual(load(null).status, 0, 'loads without SIGNING_SECRET');
