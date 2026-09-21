# Research site template

The reader-facing view of one research loop. **The template files themselves (HTML/CSS/JS)
are not here yet — they land in a follow-up commit by another agent.** This README is the
data contract they will be written against, and it is already authoritative: `emit.py` and
`research_audit.py --emit` write these files today.

## Three tabs, one week selector

Every tab is scoped by a **week selector**; a file's rows carry `week`, and the selector
filters on it.

| tab | shows | source |
| --- | --- | --- |
| **자료** | the task × model table, with the filter facets the config names | `trials.json`, columns and facets from `site.config.json` |
| **통계** | only the statistics questions the config asks for — one chart each, every chart with a **one-line takeaway** and a **status** (확정 / 미확인 / 잡음 / 철회) | `stats.json` |
| **라이브** | the running loop: the feed newest-first, the current step and its verdict, the experiment queue | `feed.jsonl`, `loop.json`, `queue.json` |

A statistic no reader question asks for is not published. A chart with no takeaway is not
published. An interpretation that failed the Step 10 results judge is marked **철회** and
stays visible — it is never deleted.

## Data contract

- **`trials.json`** — `{"week": str, "rows": [{task, model, ...columns from the config}]}`.
  One row per trial; the column set is whatever `site.config.json` declares.
- **`stats.json`** — `{"week": str, "charts": [{"question", "kind", "series", "takeaway",
  "status"}]}`. `question` matches one entry of the config's `statistics`; `status` is
  확정 / 미확인 / 잡음 / 철회.
- **`feed.jsonl`** — one JSON object per line, append-only, written by `emit.py feed`:
  `{ts (UTC ISO), week, kind: event|metric|note|decision|error|verdict, stage, title, plain,
  body?, status?, numbers{}, links[], author}`. `plain` is the sentence the page shows; the
  rest is detail behind it.
- **`loop.json`** — `{design, step, status, scores{}, rule, cause, back_to, updated}`,
  patched by `emit.py loop` and by `research_audit.py --emit`.
- **`queue.json`** — `{"items": [{id, state: past|running|next, why, how, pass_criterion,
  result}]}`, upserted by `emit.py queue`.
- **`site.config.json`** — written once at Step 0 and again when the intent doc changes:
  `{"columns": [...], "facets": [...], "statistics": [...]}`. The statistics list is *only*
  what the intent needs to know.
- **`control.json`** (optional, human-written) — a reordered queue or a stop request. The
  loop reads it with `emit.py control` **at step boundaries only, never polled**.

## Notes for whoever builds the template

- Read-only: the page never writes back into these files; the human's channel back is
  `control.json`.
- `feed.jsonl` grows; read it tail-first and page it.
- Korean is the reader language of the feed; keep the UI chrome consistent with it.
