#!/usr/bin/env python3
"""Live record: `feed` appends a line to <dir>/feed.jsonl, `loop` patches <dir>/loop.json,
`queue` upserts one experiment in <dir>/queue.json, `control` prints <dir>/control.json
(read at step boundaries only, never polled). Every line carries `plain`: 2-3 sentences a
child could follow -- no ids, no jargon. Stdlib only; flock append, atomic JSON patch.
"""
from __future__ import annotations

import argparse
import datetime
import fcntl
import json
import os
import re
import sys
import tempfile
from pathlib import Path

KINDS = ("event", "metric", "note", "decision", "error", "verdict")
STATUSES = ("확정", "미확인", "잡음")
NEEDS_PLAIN = ("metric", "note", "decision", "verdict", "error")
NODE_STATES = ("done", "running", "failed", "returned", "next", "blocked")
MODULE_STATES = ("done", "running", "waiting", "failed")
QUEUE_STATES = ("past", "running", "next")
IDPAT = re.compile(r"\b[A-Z]{1,3}\d{1,3}\b")            # G27, T3, R1
STEPPAT = re.compile(r"\bstep\s*\d+|\d+\s*단계", re.I)   # Step 8, 8단계
PLAIN_HINT = ("write 2-3 plain sentences a child could follow: what happened and what it"
              " means, no ids like G27/T3/Step 8, at most 400 characters")


def utc() -> str:
    return datetime.datetime.now(datetime.timezone.utc).isoformat(timespec="seconds")


def die(msg: str, hint: str, code: int = 2) -> None:
    print(f"error: {msg}\n  fix: {hint}", file=sys.stderr)
    raise SystemExit(code)


def check_plain(plain) -> str | None:
    """None if this `plain` is acceptable, else the reason it is not."""
    if not isinstance(plain, str) or not plain.strip():
        return "plain is empty"
    if len(plain) > 400:
        return f"plain is {len(plain)} characters (max 400)"
    m = IDPAT.search(plain) or STEPPAT.search(plain)
    return f"plain contains the id {m.group(0)!r}" if m else None


def patch(path: Path, fn) -> dict:
    """Read-modify-write one JSON object under a lock, replacing it atomically."""
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(str(path) + ".lock", "a") as lf:
        fcntl.flock(lf, fcntl.LOCK_EX)
        cur = json.loads(path.read_text()) if path.exists() else {}
        fn(cur)
        tmp = tempfile.NamedTemporaryFile("w", dir=str(path.parent), delete=False,
                                          encoding="utf-8")
        json.dump(cur, tmp, ensure_ascii=False, indent=2)
        tmp.close()
        os.replace(tmp.name, path)
    return cur


def mirror(line: dict) -> None:
    """Optional MLflow copy. An import or logging failure must never fail the emit."""
    if not os.environ.get("MLFLOW_TRACKING_URI"):
        return
    try:
        import mlflow
        for k, v in (line.get("numbers") or {}).items():
            if isinstance(v, (int, float)) and not isinstance(v, bool):
                mlflow.log_metric(str(k), float(v))
        if line.get("plain"):
            mlflow.set_tag(f"plain.{line['kind']}", line["plain"][:250])
    except Exception:
        pass


def feed(d: str, kind: str, stage: str, title: str, plain: str = "", week: str = "",
         body: str = "", status: str = "", numbers: dict | None = None,
         links: list | None = None, author: str = "agent") -> dict:
    """Validate one feed line and append it to <d>/feed.jsonl."""
    if kind not in KINDS:
        die(f"kind {kind!r} is unknown", "pick one of " + "/".join(KINDS))
    if (kind in NEEDS_PLAIN or plain) and (err := check_plain(plain)):
        die(f"{kind} line: {err}", PLAIN_HINT)
    if kind == "note" and not status:
        die("a note needs a status", "pass --status " + "|".join(STATUSES))
    if status and status not in STATUSES:
        die(f"status {status!r} is unknown", "use " + "|".join(STATUSES))
    line = {"ts": utc(), "week": week, "kind": kind, "stage": stage, "title": title,
            "plain": plain, "numbers": numbers or {}, "links": links or [], "author": author}
    line.update({k: v for k, v in (("body", body), ("status", status)) if v})
    p = Path(d) / "feed.jsonl"
    p.parent.mkdir(parents=True, exist_ok=True)
    with open(p, "a", encoding="utf-8") as fh:
        fcntl.flock(fh, fcntl.LOCK_EX)
        fh.write(json.dumps(line, ensure_ascii=False) + "\n")
        fcntl.flock(fh, fcntl.LOCK_UN)
    mirror(line)
    return line


def loop(d: str, **fields) -> dict:
    """Patch <d>/loop.json with {design, step, status, scores, rule, cause, back_to};
    a key this call does not name keeps its previous value."""
    keep = {k: v for k, v in fields.items() if v not in (None, "", {})}
    keep["updated"] = utc()
    return patch(Path(d) / "loop.json", lambda cur: cur.update(keep))


def queue(d: str, eid: str, state: str, **fields) -> dict:
    """Upsert one experiment row (id, state, why, how, pass_criterion, result)."""
    if state not in QUEUE_STATES:
        die(f"state {state!r} is unknown", "use " + "|".join(QUEUE_STATES))
    new = {k: v for k, v in fields.items() if v}

    def up(cur: dict) -> None:
        items = cur.setdefault("items", [])
        row = next((r for r in items if r.get("id") == eid), None)
        if row is None:
            items.append(row := {"id": eid})
        row.update(new, state=state)
    return patch(Path(d) / "queue.json", up)


def node(d: str, nid: str, state: str = "", module: str = "", module_state: str = "",
         one_line: str = "", number: str = "") -> dict:
    """Patch one box (and optionally one of its modules) in pipeline.json.

    The board reads pipeline.json; this is how a running step says where it is without a human
    editing the file. A key this call does not name keeps its previous value."""
    if state and state not in NODE_STATES:
        die(f"state {state!r} is unknown", "use " + "|".join(NODE_STATES))
    if module_state and module_state not in MODULE_STATES:
        die(f"module state {module_state!r} is unknown", "use " + "|".join(MODULE_STATES))

    def up(cur: dict) -> None:
        nodes = cur.setdefault("nodes", [])
        row = next((r for r in nodes if r.get("id") == nid), None)
        if row is None:
            nodes.append(row := {"id": nid, "label": nid})
        if state:
            row["state"] = state
        if one_line:
            row["one_line"] = one_line
        if number:
            row["number"] = number
        if module:
            mods = row.setdefault("modules", [])
            m = next((x for x in mods if x.get("id") == module), None)
            if m is None:
                mods.append(m := {"id": module, "label": module})
            if module_state:
                m["state"] = module_state
        cur["updated"] = utc()
    return patch(Path(d) / "pipeline.json", up)


def control(d: str) -> int:
    """<d>/control.json is the human's note back: a reordered queue or a stop request."""
    p = Path(d) / "control.json"
    print(p.read_text().rstrip() if p.exists() else f"no control file at {p} — nothing to apply")
    return 0


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("--dir", default="./.jev-loop/live/", help="where the live record lives")
    sub = ap.add_subparsers(dest="cmd", required=True)
    f = sub.add_parser("feed", help="append one line to feed.jsonl")
    f.add_argument("--kind", required=True, choices=KINDS)
    f.add_argument("--title", required=True)
    f.add_argument("--plain", default="", help="2-3 sentences a child could follow")
    f.add_argument("--status", default="", choices=("", *STATUSES))
    f.add_argument("--numbers", default="{}", help='JSON object of {name: value}')
    f.add_argument("--links", nargs="*", default=[])
    lp = sub.add_parser("loop", help="patch loop.json")
    lp.add_argument("--scores", default="{}")
    q = sub.add_parser("queue", help="upsert one experiment in queue.json")
    q.add_argument("--id", required=True); q.add_argument("--state", required=True,
                                                          choices=QUEUE_STATES)
    n = sub.add_parser("node", help="patch one box (and a module) in pipeline.json")
    n.add_argument("--id", required=True)
    n.add_argument("--state", default="", choices=("", *NODE_STATES))
    n.add_argument("--module", default="")
    n.add_argument("--module-state", default="", choices=("", *MODULE_STATES))
    sub.add_parser("control", help="print control.json if present (step boundaries only)")
    for p, opts in ((f, "stage week body author"), (lp, "design step status rule cause back-to"),
                    (q, "why how pass-criterion result title goal question exp"),
                    (n, "one-line number")):
        for o in opts.split():
            p.add_argument("--" + o, default="agent" if o == "author" else "")
    a = ap.parse_args()
    if a.cmd == "control":
        raise SystemExit(control(a.dir))
    out = (feed(a.dir, a.kind, a.stage, a.title, a.plain, a.week, a.body, a.status,
                json.loads(a.numbers), a.links, a.author) if a.cmd == "feed" else
           loop(a.dir, design=a.design, step=a.step, status=a.status,
                scores=json.loads(a.scores), rule=a.rule, cause=a.cause, back_to=a.back_to)
           if a.cmd == "loop" else
           node(a.dir, a.id, a.state, a.module, a.module_state, a.one_line, a.number)
           if a.cmd == "node" else
           queue(a.dir, a.id, a.state, why=a.why, how=a.how, pass_criterion=a.pass_criterion,
                 result=a.result, title=a.title, goal=a.goal, question=a.question, exp=a.exp))
    print(json.dumps(out, ensure_ascii=False))


if __name__ == "__main__":
    main()
