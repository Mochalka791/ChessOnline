import { apiPost } from '../../js/shared/api.js';
import { showToast } from '../../js/shared/ui.js';

let roomId = null;
let grid = [];

export function initSudoku(root) {
  const board = root.querySelector('#sudoku-board');
  const statusEl = root.querySelector('#sudoku-status');
  const rowInput = root.querySelector('#sudoku-row');
  const colInput = root.querySelector('#sudoku-column');
  const valueInput = root.querySelector('#sudoku-value');
  const validateBtn = root.querySelector('#sudoku-validate');
  const resetBtn = root.querySelector('#sudoku-reset');

  validateBtn.addEventListener('click', async () => {
    try {
      const row = Number(rowInput.value) - 1;
      const column = Number(colInput.value) - 1;
      const value = Number(valueInput.value);
      const state = await apiPost('/api/sudoku/validate', { roomId, row, column, value });
      applyState(state);
    } catch (error) {
      showToast(error.message, { variant: 'error' });
    }
  });

  resetBtn.addEventListener('click', async () => {
    const state = await apiPost('/api/sudoku/reset', { roomId });
    applyState(state);
  });

  function renderBoard(state) {
    grid = state.cells;
    board.innerHTML = '';
    grid.forEach((row) => {
      row.forEach((value) => {
        const cell = document.createElement('div');
        cell.className = 'sudoku-cell';
        if (value !== 0) {
          cell.textContent = value;
          cell.classList.add('is-fixed');
        } else {
          cell.textContent = '';
        }
        board.appendChild(cell);
      });
    });
  }

  function applyState(state) {
    roomId = state.gameId.value;
    renderBoard(state);
    statusEl.textContent = state.solved ? 'Sudoku gelöst!' : 'Setze weitere Werte.';
  }

  async function bootstrap() {
    try {
      const state = await apiPost('/api/sudoku/new', { roomId });
      applyState(state);
    } catch (error) {
      showToast(`Sudoku konnte nicht geladen werden: ${error.message}`, { variant: 'error' });
    }
  }

  bootstrap();

  return {
    debug: {},
    tests: {
      forceWin: () => apiPost('/api/sudoku/dev/force-win', { roomId }),
      forceLose: () => apiPost('/api/sudoku/dev/force-lose', { roomId }),
      forceDraw: () => apiPost('/api/sudoku/dev/force-draw', { roomId }),
      resetGame: () => apiPost('/api/sudoku/dev/reset', { roomId })
    }
  };
}
