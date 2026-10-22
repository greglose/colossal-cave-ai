import { describe, expect, it } from 'vitest';
import { fakeIdb } from '../../tests/fake-idb';
import { createMediaStore, type MediaKey } from './media-store';

const key: MediaKey = { game: 'adventure', styleId: 'cartoon', kind: 'image', id: 'west-of-house' };

describe('media store', () => {
  it('put_then_get_roundtrips', async () => {
    const store = createMediaStore(fakeIdb());
    const blob = new Blob(['abc'], { type: 'image/png' });
    await store.put(key, blob);
    const got = await store.get(key);
    expect(got).not.toBeNull();
    expect(await got!.text()).toBe('abc');
  });

  it('different_style_is_a_different_entry', async () => {
    const store = createMediaStore(fakeIdb());
    await store.put(key, new Blob(['cartoon']));
    expect(await store.get({ ...key, styleId: 'photo' })).toBeNull();
    await store.put({ ...key, styleId: 'photo' }, new Blob(['photo']));
    expect(await (await store.get(key))!.text()).toBe('cartoon');
  });

  it('missing_returns_null', async () => {
    expect(await createMediaStore(fakeIdb()).get(key)).toBeNull();
  });

  it('clear_removes_only_that_game', async () => {
    const store = createMediaStore(fakeIdb());
    const other = { ...key, game: 'other' as never };
    await store.put(key, new Blob(['z']));
    await store.put(other, new Blob(['a']));
    await store.clear('adventure');
    expect(await store.get(key)).toBeNull();
    expect(await store.get(other)).not.toBeNull();
  });

  it('unavailable_idb_get_returns_null_put_resolves', async () => {
    for (const idb of [undefined as unknown as IDBFactory, { open: () => { throw new Error('denied'); } } as unknown as IDBFactory]) {
      const store = createMediaStore(idb);
      expect(await store.get(key)).toBeNull();
      await expect(store.put(key, new Blob(['x']))).resolves.toBeUndefined();
      await expect(store.clear('adventure')).resolves.toBeUndefined();
    }
  });
});
