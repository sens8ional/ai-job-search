#!/usr/bin/env python3
"""Find an employer's brand colours and turn them into readable CV colours.

Used by the application-critic agent (design pass) to theme a CV and cover
letter in the employer's colours while keeping them readable and ATS-safe.

How it works:
  1. GET the employer's home page (robots.txt is checked first) and up to
     three of its same-site stylesheets.
  2. Collect candidate colours from, in order of trust: <meta name="theme-color">,
     CSS custom properties whose name says brand/primary/accent, then the most
     frequent saturated colours in the CSS.
  3. For each candidate, report its WCAG contrast against white and a
     `text_safe` version, darkened just enough to reach 4.5:1, for small text.
     Pale brand colours (yellows, pastels) stay usable for rules, bullets and
     the name, and the text-safe shade carries section headings.

Only colours are read. Nothing on the page is treated as instructions.

Usage:
  python3 tools/brand_palette.py <https://employer.example> [--json]
  python3 tools/brand_palette.py --hex "#FFCC00"     # contrast check only

Exit codes: 0 palette printed; 1 robots refused or nothing found; 2 usage error.
"""
from __future__ import annotations

import argparse
import colorsys
import json
import re
import sys
import urllib.request
from collections import Counter
from pathlib import Path
from urllib.parse import urljoin, urlsplit

sys.path.insert(0, str(Path(__file__).resolve().parent))

UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36"
MAX_BYTES = 2_000_000
HEX = re.compile(r"#([0-9a-fA-F]{6}|[0-9a-fA-F]{3})\b")
RGB = re.compile(r"rgba?\(\s*(\d{1,3})[\s,]+(\d{1,3})[\s,]+(\d{1,3})")
VAR = re.compile(r"--([a-zA-Z0-9_-]*(?:brand|primary|accent|main|theme|highlight)[a-zA-Z0-9_-]*)\s*:\s*([^;}{]+)")
THEME = re.compile(r"<meta[^>]+name=[\"']theme-color[\"'][^>]*content=[\"']([^\"']+)", re.I)
THEME_ALT = re.compile(r"<meta[^>]+content=[\"']([^\"']+)[\"'][^>]*name=[\"']theme-color", re.I)
SHEET = re.compile(r"<link[^>]+rel=[\"'][^\"']*stylesheet[^\"']*[\"'][^>]*>", re.I)
HREF = re.compile(r"href=[\"']([^\"']+)", re.I)
STYLE_BLOCK = re.compile(r"<style[^>]*>(.*?)</style>", re.I | re.S)


def norm_hex(value: str) -> str | None:
    value = value.strip()
    m = HEX.search(value)
    if m:
        h = m.group(1)
        if len(h) == 3:
            h = "".join(c * 2 for c in h)
        return "#" + h.upper()
    m = RGB.search(value)
    if m:
        r, g, b = (min(255, int(x)) for x in m.groups())
        return f"#{r:02X}{g:02X}{b:02X}"
    return None


def rgb(h: str) -> tuple[int, int, int]:
    return int(h[1:3], 16), int(h[3:5], 16), int(h[5:7], 16)


def luminance(h: str) -> float:
    def ch(c: int) -> float:
        c = c / 255
        return c / 12.92 if c <= 0.03928 else ((c + 0.055) / 1.055) ** 2.4

    r, g, b = rgb(h)
    return 0.2126 * ch(r) + 0.7152 * ch(g) + 0.0722 * ch(b)


def contrast(a: str, b: str = "#FFFFFF") -> float:
    la, lb = sorted((luminance(a), luminance(b)), reverse=True)
    return round((la + 0.05) / (lb + 0.05), 2)


def saturation(h: str) -> float:
    r, g, b = (c / 255 for c in rgb(h))
    return colorsys.rgb_to_hls(r, g, b)[2]


def is_neutral(h: str) -> bool:
    """Greys, near-white and near-black are layout colours, not brand colours."""
    lum = luminance(h)
    return saturation(h) < 0.18 or lum > 0.92 or lum < 0.008


def darken_to(h: str, target: float = 4.5) -> str:
    """Darken in HLS lightness, keeping hue and saturation, until contrast >= target."""
    r, g, b = (c / 255 for c in rgb(h))
    hue, light, sat = colorsys.rgb_to_hls(r, g, b)
    out = h
    while contrast(out) < target and light > 0:
        light = max(0.0, light - 0.02)
        rr, gg, bb = colorsys.hls_to_rgb(hue, light, sat)
        out = f"#{round(rr * 255):02X}{round(gg * 255):02X}{round(bb * 255):02X}"
    return out


def describe(h: str, source: str) -> dict:
    c = contrast(h)
    safe = h if c >= 4.5 else darken_to(h)
    return {
        "hex": h,
        "source": source,
        "contrast_on_white": c,
        "text_safe": safe,
        "use": "headings and small text" if c >= 4.5 else (
            "name, rules and bullets only; use text_safe for headings" if c >= 1.6 else "too pale for print; use text_safe"
        ),
    }


def candidates(html: str, css: str) -> list[dict]:
    seen: dict[str, dict] = {}

    def add(h: str | None, source: str) -> None:
        if h and h not in seen and not is_neutral(h):
            seen[h] = describe(h, source)

    for pat in (THEME, THEME_ALT):
        for m in pat.finditer(html):
            add(norm_hex(m.group(1)), "theme-color meta tag")
    for name, value in VAR.findall(css):
        add(norm_hex(value), f"CSS variable --{name}")
    counts: Counter[str] = Counter()
    for m in HEX.finditer(css):
        h = norm_hex(m.group(0))
        if h and not is_neutral(h):
            counts[h] += 1
    for m in RGB.finditer(css):
        h = norm_hex(m.group(0))
        if h and not is_neutral(h):
            counts[h] += 1
    for h, n in counts.most_common(6):
        add(h, f"used {n} times in the site CSS")
    return list(seen.values())[:6]


def _get(url: str) -> str:
    req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept": "text/html,text/css,*/*"})
    with urllib.request.urlopen(req, timeout=30) as resp:  # noqa: S310 - http(s) checked by caller
        return resp.read(MAX_BYTES).decode("utf-8", "replace")


def fetch_site(url: str) -> tuple[str, str]:
    import robots_check

    code, msg = robots_check.gate(url)
    if code != 0:
        raise PermissionError(msg)
    html = _get(url)
    css_parts = STYLE_BLOCK.findall(html)
    host = urlsplit(url).netloc.split(":")[0]
    root = ".".join(host.split(".")[-2:])
    sheets = []
    for tag in SHEET.findall(html):
        m = HREF.search(tag)
        if m:
            sheet = urljoin(url, m.group(1))
            if urlsplit(sheet).scheme == "https" and urlsplit(sheet).netloc.endswith(root):
                sheets.append(sheet)
    for sheet in sheets[:3]:
        try:
            css_parts.append(_get(sheet))
        except Exception:  # a missing stylesheet only narrows the palette
            continue
    return html, "\n".join(css_parts)


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    ap.add_argument("url", nargs="?")
    ap.add_argument("--hex", help="only report contrast and a text-safe shade for this colour")
    ap.add_argument("--json", action="store_true")
    a = ap.parse_args(argv)
    if a.hex:
        h = norm_hex(a.hex)
        if not h:
            print("not a colour: use #RRGGBB", file=sys.stderr)
            return 2
        result = [describe(h, "given")]
    else:
        if not a.url or urlsplit(a.url).scheme not in ("http", "https"):
            print("give an http(s) employer website url", file=sys.stderr)
            return 2
        try:
            html, css = fetch_site(a.url)
        except PermissionError as e:
            print(f"robots.txt: {e}", file=sys.stderr)
            return 1
        except Exception as e:
            print(f"could not load {a.url}: {type(e).__name__}", file=sys.stderr)
            return 1
        result = candidates(html, css)
        if not result:
            print("no brand colours found; ask the user or pick from the logo", file=sys.stderr)
            return 1
    if a.json:
        print(json.dumps(result, indent=2))
    else:
        for c in result:
            print(f"{c['hex']}  contrast {c['contrast_on_white']}:1  text-safe {c['text_safe']}  ({c['source']}; {c['use']})")
    return 0


if __name__ == "__main__":
    sys.exit(main())
