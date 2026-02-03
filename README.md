# Claude Code Skills & Agents for DSLab

Claude Code의 커스텀 스킬과 에이전트 모음입니다. 여러 서버에서 공유하여 사용할 수 있습니다.

## 설치

```bash
git clone https://github.com/iamseungpil/claude-for-dslab.git ~/.local/share/claude-for-dslab
cd ~/.local/share/claude-for-dslab
chmod +x install.sh
./install.sh
```

## Skills (사용자 호출)

`/skill-name` 형태로 직접 호출하거나, Claude가 상황에 맞게 자동으로 사용합니다.

| 스킬 | 설명 |
|------|------|
| `hwpx` | 한글(HWPX) 문서 생성/편집/분석. hwpxjs + LibreOffice 기반 |
| `iterative-academic-writer` | 학술 문서 반복 작성 (academic-planner + academic-reviewer) |
| `iterative-code-review` | code-architect + code-reviewer + 테스트 반복으로 코드 품질 개선 |
| `weekly-report-writer` | Git 변경사항 분석하여 학술 스타일 주간 보고서 생성 |
| `codex-iterative-solver` | Codex CLI와 협업하여 복잡한 문제를 반복적으로 분석/해결 |
| `paper-digest` | 논문 요약을 소셜 공유용(Discord/Slack/Twitter)으로 생성. 인사이트 중심 단일 문단 |
| `update-study` | Study 노트 업데이트 |

## Agents (자동 호출)

Claude가 Task 도구를 통해 상황에 맞게 자동으로 호출합니다.

| 에이전트 | 모델 | 설명 |
|----------|------|------|
| `academic-writing-assistant` | opus | 학술 논문 작성 지원 (두괄식, 간결성, 목적 중심) |
| `academic-planner` | opus | 학술 문서 구조 설계 및 블루프린트 작성 |
| `academic-reviewer` | opus | 학술 문서 품질 평가 |
| `code-reviewer` | opus | 코드 품질/보안 검토 (Critical/Warning/Suggestion 분류) |
| `debugger` | opus | 에러/테스트 실패 디버깅 (root cause 분석) |
| `code-cleanup-optimizer` | opus | 중복 코드, 불필요 파일 정리 및 구조 최적화 |
| `modular-code-architect` | opus | 모듈화된 확장 가능한 코드 설계 (Registry 패턴 등) |
| `task-planner-analyzer` | opus | 작업 분석 및 todo 리스트 생성 |
| `report-planner` | opus | 보고서 구조 설계 |
| `report-reviewer` | opus | 보고서 품질 평가 |
| `experiment-interpreter` | opus | 실험 결과 해석 |
| `experiment-verifier` | opus | 실험 검증 |

## hwpx 스킬 상세

한글(Hancom Office) 문서 작업을 위한 종합 도구입니다.

### 의존성

```bash
# Node.js (hwpxjs)
npm install -g @ssabrojs/hwpxjs

# macOS
brew install --cask libreoffice  # PDF 변환용
brew install poppler             # pdftoppm

# Python
pip install beautifulsoup4 lxml --break-system-packages
```

### 주요 기능

| 기능 | 명령어/API |
|------|-----------|
| 텍스트 추출 | `npx hwpxjs txt document.hwpx` |
| HTML 변환 | `npx hwpxjs html document.hwpx` |
| HWP→HWPX 변환 | `npx hwpxjs convert:hwp input.hwp output.hwpx` |
| PDF 변환 | `python scripts/convert_to_pdf.py document.hwpx` |
| HWPX 검증 | `python scripts/validate.py document.hwpx` |
| 언팩/리팩 | `python scripts/unpack.py` / `python scripts/pack.py` |

### 파일 구조

```
skills/hwpx/
├── SKILL.md                    # 메인 문서
├── references/
│   ├── image-insertion.md      # lxml 기반 이미지 삽입 가이드
│   └── xml-reference.md        # XML 구조 상세 레퍼런스
└── scripts/
    ├── unpack.py / pack.py     # HWPX 압축/해제
    ├── convert_hwp.py          # HWP→HWPX
    ├── convert_to_pdf.py       # HWPX→PDF
    ├── validate.py             # HWPX 검증
    └── office/soffice.py       # LibreOffice 래퍼
```

## 디렉토리 구조

```
claude-for-dslab/
├── README.md
├── install.sh
├── skills/
│   ├── hwpx/
│   │   ├── SKILL.md
│   │   ├── references/
│   │   └── scripts/
│   ├── iterative-academic-writer/
│   ├── iterative-code-review/
│   ├── weekly-report-writer/
│   ├── codex-iterative-solver/
│   ├── paper-digest/
│   └── update-study/
└── agents/
    ├── academic-writing-assistant.md
    ├── academic-planner.md
    ├── academic-reviewer.md
    ├── code-reviewer.md
    ├── debugger.md
    ├── code-cleanup-optimizer.md
    ├── modular-code-architect.md
    ├── task-planner-analyzer.md
    ├── report-planner.md
    ├── report-reviewer.md
    ├── experiment-interpreter.md
    └── experiment-verifier.md
```

## 업데이트

```bash
cd ~/.local/share/claude-for-dslab
git pull
# symlink이므로 자동 반영됨
```

## 새 스킬/에이전트 추가

### 스킬 추가

```bash
mkdir skills/new-skill-name
# SKILL.md 작성 (frontmatter 필수: name, description)
./install.sh
```

### 에이전트 추가

```bash
# agents/new-agent-name.md 작성
# frontmatter: name, description, model (opus/sonnet/haiku)
./install.sh
```

## 라이선스

Internal use only - DSLab
