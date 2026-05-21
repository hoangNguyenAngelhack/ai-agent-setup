# {{PROJECT_NAME}}

Next.js 14 (App Router) + TypeScript + TailwindCSS

## Quick Start

```bash
npm install
cp .env.example .env
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

## Project Structure

```
src/
├── app/                    # App Router pages
│   ├── layout.tsx          # Root layout
│   ├── page.tsx            # Home page
│   └── globals.css         # Global styles
├── components/
│   └── ui/                 # Shared UI components
└── lib/                    # Utilities
```

## Features

- **App Router** — File-based routing with layouts
- **Server Components** — Default server rendering
- **TypeScript** — Full type safety
- **TailwindCSS** — Utility-first styling
- **SEO Optimized** — Metadata API for SEO

## Deploy

Deploy to Vercel with one click:

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new)

## Author

{{AUTHOR_NAME}} <{{AUTHOR_EMAIL}}>
