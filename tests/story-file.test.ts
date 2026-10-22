import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { validateStory } from '../src/lib/if/story';

const ROOT = join(__dirname, '..');
const STORY = 'public/advent.z5';
// Graham Nelson's Advent.z5 (release 9, serial 060321), as shipped in the glkote-term package's test fixtures.
const SHA256 = '6179b5d5b17d692ec83fe64101ff8e4092390166c2b05063e7310eb976b93ea0';
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
