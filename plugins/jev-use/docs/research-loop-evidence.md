# Research-loop evidence

What was measured when the `jev-research-loop` skill (then the standalone
implementation audit, now Step 8) was validated on a live RL research repo. All numbers are `noul` answers from batched `jev-use judge` calls;
the state was an intent document plus module source.

## Planted-defect and perturbation deltas

| Perturbation | Question | Before → after | Δ | Verdict |
| --- | --- | --- | --- | --- |
| ±1 cap planted into an "uncapped" credit function, **with** per-property `criteria` | property `uncapped` | .65 → .33 | −.32 | **detected** |
| the same ±1 cap, **without** `criteria` | property (uncapped) | .61 → .58 | −.03 | **missed** |
| sign flip in the credit term | `bug` | .41 → .47 | +.06 | **weak** |
| buggy "credit summed into the sequence score and broadcast" advantage patch replaced by a post-centering token-localized one | `bug` | .63 → .50 | −.13 | **detected** |
| factually wrong intent statement, code unchanged | alignment / `quality` | .65 → .52 | −.13 | **detected — on the document, not the code** |
| reproduction run: `max(-1, min(1, …))` planted into `pmi_shift` | property `uncapped` | .87 → .24 | −.63 | **detected** |
| same run | `bug` | .37 → .64 | +.27 | **detected** |

Latency ≈ 700 ms per batched call (11 questions in one call); every `noul` verdict
returned `escalate: "unsure"` — estimated confidence < .4.

## Design consequences

1. **Criteria matter more than wording.** The identical defect is detected at
   −.32 with `criteria.true/false` and missed at −.03 without them. Never emit a
   property question without both criteria.
2. **Read Δ, not levels.** Absolute values sit in a narrow band (.2–.9) that
   does not separate healthy from broken code. Compare variants of the same file.
   Thresholds in use: property < .5, `bug` ≥ .55, any Δ ≥ .10; Δ < .05 is noise.
3. **`unsure` ⇒ prior.** Because every verdict escalates, no verdict can close a
   question. Verdicts order the reading list; that is their whole job.
4. **Direct read is mandatory.** The one real bug in the audited repo was found
   only by reading the framework's `compute_grpo_outcome_advantage` — a file that
   was never in any state Jev saw. Jev cannot flag code it was not shown.
5. **A wrong intent produces a confident wrong audit.** The .65 → .52 drop on
   *unchanged* code is the failure mode to avoid: correct the intent document
   against the project's own records in Step 0, before any property is written.

## Today's four findings, classified on both axes

| finding | cause | confidence | how it got there |
| --- | --- | --- | --- |
| credit summed into the sequence score and broadcast across all tokens | `impl_error/wrong_wiring` | 확정 | started as `unclassified` (jev `bug` .63, `escalate: unsure`); `next_test` = read verl's `compute_grpo_outcome_advantage` in the framework source — that read confirmed it |
| `r1_acc` gate reading the final-turn accuracy instead of the first-turn one | `measurement_error` | 확정 | jev scored the formula as written and saw nothing wrong; found by hand-recomputing what the gate was supposed to mean |
| `bitsandbytes` missing in the training env | `runtime_error` | 확정 | not a Jev target — rc signature in the job log |
| intent doc claiming self-written reset notes were the positive result | `intent_error` | 확정 | Step 0 cross-check against the results ledger, which records +.006/−.010 FAIL |

`measurement_error` is the class Jev is structurally worst at: it judges the
formula in front of it and cannot know which quantity the gate was meant to
compute. Budget an LLM hand-recomputation for every gate.

## First real run of the full loop, 2026-09-21

Running all ten steps on a live experiment for the first time produced **1 implementation
finding** from Jev (a stop rule declared in the design but never wired — `unimplemented`),
**1 intent finding the human found, not Jev** (an approved 200-problem pilot scale was
absent from the intent doc while the code used 388; once the number was written into the
intent and a `pilot_scale` property added, the job-state judgment came back **.04** and
caught it), and **4 `runtime_error`s found by reading logs** (a missing config key, an FP8
warmup step, a reward loop that never yielded, a monkeypatch against a moved symbol) —
**none of the four visible to Jev**, which never sees a log. Two Jev verdicts were **false
priors**: `unneeded` **.89** on a function that was in fact called, and `fix_correct`
**.12** when the `plan` subcommand was fed a description of the gap instead of a plan for
closing it. The lessons are wired into the skill as the Step 0 approval ledger, the
`runconfig` state (Step 8h), and the «Order of operations» rule that the smoke run precedes
the audit.

## Failure modes of the harness itself, 2026-09-21

- **A 503 outage produced four `None` tables and four bogus history rows.** Verdicts came back
  `{"answer": null, "reason": "unreachable"}`; the table printed `None` and `--record` appended
  normal-looking rows, so the ledger claimed four judgments that never happened. The script now
  prints `UNREACHABLE: <hint>`, exits **4** after saving the JSON, and records **nothing**.
- **`runconfig` with 26 code-scope properties produced 15 escalations** that buried the two
  answers that mattered (`run_scale` **.82**, `control_bit_identical` **.94**). Properties now
  carry a `"scope"` (`code` default / `run` / `design`); `runconfig` asks run-scope only and
  drops the fixed `gold_leak` / `unneeded` / `bug` / `quality` questions, which are about code.
- **`min_property` mixed types**: a 1–5 `score` and the high = bad ids sat in the same minimum.
  The history row now keeps `min_property` (high = good `noul` only), `scores` and `choice` apart.
- **`--judge agent`** replaces the print-only fable mode: the request is written to
  `<tag>.request.json`, the agent's `<tag>.verdicts.json` is validated (type range + a `reason`
  citing `file:line`) and then tabulated, saved and recorded exactly as Jev's.

## Blind classes (extend per repo)

- **sign flips** — Δ +.06, below the noise floor. Treat sign correctness as a
  human gate, or catch it with a unit test on the truth table instead.
- **anything in uncalled framework code** — structurally invisible.
- **runtime behavior** — curves, densities, reproduction gates, tensor shapes.
- **falsified-claim swaps far from the code under audit** — replacing one result
  claim in the intent doc with its opposite moved every `mc/credit.py` verdict by
  ≤ .05 (noise). `intent-delta` only fires when the swapped claim touches a
  property the audited file actually implements.
