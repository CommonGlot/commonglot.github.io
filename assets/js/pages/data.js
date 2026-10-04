(async () => {
  const { esc, $, href, data, codeBlock, fmt } = CG;
  try {
    const [site, stats] = await Promise.all([data.site(), data.stats()]);
    const D = site.data_page;
    $('#data-hero').innerHTML = `<span class="kicker">${esc(D.kicker)}</span><h1>${esc(D.title)}</h1><p class="lead">${esc(D.lead)}</p>
      <p class="small muted" style="margin-top:12px">Last built ${esc(stats.generated)} · ${fmt(stats.languages_in_directory)} languages · ${fmt(stats.scripts_in_glotscript)} scripts</p>`;
    $('#data-files').innerHTML = D.files.map(f => {
      const link = f.path.includes('{') ? href(f.path.replace('{letter}', 'a')) : href(f.path);
      return `<div class="card"><span class="sticker">JSON</span><h3>${esc(f.title)}</h3><p><code>${esc(f.path)}</code></p><p class="muted small">${esc(f.text)}</p>
        ${f.keys ? `<dl class="facts">${Object.entries(f.keys).map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join('')}</dl>` : ''}
        <a class="btn btn--sm btn--yellow" href="${link}" download>Download${f.path.includes('{') ? ' (a.json)' : ''}</a></div>`;
    }).join('');
    $('#data-rebuild').innerHTML = `<h2>${esc(D.rebuild_title)}</h2>${codeBlock(D.rebuild_code, 'bash')}`;
    $('#data-sources').innerHTML = `<h2>${esc(D.sources_title)}</h2><div class="table-wrap"><table><thead><tr><th>Source</th><th>Used for</th><th>Licence</th></tr></thead><tbody>
      ${site.sources.map(s => `<tr><td><a href="${s.url}" target="_blank" rel="noopener">${esc(s.name)}</a></td><td class="small">${esc(s.use)}</td><td class="small">${esc(s.license)}</td></tr>`).join('')}
    </tbody></table></div>`;
  } catch (e) { CG.showError($('#data-hero'), e); }
})();
