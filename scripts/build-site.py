"""Copy the static site source into the GitHub Pages artifact directory."""

from pathlib import Path
from shutil import copytree, rmtree


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "src"
OUTPUT = ROOT / "public"


def main() -> None:
    if not (SOURCE / "index.html").is_file():
        raise SystemExit(f"Missing site source: {SOURCE / 'index.html'}")
    rmtree(OUTPUT, ignore_errors=True)
    copytree(SOURCE, OUTPUT)
    (OUTPUT / ".nojekyll").touch()
    print(f"Built {SOURCE} -> {OUTPUT}")


if __name__ == "__main__":
    main()
