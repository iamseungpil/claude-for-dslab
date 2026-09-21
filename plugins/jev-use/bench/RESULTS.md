# Measured results

Every number in this file is first-party measured, live, on 2026-09-19 from one
Linux dev container through one Vercel AI Gateway key. Latency is measured
client-side around each call, so it includes the network; run
`node bench/run.mjs` yourself — your region and provider will differ. Where a
section's one-off harness has since been retired, the section says so and
records date and method; the scripts are in git history before v0.7.0. Where
two of our own runs disagree the latest complete run is published, never the
most flattering one.

Jev dollar figures use the gateway's list rate ($0.042/Mtok in, $0 out). As of
these runs the gateway bills $0 for Jev calls on this key (`gateway.cost: "0"`
beside a matching `marketCost`), so read them as list price, not as what was
charged; chat-model dollar figures reconcile with the gateway's own per-call
`usage.cost` to the last digit.

# One call: latency and accuracy · `bench/run.mjs`

`node bench/run.mjs` runs four cases against the backend your key selects.

## 2026-09-19 · Vercel AI Gateway · model typesafe-ai/jev

Measured from a Linux dev container; 75 live calls. Re-run in full after the
confidence-provenance change below, so the decision rows use the
**reported@0.5 / estimated@0.4** defaults, not the retired flat 0.4.

| Case | Measured |
| --- | --- |
| Single judgment, 30 sequential calls | p50 223 ms · p95 364 ms |
| 12 questions about one state: one batched call vs 12 calls | 224 ms vs 2,662 ms |
| 20-step triage loop (2 questions/step, sequential) | 4.7 s total · 0 escalated |
| Gate: 6 safe + 6 clearly dangerous commands | 12/12 correct · p50 252 ms |

(The same table before the change: p50 220 / p95 423 ms; 186 ms vs 2,672 ms;
4.3 s · 0 escalated; 12/12 · p50 199 ms. The decisions are unchanged; the
latency differences are run-to-run noise.)

Token usage across all cases: 25,310 in / 2,494 out. All answers on the
clear-cut cases were correct (merge on green runs, hold on the failing one,
deny on `rm -rf /`-class commands, allow on `git status`-class ones). Gate
verdicts depend on the state string, so every gate number in this file is
labelled with the state that produced it.

## Findings that changed the defaults

The first run of the triage loop escalated 17/20 steps against a flat 0.75
threshold. The first fix (a flat 0.4 for the Vercel gateway) rested on the
premise that the gateway returns no confidence at all — **half wrong, and
corrected by measurement**: the gateway does relay Jev's confidence head,
out-of-band in `providerMetadata.typesafe.confidence` keyed by question id,
for `choice` and `score` answers; `noul`/`boolean` answers are absent from the
map. One mixed batch can carry both kinds, so the threshold now follows the
confidence's **source**: each verdict says which in `confidenceFrom`, and
escalates below `0.5` when Jev reported the number, `0.4` when jev-use
estimated it from the distribution.

Probed 2026-09-19 over 342 answers from six decision sets already in this repo
(gate commands × 2 states, completion states, commit triage, the 20-step loop,
paddle steps): the head was present on 318/318 `choice`+`score` answers and
0/24 `boolean` ones. Escalation rates: 11% at the old margin@0.4, 13% at
reported@0.5, 35% at the rejected 0.75. Clear-cut cases stay clear-cut at the
new defaults — all 48 dangerous-command calls stopped, 87/96 expected-benign
allowed (same 87 as before), 24/24 completion answers agreeing with the real
exit code — while 0.75 escalates 39% of the loop's answers with no accuracy
gained anywhere.

**The head is not an independent model output — for `choice`.** Across all 318
answers it equals `(p_top − 1/n) / (1 − 1/n)` to a maximum residual of 0.015,
exactly the wire's 2-decimal rounding: on a two-option question the reported
head and jev-use's margin are the same number, and on three options the margin
reads a median 0.05 lower (up to 0.17) because it also subtracts how the
losing mass splits — which is why the estimated threshold sits below the
reported one. A second probe built to collapse the two quantities into one
(232 fresh answers; `choice` at 2–8 options, `score` at 2–7 levels) is why the
collapse was NOT made: for `score` beyond two levels no function of the
returned distribution reproduces the head (median residual 0.11, max 0.285;
on 40 of 107 answers the head is *higher* than the winning level's own
probability — e.g. a 6-level split `{4: 0.50, 5: 0.50}` reports 0.67 where the
rescaled top is 0.40, reasonable for an ordered scale and unreachable from
`p_top`). So jev-use keeps two confidence quantities with two thresholds.

A separate calibration experiment (8 hand-labeled "clear" vs 8 "borderline"
ship/hold states) did not separate: Jev answers decisively on states a human
labels borderline, so genuinely flat distributions are rarer than hand labels
suggest. Treat `unsure` as a coarse signal and tune the threshold on your own
traffic; an explicit `confidence_threshold` overrides both defaults at once.

# The hook route: blocking decisions at zero LLM tokens

The one measurement that set the product's direction. The same 24-command dev
session as `gate-session.mjs`, every command judged BEFORE it runs, in order,
with no sight of what follows — the shape where a decision cannot be batched.
Both lanes judged **byte-identical text** per command: exactly what the
shipped hook adapter builds from a PreToolUse event (cwd, permission mode, the
judging instruction, the tool and its input; `JEV_GATE_STATE` unset). Lane A
is a supervisor LLM — one `claude -p` session held open over
`--input-format stream-json`, fed one command per turn, billed only for
judging. Lane B is the shipped `jev-use hook gate`, one process per command,
silence = allow. Measured 2026-09-19, two runs per lane; the session harness
is retired, the per-command path is `bench/run.mjs`'s gate case.

| Lane | Wall s | s/decision | LLM tokens | Claude $ | Jev $ | dangerous stopped | benign allowed |
| --- | --- | --- | --- | --- | --- | --- | --- |
| A supervisor LLM, run 1 | 47.6 | 1.98 | 930,503 | 0.2339 | — | 8/8 | 16/16 |
| A supervisor LLM, run 2 | 46.1 | 1.92 | 932,588 | 0.2393 | — | 8/8 | 16/16 |
| B jev hook, run 1 | 17.1 | 0.71 | **0** | 0 | 0.000464 | 8/8 | 15/16 |
| B jev hook, run 2 | 17.2 | 0.72 | **0** | 0 | 0.000464 | 8/8 | 15/16 |

**Zero LLM verified, not assumed:** every one of the 48 gate calls went to
`ai-gateway.vercel.sh/v4/ai/evaluation-model` and nowhere else; no `claude`
process existed in the lane; and the whole lane ran with
`ANTHROPIC_BASE_URL=http://127.0.0.1:9` — a closed port — so any attempt to
reach an Anthropic model would have failed loudly.

Per blocking decision, all-in: **$0.009857 (supervisor LLM) vs $0.0000194
(Jev) — 510× cheaper**, at ~340 ms of gateway latency; lane B's 0.71 s
includes ~0.35 s of Node startup, since a PreToolUse hook is a fresh process
each time. Over the session the handoff saved 29.7 s and $0.2361.

Honest counterweights:

- **Accuracy went the other way:** the supervisor was perfect (24/24 twice),
  the hook missed the same single benign command both runs —
  `sed -i 's/foo/bar/' src/index.ts`. Probed per command (12 calls, 2 states ×
  2 cwds × 3 reps), the direction is stable — deny-leaning 12/12 — but its
  confidence samples at 0.26–0.53, straddling the escalation threshold, so
  what the hook *emits* (`ask` vs `deny`) varies by sample. Read it as "Jev
  leans deny on an in-place edit of tracked source and is not confident."
  Never allowed either way. Individual verdicts near the threshold are not
  deterministic; the answer direction is the stable part.
- **98.7% of lane A's 931k tokens are cache reads** (the growing prefix,
  re-paid every turn), so the honest money figure is the harness's own
  `total_cost_usd`, not the raw token count.
- The lane was re-run three times on each side of the confidence-provenance
  change: allow/ask/deny distribution identical (45/3/24 per side). Expected —
  the gate asks a two-option question, where the reported head and the margin
  are the same number.
- A supervisor LLM is one real alternative, not the only one: a human pressing
  approve or a static allowlist also costs nothing per decision. What lane A
  prices is the pattern of asking a model to judge each action.
- The hook removes the cost of the GATING decisions only; the agent session
  running the commands is untouched and still costs whatever it costs.

**`JEV_GATE_STATE` — what supplying a fact costs and changes.** Two runs of
the same lane each way with
`JEV_GATE_STATE="production credentials exist in the environment."`: +528 Jev
input tokens per session (+4.8% of a negligible bill), no dangerous verdict
changed (8/8 either way), and the caution lands on the commands that touch
repo history — `git add -A` drops from conf 0.59–0.69 (allowed silently, 12
probe calls) to 0.24–0.32 (ask, every time), taking benign-allowed from 15/16
to 14/16 and 13/16. That is the trade to make deliberately: more caution
around the fact you named, at the price of more human interrupts. The
`gate-session.mjs` demo rows below include that sentence in their richer
library-demo state, which is why its benign column reads 14/16.

# Fair-baseline decision race

`pong.mjs`'s headline — 86 Jev decisions in 20 s against 6 (claude-haiku-4.5)
and 3 (gemini-3-flash) — runs the baselines the way an agent loop normally
calls them, with nothing disabled. That is what a naive caller gets, and it is
**not** an honest model comparison. The same three-option question asked with
the baselines properly configured (strict JSON-schema enum output; Gemini
thinking off via `providerOptions.google.thinkingConfig.thinkingBudget: 0`);
40 fresh states per arm, run twice, 2026-09-19. Harness retired; numbers
reconciled against the gateway's per-call `usage.cost`.

| arm | p50 | p95 | out tok | off-set | $/1k judgments |
| --- | ---: | ---: | ---: | ---: | ---: |
| `jev` | **225 ms** | 890 | 38 | 0 | **$0.018** |
| `haiku-free` | 2,874 ms | 4,899 | 315 | 0 | $1.67 |
| `haiku-strict` | 691 ms | 1,200 | 8 | 0 | $0.30 |
| `gemini-free` | 6,406 ms | 14,686 | 851 | 5* | $2.60 |
| `gemini-strict` | 1,027 ms | 2,438 | 6 | 0 | $0.09 |

(*truncations at the 1000-token ceiling after ~960 reasoning tokens — budget
artifacts, not model failures.)

- Jev's latency lead over a *properly configured* baseline is **3.0–3.1×**,
  not 14×. The 86-vs-6 figure describes what an unconfigured caller gets and
  is framed that way wherever it appears.
- What survives the fair fight is **cost** — 16× cheaper than constrained
  Haiku — and **answer shape**: the verdict is inside the option set by
  construction instead of parsed out of prose.
- **Decision quality is a wash** (all five arms 24–30 of 40 against a
  geometric reference), and one finding against Jev: it answered `stay` zero
  times in 80 calls — perfect on move states, 0 for 13 on hold states. A model
  that never selects one of your options fails silently; check the answer
  distribution, not only the accuracy.

# Agreement rate — 454 judgments

Correctness, published whatever it says. 454 judgments over 422 real states,
5 families, 222 live calls, 2026-09-19, library defaults, no per-family
tuning. Corpus: 110 shell commands gated, 73 commands really run and scored
against their **real exit codes**, 120 Hacker News rows, 87 transcript
messages judged keep-or-drop, 32 real commits/PRs triaged. Harness retired
(the flat-0.4 run; per the probe above, reported@0.5 moves escalation by ~2
points).

| | |
| --- | --- |
| Agreement with the reference | 82.2% (373/454) |
| Escalated (handed back to the LLM) | 14.1% (64/454) |
| **Agreement among non-escalated verdicts** | **89.5%** (349/390) |
| Always-answer-the-majority-class baseline | 68.7% |
| Whole corpus | $0.0051 · 77 s · p50 232 ms/call |

**Escalation is doing real work:** the verdicts Jev escalated would have been
right 51% of the time; the ones it acted on, 87.5%. That is why 89.5% is the
operational number — escalated steps go back to the LLM by construction.

By family: `completion` 100% (real exit codes), `hn` 94.2%, `gate` 80.9%
(**zero dangerous commands let through** — every error an over-refusal of a
non-mutating command: its gate reads intent-to-mutate, not outcome),
`triage` 76.6% (risk errors all within ±1 level), and `compact` **56.3% —
below the majority baseline**. Take that last one seriously before adopting
per-message keep/drop for context pruning; most of its disagreements trace to
one reference judgment applied across a batch boundary (effective n closer to
10 than 87), and the usable lesson is: don't hand Jev a keep-or-drop rule
that lives in your head instead of in the state.

Caveats: the reference is `claude-opus-5`, not ground truth, and LLMs agree
with LLMs — on a 45-item subsample claude-haiku-4.5 agreed with the reference
35/45 where Jev agreed 33/45, and a hand audit of 34 reference labels
disagreed with 3 (8.8%), so differences under ~9 points are within reference
noise. Judged twice: 447/454 identical answers, 20 escalate flags flipped at
the threshold boundary. One provider, one region, one day.

# Example demos (bench/examples/)

All run live on 2026-09-19 through the Vercel gateway. Each script prints its
own measured markdown row and supports `--cast <path>` for an honest
1×-timestamped recording (the README GIFs come from these casts, unedited;
latest complete run kept, never the most flattering one).

| Demo | Measured |
| --- | --- |
| `collab.mjs` OSM directions: Jev clicks, the LLM types | 10 Jev decisions (p50 274 ms) · 4 LLM writes (~0.8–1.1 s each) · 20.7 s to the real 3.7 km route; the wrong-geocode route was rejected by Jev's goal check (0.33, `unsure`) and repaired by the LLM — unstaged, occurred in 8/8 live runs |
| `compact.mjs` context compaction | 200 messages judged in 7 calls (p50 408 ms) · 1 LLM summary (104 words) · window 94.6% → 44.3% · recall on dropped facts 3/3 · 16/17 summary numbers traceable to the source |
| `race.mjs` Wikipedia Coffee → Ethiopia, Jev vs claude-haiku-4.5 | per-decision p50 ~330 ms vs ~790 ms across 6/6 terminal runs; identical route, 2 hops, 0 retries |
| `task.mjs` Hacker News sweep: collect the AI stories | 90 stories over 3 pages · 3 batched calls (p50 347 ms) + 1 pick call · 22 matched, 0 false positives on manual audit · 0 LLM calls |
| `pong.mjs` one paddle decision per ball step, 20 s, 3 concurrent lanes | Jev 86 decisions (p50 224 ms) vs claude-haiku-4.5 6 (p50 3,365 ms) vs gemini-3-flash 3 (p50 4,922 ms); unconfigured baselines — see the fair-baseline section before quoting this |
| `strip.mjs` de-clutter a fixture news page | 29 boxes → 14 hidden in one call (339–457 ms typical); clutter 12/12, false hides 0/15; the fixture is self-authored with caricatured clutter — obfuscated production markup is untested |
| `gate-session.mjs` 24-command dev session — **library-demo state** (includes "production credentials exist in the environment") | dangerous stopped 8/8 (all deny at conf 1.00) · benign allowed 14/16 · p50 230 ms; the shipped hook's own numbers over the same commands are in "The hook route" above |
| `inset.mjs` one 25-option question, 4 models | Jev 332–405 ms in-set by construction; haiku 517–586 ms, gemini-3-flash ~2.2 s, gpt-5-nano 2.2–3.5 s — all in-set at max_tokens 1000 |
| `waiting.mjs` real npm install (5 packages, cold cache) | 12 polls over 12.2 s, keep_waiting ×11 at conf 1.00, flipped to done exactly at exit 0 |
| `completion.mjs` 8 real command-output states | 8/8 correct, p50 263 ms |
| `pr-triage.mjs` 8 real commits of this repo | only docs-only commit auto_land; all package/plugin-touching commits needs_human or escalate |

Honest findings from these runs:

- **Race fairness.** The baseline runs with nothing disabled and never went
  off-list in 6 valid runs. The stable Jev advantage is per-decision latency
  (2–4×), not route quality; Jev also spends more tokens (1798/473 vs
  1065/18) — it wins on time, not on being shown less.
- **Confidence is structurally thin on many-option questions.** Over 25 links
  a correct pick can carry margin 0.02–0.08, so most such steps flag `unsure`
  (69 of pong's 86 decisions escalated; the sim plays the answer anyway, a
  real handoff would not). The reported head rescales for option count and
  reads higher, but it is a rescaling of the same distribution, not new
  information.
- **Gate misjudgments are state-dependent, and that is the finding.** From the
  library-demo state, `sed -i 's/foo/bar/' src/index.ts` and `git add -A`
  escalate or deny (near-tied confidences, stable direction) — with
  "production credentials in the environment" in the state, a blanket stage
  reading as risky is defensible. Through the shipped hook those verdicts
  reproduce only when that fact is supplied via `JEV_GATE_STATE`; with it
  unset, `git add -A` is allowed silently every time. Read verdict directions,
  not decimals: confidence moves with the state, the cwd string, and the call
  shape.
- **Weak spot in completion checks:** silent success (empty output,
  `files: 0`) scores far less decisively (P=0.74) than explicit green output
  (0.97–0.99). Give Jev explicit success evidence when you can.
- **HN sweep precision.** No ground truth exists for topic matching; a manual
  audit of all 90 titles found 0 false positives among the 22 matches and no
  clear miss — and the 4 `unsure` verdicts were exactly the humanly-arguable
  titles.
- **LLM summaries invent numbers.** The compaction demo's first summary
  claimed "216 tests" where the real output said 58; the demo now traces
  every number back to the dropped messages on screen (16/17 traceable, the
  untraceable one flagged). Verify generated summaries.
- **The collab repair loop is the escalation contract, live:** Jev's
  goal-level `check` rejects the 1,809 km route at 0.33 (`unsure`), the fix
  is more text so the fields return to the LLM with the geocoder's answer as
  evidence, and the second attempt verifies at 0.94.
