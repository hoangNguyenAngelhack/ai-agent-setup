const assert = require('node:assert');
const { observe } = require('./runtime/isolate.cjs');

const seen = observe(`
  const { profileHtml } = load('src/render.js');
  const { handle } = load('src/app.js');
  return {
    hostile: profileHtml({ name: '<script>alert(1)</script>', email: '"x"@a.io' }),
    apostrophe: profileHtml({ name: "O'Neil & Co", email: 'o@a.io' }),
    page: handle({ method: 'GET', url: '/profile/1/html', headers: {} }).body,
  };
`);
// Any correct HTML escape is accepted: named, decimal or hexadecimal character references.
const quote = '(&quot;|&#34;|&#x22;)';
const apostrophe = '(&#39;|&#x27;|&apos;)';
assert.doesNotMatch(seen.hostile, /<script>/);
assert.match(seen.hostile, /(&lt;|&#60;|&#x3c;)script(&gt;|&#62;|&#x3e;)/i);
assert.match(seen.hostile, new RegExp(`${quote}x${quote}@a\\.io`, 'i'));
assert.match(seen.apostrophe, new RegExp(`O${apostrophe}Neil (&amp;|&#38;|&#x26;) Co`, 'i'));
assert.match(seen.page, /Ada/);
