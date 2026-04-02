# diff 모드 출력 템플릿

이 문서는 `/code-architecture-writer diff` 모드의 출력 형식을 정의합니다. 실제 생성 시 이 템플릿의 구조를 따르되, 내용은 분석 결과로 채웁니다.

---

## 템플릿 구조

```markdown
# Code Changes Explanation (vs {base_branch} branch)

**Base**: `{base_branch}` branch (commit `{commit_hash}`)
**Purpose**: {변경의 핵심 목적을 한 줄로 요약}
**Date**: {YYYY-MM-DD}
**Total**: {N} files, +{M} lines

---

## 변경 파일 목록

| # | 파일 | 변경량 | 핵심 역할 |
|---|------|--------|----------|
| 1 | `{파일경로}` | +{N} | **{핵심 역할 한 줄 설명}** |
| 2 | `{파일경로}` | +{N} | {역할 설명} |
| ... | ... | ... | ... |

---

## 파일 1: {파일명} -- 왜 이 파일인가?

**{왜 이 파일을 변경해야 했는지 한 문장으로 설명}**
{선택: 부연 설명이 필요하면 1-2문장 추가}

### 변경 A: {변경 설명} (Line {N}-{M})

```{언어}
+{실제 코드에서 발췌한 스니펫}
```

**왜 {설계 결정 키워드}인가?** {이유를 구체적으로 설명. 대안이 있었다면 왜 이 방식을 선택했는지.}

---

### 변경 B: {변경 설명} (Line {N}-{M})

```{언어}
+{실제 코드에서 발췌한 스니펫}
```

**왜 {설계 결정 키워드}인가?** {이유 설명}

{필요 시 추가 컨텍스트:}
- 반환값 해석 테이블
- 조건 분기 설명
- 성능/안전성 고려사항

---

## 파일 2: {파일명} -- 왜 이 파일인가?

(위와 동일한 구조 반복)

---

## 변경 간 의존 관계

```
{config 파일} (파라미터 정의)
     |
     v
{핵심 파일} (주요 로직 구현)  <---- {호출 파일} (호출)
     |
     v
{진입점 파일} (CLI -> config 주입)
     |
     +-- {관련 파일 A} (기능 A)
     |
     +-- {관련 파일 B} (기능 B)
```

---

## 핵심 설계 결정 요약

| 질문 | 답변 |
|------|------|
| 왜 {파일명}인가? | {한 문장 답변} |
| 왜 {기술 선택}인가? | {한 문장 답변} |
| 왜 {임계값/설정값}인가? | {한 문장 답변 + 근거} |
| 왜 {구조적 결정}인가? | {한 문장 답변} |
```

---

## 작성 규칙

### 파일 섹션 제목

형식: `## 파일 N: {파일명} -- 왜 이 파일인가?`

파일 번호는 변경 파일 목록 테이블의 번호와 일치해야 한다.

### 볼드 "왜" 문장

각 파일 섹션의 첫 줄은 반드시 **볼드**로 "왜 이 파일을 변경해야 했는지"를 한 문장으로 설명한다.

```markdown
(O) **`get_train_data_batch()`가 trace -> tensor 변환의 유일한 지점이기 때문이다.**
(X) daemon.py를 수정했다.
(X) **daemon.py에 필터링 기능을 추가했다.** (이것은 "what"이지 "why"가 아님)
```

### 변경 블록

각 변경 블록은 다음 요소를 포함한다:

1. **변경 제목**: `### 변경 A: {변경 설명} (Line {N}-{M})`
2. **코드 스니펫**: 실제 파일에서 Read tool로 읽은 코드 발췌
3. **왜 설명**: `**왜 {키워드}인가?** {설명}`

### 코드 스니펫 형식

- 추가된 줄은 `+` prefix 사용
- 삭제된 줄은 `-` prefix 사용
- 컨텍스트 줄(변경 없음)은 공백 prefix 사용
- 라인 번호 주석은 `# Line N` 형식으로 코드 우측에 배치

```python
+import logging                                          # Line 5
+
+try:                                                    # Line 28
+    from verl.experimental.agent_loop.tool_parser import ToolParser
+    TOOL_PARSER_AVAILABLE = True
+except ImportError:
+    TOOL_PARSER_AVAILABLE = False
```

### 의존 관계 다이어그램

- 화살표 `|` + `v` = "이 파일이 아래 파일에 의존/영향"
- 화살표 `<----` = "이 파일이 왼쪽 파일을 호출"
- `+--` = 분기 (여러 파일이 같은 소스에 의존)

### 설계 결정 요약 테이블

- 질문은 "왜 X인가?" 형식
- 답변은 한 문장으로 핵심 이유 + 필요 시 근거
- 모든 주요 설계 결정이 포함되어야 함

---

## 실제 예시 (참고)

아래는 실제 프로젝트에서 생성된 문서의 일부이다.

### 헤더 예시

```markdown
# Code Changes Explanation (vs main branch)

**Base**: `main` branch (commit `9397b7c`)
**Purpose**: Unexpected Tool Call Filtering + 실험 인프라 구축
**Date**: 2026-01-24
**Total**: 6 files, +459 lines
```

### 파일 설명 예시

```markdown
## 파일 1: daemon.py -- 왜 이 파일인가?

**`get_train_data_batch()`가 trace -> tensor 변환의 유일한 지점이기 때문이다.**
이 함수에서 rollout의 각 turn을 검증하고, 비정상 turn을 제거하면 해당 turn이
GRPO gradient에 포함되지 않는다.

### 변경 A: Import 추가 (Line 5, 22-32)

```python
+import logging                                          # Line 5
+try:                                                    # Line 28
+    from verl.experimental.agent_loop.tool_parser import ToolParser
+    TOOL_PARSER_AVAILABLE = True
+except ImportError:
+    TOOL_PARSER_AVAILABLE = False
```

**왜 try/except인가?** ToolParser는 `verl` 패키지의 experimental 모듈이다.
설치되지 않은 환경에서도 daemon.py가 정상 동작하도록 optional import 처리.
```

### 설계 결정 요약 예시

```markdown
| 질문 | 답변 |
|------|------|
| 왜 daemon.py인가? | trace -> tensor 변환의 유일한 지점. gradient 포함 직전에 제거 가능. |
| 왜 chat template인가? | 모델 독립적 토큰 감지. 하드코딩 대비 이식성 향상. |
| 왜 `== 0` 임계값인가? | 2-turn trajectory에서 over-filtering 증폭 방지. |
| 왜 항상 카운트하는가? | Dry-run 메트릭으로 필터링 효과 사전 예측 가능. |
```
