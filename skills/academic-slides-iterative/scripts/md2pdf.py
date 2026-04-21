#!/usr/bin/env python3
"""Convert the companion talking-points markdown to PDF.

Uses python-markdown + weasyprint, with CSS baked in to match the
Metropolis Beamer deck palette (BlueA / GreenA / OrangeA / RedA / GrayA).
Korean glyphs render via Noto Sans CJK KR / Noto Sans Mono CJK KR when
available; falls back to Noto Sans for Latin-only docs.

Usage::

    python3 md2pdf.py <input.md> [<output.pdf>]

If <output.pdf> is omitted, writes alongside the .md with .pdf suffix.
"""
from __future__ import annotations

import pathlib
import sys

import markdown
from weasyprint import CSS, HTML


CSS_TEMPLATE = """
@page {
  size: A4;
  margin: 2.0cm 1.8cm;
  @bottom-center { content: counter(page) " / " counter(pages);
                   font-size: 9pt; color: #666; }
}
body {
  font-family: 'Noto Sans CJK KR', 'Noto Sans', sans-serif;
  font-size: 10.5pt;
  line-height: 1.55;
  color: #222;
}
h1 { font-size: 20pt; border-bottom: 2px solid #174A7E;
     padding-bottom: 0.2em; margin-top: 1.4em; color: #174A7E; }
h2 { font-size: 15pt; border-bottom: 1px solid #59636E;
     padding-bottom: 0.15em; margin-top: 1.6em; color: #174A7E; }
h3 { font-size: 12.5pt; margin-top: 1.2em; color: #2D7D46; }
h4 { font-size: 11pt; margin-top: 1.0em; color: #B46A1E; }
p { margin: 0.45em 0; }
code, pre, tt { font-family: 'Noto Sans Mono CJK KR', 'DejaVu Sans Mono',
                 monospace; font-size: 9.5pt; }
code { background: #EEF2F5; padding: 0.1em 0.3em; border-radius: 3px; }
pre { background: #F7F9FB; border-left: 3px solid #174A7E;
      padding: 0.6em 0.8em; overflow-x: auto; font-size: 9pt;
      line-height: 1.35; white-space: pre-wrap; word-break: break-word; }
pre code { background: transparent; padding: 0; }
table { border-collapse: collapse; margin: 0.8em 0; width: 100%;
        font-size: 10pt; }
th, td { border: 1px solid #C3CBD4; padding: 0.35em 0.55em;
         text-align: left; vertical-align: top; }
th { background: #EEF2F5; font-weight: 600; }
ul, ol { margin: 0.3em 0 0.6em 1.3em; padding-left: 0.3em; }
li { margin: 0.15em 0; }
strong { color: #174A7E; }
em { color: #59636E; }
blockquote { border-left: 3px solid #B46A1E;
             margin: 0.6em 0 0.6em 0.4em; padding: 0.3em 0.8em;
             background: #FAEBD7; font-style: italic; }
hr { border: none; border-top: 1px solid #C3CBD4; margin: 1.2em 0; }
"""


def render(src: pathlib.Path, dst: pathlib.Path) -> None:
    md_text = src.read_text(encoding="utf-8")
    html_body = markdown.markdown(
        md_text,
        extensions=["tables", "fenced_code", "toc", "codehilite"],
    )
    full_html = (
        '<!DOCTYPE html>\n<html lang="ko"><head><meta charset="utf-8">'
        f'<title>{src.stem}</title></head><body>{html_body}</body></html>'
    )
    HTML(string=full_html).write_pdf(
        str(dst), stylesheets=[CSS(string=CSS_TEMPLATE)]
    )
    print(f"wrote {dst} ({dst.stat().st_size} bytes)")


def main(argv: list[str]) -> int:
    if len(argv) < 2 or len(argv) > 3:
        print("usage: md2pdf.py <input.md> [<output.pdf>]", file=sys.stderr)
        return 2
    src = pathlib.Path(argv[1]).resolve()
    if not src.exists():
        print(f"error: input not found: {src}", file=sys.stderr)
        return 1
    dst = pathlib.Path(argv[2]).resolve() if len(argv) == 3 else src.with_suffix(".pdf")
    render(src, dst)
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
