/**
 * Secure Storage utilities (React Native CLI)
 * Demonstrates: security.md (token storage), tech-stack.md (react-native-keychain)
 */

import * as Keychain from 'react-native-keychain';
import AsyncStorage from '@react-native-async-storage/async-storage';

const TOKEN_KEY = 'auth_token';
const REFRESH_TOKEN_KEY = 'refresh_token';
const SERVICE_NAME = 'com.myapp.auth';

export const secureStorage = {
  async setToken(token: string): Promise<void> {
    await Keychain.setGenericPassword(TOKEN_KEY, token, { service: SERVICE_NAME });
  },

  async getToken(): Promise<string | null> {
    const credentials = await Keychain.getGenericPassword({ service: SERVICE_NAME });
    return credentials ? credentials.password : null;
  },

  async setRefreshToken(token: string): Promise<void> {
    await Keychain.setGenericPassword(REFRESH_TOKEN_KEY, token, {
      service: `${SERVICE_NAME}.refresh`,
    });
  },

  async getRefreshToken(): Promise<string | null> {
    const credentials = await Keychain.getGenericPassword({
      service: `${SERVICE_NAME}.refresh`,
    });
    return credentials ? credentials.password : null;
  },

  async clearTokens(): Promise<void> {
    await Promise.all([
      Keychain.resetGenericPassword({ service: SERVICE_NAME }),
      Keychain.resetGenericPassword({ service: `${SERVICE_NAME}.refresh` }),
    ]);
  },

  async setSecureItem(key: string, value: string): Promise<void> {
    await Keychain.setGenericPassword(key, value, { service: `${SERVICE_NAME}.${key}` });
  },

  async getSecureItem(key: string): Promise<string | null> {
    const credentials = await Keychain.getGenericPassword({
      service: `${SERVICE_NAME}.${key}`,
    });
    return credentials ? credentials.password : null;
  },

  async deleteSecureItem(key: string): Promise<void> {
    await Keychain.resetGenericPassword({ service: `${SERVICE_NAME}.${key}` });
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

  async clear(): Promise<void> {
    await AsyncStorage.clear();
  },
};
