(async () => {
  const { esc, $, href, extAttrs, data, projectUrl } = CG;
  try {
    const [site, projects] = await Promise.all([data.site(), data.projects()]);
    const g = site.glotsuite;
    $('#gs-hero').innerHTML = `
      <div><span class="kicker">${esc(g.kicker)}</span><h1>${esc(g.title)}</h1><p class="lead">${esc(g.lead)}</p>
        <div class="btn-row" style="margin-top:24px"><a class="btn btn--pink" href="${g.home_url}"${extAttrs(g.home_url)}>${esc(g.home_label)} ↗</a>
        <a class="btn" href="${href('pages/projects.html')}">All projects</a></div></div>
      <div class="card tilt-r" style="justify-self:center;max-width:360px"><img src="${href(g.logo)}" alt="GlotSuite logo" width="320" height="320" style="width:100%;height:auto"></div>`;

    $('#pipeline-head').innerHTML = `<div><h2>${esc(g.pipeline_title)}</h2></div>`;
    $('#pipeline').innerHTML = g.pipeline.map(s => `
      <div class="step"><h3>${esc(s.label)}</h3><p class="small muted">${esc(s.text)}</p>
        <div class="chips">${projects.filter(p => p.stage === s.id).map(p => `<a class="chip" href="${projectUrl(p.id)}">${esc(p.name)}</a>`).join('')}</div></div>`).join('');

    $('#timeline-title').textContent = g.timeline_title;
    $('#timeline').innerHTML = [...projects].sort((a, b) => a.year - b.year).map(p => `
      <div class="item" style="--dotc:var(--${p.color})"><a class="card" href="${projectUrl(p.id)}">
        <span class="year">${esc(p.year)} · ${esc(p.venue)}</span><h3 style="margin-top:4px">${esc(p.name)}</h3><p class="small muted">${esc(p.tagline)}</p></a></div>`).join('');

    $('#adoption-title').textContent = g.adoption_title;
    $('#adoption').innerHTML = g.adoption.map((a, i) => `<div class="card card--${['yellow', 'pink', 'green'][i % 3]}"><h3>${esc(a.title)}</h3><p>${esc(a.text)}</p></div>`).join('');
  } catch (e) { CG.showError($('#gs-hero'), e); }
})();
