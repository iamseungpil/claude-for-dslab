export const meta = {
  name: 'deepswe-retaxonomy-and-site',
  description: 'Re-label DeepSWE failures on a prior-work taxonomy, measure agreement with a second model, then rebuild the viewer so each page does one job',
  phases: [
    { title: 'Reclassify', detail: '170 failure verdicts onto the published taxonomy' },
    { title: 'Crosscheck', detail: 'independent second labelling of a sample, for agreement' },
    { title: 'Wire', detail: 'taxonomy doc + collector carries the new fields' },
    { title: 'Site', detail: 'overview = numbers only; findings = insight, chart, example' },
  ],
}

const ROOT = '/w/seungpil.lee/deepswe'

const TAXONOMY = `
ROOT CAUSE — exactly one of these nine. The first eight are from "Failure as a Process:
An Anatomy of CLI Coding Agent Trajectories" (arXiv 2607.09510), which labelled CLI agent
trajectories with Opus drafting and two human annotators finalising (Cohen's kappa 0.78-0.94).
The ninth is ours, for cases where the agent's solution was defensible and the grader rejected it.

  epistemic group (the agent's picture of the world was wrong):
  - false_premise         acts on an unverified assumption about the task or the environment
  - specification_neglect ignores or forgets an explicitly stated requirement
  - output_misreading     misinterprets command output or an error message
  - ignored_signal        continues despite evidence that contradicts its assumption
  - premature_action      acts before performing basic verification

  competence group (the agent knew what to do and could not do it):
  - knowledge_gap         lacks the required domain, tool, library or protocol knowledge
  - capability_limitation picks a reasonable strategy but executes it incorrectly

  external:
  - environment_blocker   fails because of an external environment blocker
  - verifier_artifact     a defensible solution rejected by grader-side conventions
                          (name collisions, test-id ordering, held-out test expectations)

PHASE — exactly one of three, from "An Empirical Study on Failures in Automated Issue
Solving" (arXiv 2509.13941), whose taxonomy has three phases, nine categories and 25
subcategories, labelled by four researchers with dual independent coding (kappa 0.72-0.77):
  - localization  the decisive error was in finding the code to change
  - repair        the decisive error was in what the change did
  - validation    the decisive error was in checking the result

POST_FAILURE_BEHAVIOUR — exactly one, also from arXiv 2607.09510, which found five dominant
behaviours after an error becomes unrecoverable:
  - gives_up               terminates quickly with little further work
  - repairs_wrong_problem  keeps repairing something that is not the actual cause
  - repeats_same_approach  retries the same unsuccessful strategy without changing direction
  - useless_checks         runs verification that cannot change the outcome any more
  - fabricates_success     claims success, or bends its own tests, while the task is unsolved
  - none_reached           the run ended at submission with no such period
`

const OUTPUT_CONTRACT = `
Write the result INTO the existing verdict file, adding one new key "taxonomy" whose value is
an object with exactly these keys, and changing nothing else in the file:

  "root_cause"              one of the nine names above
  "root_cause_evidence"     one sentence naming the concrete moment in this trial that fixes the label
  "phase"                   localization | repair | validation
  "post_failure_behaviour"  one of the six names above
  "confidence"              high | medium | low — low when the existing verdict does not settle it
  "prior_label"             the file's existing "category" value, copied verbatim, so the two can be compared

Load with json.load, add the key, dump with json.dump(obj, f, ensure_ascii=False, indent=1).
Never hand-edit JSON text. Confirm each file re-parses with python3 -m json.tool before moving on.
`

const READ_SOURCE = `
Each verdict file already contains an earlier judge's extracted evidence: "summary",
"critical_reason", "reasoning_flaw" (a quote from the agent's own reasoning plus why it was
wrong), "missing_requirements", "patch_gap", "training_data_hint", "contrast_ko", and the
booleans "found_gold_files", "ran_tests", "verified_result". Label from that evidence.
Do not open the raw transcripts under jobs/analysis-briefs — they run to 1.2 MB each and the
verdict already carries what the earlier judge found. If a verdict genuinely does not settle
the label, say so with "confidence": "low" rather than guessing confidently.
`

phase('Reclassify')
const SHARDS = 8
const relabel = await parallel(
  Array.from({ length: SHARDS }, (_, k) => () =>
    agent(
      `Re-label DeepSWE failure verdicts onto a taxonomy taken from published work.

Your shard: run
  ls ${ROOT}/jobs/analysis/*.json | sort | awk 'NR % ${SHARDS} == ${k}'
That is your exact file list. Handle every file it prints, in order. Do this work YOURSELF —
no sub-agents, no delegation. You are not finished until every file in your shard has the new key.

${TAXONOMY}
${READ_SOURCE}
${OUTPUT_CONTRACT}

Judge honestly and independently. The existing "category" field is an earlier, coarser label
made without reference to any published taxonomy; copy it into "prior_label" but do not let it
decide your answer. In particular: a verdict the old scheme called "misread_requirements" may
be false_premise (it assumed something and never checked) or specification_neglect (the
requirement was stated and it dropped it) — those are different failures and the distinction
is the point of this pass.

Touch only files under jobs/analysis/. Other processes write elsewhere under jobs/. Run no git commands.

Report in 4 lines: how many files you labelled, the root_cause distribution, how many you
marked confidence low, and one case where your label disagrees with prior_label and why.`,
      { label: `relabel:shard${k}`, phase: 'Reclassify' }
    )
  )
)

phase('Crosscheck')
const CROSS = 3
const crosscheck = await parallel(
  Array.from({ length: CROSS }, (_, k) => () =>
    agent(
      `Independently label a sample of DeepSWE failure verdicts, for an inter-rater agreement measure.
Another model has already labelled all of them. You must not look at its answer.

Your sample: run
  mkdir -p ${ROOT}/jobs/analysis-crosscheck
  ls ${ROOT}/jobs/analysis/*.json | sort | awk 'NR % 6 == ${k}' | head -20
Handle every file it prints. Do this work YOURSELF — no sub-agents, no delegation.

${TAXONOMY}
${READ_SOURCE}

CRITICAL: when you read a verdict file, IGNORE its "taxonomy" key entirely if present — that is
the other model's answer and using it would destroy the measurement. Label from the evidence
fields only.

Write your answer to a SEPARATE file: ${ROOT}/jobs/analysis-crosscheck/<same basename>.json,
containing exactly {"root_cause": ..., "phase": ..., "post_failure_behaviour": ..., "confidence": ...}.
Use json.dump with ensure_ascii=False. Do not modify anything under jobs/analysis/.

Report in 3 lines: how many you labelled, your root_cause distribution, and any label you found
genuinely ambiguous.`,
      { label: `crosscheck:${k}`, phase: 'Crosscheck', model: 'opus' }
    )
  )
)

phase('Wire')
const wire = await parallel([
  () =>
    agent(
      `Write ${ROOT}/docs/taxonomy.md — a short Korean document explaining the failure taxonomy this
project now uses and where it came from. It will be shown on the site.

Content, in this order:
1. One paragraph: why the taxonomy changed. The first pass used categories invented while reading
   this data, with no reference to published work. The new one is taken from two peer-reviewed
   empirical studies so results can be compared with them.
2. The taxonomy itself, as three short lists (root cause / phase / post-failure behaviour), each
   item one line of plain Korean. Source of truth:
${TAXONOMY}
3. Provenance, with links:
   - "Failure as a Process: An Anatomy of CLI Coding Agent Trajectories", arXiv 2607.09510
     (https://arxiv.org/html/2607.09510) — root causes and post-failure behaviours. Their labelling
     used Claude Opus drafts finalised by two human annotators, Cohen's kappa 0.78-0.94. Their own
     distribution was epistemic 57.9%, competence 32.8%, environment 9.4%.
   - "An Empirical Study on Failures in Automated Issue Solving", arXiv 2509.13941
     (https://arxiv.org/abs/2509.13941) — the localization / repair / validation phases. Four
     researchers dual-coded 150 failed instances, pairwise kappa 0.72-0.77.
   - "SWE-EVO", arXiv 2512.18470 (https://arxiv.org/pdf/2512.18470) — consulted, its coarser seven
     categories fold into the above.
4. What we added and why: verifier_artifact is ours, for defensible solutions the grader rejected.
5. Limitations, stated plainly: labels were assigned from an earlier judge's extracted evidence
   rather than from the raw transcripts; one model labelled everything and a second model labelled
   a sample for agreement; no human adjudication. Say that the agreement figure will be inserted
   here once computed, as a placeholder line reading "일치도: (측정 후 기입)".

Korean, plain language, no heading deeper than ##. Markdown. Do not touch any other file.
Run no git commands. Report in 2 lines what you wrote.`,
      { label: 'doc:taxonomy', phase: 'Wire' }
    ),
  () =>
    agent(
      `Make the collector carry the new taxonomy fields into the site data, and add the taxonomy
document to the site metadata. Edit only ${ROOT}/deepswe/collect.py.

1. Each verdict under jobs/analysis/ now has a "taxonomy" object with keys root_cause,
   root_cause_evidence, phase, post_failure_behaviour, confidence, prior_label. In the per-trial
   summary written to trials.json (look for where "analysis_category" and "knowledge_gap" are set),
   add flat fields: "root_cause", "fail_phase", "post_behaviour", "tax_confidence". Read them
   defensively — a verdict without the key must yield None, not an exception.
2. In the meta object (look for where "analysis_categories" and "knowledge_gaps" lists are built),
   add sorted unique lists "root_causes", "fail_phases", "post_behaviours" over the trials.
3. Add a TAXONOMY_MD constant pointing at docs/taxonomy.md alongside the existing ABOUT_MD and
   TAKEAWAYS_MD, and put its text in meta as "taxonomy_doc" (empty string when the file is absent).
4. The full taxonomy object must also reach the per-trial detail JSON, next to the existing
   "analysis" object, so the trial page can show the evidence sentence.

Then run, from ${ROOT}:
  jobs=(); for j in jobs/smoke jobs/full-b0* jobs/dt-iso-full; do [ -d "$j" ] && jobs+=("$j"); done
  .venv/bin/python -m deepswe.collect "\${jobs[@]}"
and confirm with a short python one-liner that trials.json now carries non-null root_cause on the
failed trials and that meta.json has the three new lists. Do not deploy. Run no git commands.
Report in 3 lines: what you changed and the counts you verified.`,
      { label: 'wire:collector', phase: 'Wire' }
    ),
])

phase('Site')
const overview = await agent(
  `Restructure the DeepSWE viewer's OVERVIEW so the page does one job: show the numbers and let the
reader filter and jump to examples. Edit only ${ROOT}/site/index.html.

The problem: renderOverview has grown to eight stacked cards of equal visual weight — 무엇이 결과를
가르나, 통과와 실패는 무엇이 달랐나, 네 축을 나란히, 얼마나 썼나, 한눈에, 통과율 · 리더보드 대비,
왜 틀렸나, 얼마나 아깝게 틀렸나 — plus prose explaining each. A reader cannot tell conclusion from
evidence. Interpretation belongs on the findings tab, not here.

Rebuild renderOverview as exactly THREE cards:

1. \`숫자\` — the KPI tiles that exist today (시행, 통과율, 과제, 비용), then the four side-by-side
   pass-rate charts that exist today as 네 축을 나란히 (모델별 / 언어별 / 난이도별 / 과제 종류별),
   each keeping its spread-in-pp caption. Then the cost-per-solved-task bars and the token bars from
   today's 얼마나 썼나. Numbers only — delete the computed prose sentences from all of these.
2. \`유형\` — failure type distribution on the NEW taxonomy: one stacked bar of root_cause per model
   (trials now carry a "root_cause" field; group the nine causes into the three families
   epistemic / competence / external for the bar, with the nine as a legend), one bar of fail_phase,
   one bar of post_behaviour. Under each chart, up to three links to representative trials
   (#trial/<id>), choosing failed trials of that type with the smallest f2p_fail. One short Korean
   line per chart saying what the chart shows — a label, not an argument.
3. The existing trial table card, unchanged.

Everything you remove from the overview must not be deleted from the codebase blindly: the helper
functions the findings tab still uses must keep working. Check what renderFindings calls before you
delete anything.

Add sidebar filters for the three new axes (root_cause, fail_phase, post_behaviour) alongside the
existing chips, with Korean labels — add a KO.cause / KO.phase / KO.behaviour map. Wire them into
the existing filter state and filtered() the same way the existing chips work.

CONSTRAINTS: colours only from existing CSS custom properties or the existing mcolor/CAT_COLORS/
GAP_COLORS helpers, no raw hex. Do not change data loading, routing, openTask, openTrial,
renderSetup. Do not rename existing ids/classes. Round every number. Korean text throughout.
The max-width:900px media query must keep working.

VERIFY: from ${ROOT}/site run python3 -m http.server 8801 --bind 127.0.0.1 &, then
  timeout 90 chromium-browser --headless=new --no-sandbox --disable-gpu --disable-dev-shm-usage --hide-scrollbars --window-size=1400,1600 --virtual-time-budget=8000 --screenshot=$HOME/ov.png "http://127.0.0.1:8801/"
and a 430x1400 shot. Chromium cannot write to /tmp; use $HOME. Read both, confirm three cards, real
numbers, working example links, no clipped labels. Kill the server. Run no git commands.

Report in 5 lines: what the overview now contains and what the screenshots showed.`,
  { label: 'site:overview', phase: 'Site' }
)

const findings = await agent(
  `Rewrite the DeepSWE viewer's FINDINGS tab so it does one job: explain, to someone who has never
seen this project, what was learned — as a sequence of insight cards, each one conclusion + one
chart + one real example to click. Edit ${ROOT}/site/index.html (function renderFindings) and
rewrite ${ROOT}/docs/takeaways.md.

Today the findings tab is a small computed dashboard followed by a 25,000-character Korean essay.
The essay is too dense to be the thing a reader meets. Invert it.

New renderFindings: a vertical sequence of six to eight INSIGHT CARDS. Each card is
  - a heading that states the conclusion as a sentence a child could follow
  - one chart, computed from state.trials, that shows exactly that conclusion and nothing else
  - one line of supporting numbers
  - two or three links to real trials (#trial/<id>) that show the conclusion concretely
The insights to cover, each computed live, never hard-coded:
  (a) four conditions, 113 problems each, and what fraction each solved
  (b) failures are dominated by the epistemic family, not by missing knowledge — use root_cause
  (c) most failures miss by one or two required tests
  (d) more thinking did not buy more correct answers: max-reasoning turns vs pass rate
  (e) which language is hardest, and that task size does not predict difficulty
  (f) cost per solved task differs several-fold between models
  (g) passing is not the same as meeting the spec: the share of judged winners with a requirement gap
  (h) what the winners did differently: ambiguity resolved by checking rather than guessing
Use the site's existing chart idiom and helpers. Keep each card short; the reader should be able to
scroll the whole tab and come away with the story.

Below the cards, put the markdown document inside a collapsed \`<details class="more">\` labelled
\`자세한 분석 원문\`, and add a second collapsed block \`분류 기준과 출처\` rendering
state.meta.taxonomy_doc (the new taxonomy document, may be empty — handle that).

Then rewrite ${ROOT}/docs/takeaways.md to match: keep every number and claim that is still true, but
cut it to roughly a third by removing restatement and moving dense numeric passages under \`### 상세\`
subsections. Lead every \`##\` section with one plain-Korean conclusion sentence. Preserve the existing
italic header note about scope, and the sections on the isolation incident, the judge-bias finding,
and the limitations — those are findings, not filler. Do not invent numbers: every figure must
already appear in the current document or be computable from ${ROOT}/site/data/trials.json.

After editing takeaways.md, run from ${ROOT}:
  jobs=(); for j in jobs/smoke jobs/full-b0* jobs/dt-iso-full; do [ -d "$j" ] && jobs+=("$j"); done
  .venv/bin/python -m deepswe.collect "\${jobs[@]}"
so meta.json picks up the new text.

CONSTRAINTS: colours only from existing CSS custom properties or existing palettes, no raw hex.
Do not change data loading, routing, renderOverview, openTask, openTrial, renderSetup. Korean
throughout, plain words, no jargon left unexplained. Round every number.

VERIFY: serve on 8802, screenshot #findings at 1400x2200 and 430x1600 with headless chromium
(write to $HOME, not /tmp), read both, confirm the cards render with real numbers and the example
links resolve. Kill the server. Run no git commands.

Report in 5 lines: the insight cards you produced and what the screenshots showed.`,
  { label: 'site:findings', phase: 'Site' }
)

return {
  relabel: relabel.filter(Boolean).length,
  crosscheck: crosscheck.filter(Boolean).length,
  wired: wire.filter(Boolean).length,
  overview: overview ? 'done' : 'failed',
  findings: findings ? 'done' : 'failed',
}
