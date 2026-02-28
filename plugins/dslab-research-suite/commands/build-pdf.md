---
description: Build a LaTeX PDF from an academic survey markdown
argument-hint: [markdown-file-path]
---

Invoke the academic-latex-pipeline skill to convert the markdown file at @$1 into a publication-quality LaTeX PDF.

Follow the 5-phase pipeline:
1. Content quality check (iterative-academic-writing, 14 principles)
2. LaTeX build (MD → TEX → PDF with Korean font support)
3. Format review (table overflow, figure validation)
4. Figure/image review (TikZ)
5. Git management (per-project repo, selective push)
