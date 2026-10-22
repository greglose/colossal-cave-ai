import { describe, expect, it } from 'vitest';
import { fakeIdb } from '../../tests/fake-idb';
import { createStoryStore } from './story-store';

describe('story store', () => {
  it('missing_returns_null', async () => {
    expect(await createStoryStore(fakeIdb()).get()).toBeNull();
  });

  it('put_then_get_roundtrips_the_bytes', async () => {
    const store = createStoryStore(fakeIdb());
    await store.put(new Uint8Array([5, 1, 2, 255]));
    expect(Array.from((await store.get()) ?? [])).toEqual([5, 1, 2, 255]);
  });

  it('put_replaces_the_earlier_file', async () => {
    const store = createStoryStore(fakeIdb());
    await store.put(new Uint8Array([3]));
    await store.put(new Uint8Array([5, 5]));
    expect(Array.from((await store.get()) ?? [])).toEqual([5, 5]);
  });

  it('clear_removes_it', async () => {
    const store = createStoryStore(fakeIdb());
    await store.put(new Uint8Array([5]));
    await store.clear();
    expect(await store.get()).toBeNull();
  });

  it('does_not_share_the_media_database', async () => {
    const idb = fakeIdb();
    await createStoryStore(idb).put(new Uint8Array([5]));
    const names: string[] = [];
    const open = idb.open.bind(idb);
    idb.open = ((name: string, v?: number) => (names.push(name), open(name, v))) as typeof idb.open;
    await createStoryStore(idb).get();
    expect(names).toEqual(['cls-cave-story']);
  });

  it('unavailable_idb_get_returns_null_and_put_resolves', async () => {
    for (const idb of [undefined as unknown as IDBFactory, { open: () => { throw new Error('denied'); } } as unknown as IDBFactory]) {
      const store = createStoryStore(idb);
      expect(await store.get()).toBeNull();
      await expect(store.put(new Uint8Array([5]))).resolves.toBeUndefined();
      await expect(store.clear()).resolves.toBeUndefined();
    }
  });

  it('a_stored_value_that_is_not_bytes_reads_as_missing', async () => {
    const idb = fakeIdb();
    const store = createStoryStore(idb);
    await store.put('nonsense' as unknown as Uint8Array);
    expect(await store.get()).toBeNull();
  });
});
