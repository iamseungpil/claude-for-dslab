---
name: jev-research-audit
description: Use when auditing research code against a written intent — checking whether an experiment's training code, reward, credit assignment or data pipeline actually does what the project's intent document claims, hunting a silent learning-signal bug, gold leakage into a trained path, a closed axis being re-bought, or code the intent does not need, and calibrating how much of that a judgment model can even see. Triggers on "audit this against the intent", "does the code match what we said we were doing", "check for gold leak", "find the silent reward bug", "intent conformance review", "jev로 코드 점검", "의도 부합 점검", "코드가 의도대로인지 확인", "보상 신호 버그 찾아줘". Not for writing the fix, not for judging whether the research idea is good — those stay with the LLM.
---

# Auditing research code against an intent

Jev answers typed questions about one state in ~700 ms per batched call. It makes
**priors that order your reading list**; it closes nothing. Every real finding in
validation came from an LLM read of the file Jev pointed at
(`docs/research-audit-evidence.md`). Every finding carries **two axes**:
`confidence` (확정 / 미확인 / 잡음) and `cause`. Never report one without the other.

## The cause axis

| cause | what it means | who decides it |
| --- | --- | --- |
| `intent_error` | the intent document disagrees with the project's ledger/results | Step 0 LLM cross-check, plus `intent-delta` (same code, two intent docs — a big Δ means the document, not the code, moved the verdict) |
| `design_error` | faithful to the intent but cannot work, including re-buying a closed axis | `plan` verdicts + `--closed-axes PATH` folded into every state |
| `impl_error` | code ≠ design. Subtypes: `wrong_wiring` / `sign` / `index`; `unimplemented` (stub, `NotImplementedError`, silent zero); `unneeded_or_duplicate`; `budget_violation` (line count) | module questions → `functions` narrowing → **direct read** |
| `measurement_error` | code is right, the metric or gate measures something else (a sagging rule that watches final accuracy; a budget artifact) | LLM hand-recomputation against a "metric definition" property. **Jev is weakest here** — it reads the formula as written and cannot know what the number was supposed to mean |
| `runtime_error` | environment/execution (missing package, worker storm) | not a Jev target at all — logs and rc signatures |
| `unclassified` | Jev `unsure` and the direct read did not settle it | you, and **`next_test` must not be empty** — name the concrete experiment that would split it (dump the step-1 advantage tensor; read function F in the framework source) |

**Where each cause sends you back** (the loop step to re-enter): `intent_error` → intent doc with the user; `design_error` → brainstorming / design judge; `impl_error` → implementation (subagent) + re-audit; `measurement_error` → the gate/metric definition, not the code; `runtime_error` → launcher/queue; `unclassified` → run `next_test` first, then classify.

## Step 0 — INTENT (LLM)

Require a **corrected intent document** as a path. If the user pasted prose, first
check it against the project's ledger/results and write or update the doc from
what the records actually say. Never feed a statement with known factual errors: a
wrong intent sentence dropped the alignment verdict **.65 → .52 on unchanged
code**. A wrong document yields a confident wrong audit — that is `intent_error`.

## Step 1 — PROPERTIES (LLM writes)

Derive `properties.json` from the intent: one `noul` question per **verifiable**
property, each with explicit `criteria.true` / `criteria.false`. Criteria are not
decoration — the same planted defect moved a verdict .61 → .58 without them
(missed) and .65 → .33 with them (detected).

```json
[{"id": "uncapped",
  "question": "Is the credit magnitude passed through uncapped — no clamp or clip that collapses it to a sign-only binary?",
  "criteria": {"true": "the continuous magnitude survives into the reward",
               "false": "a cap truncates it"}}]
```

Properties that worked: uncapped credit · bidirectional credit (no anchor that
drops one direction) · post-centered token-localized credit (not summed into a
sequence score and broadcast) · no injected meta content in trained arms · no gold
in the trigger or the selection rule · single source of truth for a parser/grader ·
undefined terms excluded rather than zero-filled. Add at least one **metric
definition** property (does this gate compute the quantity the intent names?) —
the only handle on `measurement_error`. Phrase properties so **high = good**; the
script adds three fixed `noul` questions where **high = bad** (`gold_leak`,
`unneeded`, `bug`) plus `quality`, a 5-level `score`. A property must be verifiable
*from the code*; "is this good research?" is `open_ended` and stays with you.

## Step 2 — JUDGE (script → Jev)

```bash
set -a; source /path/to/.env; set +a
export TYPESAFE_API_KEY="$JEV_API_KEY"      # key from env only; never written or logged
python3 scripts/research_audit.py --intent docs/INTENT.md --properties properties.json \
  --out ./.jev-audit/ --closed-axes docs/closed_axes.txt \
  modules --files mc/credit.py mc/train_hook.py
```

All questions for one module go in **ONE** `jev-use judge` call. State = intent
(+ closed axes) + module source, passed by reference on stdin — nothing enters the
conversation. One JSON per module under `--out`, plus a table on stdout.

## Step 3 — READ THE TABLE (LLM)

Absolute levels are weak. Act only on: a **property answer < .5**, **bug ≥ .55**,
or any **Δ ≥ .10** between two variants of the same code. **Δ < .05 is noise.**
Every `noul` verdict in validation returned `escalate: unsure` (estimated
confidence < .4) — the normal case, not a failure. Such verdicts are priors: they
order the reading list and never close a question.

## Step 4 — NARROW (script → Jev)

```bash
python3 scripts/research_audit.py --intent docs/INTENT.md --out ./.jev-audit/ \
  functions --file mc/train_hook.py
```

Re-asks `bug` / `unneeded` per top-level function (state = module preamble + that function).

## Step 5 — DIRECT READ (LLM, mandatory)

Open the flagged function(s) **and the framework code they call**. In validation
the only real bug was found by reading verl's
`compute_grpo_outcome_advantage` — Jev never saw that file and could not have.
Classify each finding on both axes with `file:line`. Jev never closes a finding.

## Step 6 — PLAN JUDGE (optional, before fixing)

```bash
python3 scripts/research_audit.py --intent docs/INTENT.md \
  plan --code-file mc/credit.py --plan-text "remove clamp; center after scatter"
```

Asks `fix_correct` / `fix_incomplete` / `fix_harm`. Ordering only; with
`--closed-axes` it is also the `design_error` probe. It does not approve a patch.

## Step 7 — CALIBRATE (recommended once per repo)

```bash
python3 scripts/research_audit.py --intent docs/INTENT.md --properties properties.json \
  plant --file mc/credit.py --patch 'OLD_LINE=>NEW_LINE_WITH_DEFECT'
```

Judges the original against each planted-defect copy and prints Δ per question;
each `OLD` must occur exactly once. Record which defect classes come back **blind**
(Δ < .10) in `docs/research-audit-evidence.md` — a blind class is a human gate in
this repo, permanently.

## Output contract

The script prints raw Jev values only. **You** write the findings table:

| id | file:line | cause | confidence | evidence | next_test |
| --- | --- | --- | --- | --- | --- |
| F1 | `mc/train_hook.py:363` | `impl_error/wrong_wiring` | 확정 | jev bug .56 → function .56; direct read of verl `compute_grpo_outcome_advantage` | — |
| F2 | `mc/credit.py:44` | `unclassified` | 미확인 | jev `uncapped` .86, unsure | dump the step-1 advantage tensor and check the span |

`next_test` is **mandatory** for every 미확인 and `unclassified` row. Group the
table under 확정 / 미확인 / 잡음, and close with one narrowing sentence, e.g.
"jev 결과를 보니 `no_gold_trigger`만 .22로 떨어졌고 나머지 속성은 전부 .8 위였다,
이제 gold 가 트리거에 닿는 자리를 함수 단위로 좁힌다."

## What Jev cannot see

Runtime numbers, training curves, reproduction gates, tensor shapes, anything not
in the state, and any framework code you only call. Those stay human gates — no
audit result substitutes for running the gate. Cost/latency ≈ 700 ms per batched
call at judgment-model rates; a 2-module audit with 11 questions is two calls. The
key is read from the environment only; the script never prints, logs or writes it,
never echoes the state, and exits non-zero on node < 20 or a missing key with a
one-line fix hint.
