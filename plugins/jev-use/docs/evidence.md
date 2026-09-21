# Third-party evidence

Everything here is measured by other teams calling Jev directly in their
own projects, cited from their repos; jev-use's own first-party measurements
are in [bench/RESULTS.md](../bench/RESULTS.md). The ecosystem is as young as
Jev itself (weeks); weigh the numbers accordingly.

## Where Jev-in-the-loop wins

| Loop shape | Measured by | Their number |
| --- | --- | --- |
| Full browser-agent loop, matched A/B | [browser-use/jev-ultrafast](https://github.com/browser-use/jev-ultrafast) | task median **9.45 s → 7.09 s**; median Jev latency **178 ms**; the run split **17 Jev requests : 2 LLM text calls** ([their measurements](https://github.com/browser-use/jev-ultrafast/blob/main/docs/performance.md)) |
| Browser tasks, cost per task | [fastbrowse](https://github.com/agent-labs-dev/fastbrowse) | **40/42** passed at **$0.011/task** vs a hosted LLM agent's 14/42 at $0.40 — their words: "a task costs a thirty-fifth as much" |
| Gate every tool call | [pi-warden](https://github.com/DevMortimer/pi-warden), [jev-guard](https://github.com/leepokai/jev-guard) | 17,160 live calls at ~$0.00004 & ~0.3 s each; a guarded rule broken 0× with the gate on, 6× without |
| Per-item judgment, LLM vs Jev | [public-browser](https://github.com/Silbercue/public-browser) | ~3 s / $0.0002 per item vs 9–10 s / $0.11 (their caveat: "not a benchmark of equals") |
| Batch sweeps (files, rows, chunks) | [Every](https://github.com/sufianetaouil/every), [jgrep](https://github.com/kyu1204/jgrep), [jev-curate](https://github.com/AkashPriyadarshii/jev-curate) | 1,842 functions judged in 3.1 s for $0.03 |
| Stop / completion judging | [limpet](https://github.com/noplan-inc/limpet) | 0.7 s, $0.0001 per stop decision |
| Context trimming at write time | [pi-jev-context](https://github.com/Nyarlathoteppppp/pi-jev-context) | 31–53% of tool-result tokens cut, p50 347 ms |

Batching is why per-step cost stays flat:
[pi-heed measured](https://github.com/Nyarlathoteppppp/pi-heed/blob/main/EXPERIMENTS.md)
1/4/8 questions per call at ≈274 ms median either way — latency is flat in
question count, so every question about one state should ride one call.

## Where it does not win — the ecosystem's negative results

- **One-off evaluations.** Saving 5 s once is invisible; the design pays in
  loops.
- **Retroactive "will this matter later" judgments.**
  [pi-jev-context measured it](https://github.com/Nyarlathoteppppp/pi-jev-context):
  Jev-judged pruning of *old* context dropped later-needed information 73%
  of the time and stays shadow-only in that project. Judge at write time,
  not in hindsight.
- **Loops that are mostly generation.** If every step writes code, the
  dispatcher just routes everything back to the LLM —
  [yoshi](https://github.com/compozy/yoshi)'s Sonnet arm measured −0.03%
  savings.
