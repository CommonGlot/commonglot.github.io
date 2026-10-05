(async () => {
  const { esc, $, data, projectCard, tabMarkup, panelAttrs, tabs } = CG;
  try {
    const [site, taxonomy, projects] = await Promise.all([data.site(), data.taxonomy(), data.projects()]);
    const g = site.glotsuite;
    $('#projects-hero').innerHTML = `<span class="kicker">${esc(g.kicker)}</span><h1>${esc(site.home.projects_title)}</h1><p class="lead">${esc(site.home.projects_text)}</p>`;

    // One tab per project kind, plus "All" and a tab per pipeline stage.
    const kinds = Object.keys(taxonomy.project_kinds).filter(k => projects.some(p => p.kind === k));
    const groups = [
      { id: 'all', label: 'All', items: projects, accent: 'yellow' },
      ...kinds.map((k, i) => ({ id: k, label: taxonomy.project_kinds[k] + 's', items: projects.filter(p => p.kind === k), accent: ['pink', 'blue', 'green', 'yellow'][i % 4] })),
      ...g.pipeline.map(s => ({ id: 'stage-' + s.id, label: 'Stage: ' + s.label, items: projects.filter(p => p.stage === s.id), note: s.text })),
    ].filter(x => x.items.length);

    $('#projects-tabs').innerHTML = `<h2 class="visually-hidden">${esc(site.projects_page.list_title)}</h2>` + tabMarkup('pj', groups.map(x => ({ ...x, count: x.items.length }))) +
      groups.map(x => `<div ${panelAttrs('pj', x.id)} class="tab-panel">
        ${x.note ? `<p class="lead" style="margin-bottom:20px">${esc(x.note)}</p>` : ''}
        <div class="grid grid-auto">${x.items.map(p => projectCard(p, taxonomy)).join('')}</div></div>`).join('');
    tabs($('#projects-tabs'), { hash: true });
  } catch (e) { CG.showError($('#projects-tabs'), e); }
})();
