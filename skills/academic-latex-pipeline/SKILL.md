---
name: academic-latex-pipeline
description: >-
  Complete workflow for converting Korean/English academic survey Markdown into
  publication-quality LaTeX PDFs. Handles Obsidian artifact cleanup (wikilinks,
  mermaid), XeLaTeX compilation with Korean font support (ucharclasses + Noto
  Sans CJK KR), BibTeX citations, TikZ figure generation, tcolorbox example
  boxes, and iterative format review. Use this skill whenever the user wants to
  build a PDF from an academic markdown file, compile a LaTeX survey paper, or
  fix formatting issues in an existing academic PDF. MANDATORY TRIGGERS: LaTeX
  survey, academic PDF, 서베이 PDF, 논문 PDF 빌드, xelatex, build_latex.py,
  Korean academic paper, survey compilation
---

# Academic LaTeX Pipeline

Converts academic survey Markdown (often from Obsidian) into polished LaTeX PDFs. The pipeline has five phases, each with a decision gate before proceeding.

## When to Use

- User has a `.md` survey/paper and wants a PDF
- User wants to fix formatting in an existing LaTeX-compiled PDF
- User needs Korean font support in LaTeX (XeLaTeX + Noto Sans CJK KR)
- User wants to replace Mermaid diagrams with TikZ figures
- User mentions `build_latex.py` or survey compilation

## Phase Overview

```
Phase 1: Content Quality    → iterative-academic-writing skill, Critical=0 to pass
Phase 2: LaTeX Build        → MD→TEX→PDF pipeline with Korean fonts
Phase 3: Format Review      → Page-by-page visual inspection, fix overflows
Phase 4: Figure Validation  → TikZ rendering, captions, sizing
Phase 5: Git Management     → Per-project repo, selective file push
```

---

## Phase 1: Content Writing Loop

Invoke `iterative-academic-writing` skill on the source `.md` file. The skill applies 14 academic writing principles with FactBase verification and hallucination detection.

**Gate**: Critical issues = 0 → proceed to Phase 2.

This phase ensures content quality before expensive LaTeX processing. Don't skip it — fixing content errors after PDF generation wastes time.

---

## Phase 2: LaTeX Build Pipeline

### 2.1 Project Structure

Each academic project lives in its own directory under `07_Academic_Writing/`:
```
ProjectName/
├── SourceDocument.md          # Obsidian source (may have wikilinks, mermaid)
├── build_latex.py             # Python build script (MD → TEX → PDF)
├── build_and_compile.sh       # Shell wrapper for build + xelatex + bibtex
├── references.bib             # BibTeX bibliography
├── survey_main.tex            # Generated LaTeX (output of build_latex.py)
├── survey_main.pdf            # Final PDF
└── .gitignore                 # Exclude .aux .log .out .toc .bbl .blg
```

### 2.2 Build Script (`build_latex.py`)

The build script handles the full MD→TEX transformation:

1. **Preprocess MD**: Strip wikilinks `[[...]]`, remove Obsidian YAML frontmatter, clean tags
2. **Pandoc conversion**: `pandoc input.md -f markdown -t latex`
3. **Inject preamble** with Korean font support:
   ```latex
   \usepackage{fontspec}
   \usepackage{ucharclasses}
   \setmainfont{Noto Sans CJK KR}
   \newfontfamily\hangulfont{Noto Sans CJK KR}
   \setTransitionsForCJK{\hangulfont}{}{}
   ```
   Why `ucharclasses` instead of `xeCJK`? The `xeCJK` package requires `ctexhook.sty` which is missing from many LaTeX distributions. `ucharclasses` is more portable.

4. **Replace Mermaid** blocks with TikZ figures
5. **Wrap examples** in `tcolorbox` environments
6. **Inject citations**: Match `PaperName (Year)` → `\cite{key_year}`
7. **Fix tables**: Use `p{Xcm}` columns instead of `l`/`c`/`r` to prevent overflow

### 2.3 Font Installation
```bash
mkdir -p ~/.local/share/fonts
# Download Noto Sans CJK KR from github.com/googlei18n/noto-cjk/releases
fc-cache -fv ~/.local/share/fonts/
```

### 2.4 Compilation (3-pass)
```bash
xelatex -interaction=nonstopmode survey_main.tex   # Pass 1
bibtex survey_main                                   # Citations
xelatex -interaction=nonstopmode survey_main.tex   # Pass 2 (resolve refs)
xelatex -interaction=nonstopmode survey_main.tex   # Pass 3 (final)
```

### 2.5 Overfull Hbox Prevention (Preamble)
```latex
\tolerance=1000
\emergencystretch=3em
\hfuzz=2pt
```

**Gate**: Compilation succeeds without errors → proceed to Phase 3.

---

## Phase 3: Format Review Loop

Review the PDF page by page. Check for:

**Critical** (must fix, loop back):
- Table overflow beyond margins
- Missing or blank figures
- Unreadable/clipped text
- `[[wikilink]]` artifacts surviving preprocessing
- Undefined citations

**Minor** (can defer):
- Spacing tweaks, caption capitalization, color preferences

For each critical issue:
- Table overflow → adjust column widths in `build_latex.py`, use `tabularx` with `X` columns
- Missing figures → test TikZ in standalone mode, simplify
- Wikilinks → fix regex in build script's preprocessing step
- Undefined citations → add entries to `references.bib`

Recompile after fixes. Gate: no Critical issues → Phase 4.

---

## Phase 4: Figure/Image Review

For each TikZ figure:
1. Does it render correctly?
2. Is the caption present and descriptive?
3. Is sizing appropriate (`\resizebox{\textwidth}{!}{...}`)?
4. Is placement correct (`[H]` float specifier)?

Test problematic TikZ in isolation:
```latex
\documentclass[tikz]{standalone}
\usepackage{tikz}
\begin{document}
% TikZ code here
\end{document}
```

Gate: all figures correct → Phase 5.

---

## Phase 5: Git Management

Each academic project gets its own GitHub repository. Only push LaTeX/build files, not Obsidian notes.

### Files to include in repo:
- `build_latex.py`, `build_and_compile.sh`
- `survey_main.tex`, `survey_main.pdf`
- `references.bib`
- `.gitignore`

### Files to exclude:
- Original `.md` Obsidian source (stays in Obsidian vault only)
- `.obsidian/` directory
- LaTeX build artifacts (`.aux`, `.log`, `.out`, `.toc`, `.bbl`, `.blg`)

### `.gitignore` template:
```
*.aux
*.log
*.out
*.toc
*.bbl
*.blg
*.synctex.gz
.DS_Store
```

### Repo naming: `Username/Project-Name` (e.g., `iamseungpil/Skill-LM-Survey`)

---

## Common Issues & Fixes

| Issue | Fix |
|-------|-----|
| Korean text missing | Verify Noto Sans CJK KR installed, check `fc-list \| grep Noto` |
| Overfull hbox | Increase `\tolerance`, `\emergencystretch`, reword long lines |
| Table overflow | Use `p{2cm}` or `X` columns, reduce content |
| Broken tcolorbox | Check `\tcbuselibrary{most}` is loaded |
| Undefined citations | Add missing keys to `.bib`, rerun bibtex |
| Mermaid not replaced | Check regex pattern in build script |

## English Version Generation

For bilingual projects, create a separate English build:
- Translate MD content (keep same structure)
- Use English-specific preamble (no CJK fonts needed, use standard `\usepackage[T1]{fontenc}`)
- Generate `survey_main_EN.tex` → `survey_main_EN.pdf`
- Both versions share `references.bib`

## Related Skills

- `iterative-academic-writing` — Phase 1 content evaluation
- `pdf` — General PDF manipulation (merge, split, forms)
