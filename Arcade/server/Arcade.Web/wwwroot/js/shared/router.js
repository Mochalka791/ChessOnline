const routes = new Map();
let notFoundHandler = null;
let currentPath = '';

export function registerRoute(path, loader) {
  routes.set(path, loader);
}

export function registerNotFound(loader) {
  notFoundHandler = loader;
}

export async function navigate(path) {
  window.location.hash = path;
}

export async function startRouter(renderTarget) {
  async function renderRoute() {
    const hash = window.location.hash || '#/';
    if (hash === currentPath) {
      return;
    }

    currentPath = hash;
    const [base, ...rest] = hash.slice(1).split('/');
    const routeKey = `#/${base}${rest.length ? '/' + rest.join('/') : ''}`;
    const loader = routes.get(routeKey) ?? routes.get(`#/${base}`);
    const handler = loader ?? notFoundHandler;

    if (!handler) {
      renderTarget.innerHTML = '<p>Keine Route gefunden.</p>';
      return;
    }

    const content = await handler({ path: routeKey, segments: [base, ...rest] });
    renderTarget.innerHTML = '';
    renderTarget.appendChild(content);
    updateActiveNav(routeKey);
  }

  window.addEventListener('hashchange', renderRoute);
  await renderRoute();
}

function updateActiveNav(routeKey) {
  document.querySelectorAll('.arcade-nav__link').forEach((link) => {
    if (link.getAttribute('href') === routeKey || (routeKey.startsWith(link.getAttribute('href')) && link.getAttribute('href') !== '#/')) {
      link.classList.add('is-active');
    } else {
      link.classList.remove('is-active');
    }
  });
}
