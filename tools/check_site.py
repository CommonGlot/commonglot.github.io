#!/usr/bin/env python3
"""SEO and integrity checks for the built site (_site/). Exits non-zero on errors.

Checks every indexable page for: one <title>, unique titles and descriptions,
a canonical URL matching its location, robots meta, Open Graph and Twitter tags,
exactly one <h1>, no skipped heading levels, alt text on images, valid JSON-LD,
lang attribute and viewport. Across the site: broken internal links, sitemap
coverage, orphan pages (in the sitemap but never linked) and redirect chains.

Usage: python3 tools/check_site.py [_site]
"""

import json
import re
import sys
import xml.etree.ElementTree as ET
from collections import Counter, defaultdict
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urljoin, urlparse

ROOT = Path(__file__).resolve().parent.parent


class Page(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.titles, self.meta, self.links, self.canon, self.headings = [], {}, [], None, []
        self.imgs_no_alt, self.jsonld, self.lang, self._in = 0, [], None, None
        self._buf = ""

    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        if tag == "html":
            self.lang = a.get("lang")
        elif tag == "title":
            self._in, self._buf = "title", ""
        elif tag == "meta":
            key = a.get("name") or a.get("property")
            if key:
                self.meta[key] = a.get("content", "")
        elif tag == "link" and a.get("rel") == "canonical":
            self.canon = a.get("href")
        elif tag in ("a", "link", "script", "img") and (a.get("href") or a.get("src")):
            if not (tag == "link" and a.get("rel") in ("canonical", "preconnect")):
                self.links.append(a.get("href") or a.get("src"))
        if tag == "img" and "alt" not in a:
            self.imgs_no_alt += 1
        if re.fullmatch(r"h[1-6]", tag):
            self.headings.append(int(tag[1]))
        if tag == "script" and a.get("type") == "application/ld+json":
            self._in, self._buf = "ld", ""

    def handle_data(self, data):
        if self._in:
            self._buf += data

    def handle_endtag(self, tag):
        if tag == "title" and self._in == "title":
            self.titles.append(self._buf.strip()); self._in = None
        elif tag == "script" and self._in == "ld":
            self.jsonld.append(self._buf); self._in = None


def main():
    out = Path(sys.argv[1] if len(sys.argv) > 1 else ROOT / "_site")
    site = json.loads((out / "data" / "site.json").read_text())
    base = site["seo"]["site_url"].rstrip("/") + "/"
    errors, warnings = [], []
    pages, inbound = {}, defaultdict(set)
    legacy = {k for k in site.get("legacy_redirects", {}) if not k.startswith("_")}

    for f in sorted(out.rglob("*.html")):
        rel = f.relative_to(out).as_posix()
        if rel in legacy:
            continue
        path = rel[:-len("index.html")] if rel.endswith("index.html") else rel
        p = Page()
        p.feed(f.read_text(encoding="utf-8"))
        pages[path] = p
        url = base + path
        for href in p.links:
            u = urlparse(urljoin(url, href))
            if u.scheme in ("http", "https") and (u.netloc == urlparse(base).netloc) or (not u.scheme and not u.netloc):
                target = u.path.lstrip("/")
                if path != "404.html":
                    inbound[target].add(path)
                t = out / target
                if target.startswith("data/runtime.json"):
                    continue  # written by the deploy workflow
                if not (t.is_file() or (t / "index.html").is_file()):
                    errors.append(f"/{path}: broken link {href}")
        if path == "404.html":
            continue
        tag = f"/{path}"
        if len(p.titles) != 1:
            errors.append(f"{tag}: {len(p.titles)} <title> elements")
        for key in ("description", "robots", "og:title", "og:description", "og:image", "og:url", "twitter:card"):
            if not p.meta.get(key):
                errors.append(f"{tag}: missing meta {key}")
        if p.canon != url:
            errors.append(f"{tag}: canonical {p.canon} != {url}")
        if p.headings.count(1) != 1:
            errors.append(f"{tag}: {p.headings.count(1)} <h1> elements")
        for a, b in zip(p.headings, p.headings[1:]):
            if b > a + 1:
                errors.append(f"{tag}: heading jumps h{a} → h{b}"); break
        if p.imgs_no_alt:
            errors.append(f"{tag}: {p.imgs_no_alt} <img> without alt")
        if p.lang != "en":
            errors.append(f"{tag}: missing <html lang>")
        if "viewport" not in p.meta:
            errors.append(f"{tag}: missing viewport")
        for block in p.jsonld:
            try:
                data = json.loads(block)
                if data.get("@context") != "https://schema.org":
                    errors.append(f"{tag}: JSON-LD without schema.org context")
            except json.JSONDecodeError as e:
                errors.append(f"{tag}: invalid JSON-LD ({e})")
        if not p.jsonld:
            errors.append(f"{tag}: no JSON-LD")
        d = p.meta.get("description", "")
        if not 50 <= len(d) <= 170:
            warnings.append(f"{tag}: description length {len(d)}")

    indexable = {k: v for k, v in pages.items() if k != "404.html"}
    for label, values in (("title", [p.titles[0] for p in indexable.values() if p.titles]),
                          ("description", [p.meta.get("description") for p in indexable.values()])):
        for value, n in Counter(values).items():
            if n > 1:
                errors.append(f"duplicate {label} on {n} pages: {value[:70]}")

    ns = {"s": "http://www.sitemaps.org/schemas/sitemap/0.9"}
    locs = [u.find("s:loc", ns).text for u in ET.parse(out / "sitemap.xml").getroot().findall("s:url", ns)]
    in_map = {l[len(base):] for l in locs}
    for p in in_map - set(indexable):
        errors.append(f"sitemap lists missing page /{p}")
    for p in set(indexable) - in_map:
        errors.append(f"page /{p} not in sitemap")
    for p in in_map:
        if p and not (inbound.get(p, set()) - {p}):
            errors.append(f"orphan page /{p}: no internal links point to it")

    for old, target in site.get("legacy_redirects", {}).items():
        if old.startswith("_"):
            continue
        dest = target["fallback"] if isinstance(target, dict) else target
        if dest in {k for k in site.get("legacy_redirects", {})}:
            errors.append(f"redirect chain: {old} → {dest}")
        if dest not in indexable:
            errors.append(f"redirect {old} → missing page {dest}")

    for w in warnings[:20]:
        print("warning:", w)
    for e in errors[:200]:
        print("ERROR:", e)
    print(f"checked {len(pages):,} pages, {len(locs):,} sitemap URLs: {len(errors)} errors, {len(warnings)} warnings")
    sys.exit(1 if errors else 0)


if __name__ == "__main__":
    main()
