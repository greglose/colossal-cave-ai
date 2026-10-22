// The "Load story file" panel: a file input plus drag and drop. The page ships no story file; the player supplies
// their own copy of Advent.z5. A file is checked (lib/if/story) before it is kept, and nothing here reads the
// story's text or sends it anywhere: it goes to IndexedDB on this device and to the interpreter.
import { MAX_STORY_BYTES, storyProblem, validateStory } from '../lib/if/story';

export interface LoaderElements {
  panel: HTMLElement;
  drop: HTMLElement;
  input: HTMLInputElement;
  error: HTMLElement;
  cancel: HTMLButtonElement;
}

export function findLoaderElements(root: ParentNode): LoaderElements {
  const q = <T extends HTMLElement>(sel: string): T => {
    const el = root.querySelector<T>(sel);
    if (!el) throw new Error(`Missing ${sel}`);
    return el;
  };
  return {
    panel: q('[data-loader]'),
    drop: q('[data-drop]'),
    input: q<HTMLInputElement>('[data-story-input]'),
    error: q('[data-loader-error]'),
    cancel: q<HTMLButtonElement>('[data-act="cancel-load"]'),
  };
}

export interface LoaderDeps {
  els: LoaderElements;
  store: { put(bytes: Uint8Array): Promise<void> };
  /** Called with the validated bytes, after they have been kept. */
  onLoaded(bytes: Uint8Array): void;
  onCancel?(): void;
}

export function createStoryLoader({ els, store, onLoaded, onCancel }: LoaderDeps) {
  const fail = (message: string) => void (els.error.textContent = message);

  async function accept(file: File | undefined): Promise<void> {
    if (!file) return;
    els.error.textContent = '';
    if (file.size > MAX_STORY_BYTES) return fail(storyProblem({ ok: false, reason: 'too-big' }));
    let bytes: Uint8Array;
    try {
      bytes = new Uint8Array(await file.arrayBuffer());
    } catch {
      return fail('That file could not be read. Try choosing it again.');
    }
    const check = validateStory(bytes);
    if (!check.ok) return fail(storyProblem(check));
    await store.put(bytes);
    onLoaded(bytes);
  }

  els.input.addEventListener('change', () => {
    const file = els.input.files?.[0];
    void accept(file).finally(() => {
      // The same file can be chosen again after an error.
      try {
        els.input.value = '';
      } catch {
        // Some environments forbid resetting a file input.
      }
    });
  });
  els.drop.addEventListener('dragover', (e) => {
    e.preventDefault();
    els.drop.dataset.over = 'true';
  });
  els.drop.addEventListener('dragleave', () => void (els.drop.dataset.over = 'false'));
  els.drop.addEventListener('drop', (e) => {
    e.preventDefault();
    els.drop.dataset.over = 'false';
    void accept((e as DragEvent).dataTransfer?.files?.[0]);
  });
  els.cancel.addEventListener('click', () => {
    els.panel.hidden = true;
    onCancel?.();
  });

  return {
    show({ canCancel, message = '' }: { canCancel: boolean; message?: string }): void {
      els.error.textContent = message;
      els.cancel.hidden = !canCancel;
      els.panel.hidden = false;
    },
    hide(): void {
      els.panel.hidden = true;
    },
  };
}
