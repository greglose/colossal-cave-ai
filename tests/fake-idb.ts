// Minimal in-memory IDBFactory: just the surface the media and story stores use (open/upgrade, get, put, delete, getAllKeys).
export function fakeIdb(): IDBFactory {
  const dbs = new Map<string, Map<string, Map<string, unknown>>>();
  const req = <T>(run: () => T) => {
    const r: Record<string, unknown> = {};
    queueMicrotask(() => {
      try {
        r.result = run();
        (r.onsuccess as (() => void) | undefined)?.();
      } catch (e) {
        r.error = e;
        (r.onerror as (() => void) | undefined)?.();
      }
    });
    return r;
  };
  return {
    open(name: string) {
      const r: Record<string, unknown> = {};
      queueMicrotask(() => {
        const fresh = !dbs.has(name);
        if (fresh) dbs.set(name, new Map());
        const data = dbs.get(name)!;
        const db = {
          objectStoreNames: { contains: (n: string) => data.has(n) },
          createObjectStore: (n: string) => void data.set(n, new Map()),
          close() {},
          transaction(n: string) {
            const s = data.get(n)!;
            const tx: Record<string, unknown> = {
              objectStore: () => ({
                get: (k: string) => req(() => s.get(k)),
                put: (v: unknown, k: string) => {
                  const q = req(() => void s.set(k, v));
                  q.onsuccess = undefined;
                  queueMicrotask(() => queueMicrotask(() => (tx.oncomplete as (() => void) | undefined)?.()));
                  return q;
                },
                delete: (k: string) => {
                  const q = req(() => void s.delete(k));
                  queueMicrotask(() => queueMicrotask(() => (tx.oncomplete as (() => void) | undefined)?.()));
                  return q;
                },
                getAllKeys: () => req(() => [...s.keys()]),
              }),
            };
            return tx;
          },
        };
        r.result = db;
        if (fresh) (r.onupgradeneeded as (() => void) | undefined)?.();
        (r.onsuccess as (() => void) | undefined)?.();
      });
      return r as unknown as IDBOpenDBRequest;
    },
  } as unknown as IDBFactory;
}
