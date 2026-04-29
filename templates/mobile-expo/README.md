# Mobile App Template

React Native + Expo template with TypeScript, NativeWind, and best practices.

## Tech Stack

- **Framework**: React Native 0.74 + Expo SDK 51
- **Language**: TypeScript (strict mode)
- **Routing**: Expo Router (file-based)
- **Styling**: NativeWind (Tailwind CSS)
- **State**: Zustand + MMKV
- **Server State**: TanStack Query
- **Forms**: React Hook Form + Zod

## Quick Start

```bash
# Install dependencies
npm install

# Start development
npm start

# Run on iOS
npm run ios

# Run on Android
npm run android
```

## Project Structure

```
src/
├── app/                    # Expo Router (file-based routing)
│   ├── (tabs)/             # Tab navigator
│   │   ├── _layout.tsx
│   │   ├── index.tsx       # Home
│   │   ├── profile.tsx
│   │   └── settings.tsx
│   ├── (auth)/             # Auth stack
│   └── _layout.tsx         # Root layout
├── components/
│   └── ui/                 # Design system
├── lib/
│   ├── api.ts              # Axios client
│   └── utils.ts            # Utilities
├── stores/                 # Zustand stores
├── hooks/                  # Custom hooks
└── constants/              # Theme, config
```

## Scripts

```bash
npm start           # Start Expo dev server
npm run ios         # Run on iOS simulator
npm run android     # Run on Android emulator
npm run lint        # Run ESLint
npm run typecheck   # Run TypeScript check
npm test            # Run tests
```

## Building for Production

```bash
# Install EAS CLI
npm install -g eas-cli

# Configure EAS
eas build:configure

# Build for stores
eas build --platform ios --profile production
eas build --platform android --profile production

# Submit to stores
eas submit --platform ios
eas submit --platform android
```

## Environment Variables

Copy `.env.example` to `.env` and configure:

```bash
API_URL=http://localhost:3000/api/v1
```

## Code Style

See `.claude/rules/` for coding standards:

- `tech-stack.md` - Approved libraries
- `clean-code.md` - Code quality rules
- `mobile-performance-checklist.md` - Performance guidelines

## License

MIT
