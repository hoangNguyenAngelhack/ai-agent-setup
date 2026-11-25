# Shop

A small shop API built on `node:http`, with a static web UI in `public/`.

- `npm start` serves the API on port 3000.
- `npm test` runs the tests in `test/`.

Requests are authenticated with `Authorization: Bearer <token>`.

## CSV export

`GET /orders.csv` (token required) returns the signed-in user's orders as CSV: `id,total,status`.
