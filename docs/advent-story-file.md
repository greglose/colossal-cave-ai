# The advent.z5 story file

## What it is

`public/advent.z5` is Graham Nelson's Z-machine (Inform) port of the 350-point Colossal Cave Adventure by Will Crowther
(1976) and Don Woods (1977). The banner reads "Reconstructed in three steps by Donald Ekman, David M. Baggett (1993)
and Graham Nelson (1994)", release 9, serial number 060321, Inform 6.31 library. It is a Z-machine **version 5** story.

- Size 138,240 bytes, SHA-256 `6179b5d5b17d692ec83fe64101ff8e4092390166c2b05063e7310eb976b93ea0`.
- The bytes are the copy that ships as a test fixture (`tests/advent.z5`) in the `glkote-term` 0.4.4 npm package. The
  Interactive Fiction Archive lists the same game at
  https://www.ifarchive.org/indexes/if-archive/games/zcode/ ; the build environment could not reach that host, so the
  archive's own copy was not compared byte for byte. Do that before relying on this file's provenance.

## License situation

- The file has **no stated redistribution license**. The Interactive Fiction Database lists it as freeware.
- It derives from Crowther and Woods' original, which had no explicit license either. (Eric Raymond's BSD-2-Clause
  "Open Adventure" covers the 2.5 source with Don Woods' 2017 permission; that is a different lineage from Nelson's port
  and does not cover this file.)
- It is distributed on the Interactive Fiction Archive and bundled by other open projects, but that is not a license.

## Decision

The site serves the file so that players do not have to find and load it. This is a deliberate choice by the project
owner, made in good faith with the risk understood:

- Permission from Graham Nelson is being sought. If it is granted, record it here. If anyone with a claim asks for the
  file to be removed, remove it (`public/advent.z5`, the pinned hash and the About text) and either ship a
  bring-your-own-file flow or a different story.
- The page says its license is unstated and that permission is being sought. The file is not altered.
- `tests/story-file.test.ts` pins the exact file by hash and fails if any other story file is tracked, so the shipped
  file cannot change unnoticed.

## Tests

The specs that play real turns read `advent.z5` and `advent.z3` in place from `node_modules/glkote-term/tests/`
(`find node_modules/glkote-term -iname 'advent*'`) and skip if absent. `tests/story-file.test.ts` and the build test
cover the shipped copy.
