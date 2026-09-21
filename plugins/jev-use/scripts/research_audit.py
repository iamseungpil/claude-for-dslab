#!/usr/bin/env python3
"""Audit research code against a written intent, with Jev as the prior-maker.

Each subcommand batches all questions about one state into ONE `jev-use judge` call.
The state (intent + source) never enters the conversation -- it goes to the subprocess
on stdin and to disk under --out. Verdicts are priors, not decisions. Key comes from the
environment only (TYPESAFE_API_KEY / OPENROUTER_API_KEY / AI_GATEWAY_API_KEY, or
JEV_BACKEND=mock). See --help.
"""
from __future__ import annotations

import argparse
import ast
import datetime
import json
import os
import re
import shlex
import subprocess
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import emit as live  # noqa: E402  the live record: feed.jsonl + loop.json


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


# --- implementation-audit questions that need an extra input to be answerable ------------
CLEAN_CODE = noul(
    "clean_code",
    "Does this module keep clean-code discipline? Checklist: one job per function; names say"
    " what they do; no magic numbers and no hidden global state; the module stays inside its"
    " declared line budget; it has a test.",
    "every item of the checklist holds",
    "at least one item fails -- cite the file:line where it fails")
DUPLICATES = noul(
    "duplicates_existing",
    "Does this module re-implement something the package already provides, per the signature"
    " index below?",
    "a function or class here duplicates one already present elsewhere in the package",
    "nothing here exists elsewhere in the package")
REPEATS_FAILED = noul(
    "repeats_failed_impl",
    "Does this module redo an implementation the failed-implementation ledger already records"
    " as tried and failed?",
    "it rebuilds something the ledger says already failed",
    "it is not on the ledger")
PLAN_COVERAGE = noul(
    "plan_coverage",
    "Is every module the plan lists actually implemented in the files audited -- no plan item"
    " left unbuilt, stubbed or silently zeroed?",
    "every plan item has a built file behind it",
    "a plan item is missing -- list the missing plan item ids in the reason")

AGENT = False           # --judge agent: the main agent answers; no backend call is made
OUT = "./.jev-audit/"   # --out, needed by the agent-judge request/verdict file round trip
EXTRA = ""              # signature index + failed-impl ledger, folded into every code state
EMIT: str | None = None  # --emit DIR: the live record this run writes a verdict line to

# a reason must cite something checkable: file:line, or a document/section reference
CITE = re.compile(r"[\w./\\-]+\.\w+:\d+|[\w./\\-]+\.(?:md|txt|json|ya?ml|rst)\b|§\s*\S+")
HIGH_BAD = ("bug", "gold_leak", "unneeded", "stop_rule_triggered",  # high = bad noul ids
            "duplicates_existing", "repeats_failed_impl")
SCOPES = ("code", "run", "design")


def die(msg: str, hint: str, code: int = 2) -> None:
    print(f"error: {msg}\n  fix: {hint}", file=sys.stderr)
    raise SystemExit(code)


def qtype(q: dict) -> str:
    return q.get("type") or "noul"


def check_agent(res: dict, questions: list[dict], path: Path) -> None:
    """Every question answered, in range for its type, with a citing reason. Else exit 6."""
    vs = res.get("verdicts")
    if not isinstance(vs, list):
        die(f"{path} has no 'verdicts' list",
            'write {"verdicts": [{"id","type","answer","confidence","reason"}],'
            ' "backend": "agent"}', 6)
        return
    by = {v.get("id"): v for v in vs if isinstance(v, dict)}
    for q in questions:
        qid, t, v = q["id"], qtype(q), by.get(q["id"])
        if v is None:
            die(f"{path} does not answer '{qid}'", "add a verdict for every question id", 6)
            return
        ans, num = v.get("answer"), isinstance(v.get("answer"), (int, float)) and not isinstance(
            v.get("answer"), bool)
        ok = (num and 0.0 <= ans <= 1.0) if t == "noul" else (
            (num and 1 <= ans <= 5) if t == "score" else ans in (q.get("options") or {}))
        if not ok:
            want = {"noul": "a float in [0,1]", "score": "a number 1..5"}.get(
                t, "one of " + ", ".join(sorted(q.get("options") or {})))
            die(f"{path}: verdict '{qid}' answer {ans!r} is not valid for type {t}",
                f"answer '{qid}' with {want}", 6)
            return
        reason = v.get("reason")
        if not isinstance(reason, str) or not reason.strip():
            die(f"{path}: verdict '{qid}' has no reason",
                "every reason must be a non-empty string citing file:line or a document", 6)
            return
        if not CITE.search(reason):
            die(f"{path}: verdict '{qid}' reason cites nothing checkable",
                "cite a file:line (mc/credit.py:44) or a document (docs/INTENT.md) in the"
                " reason", 6)
            return


def agent_judge(tag: str, state: str, questions: list[dict]) -> dict:
    """Write the exact request; read the agent's verdicts if they exist, else exit 5."""
    out = Path(OUT)
    out.mkdir(parents=True, exist_ok=True)
    req, ver = out / f"{tag}.request.json", out / f"{tag}.verdicts.json"
    req.write_text(json.dumps({"state": state, "questions": questions}, indent=2))
    if not ver.exists():
        print(f"AWAITING AGENT VERDICTS: read {req}, write {ver}, rerun the same command")
        raise SystemExit(5)
    try:
        res = json.loads(ver.read_text())
    except json.JSONDecodeError as e:
        die(f"{ver} is not valid JSON ({e})", "rewrite the verdicts file as one JSON object", 6)
        return {}
    check_agent(res, questions, ver)
    if EMIT and (err := live.check_plain(res.get("plain"))):
        die(f"{ver}: {err}",
            'add a top-level "plain" next to "verdicts": ' + live.PLAIN_HINT, 6)
    res["backend"] = "agent"
    res.setdefault("latencyMs", 0)
    return res


def unreachable(res: dict) -> bool:
    """The backend did not judge: a verdict says so, or nothing was answered at all."""
    vs = [v for v in res.get("verdicts", []) if isinstance(v, dict)]
    if not vs:
        return True
    return (any(str(v.get("reason", "")).strip().lower() == "unreachable" for v in vs)
            or all(v.get("answer") is None for v in vs))


def unreachable_hint(rows: list) -> str:
    """One line naming what came back, for the UNREACHABLE banner."""
    for name, res in rows:
        for v in res.get("verdicts", []):
            if isinstance(v, dict) and v.get("answer") is None:
                return (f"{name}: backend {res.get('backend', '?')} returned"
                        f" reason={v.get('reason')!r} — no judgment happened")
        if unreachable(res):
            return f"{name}: backend {res.get('backend', '?')} returned no verdicts"
    return "the backend returned no judgment"


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


def judge(state: str, questions: list[dict], cmd: str, threshold: float | None,
          label: str = "state", tag: str | None = None) -> dict:
    """One batched call. Returns the engine's result dict (exit 3 = escalated, not an error)."""
    if AGENT:
        return agent_judge(tag or re.sub(r"[^\w.-]+", "_", label), state, questions)
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


def table(rows: list[tuple[str, dict]], qids: list[str]) -> None:
    """Raw jev values only. The cause/confidence findings table is the LLM's to write."""
    def cell(v: dict | None) -> str:
        x = (v or {}).get("answer")
        return f"{x:.2f}" if isinstance(x, (int, float)) else str(x)[:7] if v else "-"
    w = max([12] + [len(r[0]) for r in rows])
    head = f"{'target':<{w}} " + " ".join(f"{q[:7]:>7s}" for q in qids) + "   esc    ms"
    print(head + "\n" + "-" * len(head))
    for name, res in rows:
        by = {v.get("id"): v for v in res.get("verdicts", [])}
        esc = sum(1 for v in res.get("verdicts", []) if v.get("escalate"))
        print(f"{name:<{w}} " + " ".join(f"{cell(by.get(q)):>7s}" for q in qids)
              + f"   {esc:>3d} {res.get('latencyMs', 0):>5d}")


def props_of(path: str | None, scope: str) -> list[dict]:
    """Properties whose "scope" matches (absent scope means "code"). Unknown scope = error."""
    out = []
    for p in (json.loads(Path(path).read_text()) if path else []):
        sc = p.get("scope", "code")
        if sc not in SCOPES:
            die(f"property '{p.get('id')}' has scope {sc!r}",
                'use one of "code" (default), "run", "design"')
        if sc != scope:
            continue
        out.append({"id": p["id"], "type": "noul", "question": p["question"],
                    **({"criteria": p["criteria"]} if p.get("criteria") else {})})
    return out


def questions_for(path: str | None, extra: list[dict] | None = None) -> list[dict]:
    """Code-scope properties (if any) first, then the three fixed noul, then quality."""
    return props_of(path, "code") + FIXED + (extra or []) + [QUALITY]


SIG_CAP = 6000   # the signature index is a hint, not the package: ~6 KB, then truncated


def sig_index(root: str, cap: int = SIG_CAP) -> str:
    """def/class names per file under `root`, parsed with ast, capped. Unparsable files are
    skipped -- a partial index is still a usable duplicate hint."""
    lines = []
    for p in sorted(Path(root).rglob("*.py")):
        try:
            tree = ast.parse(p.read_text())
        except (OSError, SyntaxError, ValueError):
            continue
        names = [n.name for n in tree.body
                 if isinstance(n, (ast.FunctionDef, ast.AsyncFunctionDef, ast.ClassDef))]
        if names:
            lines.append(f"{p}: {', '.join(names)}")
    s = "\n".join(lines)
    return s[:cap] + "\n... (index truncated)" if len(s) > cap else s


def audit_extras(a) -> list[dict]:
    """The Step 8 questions that need an input: each is skipped, loudly, without it."""
    global EXTRA  # noqa: PLW0603
    qs, parts = [CLEAN_CODE], []
    if getattr(a, "package_root", None):
        qs.append(DUPLICATES)
        parts.append("# PACKAGE SIGNATURE INDEX (def/class per file, truncated)\n"
                     + sig_index(a.package_root) + "\n")
    else:
        print("note: duplicates_existing skipped — pass --package-root SRC to ask it")
    if getattr(a, "failed_impls", None):
        led = Path(a.failed_impls)
        if not led.exists():
            die(f"failed-impls ledger {led} does not exist",
                "start it: one line per abandoned build (what was built, why it failed, date)")
        qs.append(REPEATS_FAILED)
        parts.append("# FAILED IMPLEMENTATIONS (already built once and abandoned)\n"
                     + led.read_text() + "\n")
    else:
        print("note: repeats_failed_impl skipped — pass --failed-impls docs/failed_impls.txt"
              " to ask it")
    EXTRA = "\n" + "\n".join(parts) if parts else ""
    return qs


def run_questions(path: str | None) -> list[dict]:
    """runconfig asks ONLY run-scope properties: the fixed four are about code, not the job."""
    qs = props_of(path, "run")
    if not qs:
        die("no run-scope property in properties.json",
            'add a run-scale property with "scope": "run" (e.g. pilot_scale: does the'
            " submitted run use the pool size / K / step count the intent names?)")
    return qs


CLOSED = ""   # set from --closed-axes; appended to every state so design_error is judgeable


def head(intent: Path, label: str, body: str) -> str:
    return (f"# WRITTEN INTENT (the contract this code must satisfy)\n{intent.read_text()}\n"
            f"{CLOSED}{EXTRA}\n# CODE UNDER AUDIT: {label}\n```python\n{body}\n```\n")


def save(out: Path, name: str, res: dict) -> None:
    out.mkdir(parents=True, exist_ok=True)
    (out / f"{name}.json").write_text(json.dumps(res, indent=2))


def emit(a, tag: str, name: str, state: str, qs: list[dict]) -> list:
    """One batched call on one state: judge, persist the verdict JSON, print the raw table."""
    res = judge(state, qs, a.jev_cmd, a.threshold, name, tag)
    save(Path(a.out), tag, res)
    table([(name, res)], [q["id"] for q in qs])
    return [(name, res)]


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


def cmd_modules(a) -> list:
    qs = questions_for(a.properties, audit_extras(a))
    rows = []
    for f in a.files:
        p = Path(f)
        res = judge(head(Path(a.intent), p.name, p.read_text()), qs, a.jev_cmd, a.threshold,
                    p.name, p.stem)
        save(Path(a.out), p.stem, res)
        rows.append((p.name, res))
    table(rows, [q["id"] for q in qs])
    if not a.plan:
        print("note: plan_coverage skipped — pass --plan .jev-loop/plan.md to ask it")
        return rows
    state = (f"# WRITTEN INTENT\n{Path(a.intent).read_text()}\n{CLOSED}\n"
             f"# PLAN (what was to be built)\n{Path(a.plan).read_text()}\n"
             "# FILES ACTUALLY AUDITED\n" + "".join(
                 f"{f} ({len(Path(f).read_text().splitlines())} lines)\n" for f in a.files))
    res = judge(state, [PLAN_COVERAGE], a.jev_cmd, a.threshold, "plan_coverage",
                "plan_coverage")
    save(Path(a.out), "plan_coverage", res)
    table([("plan_coverage", res)], ["plan_coverage"])
    rows.append(("plan_coverage", res))
    return rows


def cmd_functions(a) -> list:
    qs = [q for q in FIXED if q["id"] in ("bug", "unneeded")]
    src = Path(a.file).read_text()          # module preamble = everything above the first def
    ln = src.splitlines()
    pre = "\n".join(ln[:next((i for i, x in enumerate(ln)
                              if re.match(r"^(def |class |@)", x)), len(ln))])
    rows = []
    for name, body in split_functions(src):
        state = head(Path(a.intent), f"{Path(a.file).name}::{name}", pre + "\n\n" + body)
        res = judge(state, qs, a.jev_cmd, a.threshold, name,
                    f"{Path(a.file).stem}.{name}")
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
    return emit(a, f"plan.{p.stem}", "plan", head(Path(a.intent), p.name, p.read_text())
                + f"\n# PROPOSED CHANGE (not yet applied)\n{a.plan_text}\n", PLAN_Q)


def cmd_intent_delta(a) -> list:
    """Same code, two intent docs: a large delta means the DOCUMENT moved the verdict
    (intent_error, fix Step 0 first), not the code (impl_error)."""
    qs = questions_for(a.properties)
    src, rows = Path(a.file).read_text(), []
    for tag, doc in (("intent_a", a.intent), ("intent_b", a.intent_b)):
        res = judge(head(Path(doc), Path(a.file).name, src), qs, a.jev_cmd, a.threshold, tag,
                    f"intent.{Path(a.file).stem}.{tag}")
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
    base = judge(head(Path(a.intent), Path(a.file).name, src), qs, a.jev_cmd, a.threshold,
                 "original", f"plant.{Path(a.file).stem}.original")
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
                    qs, a.jev_cmd, a.threshold, f"planted#{n}",
                    f"plant.{Path(a.file).stem}.{n}")
        save(Path(a.out), f"plant.{Path(a.file).stem}.{n}", res)
        rows.append((f"planted#{n}", res))
    table(rows, [q["id"] for q in qs])
    print("\ndelta vs original (positive = planted copy scored higher; |d| >= .10 = detected):")
    for name, res in rows[1:]:
        print(f"  {name}: " + "  ".join(f"{k}={v:+.2f}" for k, v in deltas(base, res).items()))
    return rows


def cmd_runconfig(a) -> list:
    """The run as it will actually be submitted: job command + env, pool summary, launcher
    defaults. Catches a scale the intent fixes but the submitted config does not honour."""
    job = json.loads(Path(a.job).read_text())
    c = job.get("command") or job.get("cmd") or ""
    env = job.get("env") or job.get("environment") or {}
    body = [f"# JOB AS SUBMITTED: {Path(a.job).name}\nCOMMAND:\n"
            f"{' '.join(c) if isinstance(c, list) else c}\nENV ASSIGNMENTS:\n"
            + "".join(f"{k}={v}\n" for k, v in sorted(env.items()))
            + "".join(f"{k}: {json.dumps(v)[:400]}\n" for k, v in sorted(job.items())
                      if k not in ("command", "cmd", "env", "environment"))]
    if a.pool_summary:
        body.append(f"# POOL SUMMARY: {Path(a.pool_summary).name}\n"
                    f"{Path(a.pool_summary).read_text()[:4000]}\n")
    if a.launcher:  # default values the launcher supplies when the job omits a knob
        body.append(f"# LAUNCHER DEFAULT VALUES: {Path(a.launcher).name}\n" + "\n".join(
            ln.strip() for ln in Path(a.launcher).read_text().splitlines()
            if re.search(r"\$\{\w+:-[^}]*\}", ln)) + "\n")
    rows = emit(a, f"runconfig.{Path(a.job).stem}", Path(a.job).name,
                f"# WRITTEN INTENT (the contract this run must honour)\n"
                f"{Path(a.intent).read_text()}\n{CLOSED}\n" + "\n".join(body),
                run_questions(a.properties))
    print("\nrun this on the EXACT job JSON before submission: a scale the intent fixes but"
          " the config does not honour shows up here, not in the module audit.")
    return rows


SCORE_IDS = ("quality", "design_quality")
CHOICE_IDS = ("continue",)


def vkind(v: dict) -> str:
    """The type of a verdict: what it declares, else what its id is known to be."""
    t = v.get("type")
    if t in ("noul", "score", "choice"):
        return t
    return ("score" if v["id"] in SCORE_IDS else
            "choice" if v["id"] in CHOICE_IDS else "noul")


def record(a, rows: list) -> None:
    """Append one audit-state line to <out>/STATE.json.history; never delete entries.

    min_property looks at high=good `noul` answers ONLY: the fixed high=bad ids, the 1-5
    `score` verdicts and the `choice` are kept apart, under "scores" and "choice".
    An unreachable judgment appends nothing at all (main() exits 4 before reaching here).
    """
    p = Path(a.out) / "STATE.json"
    st = json.loads(p.read_text()) if p.exists() else {}
    vs = [v for _, r in rows for v in r.get("verdicts", []) if isinstance(v, dict) and "id" in v]
    num = [v for v in vs if isinstance(v.get("answer"), (int, float))
           and not isinstance(v.get("answer"), bool)]
    good = [v["answer"] for v in num if vkind(v) == "noul" and v["id"] not in HIGH_BAD]
    row = {
        "min_property": min(good, default=None),
        "step": getattr(a, "step", None) or st.get("step"), "subcommand": a.cmd,
        "targets": [n for n, _ in rows],
        "max_bug": max([v["answer"] for v in num if v["id"] == "bug"], default=None),
        "scores": {v["id"]: v["answer"] for v in num if vkind(v) == "score"},
        "choice": {v["id"]: v.get("answer") for v in vs if vkind(v) == "choice"},
        "backend": next((r.get("backend") for _, r in rows if r.get("backend")), None),
        "escalated": sum(1 for v in vs if v.get("escalate")),
        "timestamp": datetime.datetime.now().isoformat(timespec="seconds")}
    st.setdefault("history", []).append(row)
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(json.dumps(st, indent=2))
    print(f"recorded: {p}  (history entries: {len(st['history'])})")


def failed(v: dict) -> bool:
    """Step 3 / Step 8c thresholds: high=good under .5, high=bad at .55 or above."""
    x = v.get("answer")
    if not isinstance(x, (int, float)) or isinstance(x, bool):
        return False
    if vkind(v) == "score":
        return x < 3.5
    return x >= 0.55 if v["id"] in HIGH_BAD else x < 0.5


def live_verdict(a, rows: list) -> None:
    """One `verdict` feed line per judged command, plus a loop.json patch. The script cannot
    write child-level prose: agent mode must supply "plain", jev mode gets a template."""
    vs = [v for _, r in rows for v in r.get("verdicts", []) if isinstance(v, dict) and "id" in v]
    bad = [v for v in vs if failed(v)]
    nums = {v["id"]: v["answer"] for v in vs if isinstance(v.get("answer"), (int, float))
            and not isinstance(v.get("answer"), bool)}
    low = sorted(((k, x) for k, x in nums.items()), key=lambda kv: kv[1])[:3]
    by = {v["id"]: v for v in vs}
    plain = next((r.get("plain") for _, r in rows if r.get("plain")), None) or (
        f"심판이 {len(vs)}가지를 확인했고 {len(bad)}가지가 기준에 못 미쳤어요. "
        + ("그래서 앞 단계로 돌아가요." if bad else "그래서 다음 단계로 가요."))
    live.feed(EMIT, "verdict", a.cmd, f"{a.cmd} {', '.join(n for n, _ in rows)}", plain,
              body="\n".join(f"{k}={x:.2f} — {by[k].get('reason') or by[k].get('evidence') or ''}"
                             for k, x in low),
              numbers=nums, author="research_audit")
    live.loop(EMIT, step=getattr(a, "step", None) or "", status="back" if bad else "forward",
              scores={v["id"]: v["answer"] for v in vs if vkind(v) == "score"},
              design=rows[0][0] if a.cmd == "design" else "")


def cmd_record(a) -> list:
    """agent mode, by hand: turn the agent's own answers into a verdict file of the jev shape.
    noul values in [0,1], score 1-5, one line of evidence (file:line) per answer."""
    ans = json.loads(Path(a.answers).read_text())
    if not isinstance(ans, dict):
        die("answers file is not an object", 'write {"id": value, ...} (+ "evidence")')
    ev = ans.pop("evidence", None) or {}
    res = {"backend": "agent", "latencyMs": 0,
           "verdicts": [{"id": k, "answer": v, "escalate": False,
                         **({"evidence": ev[k]} if k in ev else {})} for k, v in ans.items()]}
    save(Path(a.out), a.target, res)
    table([(a.target, res)], [v["id"] for v in res["verdicts"]])
    return [(a.target, res)]  # main() records it exactly as --record does


def doc_state(intent: Path, parts: list[tuple[str, str]]) -> str:
    """State for document-level judging: intent (+ closed axes) then each named document."""
    out = [f"# WRITTEN INTENT (the contract this design must serve)\n{intent.read_text()}\n",
           f"{CLOSED}\n"]
    for label, body in parts:
        out.append(f"# {label}\n{body}\n")
    return "".join(out)


DESIGN_Q = [
    noul("intent_consistent", "Does this design serve the written intent, rather than a different"
         " question the intent does not ask?", "every claim it tests is one the intent asks for",
         "it tests something the intent does not ask for"),
    noul("no_closed_axis_rebuy", "Does this design stay off the closed axes -- is it free of"
         " re-buying a conclusion already falsified?", "no closed axis is re-bought",
         "it re-buys an axis listed as closed"),
    noul("gates_numeric", "Are the gates stated as numbers with a comparison, so the outcome"
         " can be decided without further judgment?",
         "each gate names a quantity, a threshold and a direction",
         "a gate is qualitative, vague, or missing a threshold"),
    noul("stop_rules_present", "Does the design name stop rules -- conditions under which the"
         " arm is abandoned before the planned end?",
         "at least one concrete stop condition is stated", "no stop condition is stated"),
    noul("novelty_stated", "Does the design say what is new relative to the survey of prior work"
         " it cites?", "the delta against prior work is stated", "novelty is asserted or absent"),
    noul("mechanism_verifiable", "Is the proposed mechanism stated concretely enough that code"
         " could be checked against it line by line?",
         "the mechanism names the signal, where it is applied and how it is credited",
         "the mechanism is only a direction or a slogan"),
    noul("novelty_vs_named_prior", "Does the design name at least one specific prior work from"
         " the survey and state a concrete delta against it?",
         "a named prior work is cited and the delta is a real change of mechanism, data or"
         " measurement",
         "no prior work is named, or the delta is only a rename or a re-scope of it"),
    noul("expected_effect_grounded", "Does the design state the baseline number, the expected"
         " effect size with its source, and that the gate thresholds exceed the known noise"
         " band?",
         "baseline, expected effect with a source (a prior result or own pilot), and gates"
         " above the noise band are all stated",
         "the expected effect is absent, unsourced, or inside the noise band"),
    noul("cost_benefit_stated", "Does the design estimate what this costs (money, time, tokens,"
         " lines) and say which intent goal advances by how much if it works, against at least"
         " one cheaper alternative?",
         "cost, the advance on a named intent goal, and a cheaper alternative are all stated",
         "cost or payoff is unstated, or no cheaper alternative is compared"),
    noul("cheapest_first", "Is this the cheapest experiment that answers this question -- is no"
         " cheaper experiment answering the same question left un-run in the queue or design?",
         "no cheaper experiment would answer the same question",
         "a cheaper experiment answering the same question is sitting un-run"),
]
DESIGN_SCORE = {"id": "design_quality", "type": "score",
                "question": "How complete is this design document as an experiment contract?",
                "levels": ["contradicts the intent", "missing most required parts",
                           "parts present but underspecified", "complete with gaps",
                           "a complete, checkable contract"]}


def cmd_design(a) -> list:
    doc = Path(a.design)
    rows = emit(a, f"design.{doc.stem}", "design",
                doc_state(Path(a.intent), [(f"DESIGN DOCUMENT: {doc.name}", doc.read_text())]),
                DESIGN_Q + [DESIGN_SCORE])
    print("\nformal check only: any property < .5 or design_quality < 3.5 sends you back to"
          " Step 1c. Design QUALITY stays with the human.")
    return rows


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
    d, r = Path(a.design), Path(a.results)
    rows = emit(a, f"results.{d.stem}", "results",
                doc_state(Path(a.intent), [(f"DESIGN DOCUMENT: {d.name}", d.read_text()),
                                           (f"MEASURED RESULTS: {r.name}", r.read_text())]),
                RESULT_Q + [CONTINUE_Q])
    print("\nstop_rule_triggered is high=BAD. A problem on any row sends you back to Step 1.")
    return rows


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("--intent", help="path to the corrected intent document (all but `record`)")
    ap.add_argument("--judge", choices=("jev", "agent", "fable"), default="jev",
                    help="jev = batched backend calls; agent (= fable) = no backend: write"
                         " <out>/<tag>.request.json and read <out>/<tag>.verdicts.json that the"
                         " main agent writes (exit 5 while it is missing, 6 if it is invalid)")
    ap.add_argument("--out", default="./.jev-audit/", help="where verdict JSON lands")
    ap.add_argument("--properties", help="JSON list of {id, question, criteria:{true,false}}")
    ap.add_argument("--jev-cmd", default="npx -y jev-use@0.7.1 judge")
    ap.add_argument("--threshold", type=float)
    ap.add_argument("--closed-axes", help="text file of axes already falsified; goes into every"
                    " state so re-buying one shows as design_error")
    ap.add_argument("--emit", metavar="DIR", help="live record directory: every judged command"
                    " appends a `verdict` line to DIR/feed.jsonl and patches DIR/loop.json."
                    " With --judge agent the verdicts file must carry a top-level \"plain\"")
    ap.add_argument("--step", type=int, help="loop step this judgment belongs to")
    ap.add_argument("--record", action="store_true", help="append {step, subcommand, targets,"
                    " min_property, max_bug, scores, choice, backend, escalated, timestamp} to"
                    " <out>/STATE.json.history; an unreachable judgment appends nothing")
    sub = ap.add_subparsers(dest="cmd", required=True)
    m = sub.add_parser("modules", help="one batched call per file")
    m.add_argument("--files", nargs="+", required=True); m.set_defaults(fn=cmd_modules)
    m.add_argument("--plan", help="plan.md; enables plan_coverage, asked once per run")
    m.add_argument("--package-root", help="package to index (def/class per file, ~6 KB);"
                   " enables duplicates_existing")
    m.add_argument("--failed-impls", help="text ledger of implementations already tried and"
                   " abandoned; enables repeats_failed_impl")
    f = sub.add_parser("functions", help="re-ask bug/unneeded per function")
    f.add_argument("--file", required=True); f.set_defaults(fn=cmd_functions)
    pl = sub.add_parser("plan", help="judge a proposed fix before writing it")
    pl.add_argument("--code-file", required=True)
    pl.add_argument("--plan-text", required=True); pl.set_defaults(fn=cmd_plan)
    pt = sub.add_parser("plant", help="calibrate: original vs planted-defect copies")
    pt.add_argument("--file", required=True); pt.set_defaults(fn=cmd_plant)
    pt.add_argument("--patch", action="append", required=True, metavar="OLD=>NEW")
    idl = sub.add_parser("intent-delta", help="same code, two intent docs: intent_error probe")
    idl.add_argument("--intent-b", required=True, help="the second (corrected) intent doc")
    idl.add_argument("--file", required=True); idl.set_defaults(fn=cmd_intent_delta)
    dg = sub.add_parser("design", help="formal check of a design doc before planning")
    dg.add_argument("--design", required=True); dg.set_defaults(fn=cmd_design)
    rs = sub.add_parser("results", help="judge measured results against the design's gates")
    rs.add_argument("--design", required=True, help="path to .jev-loop/design.md")
    rs.add_argument("--results", required=True, help="path to .jev-loop/results.md")
    rs.set_defaults(fn=cmd_results)
    rc = sub.add_parser("runconfig", help="judge the run as submitted: job JSON + pool summary"
                        " + launcher defaults (Step 8h)")
    rc.add_argument("--job", required=True, help="path to the exact job JSON to be submitted")
    rc.add_argument("--pool-summary", help="path to the pool/dataset summary JSON")
    rc.add_argument("--launcher", help="launcher script; its ${VAR:-default} lines are folded in")
    rc.set_defaults(fn=cmd_runconfig)
    rd = sub.add_parser("record", help="agent answers by hand -> verdict file + history row")
    rd.add_argument("--target", required=True, help="verdict file name under --out")
    rd.add_argument("--answers", required=True, help='JSON {id: value} + optional "evidence"')
    rd.set_defaults(fn=cmd_record)
    a = ap.parse_args()
    if a.cmd != "record":
        if not a.intent:
            die("--intent is required", "pass --intent path/to/INTENT.md")
        if a.judge == "jev":
            preflight()   # --judge agent needs no key and no node
    global AGENT, CLOSED, OUT, EMIT  # noqa: PLW0603
    AGENT, OUT, EMIT = a.judge in ("agent", "fable"), a.out, a.emit
    if a.closed_axes:
        CLOSED = ("\n# CLOSED AXES (already falsified -- re-buying one is a design error)\n"
                  + Path(a.closed_axes).read_text() + "\n")
    rows = a.fn(a)
    if a.cmd == "record":
        return record(a, rows)
    if any(unreachable(r) for _, r in rows):
        print(f"\nUNREACHABLE: {unreachable_hint(rows)}; the verdict JSON under {a.out} holds"
              " no judgment and nothing was recorded -- rerun once the backend answers.")
        raise SystemExit(4)
    if a.record:
        record(a, rows)
    if EMIT:
        live_verdict(a, rows)
    if any(v.get("escalate") for _, r in rows for v in r.get("verdicts", [])):
        print("\nnote: escalated verdicts are priors only -- they order your reading list,"
              " they never close a question.")


if __name__ == "__main__":
    main()
