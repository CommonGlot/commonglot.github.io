(async () => {
  const { esc, $, data } = CG;
  try {
    const [site, projects] = await Promise.all([data.site(), data.projects()]);
    const m = site.mission;
    $('#mission-hero').innerHTML = `<span class="kicker">${esc(m.kicker)}</span><h1>${esc(m.title)}</h1><p class="statement">${esc(m.statement)}</p>`;
    $('#pillars').insertAdjacentHTML('beforebegin', `<h2 class="visually-hidden">${esc(m.pillars_title)}</h2>`);
    $('#pillars').innerHTML = m.pillars.map((p, i) => `
      <div class="card card--${CG.tok(p.color)} ${i % 2 ? 'tilt-r' : 'tilt-l'}"><div style="font-size:2rem">${esc(p.icon)}</div><h3>${esc(p.title)}</h3><p class="small">${esc(p.text)}</p></div>`).join('');
    $('#mission-body').innerHTML = `
      <div class="prose">${m.paragraphs.slice(0, 2).map(p => `<p>${esc(p)}</p>`).join('')}</div>
      <div class="prose">${m.paragraphs.slice(2).map(p => `<p>${esc(p)}</p>`).join('')}</div>`;
    $('#deliver-head').innerHTML = `<div><span class="kicker">${esc(m.deliverables_kicker)}</span><h2>${esc(m.deliverables_title)}</h2></div>`;
    Blocks.deliverables($('#mission-deliverables'), m, projects);
    $('#principles-head').innerHTML = `<div><h2>${esc(m.principles_title)}</h2></div>`;
    $('#principles').innerHTML = m.principles.map((p, i) => `
      <div class="card"><span class="sticker">0${i + 1}</span><h3>${esc(p.title)}</h3><p class="muted">${esc(p.text)}</p></div>`).join('');
  } catch (e) { CG.showError($('#mission-hero'), e); }
})();
