# Build brief: Colossal Cave AI

Build this app by porting https://github.com/greglose/zork-ai (finished Astro 7 app, live at
https://greglose.github.io/zork-ai/: ifvms Z-machine engine, OpenRouter pictures and video with the player's own key,
style picker, caps, cost notice, own service worker, Pages workflow, 113 tests). Strict TDD, ASCII-only text, no secrets,
typed game commands never go into any prompt. Work on a branch and open a PR to main.

## Steps
1. Clone zork-ai into a temp dir outside this repo, read its README.md, docs/ and src. Copy it (without .git,
   public/zork1.z3, public/LICENSE-ZORK.txt) into this repo. Keep this repo's LICENSE (MIT, Greg Lose 2026); replace README.md.
2. Rename: package colossal-cave-ai, title "Colossal Cave: An AI Interpretation", astro base '/colossal-cave-ai/'
   (site https://greglose.github.io, keep env overrides), storage and IndexedDB key names, a new generated icon set
   (180/192/512, lantern or cave mouth), the art-style bible for Colossal Cave (building at the end of the road, forest,
   cave, brass lantern, grate, snake, dragon, treasure; remove the Zork bible), footer "A Cant Lose Software project"
   linking to https://cantlosesoftware.com.
3. LICENSE RULE: Advent.z5 (Graham Nelson's Z-machine port of the 350-point original) has no stated redistribution
   license. No story file may be tracked in git: .gitignore *.z3 *.z5 *.z8 etc., plus a test that fails if any tracked
   file looks like a Z-machine story file. The player loads their own copy: first-run "Load story file" panel (file input
   + drag and drop) linking to https://www.ifarchive.org/indexes/if-archive/games/zcode/ (Advent.z5), with plain text in
   the UI and README that the file is the player's own copy, not distributed here, license unstated. Validate (Z-machine
   version byte 3-8 that ifvms runs, non-empty, <= 1 MB) with clear errors; keep validated bytes in IndexedDB; a
   "Choose a different story file" button in Settings; the service worker must not cache the file.
4. Engine: Advent.z5 is Z-machine v5 (Zork was v3). v5 has no built-in status line; the Inform library draws one in the
   upper window. Adapt engine.ts so Turn.status (location, score, moves) is read from real v5 output; adapt events.ts
   for Adventure (350 points; "At End Of Road"; "You are dead"/"You have died"; "You have won"). For tests use the Nelson
   advent.z5/z3 fixtures shipped inside node_modules/glkote-term (`find node_modules/glkote-term -iname 'advent*'`),
   read in place, skip if absent, never copied to a tracked path. Transcript tests from real output ("enter building",
   "take keys", "take lamp", "out", "south"). Quetzal save/restore must work with v5.
5. Keep the Vite 'pre' plugin in astro.config.mjs that declares glkapi.js's undeclared globals, and the bundle test that
   plays real turns (glkapi.js breaks in a strict ES bundle otherwise).
6. Docs: README (what it is, getting Advent.z5, bring your own OpenRouter key, key stays in the browser and goes only to
   openrouter.ai, privacy facts, credits: Crowther and Woods; Nelson's port; ifvms; licensing honest), THIRD-PARTY-NOTICES.md
   (ifvms, glkote-term), docs/advent-story-file.md (license situation; permission from Graham Nelson being sought),
   .github/workflows/pages.yml (Node 24).

## Done when
`npm ci`, `npx astro check` 0 errors, `npm test` green, `npm run build` ok, secrets scan clean, `git ls-files` shows no
story file, PR opened. Do not enable Pages or change repo settings. Report what could not be verified (no real key or
real browser in the cloud).
