# Critic Checklist

One-page gates for Phase 1 (content) and Phase 3 (fact-drift).

## Phase 1 — content gate (run before any LaTeX)

- [ ] 1. One concept per slide. No "and" joining two ideas.
- [ ] 2. Every slide has a real file / line / JSON path in the scratch note.
- [ ] 3. Takeaway sentence stands alone without the artefact.
- [ ] 4. Slide 2 is the 두괄식 TL;DR with `[added] / [worked] / [missing]`.
- [ ] 5. No filler slides (contributions, conclusion, acknowledgements) unless asked.
- [ ] 6. No taxonomies unless the code meaningfully splits on them.
- [ ] 7. Examples are real, not illustrative.
- [ ] 8. Slide body is abstract; file paths / line numbers / rev labels live in the companion.
- [ ] 9. Any "agent did X" example has been grep-confirmed NOT to be a seed.

## Phase 3 — fact-drift audit (run before push)

- [ ] A. Every mechanism claim re-grepped: still true in current code?
- [ ] B. "Feature missing" claims rewritten as "wired but unused" if infrastructure exists.
- [ ] C. Every numeric claim re-read from the JSON source; newer run = newer number.
- [ ] D. External critic feedback: file-confirmed, not reflexively accepted or rejected.
- [ ] E. Seed-vs-discovered distinction preserved in every skill/example slide.

## Visual checks (Phase 2, per-page)

- [ ] V1. No text clipped at slide edge.
- [ ] V2. Arrows terminate on box borders, not through other boxes.
- [ ] V3. No arrow lands in empty space adjacent to a box.
- [ ] V4. Table columns do not run off page.
- [ ] V5. Verbatim blocks are not cut off at bottom.

## Exit criteria

- All 9 content gates pass
- All 5 fact-drift gates pass
- All 5 visual checks pass on every page
- `pdflatex` RC = 0; no `LaTeX Error` / `Undefined control sequence`
- Only cosmetic overfull (e.g., Metropolis ~15pt title-page vbox) remains
