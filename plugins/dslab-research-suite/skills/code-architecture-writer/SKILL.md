---
name: code-architecture-writer
description: Analyze codebases and generate architecture/code explanation documents. Two modes - (1) `/code-architecture-writer diff <base_branch> [output.md]` for change explanation, (2) `/code-architecture-writer flow <entrypoint.py> [output.md]` for execution flow. Explains "why" each file/function exists, not just "what" it does.
version: 1.0.0
---

# Code Architecture Writer

코드베이스를 분석하여 아키텍처/코드 설명 문서를 생성하는 스킬입니다. 모든 설명은 "what"이 아닌 **"why"** 중심으로 작성됩니다.

## 사용 모드

### Mode 1: diff -- 변경사항 설명
```
/code-architecture-writer diff <base_branch> [output.md]
```
- `base_branch`: 비교 기준 브랜치 (예: `main`)
- `output.md`: 출력 파일 경로 (기본값: `CODE_CHANGES_EXPLANATION.md`)

**산출물**: 브랜치 간 변경된 파일들의 "왜 이렇게 바꿨는가" 설명 문서

### Mode 2: flow -- 실행 흐름 설명
```
/code-architecture-writer flow <entrypoint.py> [output.md]
```
- `entrypoint.py`: 진입점 파일 경로
- `output.md`: 출력 파일 경로 (기본값: `ARCHITECTURE_FLOW.md`)

**산출물**: 진입점부터 전체 실행 흐름을 추적한 아키텍처 설명 문서

---

## 워크플로우 개요

```
Phase 1: Target Analysis (대상 분석)
         │
         ├── [diff] git diff base..HEAD → 변경 파일 목록
         └── [flow] entrypoint → import/call 추적
         │
         ▼
Phase 2: Deep Reading (심층 읽기)
         │
         ├── 변경/관련 파일 전체 읽기
         ├── "왜 이 파일인가?" 분석
         ├── 핵심 코드 블록 식별
         └── 함수/클래스 관계 매핑
         │
         ▼
Phase 3: Document Generation (문서 생성)
         │
         ├── 변경 파일 요약 테이블
         ├── 파일별 상세 설명 ("why" 중심)
         ├── 실행 흐름 다이어그램 (ASCII art)
         └── 핵심 설계 결정 요약
         │
         ▼
Phase 4: Quality Check (품질 검증)
         │
         ├── 모든 변경 파일이 설명되었는가?
         ├── 각 변경에 "why" 설명이 있는가?
         ├── 코드 스니펫이 실제 코드와 일치하는가?
         └── 다이어그램이 실제 실행 흐름을 반영하는가?
```

---

## Phase 1: Target Analysis (대상 분석)

### Mode: diff

```bash
# 1. 변경 파일 목록 추출
git diff <base_branch>..HEAD --stat
git diff <base_branch>..HEAD --name-only

# 2. 총 변경량 파악
git diff <base_branch>..HEAD --shortstat

# 3. 커밋 히스토리 확인 (변경 의도 파악)
git log <base_branch>..HEAD --oneline

# 4. base 커밋 해시 기록
git rev-parse --short <base_branch>
```

**산출물**: 변경 파일 목록 + 각 파일의 변경량 (lines added/removed)

### Mode: flow

```bash
# 1. 진입점 파일 읽기
Read(entrypoint.py)

# 2. import 문 추출 → 의존 파일 목록 구성
# 3. 호출 체인 추적: main() → 어떤 함수/클래스를 호출하는가?
# 4. 각 호출 대상의 파일 위치 확인
```

**산출물**: 호출 체인 그래프 + 관련 파일 목록

---

## Phase 2: Deep Reading (심층 읽기)

### Step 2.1: 파일별 전체 읽기

```
대상 파일 목록의 각 파일에 대해:
│
├── Read tool로 파일 전체 읽기
├── 파일의 전체 구조 파악 (클래스, 함수, 상수)
└── 핵심 코드 블록 식별 (변경/호출 지점)
```

### Step 2.2: "왜 이 파일인가?" 분석

각 파일에 대해 다음 질문에 답변을 준비:

| 질문 | 설명 |
|------|------|
| **왜 이 파일을 변경/참조했는가?** | 이 파일이 시스템에서 어떤 역할을 하기 때문에 변경이 필요했는가 |
| **왜 다른 파일이 아닌가?** | 동일한 변경을 다른 위치에서 할 수 없었던 이유 |
| **왜 이 방식으로 구현했는가?** | 대안 대비 선택한 방식의 장점 |
| **다른 파일과의 관계는?** | 이 파일의 변경이 다른 파일에 어떤 영향을 미치는가 |

### Step 2.3: 함수/클래스 관계 매핑

```
호출 관계:
  FileA.func_a() → FileB.func_b() → FileC.func_c()

데이터 흐름:
  config.yaml → daemon.__init__() → daemon.get_data()

의존 관계:
  trainer.py ──depends──→ daemon.py ──depends──→ config.yaml
```

---

## Phase 3: Document Generation (문서 생성)

### Mode: diff -- 문서 구조

참고: `references/diff-explanation-template.md` 참조

```markdown
# Code Changes Explanation (vs <base_branch>)

**Base**: `<base_branch>` branch (commit `<hash>`)
**Purpose**: <변경의 핵심 목적 한 줄 요약>
**Date**: <오늘 날짜>
**Total**: <N> files, +<M> lines

---

## 변경 파일 목록

| # | 파일 | 변경량 | 핵심 역할 |
|---|------|--------|----------|
| 1 | `file.py` | +N | **핵심 역할 한 줄** |

---

## 파일 1: file.py -- 왜 이 파일인가?

**<왜 이 파일을 변경해야 했는지 한 문장으로 설명 (볼드)>**

### 변경 A: <변경 설명> (Line N-M)

```python
+코드 스니펫
```

**왜 <설계 결정>인가?** <이유 설명>

---

## 변경 간 의존 관계

```
(ASCII 다이어그램)
```

---

## 핵심 설계 결정 요약

| 질문 | 답변 |
|------|------|
| 왜 X인가? | Y이기 때문이다. |
```

### Mode: flow -- 문서 구조

참고: `references/flow-diagram-template.md` 참조

```markdown
# <프로젝트> 실행 흐름

**Purpose**: <진입점>을 실행하면 어떤 코드가 어떤 순서로 호출되는지 정리
**Date**: <오늘 날짜>

---

## 핵심 요약: 한눈에 보는 실행 흐름

```
entrypoint.py:main()
  → step1()
    → step2()
      ├── [Process A]
      └── [Process B]
```

---

## N단계: <단계 이름> (<파일명>)

**파일**: `<파일 경로>`

```python
<핵심 코드 발췌>
```

**역할**: <한 줄 요약>
**다음**: → <다음 단계>

---

## 데이터 흐름 요약

```
(ASCII 다이어그램)
```

---

## 핵심 파일 역할 정리

| 파일 | 역할 | 한줄 설명 |
|------|------|----------|

---

## 왜 <핵심 파일>을 수정했는가?

<아키텍처 관점에서 왜 이 위치가 적절한지 근거 제시>
```

---

## Phase 4: Quality Check (품질 검증)

### 검증 체크리스트

| 카테고리 | 항목 | 체크 |
|---------|------|------|
| **완전성** | 모든 변경/관련 파일이 문서에 포함되었는가? | [] |
| **Why 중심** | 각 변경/파일에 "왜" 설명이 있는가? | [] |
| **코드 정확성** | 코드 스니펫이 실제 코드와 일치하는가? | [] |
| **다이어그램** | ASCII 다이어그램이 실제 실행 흐름/의존 관계를 반영하는가? | [] |
| **설계 결정** | 핵심 설계 결정이 질문-답변 형태로 요약되었는가? | [] |
| **의존 관계** | 파일 간 의존 관계가 명확하게 표현되었는가? | [] |
| **일관성** | 변경 파일 목록 테이블의 파일 수와 상세 설명의 파일 수가 일치하는가? | [] |

### 코드 스니펫 검증 프로세스

```
문서에 포함된 모든 코드 스니펫에 대해:
│
├── [Step 1] 실제 파일에서 해당 코드 블록 읽기
│   Read tool로 해당 라인 범위 확인
│
├── [Step 2] 코드 스니펫과 실제 코드 대조
│   - 들여쓰기, 변수명, 함수명이 일치하는가?
│   - 라인 번호가 정확한가?
│
└── [Step 3] 불일치 발견 시 문서 수정
    Edit tool로 코드 스니펫 업데이트
```

### "Why" 설명 검증

각 파일 섹션에서 다음이 포함되어 있는지 확인:

1. **파일 수준 Why**: "왜 이 파일인가?" (볼드 한 문장)
2. **변경 수준 Why**: 각 변경 블록마다 "왜 X인가?" 설명
3. **설계 결정 Why**: 대안 대비 선택한 방식의 근거

---

## 작성 원칙

### 1. "Why" 중심 설명 (가장 중요)

모든 설명의 핵심은 **"왜 이렇게 했는가"** 이다.

```
(O) 올바른 예시:
  **왜 daemon.py인가?** `get_train_data_batch()`가 trace -> tensor 변환의
  유일한 지점이기 때문이다. 이 함수에서 rollout의 각 turn을 검증하고,
  비정상 turn을 제거하면 해당 turn이 GRPO gradient에 포함되지 않는다.

(X) 잘못된 예시:
  daemon.py에 필터링 로직을 추가했다.
```

### 2. 코드 스니펫은 실제 코드에서 발췌

코드 스니펫을 작성할 때 반드시 Read tool로 실제 파일을 읽고 복사한다. 기억에 의존하여 코드를 작성하지 않는다.

```
(O) 올바른 프로세스:
  Read(file_path) → 해당 라인 복사 → 문서에 삽입

(X) 잘못된 프로세스:
  파일 내용을 기억에서 재구성하여 작성
```

### 3. 변경량의 정확한 기재

`git diff --stat` 결과를 직접 사용한다.

```
(O) +160 lines (git diff 결과 기반)
(X) 약 150줄 추가 (추정)
```

### 4. 의존 관계 ASCII 다이어그램

파일 간 의존 관계를 ASCII art로 표현한다. 화살표 방향은 "의존한다" 또는 "호출한다" 방향.

```
config.yaml (파라미터 정의)
     |
     v
daemon.py (필터링 구현)  <---- trainer.py (호출)
     |
     v
train_calc_agent.py (CLI -> config 주입)
```

### 5. 설계 결정 요약 테이블

문서 말미에 핵심 설계 결정을 질문-답변 테이블로 정리한다.

```markdown
| 질문 | 답변 |
|------|------|
| 왜 daemon.py인가? | trace -> tensor 변환의 유일한 지점. gradient 포함 직전에 제거 가능. |
| 왜 chat template인가? | 모델 독립적 토큰 감지. 하드코딩 대비 이식성 향상. |
```

### 6. 한국어 사용 원칙

- 설명 본문은 한국어로 작성
- 코드, 변수명, 파일명은 원문 그대로 유지
- 기술 용어는 영문 원어 사용 (번역하지 않음)
  - (O) "gradient", "tensor", "rollout"
  - (X) "기울기", "텐서", "롤아웃"

---

## 사용 예시

### 예시 1: diff 모드

```
사용자: /code-architecture-writer diff main

Claude:
[Phase 1] git diff main..HEAD 분석...
  - 변경 파일 6개 확인
  - 총 +459 lines

[Phase 2] 파일별 심층 읽기...
  - daemon.py: 핵심 필터링 로직 (+160)
  - config.yaml: 파라미터 추가 (+8)
  - trainer.py: 버그 수정 (+1)
  - calc_agent.py: 대화 로깅 (+126)
  - train_calc_agent.py: CLI 옵션 (+71)
  - train_sql_agent.py: CLI 옵션 + config 튜닝 (+98)

[Phase 3] 문서 생성...
  - 파일별 "왜" 설명 작성
  - 의존 관계 다이어그램 작성
  - 설계 결정 요약 테이블 작성

[Phase 4] 품질 검증...
  - 6/6 파일 설명 완료
  - 코드 스니펫 검증 완료

CODE_CHANGES_EXPLANATION.md 저장 완료
```

### 예시 2: flow 모드

```
사용자: /code-architecture-writer flow examples/calc_x/train_calc_agent.py

Claude:
[Phase 1] 진입점 분석...
  - train_calc_agent.py:main() 확인
  - import/call 추적 시작

[Phase 2] 호출 체인 추적...
  - main() -> train() -> agl.VERL(config) -> agl.Trainer(...)
  - trainer.fit() -> strategy.execute()
  - 10개 핵심 파일 식별

[Phase 3] 문서 생성...
  - 10단계 실행 흐름 작성
  - 데이터 흐름 다이어그램 작성
  - 핵심 파일 역할 정리 테이블 작성

[Phase 4] 품질 검증...
  - 모든 단계의 코드 스니펫 검증 완료
  - 다이어그램과 실제 흐름 일치 확인

ARCHITECTURE_FLOW.md 저장 완료
```

---

## 주의사항

1. **코드 hallucination 방지**: 모든 코드 스니펫은 반드시 Read tool로 실제 파일을 읽고 발췌한다. 기억에서 재구성하지 않는다.
2. **변경량 정확성**: `git diff --stat` 결과를 직접 사용한다. 추정하지 않는다.
3. **커밋 해시 정확성**: `git rev-parse --short` 결과를 사용한다.
4. **라인 번호 정확성**: Read tool로 읽은 파일의 실제 라인 번호를 사용한다.
5. **"왜" 누락 금지**: 모든 파일과 변경 블록에 "왜" 설명이 반드시 포함되어야 한다.
6. **파일 누락 금지**: diff 모드에서 변경된 모든 파일이 설명되어야 한다. flow 모드에서 호출 체인의 모든 핵심 파일이 포함되어야 한다.
