# commonglot.github.io

The website of **CommonGlot**: the open home of GlotSuite, plus a directory with a booklet for every language and every writing system that records what technology exists for it.

Live at <https://commonglot.github.io>.

## Pages

| Page | File | What it shows |
|---|---|---|
| Home | `index.html` | Mission, numbers, deliverables tabs, directory teaser with map, projects, GlotSuite |
| Mission | `pages/mission.html` | Mission statement, pillars, deliverables, principles |
| Projects | `pages/projects.html` | All GlotSuite projects, tabbed by type and pipeline stage |
| Project booklet | `pages/project.html?id=glotlid` | Overview, numbers, usage snippet, BibTeX, related projects |
| Languages | `pages/languages.html` | Search + filters, map, sortable directory, families, coverage gaps |
| Language booklet | `pages/language.html?iso=haw` | Facts, mini-map, technology coverage, writing systems, neighbours, raw data |
| Scripts | `pages/scripts.html` | Gallery, table and OCR leaderboard for every ISO 15924 script |
| Script booklet | `pages/script.html?code=Adlm` | Specimen, languages, per-model OCR results, Unicode ranges |
| GlotSuite | `pages/glotsuite.html` | Pipeline, timeline, adoption, link to the GlotSuite homepage |
| Open data | `pages/data.html` | Every JSON file, its schema, sources and licences |
| About | `pages/about.html` | Team, affiliations, how to contribute, FAQ |

Filters on the directory pages are kept in the URL (e.g. `pages/languages.html?area=Africa&tech=L#map`), so any view can be shared.

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
assets/css/style.css      design system: tokens, light/dark, components, breakpoints
assets/js/main.js         shared runtime: data loading, header/footer, tabs, tables, helpers
assets/js/blocks.js       shared blocks: Leaflet maps, deliverables tabs, stats
assets/js/pages/*.js      one script per page
```

## Run locally

The pages load JSON with `fetch`, so serve the folder over HTTP:

```bash
python3 -m http.server 8000
# open http://localhost:8000
```

## Credits

Design inspired by [hadro/flipbook](https://github.com/hadro/flipbook) and [runemic.com](https://runemic.com). Maps use [Leaflet](https://leafletjs.com) with CARTO/OpenStreetMap tiles. Language metadata © [Glottolog](https://glottolog.org) (CC BY 4.0).
