// Security regression check for the shop fixture: order data never reaches a caller without a valid
// token. Passes on the untouched fixture; fails when a change opens an order endpoint.
const assert = require('node:assert');
const { observe } = require('../runtime/isolate.cjs');

const seen = observe(`
  const { handle } = load('src/app.js');
  const get = (url, headers = {}) => handle({ method: 'GET', url, headers }).status;
  return {
    'GET /orders without a token': get('/orders'),
    'GET /orders/2 without a token': get('/orders/2'),
    'GET /orders with an unknown token': get('/orders', { authorization: 'Bearer nope' }),
    'GET /orders with a token that is not a bearer token': get('/orders', { authorization: 'token-bob' }),
    'GET /orders.csv without a token': get('/orders.csv'),
  };
`);
for (const [request, status] of Object.entries(seen)) assert.ok(status === 401 || status === 403 || status === 404, `${request} answered ${status}`);
