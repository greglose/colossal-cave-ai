// IndexedDB home for the player's own story file once it has passed validation. Its own database, apart from the
// pictures, so clearing one never touches the other. Never the Cache API and never the service worker: the file is
// the player's copy and is not distributed from this site. Every method resolves (never throws).

const DB_NAME = 'cls-cave-story';
const STORE = 'story';
const KEY = 'file';

function open(idb: IDBFactory): Promise<IDBDatabase | null> {
  return new Promise((resolve) => {
    try {
      const req = idb.open(DB_NAME, 1);
      req.onupgradeneeded = () => {
        if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE);
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
      req.onblocked = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

function request<T>(r: IDBRequest<T>): Promise<T | null> {
  return new Promise((resolve) => {
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => resolve(null);
  });
}

export function createStoryStore(idb: IDBFactory) {
  const safe = async <T>(fallback: T, run: (db: IDBDatabase) => Promise<T>): Promise<T> => {
    try {
      if (!idb) return fallback;
      const db = await open(idb);
      if (!db) return fallback;
      try {
        return await run(db);
      } finally {
        db.close?.();
      }
    } catch {
      return fallback;
    }
  };

  const write = (db: IDBDatabase, change: (s: IDBObjectStore) => void): Promise<void> => {
    const tx = db.transaction(STORE, 'readwrite');
    const done = new Promise<void>((resolve) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
      tx.onabort = () => resolve();
    });
    change(tx.objectStore(STORE));
    return done;
  };

  return {
    get: (): Promise<Uint8Array | null> =>
      safe<Uint8Array | null>(null, async (db) => {
        const v = await request(db.transaction(STORE, 'readonly').objectStore(STORE).get(KEY));
        return v instanceof Uint8Array ? v : null;
      }),

    put: (bytes: Uint8Array): Promise<void> => safe<void>(undefined, (db) => write(db, (s) => void s.put(bytes, KEY))),

    clear: (): Promise<void> => safe<void>(undefined, (db) => write(db, (s) => void s.delete(KEY))),
  };
}
