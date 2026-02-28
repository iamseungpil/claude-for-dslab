---
name: research-survey-visualizer
description: Survey research publications and create intuitive interactive artifacts. Use when users ask to (1) survey/analyze a researcher's publications, (2) compare multiple research methods/papers, (3) explain research architectures visually, (4) create visual summaries of academic papers. Triggers on phrases like "연구 정리", "논문 서베이", "research survey", "compare papers", "visualize research", "아티팩트로 만들어줘", "이해하기 쉽게 정리".
---

# Research Survey Visualizer

Survey research publications and create intuitive React artifacts that explain complex methods through visual architecture diagrams and comparison tables.

## Workflow Overview

### Phase 1: Research Discovery

1. **Identify target**: Researcher name, institution, or research topic
2. **Web search**: Query "[researcher name] [year] publications" or "[topic] recent papers"
3. **Gather papers**: Collect 3-7 key publications with venues, dates, and links

### Phase 2: Deep Analysis (Per Paper)

For each paper, extract:

| Component | What to Find | Example |
|-----------|--------------|---------|
| **Problem** | What limitation does this solve? | "O(n²) attention is too slow for 1M tokens" |
| **Key Discovery** | Novel insight enabling the solution | "Video tokens show Grid-pattern sparsity" |
| **Method** | Step-by-step approach (3-5 steps) | "1. Analyze patterns → 2. Permute → 3. Sparse attention" |
| **Baselines** | 3-4 prior methods to compare against | "MInference, Flash Attention, Token Compression" |
| **Differentiators** | How this beats each baseline | "Unlike X which ignores Y, we handle Z" |
| **Metrics** | Quantitative improvements | "8.3x speedup, 13% accuracy gain" |

**Critical**: For each baseline, identify its specific limitation and how the new method addresses it.

### Phase 3: Architecture Visualization

Create visual diagrams showing:
- **Data flow**: Input → Processing stages → Output
- **Key transformations**: What happens at each step
- **Before/After**: Visual comparison of old vs new approach

See `references/artifact-design.md` for component patterns.

### Phase 4: Artifact Generation

Create an interactive React artifact with:
- Tab/page navigation for multiple papers
- Architecture diagram per paper
- Comparison table: Baseline → Limitation → Our Solution
- Key metrics display

Use template in `assets/artifact-template.jsx` as starting point.

## Output Requirements

1. **Language**: Match user's language (Korean/English)
2. **Abstraction level**: Intuitive diagrams over mathematical notation
3. **Comparison focus**: Every method explained relative to baselines
4. **Interactivity**: Navigable pages, visual hierarchy

## Quick Reference

```
Survey Request → Web Search → Paper Analysis → Architecture Design → React Artifact
```

For detailed guidance:
- Survey methodology: `references/survey-workflow.md`
- Visual design patterns: `references/artifact-design.md`
- React template: `assets/artifact-template.jsx`
