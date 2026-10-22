import { ADVENT_Z5, CROWTHER, hasAdventZ5, readStory } from '../../tests/fixtures';
import { createRequire } from 'node:module';
import { describe, expect, it, vi } from 'vitest';
import { createDetector } from '../lib/if/events';
import { createEngine } from '../lib/if/engine';
import { createSpendGuard, defaultSettings, type Settings } from '../lib/if/settings';
import type { Turn } from '../lib/if/types';
import type { MediaKey } from './media-store';
import type { MediaResult } from './openrouter';
import { cleanText, createController } from './controller';

const turn = (room: string, score: number, body: string, extra: Partial<Turn> = {}): Turn => ({
  text: body,
  status: { location: room, score, moves: 1 },
  finished: false,
  ...extra,
});
const blob = (tag: string) => new Blob([tag], { type: 'image/png' });
const deferred = <T>() => {
  let resolve!: (v: T) => void;
  const promise = new Promise<T>((r) => (resolve = r));
  return { promise, resolve };
};

function rig(opts: { settings?: Partial<Settings>; turns?: Turn[] } = {}) {
  const log: string[] = [];
  const settings: Settings = { ...defaultSettings(), key: 'sk-test', consented: true, ...opts.settings };
  const guard = createSpendGuard(settings);
  const queue = [...(opts.turns ?? [])];
  const sent: string[] = [];
  const engine = {
    start: vi.fn(async () => queue.shift()!),
    send: vi.fn(async (c: string) => {
      sent.push(c);
      return queue.shift()!;
    }),
    save: vi.fn(() => new Uint8Array(0)),
    restore: vi.fn(async () => queue.shift()!),
  };
  const ui = {
    showText: vi.fn((t: string) => void log.push(`text:${t}`)),
    showImage: vi.fn((b: Blob | null) => void log.push(`show-image:${b ? 'blob' : 'null'}`)),
    showVideo: vi.fn((_b: Blob) => void log.push('show-video')),
    showNotice: vi.fn((m: string) => void log.push(`notice:${m}`)),
    setBusy: vi.fn((_b: boolean) => undefined),
  };
  const stored = new Map<string, Blob>();
  const keyOf = (k: MediaKey) => `${k.game}|${k.styleId}|${k.kind}|${k.id}`;
  const store = {
    get: vi.fn(async (k: MediaKey) => stored.get(keyOf(k)) ?? null),
    put: vi.fn(async (k: MediaKey, b: Blob) => void stored.set(keyOf(k), b)),
  };
  const prompts: string[] = [];
  const openrouter = {
    image: vi.fn(async (_m: string, p: string): Promise<MediaResult<Blob>> => {
      log.push('image');
      prompts.push(p);
      return { ok: true, value: blob('img') };
    }),
    video: vi.fn(async (_m: string, p: string): Promise<MediaResult<Blob>> => {
      log.push('video');
      prompts.push(p);
      return { ok: true, value: blob('vid') };
    }),
  };
  const controller = createController({ engine, detector: createDetector(), settings, guard, openrouter, store, ui, game: 'adventure' });
  return { controller, engine, ui, store, stored, openrouter, settings, guard, log, prompts, sent, queue };
}

describe('createController', () => {
  it('text_shown_before_image_requested', async () => {
    const r = rig({ turns: [turn('West of House', 0, 'start\n\n>'), turn('North of House', 0, 'north\nYou are north of the house.\n\n>')] });
    await r.controller.start();
    await r.controller.idle();
    r.log.length = 0;
    await r.controller.command('north');
    await r.controller.idle();
    expect(r.log.indexOf('text:You are north of the house.')).toBe(0);
    expect(r.log.indexOf('image')).toBeGreaterThan(0);
  });

  it('new_room_requests_image_once_then_uses_cache', async () => {
    const r = rig({
      turns: [
        turn('West of House', 0, 'a'),
        turn('North of House', 0, 'b'),
        turn('West of House', 0, 'c'),
        turn('North of House', 0, 'd'),
      ],
    });
    await r.controller.start();
    await r.controller.idle();
    await r.controller.command('north');
    await r.controller.idle();
    await r.controller.command('south');
    await r.controller.idle();
    await r.controller.command('north');
    await r.controller.idle();
    expect(r.openrouter.image).toHaveBeenCalledTimes(2);
    expect(r.ui.showImage).toHaveBeenCalledTimes(4);
    expect(r.ui.showImage.mock.calls.every((c) => c[0] instanceof Blob)).toBe(true);
  });

  it('scoreGain_requests_video_when_allowed', async () => {
    const r = rig({ turns: [turn('Living Room', 0, 'a'), turn('Living Room', 5, 'Taken.')] });
    await r.controller.start();
    await r.controller.command('take lamp');
    await r.controller.idle();
    expect(r.openrouter.video).toHaveBeenCalledTimes(1);
    expect(r.openrouter.video.mock.calls[0][0]).toBe(r.settings.videoModel);
    expect(r.ui.showVideo).toHaveBeenCalledTimes(1);
  });

  it('scoreGain_skips_video_when_video_cap_is_zero', async () => {
    const r = rig({ settings: { maxVideos: 0 }, turns: [turn('Living Room', 0, 'a'), turn('Living Room', 5, 'Taken.')] });
    await r.controller.start();
    await r.controller.command('take lamp');
    await r.controller.idle();
    expect(r.openrouter.video).not.toHaveBeenCalled();
  });

  it('no_key_shows_notice_and_plays_on', async () => {
    const r = rig({ settings: { key: null }, turns: [turn('West of House', 0, 'a'), turn('North of House', 0, 'You are north.')] });
    await r.controller.start();
    await r.controller.command('north');
    await r.controller.idle();
    expect(r.ui.showText).toHaveBeenCalledWith('You are north.');
    expect(r.openrouter.image).not.toHaveBeenCalled();
    expect(r.ui.showNotice.mock.calls.some((c) => /key/i.test(c[0]))).toBe(true);
  });

  it('cost_notice_not_accepted_shows_notice_and_makes_no_call', async () => {
    const r = rig({ settings: { consented: false }, turns: [turn('West of House', 0, 'a')] });
    await r.controller.start();
    await r.controller.idle();
    expect(r.openrouter.image).not.toHaveBeenCalled();
    expect(r.ui.showNotice.mock.calls.some((c) => /cost/i.test(c[0]))).toBe(true);
  });

  it('cap_reached_skips_generation_with_notice', async () => {
    const r = rig({ settings: { maxImages: 1 }, turns: [turn('West of House', 0, 'a'), turn('North of House', 0, 'b')] });
    await r.controller.start();
    await r.controller.idle();
    await r.controller.command('north');
    await r.controller.idle();
    expect(r.openrouter.image).toHaveBeenCalledTimes(1);
    expect(r.ui.showNotice.mock.calls.some((c) => /limit/i.test(c[0]))).toBe(true);
  });

  it('failed_image_shows_notice_and_keeps_last_picture', async () => {
    const r = rig({ turns: [turn('West of House', 0, 'a'), turn('North of House', 0, 'b')] });
    await r.controller.start();
    await r.controller.idle();
    r.openrouter.image.mockResolvedValueOnce({ ok: false, reason: 'credit' });
    await r.controller.command('north');
    await r.controller.idle();
    expect(r.ui.showImage).toHaveBeenCalledTimes(1);
    expect(r.ui.showImage).not.toHaveBeenCalledWith(null);
    expect(r.ui.showNotice.mock.calls.some((c) => /credit/i.test(c[0]))).toBe(true);
    expect(r.store.put).toHaveBeenCalledTimes(1);
  });

  it('request_video_button_uses_current_room', async () => {
    const r = rig({ turns: [turn('Troll Room', 0, 'A nasty troll blocks the way.')] });
    await r.controller.start();
    await r.controller.idle();
    await r.controller.requestVideo();
    expect(r.openrouter.video).toHaveBeenCalledTimes(1);
    expect(r.prompts[r.prompts.length - 1]).toContain('Troll Room');
    expect(r.ui.showVideo).toHaveBeenCalledTimes(1);
  });

  it('request_video_before_any_room_shows_notice', async () => {
    const r = rig();
    await r.controller.requestVideo();
    expect(r.openrouter.video).not.toHaveBeenCalled();
    expect(r.ui.showNotice).toHaveBeenCalledTimes(1);
  });

  it('style_change_uses_new_cache_namespace', async () => {
    const r = rig({ turns: [turn('West of House', 0, 'a')] });
    await r.controller.start();
    await r.controller.idle();
    r.controller.setStyle('anime');
    await r.controller.idle();
    expect(r.settings.styleByGame.adventure).toBe('anime');
    expect(r.openrouter.image).toHaveBeenCalledTimes(2);
    const styles = r.store.get.mock.calls.map((c) => c[0].styleId);
    expect(styles).toContain('anime');
    expect([...r.stored.keys()].sort()).toEqual(['adventure|anime|image|west of house', 'adventure|cartoon|image|west of house']);
  });

  it('unknown_style_is_ignored', async () => {
    const r = rig({ turns: [turn('West of House', 0, 'a')] });
    await r.controller.start();
    await r.controller.idle();
    r.controller.setStyle('not-a-style');
    await r.controller.idle();
    expect(r.settings.styleByGame.adventure).toBeUndefined();
    expect(r.openrouter.image).toHaveBeenCalledTimes(1);
  });

  it('result_after_key_forgotten_is_discarded', async () => {
    const r = rig({ turns: [turn('West of House', 0, 'a')] });
    const d = deferred<MediaResult<Blob>>();
    r.openrouter.image.mockReturnValueOnce(d.promise);
    await r.controller.start();
    await vi.waitFor(() => expect(r.openrouter.image).toHaveBeenCalled());
    r.settings.key = null;
    d.resolve({ ok: true, value: blob('late') });
    await r.controller.idle();
    expect(r.store.put).not.toHaveBeenCalled();
    expect(r.ui.showImage).not.toHaveBeenCalled();
    expect(r.ui.showNotice).not.toHaveBeenCalled();
  });

  it('video_result_after_key_forgotten_is_discarded', async () => {
    const r = rig({ turns: [turn('Troll Room', 0, 'A nasty troll blocks the way.')] });
    await r.controller.start();
    await r.controller.idle();
    const d = deferred<MediaResult<Blob>>();
    r.openrouter.video.mockReturnValueOnce(d.promise);
    const pending = r.controller.requestVideo();
    await vi.waitFor(() => expect(r.openrouter.video).toHaveBeenCalled());
    r.settings.key = null;
    d.resolve({ ok: true, value: blob('late') });
    await pending;
    await r.controller.idle();
    expect(r.store.put.mock.calls.some((c) => c[0].kind === 'video')).toBe(false);
    expect(r.ui.showVideo).not.toHaveBeenCalled();
    expect(r.ui.showNotice).not.toHaveBeenCalled();
  });

  it('no_player_command_text_in_any_prompt', async () => {
    const r = rig({
      turns: [
        turn('West of House', 0, 'start'),
        turn('Living Room', 3, 'xyzzy-secret-word\nYou are in the living room.\n\n>'),
      ],
    });
    await r.controller.start();
    await r.controller.idle();
    await r.controller.command('xyzzy-secret-word');
    await r.controller.idle();
    await r.controller.requestVideo();
    expect(r.openrouter.image.mock.calls.length + r.openrouter.video.mock.calls.length).toBeGreaterThanOrEqual(3);
    for (const p of r.prompts) expect(p).not.toContain('secret');
  });

  it('empty_command_requests_nothing', async () => {
    const r = rig({ turns: [turn('West of House', 0, 'a')] });
    await r.controller.start();
    await r.controller.idle();
    const calls = r.openrouter.image.mock.calls.length;
    await r.controller.command('   ');
    await r.controller.idle();
    expect(r.engine.send).not.toHaveBeenCalled();
    expect(r.openrouter.image.mock.calls.length).toBe(calls);
  });

  it('newest_room_wins_while_an_image_is_in_flight', async () => {
    const r = rig({
      turns: [turn('Room A', 0, 'a'), turn('Room B', 0, 'b'), turn('Room C', 0, 'c')],
    });
    const d = deferred<MediaResult<Blob>>();
    r.openrouter.image.mockImplementationOnce((_m: string, p: string) => {
      r.prompts.push(p);
      return d.promise;
    });
    await r.controller.start();
    await vi.waitFor(() => expect(r.openrouter.image).toHaveBeenCalled());
    await r.controller.command('go b');
    await r.controller.command('go c');
    d.resolve({ ok: true, value: blob('a') });
    await r.controller.idle();
    expect(r.openrouter.image).toHaveBeenCalledTimes(2);
    expect(r.prompts[1]).toContain('Room C');
    expect(r.prompts.some((p) => p.includes('Room B'))).toBe(false);
    // Room A's picture is paid for, so it is kept, but it is not shown over the newer room.
    expect(r.stored.has('adventure|cartoon|image|room a')).toBe(true);
    expect(r.ui.showImage).toHaveBeenCalledTimes(1);
  });

  it('retry_image_asks_again_for_the_current_room', async () => {
    const r = rig({ turns: [turn('West of House', 0, 'a')] });
    r.openrouter.image.mockResolvedValueOnce({ ok: false, reason: 'network' });
    await r.controller.start();
    await r.controller.idle();
    expect(r.ui.showImage).not.toHaveBeenCalled();
    r.controller.retryImage();
    await r.controller.idle();
    expect(r.openrouter.image).toHaveBeenCalledTimes(2);
    expect(r.ui.showImage).toHaveBeenCalledTimes(1);
  });

  it('start_with_saved_bytes_restores_and_looks_without_a_score_event', async () => {
    const r = rig({
      turns: [turn('West of House', 0, 'banner'), turn('Living Room', 0, 'restored'), turn('Living Room', 25, 'look\nYou are in the living room.\n\n>')],
    });
    await r.controller.start(new Uint8Array([1, 2, 3]));
    await r.controller.idle();
    expect(r.engine.restore).toHaveBeenCalledTimes(1);
    expect(r.sent).toEqual(['look']);
    expect(r.ui.showText).toHaveBeenCalledWith('You are in the living room.');
    expect(r.openrouter.video).not.toHaveBeenCalled();
    expect(r.openrouter.image).toHaveBeenCalledTimes(1);
  });
});

describe('createController start with the instructions question', () => {
  const asked = (): Turn => ({ text: 'ADVENTURE\nColossal Cave by William Crowther\n\nWelcome to Adventure!! Would you like instructions?\n\n  ', status: null, finished: false });
  const answered = (): Turn =>
    turn('End of Road', 0, 'no\n\n(Type ABOUT for details about this specific Inform 7 implementation.)\n\nYou are standing at the end of a road before a small brick building.\n\n>');

  it('answers_no_shows_the_banner_without_the_question_and_pictures_the_first_room', async () => {
    const r = rig({ turns: [asked(), answered()] });
    await r.controller.start();
    await r.controller.idle();
    expect(r.sent).toEqual(['no']);
    const shown = r.ui.showText.mock.calls.map((c) => c[0]);
    expect(shown[0]).toContain('Colossal Cave by William Crowther');
    expect(shown.join('\n')).not.toMatch(/Would you like instructions/);
    expect(shown[1]).toBe('You are standing at the end of a road before a small brick building.');
    expect(r.openrouter.image).toHaveBeenCalledTimes(1);
    expect(r.prompts[0]).not.toMatch(/Type ABOUT|Inform 7/);
    expect(r.prompts[0]).toContain('end of a road');
  });

  it('answers_no_before_restoring_a_saved_position', async () => {
    const r = rig({ turns: [asked(), answered(), turn('Building', 0, 'restored'), turn('Building', 0, 'look\nYou are inside a building.\n\n>')] });
    await r.controller.start(new Uint8Array([1, 2, 3]));
    expect(r.sent).toEqual(['no', 'look']);
    expect(r.engine.restore).toHaveBeenCalledTimes(1);
    expect(r.ui.showText).toHaveBeenLastCalledWith('You are inside a building.');
  });

  it('a_game_that_does_not_ask_is_left_alone', async () => {
    const r = rig({ turns: [turn('At End Of Road', 36, 'Welcome\nAt End Of Road\nYou are standing.\n>')] });
    await r.controller.start();
    expect(r.sent).toEqual([]);
  });
});

describe('cleanText', () => {
  it('drops_the_echoed_command_line_and_the_trailing_prompt', () => {
    expect(cleanText('open mailbox\nOpening the small mailbox reveals a leaflet.\n\n>', 'open mailbox')).toBe(
      'Opening the small mailbox reveals a leaflet.',
    );
  });
  it('keeps_the_first_line_when_it_is_not_an_echo', () => {
    expect(cleanText('West of House\nYou are here.\n\n>', 'look')).toBe('West of House\nYou are here.');
  });
  it('leaves_empty_text_empty', () => {
    expect(cleanText('', 'x')).toBe('');
    expect(cleanText('\n>', undefined)).toBe('');
  });
});

describe.skipIf(!hasAdventZ5)('over the real Advent.z5', () => {
  it('shows_clean_text_and_asks_for_one_picture_per_new_room', async () => {
    const nodeRequire = createRequire(import.meta.url);
    const path = nodeRequire.resolve('glkote-term/src/glkapi.js');
    delete nodeRequire.cache[path];
    const real = createEngine(readStory(ADVENT_Z5), nodeRequire(path));
    const r = rig();
    const settings = r.settings;
    const shown: string[] = [];
    const ui = { ...r.ui, showText: (t: string) => void shown.push(t) };
    const c = createController({
      engine: real,
      detector: createDetector(),
      settings,
      guard: createSpendGuard(settings),
      openrouter: r.openrouter,
      store: r.store,
      ui,
      game: 'adventure',
    });
    await c.start();
    await c.command('enter building');
    await c.command('take keys');
    await c.command('out');
    await c.idle();
    expect(shown[1]).toContain('Inside Building');
    expect(shown[2]).toBe('Taken.');
    expect(shown.every((t) => !t.endsWith('>') && !/^(enter building|take keys|out)$/m.test(t))).toBe(true);
    // End Of Road, Inside Building, then End Of Road again (already pictured: served from the store, no new request).
    expect(r.openrouter.image).toHaveBeenCalledTimes(2);
    expect(r.prompts[1]).toContain('well house for a large spring');
    expect(r.prompts.join('\n')).not.toMatch(/enter building|take keys/i);
  });
});

describe('over the shipped Crowther story', () => {
  it('answers_the_opening_question_and_pictures_each_new_room_once', async () => {
    const nodeRequire = createRequire(import.meta.url);
    const path = nodeRequire.resolve('glkote-term/src/glkapi.js');
    delete nodeRequire.cache[path];
    const real = createEngine(readStory(CROWTHER), nodeRequire(path));
    const r = rig();
    const shown: string[] = [];
    const ui = { ...r.ui, showText: (t: string) => void shown.push(t) };
    const c = createController({ engine: real, detector: createDetector(), settings: r.settings, guard: createSpendGuard(r.settings), openrouter: r.openrouter, store: r.store, ui, game: 'adventure' });
    await c.start();
    await c.command('enter building');
    await c.command('out');
    await c.idle();
    expect(shown.join('\n')).not.toMatch(/Would you like instructions|Type ABOUT/);
    expect(shown.some((t) => t.includes('end of a road before a small brick building'))).toBe(true);
    expect(shown.some((t) => t.includes('well house for a large spring'))).toBe(true);
    // End of Road, Building, then End of Road again (already pictured).
    expect(r.openrouter.image).toHaveBeenCalledTimes(2);
    expect(r.prompts.join('\n')).not.toMatch(/enter building/i);
  });
});
