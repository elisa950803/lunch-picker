/**
 * Safe storage helpers for Safari compatibility
 * Handles cases where storage might be blocked or unavailable
 */

type StorageType = 'localStorage' | 'sessionStorage';

function getStorage(type: StorageType): Storage | null {
  if (typeof window === 'undefined') {
    return null;
  }
  
  try {
    const storage = window[type];
    // Test if storage is available and not blocked
    const testKey = '__storage_test__';
    storage.setItem(testKey, 'test');
    storage.removeItem(testKey);
    return storage;
  } catch (e) {
    // Storage is blocked (Safari private mode, etc.)
    return null;
  }
}

// In-memory fallback storage
const memoryStorage = new Map<string, string>();

export function safeGetItem(type: StorageType, key: string): string | null {
  const storage = getStorage(type);
  if (storage) {
    try {
      return storage.getItem(key);
    } catch (e) {
      console.warn(`Failed to read from ${type}:`, e);
      return memoryStorage.get(key) || null;
    }
  }
  // Fallback to memory storage
  return memoryStorage.get(key) || null;
}

export function safeSetItem(type: StorageType, key: string, value: string): boolean {
  const storage = getStorage(type);
  if (storage) {
    try {
      storage.setItem(key, value);
      return true;
    } catch (e) {
      console.warn(`Failed to write to ${type}:`, e);
      // Fallback to memory storage
      memoryStorage.set(key, value);
      return false;
    }
  }
  // Fallback to memory storage
  memoryStorage.set(key, value);
  return false;
}

export function safeRemoveItem(type: StorageType, key: string): void {
  const storage = getStorage(type);
  if (storage) {
    try {
      storage.removeItem(key);
    } catch (e) {
      console.warn(`Failed to remove from ${type}:`, e);
    }
  }
  memoryStorage.delete(key);
}
