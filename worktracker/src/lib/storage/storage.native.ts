import AsyncStorage from '@react-native-async-storage/async-storage';

import type { Storage } from './index';

const storage: Storage = {
  async getItem(key) {
    try {
      return await AsyncStorage.getItem(key);
    } catch (error) {
      console.error(`[AsyncStorage] Error reading key "${key}":`, error);
      return null;
    }
  },

  async setItem(key, value) {
    try {
      await AsyncStorage.setItem(key, value);
    } catch (error) {
      console.error(`[AsyncStorage] Error writing key "${key}":`, error);
      throw error;
    }
  },

  async removeItem(key) {
    try {
      await AsyncStorage.removeItem(key);
    } catch (error) {
      console.error(`[AsyncStorage] Error deleting key "${key}":`, error);
    }
  },

  async clear() {
    try {
      await AsyncStorage.clear();
    } catch (error) {
      console.error('[AsyncStorage] Error clearing storage:', error);
      throw error;
    }
  },
};

export default storage;
