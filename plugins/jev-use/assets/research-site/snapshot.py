#!/usr/bin/env python3
"""주차 보고서를 얼려 둔다(스냅샷). 지난 보고서는 지우지 않고 쌓인다.

  python research-site/snapshot.py --site site --week 2026-W38 --label "3주차 (재구성본)" [--max-week 3]

얼린 보고서는 site/reports/<주차>/ 아래에 화면 파일과 그때의 data/ 를 함께 담는다. 실시간(KV) 갱신은 하지 않고
meta.json 에 frozen_at 을 적어 화면이 '얼린 보고서' 띠를 띄우게 한다. 목록은 site/reports/index.json 과
site/data/reports.json 두 곳에 같이 적는다(앞은 기록, 뒤는 화면이 읽는 메뉴).
표준 라이브러리만 쓴다.
"""
import argparse, datetime, json, os, shutil

ASSETS = ("index.html", "css", "js")
DATA = ("meta.json", "rows.json", "stats.json", "live.json", "reports.json")


def size_mb(path):
    n = 0
    for base, _, files in os.walk(path):
        n += sum(os.path.getsize(os.path.join(base, f)) for f in files)
    return n / 1e6


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--site", default="site")
    ap.add_argument("--week", required=True, help="ISO 주차, 예: 2026-W38")
    ap.add_argument("--label", default="")
    ap.add_argument("--week-id", default="", help="사이트 주차 id (주차 카드의 '당시 보고서 보기' 연결용)")
    ap.add_argument("--max-week", default="", help="이 주차 id 이하만 남긴다(재구성본을 만들 때)")
    ap.add_argument("--summary", default="")
    args = ap.parse_args()
    site = os.path.abspath(args.site)
    dest = os.path.join(site, "reports", args.week)
    if os.path.exists(dest):
        shutil.rmtree(dest)
    os.makedirs(os.path.join(dest, "data"), exist_ok=True)
    for a in ASSETS:
        src = os.path.join(site, a)
        if os.path.isdir(src):
            shutil.copytree(src, os.path.join(dest, a))
        elif os.path.exists(src):
            shutil.copy2(src, dest)
    frozen = datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%d %H:%M UTC")
    keep = args.max_week
    for name in DATA:
        src = os.path.join(site, "data", name)
        if not os.path.exists(src):
            continue
        with open(src) as f:
            obj = json.load(f)
        if keep:      # 그 주차까지의 자료만 남긴다 — 얼린 보고서가 나중 결과를 보여 주면 안 된다
            if name == "rows.json":
                obj["rows"] = [r for r in obj["rows"] if str(r.get("week", "")) <= keep]
            elif name == "stats.json":
                obj["weekly"] = [w for w in obj.get("weekly", []) if str(w.get("week", "")) <= keep]
                obj["blocks"] = [b for b in obj.get("blocks", []) if not b.get("week") or str(b["week"]) <= keep]
            elif name == "meta.json":
                obj["weeks"] = [w for w in obj.get("weeks", []) if str(w.get("id", "")) <= keep]
        if name == "meta.json":
            obj["frozen_at"] = frozen
            obj["title"] = (obj.get("title") or "연구판") + " — " + (args.label or args.week)
        with open(os.path.join(dest, "data", name), "w") as f:
            json.dump(obj, f, ensure_ascii=False, separators=(",", ":"))
    mb = size_mb(dest)
    entry = {"week": args.week, "week_id": args.week_id or keep, "label": args.label or args.week,
             "frozen_at": frozen, "path": f"/reports/{args.week}/",
             "summary": args.summary, "mb": round(mb, 2)}
    idx_path = os.path.join(site, "reports", "index.json")
    reports = []
    if os.path.exists(idx_path):
        with open(idx_path) as f:
            reports = json.load(f).get("reports", [])
    reports = [r for r in reports if r["week"] != args.week] + [entry]
    reports.sort(key=lambda r: r["week"], reverse=True)
    for path in (idx_path, os.path.join(site, "data", "reports.json")):
        os.makedirs(os.path.dirname(path), exist_ok=True)
        with open(path, "w") as f:
            json.dump({"reports": reports}, f, ensure_ascii=False, indent=1)
    print(f"얼린 보고서 {args.week} · {mb:.2f} MB · {dest}")
    if mb > 6:
        print("경고: 한 스냅샷이 6MB를 넘었습니다 — 자료를 줄이는 편이 좋습니다")


if __name__ == "__main__":
    main()
