(async () => {
  const { esc, $, href, tok, data } = CG;
  try {
    const n = (await data.site()).not_found;
    $('#nf').innerHTML = `<span class="kicker">404</span><h1>${esc(n.title)}</h1><p class="lead">${esc(n.text)}</p>
      <div class="btn-row" style="margin-top:24px">${n.links.map(l => `<a class="btn${l.style !== 'plain' ? ' btn--' + tok(l.style) : ''}" href="${href(l.href)}">${esc(l.label)}</a>`).join('')}</div>`;
  } catch (e) { CG.showError($('#nf'), e); }
})();
