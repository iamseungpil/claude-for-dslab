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

## Blind classes (extend per repo)

- **sign flips** — Δ +.06, below the noise floor. Treat sign correctness as a
  human gate, or catch it with a unit test on the truth table instead.
- **anything in uncalled framework code** — structurally invisible.
- **runtime behavior** — curves, densities, reproduction gates, tensor shapes.
- **falsified-claim swaps far from the code under audit** — replacing one result
  claim in the intent doc with its opposite moved every `mc/credit.py` verdict by
  ≤ .05 (noise). `intent-delta` only fires when the swapped claim touches a
  property the audited file actually implements.
