# The advent-crowther.z5 story file

## What it is

`public/advent-crowther.z5` is `Advent_Crowther-r2.z5`: "Adventure - Colossal Cave by William Crowther, ported by Chris
Conley", release 2 (about text: release 2.22), serial number 110819, built with Inform 7 build 6G60. It aims to
reproduce the output text and world model of Crowther's original 1976 program. It is a Z-machine **version 5** story.

- Size 254,464 bytes, SHA-256 `6a2f94c6b99da7e67312e823bd4574d27bb1a68d4688dac6c5c22eed910fb27a`.
- It was supplied by the project owner. The build environment could not reach the Interactive Fiction Archive, so its
  origin was not checked against the archive's copy.
- It is the 1976 game, not the later 350-point Woods expansion: **no score** ("There is no score in this story."), a smaller
  map, and one status-line column (location, then move count).

## License situation

- The file contains no license text (a search of its strings found none), and the project has not confirmed the terms
  under which Chris Conley released it.
- It reproduces Crowther's original, which had no explicit license either. (Eric Raymond's BSD-2-Clause "Open Adventure"
  covers the later 2.5 source with Don Woods' 2017 permission; that is a different work and does not cover this file.)
- Distribution elsewhere is not a license.

## Decision

The site serves the file so that players do not have to find and load it. This is a deliberate choice by the project
owner, with the risk understood:

- **To do:** confirm the terms with Chris Conley, and record them here. If anyone with a claim asks for the file to be
  removed, remove it (`public/advent-crowther.z5`, the pinned hash and the About text) and either ship a
  bring-your-own-file flow or a different story.
- The page says its license is unstated and that permission is sought. The file is not altered.
- `tests/story-file.test.ts` pins the exact file by hash and fails if any other story file is tracked.

## How the app handles this story

- **Opening question:** the game asks "Would you like instructions?" first. `controller.start` answers no (after showing
  the banner without the question) and drops the "(Type ABOUT ...)" line from the first room text.
- **Rooms:** the status line is `Location ... <moves>`. The engine reports score 0 for such games, so no score-gain video
  is ever made. Pictures key on the location name ("End of Road", "Building", "Valley").
- **Death:** a starred banner such as `*** You fell into a pit and broke every bone in your body! ***`, followed by
  "Would you like to RESTART, RESTORE a saved game, QUIT or UNDO the last command?". The player types one of those.
- **Quit:** the game exits and the page stops sending commands.

## Tests

The shipped file is exercised directly by the engine, event and story-file specs. The scored-game paths (the
`Score: N  Moves: M` status line) are covered by the Nelson `advent.z5` / `advent.z3` builds that ship as test fixtures in
`node_modules/glkote-term/tests/`, read in place and never copied to a tracked path; those specs skip if absent. The
Nelson files are not part of this project.
