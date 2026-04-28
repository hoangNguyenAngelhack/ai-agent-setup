#!/bin/bash

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Print banner
echo ""
echo -e "${CYAN}╔═══════════════════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║          AI Agent Setup - Project Initializer             ║${NC}"
echo -e "${CYAN}╚═══════════════════════════════════════════════════════════╝${NC}"
echo ""

# Step 1: Project name
echo -e "${BLUE}[1/7]${NC} Project name:"
read -p "→ " PROJECT_NAME

if [ -z "$PROJECT_NAME" ]; then
  echo -e "${RED}Error: Project name is required${NC}"
  exit 1
fi

# Step 2: Project type
echo ""
echo -e "${BLUE}[2/7]${NC} Project type:"
echo "  1) fullstack  - Next.js frontend + Express backend"
echo "  2) backend    - Express API only"
echo "  3) frontend   - React + Vite SPA only"
echo "  4) nextjs     - Next.js fullstack (App Router)"
read -p "→ Choose (1-4): " PROJECT_TYPE

case $PROJECT_TYPE in
  1) TYPE="fullstack" ;;
  2) TYPE="backend" ;;
  3) TYPE="frontend" ;;
  4) TYPE="nextjs" ;;
  *) TYPE="fullstack" ;;
esac

# Step 3: Tier
echo ""
echo -e "${BLUE}[3/7]${NC} Rule tier:"
echo "  1) starter   - MVP, prototypes (50% coverage)"
echo "  2) standard  - Production apps (80% coverage)"
echo "  3) strict    - Enterprise, fintech (95% coverage)"
read -p "→ Choose (1-3): " TIER_CHOICE

case $TIER_CHOICE in
  1) TIER="Starter" ;;
  2) TIER="Standard" ;;
  3) TIER="Strict" ;;
  *) TIER="Standard" ;;
esac

# Step 4: Database
echo ""
echo -e "${BLUE}[4/7]${NC} Database:"
echo "  1) postgresql - Recommended"
echo "  2) mysql"
echo "  3) sqlite     - Development only"
echo "  4) none       - No database"
read -p "→ Choose (1-4): " DB_CHOICE

case $DB_CHOICE in
  1) DATABASE="postgresql" ;;
  2) DATABASE="mysql" ;;
  3) DATABASE="sqlite" ;;
  4) DATABASE="none" ;;
  *) DATABASE="postgresql" ;;
esac

# Step 5: Features
echo ""
echo -e "${BLUE}[5/7]${NC} Additional features (comma-separated):"
echo "  redis, bullmq, docker, github-actions, husky"
read -p "→ Features (or press Enter to skip): " FEATURES

# Step 6: Author info
echo ""
echo -e "${BLUE}[6/7]${NC} Author name:"
read -p "→ " AUTHOR_NAME
AUTHOR_NAME=${AUTHOR_NAME:-"Developer"}

echo ""
echo -e "${BLUE}[7/7]${NC} Author email:"
read -p "→ " AUTHOR_EMAIL
AUTHOR_EMAIL=${AUTHOR_EMAIL:-"dev@example.com"}

# Confirm
echo ""
echo -e "${YELLOW}═══════════════════════════════════════════════════════════${NC}"
echo -e "${YELLOW}Configuration Summary:${NC}"
echo -e "  Project:  ${GREEN}$PROJECT_NAME${NC}"
echo -e "  Type:     ${GREEN}$TYPE${NC}"
echo -e "  Tier:     ${GREEN}$TIER${NC}"
echo -e "  Database: ${GREEN}$DATABASE${NC}"
echo -e "  Features: ${GREEN}${FEATURES:-none}${NC}"
echo -e "  Author:   ${GREEN}$AUTHOR_NAME <$AUTHOR_EMAIL>${NC}"
echo -e "${YELLOW}═══════════════════════════════════════════════════════════${NC}"
echo ""
read -p "Proceed? (Y/n): " CONFIRM

if [[ "$CONFIRM" =~ ^[Nn]$ ]]; then
  echo -e "${RED}Cancelled.${NC}"
  exit 0
fi

# Create project
echo ""
echo -e "${CYAN}Creating project...${NC}"

mkdir -p "$PROJECT_NAME"
cd "$PROJECT_NAME"

# Initialize git
git init -q

# Copy .claude configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cp -r "$SCRIPT_DIR/../.claude" .

# Update CLAUDE.md with tier and author
sed -i.bak "s/Hoang Nguyen (hoang.nguyen@angelhack.com)/$AUTHOR_NAME ($AUTHOR_EMAIL)/" .claude/CLAUDE.md
sed -i.bak "s/Tier: Standard/Tier: $TIER/" .claude/CLAUDE.md
rm -f .claude/CLAUDE.md.bak

# Create project structure based on type
echo -e "${CYAN}Setting up $TYPE project...${NC}"

case $TYPE in
  "backend")
    mkdir -p src/{config,controllers,middleware,models,repositories,routes,services,utils,queues}
    mkdir -p tests/{unit,integration,e2e}
    mkdir -p docs/{api,architecture}

    # Package.json
    cat > package.json << EOF
{
  "name": "$PROJECT_NAME",
  "version": "1.0.0",
  "description": "",
  "main": "dist/index.js",
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js",
    "test": "vitest",
    "test:coverage": "vitest --coverage",
    "lint": "eslint src --ext .ts",
    "db:migrate": "prisma migrate dev",
    "db:generate": "prisma generate",
    "db:studio": "prisma studio"
  },
  "keywords": [],
  "author": "$AUTHOR_NAME <$AUTHOR_EMAIL>",
  "license": "MIT"
}
EOF

    # Copy backend examples
    cp "$SCRIPT_DIR/../examples/backend/"*.ts src/utils/ 2>/dev/null || true
    ;;

  "frontend")
    # Will be created by Vite
    ;;

  "nextjs")
    # Will be created by create-next-app
    ;;

  "fullstack")
    mkdir -p apps/api/src/{config,controllers,middleware,models,repositories,routes,services,utils}
    mkdir -p apps/web/src/{components,hooks,lib,pages,stores}
    mkdir -p packages/shared/src

    # Root package.json for monorepo
    cat > package.json << EOF
{
  "name": "$PROJECT_NAME",
  "private": true,
  "workspaces": ["apps/*", "packages/*"],
  "scripts": {
    "dev": "turbo dev",
    "build": "turbo build",
    "test": "turbo test",
    "lint": "turbo lint"
  },
  "devDependencies": {
    "turbo": "^2.0.0"
  },
  "author": "$AUTHOR_NAME <$AUTHOR_EMAIL>",
  "license": "MIT"
}
EOF
    ;;
esac

# Create .env.example
cat > .env.example << EOF
# Application
NODE_ENV=development
PORT=3000
APP_NAME=$PROJECT_NAME
APP_URL=http://localhost:3000
LOG_LEVEL=info

# Database
EOF

if [ "$DATABASE" = "postgresql" ]; then
  echo "DATABASE_URL=postgresql://user:password@localhost:5432/${PROJECT_NAME}_dev" >> .env.example
elif [ "$DATABASE" = "mysql" ]; then
  echo "DATABASE_URL=mysql://user:password@localhost:3306/${PROJECT_NAME}_dev" >> .env.example
elif [ "$DATABASE" = "sqlite" ]; then
  echo "DATABASE_URL=file:./dev.db" >> .env.example
fi

cat >> .env.example << EOF

# Redis
REDIS_URL=redis://localhost:6379

# JWT
JWT_SECRET=change-this-in-production
JWT_EXPIRES_IN=15m
JWT_REFRESH_SECRET=change-this-refresh-secret
JWT_REFRESH_EXPIRES_IN=7d
EOF

# Create .gitignore
cat > .gitignore << 'EOF'
# Dependencies
node_modules/
.pnpm-store/

# Build
dist/
build/
.next/
out/

# Environment
.env
.env.local
.env.*.local

# IDE
.vscode/
.idea/
*.swp
*.swo

# OS
.DS_Store
Thumbs.db

# Logs
logs/
*.log
npm-debug.log*

# Testing
coverage/

# Database
*.db
*.sqlite

# Misc
.turbo/
EOF

# Create README
cat > README.md << EOF
# $PROJECT_NAME

## Tech Stack
- Type: $TYPE
- Tier: $TIER
- Database: $DATABASE

## Quick Start

\`\`\`bash
# Install dependencies
npm install

# Setup environment
cp .env.example .env

# Run database migrations (if applicable)
npm run db:migrate

# Start development
npm run dev
\`\`\`

## Project Structure

See \`.claude/rules/project-structure.md\` for details.

## Development Workflow

\`\`\`
/spec → /plan → /build → /test → /review → /deploy
\`\`\`

## Author

$AUTHOR_NAME <$AUTHOR_EMAIL>
EOF

# Create tsconfig.json
cat > tsconfig.json << 'EOF'
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "lib": ["ES2022"],
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"]
    }
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
EOF

# Add features
if [[ "$FEATURES" == *"docker"* ]]; then
  echo -e "${CYAN}Adding Docker support...${NC}"
  cat > Dockerfile << 'EOF'
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./
EXPOSE 3000
CMD ["node", "dist/index.js"]
EOF

  cat > docker-compose.yml << EOF
version: '3.8'
services:
  app:
    build: .
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
    depends_on:
      - db
      - redis

  db:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: user
      POSTGRES_PASSWORD: password
      POSTGRES_DB: ${PROJECT_NAME}_dev
    volumes:
      - postgres_data:/var/lib/postgresql/data
    ports:
      - "5432:5432"

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"

volumes:
  postgres_data:
EOF
fi

if [[ "$FEATURES" == *"github-actions"* ]]; then
  echo -e "${CYAN}Adding GitHub Actions...${NC}"
  mkdir -p .github/workflows
  cat > .github/workflows/ci.yml << 'EOF'
name: CI

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main, develop]

jobs:
  test:
    runs-on: ubuntu-latest

    services:
      postgres:
        image: postgres:16-alpine
        env:
          POSTGRES_USER: test
          POSTGRES_PASSWORD: test
          POSTGRES_DB: test
        ports:
          - 5432:5432
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5

    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Run linter
        run: npm run lint

      - name: Run tests
        run: npm run test:coverage
        env:
          DATABASE_URL: postgresql://test:test@localhost:5432/test

      - name: Upload coverage
        uses: codecov/codecov-action@v3
EOF
fi

if [[ "$FEATURES" == *"husky"* ]]; then
  echo -e "${CYAN}Adding Husky pre-commit hooks...${NC}"
  cat > .husky/pre-commit << 'EOF'
#!/bin/sh
. "$(dirname "$0")/_/husky.sh"

npm run lint
npm run test
EOF
  chmod +x .husky/pre-commit 2>/dev/null || true
fi

# Prisma setup
if [ "$DATABASE" != "none" ]; then
  echo -e "${CYAN}Setting up Prisma...${NC}"
  mkdir -p prisma

  if [ "$DATABASE" = "postgresql" ]; then
    PROVIDER="postgresql"
  elif [ "$DATABASE" = "mysql" ]; then
    PROVIDER="mysql"
  else
    PROVIDER="sqlite"
  fi

  cat > prisma/schema.prisma << EOF
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "$PROVIDER"
  url      = env("DATABASE_URL")
}

model User {
  id        String   @id @default(cuid())
  email     String   @unique
  name      String?
  password  String
  role      Role     @default(USER)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  deletedAt DateTime?

  @@map("users")
  @@index([email])
}

enum Role {
  USER
  ADMIN
}
EOF
fi

# Initial commit
git add -A
git commit -q -m "feat: initial project setup

- Project type: $TYPE
- Tier: $TIER
- Database: $DATABASE
- Features: ${FEATURES:-none}

Generated by AI Agent Setup CLI"

# Done!
echo ""
echo -e "${GREEN}╔═══════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║                    Setup Complete!                        ║${NC}"
echo -e "${GREEN}╚═══════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "Project created at: ${CYAN}$(pwd)${NC}"
echo ""
echo -e "${YELLOW}Next steps:${NC}"
echo ""
echo "  1. cd $PROJECT_NAME"
echo "  2. npm install"
echo "  3. cp .env.example .env"
echo "  4. npm run dev"
echo ""
echo -e "${BLUE}Happy coding!${NC}"
