// The Nelson Advent builds that ship inside the glkote-term npm package (its own test fixtures). They are read in
// place from node_modules and never copied to a tracked path. Specs that need one skip when the package lacks it.
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const DIR = join(__dirname, '..', 'node_modules', 'glkote-term', 'tests');

export const ADVENT_Z5 = join(DIR, 'advent.z5');
export const ADVENT_Z3 = join(DIR, 'advent.z3');
export const hasAdventZ5 = existsSync(ADVENT_Z5);
export const hasAdventZ3 = existsSync(ADVENT_Z3);

export const readStory = (path: string): Uint8Array => new Uint8Array(readFileSync(path));
