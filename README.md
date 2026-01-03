# Claude Code Skills & Agents for DSLab

Claude Code의 커스텀 스킬과 에이전트 모음입니다. 여러 서버에서 공유하여 사용할 수 있습니다.

## 설치

```bash
git clone https://github.com/iamseungpil/claude--for-dslab.git
cd claude--for-dslab
chmod +x install.sh
./install.sh
```

## Skills (사용자 호출)

`/skill-name` 형태로 직접 호출하거나, Claude가 상황에 맞게 자동으로 사용합니다.

| 스킬 | 설명 |
|------|------|
| `codex-iterative-solver` | Codex CLI와 협업하여 복잡한 문제를 반복적으로 분석/해결 |
| `weekly-report-writer` | Git 변경사항 분석하여 학술 스타일 주간 보고서 생성 |
| `iterative-code-review` | code-architect + code-reviewer + 테스트 반복으로 코드 품질 개선 |

## Agents (자동 호출)

Claude가 Task 도구를 통해 상황에 맞게 자동으로 호출합니다.

| 에이전트 | 모델 | 설명 |
|----------|------|------|
| `academic-writing-assistant` | opus | 학술 논문 작성 지원 (두괄식, 간결성, 목적 중심) |
| `code-reviewer` | opus | 코드 품질/보안 검토 (Critical/Warning/Suggestion 분류) |
| `debugger` | opus | 에러/테스트 실패 디버깅 (root cause 분석) |
| `code-cleanup-optimizer` | opus | 중복 코드, 불필요 파일 정리 및 구조 최적화 |
| `modular-code-architect` | opus | 모듈화된 확장 가능한 코드 설계 (Registry 패턴 등) |

## 디렉토리 구조

```
claude--for-dslab/
├── README.md
├── install.sh
├── skills/
│   ├── codex-iterative-solver/
│   │   └── SKILL.md
│   ├── weekly-report-writer/
│   │   └── SKILL.md
│   └── iterative-code-review/
│       └── SKILL.md
└── agents/
    ├── academic-writing-assistant.md
    ├── code-reviewer.md
    ├── debugger.md
    ├── code-cleanup-optimizer.md
    └── modular-code-architect.md
```

## 업데이트

```bash
cd ~/claude--for-dslab
git pull
# symlink이므로 자동 반영됨
```

## 새 스킬/에이전트 추가

### 스킬 추가

```bash
mkdir skills/new-skill-name
# SKILL.md 작성 (frontmatter 필수: name, description)
```

### 에이전트 추가

```bash
# agents/new-agent-name.md 작성
# frontmatter: name, description, model (opus/sonnet/haiku)
```

## 라이선스

Internal use only - DSLab
