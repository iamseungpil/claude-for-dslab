# DS Lab Research Suite

Academic research toolkit for DS Lab. Integrates arxiv paper discovery, survey note generation, academic writing evaluation, LaTeX PDF compilation, and research visualization into a single plugin.

## Components

### MCP Server
- **arxiv-mcp-server** — Search and fetch arxiv papers directly from Claude

### Skills (5)
- **survey-paper** — Generate structured Obsidian survey notes from arxiv papers
- **paper-digest** — Create shareable paper summaries for Discord/Slack/Twitter
- **iterative-academic-writing** — 14-principle academic writing evaluation with FactBase verification
- **academic-latex-pipeline** — MD → LaTeX → PDF pipeline with Korean font support (XeLaTeX + Noto Sans CJK KR)
- **research-survey-visualizer** — Interactive visual summaries of research papers

### Commands (4)
- `/survey [arxiv-id]` — Survey a paper into an Obsidian note
- `/digest [arxiv-id]` — Generate a shareable paper digest
- `/build-pdf [md-file]` — Build a LaTeX PDF from survey markdown
- `/review-writing [md-file]` — Evaluate academic writing with 14 principles

## Setup

### Prerequisites
- **uv** (Python package manager): `pip install uv` or `brew install uv`
- The arxiv MCP server will be auto-installed on first use via `uv tool run`

### For Korean PDF generation
- XeLaTeX: `sudo apt install texlive-xetex` (Linux) or `brew install --cask mactex` (macOS)
- Noto Sans CJK KR font: download from [Google Noto CJK](https://github.com/googlei18n/noto-cjk/releases)

## Typical Workflow

1. `/survey 2512.17102` — Create a detailed Obsidian survey note for a SAGE paper
2. `/review-writing Survey.md` — Check the survey note with 14 academic writing principles
3. `/build-pdf Survey.md` — Convert the polished survey into a LaTeX PDF
4. `/digest 2512.17102` — Share a quick summary on Discord
