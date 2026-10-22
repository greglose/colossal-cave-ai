// @vitest-environment happy-dom
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { read } from './helpers';
import { defaultSettings } from '../src/lib/if/settings';
import { GAME_SAVE_KEY, SETTINGS_KEY, writeGameSave, writeSettings } from '../src/lib/if/save';
import { storyId } from '../src/lib/if/story';
import type { Turn } from '../src/lib/if/types';

// The story engine and the OpenRouter client are stubbed; the page, the controller, the settings panel, the story
// loader and the UI are the real built page and real code. The media and story stores are in-memory (no IndexedDB
// in happy-dom).
const fake = vi.hoisted(() => ({
  sent: [] as string[],
  images: [] as string[],
  videos: [] as string[],
  stored: new Map<string, Blob>(),
  turns: {} as Record<string, unknown>,
  story: null as Uint8Array | null,
  storyPuts: 0,
  storyClears: 0,
  engineBytes: [] as Uint8Array[],
  restores: 0,
  startFails: false,
  reloads: 0,
}));

vi.mock('../src/lib/if/engine', () => ({
  createEngine: (bytes: Uint8Array) => {
    fake.engineBytes.push(bytes);
    return {
      start: async () => {
        if (fake.startFails) throw new Error('bad story');
        return fake.turns.start;
      },
      send: async (command: string) => {
        fake.sent.push(command);
        return fake.turns[command.toLowerCase()] ?? { text: `Nothing happens.`, status: { location: 'At End Of Road', score: 36, moves: 1 }, finished: false };
      },
      save: () => new Uint8Array([1, 2, 3]),
      restore: async () => {
        fake.restores += 1;
        return fake.turns.start;
      },
    };
  },
}));
vi.mock('../src/scripts/openrouter', () => ({
  createOpenRouter: () => ({
    image: async (_model: string, prompt: string) => {
      fake.images.push(prompt);
      return { ok: true, value: new Blob(['png'], { type: 'image/png' }) };
    },
    video: async (_model: string, prompt: string) => {
      fake.videos.push(prompt);
      return { ok: true, value: new Blob(['mp4'], { type: 'video/mp4' }) };
    },
  }),
}));
vi.mock('../src/scripts/media-store', () => ({
  createMediaStore: () => ({
    get: async (k: unknown) => fake.stored.get(JSON.stringify(k)) ?? null,
    put: async (k: unknown, b: Blob) => void fake.stored.set(JSON.stringify(k), b),
  }),
}));
vi.mock('../src/scripts/story-store', () => ({
  createStoryStore: () => ({
    get: async () => fake.story,
    put: async (b: Uint8Array) => {
      fake.story = b;
      fake.storyPuts += 1;
    },
    clear: async () => {
      fake.story = null;
      fake.storyClears += 1;
    },
  }),
}));
vi.mock('../src/scripts/nav', () => ({ reloadPage: () => void (fake.reloads += 1) }));

const turn = (location: string, text: string, score = 36): Turn => ({ text, status: { location, score, moves: 1 }, finished: false });
const ROAD = 'At End Of Road\nYou are standing at the end of a road before a small brick building. Around you is a forest.';
const BUILDING = 'Inside Building\nYou are inside a building, a well house for a large spring.';

const story = (version = 5, release = 9): Uint8Array => {
  const b = new Uint8Array(4096);
  b[0] = version;
  b[3] = release;
  return b;
};

const root = () => document.querySelector<HTMLElement>('[data-game]')!;
const q = <T extends HTMLElement>(sel: string) => root().querySelector<T>(sel)!;
const logText = () => q('[data-log]').textContent ?? '';
const settle = () => new Promise((resolve) => setTimeout(resolve, 30));
const visible = (sel: string) => !q(sel).hidden;

async function type(command: string): Promise<void> {
  const input = q<HTMLInputElement>('[data-input]');
  input.value = command;
  q<HTMLFormElement>('[data-form]').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
  await vi.waitFor(() => expect(fake.sent).toContain(command));
  await settle();
}

async function pickFile(bytes: Uint8Array): Promise<void> {
  const input = q<HTMLInputElement>('[data-story-input]');
  const file = { name: 'Advent.z5', size: bytes.length, arrayBuffer: async () => bytes.buffer.slice(0, bytes.byteLength) } as unknown as File;
  Object.defineProperty(input, 'files', { value: [file], configurable: true });
  input.dispatchEvent(new Event('change', { bubbles: true }));
  await settle();
}

let page = '';
beforeAll(async () => {
  page = await vi.waitFor(() => read('index.html'), { timeout: 60_000, interval: 250 });
}, 65_000);

async function boot(opts: { key?: string | null; consented?: boolean; story?: Uint8Array | null; ready?: 'game' | 'loader' } = {}): Promise<void> {
  const settings = { ...defaultSettings(), key: opts.key === undefined ? 'sk-or-test-key' : opts.key, consented: opts.consented ?? true };
  writeSettings(localStorage, settings);
  fake.story = opts.story === undefined ? story() : opts.story;
  document.body.innerHTML = /<body[^>]*>([\s\S]*)<\/body>/.exec(page)![1].replace(/<script[\s\S]*?<\/script>/g, '');
  vi.resetModules();
  await import('../src/scripts/main.ts');
  const ready = opts.ready ?? (opts.story === null ? 'loader' : 'game');
  if (ready === 'game') await vi.waitFor(() => expect(logText()).toContain('end of a road before a small brick building'));
  else await vi.waitFor(() => expect(visible('[data-loader]')).toBe(true));
  await settle();
}

beforeEach(() => {
  localStorage.clear();
  Object.assign(fake, {
    sent: [],
    images: [],
    videos: [],
    stored: new Map(),
    story: null,
    storyPuts: 0,
    storyClears: 0,
    engineBytes: [],
    restores: 0,
    startFails: false,
    reloads: 0,
    turns: {
      start: turn('At End Of Road', `ADVENTURE\n${ROAD}\n>`),
      'take keys': turn('Inside Building', 'Taken.'),
      look: turn('At End Of Road', ROAD),
      'enter building': turn('Inside Building', BUILDING),
      out: turn('At End Of Road', 'At End Of Road'),
    },
  });
  vi.stubGlobal('matchMedia', () => ({ matches: true, addEventListener: () => {}, removeEventListener: () => {} }));
  window.matchMedia = globalThis.matchMedia;
  if (!URL.createObjectURL) URL.createObjectURL = () => 'blob:test';
  if (!URL.revokeObjectURL) URL.revokeObjectURL = () => {};
});

describe('story file', () => {
  it('first run shows the load panel and no game, and starts no engine', async () => {
    await boot({ story: null });
    expect(visible('[data-loader]')).toBe(true);
    expect(q('[data-stage]').hidden).toBe(true);
    expect(fake.engineBytes).toEqual([]);
    expect(fake.images).toEqual([]);
    expect(q('[data-loader]').textContent).toMatch(/Advent\.z5/);
    expect(q('[data-loader]').textContent).toMatch(/your own copy/i);
    expect(q('[data-act="cancel-load"]').hidden).toBe(true);
  });

  it('loading a valid file starts the game and keeps the file', async () => {
    await boot({ story: null });
    await pickFile(story(5));
    await vi.waitFor(() => expect(logText()).toContain('end of a road before a small brick building'));
    expect(fake.storyPuts).toBe(1);
    expect(fake.engineBytes.length).toBe(1);
    expect(fake.engineBytes[0]![0]).toBe(5);
    expect(visible('[data-loader]')).toBe(false);
    expect(q('[data-stage]').hidden).toBe(false);
  });

  it('a file that is not a story shows the reason and starts nothing', async () => {
    await boot({ story: null });
    await pickFile(story(0));
    expect(q('[data-loader-error]').textContent).toMatch(/does not look like a Z-machine story file/);
    expect(fake.storyPuts).toBe(0);
    expect(fake.engineBytes).toEqual([]);
    expect(visible('[data-loader]')).toBe(true);
  });

  it('a kept story file starts the game straight away, with no load panel', async () => {
    await boot();
    expect(visible('[data-loader]')).toBe(false);
    expect(q('[data-stage]').hidden).toBe(false);
    expect(fake.storyPuts).toBe(0);
  });

  it('a kept file that no longer validates is dropped and the load panel returns', async () => {
    await boot({ story: story(0), ready: 'loader' });
    expect(visible('[data-loader]')).toBe(true);
    expect(fake.storyClears).toBe(1);
    expect(fake.engineBytes).toEqual([]);
  });

  it('a story the interpreter cannot start is dropped with a message', async () => {
    fake.startFails = true;
    await boot({ story: story(4), ready: 'loader' });
    expect(q('[data-loader-error]').textContent).toMatch(/could not be started/i);
    expect(fake.storyClears).toBe(1);
  });

  it('Settings has Choose a different story file, which shows the panel with a way back', async () => {
    await boot();
    const button = q<HTMLButtonElement>('[data-act="change-story"]');
    expect(button.textContent).toBe('Choose a different story file');
    expect(q('[data-settings]').contains(button)).toBe(true);
    button.click();
    expect(visible('[data-loader]')).toBe(true);
    expect(q('[data-stage]').hidden).toBe(true);
    expect(q<HTMLButtonElement>('[data-act="cancel-load"]').hidden).toBe(false);
    q<HTMLButtonElement>('[data-act="cancel-load"]').click();
    expect(visible('[data-loader]')).toBe(false);
    expect(q('[data-stage]').hidden).toBe(false);
  });

  it('choosing a different file keeps it, forgets the old position and reloads the page', async () => {
    await boot();
    await type('take keys');
    expect(localStorage.getItem(GAME_SAVE_KEY)).toContain('bytes');
    q<HTMLButtonElement>('[data-act="change-story"]').click();
    await pickFile(story(5, 12));
    expect(fake.storyPuts).toBe(1);
    expect(fake.reloads).toBe(1);
    const saved = JSON.parse(localStorage.getItem(GAME_SAVE_KEY)!);
    expect(saved.bytes).toBeNull();
  });
});

describe('Colossal Cave page', () => {
  it('boots to the opening text and one picture request for the first room', async () => {
    await boot();
    expect(logText()).toContain('end of a road before a small brick building');
    expect(fake.images.length).toBe(1);
    expect(fake.images[0]).toContain('Colossal Cave');
  });

  it('shows the reply to a typed command', async () => {
    await boot();
    await type('take keys');
    expect(logText()).toContain('> take keys');
    expect(logText()).toContain('Taken.');
  });

  it('makes no second picture request when the player stays in the same room', async () => {
    await boot();
    await type('look');
    await type('look');
    expect(fake.images.length).toBe(1);
  });

  it('makes a request for a new room, and none when returning to a room already pictured', async () => {
    await boot();
    await type('enter building');
    expect(fake.images.length).toBe(2);
    await type('out');
    expect(fake.images.length).toBe(2);
  });

  it('never puts what the player typed into a picture prompt', async () => {
    await boot();
    await type('take keys');
    await type('enter building');
    expect(fake.images.length).toBe(2);
    for (const prompt of fake.images) expect(prompt.toLowerCase()).not.toMatch(/take keys|> ?enter building/);
  });

  it('makes no request without a key, and the game still plays', async () => {
    await boot({ key: null });
    await type('take keys');
    expect(fake.images.length).toBe(0);
    expect(logText()).toContain('Taken.');
    expect(q('[data-notice]').textContent).toMatch(/OpenRouter key/);
  });

  it('makes no request until the cost notice is accepted', async () => {
    await boot({ consented: false });
    expect(fake.images.length).toBe(0);
    expect(q('[data-notice]').textContent).toMatch(/cost notice/i);
  });

  it('keeps the key in the settings key only, and Forget key clears it', async () => {
    await boot();
    expect(JSON.parse(localStorage.getItem(SETTINGS_KEY)!).key).toBe('sk-or-test-key');
    expect(localStorage.getItem(GAME_SAVE_KEY) ?? '').not.toContain('sk-or-test-key');
    q('[data-act="forget"]').click();
    expect(JSON.parse(localStorage.getItem(SETTINGS_KEY)!).key).toBeNull();
    expect(q<HTMLInputElement>('[data-key]').value).toBe('');
  });

  it('saves the game under cls.cave-save after a move, tagged with the story it belongs to', async () => {
    await boot();
    await type('enter building');
    const saved = JSON.parse(localStorage.getItem(GAME_SAVE_KEY)!);
    expect(saved.version).toBe(1);
    expect(saved.storyId).toBe(storyId(story()));
  });

  it('restores a saved position made with the same story file', async () => {
    writeGameSave(localStorage, { styleId: null, bytes: new Uint8Array([1, 2, 3]), storyId: storyId(story()) });
    await boot();
    expect(fake.restores).toBe(1);
  });

  it('does not restore a position saved with a different story file', async () => {
    writeGameSave(localStorage, { styleId: null, bytes: new Uint8Array([1, 2, 3]), storyId: storyId(story(5, 99)) });
    await boot();
    expect(fake.restores).toBe(0);
  });

  it('does not restore a position that carries no story id', async () => {
    writeGameSave(localStorage, { styleId: null, bytes: new Uint8Array([1, 2, 3]), storyId: null });
    await boot();
    expect(fake.restores).toBe(0);
  });
});
