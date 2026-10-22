import { describe, expect, it } from 'vitest';
import { defaultSettings } from './settings';
import {
  GAME_SAVE_KEY,
  SETTINGS_KEY,
  fromBase64,
  loadGameSave,
  loadSettings,
  toBase64,
  writeGameSave,
  writeSettings,
} from './save';

const memory = (init: Record<string, string> = {}) => {
  const data = { ...init };
  return {
    data,
    getItem: (k: string) => data[k] ?? null,
    setItem: (k: string, v: string) => void (data[k] = v),
  };
};
const throwing = {
  getItem: () => {
    throw new Error('blocked');
  },
  setItem: () => {
    throw new Error('quota');
  },
};

describe('game save', () => {
  it('uses_the_cls_cave_keys', () => {
    expect(GAME_SAVE_KEY).toBe('cls.cave-save');
    expect(SETTINGS_KEY).toBe('cls.cave-settings');
  });

  it('roundtrips_style_and_engine_bytes', () => {
    const m = memory();
    const bytes = new Uint8Array([0, 1, 2, 250, 255, 128]);
    writeGameSave(m, { styleId: 'anime', bytes, storyId: null });
    const back = loadGameSave(m);
    expect(back.styleId).toBe('anime');
    expect(Array.from(back.bytes ?? [])).toEqual(Array.from(bytes));
  });

  it('roundtrips_the_story_id_that_made_the_save', () => {
    const m = memory();
    writeGameSave(m, { styleId: null, bytes: new Uint8Array([1]), storyId: '9-060321-1a2b' });
    expect(loadGameSave(m).storyId).toBe('9-060321-1a2b');
  });

  it('a_save_without_a_story_id_loads_with_null', () => {
    const raw = JSON.stringify({ version: 1, styleId: 'anime', bytes: 'AQ==' });
    expect(loadGameSave(memory({ [GAME_SAVE_KEY]: raw })).storyId).toBeNull();
  });

  it('missing_storage_gives_a_fresh_save', () => {
    expect(loadGameSave(memory())).toEqual({ styleId: null, bytes: null, storyId: null });
    expect(loadGameSave(undefined)).toEqual({ styleId: null, bytes: null, storyId: null });
  });

  it('bad_json_is_replaced', () => {
    expect(loadGameSave(memory({ [GAME_SAVE_KEY]: '{nope' }))).toEqual({ styleId: null, bytes: null, storyId: null });
  });

  it('wrong_shapes_are_replaced', () => {
    for (const raw of ['null', '[]', '7', '{"version":1,"styleId":5,"bytes":9}', '{"version":9,"styleId":"anime"}']) {
      expect(loadGameSave(memory({ [GAME_SAVE_KEY]: raw }))).toEqual({ styleId: null, bytes: null, storyId: null });
    }
  });

  it('unknown_style_is_dropped_but_bytes_are_kept', () => {
    const m = memory({ [GAME_SAVE_KEY]: JSON.stringify({ version: 1, styleId: 'oil-on-velvet', bytes: toBase64(new Uint8Array([9, 9])) }) });
    const back = loadGameSave(m);
    expect(back.styleId).toBeNull();
    expect(Array.from(back.bytes ?? [])).toEqual([9, 9]);
  });

  it('invalid_base64_gives_null_bytes', () => {
    const m = memory({ [GAME_SAVE_KEY]: JSON.stringify({ version: 1, styleId: 'anime', bytes: '***not base64***' }) });
    expect(loadGameSave(m)).toEqual({ styleId: 'anime', bytes: null, storyId: null });
  });

  it('never_throws_when_storage_throws', () => {
    expect(loadGameSave(throwing)).toEqual({ styleId: null, bytes: null, storyId: null });
    expect(() => writeGameSave(throwing, { styleId: 'anime', bytes: new Uint8Array(1), storyId: null })).not.toThrow();
    expect(() => writeGameSave(undefined, { styleId: null, bytes: null, storyId: null })).not.toThrow();
  });

  it('game_save_never_holds_the_key', () => {
    const m = memory();
    writeGameSave(m, { styleId: 'anime', bytes: new Uint8Array([1]), storyId: null });
    expect(m.data[GAME_SAVE_KEY]).not.toMatch(/sk-|key/i);
  });
});

describe('base64', () => {
  it('roundtrips_large_arrays', () => {
    const big = new Uint8Array(70000).map((_, i) => i % 251);
    expect(Array.from(fromBase64(toBase64(big)) ?? [])).toEqual(Array.from(big));
  });
  it('rejects_garbage', () => {
    expect(fromBase64('@@@')).toBeNull();
  });
});

describe('settings storage', () => {
  it('roundtrips_through_cls_if_settings', () => {
    const m = memory();
    const s = { ...defaultSettings(), key: 'sk-or-test', consented: true, imageModel: 'a/b', styleByGame: { adventure: 'pixel' } };
    writeSettings(m, s);
    expect(m.data[SETTINGS_KEY]).toContain('sk-or-test');
    expect(loadSettings(m)).toEqual(s);
  });
  it('bad_data_gives_defaults', () => {
    expect(loadSettings(memory({ [SETTINGS_KEY]: '<<<' }))).toEqual(defaultSettings());
    expect(loadSettings(undefined)).toEqual(defaultSettings());
    expect(loadSettings(throwing)).toEqual(defaultSettings());
  });
  it('write_never_throws', () => {
    expect(() => writeSettings(throwing, defaultSettings())).not.toThrow();
    expect(() => writeSettings(undefined, defaultSettings())).not.toThrow();
  });
});
