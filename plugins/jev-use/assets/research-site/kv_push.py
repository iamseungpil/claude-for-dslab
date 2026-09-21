#!/usr/bin/env python3
"""라이브 자료를 Cloudflare KV 로 밀어 넣는다(그리고 사람이 남긴 제어 문서를 끌어온다).

  python research-site/kv_push.py --config site.config.json            # 밀어 넣기
  python research-site/kv_push.py --config site.config.json --pull-control   # 제어 문서 받아오기

표준 라이브러리만 쓴다. 토큰은 환경변수 CLOUDFLARE_API_TOKEN 에서 읽고 절대 찍지 않는다.
사이트가 Cloudflare Access 뒤에 있어 공개 쓰기 엔드포인트를 두지 않는다 — 쓰는 쪽은 이 스크립트뿐이다.
"""
import argparse, json, os, sys, urllib.request

API = "https://api.cloudflare.com/client/v4"
FEED_TAIL = 200


def kv(method, account, ns, key, data=None):
    token = os.environ.get("CLOUDFLARE_API_TOKEN") or os.environ.get("CF_API_TOKEN")
    if not token:
        sys.exit("CLOUDFLARE_API_TOKEN 이 환경에 없습니다")
    url = f"{API}/accounts/{account}/storage/kv/namespaces/{ns}/values/{key}"
    req = urllib.request.Request(url, method=method, data=data)
    req.add_header("Authorization", "Bearer " + token)
    if data is not None:
        req.add_header("Content-Type", "text/plain")
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            return r.read()
    except urllib.error.HTTPError as e:
        if method == "GET" and e.code == 404:
            return None
        sys.exit(f"KV {method} {key} 실패: HTTP {e.code}")


def payload(root, cfg):
    """사이트가 읽는 모양 그대로 만든다 — 화면은 정적 live.json 과 같은 구조를 받는다."""
    live_dir = os.path.join(root, "docs", "discovery", "live")
    out = {}
    feed = []
    fp = os.path.join(live_dir, "feed.jsonl")
    if os.path.exists(fp):
        with open(fp) as f:
            lines = [l.strip() for l in f if l.strip()]
        for l in lines[-FEED_TAIL:]:
            try:
                feed.append(json.loads(l))
            except json.JSONDecodeError:
                pass
    feed.sort(key=lambda x: x.get("ts") or "", reverse=True)
    out["feed"] = feed
    out["updated"] = feed[0].get("ts") if feed else None
    for name, path in (("loop", os.path.join(live_dir, "loop.json")),
                       ("queue", os.path.join(live_dir, "queue.json")),
                       ("bank", os.path.join(root, "deepswe", "k2lab", "runs", "proposer", "bank_public.json"))):
        if os.path.exists(path):
            with open(path) as f:
                out[name] = json.load(f)
    # 진행 중 실험 패널과 지도는 빌드가 쓰는 계산을 그대로 쓴다(있으면).
    built = os.path.join(root, cfg.get("out", "site/data"), "live.json")
    if os.path.exists(built):
        with open(built) as f:
            base = json.load(f)
        for k in ("panels", "map", "now", "kinds_ko", "pipeline", "lint_ok"):
            if k in base:
                out.setdefault(k, base[k])
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--config", default="site.config.json")
    ap.add_argument("--pull-control", action="store_true")
    args = ap.parse_args()
    root = os.path.dirname(os.path.abspath(args.config)) or "."
    with open(args.config) as f:
        cfg = json.load(f)
    kvcfg = cfg.get("kv") or {}
    account, ns = kvcfg.get("account_id"), kvcfg.get("namespace_id")
    if not account or not ns:
        sys.exit("site.config.json 의 kv.account_id / kv.namespace_id 가 필요합니다")
    if args.pull_control:
        raw = kv("GET", account, ns, "control")
        dest = os.path.join(root, "docs", "discovery", "live", "control.json")
        with open(dest, "w") as f:
            f.write((raw or b"{}").decode())
        print("control ->", dest, len(raw or b""), "bytes")
        return
    body = json.dumps(payload(root, cfg), ensure_ascii=False).encode()
    kv("PUT", account, ns, "live", body)
    print(f"KV live 갱신 {len(body)} bytes · 기록 {len(json.loads(body)['feed'])}줄")


if __name__ == "__main__":
    main()
