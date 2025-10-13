import { createCard, createSection } from '../shared/ui.js';

export async function renderHome() {
  const grid = document.createElement('div');
  grid.className = 'arcade-card-grid';

  grid.appendChild(
    createCard({
      title: 'Starte dein Match',
      description: 'Fordere Stockfish heraus oder spiele gegen Freunde in der Echtzeit-Lobby.',
      actions: [
        { tag: 'a', className: 'btn btn-primary', label: 'Jetzt spielen', href: '#/games/chess' },
        { tag: 'a', className: 'btn btn-outline', label: 'Alle Spiele', href: '#/games' }
      ]
    })
  );

  grid.appendChild(
    createCard({
      title: 'Debug-Modus',
      description: 'Aktiviere das Debug-Panel, um Szenarien für Tests nachzustellen.',
      actions: [
        {
          className: 'btn btn-outline',
          label: 'Hooks anzeigen',
          onClick: () => {
            const panel = document.getElementById('debug-panel');
            panel.hidden = !panel.hidden;
          }
        }
      ]
    })
  );

  return createSection({
    title: 'Willkommen in der Arcade',
    subtitle: 'Eine Sammlung moderner Browser-Games mit gemeinsamer Oberfläche und Analyse-Tools.',
    content: grid
  });
}
