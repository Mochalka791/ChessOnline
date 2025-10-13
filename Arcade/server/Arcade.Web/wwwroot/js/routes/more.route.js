import { createPlaceholderCard, createSection } from '../shared/ui.js';

export async function renderMore() {
  const grid = document.createElement('div');
  grid.className = 'arcade-card-grid';
  grid.appendChild(createPlaceholderCard('Weitere Modi werden bald verfügbar sein. Bleib dran!'));
  return createSection({
    title: 'Mehr Spiele',
    subtitle: 'Wir arbeiten an zusätzlichen Retro- und Puzzle-Erlebnissen.',
    content: grid
  });
}
