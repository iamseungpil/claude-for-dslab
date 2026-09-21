#!/bin/bash
# 연구판 배포 예시. 실제 저장소에서는 이 세 걸음을 자기 배포 명령과 함께 쓴다.
#   ./research-site/deploy.sh <설정파일> <배포폴더>
set -euo pipefail
CONFIG="${1:-site.config.json}"
OUT="${2:-site}"
HERE="$(cd "$(dirname "$0")" && pwd)"

# 1. 자료 — 설정과 시행 표를 읽어 data/*.json 을 다시 만든다 (모델 호출·네트워크 없음)
python "$HERE/build_site_data.py" "$CONFIG"

# 2. 화면 — index.html 과 css/js 를 배포 폴더로 복사한다 (data/ 는 건드리지 않는다)
mkdir -p "$OUT"
cp "$HERE/index.html" "$OUT/"
rm -rf "$OUT/css" "$OUT/js"
cp -r "$HERE/css" "$HERE/js" "$OUT/"

# 3. 배포 — 정적 파일을 올리기만 하면 된다. 예: Cloudflare Pages
#    wrangler pages deploy "$OUT" --project-name <프로젝트> --branch main
echo "준비 끝: $OUT (index.html · css/ · js/ · data/)"
