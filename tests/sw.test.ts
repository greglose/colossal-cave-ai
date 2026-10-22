import { beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// The worker is plain script; run it against a fake ServiceWorkerGlobalScope and drive its listeners directly.
const SOURCE = readFileSync(join(__dirname, '..', 'public', 'sw.js'), 'utf8');
const ORIGIN = 'https://greglose.github.io';
const SCOPE = `${ORIGIN}/colossal-cave-ai/`;

type Handler = (event: unknown) => void;

function boot() {
  const handlers: Record<string, Handler> = {};
  const store = new Map<string, Response>();
  const matchCalls: unknown[] = [];
  const fetchCalls: string[] = [];
  const cache = {
    match: async (req: Request | string, opts?: unknown) => {
      matchCalls.push(opts);
      return store.get(typeof req === 'string' ? req : req.url)?.clone();
    },
    put: async (req: Request | string, res: Response) => void store.set(typeof req === 'string' ? req : req.url, res),
    addAll: async () => {},
  };
  const caches = {
    open: async () => cache,
    keys: async () => ['cave-ai-old'],
    delete: vi.fn(async () => true),
    match: async (req: Request, opts?: unknown) => cache.match(req, opts),
  };
  const self = {
    registration: { scope: SCOPE },
    location: { origin: ORIGIN },
    addEventListener: (type: string, fn: Handler) => void (handlers[type] = fn),
    skipWaiting: () => {},
    clients: { claim: async () => {} },
  };
  const fetchFn = async (req: Request | string) => {
    const url = typeof req === 'string' ? req : req.url;
    fetchCalls.push(url);
    return new Response('net', { status: 200 });
  };
  new Function('self', 'caches', 'fetch', 'URL', 'Request', 'Response', SOURCE)(self, caches, fetchFn, URL, Request, Response);
  const fetchEvent = (url: string, mode = 'no-cors') => {
    const req = new Request(url, { method: 'GET' });
    Object.defineProperty(req, 'mode', { value: mode });
    let responded: Promise<Response> | undefined;
    handlers.fetch({ request: req, respondWith: (p: Promise<Response>) => void (responded = p), waitUntil: () => {} });
    return responded;
  };
  return { handlers, store, matchCalls, fetchCalls, fetchEvent, caches };
}

describe('service worker', () => {
  let sw: ReturnType<typeof boot>;
  beforeEach(() => void (sw = boot()));

  it('never intercepts a cross-origin request, openrouter.ai included', () => {
    expect(sw.fetchEvent('https://openrouter.ai/api/v1/chat/completions')).toBeUndefined();
    expect(sw.fetchEvent('https://cantlosesoftware.com/')).toBeUndefined();
    expect(sw.fetchCalls).toEqual([]);
  });

  it('serves the story file cache-first, so the game works offline', async () => {
    const url = `${SCOPE}advent-crowther.z5`;
    expect(await (await sw.fetchEvent(url))!.text()).toBe('net');
    expect(await (await sw.fetchEvent(url))!.text()).toBe('net');
    expect(sw.fetchCalls).toEqual([url]);
  });

  it('leaves other file types and unknown paths alone', () => {
    for (const name of ['other.zip', 'adventure.dat', 'notes.txt']) expect(sw.fetchEvent(`${SCOPE}${name}`)).toBeUndefined();
  });

  it('ignores Vary on every cache lookup', async () => {
    await sw.fetchEvent(`${SCOPE}icon-192.png`);
    await sw.fetchEvent(`${SCOPE}icon-192.png`);
    expect(sw.matchCalls.length).toBeGreaterThan(0);
    for (const opts of sw.matchCalls) expect(opts).toEqual({ ignoreVary: true });
  });

  it('caches hashed bundles and icons cache-first', async () => {
    for (const path of ['_astro/main.abc123.js', 'icon-192.png']) {
      await sw.fetchEvent(`${SCOPE}${path}`);
      await sw.fetchEvent(`${SCOPE}${path}`);
    }
    expect(sw.fetchCalls.length).toBe(2);
  });

  it('leaves non-GET requests alone', () => {
    const req = new Request(`${SCOPE}icon-192.png`, { method: 'POST', body: 'x' });
    expect(sw.handlers.fetch({ request: req, respondWith: () => { throw new Error('intercepted'); } })).toBeUndefined();
  });

  it('drops caches from older versions on activate', async () => {
    let done: Promise<unknown> | undefined;
    sw.handlers.activate({ waitUntil: (p: Promise<unknown>) => void (done = p) });
    await done;
    expect(sw.caches.delete).toHaveBeenCalledWith('cave-ai-old');
  });
});
