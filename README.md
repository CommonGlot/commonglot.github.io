# commonglot.github.io

The website for **CommonGlot**: open tools, corpora and benchmarks so that NLP technology reaches every language. A non-profit initiative from CIS-LMU Munich and Sorbonne Université.

Live at <https://commonglot.github.io>.

## Pages

| Page | Path |
|---|---|
| Home | `index.html` |
| Languages | `pages/languages.html` — browse 7,500+ languages with map and coverage data |
| Writing Systems | `pages/scripts.html` — explore 175 scripts with specimens and OCR benchmarks |
| Project detail | `pages/project.html?id=glotlid` — one page per GlotSuite project |
| Privacy | `pages/privacy.html` |
| Terms | `pages/terms.html` |
| 404 | `404.html` |

## Architecture

The site is fully static — vanilla HTML, CSS and JavaScript with no build step. All content is driven by JSON files in `data/`:

- `data/projects.json` — GlotSuite projects (links, stars, venues)
- `data/languages/index.json` — compact language records (ISO code, name, family, coordinates, tools coverage)
- `data/scripts.json` — writing systems (type, direction, specimens, font names, OCR benchmarks)
- `data/runtime.json` — injected at deploy time by GitHub Actions (CARTO API key for map tiles)

Shared JavaScript (`assets/js/main.js`) renders the header, footer, theme toggle, filter tabs, search, and table sort. Each page has an inline `<script>` that loads its JSON and renders cards/tables/overlays.

## Code layout

```
index.html                  home page — project cards, explore section
pages/                      sub-pages (languages, scripts, project detail, privacy, terms)
assets/css/style.css        all styles: colour tokens, light/dark mode, components, responsive
assets/js/main.js           shared runtime: header, footer, theme, tabs, search, helpers
assets/img/                 logos (SVG marks for each project)
data/                       JSON data files
.github/workflows/pages.yml deploy workflow (injects CARTO_API_KEY into runtime.json)
```

## Features

- **Dark/light theme** — auto-detects system preference, toggle in header, saved to localStorage
- **Language map** — Leaflet with canvas renderer for 7,500+ circle markers, colour-coded by endangerment
- **Script specimens** — lazy-loads Noto fonts from Google Fonts and Fontsource/jsDelivr CDN
- **OCR quality indicators** — colour-coded CER badges (green ≤30%, yellow ≤70%, grey >70%)
- **Responsive** — works on mobile with collapsible hamburger menu
- **No cookies or tracking** — only localStorage for theme preference

## Run locally

```bash
python3 -m http.server 8000
# open http://localhost:8000
```

The map tiles require a CARTO API key. Create `data/runtime.json` with:
```json
{ "CARTO_API_KEY": "your-key-here" }
```

## Deploy

Pushes to `main` trigger `.github/workflows/pages.yml`, which:
1. Injects the `CARTO_API_KEY` secret into `data/runtime.json`
2. Deploys to GitHub Pages

## Credits

Design set in [Inter](https://fonts.google.com/specimen/Inter). Script specimens use [Noto](https://fonts.google.com/noto) fonts. Maps use [Leaflet](https://leafletjs.com) with CARTO/OpenStreetMap tiles. Language metadata from [Glottolog](https://glottolog.org) (CC BY 4.0).

## License

[Apache License 2.0](LICENSE)
