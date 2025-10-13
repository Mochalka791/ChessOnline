import { registerDebugHooks } from '../shared/debug.js';
import { registerTestHooks } from '../shared/test-hooks.js';

const STYLE_KEY = '/games/blockwood/blockwood.css';

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

export async function renderBlockwood() {
  ensureStylesheet(STYLE_KEY);
  const view = await fetch('/games/blockwood/view.html').then((r) => r.text());
  const template = document.createElement('template');
  template.innerHTML = view.trim();
  const content = template.content.cloneNode(true);
  const root = document.createElement('div');
  root.appendChild(content);

  const module = await import('../games/blockwood/blockwood.js');
  const hooks = module.initBlockwood(root);
  registerDebugHooks('Blockwood', hooks?.debug ?? null);
  registerTestHooks('Blockwood', hooks?.tests ?? null);

  return root;
}
