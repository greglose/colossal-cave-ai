import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = join(__dirname, '..');
const text = (path: string) => readFileSync(join(ROOT, path), 'utf8');

describe('docs and deploy', () => {
  it('the pages workflow builds on Node 24 and publishes dist/', () => {
    const wf = text('.github/workflows/pages.yml');
    expect(wf).toMatch(/node-version:\s*24/);
    expect(wf).toContain('npm ci && npm run build');
    expect(wf).toContain('path: dist');
  });

  it('the README covers the story file, the key, privacy and credits', () => {
    const readme = text('README.md');
    expect(readme).toMatch(/Players load nothing/);
    expect(readme).toMatch(/license is unstated/i);
    expect(readme).toMatch(/OpenRouter key/);
    expect(readme).toMatch(/goes only to `openrouter\.ai`/);
    expect(readme).toMatch(/Crowther/);
    expect(readme).toMatch(/Graham\s+Nelson/);
    expect(readme).toMatch(/ifvms/);
    expect(readme).toContain('https://cantlosesoftware.com');
  });

  it('third-party notices cover ifvms, glkote-term and the story file', () => {
    const notices = text('THIRD-PARTY-NOTICES.md');
    expect(notices).toMatch(/ifvms/);
    expect(notices).toMatch(/glkote-term/);
    expect(notices).toMatch(/advent\.z5/);
    expect(notices).toMatch(/no stated\s+redistribution license/);
  });

  it('the story file document says permission from Graham Nelson is being sought', () => {
    const doc = text('docs/advent-story-file.md');
    expect(doc).toMatch(/Permission from Graham Nelson is being sought/);
    expect(doc).toMatch(/no stated redistribution license/i);
  });

  it('keeps the MIT license of Greg Lose', () => {
    expect(text('LICENSE')).toMatch(/Copyright \(c\) 2026 Greg Lose/);
  });

  it('is named colossal-cave-ai with the base path and no leftovers of the other game', () => {
    expect(JSON.parse(text('package.json')).name).toBe('colossal-cave-ai');
    expect(text('astro.config.mjs')).toContain("'/colossal-cave-ai/'");
    expect(text('astro.config.mjs')).toContain('https://greglose.github.io');
    expect(existsSync(join(ROOT, 'public/zork1.z3'))).toBe(false);
    expect(existsSync(join(ROOT, 'public/advent.z5'))).toBe(true);
    const files = execFileSync('git', ['ls-files', '-z', '--cached', '--others', '--exclude-standard'], { cwd: ROOT, encoding: 'utf8' })
      .split('\0')
      .filter((f) => f && existsSync(join(ROOT, f)) && !/\.(png|lock)$|package-lock\.json$|^docs\/BUILD-BRIEF\.md$|^README\.md$|^tests\/(repo|build)\.test\.ts$|^src\/lib\/if\/prompt\.test\.ts$/.test(f));
    const offenders = files.filter((f) => /zork/i.test(readFileSync(join(ROOT, f), 'utf8')));
    expect(offenders).toEqual([]);
  });

  it('every tracked text file is plain ASCII', () => {
    const files = execFileSync('git', ['ls-files', '-z', '--cached', '--others', '--exclude-standard'], { cwd: ROOT, encoding: 'utf8' })
      .split('\0')
      .filter((f) => f && existsSync(join(ROOT, f)) && !/\.(png|z5)$/.test(f));
    const offenders = files.filter((f) => /[^\x00-\x7f]/.test(readFileSync(join(ROOT, f), 'utf8')));
    expect(offenders).toEqual([]);
  });
});
