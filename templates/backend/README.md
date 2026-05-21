# {{PROJECT_NAME}}

Express + TypeScript + Prisma + Redis backend API.

## Quick Start

```bash
npm install
cp .env.example .env
npm run db:migrate
npm run dev
```

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server with hot reload |
| `npm run build` | Build for production |
| `npm run start` | Start production server |
| `npm run test` | Run tests |
| `npm run lint` | Run ESLint |
| `npm run typecheck` | Run TypeScript type checking |
| `npm run db:migrate` | Run database migrations |
| `npm run db:studio` | Open Prisma Studio |
| `npm run db:seed` | Seed database |

## Project Structure

```
src/
├── config/          # Database, Redis, env configuration
├── controllers/     # Route handlers (thin layer)
├── middleware/      # Express middleware (auth, logging, errors)
├── repositories/    # Data access layer
├── routes/          # Route definitions
├── services/        # Business logic
├── utils/           # Utilities (logger, errors)
└── index.ts         # Application entry point
```

## API Conventions

- Base URL: `/api/v1`
- Response format: `{ success: boolean, data?: T, error?: { code, message } }`
- Authentication: Bearer token in `Authorization` header

## Author

{{AUTHOR_NAME}} <{{AUTHOR_EMAIL}}>
