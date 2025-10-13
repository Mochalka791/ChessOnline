import { createSection } from '../shared/ui.js';

export async function renderAbout() {
  const content = document.createElement('div');
  content.className = 'arcade-card-grid';

  const paragraph = document.createElement('p');
  paragraph.className = 'arcade-card__meta';
  paragraph.textContent = 'Arcade ist eine modulare SPA auf .NET 9 Basis. Backend-Features werden als eigenständige Module eingebunden und teilen sich eine einheitliche Shell.';

  content.appendChild(paragraph);

  return createSection({
    title: 'Über das Projekt',
    subtitle: 'Technologie-Stack: .NET 9, Minimal APIs, SignalR, Vanilla JS.',
    content
  });
}
