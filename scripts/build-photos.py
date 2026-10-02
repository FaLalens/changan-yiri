"""Build the selected album photos from the retouched Xi'an JPEGs.

Usage: python scripts/build-photos.py E:/29201/图片/202608_XiAn
The selected JPEGs live in each chapter's *_xiutu folder. Requires Pillow with
WebP support. Sources are never modified; outputs are metadata-free WebP.
"""

from __future__ import annotations

import argparse
from pathlib import Path

from PIL import Image, ImageOps, features


ROOT = Path(__file__).resolve().parents[1]

SELECTION = {
    "defuxiang": (
        "01_20260829_德福巷",
        "01_DeFuXiang_xiutu",
        ("144107", "144740", "145439", "145739", "150111", "153019", "163105", "163314"),
    ),
    "tangyuan": (
        "02_20260829_唐苑",
        "02_TangYuan_xiutu",
        ("175941", "180628", "180846", "182200", "182608", "184323", "185710", "190240", "191259"),
    ),
    "zhonglou": (
        "03_20260829_钟楼",
        "03_ZhongLou_xiutu",
        ("204936", "205711", "212910", "220313", "220748", "221006"),
    ),
}


def save_webp(image: Image.Image, path: Path, longest: int, quality: int) -> None:
    resized = image.copy()
    resized.thumbnail((longest, longest), Image.Resampling.LANCZOS)
    path.parent.mkdir(parents=True, exist_ok=True)
    resized.save(path, "WEBP", quality=quality, method=6)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("source", type=Path, help="202608_XiAn source directory")
    parser.add_argument("--output", type=Path, default=ROOT / "src" / "assets" / "photos")
    args = parser.parse_args()
    if not features.check("webp"):
        parser.error("Pillow must be built with WebP support")

    sources = [
        (group, args.source / folder / edited_folder / f"XiAn_20260829_{time}.JPG")
        for group, (folder, edited_folder, times) in SELECTION.items()
        for time in times
    ]
    missing = [str(path) for _, path in sources if not path.is_file()]
    if missing:
        parser.error("Missing source photos:\n" + "\n".join(missing))

    for group, source in sources:
        with Image.open(source) as opened:
            image = ImageOps.exif_transpose(opened).convert("RGB")
        stem = source.stem
        destination = args.output / group
        save_webp(image, destination / f"{stem}.webp", 2400, 88)
        save_webp(image, destination / f"{stem}@m.webp", 1200, 86)
        print(f"{group}/{stem}: {image.width}x{image.height}")


if __name__ == "__main__":
    main()
