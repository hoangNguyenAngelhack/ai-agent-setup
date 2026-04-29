/**
 * Auth Store with MMKV persistence (React Native CLI)
 * Demonstrates: tech-stack.md (Zustand + MMKV), security.md (token storage)
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { MMKV } from 'react-native-mmkv';

const storage = new MMKV();

const mmkvStorage = {
  getItem: (name: string): string | null => {
    return storage.getString(name) ?? null;
  },
  setItem: (name: string, value: string): void => {
    storage.set(name, value);
  },
  removeItem: (name: string): void => {
    storage.delete(name);
  },
};

export interface User {
  id: string;
  email: string;
  name: string;
  avatar?: string;
}

interface AuthState {
  token: string | null;
  refreshToken: string | null;
  user: User | null;
  isOnboarded: boolean;
  setAuth: (token: string, refreshToken: string, user: User) => void;
  setUser: (user: User) => void;
  setOnboarded: (value: boolean) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      refreshToken: null,
      user: null,
      isOnboarded: false,

      setAuth: (token, refreshToken, user) =>
        set({ token, refreshToken, user }),

      setUser: (user) => set({ user }),

      setOnboarded: (isOnboarded) => set({ isOnboarded }),

      logout: () =>
        set({
          token: null,
          refreshToken: null,
          user: null,
        }),
    }),
    {
      name: 'auth-storage',
      storage: createJSONStorage(() => mmkvStorage),
    }
  )
);

export const useIsAuthenticated = () =>
  useAuthStore((state) => !!state.token);

export const useCurrentUser = () =>
  useAuthStore((state) => state.user);
