# Mobile App Template (React Native CLI)

React Native CLI template with TypeScript, NativeWind, and best practices.

## Tech Stack

- **Framework**: React Native 0.74
- **Language**: TypeScript (strict mode)
- **Navigation**: React Navigation 6
- **Styling**: NativeWind (Tailwind CSS)
- **State**: Zustand + MMKV
- **Server State**: TanStack Query
- **Forms**: React Hook Form + Zod

## Quick Start

```bash
# Install dependencies
npm install

# Install iOS pods
cd ios && pod install && cd ..

# Run on iOS
npm run ios

# Run on Android
npm run android
```

## Project Structure

```
src/
├── screens/                # Screen components
│   ├── HomeScreen.tsx
│   ├── ProfileScreen.tsx
│   └── SettingsScreen.tsx
├── components/
│   └── ui/                 # Design system
├── navigation/
│   └── RootNavigator.tsx
├── services/
│   └── api.ts              # Axios client
├── stores/                 # Zustand stores
├── hooks/                  # Custom hooks
└── constants/              # Theme, config
```

## Scripts

```bash
npm run ios         # Run on iOS simulator
npm run android     # Run on Android emulator
npm run start       # Start Metro bundler
npm run lint        # Run ESLint
npm run typecheck   # Run TypeScript check
npm test            # Run tests
```

## Building for Production

### iOS

```bash
cd ios
xcodebuild -workspace MyApp.xcworkspace -scheme MyApp -configuration Release
```

### Android

```bash
cd android
./gradlew assembleRelease   # APK
./gradlew bundleRelease     # AAB for Play Store
```

## Environment Variables

Create `.env` from `.env.example`:

```bash
cp .env.example .env
```

Configure `react-native-config` in your native projects.

## Code Style

See `.claude/rules/` for coding standards:

- `tech-stack.md` - Approved libraries
- `clean-code.md` - Code quality rules
- `mobile-performance-checklist.md` - Performance guidelines

## License

MIT
