import { apiGet, apiPost } from '../../js/shared/api.js';
import { showToast } from '../../js/shared/ui.js';

let roomId = null;

export function initTetris(root) {
  const statusEl = root.querySelector('#tetris-status');
  const levelEl = root.querySelector('#tetris-level');
  const scoreEl = root.querySelector('#tetris-score');
  const linesEl = root.querySelector('#tetris-lines');
  const tickBtn = root.querySelector('#tetris-tick');
  const resetBtn = root.querySelector('#tetris-reset');

  root.querySelectorAll('[data-action]').forEach((button) => {
    button.addEventListener('click', async () => {
      await performMove(button.dataset.action);
    });
  });

  tickBtn.addEventListener('click', async () => {
    await performTick();
  });

  resetBtn.addEventListener('click', async () => {
    await resetGame();
  });

  async function performTick() {
    const state = await apiPost('/api/tetris/tick', { roomId });
    applyState(state);
  }

  async function performMove(action) {
    const state = await apiPost('/api/tetris/move', { roomId, action });
    applyState(state);
  }

  async function resetGame() {
    const state = await apiPost('/api/tetris/reset', { roomId });
    applyState(state);
  }

  function applyState(state) {
    roomId = state.gameId.value;
    levelEl.textContent = state.level;
    scoreEl.textContent = state.score;
    linesEl.textContent = state.linesCleared;
    statusEl.textContent = `Level ${state.level} – ${state.linesCleared} Linien`;
  }

  async function bootstrap() {
    try {
      const state = await apiPost('/api/tetris/new', { roomId });
      applyState(state);
    } catch (error) {
      showToast(`Tetris konnte nicht geladen werden: ${error.message}`, { variant: 'error' });
    }
  }

  bootstrap();

  return {
    debug: {
      Tick: performTick
    },
    tests: {
      forceWin: () => apiPost('/api/tetris/dev/force-win', { roomId }),
      forceLose: () => apiPost('/api/tetris/dev/force-lose', { roomId }),
      forceDraw: () => apiPost('/api/tetris/dev/force-draw', { roomId }),
      resetGame: () => apiPost('/api/tetris/dev/reset', { roomId })
    }
  };
}
