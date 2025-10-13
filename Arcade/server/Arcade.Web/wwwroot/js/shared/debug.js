import { showToast } from './ui.js';

const panel = document.getElementById('debug-panel');
const actionsHost = panel.querySelector('.debug-panel__actions');
const hooks = {};

export function registerDebugHooks(feature, map) {
  hooks[feature] = map;
  refreshPanel();
}

function refreshPanel() {
  const entries = Object.entries(hooks).filter(([, value]) => !!value);
  if (entries.length === 0) {
    panel.hidden = true;
    actionsHost.innerHTML = '';
    return;
  }

  panel.hidden = false;
  actionsHost.innerHTML = '';

  entries.forEach(([name, featureHooks]) => {
    const header = document.createElement('div');
    header.className = 'debug-panel__title';
    header.textContent = name;
    actionsHost.appendChild(header);

    Object.entries(featureHooks).forEach(([key, fn]) => {
      const btn = document.createElement('button');
      btn.className = 'btn btn-outline';
      btn.textContent = key;
      btn.addEventListener('click', async () => {
        try {
          await fn();
          showToast(`${name}: ${key} ok`);
        } catch (error) {
          console.error(error);
          showToast(`${name}: ${key} fehlgeschlagen`, { variant: 'error' });
        }
      });
      actionsHost.appendChild(btn);
    });
  });
}
