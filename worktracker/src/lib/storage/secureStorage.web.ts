import type { SecureStorage } from './index';

const warningPrefix = '[secureStorage:web]';

const secureStorage: SecureStorage = {
  async getItem(key) {
    try {
      if (typeof window === 'undefined' || !window.localStorage) {
        return null;
      }
      console.warn(`${warningPrefix} Using localStorage fallback for key "${key}".`);
      return window.localStorage.getItem(key);
    } catch (error) {
      console.error(`${warningPrefix} Error reading key "${key}":`, error);
      return null;
    }
  },

  async setItem(key, value) {
    try {
      if (typeof window === 'undefined' || !window.localStorage) {
        return;
      }
      console.warn(`${warningPrefix} Using localStorage fallback for key "${key}".`);
      window.localStorage.setItem(key, value);
    } catch (error) {
      console.error(`${warningPrefix} Error writing key "${key}":`, error);
      throw error;
    }
  },

  async removeItem(key) {
    try {
      if (typeof window === 'undefined' || !window.localStorage) {
        return;
      }
      console.warn(`${warningPrefix} Using localStorage fallback for key "${key}".`);
      window.localStorage.removeItem(key);
    } catch (error) {
      console.error(`${warningPrefix} Error deleting key "${key}":`, error);
    }
  },

  async clear() {
    try {
      if (typeof window === 'undefined' || !window.localStorage) {
        return;
      }
      console.warn(`${warningPrefix} Clearing localStorage fallback values.`);
      window.localStorage.clear();
    } catch (error) {
      console.error(`${warningPrefix} Error clearing fallback storage:`, error);
      throw error;
    }
  },
};

export default secureStorage;
