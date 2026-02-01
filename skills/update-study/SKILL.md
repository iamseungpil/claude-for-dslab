---
name: update-study
description: Update an experiment study document with verified results, interpretations, hypotheses, and next experiment plans. Reads ML experiment logs, uses experiment-interpreter for analysis and experiment-verifier for fact-checking in an iterative loop. Ensures zero hallucination through log-level cross-checking. Usage examples - `/update-study logs/experiment.log study.md` or `/update-study "logs/exp1.log logs/exp2.log" results/ablation_study.md`
---

# Update Study - Iterative Experiment Analysis Skill

실험 로그를 분석하여 study 문서를 결과/해석/가설/다음 실험으로 업데이트하는 스킬입니다.
experiment-interpreter와 experiment-verifier 에이전트를 반복 호출하여 hallucination 0건을 보장합니다.

## 사용법

```
/update-study <log_path(s)> <study_md_path>
```

- `log_path(s)`: 실험 로그 파일 경로 (공백으로 구분하여 여러 개 가능)
- `study_md_path`: 업데이트할 study markdown 파일 경로

## Arguments 파싱

`$ARGUMENTS`에서 마지막 인자가 `.md` 파일이면 study 파일, 나머지는 로그 파일로 파싱합니다.

```
예시:
  /update-study logs/exp1.log results/study.md
  → log_files: ["logs/exp1.log"]
  → study_file: "results/study.md"

  /update-study logs/exp1.log logs/exp2.log memgen_ablation_study.md
  → log_files: ["logs/exp1.log", "logs/exp2.log"]
  → study_file: "memgen_ablation_study.md"
```

---

## 워크플로우

```
┌───────────────────────────────────────────────────────────────┐
│                     /update-study                              │
├───────────────────────────────────────────────────────────────┤
│                                                               │
│  Phase 1: 사전 준비                                            │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │  • 로그 파일 존재 확인                                    │  │
│  │  • study.md 파일 읽기 (기존 내용 보존)                    │  │
│  │  • 로그에서 실험 config 식별                              │  │
│  └──────────────────────────┬──────────────────────────────┘  │
│                              │                                 │
│                              ▼                                 │
│  Phase 2: 해석 (experiment-interpreter 에이전트)               │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │  • 로그 파일 전체 읽기                                    │  │
│  │  • 수치 추출 + source citation                           │  │
│  │  • 기존 study.md 결과와 비교                              │  │
│  │  • 해석 + 가설 + 다음 실험 생성                           │  │
│  │  → study.md 업데이트 초안 반환                            │  │
│  └──────────────────────────┬──────────────────────────────┘  │
│                              │                                 │
│                              ▼                                 │
│  Phase 3: study.md에 초안 작성                                 │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │  • 기존 내용 끝에 새 섹션 추가 (append)                   │  │
│  │  • 이전 결과 절대 수정 안 함                              │  │
│  └──────────────────────────┬──────────────────────────────┘  │
│                              │                                 │
│                              ▼                                 │
│  Phase 4: 검증 (experiment-verifier 에이전트)                  │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │  • 새로 추가된 섹션의 모든 수치 → 로그 대조               │  │
│  │  • 해석의 논리적 타당성 검증                              │  │
│  │  • 가설 falsifiability 검증                              │  │
│  │  • 이전 결과 변경 여부 확인                               │  │
│  │  → PASS/FAIL + feedback 반환                             │  │
│  └──────────────────────────┬──────────────────────────────┘  │
│                              │                                 │
│                    ┌─────────┴─────────┐                      │
│                    │   PASS?           │                      │
│                    └─────────┬─────────┘                      │
│                     Yes      │      No                        │
│                      │       │       │                        │
│                      ▼       │       ▼                        │
│               ┌──────────┐   │  ┌──────────────────────┐     │
│               │ 완료!    │   │  │ Phase 2로 복귀       │     │
│               │ 최종 저장 │   │  │ (피드백 전달,        │     │
│               └──────────┘   │  │  최대 3회 반복)       │     │
│                              │  └──────────────────────┘     │
│                              │                                │
└──────────────────────────────┴────────────────────────────────┘
```

---

## Phase 1: 사전 준비

### Step 1.1: 파일 확인

```
1. 로그 파일 존재 확인
   - 각 log_path에 대해 파일 존재 여부 확인
   - 존재하지 않으면 에러 메시지 출력 후 중단

2. study.md 파일 확인
   - 파일이 존재하면 Read tool로 전체 내용 읽기
   - 파일이 없으면 새로 생성할 것임을 안내

3. 로그 파일 요약 정보 추출 (빠른 스캔)
   - 실험 config 파일 경로
   - 실험 모드 (train/evaluate)
   - 최종 metric 라인 위치
```

### Step 1.2: 기존 study.md 분석

```
기존 study.md에서 확인할 사항:
- 이미 기록된 실험 목록
- 비교 가능한 baseline 결과
- 미해결 가설 목록
- 계획된 실험 목록 (이번 실험이 기존 계획에 해당하는지)
```

---

## Phase 2: 해석 (experiment-interpreter 호출)

### Task tool 호출

```
Task tool 사용:
- subagent_type: "experiment-interpreter"  (또는 해당 agent가 없으면 "general-purpose")
- prompt:

  "다음 실험 로그를 분석하고 study.md 업데이트 초안을 생성해주세요.

  ## 로그 파일
  {각 로그 파일의 전체 경로}

  ## 기존 study.md 내용 (비교용)
  {기존 study.md의 결과 요약 테이블}

  ## 이전 검증 피드백 (있는 경우)
  {verifier의 feedback_summary - 첫 iteration에는 없음}

  ## 요구사항
  1. 로그에서 모든 수치를 추출하고 (source: filepath:L행번호) 형식으로 출처 표기
  2. 기존 결과와 비교 테이블 생성
  3. 데이터에 기반한 해석 작성
  4. 각 가설은 falsifiable + prediction + falsification 포함
  5. 다음 실험은 구체적 config 변경 포함
  6. 출력은 study.md에 바로 append할 수 있는 markdown 형식

  ## 출력 형식
  아래 템플릿을 정확히 따라주세요:

  ### Experiment: {name} ({YYYY-MM-DD})
  #### Configuration
  | Parameter | Value |
  |-----------|-------|
  ...
  #### Results
  | Metric | Value | Source |
  |--------|-------|--------|
  ...
  #### Comparison with Prior Results
  ...
  #### Interpretation
  ...
  #### Hypotheses
  ...
  #### Next Experiments
  ..."
```

### 피드백 반영 (2회차 이상)

Verifier의 feedback이 있는 경우, interpreter에게 전달:

```
"이전 버전에서 다음 문제가 발견되었습니다. 모든 항목을 수정해주세요:

{feedback_summary 목록}

수정 사항:
1. [피드백 1에 대한 수정 방향]
2. [피드백 2에 대한 수정 방향]
..."
```

---

## Phase 3: study.md 업데이트

### 추가 규칙

1. **Append Only**: 기존 내용 뒤에 새 섹션 추가. 기존 내용 수정 금지.
2. **구분선**: 새 실험 전에 `---` 구분선 삽입
3. **날짜 표기**: 실험 실행 날짜 (로그 타임스탬프 기반)
4. **일관된 포맷**: 아래 템플릿을 정확히 준수

### study.md 업데이트 템플릿

```markdown
---

### Experiment: {experiment_name} ({YYYY-MM-DD})

#### Configuration

| Parameter | Value |
|-----------|-------|
| Config | `{yaml_path}` |
| Mode | {mode_description} |
| Compressor | {compressor_type} |
| Key Params | {relevant_params} |
| Training | {epochs, lr, batch_size} |

#### Results

| Metric | Value | Source |
|--------|-------|--------|
| Accuracy | {X.XX%} | `{log_file}:L{line}` |
| Train Loss (final) | {X.XXXX} | `{log_file}:L{line}` |
| Grad Norm (final) | {X.XX} | `{log_file}:L{line}` |
| Total Cycles | {N} | `{log_file}:L{line}` |

#### Comparison with Prior Results

| Experiment | Accuracy | Δ |
|-----------|----------|---|
| {baseline_1} | {X.XX%} | {+/-X.XX%p} |
| {baseline_2} | {X.XX%} | {+/-X.XX%p} |

#### Interpretation

{2-3 paragraphs of data-grounded interpretation}
{Compare with expectations from prior hypotheses}
{Acknowledge limitations and alternative explanations}

#### Hypotheses

**H{N}: {One-sentence falsifiable claim}**
- Based on: {specific results}
- Mechanism: {proposed explanation}
- Prediction: {testable prediction}
- Falsification: {what would disprove this}

#### Next Experiments

**E{N}: {Experiment name}**
- Tests: H{N}
- Config: `{yaml changes}`
- Expected: {predicted outcome}
- Priority: {High/Medium/Low}
```

---

## Phase 4: 검증 (experiment-verifier 호출)

### Task tool 호출

```
Task tool 사용:
- subagent_type: "experiment-verifier"  (또는 해당 agent가 없으면 "general-purpose")
- prompt:

  "다음 study.md 업데이트 내용을 검증해주세요.

  ## 검증 대상 (새로 추가된 섹션)
  {Phase 3에서 추가한 내용}

  ## 원본 로그 파일 경로
  {각 로그 파일의 전체 경로}

  ## 기존 study.md (변경 여부 확인용)
  {기존 study.md 내용}

  ## 검증 요구사항
  1. 모든 수치를 원본 로그와 대조 (파일:라인 직접 확인)
  2. 해석의 논리적 타당성 검증
  3. 모든 가설의 falsifiability 확인
  4. 다음 실험의 실행 가능성 확인
  5. 기존 결과 변경 여부 확인

  ## 출력
  JSON 형식의 검증 보고서를 반환해주세요."
```

### 결과 처리

```python
if verdict == "PASS":
    # study.md 최종 저장 확정
    # 사용자에게 결과 요약 보고
elif iteration < 3:
    # feedback_summary를 Phase 2로 전달
    # interpreter에게 수정 요청
else:
    # 최대 반복 도달
    # 현재 최선 버전 저장
    # 미해결 이슈 사용자에게 보고
```

---

## 반복 제어

```
최대 반복: 3회

Iteration 1: interpreter → write → verifier
  → PASS: 완료
  → FAIL: feedback 수집

Iteration 2: interpreter(+feedback) → rewrite → verifier
  → PASS: 완료
  → FAIL: feedback 수집

Iteration 3: interpreter(+feedback) → rewrite → verifier
  → PASS: 완료
  → FAIL: 현재 버전 저장 + 미해결 이슈 보고
```

---

## 진행 상황 보고

실행 중 사용자에게 상태를 보고합니다:

```
[Phase 1] 사전 준비...
  ✓ 로그 파일 확인: {N}개
  ✓ study.md 읽기 완료 (기존 실험: {M}개)

[Phase 2] 해석 생성 (experiment-interpreter)...
  ✓ 수치 추출: {N}개 메트릭
  ✓ 비교 테이블 생성
  ✓ 가설 {N}개 생성

[Phase 3] study.md 업데이트...
  ✓ 새 섹션 추가 완료

[Phase 4] 검증 (experiment-verifier)...
  → Numerical: {verified}/{total}
  → Logic: {sound}/{total}
  → Hypotheses: {valid}/{total}
  → Verdict: PASS/FAIL

[Iteration 2] 피드백 반영...
  ✓ {N}개 이슈 수정
  → 재검증: PASS

✅ 완료! study.md 업데이트됨
  - 새 실험: {experiment_name}
  - 정확도: {X.XX%}
  - 가설: {N}개
  - 다음 실험: {N}개
```

---

## 주의사항

1. **로그 파일이 ground truth**: 로그에 없는 수치는 사용 불가
2. **Append Only**: 이전 결과를 절대 수정하지 않음
3. **매 수치에 출처**: `(source: filepath:L행번호)` 필수
4. **가설은 falsifiable**: 검증 불가능한 가설은 삭제
5. **최대 3회 반복**: 무한 루프 방지
6. **사용자 보고**: 각 Phase 완료 시 진행 상황 알림
7. **기존 가설 연결**: 이번 실험이 이전 가설을 검증하는 경우, 해당 가설의 검증 결과를 명시
