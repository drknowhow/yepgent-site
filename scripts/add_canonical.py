"""
Add <link rel="canonical" href="..." /> to every public HTML page.

Idempotent: skips files that already declare a canonical.

Excludes node_modules/, .git/, email-templates/ (transactional, not crawled).

Run from repo root:
    python scripts/add_canonical.py
"""

from __future__ import annotations

import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SITE_ORIGIN = "https://yepgent.com"

EXCLUDE_DIR_PARTS = {"node_modules", ".git", "email-templates"}

# Match the closing </head> tag (case-insensitive). We inject just before it.
HEAD_CLOSE_RE = re.compile(r"</head\s*>", re.IGNORECASE)
EXISTING_CANONICAL_RE = re.compile(
    r"<link[^>]*\brel\s*=\s*['\"]canonical['\"]", re.IGNORECASE
)


def canonical_url_for(rel_path: Path) -> str:
    """Map a repo-relative HTML path to its canonical URL."""
    parts = rel_path.parts
    if parts[-1].lower() == "index.html":
        # /index.html or <dir>/index.html or <dir>/<sub>/index.html
        dir_parts = parts[:-1]
        if not dir_parts:
            return f"{SITE_ORIGIN}/"
        return f"{SITE_ORIGIN}/" + "/".join(dir_parts) + "/"
    # Non-index .html file (e.g. blog/2026-06-05-...html, thanks.html)
    return f"{SITE_ORIGIN}/" + "/".join(parts)


def inject_canonical(html: str, url: str) -> str | None:
    """Return modified HTML, or None if already canonical-tagged."""
    if EXISTING_CANONICAL_RE.search(html):
        return None

    link = f'  <link rel="canonical" href="{url}" />\n'
    new_html, n = HEAD_CLOSE_RE.subn(link + r"\g<0>", html, count=1)
    if n == 0:
        # No </head> found — odd, but don't silently mangle.
        return None
    return new_html


def is_excluded(path: Path) -> bool:
    return any(part in EXCLUDE_DIR_PARTS for part in path.parts)


def main() -> int:
    changed: list[str] = []
    skipped_existing: list[str] = []
    skipped_other: list[str] = []

    for html_path in ROOT.rglob("*.html"):
        rel = html_path.relative_to(ROOT)
        if is_excluded(rel):
            continue

        url = canonical_url_for(rel)
        try:
            text = html_path.read_text(encoding="utf-8")
        except UnicodeDecodeError:
            text = html_path.read_text(encoding="utf-8", errors="replace")

        result = inject_canonical(text, url)
        if result is None:
            if EXISTING_CANONICAL_RE.search(text):
                skipped_existing.append(str(rel))
            else:
                skipped_other.append(str(rel))
            continue

        html_path.write_text(result, encoding="utf-8", newline="\n")
        changed.append(f"{rel}  ->  {url}")

    print(f"Modified: {len(changed)}")
    for line in changed:
        print(f"  + {line}")
    if skipped_existing:
        print(f"\nSkipped (canonical already present): {len(skipped_existing)}")
        for s in skipped_existing:
            print(f"  = {s}")
    if skipped_other:
        print(f"\nSkipped (no </head> found — manual check): {len(skipped_other)}")
        for s in skipped_other:
            print(f"  ? {s}")

    return 0


if __name__ == "__main__":
    sys.exit(main())
