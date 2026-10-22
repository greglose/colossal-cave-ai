import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';
import { ADVENT_Z5, hasAdventZ5, readStory } from '../../../tests/fixtures';
import { createEngine } from './engine';
import { createDetector } from './events';
import type { Turn } from './types';

const nodeRequire = createRequire(import.meta.url);
function freshEngine() {
  const path = nodeRequire.resolve('glkote-term/src/glkapi.js');
  delete nodeRequire.cache[path];
  return createEngine(readStory(ADVENT_Z5), nodeRequire(path));
}

const turn = (over: Partial<Turn> = {}): Turn => ({
  text: '',
  status: { location: 'At End Of Road', score: 36, moves: 0 },
  finished: false,
  ...over,
});

describe.skipIf(!hasAdventZ5)('createDetector on a recorded Advent transcript', () => {
  it('first_turn_yields_newroom_at_end_of_road_then_inside_building_on_entering', async () => {
    const engine = freshEngine();
    const detector = createDetector();
    const first = detector.next(await engine.start());
    expect(first).toHaveLength(1);
    expect(first[0]).toMatchObject({ kind: 'newRoom', roomId: 'at end of road', roomName: 'At End Of Road' });
    const moved = detector.next(await engine.send('enter building'));
    expect(moved).toHaveLength(1);
    expect(moved[0]).toMatchObject({ kind: 'newRoom', roomId: 'inside building', roomName: 'Inside Building' });
    expect(moved[0]!.text).toContain('well house for a large spring');
  });

  it('staying_in_the_room_yields_no_event', async () => {
    const engine = freshEngine();
    const detector = createDetector();
    detector.next(await engine.start());
    detector.next(await engine.send('enter building'));
    expect(detector.next(await engine.send('take keys'))).toEqual([]);
    expect(detector.next(await engine.send('take lamp'))).toEqual([]);
  });

  it('returning_to_a_seen_room_yields_newroom_again_with_same_roomid', async () => {
    const engine = freshEngine();
    const detector = createDetector();
    const first = detector.next(await engine.start());
    detector.next(await engine.send('enter building'));
    const back = detector.next(await engine.send('out'));
    expect(back[0]).toMatchObject({ kind: 'newRoom', roomId: (first[0] as { roomId: string }).roomId });
  });
});

describe('createDetector on scripted turns', () => {
  it('score_36_to_46_yields_scoregain_delta_ten', () => {
    const d = createDetector();
    d.next(turn());
    const events = d.next(turn({ text: 'Taken.', status: { location: 'At End Of Road', score: 46, moves: 1 } }));
    expect(events).toEqual([{ kind: 'scoreGain', delta: 10, text: 'Taken.' }]);
  });

  it('text_containing_you_have_died_yields_death', () => {
    const d = createDetector();
    d.next(turn());
    const events = d.next(turn({ text: '**** You have died ****' }));
    expect(events.map((e) => e.kind)).toEqual(['death']);
  });

  it('text_containing_you_are_dead_yields_death', () => {
    const d = createDetector();
    expect(d.next(turn({ text: 'You are dead!' })).map((e) => e.kind)).toContain('death');
  });

  it('text_containing_gotten_yourself_killed_yields_death', () => {
    const d = createDetector();
    d.next(turn());
    const text = "Oh dear, you seem to have gotten yourself killed. I might be able to help you out.";
    expect(d.next(turn({ text })).map((e) => e.kind)).toEqual(['death']);
  });

  it('text_containing_you_have_won_yields_ending_even_while_the_game_is_still_running', () => {
    const d = createDetector();
    d.next(turn());
    const events = d.next(turn({ text: '*** You have won ***' }));
    expect(events).toEqual([{ kind: 'ending', text: '*** You have won ***' }]);
  });

  it('finished_with_a_win_line_yields_one_ending', () => {
    const d = createDetector();
    d.next(turn());
    expect(d.next(turn({ text: 'You have won', finished: true })).map((e) => e.kind)).toEqual(['ending']);
  });

  it('finished_yields_ending', () => {
    const d = createDetector();
    d.next(turn());
    const events = d.next(turn({ text: 'Thanks for playing.', finished: true }));
    expect(events).toEqual([{ kind: 'ending', text: 'Thanks for playing.' }]);
  });

  it('a_turn_with_no_status_yields_no_events', () => {
    const d = createDetector();
    expect(d.next(turn({ text: 'hello', status: null }))).toEqual([]);
  });

  it('score_decrease_yields_no_scoregain', () => {
    const d = createDetector();
    d.next(turn({ status: { location: 'At End Of Road', score: 46, moves: 1 } }));
    expect(d.next(turn({ status: { location: 'At End Of Road', score: 40, moves: 2 } }))).toEqual([]);
  });
});
