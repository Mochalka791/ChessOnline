import { registerDebugHooks } from '../shared/debug.js';
import { registerTestHooks } from '../shared/test-hooks.js';

const STYLE_KEY = '/games/snake/snake.css';

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

export async function renderSnake() {
  ensureStylesheet(STYLE_KEY);
  const view = await fetch('/games/snake/view.html').then((r) => r.text());
  const template = document.createElement('template');
  template.innerHTML = view.trim();
  const content = template.content.cloneNode(true);
  const root = document.createElement('div');
  root.appendChild(content);

  const module = await import('../games/snake/snake.js');
  const hooks = module.initSnake(root);
  registerDebugHooks('Snake', hooks?.debug ?? null);
  registerTestHooks('Snake', hooks?.tests ?? null);

  return root;
}
