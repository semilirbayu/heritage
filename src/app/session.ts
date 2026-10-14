// Browser-side session: the raw .ged file lives in this browser, never on
// disk server-side (ADR-0005). The pure helpers below are the decision logic
// covered by tests; SESSION_SCRIPT is the browser code that applies it.

export const SESSION_KEY = "heritage.ged.v1";

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

/** Restore only when this browser has a file and the server has no tree. */
export function shouldRestore(hasStoredFile: boolean, serverHasTree: boolean): boolean {
  return hasStoredFile && !serverHasTree;
}

export function readStored(store: StorageLike, key: string = SESSION_KEY): string | null {
  try {
    return store.getItem(key);
  } catch {
    return null;
  }
}

export function writeStored(store: StorageLike, value: string, key: string = SESSION_KEY): "ok" | "full" {
  try {
    store.setItem(key, value);
    return "ok";
  } catch {
    return "full";
  }
}

export const SESSION_SCRIPT = `(() => {
  const KEY = '${SESSION_KEY}';
  const notice = msg => {
    let el = document.getElementById('sessionNotice');
    if (!el) {
      el = document.createElement('div');
      el.id = 'sessionNotice';
      el.className = 'tree-notice';
      el.setAttribute('role', 'status');
      const main = document.querySelector('main.page');
      if (main) main.prepend(el); else document.body.prepend(el);
    }
    el.textContent = msg;
  };
  const storeFile = file => new Promise(resolve => {
    const fr = new FileReader();
    fr.onload = () => {
      try { localStorage.setItem(KEY, fr.result); resolve(true); }
      catch { resolve(false); }
    };
    fr.onerror = () => resolve(false);
    fr.readAsDataURL(file);
  });
  // Import forms: keep the raw file in this browser, then go to the explorer.
  document.querySelectorAll('form[action="/import"]').forEach(form => {
    form.addEventListener('submit', async ev => {
      const input = form.querySelector('input[type=file]');
      const file = input && input.files && input.files[0];
      if (!file) return;
      ev.preventDefault();
      const fd = new FormData(form);
      let res;
      try {
        res = await fetch(form.action, { method: 'POST', body: fd, redirect: 'follow' });
      } catch {
        notice('Import failed. Check your connection and try again.');
        return;
      }
      if (!res.ok) {
        notice('Import failed. This file could not be read.');
        return;
      }
      const saved = await storeFile(file);
      if (!saved) {
        notice('Browser storage is full. The tree opened, but it will not be restored after a restart.');
      }
      location.href = res.url || '/';
    });
  });
  // Restore: if the server lost the tree, re-send the stored file.
  fetch('/api/status').then(r => r.json()).then(status => {
    if (!status || status.tree) return;
    let dataUrl = null;
    try { dataUrl = localStorage.getItem(KEY); } catch { return; }
    if (!dataUrl) return;
    fetch(dataUrl)
      .then(r => r.blob())
      .then(blob => {
        const fd = new FormData();
        fd.append('file', new File([blob], 'restored.ged', { type: 'text/plain' }));
        return fetch('/import', { method: 'POST', body: fd, redirect: 'follow' });
      })
      .then(res => { if (res && res.ok) location.href = res.url || '/'; })
      .catch(() => notice('We could not restore your file. Drop it on the home screen again.'));
  }).catch(() => {});
})();
`;
