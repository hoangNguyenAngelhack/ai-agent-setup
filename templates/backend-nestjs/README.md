# {{PROJECT_NAME}}

NestJS + TypeScript + Prisma + Redis enterprise backend API.

## Quick Start

```bash
npm install
cp .env.example .env
npm run db:migrate
npm run start:dev
```

## Scripts

| Command | Description |
|---------|-------------|
| `npm run start:dev` | Start development server with hot reload |
| `npm run build` | Build for production |
| `npm run start:prod` | Start production server |
| `npm run test` | Run unit tests |
| `npm run test:e2e` | Run e2e tests |
| `npm run test:cov` | Run tests with coverage |
| `npm run lint` | Run ESLint |
| `npm run db:migrate` | Run database migrations |
| `npm run db:studio` | Open Prisma Studio |

## Project Structure

```
src/
├── common/              # Shared utilities
│   ├── decorators/      # Custom decorators
│   ├── filters/         # Exception filters
│   ├── guards/          # Auth guards
│   ├── interceptors/    # Logging, transform
│   └── pipes/           # Validation pipes
├── config/              # Configuration module
├── modules/
│   ├── auth/            # Authentication module
│   └── users/           # Users module
├── app.module.ts        # Root module
└── main.ts              # Bootstrap
```

## API Conventions

- Base URL: `/api/v1`
- Response format: `{ success: boolean, data?: T, error?: { code, message } }`
- Authentication: Bearer token in `Authorization` header
- Validation: class-validator + class-transformer
- Documentation: Swagger at `/api-docs`

## Tech Stack

- **Framework**: NestJS 10+
- **ORM**: Prisma
- **Database**: PostgreSQL
- **Cache**: Redis (@nestjs/cache-manager)
- **Queue**: BullMQ (@nestjs/bullmq)
- **Validation**: class-validator
- **Documentation**: @nestjs/swagger

## Author

{{AUTHOR_NAME}} <{{AUTHOR_EMAIL}}>
