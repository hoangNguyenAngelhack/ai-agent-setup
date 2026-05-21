# {{PROJECT_NAME}}

Full-stack Next.js 14 + tRPC + Prisma + NextAuth + TailwindCSS

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
| `npm run dev` | Start development server |
| `npm run build` | Build for production |
| `npm run start` | Start production server |
| `npm run lint` | Run ESLint |
| `npm run typecheck` | Run TypeScript type checking |
| `npm run db:migrate` | Run database migrations |
| `npm run db:studio` | Open Prisma Studio |

## Project Structure

```
src/
├── app/                    # App Router pages
│   ├── api/trpc/           # tRPC API handler
│   ├── (auth)/             # Auth pages (login, register)
│   ├── (dashboard)/        # Protected dashboard pages
│   ├── layout.tsx          # Root layout
│   └── providers.tsx       # React Query + tRPC providers
├── components/
│   └── ui/                 # Shared UI components
├── lib/                    # Utilities
├── server/
│   ├── db.ts               # Prisma client
│   ├── trpc.ts             # tRPC config
│   └── routers/            # tRPC routers
└── trpc/
    └── client.ts           # tRPC React client
```

## Tech Stack

- **Framework**: Next.js 14 (App Router)
- **API**: tRPC (end-to-end type safety)
- **Database**: PostgreSQL + Prisma
- **Auth**: NextAuth.js
- **Styling**: TailwindCSS

## Author

{{AUTHOR_NAME}} <{{AUTHOR_EMAIL}}>
