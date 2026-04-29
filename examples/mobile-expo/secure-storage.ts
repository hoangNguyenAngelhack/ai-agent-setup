/**
 * Secure Storage utilities
 * Demonstrates: security.md (token storage), tech-stack.md (expo-secure-store / keychain)
 */

import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';

const TOKEN_KEY = 'auth_token';
const REFRESH_TOKEN_KEY = 'refresh_token';

export const secureStorage = {
  async setToken(token: string): Promise<void> {
    await SecureStore.setItemAsync(TOKEN_KEY, token);
  },

  async getToken(): Promise<string | null> {
    return SecureStore.getItemAsync(TOKEN_KEY);
  },

  async setRefreshToken(token: string): Promise<void> {
    await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, token);
  },

  async getRefreshToken(): Promise<string | null> {
    return SecureStore.getItemAsync(REFRESH_TOKEN_KEY);
  },

  async clearTokens(): Promise<void> {
    await Promise.all([
      SecureStore.deleteItemAsync(TOKEN_KEY),
      SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY),
    ]);
  },

  async setSecureItem(key: string, value: string): Promise<void> {
    await SecureStore.setItemAsync(key, value);
  },

  async getSecureItem(key: string): Promise<string | null> {
    return SecureStore.getItemAsync(key);
  },

  async deleteSecureItem(key: string): Promise<void> {
    await SecureStore.deleteItemAsync(key);
  },
};

export const storage = {
  async get<T>(key: string): Promise<T | null> {
    try {
      const value = await AsyncStorage.getItem(key);
      return value ? JSON.parse(value) : null;
    } catch {
      return null;
    }
  },

  async set<T>(key: string, value: T): Promise<void> {
    await AsyncStorage.setItem(key, JSON.stringify(value));
  },

  async remove(key: string): Promise<void> {
    await AsyncStorage.removeItem(key);
  },

  async multiGet<T>(keys: string[]): Promise<Record<string, T | null>> {
    const pairs = await AsyncStorage.multiGet(keys);
    return pairs.reduce(
      (acc, [key, value]) => {
        acc[key] = value ? JSON.parse(value) : null;
        return acc;
      },
      {} as Record<string, T | null>
    );
  },

  async multiSet(items: Record<string, unknown>): Promise<void> {
    const pairs = Object.entries(items).map(
      ([key, value]) => [key, JSON.stringify(value)] as [string, string]
    );
    await AsyncStorage.multiSet(pairs);
  },

  async clear(): Promise<void> {
    await AsyncStorage.clear();
  },
};

export const cacheStorage = {
  async getWithExpiry<T>(key: string): Promise<T | null> {
    const item = await storage.get<{ value: T; expiry: number }>(key);
    if (!item) return null;
    if (Date.now() > item.expiry) {
      await storage.remove(key);
      return null;
    }
    return item.value;
  },

  async setWithExpiry<T>(key: string, value: T, ttlMs: number): Promise<void> {
    const item = {
      value,
      expiry: Date.now() + ttlMs,
    };
    await storage.set(key, item);
  },
};
