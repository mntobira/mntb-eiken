import { EIKEN_STORAGE_PREFIX } from './config';

// A per-app view of storage: no reads, clears or migrations of the university keys.
function backing(): Storage { return globalThis.localStorage; }
export const eikenStorage: Storage = {
  get length() { return keys().length; },
  key(index) { return keys()[index] ?? null; },
  getItem(key) { return backing().getItem(EIKEN_STORAGE_PREFIX + key); },
  setItem(key, value) { backing().setItem(EIKEN_STORAGE_PREFIX + key, value); },
  removeItem(key) { backing().removeItem(EIKEN_STORAGE_PREFIX + key); },
  clear() { for (const key of keys()) this.removeItem(key); },
};
function keys(): string[] {
  const store = backing();
  const result: string[] = [];
  for (let i = 0; i < store.length; i++) {
    const key = store.key(i);
    if (key?.startsWith(EIKEN_STORAGE_PREFIX)) result.push(key.slice(EIKEN_STORAGE_PREFIX.length));
  }
  return result;
}
