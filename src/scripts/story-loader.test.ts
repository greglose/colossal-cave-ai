// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MAX_STORY_BYTES } from '../lib/if/story';
import { createStoryLoader, findLoaderElements } from './story-loader';

const MARKUP = `
  <section data-loader hidden>
    <div data-drop><input type="file" data-story-input /></div>
    <p data-loader-error role="alert"></p>
    <button type="button" data-act="cancel-load" hidden>Cancel</button>
  </section>`;

const story = (version = 5, length = 4096) => {
  const b = new Uint8Array(length);
  b[0] = version;
  return b;
};
const fileOf = (bytes: Uint8Array, name = 'Advent.z5') =>
  ({ name, size: bytes.length, arrayBuffer: async () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) }) as unknown as File;

function rig() {
  document.body.innerHTML = MARKUP;
  const els = findLoaderElements(document.body);
  const store = { put: vi.fn(async (_b: Uint8Array) => undefined), get: vi.fn(), clear: vi.fn() };
  const onLoaded = vi.fn();
  const loader = createStoryLoader({ els, store, onLoaded });
  return { els, store, onLoaded, loader };
}
const pick = async (els: ReturnType<typeof findLoaderElements>, file: File) => {
  Object.defineProperty(els.input, 'files', { value: [file], configurable: true });
  els.input.dispatchEvent(new Event('change', { bubbles: true }));
  await new Promise((r) => setTimeout(r, 0));
};
const dropEvent = (type: string, file?: File) => {
  const ev = new Event(type, { bubbles: true, cancelable: true });
  Object.defineProperty(ev, 'dataTransfer', { value: { files: file ? [file] : [] } });
  return ev;
};

beforeEach(() => void (document.body.innerHTML = ''));

describe('story loader', () => {
  it('show_reveals_the_panel_and_hide_hides_it', () => {
    const { els, loader } = rig();
    loader.show({ canCancel: false });
    expect(els.panel.hidden).toBe(false);
    expect(els.cancel.hidden).toBe(true);
    loader.show({ canCancel: true });
    expect(els.cancel.hidden).toBe(false);
    loader.hide();
    expect(els.panel.hidden).toBe(true);
  });

  it('a_valid_file_is_stored_then_handed_over', async () => {
    const { els, store, onLoaded, loader } = rig();
    loader.show({ canCancel: false });
    await pick(els, fileOf(story(5)));
    expect(store.put).toHaveBeenCalledTimes(1);
    expect(store.put.mock.calls[0]![0][0]).toBe(5);
    expect(onLoaded).toHaveBeenCalledTimes(1);
    expect(onLoaded.mock.calls[0]![0][0]).toBe(5);
    expect(els.error.textContent).toBe('');
  });

  it('an_invalid_file_shows_a_clear_error_and_is_not_stored', async () => {
    const { els, store, onLoaded, loader } = rig();
    loader.show({ canCancel: false });
    await pick(els, fileOf(story(0)));
    expect(els.error.textContent).toMatch(/does not look like a Z-machine story file/);
    await pick(els, fileOf(new Uint8Array(0)));
    expect(els.error.textContent).toMatch(/empty/);
    await pick(els, fileOf(story(6)));
    expect(els.error.textContent).toMatch(/version 6/);
    expect(store.put).not.toHaveBeenCalled();
    expect(onLoaded).not.toHaveBeenCalled();
  });

  it('a_file_over_one_megabyte_is_refused_without_reading_it', async () => {
    const { els, store, loader } = rig();
    loader.show({ canCancel: false });
    const arrayBuffer = vi.fn(async () => new ArrayBuffer(8));
    await pick(els, { name: 'big.bin', size: MAX_STORY_BYTES + 1, arrayBuffer } as unknown as File);
    expect(els.error.textContent).toMatch(/larger than 1 MB/);
    expect(arrayBuffer).not.toHaveBeenCalled();
    expect(store.put).not.toHaveBeenCalled();
  });

  it('a_file_that_cannot_be_read_shows_an_error', async () => {
    const { els, onLoaded, loader } = rig();
    loader.show({ canCancel: false });
    await pick(els, { name: 'x', size: 10, arrayBuffer: async () => { throw new Error('gone'); } } as unknown as File);
    expect(els.error.textContent).toMatch(/could not be read/i);
    expect(onLoaded).not.toHaveBeenCalled();
  });

  it('a_good_file_after_a_bad_one_clears_the_error', async () => {
    const { els, loader } = rig();
    loader.show({ canCancel: false });
    await pick(els, fileOf(story(0)));
    expect(els.error.textContent).not.toBe('');
    await pick(els, fileOf(story(5)));
    expect(els.error.textContent).toBe('');
  });

  it('drag_and_drop_takes_the_first_file', async () => {
    const { els, onLoaded, loader } = rig();
    loader.show({ canCancel: false });
    const over = dropEvent('dragover');
    els.drop.dispatchEvent(over);
    expect(over.defaultPrevented).toBe(true);
    expect(els.drop.dataset.over).toBe('true');
    const drop = dropEvent('drop', fileOf(story(5)));
    els.drop.dispatchEvent(drop);
    expect(drop.defaultPrevented).toBe(true);
    expect(els.drop.dataset.over).toBe('false');
    await new Promise((r) => setTimeout(r, 0));
    expect(onLoaded).toHaveBeenCalledTimes(1);
  });

  it('dropping_nothing_does_nothing', async () => {
    const { els, onLoaded, loader } = rig();
    loader.show({ canCancel: false });
    els.drop.dispatchEvent(dropEvent('drop'));
    await new Promise((r) => setTimeout(r, 0));
    expect(onLoaded).not.toHaveBeenCalled();
  });

  it('cancel_hides_the_panel_and_calls_back', () => {
    const rigged = rig();
    const onCancel = vi.fn();
    const loader = createStoryLoader({ els: rigged.els, store: rigged.store, onLoaded: rigged.onLoaded, onCancel });
    loader.show({ canCancel: true });
    rigged.els.cancel.click();
    expect(rigged.els.panel.hidden).toBe(true);
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('an_error_from_an_earlier_visit_is_cleared_on_show', async () => {
    const { els, loader } = rig();
    loader.show({ canCancel: false });
    await pick(els, fileOf(story(0)));
    loader.show({ canCancel: false });
    expect(els.error.textContent).toBe('');
  });
});

describe('story loader message', () => {
  it('show_can_carry_a_message_for_a_file_that_failed_later', () => {
    const { els, loader } = rig();
    loader.show({ canCancel: false, message: 'That story file could not be started.' });
    expect(els.error.textContent).toBe('That story file could not be started.');
  });
});
