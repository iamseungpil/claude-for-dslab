---
name: academic-slides-iterative
description: >-
  Build academic Beamer slide decks through a four-phase iterative loop:
  (0) gather grounded source material, (1) insight-first prose outline
  with self-critic, (2) LaTeX render + visual verification, (3) fact-drift
  re-audit against live code. Every slide carries exactly one concept as a
  flowchart / code block / table / I-O example — never a prose bullet list.
  The deck itself is lean (keywords + figures); a companion talking-points
  markdown carries the depth. Leads with a TL;DR slide framed as "since
  <baseline>: [added] / [worked] / [missing]". Seeds vs agent-discovered
  examples are always distinguished. Matches Metropolis Beamer style, no
  emojis, minimum prose, flowcharts / verbatim boxes / I-O structure preferred
  over bullet lists. Paper-digest-style principle: explain WHY it matters
  at an abstract level, not WHAT each file/line does — but numbers and
  example payloads must be verbatim. MANDATORY TRIGGERS: academic slides,
  iterative slides, research talk deck, Beamer presentation, one concept
  per slide, implementation walkthrough slides, Metropolis talk,
  연구 발표 슬라이드, 한 슬라이드 한 개념, ppt loop, slide critic loop,
  weekly update deck, thesis defense deck, lab meeting slides
allowed-tools: [Read, Write, Edit, Bash, Glob, Grep]
license: MIT license
metadata:
  skill-author: DS-Lab Research
---

# Academic Slides Iterative

Build research-talk Beamer decks through a **four-phase loop**:
**source → content → form → fact-drift**, with a self-critic gate at each
phase. Every slide carries exactly one concept, expressed as a flowchart,
code block, table, or I-O example — not as a wall of prose.

The deck itself is **lean**: keywords + figures, captions shrunk to
one-liners. The depth lives in a **companion markdown** the speaker reads
off-stage.

## When to use

- User is preparing an implementation walkthrough, research talk, thesis
  defense, lab meeting, or weekly research update and wants a polished
  Beamer deck.
- User explicitly wants "one concept per slide" / "minimum prose" / "flowchart
  and code, not bullet lists" / "두괄식" / "lead with conclusion".
- User wants the slides to actually reflect their code — function names
  and real data examples — rather than generic bullet points.
- User wants to iterate until clipping / overflow / arrow overlap / stale
  claim issues are all resolved.
- User wants both (a) a lean deck and (b) a companion prose document with
  deeper explanations.

## Non-goals

- Does not generate AI images (no external renders).
- Does not write survey papers or long-form manuscripts (see
  `academic-latex-pipeline`).
- Does not target PowerPoint (pure LaTeX Beamer).

---

## Phase 0 — gather grounded source material

Before writing any slide, collect concrete artefacts the talk needs to
reference.

1. Read the user's intent message verbatim. Extract which acts / parts
   they want covered.
2. Read the code / data the talk is about. For every claim that will land
   on a slide, open the actual file and cite `path:line` in a scratch
   note. A scratch note reference is private to the author; **slides
   themselves usually do not show file:line** (see Phase 1 rule 8).
3. If the talk cites experimental numbers, load the JSON logs and extract
   the exact counts. Never paraphrase a number.
4. If the talk cites function signatures or code bodies, copy them
   verbatim from the source.
5. If real example prompts / skills / responses exist in run artefacts,
   pull at least 3 concrete examples and decide which diversity axis you
   want to show.
6. **Seed vs agent-discovered check.** If the example is a skill / prompt /
   hypothesis that could have come from a hard-coded seed library or
   prompt scaffold, verify its origin before calling it "what the agent
   did". A slide that says "look at this skill the agent found" but shows
   a seed is a factual error. Grep the seed files (e.g., `seed_library.py`,
   `initial_goals.json`) and exclude any example found there.

Write the findings to `slides_source_notes.md` alongside the eventual
`.tex`. Every slide you later draft must cite back to a source note entry.

---

## Phase 1 — insight-first prose outline (content gate)

Produce a Markdown outline where each slide is a heading with ≤ 80 words
of prose describing the one idea, the supporting artefact, and the
takeaway sentence. **Do not start LaTeX until this outline passes the
self-critic gate below.**

### Mandatory structural skeleton

The outline must start with a **두괄식 TL;DR slide** (slide 2, right
after title) shaped as three pillars:

- `[added since <baseline>]` — what mechanisms are new
- `[worked]` — what measurable effect they had
- `[missing]` — what is still failing, honestly

Paper-digest style: the three pillars chain together as a **one-sentence
narrative** ("before X → added Y → got Z → still missing W"). The
baseline can be a commit hash ("since Friday's commit 1bcf2b5"), a
previous release, or a described prior state.

Body slides should be sequenced:

1. Title
2. **TL;DR** (the three-pillar slide)
3. Structural overview (per-turn loop / phases / architecture)
4. Module or component maps
5. Per-module deep-dive slides, each with one real I-O example
6. "What worked" — headline structural numbers
7. "What is missing" — the honest gap
8. Minimal fixes (not new architecture)
9. Appendix slides — real traces, time series, lifecycle tables

### Per-slide outline template

```markdown
### Slide N — <title>
*One concept:* <one sentence>
*Artefact:* <flowchart | verbatim code | table | example box>
*Source:* <file:line or run JSON path (private — do not print on slide)>
*Takeaway sentence:* <one sentence the speaker will say>
```

### Phase-1 self-critic gate

Loop the following checks until all pass:

1. **One concept per slide.** If a slide's *one concept* line reads like
   two ideas joined by "and", split or drop the second idea.
2. **Source grounded.** Every slide must name a real file, line, run
   namespace, or JSON path in the scratch note. "In the world model" is
   not a source.
3. **Takeaway readable alone.** If the speaker's takeaway needs the
   artefact to make sense, rewrite the sentence to stand alone.
4. **두괄식 TL;DR present.** Slide 2 is the three-pillar
   added/worked/missing slide. No "overview" / "agenda" filler slides
   before it.
5. **No filler slides.** No "what this talk contributes" / "conclusion"
   / "acknowledgements" slides unless the user explicitly asked — they
   usually belong in the talk, not the slides.
6. **No fake taxonomies.** No five-kind / taxonomy slides if the
   implementation does not meaningfully split on them. Show flat lists
   of real examples instead.
7. **Real examples over illustrations.** If the talk is about a system
   that has produced actual artefacts (skills, prompts, run responses),
   the slide must show a real one — not a made-up one.
8. **Abstract on the slide, concrete in the companion.** The slide body
   itself should describe principles, not file paths / line numbers /
   rev labels / plan codes. These belong in the companion talking-points
   markdown. Exception: a short \texttt{path/file.py} citation on a
   side-note for a trace slide is acceptable.
9. **Seeds excluded from "agent did X" slides.** Any example framed as
   "what the agent discovered" must not be a hard-coded seed. Verify via
   grep of seed files before inclusion.

Only when all nine checks pass, proceed to Phase 2.

---

## Phase 2 — translate to Beamer, with a render-verify loop

### Per-slide generation rules

- Use Metropolis theme: `\usetheme{metropolis}`. Aspect ratio 16:9.
- Load `booktabs`, `fancyvrb`, `tikz`, and the TikZ libraries
  `positioning, arrows.meta, shapes, shapes.geometric, calc, fit,
  backgrounds`.
- A slide is at most one of:
  - a TikZ flowchart
  - a `\begin{Verbatim}` block with the real code / prompt / skill
  - a `booktabs` table with ≤ 6 rows
  - a single labelled I-O box with input on top, output below
- Minimum font in code blocks: `\scriptsize`. Drop to `\tiny` only if
  the code exceeds 16 lines.
- Slide captions ≤ 2 short sentences. Delete adverbs and hedges. If a
  caption runs > 2 sentences, either move content to the companion
  markdown or split the slide.
- Titles use sentence case, no emoji.
- Every TikZ diagram is wrapped in
  `\resizebox{0.98\textwidth}{!}{ ... }` or
  `\resizebox{!}{0.8\textheight}{ ... }`.
- Arrows use `\tikzset{arr/.style={-{Latex[length=1.6mm]}, thick}}`.
- Cross-module / long-range TikZ links route **below** (or above) the
  boxes through explicit coordinate via-points. Never bend through the
  centre of a labelled box.
- When two boxes may end up horizontally overlapping (common when you
  place two memory / mem-L / mem-R boxes under a module row), prefer a
  **single wide bar** spanning the full width instead.

### Render-verify loop

After every compile:

1. Run `pdflatex -interaction=nonstopmode` twice. Record the return code.
2. Grep the log for `Overfull .* too wide`, `Overfull .* too high`,
   `LaTeX Error`, `Undefined control sequence`.
3. Render each page to PNG (via `pdftoppm -r 110`) and visually inspect:
   a. no text is clipped at the slide edge
   b. arrows terminate on box borders, not through other boxes
   c. arrows do not land in empty space next to a box
   d. table columns do not run off the page
   e. verbatim blocks are not cut off at bottom
4. For every issue found, record `slide N : <issue>` in a scratch list.
5. Apply the smallest fix that removes the issue:
   - horizontal clipping → wrap TikZ in `\resizebox{0.98\textwidth}{!}`
   - vertical overflow → shrink fontsize one step or split the slide
   - arrow crossing a box → route via explicit coordinate below the row
   - arrow hitting empty space → attach to `(node.south) -- (node.south
     |- target.north)` patterns
   - two mem boxes overlapping → collapse into one wide bar
   - title with underscores rendering wrong → `\texttt{\_underscored\_}`
6. Recompile and loop until all five visual checks pass on every page.

Exit the loop only when:

- every `pdflatex` pass exits with `RC = 0`
- no `LaTeX Error` or `Undefined control sequence` in the log
- overflow warnings are either absent or explicitly within the title page
  frame (Metropolis reports a known cosmetic ~15 pt vbox)
- visual inspection of every page found no clipped / overlapping / badly
  aligned content

---

## Phase 3 — fact-drift audit (re-ground against live code)

After Phase 2 closes, the deck is visually correct but may contain
stale claims. Research code moves fast; a claim that was true when the
outline was drafted may be false an hour later. Run this phase **before**
pushing.

Audit each slide against the current code:

1. For every slide that names a mechanism ("X is blocked by whitelist"),
   grep the current source. If the mechanism has been relaxed / renamed /
   moved, update the slide.
2. For every slide that says "the agent does not X" or "feature X is
   missing", grep for `X` in the codebase. If the feature is actually
   wired end-to-end but silently under-used at runtime, rewrite the
   slide as **"infrastructure exists but unused"**, not "missing".
3. For every numeric claim, re-read the JSON source (planner_state.json,
   world_model.json, etc.) and confirm the number has not shifted. If a
   newer run has a different number, prefer the newer one and name the
   run namespace in the companion markdown.
4. When an external critic (another agent, a reviewer) challenges a
   claim, do not simply accept or reject. Open the cited file, confirm
   or refute with actual lines, and amend the slide accordingly. Always
   write the amended framing so it survives the next drift too.

### Companion markdown (talking points)

Produce alongside the `.tex` a `<deck>_talking_points.md` that:

- Opens with a 3-line TL;DR matching slide 2's three pillars
- Has top-level sections for: Before state, Additions, Measured effects,
  Honest remaining gap, Minimal fixes
- Includes a **"Slide ↔ section roadmap" table** near the end: one row
  per slide with (slide number, one-line message, which section carries
  the deep version)
- Adds a **time budget** block: e.g., "For a 20-minute talk, spend 2 min
  on TL;DR, 5 min on structure, 8 min on module examples, 3 min on
  results-and-gap, 2 min on fixes; appendix only in Q&A"
- Gives per-slide speaker script with "what to show / what to say / how
  it is implemented" for each slide
- Lists 2–4 expected questions with draft answers

The companion markdown is the place for file paths, line numbers, rev
labels, and long prose. The slides stay abstract; the markdown is concrete.
Convert the markdown to a PDF via `scripts/md2pdf.py` (weasyprint + Korean
CJK fonts baked in).

---

## Phase 4 — push (only when the user asks)

When the user asks, push to:

- git (if a repo is available locally or via `gh`): commit with a
  descriptive message that cites which slides changed and why, then
  `git push`.
- Hugging Face datasets (if `hf auth whoami` succeeds): upload the
  `.tex`, `.pdf`, and companion `.md` and `.pdf`.

Always return both URLs to the user.

---

## Paper-digest-style principle

Borrowing from the `paper-digest` skill: every slide and every sentence
should answer "**why does this matter?**" before "what does it do?".
Pair every module with the motivation that explains its existence.
Chain cause-and-effect explicitly: "we added X **because** Y; the
consequence was Z". The slides carry the chain compressed; the
companion markdown carries it in full.

Abstract principles over file:line: on the slide say
"Trust gate: simulator must earn accuracy before driving real actions",
not "Trust gate: `planner.py:220-231` checks `transition_accuracy >=
gate_threshold`". Move the latter into the companion.

---

## Supporting files

- `references/style_guide.md` — concrete examples of the "one concept,
  one artefact" rule with good vs bad slide pairs.
- `references/tikz_recipes.md` — proven TikZ patterns for decision
  flowcharts, module maps with via-points, and commit loops.
- `references/critic_checklist.md` — the Phase-1 and Phase-3 critic
  gates as a one-page checklist.
- `scripts/render_and_check.sh` — the compile + overfull-grep + page
  count helper used in the render-verify loop.
- `scripts/md2pdf.py` — companion markdown → PDF converter (weasyprint,
  Noto Sans CJK KR + Noto Sans Mono CJK KR, palette matching the deck).
