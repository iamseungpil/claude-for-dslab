#!/usr/bin/env python3
"""Audit research code against a written intent, with Jev as the prior-maker.

Each subcommand batches all questions about one state into ONE `jev-use judge`
call. The state (intent + source) never enters the conversation -- it goes to the
subprocess on stdin and to disk under --out. Verdicts are priors, not decisions.
Key comes from the environment only (TYPESAFE_API_KEY / OPENROUTER_API_KEY /
AI_GATEWAY_API_KEY, or JEV_BACKEND=mock). See --help.
"""
from __future__ import annotations

import argparse
import json
import os
import re
import shlex
import subprocess
import sys
from pathlib import Path

def noul(i: str, q: str, t: str, f: str) -> dict:
    return {"id": i, "type": "noul", "question": q, "criteria": {"true": t, "false": f}}


FIXED = [
    noul("gold_leak", "Does this code let the ground-truth label (gold answer) reach a place the"
         " intent forbids -- a training reward, a retry trigger, or a selection rule?",
         "gold (or anything derived from it) reaches a trained or selecting path",
         "gold appears only in offline evaluation or an explicit control cell"),
    noul("unneeded", "Is part of this code unnecessary for the stated intent -- dead, superseded,"
         " or belonging to an axis the intent says is closed?",
         "code paths exist that the intent does not need",
         "every path serves a claim the intent makes"),
    noul("bug", "Does this code contain a defect that would silently change the learning signal"
         " -- wrong sign, wrong span, broadcast where localization was meant, a cap that erases"
         " magnitude, a stub/silent zero, or an ordering that cancels the term?",
         "a concrete defect of that kind is present",
         "the computation matches what the intent describes"),
]
QUALITY = {"id": "quality", "type": "score",
           "question": "How well does this code realize the written intent?",
           "levels": ["contradicts the intent", "unrelated to the intent",
                      "partially realizes it", "realizes it with gaps",
                      "faithfully realizes it"]}


def die(msg: str, hint: str) -> None:
    print(f"error: {msg}\n  fix: {hint}", file=sys.stderr)
    raise SystemExit(2)


def preflight() -> None:
    try:
        v = subprocess.run(["node", "--version"], capture_output=True, text=True, check=True)
        major = int(v.stdout.strip().lstrip("v").split(".")[0])
    except Exception:
        die("node not found on PATH", "install node >= 20 and put it on PATH")
        return
    if major < 20:
        die(f"node {major} is too old (jev-use needs >= 20)",
            "put a node >= 20 first on PATH, e.g. via conda/nvm, then rerun")
    if os.environ.get("JEV_BACKEND") == "mock":
        return
    if not any(os.environ.get(k) for k in
               ("TYPESAFE_API_KEY", "OPENROUTER_API_KEY", "AI_GATEWAY_API_KEY")):
        die("no Jev API key in the environment",
            "set -a; source <your>/.env; set +a; export TYPESAFE_API_KEY=\"$JEV_API_KEY\"")


def judge(state: str, questions: list[dict], cmd: str, threshold: float | None) -> dict:
    """One batched call. Returns the engine's result dict (exit 3 = escalated, not an error)."""
    req: dict = {"state": state, "questions": questions}
    if threshold is not None:
        req["confidenceThreshold"] = threshold
    p = subprocess.run(shlex.split(cmd), input=json.dumps(req),
                       capture_output=True, text=True)
    out = p.stdout[p.stdout.find("{"):] if "{" in p.stdout else ""
    if not out:
        die(f"jev call produced no JSON (exit {p.returncode})",
            f"run `{cmd}` by hand; stderr was: {p.stderr.strip()[:300]}")
    return json.loads(out)


def cell(v: dict | None) -> str:
    a = (v or {}).get("answer")
    return f"{a:.2f}" if isinstance(a, (int, float)) else str(a)[:7] if v else "-"


def table(rows: list[tuple[str, dict]], qids: list[str]) -> None:
    """Raw jev values only. The cause/confidence findings table is the LLM's to write."""
    w = max([12] + [len(r[0]) for r in rows])
    head = f"{'target':<{w}} " + " ".join(f"{q[:7]:>7s}" for q in qids) + "   esc    ms"
    print(head + "\n" + "-" * len(head))
    for name, res in rows:
        by = {v.get("id"): v for v in res.get("verdicts", [])}
        esc = sum(1 for v in res.get("verdicts", []) if v.get("escalate"))
        print(f"{name:<{w}} " + " ".join(f"{cell(by.get(q)):>7s}" for q in qids)
              + f"   {esc:>3d} {res.get('latencyMs', 0):>5d}")


def questions_for(path: str | None) -> list[dict]:
    """Derived properties (if any) first, then the three fixed noul + quality."""
    props = [{"id": p["id"], "type": "noul", "question": p["question"],
              **({"criteria": p["criteria"]} if p.get("criteria") else {})}
             for p in (json.loads(Path(path).read_text()) if path else [])]
    return props + FIXED + [QUALITY]


CLOSED = ""   # set from --closed-axes; appended to every state so design_error is judgeable


def head(intent: Path, label: str, body: str) -> str:
    return (f"# WRITTEN INTENT (the contract this code must satisfy)\n{intent.read_text()}\n"
            f"{CLOSED}\n# CODE UNDER AUDIT: {label}\n```python\n{body}\n```\n")


def save(out: Path, name: str, res: dict) -> None:
    out.mkdir(parents=True, exist_ok=True)
    (out / f"{name}.json").write_text(json.dumps(res, indent=2))


def split_functions(src: str) -> list[tuple[str, str]]:
    """(name, body) per top-level def/class, decorators merged onto what follows."""
    lines = src.splitlines()
    starts = [i for i, ln in enumerate(lines) if re.match(r"^(def |class |@)", ln)]
    chunks, i = [], 0
    while i < len(starts):
        s = starts[i]
        while i < len(starts) and lines[starts[i]].startswith("@"):  # merge decorators
            i += 1
        if i >= len(starts):
            break
        j = i + 1
        while j < len(starts) and lines[starts[j]].startswith("@"):
            j += 1
        end = starts[j] if j < len(starts) else len(lines)
        body = "\n".join(lines[s:end])
        if end - s >= 8:
            m = re.search(r"^(?:def|class)\s+(\w+)", body, re.M)
            chunks.append((m.group(1) if m else f"chunk{s}", body))
        i = j
    return chunks


def preamble(src: str) -> str:
    lines = src.splitlines()
    cut = next((i for i, ln in enumerate(lines) if re.match(r"^(def |class |@)", ln)), len(lines))
    return "\n".join(lines[:cut])


def cmd_modules(a) -> list:
    qs = questions_for(a.properties)
    rows = []
    for f in a.files:
        p = Path(f)
        res = judge(head(Path(a.intent), p.name, p.read_text()), qs, a.jev_cmd, a.threshold)
        save(Path(a.out), p.stem, res)
        rows.append((p.name, res))
    table(rows, [q["id"] for q in qs])
    return rows


def cmd_functions(a) -> list:
    qs = [q for q in FIXED if q["id"] in ("bug", "unneeded")]
    src = Path(a.file).read_text()
    pre = preamble(src)
    rows = []
    for name, body in split_functions(src):
        state = head(Path(a.intent), f"{Path(a.file).name}::{name}", pre + "\n\n" + body)
        res = judge(state, qs, a.jev_cmd, a.threshold)
        save(Path(a.out), f"{Path(a.file).stem}.{name}", res)
        rows.append((name, res))
    table(rows, [q["id"] for q in qs])
    return rows


PLAN_Q = [
    noul("fix_correct", "Would the proposed change make the code satisfy the intent?",
         "the change closes the gap it targets", "it misses or misidentifies the gap"),
    noul("fix_incomplete", "Does the proposed change leave part of the same defect unfixed?",
         "some instance of the defect survives it", "it covers every instance"),
    noul("fix_harm", "Would the proposed change break something the intent relies on?",
         "it removes or distorts a behavior the intent needs", "it is confined to the defect"),
    noul("budget_ok", "Does the proposed change stay inside the line budget it states -- no new"
         " module or rewrite beyond what the plan declares?",
         "the change fits the declared budget", "it exceeds or ignores the declared budget"),
]


def cmd_plan(a) -> list:
    p = Path(a.code_file)
    state = head(Path(a.intent), p.name, p.read_text()) + \
        f"\n# PROPOSED CHANGE (not yet applied)\n{a.plan_text}\n"
    res = judge(state, PLAN_Q, a.jev_cmd, a.threshold)
    save(Path(a.out), f"plan.{p.stem}", res)
    table([("plan", res)], [q["id"] for q in PLAN_Q])
    return [("plan", res)]


def cmd_intent_delta(a) -> list:
    """Same code, two intent docs: a large delta means the DOCUMENT moved the verdict
    (intent_error, fix Step 0 first), not the code (impl_error)."""
    qs = questions_for(a.properties)
    src, rows = Path(a.file).read_text(), []
    for tag, doc in (("intent_a", a.intent), ("intent_b", a.intent_b)):
        res = judge(head(Path(doc), Path(a.file).name, src), qs, a.jev_cmd, a.threshold)
        save(Path(a.out), f"intent.{Path(a.file).stem}.{tag}", res)
        rows.append((tag, res))
    table(rows, [q["id"] for q in qs])
    print("\ndelta B-A on IDENTICAL code (|d| >= .10 = the document, not the code, moved it):")
    d = deltas(rows[0][1], rows[1][1])
    print("  " + "  ".join(f"{k}={v:+.2f}" for k, v in d.items()))
    return rows


def deltas(base: dict, other: dict) -> dict:
    b = {v["id"]: v.get("answer") for v in base["verdicts"]}
    return {v["id"]: round(v["answer"] - b.get(v["id"], 0), 3) for v in other["verdicts"]
            if isinstance(v.get("answer"), (int, float))}


def cmd_plant(a) -> list:
    qs = questions_for(a.properties)
    src = Path(a.file).read_text()
    base = judge(head(Path(a.intent), Path(a.file).name, src), qs, a.jev_cmd, a.threshold)
    save(Path(a.out), f"plant.{Path(a.file).stem}.original", base)
    rows = [("original", base)]
    for n, patch in enumerate(a.patch, 1):
        if "=>" not in patch:
            die(f"patch {n} has no '=>' separator", "write --patch 'OLD=>NEW'")
        old, new = patch.split("=>", 1)
        if src.count(old) != 1:
            die(f"patch {n} matches {src.count(old)} times (need exactly 1)",
                "extend OLD with surrounding lines until it is unique")
        res = judge(head(Path(a.intent), Path(a.file).name, src.replace(old, new)),
                    qs, a.jev_cmd, a.threshold)
        save(Path(a.out), f"plant.{Path(a.file).stem}.{n}", res)
        rows.append((f"planted#{n}", res))
    table(rows, [q["id"] for q in qs])
    print("\ndelta vs original (positive = planted copy scored higher; |d| >= .10 = detected):")
    for name, res in rows[1:]:
        print(f"  {name}: " + "  ".join(f"{k}={v:+.2f}" for k, v in deltas(base, res).items()))
    return rows


def doc_state(intent: Path, parts: list[tuple[str, str]]) -> str:
    """State for document-level judging: intent (+ closed axes) then each named document."""
    out = [f"# WRITTEN INTENT (the contract this design must serve)\n{intent.read_text()}\n",
           f"{CLOSED}\n"]
    for label, body in parts:
        out.append(f"# {label}\n{body}\n")
    return "".join(out)


DESIGN_Q = [
    noul("intent_consistent", "Does this design serve the written intent, rather than a"
         " different question the intent does not ask?",
         "every claim it tests is one the intent asks for",
         "it tests something the intent does not ask for"),
    noul("no_closed_axis_rebuy", "Does this design stay off the closed axes -- is it free of"
         " re-buying a conclusion already falsified?",
         "no closed axis is re-bought", "it re-buys an axis listed as closed"),
    noul("gates_numeric", "Are the gates stated as numbers with a comparison, so the outcome"
         " can be decided without further judgment?",
         "each gate names a quantity, a threshold and a direction",
         "a gate is qualitative, vague, or missing a threshold"),
    noul("stop_rules_present", "Does the design name stop rules -- conditions under which the"
         " arm is abandoned before the planned end?",
         "at least one concrete stop condition is stated", "no stop condition is stated"),
    noul("novelty_stated", "Does the design say what is new relative to the survey of prior"
         " work it cites?",
         "the delta against prior work is stated", "novelty is asserted or absent"),
    noul("mechanism_verifiable", "Is the proposed mechanism stated concretely enough that code"
         " could be checked against it line by line?",
         "the mechanism names the signal, where it is applied and how it is credited",
         "the mechanism is only a direction or a slogan"),
]
DESIGN_SCORE = {"id": "design_quality", "type": "score",
                "question": "How complete is this design document as an experiment contract?",
                "levels": ["contradicts the intent", "missing most required parts",
                           "parts present but underspecified", "complete with gaps",
                           "a complete, checkable contract"]}


def cmd_design(a) -> list:
    qs = DESIGN_Q + [DESIGN_SCORE]
    doc = Path(a.design)
    res = judge(doc_state(Path(a.intent), [(f"DESIGN DOCUMENT: {doc.name}", doc.read_text())]),
                qs, a.jev_cmd, a.threshold)
    save(Path(a.out), f"design.{doc.stem}", res)
    table([("design", res)], [q["id"] for q in qs])
    print("\nformal check only: any property < .5 or design_quality < 3.5 sends you back to"
          " Step 1c. Design QUALITY stays with the human.")
    return [("design", res)]


RESULT_Q = [
    noul("gates_met", "Did the measured results meet every numeric gate the design states?",
         "every gate is met at or beyond its threshold", "at least one gate is missed"),
    noul("stop_rule_triggered", "Did any stop rule in the design fire in these results?",
         "a stated stop condition is satisfied by the numbers",
         "no stop condition is satisfied"),
    noul("metric_matches_definition", "Does each reported metric compute the quantity the"
         " design defines it as, rather than a nearby one?",
         "the reported quantity matches the design's definition",
         "a reported number measures something else"),
]
CONTINUE_Q = {"id": "continue", "type": "choice",
              "question": "Given these results against this design, what happens next?",
              "options": {"continue": "gates are on track; keep the arm running",
                          "stop_arm": "a stop rule fired or the arm is dead",
                          "back_to_step_1": "the design or the measurement itself is wrong"}}


def cmd_results(a) -> list:
    qs = RESULT_Q + [CONTINUE_Q]
    d, r = Path(a.design), Path(a.results)
    state = doc_state(Path(a.intent), [(f"DESIGN DOCUMENT: {d.name}", d.read_text()),
                                       (f"MEASURED RESULTS: {r.name}", r.read_text())])
    res = judge(state, qs, a.jev_cmd, a.threshold)
    save(Path(a.out), f"results.{d.stem}", res)
    table([("results", res)], [q["id"] for q in qs])
    print("\nstop_rule_triggered is high=BAD. A problem on any row sends you back to Step 1.")
    return [("results", res)]


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("--intent", required=True, help="path to the corrected intent document")
    ap.add_argument("--out", default="./.jev-audit/", help="where verdict JSON lands")
    ap.add_argument("--properties", help="JSON list of {id, question, criteria:{true,false}}")
    ap.add_argument("--jev-cmd", default="npx -y jev-use@0.7.1 judge")
    ap.add_argument("--threshold", type=float)
    ap.add_argument("--closed-axes", help="text file of axes already falsified; goes into"
                                          " every state so re-buying one shows as design_error")
    sub = ap.add_subparsers(dest="cmd", required=True)
    m = sub.add_parser("modules", help="one batched call per file")
    m.add_argument("--files", nargs="+", required=True)
    m.set_defaults(fn=cmd_modules)
    f = sub.add_parser("functions", help="re-ask bug/unneeded per top-level function")
    f.add_argument("--file", required=True)
    f.set_defaults(fn=cmd_functions)
    pl = sub.add_parser("plan", help="judge a proposed fix before writing it")
    pl.add_argument("--code-file", required=True)
    pl.add_argument("--plan-text", required=True)
    pl.set_defaults(fn=cmd_plan)
    pt = sub.add_parser("plant", help="calibrate: original vs planted-defect copies")
    pt.add_argument("--file", required=True)
    pt.add_argument("--patch", action="append", required=True, metavar="OLD=>NEW")
    pt.set_defaults(fn=cmd_plant)
    idl = sub.add_parser("intent-delta", help="same code, two intent docs: intent_error probe")
    idl.add_argument("--intent-b", required=True, help="the second (e.g. corrected) intent doc")
    idl.add_argument("--file", required=True)
    idl.set_defaults(fn=cmd_intent_delta)
    dg = sub.add_parser("design", help="formal check of a design doc before planning")
    dg.add_argument("--design", required=True, help="path to .jev-loop/design.md")
    dg.set_defaults(fn=cmd_design)
    rs = sub.add_parser("results", help="judge measured results against the design's gates")
    rs.add_argument("--design", required=True, help="path to .jev-loop/design.md")
    rs.add_argument("--results", required=True, help="path to .jev-loop/results.md")
    rs.set_defaults(fn=cmd_results)
    a = ap.parse_args()
    preflight()
    if a.closed_axes:
        global CLOSED  # noqa: PLW0603
        CLOSED = ("\n# CLOSED AXES (already falsified -- re-buying one is a design error)\n"
                  + Path(a.closed_axes).read_text() + "\n")
    rows = a.fn(a)
    if any(v.get("escalate") for _, r in rows for v in r.get("verdicts", [])):
        print("\nnote: escalated verdicts are priors only -- they order your reading list,"
              " they never close a question.")


if __name__ == "__main__":
    main()
