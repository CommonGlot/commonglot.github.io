(async () => {
  const { esc, $, data } = CG;
  try {
    const site = await data.site();
    const A = site.about;
    $('#about-hero').innerHTML = `<div class="hero-grid"><div><span class="kicker">${esc(A.kicker)}</span><h1>${esc(A.title)}</h1><p class="lead">${esc(A.lead)}</p></div>
      <div class="lockup" role="img" aria-label="${esc(site.brand.name)} logo"><img src="${CG.href(site.brand.logo)}" alt="" width="166" height="196"><span><b>Common</b><b>Glot</b></span></div></div>`;
    $('#team-title').textContent = A.team_title;
    const initials = n => n.split(/\s+/).map(w => w[0]).slice(0, 2).join('');
    const colors = ['pink', 'yellow', 'blue', 'green'];
    $('#team').innerHTML = A.team.map((p, i) => `
      <${p.url ? `a href="${CG.href(p.url)}" target="_blank" rel="noopener"` : 'div'} class="card" style="display:flex;gap:16px;align-items:center">
        <span style="flex-shrink:0;width:60px;height:60px;display:grid;place-items:center;border:2.5px solid var(--line-c);border-radius:50%;font-weight:800;font-size:1.2rem;background:var(--${colors[i % 4]});color:${colors[i % 4] === 'blue' ? 'var(--on-blue)' : 'var(--on-accent)'}">${esc(initials(p.name))}</span>
        <div><h3 style="margin:0">${esc(p.name)}</h3><p class="small muted" style="margin:2px 0 0">${esc(p.role)}${p.affiliation ? ' · ' + esc(p.affiliation) : ''}</p></div>
      </${p.url ? 'a' : 'div'}>`).join('');
    $('#team-note').textContent = A.team_note;
    $('#contribute-title').textContent = A.contribute_title;
    $('#contribute-list').innerHTML = A.contribute.map((c, i) => `<div class="card ${i % 2 ? 'tilt-r' : 'tilt-l'}"><span class="sticker" style="--sticker:var(--${colors[i % 4]})">0${i + 1}</span><h3>${esc(c.title)}</h3><p class="muted small">${esc(c.text)}</p></div>`).join('');
    $('#contribute-cta').innerHTML = `<a class="btn btn--pink" href="${CG.href(A.issues_url)}" target="_blank" rel="noopener">Open an issue ↗</a><a class="btn" href="${CG.href(site.brand.github)}" target="_blank" rel="noopener">CommonGlot on GitHub ↗</a>`;
    $('#faq-title').textContent = A.faq_title;
    $('#faq').innerHTML = A.faq.map(f => `<details class="faq"><summary>${esc(f.q)}</summary><p>${esc(f.a)}</p></details>`).join('');
    $('#aff-title').textContent = A.affiliations_title;
    $('#affiliations').innerHTML = A.affiliations.map(a => `<a class="card" href="${CG.href(a.url)}" target="_blank" rel="noopener"><h3 style="margin:0">${esc(a.name)} ↗</h3></a>`).join('');
  } catch (e) { CG.showError($('#about-hero'), e); }
})();
