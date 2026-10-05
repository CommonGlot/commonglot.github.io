#!/usr/bin/env python3
"""Build the deployable site into _site/: crawlable pages, SEO metadata, sitemap.

The repository is a working static site on its own; this step adds what search
engines and social networks need:

  * a static booklet page per language (/languages/<iso>/), script
    (/scripts/<code>/) and project (/projects/<id>/) with real content in the HTML
  * A–Z browse pages so every booklet is reachable through plain links
  * per-page <title>, meta description, canonical URL, robots, author,
    Open Graph / Twitter tags and JSON-LD (Organization, WebSite, BreadcrumbList,
    Language, DefinedTerm, SoftwareSourceCode / Dataset)
  * static header and footer markup (main.js replaces it on load)
  * sitemap.xml with lastmod, robots.txt, site.webmanifest
  * noindex redirect pages for legacy URLs

Everything comes from data/*.json. Usage:  python3 tools/build_site.py [--out _site]
Then run tools/prerender.mjs (fills JS-rendered top-level pages) and tools/check_site.py.
"""

import argparse
import datetime
import html
import json
import re
import shutil
import subprocess
import unicodedata
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SKIP = {".git", ".github", "tools", "templates", "node_modules", "_site", ".gitignore", "README.md"}


def esc(s):
    return html.escape(str(s if s is not None else ""), quote=True)


def load(name):
    return json.loads((ROOT / "data" / name).read_text(encoding="utf-8"))


def git_date(*paths):
    """Last commit date (YYYY-MM-DD) touching any of the paths; today if unknown."""
    try:
        out = subprocess.run(["git", "log", "-1", "--format=%cs", "--", *paths], cwd=ROOT,
                             capture_output=True, text=True, check=True).stdout.strip()
        return out or TODAY
    except (subprocess.CalledProcessError, FileNotFoundError):
        return TODAY


def slug_letter(name):
    """First letter for A–Z browsing; names starting with a non-letter go under '#'."""
    for ch in unicodedata.normalize("NFD", name):
        if ch.isalpha():
            ch = ch.lower()
            return ch if "a" <= ch <= "z" else "other"
    return "other"


def jsonld(obj):
    # Escape "<" so a value can never close the script element.
    return '<script type="application/ld+json">' + json.dumps(obj, ensure_ascii=False, separators=(",", ":")).replace("<", "\\u003c") + "</script>"


TODAY = datetime.date.today().isoformat()


class Site:
    def __init__(self, out):
        self.out = out
        self.site = load("site.json")
        self.seo = self.site["seo"]
        self.url = self.seo["site_url"].rstrip("/") + "/"
        self.tax = load("taxonomy.json")
        self.projects = load("projects.json")
        self.scripts = load("scripts.json")
        self.languages = load("languages/index.json")
        self.stats = load("generated_stats.json")
        self.lang_by_iso = {l["i"]: l for l in self.languages}
        self.script_by_code = {s["code"]: s for s in self.scripts}
        self.details = {}
        for shard in (ROOT / "data" / "languages" / "details").glob("*.json"):
            self.details.update(json.loads(shard.read_text(encoding="utf-8")))
        self.sitemap = []  # (path, lastmod, priority)
        self.data_date = self.stats.get("generated", TODAY)

    # ------------------------------------------------------------ helpers --
    def abs(self, path):
        return self.url + path

    def rel(self, depth, path):
        return "../" * depth + path if depth else ("./" + path if path else "./")

    def org_node(self):
        o = self.seo["organization"]
        return {
            "@type": "Organization", "@id": self.url + "#organization", "name": o["name"], "alternateName": o.get("alternate_name"), "legalName": o["name"], "url": o["url"],
            "logo": {"@type": "ImageObject", "url": self.abs(o["logo"]), "width": 512, "height": 512},
            "description": o["description"], "sameAs": o["same_as"],
            "contactPoint": {"@type": "ContactPoint", "contactType": "technical support", "url": o["contact_url"], "availableLanguage": "en"},
        }

    def website_node(self):
        return {
            "@type": "WebSite", "@id": self.url + "#website", "url": self.url, "name": self.seo["site_name"],
            "description": self.site["brand"]["description"], "inLanguage": self.seo["language"],
            "publisher": {"@id": self.url + "#organization"},
            "potentialAction": {"@type": "SearchAction",
                                "target": {"@type": "EntryPoint", "urlTemplate": self.url + "languages/?q={search_term_string}"},
                                "query-input": "required name=search_term_string"},
        }

    def breadcrumb_node(self, path, crumbs):
        return {"@type": "BreadcrumbList", "@id": self.abs(path) + "#breadcrumb",
                "itemListElement": [{"@type": "ListItem", "position": i + 1, "name": name, "item": self.abs(p)}
                                    for i, (name, p) in enumerate(crumbs)]}

    def head(self, *, path, title, description, page_type="WebPage", crumbs=None, main_entity=None,
             date_modified=None, noindex=False, extra_nodes=()):
        s = self.seo
        canonical = self.abs(path)
        image = self.abs(s["og_image"])
        if path:  # full Organization/WebSite nodes live on the home page; other pages reference them compactly
            o = self.seo["organization"]
            graph = [{"@type": "Organization", "@id": self.url + "#organization", "name": o["name"], "url": o["url"],
                      "logo": self.abs(o["logo"])},
                     {"@type": "WebSite", "@id": self.url + "#website", "url": self.url, "name": self.seo["site_name"]}]
        else:
            graph = [self.org_node(), self.website_node()]
        page = {"@type": page_type, "@id": canonical + "#webpage", "url": canonical, "name": title,
                "description": description, "isPartOf": {"@id": self.url + "#website"},
                "inLanguage": s["language"], "publisher": {"@id": self.url + "#organization"},
                "primaryImageOfPage": {"@type": "ImageObject", "url": image},
                "dateModified": date_modified or TODAY}
        if crumbs:
            graph.append(self.breadcrumb_node(path, crumbs))
            page["breadcrumb"] = {"@id": canonical + "#breadcrumb"}
        if main_entity:
            page["mainEntity"] = main_entity
        graph.append(page)
        graph.extend(extra_nodes)
        robots = "noindex, follow" if noindex else "index, follow, max-image-preview:large, max-snippet:-1"
        tags = [
            f'<title>{esc(title)}</title>',
            f'<meta name="description" content="{esc(description)}">',
            f'<meta name="robots" content="{robots}">',
            f'<meta name="author" content="{esc(s["author"])}">',
            f'<link rel="canonical" href="{esc(canonical)}">',
            f'<meta property="og:type" content="website">',
            f'<meta property="og:site_name" content="{esc(s["site_name"])}">',
            f'<meta property="og:locale" content="{esc(s["locale"])}">',
            f'<meta property="og:title" content="{esc(title)}">',
            f'<meta property="og:description" content="{esc(description)}">',
            f'<meta property="og:url" content="{esc(canonical)}">',
            f'<meta property="og:image" content="{esc(image)}">',
            '<meta property="og:image:width" content="1200">',
            '<meta property="og:image:height" content="630">',
            f'<meta property="og:image:alt" content="{esc(s["og_image_alt"])}">',
            '<meta name="twitter:card" content="summary_large_image">',
            f'<meta name="twitter:title" content="{esc(title)}">',
            f'<meta name="twitter:description" content="{esc(description)}">',
            f'<meta name="twitter:image" content="{esc(image)}">',
            f'<meta name="twitter:image:alt" content="{esc(s["og_image_alt"])}">',
        ]
        if s.get("twitter_site"):
            tags.append(f'<meta name="twitter:site" content="{esc(s["twitter_site"])}">')
        if s["verification"].get("google"):
            tags.append(f'<meta name="google-site-verification" content="{esc(s["verification"]["google"])}">')
        if s["verification"].get("bing"):
            tags.append(f'<meta name="msvalidate.01" content="{esc(s["verification"]["bing"])}">')
        depth = path.count("/")
        tags += [
            f'<link rel="icon" href="{self.rel(depth, "assets/img/commonglot-mark.svg")}" type="image/svg+xml">',
            f'<link rel="icon" href="{self.rel(depth, "assets/img/icon-32.png")}" type="image/png" sizes="32x32">',
            f'<link rel="apple-touch-icon" href="{self.rel(depth, "assets/img/apple-touch-icon.png")}">',
            f'<link rel="manifest" href="{self.rel(depth, "site.webmanifest")}">',
            jsonld({"@context": "https://schema.org", "@graph": graph}),
        ]
        return "\n  ".join(tags)

    def chrome(self, depth, page_key):
        """Static header + footer markup, identical to what main.js renders."""
        b, s = self.site["brand"], self.site
        tag = f'<small class="brand-tag">{esc(b["status"])}</small>' if b.get("status") else ""
        r = lambda h: h if re.match(r"^(https?:|#)", h) else self.rel(depth, h)
        ext = lambda h: ' target="_blank" rel="noopener"' if h.startswith("http") else ""
        current = ' aria-current="page"'
        nav = "".join(f'<li><a href="{esc(r(n["href"]))}"{current if n["key"] == page_key else ""}>{esc(n["label"])}</a></li>' for n in s["nav"])
        header = (f'<a class="skip-link" href="#main">Skip to content</a>'
                  f'<header class="site-header"><div class="container header-inner">'
                  f'<a class="brand" href="{esc(r(""))}"><img src="{esc(r(b["logo"]))}" alt="" width="34" height="40"><span>{esc(b["name"])}</span>{tag}</a>'
                  f'<nav class="nav" id="site-nav" aria-label="Main"><ul>{nav}</ul></nav>'
                  f'<div class="header-tools"><button class="icon-btn" id="theme-btn" type="button" aria-label="Switch theme">☾</button>'
                  f'<button class="icon-btn menu-btn" id="menu-btn" type="button" aria-controls="site-nav" aria-expanded="false" aria-label="Open menu"><span></span></button></div>'
                  f'</div></header>')
        f = s["footer"]
        cols = "".join(f'<div><h2 class="footer-h">{esc(c["title"])}</h2><ul>' + "".join(f'<li><a href="{esc(r(l["href"]))}"{ext(l["href"])}>{esc(l["label"])}</a></li>' for l in c["links"]) + "</ul></div>" for c in f["columns"])
        legal = "".join(f' · <a href="{esc(r(l["href"]))}">{esc(l["label"])}</a>' for l in f.get("legal_links", []))
        footer = (f'<footer class="site-footer"><div class="container"><div class="footer-grid">'
                  f'<div><div class="footer-brand"><img src="{esc(r(b["logo"]))}" alt="" width="36" height="42">{esc(b["name"])}{tag}</div><p class="footer-blurb">{esc(f["blurb"])}</p></div>'
                  f'{cols}</div><div class="footer-bottom"><span>© {datetime.date.today().year} {esc(b.get("legal_name", b["name"]))}{legal}</span><span>{esc(f["legal"])}</span></div></div></footer>')
        return header, footer

    def render(self, template_html, *, path, head, page_key, body_attrs="", fills=None):
        depth = path.count("/")
        doc = template_html
        # Drop the template's own title/description; insert generated head tags after the viewport meta.
        doc = re.sub(r"\s*<title>.*?</title>", "", doc, flags=re.S)
        doc = re.sub(r'\s*<meta name="description"[^>]*>', "", doc)
        doc = re.sub(r'\s*<link rel="icon"[^>]*>', "", doc)
        doc = doc.replace('<meta name="viewport" content="width=device-width, initial-scale=1">',
                          '<meta name="viewport" content="width=device-width, initial-scale=1">\n  ' + head, 1)
        header, footer = self.chrome(depth, page_key)
        doc = re.sub(r"<body([^>]*)>", lambda m: f"<body{m.group(1)}{body_attrs}>\n{header}", doc, count=1)
        doc = doc.replace("</main>", "</main>\n" + footer, 1)
        for el_id, content in (fills or {}).items():
            doc, n = re.subn(rf'(<(\w+)[^>]*\bid="{el_id}"[^>]*>)(.*?)(</\2>)', lambda m: m.group(1) + content + m.group(4), doc, count=1, flags=re.S)
            if not n:
                raise SystemExit(f"{path}: container #{el_id} not found")
        return doc

    def write(self, path, content, lastmod, priority=0.5, sitemap=True):
        target = self.out / path / "index.html" if path.endswith("/") or path == "" else self.out / path
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(content, encoding="utf-8")
        if sitemap:
            self.sitemap.append((path, lastmod, priority))

    # -------------------------------------------------------------- pages --
    def top_pages(self):
        for p in self.site["pages"]:
            src = (ROOT / p["source"]).read_text(encoding="utf-8")
            crumbs = [("Home", "")] + ([(p["name"], p["path"])] if p["path"] else [])
            js = ROOT / "assets" / "js" / "pages" / (Path(p["source"]).parent.name.replace("-", "") or "home")
            lastmod = git_date(p["source"], str(js) + ".js") if p["path"] else git_date("index.html", "assets/js/pages/home.js")
            main_entity, extra = None, []
            if p["type"] == "Dataset":
                main_entity = self.dataset_entity()
            nodes_page_type = "WebPage" if p["type"] == "Dataset" else p["type"]
            head = self.head(path=p["path"], title=p["title"], description=p["description"], page_type=nodes_page_type,
                             crumbs=crumbs if p["path"] else None, main_entity=main_entity, date_modified=lastmod, extra_nodes=extra)
            key = re.search(r'data-page="([^"]*)"', src).group(1)
            fills = {}
            if p["path"] == "languages/":
                fills["lang-browse"] = self.az_nav(1)
            self.write(p["path"], self.render(src, path=p["path"], head=head, page_key=key, fills=fills), lastmod,
                       1.0 if not p["path"] else 0.8)

    def dataset_entity(self):
        d = self.site["data_page"]
        return {
            "@type": "Dataset", "name": "CommonGlot language and script directory",
            "description": d["lead"] + " " + " ".join(f["text"] for f in d["files"][:3]),
            "url": self.abs("open-data/"), "creator": {"@id": self.url + "#organization"},
            "dateModified": self.data_date, "inLanguage": "en",
            "keywords": ["languages", "writing systems", "ISO 639-3", "ISO 15924", "language identification", "OCR", "low-resource languages"],
            "isBasedOn": [s["url"] for s in self.site["sources"]],
            "distribution": [{"@type": "DataDownload", "encodingFormat": "application/json", "name": f["title"],
                              "contentUrl": self.abs(f["path"].replace("{letter}", "a"))} for f in d["files"]],
        }

    def az_nav(self, depth):
        letters = sorted({slug_letter(l["n"]) for l in self.languages}, key=lambda c: (c == "other", c))
        links = "".join(f'<li><a class="chip" href="{self.rel(depth, "languages/browse/" + c + "/")}">{"#" if c == "other" else c.upper()}</a></li>' for c in letters)
        return f'<h2 class="h3">Browse all languages A–Z</h2><ul class="chips az">{links}</ul>'

    # ----- language booklets
    def language_pages(self):
        tpl = (ROOT / "templates" / "language.html").read_text(encoding="utf-8")
        family_members = defaultdict(list)
        for l in self.languages:
            if l.get("f"):
                family_members[l["f"]].append(l)
        for fam in family_members.values():
            fam.sort(key=lambda x: -(x.get("p") or 0))
        for l in self.languages:
            iso, d = l["i"], self.details.get(l["i"], {})
            path = f"languages/{iso}/"
            title, desc = self.lang_title(l), self.lang_description(l, d)
            crumbs = [("Home", ""), ("Languages", "languages/")] + ([(l["m"], "languages/?area=" + l["m"])] if False else []) + [(l["n"], path)]
            same_as = [u for u in (
                d.get("glottocode") and f"https://glottolog.org/resource/languoid/id/{d['glottocode']}",
                d.get("wikidata") and f"https://www.wikidata.org/wiki/{d['wikidata']}",
                f"https://iso639-3.sil.org/code/{iso}") if u]
            entity = {"@type": "Language", "name": l["n"], "alternateName": [d["endonym"]] if d.get("endonym") and d["endonym"] != l["n"] else None,
                      "identifier": [{"@type": "PropertyValue", "propertyID": "ISO 639-3", "value": iso}] +
                                    ([{"@type": "PropertyValue", "propertyID": "Glottocode", "value": d["glottocode"]}] if d.get("glottocode") else []),
                      "sameAs": same_as, "description": self.lang_sentence(l, d)}
            entity = {k: v for k, v in entity.items() if v}
            head = self.head(path=path, title=title, description=desc, crumbs=crumbs, main_entity=entity, date_modified=self.data_date)
            body = self.lang_static(l, d, family_members.get(l.get("f"), []))
            self.write(path, self.render(tpl, path=path, head=head, page_key="languages", body_attrs=f' data-id="{esc(iso)}"',
                                         fills={"lang-head": body[0], "lang-body": body[1]}), self.data_date, 0.6)

    def script_link(self, code, depth):
        alias = self.tax.get("script_aliases", {}).get(code, {})
        name = self.script_by_code.get(code, {}).get("name") or alias.get("name") or code
        target = code if code in self.script_by_code else alias.get("link") if alias.get("link") in self.script_by_code else None
        return f'<a href="{self.rel(depth, "scripts/" + target + "/")}">{esc(name)}</a>' if target else esc(name)

    def script_name(self, code):
        return self.script_by_code.get(code, {}).get("name") or self.tax.get("script_aliases", {}).get(code, {}).get("name") or code

    def lang_title(self, l):
        return f"{l['n']} language ({l['i']}): scripts, status & language tech · CommonGlot"

    def lang_sentence(self, l, d):
        fam = l.get("f")
        kind = f"{fam} language" if fam and fam not in ("Isolate", "Unclassified", "Bookkeeping") else "language"
        s = f"{l['n']} is {'an' if kind[0].lower() in 'aeiou' else 'a'} {kind}"
        if fam == "Isolate":
            s = f"{l['n']} is a language isolate"
        countries = [c["name"] for c in d.get("countries", [])]
        if countries:
            s += " spoken in " + (", ".join(countries[:3]) + (" and other countries" if len(countries) > 3 else ""))
        elif l.get("m"):
            s += f" of {l['m']}"
        s += "."
        end = self.tax["endangerment"].get(str(l.get("e")))
        if end:
            s += f" Glottolog lists it as {end['label']}."
        written = [c for c in l.get("s", []) if c != "Zxxx"]
        if written:
            s += " It is written in " + ", ".join(self.script_name(c) for c in written[:3]) + "."
        elif l.get("s"):
            s += " It has no established writing system."
        return s

    def lang_description(self, l, d):
        t = l.get("t", "")
        tech = "identified by GlotLID" if "L" in t else "not yet covered by GlotLID"
        sentence = self.lang_sentence(l, d).replace(f"{l['n']} is", f"{l['n']} ({l['i']}) is", 1)
        base = f"{sentence} Writing systems, status and language technology — {tech}."
        return base if len(base) <= 165 else base[:162].rsplit(" ", 1)[0] + "…"

    def lang_static(self, l, d, family):
        iso, depth = l["i"], 2
        r = lambda p: self.rel(depth, p)
        end = self.tax["endangerment"].get(str(l.get("e")))
        crumbs = f'<nav class="breadcrumbs" aria-label="Breadcrumb"><a href="{r("languages/")}">Languages</a> / {esc(l["n"])}</nav>'
        head = (f'{crumbs}<p class="kicker">{esc(l.get("f") or "Unclassified")}{" · " + esc(l["m"]) if l.get("m") else ""}</p>'
                f'<h1>{esc(l["n"])}</h1>' + (f'<p class="endonym" lang="{esc(iso)}">{esc(d["endonym"])}</p>' if d.get("endonym") and d["endonym"] != l["n"] else "") +
                f'<p class="lead">{esc(self.lang_sentence(l, d))}</p>')
        facts = [("ISO 639-3", esc(iso)), ("Glottocode", esc(d.get("glottocode", "–"))),
                 ("Family", esc(l.get("f") or "–")), ("Macroarea", esc(l.get("m") or "–")),
                 ("Countries", esc(", ".join(c["name"] for c in d.get("countries", [])) or "–")),
                 ("Speakers", f'{l["p"]:,}' if l.get("p") else "–"), ("Status", esc(end["label"]) if end else "unknown"),
                 ("Scripts", ", ".join(self.script_link(c, depth) for c in l.get("s", [])) or "–")]
        aside = '<aside><div class="card"><dl class="facts">' + "".join(f"<div><dt>{k}</dt><dd>{v}</dd></div>" for k, v in facts) + "</dl></div></aside>"
        t = l.get("t", "")
        proj = {p["id"]: p for p in self.projects}
        rows = []
        lid = d.get("glotlid", [])
        rows.append(("glotlid", f"{len(lid)} GlotLID v3 label(s): " + ", ".join(f'{esc(x["label"])} (F1 {x["f1"] * 100:.1f}%)' for x in lid) if lid else "No GlotLID label yet."))
        rows.append(("glot500", "Included in Glot500 (" + ", ".join(f"{esc(iso)}_{esc(s)}" for s in d.get("glot500", [])) + ")." if d.get("glot500") else "Not among the Glot500 languages."))
        rows.append(("glotscript", "Writing system recorded in GlotScript-R." if "S" in t else "No writing system recorded."))
        ocr = [self.script_by_code[c] for c in l.get("s", []) if self.script_by_code.get(c, {}).get("ocr")]
        rows.append(("glotocr-bench", "OCR benchmark results: " + ", ".join(f'{esc(s["name"])} best Acc@5 {s["ocr"]["best"]["acc5"]:.1f}%' for s in ocr) + "." if ocr else "None of its scripts are in the OCR benchmark."))
        tech = "<ul>" + "".join(f'<li><a href="{r("projects/" + pid + "/")}">{esc(proj[pid]["name"])}</a>: {txt}</li>' for pid, txt in rows) + "</ul>"
        kin = [x for x in family if x["i"] != iso][:24]
        related = ("<h2>Related languages</h2><ul class=\"lang-list\">" + "".join(f'<li><a href="{r("languages/" + x["i"] + "/")}">{esc(x["n"])}</a><span class="iso">{esc(x["i"])}</span></li>' for x in kin) + "</ul>") if kin else ""
        letter = slug_letter(l["n"])
        main = (f'<div><h2>{esc(self.site["booklet"]["language_tech_title"])}</h2><p class="muted">{esc(self.site["booklet"]["language_tech_text"])}</p>{tech}{related}'
                f'<p><a href="{r("languages/browse/" + letter + "/")}">More languages starting with {"#" if letter == "other" else letter.upper()}</a> · <a href="{r("languages/")}">Language directory</a></p></div>')
        return head, aside + main

    # ----- script booklets
    def script_pages(self):
        tpl = (ROOT / "templates" / "script.html").read_text(encoding="utf-8")
        models = {m["id"]: m["display"] for m in load("ocr_models.json")}
        for s in self.scripts:
            path = f"scripts/{s['code']}/"
            n_lang = len(s["languages"])
            title = f"{s['name']} script ({s['code']}): languages, Unicode & OCR · CommonGlot"
            ocr = f" Best OCR accuracy: {s['ocr']['best']['acc5']:.0f}% Acc@5 ({models.get(s['ocr']['best']['model'], s['ocr']['best']['model'])})." if s.get("ocr") else ""
            desc = f"The {s['name']} writing system (ISO 15924 {s['code']}){', a ' + s['type'] if s.get('type') else ''}: {n_lang:,} languages use it, {s['characters']:,} Unicode characters.{ocr}"
            entity = {"@type": "DefinedTerm", "name": s["name"], "termCode": s["code"], "description": desc,
                      "inDefinedTermSet": {"@type": "DefinedTermSet", "name": "ISO 15924 script codes", "url": "https://www.unicode.org/iso15924/"}}
            head = self.head(path=path, title=title, description=desc, crumbs=[("Home", ""), ("Scripts", "scripts/"), (s["name"], path)],
                             main_entity=entity, date_modified=self.data_date)
            r = lambda p: self.rel(2, p)
            langs = [self.lang_by_iso[i] for i in s["languages"] if i in self.lang_by_iso]
            head_html = (f'<nav class="breadcrumbs" aria-label="Breadcrumb"><a href="{r("scripts/")}">Scripts</a> / {esc(s["name"])}</nav>'
                         f'<p class="kicker">ISO 15924 · {esc(s["code"])}{" · " + esc(s["type"]) if s.get("type") else ""}</p><h1>{esc(s["name"])}</h1>'
                         f'<p class="lead">{esc(desc)}</p>')
            body = (f'<aside><div class="card"><dl class="facts"><div><dt>Code</dt><dd>{esc(s["code"])}</dd></div>'
                    f'<div><dt>Direction</dt><dd>{"Right-to-left" if s.get("direction") == "rtl" else "Left-to-right" if s.get("direction") == "ltr" else "–"}</dd></div>'
                    f'<div><dt>Characters</dt><dd>{s["characters"]:,}</dd></div><div><dt>GlotLID</dt><dd>{s["glotlid_labels"]} labels</dd></div></dl></div></aside>'
                    f'<div><h2>Languages written in {esc(s["name"])}</h2><ul class="lang-list">' +
                    "".join(f'<li><a href="{r("languages/" + l["i"] + "/")}">{esc(l["n"])}</a><span class="iso">{esc(l["i"])}</span></li>' for l in langs[:300]) + "</ul>" +
                    (f'<p><a href="{r("languages/")}?script={esc(s["code"])}">All {n_lang:,} languages on the map</a></p>' if n_lang > 300 else "") +
                    (("<h2>OCR results</h2><ul>" + "".join(f'<li>{esc(models.get(x["model"], x["model"]))}: Acc@5 {x["acc5"]:.1f}%, CER {x["cer"]:.1f}</li>' for x in s["ocr"]["results"].get("plain", [])) + "</ul>") if s.get("ocr") else "") +
                    "</div>")
            self.write(path, self.render(tpl, path=path, head=head, page_key="scripts", body_attrs=f' data-id="{esc(s["code"])}"',
                                         fills={"script-head": head_html, "script-body": body}), self.data_date, 0.6)

    # ----- project booklets
    def project_pages(self):
        tpl = (ROOT / "templates" / "project.html").read_text(encoding="utf-8")
        lastmod = git_date("data/projects.json")
        for p in self.projects:
            path = f"projects/{p['id']}/"
            title = f"{p['name']}: {p['tagline'].rstrip('.')} · CommonGlot"
            desc = (p["description"][:157].rsplit(" ", 1)[0] + "…") if len(p["description"]) > 160 else p["description"]
            authors = re.search(r"author\s*=\s*\{(.+?)\},?\n", p.get("citation", ""), re.S)
            people = [{"@type": "Person", "name": " ".join(reversed([x.strip() for x in a.split(",", 1)])) if "," in a else a.strip()}
                      for a in re.sub(r"[{}\\'\"`^~]", "", authors.group(1)).split(" and ")] if authors else []
            kind = "Dataset" if p["kind"] in ("corpus", "benchmark") else "SoftwareSourceCode"
            entity = {"@type": kind, "name": p["name"], "description": p["description"], "url": self.abs(path),
                      "author": people or None, "datePublished": str(p["year"]),
                      "sameAs": [u for u in p["links"].values()],
                      "citation": p["links"].get("paper"), "codeRepository": p["links"].get("code") if kind == "SoftwareSourceCode" else None,
                      "creator": people or None if kind == "Dataset" else None}
            entity = {k: v for k, v in entity.items() if v}
            head = self.head(path=path, title=title, description=desc, crumbs=[("Home", ""), ("Projects", "projects/"), (p["name"], path)],
                             main_entity=entity, date_modified=lastmod)
            r = lambda x: self.rel(2, x)
            head_html = (f'<nav class="breadcrumbs" aria-label="Breadcrumb"><a href="{r("projects/")}">Projects</a> / {esc(p["name"])}</nav>'
                         f'<p class="kicker">{esc(self.tax["project_kinds"][p["kind"]])} · {esc(p["venue"])}</p><h1>{esc(p["name"])}</h1><p class="lead">{esc(p["tagline"])}</p>')
            body = (f'<aside><div class="card"><dl class="facts"><div><dt>Published</dt><dd>{esc(p["venue"])}</dd></div><div><dt>Year</dt><dd>{p["year"]}</dd></div></dl></div></aside>'
                    f'<div><h2>Overview</h2><p>{esc(p["description"])}</p><h2>Features</h2><ul>' + "".join(f"<li>{esc(x)}</li>" for x in p["features"]) + "</ul>"
                    f'<h2>Links</h2><ul>' + "".join(f'<li><a href="{esc(u)}" rel="noopener" target="_blank">{esc(k.title())}</a></li>' for k, u in p["links"].items()) + "</ul></div>")
            self.write(path, self.render(tpl, path=path, head=head, page_key="projects", body_attrs=f' data-id="{esc(p["id"])}"',
                                         fills={"project-head": head_html, "project-body": body}), lastmod, 0.7)

    # ----- A–Z browse pages
    def browse_pages(self):
        groups = defaultdict(list)
        for l in self.languages:
            groups[slug_letter(l["n"])].append(l)
        tpl = (ROOT / "templates" / "browse.html").read_text(encoding="utf-8")
        for letter, items in groups.items():
            items.sort(key=lambda x: unicodedata.normalize("NFD", x["n"]).lower())
            label = "#" if letter == "other" else letter.upper()
            path = f"languages/browse/{letter}/"
            title = f"Languages starting with {label} — language directory · CommonGlot"
            desc = f"All {len(items):,} languages whose names start with {label}, from {items[0]['n']} to {items[-1]['n']}, each with a booklet on its scripts, status and language technology."
            head = self.head(path=path, title=title, description=desc, page_type="CollectionPage",
                             crumbs=[("Home", ""), ("Languages", "languages/"), (f"A–Z: {label}", path)], date_modified=self.data_date)
            r = lambda x: self.rel(3, x)
            content = (f'<nav class="breadcrumbs" aria-label="Breadcrumb"><a href="{r("languages/")}">Languages</a> / A–Z / {label}</nav>'
                       f'<h1>Languages: {label}</h1><p class="lead">{len(items):,} languages · <a href="{r("languages/")}">search and map the full directory</a></p>'
                       f'{self.az_nav(3)}<h2>{label}</h2><ul class="lang-list">' +
                       "".join(f'<li><a href="{r("languages/" + l["i"] + "/")}">{esc(l["n"])}</a><span class="iso">{esc(l["i"])}</span></li>' for l in items) + "</ul>")
            self.write(path, self.render(tpl, path=path, head=head, page_key="languages", fills={"browse": content}), self.data_date, 0.5)

    # ----- legacy redirects, 404, sitemap, robots, manifest
    def legacy(self):
        for old, target in self.site["legacy_redirects"].items():
            if old.startswith("_"):
                continue
            depth = old.count("/")
            if isinstance(target, dict):
                dest = self.rel(depth, target["fallback"])
                script = (f'<script src="{self.rel(depth, "assets/js/legacy.js")}" data-param="{esc(target["param"])}" '
                          f'data-to="{esc(self.rel(depth, target["to"]))}"></script>')
            else:
                dest, script = self.rel(depth, target), ""
            canonical = self.abs(target["fallback"] if isinstance(target, dict) else target)
            doc = (f'<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Moved · CommonGlot</title>'
                   f'<meta name="robots" content="noindex, follow"><link rel="canonical" href="{esc(canonical)}">'
                   f'{script}<meta http-equiv="refresh" content="0; url={esc(dest)}"></head>'
                   f'<body><p>This page has moved to <a href="{esc(dest)}">{esc(canonical)}</a>.</p></body></html>')
            (self.out / old).parent.mkdir(parents=True, exist_ok=True)
            (self.out / old).write_text(doc, encoding="utf-8")

    def not_found(self):
        src = (ROOT / "404.html").read_text(encoding="utf-8")
        head = self.head(path="404.html", title="Page not found · CommonGlot", description="The page you were looking for does not exist.", noindex=True)
        doc = self.render(src, path="", head=head, page_key="")
        # 404 is served at any depth, so it uses root-absolute URLs via <base href="/">.
        (self.out / "404.html").write_text(doc.replace('<link rel="canonical" href="' + self.abs("404.html") + '">', ""), encoding="utf-8")

    def extras(self):
        urls = "".join(f"<url><loc>{esc(self.abs(p))}</loc><lastmod>{d}</lastmod><priority>{pr:.1f}</priority></url>\n"
                       for p, d, pr in sorted(self.sitemap, key=lambda x: (-x[2], x[0])))
        (self.out / "sitemap.xml").write_text('<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' + urls + "</urlset>\n", encoding="utf-8")
        (self.out / "robots.txt").write_text(f"User-agent: *\nAllow: /\n\nSitemap: {self.abs('sitemap.xml')}\n", encoding="utf-8")
        b = self.site["brand"]
        manifest = {"name": b["name"], "short_name": b["name"], "description": b["description"], "lang": self.seo["language"],
                    "start_url": "./", "scope": "./", "display": "standalone",
                    "background_color": self.seo["theme_color"], "theme_color": self.seo["theme_color"],
                    "icons": [{"src": "assets/img/icon-192.png", "sizes": "192x192", "type": "image/png"},
                              {"src": "assets/img/icon-512.png", "sizes": "512x512", "type": "image/png"},
                              {"src": "assets/img/icon-512-maskable.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable"}]}
        (self.out / "site.webmanifest").write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")

    def copy_static(self):
        if self.out.exists():
            shutil.rmtree(self.out)
        self.out.mkdir(parents=True)
        for item in ROOT.iterdir():
            if item.name in SKIP or item.name.startswith(".") and item.name != ".nojekyll":
                continue
            dest = self.out / item.name
            shutil.copytree(item, dest) if item.is_dir() else shutil.copy2(item, dest)

    def build(self):
        self.copy_static()
        self.top_pages()
        self.project_pages()
        self.script_pages()
        self.language_pages()
        self.browse_pages()
        self.legacy()
        self.not_found()
        self.extras()
        print(f"built {len(self.sitemap):,} indexable pages into {self.out}")


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--out", default=str(ROOT / "_site"))
    Site(Path(ap.parse_args().out)).build()


if __name__ == "__main__":
    main()
