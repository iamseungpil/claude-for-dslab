#!/usr/bin/env python3
"""설정 하나(site.config.json)와 시행 표 하나를 읽어 연구판이 읽는 정적 JSON을 만든다.

  python research-site/build_site_data.py site.config.json [--out site/data]

여기에는 어떤 연구 주제도 들어 있지 않다. 주제별 계산(층별 통과율·오류 서명 같은 것)은
설정의 `prepare` 가 가리키는 파이썬 모듈이 맡고, 이 파일은 그 결과를 합쳐 담기만 한다.

내보내는 것 (data/):
  meta.json  — 제목·주차·열·결과 종류·필터 항목(값과 건수까지)
  rows.json  — 과제 한 개 = 한 줄, 모델 한 개 = 한 칸
  stats.json — 질문 블록(prepare가 만든다)
  live.json  — 루프·피드·큐·가설 창고 (설정의 live 경로를 그대로 담는다)
표준 라이브러리만 쓰고 모델 호출도 네트워크 접근도 하지 않는다. 다시 돌려도 같은 결과가 나온다.
"""
import argparse, collections, datetime, importlib.util, json, os, sys

BUILT = datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%d %H:%M UTC")


def load_json(path, default=None):
    if not os.path.exists(path):
        return default
    with open(path) as f:
        return json.load(f)


def load_jsonl(path):
    if not os.path.exists(path):
        return None
    out = []
    with open(path) as f:
        for line in f:
            line = line.strip()
            if line:
                out.append(json.loads(line))
    return out


def load_module(path, name="prepare_hook"):
    spec = importlib.util.spec_from_file_location(name, path)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


def week_of(cfg, value):
    """시행의 날짜 같은 값 → 주차 id. 범위에 없으면 빈 문자열(주차 선택에서 빠진다)."""
    d = str(value or "")[:10]
    for w in cfg.get("weeks", []):
        if w.get("from", "") <= d <= w.get("to", "9999"):
            return w["id"]
    return ""


def get(row, field, default=None):
    return row.get(field, default) if field else default


def build_rows(cfg, trials):
    """시행들을 과제 줄로 접는다. 한 줄의 열쇠는 cfg.row.key, 한 칸의 열쇠는 cfg.matrix.column_field."""
    rowcfg, mat, cellcfg = cfg["row"], cfg["matrix"], cfg.get("cell", {})
    colf, outf = mat["column_field"], mat["outcome_field"]
    passv = mat.get("pass_outcome")
    href = cellcfg.get("href_template")
    kvspec = cellcfg.get("kv", [])
    cell_fields = cellcfg.get("fields", {})
    rows = {}
    for t in trials:
        if not t.get(colf) or not t.get(outf):
            continue
        key = "|".join(str(t.get(k, "")) for k in rowcfg["key"])
        r = rows.get(key)
        if r is None:
            r = rows[key] = {"k": key, "cells": {}}
            for name, field in rowcfg["fields"].items():
                r[name] = t.get(field)
            r["task_short"] = str(r.get("task") or "")[-46:]
        cell = {"o": t[outf]}
        for name, field in cell_fields.items():
            v = t.get(field)
            if v not in (None, "", []):
                cell[name] = v
        if cellcfg.get("error_field") and t.get(cellcfg["error_field"]):
            cell["e"] = " ".join(str(t[cellcfg["error_field"]]).split())[:400]
        if href and t.get(cellcfg.get("id_field", "id")):
            cell["h"] = href.format(id=t[cellcfg.get("id_field", "id")])
        # 이름은 meta.kv_labels에 한 번만 두고 칸에는 번호만 적는다 (같은 이름 5천 번을 반복하지 않게)
        kv = [[i, t.get(s["field"])] for i, s in enumerate(kvspec) if t.get(s["field"]) not in (None, "")]
        if kv:
            cell["kv"] = kv
        r["cells"][t[colf]] = cell
    out = []
    for r in rows.values():
        r["n_models"] = len(r["cells"])
        r["solvers"] = sum(1 for c in r["cells"].values() if c["o"] == passv)
        out.append(r)
    # 저장소별로 번갈아 놓는다 — 알파벳순으로 두면 첫 화면이 한 저장소로만 차서 시험지를 오해한다.
    out.sort(key=lambda r: (str(r.get("week") or ""), str(r.get("repo") or ""), str(r.get("task") or "")))
    seen = collections.Counter()
    for r in out:
        r["_i"] = seen[(r.get("week"), r.get("repo"))]
        seen[(r.get("week"), r.get("repo"))] += 1
    out.sort(key=lambda r: (str(r.get("week") or ""), r["_i"], str(r.get("repo") or "")))
    for r in out:
        r.pop("_i", None)
    return out


def _vals(x):
    return x if isinstance(x, list) else [] if x in (None, "") else [x]


def match_rows(cfg, rows, patch, facets_by_key):
    """필터 patch(=화면과 같은 규칙) 에 맞는 과제 줄. 대표 사례를 고르는 데 쓴다."""
    focus = patch.get(cfg["matrix"].get("focus_facet"))
    out = []
    for r in rows:
        ok = True
        cell_reqs = {}
        for k, v in patch.items():
            if k == "week":
                ok = ok and str(r.get("week")) == str(v)
                continue
            f = facets_by_key.get(k)
            if not f or k == cfg["matrix"].get("focus_facet"):
                continue
            if f.get("scope") == "cell":
                cell_reqs[f["field"]] = v
            else:
                ok = ok and str(v) in [str(x) for x in _vals(r.get(f["field"]))]
            if not ok:
                break
        if not ok:
            continue
        cells = [(focus, r["cells"].get(focus))] if focus else list(r["cells"].items())
        hit = [m for m, c in cells if c and all(str(vv) in [str(x) for x in _vals(c.get(ff))]
                                                for ff, vv in cell_reqs.items())]
        if cell_reqs and not hit:
            continue
        out.append((r, hit[0] if hit else (focus or next(iter(r["cells"]), ""))))
    return out


def resolve_cases(cfg, rows, facets_by_key, patch, n=3, label=""):
    """patch → 대표 사례 몇 개 (줄 열쇠 + 모델). 정렬이 고정돼 있어 다시 돌려도 같은 것이 나온다."""
    hits = match_rows(cfg, rows, patch, facets_by_key)
    out = []
    for r, m in hits[:n]:
        out.append({"label": label or (r.get("task_short") or r.get("task")),
                    "task": r.get("task_short") or r.get("task"), "k": r["k"], "model": m,
                    "title": (r.get("title") or "")[:60],
                    "repo": r.get("repo"), "outcome": (r["cells"].get(m) or {}).get("o")})
    return {"n": len(hits), "cases": out, "patch": patch}


def facet_values(cfg, rows, facet):
    """필터 항목의 값 목록과 건수. 설정이 values를 직접 주면 그것을 쓰고, 아니면 자료에서 센다."""
    if facet.get("values"):
        return facet["values"]
    counter = collections.Counter()
    for r in rows:
        if facet.get("scope") == "cell":
            for c in r["cells"].values():
                v = c.get(facet["field"])
                for x in (v if isinstance(v, list) else [v]):
                    if x not in (None, ""):
                        counter[str(x)] += 1
        else:
            v = r.get(facet["field"])
            for x in (v if isinstance(v, list) else [v]):
                if x not in (None, ""):
                    counter[str(x)] += 1
    order = facet.get("order")
    labels = facet.get("map", {})
    items = sorted(counter.items(), key=lambda kv: (order.index(kv[0]) if order and kv[0] in order else 999, -kv[1]))
    return [[v, labels.get(v, v), n] for v, n in items]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("config")
    ap.add_argument("--out", default=None)
    ap.add_argument("--root", default=None, help="상대 경로의 기준 (기본: 설정 파일이 있는 폴더)")
    args = ap.parse_args()
    cfg = load_json(args.config)
    if cfg is None:
        sys.exit(f"설정을 찾을 수 없습니다: {args.config}")
    root = args.root or os.path.dirname(os.path.abspath(args.config)) or "."
    out_dir = args.out or os.path.join(root, cfg.get("out", "site/data"))
    os.makedirs(out_dir, exist_ok=True)
    rel = lambda p: p if os.path.isabs(p) else os.path.join(root, p)

    trials = load_json(rel(cfg["input"]["trials"]))
    if trials is None:
        sys.exit(f"시행 표가 없습니다: {cfg['input']['trials']}")
    if isinstance(trials, dict):
        trials = trials.get("rows") or trials.get("trials") or []

    hook = load_module(rel(cfg["prepare"])) if cfg.get("prepare") else None
    if hook and hasattr(hook, "enrich"):
        trials = hook.enrich(root, trials, cfg)

    wf = cfg.get("week_field")
    if wf:
        for t in trials:
            t["_week"] = week_of(cfg, t.get(wf))
        trials = [t for t in trials if t["_week"] or not cfg.get("drop_undated", True)]

    rows = build_rows(cfg, trials)
    wlabel = {w["id"]: w["label"] for w in cfg.get("weeks", [])}
    for r in rows:
        r["week_label"] = wlabel.get(r.get("week"), r.get("week"))

    focus_key = cfg["matrix"].get("focus_facet")
    col_counts = collections.Counter(c for r in rows for c in r["cells"])
    facets = []
    for f in cfg["facets"]:
        g = dict(f)
        if g["key"] == focus_key:   # 기준 모델 항목의 값은 행렬의 열 그대로다
            labels = cfg["matrix"].get("col_labels", {})
            g["values"] = [[c, labels.get(c, c), n] for c, n in col_counts.most_common()]
        elif g.get("type", "enum") == "enum":
            g["values"] = facet_values(cfg, rows, g)
        g.pop("map", None)
        g.pop("order", None)
        facets.append(g)

    mat = dict(cfg["matrix"])
    cols = mat.get("columns")
    if not cols:
        counter = collections.Counter(c for r in rows for c in r["cells"])
        cols = [c for c, _ in counter.most_common()]
    mat["columns"] = cols
    meta = {"title": cfg.get("title", "연구판"), "built_at": BUILT, "links": cfg.get("links", []),
            "weeks": [{k: w.get(k) for k in ("id", "label", "legacy", "range")} for w in cfg.get("weeks", [])],
            "facets": facets, "matrix": mat, "presets": cfg.get("presets", []),
            "kv_labels": [s["label"] for s in cfg.get("cell", {}).get("kv", [])],
            "n_rows": len(rows), "n_trials": len(trials)}

    blocks = []
    if hook and hasattr(hook, "blocks"):
        blocks = hook.blocks(root, rows, trials, cfg)
    # 블록·주차 카드가 적어 둔 case_patch 를 실제 사례(줄 열쇠 + 모델)로 바꾼다 — 화면은 링크만 그린다.
    fbk = {f["key"]: f for f in facets}
    for b in blocks:
        if b.get("case_patch"):
            b["cases"] = resolve_cases(cfg, rows, fbk, b.pop("case_patch"))
    weekly = load_json(rel(cfg["weekly"])) if cfg.get("weekly") else None
    cards = (weekly or {}).get("weeks", [])
    for c in cards:
        for cs in c.get("cases", []):
            if cs.get("patch"):
                cs["resolved"] = resolve_cases(cfg, rows, fbk, cs["patch"], 3, cs.get("label", ""))

    live = {"updated": BUILT}
    if hook and hasattr(hook, "live"):
        live = hook.live(root, cfg) or live
    else:
        for name, path in (cfg.get("live") or {}).items():
            p = rel(path)
            live[name] = load_jsonl(p) if p.endswith(".jsonl") else load_json(p)

    dump(out_dir, "meta.json", meta)
    dump(out_dir, "rows.json", {"built_at": BUILT, "rows": rows})
    dump(out_dir, "stats.json", {"built_at": BUILT, "blocks": blocks,
                                 "weekly": cards, "weekly_note": (weekly or {}).get("note", "")})
    dump(out_dir, "live.json", live)
    miss = sum(1 for b in blocks if b.get("missing"))
    print(f"과제 {len(rows)}줄 · 시행 {len(trials)}건 · 열 {len(cols)}개 · 질문 {len(blocks)}개"
          f"{f' (자료 없음 {miss}개)' if miss else ''}")
    for name in ("meta.json", "rows.json", "stats.json", "live.json"):
        print(f"  {name}: {os.path.getsize(os.path.join(out_dir, name)) / 1e6:.2f} MB")


def scrub(o):
    """JSON에 없는 값(NaN·Infinity)을 null로 바꾼다 — 원본이 pandas에서 왔으면 섞여 들어온다."""
    if isinstance(o, float):
        return o if o == o and abs(o) != float("inf") else None
    if isinstance(o, dict):
        return {k: scrub(v) for k, v in o.items()}
    if isinstance(o, (list, tuple)):
        return [scrub(v) for v in o]
    return o


def dump(out_dir, name, obj):
    with open(os.path.join(out_dir, name), "w") as f:
        json.dump(scrub(obj), f, ensure_ascii=False, separators=(",", ":"), allow_nan=False)


if __name__ == "__main__":
    main()
