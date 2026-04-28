#!/usr/bin/env node

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const readline = require('readline');

const VERSION = '1.0.0';

const colors = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  gray: '\x1b[90m',
};

const log = {
  info: (msg) => console.log(`${colors.cyan}${msg}${colors.reset}`),
  success: (msg) => console.log(`${colors.green}${msg}${colors.reset}`),
  warn: (msg) => console.log(`${colors.yellow}${msg}${colors.reset}`),
  error: (msg) => console.log(`${colors.red}${msg}${colors.reset}`),
  gray: (msg) => console.log(`${colors.gray}${msg}${colors.reset}`),
  step: (num, total, msg) => console.log(`${colors.blue}[${num}/${total}]${colors.reset} ${msg}`),
};

// Help text
const HELP = `
${colors.cyan}${colors.bold}create-ai-agent${colors.reset} - Create production-ready projects with AI agent configuration

${colors.yellow}Usage:${colors.reset}
  npx create-ai-agent [project-name] [options]

${colors.yellow}Options:${colors.reset}
  -t, --type <type>      Project type: backend, frontend, nextjs, fullstack
  -T, --tier <tier>      Rule tier: starter, standard, strict
  -d, --db <database>    Database: postgresql, mysql, sqlite, none
  -y, --yes              Skip prompts, use defaults
  -h, --help             Show this help
  -v, --version          Show version

${colors.yellow}Examples:${colors.reset}
  npx create-ai-agent my-app
  npx create-ai-agent my-api --type backend --db postgresql
  npx create-ai-agent my-app --type nextjs --tier strict -y

${colors.yellow}Interactive mode:${colors.reset}
  Just run: npx create-ai-agent
`;

// Parse arguments
function parseArgs(args) {
  const result = {
    projectName: null,
    type: null,
    tier: null,
    db: null,
    yes: false,
    help: false,
    version: false,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    const next = args[i + 1];

    if (arg === '-h' || arg === '--help') {
      result.help = true;
    } else if (arg === '-v' || arg === '--version') {
      result.version = true;
    } else if (arg === '-y' || arg === '--yes') {
      result.yes = true;
    } else if (arg === '-t' || arg === '--type') {
      result.type = next;
      i++;
    } else if (arg === '-T' || arg === '--tier') {
      result.tier = next;
      i++;
    } else if (arg === '-d' || arg === '--db') {
      result.db = next;
      i++;
    } else if (!arg.startsWith('-') && !result.projectName) {
      result.projectName = arg;
    }
  }

  return result;
}

// Readline helper
function createPrompt() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const question = (query) => new Promise((resolve) => rl.question(query, resolve));
  const close = () => rl.close();

  return { question, close };
}

// Validate project name
function validateProjectName(name) {
  if (!name) return 'Project name is required';
  if (!/^[a-z0-9-_]+$/i.test(name)) return 'Project name can only contain letters, numbers, hyphens, and underscores';
  if (fs.existsSync(name)) return `Directory "${name}" already exists`;
  return null;
}

// Main function
async function main() {
  const args = parseArgs(process.argv.slice(2));

  // Handle --help
  if (args.help) {
    console.log(HELP);
    process.exit(0);
  }

  // Handle --version
  if (args.version) {
    console.log(`create-ai-agent v${VERSION}`);
    process.exit(0);
  }

  // Banner
  console.log('');
  log.info('╔═══════════════════════════════════════════════════════════╗');
  log.info('║         create-ai-agent - Project Initializer             ║');
  log.info('╚═══════════════════════════════════════════════════════════╝');
  console.log('');

  const { question, close } = createPrompt();
  let config = {
    projectName: args.projectName,
    type: args.type,
    tier: args.tier,
    db: args.db,
    author: null,
    email: null,
  };

  try {
    // Step 1: Project name
    if (!config.projectName) {
      log.step(1, 6, 'Project name:');
      config.projectName = await question('→ ');
    }

    const nameError = validateProjectName(config.projectName);
    if (nameError) {
      log.error(nameError);
      close();
      process.exit(1);
    }

    // Step 2: Project type
    if (!config.type) {
      if (args.yes) {
        config.type = 'backend';
      } else {
        console.log('');
        log.step(2, 6, 'Project type:');
        console.log('  1) backend    - Express + Prisma + Redis');
        console.log('  2) frontend   - React + Vite + TanStack Query');
        console.log('  3) nextjs     - Next.js 14 (App Router)');
        console.log('  4) fullstack  - Monorepo (API + Web)');
        const choice = await question('→ Choose (1-4) [1]: ');
        const types = { '1': 'backend', '2': 'frontend', '3': 'nextjs', '4': 'fullstack', '': 'backend' };
        config.type = types[choice] || 'backend';
      }
    }

    // Step 3: Tier
    if (!config.tier) {
      if (args.yes) {
        config.tier = 'standard';
      } else {
        console.log('');
        log.step(3, 6, 'Rule tier:');
        console.log('  1) starter   - MVP, prototypes (50% test coverage)');
        console.log('  2) standard  - Production apps (80% coverage)');
        console.log('  3) strict    - Enterprise (95% coverage)');
        const choice = await question('→ Choose (1-3) [2]: ');
        const tiers = { '1': 'starter', '2': 'standard', '3': 'strict', '': 'standard' };
        config.tier = tiers[choice] || 'standard';
      }
    }

    // Step 4: Database
    if (!config.db) {
      if (args.yes) {
        config.db = 'postgresql';
      } else {
        console.log('');
        log.step(4, 6, 'Database:');
        console.log('  1) postgresql - Recommended');
        console.log('  2) mysql');
        console.log('  3) sqlite     - Development only');
        console.log('  4) none');
        const choice = await question('→ Choose (1-4) [1]: ');
        const dbs = { '1': 'postgresql', '2': 'mysql', '3': 'sqlite', '4': 'none', '': 'postgresql' };
        config.db = dbs[choice] || 'postgresql';
      }
    }

    // Step 5 & 6: Author info
    if (args.yes) {
      config.author = 'Developer';
      config.email = 'dev@example.com';
    } else {
      console.log('');
      log.step(5, 6, 'Author name:');
      config.author = (await question('→ [Developer]: ')) || 'Developer';

      console.log('');
      log.step(6, 6, 'Author email:');
      config.email = (await question('→ [dev@example.com]: ')) || 'dev@example.com';
    }

    close();

    // Summary
    console.log('');
    log.warn('═══════════════════════════════════════════════════════════');
    log.warn('Configuration:');
    console.log(`  Project:  ${colors.green}${config.projectName}${colors.reset}`);
    console.log(`  Type:     ${colors.green}${config.type}${colors.reset}`);
    console.log(`  Tier:     ${colors.green}${config.tier}${colors.reset}`);
    console.log(`  Database: ${colors.green}${config.db}${colors.reset}`);
    console.log(`  Author:   ${colors.green}${config.author} <${config.email}>${colors.reset}`);
    log.warn('═══════════════════════════════════════════════════════════');
    console.log('');

    // Create project
    log.info('Creating project...');

    // Create directory
    fs.mkdirSync(config.projectName, { recursive: true });
    process.chdir(config.projectName);

    // Download .claude configuration
    log.gray('→ Downloading AI agent configuration...');
    try {
      execSync('npx degit hoangNguyenAngelhack/ai-agent-setup/.claude .claude --force', {
        stdio: 'pipe'
      });
    } catch (e) {
      log.warn('Could not download .claude config, creating minimal version...');
      fs.mkdirSync('.claude', { recursive: true });
      fs.writeFileSync('.claude/CLAUDE.md', `# Claude AI Agent Configuration\n\n**Maintainer:** ${config.author} (${config.email})\n**Tier:** ${capitalize(config.tier)}\n`);
    }

    // Update CLAUDE.md
    const claudePath = '.claude/CLAUDE.md';
    if (fs.existsSync(claudePath)) {
      let content = fs.readFileSync(claudePath, 'utf8');
      content = content.replace(/Hoang Nguyen \(hoang\.nguyen@angelhack\.com\)/g, `${config.author} (${config.email})`);
      content = content.replace(/Tier: Standard/g, `Tier: ${capitalize(config.tier)}`);
      fs.writeFileSync(claudePath, content);
    }

    // Create project structure based on type
    log.gray(`→ Setting up ${config.type} project...`);

    if (config.type === 'nextjs') {
      execSync('npx create-next-app@latest . --typescript --tailwind --eslint --app --src-dir --import-alias "@/*" --no-git', {
        stdio: 'inherit',
      });
    } else if (config.type === 'frontend') {
      execSync('npm create vite@latest . -- --template react-ts', {
        stdio: 'inherit',
      });
    } else {
      createBackendProject(config);
    }

    // Git init
    log.gray('→ Initializing git...');
    execSync('git init -q', { stdio: 'pipe' });
    execSync('git add -A', { stdio: 'pipe' });
    execSync(`git commit -q -m "feat: initial project setup (${config.type}, ${config.tier})"`, { stdio: 'pipe' });

    // Done!
    console.log('');
    log.success('╔═══════════════════════════════════════════════════════════╗');
    log.success('║                    Setup Complete!                        ║');
    log.success('╚═══════════════════════════════════════════════════════════╝');
    console.log('');
    console.log(`Project created at: ${colors.cyan}${process.cwd()}${colors.reset}`);
    console.log('');
    log.warn('Next steps:');
    console.log('');
    console.log(`  cd ${config.projectName}`);
    console.log('  npm install');
    console.log('  cp .env.example .env');
    if (config.db !== 'none') {
      console.log('  npm run db:migrate');
    }
    console.log('  npm run dev');
    console.log('');
    log.info('Happy coding! 🚀');
    console.log('');

  } catch (error) {
    close();
    log.error(`Error: ${error.message}`);
    process.exit(1);
  }
}

function capitalize(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

function createBackendProject(config) {
  // Create directories
  const dirs = [
    'src/config',
    'src/controllers',
    'src/middleware',
    'src/repositories',
    'src/routes',
    'src/services',
    'src/utils',
    'tests/unit',
    'tests/integration',
  ];

  if (config.db !== 'none') {
    dirs.push('prisma');
  }

  dirs.forEach((dir) => fs.mkdirSync(dir, { recursive: true }));

  // Package.json
  const pkg = {
    name: config.projectName,
    version: '1.0.0',
    type: 'module',
    scripts: {
      dev: 'tsx watch src/index.ts',
      build: 'tsc',
      start: 'node dist/index.js',
      test: 'vitest',
      'test:coverage': 'vitest --coverage',
      lint: 'eslint src --ext .ts',
    },
    dependencies: {
      express: '^4.21.0',
      zod: '^3.23.0',
      pino: '^9.0.0',
      'pino-pretty': '^11.0.0',
      cors: '^2.8.5',
      helmet: '^7.1.0',
    },
    devDependencies: {
      typescript: '^5.5.0',
      tsx: '^4.16.0',
      vitest: '^2.0.0',
      '@types/node': '^22.0.0',
      '@types/express': '^4.17.21',
      '@types/cors': '^2.8.17',
    },
    author: `${config.author} <${config.email}>`,
    license: 'MIT',
  };

  if (config.db !== 'none') {
    pkg.dependencies['@prisma/client'] = '^5.18.0';
    pkg.devDependencies['prisma'] = '^5.18.0';
    pkg.scripts['db:migrate'] = 'prisma migrate dev';
    pkg.scripts['db:generate'] = 'prisma generate';
    pkg.scripts['db:studio'] = 'prisma studio';
  }

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
  let envContent = `# Application
NODE_ENV=development
PORT=3000
APP_NAME=${config.projectName}

`;

  if (config.db === 'postgresql') {
    envContent += `# Database\nDATABASE_URL=postgresql://user:password@localhost:5432/${config.projectName}_dev\n\n`;
  } else if (config.db === 'mysql') {
    envContent += `# Database\nDATABASE_URL=mysql://user:password@localhost:3306/${config.projectName}_dev\n\n`;
  } else if (config.db === 'sqlite') {
    envContent += `# Database\nDATABASE_URL=file:./dev.db\n\n`;
  }

  envContent += `# Redis
REDIS_URL=redis://localhost:6379

# JWT
JWT_SECRET=change-this-in-production
JWT_EXPIRES_IN=15m
`;

  fs.writeFileSync('.env.example', envContent);

  // Prisma schema
  if (config.db !== 'none') {
    const provider = config.db;
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
  fs.writeFileSync('.gitignore', `node_modules/
dist/
.env
.env.local
*.log
coverage/
.DS_Store
`);

  // Entry point
  fs.writeFileSync('src/index.ts', `import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { logger } from './utils/logger.js';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(helmet());
app.use(cors());
app.use(express.json());

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
  logger.info(\`Server running on http://localhost:\${PORT}\`);
});
`);

  // Logger
  fs.writeFileSync('src/utils/logger.ts', `import pino from 'pino';

export const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  transport: process.env.NODE_ENV === 'development'
    ? { target: 'pino-pretty', options: { colorize: true } }
    : undefined,
});
`);

  // README
  fs.writeFileSync('README.md', `# ${config.projectName}

## Quick Start

\`\`\`bash
npm install
cp .env.example .env
${config.db !== 'none' ? 'npm run db:migrate\n' : ''}npm run dev
\`\`\`

## Scripts

- \`npm run dev\` - Start development server
- \`npm run build\` - Build for production
- \`npm run test\` - Run tests
${config.db !== 'none' ? '- `npm run db:studio` - Open Prisma Studio\n' : ''}
## Author

${config.author} <${config.email}>
`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
