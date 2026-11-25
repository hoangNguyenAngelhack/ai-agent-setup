# Shop API

Authentication: `Authorization: Bearer <token>` where noted.

- `GET /health`: `{ "status": "ok" }`.
- `GET /users?email=<email>`: `{ id, name }`; 400 `INVALID_EMAIL`, 404 `NOT_FOUND`.
- `GET /users/:id`: `{ id, name, email }`; 400 `INVALID_ID`.
- `GET /profile/:id/html`: HTML profile; 404 `NOT_FOUND`.
- `GET /orders` (Bearer token): `{ data: [orders] }`; 401 `UNAUTHENTICATED`.
- `GET /orders/:id` (Bearer token): the order; 401 `UNAUTHENTICATED`, 404 `NOT_FOUND`.
