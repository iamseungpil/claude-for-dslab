# Claude Code Skills & Agents for DSLab

Claude Code의 커스텀 스킬과 에이전트 모음입니다. 여러 서버에서 공유하여 사용할 수 있습니다.

## 설치

```bash
git clone https://github.com/iamseungpil/claude-for-dslab.git ~/.local/share/claude-for-dslab
cd ~/.local/share/claude-for-dslab
chmod +x install.sh
./install.sh
```

## 마켓플레이스 플러그인 (`/plugin`)

top-level `skills/`·`agents/`·`commands/`(install.sh 심링크 방식)와 별개로, 번들 의존성·hooks·MCP가 필요한 도구는 `plugins/` 아래 완결형 플러그인으로 담고 `.claude-plugin/marketplace.json`(마켓플레이스명 `dslab`)에 등록한다. Claude Code에서 다음처럼 설치한다.

```text
/plugin marketplace add iamseungpil/claude-for-dslab
/plugin install dslab-research-suite@dslab
/plugin install understand-anything@dslab
/plugin install superpowers@dslab
```

| 플러그인 | 설명 |
|----------|------|
| `dslab-research-suite` | 논문 검색·서베이·LaTeX·반복 윤문·코드 리뷰 등 학술 연구 툴킷 (이 레포 자체 제작) |
| `understand-anything` | 코드베이스를 인터랙티브 knowledge graph로 분석·시각화·설명 (architecture / domain / onboarding / diff / dashboard). `/understand`, `/understand-explain`, `/understand-dashboard` 등. ([Lum1104/Understand-Anything](https://github.com/Lum1104/Understand-Anything) v2.7.6, MIT — `plugins/understand-anything/`에 벤더링) |
| `superpowers` | Claude Code 코어 스킬 라이브러리: TDD, 체계적 디버깅, 브레인스토밍, plan 작성, 병렬 에이전트, git worktree, 코드 리뷰 등 14개 워크플로 스킬. ([obra/superpowers](https://github.com/obra/superpowers) v5.1.0, MIT — `plugins/superpowers/`에 벤더링) |

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
| `survey-paper` | arxiv 논문을 Obsidian 서베이 노트로 변환. Digest + Iterative Writing + 플로우 다이어그램 |
| `update-study` | Study 노트 업데이트 |
| `humanize-korean` | AI(ChatGPT·Claude·Gemini)가 쓴 한글 글의 "AI 티"(번역투, 기계적 병렬, 관용구 등 10대 카테고리)를 탐지·윤문. Fast/Strict 두 모드 |
| `humanize-writing` | 영문 AI 글의 banned vocab + AI 구조(parallel negation, tricolon, em dash, mirror) 3-pass 윤문. LinkedIn 룰 포함. (from [Luis Guzman/humanize-writing](https://github.com/luisguzman/humanize-writing-skill), MIT) |
| `autoresearch` | Karpathy autoresearch 패턴: goal + metric + autonomous loop. `/autoresearch:plan/predict/probe/debug/fix/learn/ship/reason/security/scenario` 등 슬래시 변형 지원. (from [uditgoenka/autoresearch](https://github.com/uditgoenka/autoresearch), MIT) |
| `paper-section-rewrite` | 논문 한 섹션을 구조 plan critic loop → 두괄식 prose → 본문 critic loop → 수식·notation 감사 → LaTeX 빌드 검증까지 돌리는 섹션 단위 윤문. paper-digest의 insight-first, iterative-academic-writing의 두괄식, humanize-writing의 ML-비전공자 친화 원칙을 한 섹션 단위로 묶어서 적용. KO/EN 양쪽 지원 |
| `stacked-research` | 실험 결과가 쌓이게 만드는 연구 규율. 설계·발사·판정, 사전등록·헌법·판정문, autoresearch 루프, 정본 코드 변경 승인에 적용. 같은 결론을 다시 사는 것, 무효 레버(선언은 있고 배선은 없는 것), 이미 되던 것을 조용히 깨뜨리는 것, 일회성 스크립트 증식, 문서가 진전을 대체하는 것을 막는다 |
| `karpathy-guidelines` | Andrej Karpathy의 LLM 코딩 pitfall 관찰에서 도출한 4원칙(Think Before Coding / Simplicity First / Surgical Changes / Goal-Driven Execution). 코드 작성·리뷰·리팩토링 시 과잉 추상화·orthogonal edit·가정 은폐를 막는 행동 가이드. (from [multica-ai/andrej-karpathy-skills](https://github.com/multica-ai/andrej-karpathy-skills), MIT) |

슬래시 명령:
- `/humanize <텍스트 또는 파일>` — humanize-korean 풀 파이프라인 실행
- `/humanize-redo` — 가장 최근 윤문 결과를 카테고리·강도 조정해 2차 윤문
- `/autoresearch <goal>` — 목표·metric 기반 자동 반복 루프
- `/autoresearch:plan|predict|probe|debug|fix|learn|ship|reason|security|scenario` — 도메인별 변형

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
│   ├── survey-paper/
│   └── update-study/
├── agents/
│   ├── academic-writing-assistant.md
│   ├── academic-planner.md
│   ├── academic-reviewer.md
│   ├── code-reviewer.md
│   ├── debugger.md
│   ├── code-cleanup-optimizer.md
│   ├── modular-code-architect.md
│   ├── task-planner-analyzer.md
│   ├── report-planner.md
│   ├── report-reviewer.md
│   ├── experiment-interpreter.md
│   └── experiment-verifier.md
├── .claude-plugin/
│   └── marketplace.json        # 마켓플레이스 `dslab` 매니페스트
└── plugins/                    # /plugin 으로 설치되는 완결형 플러그인
    ├── dslab-research-suite/    # 자체 제작 연구 툴킷 플러그인
    ├── claude-scientific-skills/
    ├── understand-anything/     # 벤더링 (Lum1104, MIT)
    └── superpowers/             # 벤더링 (obra/Jesse Vincent, MIT)
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
