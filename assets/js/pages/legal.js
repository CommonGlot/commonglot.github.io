/* Privacy Policy and Terms of Use: <body data-doc="privacy|terms"> selects the document in data/legal.json. */
(async () => {
  const { esc, $, href, extAttrs, data, getJSON } = CG;
  try {
    const [site, legal] = await Promise.all([data.site(), getJSON('data/legal.json')]);
    const doc = legal[document.body.dataset.doc];
    if (!doc) throw new Error('unknown document');
    const links = ls => ls ? `<p class="chips">${ls.map(l => `<a class="chip" href="${href(l.href)}"${extAttrs(l.href)}>${esc(l.label)} ↗</a>`).join('')}</p>` : '';
    const list = items => items ? `<ul class="legal-list">${items.map(i => `<li><a href="${href(i.href)}"${extAttrs(i.href)}>${esc(i.label)}</a> — ${esc(i.text)}</li>`).join('')}</ul>` : '';
    const sources = () => `<div class="table-wrap"><table><thead><tr><th>Source</th><th>Licence</th></tr></thead><tbody>
      ${site.sources.map(s => `<tr><td><a href="${href(s.url)}"${extAttrs(s.url)}>${esc(s.name)}</a></td><td>${esc(s.license)}</td></tr>`).join('')}</tbody></table></div>`;
    const id = h => h.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

    $('#legal-hero').innerHTML = `<span class="kicker">${esc(doc.kicker)}</span><h1>${esc(doc.title)}</h1>
      <p class="muted">Last updated <time datetime="${esc(doc.updated)}">${esc(new Date(doc.updated + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }))}</time></p>
      <div class="card card--yellow" style="margin-top:20px"><h2 class="h3">In short</h2><ul class="legal-list">${doc.summary.map(s => `<li>${esc(s)}</li>`).join('')}</ul></div>`;
    $('#legal-toc').innerHTML = `<div class="card"><h2 class="h3">Contents</h2><ol class="legal-toc">${doc.sections.map(s => `<li><a href="#${id(s.h)}">${esc(s.h)}</a></li>`).join('')}</ol></div>`;
    $('#legal-body').innerHTML = doc.sections.map(s => `
      <section class="legal-section" id="${id(s.h)}"><h2>${esc(s.h)}</h2>
        ${s.p.map(p => `<p>${esc(p)}</p>`).join('')}${list(s.list)}${s.include === 'sources' ? sources() : ''}${links(s.links)}
      </section>`).join('');
  } catch (e) { CG.showError($('#legal-hero'), e); }
})();
