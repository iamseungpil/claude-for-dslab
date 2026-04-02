# Structure Rules Reference

## Section Name Mapping

When splitting sections, convert section titles to filenames:

```
\section{Background \& Motivation}  → 01_background.tex
\section{Research Questions}         → 02_research_questions.tex
\section{Proposed Method}            → 03_proposed_method.tex
\section{Experimental Setup}         → 04_experimental_setup.tex
\section{Expected Results \& Analysis} → 05_expected_results.tex
\section*{Acknowledgments}           → (merged into NN_bibliography.tex)
```

Rules:
- Remove special characters (`&`, `:`, etc.)
- Convert spaces to underscores
- Lowercase
- Prefix with zero-padded number
- `\section*` (unnumbered) sections merge into nearest numbered section file

## Frontmatter Extraction

Everything between `\begin{document}` and the first `\section`:
```latex
% 00_frontmatter.tex
\title{...}
\author{...}
\date{...}

\maketitle

\begin{abstract}
...
\end{abstract}
```

## Bibliography Conversion: Inline → BibTeX

### Input (inline)
```latex
\bibitem[Zelikman et~al.(2024)]{zelikman2024quietstar}
Zelikman, E., Harik, G., ... (2024). Quiet-STaR: ...
\textit{arXiv preprint arXiv:2403.09629}.
```

### Output (refs.bib)
```bibtex
@article{zelikman2024quietstar,
  author  = {Zelikman, Eric and Harik, Georges and ...},
  title   = {Quiet-{STaR}: Language Models Can Teach Themselves to Think Before Speaking},
  journal = {arXiv preprint arXiv:2403.09629},
  year    = {2024},
}
```

### Conversion Rules
- `\textit{arXiv preprint ...}` → `@article` with `journal` field
- `\textit{Proceedings of ...}` or `In \textit{...}` → `@inproceedings` with `booktitle` field
- `\textit{Journal Name}` → `@article` with `journal` field
- Preserve citation keys exactly as in `\bibitem{key}`
- Expand author abbreviations where possible (E. → Eric)
- Protect capitalization with `{braces}` in titles

## main.tex Template

```latex
\newcommand{\professor}{PROJECT_NAME}  % Change to select project

\documentclass[11pt,a4paper]{article}

%%% MERGED PREAMBLE (superset of all projects) %%%

% Graphics path per project
\graphicspath{{\professor/figures/}}

\begin{document}
\input{\professor/content}
\end{document}
```

## content.tex Template

```latex
\input{PROJECT_NAME/sections/00_frontmatter}
\input{PROJECT_NAME/sections/01_SECTION_NAME}
...
\input{PROJECT_NAME/sections/NN_bibliography}
```

Note: Use hardcoded project name in `\input` paths, not `\professor` variable,
because `\input` with `\professor` works in main.tex but content.tex paths
should be explicit for clarity and Overleaf compatibility.

## Compilation Verification Checklist

1. `pdflatex -interaction=nonstopmode main.tex` → no `!` errors
2. `bibtex main` → no errors, correct `.bib` file found
3. `pdflatex` × 2 more passes → resolve references
4. `grep "! " main.log` → 0 results
5. `grep "Overfull" main.log` → 0 results (or acceptable)
6. `grep "Citation.*undefined" main.log` → 0 results
7. Page count matches original
8. `grep -c "bibitem" main.bbl` matches number of `\cite` calls
