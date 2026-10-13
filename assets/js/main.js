/* ===== Utility: Load JSON ===== */
async function loadJSON(url) {
  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`Failed to load ${url}: ${resp.status}`);
  return resp.json();
}

/* ===== Base path ===== */
function getBasePath() {
  return window.location.pathname.includes('/pages/') ? '../' : './';
}

/* ===== Dark mode ===== */
function initTheme() {
  let stored = null;
  try { stored = localStorage.getItem('theme'); } catch (e) { /* ignore */ }
  if (stored === 'dark' || stored === 'light') {
    document.documentElement.setAttribute('data-theme', stored);
  } else if (window.matchMedia?.('(prefers-color-scheme: dark)').matches) {
    document.documentElement.setAttribute('data-theme', 'dark');
  }
}

function toggleTheme() {
  const current = document.documentElement.getAttribute('data-theme');
  const next = current === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', next);
  try { localStorage.setItem('theme', next); } catch (e) { /* ignore */ }
  updateThemeIcon(next);
}

function updateThemeIcon(theme) {
  const btn = document.getElementById('theme-toggle');
  if (!btn) return;
  btn.innerHTML = theme === 'dark'
    ? `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>`
    : `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>`;
}

/* ===== SVG icons for pills ===== */
function svgIcon(type) {
  const icons = {
    paper: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>`,
    code: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>`,
    demo: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polygon points="10 8 16 12 10 16 10 8"/></svg>`,
    model: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>`,
    data: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/></svg>`
  };
  return icons[type] || '';
}

/* ===== Format number ===== */
function formatNumber(n) {
  if (n == null) return '—';
  if (n >= 1e9) return (n / 1e9).toFixed(1).replace(/\.0$/, '') + 'B';
  if (n >= 1e6) return (n / 1e6).toFixed(1).replace(/\.0$/, '') + 'M';
  if (n >= 1e3) return (n / 1e3).toFixed(1).replace(/\.0$/, '') + 'K';
  return n.toString();
}

/* ===== Search ===== */
function setupSearch(inputId, callback) {
  const input = document.getElementById(inputId);
  if (!input) return;
  let timer;
  input.addEventListener('input', () => {
    clearTimeout(timer);
    timer = setTimeout(() => callback(input.value.toLowerCase().trim()), 200);
  });
}

/* ===== Table sort ===== */
function setupTableSort(tableId) {
  const table = document.getElementById(tableId);
  if (!table) return;
  const headers = table.querySelectorAll('th[data-sort]');
  let current = { col: null, asc: true };

  headers.forEach(th => {
    th.addEventListener('click', () => {
      const col = th.dataset.sort;
      const type = th.dataset.type || 'string';
      current = { col, asc: current.col === col ? !current.asc : true };

      headers.forEach(h => h.classList.remove('sorted'));
      th.classList.add('sorted');

      const tbody = table.querySelector('tbody');
      const rows = Array.from(tbody.querySelectorAll('tr'));
      const ci = Array.from(th.parentNode.children).indexOf(th);

      rows.sort((a, b) => {
        let va = a.children[ci]?.textContent.trim() || '';
        let vb = b.children[ci]?.textContent.trim() || '';
        if (type === 'number') {
          va = parseFloat(va.replace(/[^0-9.-]/g, '')) || 0;
          vb = parseFloat(vb.replace(/[^0-9.-]/g, '')) || 0;
        } else {
          va = va.toLowerCase(); vb = vb.toLowerCase();
        }
        if (va < vb) return current.asc ? -1 : 1;
        if (va > vb) return current.asc ? 1 : -1;
        return 0;
      });
      rows.forEach(r => tbody.appendChild(r));

      const arrow = th.querySelector('.sort-arrow');
      if (arrow) arrow.textContent = current.asc ? '▲' : '▼';
    });
  });
}

/* ===== Filter tabs ===== */
function setupFilterTabs(containerId, callback) {
  const el = document.getElementById(containerId);
  if (!el) return;
  el.addEventListener('click', e => {
    const tab = e.target.closest('.filter-tab');
    if (!tab) return;
    el.querySelectorAll('.filter-tab').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    callback(tab.dataset.filter);
  });
}

/* ===== Header ===== */
function renderHeader() {
  const base = getBasePath();
  const page = window.location.pathname.split('/').pop() || 'index.html';

  const links = [
    { href: `${base}index.html`, label: 'Home', page: 'index.html' },
    { href: `${base}pages/languages.html`, label: 'Languages', page: 'languages.html' },
    { href: `${base}pages/scripts.html`, label: 'Scripts', page: 'scripts.html' },
    { href: 'https://github.com/cisnlp', label: 'GitHub', ext: true }
  ];

  const theme = document.documentElement.getAttribute('data-theme') || 'light';

  const header = document.createElement('header');
  header.className = 'site-header';
  header.innerHTML = `
    <div class="wrap">
      <a href="${base}index.html" class="site-logo">
        <img src="${base}assets/img/glotsuite-mark.svg" alt="" width="28" height="28">
        <span>CommonGlot</span>
      </a>
      <ul class="nav-links" id="nav-links">
        ${links.map(l => {
          const active = !l.ext && page === l.page ? ' class="active"' : '';
          const ext = l.ext ? ' target="_blank" rel="noopener"' : '';
          return `<li><a href="${l.href}"${active}${ext}>${l.label}</a></li>`;
        }).join('')}
      </ul>
      <div class="nav-actions">
        <button class="theme-btn" id="theme-toggle" type="button" aria-label="Toggle dark mode">
          ${theme === 'dark'
            ? `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>`
            : `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>`}
        </button>
        <button class="hamburger" id="nav-hamburger" type="button" aria-label="Toggle menu" aria-expanded="false">
          <span></span><span></span><span></span>
        </button>
      </div>
    </div>
  `;
  document.body.prepend(header);

  const hamburger = document.getElementById('nav-hamburger');
  const navLinks = document.getElementById('nav-links');

  hamburger.addEventListener('click', () => {
    const open = hamburger.classList.toggle('open');
    hamburger.setAttribute('aria-expanded', open);
    navLinks.classList.toggle('open', open);
    document.body.style.overflow = open ? 'hidden' : '';
  });

  navLinks.querySelectorAll('a').forEach(a => {
    a.addEventListener('click', () => {
      hamburger.classList.remove('open');
      hamburger.setAttribute('aria-expanded', 'false');
      navLinks.classList.remove('open');
      document.body.style.overflow = '';
    });
  });

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && hamburger.classList.contains('open')) {
      hamburger.classList.remove('open');
      hamburger.setAttribute('aria-expanded', 'false');
      navLinks.classList.remove('open');
      document.body.style.overflow = '';
    }
  });

  document.getElementById('theme-toggle').addEventListener('click', toggleTheme);
}

/* ===== Footer ===== */
function renderFooter() {
  const footer = document.createElement('footer');
  footer.className = 'site-footer';
  const base = getBasePath();
  footer.innerHTML = `
    <div class="wrap">
      &copy; ${new Date().getFullYear()} CommonGlot &middot;
      <a href="https://www.cis.lmu.de/" target="_blank" rel="noopener">CIS-LMU Munich</a> &middot;
      <a href="https://www.sorbonne-universite.fr/" target="_blank" rel="noopener">Sorbonne Universit&eacute;</a>
      <span class="footer-legal">
        &middot; <a href="${base}pages/privacy.html">Privacy</a>
        &middot; <a href="${base}pages/terms.html">Terms</a>
      </span>
    </div>
  `;
  document.body.appendChild(footer);
}

/* ===== Init ===== */
initTheme();
document.addEventListener('DOMContentLoaded', () => {
  renderHeader();
  renderFooter();
});
