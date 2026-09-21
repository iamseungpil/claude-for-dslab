/**
 * Example: review triage over REAL commits. The last 8 commits of this repo
 * become states (diffstat + the head of the patch); one live judge call per
 * commit asks whether it can land unreviewed and how risky it is.
 *
 * There is no ground truth here — the point is whether the pattern is
 * sensible: docs-only commits should lean auto_land, version-bump/publish
 * commits should lean needs_human. Those expectations come from the changed
 * file list; they are flagged, never scored.
 *
 * Run:    node bench/examples/pr-triage.mjs [--cast out.cast]
 * Render: agg out.cast pr-triage.gif
 */

import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { Jev, pick, rate } from "../../dist/index.js";

const castIdx = process.argv.indexOf("--cast");
const castPath = castIdx > -1 ? process.argv[castIdx + 1] : null;
const REPO = new URL("../..", import.meta.url).pathname;

const jev = new Jev();

const t0 = performance.now();
const events = [];
const say = (line = "") => {
  process.stdout.write(line + "\n");
  events.push([(performance.now() - t0) / 1000, "o", line + "\r\n"]);
};

const B = "\x1b[1m";
const D = "\x1b[2m";
const G = "\x1b[32m";
const Y = "\x1b[33m";
const C = "\x1b[36m";
const X = "\x1b[0m";

const git = (...args) =>
  execFileSync("git", ["-C", REPO, ...args], { encoding: "utf8", maxBuffer: 1 << 24 });

const shas = git("log", "-8", "--format=%h").trim().split("\n");

// Expectation from the changed files alone, for the sensibility flag only.
const expectationFor = (files, subject) => {
  const docsOnly = files.length > 0 && files.every((f) => /(^|\/)README|\.md$|^docs\//.test(f));
  const publishy =
    files.some((f) => /^package(-lock)?\.json$|plugin\.json$/.test(f)) ||
    /^\d+\.\d+\.\d+|version|publish|release/i.test(subject);
  if (docsOnly) return "auto_land";
  if (publishy) return "needs_human";
  return null;
};

const RISK = ["cosmetic", "logic change", "touches release/publish path"];
const SHORT = ["cosmetic", "logic", "release"];

say(`${B}jev-use PR triage${X} ${D}· last 8 real commits · ${jev.backend.name}${X}`);
say(`${D}state = git show --stat + first 60 patch lines${X}`);
say();

let inTok = 0;
let outTok = 0;
let routeEsc = 0, riskEsc = 0; // questions handed back to the LLM
const results = [];

for (const sha of shas) {
  const subject = git("show", "-s", "--format=%s", sha).trim();
  const stat = git("show", "--stat", sha);
  const patch = git("show", "--format=", "-p", sha).split("\n").slice(0, 60).join("\n");
  const files = git("show", "--name-only", "--format=", sha).trim().split("\n").filter(Boolean);

  const res = await jev.judge(`${stat}\n--- patch (first 60 lines) ---\n${patch}`, {
    route: pick("How should this commit be triaged for review?", {
      auto_land: "routine, safe to land without human review",
      needs_human: "a human should look",
    }),
    risk: rate("What kind of change is this?", RISK),
  });
  inTok += res.usage?.inputTokens ?? 0;
  outTok += res.usage?.outputTokens ?? 0;

  const { route, risk } = res.answers;
  if (route.escalate) routeEsc++;
  if (risk.escalate) riskEsc++;
  const riskIdx = Math.round(Number(risk.answer ?? 0));
  const verdict = route.escalate ? "escalate" : String(route.answer);
  const expected = expectationFor(files, subject);
  results.push({ sha, subject, verdict, conf: route.confidence, riskIdx, expected, files });

  const col = verdict === "auto_land" ? G : Y;
  say(
    `${C}${sha}${X} ${subject.slice(0, 28).padEnd(28)} ` +
      `${col}${verdict.padEnd(11)}${X} ${D}${route.confidence.toFixed(2)}${X} ` +
      `${D}${(SHORT[riskIdx] ?? String(riskIdx)).padEnd(8)}${X} ` +
      `${C}${String(res.latencyMs).padStart(4)}ms${X}`,
  );
}

const wall = ((performance.now() - t0) / 1000).toFixed(1);
const auto = results.filter((r) => r.verdict === "auto_land").length;
const human = results.filter((r) => r.verdict === "needs_human").length;

// Sensibility check: only commits with a file-derived expectation are judged.
// An escalate is a handoff, not a verdict, so it is counted separately.
const checked = results.filter((r) => r.expected);
const agree = checked.filter((r) => r.verdict === r.expected);
const handed = checked.filter((r) => r.verdict === "escalate");

say();
say(
  `${B}${auto} auto_land · ${human} needs_human · ${routeEsc} esc${X} ` +
    `${D}(+${riskEsc} risk) · ${wall}s · ${inTok}/${outTok} tok${X}`,
);
say(
  `${D}pattern check vs file-derived expectation (not ground truth): ` +
    `${agree.length}/${checked.length}${X}`,
);
for (const r of checked) {
  const mark =
    r.verdict === r.expected ? `${G}ok ${X}` : r.verdict === "escalate" ? `${Y}esc${X}` : `${Y}dif${X}`;
  say(`  ${mark} ${r.sha} expected ${r.expected.padEnd(11)} got ${r.verdict}`);
}
if (handed.length) say(`${D}esc = handed to the LLM, no auto_land claimed${X}`);

if (castPath) {
  writeFileSync(
    castPath,
    [
      JSON.stringify({ version: 2, width: 80, height: 22, title: "jev-use PR triage" }),
      ...events.map((e) => JSON.stringify(e)),
    ].join("\n") + "\n",
  );
  console.error(`cast written: ${castPath} (${jev.via})`);
}

// Exactly one markdown row, last line on stdout (wider than the 80-col cast).
console.log(
  `| Review triage over 8 real commits | ${auto} auto_land · ${human} needs_human · ` +
    `${routeEsc} escalated · ${wall} s · ${inTok} in / ${outTok} out tokens |`,
);
