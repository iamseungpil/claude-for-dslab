/**
 * Records the demo GIF shown in the README: a 10-item triage queue driven
 * live against the configured backend, at real latency. Prints to the
 * terminal and simultaneously writes an asciinema v2 cast with true
 * timestamps — no post-editing, what you see is one 1x run.
 *
 * Run:    node bench/record.mjs [out.cast]
 * Render: agg out.cast assets/demo.gif
 */

import { writeFileSync } from "node:fs";
import { Jev, pick, rate, route } from "../dist/index.js";

const jev = new Jev();
const castPath = process.argv[2] ?? "demo.cast";

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
const R = "\x1b[31m";
const C = "\x1b[36m";
const X = "\x1b[0m";

const queue = [
  { id: "ci-201", state: "CI run #201: build ok, 214 tests passed, 0 failed, lint clean; branch up to date." },
  { id: "ci-202", state: "CI run #202: build ok, 198 tests passed, 0 failed; docs-only diff." },
  { id: "dep-12", state: "Dependency update: lockfile diff is empty, no code changes." },
  { id: "ci-203", state: "CI run #203: 1 of 214 tests failed (test_refund_rounding), first failure in 30 runs." },
  { id: "task-31", state: "Write the SQL migration for the renamed column and update the ORM model.", producesContent: true },
  { id: "ci-204", state: "CI run #204: build ok, 215 tests passed, 0 failed; branch 1 commit ahead." },
  { id: "shot-9", state: "Screenshot diff: 2 of 42 differ by anti-aliasing only per the pixel report." },
  { id: "ci-205", state: "CI run #205: build ok, all green, no conflicts." },
  { id: "sec-3", state: "Secret scanner reported zero findings on the diff." },
  { id: "inc-2", state: "Error rate jumped 0.1% -> 4.2% in 10 minutes and is climbing; deploy 12 min ago." },
];

say(`${B}jev-use${X} ${D}· live judgments, one 1x run · backend: ${jev.backend.name}${X}`);
say();

let jevCalls = 0;
let handoffs = 0;
const lat = [];

for (const item of queue) {
  const step = route({
    producesContent: item.producesContent ?? false,
    enumerable: !item.producesContent,
  });
  if (step.to === "llm") {
    handoffs++;
    say(`${item.id.padEnd(8)} ${Y}-> LLM${X}    ${D}${step.reason}${X}`);
    continue;
  }
  const res = await jev.judge(item.state, {
    action: pick("Next action?", {
      merge: "all green, proceed",
      rerun: "looks flaky",
      hold: "needs attention",
    }),
    sev: rate("How serious?", ["routine", "worth a look", "incident"]),
  });
  jevCalls++;
  lat.push(res.latencyMs ?? 0);
  const { action, sev } = res.answers;
  if (action.escalate) {
    handoffs++;
    say(`${item.id.padEnd(8)} ${Y}-> LLM${X}    ${D}${action.reason}, prior=${action.answer}${X}`);
    continue;
  }
  const level = sev.legend?.[String(Math.round(Number(sev.answer)))] ?? String(sev.answer);
  const col = level === "incident" ? R : G;
  say(
    `${item.id.padEnd(8)} ${col}${String(action.answer).padEnd(6)}${X} ` +
      `${D}conf${X} ${action.confidence.toFixed(2)}  ${C}${res.latencyMs}ms${X}  ${col}${level}${X}`,
  );
}

const p50 = lat.sort((a, b) => a - b)[Math.floor(lat.length / 2)];
say();
say(`${B}${queue.length} items · ${jevCalls} judged by Jev (p50 ${p50}ms) · ${handoffs} -> LLM${X}`);
say(`${D}LLM tokens spent on the ${queue.length - handoffs} routine items: 0${X}`);

writeFileSync(
  castPath,
  [
    JSON.stringify({ version: 2, width: 80, height: 18, title: "jev-use demo" }),
    ...events.map((e) => JSON.stringify(e)),
  ].join("\n") + "\n",
);
console.error(`\ncast written: ${castPath} (${jev.via})`);
