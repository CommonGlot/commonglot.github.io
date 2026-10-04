(async () => {
  const { esc, $, $$, href, data, param, fmt, fill, langUrl, projectUrl, tabMarkup, panelAttrs, tabs, bar, codeBlock } = CG;
  const code = param('code') || '';
  try {
    const [site, taxonomy, scripts, ocrModels, languages, projects] = await Promise.all([
      data.site(), data.taxonomy(), data.scripts(), data.ocrModels(), data.languages(), data.projects()]);
    const s = scripts.find(x => x.code.toLowerCase() === code.toLowerCase());
    if (!s) {
      $('#script-head').innerHTML = `<h1>Script not found</h1><p class="lead">No script with ISO 15924 code “${esc(code)}”.</p><a class="btn btn--yellow" href="${href('pages/scripts.html')}">Browse scripts</a>`;
      return;
    }
    document.title = `${s.name} (${s.code}) — ${site.brand.name}`;
    const byIso = Object.fromEntries(languages.map(l => [l.i, l]));
    const modelName = Object.fromEntries(ocrModels.map(m => [m.id, m.display]));
    const proj = Object.fromEntries(projects.map(p => [p.id, p]));
    const dirAttr = s.direction === 'rtl' ? ' dir="rtl"' : '';
    const tier = s.ocr && taxonomy.ocr_tiers[s.ocr.tier];

    $('#script-head').innerHTML = `
      <div class="breadcrumbs"><a href="${href('pages/scripts.html')}">Scripts</a> / ${esc(s.name)}</div>
      <div class="booklet-head"><div>
        <span class="kicker">ISO 15924 · ${esc(s.code)}${s.type ? ' · ' + esc(s.type) : ''}</span>
        <h1>${esc(s.name)}</h1>
      </div><div class="chips">${tier ? `<span class="chip chip--${CG.tok(tier.color)}">${esc(tier.label)} OCR tier</span>` : '<span class="chip chip--off">Not in OCR bench</span>'}</div></div>
      <div class="specimen" style="margin-top:20px"${dirAttr}>${esc(s.sample || s.specimen)}</div>
      ${s.sample && s.specimen ? `<p class="small muted" style="margin-top:10px"${dirAttr}>Letters: ${esc(s.specimen)}</p>` : ''}`;

    const vals = { code: s.code };
    const users = s.languages.map(i => byIso[i]).filter(Boolean);
    const aux = s.languages_aux.map(i => byIso[i]).filter(Boolean);
    const aside = `
      <div class="card"><dl class="facts">
        <div><dt>Code</dt><dd><code>${esc(s.code)}</code></dd></div>
        <div><dt>Type</dt><dd>${s.type ? `${esc(s.type)}<br><span class="small muted">${esc(taxonomy.script_types[s.type] || '')}</span>` : '–'}</dd></div>
        <div><dt>Direction</dt><dd>${s.direction === 'rtl' ? 'Right-to-left' : s.direction === 'ltr' ? 'Left-to-right' : '–'}</dd></div>
        <div><dt>Characters</dt><dd>${fmt(s.characters)} code points</dd></div>
        <div><dt>Languages</dt><dd>${fmt(users.length)} main · ${fmt(aux.length)} auxiliary</dd></div>
        <div><dt>GlotLID</dt><dd>${fmt(s.glotlid_labels)} labels</dd></div>
        ${s.ocr ? `<div><dt>Best OCR</dt><dd>${s.ocr.best.acc5.toFixed(1)}% Acc@5<br><span class="small muted">${esc(modelName[s.ocr.best.model] || s.ocr.best.model)}</span></dd></div>` : ''}
      </dl></div>
      <div class="card"><h3>Elsewhere</h3><div class="ext-links">${taxonomy.external_script_links.map(x => `<a class="chip" href="${href(fill(x.url, vals))}" target="_blank" rel="noopener">${esc(x.label)} ↗</a>`).join('')}</div></div>`;

    const langList = list => list.length ? `<ul class="lang-list">${list.map(l => `<li><a href="${langUrl(l.i)}">${esc(l.n)}</a><span class="iso">${esc(l.i)}</span></li>`).join('')}</ul>` : '<p class="empty">None recorded.</p>';
    const ocrSection = !s.ocr ? `<div class="card"><p>${esc(s.name)} is not part of GlotOCR Bench yet.</p><a class="btn btn--sm" href="${projectUrl('glotocr-bench')}">About the benchmark →</a></div>` :
      Object.entries(s.ocr.results).map(([variant, rows]) => `
        <div class="card" style="margin-bottom:20px"><h3>${variant === 'plain' ? 'Plain rendering' : 'Old-document rendering'}</h3>
          <p class="small muted">Acc@5 per model${s.ocr.samples ? ` · ${fmt(s.ocr.samples)} samples` : ''}. Character error rate in brackets.</p>
          <div class="bars">${rows.map(r => bar(`${modelName[r.model] || r.model} (CER ${r.cer.toFixed(1)})`, r.acc5, 100, variant === 'plain' ? 'green' : 'yellow')).join('')}</div></div>`).join('');

    const record = { ...s, languages: s.languages.length, languages_aux: s.languages_aux.length };
    $('#script-body').innerHTML = `<aside>${aside}</aside>
      <div id="sb-tabs">
        ${tabMarkup('sb', [
          { id: 'languages', label: 'Languages', count: fmt(users.length), accent: 'pink' },
          { id: 'ocr', label: 'OCR results', accent: 'green' },
          { id: 'unicode', label: 'Unicode', accent: 'yellow' },
          { id: 'data', label: 'Data', accent: 'blue' }])}
        <div ${panelAttrs('sb', 'languages')} class="tab-panel">
          <div class="card"><h3>Main script for</h3>${langList(users)}
            <a class="btn btn--sm" style="margin-top:14px" href="${href('pages/languages.html')}?script=${encodeURIComponent(s.code)}#map">See them on the map →</a></div>
          ${aux.length ? `<div class="card" style="margin-top:20px"><h3>Also used by</h3>${langList(aux)}</div>` : ''}
        </div>
        <div ${panelAttrs('sb', 'ocr')} class="tab-panel" hidden>${ocrSection}</div>
        <div ${panelAttrs('sb', 'unicode')} class="tab-panel" hidden>
          <div class="card"><h3>Ranges</h3><p class="small muted">From <a href="${projectUrl('glotscript')}">${esc(proj.glotscript.name)}</a>'s script table.</p>
            <div class="chips">${s.ranges.map(r => `<span class="chip">${esc(r)}</span>`).join('')}</div></div>
        </div>
        <div ${panelAttrs('sb', 'data')} class="tab-panel" hidden>${codeBlock(JSON.stringify(record, null, 2), 'json')}</div>
      </div>`;
    tabs($('#sb-tabs'), { hash: true });
    $$('.specimen, .specimen + p').forEach(el => CG.useFont(el, s.font, (s.sample || '') + (s.specimen || '')));
  } catch (e) { CG.showError($('#script-head'), e); }
})();
