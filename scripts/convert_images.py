"""
Convert every PNG in blog/images/ to WebP + AVIF siblings.

Emits a JSON sidecar (`blog/images/_dimensions.json`) mapping each PNG
filename to its intrinsic {width, height, bytes_png, bytes_webp, bytes_avif}.
The rewrite script consumes this to add explicit width/height attributes
(CLS fix) without re-probing every image.

Idempotent: skips an output file if it already exists AND is newer than
the source PNG. Re-run safely after adding new images.

Run from repo root:
    python scripts/convert_images.py
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
IMG_DIR = ROOT / "blog" / "images"
SIDECAR = IMG_DIR / "_dimensions.json"

WEBP_QUALITY = 82
AVIF_QUALITY = 50  # AVIF quality is on a different scale than WebP/JPEG.


def needs_rebuild(src: Path, dst: Path) -> bool:
    if not dst.exists():
        return True
    return src.stat().st_mtime > dst.stat().st_mtime


def convert_one(png: Path) -> tuple[int, int, int, int, int]:
    """Return (w, h, bytes_png, bytes_webp, bytes_avif)."""
    webp = png.with_suffix(".webp")
    avif = png.with_suffix(".avif")

    with Image.open(png) as im:
        im.load()
        w, h = im.size

        if needs_rebuild(png, webp):
            # method=6 = slowest, best compression.
            im.save(
                webp,
                format="WEBP",
                quality=WEBP_QUALITY,
                method=6,
            )

        if needs_rebuild(png, avif):
            im.save(
                avif,
                format="AVIF",
                quality=AVIF_QUALITY,
            )

    return (
        w,
        h,
        png.stat().st_size,
        webp.stat().st_size,
        avif.stat().st_size,
    )


def main() -> int:
    if not IMG_DIR.is_dir():
        print(f"ERROR: {IMG_DIR} does not exist", file=sys.stderr)
        return 1

    pngs = sorted(IMG_DIR.glob("*.png"))
    if not pngs:
        print("No PNGs to convert.")
        return 0

    sidecar_data: dict[str, dict[str, int]] = {}
    if SIDECAR.exists():
        try:
            sidecar_data = json.loads(SIDECAR.read_text(encoding="utf-8"))
        except json.JSONDecodeError:
            sidecar_data = {}

    total_png = total_webp = total_avif = 0
    for png in pngs:
        try:
            w, h, b_png, b_webp, b_avif = convert_one(png)
        except Exception as exc:  # pragma: no cover - surface and continue
            print(f"  ! {png.name}: {exc}", file=sys.stderr)
            continue

        sidecar_data[png.name] = {
            "width": w,
            "height": h,
            "bytes_png": b_png,
            "bytes_webp": b_webp,
            "bytes_avif": b_avif,
        }
        total_png += b_png
        total_webp += b_webp
        total_avif += b_avif
        print(
            f"  {png.name}  {w}x{h}  "
            f"png {b_png/1024:.0f}k -> webp {b_webp/1024:.0f}k "
            f"({b_webp/b_png*100:.0f}%) / avif {b_avif/1024:.0f}k "
            f"({b_avif/b_png*100:.0f}%)"
        )

    SIDECAR.write_text(
        json.dumps(sidecar_data, indent=2, sort_keys=True) + "\n",
        encoding="utf-8",
    )

    print(
        f"\n{len(pngs)} images. Combined PNG {total_png/1e6:.1f}MB -> "
        f"WebP {total_webp/1e6:.1f}MB ({total_webp/total_png*100:.0f}%) "
        f"/ AVIF {total_avif/1e6:.1f}MB ({total_avif/total_png*100:.0f}%)"
    )
    print(f"Sidecar written: {SIDECAR.relative_to(ROOT)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
