"""
Rewrite <img src="/blog/images/X.png" ...> into <picture> with AVIF + WebP
sources and the PNG as final fallback.

- Adds intrinsic width/height attributes from blog/images/_dimensions.json
  (fixes CLS — browsers can reserve the box before bytes arrive).
- Adds loading="lazy" if not already present.
- Idempotent: skips img tags already inside <picture> (so re-runs are safe).
- Only touches img tags whose src points to /blog/images/*.png.
  data-src attrs (lightbox JS) are intentionally left alone — they're not
  rendered img elements; the lightbox can be upgraded separately if wanted.

Excludes node_modules/, .git/, email-templates/ (transactional, not crawled).

Run from repo root:
    python scripts/rewrite_img_to_picture.py
"""

from __future__ import annotations

import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SIDECAR = ROOT / "blog" / "images" / "_dimensions.json"

EXCLUDE_DIR_PARTS = {"node_modules", ".git", "email-templates"}

# Match a whole <img ...> tag (single or multi-line) whose src is a
# /blog/images/*.png reference. We do NOT match self-closing/non-closing
# variants separately — capture the whole tag including its terminator.
IMG_TAG_RE = re.compile(
    r"<img\b(?P<attrs>[^>]*?\bsrc=[\"'](?P<src>/?blog/images/[^\"']+\.png)[\"'][^>]*?)/?>",
    re.IGNORECASE | re.DOTALL,
)

# Pull individual attributes from the attrs string.
ATTR_RE = re.compile(
    r"""(?P<name>[a-zA-Z_:][-a-zA-Z0-9_:.]*)\s*=\s*(?P<q>["'])(?P<val>.*?)(?P=q)""",
    re.DOTALL,
)


def is_excluded(path: Path) -> bool:
    return any(part in EXCLUDE_DIR_PARTS for part in path.parts)


def parse_attrs(attrs_str: str) -> dict[str, str]:
    return {
        m["name"].lower(): m["val"]
        for m in ATTR_RE.finditer(attrs_str)
    }


def is_already_in_picture(html: str, img_start: int) -> bool:
    """Look back from img_start for an unclosed <picture> open tag."""
    window = html[max(0, img_start - 400) : img_start]
    last_open = window.lower().rfind("<picture")
    if last_open == -1:
        return False
    last_close = window.lower().rfind("</picture>")
    return last_close < last_open


def rebuild_img(attrs: dict[str, str], dims: dict[str, int]) -> str:
    """Re-emit the inner <img> with normalized attrs."""
    # Always set width/height from the sidecar (source of truth).
    attrs["width"] = str(dims["width"])
    attrs["height"] = str(dims["height"])
    # Add loading="lazy" if missing.
    attrs.setdefault("loading", "lazy")
    # Keep a sensible attribute order for readability.
    preferred_order = (
        "src",
        "alt",
        "width",
        "height",
        "loading",
        "fetchpriority",
        "class",
        "id",
        "decoding",
    )
    parts: list[str] = []
    seen: set[str] = set()
    for name in preferred_order:
        if name in attrs:
            parts.append(f'{name}="{attrs[name]}"')
            seen.add(name)
    for name, value in attrs.items():
        if name in seen:
            continue
        parts.append(f'{name}="{value}"')
    return "<img " + " ".join(parts) + " />"


def rewrite_one(html: str, sidecar: dict) -> tuple[str, int]:
    out: list[str] = []
    cursor = 0
    rewrites = 0

    for m in IMG_TAG_RE.finditer(html):
        start, end = m.span()
        out.append(html[cursor:start])
        cursor = end

        src = m["src"]  # e.g. /blog/images/foo.png or blog/images/foo.png
        filename = Path(src).name
        dims = sidecar.get(filename)
        if dims is None:
            # No sidecar entry — leave img untouched.
            out.append(m.group(0))
            continue

        if is_already_in_picture(html, start):
            # Already wrapped — skip.
            out.append(m.group(0))
            continue

        attrs = parse_attrs(m["attrs"])
        # Normalize src to leading slash form for sibling sources.
        normalized_src = src if src.startswith("/") else "/" + src
        attrs["src"] = normalized_src
        webp_src = normalized_src[: -len(".png")] + ".webp"
        avif_src = normalized_src[: -len(".png")] + ".avif"

        inner = rebuild_img(attrs, dims)
        block = (
            "<picture>"
            f'<source srcset="{avif_src}" type="image/avif" />'
            f'<source srcset="{webp_src}" type="image/webp" />'
            f"{inner}"
            "</picture>"
        )
        out.append(block)
        rewrites += 1

    out.append(html[cursor:])
    return "".join(out), rewrites


def main() -> int:
    if not SIDECAR.exists():
        print(
            f"ERROR: sidecar not found at {SIDECAR.relative_to(ROOT)}. "
            "Run scripts/convert_images.py first.",
            file=sys.stderr,
        )
        return 1

    sidecar = json.loads(SIDECAR.read_text(encoding="utf-8"))

    total_rewrites = 0
    files_changed = 0
    for html_path in ROOT.rglob("*.html"):
        rel = html_path.relative_to(ROOT)
        if is_excluded(rel):
            continue
        try:
            text = html_path.read_text(encoding="utf-8")
        except UnicodeDecodeError:
            text = html_path.read_text(encoding="utf-8", errors="replace")

        new_text, n = rewrite_one(text, sidecar)
        if n == 0:
            continue

        html_path.write_text(new_text, encoding="utf-8", newline="\n")
        files_changed += 1
        total_rewrites += n
        print(f"  {rel}  {n} img -> picture")

    print(f"\n{files_changed} files changed, {total_rewrites} img tags wrapped.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
