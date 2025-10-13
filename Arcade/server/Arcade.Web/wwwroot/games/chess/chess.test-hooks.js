import { apiPost, apiGet } from '../../js/shared/api.js';

export const chessTestHooks = {
  forceWin: (roomId) => apiPost('/api/chess/dev/force-win', { roomId }),
  forceLose: (roomId) => apiPost('/api/chess/dev/force-lose', { roomId }),
  forceDraw: (roomId) => apiPost('/api/chess/dev/force-draw', { roomId }),
  resetGame: (roomId) => apiPost('/api/chess/dev/reset', { roomId }),
  runAnalyze: (roomId, depth) => apiGet(`/api/chess/dev/analyze?roomId=${roomId}&depth=${depth}`)
};
