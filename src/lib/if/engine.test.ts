import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';
import { ADVENT_Z3, ADVENT_Z5, CROWTHER, hasAdventZ3, hasAdventZ5, readStory } from '../../../tests/fixtures';
import { createEngine as createEngineWith, type Engine } from './engine';

// glkote-term's Glk API is a module-level singleton (one live game per page load), so each test
// evaluates a pristine copy of it and injects it.
const nodeRequire = createRequire(import.meta.url);
function createEngine(bytes: Uint8Array): Engine {
  const path = nodeRequire.resolve('glkote-term/src/glkapi.js');
  delete nodeRequire.cache[path];
  return createEngineWith(bytes, nodeRequire(path));
}

describe.skipIf(!hasAdventZ5)('createEngine over Advent.z5 (Z-machine v5)', () => {
  const story = () => readStory(ADVENT_Z5);

  it('start_text_has_the_banner_and_the_first_room', async () => {
    const turn = await createEngine(story()).start();
    expect(turn.text).toContain('Welcome to Adventure!');
    expect(turn.text).toContain('At End Of Road');
    expect(turn.text).toContain('small brick building');
    expect(turn.finished).toBe(false);
  });

  it('status_is_read_from_the_inform_status_line_in_the_upper_window', async () => {
    const turn = await createEngine(story()).start();
    expect(turn.status).toEqual({ location: 'At End Of Road', score: 36, moves: 0 });
  });

  it('enter_building_moves_to_inside_building', async () => {
    const engine = createEngine(story());
    await engine.start();
    const turn = await engine.send('enter building');
    expect(turn.text).toContain('Inside Building');
    expect(turn.text).toContain('well house for a large spring');
    expect(turn.status).toEqual({ location: 'Inside Building', score: 36, moves: 1 });
  });

  it('take_keys_and_take_lamp_are_taken_and_count_as_moves', async () => {
    const engine = createEngine(story());
    await engine.start();
    await engine.send('enter building');
    const keys = await engine.send('take keys');
    expect(keys.text).toContain('Taken.');
    const lamp = await engine.send('take lamp');
    expect(lamp.text).toContain('Taken.');
    expect(lamp.status?.moves).toBe(3);
  });

  it('out_then_south_walks_to_the_valley', async () => {
    const engine = createEngine(story());
    await engine.start();
    await engine.send('enter building');
    const out = await engine.send('out');
    expect(out.status?.location).toBe('At End Of Road');
    const south = await engine.send('south');
    expect(south.status?.location).toBe('In A Valley');
    expect(south.text).toContain('valley in the forest beside a stream');
  });

  it('empty_command_returns_empty_new_text_without_throwing', async () => {
    const engine = createEngine(story());
    await engine.start();
    const turn = await engine.send('');
    expect(turn.text.trim()).toBe('');
    expect(turn.status?.location).toBe('At End Of Road');
  });

  it('save_then_restore_returns_same_location_and_score', async () => {
    const engine = createEngine(story());
    await engine.start();
    await engine.send('enter building');
    const data = engine.save();
    expect(data.length).toBeGreaterThan(0);
    // Quetzal: an IFF FORM of type IFZS.
    expect(String.fromCharCode(...data.subarray(0, 4))).toBe('FORM');
    expect(String.fromCharCode(...data.subarray(8, 12))).toBe('IFZS');
    const moved = await engine.send('out');
    expect(moved.status?.location).toBe('At End Of Road');
    const restored = await engine.restore(data);
    expect(restored.status?.location).toBe('Inside Building');
    const look = await engine.send('look');
    expect(look.text).toContain('well house for a large spring');
  });

  it('a_save_from_one_engine_restores_in_a_fresh_engine', async () => {
    const first = createEngine(story());
    await first.start();
    await first.send('enter building');
    await first.send('take keys');
    const data = first.save();
    const second = createEngine(story());
    await second.start();
    await second.restore(data);
    const inventory = await second.send('inventory');
    expect(inventory.text).toContain('keys');
    expect(inventory.status?.location).toBe('Inside Building');
  });

  it('quit_and_confirm_finishes_the_game_and_later_commands_do_not_hang', async () => {
    const engine = createEngine(story());
    await engine.start();
    const ask = await engine.send('quit');
    expect(ask.text).toContain('Are you sure you want to quit?');
    expect(ask.finished).toBe(false);
    const done = await engine.send('yes');
    expect(done.finished).toBe(true);
    const after = await Promise.race([engine.send('look'), new Promise<'hung'>((r) => setTimeout(() => r('hung'), 2000))]);
    expect(after).not.toBe('hung');
    expect((after as { finished: boolean }).finished).toBe(true);
  });

  it('dying_in_the_dark_prints_the_reincarnation_question', async () => {
    const engine = createEngine(story());
    await engine.start();
    for (const c of ['enter building', 'take keys', 'out', 'south', 'south', 'south', 'unlock grate with keys', 'open grate', 'down', 'west', 'west']) {
      await engine.send(c);
    }
    let death = '';
    for (let i = 0; i < 400 && !death; i++) {
      const turn = await engine.send(i % 2 ? 'east' : 'west');
      if (/killed/.test(turn.text)) death = turn.text;
    }
    expect(death).toContain('You fell into a pit and broke every bone in your body!');
    expect(death).toContain('Do you want me to try to reincarnate you?');
  });
});

describe.skipIf(!hasAdventZ3)('createEngine over Advent.z3 (Z-machine v3)', () => {
  it('the v3_status_line_still_parses', async () => {
    const turn = await createEngine(readStory(ADVENT_Z3)).start();
    expect(turn.status?.location).toBe('At End Of Road');
  });
});

describe('createEngine over the shipped story (Crowther 1976, Inform 7, v5)', () => {
  const story = () => readStory(CROWTHER);

  it('opens_with_the_banner_and_the_instructions_question', async () => {
    const turn = await createEngine(story()).start();
    expect(turn.text).toContain('Colossal Cave by William Crowther, ported by Chris Conley');
    expect(turn.text).toContain('Would you like instructions?');
    expect(turn.status).toBeNull(); // the upper window is still blank
  });

  it('answering_no_reaches_the_first_room_with_location_and_moves_but_no_score', async () => {
    const engine = createEngine(story());
    await engine.start();
    const turn = await engine.send('no');
    expect(turn.text).toContain('end of a road before a small brick building');
    expect(turn.status).toEqual({ location: 'End of Road', score: 0, moves: 1 });
  });

  it('walking_updates_the_location_from_the_status_line', async () => {
    const engine = createEngine(story());
    await engine.start();
    await engine.send('no');
    const inside = await engine.send('enter building');
    expect(inside.status?.location).toBe('Building');
    expect(inside.text).toContain('well house for a large spring');
    await engine.send('out');
    expect((await engine.send('south')).status).toEqual({ location: 'Valley', score: 0, moves: 4 });
  });

  it('save_then_restore_returns_to_the_same_room', async () => {
    const engine = createEngine(story());
    await engine.start();
    await engine.send('no');
    await engine.send('enter building');
    const data = engine.save();
    expect(String.fromCharCode(...data.subarray(8, 12))).toBe('IFZS');
    await engine.send('out');
    expect((await engine.restore(data)).status?.location).toBe('Building');
  });

  it('quit_finishes_the_game', async () => {
    const engine = createEngine(story());
    await engine.start();
    await engine.send('no');
    await engine.send('quit');
    expect((await engine.send('yes')).finished).toBe(true);
  });

  it('a_fatal_fall_in_the_dark_prints_the_starred_death_line', async () => {
    const engine = createEngine(story());
    await engine.start();
    await engine.send('no');
    for (const c of ['enter building', 'take keys', 'out', 'south', 'south', 'south', 'unlock grate', 'open grate', 'down', 'west', 'west']) {
      await engine.send(c);
    }
    let death = '';
    for (let i = 0; i < 400 && !death; i++) {
      const turn = await engine.send(i % 2 ? 'east' : 'west');
      if (/broke every bone/.test(turn.text)) death = turn.text;
    }
    expect(death).toContain('*** You fell into a pit and broke every bone in your body! ***');
  });
});
