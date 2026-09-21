/**
 * Example: "is this step actually done?" — the limpet-style stop judgment,
 * scored against ground truth.
 *
 * Eight states are captured from commands this script really runs in the
 * repo (test suite, typecheck, MCP smoke, a listing of a temp workspace)
 * plus deliberately failing ones (typecheck of a broken generated file, a
 * missing-file read, a missing npm script, a workspace with a leftover
 * file). No output text is invented: every state is a command line, the
 * tail of its real combined output, and its real exit code. Each state gets
 * one noul question and its own call, so the accuracy below is per-state.
 *
 * Run:  node bench/examples/completion.mjs [--cast out.cast] [--tmp dir]
 */

import { execSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Jev, check } from "../../dist/index.js";

const argv = process.argv.slice(2);
const flag = (name) => (argv.includes(name) ? argv[argv.indexOf(name) + 1] : undefined);
const castPath = flag("--cast");

const jev = new Jev();
const repo = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

const t0 = performance.now();
const events = [];
const say = (line = "") => {
  process.stdout.write(line + "\n");
  events.push([(performance.now() - t0) / 1000, "o", line + "\r\n"]);
};
// bold, dim, green, red, cyan, reset
const [B, D, G, R, C, X] = ["1m", "2m", "32m", "31m", "36m", "0m"].map((c) => `\x1b[${c}`);
const pct = (xs, p) => {
  const s = [...xs].sort((a, b) => a - b);
  return Math.round(s[Math.min(s.length - 1, Math.floor((p / 100) * s.length))]);
};

/** Run a command for real; return its state string (never invented text). */
const capture = (cmd, cwd) => {
  let out = "";
  let code = 0;
  try {
    out = execSync(`{ ${cmd} ; } 2>&1`, { cwd, encoding: "utf8", timeout: 180_000 });
  } catch (e) {
    out = String(e.stdout ?? "");
    code = e.status ?? 1;
  }
  const tail = out.split("\n").filter((l) => l.trim()).slice(-12);
  return `$ ${cmd}\n${tail.join("\n") || "(no output)"}\n[process exited with code ${code}]`;
};

say(`${B}jev-use${X} ${D}· is this done? 8 real states · backend: ${jev.backend.name}${X}`);
say(`${D}every state below is the captured output of a command run just now${X}`);

// -- capture the eight states ---------------------------------------------
const work = flag("--tmp") ?? mkdtempSync(join(tmpdir(), "jev-done-"));
const ws = join(work, "ws");
mkdirSync(ws, { recursive: true });
const tsc = join(repo, "node_modules/.bin/tsc");
writeFileSync(join(work, "broken.ts"),
  'export const n: number = "not a number";\nexport function f(a: string): number { return a; }\n');
writeFileSync(join(ws, "leftover.tmp"), "half-written artifact\n");
const listing = 'ls -1A; echo "files: $(ls -1A | wc -l)"';

const tCap = performance.now();
const cases = [
  ["vitest test suite run", "done", capture("npm test", repo)],
  ["package typecheck", "done", capture("npx tsc --noEmit", repo)],
  ["MCP stdio smoke check", "done", capture("node scripts/smoke.mjs", repo)],
  ["workspace cleanup, try 1", "fail", capture(listing, ws)],
  ["typecheck of broken.ts", "fail", capture(`${tsc} --noEmit --pretty false broken.ts`, work)],
  ["config file read", "fail",
    capture(`node -e "require('node:fs').readFileSync('/etc/jev-missing.json')"`, work)],
  ["npm release script", "fail", capture("npm run release", repo)],
];
rmSync(join(ws, "leftover.tmp"));
cases.push(["workspace cleanup, try 2", "done", capture(listing, ws)]);
const capSecs = (performance.now() - tCap) / 1000;
say(`${D}captured 8 states from real commands in ${capSecs.toFixed(1)}s${X}`);
say();

// -- one noul question per state, one call per state -----------------------
const lat = [];
let inTok = 0;
let outTok = 0;
let correct = 0;
let i = 0;

for (const [label, want, state] of cases) {
  const res = await jev.judge(state, {
    done: check(`Did the ${label.replace(/, try \d/, "")} complete successfully?`, {
      true: "the command finished with no errors and nothing is left to do",
      false: "it errored, failed, or left work unfinished",
    }),
  });
  lat.push(res.latencyMs ?? 0);
  inTok += res.usage?.inputTokens ?? 0;
  outTok += res.usage?.outputTokens ?? 0;
  const p = Number(res.answers.done.answer);
  const got = p >= 0.5 ? "done" : "fail";
  const hit = got === want;
  if (hit) correct++;
  i++;
  say(
    `${i}/8 ${hit ? `${G}✓${X}` : `${R}✗${X}`} ${label.padEnd(24)} ` +
      `${D}want${X} ${want.padEnd(4)} ${D}got${X} ${got.padEnd(4)} ` +
      `p ${p.toFixed(2)}  ${C}${res.latencyMs}ms${X}`,
  );
}

rmSync(work, { recursive: true, force: true });
say();
say(`${B}${correct}/8 correct${X} · p50 ${pct(lat, 50)}ms · p95 ${pct(lat, 95)}ms · ` +
  `${inTok} in / ${outTok} out tok`);
say();
say(`| Completion checks (8 states) | ${correct}/8 correct · p50 ${pct(lat, 50)}ms · ` +
  `${inTok + outTok} tok |`);

if (castPath) {
  writeFileSync(
    castPath,
    [
      JSON.stringify({ version: 2, width: 80, height: 20, title: "jev-use completion" }),
      ...events.map((e) => JSON.stringify(e)),
    ].join("\n") + "\n",
  );
  console.error(`\ncast written: ${castPath} (${jev.via})`);
}
