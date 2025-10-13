import { apiPost } from '../../js/shared/api.js';
import { showToast } from '../../js/shared/ui.js';

let roomId = null;

export function initBlockwood(root) {
  const statusEl = root.querySelector('#blockwood-status');
  const movesEl = root.querySelector('#blockwood-moves');
  const targetEl = root.querySelector('#blockwood-target');
  const moveBtn = root.querySelector('#blockwood-move');
  const resetBtn = root.querySelector('#blockwood-reset');

  moveBtn.addEventListener('click', async () => {
    const state = await apiPost('/api/blockwood/move', { roomId });
    applyState(state);
  });

  resetBtn.addEventListener('click', async () => {
    const state = await apiPost('/api/blockwood/reset', { roomId });
    applyState(state);
  });

  function applyState(state) {
    roomId = state.gameId.value;
    movesEl.textContent = state.moves;
    targetEl.textContent = state.targetMoves;
    statusEl.textContent = state.solved ? 'Puzzle gelöst!' : `Züge: ${state.moves}`;
  }

  async function bootstrap() {
    try {
      const state = await apiPost('/api/blockwood/new', { roomId });
      applyState(state);
    } catch (error) {
      showToast(`Blockwood konnte nicht geladen werden: ${error.message}`, { variant: 'error' });
    }
  }

  bootstrap();

  return {
    debug: {
      Move: () => apiPost('/api/blockwood/move', { roomId })
    },
    tests: {
      forceWin: () => apiPost('/api/blockwood/dev/force-win', { roomId }),
      forceLose: () => apiPost('/api/blockwood/dev/force-lose', { roomId }),
      forceDraw: () => apiPost('/api/blockwood/dev/force-draw', { roomId }),
      resetGame: () => apiPost('/api/blockwood/dev/reset', { roomId })
    }
  };
}
