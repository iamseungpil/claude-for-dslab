# English Academic Writing — Banned & Caution Phrases

For Stage 4 score gate when language is set to EN. Use as automatic checks during critic loops.

---

## 1. Throat-clearing openers (서두 빈말)

| Phrase | Problem | Regex |
|---|---|---|
| `In this paper, we...` | Reader knows it's the paper. Drop. | `\bin this paper, we\b` |
| `It is worth noting that...` | Everything you write is worth noting. Cut. | `\bit is worth noting\b` |
| `It should be noted that...` | Same problem. | `\bit should be noted\b` |
| `As mentioned above/before` | Reader has memory. Cut. | `\bas (mentioned\|stated) (above\|before)\b` |
| `The reader will note that...` | Patronizing. | `\bthe reader will note\b` |

---

## 2. Filler / vague quantifiers

| Phrase | Replace with | Regex |
|---|---|---|
| `various` | specific list (e.g., "three benchmarks") | `\bvarious\b` |
| `a number of` | concrete count | `\ba number of\b` |
| `several` (vague) | concrete count | `\bseveral\b` |
| `many` (in argument) | with qualification or count | `\bmany\b` |
| `quite` / `rather` (hedging) | drop | `\b(quite\|rather)\b` |

---

## 3. Overclaims

| Phrase | Problem | Regex |
|---|---|---|
| `clearly` | If clear, no need to say. | `\bclearly\b` |
| `obviously` | Same. Plus condescending. | `\bobviously\b` |
| `for the first time` | Overclaim risk. Verify. | `\bfor the first time\b` |
| `to the best of our knowledge, the first` | OK only with strong evidence. | `\bto the best of our knowledge, the first\b` |
| `novel approach` (without specifying what's new) | Specify the novelty. | `\bnovel approach\b` |
| `state-of-the-art` (claim) | Cite or qualify. | `\bstate-of-the-art\b` |

---

## 4. Soft hedging (vague modesty)

| Phrase | Replace | Regex |
|---|---|---|
| `it could be argued that` | drop, just argue | `\bit could be argued\b` |
| `seems to suggest` | suggests / shows | `\bseems to suggest\b` |
| `tends to be` | is, when X | `\btends to be\b` |
| `more or less` | drop | `\bmore or less\b` |

---

## 5. Connectors — overuse signals

These are not banned but **density** matters: > 1 per paragraph triggers a check.

| Phrase | When OK / When abused |
|---|---|
| `Moreover` | OK once per paragraph; if 2+ in a row, restructure |
| `Furthermore` | Same |
| `Additionally` | Often replaceable with rephrase |
| `In addition` | Same |
| `Therefore` (overuse) | Causal already implied; trim |
| `Thus` (overuse) | Same |

**Threshold:** ≥ 2 of {moreover, furthermore, additionally, in addition} per paragraph → -1 point.

---

## 6. Em-dash discipline

paper-section-rewrite enforces **em-dash 0**. The `—` and `---` are banned in body prose. Use parentheses, periods, commas, semicolons instead.

| Regex | Action |
|---|---|
| `—` | replace with `(...)` or `; ` or `. ` |
| `---` | same |

---

## 7. Bold leaders / paragraph labels

paper-section-rewrite enforces **0 bold-leader patterns**:

| Pattern | Action |
|---|---|
| `\textbf{X.}` | drop, write a thesis sentence instead |
| `\paragraph{X.}` | same |
| `\emph{label.}\quad ` | same |

---

## 8. List discipline

Body prose should be prose. Bullet lists are reserved for genuinely sequential or enumerable content.

| Test | Action |
|---|---|
| Bullet list ≥ 4 items in body | Convert to prose unless truly enumerable |
| Numbered list with no order | Convert to prose |

---

## 9. Forbidden specific phrases (style)

| Phrase | Problem |
|---|---|
| `we now turn to` | aesthetic in academic writing |
| `in summary` (anywhere but conclusion) | conclusion-only |
| `to conclude` (in body) | conclusion-only |
| `last but not least` | cliché |
| `at the end of the day` | colloquial |

---

## 10. Quantitative grep usage

```bash
# Count banned filler/overclaim
echo "$paragraph" | grep -oiE "\b(various|several|many|clearly|obviously)\b" | wc -l
echo "$paragraph" | grep -oiE "\b(moreover|furthermore|additionally|in addition)\b" | wc -l

# Em-dash check (zero allowed)
echo "$prose" | grep -c "—"
```

Coach output format:

```
This paragraph:
- "various" 2x → consider naming the items (-1 expression)
- "moreover" 2x in adjacent sentences → -1
- em-dash count: 0 ✓
Expression score: 1/3
```

---

## 11. Sentence-length / complexity heuristics

| Metric | Threshold |
|---|---|
| Words per sentence | > 30 → flag |
| Verbs per sentence | > 3 → flag |
| Subordinate-clause depth | > 2 levels → flag |
| Subjects per sentence | > 2 → flag |

---

## Korean register notes for KO/EN bilingual mode

When mixing KO body with EN technical terms:
- Inline gloss EN terms on first use: "도구적 부분 목표(instrumental sub-goal)"
- After first use, KO term sufficient
- Math notation: keep in EN/LaTeX
- Citations: keep in EN format
