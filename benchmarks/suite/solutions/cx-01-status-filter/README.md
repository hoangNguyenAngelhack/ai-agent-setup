# Shop

A small shop API built on `node:http`, with a static web UI in `public/`.

- `npm start` serves the API on port 3000.
- `npm test` runs the tests in `test/`.

Requests are authenticated with `Authorization: Bearer <token>`.

## Order status filter

`GET /orders?status=pending|shipped` returns only orders with that status; other values get 400 `INVALID_STATUS`.
