---
name: research-survey-visualizer
description: Survey research publications and create intuitive interactive visualizations inline in chat. Use when users ask to (1) survey/analyze a researcher's publications, (2) compare multiple research methods/papers, (3) explain research architectures visually, (4) create visual summaries of academic papers. Triggers on phrases like "연구 정리", "논문 서베이", "research survey", "compare papers", "visualize research", "아티팩트로 만들어줘", "이해하기 쉽게 정리", "인터랙티브하게 설명", "논문 설명". Produces inline Visualizer widgets (SVG diagrams + HTML interactive simulations) interleaved with text explanations following a Why→What→How narrative structure. Always use this skill when asked to visually explain or survey papers — do NOT create React artifacts or .jsx files.
---

# Research Survey Visualizer

Survey research publications and create intuitive **inline interactive visualizations** using the Visualizer tool (`show_widget`). Output is NOT a file or artifact — it's a series of SVG diagrams and HTML interactive widgets woven into the conversation with text explanations.

## Workflow Overview

### Phase 1: Research Discovery

1. **Identify target**: Researcher name, institution, or specific paper(s)
2. **Web search**: Fetch paper content from arxiv HTML or search for key publications
3. **Gather papers**: Collect 3-7 key publications with venues, dates, and links

### Phase 2: Deep Analysis — Insight-First Extraction

For each paper, extract in **this exact order** (Why→What→How):

#### 1. CONTEXT — 왜 이게 문제인가?

| What to find | How to present |
|---|---|
| Existing method's **concrete failure case** | Specific scenario where it breaks |
| **Why** current approaches fail (root cause) | Cause→effect chain, not just "it's limited" |
| Intuitive analogy for non-experts | "Like trying to X without Y" |

#### 2. INSIGHT — 뭘 깨달았나?

| What to find | How to present |
|---|---|
| The **observation others missed** | "Everyone assumed X, but actually Y" |
| Why this insight naturally leads to a solution | "If the problem is X, then the fix is obviously Y" |

#### 3. METHOD — 어떻게 해결했나?

| What to find | How to present |
|---|---|
| 3-5 step pipeline from insight to implementation | Each step as a transformation |
| What each step does to the data/model | Input → transformation → output |
| How this connects back to the insight | "Because we realized X, we do Y at this step" |

#### 4. EVIDENCE — 왜 믿을 수 있나?

| What to find | How to present |
|---|---|
| 3-4 baseline methods and their specific weaknesses | "X failed because..." |
| Quantitative comparison | "X collapsed at N=1000, ours held steady" |
| The key differentiator vs each baseline | Side-by-side contrast |

**Critical**: Never describe a method without first explaining WHY it's needed. Never show results without comparison to alternatives.

### CRITICAL: Response Separation Strategy (Stability)

**Widget rendering fails when heavy tool calls (web_fetch, read_me) and multiple widgets coexist in the same response.** The client-side iframe renderer cannot handle the combined streaming load, resulting in "No result received" errors and invisible widgets.

#### Mandatory response split

```
Response 1 (Fetch & Analyze):
  - web_fetch (PDF/HTML)
  - read_me (load design guide)
  - Text: analysis summary, context, insight explanation
  - End response here. Do NOT generate widgets yet.

Response 2+ (Visualize):
  - Max 2 widgets per response
  - Text between every widget
  - If 3-5 widgets needed, split across 2-3 responses
```

#### Why this matters

Tested and confirmed: identical widget code succeeds when called in a clean response, but fails when preceded by web_fetch + read_me in the same response. The issue is client-side rendering timing, not widget complexity — complex widgets (tabs, dynamic rendering, sendPrompt) work fine in isolation.

#### Widget code compactness

Use short CSS class names and JS variable names to minimize widget_code size. This improves streaming reliability.

```
BAD:  .sim-row, .result-box, .result-num, getElementById('stress')
GOOD: .sr, .rb, .rn, getElementById('s1')
```

### Phase 3: Visualization — Inline Widget Sequence

**Before creating any widget**: Ensure `read_me` was called in a PRIOR response (not the current one). If this is the first response, call `read_me` alone with the analysis text, then generate widgets in the NEXT response.

**Output is a sequence of text + widgets in THIS order:**

```
1. [Text]              Context — 왜 이 논문/연구가 필요한가
2. [Interactive HTML]  WHY 체감 위젯 — 문제를 직접 경험 (필수)
3. [Text]              Insight 설명 — 핵심 깨달음 + 인과 체인
4. [SVG Diagram]       WHAT 다이어그램 — 논문의 핵심 구조/메커니즘
5. [Text]              Method 설명 — insight → solution 연결
6. [Interactive HTML]  HOW 시뮬레이션 — 제안 방법을 직접 조작 (필수)
7. [Text]              Evidence + 결론 — 정량 비교, 시사점
```

**If the full sequence requires 3+ widgets, split across responses:**
- Response A: widgets 1-2 (WHY + WHAT) with bridging text
- Response B: widgets 3+ (HOW + EVIDENCE) with concluding text
- Use a natural transition: "다음 위젯에서 해결 방법을 직접 조작해보세요." then continue

#### Widget Requirements

- **최소 2개 Interactive HTML 위젯 필수**: 하나는 "문제 체감용", 하나는 "해결 체감용"
- **위젯 사이에 반드시 텍스트 배치**: 위젯끼리 연속 배치 금지
- **한 응답당 최대 2개 위젯**: 3개 이상 필요하면 응답을 나눈다
- **sendPrompt()**: 모든 클릭 가능한 노드에 후속 질문 연결

#### Widget Type Decision Guide

| 논문 요소 | 위젯 타입 | 핵심 인터랙션 |
|-----------|----------|-------------|
| 문제 체감 (WHY) | **HTML interactive** (필수) | 슬라이더/토글로 기존 방법의 한계를 직접 경험 |
| 핵심 구조 (WHAT) | SVG diagram | 클릭 → sendPrompt()로 deep-dive |
| 해결 체감 (HOW) | **HTML interactive** (필수) | 파라미터 조작으로 제안 방법의 효과 확인 |
| 정량 비교 (EVIDENCE) | Chart.js 또는 SVG | 호버/필터로 baseline별 비교 |

For detailed design patterns and code examples, see `references/visualization-design.md`.

### Phase 4: Multi-Paper Surveys

When surveying multiple papers:

1. **Lead with unifying theme**: What connects these papers?
2. **Per paper**: Follow the WHY→WHAT→HOW sequence above
3. **Cross-paper synthesis**: What each paper realized differently
4. **Comparison widget**: Interactive HTML comparing approaches side-by-side
5. Use sendPrompt() buttons to let users navigate between papers

## Output Rules

1. **Language**: Match user's language (Korean/English)
2. **Narrative**: Always Why→What→How. Never method-first.
3. **Interactivity**: Minimum 2 interactive HTML widgets per paper
4. **Text placement**: Explanatory text goes in response, NOT inside widgets
5. **Concreteness**: Use analogies and concrete examples over jargon
6. **Comparison**: Every method explained relative to baselines
7. **No inline event handlers (CSP)**: NEVER use `onclick=""`, `oninput=""`, `onchange=""` or any `on*=""` HTML attributes. They are blocked by the iframe Content Security Policy. ALWAYS use `document.getElementById('id').addEventListener('event', fn)` inside a `<script>` block instead. This applies to both HTML widgets and SVG `sendPrompt()` calls — use `addEventListener('click', () => sendPrompt('...'))` on SVG nodes.

## Avoid

- Jargon without intuitive explanation
- Findings without comparison to alternatives
- Method description without motivation ("왜 이렇게 했는지" 없이 "이렇게 했다"만)
- Static-only diagrams claiming to be "interactive"
- Putting explanation text inside widget HTML (text belongs in response)
- Creating .jsx files or React artifacts (use Visualizer show_widget only)
- Information dump without narrative arc
- **Inline event handlers** (`onclick=""`, `oninput=""`, etc.) — CSP blocks them; use addEventListener

## Quick Reference

```
Response 1: Paper URL → Web Fetch → read_me → Insight-First Extraction (text only, NO widgets)
Response 2: WHY widget + WHAT diagram (max 2 widgets) + bridging text
Response 3: HOW widget + EVIDENCE (if needed) + conclusion text
```

**Golden rule**: Never mix web_fetch/read_me with widget generation in the same response.

For detailed guidance:
- Survey methodology: `references/survey-workflow.md`
- Visual design patterns: `references/visualization-design.md`
