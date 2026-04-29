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
  console.log('  1) backend      - Express + Prisma + Redis');
  console.log('  2) frontend     - React + Vite + TanStack Query');
  console.log('  3) nextjs       - Next.js 14 (App Router)');
  console.log('  4) mobile-expo  - React Native + Expo (recommended)');
  console.log('  5) mobile-cli   - React Native CLI (bare workflow)');
  console.log('  6) fullstack    - Monorepo (API + Web)');
  const typeChoice = await question('→ Choose (1-6): ');
  const types = { '1': 'backend', '2': 'frontend', '3': 'nextjs', '4': 'mobile-expo', '5': 'mobile-cli', '6': 'fullstack' };
  const projectType = types[typeChoice] || 'backend';
  const isMobile = projectType === 'mobile-expo' || projectType === 'mobile-cli';

  // Step 3: Tier
  console.log('');
  log.step('3/6', 'Rule tier:');
  console.log('  1) starter   - MVP, prototypes (50% test coverage)');
  console.log('  2) standard  - Production apps (80% coverage)');
  console.log('  3) strict    - Enterprise (95% coverage)');
  const tierChoice = await question('→ Choose (1-3): ');
  const tiers = { '1': 'Starter', '2': 'Standard', '3': 'Strict' };
  const tier = tiers[tierChoice] || 'Standard';

  // Step 4: Database (skip for mobile)
  let database = 'none';
  if (!isMobile) {
    console.log('');
    log.step('4/6', 'Database:');
    console.log('  1) postgresql');
    console.log('  2) mysql');
    console.log('  3) sqlite');
    console.log('  4) none');
    const dbChoice = await question('→ Choose (1-4): ');
    const dbs = { '1': 'postgresql', '2': 'mysql', '3': 'sqlite', '4': 'none' };
    database = dbs[dbChoice] || 'postgresql';
  } else {
    console.log('');
    log.step('4/6', 'Database: skipped (mobile project)');
  }

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
    } else if (projectType === 'mobile-expo') {
      log.info('Running create-expo-app...');
      execSync(`npx create-expo-app@latest . --template blank-typescript`, { stdio: 'inherit' });
      createMobileExpoProject(projectName, authorName, authorEmail);
    } else if (projectType === 'mobile-cli') {
      log.info('Running react-native init...');
      execSync(`npx @react-native-community/cli init ${projectName} --template react-native-template-typescript --directory .`, { stdio: 'inherit' });
      createMobileCLIProject(projectName, authorName, authorEmail);
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
    if (projectType === 'mobile-expo') {
      console.log('  2. npm install');
      console.log('  3. npx expo start');
    } else if (projectType === 'mobile-cli') {
      console.log('  2. npm install');
      console.log('  3. cd ios && pod install && cd ..');
      console.log('  4. npm run ios  # or npm run android');
    } else {
      console.log('  2. npm install');
      console.log('  3. cp .env.example .env');
      console.log('  4. npm run dev');
    }
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

function createMobileExpoProject(name, author, email) {
  // Create additional directories
  const dirs = [
    'src/components/ui',
    'src/lib',
    'src/stores',
    'src/hooks',
    'src/constants',
  ];
  dirs.forEach((dir) => fs.mkdirSync(dir, { recursive: true }));

  // Add dependencies to package.json
  const pkgPath = 'package.json';
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
  pkg.dependencies = {
    ...pkg.dependencies,
    '@react-navigation/native': '^6.1.0',
    '@tanstack/react-query': '^5.0.0',
    axios: '^1.6.0',
    'expo-image': '~1.12.0',
    'expo-router': '~3.5.0',
    'expo-secure-store': '~13.0.0',
    'lucide-react-native': '^0.300.0',
    nativewind: '^4.0.0',
    'react-hook-form': '^7.50.0',
    'react-native-mmkv': '^2.12.0',
    'react-native-reanimated': '~3.10.0',
    'react-native-safe-area-context': '4.10.0',
    'react-native-screens': '3.31.0',
    'react-native-svg': '15.2.0',
    zod: '^3.22.0',
    zustand: '^4.5.0',
    '@hookform/resolvers': '^3.3.0',
  };
  pkg.devDependencies = {
    ...pkg.devDependencies,
    '@testing-library/react-native': '^12.4.0',
    tailwindcss: '^3.4.0',
  };
  pkg.main = 'expo-router/entry';
  pkg.author = `${author} <${email}>`;
  fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2));

  // Update app.json
  const appJsonPath = 'app.json';
  const appJson = JSON.parse(fs.readFileSync(appJsonPath, 'utf8'));
  appJson.expo.scheme = name.toLowerCase().replace(/[^a-z0-9]/g, '');
  appJson.expo.plugins = ['expo-router', 'expo-secure-store'];
  appJson.expo.experiments = { typedRoutes: true };
  fs.writeFileSync(appJsonPath, JSON.stringify(appJson, null, 2));

  // tailwind.config.js
  fs.writeFileSync(
    'tailwind.config.js',
    `/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,ts,tsx}', './app/**/*.{js,ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        primary: {
          500: '#3b82f6',
          600: '#2563eb',
        },
      },
    },
  },
  plugins: [],
};
`
  );

  // babel.config.js
  fs.writeFileSync(
    'babel.config.js',
    `module.exports = function (api) {
  api.cache(true);
  return {
    presets: [
      ['babel-preset-expo', { jsxImportSource: 'nativewind' }],
      'nativewind/babel',
    ],
    plugins: ['react-native-reanimated/plugin'],
  };
};
`
  );

  // metro.config.js
  fs.writeFileSync(
    'metro.config.js',
    `const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');

const config = getDefaultConfig(__dirname);

module.exports = withNativeWind(config, { input: './src/global.css' });
`
  );

  // eas.json
  fs.writeFileSync(
    'eas.json',
    JSON.stringify(
      {
        cli: { version: '>= 5.0.0' },
        build: {
          development: { developmentClient: true, distribution: 'internal' },
          preview: { distribution: 'internal' },
          production: {},
        },
        submit: { production: {} },
      },
      null,
      2
    )
  );

  // global.css
  fs.writeFileSync(
    'src/global.css',
    `@tailwind base;
@tailwind components;
@tailwind utilities;
`
  );

  // API client
  fs.writeFileSync(
    'src/lib/api.ts',
    `import axios from 'axios';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000/api/v1';

export const api = axios.create({
  baseURL: API_URL,
  timeout: 10000,
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Handle unauthorized
    }
    return Promise.reject(error);
  }
);
`
  );

  // Auth store
  fs.writeFileSync(
    'src/stores/auth-store.ts',
    `import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { MMKV } from 'react-native-mmkv';

const storage = new MMKV();

const mmkvStorage = {
  getItem: (name: string) => storage.getString(name) ?? null,
  setItem: (name: string, value: string) => storage.set(name, value),
  removeItem: (name: string) => storage.delete(name),
};

interface AuthState {
  token: string | null;
  setToken: (token: string | null) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      setToken: (token) => set({ token }),
      logout: () => set({ token: null }),
    }),
    {
      name: 'auth-storage',
      storage: createJSONStorage(() => mmkvStorage),
    }
  )
);
`
  );

  // Button component
  fs.writeFileSync(
    'src/components/ui/button.tsx',
    `import React from 'react';
import { Pressable, Text, ActivityIndicator, PressableProps } from 'react-native';

interface ButtonProps extends PressableProps {
  title: string;
  loading?: boolean;
  variant?: 'primary' | 'outline';
}

export function Button({ title, loading, variant = 'primary', disabled, ...props }: ButtonProps) {
  const isPrimary = variant === 'primary';

  return (
    <Pressable
      className={\`px-4 py-3 rounded-lg items-center \${
        isPrimary ? 'bg-primary-500 active:bg-primary-600' : 'border border-primary-500'
      } \${(disabled || loading) ? 'opacity-50' : ''}\`}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? (
        <ActivityIndicator color={isPrimary ? 'white' : '#3b82f6'} />
      ) : (
        <Text className={\`font-semibold \${isPrimary ? 'text-white' : 'text-primary-500'}\`}>
          {title}
        </Text>
      )}
    </Pressable>
  );
}
`
  );

  // README
  fs.writeFileSync(
    'README.md',
    `# ${name}

React Native + Expo mobile app.

## Quick Start

\`\`\`bash
npm install
npx expo start
\`\`\`

## Scripts

- \`npm start\` - Start Expo dev server
- \`npm run ios\` - Run on iOS simulator
- \`npm run android\` - Run on Android emulator
- \`npm test\` - Run tests

## Build for Production

\`\`\`bash
npm install -g eas-cli
eas build --platform all
\`\`\`

## Author

${author} <${email}>
`
  );
}

function createMobileCLIProject(name, author, email) {
  // Create additional directories
  const dirs = [
    'src/screens',
    'src/screens/auth',
    'src/components/ui',
    'src/navigation',
    'src/services',
    'src/stores',
    'src/hooks',
    'src/utils',
    'src/constants',
  ];
  dirs.forEach((dir) => fs.mkdirSync(dir, { recursive: true }));

  // Update package.json
  const pkgPath = 'package.json';
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
  pkg.dependencies = {
    ...pkg.dependencies,
    '@react-navigation/native': '^6.1.0',
    '@react-navigation/native-stack': '^6.9.0',
    '@react-navigation/bottom-tabs': '^6.5.0',
    '@tanstack/react-query': '^5.0.0',
    axios: '^1.6.0',
    'react-native-screens': '^3.31.0',
    'react-native-safe-area-context': '^4.10.0',
    'react-native-gesture-handler': '^2.16.0',
    'react-native-reanimated': '^3.10.0',
    'react-native-svg': '^15.2.0',
    'react-native-mmkv': '^2.12.0',
    'react-native-keychain': '^8.2.0',
    'react-native-fast-image': '^8.6.3',
    'react-native-config': '^1.5.1',
    nativewind: '^4.0.0',
    'react-hook-form': '^7.50.0',
    '@hookform/resolvers': '^3.3.0',
    zod: '^3.22.0',
    zustand: '^4.5.0',
    'lucide-react-native': '^0.300.0',
  };
  pkg.devDependencies = {
    ...pkg.devDependencies,
    '@testing-library/react-native': '^12.4.0',
    tailwindcss: '^3.4.0',
  };
  pkg.author = `${author} <${email}>`;
  fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2));

  // tailwind.config.js
  fs.writeFileSync(
    'tailwind.config.js',
    `/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./App.{js,ts,tsx}', './src/**/*.{js,ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        primary: {
          500: '#3b82f6',
          600: '#2563eb',
        },
      },
    },
  },
  plugins: [],
};
`
  );

  // babel.config.js - update existing
  fs.writeFileSync(
    'babel.config.js',
    `module.exports = {
  presets: [
    ['module:@react-native/babel-preset', { jsxImportSource: 'nativewind' }],
    'nativewind/babel',
  ],
  plugins: ['react-native-reanimated/plugin'],
};
`
  );

  // .env.example
  fs.writeFileSync(
    '.env',
    `API_URL=http://localhost:3000/api/v1
`
  );

  // global.css
  fs.writeFileSync(
    'src/global.css',
    `@tailwind base;
@tailwind components;
@tailwind utilities;
`
  );

  // API client
  fs.writeFileSync(
    'src/services/api.ts',
    `import axios from 'axios';
import Config from 'react-native-config';

const API_URL = Config.API_URL || 'http://localhost:3000/api/v1';

export const api = axios.create({
  baseURL: API_URL,
  timeout: 10000,
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Handle unauthorized
    }
    return Promise.reject(error);
  }
);
`
  );

  // Auth store
  fs.writeFileSync(
    'src/stores/auth-store.ts',
    `import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { MMKV } from 'react-native-mmkv';

const storage = new MMKV();

const mmkvStorage = {
  getItem: (name: string) => storage.getString(name) ?? null,
  setItem: (name: string, value: string) => storage.set(name, value),
  removeItem: (name: string) => storage.delete(name),
};

interface AuthState {
  token: string | null;
  setToken: (token: string | null) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      setToken: (token) => set({ token }),
      logout: () => set({ token: null }),
    }),
    {
      name: 'auth-storage',
      storage: createJSONStorage(() => mmkvStorage),
    }
  )
);
`
  );

  // Navigation
  fs.writeFileSync(
    'src/navigation/RootNavigator.tsx',
    `import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Home, User, Settings } from 'lucide-react-native';

import HomeScreen from '../screens/HomeScreen';
import ProfileScreen from '../screens/ProfileScreen';
import SettingsScreen from '../screens/SettingsScreen';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={{
        tabBarActiveTintColor: '#3b82f6',
        tabBarInactiveTintColor: '#9ca3af',
      }}
    >
      <Tab.Screen
        name="Home"
        component={HomeScreen}
        options={{ tabBarIcon: ({ color, size }) => <Home color={color} size={size} /> }}
      />
      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{ tabBarIcon: ({ color, size }) => <User color={color} size={size} /> }}
      />
      <Tab.Screen
        name="Settings"
        component={SettingsScreen}
        options={{ tabBarIcon: ({ color, size }) => <Settings color={color} size={size} /> }}
      />
    </Tab.Navigator>
  );
}

export function RootNavigator() {
  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="Main" component={MainTabs} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
`
  );

  // Screens
  fs.writeFileSync(
    'src/screens/HomeScreen.tsx',
    `import React from 'react';
import { View, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function HomeScreen() {
  return (
    <SafeAreaView className="flex-1 bg-white">
      <View className="flex-1 items-center justify-center p-4">
        <Text className="text-2xl font-bold text-gray-900">Home</Text>
      </View>
    </SafeAreaView>
  );
}
`
  );

  fs.writeFileSync(
    'src/screens/ProfileScreen.tsx',
    `import React from 'react';
import { View, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function ProfileScreen() {
  return (
    <SafeAreaView className="flex-1 bg-white">
      <View className="flex-1 items-center justify-center p-4">
        <Text className="text-2xl font-bold text-gray-900">Profile</Text>
      </View>
    </SafeAreaView>
  );
}
`
  );

  fs.writeFileSync(
    'src/screens/SettingsScreen.tsx',
    `import React from 'react';
import { View, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function SettingsScreen() {
  return (
    <SafeAreaView className="flex-1 bg-white">
      <View className="flex-1 items-center justify-center p-4">
        <Text className="text-2xl font-bold text-gray-900">Settings</Text>
      </View>
    </SafeAreaView>
  );
}
`
  );

  // Button component
  fs.writeFileSync(
    'src/components/ui/Button.tsx',
    `import React from 'react';
import { Pressable, Text, ActivityIndicator, PressableProps } from 'react-native';

interface ButtonProps extends PressableProps {
  title: string;
  loading?: boolean;
  variant?: 'primary' | 'outline';
}

export function Button({ title, loading, variant = 'primary', disabled, ...props }: ButtonProps) {
  const isPrimary = variant === 'primary';

  return (
    <Pressable
      className={\`px-4 py-3 rounded-lg items-center \${
        isPrimary ? 'bg-primary-500 active:bg-primary-600' : 'border border-primary-500'
      } \${(disabled || loading) ? 'opacity-50' : ''}\`}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? (
        <ActivityIndicator color={isPrimary ? 'white' : '#3b82f6'} />
      ) : (
        <Text className={\`font-semibold \${isPrimary ? 'text-white' : 'text-primary-500'}\`}>
          {title}
        </Text>
      )}
    </Pressable>
  );
}
`
  );

  // Update App.tsx
  fs.writeFileSync(
    'App.tsx',
    `import './src/global.css';
import React from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RootNavigator } from './src/navigation/RootNavigator';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      retry: 2,
    },
  },
});

export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <RootNavigator />
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
`
  );

  // README
  fs.writeFileSync(
    'README.md',
    `# ${name}

React Native CLI mobile app.

## Quick Start

\`\`\`bash
npm install
cd ios && pod install && cd ..
npm run ios   # or npm run android
\`\`\`

## Scripts

- \`npm run ios\` - Run on iOS simulator
- \`npm run android\` - Run on Android emulator
- \`npm test\` - Run tests

## Build for Production

\`\`\`bash
# iOS
cd ios && xcodebuild -workspace ${name}.xcworkspace -scheme ${name} -configuration Release

# Android
cd android && ./gradlew assembleRelease
\`\`\`

## Author

${author} <${email}>
`
  );
}

main().catch(console.error);
