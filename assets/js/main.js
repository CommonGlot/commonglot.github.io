/* ===== Utility: Load JSON ===== */
async function loadJSON(url) {
  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`Failed to load ${url}: ${resp.status}`);
  return resp.json();
}

/* ===== Determine base path ===== */
function getBasePath() {
  const path = window.location.pathname;
  if (path.includes('/pages/')) return '../';
  return './';
}

/* ===== Navigation ===== */
function renderNav() {
  const base = getBasePath();
  const isSubpage = base === '../';
  const currentPage = window.location.pathname.split('/').pop() || 'index.html';

  const links = [
    { href: `${base}index.html`, label: 'Home', page: 'index.html' },
    { href: `${base}pages/projects.html`, label: 'Projects', page: 'projects.html' },
    { href: `${base}pages/languages.html`, label: 'Languages', page: 'languages.html' },
    { href: `${base}pages/scripts.html`, label: 'Scripts', page: 'scripts.html' },
    { href: `${base}pages/glotsuite.html`, label: 'GlotSuite', page: 'glotsuite.html' },
    { href: `${base}pages/about.html`, label: 'About', page: 'about.html' }
  ];

  const linksHtml = links.map(l => {
    const active = currentPage === l.page ? ' class="active"' : '';
    return `<li><a href="${l.href}"${active}>${l.label}</a></li>`;
  }).join('');

  const nav = document.createElement('nav');
  nav.className = 'nav';
  nav.innerHTML = `
    <div class="nav-inner">
      <a href="${base}index.html" class="nav-logo">
        <img src="${base}assets/img/glotsuite-mark.svg" alt="GlotSuite">
        <span>CommonGlot</span>
      </a>
      <ul class="nav-links" id="nav-links">${linksHtml}</ul>
      <button class="nav-hamburger" id="nav-hamburger" aria-label="Toggle menu">
        <span></span><span></span><span></span>
      </button>
    </div>
  `;
  document.body.prepend(nav);

  const hamburger = document.getElementById('nav-hamburger');
  const navLinks = document.getElementById('nav-links');
  hamburger.addEventListener('click', () => {
    hamburger.classList.toggle('open');
    navLinks.classList.toggle('open');
  });
}

/* ===== Footer ===== */
function renderFooter() {
  const base = getBasePath();
  const footer = document.createElement('footer');
  footer.className = 'footer';
  footer.innerHTML = `
    <div class="container">
      <div class="footer-grid">
        <div>
          <h4>CommonGlot Foundation</h4>
          <p>Building open tools, corpora, and benchmarks to bring NLP technology to every language. Part of the GlotSuite initiative at CIS-LMU Munich and Sorbonne Universit&eacute;.</p>
        </div>
        <div>
          <h4>Explore</h4>
          <ul class="footer-links">
            <li><a href="${base}pages/projects.html">Projects</a></li>
            <li><a href="${base}pages/languages.html">Languages</a></li>
            <li><a href="${base}pages/scripts.html">Scripts</a></li>
            <li><a href="${base}pages/glotsuite.html">GlotSuite</a></li>
          </ul>
        </div>
        <div>
          <h4>Community</h4>
          <ul class="footer-links">
            <li><a href="https://github.com/cisnlp" target="_blank" rel="noopener">GitHub</a></li>
            <li><a href="https://huggingface.co/cis-lmu" target="_blank" rel="noopener">Hugging Face</a></li>
            <li><a href="${base}pages/about.html">About Us</a></li>
          </ul>
        </div>
        <div>
          <h4>Affiliations</h4>
          <ul class="footer-links">
            <li><a href="https://www.cis.lmu.de/" target="_blank" rel="noopener">CIS-LMU Munich</a></li>
            <li><a href="https://www.sorbonne-universite.fr/" target="_blank" rel="noopener">Sorbonne Universit&eacute;</a></li>
          </ul>
        </div>
      </div>
      <div class="footer-bottom">
        &copy; ${new Date().getFullYear()} CommonGlot Foundation. All research outputs are open-source.
      </div>
    </div>
  `;
  document.body.appendChild(footer);
}

/* ===== Format Number ===== */
function formatNumber(n) {
  if (n >= 1_000_000_000) return (n / 1_000_000_000).toFixed(1).replace(/\.0$/, '') + 'B';
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1).replace(/\.0$/, '') + 'M';
  if (n >= 1_000) return (n / 1_000).toFixed(1).replace(/\.0$/, '') + 'K';
  return n.toString();
}

/* ===== Search / Filter ===== */
function setupSearch(inputId, callback) {
  const input = document.getElementById(inputId);
  if (!input) return;
  let debounce;
  input.addEventListener('input', () => {
    clearTimeout(debounce);
    debounce = setTimeout(() => callback(input.value.toLowerCase().trim()), 200);
  });
}

/* ===== Sort Table ===== */
function setupTableSort(tableId) {
  const table = document.getElementById(tableId);
  if (!table) return;
  const headers = table.querySelectorAll('th[data-sort]');
  let currentSort = { col: null, asc: true };

  headers.forEach(th => {
    th.addEventListener('click', () => {
      const col = th.dataset.sort;
      const type = th.dataset.type || 'string';
      if (currentSort.col === col) {
        currentSort.asc = !currentSort.asc;
      } else {
        currentSort.col = col;
        currentSort.asc = true;
      }

      headers.forEach(h => h.classList.remove('sorted'));
      th.classList.add('sorted');

      const tbody = table.querySelector('tbody');
      const rows = Array.from(tbody.querySelectorAll('tr'));
      const colIndex = Array.from(th.parentNode.children).indexOf(th);

      rows.sort((a, b) => {
        let va = a.children[colIndex]?.textContent.trim() || '';
        let vb = b.children[colIndex]?.textContent.trim() || '';
        if (type === 'number') {
          va = parseFloat(va.replace(/[^0-9.-]/g, '')) || 0;
          vb = parseFloat(vb.replace(/[^0-9.-]/g, '')) || 0;
        } else {
          va = va.toLowerCase();
          vb = vb.toLowerCase();
        }
        if (va < vb) return currentSort.asc ? -1 : 1;
        if (va > vb) return currentSort.asc ? 1 : -1;
        return 0;
      });

      rows.forEach(r => tbody.appendChild(r));

      const arrow = th.querySelector('.sort-arrow');
      if (arrow) arrow.textContent = currentSort.asc ? '▲' : '▼';
    });
  });
}

/* ===== Filter Tabs ===== */
function setupFilterTabs(containerId, callback) {
  const container = document.getElementById(containerId);
  if (!container) return;
  container.addEventListener('click', e => {
    const tab = e.target.closest('.filter-tab');
    if (!tab) return;
    container.querySelectorAll('.filter-tab').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    callback(tab.dataset.filter);
  });
}

/* ===== Link icons ===== */
function linkIcon(type) {
  const icons = {
    paper: '📄',
    code: '💻',
    demo: '🚀',
    model: '🧠',
    data: '📊'
  };
  return icons[type] || '';
}

/* ===== Init nav + footer on every page ===== */
document.addEventListener('DOMContentLoaded', () => {
  renderNav();
  renderFooter();
});
