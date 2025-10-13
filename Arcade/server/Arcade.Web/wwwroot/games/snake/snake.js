import { apiGet, apiPost } from '../../js/shared/api.js';
import { showToast } from '../../js/shared/ui.js';

let roomId = null;

export function initSnake(root) {
  const statusEl = root.querySelector('#snake-status');
  const scoreEl = root.querySelector('#snake-score');
  const aliveEl = root.querySelector('#snake-alive');

  root.querySelectorAll('[data-direction]').forEach((button) => {
    button.addEventListener('click', async () => {
      await move(button.dataset.direction);
    });
  });

  root.querySelector('#snake-reset').addEventListener('click', async () => {
    await reset();
  });

  async function move(direction) {
    const state = await apiPost('/api/snake/move', { roomId, direction });
    applyState(state);
  }

  async function reset() {
    const state = await apiPost('/api/snake/reset', { roomId });
    applyState(state);
  }

  function applyState(state) {
    roomId = state.gameId.value;
    scoreEl.textContent = state.score;
    aliveEl.textContent = state.alive ? 'Ja' : 'Nein';
    statusEl.textContent = `Score: ${state.score}`;
  }

  async function bootstrap() {
    try {
      const state = await apiPost('/api/snake/new', { roomId });
      applyState(state);
    } catch (error) {
      showToast(`Snake konnte nicht geladen werden: ${error.message}`, { variant: 'error' });
    }
  }

  bootstrap();

  return {
    debug: {
      Tick: () => move('Up')
    },
    tests: {
      forceWin: () => apiPost('/api/snake/dev/force-win', { roomId }),
      forceLose: () => apiPost('/api/snake/dev/force-lose', { roomId }),
      forceDraw: () => apiPost('/api/snake/dev/force-draw', { roomId }),
      resetGame: () => apiPost('/api/snake/dev/reset', { roomId })
    }
  };
}
