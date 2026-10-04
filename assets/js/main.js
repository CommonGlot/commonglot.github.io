/* CommonGlot shared runtime: data loading, header/footer, tabs, tables, helpers.
   Every page sets <body data-page="..."> and loads this file plus its own script. */

const CG = (() => {
  const inPages = /\/pages\//.test(location.pathname);
  const base = inPages ? '../' : './';
  const cache = new Map();

  /* ---------- data ---------- */
  function getJSON(path) {
    if (!cache.has(path)) {
      cache.set(path, fetch(base + path).then(r => {
        if (!r.ok) throw new Error(`${path}: HTTP ${r.status}`);
        return r.json();
      }));
    }
    return cache.get(path);
  }
  const data = {
    site: () => getJSON('data/site.json'),
    taxonomy: () => getJSON('data/taxonomy.json'),
    projects: () => getJSON('data/projects.json'),
    stats: () => getJSON('data/generated_stats.json'),
    scripts: () => getJSON('data/scripts.json'),
    ocrModels: () => getJSON('data/ocr_models.json'),
    languages: () => getJSON('data/languages/index.json'),
    languageDetails: iso => getJSON(`data/languages/details/${iso[0]}.json`).then(d => d[iso] || {}),
  };

  /* ---------- helpers ---------- */
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  // Tokens (colours, ids, class suffixes) from data may only contain [A-Za-z0-9_#-].
  const tok = s => String(s ?? '').replace(/[^\w#-]/g, '');
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
  // Single gate for every URL written into the page: only http(s), mailto, in-page anchors and
  // site-relative paths are allowed (blocks javascript:, data:, etc.), and the result is HTML-escaped.
  function href(h) {
    if (!h) return '#';
    h = String(h).replace(/[\u0000-\u001F\u007F]/g, '').trim();
    if (h.startsWith('#')) return esc(h);
    if (/^[a-z][a-z0-9+.-]*:/i.test(h)) {
      let u;
      try { u = new URL(h); } catch (e) { return '#'; }
      return ['http:', 'https:', 'mailto:'].includes(u.protocol) ? esc(u.href) : '#';
    }
    if (h.startsWith('//')) return '#';
    return esc(base + h.replace(/^\/+/, ''));
  }
  const isExternal = h => /^https?:/.test(h || '');
  const extAttrs = h => isExternal(h) ? ' target="_blank" rel="noopener"' : '';
  const fmt = n => n == null ? '–' : Number(n).toLocaleString('en-US');
  function compact(n) {
    if (n == null) return '–';
    if (n >= 1e9) return (n / 1e9).toFixed(1).replace(/\.0$/, '') + 'B';
    if (n >= 1e6) return (n / 1e6).toFixed(1).replace(/\.0$/, '') + 'M';
    if (n >= 1e3) return (n / 1e3).toFixed(1).replace(/\.0$/, '') + 'K';
    return String(n);
  }
  const param = k => new URLSearchParams(location.search).get(k);
  const debounce = (fn, ms = 180) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };
  const langUrl = iso => `${base}pages/language.html?iso=${encodeURIComponent(iso)}`;
  const scriptUrl = code => `${base}pages/script.html?code=${encodeURIComponent(code)}`;
  const projectUrl = id => `${base}pages/project.html?id=${encodeURIComponent(id)}`;
  const fill = (tpl, vals) => tpl.replace(/\{(\w+)\}/g, (_, k) => encodeURIComponent(vals[k] ?? ''));
  function showError(target, err) {
    console.error(err);
    if (target) target.innerHTML = `<div class="error">Could not load data (${esc(err.message)}). If you opened the file directly, serve the folder over HTTP instead.</div>`;
  }

  /* ---------- theme ---------- */
  function currentTheme() {
    try { const t = localStorage.getItem('cg-theme'); if (t) return t; } catch (e) { /* storage unavailable */ }
    return matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  function applyTheme(t) {
    document.documentElement.setAttribute('data-theme', t);
    const btn = $('#theme-btn');
    if (btn) { btn.textContent = t === 'dark' ? '☀' : '☾'; btn.setAttribute('aria-label', t === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'); }
    document.dispatchEvent(new CustomEvent('cg:theme', { detail: t }));
  }
  applyTheme(currentTheme());

  /* ---------- header & footer ---------- */
  function renderHeader(site) {
    const page = document.body.dataset.page;
    const header = document.createElement('header');
    header.className = 'site-header';
    header.innerHTML = `
      <div class="container header-inner">
        <a class="brand" href="${href('index.html')}"><img src="${href(site.brand.logo)}" alt="" width="34" height="34"><span>${esc(site.brand.name)}</span></a>
        <nav class="nav" id="site-nav" aria-label="Main">
          <ul>${site.nav.map(n => `<li><a href="${href(n.href)}"${n.key === page ? ' aria-current="page"' : ''}>${esc(n.label)}</a></li>`).join('')}</ul>
        </nav>
        <div class="header-tools">
          <button class="icon-btn" id="theme-btn" type="button"></button>
          <button class="icon-btn menu-btn" id="menu-btn" type="button" aria-controls="site-nav" aria-expanded="false" aria-label="Open menu"><span></span></button>
        </div>
      </div>`;
    document.body.prepend(header);
    const skip = document.createElement('a');
    skip.className = 'skip-link'; skip.href = '#main'; skip.textContent = 'Skip to content';
    document.body.prepend(skip);

    const nav = $('#site-nav'), menu = $('#menu-btn');
    const setOpen = open => {
      nav.classList.toggle('open', open);
      menu.setAttribute('aria-expanded', String(open));
      menu.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
      document.body.classList.toggle('nav-open', open);
    };
    menu.addEventListener('click', () => setOpen(!nav.classList.contains('open')));
    nav.addEventListener('click', e => { if (e.target.closest('a')) setOpen(false); });
    document.addEventListener('keydown', e => { if (e.key === 'Escape' && nav.classList.contains('open')) { setOpen(false); menu.focus(); } });
    matchMedia('(min-width: 1081px)').addEventListener('change', e => { if (e.matches) setOpen(false); });

    $('#theme-btn').addEventListener('click', () => {
      const next = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
      try { localStorage.setItem('cg-theme', next); } catch (e) { /* storage unavailable */ }
      applyTheme(next);
    });
    applyTheme(document.documentElement.getAttribute('data-theme'));
  }

  function renderFooter(site) {
    const f = site.footer;
    const footer = document.createElement('footer');
    footer.className = 'site-footer';
    footer.innerHTML = `
      <div class="container">
        <div class="footer-grid">
          <div>
            <div class="footer-brand"><img src="${href(site.brand.logo)}" alt="" width="36" height="36">${esc(site.brand.name)}</div>
            <p class="footer-blurb">${esc(f.blurb)}</p>
          </div>
          ${f.columns.map(c => `<div><h4>${esc(c.title)}</h4><ul>${c.links.map(l => `<li><a href="${href(l.href)}"${extAttrs(l.href)}>${esc(l.label)}</a></li>`).join('')}</ul></div>`).join('')}
        </div>
        <div class="footer-bottom"><span>© ${new Date().getFullYear()} ${esc(site.brand.name)}</span><span>${esc(f.legal)}</span></div>
      </div>`;
    document.body.appendChild(footer);
  }

  /* ---------- tabs (WAI-ARIA, keyboard, URL hash sync) ---------- */
  function tabs(container, { onChange, hash = false } = {}) {
    const list = container.querySelector('[role="tablist"]');
    const btns = $$('[role="tab"]', list);
    const select = (btn, focus = false, fromHash = false) => {
      btns.forEach(b => {
        const on = b === btn;
        b.setAttribute('aria-selected', String(on));
        b.tabIndex = on ? 0 : -1;
        const panel = document.getElementById(b.getAttribute('aria-controls'));
        if (panel) panel.hidden = !on;
      });
      if (focus) btn.focus();
      if (hash && !fromHash) history.replaceState(null, '', '#' + btn.dataset.tab);
      onChange && onChange(btn.dataset.tab);
    };
    btns.forEach((b, i) => {
      b.addEventListener('click', () => select(b));
      b.addEventListener('keydown', e => {
        const vertical = getComputedStyle(list).flexDirection === 'column';
        const next = vertical ? 'ArrowDown' : 'ArrowRight', prev = vertical ? 'ArrowUp' : 'ArrowLeft';
        let j = null;
        if (e.key === next) j = (i + 1) % btns.length;
        else if (e.key === prev) j = (i - 1 + btns.length) % btns.length;
        else if (e.key === 'Home') j = 0;
        else if (e.key === 'End') j = btns.length - 1;
        if (j !== null) { e.preventDefault(); select(btns[j], true); }
      });
    });
    const initial = (hash && btns.find(b => '#' + b.dataset.tab === location.hash)) || btns.find(b => b.getAttribute('aria-selected') === 'true') || btns[0];
    if (initial) select(initial, false, true);
    return { select: id => { const b = btns.find(x => x.dataset.tab === id); if (b) select(b); } };
  }

  /* Build tab buttons + panels markup from a list of {id,label,count?,accent?}. */
  function tabMarkup(prefix, items, { vertical = false } = {}) {
    return `<div class="tabs" role="tablist"${vertical ? ' aria-orientation="vertical"' : ''}>${items.map((t, i) => `
      <button class="tab" role="tab" type="button" id="${prefix}-tab-${tok(t.id)}" data-tab="${tok(t.id)}" aria-controls="${prefix}-panel-${tok(t.id)}" aria-selected="${i === 0}"${t.accent ? ` style="--tab-accent:var(--${tok(t.accent)})"` : ''}>
        <span>${esc(t.label)}</span>${t.count != null ? `<span class="count">${esc(t.count)}</span>` : ''}
      </button>`).join('')}</div>`;
  }
  const panelAttrs = (prefix, id) => `role="tabpanel" id="${prefix}-panel-${tok(id)}" aria-labelledby="${prefix}-tab-${tok(id)}" tabindex="0"`;

  /* ---------- sortable table state ---------- */
  function sortable(table, state, rerender) {
    $$('th[data-sort]', table).forEach(th => {
      th.tabIndex = 0;
      const go = () => {
        const key = th.dataset.sort;
        state.dir = state.key === key ? -state.dir : (th.dataset.type === 'number' ? -1 : 1);
        state.key = key;
        $$('th[data-sort]', table).forEach(h => h.removeAttribute('aria-sort'));
        th.setAttribute('aria-sort', state.dir === 1 ? 'ascending' : 'descending');
        rerender();
      };
      th.addEventListener('click', go);
      th.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(); } });
    });
  }
  const collator = new Intl.Collator('en', { sensitivity: 'base', ignorePunctuation: true, numeric: true });
  function sortRows(rows, state, getters) {
    if (!state.key) return rows;
    const get = getters[state.key];
    return [...rows].sort((a, b) => {
      const va = get(a), vb = get(b);
      if (va == null && vb == null) return 0;
      if (va == null) return 1;
      if (vb == null) return -1;
      return (typeof va === 'number' ? va - vb : collator.compare(String(va), String(vb))) * state.dir;
    });
  }

  function pager(container, total, page, perPage, onPage) {
    const pages = Math.max(1, Math.ceil(total / perPage));
    container.innerHTML = pages <= 1 ? '' : `
      <button class="btn btn--sm" data-p="${page - 1}" ${page <= 1 ? 'disabled' : ''}>← Prev</button>
      <span class="info">Page ${page} of ${fmt(pages)}</span>
      <button class="btn btn--sm" data-p="${page + 1}" ${page >= pages ? 'disabled' : ''}>Next →</button>`;
    container.onclick = e => { const b = e.target.closest('[data-p]'); if (b && !b.disabled) onPage(+b.dataset.p); };
  }

  /* ---------- web fonts for rare scripts ---------- */
  // Requests only the glyphs shown (Google Fonts `text=` subsetting); unknown families fail harmlessly.
  const fontsLoaded = new Set();
  function useFont(el, family, text) {
    if (!el || !family) return;
    const key = family + '|' + text;
    if (!fontsLoaded.has(key)) {
      fontsLoaded.add(key);
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(family).replace(/%20/g, '+')}&display=swap` + (text ? `&text=${encodeURIComponent(text)}` : '');
      document.head.appendChild(link);
    }
    el.style.fontFamily = `"${family}", var(--font)`;
  }
  // Apply fonts to [data-font] elements as they scroll into view.
  const fontObserver = 'IntersectionObserver' in window ? new IntersectionObserver(entries => {
    entries.forEach(e => {
      if (!e.isIntersecting) return;
      fontObserver.unobserve(e.target);
      useFont(e.target, e.target.dataset.font, e.target.textContent);
    });
  }, { rootMargin: '200px' }) : null;
  function lazyFonts(root = document) {
    $$('[data-font]', root).forEach(el => fontObserver ? fontObserver.observe(el) : useFont(el, el.dataset.font, el.textContent));
  }

  /* ---------- small components ---------- */
  function copyButton(btn, getText) {
    btn.addEventListener('click', async () => {
      try { await navigator.clipboard.writeText(getText()); btn.textContent = 'Copied!'; }
      catch (e) { btn.textContent = 'Press Ctrl+C'; }
      setTimeout(() => { btn.textContent = 'Copy'; }, 1600);
    });
  }
  function codeBlock(code, lang = '') {
    const id = 'code-' + Math.random().toString(36).slice(2, 8);
    setTimeout(() => { const b = document.getElementById(id); if (b) copyButton(b, () => code); });
    return `<div class="code-block"><button class="btn btn--sm btn--yellow copy" id="${id}" type="button">Copy</button><pre><code${lang ? ` data-lang="${esc(lang)}"` : ''}>${esc(code)}</code></pre></div>`;
  }
  function bar(name, value, max = 100, color = 'blue', suffix = '%', link = '') {
    const pct = Math.max(0, Math.min(100, (value / max) * 100));
    const label = link ? `<a href="${link}">${esc(name)}</a>` : esc(name);
    return `<div class="bar"><span class="name" title="${esc(name)}">${label}</span><span class="track"><span class="fill" style="width:${pct.toFixed(1)}%;--bar:var(--${tok(color)})"></span></span><span class="v">${value == null ? '–' : value.toFixed(1) + suffix}</span></div>`;
  }
  function projectCard(p, taxonomy, { sticker = true } = {}) {
    return `<a class="card project-card" href="${projectUrl(p.id)}">
      ${sticker ? `<span class="sticker" style="--sticker:var(--${tok(p.color)})">${esc(taxonomy.project_kinds[p.kind] || p.kind)}</span>` : ''}
      <div class="top"><img class="logo" src="${href('assets/img/' + p.logo)}" alt="" loading="lazy" width="56" height="56">
        <div><h3>${esc(p.name)}</h3><div class="meta">${esc(p.venue)}${p.venue && !String(p.venue).includes(p.year) ? ' · ' + p.year : ''}</div></div></div>
      <p class="muted">${esc(p.tagline)}</p>
      <div class="numbers">${(p.numbers || []).slice(0, 2).map(n => `<div class="num-chip"><b>${esc(n.value)}</b><span>${esc(n.label)}</span></div>`).join('')}</div>
    </a>`;
  }

  /* ---------- boot ---------- */
  const ready = data.site().then(site => {
    renderHeader(site);
    renderFooter(site);
    return site;
  }).catch(err => { console.error(err); });

  return {
    base, data, getJSON, esc, tok, $, $$, href, extAttrs, isExternal, fmt, compact, param, debounce, fill,
    langUrl, scriptUrl, projectUrl, showError, tabs, tabMarkup, panelAttrs, sortable, sortRows, pager,
    copyButton, codeBlock, bar, projectCard, useFont, lazyFonts, ready,
  };
})();
