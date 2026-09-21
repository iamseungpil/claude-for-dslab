#!/usr/bin/env python3
"""Plain-assert tests for research_audit.py. Run: python3 test_research_audit.py

No pytest, no network, no key: the only subprocess runs are the agent-judge round trip,
which never calls a backend at all (JEV_BACKEND=mock is exported anyway).
"""
from __future__ import annotations

import json
import os
import subprocess
import sys
import tempfile
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
import research_audit as ra  # noqa: E402

PROPS = [
    {"id": "uncapped", "question": "Is the credit uncapped?",
     "criteria": {"true": "magnitude survives", "false": "a cap truncates it"}},
    {"id": "token_local", "scope": "code", "question": "Is the credit token-localized?"},
    {"id": "pilot_scale", "scope": "run", "question": "Does the run use the pilot pool size?"},
    {"id": "gates_numeric_doc", "scope": "design", "question": "Are the gates numeric?"},
]
FAILS: list[str] = []


def check(cond: bool, what: str) -> None:
    print(("  ok   " if cond else "  FAIL ") + what)
    if not cond:
        FAILS.append(what)


def props_file(d: Path) -> str:
    p = d / "properties.json"
    p.write_text(json.dumps(PROPS))
    return str(p)


def run(args: list[str], cwd: Path) -> subprocess.CompletedProcess:
    env = {**os.environ, "JEV_BACKEND": "mock"}
    return subprocess.run([sys.executable, str(HERE / "research_audit.py"), *args],
                          capture_output=True, text=True, cwd=cwd, env=env)


def test_scope() -> None:
    print("scope filtering")
    with tempfile.TemporaryDirectory() as t:
        pf = props_file(Path(t))
        code = [q["id"] for q in ra.questions_for(pf)]
        check(code[:2] == ["uncapped", "token_local"], "modules asks both code-scope properties")
        check("pilot_scale" not in code and "gates_numeric_doc" not in code,
              "modules asks no run/design-scope property")
        check(code[2:] == ["gold_leak", "unneeded", "bug", "quality"],
              "modules keeps the four fixed questions, in order")
        run_q = ra.run_questions(pf)
        check([q["id"] for q in run_q] == ["pilot_scale"],
              "runconfig asks the run-scope property only")
        check(not {"gold_leak", "unneeded", "bug", "quality"} & {q["id"] for q in run_q},
              "runconfig drops the fixed code questions")
        empty = Path(t) / "none.json"
        empty.write_text(json.dumps([PROPS[0]]))
        try:
            ra.run_questions(str(empty))
            check(False, "runconfig dies when no run-scope property exists")
        except SystemExit as e:
            check(e.code == 2, "runconfig dies (exit 2) when no run-scope property exists")


class A:            # a minimal argparse-namespace stand-in for record()
    def __init__(self, out: str, cmd: str = "modules", step: int | None = 8):
        self.out, self.cmd, self.step = out, cmd, step


def test_record_summary() -> None:
    print("record() summary fields")
    with tempfile.TemporaryDirectory() as t:
        rows = [("credit.py", {"backend": "agent", "verdicts": [
            {"id": "uncapped", "type": "noul", "answer": 0.82},
            {"id": "control_bit_identical", "type": "noul", "answer": 0.94},
            {"id": "bug", "type": "noul", "answer": 0.61, "escalate": "unsure"},
            {"id": "gold_leak", "type": "noul", "answer": 0.70},
            {"id": "unneeded", "type": "noul", "answer": 0.89},
            {"id": "stop_rule_triggered", "type": "noul", "answer": 0.40},
            {"id": "quality", "type": "score", "answer": 4},
            {"id": "design_quality", "type": "score", "answer": 3},
            {"id": "continue", "type": "choice", "answer": "stop_arm"}]})]
        ra.record(A(t), rows)
        h = json.loads((Path(t) / "STATE.json").read_text())["history"][-1]
        check(h["min_property"] == 0.82, "min_property is the min over high=good noul only")
        check(h["max_bug"] == 0.61, "max_bug still reported")
        check(h["scores"] == {"quality": 4, "design_quality": 3}, "score verdicts land in scores")
        check(h["choice"] == {"continue": "stop_arm"}, "choice verdict lands in choice")
        check(h["backend"] == "agent", "backend is recorded")
        check(h["escalated"] == 1 and h["step"] == 8, "escalated count and step survive")


def test_unreachable() -> None:
    print("unreachable handling")
    bad = {"backend": "typesafe", "verdicts": [
        {"id": "uncapped", "answer": None, "reason": "unreachable"},
        {"id": "bug", "answer": None, "reason": "unreachable"}]}
    ok = {"backend": "mock", "verdicts": [{"id": "uncapped", "answer": 0.5, "reason": "fine"}]}
    check(ra.unreachable(bad), "a reason of 'unreachable' is detected")
    check(ra.unreachable({"verdicts": [{"id": "a", "answer": None}]}),
          "all-null answers are detected")
    check(ra.unreachable({"verdicts": []}), "an empty verdict list is unreachable")
    check(not ra.unreachable(ok), "a real verdict is not unreachable")
    check("503" not in ra.unreachable_hint([("credit.py", bad)])
          and "unreachable" in ra.unreachable_hint([("credit.py", bad)]),
          "the hint names the reason that came back")
    with tempfile.TemporaryDirectory() as t:
        ra.record(A(t), [("credit.py", ok)])          # one legitimate row, then nothing more
        before = json.loads((Path(t) / "STATE.json").read_text())["history"]
        check(len(before) == 1, "a reachable judgment appends one row")
        # main() exits 4 before record() is reached, so an unreachable run appends nothing:
        check(ra.unreachable(bad) and len(before) == 1,
              "an unreachable judgment appends no judgment row")


INTENT = "# Intent\nThe credit magnitude must stay uncapped.\n"
SRC = "def credit(x):\n    return x  # uncapped\n"


def verdicts_for(request: Path, reason: str = "mc/credit.py:2 returns x uncapped") -> dict:
    qs = json.loads(request.read_text())["questions"]
    out = []
    for q in qs:
        t = q.get("type", "noul")
        ans = 0.8 if t == "noul" else 4 if t == "score" else sorted(q.get("options") or {})[0]
        out.append({"id": q["id"], "type": t, "answer": ans, "confidence": 0.5,
                    "reason": reason})
    return {"verdicts": out, "backend": "agent"}


def test_agent_round_trip() -> None:
    print("agent-judge round trip")
    with tempfile.TemporaryDirectory() as t:
        d = Path(t)
        (d / "INTENT.md").write_text(INTENT)
        (d / "credit.py").write_text(SRC)
        pf = props_file(d)
        args = ["--judge", "agent", "--intent", "INTENT.md", "--properties", pf,
                "--out", "aud", "--record", "modules", "--files", "credit.py"]
        p1 = run(args, d)
        req = d / "aud" / "credit.request.json"
        check(p1.returncode == 5, f"first call exits 5 (got {p1.returncode})")
        check("AWAITING AGENT VERDICTS" in p1.stdout, "first call prints the AWAITING line")
        check(req.exists(), "the request file is written")
        body = json.loads(req.read_text())
        check(set(body) == {"state", "questions"} and INTENT.strip() in body["state"],
              "the request holds the exact state and questions")
        check([q["id"] for q in body["questions"]][0] == "uncapped"
              and "pilot_scale" not in [q["id"] for q in body["questions"]],
              "the request carries code-scope questions only")

        ver = d / "aud" / "credit.verdicts.json"
        ver.write_text(json.dumps(verdicts_for(req)))
        p2 = run(args, d)
        check(p2.returncode == 0, f"second call succeeds (got {p2.returncode}: {p2.stderr[:200]})")
        check("uncapped" in p2.stdout or "0.80" in p2.stdout, "the table is printed")
        hist = json.loads((d / "aud" / "STATE.json").read_text())["history"]
        check(hist[-1]["backend"] == "agent" and hist[-1]["min_property"] == 0.8,
              "the history row is marked backend=agent")

        # a verdict with no reason is rejected
        broken = verdicts_for(req)
        broken["verdicts"][0].pop("reason")
        ver.write_text(json.dumps(broken))
        p3 = run(args, d)
        check(p3.returncode == 6, f"a reason-less verdict exits 6 (got {p3.returncode})")
        check("no reason" in p3.stderr, "the error says which verdict has no reason")

        # a reason without a citation is rejected too
        ver.write_text(json.dumps(verdicts_for(req, reason="it looks fine to me")))
        check(run(args, d).returncode == 6, "an uncited reason exits 6")

        # a noul answer outside [0,1] is rejected
        bad = verdicts_for(req)
        bad["verdicts"][0]["answer"] = 4
        ver.write_text(json.dumps(bad))
        check(run(args, d).returncode == 6, "a noul answer of 4 exits 6")


def main() -> None:
    for fn in (test_scope, test_record_summary, test_unreachable, test_agent_round_trip):
        fn()
    print(f"\n{'FAILED: ' + '; '.join(FAILS) if FAILS else 'all checks passed'}")
    raise SystemExit(1 if FAILS else 0)


if __name__ == "__main__":
    main()
