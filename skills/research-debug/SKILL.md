---
name: research-debug
description: Research-driven debugging workflow that combines web research for similar cases, deep code analysis with task-planner-analyzer, and iterative fixes with modular-code-architect and code-reviewer. Use when encountering training collapse, gibberish generation, or architecture-level bugs where the problem may be documented in research literature. Parallel execution of research and fixes for efficiency.
---

# Research-Driven Debugging (research-debug)

복잡한 ML 학습 문제나 architecture-level 버그를 해결하는 통합 워크플로우입니다. 웹 연구, 코드 분석, 반복적 수정을 병렬로 진행하여 근본 원인을 찾고 해결합니다.

## 🎯 사용 시점

### ✅ Ideal Use Cases
- **Training collapse/divergence**: 학습이 초기에는 잘 되다가 갑자기 붕괴
- **Gibberish generation**: 모델이 무의미한 출력 생성
- **Known research problem**: 문제가 논문/블로그에서 논의된 적이 있을 것 같은 경우
- **Architecture-level bugs**: 단순 구현 버그가 아닌 설계 결함이 의심될 때
- **Performance anomalies**: 예상과 다른 성능 패턴 (loss spike, reward collapse 등)

### ❌ Not Suitable For
- **Simple bugs**: Syntax error, typo 등은 직접 수정
- **Well-defined requirements**: "Add feature X" 같은 명확한 요구사항은 직접 구현
- **No literature**: 완전히 새로운 문제는 research 단계가 비효율적

## 📋 Workflow Phases

### Phase 1: Evidence Gathering (병렬 실행)

```bash
# 동시에 3가지 작업 시작:
# 1. Web research for similar cases
# 2. Deep code analysis with task-planner-analyzer
# 3. Start safe fixes (config changes, monitoring)
```

#### Step 1.1: Web Research
```python
WebSearch(
    query="[problem description] [domain] [year]"
)
# Example: "GRPO policy gradient collapse vocabulary 2024 2025"
```

**찾을 것:**
- Documented failure modes (문서화된 실패 패턴)
- Fundamental design flaws (근본적 설계 결함)
- Known workarounds (알려진 해결 방법)
- Recent papers addressing the issue (최신 연구)

#### Step 1.2: Code Analysis (Task-Planner-Analyzer)
```python
Task(
    subagent_type="task-planner-analyzer",
    prompt=f"""
Analyze {problem_description} in this codebase.

**Context from web research:**
{web_search_findings}

**Files to examine:**
{list_of_relevant_files}

**Your tasks:**
1. Examine codebase structure
2. Identify design flaws matching literature
3. Check for known anti-patterns
4. Create prioritized TODO list with:
   - File paths and line numbers
   - Root causes vs symptoms
   - Risk assessment
   - Dependencies and constraints
    """
)
```

#### Step 1.3: Start Safe Fixes (Optional)
```bash
# If you already know some safe fixes (e.g., config changes), start them
# while analysis is running
python scripts/train.py --config fixed_config.yaml > logs/new_run.log 2>&1 &
```

### Phase 2: Root Cause Triangulation

#### Cross-Reference Literature ↔ Code
Create a mapping table:

| Literature Finding | Code Location | Match? | Impact | Priority |
|--------------------|---------------|--------|--------|----------|
| Token-level issue  | line 316      | ✅ YES  | HIGH   | 1        |
| Entropy collapse   | line 888      | ✅ YES  | CRITICAL | 1      |
| Conflicting grads  | multiple      | ✅ YES  | MEDIUM | 2        |

#### Prioritize by Impact
1. **CRITICAL**: Collapse trigger (direct cause of observed failure)
2. **HIGH**: Fundamental flaw (will cause problems at scale)
3. **MEDIUM**: Optimization (improves stability but not essential)
4. **LOW**: Cosmetic (code quality, not behavior)

### Phase 3: Iterative Fix-and-Verify

#### Fix Loop
```
FOR each priority (CRITICAL → HIGH → MEDIUM):
    1. Modular-Code-Architect: Apply fix
    2. Code-Reviewer: Verify no side effects
    3. Run tests (if applicable)
    4. Monitor metrics for early warnings
    5. If problem recurs → back to Task-Planner
```

#### Apply Fixes with Modular-Code-Architect
```python
Task(
    subagent_type="modular-code-architect",
    prompt=f"""
Implement fix for {root_cause} based on this analysis:
{analysis_from_phase2}

**Constraints:**
{list_of_constraints}

**Verification criteria:**
{how_to_verify_fix_worked}

Follow modular design: minimal changes, plug-and-play.
    """
)
```

#### Verify with Code-Reviewer
```python
Task(
    subagent_type="code-reviewer",
    prompt="""
Review recent changes for:
1. Critical issues (logic errors, side effects)
2. Consistency with architecture constraints
3. Whether the fix actually addresses the root cause

Use ultrathink level.
    """
)
```

#### Verification Criteria
- [ ] No collapse for 100+ steps (or 10x previous collapse point)
- [ ] Metrics stay within healthy ranges
- [ ] No new issues introduced (regression tests pass)
- [ ] Edge cases handled

### Phase 4: Documentation

#### Create Analysis Document
```markdown
# File: logs/{problem}_root_cause_analysis.md

## Problem Summary
[What happened]

## Root Causes (Ranked)
1. **RC1**: [Description]
   - Evidence: [Literature + Code]
   - Fix: [What was applied]
   - Verification: [How we know it worked]

## Fixes Applied
[Detailed changelog]

## Verification Results
[Metrics before/after]

## Lessons Learned
[What to watch for next time]
```

#### Update Project Memory
Add to MEMORY.md or similar:
- New failure modes discovered
- Effective fixes
- Ineffective approaches (to avoid repeating)
- Monitoring metrics to add

## 🔍 Monitoring & Debugging

### Key Metrics to Watch
```python
# For ML training issues:
metrics_to_monitor = [
    "loss",              # Should decrease steadily
    "reward",            # Should be stable or improve
    "entropy",           # High = gibberish, Low = mode collapse
    "gradient_norm",     # Should be bounded
    "v_norm",            # For LoRA: should not hit clamp boundary
    "kl_loss",           # For RL: should be non-zero when active
]
```

### Early Warning Signs
```python
# Add to training code:
if entropy > 0.9 * log(vocab_size):
    logger.warning("Entropy collapse imminent - gibberish likely")

if all_advantages_zero and mean_reward > 0.5:
    logger.warning("Perfect accuracy but zero variance - KL-only training")

if v_norm >= max_norm * 0.95:
    logger.warning("V-vector at clamp boundary - may be fighting constraint")
```

## 📚 Example: GRPO Collapse

### Phase 1: Evidence Gathering
**WebSearch**: Found 5 papers documenting GRPO instability
- Token-level importance weight fails ([DAPO](https://arxiv.org/pdf/2503.14476))
- Catastrophic model collapse ([GSPO](https://arxiv.org/pdf/2507.18071))
- Entropy collapse & gibberish ([OpenReview](https://openreview.net/forum?id=tyUnYbE7Gi))

**Task-Planner**: Identified 5 root causes in code
- KL-only collapse trigger (CRITICAL)
- Token-level mismatch (HIGH)
- Task overfitting (HIGH)

### Phase 2: Triangulation
| Finding | Both Sources? | Priority |
|---------|--------------|----------|
| KL-only steps | ✅ Yes | CRITICAL |
| Token-level | ✅ Yes | HIGH |
| Task overfit | Code only | HIGH |

### Phase 3: Fix & Verify
1. **Fix 1**: Advantage-aware KL gating
   - Applied, verified, no collapse at step 20
2. **Fix 2**: Length-normalized log-probs
   - Importance ratios stable [0.5, 2.0]
3. **Fix 3**: Reduce steps_per_task 20→3
   - New tasks every 3 steps, stable 200+ steps

### Phase 4: Documentation
- ✅ Root cause analysis written
- ✅ MEMORY.md updated
- ✅ Workflow recipe created

## ⚠️ Common Pitfalls

### 1. Fixing Symptoms Instead of Root Causes
❌ Bad: "Gibberish appeared, let's increase temperature"
✅ Good: "Gibberish = entropy collapse. What causes that? KL-only signal."

### 2. Serial Execution (Wasting Time)
❌ Bad: WebSearch → wait → Analyze → wait → Fix → wait
✅ Good: WebSearch || Analyze || Start Safe Fixes → Integrate

### 3. Ignoring Literature
❌ Bad: "This is unique, no point searching"
✅ Good: "Let me check if anyone has seen this before"

### 4. Not Documenting Failures
❌ Bad: "That didn't work, let's try something else"
✅ Good: "Failed BECAUSE X, documented for future reference"

## 🚀 Quick Start Template

```bash
# 1. Start parallel evidence gathering
WebSearch("problem_description 2024 2025")
Task(subagent_type="task-planner-analyzer", prompt="Analyze {problem}...")

# 2. Start monitoring while waiting
tail -f logs/training.log &

# 3. Apply fixes iteratively
Task(subagent_type="modular-code-architect", prompt="Fix {root_cause}...")
Task(subagent_type="code-reviewer", prompt="Review changes...")

# 4. Document everything
Write("logs/root_cause_analysis.md", content="...")
Edit("MEMORY.md", add="New learnings...")
```

## 🎓 Success Criteria

### Process Metrics
- **Time to root cause**: < 2 hours (with parallel execution)
- **Fix iterations**: < 3 (if root cause correct)
- **Regression rate**: < 10% (good code review)

### Outcome Metrics
- **Problem resolved**: Yes/No
- **Stability duration**: Steps until next issue
- **Knowledge captured**: Documentation complete

## 📖 Related Skills

- **iterative-code-review**: Use after fixes applied for quality verification
- **code-reviewer**: Standalone code quality checks
- **debugger**: When tests fail during verification phase
- **task-planner-analyzer**: Can be used standalone for planning

---

**Remember**: This is a flexible workflow, not a rigid process. Adapt to your specific problem while maintaining the core principles: evidence-based, parallel execution, root-cause focused, and well-documented.
