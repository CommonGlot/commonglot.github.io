(async () => {
  const { esc, $, href, extAttrs, data, param, codeBlock, tabMarkup, panelAttrs, tabs, fmt, projectCard } = CG;
  const LINK_LABELS = { paper: 'Paper', code: 'Code', demo: 'Demo', model: 'Model', data: 'Data', package: 'PyPI', leaderboard: 'Leaderboard', results: 'Results', pipeline: 'Pipeline' };
  try {
    const [site, taxonomy, projects] = await Promise.all([data.site(), data.taxonomy(), data.projects()]);
    const p = projects.find(x => x.id === param('id'));
    if (!p) {
      $('#project-head').innerHTML = `<h1>Project not found</h1><p class="lead">No project with id “${esc(param('id'))}”.</p><a class="btn btn--yellow" href="${href('pages/projects.html')}">All projects</a>`;
      return;
    }
    document.title = `${p.name} — ${site.brand.name}`;
    const stage = site.glotsuite.pipeline.find(s => s.id === p.stage);

    $('#project-head').innerHTML = `
      <div class="breadcrumbs"><a href="${href('pages/projects.html')}">Projects</a> / ${esc(p.name)}</div>
      <div class="booklet-head">
        <div style="display:flex;gap:22px;align-items:center;flex-wrap:wrap">
          <img src="${href('assets/img/' + p.logo)}" alt="" width="96" height="96" style="width:96px;height:96px;background:#fffaf0;border:2.5px solid var(--line-c);border-radius:20px;padding:8px;box-shadow:5px 5px 0 var(--shadow)">
          <div><span class="kicker">${esc(taxonomy.project_kinds[p.kind])} · ${esc(p.venue)}</span><h1 style="margin:0">${esc(p.name)}</h1></div>
        </div>
      </div>
      <p class="lead" style="margin-top:18px">${esc(p.tagline)}</p>
      <div class="btn-row" style="margin-top:20px">${Object.entries(p.links).map(([k, u], i) => `<a class="btn btn--sm${i === 0 ? ' btn--' + p.color : ''}" href="${u}"${extAttrs(u)}>${esc(LINK_LABELS[k] || k)} ↗</a>`).join('')}</div>`;

    // Directory coverage for projects that set flags in the language index.
    const flag = Object.entries(taxonomy.coverage).find(([, v]) => v.project === p.id);
    let coverage = '';
    if (flag) {
      const langs = await data.languages();
      const n = langs.filter(l => (l.t || '').includes(flag[0])).length;
      coverage = `<div class="card card--${p.color}"><h3>${fmt(n)} languages</h3><p class="small">${esc(flag[1].long)} in the CommonGlot directory.</p>
        <a class="btn btn--sm" href="${href('pages/languages.html')}?tech=${flag[0]}">Browse them →</a></div>`;
    }

    const sections = [
      { id: 'overview', label: 'Overview' },
      { id: 'use', label: 'Use it' },
      { id: 'cite', label: 'Cite' },
      { id: 'related', label: 'Related' },
    ];
    const related = projects.filter(x => x.id !== p.id && (x.stage === p.stage || x.kind === p.kind));
    $('#project-body').innerHTML = `
      <aside>
        <div class="card"><dl class="facts">
          <div><dt>Type</dt><dd>${esc(taxonomy.project_kinds[p.kind])}</dd></div>
          <div><dt>Published</dt><dd>${esc(p.venue)}</dd></div>
          <div><dt>Year</dt><dd>${esc(p.year)}</dd></div>
          ${stage ? `<div><dt>Stage</dt><dd>${esc(stage.label)}</dd></div>` : ''}
          <div><dt>Links</dt><dd class="chips">${Object.entries(p.links).map(([k, u]) => `<a class="chip" href="${u}"${extAttrs(u)}>${esc(LINK_LABELS[k] || k)}</a>`).join('')}</dd></div>
        </dl></div>
        ${coverage}
      </aside>
      <div id="pj-tabs">
        ${tabMarkup('pd', sections)}
        <div ${panelAttrs('pd', 'overview')} class="tab-panel">
          <div class="stats" style="margin-bottom:24px">${p.numbers.map(n => `<div class="stat"><b>${esc(n.value)}</b><span>${esc(n.label)}</span></div>`).join('')}</div>
          <div class="card"><p style="font-size:1.08rem">${esc(p.description)}</p>
            <h3 style="margin-top:20px">Features</h3>
            <div class="deliver-panel"><ul class="outputs">${p.features.map(f => `<li>${esc(f)}</li>`).join('')}</ul></div>
          </div>
        </div>
        <div ${panelAttrs('pd', 'use')} class="tab-panel" hidden>
          ${p.usage ? codeBlock(p.usage.code, p.usage.lang) : '<p class="empty">See the repository for usage.</p>'}
        </div>
        <div ${panelAttrs('pd', 'cite')} class="tab-panel" hidden>
          <p class="muted">If you use ${esc(p.name)}, please cite:</p>
          ${codeBlock(p.citation, 'bibtex')}
        </div>
        <div ${panelAttrs('pd', 'related')} class="tab-panel" hidden>
          <div class="grid grid-auto">${related.map(x => projectCard(x, taxonomy)).join('') || '<p class="empty">No related projects.</p>'}</div>
        </div>
      </div>`;
    tabs($('#pj-tabs'), { hash: true });
  } catch (e) { CG.showError($('#project-head'), e); }
})();
