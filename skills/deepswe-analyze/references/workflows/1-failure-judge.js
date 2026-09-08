export const meta = {
  name: 'deepswe-failure-analysis',
  description: 'One Sonnet subagent per failed DeepSWE trial: read the analysis brief, write a fixed-schema verdict JSON',
  phases: [{ title: 'Analyze', detail: 'read brief, judge the trajectory, write jobs/analysis/<id>.json' }],
}
const ROOT = '/w/seungpil.lee/deepswe'
const SCHEMA = {
  type: 'object',
  properties: {
    id: { type: 'string' },
    written: { type: 'boolean' },
    category: { type: 'string' },
    knowledge_gap: { type: 'string' },
  },
  required: ['id', 'written', 'category', 'knowledge_gap'],
}
const CATEGORIES = 'misread_requirements, incomplete_implementation, wrong_strategy, localization, broke_existing_behavior, environment_or_tooling, no_verification, gave_up_or_ran_out, verifier_mismatch'
const GAPS = 'language_or_stdlib, library_or_framework, codebase_conventions, requirement_interpretation, testing_discipline, algorithm_or_design, none'
const prompt = (id) => `You are a senior software engineer reviewing why a coding agent failed one benchmark task.

1. Read the ENTIRE brief at ${ROOT}/jobs/analysis-briefs/${id}.md. It can be up to ~22,000 lines: read it in chunks with the Read tool (offset/limit) until you reach the end. Do not skip the transcript — the agent's own reasoning lines are the most important evidence.
2. Decide why the attempt failed, then write your verdict as a single JSON object to ${ROOT}/jobs/analysis/${id}.json with EXACTLY these keys and types:
   - category (string): exactly one of: ${CATEGORIES}
   - summary (string): two or three sentences — what went wrong and why the tests failed
   - plain_summary_ko (string): 한국어 한두 문장. 전문 용어 없이, 초등학생도 이해할 수 있게 이 시도가 왜 틀렸는지 설명
   - critical_calls (array of integers): the [call N] indices where the failure became inevitable; at most 4
   - critical_reason (string): one sentence on what those calls got wrong
   - reasoning_flaw (string): quote the sentence(s) from the agent's reasoning at or just before the critical call where its thinking went wrong, then one paragraph on why that thinking was mistaken and what it should have concluded; empty string if the reasoning was sound and the mistake was purely mechanical
   - missing_requirements (array of strings): requirements in the task statement the patch does not satisfy; empty array if none
   - patch_gap (string): what the reference patch does that the model patch does not, one or two sentences
   - knowledge_gap (string): exactly one of: ${GAPS} — the thing the agent most lacked
   - training_data_hint (string): one or two sentences on what kind of training examples would have prevented this failure
   - found_gold_files (boolean): the model edited the files the reference patch edits
   - ran_tests (boolean): the model ran the project's relevant test suite at least once
   - verified_result (boolean): the model checked its own result against the requirements before finishing
   Be concrete and cite evidence from the transcript. Valid JSON only, UTF-8, no comments, no trailing commas.
3. Return {id: "${id}", written: true, category, knowledge_gap} via the structured output. If you could not read the brief or write the file, return written: false.`
phase('Analyze')
const results = await pipeline(
  args,
  (id) => agent(prompt(id), { label: `analyze:${id}`, phase: 'Analyze', schema: SCHEMA, model: 'sonnet', effort: 'high' }),
)
const ok = results.filter(Boolean).filter(r => r.written)
log(`${ok.length} verdicts written of ${args.length}`)
return { written: ok.length, total: args.length, failed: args.filter(id => !ok.some(r => r.id === id)) }