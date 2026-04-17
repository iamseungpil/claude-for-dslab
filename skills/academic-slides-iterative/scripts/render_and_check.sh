#!/usr/bin/env bash
# render_and_check.sh  <tex_file>
#
# Compile a Beamer .tex twice, then report:
#  - final return code
#  - all "Overfull X too wide" and "Overfull X too high" warnings
#  - any LaTeX Error or Undefined control sequence
#  - page count
#
# Usage (from the directory containing the .tex):
#   ./render_and_check.sh v3_mcts_wake_sleep_talk.tex

set -u
TEX="${1:?usage: $0 <tex_file>}"
[[ -f "$TEX" ]] || { echo "missing: $TEX" >&2; exit 2; }

# Compile twice for cross-refs / TikZ positioning
pdflatex -interaction=nonstopmode "$TEX" > /tmp/_pdflatex_1.log 2>&1
pdflatex -interaction=nonstopmode "$TEX" > /tmp/_pdflatex_2.log 2>&1
RC=$?

PDF="${TEX%.tex}.pdf"
[[ -f "$PDF" ]] || { echo "no pdf produced" >&2; cat /tmp/_pdflatex_2.log; exit 3; }

echo "=== compile rc=$RC ==="

echo "=== overfull boxes ==="
grep -E "Overfull .* too (wide|high)" /tmp/_pdflatex_2.log | head -20 || echo "(none)"

echo "=== latex errors ==="
grep -E "^! (LaTeX Error|Undefined control sequence|Missing)" /tmp/_pdflatex_2.log | head -10 || echo "(none)"

echo "=== page count ==="
grep -oE "Output written on .* \([0-9]+ pages?" /tmp/_pdflatex_2.log | tail -1
