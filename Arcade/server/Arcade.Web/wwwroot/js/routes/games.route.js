import { createCard, createSection } from '../shared/ui.js';

const games = [
  {
    key: 'chess',
    title: 'Chess',
    description: 'Analyse, Stockfish und Echtzeit-Bots über SignalR.',
    href: '#/games/chess'
  },
  {
    key: 'tetris',
    title: 'Tetris',
    description: 'Droppe Blöcke, cleare Reihen und steigere dein Level.',
    href: '#/games/tetris'
  },
  {
    key: 'snake',
    title: 'Snake',
    description: 'Wachse durch Food, meide Kollisionen und sichere den Highscore.',
    href: '#/games/snake'
  },
  {
    key: 'blockwood',
    title: 'Blockwood',
    description: 'Schiebe Blöcke ins Ziel – Puzzle für Strateg:innen.',
    href: '#/games/blockwood'
  },
  {
    key: 'sudoku',
    title: 'Sudoku',
    description: 'Logikrätsel mit Validator und Solver-Unterstützung.',
    href: '#/games/sudoku'
  },
  {
    key: 'minesweeper',
    title: 'Minesweeper',
    description: 'Finde Minen mit smarter Aufdeckung und Schnell-Reset.',
    href: '#/games/minesweeper'
  }
];

export async function renderGames() {
  const grid = document.createElement('div');
  grid.className = 'arcade-card-grid';

  games.forEach((game) => {
    grid.appendChild(
      createCard({
        title: game.title,
        description: game.description,
        actions: [
          { tag: 'a', className: 'btn btn-primary', label: 'Starten', href: game.href }
        ]
      })
    );
  });

  return createSection({
    title: 'Alle Spiele',
    subtitle: 'Wähle deinen Modus und starte direkt im Browser.',
    content: grid
  });
}
