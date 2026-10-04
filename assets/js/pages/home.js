(async () => {
  const { esc, href, extAttrs, $, langUrl, scriptUrl, projectCard, data } = CG;
  try {
    const [site, taxonomy, projects, stats, scripts] = await Promise.all([
      data.site(), data.taxonomy(), data.projects(), data.stats(), data.scripts(),
    ]);
    const h = site.home;

    /* hero */
    $('#hero-text').innerHTML = `
      <span class="kicker">${esc(h.kicker)}</span>
      <h1 class="hero-title">${h.title.map(w => `<span class="w">${esc(w)}</span>`).join(' ')}</h1>
      <p class="lead">${esc(h.lead)}</p>
      <div class="btn-row">${h.ctas.map(c => `<a class="btn${c.style !== 'plain' ? ' btn--' + c.style : ''}" href="${href(c.href)}">${esc(c.label)}</a>`).join('')}</div>`;

    // Hero tiles: one glyph from each script's sample phrase.
    const byCode = Object.fromEntries(scripts.map(s => [s.code, s]));
    const colors = ['pink', 'yellow', 'blue', 'green', 'orange', 'card'];
    const spots = [[4, 6, -6, 34], [44, 0, 5, 30], [64, 40, -3, 32], [8, 50, 4, 30], [36, 70, -5, 28], [70, 74, 7, 24]];
    $('#hero-art').innerHTML = h.hero_scripts.map((code, i) => {
      const s = byCode[code]; if (!s) return '';
      const [x, y, r, size] = spots[i % spots.length];
      const glyph = [...(s.sample || s.specimen || s.code)].find(c => /\p{L}/u.test(c));
      return `<a class="tile" href="${scriptUrl(code)}" title="${esc(s.name)}" tabindex="-1" style="left:${x}%;top:${y}%;width:${size}%;height:${size}%;transform:rotate(${r}deg);background:var(--${colors[i % colors.length]});${colors[i % colors.length] === 'blue' ? 'color:#fff;' : ''}">${esc(glyph)}</a>`;
    }).join('');

    /* stats */
    $('#numbers-title').textContent = h.numbers_title;
    Blocks.stats($('#home-stats'), h.numbers, stats);

    /* mission */
    const m = site.mission;
    $('#home-mission').innerHTML = `
      <div class="grid grid-2" style="align-items:center">
        <div><span class="kicker">${esc(m.kicker)}</span><h2>${esc(m.title)}</h2><p class="statement">${esc(m.statement)}</p>
          <a class="btn btn--yellow" href="${href('pages/mission.html')}">Read the mission →</a></div>
        <div class="grid grid-2">${m.pillars.slice(0, 4).map((p, i) => `
          <div class="card card--${p.color} ${i % 2 ? 'tilt-r' : 'tilt-l'}"><div style="font-size:1.8rem">${esc(p.icon)}</div><h3>${esc(p.title)}</h3><p class="small">${esc(p.text)}</p></div>`).join('')}</div>
      </div>`;

    /* deliverables */
    $('#deliver-head').innerHTML = `<div><span class="kicker">${esc(m.deliverables_kicker)}</span><h2>${esc(m.deliverables_title)}</h2></div>`;
    Blocks.deliverables($('#home-deliverables'), m, projects);

    /* directory teaser */
    const d = h.directory_teaser;
    $('#directory-head').innerHTML = `<div><span class="kicker">${esc(d.kicker)}</span><h2>${esc(d.title)}</h2><p>${esc(d.text)}</p></div>
      <div class="btn-row"><a class="btn btn--pink" href="${href('pages/languages.html')}">Languages →</a><a class="btn btn--blue" href="${href('pages/scripts.html')}">Scripts →</a></div>`;

    const languages = await data.languages();
    const byIso = Object.fromEntries(languages.map(l => [l.i, l]));
    $('#directory-examples').innerHTML = `
      <h3>${esc(d.examples_title)}</h3>
      <div class="grid grid-2">${d.language_examples.map(i => byIso[i]).filter(Boolean).map(l => `
        <a class="card" href="${langUrl(l.i)}"><span class="sticker" style="--sticker:${(taxonomy.macroareas[l.m] || {}).color || 'var(--yellow)'}">${esc(l.i)}</span>
          <h3>${esc(l.n)}</h3><p class="small muted">${esc(l.f || '')}${l.m ? ' · ' + esc(l.m) : ''}</p></a>`).join('')}</div>
      <div class="chips" style="margin-top:22px">${d.script_examples.map(c => byCode[c]).filter(Boolean).map(s => `<a class="chip" href="${scriptUrl(s.code)}">${esc(s.name)} · ${esc(s.code)}</a>`).join('')}</div>`;

    const map = Blocks.makeMap($('#home-map'), { scrollWheelZoom: false });
    Blocks.languageDots(map, languages, taxonomy, { radius: 3 });
    Blocks.legend($('#home-legend'), Object.entries(taxonomy.macroareas).map(([k, v]) => [k, v.color]));

    /* projects */
    $('#projects-head').innerHTML = `<div><span class="kicker">GlotSuite</span><h2>${esc(h.projects_title)}</h2><p>${esc(h.projects_text)}</p></div>
      <a class="btn" href="${href('pages/projects.html')}">All projects →</a>`;
    $('#home-projects').innerHTML = projects.map(p => projectCard(p, taxonomy)).join('');

    /* glotsuite */
    const g = site.glotsuite;
    $('#home-glotsuite').innerHTML = `<div class="card card--yellow callout">
      <div style="display:flex;gap:20px;align-items:center;flex-wrap:wrap">
        <img src="${href(g.logo)}" alt="GlotSuite" width="120" height="120" style="width:120px;height:120px;background:#fffaf0;border:2.5px solid var(--line-c);border-radius:18px;padding:10px">
        <div style="flex:1;min-width:220px"><h2>${esc(g.title)}</h2><p>${esc(g.lead)}</p></div>
      </div>
      <div class="btn-row"><a class="btn" href="${href('pages/glotsuite.html')}">How it fits →</a><a class="btn btn--pink" href="${g.home_url}"${extAttrs(g.home_url)}>${esc(g.home_label)} ↗</a></div>
    </div>`;

    /* cta */
    $('#home-cta').innerHTML = `<div class="card card--blue callout"><div><h2>${esc(h.cta.title)}</h2><p>${esc(h.cta.text)}</p></div>
      <a class="btn btn--yellow" href="${href(h.cta.button.href)}">${esc(h.cta.button.label)}</a></div>`;
  } catch (e) { CG.showError($('#hero-text'), e); }
})();
