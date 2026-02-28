#!/usr/bin/env python3
"""
LaTeX Build Pipeline Template for Korean Academic Papers

This script automates the core transformations from markdown to publication-ready LaTeX:
- Strip Obsidian artifacts (wikilinks, tags, frontmatter)
- Inject XeLaTeX preamble with Korean font support
- Replace Mermaid placeholders with TikZ
- Wrap examples in tcolorbox
- Inject BibTeX citations via regex pattern matching
- Fix table formatting for wide tables
"""

import re
import sys
from pathlib import Path


class LaTeXBuilder:
    """Automates Markdown → LaTeX transformations"""

    def __init__(self, input_tex: str, output_tex: str, bib_file: str = None):
        """
        Args:
            input_tex: Path to pandoc-generated .tex file
            output_tex: Path to output processed .tex file
            bib_file: Optional path to .bib file for citation matching
        """
        self.input_tex = input_tex
        self.output_tex = output_tex
        self.bib_file = bib_file
        self.citations = {}
        self._load_citations()

    def _load_citations(self):
        """Parse .bib file to map paper names to citation keys"""
        if not self.bib_file or not Path(self.bib_file).exists():
            return

        with open(self.bib_file, 'r', encoding='utf-8') as f:
            content = f.read()

        # Extract @article{key, title={...}, year={...}, ...}
        pattern = r'@\w+\{([^,]+),.*?title\s*=\s*["{]([^"]*)["}].*?year\s*=\s*["{](\d{4})["}]'
        for match in re.finditer(pattern, content, re.DOTALL):
            key, title, year = match.groups()
            key = key.strip()
            title = title.strip()
            # Map variations: "ResNet" → ResNet2015
            self.citations[title.lower()] = f"\\cite{{{key}}}"
            # Also store with year pattern
            self.citations[f"{title.lower()} ({year})"] = f"\\cite{{{key}}}"

    def strip_obsidian_artifacts(self, content: str) -> str:
        """Remove wikilinks [[Page]], tags, and frontmatter"""
        # Remove YAML frontmatter
        content = re.sub(r'^---\n(.*?)\n---\n', '', content, flags=re.DOTALL)

        # Convert wikilinks [[Page]] → Page (or remove if too local)
        content = re.sub(r'\[\[([^\]]+)\]\]', r'\1', content)

        # Remove inline tags #tag (but keep hashtags in text)
        content = re.sub(r'(?:^|\s)#[\w-]+(?:\s|$)', ' ', content)

        return content.strip()

    def inject_preamble(self, content: str) -> str:
        """
        Insert XeLaTeX preamble with Korean font support at \documentclass

        This preamble includes:
        - ucharclasses + Noto Sans CJK KR font
        - tcolorbox for example boxes
        - natbib for citations
        - Overfull hbox prevention
        - Pandoc compatibility (\tightlist)
        """
        preamble = r"""
% XeLaTeX Preamble with Korean Font Support
\usepackage[T1]{fontenc}
\usepackage[utf-8]{inputenc}
\usepackage{xeCJK}
\usepackage{ucharclasses}

% Noto Sans CJK KR for Korean text (preferred over xeCJK)
% Requires: ~/.local/share/fonts/NotoSansCJK-*.ttc
\setCJKmainfont[
  BoldFont={* Bold},
  Path=~/.local/share/fonts/,
  Extension=.ttc
]{NotoSansCJK-Regular}

\setCJKsansfont[
  Path=~/.local/share/fonts/,
  Extension=.ttc
]{NotoSansCJK-Regular}

% Latin/English fallback
\setmainfont{Latin Modern Roman}
\setsansfont{Latin Modern Sans}
\setmonofont{Latin Modern Mono}

% Page geometry
\usepackage{geometry}
\geometry{margin=1in}

% Math & graphics
\usepackage{amssymb,amsmath}
\usepackage{graphicx}
\usepackage{float}

% Bibliography & citations
\usepackage{natbib}
\bibliographystyle{unsrtnat}

% Example boxes (tcolorbox)
\usepackage{tcolorbox}
\tcbuselibrary{most}

\newtcolorbox{skillbox}{
  colback=green!5!white,
  colframe=green!75!black,
  title=\textbf{Skill},
  fonttitle=\bfseries,
  arc=3mm,
  boxrule=1pt
}

\newtcolorbox{insightbox}{
  colback=orange!5!white,
  colframe=orange!75!black,
  title=\textbf{Insight},
  fonttitle=\bfseries,
  arc=3mm,
  boxrule=1pt
}

% Table formatting
\usepackage{longtable}
\usepackage{booktabs}
\usepackage[labelfont=bf]{caption}

% Overfull hbox prevention
\tolerance=1000
\emergencystretch=3em
\hfuzz=2pt

% Pandoc compatibility
\providecommand{\tightlist}{%
  \setlength{\itemsep}{0pt}\setlength{\parskip}{0pt}}

% Hyperlinks (optional)
\usepackage{hyperref}
\hypersetup{colorlinks=true, linkcolor=blue, urlcolor=blue}
"""

        # Insert after \documentclass line
        pattern = r'(\\documentclass\[.*?\]\{.*?\})'
        match = re.search(pattern, content)

        if match:
            insert_pos = match.end()
            content = content[:insert_pos] + preamble + content[insert_pos:]
        else:
            # Fallback: prepend preamble
            content = preamble + "\n" + content

        return content

    def replace_mermaid_with_tikz(self, content: str) -> str:
        """
        Replace Mermaid code blocks with TikZ placeholders.

        This is a template; for production, integrate mermaid-to-tikz converter.
        """
        # Match ```mermaid ... ``` blocks
        pattern = r'```mermaid\n(.*?)\n```'

        def tikz_placeholder(match):
            mermaid_code = match.group(1)
            # Simple heuristic: detect graph direction
            if 'graph LR' in mermaid_code or 'graph TB' in mermaid_code:
                return r"""
\begin{tikzpicture}[node distance=2cm, auto]
  % TODO: Convert mermaid to TikZ
  % Mermaid code:
  % """ + mermaid_code.replace('\n', '\n  % ') + r"""
  \node (A) {A};
  \node (B) [right of=A] {B};
  \draw[->] (A) -- (B);
\end{tikzpicture}
"""
            return ""

        content = re.sub(pattern, tikz_placeholder, content, flags=re.DOTALL)
        return content

    def wrap_examples_in_tcolorbox(self, content: str) -> str:
        """
        Wrap example blocks in tcolorbox environments.

        Heuristic: Look for lines starting with \\textbf{Example:} or \\textbf{예제:}
        """
        lines = content.split('\n')
        result = []
        in_example = False
        example_type = 'skillbox'

        for i, line in enumerate(lines):
            # Detect example start
            if re.search(r'\\textbf\{Example:|\\textbf\{예제:', line):
                in_example = True
                example_type = 'skillbox' if 'Skill' in line else 'insightbox'
                result.append(f'\\begin{{{example_type}}}')
                # Remove the \textbf prefix
                line = re.sub(r'\\textbf\{Example:\s*\}', '', line)
                line = re.sub(r'\\textbf\{예제:\s*\}', '', line)

            # Detect example end (blank line or new section)
            elif in_example and (line.strip() == '' or re.match(r'^\\(section|subsection|subsubsection)', line)):
                result.append(f'\\end{{{example_type}}}')
                in_example = False
                if line.strip() != '':
                    result.append(line)
                continue

            result.append(line)

        # Close any unclosed box
        if in_example:
            result.append(f'\\end{{{example_type}}}')

        return '\n'.join(result)

    def inject_citations(self, content: str) -> str:
        """
        Inject BibTeX citations via regex pattern matching.

        Strategy:
        1. Try "PaperName (Year)" pattern
        2. Fallback to name-only match
        3. Use \nocite{key} for uncited papers
        """
        for paper_pattern, cite_cmd in self.citations.items():
            # Exact pattern: PaperName (Year)
            pattern = re.escape(paper_pattern)
            content = re.sub(pattern, cite_cmd, content, flags=re.IGNORECASE)

        # Fallback: Look for capitalized names without year
        # e.g., "ResNet" → \cite{ResNet2015} if available
        for pattern in list(self.citations.keys()):
            # Extract paper name (before year)
            match = re.match(r'([^(]+)(?:\s*\(\d{4}\))?', pattern)
            if match:
                paper_name = match.group(1).strip()
                # Avoid duplicate replacements
                if paper_name.lower() != pattern.lower():
                    regex = r'\b' + re.escape(paper_name) + r'\b'
                    if paper_name in content and paper_name not in self.citations:
                        content = re.sub(regex, self.citations[pattern], content)

        return content

    def fix_table_formatting(self, content: str) -> str:
        """
        Fix table formatting for wide tables.

        Problem: Pandoc generates tables with |l|l|l|... which overflow on wide tables
        Solution: Replace with p{2cm} columns or adjust widths dynamically
        """
        # Find longtable environments
        pattern = r'\\begin\{longtable\}\{([^}]+)\}'

        def fix_columns(match):
            cols = match.group(1)
            # Count columns
            col_count = cols.count('|') - 1  # Remove outer pipes
            col_count = max(col_count, cols.count('l') + cols.count('c') + cols.count('r'))

            if col_count > 0:
                # Calculate column width: assume 6.5 inch text width, 0.5 inch margins
                # Rough: 6in / col_count, minus separator space
                col_width = f"{{p{{{{1.5cm}}}}}}" * col_count
                # Return as p{width} format
                return f"\\begin{{longtable}}{{{col_width.replace('{', '').replace('}', ' p{1.5cm} ')}}}"

            return match.group(0)

        # Simple heuristic: convert |l|l|l| to p{} format
        content = re.sub(r'\{(\|+[lcr\|]+\|+)\}', lambda m: '{' + 'p{1.5cm}' * m.group(1).count('|') + '}', content)

        return content

    def remove_duplicate_sections(self, content: str) -> str:
        """
        Remove or merge duplicate sections.

        Common duplicates:
        - "List of Papers" + "References"
        - Repeated introductions
        """
        # Split by major sections
        sections = re.split(r'(\\section\{[^}]+\})', content)

        seen_sections = {}
        result = []

        for i, part in enumerate(sections):
            if part.startswith('\\section{'):
                section_name = re.search(r'\\section\{([^}]+)\}', part).group(1).lower()

                # Skip duplicate "References", "List of Papers", etc.
                if 'reference' in section_name or 'paper' in section_name:
                    if section_name in seen_sections:
                        # Skip this section (it's a duplicate)
                        # Also skip the following content until next section
                        continue
                    seen_sections[section_name] = True

            result.append(part)

        return ''.join(result)

    def process(self) -> bool:
        """
        Run the complete build pipeline.

        Returns True on success, False on error.
        """
        try:
            print(f"[*] Reading input: {self.input_tex}")
            with open(self.input_tex, 'r', encoding='utf-8') as f:
                content = f.read()

            print("[*] Stripping Obsidian artifacts...")
            content = self.strip_obsidian_artifacts(content)

            print("[*] Injecting XeLaTeX preamble...")
            content = self.inject_preamble(content)

            print("[*] Replacing Mermaid with TikZ...")
            content = self.replace_mermaid_with_tikz(content)

            print("[*] Wrapping examples in tcolorbox...")
            content = self.wrap_examples_in_tcolorbox(content)

            print("[*] Injecting BibTeX citations...")
            content = self.inject_citations(content)

            print("[*] Fixing table formatting...")
            content = self.fix_table_formatting(content)

            print("[*] Removing duplicate sections...")
            content = self.remove_duplicate_sections(content)

            print(f"[*] Writing output: {self.output_tex}")
            with open(self.output_tex, 'w', encoding='utf-8') as f:
                f.write(content)

            print("[+] Build pipeline completed successfully!")
            return True

        except Exception as e:
            print(f"[-] Error during build: {e}", file=sys.stderr)
            return False


if __name__ == '__main__':
    if len(sys.argv) < 3:
        print(f"Usage: {sys.argv[0]} <input.tex> <output.tex> [references.bib]")
        print(f"\nExample:")
        print(f"  {sys.argv[0]} pandoc_output.tex final.tex references.bib")
        sys.exit(1)

    input_file = sys.argv[1]
    output_file = sys.argv[2]
    bib_file = sys.argv[3] if len(sys.argv) > 3 else None

    builder = LaTeXBuilder(input_file, output_file, bib_file)
    success = builder.process()

    sys.exit(0 if success else 1)
