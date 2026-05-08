# academic-writing-trainer — Claude Desktop 설치 가이드

본 트레이너 스킬을 Claude Desktop (또는 claude.ai 웹)에서 테스트하는 방법.

Claude Code에서는 `~/.claude/skills/`에 자동 symlink되므로 별도 설치 불필요.
Claude Desktop은 skill 자동 로딩 기능이 없으므로 **Project로 만들어** 사용한다.

---

## 방법 1 — Claude Desktop의 Project 기능 사용 (권장)

### 1. Project 생성

1. Claude Desktop 열기
2. 좌측 사이드바 "Projects" → "New Project"
3. 프로젝트 이름: "Academic Writing Trainer (KO/EN)"
4. 설명: "5문단 학술 글 단계별 작성 코칭"

### 2. Custom Instructions 설정

"Custom instructions" 영역에 [bundled-prompt.md](bundled-prompt.md)의 전체 내용을 복사해 붙여넣기.

이 한 파일에 SKILL.md + 모든 reference가 통합되어 있다.

### 3. Project Knowledge 추가 (선택, 길이 절약 시)

Custom Instructions 길이 제한이 걸리면, [bundled-prompt.md](bundled-prompt.md) 대신 다음을 분리:

- **Custom Instructions**: SKILL.md 본문만
- **Project Knowledge files**:
  - `references/writing-principles-ko.md`
  - `references/genre-rubrics.md`
  - `references/feedback-corpus.md`
  - `references/banned-phrases-ko.md`
  - `references/banned-phrases-en.md`
  - `references/scoring-rubrics.md`
  - `references/coach-persona.md`
  - `references/stage-flow-short.md`
  - `references/stage-flow-long.md`
  - `references/case-studies.md`

각 파일을 Project Knowledge에 업로드.

### 4. 사용

Project 안에서 새 대화 시작 후:

```
글쓰기 연습 시작
```

또는

```
[주제]에 대해 5문단 연구 제안서 작성 트레이너 시작
```

---

## 방법 2 — claude.ai 웹 (Team plan 이상)

claude.ai 웹은 Custom Skills 업로드를 지원한다 (Team plan 기준).

1. claude.ai → 좌측 "Skills" → "Create Skill"
2. SKILL.md 업로드
3. references 폴더 전체 업로드
4. 트리거 키워드: "글쓰기 연습", "academic writing trainer" 등

---

## 방법 3 — 단순 paste (가장 빠름)

Project를 만들기 귀찮으면, 그냥 Claude Desktop 대화창에:

1. [bundled-prompt.md](bundled-prompt.md)의 내용을 복사
2. 새 대화 첫 메시지로 paste
3. 그 뒤 "글쓰기 연습 시작" 입력

이 방식은 한 세션 내에서만 유효 (다음 세션엔 다시 paste 필요).

---

## 동작 확인

설치 후 Claude에게:

```
academic-writing-trainer 어떻게 사용해?
```

라고 물어보면 트레이너가 모드/장르/언어 선택을 안내하면 OK.

---

## 차이점 — Claude Code vs Claude Desktop

| 기능 | Claude Code | Claude Desktop |
|---|---|---|
| 스킬 자동 로딩 | ✓ | ✗ (Project로 수동 설정) |
| 파일 저장 (proposal.md 등) | ✓ Write tool | △ 채팅에 출력 (수동 복사) |
| 정량 grep | ✓ Bash tool | △ Claude가 mental grep |
| 대화 길이 | 길어도 OK | 점점 느려짐 (긴 세션 시 새 대화 권장) |

핵심 학습 흐름은 양쪽 동일. 단, 산출물 저장은 Claude Desktop에서 사용자가 수동으로 복사.
