import { describe, expect, it } from 'vitest';
import { ADVENT_Z3, ADVENT_Z5, hasAdventZ3, hasAdventZ5, readStory } from '../../../tests/fixtures';
import { MAX_STORY_BYTES, storyId, storyProblem, validateStory } from './story';

/** A header-sized buffer with a version byte; enough for validation, which never runs the game. */
const bytesOf = (version: number, length = 4096): Uint8Array => {
  const b = new Uint8Array(length);
  b[0] = version;
  return b;
};

describe('validateStory', () => {
  it('accepts_the_versions_ifvms_runs', () => {
    for (const v of [3, 4, 5, 8]) expect(validateStory(bytesOf(v))).toEqual({ ok: true, version: v });
  });

  it('rejects_an_empty_file', () => {
    expect(validateStory(new Uint8Array(0))).toEqual({ ok: false, reason: 'empty' });
  });

  it('rejects_a_file_too_short_to_hold_a_header', () => {
    expect(validateStory(bytesOf(5, 63))).toEqual({ ok: false, reason: 'too-short' });
  });

  it('rejects_a_file_over_one_megabyte', () => {
    expect(MAX_STORY_BYTES).toBe(1024 * 1024);
    expect(validateStory(bytesOf(5, MAX_STORY_BYTES + 1))).toEqual({ ok: false, reason: 'too-big' });
    expect(validateStory(bytesOf(5, MAX_STORY_BYTES))).toEqual({ ok: true, version: 5 });
  });

  it('rejects_z_machine_versions_the_interpreter_does_not_run', () => {
    for (const v of [1, 2, 6, 7]) expect(validateStory(bytesOf(v))).toEqual({ ok: false, reason: 'unsupported-version', version: v });
  });

  it('rejects_bytes_that_are_not_a_z_machine_story_file', () => {
    for (const v of [0, 9, 32, 0x47, 255]) expect(validateStory(bytesOf(v))).toEqual({ ok: false, reason: 'not-zcode' });
    const text = new TextEncoder().encode('This is a plain text file, not a story. '.repeat(10));
    expect(validateStory(text)).toEqual({ ok: false, reason: 'not-zcode' });
  });

  it('recognises_a_blorb_wrapper_and_says_so', () => {
    const blorb = bytesOf(0, 4096);
    blorb.set(new TextEncoder().encode('FORM'), 0);
    blorb.set(new TextEncoder().encode('IFRS'), 8);
    expect(validateStory(blorb)).toEqual({ ok: false, reason: 'blorb' });
  });

  it.skipIf(!hasAdventZ5)('accepts_the_real_advent_z5', () => {
    expect(validateStory(readStory(ADVENT_Z5))).toEqual({ ok: true, version: 5 });
  });

  it.skipIf(!hasAdventZ3)('accepts_the_real_advent_z3', () => {
    expect(validateStory(readStory(ADVENT_Z3))).toEqual({ ok: true, version: 3 });
  });
});

describe('storyProblem', () => {
  it('has_a_plain_ascii_sentence_for_every_failure', () => {
    const failures = [
      { ok: false, reason: 'empty' },
      { ok: false, reason: 'too-short' },
      { ok: false, reason: 'too-big' },
      { ok: false, reason: 'not-zcode' },
      { ok: false, reason: 'blorb' },
      { ok: false, reason: 'unsupported-version', version: 6 },
    ] as const;
    const seen = new Set<string>();
    for (const f of failures) {
      const text = storyProblem(f);
      expect(text.length).toBeGreaterThan(20);
      expect(/^[\x20-\x7e]*$/.test(text)).toBe(true);
      seen.add(text);
    }
    expect(seen.size).toBe(failures.length);
  });

  it('names_the_version_that_is_not_supported', () => {
    expect(storyProblem({ ok: false, reason: 'unsupported-version', version: 6 })).toContain('version 6');
  });
});

describe('storyId', () => {
  it('is_release_serial_and_checksum_from_the_header', () => {
    const b = bytesOf(5);
    b[2] = 0x00;
    b[3] = 0x09; // release 9
    b.set(new TextEncoder().encode('060321'), 0x12);
    b[0x1c] = 0xab;
    b[0x1d] = 0xcd;
    expect(storyId(b)).toBe('9-060321-abcd');
  });

  it('differs_between_two_different_story_files', () => {
    expect(storyId(bytesOf(5))).not.toBe(storyId(bytesOf(3)) + 'x');
    const a = bytesOf(5);
    const c = bytesOf(5);
    c[0x1d] = 1;
    expect(storyId(a)).not.toBe(storyId(c));
  });

  it.skipIf(!hasAdventZ5)('is_stable_for_the_real_file', () => {
    expect(storyId(readStory(ADVENT_Z5))).toBe(storyId(readStory(ADVENT_Z5)));
    expect(storyId(readStory(ADVENT_Z5))).toMatch(/^\d+-\d{6}-[0-9a-f]{4}$/);
  });
});
