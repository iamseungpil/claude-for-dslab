#!/usr/bin/env python3
"""Plain-assert tests for emit.py. Run: python3 test_emit.py

No pytest, no network, no MLflow: MLFLOW_TRACKING_URI is never set here, so the mirror is
a no-op by construction.
"""
from __future__ import annotations

import json
import subprocess
import sys
import tempfile
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
import emit as em  # noqa: E402

FAILS: list[str] = []
OK = "실험을 한 번 돌렸고 점수가 조금 올라갔어요. 아직 한 번뿐이라 확실하지는 않아요."


def check(cond: bool, what: str) -> None:
    print(("  ok   " if cond else "  FAIL ") + what)
    if not cond:
        FAILS.append(what)


def run(args: list[str], d: Path) -> subprocess.CompletedProcess:
    return subprocess.run([sys.executable, str(HERE / "emit.py"), "--dir", str(d), *args],
                          capture_output=True, text=True)


def test_plain() -> None:
    print("plain validation")
    check(em.check_plain(OK) is None, "a plain Korean sentence passes")
    check(em.check_plain("") and "empty" in em.check_plain(""), "an empty plain is rejected")
    check(em.check_plain(None) is not None, "a missing plain is rejected")
    check("400" in (em.check_plain("가" * 401) or ""), "a plain over 400 characters is rejected")
    for jargon in ("G27 게이트를 넘었어요.", "T3 결과가 좋아요.", "Step 8 로 돌아갑니다.",
                   "8단계로 돌아갑니다."):
        check(em.check_plain(jargon) is not None, f"jargon is rejected: {jargon}")
    check(em.check_plain("심판이 7가지를 확인했고 2가지가 기준에 못 미쳤어요."
                         " 그래서 앞 단계로 돌아가요.") is None,
          "the templated Jev sentence passes its own check")


def test_feed() -> None:
    print("feed lines")
    with tempfile.TemporaryDirectory() as t:
        d = Path(t)
        em.feed(str(d), "note", "step8", "table read", OK, week="w3", status="미확인",
                numbers={"pass_rate": 0.42}, links=["docs/results.md"])
        line = json.loads((d / "feed.jsonl").read_text().splitlines()[-1])
        check(set(line) >= {"ts", "week", "kind", "stage", "title", "plain", "numbers",
                            "links", "author", "status"}, "the line carries the full schema")
        check(line["ts"].endswith("+00:00"), "the timestamp is UTC ISO")
        check(line["status"] == "미확인", "the note's status survives")
        em.feed(str(d), "event", "step7", "implementation started")
        check(len((d / "feed.jsonl").read_text().splitlines()) == 2,
              "an event needs no plain and the feed appends")
        for kind in ("metric", "note", "decision", "verdict", "error"):
            try:
                em.feed(str(d), kind, "s", "t", "", status="확정")
                check(False, f"{kind} without plain is rejected")
            except SystemExit as e:
                check(e.code == 2, f"{kind} without plain is rejected (exit 2)")
        try:
            em.feed(str(d), "note", "s", "t", OK)
            check(False, "a note without status is rejected")
        except SystemExit as e:
            check(e.code == 2, "a note without status is rejected (exit 2)")
        try:
            em.feed(str(d), "note", "s", "t", "G27 이 올랐어요.", status="확정")
            check(False, "jargon in plain is rejected")
        except SystemExit as e:
            check(e.code == 2, "jargon in plain is rejected (exit 2)")


def test_loop_and_queue() -> None:
    print("loop.json and queue.json")
    with tempfile.TemporaryDirectory() as t:
        d = Path(t)
        em.loop(str(d), step="8", status="back", scores={"quality": 4})
        em.loop(str(d), cause="impl_error", back_to="7")
        lp = json.loads((d / "loop.json").read_text())
        check(lp["step"] == "8" and lp["cause"] == "impl_error",
              "a patch keeps the fields it does not name")
        check(lp["scores"] == {"quality": 4} and "updated" in lp,
              "scores and the update stamp are kept")
        em.queue(str(d), "exp-04", "next", why="cheaper than the sweep", how="one seed")
        em.queue(str(d), "exp-04", "running", result="")
        em.queue(str(d), "exp-05", "past", result="no effect")
        items = json.loads((d / "queue.json").read_text())["items"]
        check(len(items) == 2, "an upsert does not duplicate the row")
        check(items[0]["state"] == "running" and items[0]["why"] == "cheaper than the sweep",
              "the state moves and the untouched fields stay")
        try:
            em.queue(str(d), "exp-06", "maybe")
            check(False, "an unknown queue state is rejected")
        except SystemExit as e:
            check(e.code == 2, "an unknown queue state is rejected (exit 2)")


def test_cli() -> None:
    print("cli")
    with tempfile.TemporaryDirectory() as t:
        d = Path(t)
        p = run(["control"], d)
        check(p.returncode == 0 and "no control file" in p.stdout,
              "control prints a hint when no control file exists")
        (d / "control.json").write_text(json.dumps({"stop": "exp-04"}))
        p = run(["control"], d)
        check(p.returncode == 0 and "exp-04" in p.stdout, "control prints the file when present")
        p = run(["feed", "--kind", "metric", "--title", "pass rate", "--plain", OK,
                 "--numbers", '{"pass_rate": 0.42}'], d)
        check(p.returncode == 0, f"a metric line is written (got {p.returncode}: {p.stderr})")
        check(json.loads(p.stdout)["numbers"]["pass_rate"] == 0.42, "numbers round-trip")
        p = run(["feed", "--kind", "metric", "--title", "pass rate", "--plain", "T3 가 올랐어요."],
                d)
        check(p.returncode == 2 and "plain" in p.stderr, "the cli rejects jargon with a hint")


def test_queue_extras_and_node() -> None:
    """queue 는 지도에 오를 칸(title·goal·question·exp)을 함께 적고, node 는 보드 상자를 고친다."""
    with tempfile.TemporaryDirectory() as t:
        d = Path(t)
        em.queue(str(d), "round-6", "running", title="6바퀴", goal="g1", question="q_auto",
                 exp="e12", why="회수율을 다시 잰다", how="", pass_criterion="", result="")
        row = json.loads((d / "queue.json").read_text())["items"][-1]
        check(row["title"] == "6바퀴" and row["goal"] == "g1" and row["question"] == "q_auto"
              and row["exp"] == "e12" and row["state"] == "running",
              "queue carries title/goal/question/exp so the new item lands on the map")

        em.node(str(d), "harness", state="running", one_line="5바퀴까지 2/4 회수", number="2 / 4")
        em.node(str(d), "harness", module="judge", module_state="running")
        doc = json.loads((d / "pipeline.json").read_text())
        box = next(n for n in doc["nodes"] if n["id"] == "harness")
        check(box["state"] == "running" and box["number"] == "2 / 4"
              and box["one_line"] == "5바퀴까지 2/4 회수", "node patches the box in place")
        check(next(m for m in box["modules"] if m["id"] == "judge")["state"] == "running",
              "node creates and patches a module inside the box")
        check(bool(doc.get("updated")), "node stamps pipeline.json with a time")

        p = run(["node", "--id", "x", "--state", "우물쭈물"], d)
        check(p.returncode == 2 and "state" in p.stderr,
              "an unknown box state is refused — the board must not colour a lie")


def main() -> None:
    for fn in (test_plain, test_feed, test_loop_and_queue, test_queue_extras_and_node, test_cli):
        fn()
    print(f"\n{'FAILED: ' + '; '.join(FAILS) if FAILS else 'all checks passed'}")
    raise SystemExit(1 if FAILS else 0)


if __name__ == "__main__":
    main()
