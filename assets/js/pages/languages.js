(async () => {
  const { esc, $, $$, data, fmt, compact, langUrl, scriptUrl, tabMarkup, panelAttrs, tabs, sortable, sortRows, pager, debounce, bar } = CG;
  const PER_PAGE = 50;
  try {
    const [site, taxonomy, languages, scripts] = await Promise.all([data.site(), data.taxonomy(), data.languages(), data.scripts()]);
    const P = site.languages_page;
    const scriptName = Object.fromEntries(scripts.map(s => [s.code, s.name]));

    $('#lang-hero').innerHTML = `<span class="kicker">${esc(P.kicker)}</span><h1>${esc(P.title)}</h1><p class="lead">${esc(P.lead)}</p>`;
    const statVals = {
      total: languages.length,
      mapped: languages.filter(l => l.y != null).length,
      lid: languages.filter(l => (l.t || '').includes('L')).length,
      endangered: languages.filter(l => l.e >= 3 && l.e <= 5).length,
      uncovered: languages.filter(l => !/[LG]/.test(l.t || '')).length,
    };
    $('#lang-stats').innerHTML = P.stats.map(s => `<div class="stat"><b>${fmt(statVals[s.key])}</b><span>${esc(s.label)}</span></div>`).join('');

    /* ---------- filters (synced with the URL) ---------- */
    const url = new URLSearchParams(location.search);
    const state = {
      q: url.get('q') || '', area: url.get('area') || '', end: url.get('end') || '', script: url.get('script') || '',
      tech: new Set((url.get('tech') || '').split('').filter(Boolean)), page: 1, colorBy: 'macroarea',
    };
    const areas = Object.keys(taxonomy.macroareas);
    $('#f-area').innerHTML = `<option value="">All macroareas</option>` + areas.map(a => `<option>${esc(a)}</option>`).join('');
    $('#f-end').innerHTML = `<option value="">Any status</option>` + Object.entries(taxonomy.endangerment).map(([k, v]) => `<option value="${esc(k)}">${esc(v.label)}</option>`).join('');
    const scriptCounts = {};
    languages.forEach(l => (l.s || []).forEach(s => { scriptCounts[s] = (scriptCounts[s] || 0) + 1; }));
    $('#f-script').innerHTML = `<option value="">Any script</option>` + Object.entries(scriptCounts).sort((a, b) => b[1] - a[1])
      .map(([c, n]) => `<option value="${esc(c)}">${esc(scriptName[c] || c)} (${fmt(n)})</option>`).join('');
    $('#f-tech').innerHTML = Object.entries(taxonomy.coverage).map(([k, v]) => `
      <label class="chip toggle-chip"><input type="checkbox" value="${esc(k)}"${state.tech.has(k) ? ' checked' : ''}>${esc(v.label)}</label>`).join('') +
      `<label class="chip toggle-chip"><input type="checkbox" value="-"${state.tech.has('-') ? ' checked' : ''}>No GlotSuite model</label>`;
    $('#lang-q').value = state.q; $('#f-area').value = state.area; $('#f-end').value = state.end; $('#f-script').value = state.script;

    const norm = s => (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
    languages.forEach(l => { l._k = norm(`${l.n} ${l.i} ${l.f || ''}`); });

    function filtered() {
      const q = norm(state.q.trim());
      return languages.filter(l =>
        (!q || l._k.includes(q)) &&
        (!state.area || l.m === state.area) &&
        (!state.end || String(l.e) === state.end) &&
        (!state.script || (l.s || []).includes(state.script)) &&
        [...state.tech].every(t => t === '-' ? !/[LG]/.test(l.t || '') : (l.t || '').includes(t)));
    }
    function syncUrl() {
      const u = new URLSearchParams();
      if (state.q) u.set('q', state.q);
      if (state.area) u.set('area', state.area);
      if (state.end) u.set('end', state.end);
      if (state.script) u.set('script', state.script);
      if (state.tech.size) u.set('tech', [...state.tech].join(''));
      history.replaceState(null, '', location.pathname + (u.toString() ? '?' + u : '') + location.hash);
    }

    /* ---------- tabs ---------- */
    const T = P.tabs;
    $('#lang-tabs').innerHTML = tabMarkup('lg', [
      { id: 'map', label: T.map, accent: 'pink' }, { id: 'table', label: T.table, accent: 'yellow' },
      { id: 'families', label: T.families, accent: 'blue' }, { id: 'coverage', label: T.coverage, accent: 'green' },
    ]) + `
      <div ${panelAttrs('lg', 'map')} class="tab-panel">
        <div class="map-controls"><label><span class="visually-hidden">Colour by</span><select class="select" id="color-by">${Object.entries(P.color_by).map(([k, v]) => `<option value="${esc(k)}">${esc(v)}</option>`).join('')}</select></label></div>
        <div class="map" id="lang-map" role="region" aria-label="Map of languages"></div>
        <div class="legend" id="lang-legend"></div>
      </div>
      <div ${panelAttrs('lg', 'table')} class="tab-panel" hidden>
        <div class="table-wrap"><table id="lang-table">
          <thead><tr>
            <th data-sort="n">Language</th><th data-sort="i">ISO</th><th data-sort="f" class="hide-sm">Family</th>
            <th data-sort="m" class="hide-sm">Macroarea</th><th>Scripts</th><th data-sort="e" data-type="number" class="hide-sm">Status</th>
            <th data-sort="p" data-type="number" class="num hide-sm">Speakers</th><th>Coverage</th>
          </tr></thead><tbody id="lang-tbody"></tbody></table></div>
        <div class="pager" id="lang-pager"></div>
      </div>
      <div ${panelAttrs('lg', 'families')} class="tab-panel" hidden><p class="muted">${esc(P.families_text)}</p><div class="grid grid-auto" id="families"></div></div>
      <div ${panelAttrs('lg', 'coverage')} class="tab-panel" hidden><p class="muted">${esc(P.coverage_text)}</p><div class="grid grid-2" id="coverage"></div></div>`;

    let current = [];
    let map, dots, mapReady = false;
    const legendFor = () => state.colorBy === 'endangerment'
      ? Object.values(taxonomy.endangerment).map(v => [v.label, v.color])
      : state.colorBy === 'coverage' ? [['GlotLID', '#ff48b0'], ['not covered', '#8a8173']]
      : Object.entries(taxonomy.macroareas).map(([k, v]) => [k, v.color]);
    function drawMap(rows) {
      if (!mapReady) return;
      if (dots) map.removeLayer(dots);
      dots = Blocks.languageDots(map, rows, taxonomy, { colorBy: state.colorBy, radius: rows.length > 2000 ? 3 : 5 });
      Blocks.legend($('#lang-legend'), legendFor());
    }
    const tabCtl = tabs($('#lang-tabs'), {
      hash: true,
      onChange: id => {
        if (id === 'map' && !mapReady) {
          map = Blocks.makeMap($('#lang-map'));
          mapReady = true; drawMap(current);
        } else if (id === 'map') setTimeout(() => map.invalidateSize(), 0);
      },
    });
    $('#color-by').addEventListener('change', e => { state.colorBy = e.target.value; drawMap(current); });

    /* ---------- table ---------- */
    const sortState = { key: 'n', dir: 1 };
    const getters = { n: l => l.n, i: l => l.i, f: l => l.f, m: l => l.m, e: l => l.e, p: l => l.p };
    sortable($('#lang-table'), sortState, () => { state.page = 1; renderTable(); });
    const covChips = l => Object.entries(taxonomy.coverage).map(([k, v]) =>
      `<span class="chip ${(l.t || '').includes(k) ? 'chip--' + CG.tok(v.color) : 'chip--off'}" title="${esc(v.long)}">${esc(v.label)}</span>`).join('');
    function renderTable() {
      const rows = sortRows(current, sortState, getters);
      const slice = rows.slice((state.page - 1) * PER_PAGE, state.page * PER_PAGE);
      $('#lang-tbody').innerHTML = slice.map(l => {
        const end = taxonomy.endangerment[l.e];
        return `<tr>
          <td><a href="${langUrl(l.i)}">${esc(l.n)}</a></td><td><code>${esc(l.i)}</code></td>
          <td class="hide-sm">${esc(l.f || '–')}</td><td class="hide-sm">${esc(l.m || '–')}</td>
          <td>${(l.s || []).slice(0, 3).map(s => `<a class="chip" href="${scriptUrl(s)}">${esc(s)}</a>`).join(' ')}</td>
          <td class="hide-sm">${end ? `<span class="chip"><span class="dot" style="background:${CG.tok(end.color)}"></span>${esc(end.short)}</span>` : '–'}</td>
          <td class="num hide-sm">${l.p ? compact(l.p) : '–'}</td>
          <td><div class="chips" style="flex-wrap:nowrap">${covChips(l)}</div></td></tr>`;
      }).join('') || `<tr><td colspan="8" class="empty">No languages match these filters.</td></tr>`;
      pager($('#lang-pager'), rows.length, state.page, PER_PAGE, p => { state.page = p; renderTable(); $('#lang-table').scrollIntoView({ block: 'start' }); });
    }

    /* ---------- families & coverage ---------- */
    function renderFamilies() {
      const fams = {};
      current.forEach(l => { const f = l.f || 'Unclassified'; (fams[f] = fams[f] || { n: 0, lid: 0, areas: {} }); fams[f].n++; if ((l.t || '').includes('L')) fams[f].lid++; fams[f].areas[l.m] = 1; });
      $('#families').innerHTML = Object.entries(fams).sort((a, b) => b[1].n - a[1].n).slice(0, 36).map(([name, f]) => `
        <button class="card hoverable" type="button" data-family="${esc(name)}" style="text-align:left;font:inherit;color:inherit;cursor:pointer">
          <h3>${esc(name)}</h3><p class="small muted">${fmt(f.n)} languages · ${esc(Object.keys(f.areas).filter(a => a !== 'undefined').join(', '))}</p>
          ${bar('GlotLID', f.lid / f.n * 100, 100, 'pink')}
        </button>`).join('') || '<p class="empty">No families in this selection.</p>';
    }
    $('#families').addEventListener('click', e => {
      const b = e.target.closest('[data-family]'); if (!b) return;
      state.q = b.dataset.family === 'Unclassified' ? '' : b.dataset.family; $('#lang-q').value = state.q;
      update(); tabCtl.select('table');
    });
    function renderCoverage() {
      const group = (key, label, names) => {
        const g = {};
        current.forEach(l => { const k = l[key]; if (k == null) return; (g[k] = g[k] || { n: 0, lid: 0 }); g[k].n++; if ((l.t || '').includes('L')) g[k].lid++; });
        return `<div class="card"><h3>${esc(label)}</h3><div class="bars">${Object.entries(g).sort((a, b) => b[1].n - a[1].n)
          .map(([k, v]) => bar(`${names ? names(k) : k} (${fmt(v.n)})`, v.lid / v.n * 100, 100, 'pink')).join('')}</div></div>`;
      };
      $('#coverage').innerHTML = group('m', 'By macroarea') + group('e', 'By endangerment', k => taxonomy.endangerment[k].label);
    }

    /* ---------- update loop ---------- */
    function update() {
      current = filtered();
      state.page = 1;
      $('#lang-count').textContent = `${fmt(current.length)} of ${fmt(languages.length)} languages`;
      syncUrl(); renderTable(); renderFamilies(); renderCoverage(); drawMap(current);
    }
    $('#lang-q').addEventListener('input', debounce(e => { state.q = e.target.value; update(); }));
    $('#f-area').addEventListener('change', e => { state.area = e.target.value; update(); });
    $('#f-end').addEventListener('change', e => { state.end = e.target.value; update(); });
    $('#f-script').addEventListener('change', e => { state.script = e.target.value; update(); });
    $('#f-tech').addEventListener('change', e => { e.target.checked ? state.tech.add(e.target.value) : state.tech.delete(e.target.value); update(); });
    update();
  } catch (e) { CG.showError($('#lang-hero'), e); }
})();
