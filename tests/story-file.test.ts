import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { validateStory } from '../src/lib/if/story';

const ROOT = join(__dirname, '..');
const STORY = 'public/advent-crowther.z5';
// Chris Conley's Inform 7 port of Will Crowther's 1976 Adventure (release 2, serial 110819), Advent_Crowther-r2.z5.
const SHA256 = '6a2f94c6b99da7e67312e823bd4574d27bb1a68d4688dac6c5c22eed910fb27a';
const STORY_NAME = /\.(z[1-8]|zblorb|zlb|blb|blorb|gblorb|ulx)$/i;

describe('the shipped story file', () => {
  const bytes = () => new Uint8Array(readFileSync(join(ROOT, STORY)));

  it('is the exact Advent.z5 we mean to ship', () => {
    expect(createHash('sha256').update(bytes()).digest('hex')).toBe(SHA256);
  });

  it('passes the same validation the page runs', () => {
    expect(validateStory(bytes())).toEqual({ ok: true, version: 5 });
  });

  it('is the only story file in the repository', () => {
    let files: string[];
    try {
      files = execFileSync('git', ['ls-files', '-z', '--cached', '--others', '--exclude-standard'], { cwd: ROOT, encoding: 'utf8' })
        .split('\0')
        .filter(Boolean);
    } catch {
      return; // not a git checkout
    }
    expect(files.filter((f) => existsSync(join(ROOT, f)) && STORY_NAME.test(f))).toEqual([STORY]);
  });

  it('is not ignored by git', () => {
    try {
      execFileSync('git', ['check-ignore', '--no-index', '-q', STORY], { cwd: ROOT });
      throw new Error('ignored');
    } catch (e) {
      expect((e as { status?: number }).status).toBe(1);
    }
  });
});
