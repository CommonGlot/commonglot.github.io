(async () => {
  const { esc, $, href, extAttrs, data, param, fmt, compact, fill, langUrl, scriptUrl, projectUrl, tabMarkup, panelAttrs, tabs, bar, codeBlock } = CG;
  const iso = (param('iso') || '').toLowerCase();
  try {
    const [site, taxonomy, languages, scripts, projects, ocrModels] = await Promise.all([
      data.site(), data.taxonomy(), data.languages(), data.scripts(), data.projects(), data.ocrModels()]);
    const l = languages.find(x => x.i === iso);
    if (!l) {
      $('#lang-head').innerHTML = `<h1>Language not found</h1><p class="lead">No language with ISO 639-3 code “${esc(iso)}” in the directory.</p><a class="btn btn--yellow" href="${href('pages/languages.html')}">Browse languages</a>`;
      return;
    }
    const d = await data.languageDetails(iso);
    const B = site.booklet;
    const byCode = Object.fromEntries(scripts.map(s => [s.code, s]));
    const proj = Object.fromEntries(projects.map(p => [p.id, p]));
    const modelName = Object.fromEntries(ocrModels.map(m => [m.id, m.display]));
    const end = taxonomy.endangerment[l.e];
    document.title = `${l.n} (${l.i}) — ${site.brand.name}`;

    /* ---------- head ---------- */
    const codes = [`ISO 639-3 · ${l.i}`, d.glottocode && `Glottocode · ${d.glottocode}`, d.wikidata && `Wikidata · ${d.wikidata}`].filter(Boolean);
    $('#lang-head').innerHTML = `
      <div class="breadcrumbs"><a href="${href('pages/languages.html')}">Languages</a> / ${l.m ? `<a href="${href('pages/languages.html')}?area=${encodeURIComponent(l.m)}">${esc(l.m)}</a> / ` : ''}${esc(l.n)}</div>
      <div class="booklet-head"><div>
        <span class="kicker">${esc(l.f || 'Unclassified')}${l.m ? ' · ' + esc(l.m) : ''}</span>
        <h1 style="margin-bottom:8px">${esc(l.n)}</h1>
        ${d.endonym && d.endonym !== l.n ? `<p class="endonym" lang="${esc(l.i)}">${esc(d.endonym)}</p>` : ''}
        <div class="codes">${codes.map(c => `<span class="chip">${esc(c)}</span>`).join('')}</div>
      </div>
      <div class="chips">${Object.entries(taxonomy.coverage).map(([k, v]) => `<span class="chip ${(l.t || '').includes(k) ? 'chip--' + v.color : 'chip--off'}" title="${esc(v.long)}">${esc(v.label)}</span>`).join('')}</div></div>
      ${d.description ? `<p class="lead" style="margin-top:16px">${esc(d.description.charAt(0).toUpperCase() + d.description.slice(1))}.</p>` : ''}`;

    /* ---------- aside ---------- */
    const famLink = l.f ? `<a href="${href('pages/languages.html')}?q=${encodeURIComponent(l.f)}#table">${esc(l.f)}</a>` : '–';
    const scale = Object.keys(taxonomy.endangerment).map(k => `<span class="${+k <= (l.e || 0) ? 'on' : ''}" style="background:${taxonomy.endangerment[k].color}"></span>`).join('');
    const vals = { iso: l.i, glottocode: d.glottocode, wikidata: d.wikidata };
    const ext = taxonomy.external_language_links.filter(x => vals[x.needs]).map(x => `<a class="chip" href="${fill(x.url, vals)}" target="_blank" rel="noopener">${esc(x.label)} ↗</a>`).join('');
    const aside = `
      <div class="card"><dl class="facts">
        <div><dt>Family</dt><dd>${famLink}</dd></div>
        <div><dt>Macroarea</dt><dd>${esc((d.macroareas || [l.m]).filter(Boolean).join(', ') || '–')}</dd></div>
        <div><dt>Countries</dt><dd>${(d.countries || []).map(c => esc(c.name)).join(', ') || '–'}</dd></div>
        <div><dt>Speakers</dt><dd>${l.p ? `${compact(l.p)} <span class="muted small">(${fmt(l.p)})</span>` : '–'}</dd></div>
        <div><dt>Status</dt><dd>${end ? esc(end.label) : 'unknown'}${end ? `<div class="endangerment-scale" aria-hidden="true">${scale}</div>` : ''}</dd></div>
        <div><dt>Documented</dt><dd>${d.documentation ? esc(taxonomy.documentation[d.documentation] || d.documentation) : '–'}</dd></div>
        <div><dt>Scripts</dt><dd class="chips">${(l.s || []).map(s => `<a class="chip" href="${scriptUrl(s)}">${esc(byCode[s]?.name || s)}</a>`).join('') || '–'}</dd></div>
        ${d.scripts_aux ? `<div><dt>Also</dt><dd class="chips">${d.scripts_aux.map(s => `<a class="chip" href="${scriptUrl(s)}">${esc(byCode[s]?.name || s)}</a>`).join('')}</dd></div>` : ''}
        ${d.cldr_status ? `<div><dt>Official</dt><dd>${esc(d.cldr_status)}</dd></div>` : ''}
      </dl></div>
      ${l.y != null ? `<div class="map map--small" id="mini-map" role="region" aria-label="Location of ${esc(l.n)}"></div>` : ''}
      <div class="card"><h3>Elsewhere</h3><div class="ext-links">${ext}</div></div>`;

    /* ---------- technology ---------- */
    const row = (p, status, text, extra = '') => `
      <div class="tech-row">
        <img src="${href('assets/img/' + p.logo)}" alt="" width="48" height="48" loading="lazy">
        <div><h4><a href="${projectUrl(p.id)}">${esc(p.name)}</a></h4><p>${text}</p>${extra}</div>
        <span class="status status--${status[0]}">${esc(status[1])}</span>
      </div>`;
    const tech = [];
    const lid = d.glotlid || [];
    tech.push(row(proj.glotlid, lid.length ? ['yes', 'Supported'] : ['no', 'Not yet'],
      lid.length ? `${lid.length} label${lid.length > 1 ? 's' : ''} in GlotLID v3.` : esc(taxonomy.coverage.L.long) + ' — no label yet.',
      lid.length ? `<div class="bars" style="margin-top:10px">${lid.map(x => bar(`${x.label} · F1`, x.f1 * 100, 100, 'pink')).join('')}</div>
        <p class="small muted" style="margin-top:6px">${lid.map(x => `${esc(x.label)}: precision ${(x.precision * 100).toFixed(1)}%, recall ${(x.recall * 100).toFixed(1)}%, ${fmt(x.sentences)} training sentences`).join('<br>')}</p>` : ''));
    const g500 = d.glot500 || [];
    tech.push(row(proj.glot500, g500.length ? ['yes', 'Included'] : ['no', 'Not yet'],
      g500.length ? `Glot500 includes ${g500.map(s => `${esc(l.i)}_${esc(s)}`).join(', ')}.` : 'Not among the Glot500 languages.'));
    tech.push(row(proj.glotscript, (l.t || '').includes('S') ? ['yes', 'Recorded'] : ['no', 'Not yet'],
      (l.t || '').includes('S') ? `GlotScript-R lists ${(l.s || []).map(s => esc(byCode[s]?.name || s)).join(', ')}${d.scripts_aux ? ` (plus ${d.scripts_aux.length} auxiliary)` : ''}.` : 'No writing system recorded.'));
    const ocrScripts = (l.s || []).map(s => byCode[s]).filter(s => s && s.ocr);
    tech.push(row(proj['glotocr-bench'], ocrScripts.length ? ['yes', 'Benchmarked'] : ['no', 'Not yet'],
      ocrScripts.length ? 'Best OCR accuracy (Acc@5) for this language’s scripts:' : 'None of its scripts are in the OCR benchmark.',
      ocrScripts.length ? `<div class="bars" style="margin-top:10px">${ocrScripts.map(s => bar(`${s.name} · ${modelName[s.ocr.best.model] || s.ocr.best.model}`, s.ocr.best.acc5, 100, 'green', '%', scriptUrl(s.code))).join('')}</div>` : ''));
    ['glotcc', 'glotweb', 'glotstorybook'].forEach(id => {
      const p = proj[id]; if (!p) return;
      tech.push(row(p, ['part', 'Check'], `${esc(p.tagline)} Per-language coverage is listed in the dataset.`,
        `<div class="chips" style="margin-top:8px">${['data', 'demo'].filter(k => p.links[k]).map(k => `<a class="chip" href="${p.links[k]}" target="_blank" rel="noopener">${k === 'data' ? 'Dataset' : 'Demo'} ↗</a>`).join('')}</div>`));
    });

    /* ---------- neighbours ---------- */
    const dist = (a, b) => {
      const r = Math.PI / 180, dLa = (b.y - a.y) * r, dLo = (b.x - a.x) * r;
      const h = Math.sin(dLa / 2) ** 2 + Math.cos(a.y * r) * Math.cos(b.y * r) * Math.sin(dLo / 2) ** 2;
      return 12742 * Math.asin(Math.sqrt(h));
    };
    const near = l.y != null ? languages.filter(x => x.y != null && x.i !== l.i).map(x => [x, dist(l, x)]).sort((a, b) => a[1] - b[1]).slice(0, 12) : [];
    const kin = l.f ? languages.filter(x => x.f === l.f && x.i !== l.i).sort((a, b) => (b.p || 0) - (a.p || 0)).slice(0, 24) : [];
    const langItem = (x, extra = '') => `<li><a href="${langUrl(x.i)}">${esc(x.n)}</a><span class="iso">${esc(x.i)}</span>${extra}</li>`;

    /* ---------- tabs ---------- */
    const record = { ...l, ...d }; delete record._k;
    $('#lang-body').innerHTML = `<aside>${aside}</aside>
      <div id="lb-tabs">
        ${tabMarkup('lb', [
          { id: 'tech', label: B.language_tech_title, accent: 'pink' }, { id: 'writing', label: 'Writing', accent: 'yellow' },
          { id: 'neighbours', label: 'Neighbours', accent: 'blue' }, { id: 'data', label: 'Data', accent: 'green' }])}
        <div ${panelAttrs('lb', 'tech')} class="tab-panel">
          <div class="card"><p class="muted">${esc(B.language_tech_text)}</p>${tech.join('')}</div>
          ${!/[LG]/.test(l.t || '') ? `<div class="card card--yellow" style="margin-top:20px"><h3>${esc(B.not_covered)}</h3>
            <a class="btn btn--sm" href="${site.about.issues_url}/new?title=${encodeURIComponent(`Technology for ${l.n} (${l.i})`)}" target="_blank" rel="noopener">${esc(B.contribute_label)} ↗</a></div>` : ''}
        </div>
        <div ${panelAttrs('lb', 'writing')} class="tab-panel" hidden>
          <div class="grid grid-auto">${[...(l.s || []), ...(d.scripts_aux || [])].map(c => byCode[c]).filter(Boolean).map((s, i) => `
            <a class="card script-card" href="${scriptUrl(s.code)}">${i >= (l.s || []).length ? '<span class="sticker">auxiliary</span>' : ''}
              <span class="code">${esc(s.code)}</span><div class="glyphs"${s.direction === 'rtl' ? ' dir="rtl"' : ''}${s.font ? ` data-font="${esc(s.font)}"` : ''}>${esc(s.sample || s.specimen)}</div>
              <h3>${esc(s.name)}</h3><p class="small muted">${esc(s.type || '')}${s.direction ? ' · ' + s.direction.toUpperCase() : ''}</p></a>`).join('') || '<p class="empty">No writing system recorded.</p>'}</div>
        </div>
        <div ${panelAttrs('lb', 'neighbours')} class="tab-panel" hidden>
          <div class="grid grid-2" style="align-items:start">
            <div class="card"><h3>Nearest languages</h3><ul class="lang-list" style="columns:1">${near.map(([x, km]) => langItem(x, ` <span class="muted small">${fmt(Math.round(km))} km</span>`)).join('') || '<li class="muted">No coordinates.</li>'}</ul></div>
            <div class="card"><h3>Same family</h3><ul class="lang-list" style="columns:2 140px">${kin.map(x => langItem(x)).join('') || '<li class="muted">No relatives listed.</li>'}</ul>
              ${l.f ? `<a class="btn btn--sm" style="margin-top:14px" href="${href('pages/languages.html')}?q=${encodeURIComponent(l.f)}#table">All ${esc(l.f)} languages →</a>` : ''}</div>
          </div>
        </div>
        <div ${panelAttrs('lb', 'data')} class="tab-panel" hidden>
          <p class="muted">${esc(B.sources_note)}</p>
          ${codeBlock(JSON.stringify(record, null, 2), 'json')}
          <a class="btn btn--sm" style="margin-top:14px" href="${href('pages/data.html')}">About the data →</a>
        </div>
      </div>`;
    tabs($('#lb-tabs'), { hash: true });
    CG.lazyFonts($('#lang-body'));

    if (l.y != null) {
      const map = Blocks.makeMap($('#mini-map'), { center: [l.y, l.x], zoom: 4, scrollWheelZoom: false });
      Blocks.languageDots(map, near.map(([x]) => x), taxonomy, { radius: 5 });
      L.circleMarker([l.y, l.x], { radius: 10, weight: 3, color: '#16130f', fillColor: '#ff48b0', fillOpacity: 1 }).addTo(map).bindPopup(Blocks.popup(l, taxonomy));
    }
  } catch (e) { CG.showError($('#lang-head'), e); }
})();
