# Research-Debug Skill

연구 기반 디버깅 워크플로우 - 웹 연구와 코드 분석을 병렬로 수행하여 복잡한 ML 문제를 해결합니다.

## 개요

이 스킬은 복잡한 ML 학습 문제나 architecture-level 버그를 해결하기 위한 통합 워크플로우입니다. 웹 연구, 코드 분석, 반복적 수정을 병렬로 진행하여 근본 원인을 찾고 해결합니다.

## 주요 기능

- **병렬 실행**: WebSearch + Task-planner-analyzer 동시 진행
- **Cross-reference**: 문헌 증거 ↔ 코드 증거 매칭
- **Root Cause Analysis**: CRITICAL → HIGH → MEDIUM 우선순위화
- **Iterative Fix**: Fix → Review → Verify 반복
- **자동 문서화**: 7가지 유형의 분석 문서 생성

## 사용 시점

### ✅ 적합한 경우
- Training collapse/divergence
- Gibberish generation
- Architecture-level bugs
- Performance anomalies (loss spike, reward collapse)
- 연구 논문에서 다룬 것 같은 문제

### ❌ 부적합한 경우
- 단순 syntax error, typo
- 명확한 요구사항 ("Add feature X")
- 완전히 새로운 문제 (문헌 없음)

## 사용 예시

### Slash Command
```bash
/research-debug
```

### 자연어
```
"Use research-debug skill to analyze this training collapse"
"GRPO training collapsed to gibberish. Apply research-debug workflow."
```

## 워크플로우

### Phase 1: Evidence Gathering (병렬)
1. WebSearch로 비슷한 사례 검색
2. Task-planner-analyzer로 코드 분석
3. 안전한 수정사항 먼저 적용 (optional)

### Phase 2: Root Cause Triangulation
1. 문헌 증거와 코드 증거 교차 검증
2. CRITICAL/HIGH/MEDIUM 우선순위화
3. 위험도 평가

### Phase 3: Iterative Fix-and-Verify
1. Modular-code-architect로 수정 적용
2. Code-reviewer로 검증
3. 테스트 실행
4. 메트릭 모니터링
5. 문제 재발 시 Phase 1로 복귀

### Phase 4: Documentation
- Root cause 분석 문서
- 수정사항 상세 문서
- 워크플로우 레시피
- MEMORY.md 업데이트

## 실제 사례: GRPO Collapse

### 문제
- Step 0-10: 100% 정확도
- Step 20: 50% → gibberish 시작
- Step 30+: 0% → OOM crash

### Research-Debug 적용 결과
1. **WebSearch**: 5개 논문에서 GRPO collapse 패턴 발견
2. **Code Analysis**: 5가지 root cause 식별
3. **Cross-reference**: CRITICAL 3개, HIGH 2개 우선순위화
4. **Fixes Applied**: 4개 critical fix 적용
   - Advantage-aware KL gating
   - Length-normalized log-probs
   - Reduced steps_per_task (20→3)
   - Increased n_tasks_per_batch (2→4)
5. **Documentation**: 7개 문서 자동 생성
6. **Result**: 100+ steps 안정적 학습 달성

## 생성되는 문서

1. `{problem}_root_cause_analysis.md` - 기술적 상세 분석
2. `{problem}_FIX_SUMMARY.md` - 한글 요약 + 실행 가이드
3. `RESEARCH_WORKFLOW_SKILL_RECIPE.md` - 재사용 가능 워크플로우
4. `FIXES_APPLIED_SUMMARY.md` - 적용된 수정사항 상세
5. Task-planner 분석 보고서
6. `FINAL_STATUS.md` - 최종 상태 요약
7. MEMORY.md 업데이트

## 참고 자료

### GRPO Collapse 사례 (2024-2025)
- [DAPO - ByteDance](https://arxiv.org/pdf/2503.14476) - Token-level importance weight fails
- [GSPO](https://arxiv.org/pdf/2507.18071) - Catastrophic model collapse
- [Training-Free GRPO](https://openreview.net/forum?id=tyUnYbE7Gi) - Entropy collapse
- [GRPO Illustrated](https://cameronrwolfe.substack.com/p/grpo) - Conflicting gradients

## 관련 Skills

- `iterative-code-review`: 수정 후 품질 검증
- `code-reviewer`: 코드 리뷰 단독 실행
- `debugger`: 테스트 실패 시 분석
- `task-planner-analyzer`: 계획 수립 단독 실행

## 작성자

Created: 2026-02-16
Based on: GRPO training collapse debugging session
Agents used: WebSearch, Task-planner-analyzer, Modular-code-architect, Code-reviewer

## License

MIT License
