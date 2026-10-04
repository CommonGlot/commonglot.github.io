#!/usr/bin/env python3
"""Build the generated JSON files under data/ from public upstream sources.

Nothing in data/languages/ or data/scripts.json is typed by hand: every value
comes from one of the sources below. Clone them (shallow is enough) into one
directory and point --sources at it:

  glottolog-cldf   https://github.com/glottolog/glottolog-cldf   (cldf/languages.csv, cldf/values.csv)
  GlotScript       https://github.com/cisnlp/GlotScript          (metadata/GlotScript.tsv, GlotScript/GlotScript.py)
  GlotLID          https://github.com/cisnlp/GlotLID             (languages-v3.md)
  GlotWeb          https://github.com/cisnlp/GlotWeb             (metadata/linguameta.tsv, metadata/glot500_iso_code.json)
  GlotOCR-bench    https://github.com/cisnlp/GlotOCR-bench       (index.html leaderboard data)

Hand-curated facts with no machine-readable upstream (script typology, sample
phrases) live in tools/curated/scripts_meta.json.

Usage:  pip install pycountry && python3 tools/build_data.py --sources /path/to/clones
"""

import argparse
import csv
import datetime
import importlib.util
import json
import re
import sys
import unicodedata
from collections import Counter, defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "data"

AES_CODES = {
    "not endangered": 1, "threatened": 2, "shifting": 3,
    "moribund": 4, "nearly extinct": 5, "extinct": 6,
}


def read_tsv(path):
    with open(path, encoding="utf-8") as f:
        return list(csv.DictReader(f, delimiter="\t"))


def read_csv(path):
    with open(path, encoding="utf-8") as f:
        return list(csv.DictReader(f))


def split_codes(value):
    return [c.strip() for c in (value or "").split(",") if c.strip()]


def write_json(path, obj, compact=False):
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        if compact:
            json.dump(obj, f, ensure_ascii=False, separators=(",", ":"))
        else:
            json.dump(obj, f, ensure_ascii=False, indent=2)
        f.write("\n")


def country_name(code):
    try:
        import pycountry
        c = pycountry.countries.get(alpha_2=code)
        return getattr(c, "common_name", None) or c.name if c else code
    except ImportError:
        return code


# ---------------------------------------------------------------- sources ---

def load_glottolog(src):
    cldf = src / "glottolog-cldf" / "cldf"
    rows = read_csv(cldf / "languages.csv")
    by_id = {r["ID"]: r for r in rows}
    code_names = {r["ID"]: r["Name"] for r in read_csv(cldf / "codes.csv")}
    values = defaultdict(dict)
    with open(cldf / "values.csv", encoding="utf-8") as f:
        for r in csv.DictReader(f):
            if r["Parameter_ID"] in ("aes", "med"):
                values[r["Language_ID"]][r["Parameter_ID"]] = code_names.get(r["Code_ID"], r["Value"])
    langs = {}
    for r in rows:
        iso = r["ISO639P3code"]
        if not iso or r["Level"] != "language":
            continue
        fam = by_id.get(r["Family_ID"])
        v = values.get(r["ID"], {})
        langs[iso] = {
            "name": r["Name"],
            "glottocode": r["Glottocode"],
            "macroareas": [m for m in r["Macroarea"].split(";") if m],
            "lat": round(float(r["Latitude"]), 3) if r["Latitude"] else None,
            "lon": round(float(r["Longitude"]), 3) if r["Longitude"] else None,
            "family": fam["Name"] if fam else ("Isolate" if r["Is_Isolate"] == "true" else None),
            "family_glottocode": fam["ID"] if fam else None,
            "countries": [c for c in r["Countries"].split(";") if c],
            "aes": v.get("aes"),
            "med": v.get("med"),
        }
    return langs


def load_linguameta(src):
    out = {}
    for r in read_tsv(src / "GlotWeb" / "metadata" / "linguameta.tsv"):
        iso = r["iso_639_3_code"]
        if not iso or iso in out:
            continue
        speakers = r["estimated_number_of_speakers"]
        out[iso] = {
            "name": r["english_name"],
            "endonym": r["endonym"] or None,
            "speakers": int(speakers) if speakers.isdigit() else None,
            "wikidata": r["wikidata_id"] or None,
            "description": r["wikidata_description"] or None,
            "cldr_status": r["cldr_official_status"] or None,
            "locales": split_codes(r["locales"].replace(" ", ",")) if r["locales"] else [],
            "endangerment_lm": r["endangerment_status"] or None,
            "macrolanguage": r["is_macrolanguage"] == "True",
        }
    return out


def load_glotscript(src):
    out = {}
    for r in read_tsv(src / "GlotScript" / "metadata" / "GlotScript.tsv"):
        aux = []
        for col in ("Wiki-aux", "SIL-aux", "Lrec2800-aux", "SIL2-aux"):
            aux += split_codes(r.get(col))
        main = split_codes(r["ISO15924-Main"])
        out[r["ISO639-3"]] = {"main": main, "aux": sorted(set(aux) - set(main))}
    return out


def load_script_ranges(src):
    path = src / "GlotScript" / "GlotScript" / "GlotScript.py"
    spec = importlib.util.spec_from_file_location("glotscript_src", path)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod.SCRIPT_RANGES


def load_glotlid(src):
    """Per-label metrics table from GlotLID's languages-v3.md."""
    out = {}
    row = re.compile(r"^\|\s*\d+\s*\|\s*(\w+?)_(\w{4})\s*\|([^\n]+)$")
    for line in (src / "GlotLID" / "languages-v3.md").read_text(encoding="utf-8").splitlines():
        m = row.match(line)
        if not m:
            continue
        cells = [c.strip() for c in m.group(3).strip().strip("|").split("|")]
        f1, prec, rec, fpr, n, meanp = cells[:6]
        out.setdefault(m.group(1), []).append({
            "label": f"{m.group(1)}_{m.group(2)}",
            "script": m.group(2),
            "f1": round(float(f1), 4),
            "precision": round(float(prec), 4),
            "recall": round(float(rec), 4),
            "sentences": int(float(n)),
        })
    return out


def load_glot500(src):
    out = defaultdict(list)
    for label in json.load(open(src / "GlotWeb" / "metadata" / "glot500_iso_code.json")):
        iso, script = label.split("_")
        out[iso].append(script)
    return out


def load_ocr(src):
    html = (src / "GlotOCR-bench" / "index.html").read_text(encoding="utf-8")
    m = re.search(r"^const RAW=(\{.*\});?\s*$", html, re.M)
    if not m:
        sys.exit("Could not find the RAW leaderboard object in GlotOCR-bench/index.html")
    return json.loads(m.group(1))


# ---------------------------------------------------------------- builders ---

def script_direction(ranges):
    counts = Counter()
    for lo, hi in ranges:
        for cp in range(lo, min(hi, lo + 200) + 1):
            bidi = unicodedata.bidirectional(chr(cp))
            if bidi in ("R", "AL"):
                counts["rtl"] += 1
            elif bidi == "L":
                counts["ltr"] += 1
    if not counts:
        return None
    return counts.most_common(1)[0][0]


def script_specimen(ranges, n=12):
    """First n letters of the script; falls back to symbols for notations like Braille."""
    for categories in (("Lo", "Lu", "Ll", "Lm"), ("So",)):
        chars = []
        for lo, hi in ranges:
            for cp in range(lo, hi + 1):
                ch = chr(cp)
                if unicodedata.category(ch) in categories and unicodedata.name(ch, ""):
                    chars.append(ch)
                    if len(chars) >= n:
                        return "".join(chars)
        if chars:
            return "".join(chars)
    return ""


def build_scripts(ranges, glotscript, glotlid, ocr, curated, lang_names):
    plain = ocr["plain"]
    old = ocr.get("old", {})
    per_script = defaultdict(lambda: {"plain": [], "old": []})
    meta = {}
    for variant, models in (("plain", plain), ("old", old)):
        for key, model in models.items():
            for s in model["scripts"]:
                meta.setdefault(s["code"], s)
                per_script[s["code"]][variant].append({
                    "model": key, "acc5": s["acc5"], "cer": s["cer"],
                })

    main_users, aux_users = defaultdict(list), defaultdict(list)
    for iso, rec in glotscript.items():
        for c in rec["main"]:
            main_users[c].append(iso)
        for c in rec["aux"]:
            aux_users[c].append(iso)
    lid_labels = Counter(l["script"] for labels in glotlid.values() for l in labels)

    scripts = []
    for code, rngs in sorted(ranges.items()):
        m = meta.get(code, {})
        name = m.get("name") or curated["names"].get(code) or code
        results = {}
        for variant in ("plain", "old"):
            rs = sorted(per_script[code][variant], key=lambda r: -r["acc5"])
            if rs:
                results[variant] = rs
        best = results.get("plain", [None])[0]
        n_chars = sum(hi - lo + 1 for lo, hi in rngs)
        users = sorted(main_users.get(code, []), key=lambda i: lang_names.get(i, i))
        scripts.append({
            "code": code,
            "name": name,
            "type": curated["types"].get(code),
            "direction": script_direction(rngs),
            "ranges": [f"U+{lo:04X}–U+{hi:04X}" if lo != hi else f"U+{lo:04X}" for lo, hi in rngs],
            "characters": n_chars,
            "sample": curated["samples"].get(code),
            "font": curated["fonts"][code] if code in curated["fonts"] else f"Noto Sans {name}",
            "specimen": script_specimen(rngs),
            "languages": users,
            "languages_aux": sorted(aux_users.get(code, [])),
            "glotlid_labels": lid_labels.get(code, 0),
            "ocr": {
                "tier": m.get("tier"),
                "samples": m.get("samples"),
                "best": best,
                "results": results,
            } if results else None,
            "special": code in ("Zinh", "Zyyy", "Zzzz"),
        })
    return scripts


def build_ocr_models(ocr):
    out = []
    for key, m in ocr["plain"].items():
        row = {k: m.get(k) for k in ("display", "type", "overall", "high", "mid", "low", "macro_cer")}
        row["id"] = key
        old = ocr.get("old", {}).get(key)
        if old:
            row["old"] = {k: old.get(k) for k in ("overall", "high", "mid", "low", "macro_cer")}
        out.append(row)
    return sorted(out, key=lambda r: -(r["overall"] or 0))


def build_languages(glotto, lmeta, glotscript, glotlid, glot500, scripts_by_code):
    isos = set(glotto) | set(glotlid) | set(glot500)
    index, details = [], defaultdict(dict)
    for iso in sorted(isos):
        g = glotto.get(iso, {})
        # Glottolog's "Bookkeeping" pseudo-family holds retired or spurious ISO codes;
        # keep them only when a GlotSuite release actually uses the code.
        if g.get("family") == "Bookkeeping" and iso not in glotlid and iso not in glot500:
            continue
        lm = lmeta.get(iso, {})
        gs = glotscript.get(iso, {"main": [], "aux": []})
        name = g.get("name") or lm.get("name")
        if not name:
            try:
                import pycountry
                rec = pycountry.languages.get(alpha_3=iso)
                name = rec.name if rec else iso
            except ImportError:
                name = iso
        lid = glotlid.get(iso, [])
        g500 = glot500.get(iso, [])
        scripts = gs["main"] or sorted({l["script"] for l in lid} | set(g500))
        ocr_scripts = [c for c in scripts if scripts_by_code.get(c, {}).get("ocr")]
        tech = "".join(flag for flag, on in (
            ("L", bool(lid)), ("G", bool(g500)), ("S", bool(gs["main"])), ("O", bool(ocr_scripts)),
        ) if on)
        row = {
            "i": iso, "n": name,
            "m": (g.get("macroareas") or [None])[0],
            "f": g.get("family"),
            "e": AES_CODES.get(g.get("aes")) if g.get("aes") else None,
            "s": scripts,
            "t": tech,
        }
        if g.get("lat") is not None:
            row["y"], row["x"] = g["lat"], g["lon"]
        if lm.get("speakers"):
            row["p"] = lm["speakers"]
        index.append({k: v for k, v in row.items() if v not in (None, [], "")})

        details[iso[0]][iso] = {
            k: v for k, v in {
                "endonym": lm.get("endonym"),
                "description": lm.get("description"),
                "glottocode": g.get("glottocode"),
                "family_glottocode": g.get("family_glottocode"),
                "macroareas": g.get("macroareas") if len(g.get("macroareas", [])) > 1 else None,
                "countries": [{"code": c, "name": country_name(c)} for c in g.get("countries", [])],
                "documentation": g.get("med"),
                "endangerment": g.get("aes"),
                "wikidata": lm.get("wikidata"),
                "cldr_status": lm.get("cldr_status"),
                "locales": lm.get("locales"),
                "macrolanguage": lm.get("macrolanguage") or None,
                "scripts_aux": gs["aux"],
                "glotlid": lid,
                "glot500": g500,
            }.items() if v not in (None, [], "")
        }
    return index, details


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--sources", required=True, type=Path, help="directory holding the cloned source repos")
    args = ap.parse_args()
    src = args.sources

    curated = json.load(open(ROOT / "tools" / "curated" / "scripts_meta.json", encoding="utf-8"))
    glotto = load_glottolog(src)
    lmeta = load_linguameta(src)
    glotscript = load_glotscript(src)
    glotlid = load_glotlid(src)
    glot500 = load_glot500(src)
    ocr = load_ocr(src)
    ranges = load_script_ranges(src)

    lang_names = {iso: g["name"] for iso, g in glotto.items()}
    scripts = build_scripts(ranges, glotscript, glotlid, ocr, curated, lang_names)
    scripts_by_code = {s["code"]: s for s in scripts}
    index, details = build_languages(glotto, lmeta, glotscript, glotlid, glot500, scripts_by_code)

    write_json(DATA / "languages" / "index.json", index, compact=True)
    for letter, shard in details.items():
        write_json(DATA / "languages" / "details" / f"{letter}.json", shard, compact=True)
    write_json(DATA / "scripts.json", scripts, compact=True)
    write_json(DATA / "ocr_models.json", build_ocr_models(ocr))

    n_lid = sum(len(v) for v in glotlid.values())
    write_json(DATA / "generated_stats.json", {
        "generated": datetime.date.today().isoformat(),
        "languages_in_directory": len(index),
        "languages_with_coordinates": sum(1 for r in index if "y" in r),
        "glotlid_labels": n_lid,
        "glotlid_languages": len(glotlid),
        "glot500_labels": sum(len(v) for v in glot500.values()),
        "glotscript_languages": len(glotscript),
        "scripts_in_glotscript": len(ranges),
        "scripts_in_ocr_bench": sum(1 for s in scripts if s["ocr"]),
        "ocr_models": len(ocr["plain"]),
        "families": len({r["f"] for r in index if r.get("f")}),
    })
    print(f"languages: {len(index)}  scripts: {len(scripts)}  glotlid labels: {n_lid}")


if __name__ == "__main__":
    main()
