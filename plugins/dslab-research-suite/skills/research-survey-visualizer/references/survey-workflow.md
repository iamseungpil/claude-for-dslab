# Survey Workflow Guide

Detailed methodology for conducting research surveys.

## Step 1: Initial Web Search

### Search Queries

```
Primary:   "[Researcher Name] [Year] publications"
Secondary: "[Researcher Name] Google Scholar"
Tertiary:  "[Researcher Name] [Institution] research"
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
- Too many → artifact becomes overwhelming

## Step 3: Deep Dive Protocol

For each selected paper, perform web search:

```
"[Paper Title] method explained"
"[Paper Title] vs [baseline]"
"[Paper Title] github"
```

### Information Extraction Template

```markdown
## [Paper Title]

### Problem Statement
- What existing limitation does this address?
- Why do current methods fail?
- What's the practical impact of this problem?

### Key Insight / Discovery
- What novel observation enables the solution?
- Why wasn't this discovered before?

### Method (3-5 steps)
1. Step 1: [Action] → [Result]
2. Step 2: [Action] → [Result]
...

### Baseline Comparison Table
| Baseline | Their Approach | Limitation | Our Solution |
|----------|---------------|------------|--------------|
| Method A | Does X | Ignores Y | Handles Y via Z |

### Quantitative Results
- Metric 1: X% improvement on [benchmark]
- Metric 2: Y× speedup on [task]
```

## Step 4: Cross-Paper Analysis

After analyzing all papers, identify:

1. **Research themes**: Group papers by topic
2. **Evolution**: How methods build on each other
3. **Collaborator patterns**: Frequent co-authors
4. **Open problems**: What's not yet solved

## Step 5: Verify Before Visualization

Checklist before creating artifact:
- [ ] Each paper has clear problem statement
- [ ] At least 3 baselines per paper with specific limitations
- [ ] Quantitative metrics collected
- [ ] Method steps are concrete (not vague)
- [ ] Architecture flow is understood

## Common Pitfalls

| Pitfall | Solution |
|---------|----------|
| Vague problem statements | Search for "motivation" or "limitations of existing" |
| Missing baselines | Check Related Work section, search "[paper] vs" |
| No architecture details | Look for method figure, GitHub code structure |
| Surface-level comparison | Find specific failure cases of baselines |
