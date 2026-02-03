#!/usr/bin/env python3
"""
PDF Export Utility for update-study skill.

Converts Markdown study documents to PDF with:
- Table of Contents
- [NEW] tag highlighting
- Clean table formatting
- Code syntax highlighting

Usage:
    python export_pdf.py input.md output.pdf
    python export_pdf.py study.md  # outputs study.pdf

Fallback order:
1. pandoc + LaTeX (best quality)
2. weasyprint (if pandoc unavailable)
3. markdown-pdf via Node.js (alternative)
4. Warning message (if all fail)
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


def preprocess_markdown(content: str) -> str:
    """
    Preprocess markdown for better PDF rendering.

    - Highlight [NEW] tags
    - Ensure table alignment
    - Fix code block formatting
    """
    # Highlight [NEW] tags with yellow background (LaTeX/HTML compatible)
    # For pandoc LaTeX: use \colorbox
    # For HTML/weasyprint: use <mark>
    content = re.sub(
        r'\[NEW\]',
        r'**\\[NEW\\]**{.new-tag}',
        content
    )

    # Ensure proper spacing around tables
    content = re.sub(
        r'(\n\|[^\n]+\|)\n([^\|])',
        r'\1\n\n\2',
        content
    )

    return content


def export_with_pandoc(input_path: str, output_path: str) -> bool:
    """Export using pandoc with LaTeX backend."""
    if not check_command('pandoc'):
        return False

    # Check for LaTeX
    has_latex = check_command('pdflatex') or check_command('xelatex')

    # Read and preprocess
    with open(input_path, 'r', encoding='utf-8') as f:
        content = f.read()

    # Create temp file with preprocessed content
    with tempfile.NamedTemporaryFile(mode='w', suffix='.md', delete=False, encoding='utf-8') as tmp:
        tmp.write(content)
        tmp_path = tmp.name

    try:
        cmd = [
            'pandoc',
            tmp_path,
            '-o', output_path,
            '--toc',
            '--toc-depth=3',
            '-V', 'geometry:margin=1in',
            '-V', 'fontsize=11pt',
            '--highlight-style=tango',
        ]

        if has_latex:
            cmd.extend([
                '--pdf-engine=xelatex' if check_command('xelatex') else '--pdf-engine=pdflatex',
                '-V', 'mainfont=DejaVu Sans',
                '-V', 'monofont=DejaVu Sans Mono',
            ])

        # Add header with [NEW] tag styling
        header_content = r'''
\usepackage{xcolor}
\definecolor{newtag}{RGB}{255, 255, 150}
\newcommand{\newtag}[1]{\colorbox{newtag}{\textbf{#1}}}
'''

        with tempfile.NamedTemporaryFile(mode='w', suffix='.tex', delete=False, encoding='utf-8') as header_file:
            header_file.write(header_content)
            header_path = header_file.name

        if has_latex:
            cmd.extend(['-H', header_path])

        result = subprocess.run(cmd, capture_output=True, text=True)

        if result.returncode == 0:
            print(f"✓ PDF exported with pandoc: {output_path}")
            return True
        else:
            print(f"⚠ Pandoc error: {result.stderr[:200]}")
            return False

    finally:
        os.unlink(tmp_path)
        if 'header_path' in locals():
            os.unlink(header_path)


def export_with_weasyprint(input_path: str, output_path: str) -> bool:
    """Export using weasyprint (HTML to PDF)."""
    try:
        from weasyprint import HTML, CSS
        import markdown
    except ImportError:
        return False

    # Read markdown
    with open(input_path, 'r', encoding='utf-8') as f:
        md_content = f.read()

    # Convert to HTML
    html_content = markdown.markdown(
        md_content,
        extensions=['tables', 'fenced_code', 'toc', 'codehilite']
    )

    # Highlight [NEW] tags
    html_content = re.sub(
        r'\[NEW\]',
        r'<mark style="background-color: #ffff96; padding: 2px 4px; font-weight: bold;">[NEW]</mark>',
        html_content
    )

    # Full HTML document
    full_html = f'''
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <style>
        body {{
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
            font-size: 11pt;
            line-height: 1.6;
            max-width: 800px;
            margin: 0 auto;
            padding: 20px;
        }}
        h1, h2, h3 {{ color: #333; }}
        h1 {{ border-bottom: 2px solid #333; padding-bottom: 10px; }}
        h2 {{ border-bottom: 1px solid #ddd; padding-bottom: 5px; }}
        table {{
            border-collapse: collapse;
            width: 100%;
            margin: 15px 0;
        }}
        th, td {{
            border: 1px solid #ddd;
            padding: 8px 12px;
            text-align: left;
        }}
        th {{
            background-color: #f5f5f5;
            font-weight: bold;
        }}
        tr:nth-child(even) {{ background-color: #fafafa; }}
        code {{
            background-color: #f4f4f4;
            padding: 2px 6px;
            border-radius: 3px;
            font-family: "SF Mono", Monaco, "Cascadia Code", monospace;
            font-size: 0.9em;
        }}
        pre {{
            background-color: #f8f8f8;
            padding: 15px;
            border-radius: 5px;
            overflow-x: auto;
        }}
        pre code {{
            background: none;
            padding: 0;
        }}
        mark {{
            background-color: #ffff96;
            padding: 2px 4px;
            font-weight: bold;
        }}
        blockquote {{
            border-left: 4px solid #ddd;
            margin: 0;
            padding-left: 15px;
            color: #666;
        }}
        hr {{
            border: none;
            border-top: 1px solid #ddd;
            margin: 30px 0;
        }}
    </style>
</head>
<body>
{html_content}
</body>
</html>
'''

    try:
        HTML(string=full_html).write_pdf(output_path)
        print(f"✓ PDF exported with weasyprint: {output_path}")
        return True
    except Exception as e:
        print(f"⚠ Weasyprint error: {e}")
        return False


def export_with_grip(input_path: str, output_path: str) -> bool:
    """Export using grip (GitHub-flavored markdown preview)."""
    if not check_command('grip'):
        return False

    # grip exports to HTML, then we'd need another tool for PDF
    # This is a fallback that creates HTML instead
    html_output = output_path.replace('.pdf', '.html')

    try:
        result = subprocess.run(
            ['grip', input_path, '--export', html_output],
            capture_output=True,
            text=True,
            timeout=60
        )

        if result.returncode == 0:
            print(f"✓ HTML exported with grip: {html_output}")
            print(f"  (PDF conversion requires additional tools)")
            return False  # Return False since we didn't create PDF
        return False
    except Exception:
        return False


def main():
    parser = argparse.ArgumentParser(
        description='Convert Markdown study document to PDF'
    )
    parser.add_argument(
        'input',
        help='Input Markdown file'
    )
    parser.add_argument(
        'output',
        nargs='?',
        help='Output PDF file (default: same name with .pdf extension)'
    )
    parser.add_argument(
        '--method',
        choices=['pandoc', 'weasyprint', 'auto'],
        default='auto',
        help='Conversion method (default: auto)'
    )

    args = parser.parse_args()

    # Validate input
    input_path = args.input
    if not os.path.exists(input_path):
        print(f"Error: Input file not found: {input_path}")
        sys.exit(1)

    # Determine output path
    output_path = args.output
    if not output_path:
        output_path = str(Path(input_path).with_suffix('.pdf'))

    print(f"📄 Converting: {input_path} → {output_path}")

    # Try conversion methods
    success = False

    if args.method == 'pandoc':
        success = export_with_pandoc(input_path, output_path)
    elif args.method == 'weasyprint':
        success = export_with_weasyprint(input_path, output_path)
    else:  # auto
        # Try in order of preference
        if not success:
            print("  Trying pandoc...")
            success = export_with_pandoc(input_path, output_path)

        if not success:
            print("  Trying weasyprint...")
            success = export_with_weasyprint(input_path, output_path)

    if success:
        print(f"\n✅ Export complete: {output_path}")

        # Show file size
        size = os.path.getsize(output_path)
        if size > 1024 * 1024:
            print(f"   Size: {size / (1024*1024):.1f} MB")
        else:
            print(f"   Size: {size / 1024:.1f} KB")
    else:
        print("\n⚠️ PDF export failed. Available options:")
        print("   1. Install pandoc: https://pandoc.org/installing.html")
        print("   2. Install weasyprint: pip install weasyprint markdown")
        print(f"\n   Markdown file preserved: {input_path}")
        sys.exit(1)


if __name__ == '__main__':
    main()
