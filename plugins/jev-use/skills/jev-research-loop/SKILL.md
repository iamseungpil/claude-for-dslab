---
name: jev-research-loop
description: Use to run the full research loop — analyze, survey, design, judge the design, plan, judge the plan, implement, audit the implementation, launch, judge the results — or to audit research code against a written intent: checking whether an experiment's training code, reward, credit assignment or data pipeline actually does what the project's intent document claims, hunting a silent learning-signal bug, gold leakage into a trained path, a closed axis being re-bought, or code the intent does not need, and calibrating how much of that a judgment model can even see. Triggers on "research loop", "run the loop", "루프 돌려", "설계부터 실험까지", "10단계", "audit this against the intent", "does the code match what we said we were doing", "check for gold leak", "find the silent reward bug", "intent conformance review", "jev로 코드 점검", "의도 부합 점검", "코드가 의도대로인지 확인", "보상 신호 버그 찾아줘". The loop can be entered at any step with `--step N` (e.g. `--step 8` = the implementation audit alone). Not for writing the fix by hand, not for judging whether the research idea is good — those stay with the LLM and the human.
---

# The research loop, with Jev as the prior-maker

**Jev judges states and names the step to re-enter; it closes nothing.** Subagents do
the analysis, the survey, the planning and the implementation. The main agent does the
design, the direct reads, the table reading and the queue submission. Jev answers typed
questions about one state in ~700 ms per batched call and every verdict is a prior that
orders your reading list. Loop state lives in `<repo>/.jev-loop/STATE.json`
(`{step, round, last_verdict, history[]}`) so the loop resumes after a context loss — you
write the `step`/`round` transitions by hand, and `research_audit.py --record` appends the
judgment rows to `history[]` (see Step 8h). **Max 3 rounds per inner loop** (1c↔3, 4↔6, 7↔9), then stop
and ask the human. Every finding carries **two axes**: `confidence` (확정 / 미확인 /
잡음) and `cause`. Never report one without the other.

## Choosing the judge

Every judging step runs under one of two backends, selected by `--judge`.
- **`judge: jev`** (default) — the fast prior-maker: **large batches** (many modules, `plant`
  sweeps, `functions` narrowing), **many items**, and whenever **the state is a file** you
  would rather not pull into the conversation.
- **`judge: agent`** — the **main agent answers the same typed questions itself**, from a file,
  with no backend call. The subcommand writes `<out>/<tag>.request.json`
  (`{"state", "questions"}`) and looks for `<out>/<tag>.verdicts.json` in the engine's own
  schema (`{"verdicts": [{"id","type","answer","confidence","reason"}], "backend": "agent"}`).
  Missing verdicts → `AWAITING AGENT VERDICTS: ...` and **exit 5**; an answer of the wrong type
  or a `reason` without a `file:line` / document citation → **exit 6**. Use it when **jev is
  unavailable** (no key, no node ≥ 20), when **the user asks for it**, or when **every jev
  verdict escalates**, so the priors carry no information. See «Running the loop with the agent
  as judge».
- **Unreachable backend.** If the backend answers but judged nothing (`"answer": null,
  `"reason": "unreachable"`, e.g. an HTTP 503), the script prints `UNREACHABLE: <hint>` under
  the table, saves the verdict JSON, **exits 4**, and `--record` **appends nothing** to
  `STATE.json.history`. A `None` table is never a judgment.

## The cause axis

| cause | what it means | who decides it |
| --- | --- | --- |
| `intent_error` | the intent document disagrees with the project's ledger/results | Step 0 LLM cross-check, plus `intent-delta` (same code, two intent docs — a big Δ means the document, not the code, moved the verdict) |
| `design_error` | faithful to the intent but cannot work, including re-buying a closed axis | `design` / `plan` verdicts + `--closed-axes PATH` folded into every state |
| `impl_error` | code ≠ design. Subtypes: `wrong_wiring` / `sign` / `index`; `unimplemented` (stub, `NotImplementedError`, silent zero); `unneeded_or_duplicate`; `budget_violation` (line count) | module questions → `functions` narrowing → **direct read** |
| `measurement_error` | code is right, the metric or gate measures something else (a sagging rule that watches final accuracy; a budget artifact) | LLM hand-recomputation against a "metric definition" property. **Jev is weakest here** — it reads the formula as written and cannot know what the number was supposed to mean |
| `runtime_error` | environment/execution (missing package, worker storm) | not a Jev target at all — logs and rc signatures |
| `unclassified` | Jev `unsure` and the direct read did not settle it | you, and **`next_test` must not be empty** — name the concrete experiment that would split it (dump the step-1 advantage tensor; read function F in the framework source) |

If results pass the design's own gates but no longer measure the intent's Pipeline contract
metric, the cause is `intent_error`, not `design_error` or `measurement_error` — the loop
returns to **Step 0**, not Step 1c: the gates were faithfully re-implemented against a
contract that had already drifted.

**Where each cause sends you back:** `intent_error` → **Step 0**, with the human;
`design_error` → **Step 1c** (rewrite the design doc); `impl_error` → **Step 7**
(implementation subagent) then re-audit; `measurement_error` → the **gate definition in
the Step 1c design doc**, not the code; `runtime_error` → **Step 10** launcher/queue;
`unclassified` → run `next_test` first, then classify.

## Order of operations

Auditing code that has never run wastes the audit on defects a single smoke run names for
free.

- **(a) Smoke before audit.** After Step 7, run the **smallest real execution** first — one
  step, smallest pool, shortest budget. Fix every `runtime_error` directly by reading the
  **rc and log signatures** (missing config key, unsupported warmup, a loop that never
  yields a reward, a monkeypatch against a moved symbol). These are **not Jev's**: it never
  sees a log, and routing them to it costs a call and returns a prior about nothing.
- **(b) Audit once a metric exists.** Step 8 runs **in full only after the run reaches its
  first real metric line**. Before that, an "unimplemented" verdict cannot be told apart
  from a path execution has not entered yet.
- **(c) Twice in the same layer ⇒ ask Jev.** A runtime failure that **repeats in the same
  layer twice** is the only case where a failure goes to Jev: send a **failure signature**
  (rc, last exception line, failing frame file — never the log) as a `choice` over the cause
  axis, to re-classify. Two failures in one layer usually mean the layer is wrong, not the
  environment: `design_error` or `impl_error` wearing a `runtime_error` mask.

## Step 0 — INTENT (main agent)

Require a **corrected intent document** as a path. If the user pasted prose, first check
it against the project's ledger/results and write or update the doc from what the records
actually say. Never feed a statement with known factual errors: a wrong intent sentence
dropped the alignment verdict **.65 → .52 on unchanged code**. A wrong document yields a
confident wrong audit — that is `intent_error`.

**Pipeline contract.** Whenever the owner has agreed a step-by-step pipeline in conversation,
the intent doc MUST contain a section titled **"Pipeline contract" / "파이프라인 계약"**,
copied **VERBATIM** from the owner's message, with the date. The main agent may not edit the
intent doc's goals or contract except by quoting the owner's own sentence that changes it --
put the quote and the date next to the change. A rewrite without a quote is how a design
judge that only checks against `docs/INTENT.md` went on approving a drifted pipeline: the
main agent had rewritten the reference itself.

**Approval ledger (before judging anything).** List **every number and scale the human
approved in conversation** — pool size, K, steps, seeds, level filter, budget — and check
that each appears **verbatim in the intent doc**. A missing one is an `intent_error` owned
by **the agent, not Jev**: *Jev cannot see a number that is in no document.* In the
**Reader questions + site config (once at the start, again when the intent doc changes).**
Ask the human the five fixed reader questions and write the answers beside the intent doc:
**what are we trying to learn** · **what is established, one number each** · **what was
retracted** · **what do we build or change** · **what is unknown, and what is next**.
Questions that arrive later are appended to that file as `proposed` and **never block the
loop**. Write `site.config.json` next to it in the same pass — the **task × model table
columns**, the **filter facets**, and the **statistics questions**, which are *only* what
the intent needs to know. A statistic no reader question asks for does not go on the site.

2026-09-21 run an approved **200-problem pilot** was absent from the intent doc while the
code used **388**; once the number was written into the intent and a `pilot_scale` property
added, the job-state judgment came back **.04** and caught it. Approved-but-unwritten
numbers are the one defect class no amount of property tuning reaches.

## Step 1 — ANALYZE + SURVEY + DESIGN

- **1a** Spawn the `experiment-interpreter` subagent (Sonnet) on the current logs, queue
  state and metrics → `.jev-loop/analysis.md`. Every number it reports must carry a
  `file:line` citation; that is its own hard constraint.
- **1b** In parallel, spawn a `survey-paper`-style subagent (Sonnet) on the prior work the
  idea touches → `.jev-loop/survey.md`.
- **1c** The **main agent** writes `.jev-loop/design.md` with these mandatory headings:
  **Intent link** (which sentence of the intent doc this serves) · **Hypothesis**
  (falsifiable) · **Mechanism** (signal, where applied, how credited) · **Gates
  (numeric)** — quantity, threshold, direction · **Stop rules** · **Novelty vs survey** ·
  **Expected effect** (baseline number, expected effect size *with its source*, and why the
  gate thresholds sit above the known noise band) · **Cost vs benefit** (money/time/tokens/
  lines, which intent goal advances by how much if it works, and one cheaper alternative it
  beats) · **Closed axes not re-bought** · **Line budget** · **Contract check** -- a table,
  contracted step → where this design implements it → deviation (none / owner quote), read
  against the intent's Pipeline contract section. A heading left empty is a Step 3 fail. **Hypotheses come from the project's hypothesis bank** when one exists: the main
  agent picks and narrows them, it does not hand-write new ones beside the bank.

## Step 2 — DESIGN JUDGE (script → Jev)

```bash
set -a; source /path/to/.env; set +a
export TYPESAFE_API_KEY="$JEV_API_KEY"      # key from env only; never written or logged
python3 scripts/research_audit.py --intent docs/INTENT.md --closed-axes docs/closed_axes.txt \
  --out ./.jev-loop/ design --design .jev-loop/design.md
```

agent judge: `... --judge agent design` writes the request file instead of calling the backend; answer it into `<tag>.verdicts.json` and rerun the same command.

Fixed `noul` questions, all phrased **high = good**: `intent_consistent` ·
`no_closed_axis_rebuy` · `gates_numeric` · `stop_rules_present` · `novelty_stated` ·
`mechanism_verifiable` · `novelty_vs_named_prior` (a *named* prior work from the survey and
a delta that is more than a rename or a re-scope) · `expected_effect_grounded` (baseline,
sourced effect size, gates above the noise band) · `cost_benefit_stated` (cost, the advance
on a named intent goal, one cheaper alternative) · `cheapest_first` (no cheaper experiment
answering the same question left un-run in the queue); plus `design_quality`, a 1–5 `score`.
**These verdicts are a formal check only** — whether the research idea is *good* is not a
Jev question and stays with the human. The four added ones ask what the owner actually buys
with an experiment: **novelty against prior work, fit to the intent, expected performance,
return on the money.**

## Step 3 — rule

Any property **< .5** or `design_quality` **< 3.5** → back to **Step 1c** (round += 1).
Else → Step 4.

## Step 4 — PLAN (subagent)

Spawn `task-planner-analyzer` → `.jev-loop/plan.md`: per module, the **file** it touches,
its **line budget**, the **tests** that will cover it, and an explicit **"will not build"**
list. No code is written in this step.

## Step 5 — PLAN JUDGE (script → Jev)

```bash
python3 scripts/research_audit.py --intent docs/INTENT.md --out ./.jev-loop/ \
  plan --code-file mc/credit.py --plan-text "$(cat .jev-loop/plan.md)"
```

agent judge: `... --judge agent plan` writes the request file instead of calling the backend; answer it into `<tag>.verdicts.json` and rerun the same command.

Asks `fix_correct` / `fix_incomplete` / `fix_harm` / `budget_ok`. With `--closed-axes` it
is also the `design_error` probe. It orders the reading list; it does not approve a patch.

## Step 6 — rule

`fix_correct` < .5, or `fix_incomplete` ≥ .55, or `fix_harm` ≥ .55, or `budget_ok` < .5
→ back to **Step 4**. Else → Step 7.

## Step 7 — IMPLEMENT (subagents)

One `modular-code-architect` subagent **per module, in parallel**, each handed only its
module's row from `.jev-loop/plan.md` (file, budget, tests, will-not-build).
**"No implementation needed" is a valid outcome** — if the plan's claim is already wired,
record that and go to Step 8 with an empty diff rather than inventing work.

## Step 8 — IMPLEMENTATION AUDIT

**8a PROPERTIES (main agent writes).** Derive `properties.json` from the intent: one
`noul` question per **verifiable** property, each with explicit `criteria.true` /
`criteria.false`. Criteria are not decoration — the same planted defect moved a verdict
.61 → .58 without them (missed) and .65 → .33 with them (detected).

```json
[{"id": "uncapped",
  "question": "Is the credit magnitude passed through uncapped — no clamp or clip that collapses it to a sign-only binary?",
  "criteria": {"true": "the continuous magnitude survives into the reward",
               "false": "a cap truncates it"}}]
```

Properties that worked: uncapped credit · bidirectional credit (no anchor that drops one
direction) · post-centered token-localized credit (not summed into a sequence score and
broadcast) · no injected meta content in trained arms · no gold in the trigger or the
selection rule · single source of truth for a parser/grader · undefined terms excluded
rather than zero-filled. Add at least one **metric definition** property (does this gate
compute the quantity the intent names?) — the only handle on `measurement_error` — and at
least one **run-scale** property in the `pilot_scale` mould, pinning the scale the intent
fixes (*"does the submitted run use the pilot pool size / K / step count the intent
names?"*), which is what Step 8h below judges. Phrase
properties so **high = good**; the script adds three fixed `noul` questions where
**high = bad** (`gold_leak`, `unneeded`, `bug`) plus `quality`, a 5-level `score`, plus
these, which cover the rest of what goes wrong in an implementation — **unimplemented,
mis-implemented, duplicate, unclean, already-failed**:

| id | high = | asked when | what it catches |
| --- | --- | --- | --- |
| `clean_code` | good | always | one job per function · names that say what they do · no magic numbers or hidden global state · inside the line budget · has a test. Reasons must cite `file:line` |
| `plan_coverage` | good | `--plan PATH`, **once per `modules` run**, against the plan + the file list | a plan item never built; the reason lists the missing plan item ids |
| `duplicates_existing` | **bad** | `--package-root SRC` (a ~6 KB `def`/`class` index built with `ast` goes into the state) | this module re-implementing something the package already has |
| `repeats_failed_impl` | **bad** | `--failed-impls PATH` (a text ledger like closed axes) | rebuilding something the ledger already records as tried and failed |

Each is **skipped with a printed hint** when its input is missing — a question asked without
its evidence is a confident answer about nothing. A
property must be verifiable *from the code*; "is this good research?" is `open_ended`.

**Property scope.** Each property may carry an optional `"scope"`: `"code"` (the default when
absent), `"run"` or `"design"`. `modules` / `functions` / `plant` / `intent-delta` ask **only
`scope: "code"`** properties (plus the fixed four); **`runconfig` asks only `scope: "run"`**
properties and **drops the fixed `gold_leak` / `unneeded` / `bug` / `quality` questions**,
which are questions about code and are meaningless against a job JSON. A module-level property
asked of a job JSON produces a confident answer about nothing — on 2026-09-21, 26 code-scope
properties produced 15 escalations in one `runconfig` table and buried the two that mattered.
If `properties.json` has no run-scope property, `runconfig` dies with a hint: add one in the
`pilot_scale` mould.

```json
[{"id": "pilot_scale", "scope": "run",
  "question": "Does the submitted run use the pilot pool size / K / step count the intent names?",
  "criteria": {"true": "every scale knob matches the intent verbatim",
               "false": "a knob differs from the number the intent fixes"}}]
```

**8b MODULE JUDGE (script → Jev).**

```bash
python3 scripts/research_audit.py --intent docs/INTENT.md --properties properties.json \
  --out ./.jev-loop/ --closed-axes docs/closed_axes.txt --emit ./.jev-loop/live/ \
  modules --files mc/credit.py mc/train_hook.py \
  --plan .jev-loop/plan.md --package-root mc --failed-impls docs/failed_impls.txt
```

agent judge: `... --judge agent modules` writes the request file instead of calling the backend; answer it into `<tag>.verdicts.json` and rerun the same command.

All questions for one module go in **ONE** `jev-use judge` call. State = intent (+ closed
axes) + module source, passed by reference on stdin — nothing enters the conversation. One
JSON per module under `--out`, plus a table on stdout.

**8c READ THE TABLE (main agent).** Absolute levels are weak. Act only on a **property
answer < .5**, **bug ≥ .55**, or any **Δ ≥ .10** between two variants of the same code.
**Δ < .05 is noise.** Every `noul` verdict in validation returned `escalate: unsure`
(estimated confidence < .4) — the normal case, not a failure.

**8d NARROW (script → Jev).**

```bash
python3 scripts/research_audit.py --intent docs/INTENT.md --out ./.jev-loop/ \
  functions --file mc/train_hook.py
```

agent judge: `... --judge agent functions` writes the request file instead of calling the backend; answer it into `<tag>.verdicts.json` and rerun the same command.

Re-asks `bug` / `unneeded` per top-level function (state = module preamble + that function).

**8e DIRECT READ (main agent, mandatory).** Open the flagged function(s) **and the
framework code they call**. In validation the only real bug was found by reading verl's
`compute_grpo_outcome_advantage` — Jev never saw that file and could not have. Classify
each finding on both axes with `file:line`. Jev never closes a finding.

**8f BUDGET + COVERAGE.** `wc -l` every touched file against the Step 4 line budget
(overrun = `impl_error/budget_violation`); check for planned-but-**unimplemented** modules
(stub, `NotImplementedError`, silent zero) and for built-but-**unneeded** code the plan's
"will not build" list forbids.

**8g CALIBRATE (recommended once per repo).**

```bash
python3 scripts/research_audit.py --intent docs/INTENT.md --properties properties.json \
  plant --file mc/credit.py --patch 'OLD_LINE=>NEW_LINE_WITH_DEFECT'
```

agent judge: `... --judge agent plant` writes the request file instead of calling the backend; answer it into `<tag>.verdicts.json` and rerun the same command.

Judges the original against each planted-defect copy and prints Δ per question; each `OLD`
must occur exactly once. Record which defect classes come back **blind** (Δ < .10) in
`docs/research-loop-evidence.md` — a blind class is a human gate in this repo, permanently.

**8h RUN CONFIG (script → Jev, before submission; run it at Step 10, just before you
submit).** The audited code is not the run. Judge
the **exact job JSON you are about to submit** — its command string and env assignments — plus
the pool summary and the launcher's `${VAR:-default}` lines, against the same properties:

```bash
python3 scripts/research_audit.py --intent docs/INTENT.md --properties properties.json \
  --out ./.jev-loop/ --record runconfig --job .jev-loop/job.json \
  --pool-summary .jev-loop/pool_summary.json --launcher mc/run.sh
```

agent judge: `... --judge agent runconfig` writes the request file instead of calling the backend; answer it into `<tag>.verdicts.json` and rerun the same command.

A scale the intent fixes but the config does not honour shows up here and nowhere else — the
module audit reads code, not the knob the launcher defaulted. Read it with the Step 8c
thresholds; it asks **only the run-scope properties** of 8a. With `--judge agent` the row is
written straight from the agent's `<tag>.verdicts.json`; `record --target NAME --step N
--answers FILE.json` (`{id: value, ...}` plus an optional `evidence` map) remains the by-hand
path and lands `"backend": "agent"`. **`--record` is how STATE.json gets judgment rows**: every
subcommand appends `{step, subcommand, targets, min_property, max_bug, scores, choice, backend,
escalated, timestamp}` to
`STATE.json.history` and never deletes an entry. The agent hand-edits STATE.json **only for
step and round transitions** — never to write a judgment.

`min_property` is the minimum over **high = good `noul`** answers only: the high = bad ids
(`bug`, `gold_leak`, `unneeded`, `stop_rule_triggered`) are excluded, the 1–5 `score` verdicts
(`quality`, `design_quality`) land in `scores`, and a `choice` lands in `choice`. Mixing a
1–5 score into a [0,1] minimum is what made an early `min_property` read `1.0` on a failing run.

**Output contract.** The script prints raw Jev values only. **You** write the findings
table, on both axes:

| id | file:line | cause | confidence | evidence | next_test |
| --- | --- | --- | --- | --- | --- |
| F1 | `mc/train_hook.py:363` | `impl_error/wrong_wiring` | 확정 | jev bug .56 → function .56; direct read of verl `compute_grpo_outcome_advantage` | — |
| F2 | `mc/credit.py:44` | `unclassified` | 미확인 | jev `uncapped` .86, unsure | dump the step-1 advantage tensor and check the span |

`next_test` is **mandatory** for every 미확인 and `unclassified` row. Group the table under
확정 / 미확인 / 잡음, and close with one narrowing sentence, e.g. "jev 결과를 보니
`no_gold_trigger`만 .22로 떨어졌고 나머지 속성은 전부 .8 위였다, 이제 gold 가 트리거에
닿는 자리를 함수 단위로 좁힌다."

## Step 9 — rule, by cause axis

`impl_error` → Step 7 and re-audit · `design_error` → Step 1c · `measurement_error` → the
gate definition in the design doc (Step 1c) · `intent_error` → Step 0 with the human ·
`runtime_error` → Step 10 · `unclassified` → run `next_test`, then re-enter Step 8e. No
open 확정 row may pass to Step 10.

**Whenever the cause axis is `impl_error` or `measurement_error`**, the main agent appends
**one line** to `docs/failed_impls.txt`: *what was built, why it failed, the date.* That
ledger is what `--failed-impls` feeds back into the next audit, so the same dead
implementation is not bought twice.

## Step 10 — QUEUE + RESULTS JUDGE

Run **Step 8h (run config)** first — it lives at the end of Step 8 and is the last gate before
submission. Then the **main agent** submits the job JSON to the project's queue (never a subagent; never
a `git push`). On each completion trigger, spawn `experiment-interpreter` to turn the run's
logs into a **structured metric summary — a table of quantity, step, value, `file:line`** →
`.jev-loop/results.md`. Raw logs never go into that file and never reach Jev; the summary is
what is judged:

```bash
python3 scripts/research_audit.py --intent docs/INTENT.md --out ./.jev-loop/ \
  results --design .jev-loop/design.md --results .jev-loop/results.md
```

agent judge: `... --judge agent results` writes the request file instead of calling the backend; answer it into `<tag>.verdicts.json` and rerun the same command.

`noul`: `gates_met` · `stop_rule_triggered` (**high = bad**) · `metric_matches_definition`;
plus `continue`, a `choice` among `{continue, stop_arm, back_to_step_1}`. Any problem —
gate missed, stop rule fired, metric mismatch — sends the loop back to **Step 1**, and
`experiment-verifier` is the subagent to call when a reported number itself is in doubt.

## Keep the documents true

INTENT, design/plan, and any skill text the project relies on are updated **in the same
step** as the change that makes them stale, never after: goals/contract change → **INTENT
first** (quote + date), then design; a gate/stop rule/evaluator changes → a dated **design
amendment**, before implementation; implementation deviates from `.jev-loop/plan.md` → the
plan is amended with the reason before Step 8's audit; a lesson that generalises beyond this
project → a skill PR.

**Every step boundary ends with a 3-line check:** INTENT reflects the owner's latest words ·
design/plan reflect what is actually being run · site pipeline/queue reflect the current
step. Any "no" blocks the next step. Pass what synced as `--docs-synced
intent,design,plan,site` to `--record`; with `--emit` on, a missing/incomplete list adds a
warning sentence to the verdict's `plain`.

## Live record

The loop is watched while it runs, so it writes as it goes. `scripts/emit.py` keeps
`feed.jsonl` (append-only), `loop.json`, `queue.json` under one directory.

- **Every step transition and EVERY progress check emits one feed line** with `plain`: 2–3
  sentences a child could follow — what happened and what it means, no ids, no jargon.
  `emit.py` rejects a `plain` that is empty, over 400 characters, or carrying a gate/step id.
- **After each experiment table is read, a `note` is mandatory**, with
  `status` 확정 / 미확인 / 잡음. There is no reading a table and saying nothing.
- Only an interpretation that **passes the Step 10 results judge** may be marked 확정 on the
  statistics page. One that fails is marked **철회** — never deleted.
- `research_audit.py --emit DIR` writes the `verdict` line itself after every judged command
  and patches `loop.json`. In `--judge agent` mode the verdicts file must carry a top-level
  `"plain"` (validated the same way, exit 6 without it); in Jev mode the line gets a
  templated sentence built from the pass/fail counts.
- **On resume**, run `python3 scripts/emit.py --dir ./.jev-loop/live/ control` — the human's
  reordered queue or stop request. Read it **at step boundaries only, never polled**.

```bash
python3 scripts/emit.py --dir ./.jev-loop/live/ feed --kind note --stage step8 \
  --status 미확인 --title "credit audit table" \
  --plain "코드를 한 줄씩 살펴봤어요. 이상한 곳이 하나 보였지만 아직 확실하지 않아요."
python3 scripts/emit.py --dir ./.jev-loop/live/ queue --id exp-04 --state next \
  --why "cheaper than the sweep" --how "one seed, 50 problems" --pass-criterion "+3pt or more"
```

Statistics shown on the site are **limited to the questions in `site.config.json`**, and
each chart carries a **one-line takeaway plus its status**. A chart with no takeaway is not
published.

## Triggers, not monitoring (token economy)

The main agent never watches. It acts on **completion notifications** only, and between
them it spends nothing.

- Sub-agents and scripts write progress to the live record themselves (`emit.py feed|node|queue`,
  start and end of every unit of work). The site is where progress is *seen*; the conversation is not.
- The main agent speaks to the human only at **step boundaries** (a judge verdict, a gate pass/fail,
  a stop rule, a decision it cannot make), in ≤5 lines: what finished, the one number, what starts next.
  It does not relay sub-agent reports, and it does not re-summarise what the site already shows.
- Batch: launch independent units together, wait for all, then judge/score once. One audit pass per batch.
- Screenshots and other expensive self-checks happen once per site change at acceptance
  (`assets/research-site/AUDIT_RUBRIC.md`), not per iteration of someone else's work.
- Waiting on external state the harness cannot notify about (a CI run, a remote queue): one check
  sized to how long that thing takes, never a short polling loop.

## Hypotheses are sentences

A hypothesis is a **sentence a person could disagree with** about what the model does and why
("after a failing test run it edits a different file instead of reading the assertion"), not a column
that happens to separate two groups. Columns and table claims are *evidence for* a sentence.
Every card carries the sentence (`plain`), the mechanism it implies, the training task it would
justify, and at least one measure. Prefer measures that read the trajectory (`jev`-kind: Jev answers a
typed question over the cited turns) when the sentence is about behaviour or intent; use predicates
and table claims when it is string- or count-decidable. A kept column effect with no sentence that
explains it is reported as "unexplained structure", never as a finding.

## Research site template

`assets/research-site/` holds the reader-facing site: three tabs — **자료 / 통계 / 라이브** —
with a week selector, reading `trials.json`, `stats.json`, `feed.jsonl`, `loop.json`,
`queue.json` and `site.config.json`. Its `README.md` is the data contract; the template files
themselves land in a follow-up commit.

## Running the loop with the agent as judge

`--judge agent` runs the identical loop with the main agent (Fable) in Jev's seat: **the same
questions, the same thresholds (Step 3, Step 6, Step 8c), the same cause axis**, the same
`STATE.json.history` rows — only the answerer changes.

```bash
python3 scripts/research_audit.py --judge agent --intent docs/INTENT.md \
  --properties properties.json --out ./.jev-loop/ --record \
  modules --files mc/credit.py          # writes .jev-loop/credit.request.json, exits 5
# read that request, write .jev-loop/credit.verdicts.json, then rerun the SAME command
```

Rules for the agent:

- **Answer from the request file only.** Read `<tag>.request.json` and judge the state it
  contains — not your memory of the conversation, not the diff you just wrote. The request is
  the whole evidence base, exactly as it would have been for Jev.
- **Cite in every `reason`.** A non-empty `reason` with a `file:line` (`mc/credit.py:44`) or a
  document reference (`docs/INTENT.md`). No citation → the script rejects the file with exit 6.
- **Stay inside the type.** `noul` → a float in [0,1]; `score` → 1–5; `choice` → one of the
  option ids. Wrong type → exit 6.
- **Calibration still applies (Step 8g).** `plant` and `intent-delta` need **one verdict file
  per variant**, and the original and the planted copies must be answered in **separate, blind
  passes** — answer one, rerun, answer the next, without looking back at the earlier answers.
  An agent that remembers the original's numbers measures nothing.

## Running only one step

`--step N` is an instruction to the agent invoking this skill (e.g. `/jev-research-loop --step 8`), not a flag of `research_audit.py`; it enters the loop at step N with whatever documents already exist in
`.jev-loop/`. `--step 8` means **run the implementation audit alone** and stop at its
findings table; `--step 2` judges an existing design doc; `--step 10` judges results
already in hand. Steps skipped this way are recorded in `STATE.json.history`.

## What Jev cannot see

Runtime numbers, training curves, reproduction gates, tensor shapes, anything not in the
state, and any framework code you only call. Those stay human gates — no audit result
substitutes for running the gate. **Raw logs are never sent**: the only runtime material that
reaches Jev is the structured metric summary of Step 10 and, per «Order of operations» (c), a
failure signature for a failure that repeated twice in the same layer. And a number the human
approved but no document records is invisible by construction — hence the Step 0 approval
ledger. Cost/latency ≈ 700 ms per batched call at
judgment-model rates; a 2-module audit with 11 questions is two calls. The key is read
from the environment only; the script never prints, logs or writes it, never echoes the
state, and exits non-zero on node < 20 or a missing key with a one-line fix hint.

**Calibration numbers** (`docs/research-loop-evidence.md`): a ±1 cap planted into an
"uncapped" credit function was detected at **.65 → .33 (−.32) with** `criteria` and
**missed at .61 → .58 (−.03) without** them; the reproduction run moved `uncapped`
**.87 → .24** and `bug` **.37 → .64**; a broadcast-advantage patch moved `bug`
**.63 → .50**; a factually wrong intent statement on **unchanged code** moved the
alignment verdict **.65 → .52**. Blind classes: **sign flips** (Δ +.06, below the noise
floor), **uncalled framework code**, **runtime behavior**, and **falsified-claim swaps
far from the audited file** (≤ .05).
