/* Reusable page blocks shared by several pages (maps, deliverables tabs, stats). */

const Blocks = (() => {
  const { esc, href, extAttrs, langUrl, fmt } = CG;

  /* ---------- maps ---------- */
  // Tile config lives in data/site.json (map). The CARTO key comes from data/runtime.json, written at
  // deploy time from the CARTO_API_KEY repository secret; without it we fall back to keyless tiles.
  const tileConfig = Promise.all([
    CG.data.site(),
    CG.getJSON('data/runtime.json').catch(() => ({})),
  ]).then(([site, runtime]) => {
    const m = site.map, key = String(runtime.carto_api_key || '').trim();
    const extra = m.data_attribution ? ' · ' + m.data_attribution : '';
    if (key) {
      const withKey = u => u.replace('{key}', encodeURIComponent(key));
      return { light: withKey(m.tiles.light), dark: withKey(m.tiles.dark), attribution: m.attribution + extra, dim: false };
    }
    return { light: m.fallback.tiles, dark: m.fallback.tiles, attribution: m.fallback.attribution + extra, dim: true };
  });

  function makeMap(el, { center = [15, 10], zoom = 2, minZoom = 1, scrollWheelZoom = true } = {}) {
    const map = L.map(el, { preferCanvas: true, worldCopyJump: true, minZoom, scrollWheelZoom, zoomControl: true }).setView(center, zoom);
    let layer;
    tileConfig.then(cfg => {
      const setTiles = () => {
        const theme = document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
        if (layer) map.removeLayer(layer);
        layer = L.tileLayer(cfg[theme], { attribution: cfg.attribution, maxZoom: 12 }).addTo(map);
        // Keyless fallback tiles have no dark style; dim them in dark mode instead.
        el.classList.toggle('dark-tiles', cfg.dim && theme === 'dark');
      };
      setTiles();
      document.addEventListener('cg:theme', setTiles);
    });
    return map;
  }

  function languageDots(map, languages, taxonomy, { colorBy = 'macroarea', radius = 4 } = {}) {
    const renderer = L.canvas({ padding: 0.5 });
    const group = L.layerGroup().addTo(map);
    const colorFor = l => {
      if (colorBy === 'endangerment') return (taxonomy.endangerment[l.e] || {}).color || '#999';
      if (colorBy === 'coverage') return l.t && l.t.includes('L') ? '#ff48b0' : '#8a8173';
      return (taxonomy.macroareas[l.m] || {}).color || '#999';
    };
    languages.forEach(l => {
      if (l.y == null) return;
      L.circleMarker([l.y, l.x], {
        renderer, radius, weight: 1, color: '#16130f', fillColor: colorFor(l), fillOpacity: .85,
      }).bindPopup(() => popup(l, taxonomy), { maxWidth: 260 }).addTo(group);
    });
    return group;
  }

  function popup(l, taxonomy) {
    const end = taxonomy.endangerment[l.e];
    return `<strong style="font-size:1rem">${esc(l.n)}</strong> <code>${esc(l.i)}</code><br>
      ${esc(l.f || 'Unclassified')} · ${esc(l.m || '')}<br>
      ${end ? `Status: ${esc(end.label)}<br>` : ''}
      Scripts: ${esc((l.s || []).join(', ') || '–')}<br>
      <a href="${langUrl(l.i)}">Open booklet →</a>`;
  }

  function legend(el, entries) {
    el.innerHTML = entries.map(([label, color]) => `<span class="item"><span class="sw" style="background:${CG.tok(color)}"></span>${esc(label)}</span>`).join('');
  }

  /* ---------- deliverables (vertical tabs) ---------- */
  function deliverables(container, mission, projects) {
    const byId = Object.fromEntries(projects.map(p => [p.id, p]));
    const items = mission.deliverables.map(d => ({ id: d.id, label: d.label, accent: d.color }));
    container.innerHTML = `<div class="deliver">${CG.tabMarkup('dlv', items, { vertical: true })}
      <div>${mission.deliverables.map(d => `
        <div class="card deliver-panel" ${CG.panelAttrs('dlv', d.id)}>
          <span class="sticker" style="--sticker:var(--${CG.tok(d.color)})">${esc(d.label)}</span>
          <h3>${esc(d.title)}</h3>
          <p class="muted">${esc(d.text)}</p>
          <ul class="outputs">${d.outputs.map(o => `<li>${esc(o)}</li>`).join('')}</ul>
          <div class="btn-row">
            ${d.projects.map(id => byId[id]).filter(Boolean).map(p => `<a class="btn btn--sm" href="${CG.projectUrl(p.id)}"><img src="${href('assets/img/' + p.logo)}" alt="" width="20" height="20">${esc(p.name)}</a>`).join('')}
            ${(d.links || []).map(l => `<a class="btn btn--sm btn--${CG.tok(d.color)}" href="${href(l.href)}"${extAttrs(l.href)}>${esc(l.label)} →</a>`).join('')}
          </div>
        </div>`).join('')}</div></div>`;
    CG.tabs(container);
  }

  /* ---------- stats band ---------- */
  function stats(el, defs, values) {
    el.innerHTML = defs.map(d => `<div class="stat"><b>${values[d.stat] != null ? fmt(values[d.stat]) : esc(d.value || '–')}</b><span>${esc(d.label)}</span></div>`).join('');
  }

  return { makeMap, languageDots, legend, deliverables, stats, popup };
})();
