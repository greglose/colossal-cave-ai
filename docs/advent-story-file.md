# The Advent.z5 story file

## What it is

`Advent.z5` is Graham Nelson's Z-machine (Inform) port of the 350-point Colossal Cave Adventure by Will Crowther
(1976) and Don Woods (1977). The banner reads "Reconstructed in three steps by Donald Ekman, David M. Baggett (1993)
and Graham Nelson (1994)", release 9, built with the Inform 6.31 library. It is a Z-machine **version 5** story.

## License situation

- The file has **no stated redistribution license**.
- It derives from Crowther and Woods' original, which also has no explicit license.
- Copies circulate on the Interactive Fiction Archive
  (https://www.ifarchive.org/indexes/if-archive/games/zcode/), and the `glkote-term` npm package ships `advent.z3` and
  `advent.z5` as test fixtures. Neither is a license to redistribute it from this project.

So this repository does not include it, the deployed site does not serve it, and the service worker does not cache it.
**The player loads their own copy.**

## What the app does about it

- No story file may be tracked in git. `.gitignore` lists the story extensions (`*.z3`, `*.z5`, `*.z8`, Blorb and so on),
  and `tests/no-story-file.test.ts` fails if any tracked file looks like a Z-machine story file, by name or by content.
- A first-run **Load story file** panel takes the file (file input or drag and drop) and links to the Archive.
  The page, the README and this document all say the file is the player's own copy, not distributed here, license
  unstated.
- Validation (`src/lib/if/story.ts`): not empty, at most 1 MB, and a Z-machine version byte that ifvms runs (3, 4, 5 or
  8). Anything else is refused with a plain message.
- The validated bytes are kept in the browser's IndexedDB (`cls-cave-story`), never uploaded. Settings has a **Choose a
  different story file** button.
- A saved position records the story's release, serial number and checksum, and is only restored into the same file.
- `public/sw.js` has no rule that matches a story file, and `tests/sw.test.ts` pins that.

## Tests without shipping the file

The specs that play real turns read `advent.z5` and `advent.z3` in place from
`node_modules/glkote-term/tests/` (`find node_modules/glkote-term -iname 'advent*'`). They are never copied to a tracked
path, and each spec skips if the fixture is absent.

## Permission

Permission from Graham Nelson to redistribute the file is being sought. If it is granted in writing, this document and
the README are where to record it, and bundling the file could then be reconsidered. Until then, nothing changes: the
player brings the file.
