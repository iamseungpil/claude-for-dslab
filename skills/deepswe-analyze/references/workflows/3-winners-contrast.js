export const meta = {
  name: 'deepswe-winners-and-eli5',
  description: 'Explain why the same model solved one task and failed a similar one, judge every passing trial on the mirrored taxonomy, then fill the winner pages and rewrite the findings as an ELI5 report with trace links',
  phases: [
    { title: 'Contrast', detail: 'same model, same repo, one solved one not — why' },
    { title: 'Winners', detail: 'judge all passing trials on the mirrored axes' },
    { title: 'Gate', detail: 'wait for the previous workflow to land' },
    { title: 'Site', detail: 'winner pages filled, findings rewritten as ELI5 with links' },
  ],
}

const ROOT = '/w/seungpil.lee/deepswe'

const MIRROR = `
SUCCESS AXIS — exactly one of nine. These mirror the failure root causes taken from
"Failure as a Process" (arXiv 2607.09510), so a solved and a failed trial can sit on one axis.
Pick the one that most decides why this attempt succeeded:

  epistemic group (its picture of the world was right, and it made it right on purpose):
  - verified_assumption    checked an assumption about the task or environment instead of trusting it
  - followed_spec          tracked every stated requirement through to the implementation
  - read_output_correctly  read a command's output or an error precisely and acted on what it said
  - acted_on_signal        noticed evidence against its own work and chased it down
  - checked_before_acting  verified before making the change, not after

  competence group:
  - had_knowledge          brought the domain, tool or library knowledge the task needed
  - executed_cleanly       right strategy, carried out without slips

  external:
  - no_obstacle            nothing in the environment got in the way and the work was routine
  - grader_favourable      it passed partly because the grader did not check something it got wrong
                           — use this whenever the trial left a stated requirement unmet and still passed
`

phase('Contrast')
const CSHARDS = 4
const contrast = await parallel(
  Array.from({ length: CSHARDS }, (_, k) => () =>
    agent(
      `Explain why ONE model solved one task and failed another in the SAME repository. Model ability
is held constant, so the difference is in the task and in what the agent did — which is exactly what
we want to isolate. Do this work YOURSELF; no sub-agents.

Get your pairs:
  cd ${ROOT} && .venv/bin/python - <<'PY'
import json,collections
T=json.load(open('site/data/trials.json'))
g=collections.defaultdict(list)
for t in T: g[(t['model'],t['repo'])].append(t)
pairs=[]
for (m,r),v in sorted(g.items()):
    for a in [x for x in v if x['resolved']]:
        for b in [x for x in v if not x['resolved']]:
            pairs.append((m,r,a['id'],b['id']))
for i,p in enumerate(pairs):
    if i % ${CSHARDS} == ${k}: print('\\t'.join(p))
PY
Every line it prints is one pair: model, repo, the id that PASSED, the id that FAILED.

For each pair:
1. Read the failed trial's verdict at jobs/analysis/<failed-id>.json — it already carries an earlier
   judge's evidence (summary, critical_reason, reasoning_flaw, missing_requirements, patch_gap) and,
   if the previous pass reached it, a "taxonomy" object.
2. Read the passing trial's evidence. If jobs/analysis-wins/<passed-id>.json exists, read it. If not,
   build its brief first with:  cd ${ROOT} && .venv/bin/python -m deepswe.win_brief <passed-id>
   then read jobs/analysis-briefs/<passed-id>.win.md in chunks (it can reach 1.2 MB — read the task
   statement, both patches, and sample the transcript where decisions were made).
3. Read both task statements under datasets/deep-swe/tasks/<task>/instruction.md to see how the two
   problems actually differ.
4. Write jobs/analysis-contrast/<passed-id>__vs__<failed-id>.json (mkdir -p the directory) with
   exactly these keys:
     "model", "repo", "passed_id", "failed_id"
     "task_difference"   one or two English sentences: how the two problems differ in what they demand
     "approach_difference" one or two English sentences: what the agent did differently on the two runs
     "decisive_factor"   one of: task_was_harder | approach_differed | verification_differed | luck
     "explanation_ko"    한국어 정확히 세 문장. 첫 문장은 두 문제가 무엇이 달랐는지, 둘째 문장은 같은
                         모델이 무엇을 다르게 했는지, 셋째 문장은 그래서 왜 한쪽만 통과했는지. 함수·
                         파일 이름은 백틱으로 원문 유지, 나머지는 쉬운 한국어. 뭉뚱그린 문장 금지.
   json.dump with ensure_ascii=False, indent=1. Verify each re-parses with python3 -m json.tool.

Be willing to answer "luck" when the honest reading is that the tasks were comparable and the
difference was not principled — that is a real finding, not a failure to analyse.

Touch only jobs/analysis-contrast/ and jobs/analysis-briefs/. Run no git commands.
Report in 4 lines: how many pairs you did, the decisive_factor distribution, and one pair where the
same model clearly changed its approach between the two runs.`,
      { label: `contrast:${k}`, phase: 'Contrast', model: 'opus' }
    )
  )
)

phase('Winners')
const NEW_SHARDS = 5
const judgeNew = Array.from({ length: NEW_SHARDS }, (_, k) => () =>
  agent(
    `Judge PASSING DeepSWE trials that have never been judged, on the success axis below. Do this work
YOURSELF; no sub-agents. You are not finished until every id in your shard has a file.

Get your shard:
  cd ${ROOT} && .venv/bin/python - <<'PY'
import json,os
T=json.load(open('site/data/trials.json'))
todo=[t['id'] for t in sorted(T,key=lambda x:x['id'])
      if t['resolved'] and not os.path.exists(f"jobs/analysis-wins/{t['id']}.json")]
for i,x in enumerate(todo):
    if i % ${NEW_SHARDS} == ${k}: print(x)
PY

For each id: build its brief with  cd ${ROOT} && .venv/bin/python -m deepswe.win_brief <id>
then read jobs/analysis-briefs/<id>.win.md in chunks (up to 1.2 MB; read the task statement, both
patches, and sample the transcript where the agent decided what to build). Write
jobs/analysis-wins/<id>.json immediately before moving to the next id.

${MIRROR}

Keys, exactly these:
  "success_axis"        one of the nine names above
  "axis_evidence"       one sentence naming the concrete moment that fixes the label
  "requirements_total"  int — distinct behavioural requirements the task states
  "requirements_addressed" int, <= total
  "ambiguity_handling"  checked_codebase | reasoned_from_spec | guessed | none_encountered
  "checked_conventions" bool
  "self_flagged_risks"  int; "self_flagged_acted_on" int, <= risks
  "own_tests_targeted_hidden_behaviour" bool
  "what_worked"         2-3 English sentences
  "success_factor_ko"   한국어 정확히 두 문장 — 무엇을 잘했는지, 그래서 왜 통과했는지. 식별자는 백틱
                        유지, 나머지는 쉬운 한국어, 뭉뚱그린 문장 금지, 문장당 40~120자
  "divergence_from_reference" 1-2 English sentences on how the patch differs from the reference yet passes

CALIBRATION: passing the graders does NOT prove the agent met every stated requirement, nor that its
own tests were well aimed. An earlier batch that was not warned about this returned full coverage for
100% of trials; a warned batch found gaps in 14%. Enumerate the stated requirements and check each.
When a trial left a requirement unmet and still passed, its success_axis is grader_favourable.

json.dump with ensure_ascii=False, indent=1; verify with python3 -m json.tool. Touch only
jobs/analysis-wins/ and jobs/analysis-briefs/. Run no git commands.
Report in 4 lines: files written, success_axis distribution, how many scored below full coverage,
and one grader_favourable case if you found any.`,
    { label: `winners:new${k}`, phase: 'Winners' }
  )
)

const REMAP_SHARDS = 2
const remap = Array.from({ length: REMAP_SHARDS }, (_, k) => () =>
  agent(
    `Add the success axis to DeepSWE passing trials that were already judged on an older, home-made set
of fields. Do this work YOURSELF; no sub-agents.

Get your shard:
  cd ${ROOT} && ls jobs/analysis-wins/*.json | sort | awk 'NR % ${REMAP_SHARDS} == ${k}'

Each file already contains: requirements_total, requirements_addressed, ambiguity_handling,
checked_conventions, self_flagged_risks, self_flagged_acted_on, own_tests_targeted_hidden_behaviour,
what_worked, success_factor_ko, divergence_from_reference. That evidence is enough — do NOT open the
raw briefs.

${MIRROR}

Add exactly two new keys to each file, changing nothing else:
  "success_axis"   one of the nine names
  "axis_evidence"  one sentence from the existing evidence that fixes the label

Rules that decide the label from what is already recorded:
  - requirements_addressed < requirements_total  ->  grader_favourable, always. It passed while
    leaving a stated requirement unmet, which is what that label means.
  - ambiguity_handling == "checked_codebase"     ->  usually verified_assumption, unless the evidence
    points more precisely at another axis.
  - ambiguity_handling == "reasoned_from_spec"   ->  usually followed_spec.
  - self_flagged_acted_on close to self_flagged_risks, with the evidence describing a chase after a
    warning sign -> acted_on_signal.
  - evidence about reading an error or test output precisely -> read_output_correctly.
  - evidence about knowing a library/protocol convention others missed -> had_knowledge.
  - a routine task with no real ambiguity -> no_obstacle.
Use judgement, not just the rules; the rules resolve ties.

Load with json.load, add the keys, dump with json.dump(..., ensure_ascii=False, indent=1). Verify each
re-parses. Touch only jobs/analysis-wins/. Run no git commands.
Report in 3 lines: files updated, success_axis distribution, how many were grader_favourable.`,
    { label: `winners:remap${k}`, phase: 'Winners' }
  )
)

const winners = await parallel([...judgeNew, ...remap])

phase('Gate')
await agent(
  `Wait for a previous workflow to finish writing, then report what landed. Do not edit anything.

Poll every 60 seconds, up to 40 times, until ALL of these hold, then stop polling:
  - ${ROOT}/docs/taxonomy.md exists and is non-empty
  - ${ROOT}/site/data/trials.json has at least one trial with a non-null "root_cause"
  - ${ROOT}/site/index.html has not been modified for at least 3 minutes
Use: stat -c %Y, and a python one-liner for the trials.json check. Sleep with  sleep 60.

If the 40 attempts run out, stop anyway and report which conditions were still unmet — do not fail.

Then report in 4 lines: which conditions held, whether index.html appears to contain a
renderFindings rewrite (grep for '숫자로 보는 결론' and for the string 'taxonomy_doc'), and the count
of trials carrying root_cause. Run no git commands.`,
  { label: 'gate:wait-for-previous', phase: 'Gate' }
)

phase('Site')
const winnerPage = await agent(
  `Fill in the DeepSWE viewer's page for a trial that PASSED. Edit only ${ROOT}/site/index.html.

Today a failed trial opens onto a rich page — Korean one-liner, 무엇이 잘못됐나, 결정적 순간 with the
commands, paired patches, full trajectory — while a passing trial shows almost nothing. Every passing
trial now has a verdict, so fill it.

Data: the trial detail JSON (data/traj/<model>/<id>.json, already loaded by loadDetail) carries a
"win" object with success_axis, axis_evidence, requirements_total/addressed, ambiguity_handling,
checked_conventions, self_flagged_risks/acted_on, own_tests_targeted_hidden_behaviour, what_worked,
success_factor_ko, divergence_from_reference. Some trials also have contrast data — check whether the
collector exposes it; if not, add it: files live at ${ROOT}/jobs/analysis-contrast/<passed>__vs__<failed>.json
and each names a passed_id and failed_id, so a passing trial can show "같은 모델이 같은 저장소에서
못 푼 문제" with explanation_ko and a link to that failed trial. Wire that through
${ROOT}/deepswe/collect.py into the detail JSON, then re-run the collector:
  cd ${ROOT} && jobs=(); for j in jobs/smoke jobs/full-b0* jobs/dt-iso-full; do [ -d "$j" ] && jobs+=("$j"); done
  .venv/bin/python -m deepswe.collect "\${jobs[@]}"

In openTrial, for a passing trial render, in this order:
  1. success_factor_ko in the existing .contrast block, labelled 무엇이 통했나
  2. a fact row: 성공 요인 (Korean label for success_axis — add a KO.axis map), 애매함 처리,
     저장소 관례 확인, 요구사항 대조 (as a percentage), 자기 발견 처리 (acted/flagged)
  3. axis_evidence and what_worked and divergence_from_reference in the existing .note style under a
     분석 원문 (영문) caption
  4. when contrast data exists: a card 같은 모델, 갈린 문제 showing explanation_ko and a link to the
     failed trial, so the reader can jump straight to the comparison
Keep the existing problem / tests / paired-patches / trajectory sections working for both outcomes.

CONSTRAINTS: colours only from existing CSS custom properties or existing palettes, no raw hex. Do not
change routing, filtering, renderOverview, renderFindings, renderSetup. Do not rename ids/classes.
Korean throughout. The max-width:900px query must keep working.

VERIFY: serve ${ROOT}/site on 8811, pick a passing trial that has contrast data and one that does not,
screenshot both at 1400x1600 with headless chromium writing to $HOME (not /tmp), read them, confirm
the sections render with real values. Kill the server. Run no git commands.
Report in 5 lines: what you added and what the screenshots showed.`,
  { label: 'site:winner-page', phase: 'Site' }
)

const report = await agent(
  `Rewrite the DeepSWE viewer's findings tab as an ELI5 report: something a bright child could read
top to bottom and come away understanding what this experiment found. Edit ${ROOT}/site/index.html
(renderFindings) and rewrite ${ROOT}/docs/takeaways.md.

Think of it as a report, not a dashboard. A sequence of sections; each section is
  - a heading that states the finding in one plain sentence
  - two or three sentences of plain Korean explaining it, using an everyday comparison where it helps
    (the running metaphor in this project is a school exam: 113 questions, four students, hidden
    marking)
  - one chart computed live from state.trials showing exactly that finding
  - two or three links to real trials (#trial/<id>) that show it concretely, each labelled with the
    task title so the reader knows what they are opening

Cover these, all computed from the data, never hard-coded:
  1. QUANTITATIVE, interpreted — not just the numbers but what they mean: pass rate per model,
     per language, per difficulty, per task category; cost per solved task; token use. For each,
     one sentence of interpretation. Say plainly which differences are big enough to matter
     (language spans ~32 points) and which are not (task category ~7).
  2. WHAT MODELS GET WRONG — the root_cause distribution on the new taxonomy, grouped into the
     epistemic / competence / external families, with what that grouping means in plain words.
     Then fail_phase and post_behaviour.
  3. WHAT MODELS GET RIGHT — the success_axis distribution over passing trials, set against the
     failure causes so the reader sees the mirror.
  4. THE SAME MODEL, DIFFERENT OUTCOMES — from jobs/analysis-contrast if the collector exposes it,
     otherwise from trials alone: the same model solving one task and failing another in the same
     repository, and what decided it.
  5. PASSING IS NOT THE SAME AS CORRECT — the share of passing trials labelled grader_favourable or
     scored below full requirement coverage.
  6. MORE THINKING DID NOT BUY MORE ANSWERS — max-reasoning turns against its pass rate.
  7. HOW WE KNOW, AND WHERE THIS COULD BE WRONG — the isolation incident, the judge-bias finding,
     the agreement measure between the two labelling models if jobs/analysis-crosscheck has content,
     and the fact that labels came from an earlier judge's evidence rather than raw transcripts.

Below the sections, keep two collapsed blocks: 자세한 분석 원문 rendering state.meta.takeaways, and
분류 기준과 출처 rendering state.meta.taxonomy_doc (the taxonomy document with its arXiv citations).

Then rewrite ${ROOT}/docs/takeaways.md to match that voice: same findings, plain Korean, every
\`##\` section opening with its conclusion, dense numeric passages moved under \`### 상세\`. Keep every
number that is still true; invent none. Preserve the header scope note, the isolation-incident
section, the judge-bias section, and the limitations. Then re-run the collector so meta.json picks it
up (same command as the other site agent uses).

CONSTRAINTS: colours only from existing CSS custom properties or existing palettes, no raw hex. Do not
change data loading, routing, renderOverview, openTask, openTrial, renderSetup. Round every number.
Korean throughout, every term explained on first use.

VERIFY: serve on 8812, screenshot #findings at 1400x2400 and 430x1600 with headless chromium writing
to $HOME, read both, confirm every section has a chart with real numbers and working trial links.
Kill the server. Run no git commands.
Report in 5 lines: the sections you produced and what the screenshots showed.`,
  { label: 'site:eli5-report', phase: 'Site' }
)

return {
  contrastAgents: contrast.filter(Boolean).length,
  winnerAgents: winners.filter(Boolean).length,
  winnerPage: winnerPage ? 'done' : 'failed',
  report: report ? 'done' : 'failed',
}
