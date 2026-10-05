(async () => {
  const { esc, $, data, fmt, scriptUrl, tabMarkup, panelAttrs, tabs, sortable, sortRows, debounce, bar } = CG;
  try {
    const [site, taxonomy, scripts, ocrModels] = await Promise.all([data.site(), data.taxonomy(), data.scripts(), data.ocrModels()]);
    const P = site.scripts_page;
    const real = scripts.filter(s => !s.special);
    const modelName = Object.fromEntries(ocrModels.map(m => [m.id, m.display]));

    $('#scripts-hero').innerHTML = `<span class="kicker">${esc(P.kicker)}</span><h1>${esc(P.title)}</h1><p class="lead">${esc(P.lead)}</p>`;
    const statVals = {
      total: real.length,
      ocr: real.filter(s => s.ocr).length,
      readable: real.filter(s => s.ocr && s.ocr.best.acc5 >= 50).length,
      rtl: real.filter(s => s.direction === 'rtl').length,
      lid: real.filter(s => s.glotlid_labels > 0).length,
    };
    $('#scripts-stats').innerHTML = P.stats.map(s => `<div class="stat"><b>${fmt(statVals[s.key])}</b><span>${esc(s.label)}</span></div>`).join('');

    /* filters */
    const url = new URLSearchParams(location.search);
    const state = { q: url.get('q') || '', type: url.get('type') || '', dir: url.get('dir') || '', tier: url.get('tier') || '' };
    $('#f-type').innerHTML = `<option value="">Any type</option>` + Object.keys(taxonomy.script_types).map(t => `<option value="${esc(t)}">${esc(t)}</option>`).join('');
    $('#f-dir').innerHTML = `<option value="">Any direction</option><option value="ltr">Left-to-right</option><option value="rtl">Right-to-left</option>`;
    $('#f-tier').innerHTML = `<option value="">Any OCR tier</option>` + Object.entries(taxonomy.ocr_tiers).map(([k, v]) => `<option value="${esc(k)}">${esc(v.label)}</option>`).join('') + `<option value="none">Not benchmarked</option>`;
    $('#script-q').value = state.q; $('#f-type').value = state.type; $('#f-dir').value = state.dir; $('#f-tier').value = state.tier;

    const filtered = () => {
      const q = state.q.trim().toLowerCase();
      return scripts.filter(s =>
        (!q || s.name.toLowerCase().includes(q) || s.code.toLowerCase().includes(q)) &&
        (!state.type || s.type === state.type) &&
        (!state.dir || s.direction === state.dir) &&
        (!state.tier || (state.tier === 'none' ? !s.ocr : s.ocr && s.ocr.tier === state.tier)));
    };

    /* tabs */
    const T = P.tabs;
    $('#script-tabs').innerHTML = `<h2 class="visually-hidden">${esc(P.explore_title)}</h2>` + tabMarkup('sc', [
      { id: 'gallery', label: T.gallery, accent: 'yellow' }, { id: 'table', label: T.table, accent: 'pink' }, { id: 'ocr', label: T.ocr, accent: 'green' },
    ]) + `
      <div ${panelAttrs('sc', 'gallery')} class="tab-panel"><div class="grid grid-auto-sm" id="gallery"></div></div>
      <div ${panelAttrs('sc', 'table')} class="tab-panel" hidden>
        <div class="table-wrap"><table id="script-table"><thead><tr>
          <th data-sort="name">Script</th><th data-sort="code">Code</th><th data-sort="type" class="hide-sm">Type</th><th data-sort="dir" class="hide-sm">Dir.</th>
          <th data-sort="langs" data-type="number" class="num">Languages</th><th data-sort="lid" data-type="number" class="num hide-sm">GlotLID labels</th>
          <th data-sort="ocr" data-type="number" class="num">Best OCR</th></tr></thead><tbody id="script-tbody"></tbody></table></div>
      </div>
      <div ${panelAttrs('sc', 'ocr')} class="tab-panel" hidden>
        <p class="muted">${esc(P.ocr_text)} <a href="${CG.href(P.ocr_source)}" target="_blank" rel="noopener">Leaderboard ↗</a></p>
        <div class="grid grid-2" style="align-items:start">
          <div class="card"><h3>Overall</h3><div class="bars">${ocrModels.map(m => bar(m.display, m.overall, 100, 'blue')).join('')}</div></div>
          <div class="table-wrap"><table><thead><tr><th>Model</th><th class="num">High</th><th class="num">Mid</th><th class="num">Low</th></tr></thead><tbody>
            ${ocrModels.map(m => `<tr><td>${esc(m.display)} <span class="sub">${esc(m.type)}</span></td><td class="num">${m.high?.toFixed(1)}</td><td class="num">${m.mid?.toFixed(1)}</td><td class="num">${m.low?.toFixed(1)}</td></tr>`).join('')}
          </tbody></table></div>
        </div>
      </div>`;
    tabs($('#script-tabs'), { hash: true });

    const sortState = { key: 'langs', dir: -1 };
    const getters = { name: s => s.name, code: s => s.code, type: s => s.type, dir: s => s.direction, langs: s => s.languages.length, lid: s => s.glotlid_labels, ocr: s => s.ocr ? s.ocr.best.acc5 : null };
    sortable($('#script-table'), sortState, () => renderTable());
    $('#script-table th[data-sort="langs"]').setAttribute('aria-sort', 'descending');

    let current = [];
    const tierChip = s => s.ocr ? `<span class="chip chip--${CG.tok(taxonomy.ocr_tiers[s.ocr.tier]?.color || 'yellow')}">${esc(s.ocr.best.acc5.toFixed(0))}% OCR</span>` : `<span class="chip chip--off">no OCR</span>`;
    function renderGallery() {
      $('#gallery').innerHTML = sortRows(current, { key: 'langs', dir: -1 }, getters).map(s => `
        <a class="card script-card" href="${scriptUrl(s.code)}">
          <span class="code">${esc(s.code)}</span>
          <div class="glyphs"${s.direction === 'rtl' ? ' dir="rtl"' : ''}${s.font ? ` data-font="${esc(s.font)}"` : ''}>${esc(s.sample || s.specimen || '')}</div>
          <h3>${esc(s.name)}</h3>
          <p class="small muted">${fmt(s.languages.length)} languages${s.type ? ' · ' + esc(s.type) : ''}</p>
          <div class="chips">${tierChip(s)}${s.glotlid_labels ? `<span class="chip chip--pink">${s.glotlid_labels} LID</span>` : ''}</div>
        </a>`).join('') || '<p class="empty">No scripts match.</p>';
      CG.lazyFonts($('#gallery'));
    }
    function renderTable() {
      $('#script-tbody').innerHTML = sortRows(current, sortState, getters).map(s => `<tr>
        <td><a href="${scriptUrl(s.code)}">${esc(s.name)}</a></td><td><code>${esc(s.code)}</code></td>
        <td class="hide-sm">${esc(s.type || '–')}</td><td class="hide-sm">${esc((s.direction || '–').toUpperCase())}</td>
        <td class="num">${fmt(s.languages.length)}</td><td class="num hide-sm">${fmt(s.glotlid_labels)}</td>
        <td class="num">${s.ocr ? `${s.ocr.best.acc5.toFixed(1)}% <span class="sub">${esc(modelName[s.ocr.best.model] || '')}</span>` : '–'}</td></tr>`).join('')
        || '<tr><td colspan="7" class="empty">No scripts match.</td></tr>';
    }
    function update() {
      current = filtered();
      $('#script-count').textContent = `${fmt(current.length)} of ${fmt(scripts.length)} scripts`;
      const u = new URLSearchParams(Object.entries(state).filter(([, v]) => v));
      history.replaceState(null, '', location.pathname + (u.toString() ? '?' + u : '') + location.hash);
      renderGallery(); renderTable();
    }
    $('#script-q').addEventListener('input', debounce(e => { state.q = e.target.value; update(); }));
    $('#f-type').addEventListener('change', e => { state.type = e.target.value; update(); });
    $('#f-dir').addEventListener('change', e => { state.dir = e.target.value; update(); });
    $('#f-tier').addEventListener('change', e => { state.tier = e.target.value; update(); });
    update();
  } catch (e) { CG.showError($('#scripts-hero'), e); }
})();
