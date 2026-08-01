from pathlib import Path
import re
import sys

from fontTools.ttLib import TTFont

ROOT = Path.cwd()
SOURCE_EXTENSIONS = {".ts", ".tsx", ".css"}
text = ""
for source in (ROOT / "app").rglob("*"):
    if source.is_file() and source.suffix in SOURCE_EXTENSIONS:
        text += source.read_text(encoding="utf-8")

required = set(re.findall(r"[\u3400-\u9fff，。；：！？、（）《》「」『』【】—…·×→｜％℃]", text))
display_fallback = {"·", "→"}
failures: list[str] = []
for filename in ("LXGWWenKaiScreen-Game.woff2", "MaShanZheng-Game.woff2"):
    font = TTFont(ROOT / "public" / "fonts" / filename)
    cmap: set[str] = set()
    for table in font["cmap"].tables:
        cmap.update(chr(codepoint) for codepoint in table.cmap)
    expected = (
        required - display_fallback
        if filename == "MaShanZheng-Game.woff2"
        else required
    )
    missing = sorted(expected - cmap)
    if missing:
        failures.append(f"{filename}: missing {''.join(missing)}")

if failures:
    print("\n".join(failures), file=sys.stderr)
    raise SystemExit(1)
print(
    f"Text font covers all {len(required)} required glyphs; "
    "display font covers every title glyph and delegates ·/→ to the text face."
)
