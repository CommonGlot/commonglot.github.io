# commonglot.github.io

The website of **CommonGlot**: the open home of GlotSuite, plus a directory with a booklet for every language and every writing system that records what technology exists for it.

Live at <https://commonglot.github.io>.

## Pages

| Page | URL | Source |
|---|---|---|
| Home | `/` | `index.html` |
| Mission | `/mission/` | `mission/index.html` |
| Projects | `/projects/` | `projects/index.html` |
| Project booklet | `/projects/glotlid/` | generated from `templates/project.html` |
| Languages | `/languages/` (filters in the query, e.g. `?area=Africa&tech=L#map`) | `languages/index.html` |
| Language booklet | `/languages/haw/` | generated from `templates/language.html` |
| Languages A–Z | `/languages/browse/a/` | generated from `templates/browse.html` |
| Scripts | `/scripts/` | `scripts/index.html` |
| Script booklet | `/scripts/Adlm/` | generated from `templates/script.html` |
| GlotSuite | `/glotsuite/` | `glotsuite/index.html` |
| Open data | `/open-data/` | `open-data/index.html` |
| About · Privacy · Terms | `/about/` · `/privacy/` · `/terms/` | `*/index.html` |

Old `pages/*.html` URLs redirect to the new ones.

## No hard-coded content

HTML files are thin shells. All text and numbers come from `data/`:

- `data/site.json`: all page copy, navigation, team, sources and footer
- `data/taxonomy.json`: labels and colours (macroareas, endangerment, coverage flags, script types) and external link templates
- `data/projects.json`: GlotSuite projects (links, numbers, usage, BibTeX)
- `data/languages/index.json`, `data/languages/details/*.json`, `data/scripts.json`, `data/ocr_models.json`, `data/generated_stats.json`: **generated** by `tools/build_data.py`

### Rebuilding the generated data

```bash
mkdir -p src
git clone --depth 1 https://github.com/glottolog/glottolog-cldf src/glottolog-cldf
for r in GlotScript GlotLID GlotWeb GlotOCR-bench; do git clone --depth 1 https://github.com/cisnlp/$r src/$r; done
pip install pycountry
python3 tools/build_data.py --sources src
```

The only hand-curated inputs are in `tools/curated/scripts_meta.json` (script typology, sample phrases, web-font names).

## Code layout

```
assets/css/style.css      design system: colour tokens, light/dark, components, breakpoints
assets/js/main.js         shared runtime: data loading, header/footer, tabs, tables, helpers
assets/js/blocks.js       shared blocks: Leaflet maps, deliverables tabs, stats
assets/js/pages/*.js      one script per page
```

## Security

- All text from JSON or the URL is HTML-escaped (`CG.esc`) before it reaches `innerHTML`.
- Every URL written into the page goes through `CG.href`, which allows only `http(s)`, `mailto`, in-page anchors and site-relative paths (so `javascript:` / `data:` links are dropped).
- Colours, ids and class suffixes from data go through `CG.tok` (`[A-Za-z0-9_#-]` only).
- Each page sets a Content-Security-Policy: scripts only from the site and cdnjs (plus the hash-pinned theme snippet), `connect-src 'self'`, no plugins, no form submissions.
- The site is fully static, with no forms, cookies, accounts or state-changing requests, so there is nothing for CSRF to target.

## Build and deploy

The repository is a working static site, but what gets deployed is `_site/`, built by
`.github/workflows/pages.yml` on every push to `main`:

1. `tools/build_site.py`: copies the site and generates the booklet and A–Z pages, per-page
   `<title>`, description, canonical URL, Open Graph/Twitter tags, JSON-LD (Organization, WebSite,
   BreadcrumbList, Language, DefinedTerm, SoftwareSourceCode/Dataset), static header and footer,
   `sitemap.xml` (with `lastmod` from git history), `robots.txt`, `site.webmanifest` and legacy redirects.
2. `tools/prerender.mjs`: renders the JavaScript-driven top-level pages to static HTML in headless Chromium.
3. esbuild minifies JS and CSS.
4. `tools/check_site.py`: fails the deploy on broken internal links, orphan pages, sitemap gaps,
   duplicate titles or descriptions, missing canonical/OG tags, invalid JSON-LD, missing `alt`,
   or heading-level jumps.

Page titles, descriptions and SEO settings (site URL, organization, Search Console / Bing
verification tokens) live in `data/site.json` under `pages` and `seo`.

## Run locally

```bash
python3 tools/build_site.py --out _site
npm install --no-save playwright leaflet && npx playwright install chromium
node tools/prerender.mjs _site          # optional: static top-level pages
python3 tools/check_site.py _site
python3 -m http.server 8000 --directory _site
```

Serving the repository root directly also works for quick edits, except the generated booklet pages.

## Credits

Design: navy ink on a soft blue-grey page with one blue accent and pill buttons, set in [Source Sans 3](https://fonts.google.com/specimen/Source+Sans+3) and [Source Code Pro](https://fonts.google.com/specimen/Source+Code+Pro). The hero pattern uses letters from many scripts. Maps use [Leaflet](https://leafletjs.com) with CARTO/OpenStreetMap tiles. Language metadata © [Glottolog](https://glottolog.org) (CC BY 4.0).
