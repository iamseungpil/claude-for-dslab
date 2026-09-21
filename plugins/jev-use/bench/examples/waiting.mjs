/**
 * Example: the agent waiting on a slow process, judged by Jev once a second.
 *
 * A real `npm install` runs into a fresh prefix with a cold cache, so its
 * output is genuinely phased (resolve -> fetch -> add) and takes seconds.
 * Every second the loop hands Jev the last 12 output lines + elapsed time +
 * exit status and asks one typed question: keep_waiting / done / failed.
 * No LLM tokens are spent on the waiting; every number below is measured.
 *
 * Run:  node bench/examples/waiting.mjs [--cast out.cast] [--tmp dir]
 */

import { spawn } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Jev, check, pick } from "../../dist/index.js";

const argv = process.argv.slice(2);
const flag = (name) => (argv.includes(name) ? argv[argv.indexOf(name) + 1] : undefined);
const castPath = flag("--cast");

const jev = new Jev();

const t0 = performance.now();
const events = [];
const say = (line = "") => {
  process.stdout.write(line + "\n");
  events.push([(performance.now() - t0) / 1000, "o", line + "\r\n"]);
};

// bold, dim, green, yellow, red, cyan, reset
const [B, D, G, Y, R, C, X] =
  ["1m", "2m", "32m", "33m", "31m", "36m", "0m"].map((c) => `\x1b[${c}`);

const pct = (xs, p) => {
  const s = [...xs].sort((a, b) => a - b);
  return Math.round(s[Math.min(s.length - 1, Math.floor((p / 100) * s.length))]);
};
const sleep = (ms) => new Promise((r) => setTimeout(r, Math.max(0, ms)));

// -- start the real slow process ------------------------------------------
const work = flag("--tmp") ?? mkdtempSync(join(tmpdir(), "jev-wait-"));
mkdirSync(join(work, "cache"), { recursive: true });
const pkgs = ["webpack", "eslint", "typescript", "vite", "rollup"];
const args = ["install", ...pkgs, "--prefix", work, "--cache", join(work, "cache"),
  "--no-audit", "--no-fund", "--loglevel", "http"];

say(`${B}jev-use${X} ${D}· waiting on a slow process · backend: ${jev.backend.name}${X}`);
say(`${D}$ npm install ${pkgs.join(" ")} (cold cache, fresh prefix)${X}`);
say();

const lines = [];
let exitCode = null;
let exitAt = null;
const child = spawn("npm", args, { stdio: ["ignore", "pipe", "pipe"] });
const feed = (buf) => {
  for (const l of String(buf).split("\n")) if (l.trim()) lines.push(l.trim());
};
child.stdout.on("data", feed);
child.stderr.on("data", feed);
const tStart = performance.now();
child.on("close", (code) => {
  exitCode = code ?? -1;
  exitAt = (performance.now() - tStart) / 1000;
});

// -- poll Jev once per second ---------------------------------------------
const lat = [];
let inTok = 0;
let outTok = 0;
let polls = 0;
let afterExit = 0;
let last = null;
let nextAt = tStart + 1000;

while (polls < 90) {
  await sleep(nextAt - performance.now());
  nextAt += 1000;
  const elapsed = (performance.now() - tStart) / 1000;
  const state = [
    `Task: npm install ${pkgs.join(" ")} into a fresh prefix (cold cache).`,
    `Elapsed: ${elapsed.toFixed(0)}s`,
    exitCode === null
      ? "Process: still running, no exit status yet"
      : `Process: exited with code ${exitCode}`,
    "Last output lines:",
    ...lines.slice(-12),
  ].join("\n");

  const res = await jev.judge(state, {
    status: pick("What should the agent do about the process it is waiting on?", {
      keep_waiting: "still running, wait another second",
      done: "finished successfully, stop waiting",
      failed: "finished with an error, stop waiting",
    }),
    // one noul alongside it: cheap extra signal in the same call
    clean: check("Is the output so far free of errors?"),
  });
  polls++;
  lat.push(res.latencyMs ?? 0);
  inTok += res.usage?.inputTokens ?? 0;
  outTok += res.usage?.outputTokens ?? 0;

  const { status, clean } = res.answers;
  last = status;
  const col = status.answer === "done" ? G : status.answer === "failed" ? R : Y;
  say(
    `t+${elapsed.toFixed(0).padStart(2)}s  ${col}${String(status.answer).padEnd(12)}${X}` +
      ` ${D}conf${X} ${status.confidence.toFixed(2)}  ${D}ok${X} ${Number(clean.answer).toFixed(2)}` +
      `  ${C}${res.latencyMs}ms${X}`,
  );

  if (exitCode !== null) {
    afterExit++;
    if (status.answer !== "keep_waiting" || afterExit >= 2) break;
  }
}

const wall = (performance.now() - tStart) / 1000;
const want = exitCode === 0 ? "done" : "failed";
const matched = last?.answer === want;
rmSync(work, { recursive: true, force: true });

say();
say(`${B}process${X} exited ${exitCode} after ${exitAt?.toFixed(1)}s · ` +
  `loop wall ${wall.toFixed(1)}s`);
say(`${B}${polls} polls${X} · p50 ${pct(lat, 50)}ms · p95 ${pct(lat, 95)}ms · ` +
  `${inTok} in / ${outTok} out tok`);
say(`final verdict ${last?.answer} vs real exit ${exitCode}: ` +
  (matched ? `${G}match${X}` : `${R}MISMATCH (expected ${want})${X}`));
say();
say(`| Waiting (npm install) | ${polls} polls · ${wall.toFixed(1)}s · ` +
  `p50 ${pct(lat, 50)}ms · ${inTok + outTok} tok · ${matched ? "correct" : "wrong"} |`);

if (castPath) {
  writeFileSync(
    castPath,
    [
      JSON.stringify({ version: 2, width: 80, height: 20, title: "jev-use waiting" }),
      ...events.map((e) => JSON.stringify(e)),
    ].join("\n") + "\n",
  );
  console.error(`\ncast written: ${castPath} (${jev.via})`);
}
