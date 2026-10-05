"""Assemble the standalone HTML. Python standard library only; no font files."""
from pathlib import Path
import base64
import re

ROOT = Path(__file__).resolve().parent
OUT = ROOT.parent / "WORLD_ARCADE_AUTONOME.html"

def data_uri(path: Path) -> str:
    return "data:image/webp;base64," + base64.b64encode(path.read_bytes()).decode("ascii")

def main() -> None:
    html = (ROOT / "index.html").read_text(encoding="utf-8")
    css = (ROOT / "css/styles.css").read_text(encoding="utf-8")
    for path in (ROOT / "assets").glob("*.webp"):
        css = css.replace("../assets/" + path.name, data_uri(path))
    html = html.replace('<link rel="stylesheet" href="css/styles.css">', '<style>\n'+css+'\n</style>')
    for filename in ("data.js", "games.js", "app.js"):
        js = (ROOT / "js" / filename).read_text(encoding="utf-8")
        if filename == "data.js":
            values = [data_uri(ROOT / "assets/avatars" / f"{i:02d}.webp") for i in range(1, 16)]
            import json
            js = "const ARCADE_INLINE_AVATARS = " + json.dumps(values) + ";\n" + js
            js = js.replace("avatar:(number)=>`assets/avatars/${String(number).padStart(2,'0')}.webp`", "avatar:(number)=>ARCADE_INLINE_AVATARS[Math.max(0,Math.min(14,Number(number)-1))]")
            for path in (ROOT / "assets").glob("*.webp"):
                js = js.replace("assets/" + path.name, data_uri(path))
        html = html.replace(f'<script src="js/{filename}"></script>', '<script>\n'+js+'\n</script>')
    OUT.write_text(html, encoding="utf-8")
    print(f"Created {OUT} ({OUT.stat().st_size:,} bytes)")

if __name__ == "__main__":
    main()
