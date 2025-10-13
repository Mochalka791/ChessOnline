import { registerRoute, registerNotFound, startRouter } from './shared/router.js';
import { createPlaceholderCard, createSection } from './shared/ui.js';
import { renderHome } from './routes/home.route.js';
import { renderGames } from './routes/games.route.js';
import { renderAbout } from './routes/about.route.js';
import { renderMore } from './routes/more.route.js';
import { renderChess } from './routes/chess.route.js';
import { renderTetris } from './routes/tetris.route.js';
import { renderSnake } from './routes/snake.route.js';
import { renderBlockwood } from './routes/blockwood.route.js';
import { renderSudoku } from './routes/sudoku.route.js';
import { renderMinesweeper } from './routes/minesweeper.route.js';

const appRoot = document.getElementById('app');

registerRoute('#/', renderHome);
registerRoute('#/games', renderGames);
registerRoute('#/about', renderAbout);
registerRoute('#/more', renderMore);
registerRoute('#/games/chess', renderChess);
registerRoute('#/games/tetris', renderTetris);
registerRoute('#/games/snake', renderSnake);
registerRoute('#/games/blockwood', renderBlockwood);
registerRoute('#/games/sudoku', renderSudoku);
registerRoute('#/games/minesweeper', renderMinesweeper);

registerNotFound(() => {
  const grid = document.createElement('div');
  grid.className = 'arcade-card-grid';
  grid.appendChild(createPlaceholderCard('Seite wurde nicht gefunden.'));
  return createSection({ title: '404', subtitle: 'Diese Route existiert nicht.', content: grid });
});

if (!window.location.hash) {
  window.location.hash = '#/';
}

startRouter(appRoot);
