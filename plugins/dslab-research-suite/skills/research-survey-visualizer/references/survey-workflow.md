# Survey Workflow Guide

Detailed methodology for conducting research surveys.

## Step 1: Initial Web Search

### Search Queries

```
Primary:   "[Researcher Name] [Year] publications"
Secondary: "[Researcher Name] Google Scholar"
Tertiary:  "[Researcher Name] [Institution] research"
For single paper: fetch arxiv HTML directly
```

### What to Collect

For each paper found:
- Title, venue, year
- arXiv/official link
- Co-authors (identify frequent collaborators)
- GitHub repository (if available)

## Step 2: Paper Triage

### Priority Criteria

1. **Venue quality**: Top-tier (ICML, NeurIPS, ICLR, CVPR, ACL) > Workshop > Preprint
2. **Recency**: Prefer recent work unless asked for historical survey
3. **Impact**: Check citations if available
4. **Relevance**: Match user's stated interest

### Target: 3-7 papers

- Too few → incomplete picture
- Too many → too many widgets, overwhelming

## Step 3: Deep Dive Protocol — Insight-First

For each selected paper, perform web search:

```
"[Paper Title] method explained"
"[Paper Title] vs [baseline]"
"[Paper Title] github"
```

### Information Extraction Template (Why→What→How order)

```markdown
## [Paper Title]

### 1. CONTEXT (왜 이게 문제인가?)
- Concrete failure scenario of existing methods
- Root cause analysis (cause → effect chain)
- Intuitive analogy for non-expert reader
- "Everyone assumed X, but..."

### 2. INSIGHT (뭘 깨달았나?)
- The observation others missed
- Why this insight makes the solution obvious
- "If the problem is actually X, then naturally we should Y"

### 3. METHOD (어떻게 해결했나?)
- Step 1: [Action] → [Result] (because of insight)
- Step 2: [Action] → [Result]
- ...
- Connection back to insight at each step

### 4. EVIDENCE (왜 믿을 수 있나?)
| Baseline | Why it fails | Our approach | Result |
|----------|-------------|--------------|--------|
| Method A | Ignores X   | Handles X    | +15%   |

- Concrete failure-vs-success comparison
- "X collapsed at N=1000, ours held steady"
```

## Step 4: Cross-Paper Analysis

After analyzing all papers, identify:

1. **Research themes**: Group papers by topic
2. **Evolution**: How methods build on each other
3. **Collaborator patterns**: Frequent co-authors
4. **Open problems**: What's not yet solved

## Step 5: Plan Widget Sequence

Before creating any widgets, plan the visualization sequence for each paper:

### Per-Paper Widget Checklist

- [ ] **WHY widget designed**: What parameter will the user adjust? What failure will they see?
  - Identified the key variable that reveals the problem
  - Designed the visual feedback (chart type, metric cards)
  - Written the instruction hint ("Try moving X toward Y...")
- [ ] **WHAT diagram designed**: What's the core structure to show?
  - Chosen diagram type (flowchart / structural / illustrative)
  - Identified 4-6 key nodes with sendPrompt() questions
  - Checked that text fits in boxes (chars × 8px + padding ≤ box width)
- [ ] **HOW widget designed**: What will the user operate?
  - The proposed method's key parameter as a slider/toggle
  - Visual showing the solution working
  - Comparison mode (before/after or A/B) planned
- [ ] **Narrative arc confirmed**: Context→Insight→Method→Evidence order
- [ ] **Text bridges written**: What goes between each widget

### Multi-Paper Additional Checks

- [ ] Unifying theme identified
- [ ] Research landscape overview SVG planned
- [ ] Cross-paper comparison widget dimension chosen
- [ ] sendPrompt() navigation between papers designed

## Common Pitfalls

| Pitfall | Solution |
|---------|----------|
| Vague problem statements | Search for "motivation" or "limitations of existing" |
| Missing baselines | Check Related Work section, search "[paper] vs" |
| No architecture details | Look for method figure, GitHub code structure |
| Surface-level comparison | Find specific failure cases of baselines |
| Method without motivation | Always extract CONTEXT and INSIGHT before METHOD |
| Static diagram for dynamic concept | If there's a parameter that changes behavior, use interactive HTML |
| No concrete analogy | Find a physical/everyday metaphor for the core mechanism |
