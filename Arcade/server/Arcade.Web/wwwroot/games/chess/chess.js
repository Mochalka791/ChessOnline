import { apiGet, apiPost } from '../../js/shared/api.js';
import { showToast } from '../../js/shared/ui.js';

const unicodeMap = {
  p: { white: '♙', black: '♟' },
  r: { white: '♖', black: '♜' },
  n: { white: '♘', black: '♞' },
  b: { white: '♗', black: '♝' },
  q: { white: '♕', black: '♛' },
  k: { white: '♔', black: '♚' }
};

let currentState = null;
let selected = null;

export function initChess(root) {
  const board = root.querySelector('#chess-board');
  const moveList = root.querySelector('#move-list');
  const statusEl = root.querySelector('#chess-status');
  const analysisDepth = root.querySelector('#analysis-depth');
  const analysisDepthValue = root.querySelector('#analysis-depth-value');
  const analysisOutput = root.querySelector('#analysis-output');
  const analyzeBtn = root.querySelector('#analyze-btn');

  analysisDepth.addEventListener('input', () => {
    analysisDepthValue.textContent = analysisDepth.value;
  });

  board.addEventListener('click', (event) => {
    const square = event.target.closest('.chess-square');
    if (!square || !currentState) {
      return;
    }

    const coord = square.dataset.coord;
    if (!selected) {
      selected = coord;
      updateSelection(board);
    } else {
      const move = `${selected}${coord}`;
      selected = null;
      updateSelection(board);
      submitMove(move);
    }
  });

  analyzeBtn.addEventListener('click', async () => {
    if (!currentState) {
      return;
    }
    analyzeBtn.disabled = true;
    analysisOutput.textContent = 'Analyse läuft…';
    try {
      const depth = Number.parseInt(analysisDepth.value, 10);
      const data = await apiGet(`/api/chess/analyze?roomId=${currentState.gameId.value}&depth=${depth}`);
      analysisOutput.textContent = formatAnalysis(data);
    } catch (error) {
      analysisOutput.textContent = error.message;
      showToast(`Analyse fehlgeschlagen: ${error.message}`, { variant: 'error' });
    } finally {
      analyzeBtn.disabled = false;
    }
  });

  async function submitMove(uci) {
    try {
      const updated = await apiPost('/api/chess/move', { roomId: currentState.gameId.value, move: uci });
      applyState(updated);
    } catch (error) {
      showToast(error.message, { variant: 'error' });
    }
  }

  function updateSelection(boardRoot) {
    boardRoot.querySelectorAll('.chess-square').forEach((square) => {
      square.classList.toggle('is-selected', square.dataset.coord === selected);
    });
  }

  function renderBoard(state) {
    board.innerHTML = '';
    const rows = state.fen.split(' ')[0].split('/');
    for (let rank = 0; rank < 8; rank++) {
      const row = rows[rank];
      let file = 0;
      for (const char of row) {
        const square = document.createElement('div');
        square.className = 'chess-square';
        const isLight = (file + rank) % 2 === 0;
        square.classList.add(isLight ? 'chess-square--light' : 'chess-square--dark');
        const coord = `${String.fromCharCode(97 + file)}${8 - rank}`;
        square.dataset.coord = coord;
        const cell = document.createElement('div');
        cell.className = 'chess-square__content';
        if (Number.isInteger(Number(char))) {
          file += Number(char);
          square.appendChild(cell);
          board.appendChild(square);
          continue;
        }

        const piece = unicodeMap[char.toLowerCase()];
        if (piece) {
          cell.textContent = char === char.toUpperCase() ? piece.white : piece.black;
        }
        square.appendChild(cell);
        board.appendChild(square);
        file++;
      }
    }
  }

  function renderMoves(state) {
    moveList.innerHTML = '';
    state.moves.forEach((entry) => {
      const item = document.createElement('li');
      item.textContent = entry;
      moveList.appendChild(item);
    });
  }

  function formatStatus(state) {
    const turn = state.activeColor === 'White' || state.activeColor === 0 ? 'Weiß' : 'Schwarz';
    return `${turn} am Zug${state.inCheck ? ' – Schach!' : ''}`;
  }

  function formatAnalysis(data) {
    const parts = [];
    if (data.bestMove) {
      parts.push(`Bester Zug: ${data.bestMove}`);
    }
    if (typeof data.centipawns === 'number') {
      parts.push(`Bewertung: ${(data.centipawns / 100).toFixed(2)} cp`);
    }
    if (typeof data.mate === 'number') {
      parts.push(`Matt in ${data.mate}`);
    }
    if (data.principalVariation?.length) {
      parts.push(`PV: ${data.principalVariation.join(' ')}`);
    }
    return parts.join('\n');
  }

  function applyState(state) {
    currentState = state;
    renderBoard(state);
    renderMoves(state);
    statusEl.textContent = formatStatus(state);
  }

  async function bootstrap() {
    try {
      const state = await apiPost('/api/chess/new', { roomId: null });
      applyState(state);
    } catch (error) {
      showToast(`Initialisierung fehlgeschlagen: ${error.message}`, { variant: 'error' });
    }
  }

  bootstrap();

  return {
    debug: {
      'Force Win': async () => {
        await apiPost('/api/chess/dev/force-win', { roomId: currentState?.gameId.value });
        showToast('Ergebnis gesetzt.');
      },
      Reset: async () => {
        await apiPost('/api/chess/dev/reset', { roomId: currentState?.gameId.value });
        const state = await apiGet(`/api/chess/state?roomId=${currentState?.gameId.value}`);
        applyState(state);
      }
    },
    tests: {
      forceWin: () => apiPost('/api/chess/dev/force-win', { roomId: currentState?.gameId.value }),
      forceLose: () => apiPost('/api/chess/dev/force-lose', { roomId: currentState?.gameId.value }),
      forceDraw: () => apiPost('/api/chess/dev/force-draw', { roomId: currentState?.gameId.value }),
      resetGame: () => apiPost('/api/chess/dev/reset', { roomId: currentState?.gameId.value }),
      runAnalyze: () => apiGet(`/api/chess/dev/analyze?roomId=${currentState?.gameId.value}&depth=${analysisDepth.value}`)
    }
  };
}
