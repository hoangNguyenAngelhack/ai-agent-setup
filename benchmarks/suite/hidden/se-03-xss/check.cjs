const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const assert = require('node:assert');
const { spawnSync } = require('node:child_process');
const root = path.join(__dirname, '..');
const app = () => require(path.join(root, 'src', 'app.js'));
const get = (url, headers = {}) => app().handle({ method: 'GET', url, headers });
const bob = { authorization: 'Bearer token-bob' };
const ada = { authorization: 'Bearer token-ada' };
const runTests = (cwd, file) => spawnSync(process.execPath, ['--test', file], { cwd, encoding: 'utf8' }).status;

const { profileHtml } = require(path.join(root, 'src', 'render.js'));
const html = profileHtml({ name: '<script>alert(1)</script>', email: '"x"@a.io' });
assert.doesNotMatch(html, /<script>/);
assert.match(html, /&lt;script&gt;/);
assert.match(html, /&quot;x&quot;@a\.io/);
assert.match(profileHtml({ name: "O'Neil & Co", email: 'o@a.io' }), /O(&#39;|&#x27;|&apos;)Neil &amp; Co/);
assert.match(get('/profile/1/html').body, /Ada/);
