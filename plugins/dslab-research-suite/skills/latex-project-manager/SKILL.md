---
name: latex-project-manager
description: >-
  Structure and manage LaTeX projects with section-based folder organization
  and Git integration. Two commands: (1) `structure` splits a monolithic .tex
  file into per-section files with main.tex orchestrator, figures/ directory,
  and BibTeX refs.bib, (2) `push` initializes git and pushes to GitHub or
  Overleaf with token-based auth. Supports multi-project layout where main.tex
  switches between projects via a single command variable. MANDATORY TRIGGERS:
  latex structure, tex organize, section split, latex git push, overleaf push,
  latex 정리, tex 구조화, 섹션 분리
---

# LaTeX Project Manager

LaTeX 프로젝트를 섹션별 폴더 구조로 분리하고 Git으로 관리하는 스킬입니다.

## When to Use

- 단일 `.tex` 파일을 섹션별로 분리하고 싶을 때
- 여러 LaTeX 프로젝트를 하나의 repo에서 스위치 방식으로 관리할 때
- LaTeX 프로젝트를 GitHub 또는 Overleaf에 push할 때
- 기존 inline `\begin{thebibliography}`를 BibTeX `.bib`으로 전환할 때

## Command 1: `structure`

### Usage
```
/latex-project-manager structure <tex_file> <output_dir> [project_name]
```

### What It Does

단일 `.tex` 파일을 분석하여 아래 구조로 분리합니다:

```
output_dir/
├── main.tex                       # 공통 preamble + 프로젝트 선택 스위치
├── <project_name>/
│   ├── content.tex                # \input 오케스트레이터
│   ├── refs.bib                   # BibTeX 참고문헌
│   ├── figures/                   # 이미지 저장 폴더
│   │   └── .gitkeep
│   └── sections/
│       ├── 00_frontmatter.tex     # \title, \author, \maketitle, \abstract
│       ├── 01_<section_name>.tex  # 각 \section별 파일
│       ├── ...
│       └── NN_bibliography.tex    # \bibliography{project/refs}
└── .gitignore
```

### Workflow

```
Phase 1: 분석
├── .tex 파일 읽기
├── preamble 추출 (documentclass ~ \begin{document})
├── \section 경계 식별
├── bibliography 방식 확인 (inline vs bibtex)
└── 패키지 목록 수집

Phase 2: 분리
├── main.tex 생성 (preamble + \professor 스위치)
├── content.tex 생성 (\input 목록)
├── 섹션별 .tex 파일 생성
├── refs.bib 생성 (inline bib → BibTeX 변환)
└── figures/ 디렉토리 생성

Phase 3: 검증
├── pdflatex 컴파일 (에러 0 확인)
├── bibtex 실행 + 재컴파일 (3-pass)
├── 원본 대비 페이지 수 일치 확인
├── citation 경고 0건 확인
└── 컨텐츠 유실 없음 확인 (diff)

Phase 4: Critique Loop
├── Round 1: 에러/경고 확인 → 수정
├── Round 2: 재검증 → 이슈 없으면 통과
└── 2회 연속 이슈 없을 때까지 반복
```

### Rules

#### Preamble Handling
- `\documentclass` ~ `\begin{document}` 사이의 모든 내용을 `main.tex`로 추출
- 여러 프로젝트가 있을 경우 패키지의 **합집합**을 사용
- `\graphicspath{{\professor/figures/}}`로 프로젝트별 이미지 경로 설정

#### Section Splitting
- `\section{...}` 단위로 분리 (subsection은 해당 section 파일에 포함)
- 파일명: `NN_<section_name>.tex` (번호 + 스네이크케이스)
- `\title`, `\author`, `\date`, `\maketitle`, `\begin{abstract}`~`\end{abstract}` → `00_frontmatter.tex`
- `\section*{Acknowledgments}` + bibliography → 마지막 번호 `_bibliography.tex`

#### Bibliography (CRITICAL)
- **반드시 BibTeX `.bib` 파일로 관리** — inline `\begin{thebibliography}` 금지
- `refs.bib`를 프로젝트 폴더 루트에 생성
- `\bibliographystyle{plainnat}` + `\bibliography{<project>/refs}` 사용
- inline `\bibitem`이 있으면 자동으로 `@article`/`@inproceedings` 엔트리로 변환
- **모든 텍스트 참조를 `\citep{}` 또는 `\citet{}`로 변환** — "(Author et al., Year)" 같은 plain text 참조를 찾아 `\citep{key}`로 교체
- 3-pass 컴파일: `pdflatex → bibtex → pdflatex → pdflatex`

#### Multi-Project Switch
```latex
% main.tex
\newcommand{\professor}{goodman}  % Change to: goodman | andreas | lake

% ... shared preamble ...

\begin{document}
\input{\professor/content}
\end{document}
```

#### Content Preservation
- 원본 내용을 **한 글자도 변경하지 않음** (구조 변경만)
- 단, LaTeX 에러가 있는 경우 수정 (예: pgfplots xticklabel `\\` 문제)

---

## Command 2: `push`

### Usage
```
/latex-project-manager push <project_dir> [remote_url]
```

### Token Authentication

우선순위:
1. 환경변수 `$GITHUB_TOKEN` 또는 `$OVERLEAF_TOKEN`
2. 사용자에게 직접 입력 요청

### Git URL Formats

| 서비스 | URL 형식 |
|--------|---------|
| GitHub | `https://<user>:<token>@github.com/<user>/<repo>.git` |
| Overleaf | `https://git:<token>@git.overleaf.com/<project_id>` |

### Workflow

```
Phase 1: 초기화
├── git init (없는 경우)
├── .gitignore 생성/확인
├── remote 설정
└── user.name / user.email 설정

Phase 2: 커밋
├── git add (tex, bib, gitkeep, gitignore만)
├── 커밋 메시지 자동 생성
└── git commit

Phase 3: Push
├── git push (또는 force push for 초기 설정)
└── 결과 확인

Phase 4: Critique
├── git ls-files로 tracked 파일 확인
├── 민감 정보 (토큰 등) 커밋에 포함되지 않았는지 확인
└── remote 연결 상태 확인
```

### .gitignore Template

```
*.aux
*.log
*.out
*.toc
*.bbl
*.blg
*.synctex.gz
*.fls
*.fdb_latexmk
*.pdf
.DS_Store
```

---

## Common Issues & Fixes

| 문제 | 원인 | 해결 |
|------|------|------|
| pgfplots xticklabel `\\` 에러 | LR mode에서 `\\` 사용 불가 | `{Label Text}` 형태로 변경, `align=center` 추가 |
| Overfull hbox (table) | `lcccc` 열이 너무 넓음 | `Xcccc` (tabularx) 또는 헤더 축약 |
| Citation undefined | `\cite` 없이 텍스트로 참조 | `\citep{key}` 또는 `\citet{key}`로 변환 |
| BibTeX 엔트리 누락 | `.bib`에 key 없음 | `refs.bib`에 엔트리 추가 |
| Overleaf git 403 | 무료 플랜 | Premium 플랜 필요, 또는 GitHub 사용 |
| `\legend`에서 `$\to$` 에러 | pgfplots legend의 math mode 제한 | `\textrightarrow{}` 사용 |

## Related Skills

- `academic-latex-pipeline` — MD→LaTeX 변환, Korean font, Format review
- `iterative-academic-writer` — 학술 문서 품질 개선 루프
