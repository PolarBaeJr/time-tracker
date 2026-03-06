import * as SecureStore from 'expo-secure-store';

import type { SecureStorage } from './index';

const secureStorage: SecureStorage = {
  async getItem(key) {
    try {
      return await SecureStore.getItemAsync(key);
    } catch (error) {
      console.error(`[SecureStore] Error reading key "${key}":`, error);
      return null;
    }
  },

  async setItem(key, value) {
    try {
      await SecureStore.setItemAsync(key, value);
    } catch (error) {
      console.error(`[SecureStore] Error writing key "${key}":`, error);
      throw error;
    }
  },

  async removeItem(key) {
    try {
      await SecureStore.deleteItemAsync(key);
    } catch (error) {
      console.error(`[SecureStore] Error deleting key "${key}":`, error);
    }
  },

  async clear() {
    // SecureStore has no bulk clear API, so callers should remove known keys.
    return Promise.resolve();
  },
};

export default secureStorage;
