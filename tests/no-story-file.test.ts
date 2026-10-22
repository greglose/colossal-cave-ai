import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { ADVENT_Z3, ADVENT_Z5, hasAdventZ3, hasAdventZ5, readStory } from './fixtures';
import { looksLikeStoryFile } from './story-scan';

const ROOT = join(__dirname, '..');

// Advent.z5 has no stated redistribution license, so no story file may ever be committed. The player loads their own.
function trackedFiles(): string[] | null {
  try {
    const out = execFileSync('git', ['ls-files', '-z'], { cwd: ROOT, encoding: 'utf8' });
    return out.split('\0').filter(Boolean);
  } catch {
    return null; // not a git checkout (for example an exported tarball)
  }
}

describe('looksLikeStoryFile (the detector itself)', () => {
  it.skipIf(!hasAdventZ5)('flags the real Advent.z5 even under an innocent name', () => {
    expect(looksLikeStoryFile('notes.txt', readStory(ADVENT_Z5))).toBe(true);
  });
  it.skipIf(!hasAdventZ3)('flags the real Advent.z3 even under an innocent name', () => {
    expect(looksLikeStoryFile('notes.txt', readStory(ADVENT_Z3))).toBe(true);
  });
  it('flags a story extension whatever the content', () => {
    for (const name of ['a.z3', 'public/Advent.Z5', 'x.z8', 'game.zblorb', 'game.ulx']) {
      expect(looksLikeStoryFile(name, new Uint8Array(0))).toBe(true);
    }
  });
  it('flags a Blorb wrapper', () => {
    const b = new Uint8Array(128);
    b.set(new TextEncoder().encode('FORM'), 0);
    b.set(new TextEncoder().encode('IFRS'), 8);
    expect(looksLikeStoryFile('pack.bin', b)).toBe(true);
  });
  it('does not flag source, text, json or png files', () => {
    const text = new TextEncoder().encode('export const x = 1;\n'.repeat(20));
    expect(looksLikeStoryFile('src/a.ts', text)).toBe(false);
    expect(looksLikeStoryFile('a.json', new TextEncoder().encode('{"a":5}'.repeat(20)))).toBe(false);
    const png = new Uint8Array(200);
    png.set([0x89, 0x50, 0x4e, 0x47], 0);
    expect(looksLikeStoryFile('icon.png', png)).toBe(false);
  });
});

describe('the repository tracks no story file', () => {
  it('git ls-files lists no Z-machine story file, by name or by content', () => {
    const files = trackedFiles();
    if (!files) return;
    const offenders = files.filter((f) => {
      const full = join(ROOT, f);
      if (!existsSync(full) || !statSync(full).isFile()) return false;
      return looksLikeStoryFile(f, new Uint8Array(readFileSync(full)));
    });
    expect(offenders).toEqual([]);
  });

  it('.gitignore keeps story files out', () => {
    const ignore = readFileSync(join(ROOT, '.gitignore'), 'utf8').split('\n').map((l) => l.trim());
    for (const pattern of ['*.z1', '*.z2', '*.z3', '*.z4', '*.z5', '*.z6', '*.z7', '*.z8', '*.zblorb', '*.blorb', '*.blb']) {
      expect(ignore).toContain(pattern);
    }
  });

  it('git agrees that a story file would be ignored', () => {
    if (!trackedFiles()) return;
    for (const name of ['Advent.z5', 'public/advent.z3', 'x.z8', 'story.zblorb']) {
      const out = execFileSync('git', ['check-ignore', '--no-index', name], { cwd: ROOT, encoding: 'utf8' });
      expect(out.trim()).toBe(name);
    }
  });
});
