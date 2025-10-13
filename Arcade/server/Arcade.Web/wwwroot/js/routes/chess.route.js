import { registerDebugHooks } from '../shared/debug.js';
import { registerTestHooks } from '../shared/test-hooks.js';
import { showToast } from '../shared/ui.js';

const STYLE_KEY = '/games/chess/chess.css';

function ensureStylesheet(href) {
  if (document.querySelector(`link[data-style="${href}"]`)) {
    return;
  }
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = href;
  link.dataset.style = href;
  document.head.appendChild(link);
}

export async function renderChess() {
  ensureStylesheet(STYLE_KEY);
  const view = await fetch('/games/chess/view.html').then((r) => r.text());
  const template = document.createElement('template');
  template.innerHTML = view.trim();
  const content = template.content.cloneNode(true);
  const root = document.createElement('div');
  root.appendChild(content);

  const module = await import('../games/chess/chess.js');
  const hooks = module.initChess(root, { showToast });
  registerDebugHooks('Chess', hooks?.debug ?? null);
  registerTestHooks('Chess', hooks?.tests ?? null);

  return root;
}
