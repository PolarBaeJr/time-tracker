import type { Storage } from './index';

const storage: Storage = {
  async getItem(key) {
    try {
      if (typeof window === 'undefined' || !window.localStorage) {
        return null;
      }
      return window.localStorage.getItem(key);
    } catch (error) {
      console.error(`[localStorage] Error reading key "${key}":`, error);
      return null;
    }
  },

  async setItem(key, value) {
    try {
      if (typeof window === 'undefined' || !window.localStorage) {
        return;
      }
      window.localStorage.setItem(key, value);
    } catch (error) {
      console.error(`[localStorage] Error writing key "${key}":`, error);
      throw error;
    }
  },

  async removeItem(key) {
    try {
      if (typeof window === 'undefined' || !window.localStorage) {
        return;
      }
      window.localStorage.removeItem(key);
    } catch (error) {
      console.error(`[localStorage] Error deleting key "${key}":`, error);
    }
  },

  async clear() {
    try {
      if (typeof window === 'undefined' || !window.localStorage) {
        return;
      }
      window.localStorage.clear();
    } catch (error) {
      console.error('[localStorage] Error clearing storage:', error);
      throw error;
    }
  },
};

export default storage;
