# Style guide — one concept, one artefact

## The rule

A slide shows **one** of:

- one flowchart (TikZ)
- one code block (verbatim)
- one table (booktabs, ≤ 6 rows)
- one labelled I/O box
- one real example pulled verbatim from a run artefact

Never two of these on the same slide. If you need both, make two slides.

## Good vs bad

### ❌ Bad: mixed intent

```latex
\begin{frame}{DreamCoder overview}
  Five skill kinds:
  \begin{itemize}
    \item abstract_primitive ...
    \item observed_law ...
    ... (5 items)
  \end{itemize}
  \vspace{1em}
  \begin{Verbatim} ... code ... \end{Verbatim}
  \begin{tabular} ... table ... \end{tabular}
\end{frame}
```

Three artefacts on one slide → reader cannot find the takeaway.

### ✅ Good: split into three slides

```latex
\begin{frame}{DreamCoder — what it stores}
  \begin{Verbatim}
    { name, precondition, controller,
      expected_effect, revises? }
  \end{Verbatim}
\end{frame}

\begin{frame}{Where skills enter the library}
  \begin{tabular}{@{}ll@{}}
  \toprule source & rate \\ \midrule
  agent propose_skill & most common \\
  MCTS top path       & imagination \\
  consolidate (10 turns) & stats \\
  \bottomrule \end{tabular}
\end{frame}

\begin{frame}{Example skill (real)}
  <paste verbatim from research_logs/.../dreamcoder_library.json>
\end{frame}
```

## Takeaway sentence

Every slide has one spoken sentence the speaker will utter. Write it
explicitly in Phase 1 and keep it ≤ 20 words. If the sentence needs the
artefact to parse, rewrite it.

Example of a takeaway that stands alone:

> "Every 10 non-reset actions we rebuild the library; this is Sleep."

Example that does not stand alone:

> "This happens 10 turns." (10 turns of what? rebuild what?)

## What to exclude

- **"What this talk contributes"** — tell the audience in the intro, not
  as a slide.
- **Acknowledgements, Q&A, References-as-slide** — unless the user asked.
- **Categorical partitions that don't matter for the story** — if the
  code tags skills with five `kind` values but the audience does not
  care which kind is which, drop the taxonomy slide and show three
  real skills instead.
- **Decorative dividers** — Beamer's Metropolis auto-divider for
  `\section` is enough; don't add a second blank title slide.

## Real numbers, every time

Never put a made-up count on a slide. If you claim 66 skills, prove it:

```bash
python -c 'import json,glob; print(sum(len(json.load(open(p))) for p in glob.glob("research_logs/shared/ls20-cb3b57cc/arcgentica_v3_*/dreamcoder_library.json")))'
```

If the number you need is missing from the logs, either (a) change the
slide to a qualitative claim or (b) add a run to collect it — do not
invent.
