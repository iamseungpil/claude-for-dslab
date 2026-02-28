# DS Lab Research Suite

Academic research toolkit for DS Lab. Integrates multi-source paper search, survey note generation, academic writing evaluation, LaTeX PDF compilation, research visualization, and code review into a single plugin.

## Components

### MCP Servers (2)
- **arxiv-mcp-server** — Search and fetch arxiv papers with local storage
- **paper-search-mcp** — Multi-source paper search: arXiv, PubMed, Google Scholar, bioRxiv

### Skills (6)
- **survey-paper** — Generate structured Obsidian survey notes from arxiv papers
- **paper-digest** — Create shareable paper summaries for Discord/Slack/Twitter
- **iterative-academic-writing** — 14-principle academic writing evaluation with FactBase verification
- **academic-latex-pipeline** — MD → LaTeX → PDF pipeline with Korean font support (XeLaTeX + Noto Sans CJK KR)
- **research-survey-visualizer** — Interactive visual summaries of research papers
- **iterative-code-review** — Analyze-implement-review-test loop for research code quality

### Commands (5)
- `/survey [arxiv-id]` — Survey a paper into an Obsidian note
- `/digest [arxiv-id]` — Generate a shareable paper digest
- `/build-pdf [md-file]` — Build a LaTeX PDF from survey markdown
- `/review-writing [md-file]` — Evaluate academic writing with 14 principles
- `/review-code [file]` — Iteratively review and improve code quality

## Setup

### Prerequisites
- **uv** (Python package manager): `pip install uv` or `brew install uv`
- MCP servers auto-install on first use via `uv tool run`

### For Korean PDF generation
- XeLaTeX: `sudo apt install texlive-xetex` (Linux) or `brew install --cask mactex` (macOS)
- Noto Sans CJK KR font: download from [Google Noto CJK](https://github.com/googlei18n/noto-cjk/releases)

## Typical Workflow

1. Use **paper-search-mcp** to search across Google Scholar, PubMed, arXiv simultaneously
2. `/survey 2512.17102` — Create a detailed Obsidian survey note
3. `/review-writing Survey.md` — Check with 14 academic writing principles
4. `/build-pdf Survey.md` — Convert to a publication-quality LaTeX PDF
5. `/digest 2512.17102` — Share a quick summary on Discord
6. `/review-code experiment.py` — Polish research experiment code
