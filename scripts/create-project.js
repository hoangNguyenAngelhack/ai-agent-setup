#!/usr/bin/env node

const { execSync, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const readline = require('readline');

const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

const log = {
  info: (msg) => console.log(`${colors.cyan}${msg}${colors.reset}`),
  success: (msg) => console.log(`${colors.green}${msg}${colors.reset}`),
  warn: (msg) => console.log(`${colors.yellow}${msg}${colors.reset}`),
  error: (msg) => console.log(`${colors.red}${msg}${colors.reset}`),
  step: (num, msg) => console.log(`${colors.blue}[${num}]${colors.reset} ${msg}`),
};

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

const question = (query) => new Promise((resolve) => rl.question(query, resolve));

async function main() {
  console.log('');
  log.info('╔═══════════════════════════════════════════════════════════╗');
  log.info('║          AI Agent Setup - Project Initializer             ║');
  log.info('╚═══════════════════════════════════════════════════════════╝');
  console.log('');

  // Step 1: Project name
  log.step('1/6', 'Project name:');
  const projectName = await question('→ ');
  if (!projectName) {
    log.error('Project name is required');
    process.exit(1);
  }

  // Step 2: Project type
  console.log('');
  log.step('2/6', 'Project type:');
  console.log('  1) backend    - Express + Prisma + Redis');
  console.log('  2) frontend   - React + Vite + TanStack Query');
  console.log('  3) nextjs     - Next.js 14 (App Router)');
  console.log('  4) fullstack  - Monorepo (API + Web)');
  const typeChoice = await question('→ Choose (1-4): ');
  const types = { '1': 'backend', '2': 'frontend', '3': 'nextjs', '4': 'fullstack' };
  const projectType = types[typeChoice] || 'backend';

  // Step 3: Tier
  console.log('');
  log.step('3/6', 'Rule tier:');
  console.log('  1) starter   - MVP, prototypes (50% test coverage)');
  console.log('  2) standard  - Production apps (80% coverage)');
  console.log('  3) strict    - Enterprise (95% coverage)');
  const tierChoice = await question('→ Choose (1-3): ');
  const tiers = { '1': 'Starter', '2': 'Standard', '3': 'Strict' };
  const tier = tiers[tierChoice] || 'Standard';

  // Step 4: Database
  console.log('');
  log.step('4/6', 'Database:');
  console.log('  1) postgresql');
  console.log('  2) mysql');
  console.log('  3) sqlite');
  console.log('  4) none');
  const dbChoice = await question('→ Choose (1-4): ');
  const dbs = { '1': 'postgresql', '2': 'mysql', '3': 'sqlite', '4': 'none' };
  const database = dbs[dbChoice] || 'postgresql';

  // Step 5: Author
  console.log('');
  log.step('5/6', 'Author name:');
  const authorName = (await question('→ ')) || 'Developer';

  console.log('');
  log.step('6/6', 'Author email:');
  const authorEmail = (await question('→ ')) || 'dev@example.com';

  rl.close();

  // Summary
  console.log('');
  log.warn('═══════════════════════════════════════════════════════════');
  log.warn('Configuration:');
  console.log(`  Project:  ${colors.green}${projectName}${colors.reset}`);
  console.log(`  Type:     ${colors.green}${projectType}${colors.reset}`);
  console.log(`  Tier:     ${colors.green}${tier}${colors.reset}`);
  console.log(`  Database: ${colors.green}${database}${colors.reset}`);
  console.log(`  Author:   ${colors.green}${authorName} <${authorEmail}>${colors.reset}`);
  log.warn('═══════════════════════════════════════════════════════════');

  console.log('');
  log.info('Creating project...');

  // Create directory
  fs.mkdirSync(projectName, { recursive: true });
  process.chdir(projectName);

  // Initialize based on type
  try {
    if (projectType === 'nextjs') {
      log.info('Running create-next-app...');
      execSync(
        `npx create-next-app@latest . --typescript --tailwind --eslint --app --src-dir --import-alias "@/*" --no-git`,
        { stdio: 'inherit' }
      );
    } else if (projectType === 'frontend') {
      log.info('Running create-vite...');
      execSync(`npm create vite@latest . -- --template react-ts`, { stdio: 'inherit' });
    } else {
      // Backend or fullstack - manual setup
      createBackendProject(projectName, projectType, database, authorName, authorEmail);
    }

    // Clone .claude configuration
    log.info('Setting up AI Agent configuration...');
    execSync(
      'npx degit hoangNguyenAngelhack/ai-agent-setup/.claude .claude --force',
      { stdio: 'inherit' }
    );

    // Update CLAUDE.md
    const claudeMdPath = '.claude/CLAUDE.md';
    if (fs.existsSync(claudeMdPath)) {
      let content = fs.readFileSync(claudeMdPath, 'utf8');
      content = content.replace(
        /Hoang Nguyen \(hoang\.nguyen@angelhack\.com\)/g,
        `${authorName} (${authorEmail})`
      );
      content = content.replace(/Tier: Standard/g, `Tier: ${tier}`);
      fs.writeFileSync(claudeMdPath, content);
    }

    // Git init
    execSync('git init -q');
    execSync('git add -A');
    execSync(`git commit -q -m "feat: initial project setup (${projectType}, ${tier})"`);

    console.log('');
    log.success('╔═══════════════════════════════════════════════════════════╗');
    log.success('║                    Setup Complete!                        ║');
    log.success('╚═══════════════════════════════════════════════════════════╝');
    console.log('');
    console.log(`Project created at: ${colors.cyan}${process.cwd()}${colors.reset}`);
    console.log('');
    log.warn('Next steps:');
    console.log('');
    console.log(`  1. cd ${projectName}`);
    console.log('  2. npm install');
    console.log('  3. cp .env.example .env');
    console.log('  4. npm run dev');
    console.log('');
    log.info('Happy coding!');
  } catch (error) {
    log.error(`Error: ${error.message}`);
    process.exit(1);
  }
}

function createBackendProject(name, type, database, author, email) {
  // Create directories
  const dirs = [
    'src/config',
    'src/controllers',
    'src/middleware',
    'src/models',
    'src/repositories',
    'src/routes',
    'src/services',
    'src/utils',
    'tests/unit',
    'tests/integration',
    'prisma',
  ];
  dirs.forEach((dir) => fs.mkdirSync(dir, { recursive: true }));

  // Package.json
  const pkg = {
    name,
    version: '1.0.0',
    type: 'module',
    scripts: {
      dev: 'tsx watch src/index.ts',
      build: 'tsc',
      start: 'node dist/index.js',
      test: 'vitest',
      'test:coverage': 'vitest --coverage',
      lint: 'eslint src --ext .ts',
      'db:migrate': 'prisma migrate dev',
      'db:generate': 'prisma generate',
      'db:studio': 'prisma studio',
    },
    dependencies: {
      express: '^4.18.2',
      '@prisma/client': '^5.10.0',
      ioredis: '^5.3.2',
      zod: '^3.22.4',
      pino: '^8.19.0',
      jsonwebtoken: '^9.0.2',
      bcrypt: '^5.1.1',
      cors: '^2.8.5',
      helmet: '^7.1.0',
    },
    devDependencies: {
      typescript: '^5.4.0',
      tsx: '^4.7.0',
      vitest: '^1.3.0',
      prisma: '^5.10.0',
      '@types/node': '^20.11.0',
      '@types/express': '^4.17.21',
      '@types/bcrypt': '^5.0.2',
      '@types/jsonwebtoken': '^9.0.5',
      '@types/cors': '^2.8.17',
      eslint: '^8.57.0',
      '@typescript-eslint/eslint-plugin': '^7.0.0',
      '@typescript-eslint/parser': '^7.0.0',
    },
    author: `${author} <${email}>`,
    license: 'MIT',
  };
  fs.writeFileSync('package.json', JSON.stringify(pkg, null, 2));

  // tsconfig.json
  const tsconfig = {
    compilerOptions: {
      target: 'ES2022',
      module: 'NodeNext',
      moduleResolution: 'NodeNext',
      lib: ['ES2022'],
      outDir: './dist',
      rootDir: './src',
      strict: true,
      esModuleInterop: true,
      skipLibCheck: true,
      forceConsistentCasingInFileNames: true,
      resolveJsonModule: true,
      declaration: true,
      sourceMap: true,
      baseUrl: '.',
      paths: { '@/*': ['./src/*'] },
    },
    include: ['src/**/*'],
    exclude: ['node_modules', 'dist'],
  };
  fs.writeFileSync('tsconfig.json', JSON.stringify(tsconfig, null, 2));

  // .env.example
  let envContent = `NODE_ENV=development
PORT=3000
APP_NAME=${name}

`;
  if (database === 'postgresql') {
    envContent += `DATABASE_URL=postgresql://user:password@localhost:5432/${name}_dev\n`;
  } else if (database === 'mysql') {
    envContent += `DATABASE_URL=mysql://user:password@localhost:3306/${name}_dev\n`;
  } else if (database === 'sqlite') {
    envContent += `DATABASE_URL=file:./dev.db\n`;
  }
  envContent += `
REDIS_URL=redis://localhost:6379

JWT_SECRET=change-this-secret
JWT_EXPIRES_IN=15m
`;
  fs.writeFileSync('.env.example', envContent);

  // Prisma schema
  if (database !== 'none') {
    const provider = database === 'postgresql' ? 'postgresql' : database === 'mysql' ? 'mysql' : 'sqlite';
    const prismaSchema = `generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "${provider}"
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

  @@map("users")
}

enum Role {
  USER
  ADMIN
}
`;
    fs.writeFileSync('prisma/schema.prisma', prismaSchema);
  }

  // .gitignore
  fs.writeFileSync(
    '.gitignore',
    `node_modules/
dist/
.env
.env.local
*.log
coverage/
.DS_Store
`
  );

  // Entry point
  fs.writeFileSync(
    'src/index.ts',
    `import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { logger } from './utils/logger.js';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(helmet());
app.use(cors());
app.use(express.json());

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
  logger.info(\`Server running on port \${PORT}\`);
});
`
  );

  // Logger
  fs.writeFileSync(
    'src/utils/logger.ts',
    `import pino from 'pino';

export const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  transport: process.env.NODE_ENV === 'development'
    ? { target: 'pino-pretty' }
    : undefined,
});
`
  );

  // README
  fs.writeFileSync(
    'README.md',
    `# ${name}

## Quick Start

\`\`\`bash
npm install
cp .env.example .env
npm run db:migrate
npm run dev
\`\`\`

## Scripts

- \`npm run dev\` - Start development server
- \`npm run build\` - Build for production
- \`npm run test\` - Run tests
- \`npm run db:studio\` - Open Prisma Studio

## Author

${author} <${email}>
`
  );
}

main().catch(console.error);
