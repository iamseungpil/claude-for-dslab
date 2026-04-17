---
name: academic-slides-iterative
description: >-
  Build academic Beamer slide decks through a strict two-phase iterative loop:
  first write the full content as prose outline, self-critic until each slide
  carries exactly one informative concept, then convert to LaTeX with visual
  verification loop that renders each page, inspects for clipped/overlapping
  content, and re-compiles until zero format breakage. Optimized for
  implementation-walkthrough / research-talk decks where every slide must
  show a single idea: one flowchart, one code block, one table, or one
  example. Matches Metropolis Beamer style, no emojis, minimal prose,
  flowcharts / verbatim boxes / I-O structure preferred over bullet lists.
  MANDATORY TRIGGERS: academic slides, iterative slides, research talk deck,
  Beamer presentation, one concept per slide, implementation walkthrough
  slides, Metropolis talk, 연구 발표 슬라이드, 한 슬라이드 한 개념, ppt
  loop, slide critic loop
allowed-tools: [Read, Write, Edit, Bash, Glob, Grep]
license: MIT license
metadata:
  skill-author: ARC-AGI-3 Research
---

# Academic Slides Iterative

Build research-talk Beamer decks through a **two-phase loop**: content → form,
with a self-critic gate in each phase. Every slide carries exactly one
concept, expressed as a flowchart / code block / table / example — not as a
wall of prose.

## When to use

- User is preparing an implementation walkthrough, research talk, thesis
  defense, lab meeting, or weekly research update and wants a polished
  Beamer deck.
- User explicitly wants "one concept per slide" / "minimum prose" / "flowchart
  and code, not bullet lists".
- User wants the slides to actually reflect their code — function names,
  prompt snippets, real data examples — rather than generic bullet points.
- User wants to iterate until clipping / overflow / spelling issues are
  all resolved.

## Non-goals

- Does not generate AI images (no Nano Banana, no external renders).
- Does not write survey papers or long-form manuscripts (see
  `academic-latex-pipeline` for that).
- Does not target PowerPoint (pure LaTeX Beamer).

---

## Phase 0 — gather the source material

Before writing any slide, collect concrete artefacts the talk needs to
reference:

1. Read the user's intent message verbatim. Extract the acts / parts they
   want covered.
2. Read the code / data the talk is about. For every claim that will land
   on a slide, open the actual file and cite `path:line` in a scratch note.
3. If the talk cites experimental numbers, load the JSON logs and extract
   the exact counts. Never paraphrase a number without grepping.
4. If the talk cites function signatures, copy the signature verbatim from
   the source. Do not summarise.
5. If real example prompts / skills / responses exist in run artefacts,
   pull at least 3 concrete examples and decide which diversity axis you
   want to show.

Write this as `slides_source_notes.md` alongside the eventual `.tex`.
Every slide you later draft must cite back to a source note entry.

---

## Phase 1 — prose outline first (content gate)

Produce a Markdown outline where each slide is a heading with ≤ 80 words
of prose describing the one idea, the supporting artefact, and the
takeaway sentence. **Do not start LaTeX until this outline passes the
self-critic gate below.**

Outline template per slide:

```markdown
### Slide N — <title>
*One concept:* <one sentence>
*Artefact:* <flowchart | verbatim code | table | example box>
*Source:* <file:line or run JSON path>
*Takeaway sentence:* <one sentence the speaker will say>
```

### Phase-1 self-critic gate

Loop the following checks until all pass:

1. **One concept per slide.** If a slide's *one concept* line reads like
   two ideas joined by "and", split the slide or drop the second idea.
2. **Source grounded.** Every slide must name a real file, line, run
   namespace, or JSON path. "In the world model" is not a source.
3. **Takeaway readable alone.** If the speaker's takeaway sentence needs
   the artefact to make sense, rewrite the sentence to stand alone.
4. **Section boundaries real.** Part dividers (`\section`) should each
   mark a legitimate topic shift, not pace filler.
5. **No "what this talk contributes" / "conclusion" / "acknowledgements"
   slides unless the user explicitly asked** — they usually belong in the
   talk, not the slides.
6. **No five-kind / taxonomy slides if the implementation does not
   meaningfully split on them.** Show flat lists of real examples
   instead.
7. **Real examples over illustrations.** If the talk is about a system
   that has produced actual artefacts (skills, prompts, run responses),
   the slide must show a real one — not a made-up one.

Only when all seven checks pass, proceed to Phase 2.

---

## Phase 2 — translate to Beamer, with a render-verify loop

### Per-slide generation rules

- Use Metropolis theme: `\usetheme{metropolis}`.
- Load `booktabs`, `fancyvrb`, `tikz`, and the TikZ libraries
  `positioning, arrows.meta, shapes, shapes.geometric, calc, fit,
  backgrounds`.
- A slide is at most one of:
  - a TikZ flowchart
  - a `\begin{Verbatim}` block with the real code / prompt / skill
  - a `booktabs` table with ≤ 6 rows
  - a single labelled I/O box with input on top, output below
- Minimum font in code blocks: `\scriptsize`. Drop to `\tiny` only if
  the code exceeds 16 lines.
- Titles use sentence case, no emoji.
- Every TikZ diagram is wrapped in
  `\resizebox{0.98\textwidth}{!}{ ... }` or
  `\resizebox{!}{0.8\textheight}{ ... }`.
- Arrows use `\tikzset{arr/.style={-{Latex[length=1.6mm]}, thick}}`.
- Cross-module / long-range TikZ links route **below** the modules
  through explicit coordinate via-points to avoid label clashes.
- Avoid `\draw ... to[bend ...]` through the centre of a labelled box.

### Render-verify loop

After every compile:

1. Run `pdflatex -interaction=nonstopmode` twice. Record the return code.
2. Grep the log for `Overfull .* too wide` and `Overfull .* too high` and
   `LaTeX Error` and `Undefined control sequence`.
3. Use a PDF reading tool to open each slide and visually check:
   a. no text is clipped at the slide edge,
   b. arrows terminate on box borders, not through other boxes,
   c. table columns do not run off the page,
   d. verbatim blocks are not cut off at bottom.
4. For every issue found, record `slide N : <issue>` in a scratch list.
5. Apply the smallest fix that removes the issue:
   - horizontal clipping → wrap TikZ in `\resizebox{0.98\textwidth}{!}`
   - vertical overflow → shrink fontsize one step (`\scriptsize → \tiny`)
     or split into two slides
   - arrow crossing a box → route via explicit coordinate below the row
   - label glued to box → use `node[pos=0.5, above=1pt]` or relocate
     the label onto the arrow midpoint
   - title with underscores rendered wrong → `\texttt{\_underscored\_}`
6. Recompile and loop until all four checks pass on every slide.

Exit the loop only when:

- every `pdflatex` pass exits with `RC = 0`
- no `LaTeX Error` or `Undefined control sequence` in the log
- overflow warnings are either absent or explicitly within the title page
  frame (which Metropolis reports as a known cosmetic 15 pt vbox)
- visual inspection of every page found no clipped / overlapping / badly
  aligned content

---

## Phase 3 — push

When the user asks, push to:

- git (if a repo is available locally or via `gh`): commit with a
  descriptive message that cites which slides were changed and why,
  then `git push`.
- Hugging Face datasets (if `hf auth whoami` succeeds): upload the
  `.tex` and `.pdf` via `hf upload <repo> <path> <path> --repo-type
  dataset`.

Always return both URLs to the user.

---

## Supporting files

- `references/style_guide.md` — concrete examples of the "one concept,
  one artefact" rule with good vs bad slide pairs.
- `references/tikz_recipes.md` — proven TikZ patterns for decision
  flowcharts, module maps with via-points, and commit loops.
- `scripts/render_and_check.sh` — the compile + overfull-grep + page
  count helper used in the render-verify loop.
