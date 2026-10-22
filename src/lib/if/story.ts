// Checks the story file before the interpreter gets it (a truncated download or a wrong file served by a cache). Pure functions over bytes; no DOM and no storage. ifvms runs Z-machine versions 3, 4, 5 and 8.

export const MAX_STORY_BYTES = 1024 * 1024;
const HEADER_BYTES = 64;
const RUNNABLE = [3, 4, 5, 8];

export type StoryCheck =
  | { ok: true; version: number }
  | { ok: false; reason: 'empty' | 'too-short' | 'too-big' | 'not-zcode' | 'blorb' }
  | { ok: false; reason: 'unsupported-version'; version: number };

const tag = (b: Uint8Array, at: number) => String.fromCharCode(...b.subarray(at, at + 4));

export function validateStory(bytes: Uint8Array): StoryCheck {
  if (bytes.length === 0) return { ok: false, reason: 'empty' };
  if (bytes.length > MAX_STORY_BYTES) return { ok: false, reason: 'too-big' };
  if (bytes.length >= 12 && tag(bytes, 0) === 'FORM' && tag(bytes, 8) === 'IFRS') return { ok: false, reason: 'blorb' };
  if (bytes.length < HEADER_BYTES) return { ok: false, reason: 'too-short' };
  const version = bytes[0]!;
  if (RUNNABLE.includes(version)) return { ok: true, version };
  if (version >= 1 && version <= 8) return { ok: false, reason: 'unsupported-version', version };
  return { ok: false, reason: 'not-zcode' };
}

/** One plain sentence telling the player what is wrong with the game file. */
export function storyProblem(check: Exclude<StoryCheck, { ok: true }>): string {
  switch (check.reason) {
    case 'empty':
      return 'The game file came back empty. Reload the page to try again.';
    case 'too-short':
      return 'The game file is too small to be complete. Reload the page to try again.';
    case 'too-big':
      return 'The game file is larger than 1 MB, which is not right. Reload the page to try again.';
    case 'blorb':
      return 'The game file is a Blorb package, not a bare story file. Reload the page to try again.';
    case 'unsupported-version':
      return `The game file is a Z-machine version ${check.version} story, which this page cannot run.`;
    case 'not-zcode':
      return 'The game file does not look like a Z-machine story file. Reload the page to try again.';
  }
}

const hex = (n: number, width: number) => n.toString(16).padStart(width, '0');

/** Release number, serial and checksum from the story header: tells two story files (and builds) apart. */
export function storyId(bytes: Uint8Array): string {
  const release = ((bytes[2] ?? 0) << 8) | (bytes[3] ?? 0);
  const serial = Array.from(bytes.subarray(0x12, 0x18), (c) => (c >= 0x20 && c < 0x7f ? String.fromCharCode(c) : '0')).join('');
  const checksum = ((bytes[0x1c] ?? 0) << 8) | (bytes[0x1d] ?? 0);
  return `${release}-${serial}-${hex(checksum, 4)}`;
}
