# Colossal Cave: An AI Interpretation

The original Colossal Cave Adventure (Will Crowther and Don Woods) in your browser, with an AI-made picture of each new
place and short video clips at key moments. The game runs entirely on your device. The pictures are optional and come
from your own OpenRouter account.

Live site (GitHub Pages): https://greglose.github.io/colossal-cave-ai/

Sister project: [zork-ai](https://github.com/greglose/zork-ai).

## The story file

The game is `public/advent.z5`, Graham Nelson's Z-machine port of the 350-point original, served next to the page.
Players load nothing. **Its license is unstated**: it derives from Crowther and Woods' original and has no license of
its own (the Interactive Fiction Database lists it as freeware). It is included in good faith while permission from
Graham Nelson is sought, and it will be removed if asked. The full situation is in
[docs/advent-story-file.md](docs/advent-story-file.md).

## How it works

- [ifvms](https://github.com/curiousdannii/ifvms.js) runs the story file in the page (`src/lib/if/engine.ts`, no DOM).
  `advent.z5` is a Z-machine version 5 story: it has no built-in status line, so the engine reads the location, score and
  moves from the status line the Inform library draws in the upper window. Text comes back at once; the game never waits
  for a picture.
- When you enter a place you have not pictured yet, the page sends that place's room text and your chosen art style to
  OpenRouter and asks for one image. Pictures are stored in this browser (IndexedDB), so a place you revisit costs
  nothing. A short video is made when your score goes up, when you die, and at the end, or when you press Make a video.
- Each session is capped (default 40 pictures and 5 videos; see Settings). Reloading starts a new session.
- Your position (saved with the Z-machine's own Quetzal format), art style and settings are saved in this browser's local
  storage. A saved position is only restored into the same story file that made it.
- It works offline after the first visit: a small service worker caches the page, its scripts and the story file. It never touches a
  request to another origin.

## Bring your own OpenRouter key

Pictures and videos need an [OpenRouter](https://openrouter.ai) key. Without one the game is fully playable as text.

- Open Settings, read the cost notice, accept it, paste your key.
- **Cost:** generation is billed by OpenRouter to your account, per picture and per video. Videos cost more than
  pictures. The default models and the session caps are in Settings; set a spending limit on your OpenRouter key.
- **The key stays in your browser.** It is kept in local storage on this device and goes only to `openrouter.ai`, in an
  `Authorization` header (never in a URL). Anyone who can use your browser profile can read it. "Forget key" removes it.

## Privacy

- Sent to OpenRouter and the model provider it routes to: the **room text** the game printed for the place and your
  **art style**.
- **Not sent:** the commands you type. The prompt builder only ever sees the room name, the game's
  own room text and the style (`src/scripts/controller.ts` strips the echoed command; `tests/runtime.test.ts` pins it).
- Nothing is sent to the author of this app. No analytics, no cookies, no other third-party requests.

## Run it

Node 22.23.4 or newer (Node 24 is what the deploy workflow uses).

```
npm ci
npm run dev      # http://localhost:4321/colossal-cave-ai/
npm test         # builds the site, then runs every spec (vitest, happy-dom)
npm run build    # static site in dist/
npm run preview
npm run check    # astro check
```

The tests that play real turns use the Nelson `advent.z5` / `advent.z3` test fixtures that ship inside the
`glkote-term` npm package, read in place from `node_modules` (they skip if absent). `tests/story-file.test.ts` pins
`public/advent.z5` by SHA-256 and fails if any other story file is tracked.

The site is served under a base path. Defaults are `https://greglose.github.io` and `/colossal-cave-ai/`; override with
the `CAVE_SITE` and `CAVE_BASE` environment variables (for example `CAVE_BASE=/ npm run build` for a domain root).
Asset URLs, the web manifest and the service worker scope all follow the base. `python3 scripts/make-icons.py`
redraws the icons (needs Pillow).

Deployment: `.github/workflows/pages.yml` builds with `npm ci && npm run build` on Node 24 and publishes `dist/` to
GitHub Pages on every push to `main` (enable Pages with source "GitHub Actions" in the repo settings).

## Credits and licenses

- Colossal Cave Adventure by Will Crowther (1976) and Don Woods (1977). The Z-machine port, `Advent.z5`, is by Graham
  Nelson (after a reconstruction by Donald Ekman, David M. Baggett and Graham Nelson, 1993-94). Neither the original nor
  the port states a redistribution license (see above). This is an unofficial interpretation, not affiliated with or
  endorsed by its authors.
- [ifvms](https://github.com/curiousdannii/ifvms.js) and glkote-term, both MIT.
- Everything else: MIT, copyright 2026 Greg Lose (`LICENSE`). Third-party texts are in `THIRD-PARTY-NOTICES.md`.
- A [Cant Lose Software](https://cantlosesoftware.com) project.
