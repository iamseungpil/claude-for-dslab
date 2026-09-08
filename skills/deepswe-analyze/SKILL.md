---
name: deepswe-analyze
description: Turn a finished harbor run (DeepSWE, SWE-bench Pro, any scaffold) into the weekly failure-reasoning analysis — Sonnet verdicts on every failed trial, prior-work taxonomy labels, success verdicts, win/loss contrast pairs, an Opus agreement check, and the weekly viewer build. Use when a week's job folders are complete and the user wants "이번 주차 분석" or the site updated.
---

# deepswe-analyze

One command that reproduces the 2026-09-08 DeepSWE analysis on a new week's results.
Everything numeric is recomputed from the trials; nothing is copied from a previous week.

## Inputs

- `repo` — the analysis checkout, default `/w/seungpil.lee/deepswe` (harbor 0.22, `.venv`, `deepswe/` package, `refresh.sh`).
- `week` — meeting id `YYYY-MM-DD`. Data goes to `site/weeks/<week>/`, prose to `docs/weeks/<week>/`.
- `jobs` — harbor job dirs for this week (`jobs/<name>/<task>__<trial>/`). Trials from other scaffolds or
  benchmarks are fine as long as `collect.py` has an adapter for them (see "Adapters").
- Optional: `--sample-wins N` (judge only N passing trials per model; default all), `--crosscheck N` (default 30).

## Procedure — run every step, in order, and do not stop early

1. **Briefs** — `scripts/pipeline.sh <repo> <week> briefs <jobs...>`
   Writes `jobs/analysis-briefs/<id>.md` for failed trials (task statement, reference patch, model patch,
   failing tests, the FULL transcript with `[call N]` markers) and `jobs/analysis-wins/<id>.md` for passing ones.
   `jobs/analysis-briefs/pending.json` lists ids that still need a verdict.
2. **Failure verdicts** — launch the Workflow in `references/workflows/1-failure-judge.js` with `args` = pending ids.
   One Sonnet agent per trial, `effort: high`. The agent must read the whole brief in chunks and write
   `jobs/analysis/<id>.json` with the 13-key schema in that script. Prefix every prompt with
   "Do this work YOURSELF. Do not spawn sub-agents." — without it Sonnet delegates and writes nothing.
3. **Validate** — `scripts/pipeline.sh <repo> <week> validate`. Removes verdicts that fail the schema or the
   self-consistency rules in `deepswe/analyze.py` (`inconsistency()`); re-run step 2 for the removed ids.
4. **Taxonomy relabel** — Workflow `references/workflows/2-taxonomy-relabel.js`. Adds the `taxonomy` block
   (root cause / phase / post-failure behaviour, definitions in `references/taxonomy.md`, provenance
   arXiv 2607.09510 and 2509.13941). Labels come from the verdict evidence; keep `confidence`.
5. **Success verdicts + contrast pairs** — Workflow `references/workflows/3-winners-contrast.js`.
   Success judges MUST carry the calibration line "passing does NOT prove the requirements were met"
   (without it every trial came back 100% covered). Contrast pairs: same model, same repo or task,
   one pass one fail, judged by Opus with `decisive_factor` in {approach_differed, verification_differed,
   task_was_harder, luck}.
6. **Agreement check** — Opus re-judges `--crosscheck` trials independently on the three taxonomy axes;
   compute Cohen's kappa per axis. Report all three. If root-cause kappa < 0.6, stop and tell the user
   before publishing; do not silently proceed.
7. **Collect + deploy** — `scripts/pipeline.sh <repo> <week> collect <jobs...>` then `... deploy <jobs...>`.
   `collect --week` writes `site/weeks/<week>/{trials,meta}.json`, `traj/`, and the headline entry in
   `site/weeks.json` (the meetings home reads only that file).
8. **Weekly table** — write `docs/weeks/<week>/summary.md` (three sentences, insight first) and
   `notes.md` with: pass-rate table vs leaderboard, root-cause / phase distribution with the change
   from the previous week, contrast decisive-factor split, kappa row, incidents, decisions needed.
   Numbers only from `site/weeks/<week>/trials.json`. Then `bash refresh.sh <week>` once more so the
   home card picks up the summary.

## Adapters (extend before running a new scaffold or benchmark)

`deepswe/collect.py` assumes mini-swe-agent trajectories (`messages` with one shell command per turn)
and DeepSWE task metadata (`task.toml` → language, category, gold patch under `solution/`).
For a new scaffold add a `turns_from_*` reader that yields the same `(turn, think, calls[phase,cmd,out])`
shape and tag each trial with `scaffold`; for a new benchmark add a `task_meta` reader and tag `benchmark`.
The viewer filters and the findings cards work off those fields unchanged.

## Guard rails learned the hard way

- Never run `collect` with a subset of job dirs into an existing week folder: it overwrites `trials.json`.
- Judges see the outcome; failure-side and success-side prompts both need the calibration warning.
- `post_failure_behaviour` had kappa 0.29 when labelled from extracted evidence instead of the raw
  transcript; treat it as reference-only unless relabelled from the full transcript.
- Duplicate (task, model) trials (smoke + full) must be marked `superseded`, or per-model counts drift.
- Do not `grep` `site/index.html`; some tools treat it as binary and return nothing. Use Python.

## Output the skill returns to the caller

A markdown block: per-model pass rate, root-cause family split, phase split, contrast split, kappa per
axis, count of trials judged / removed / re-judged, site URL for `?week=<week>`, and the open decisions.
