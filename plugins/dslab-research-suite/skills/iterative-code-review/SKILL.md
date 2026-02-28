---
name: iterative-code-review
description: Iteratively improve code quality through analyze-implement-review-test loop. Use when writing new features, fixing bugs, refactoring, or preparing for production deployment. Combines principles from task planning, modular architecture, code review, and debugging. Loops until Critical/Warning issues are resolved and tests pass (max 5 iterations).
---

# Iterative Code Review

Analyze, implement, review, and test code in an iterative loop until quality criteria are met.

## Workflow

```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│  [Phase 1]        [Phase 2]        [Phase 3]                │
│  Analyze    ───→  Implement  ───→  Review                   │
│  (once)                               │                     │
│                                       ↓                     │
│                                  Issues Found?              │
│                                       │                     │
│                             No ───────┴─────── Yes          │
│                             ↓                   ↓           │
│                       [Phase 4]           [Phase 2]         │
│                       Test/Debug           Fix Issues       │
│                             │                   │           │
│                             ↓                   └──→ Review │
│                        Tests Pass?                 (LOOP)   │
│                             │                               │
│                   Yes ──────┴────── No                      │
│                   ↓                  ↓                      │
│               ✅ Complete      [Phase 4]                    │
│                                 Debug                       │
│                                   │                         │
│                                   └───→ Test                │
│                                        (LOOP)               │
└─────────────────────────────────────────────────────────────┘
```

**Termination Conditions:**
- ✅ Success: `Critical == 0 AND Warning == 0 AND Tests pass`
- ⚠️ Partial: `Iteration == 5` → output current + remaining issues
- 🛑 Blocked: Same test fails 3 times → request manual intervention

---

## Phase 1: Analyze (Run Once)

Understand the codebase context before implementing.

### Commands to Run

```bash
# Repository state
git status
git diff HEAD~3..HEAD --stat
git log --oneline -5

# Project structure
find . -name "*.py" -o -name "*.js" -o -name "*.ts" | head -20
cat requirements.txt 2>/dev/null || cat package.json 2>/dev/null
```

### Output Checklist

- [ ] Changed files and affected modules identified
- [ ] Existing patterns and conventions noted
- [ ] Dependencies and environment requirements checked
- [ ] Todo list for implementation created

### After Analyze

```
→ Proceed to Phase 2 (Implement)
```

---

## Phase 2: Implement

Apply these principles when writing or modifying code.

### Implementation Principles

| Principle | Description | Example |
|-----------|-------------|---------|
| **Minimal change** | ADD > MODIFY; touch existing code minimally | New function > modify existing |
| **Follow patterns** | Match existing codebase conventions | Same naming, same structure |
| **Config-driven** | Externalize magic numbers and settings | `config.py` > hardcoded values |
| **Error handling** | Handle edge cases and failures explicitly | try-catch, input validation |
| **Dependency check** | Verify all imports exist | Run import test |

### Pre-Implementation Checklist

Before writing code:

```
□ All required packages in requirements.txt / package.json?
□ All environment variables documented?
□ All imported modules available?
```

### After Implement

```
→ Proceed to Phase 3 (Review)
```

---

## Phase 3: Review

Evaluate code against the checklist below.

### 🔴 Critical (must fix — blocks completion)

| ID | Issue | Example |
|----|-------|---------|
| C1 | Security vulnerability | SQL injection, XSS, path traversal |
| C2 | Exposed secrets | API keys, passwords in code |
| C3 | Data loss risk | Unhandled exceptions in write operations |
| C4 | Breaking change | Modified public API without versioning |
| C5 | Unhandled error | Exception swallowed silently |
| C6 | Missing dependency | Import of uninstalled package |
| C7 | Undefined variable | Reference to non-existent variable |

### 🟡 Warning (should fix)

| ID | Issue | Example |
|----|-------|---------|
| W1 | Missing error handling | No try-catch around I/O |
| W2 | Performance issue | N+1 query, unnecessary loop |
| W3 | Code duplication | DRY violation |
| W4 | Dead code | Unused imports, unreachable code |
| W5 | Input validation | User input used without sanitization |
| W6 | Public API missing type hints | Exported function without annotations |
| W7 | Hardcoded values | Magic numbers not in config |
| W8 | Public API missing docstring | Exported function without documentation |

### 🔵 Suggestion (optional)

| ID | Issue |
|----|-------|
| S1 | Naming could be clearer |
| S2 | Internal function could use type hints |
| S3 | Add inline comments for complex logic |
| S4 | Increase test coverage |
| S5 | Simplify complex logic |

### Optional: Static Analysis

If available, run these tools for automated detection:

| Tool | Purpose | Command |
|------|---------|---------|
| mypy/pyright | Type checking | `mypy .` |
| pylint/ruff | Linting | `ruff check .` |
| bandit | Security | `bandit -r .` |
| eslint | JS/TS linting | `npx eslint .` |

### Output Format

```markdown
## Review (Iteration N/5)

### 🔴 Critical (N)
- [C1] file.py:42 — SQL injection via f-string query
- [C6] utils.py:1 — `import pandas` but pandas not in requirements.txt

### 🟡 Warning (N)
- [W2] api.py:15 — N+1 query in loop
- [W4] helpers.py:3 — Unused import `os`

### 🔵 Suggestion (N)
- [S1] utils.py:8 — Rename `x` to `user_count`

### Status: CONTINUE / READY FOR TEST
```

### Decision Logic

```
IF critical_issues > 0 OR warning_issues > 0:
    → Status: CONTINUE
    → Return to Phase 2 (fix issues, then re-review)
ELSE:
    → Status: READY FOR TEST
    → Proceed to Phase 4 (Test)
```

---

## Phase 4: Test & Debug

### Step 1: Detect Test Framework

| Indicator | Command |
|-----------|---------|
| pytest.ini, pyproject.toml, tests/ | `pytest -v` |
| package.json with test script | `npm test` |
| Cargo.toml | `cargo test` |
| go.mod, *_test.go | `go test ./...` |
| Makefile with test target | `make test` |

### Step 2: Handle No Tests

**If no test infrastructure exists:**

```markdown
⚠️ No test framework detected.

Options:
1. Create minimal test for new code
2. Run manual verification
3. Mark as "untested" and document

Selected: [User choice or auto-select based on context]
```

**Minimal test template (Python):**

```python
# test_minimal.py
def test_new_function():
    from module import new_function
    result = new_function(test_input)
    assert result == expected_output
```

### Step 3: Run Tests

```bash
# Run and capture output
pytest -v 2>&1 | tee test_output.log
```

### Step 4: Debug Process (on failure)

| Step | Action |
|------|--------|
| **Capture** | Record full error message and stack trace |
| **Reproduce** | Identify minimal reproduction steps |
| **Isolate** | Locate exact failure point in code |
| **Fix** | Apply minimal change to resolve |
| **Verify** | Re-run only the failed test |

### Debug Output Format

```markdown
### Debug (Iteration N/5)

**Failed Test**: test_user_creation
**Error**: AssertionError: expected 200, got 401
**Stack Trace**: 
  File "test_api.py", line 42
  File "api.py", line 15

**Root Cause**: Missing auth token in test setup
**Fix Applied**: Added mock auth token to test fixture

→ Re-running test...
```

### Decision Logic

```
IF tests_pass:
    → Status: COMPLETE ✅
ELSE IF same_test_failed_3_times:
    → Status: BLOCKED 🛑
    → Request manual intervention
ELSE:
    → Apply debug fix
    → Return to Test (re-run)
```

---

## Termination Conditions

| Condition | Action |
|-----------|--------|
| `Critical == 0 AND Warning == 0 AND Tests pass` | ✅ **Complete** |
| `Iteration == 5` | ⚠️ Output current state + list remaining issues |
| `Same test fails 3 times` | 🛑 Request manual intervention |
| `No tests AND critical == 0` | ⚠️ Complete with "untested" warning |

### On Completion

```markdown
## ✅ Code Review Complete

### Summary
- Iterations: 3/5
- Critical fixed: 2
- Warnings fixed: 4
- Tests: 12 passed

### Files Modified
- api.py (security fix)
- utils.py (added error handling)
- requirements.txt (added missing dependency)

### Remaining Suggestions
- [S1] Consider renaming `x` to `user_count`
```

### On Block

```markdown
## 🛑 Manual Intervention Required

**Blocked on**: test_database_connection fails consistently

**Attempts**:
1. Added connection retry logic — still fails
2. Increased timeout to 30s — still fails  
3. Checked database URL — correct

**Possible causes**:
- Database not running in test environment
- Network/firewall issue
- Test database not seeded

**Recommended action**: Check CI/CD database configuration
```

---

## Progress Report Template

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ITERATIVE CODE REVIEW — Progress Report
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

[Phase 1] Analyze ✓
  - 3 files changed
  - Constraints: Flask patterns, SQLAlchemy ORM
  - Dependencies: requirements.txt up to date

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[Iteration 1/5]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Phase 2: Implement ✓
  - Added input validation
  - Fixed query construction

Phase 3: Review
  → Critical: 1 | Warning: 2
  → Status: CONTINUE
  → Return to Phase 2

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[Iteration 2/5]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Phase 2: Fix Critical ✓
  - Fixed SQL injection vulnerability

Phase 3: Review
  → Critical: 0 | Warning: 0
  → Status: READY FOR TEST
  → Proceed to Phase 4

Phase 4: Test
  → pytest: 12 passed ✓

✅ Complete
```

---

## Quick Reference

### Loop Summary

```
Review Loop:  Phase 2 → Phase 3 → [issues?] → Phase 2 → ...
Test Loop:    Phase 4 → [pass?] → Debug → Phase 4 → ...
```

### Exit Conditions

```
✅ Complete:  Critical=0, Warning=0, Tests=Pass
⚠️ Partial:   Iteration=5 (output with issues)
🛑 Blocked:   Same test fails 3x (need human help)
```
