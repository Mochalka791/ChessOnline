export function createSection({ title, subtitle, content }) {
  const wrapper = document.createElement('section');
  if (title) {
    const heading = document.createElement('h1');
    heading.className = 'section-title';
    heading.textContent = title;
    wrapper.appendChild(heading);
  }

  if (subtitle) {
    const sub = document.createElement('p');
    sub.className = 'section-subtitle';
    sub.textContent = subtitle;
    wrapper.appendChild(sub);
  }

  if (content) {
    wrapper.appendChild(content);
  }

  return wrapper;
}

export function createCard({ title, description, actions = [], meta }) {
  const card = document.createElement('article');
  card.className = 'arcade-card';

  const heading = document.createElement('div');
  heading.className = 'arcade-card__title';
  heading.textContent = title;
  card.appendChild(heading);

  if (meta) {
    const metaEl = document.createElement('div');
    metaEl.className = 'arcade-card__meta';
    metaEl.textContent = meta;
    card.appendChild(metaEl);
  }

  if (description) {
    const desc = document.createElement('p');
    desc.className = 'arcade-card__meta';
    desc.textContent = description;
    card.appendChild(desc);
  }

  if (actions.length) {
    const actionsEl = document.createElement('div');
    actionsEl.className = 'arcade-card__actions';
    actions.forEach((action) => {
      const button = document.createElement(action.tag ?? 'button');
      button.className = action.className ?? 'btn btn-outline';
      button.textContent = action.label;
      if (action.href) {
        button.setAttribute('href', action.href);
      }
      if (typeof action.onClick === 'function') {
        button.addEventListener('click', action.onClick);
      }
      actionsEl.appendChild(button);
    });
    card.appendChild(actionsEl);
  }

  return card;
}

const toastContainer = document.getElementById('toast-container');

export function showToast(message, { variant = 'info', timeout = 4000 } = {}) {
  const toast = document.createElement('div');
  toast.className = `toast toast--${variant}`;
  toast.innerHTML = `<span>${message}</span>`;
  toastContainer.appendChild(toast);

  setTimeout(() => {
    toast.remove();
  }, timeout);
}

export function createPlaceholderCard(text) {
  const card = document.createElement('article');
  card.className = 'arcade-card placeholder-card';
  card.textContent = text;
  return card;
}

export function createSpinner() {
  const el = document.createElement('div');
  el.className = 'spinner';
  return el;
}
