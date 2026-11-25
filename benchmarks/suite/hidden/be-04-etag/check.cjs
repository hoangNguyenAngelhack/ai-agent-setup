const assert = require('node:assert');
const { observe } = require('./runtime/isolate.cjs');

const seen = observe(`
  const { handle } = load('src/app.js');
  const get = (url, headers = {}) => handle({ method: 'GET', url, headers });
  const first = get('/users/2');
  const etag = first.headers && first.headers.etag;
  const cached = get('/users/2', { 'if-none-match': etag });
  return {
    first,
    again: get('/users/2').headers.etag,
    cached: { status: cached.status, emptyBody: cached.body === undefined || cached.body === '' || cached.body === null },
    stale: get('/users/2', { 'if-none-match': '"stale"' }).status,
    other: get('/users/1').headers.etag,
  };
`);
const etag = seen.first.headers.etag;
assert.strictEqual(seen.first.status, 200);
assert.ok(typeof etag === 'string' && etag.length > 2, 'no ETag header');
assert.strictEqual(seen.again, etag, 'ETag is not stable');
assert.strictEqual(seen.cached.status, 304);
assert.ok(seen.cached.emptyBody, '304 with a body');
assert.strictEqual(seen.stale, 200);
assert.notStrictEqual(seen.other, etag, 'different users share an ETag');
