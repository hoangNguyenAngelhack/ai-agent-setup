---
name: react-native-mobile
description: Build React Native mobile apps with Expo or React Native CLI, NativeWind (Tailwind), React Navigation, and Zustand. Use when creating iOS/Android apps, mobile UI, navigation, or native features.
license: MIT
metadata:
  author: angelhack
  version: "1.3.5"
compatibility: Requires Node.js 18+, Expo CLI or React Native CLI, iOS Simulator/Android Emulator
---

# React Native Mobile Development

Build cross-platform mobile apps with React Native.

## Impact Levels

| Level | Description |
|-------|-------------|
| **CRITICAL** | Must follow - security, performance |
| **HIGH** | Should follow - maintainability, UX |
| **MEDIUM** | Recommended - code quality |

## Framework Selection (HIGH)

| Use Case | Framework |
|----------|-----------|
| Most apps (95%), MVPs, quick iteration | Expo (managed) |
| Custom native modules, brownfield apps | React Native CLI |

## Tech Stack

- **UI**: NativeWind (Tailwind CSS)
- **Navigation**: React Navigation / Expo Router
- **State**: Zustand + TanStack Query
- **Storage**: MMKV / expo-secure-store
- **Forms**: react-hook-form + Zod
- **Animations**: react-native-reanimated

## Critical Rules

### 1. NO INLINE STYLES (CRITICAL)

```tsx
// FORBIDDEN
<View style={{flex: 1, padding: 16}}>
<View style={[styles.container, {marginTop: 10}]}>

// CORRECT - Use NativeWind
<View className="flex-1 p-4">
<View className="mt-2.5">
```

### 2. Use Shared Components (CRITICAL)

```tsx
// CORRECT
import { Text } from '@/components/ui/Text';
import { Button } from '@/components/ui/Button';

// WRONG - Don't import Text from react-native
import { Text } from 'react-native';
```

## Project Structure (Expo Router)

```
app/
├── (tabs)/              # Tab navigator
│   ├── _layout.tsx
│   ├── index.tsx        # Home
│   └── profile.tsx
├── (auth)/              # Auth stack
│   ├── _layout.tsx
│   ├── login.tsx
│   └── register.tsx
├── _layout.tsx          # Root layout
└── +not-found.tsx

components/
├── ui/                  # Shared UI
└── features/            # Feature-specific

stores/                  # Zustand stores
lib/                     # API, utils
```

## Patterns

### Navigation (Expo Router) (HIGH)

```tsx
// app/_layout.tsx
import { Stack } from 'expo-router';

export default function RootLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="(auth)" />
    </Stack>
  );
}

// app/(tabs)/_layout.tsx
import { Tabs } from 'expo-router';
import { Home, User } from 'lucide-react-native';

export default function TabLayout() {
  return (
    <Tabs>
      <Tabs.Screen 
        name="index" 
        options={{ 
          title: 'Home',
          tabBarIcon: ({ color }) => <Home color={color} />
        }} 
      />
    </Tabs>
  );
}
```

### State Management (HIGH)

```typescript
// stores/auth-store.ts
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface AuthState {
  token: string | null;
  user: User | null;
  setAuth: (token: string, user: User) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      user: null,
      setAuth: (token, user) => set({ token, user }),
      logout: () => set({ token: null, user: null }),
    }),
    {
      name: 'auth-storage',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
```

### API Client

```typescript
// lib/api.ts
import axios from 'axios';
import Constants from 'expo-constants';
import { useAuthStore } from '@/stores/auth-store';

const API_URL = Constants.expoConfig?.extra?.apiUrl;

export const api = axios.create({
  baseURL: API_URL,
  timeout: 10000,
});

api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});
```

### Secure Storage (CRITICAL)

```typescript
import * as SecureStore from 'expo-secure-store';

export const secureStorage = {
  async get(key: string): Promise<string | null> {
    return SecureStore.getItemAsync(key);
  },
  async set(key: string, value: string): Promise<void> {
    await SecureStore.setItemAsync(key, value);
  },
  async remove(key: string): Promise<void> {
    await SecureStore.deleteItemAsync(key);
  },
};
```

### UI Components

```tsx
// components/ui/Button.tsx
import { TouchableOpacity, Text, View } from 'react-native';
import { cn } from '@/lib/utils';

interface ButtonProps {
  onPress: () => void;
  variant?: 'primary' | 'secondary';
  children: React.ReactNode;
  className?: string;
}

export function Button({ 
  onPress, 
  variant = 'primary', 
  children,
  className 
}: ButtonProps) {
  return (
    <TouchableOpacity
      onPress={onPress}
      className={cn(
        'py-3 px-6 rounded-lg items-center',
        variant === 'primary' && 'bg-primary',
        variant === 'secondary' && 'border border-primary bg-transparent',
        className
      )}
    >
      {children}
    </TouchableOpacity>
  );
}
```

## Performance (HIGH)

- Use `FlatList` for long lists (not ScrollView)
- Use `useMemo` for expensive calculations
- Use `expo-image` or `FastImage` for images
- Use `react-native-reanimated` for 60fps animations
- Avoid re-renders with `memo()` for heavy components

## EAS Build & Submit

```bash
# Install
npm install -g eas-cli

# Build
eas build --platform ios --profile production
eas build --platform android --profile production

# Submit
eas submit --platform ios
eas submit --platform android
```

## Testing

- Jest + React Native Testing Library
- Detox for E2E
- Test user flows, not implementation
