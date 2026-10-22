// Heuristics for "this file looks like a Z-machine story file", used by the no-story-file-tracked spec.
const STORY_EXTENSIONS = /\.(z[1-8]|zblorb|zlb|blb|blorb|gblorb|ulx|gam|dat)$/i;
const RUNNABLE_OR_KNOWN = new Set([1, 2, 3, 4, 5, 6, 7, 8]);

export function looksLikeStoryFile(path: string, bytes: Uint8Array): boolean {
  if (STORY_EXTENSIONS.test(path)) return true;
  if (bytes.length < 64) return false;
  const tag = (at: number) => String.fromCharCode(...bytes.subarray(at, at + 4));
  if (tag(0) === 'FORM' && tag(8) === 'IFRS') return true; // Blorb package
  if (tag(0) === 'Glul') return true; // Glulx
  // Z-machine header: version byte 1..8, then the high-memory and static-memory bases point inside the file and
  // above the 64-byte header. Text starts with printable bytes, so a first byte of 1..8 is already unusual.
  if (!RUNNABLE_OR_KNOWN.has(bytes[0]!)) return false;
  const word = (at: number) => (bytes[at]! << 8) | bytes[at + 1]!;
  const high = word(0x04);
  const statics = word(0x0e);
  return high >= 64 && high <= bytes.length && statics >= 64 && statics <= bytes.length;
}
