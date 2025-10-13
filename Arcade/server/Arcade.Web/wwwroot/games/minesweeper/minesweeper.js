import { apiPost } from '../../js/shared/api.js';
import { showToast } from '../../js/shared/ui.js';

let roomId = null;

export function initMinesweeper(root) {
  const board = root.querySelector('#mines-board');
  const statusEl = root.querySelector('#mines-status');
  const rowInput = root.querySelector('#mines-row');
  const columnInput = root.querySelector('#mines-column');
  const revealBtn = root.querySelector('#mines-reveal');
  const resetBtn = root.querySelector('#mines-reset');

  revealBtn.addEventListener('click', async () => {
    try {
      const row = Number(rowInput.value) - 1;
      const column = Number(columnInput.value) - 1;
      const state = await apiPost('/api/minesweeper/reveal', { roomId, row, column });
      applyState(state);
    } catch (error) {
      showToast(error.message, { variant: 'error' });
    }
  });

  resetBtn.addEventListener('click', async () => {
    const state = await apiPost('/api/minesweeper/reset', { roomId });
    applyState(state);
  });

  function renderBoard(state) {
    board.innerHTML = '';
    state.revealed.forEach((row, r) => {
      row.forEach((visible, c) => {
        const cell = document.createElement('div');
        cell.className = 'mines-cell';
        cell.textContent = visible ? state.cells[r][c] : '';
        board.appendChild(cell);
      });
    });
  }

  function applyState(state) {
    roomId = state.gameId.value;
    renderBoard(state);
    if (state.gameOver) {
      statusEl.textContent = state.won ? 'Alle Felder aufgedeckt!' : 'Mine getroffen!';
    } else {
      statusEl.textContent = 'Felder aufdecken und Minen meiden.';
    }
  }

  async function bootstrap() {
    try {
      const state = await apiPost('/api/minesweeper/new', { roomId });
      applyState(state);
    } catch (error) {
      showToast(`Minesweeper konnte nicht geladen werden: ${error.message}`, { variant: 'error' });
    }
  }

  bootstrap();

  return {
    debug: {},
    tests: {
      forceWin: () => apiPost('/api/minesweeper/dev/force-win', { roomId }),
      forceLose: () => apiPost('/api/minesweeper/dev/force-lose', { roomId }),
      forceDraw: () => apiPost('/api/minesweeper/dev/force-draw', { roomId }),
      resetGame: () => apiPost('/api/minesweeper/dev/reset', { roomId })
    }
  };
}
