---
name: iterative-academic-writing
description: Write academic documents with iterative self-evaluation, fact verification, naturalness check, and refinement. Use when creating research papers, SoPs, abstracts, weekly reports, or any scholarly writing. Applies 19 principles (14 original + 5 naturalness) including fact-based writing with hallucination detection and AI-style sentence filtering. Loops through FactBase→Draft→Evaluate→Plan→Rewrite until Critical issues and hallucinations reach zero (max 5 iterations). Triggers on requests like "write my SoP", "help with paper", "주간 보고서 작성", "논문 작성 도와줘".
---

# Iterative Academic Writing

Write academic documents with fact verification, self-evaluate against 14 principles, and iteratively refine until quality criteria are met.

## Workflow

```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│  [Phase 0]        [Phase 1]        [Phase 2]                │
│  Build Fact  ───→  Draft    ───→   Evaluate                 │
│  Base                                  │                    │
│                                        ↓                    │
│                                   Issues Found?             │
│                                        │                    │
│                              No ───────┴─────── Yes         │
│                              ↓                   ↓          │
│                          ✅ Complete      [Phase 3]         │
│                                            Plan             │
│                                              │              │
│                                              ↓              │
│                                        [Phase 4]            │
│                                         Rewrite             │
│                                              │              │
│                                              └───→ Phase 2  │
│                                                   (LOOP)    │
└─────────────────────────────────────────────────────────────┘
```

**Termination Conditions:**
- ✅ Success: `Critical == 0 AND Hallucinations == 0`
- ⚠️ Partial: `Iteration == 5` with no hallucinations → output + remaining issues
- ❌ Failure: `Iteration == 5` with hallucinations → cannot publish

## 19 Principles (14 Original + 5 Naturalness)

### Factual Accuracy (사실성) — HIGHEST PRIORITY

| ID | Principle | Violation |
|----|-----------|-----------|
| FA1 | **Fact-based claims** | Claim not in Fact Base |
| FA2 | **No invented numbers** | Metrics/statistics without verified source |
| FA3 | **Verified citations** | Paper reference not WebSearch-verified |

### Structure (구조)

| ID | Principle | Violation |
|----|-----------|-----------|
| ST1 | **Topic-first (두괄식)** | Paragraph starts with background instead of main claim |
| ST2 | **Purpose-driven opening** | Section doesn't state why it exists |
| ST3 | **Implication-focused closing** | Section ends without stating significance |
| ST4 | **Figure/table reference** | Visual used without "Figure X shows..." |

### Understandability (이해도)

| ID | Principle | Violation |
|----|-----------|-----------|
| UN1 | **Definition-first** | Technical term used before "X is Y" definition |
| UN2 | **Compare-contrast** | New approach explained without comparing to existing |
| UN3 | **Beginner-friendly** | Requires domain knowledge to understand |
| UN4 | **Coherent flow** | Missing logical connectors between paragraphs |

### Format (형식)

| ID | Principle | Violation |
|----|-----------|-----------|
| FM1 | **Conciseness** | Unnecessary modifiers (매우, very, extremely) |
| FM2 | **Specific numbers** | Vague quantifiers (많은, some, several) |
| FM3 | **Prose only** | Bullet points in body text |
| FM4 | **Abstract-level** | Exposes file paths, function names |

### Naturalness (자연스러움)

AI가 생성한 글은 사람이 쓴 글과 미묘하게 다른 패턴을 보인다. 각 문장을 소리 내어 읽었을 때 어색하지 않은지가 기준이다.

| ID | Principle | Violation |
|----|-----------|-----------|
| NL1 | **번역체 금지** | "~하는지와 ~한지를", "~함으로써", "~에 있어서" 같은 영어 직역 구조 |
| NL2 | **과잉 수사 금지** | "수렴하고 있다", "관통하는", "혁신적인" 등 내용 대비 포장이 큰 표현 |
| NL3 | **한 문장 한 아이디어** | 동사 3개 이상 나열, em-dash 안에 긴 절이 들어가는 과압축 문장 |
| NL4 | **단어 반복 금지** | 같은 문장 또는 인접 문장에서 동일 단어 중복 (예: "직접...직접") |
| NL5 | **접속사 다양성** | "그러나", "따라서", "또한"이 기계적으로 매 문단 시작에 반복 |

## Issue Classification

### 🔴 Critical (must fix — blocks completion)

| ID | Issue | Principle |
|----|-------|-----------|
| C1 | Hallucination — claim not in Fact Base | FA1/FA2 |
| C2 | Fact contradiction — claim differs from Fact Base | FA1 |
| C3 | Topic-first violation | ST1 |
| C4 | Undefined technical term | UN1 |
| C5 | Not beginner-friendly | UN3 |
| C6 | Logical disconnect between paragraphs | UN4 |
| C7 | Bullet points in prose | FM3 |
| C8 | Translation-style sentence structure | NL1 |

### 🟡 Warning (should fix)

| ID | Issue | Principle |
|----|-------|-----------|
| W1 | Unverified citation | FA3 |
| W2 | Missing compare-contrast | UN2 |
| W3 | No implication at section end | ST3 |
| W4 | Vague modifiers | FM1 |
| W5 | Purpose unclear at section start | ST2 |
| W6 | Vague quantifiers | FM2 |
| W7 | Code elements exposed | FM4 |
| W8 | Figure/table without reference | ST4 |
| W9 | Overblown rhetoric | NL2 |
| W10 | Overloaded sentence (3+ verbs) | NL3 |
| W11 | Word repetition in adjacent sentences | NL4 |
| W12 | Mechanical connector pattern | NL5 |

### 🔵 Suggestion (optional)

| ID | Issue |
|----|-------|
| S1 | Add connective words |
| S2 | Add example/analogy |
| S3 | Simplify sentence |

---

## Phase 0: Build Fact Base (REQUIRED)

**Before writing anything, collect and verify all facts. No claim may appear in the document without a Fact Base entry.**

### Sources to Check

| Source Type | What to Extract | Verification Method |
|-------------|-----------------|---------------------|
| Code/config files | Parameters, settings | Direct file inspection |
| Result files | Metrics, numbers | Direct file inspection |
| Papers/references | Citations, claims | WebSearch verification |
| External facts | Dates, statistics | WebSearch verification |

### Fact Base Format

```markdown
## Fact Base

### ✅ Verified Facts
| ID | Claim | Source | Verification |
|----|-------|--------|--------------|
| F1 | Learning rate is 0.03 | config.yaml:12 | Code inspection |
| F2 | Titans paper published 2025 | arXiv:2501.00663 | WebSearch |
| F3 | BERT has 110M parameters | Original paper | WebSearch |

### ❌ Unverified (DO NOT USE IN DOCUMENT)
| Claim | Reason |
|-------|--------|
| "15% improvement" | No result file found |
| "State-of-the-art performance" | No benchmark comparison |
```

### Fact Base Rules

1. **Every number must have a source** — no invented statistics
2. **Every citation must be WebSearch-verified** — no hallucinated papers
3. **Unverified claims are forbidden** — cannot appear in document
4. **When in doubt, don't include** — omission > hallucination

---

## Phase 1: Draft

### Process

1. **Design structure**: Outline sections with core message for each
2. **List technical terms**: Prepare "X is Y" definitions for all jargon
3. **Write with constraint**: Every factual claim must reference Fact Base

### Internal Fact Check (while writing)

```
✍️ Writing: "LTPO uses learning rate 0.03"
   → Fact check: F1 ✓ → OK to include

✍️ Writing: "This achieved 15% improvement"  
   → Fact check: NOT IN FACT BASE ❌ → DO NOT WRITE
   → Alternative: "Experiments were conducted to measure improvement" (no number)
```

### Output

- Draft document
- Technical term definitions used
- Fact Base reference log

### After Draft

```
→ Proceed to Phase 2 (Evaluate)
```

---

## Phase 2: Evaluate

### Step 1: Hallucination Check (FIRST PRIORITY)

Extract every factual claim and verify against Fact Base:

```markdown
### Claim Verification
| Location | Claim | Fact Base ID | Status |
|----------|-------|--------------|--------|
| Para 1 | "learning rate 0.03" | F1 | ✅ Verified |
| Para 2 | "15% improvement" | — | ❌ HALLUCINATION |
| Para 3 | "Titans (2025)" | F2 | ✅ Verified |
```

### Step 2: Principle Check

Check each paragraph against all 14 principles.

### Output Format

```markdown
## Evaluation (Iteration N/5)

### Fact Check Summary
- Total claims: 15
- Verified: 12
- Hallucinations: 2 ← MUST BE 0 TO PASS

### 🔴 Critical (N)
- [C1] Para 2: "15% improvement" — NOT IN FACT BASE
- [C1] Para 4: "outperforms baseline by 2x" — NOT IN FACT BASE
- [C4] Para 3: "SAE" used without definition

### 🟡 Warning (N)
- [W2] Section 2: No compare-contrast for new method
- [W4] Para 1: "significantly" is vague

### 🔵 Suggestion (N)
- [S1] Para 2→3: Add transitional phrase

### Status: CONTINUE (2 hallucinations, 1 other critical)
```

### Decision Logic

```
IF hallucinations > 0 OR critical_issues > 0:
    → Status: CONTINUE
    → Proceed to Phase 3 (Plan)
ELSE:
    → Status: COMPLETE
    → Output final document
```

---

## Phase 3: Plan

### Priority Order (STRICT)

1. **Hallucinations (C1, C2)** — fix first, blocks everything
2. **Other Critical (C3-C7)** — fix second
3. **Warnings (W1-W7)** — fix if iteration budget allows

### Fix Planning Format

For each issue:

```markdown
### Issue: [C1] Para 2 — "15% improvement" hallucination

**Cause**: Wrote number without verifying source

**Fix Options**:

Option A (Remove claim):
- Before: "이를 통해 15%의 성능 향상을 달성했다."
- After: "실험 결과 성능 향상을 확인하였다." (no specific number)

Option B (Verify and update):
- Action: Check results.json for actual metric
- If found: Add to Fact Base with source, update sentence
- If not found: Use Option A

**Selected**: Option A (no results file available)
```

### After Planning

```
→ Proceed to Phase 4 (Rewrite)
```

---

## Phase 4: Rewrite

### Process

1. Apply all planned fixes in priority order
2. Re-verify every claim against Fact Base
3. Ensure no new hallucinations introduced
4. Update Fact Base if new verified facts discovered

### After Rewrite

```
→ Return to Phase 2 (Evaluate)
   This creates the iteration loop.
```

---

## Termination Conditions

| Condition | Action |
|-----------|--------|
| `Critical == 0 AND Hallucinations == 0` | ✅ **Success** — Output final document |
| `Iteration == 5 AND Hallucinations == 0` | ⚠️ **Partial** — Output current + list remaining warnings |
| `Iteration == 5 AND Hallucinations > 0` | ❌ **Failure** — Cannot publish; list unverifiable claims |

### On Success

Output the final document and offer to address remaining Suggestions.

### On Failure

```markdown
## ❌ Cannot Publish

The following claims could not be verified and must be removed or verified externally:

| Claim | Location | Reason |
|-------|----------|--------|
| "15% improvement" | Para 2 | No source found |
| "2x faster" | Para 5 | No benchmark data |

Please provide sources for these claims or approve their removal.
```

---

## Hallucination Types Reference

| Type | Example | How to Detect |
|------|---------|---------------|
| Invented numbers | "15% improvement" | Not in Fact Base |
| False attribution | "Smith et al. showed..." | WebSearch finds no such claim |
| Fabricated details | "Published in March 2024" | Date not verifiable |
| Exaggerated claims | "Significantly outperforms" | No comparative data |
| Causal hallucination | "X caused Y" | No evidence for causation |
| Citation hallucination | "arXiv:2401.99999" | Paper doesn't exist |

---

## Progress Report Template

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ITERATIVE ACADEMIC WRITING — Progress Report
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

[Phase 0] Fact Base: 12 verified facts, 2 unverified (excluded)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[Iteration 1/5]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Phase 1: Draft ✓
Phase 2: Evaluate
  → Hallucinations: 2 | Critical: 1 | Warning: 3
  → Status: CONTINUE
  → Proceed to Phase 3

Phase 3: Plan ✓
  → Priority: Fix 2 hallucinations first
  → Proceed to Phase 4

Phase 4: Rewrite ✓
  → Removed unverified claims
  → Return to Phase 2

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[Iteration 2/5]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Phase 2: Evaluate
  → Hallucinations: 0 | Critical: 0 | Warning: 2
  → Status: COMPLETE ✅

✅ Document finalized
   Remaining: 2 warnings (optional to fix)
```
