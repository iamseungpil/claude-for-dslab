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


def test_design_questions() -> None:
    print("design questions")
    ids = [q["id"] for q in ra.DESIGN_Q]
    for q in ("novelty_stated", "novelty_vs_named_prior", "expected_effect_grounded",
              "cost_benefit_stated", "cheapest_first", "pipeline_contract_kept"):
        check(q in ids, f"design asks {q}")
    for q in ra.DESIGN_Q:
        check(set(q.get("criteria") or {}) == {"true", "false"}, f"{q['id']} has both criteria")
    check(all(q["id"] not in ra.HIGH_BAD for q in ra.DESIGN_Q),
          "every design question is high=good")
    check(ra.NUMBERS_KO.get("pipeline_contract_kept") == "파이프라인 계약 준수",
          "pipeline_contract_kept has its Korean label")
    check("contract_metric_used" in [q["id"] for q in ra.RESULT_Q],
          "results asks contract_metric_used")
    check(ra.NUMBERS_KO.get("contract_metric_used") == "계약 지표 사용",
          "contract_metric_used has its Korean label")


def test_pipeline_contract_heading() -> None:
    print("Contract check heading is a mandatory design heading")
    check("Contract check" in ra.MANDATORY_DESIGN_HEADINGS,
          "Contract check is in the mandatory heading list")
    without = "## Intent link\nfoo\n"
    missing = ra.missing_headings(without, headings=("Intent link", "Contract check"))
    check(missing == ["Contract check"],
          "a design text without the heading is flagged by missing_headings")
    withit = "## Intent link\nfoo\n## Contract check\n| step | where | deviation |\n"
    check(ra.missing_headings(withit, headings=("Intent link", "Contract check")) == [],
          "a design text with the heading is not flagged")


def test_impl_questions() -> None:
    print("implementation-audit questions")
    check("duplicates_existing" in ra.HIGH_BAD and "repeats_failed_impl" in ra.HIGH_BAD,
          "duplicates_existing and repeats_failed_impl are high=bad")
    check("clean_code" not in ra.HIGH_BAD and "plan_coverage" not in ra.HIGH_BAD,
          "clean_code and plan_coverage are high=good")
    check("file:line" in ra.CLEAN_CODE["criteria"]["false"],
          "clean_code demands a file:line in the reason")
    check("plan item ids" in ra.PLAN_COVERAGE["criteria"]["false"],
          "plan_coverage demands the missing plan item ids")
    with tempfile.TemporaryDirectory() as t:
        d = Path(t)
        (d / "a.py").write_text("def alpha():\n    pass\nclass Beta:\n    pass\n")
        (d / "sub").mkdir(); (d / "sub" / "b.py").write_text("def gamma():\n    pass\n")
        (d / "broken.py").write_text("def (:\n")
        idx = ra.sig_index(str(d))
        check("alpha" in idx and "Beta" in idx and "gamma" in idx, "the index names def/class")
        check("broken" not in idx, "an unparsable file is skipped")
        big = d / "big.py"
        big.write_text("".join(f"def f{i}():\n    pass\n" for i in range(4000)))
        capped = ra.sig_index(str(d), cap=500)
        check(len(capped) <= 540 and "truncated" in capped, "the index is capped and says so")


class M:            # the `modules` namespace, enough for audit_extras()
    def __init__(self, **kw):
        self.__dict__.update({"plan": None, "package_root": None, "failed_impls": None, **kw})


def test_audit_extras() -> None:
    print("audit extras and their inputs")
    with tempfile.TemporaryDirectory() as t:
        d = Path(t)
        ids = [q["id"] for q in ra.audit_extras(M())]
        check(ids == ["clean_code"], "without inputs only clean_code is asked")
        check(ra.EXTRA == "", "no extra state without inputs")
        (d / "pkg").mkdir(); (d / "pkg" / "x.py").write_text("def already_here():\n    pass\n")
        led = d / "failed.txt"
        led.write_text("2026-09-01 a clamp on credit; it erased the magnitude\n")
        ids = [q["id"] for q in ra.audit_extras(M(package_root=str(d / "pkg"),
                                                  failed_impls=str(led)))]
        check(ids == ["clean_code", "duplicates_existing", "repeats_failed_impl"],
              "both inputs add their question")
        check("already_here" in ra.EXTRA, "the signature index reaches the state")
        check("erased the magnitude" in ra.EXTRA, "the failed-impls text reaches the state")
        try:
            ra.audit_extras(M(failed_impls=str(d / "nope.txt")))
            check(False, "a missing ledger dies")
        except SystemExit as e:
            check(e.code == 2, "a missing failed-impls ledger dies (exit 2) with a hint")
        ra.EXTRA = ""


def answer(d: Path, tag: str, plain: str | None = None, value: float = 0.8,
           flip: bool = False) -> None:
    """Write a verdicts file answering whatever the request asked for. `flip` answers the
    high=bad ids with 1-value, i.e. a clean run instead of a failing one."""
    req = d / "aud" / f"{tag}.request.json"
    out = verdicts_for(req)
    for v, q in zip(out["verdicts"], json.loads(req.read_text())["questions"]):
        if q.get("type", "noul") == "noul":
            v["answer"] = round(1 - value, 2) if flip and q["id"] in ra.HIGH_BAD else value
    if plain is not None:
        out["plain"] = plain
    (d / "aud" / f"{tag}.verdicts.json").write_text(json.dumps(out, ensure_ascii=False))


def bed(d: Path) -> list[str]:
    """A tiny repo: intent, one module, a plan, a package to index, a ledger."""
    (d / "INTENT.md").write_text(INTENT)
    (d / "credit.py").write_text(SRC)
    (d / "plan.md").write_text("- M1 credit hook\n- M2 grader\n")
    (d / "pkg").mkdir(exist_ok=True)
    (d / "pkg" / "x.py").write_text("def already_here():\n    pass\n")
    (d / "failed.txt").write_text("2026-09-01 a clamp; it erased the magnitude\n")
    return ["--judge", "agent", "--intent", "INTENT.md", "--out", "aud"]


def test_plan_coverage_gate() -> None:
    print("plan_coverage is asked only with --plan")
    with tempfile.TemporaryDirectory() as t:
        d = Path(t)
        args = bed(d) + ["modules", "--files", "credit.py"]
        p = run(args, d)
        check(p.returncode == 5 and "plan_coverage skipped" not in p.stdout,
              "the first call still awaits the module verdicts")
        answer(d, "credit")
        p = run(args, d)
        check("plan_coverage skipped" in p.stdout and "--plan" in p.stdout,
              "without --plan the question is skipped with a hint")
        check(not (d / "aud" / "plan_coverage.request.json").exists(),
              "no plan_coverage request is written without --plan")
        check("duplicates_existing skipped" in p.stdout
              and "repeats_failed_impl skipped" in p.stdout,
              "the other two are skipped with hints too")

        args2 = bed(d) + ["modules", "--files", "credit.py", "--plan", "plan.md",
                          "--package-root", "pkg", "--failed-impls", "failed.txt"]
        run(args2, d)                      # rewrites the request with the extra questions
        answer(d, "credit")
        p = run(args2, d)
        check(p.returncode == 5 and (d / "aud" / "plan_coverage.request.json").exists(),
              "with --plan the plan_coverage request is written")
        req = json.loads((d / "aud" / "credit.request.json").read_text())
        check([q["id"] for q in req["questions"]][-4:-1]
              == ["clean_code", "duplicates_existing", "repeats_failed_impl"],
              "the module request carries the three per-module additions")
        check("already_here" in req["state"] and "erased the magnitude" in req["state"],
              "signature index and ledger are in the module state")
        pc = json.loads((d / "aud" / "plan_coverage.request.json").read_text())
        check([q["id"] for q in pc["questions"]] == ["plan_coverage"]
              and "M2 grader" in pc["state"] and "credit.py" in pc["state"],
              "plan_coverage is asked once, against the plan and the file list")


def test_verdict_title_and_labels() -> None:
    """판정 줄의 제목은 '<단계> 판정: <문서>' 이고, 숫자 항목에는 한국어 이름표가 붙는다."""
    import research_audit as ra
    check(ra.verdict_title("design", ["design.design_v4"]) == "설계 판정: design_v4",
          "a design verdict says 설계 판정 with the document stem, not 'design design'")
    check(ra.verdict_title("results", ["results.round5"]) == "결과 판정: round5",
          "every judged step has a Korean step name")
    for qid, ko in (("intent_consistent", "의도 부합"), ("no_leakage", "누출"),
                    ("design_quality", "설계 품질")):
        check(ra.NUMBERS_KO.get(qid) == ko, f"{qid} has the Korean label {ko}")


def test_emit_integration() -> None:
    print("--emit writes a verdict line and patches loop.json")
    with tempfile.TemporaryDirectory() as t:
        d = Path(t)
        args = bed(d) + ["--emit", "live", "--step", "8", "modules", "--files", "credit.py"]
        run(args, d)
        answer(d, "credit")                              # no "plain" yet
        p = run(args, d)
        check(p.returncode == 6, f"agent verdicts without plain exit 6 (got {p.returncode})")
        check("plain is empty" in p.stderr and "plain" in p.stderr,
              "the error hints at the missing plain")
        answer(d, "credit", plain="코드를 한 줄씩 살펴봤어요. 걱정할 곳은 없었어요.")
        p = run(args, d)
        check(p.returncode == 0, f"with plain the run succeeds (got {p.returncode})")
        line = json.loads((d / "live" / "feed.jsonl").read_text().splitlines()[-1])
        check(line["kind"] == "verdict" and "modules" in line["title"],
              "a verdict line is appended, titled by command and target")
        check(line["plain"].startswith("코드를"), "the agent's plain is the line's plain")
        check(line["numbers"].get("bug") == 0.8 and len(line["body"].splitlines()) == 3,
              "numbers carry the scores and the body holds the lowest three")
        lp = json.loads((d / "live" / "loop.json").read_text())
        check(lp["step"] == 8 and lp["status"] == "back",
              "loop.json carries the step and a back status (high=bad answers at .80)")
        answer(d, "credit", plain="이번에는 모든 항목이 기준을 넘었어요. 다음으로 갑니다.",
               flip=True)
        run(args, d)
        check(json.loads((d / "live" / "loop.json").read_text())["status"] == "forward",
              "all-good answers patch the status forward")
        check(len((d / "live" / "feed.jsonl").read_text().splitlines()) == 2,
              "the feed is append-only")


def test_docs_synced() -> None:
    print("--docs-synced flag: stored + warns when incomplete")
    with tempfile.TemporaryDirectory() as t:
        d = Path(t)
        args = bed(d) + ["--emit", "live", "--step", "8", "--docs-synced", "intent,design",
                          "--record", "modules", "--files", "credit.py"]
        run(args, d)
        answer(d, "credit", plain="이번 판정은 정상이에요.")
        p = run(args, d)
        check(p.returncode == 0, f"the run succeeds (got {p.returncode})")
        hist = json.loads((d / "aud" / "STATE.json").read_text())["history"]
        check(hist[-1]["docs_synced"] == ["design", "intent"],
              "docs_synced is stored on the history row, sorted")
        line = json.loads((d / "live" / "feed.jsonl").read_text().splitlines()[-1])
        check("plan" in line["plain"] and "site" in line["plain"],
              "an incomplete docs_synced list warns in the emitted plain text")

        d2 = Path(tempfile.mkdtemp())
        args2 = bed(d2) + ["--emit", "live", "--step", "8", "--docs-synced",
                           "intent,design,plan,site", "modules", "--files", "credit.py"]
        run(args2, d2)
        answer(d2, "credit", plain="이번 판정은 정상이에요.")
        run(args2, d2)
        line2 = json.loads((d2 / "live" / "feed.jsonl").read_text().splitlines()[-1])
        check("확인하지 않았어요" not in line2["plain"],
              "a complete docs_synced list carries no warning")


def main() -> None:
    for fn in (test_scope, test_record_summary, test_unreachable, test_agent_round_trip,
               test_design_questions, test_pipeline_contract_heading, test_impl_questions,
               test_audit_extras, test_plan_coverage_gate, test_verdict_title_and_labels,
               test_emit_integration, test_docs_synced):
        fn()
    print(f"\n{'FAILED: ' + '; '.join(FAILS) if FAILS else 'all checks passed'}")
    raise SystemExit(1 if FAILS else 0)


if __name__ == "__main__":
    main()
