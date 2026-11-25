const http = require('node:http');
const { handle } = require('./app');
const { PORT } = require('./config');

const server = http.createServer((req, res) => {
  let raw = '';
  req.on('data', (chunk) => {
    raw += chunk;
  });
  req.on('end', () => {
    let response;
    try {
      response = handle({ method: req.method, url: req.url, headers: req.headers, body: raw ? JSON.parse(raw) : undefined });
    } catch {
      response = { status: 500, headers: { 'content-type': 'application/json' }, body: { error: { code: 'INTERNAL_ERROR' } } };
    }
    res.writeHead(response.status, response.headers);
    res.end(typeof response.body === 'string' ? response.body : JSON.stringify(response.body ?? ''));
  });
});

if (require.main === module) server.listen(PORT);

module.exports = { server };
