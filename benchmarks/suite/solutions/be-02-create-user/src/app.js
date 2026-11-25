const { authenticate } = require('./auth');
const { addUser, findUser, findUserByEmail, findOrder, ordersOf } = require('./store');
const { profileHtml } = require('./render');

function isPositiveInt(value) {
  return /^[1-9][0-9]*$/.test(String(value));
}

function isEmail(value) {
  return typeof value === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

const json = (status, body) => ({ status, headers: { 'content-type': 'application/json' }, body });

/**
 * Handles one request: { method, url, headers, body } → { status, headers, body }.
 * server.js adapts it to node:http.
 */
function handle(request) {
  const { method, headers = {} } = request;
  const url = new URL(request.url, 'http://shop.local');
  const parts = url.pathname.split('/').filter(Boolean);

  if (method === 'GET' && url.pathname === '/health') return json(200, { status: 'ok' });

  if (method === 'GET' && parts[0] === 'users' && parts.length === 1) {
    const email = url.searchParams.get('email');
    if (!isEmail(email)) return json(400, { error: { code: 'INVALID_EMAIL' } });
    const user = findUserByEmail(email);
    return user ? json(200, { id: user.id, name: user.name }) : json(404, { error: { code: 'NOT_FOUND' } });
  }

  if (method === 'GET' && parts[0] === 'users' && parts.length === 2) {
    if (!isPositiveInt(parts[1])) return json(400, { error: { code: 'INVALID_ID' } });
    const user = findUser(Number(parts[1]));
    return json(200, { id: user.id, name: user.name, email: user.email });
  }

  if (method === 'GET' && parts[0] === 'profile' && parts[2] === 'html') {
    const user = findUser(Number(parts[1]));
    if (!user) return json(404, { error: { code: 'NOT_FOUND' } });
    return { status: 200, headers: { 'content-type': 'text/html' }, body: profileHtml(user) };
  }

  if (method === 'GET' && parts[0] === 'orders') {
    const user = authenticate(headers);
    if (!user) return json(401, { error: { code: 'UNAUTHENTICATED' } });
    if (parts.length === 1) return json(200, { data: ordersOf(user.id) });
    const order = findOrder(Number(parts[1]));
    if (!order) return json(404, { error: { code: 'NOT_FOUND' } });
    return json(200, order);
  }

  if (method === 'POST' && url.pathname === '/users') {
    const { name, email } = request.body || {};
    if (typeof name !== 'string' || !name.trim() || !isEmail(email)) return json(422, { error: { code: 'VALIDATION_ERROR' } });
    if (findUserByEmail(email)) return json(409, { error: { code: 'CONFLICT' } });
    return json(201, addUser({ name: name.trim(), email }));
  }

  return json(404, { error: { code: 'NOT_FOUND' } });
}

module.exports = { handle };
