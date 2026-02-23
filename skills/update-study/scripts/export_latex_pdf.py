#!/usr/bin/env python3
"""
LaTeX-based PDF Export for update-study skill.

Markdown + figures → LaTeX → PDF (학술 논문 스타일)

Usage:
    python export_latex_pdf.py report.md --output report.pdf
    python export_latex_pdf.py report.md --figures-dir figures/ --output report.pdf

Features:
    - \\includegraphics for figure embedding
    - Article class, 11pt, 1-inch margins
    - Section numbering, TOC
    - Executive Summary table formatting
    - Code syntax highlighting via listings

Fallback:
    1. pandoc + xelatex (best quality)
    2. pandoc + pdflatex
    3. Direct LaTeX template generation
"""

import argparse
import os
import re
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path


def check_command(cmd: str) -> bool:
    """Check if a command is available in PATH."""
    return shutil.which(cmd) is not None


def find_figures(md_content: str, figures_dir: str = "figures") -> list:
    """Extract figure paths from markdown image references."""
    pattern = r'!\[([^\]]*)\]\(([^)]+)\)'
    figures = []
    for match in re.finditer(pattern, md_content):
        caption, path = match.group(1), match.group(2)
        figures.append({"caption": caption, "path": path})
    return figures


def preprocess_for_latex(md_content: str, figures_dir: str = "figures") -> str:
    """Preprocess markdown for better LaTeX rendering.

    - Ensure figure paths are relative and correct
    - Fix table alignment for LaTeX
    - Handle [NEW] tags
    """
    # Remove [NEW] tags (not needed in final PDF)
    md_content = re.sub(r'\[NEW\]\s*', '', md_content)

    # Ensure figure paths are correct relative to working dir
    if figures_dir and figures_dir != ".":
        # If figures are referenced without directory prefix, add it
        md_content = re.sub(
            r'!\[([^\]]*)\]\((?!/)(?!http)(?!' + re.escape(figures_dir) + r')([^)]+)\)',
            rf'![\1]({figures_dir}/\2)',
            md_content
        )

    return md_content


def export_with_pandoc_latex(
    input_path: str,
    output_path: str,
    figures_dir: str = "figures",
) -> bool:
    """Export using pandoc with LaTeX backend (best quality)."""
    if not check_command("pandoc"):
        return False

    # Determine LaTeX engine
    if check_command("xelatex"):
        engine = "xelatex"
    elif check_command("pdflatex"):
        engine = "pdflatex"
    else:
        print("  No LaTeX engine found (xelatex/pdflatex)")
        return False

    # Read and preprocess
    with open(input_path, "r", encoding="utf-8") as f:
        content = f.read()

    content = preprocess_for_latex(content, figures_dir)

    # Write preprocessed content to temp file
    with tempfile.NamedTemporaryFile(
        mode="w", suffix=".md", delete=False, encoding="utf-8"
    ) as tmp:
        tmp.write(content)
        tmp_path = tmp.name

    # LaTeX header for styling
    header_content = r"""
\usepackage{booktabs}
\usepackage{graphicx}
\usepackage{float}
\usepackage{listings}
\usepackage{xcolor}
\usepackage{hyperref}

% Code listing style
\lstset{
    basicstyle=\ttfamily\small,
    breaklines=true,
    frame=single,
    backgroundcolor=\color{gray!5},
    keywordstyle=\color{blue!70},
    commentstyle=\color{green!50!black},
    stringstyle=\color{red!60},
    numbers=none,
    tabsize=4,
}

% Figure placement preference
\let\origfigure\figure
\let\endorigfigure\endfigure
\renewenvironment{figure}[1][htbp]{\origfigure[H]}{\endorigfigure}
"""

    with tempfile.NamedTemporaryFile(
        mode="w", suffix=".tex", delete=False, encoding="utf-8"
    ) as header_file:
        header_file.write(header_content)
        header_path = header_file.name

    try:
        # Determine working directory (where figures are)
        work_dir = str(Path(input_path).parent.resolve())

        cmd = [
            "pandoc",
            tmp_path,
            "-o", output_path,
            f"--pdf-engine={engine}",
            "--toc",
            "--toc-depth=3",
            "-V", "geometry:margin=1in",
            "-V", "fontsize=11pt",
            "-V", "documentclass=article",
            "-H", header_path,
            "--highlight-style=tango",
            "--number-sections",
            f"--resource-path={work_dir}",
        ]

        # Add font settings for xelatex
        if engine == "xelatex":
            cmd.extend([
                "-V", "mainfont=DejaVu Serif",
                "-V", "sansfont=DejaVu Sans",
                "-V", "monofont=DejaVu Sans Mono",
            ])

        result = subprocess.run(
            cmd, capture_output=True, text=True, cwd=work_dir
        )

        if result.returncode == 0:
            print(f"  PDF exported with pandoc + {engine}: {output_path}")
            return True
        else:
            print(f"  Pandoc error: {result.stderr[:300]}")
            return False

    finally:
        os.unlink(tmp_path)
        os.unlink(header_path)


def generate_latex_template(
    input_path: str,
    output_tex: str,
    figures_dir: str = "figures",
) -> str:
    """Generate a LaTeX .tex file from Markdown (for manual compilation).

    This is a fallback when pandoc is not available.
    """
    with open(input_path, "r", encoding="utf-8") as f:
        content = f.read()

    # Extract title from first # heading
    title_match = re.search(r'^#\s+(.+)$', content, re.MULTILINE)
    title = title_match.group(1) if title_match else "Experiment Report"

    # Extract author/date from metadata
    author_match = re.search(r'\*\*Author\*\*:\s*(.+?)(?:\s+\*\*|\n)', content)
    date_match = re.search(r'\*\*Date\*\*:\s*(.+?)(?:\s+\*\*|\n)', content)
    author = author_match.group(1).strip() if author_match else ""
    date = date_match.group(1).strip() if date_match else ""

    latex = r"""\documentclass[11pt,a4paper]{article}
\usepackage[margin=1in]{geometry}
\usepackage{booktabs}
\usepackage{graphicx}
\usepackage{float}
\usepackage{listings}
\usepackage{xcolor}
\usepackage{hyperref}

\lstset{
    basicstyle=\ttfamily\small,
    breaklines=true,
    frame=single,
    backgroundcolor=\color{gray!5},
}

\title{""" + _escape_latex(title) + r"""}
\author{""" + _escape_latex(author) + r"""}
\date{""" + _escape_latex(date) + r"""}

\begin{document}
\maketitle
\tableofcontents
\newpage

% NOTE: This is a template. Convert your markdown content to LaTeX
% or use pandoc: pandoc report.md -o report.pdf

\end{document}
"""

    with open(output_tex, "w", encoding="utf-8") as f:
        f.write(latex)

    print(f"  LaTeX template generated: {output_tex}")
    return output_tex


def _escape_latex(text: str) -> str:
    """Escape special LaTeX characters."""
    special_chars = {
        "&": r"\&",
        "%": r"\%",
        "$": r"\$",
        "#": r"\#",
        "_": r"\_",
        "{": r"\{",
        "}": r"\}",
        "~": r"\textasciitilde{}",
        "^": r"\textasciicircum{}",
    }
    for char, replacement in special_chars.items():
        text = text.replace(char, replacement)
    return text


def main():
    parser = argparse.ArgumentParser(
        description="Convert Markdown experiment report to LaTeX PDF with figures"
    )
    parser.add_argument("input", help="Input Markdown file")
    parser.add_argument("--output", help="Output PDF file (default: same name .pdf)")
    parser.add_argument(
        "--figures-dir", default="figures",
        help="Directory containing figure images (default: figures/)"
    )
    parser.add_argument(
        "--method", choices=["auto", "pandoc", "template"], default="auto",
        help="Export method (default: auto)"
    )

    args = parser.parse_args()

    input_path = args.input
    if not os.path.exists(input_path):
        print(f"Error: Input file not found: {input_path}")
        sys.exit(1)

    output_path = args.output or str(Path(input_path).with_suffix(".pdf"))

    print(f"Converting: {input_path} -> {output_path}")

    success = False

    if args.method in ("auto", "pandoc"):
        success = export_with_pandoc_latex(input_path, output_path, args.figures_dir)

    if not success and args.method in ("auto", "template"):
        tex_path = str(Path(output_path).with_suffix(".tex"))
        generate_latex_template(input_path, tex_path, args.figures_dir)
        print(f"\n  Compile manually: xelatex {tex_path}")

    if success:
        size = os.path.getsize(output_path)
        size_str = (f"{size / (1024*1024):.1f} MB" if size > 1024 * 1024
                    else f"{size / 1024:.1f} KB")
        print(f"\nExport complete: {output_path} ({size_str})")
    else:
        print(f"\nPDF export failed. Markdown preserved: {input_path}")
        print("  Install pandoc + texlive: apt-get install pandoc texlive-xetex")
        sys.exit(1)


if __name__ == "__main__":
    main()
