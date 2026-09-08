#!/usr/bin/env bash
# Deterministic half of the pipeline (no LLM): briefs -> validate -> collect -> deploy.
# The judging steps between them are Workflow runs launched by the skill (see SKILL.md).
# Usage: pipeline.sh <repo> <week-id> <step> [job dirs...]
#   steps: briefs | validate | collect | deploy
set -euo pipefail
repo="$1"; week="$2"; step="$3"; shift 3
cd "$repo"
case "$step" in
  briefs)   .venv/bin/python -m deepswe.progress "$@"; .venv/bin/python -m deepswe.analyze emit "$@";
            .venv/bin/python -m deepswe.win_brief "$@" 2>/dev/null || true ;;
  validate) .venv/bin/python -m deepswe.analyze validate ;;
  collect)  .venv/bin/python -m deepswe.collect --week "$week" "$@" ;;
  deploy)   bash refresh.sh "$week" "$@" ;;
  *) echo "unknown step $step" >&2; exit 2 ;;
esac
