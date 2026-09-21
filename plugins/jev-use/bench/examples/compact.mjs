/**
 * Example: context compaction — Jev judges what to keep, the LLM writes the
 * replacement. The collaboration is unavoidable by construction: keep-or-drop is
 * an enumerable judgment (Jev, ~29 check() questions per batched call) and the
 * paragraph that replaces the dropped pile is prose (the LLM, one call).
 *
 * The transcript is REAL: at start-up this script runs the read-only commands in
 * CMDS inside this repo and slices their true output into turn-shaped messages
 * (user ask, assistant framing, one message per output line). The first 200 of
 * those are judged; nothing is invented or edited afterwards.
 *
 * Two honesty checks, published whatever they say: three facts are picked
 * PROGRAMMATICALLY out of the dropped messages — values appearing in no kept
 * message — and asked back against the compacted context (summary + kept
 * messages); and every number in the LLM's paragraph is traced to the pile it
 * replaced. A ✗ is a finding, not a demo failure.
 *
 * Environment: AI_GATEWAY_API_KEY (Jev backend + the summary model), plus
 * PLAYWRIGHT_CORE and CHROMIUM_PATH for --video.
 *
 * Run:   node bench/examples/compact.mjs [--video assets/compact.gif]
 */

import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { Jev, check, pick } from "../../dist/index.js";

const arg = (f) => (process.argv.indexOf(f) > -1 ? process.argv[process.argv.indexOf(f) + 1] : null);
const videoPath = arg("--video");
const ROOT = new URL("../../", import.meta.url).pathname;

const N = 200; // messages judged
const SLICE = 29; // check() questions per judge call
const GOAL = "diagnose whether the test suite is green and summarize what the session did";
const MODEL = "anthropic/claude-haiku-4.5";
const GATEWAY = process.env.AI_GATEWAY_BASE_URL ?? "https://ai-gateway.vercel.sh";
const VIEW = { width: 900, height: 640 };
const CMDS = ["node --version && npm --version", "git log --oneline -n 16", "ls -la", "npm test -- --reporter=verbose",
  "npx tsc --noEmit", "node examples/demo.mjs", "wc -l src/*.ts src/backends/*.ts", "git show --stat --oneline HEAD"];

const jev = new Jev();
const tok = (s) => Math.ceil(s.length / 4); // tokens ≈ chars/4, labelled as such on screen
const p50 = (a) => (a.length ? Math.round([...a].sort((x, y) => x - y)[Math.floor(a.length / 2)]) : 0);
const line = (m) => `[${m.n}] ${m.role}: ${m.text}`;

/** Run one command here, capturing stdout+stderr, its real exit code and its lines. */
function run(cmd) {
  let out = "", code = 0;
  try { out = execFileSync("bash", ["-c", cmd + " 2>&1"], { cwd: ROOT, encoding: "utf8", maxBuffer: 8e6 }); }
  catch (err) { out = String(err.stdout ?? "") + String(err.stderr ?? ""); code = err.status ?? 1; }
  const lines = out.replace(/\x1b\[[0-9;]*[A-Za-z]/g, "").split("\n").map((l) => l.replace(/\s+$/, "")).filter((l) => l.trim().length);
  return { lines: lines.map((l) => (l.length > 140 ? l.slice(0, 139) + "…" : l)), code };
}

// ---- 1. the transcript, built out of real command output ---------------------
process.stderr.write(`running ${CMDS.length} real commands in ${ROOT}…\n`);
const all = [];
for (const cmd of CMDS) {
  const { lines, code } = run(cmd);
  all.push({ role: "user", text: `run \`${cmd}\`` }, { role: "assistant", text: `ran \`${cmd}\` — reading the output` });
  if (!lines.length) all.push({ role: "output", text: `output: (no output, exit ${code})` });
  for (const l of lines) all.push({ role: "output", text: `output: ${l}` });
  all.push({ role: "assistant", text: `\`${cmd}\` printed ${lines.length} line(s), exit ${code}` });
}
if (all.length < N) throw new Error(`only ${all.length} real messages available, need ${N}`);
const MSGS = all.slice(0, N).map((m, i) => ({ ...m, n: i + 1, tok: tok(`[${i + 1}] ${m.role}: ${m.text}`) }));
const beforeTok = MSGS.reduce((s, m) => s + m.tok, 0);
const WINDOW = Math.ceil(beforeTok / 0.95 / 100) * 100; // demo-sized window the real transcript nearly fills
const pct = (t) => Math.round((t / WINDOW) * 1000) / 10;

// ---- the live UI: absent in headless mode, same code path either way ---------
let page = null, ctx = null, browser = null, tmp = null, capture = null, capturing = true;
const frames = []; // {f, t}: one live screenshot and the wall-clock ms it was taken
if (videoPath) {
  const { chromium } = await import(process.env.PLAYWRIGHT_CORE ?? "playwright-core");
  tmp = mkdtempSync(join(tmpdir(), "compact-"));
  writeFileSync(join(tmp, "ui.html"), pageHtml());
  browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH ?? chromium.executablePath(), args: ["--no-sandbox", "--disable-dev-shm-usage"] });
  ctx = await browser.newContext({ viewport: VIEW });
  page = await ctx.newPage();
  await page.goto("file://" + join(tmp, "ui.html"));
  mkdirSync(join(tmp, "f"));
  // Lossless PNG frames, grabbed live while the run drives the page. A recorded
  // webm would work too, but its compression noise repaints every pixel of a
  // text-dense UI, which destroys the GIF's interframe compression (~8 MB).
  capture = (async () => {
    for (let i = 0; capturing; i++) {
      const t = performance.now(), f = join(tmp, "f", `f${String(i).padStart(4, "0")}.png`);
      await page.screenshot({ path: f });
      frames.push({ f, t });
      const rest = 110 - (performance.now() - t);
      if (rest > 0) await new Promise((r) => setTimeout(r, rest));
    }
  })();
}
const ui = async (fn, a) => { if (page) await page.evaluate(([f, x]) => window.ui[f](x), [fn, a]); };
const beat = async (ms) => { if (page) await new Promise((r) => setTimeout(r, ms)); }; // pacing exists only on camera
const keepFlag = new Map();
const lat = [];
let jevIn = 0, jevOut = 0, calls = 0;
const tally = () => `kept ${[...keepFlag.values()].filter(Boolean).length} · dropped ${[...keepFlag.values()].filter((k) => !k).length} · calls ${calls}`;
const hud = (main, sub = "", mode = "jev") => ui("hud", { mode, main, sub, right: mode === "done" ? "" : tally() });
await ui("init", { window: WINDOW, goal: GOAL });
await beat(900);

// ---- 2. the transcript streams in, filling the window -----------------------
await hud(`jev · judging ${N} messages`, "transcript streaming in");
let seen = 0;
for (let i = 0; i < N; i += 10) {
  const part = MSGS.slice(i, i + 10);
  seen += part.reduce((s, m) => s + m.tok, 0);
  // The row already shows the role, so the "output: " prefix the transcript carries
  // is dropped on screen only — the messages Jev judges keep it verbatim.
  await ui("add", part.map((m) => ({ n: m.n, role: m.role, text: m.text.replace(/^output: /, "") })));
  await ui("fill", { pct: pct(seen), label: `${pct(seen)}%` });
  await beat(80);
}
await beat(700);
// ---- 3. Jev judges keep/drop, one batched call per slice ---------------------
const CRITERIA = { true: "the message carries a fact the diagnosis or the summary depends on — a test result, a count, a version, a command, an error", false: "routine detail, filler, or framing that a one-paragraph summary can absorb without loss" };
for (let a = 0; a < N; a += SLICE) {
  const slice = MSGS.slice(a, a + SLICE);
  const state = `GOAL: ${GOAL}\n\nOne coding-agent session is being compacted to fit its context window. ` +
    `Below are messages ${slice[0].n}-${slice.at(-1).n} of ${N}, verbatim.\n\n${slice.map(line).join("\n")}`;
  const qs = {};
  for (const m of slice) qs[`m${m.n}`] = check(`Message [${m.n}] — will it still matter for the goal above?`, CRITERIA);
  await ui("toRow", slice[0].n);
  await hud(`jev · judging ${N} messages`, `call ${calls + 1} · ${slice.length} check() questions in one request`);
  const res = await jev.judge(state, qs);
  calls++;
  lat.push(res.latencyMs ?? 0);
  jevIn += res.usage?.inputTokens ?? 0;
  jevOut += res.usage?.outputTokens ?? 0;
  const marks = slice.map((m) => ({ n: m.n, keep: Number(res.answers[`m${m.n}`].answer) >= 0.5 }));
  for (const k of marks) keepFlag.set(k.n, k.keep);
  await hud(`jev · judging ${N} messages`, `call ${calls} · ${slice.length} questions · ${res.latencyMs} ms`);
  // One call answered all 29 questions; the tints are painted 20 ms apart so the
  // eye can follow which message got which verdict. Presentation only — the HUD
  // carries the call's real latency and no verdict waits on the staggering.
  await ui("marks", { rows: marks, stepMs: 20 });
  await beat(220);
}
const kept = MSGS.filter((m) => keepFlag.get(m.n));
const dropped = MSGS.filter((m) => !keepFlag.get(m.n));
await beat(600);
// ---- 4. the handoff: the LLM writes the one paragraph -----------------------
await hud(`${MODEL.split("/")[1]} · writing the summary`, `${dropped.length} dropped messages → 1 paragraph`, "llm");
const writing = summarize(dropped); // fired before the collapse, so the wait is spent on screen
await ui("collapse");
const sum = await writing;
const afterTok = kept.reduce((s, m) => s + m.tok, 0) + tok(sum.text);
await ui("summary", { at: dropped[0]?.n ?? 1, head: `summary · written by ${MODEL.split("/")[1]} in ${sum.ms} ms · replaces ${dropped.length} messages` });
await ui("type", sum.text);
await ui("fill", { pct: pct(afterTok), label: `${pct(beforeTok)}% → ${pct(afterTok)}%` });
// Honesty check #2: every number in the paragraph must exist in the pile it replaced.
const dropText = dropped.map((m) => m.text).join("\n").replace(/,/g, "");
const nums = [...new Set(sum.text.replace(/,/g, "").match(/\d[\d.]*\d|\d/g) ?? [])];
const unsourced = nums.filter((n) => !dropText.includes(n));
const traced = `summary numbers found in the dropped pile: ${nums.length - unsourced.length}/${nums.length}${unsourced.length ? ` · not there: ${unsourced.join(" ")}` : ""}`;
await ui("note", traced);
await beat(500);
/** The prose half of the handoff: one real chat completion, normal settings. */
async function summarize(msgs) {
  const prompt = `A coding-agent session is being compacted. The ${msgs.length} transcript messages below are about to ` +
    `be REMOVED from the context window and replaced by your paragraph; every other message stays verbatim.\n\n` +
    `Current goal: ${GOAL}\n\nMessages being removed:\n${msgs.map(line).join("\n")}\n\n` +
    `Write ONE paragraph, at most 110 words, no preamble and no bullet points, preserving what a later reader would ` +
    `need from these messages: the concrete facts, numbers and names — not a description of the conversation. Copy ` +
    `every number and name exactly as it appears above; never total, average or estimate one yourself.`;
  const t = Date.now();
  const r = await fetch(`${GATEWAY}/v1/chat/completions`, {
    method: "POST", headers: { Authorization: `Bearer ${process.env.AI_GATEWAY_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: MODEL, max_tokens: 1000, messages: [{ role: "user", content: prompt }] }),
  });
  const j = await r.json();
  if (!r.ok) throw new Error(`summary call failed: HTTP ${r.status} ${JSON.stringify(j).slice(0, 200)}`);
  return { text: (j.choices?.[0]?.message?.content ?? "").trim().replace(/\s+/g, " "), ms: Date.now() - t, inTok: j.usage?.prompt_tokens ?? 0, outTok: j.usage?.completion_tokens ?? 0 };
}

// ---- 5. honesty check #1: facts that live only in the dropped pile ----------
const facts = pickFacts(dropped, kept.map((m) => m.text).join("\n")).slice(0, 3);
await hud("jev · honesty check", `${facts.length} answers that live ONLY in dropped messages`);
const compacted = `GOAL: ${GOAL}\n\nThis is one agent session's context AFTER compaction: a summary paragraph that ` +
  `replaced ${dropped.length} messages, plus the ${kept.length} messages kept verbatim.\n\nSUMMARY: ${sum.text}\n\nKEPT MESSAGES:\n${kept.map(line).join("\n")}`;
for (const [i, f] of facts.entries()) { await ui("rq", { i, q: f.question }); await beat(240); }
const rq = {};
facts.forEach((f, i) => { rq[`q${i}`] = pick(f.question, Object.fromEntries(f.options.map((o) => [o, `the value was ${o}`]))); });
const rres = facts.length ? await jev.judge(compacted, rq) : { answers: {}, latencyMs: 0, usage: {} };
jevIn += rres.usage?.inputTokens ?? 0;
jevOut += rres.usage?.outputTokens ?? 0;
const hit = (i) => String(rres.answers[`q${i}`].answer) === facts[i].answer;
for (const [i, f] of facts.entries()) {
  const v = rres.answers[`q${i}`];
  await ui("rres", { i, ok: hit(i), text: `${hit(i) ? "recovered" : "lost"} · answered ${v.answer}, truth ${f.answer} · conf ${v.confidence.toFixed(2)}${v.escalate ? ` · escalate ${v.reason}` : ""}` });
  await beat(620); }
const recall = facts.filter((_, i) => hit(i)).length;
const before = pct(beforeTok), after = pct(afterTok);
await hud(`judged by Jev: ${N} msgs · ${calls} calls (p50 ${p50(lat)} ms) · written by LLM: 1 call · window ${before}% → ${after}% · recall ${recall}/${facts.length}`, "", "done");
await beat(2600);

/**
 * Pick facts whose answer appears in a DROPPED message and in no kept message.
 * Each probe reads one real output shape; the decoys are perturbations of the
 * true value, so exactly one option can be right and the others cannot.
 */
function pickFacts(msgs, keptTxt) {
  const numD = (v) => [7, -11, 23, -3, 41, 101].map((d) => String(Number(v) + d)).filter((x) => Number(x) > 0 && x !== v);
  const rotD = (v) => [1, 2, 3].map((k) => v.slice(k) + v.slice(0, k)).filter((x) => x !== v);
  const verD = (v) => { const p = v.slice(1).split(".").map(Number); return [[0, 2], [1, 3], [2, 4]].map(([i, d]) => "v" + p.map((x, j) => (j === i ? x + d : x)).join(".")).filter((x) => x !== v); };
  const probes = [
    [/^output: \s*(\d{2,4}) (src\/\S+\.ts)$/, (m) => [m[1], `\`wc -l\` reported how many lines for ${m[2]}?`, numD(m[1])]],
    [/^output: (v\d+\.\d+\.\d+)$/, (m) => [m[1], "Which version did `node --version` print in this session?", verD(m[1])]],
    [/^output: ([0-9a-f]{7}) (\S.{12,})$/, (m) => [m[1], `Which short commit hash did \`git log\` list for "${m[2].slice(0, 42)}"?`, rotD(m[1])]],
    [/^output: [-dlrwxst@+.]{10,11}\s+\d+ \S+ +\S+ +(\d{4,8}) \w{3} +\d+ +[\d:]+ (\S+)$/, (m) => [m[1], `\`ls -la\` reported how many bytes for ${m[2]}?`, numD(m[1])]],
    [/^output: \s*(\S+\.\w+)\s+\|\s+(\d{2,4}) [+-]/, (m) => [m[2], `\`git show --stat\` reported how many changed lines for ${m[1]}?`, numD(m[2])]],
  ];
  const out = [];
  for (const [re, build] of probes) {
    for (const m of msgs) {
      const g = re.exec(m.text);
      if (!g) continue;
      const [answer, question, decoys] = build(g);
      // The whole point: the value must be unrecoverable from what was kept.
      if (new RegExp(`(^|\\W)${answer.replace(/\./g, "\\.")}(\\W|$)`).test(keptTxt)) continue;
      if (decoys.length < 3 || out.some((f) => f.answer === answer)) continue;
      out.push({ answer, question, options: [answer, ...decoys.slice(0, 3)].sort(), from: m.n });
      break;  // one fact per probe
    }
  }
  return out;
}

// ---- 6. record -------------------------------------------------------------
if (page) {
  capturing = false;
  await capture;
  await ctx.close();
  await browser.close();
  mkdirSync(dirname(videoPath), { recursive: true });
  // Each GIF frame carries the real interval it was captured over, so the result
  // plays at 1× however many frames a preset keeps. First preset under the
  // 2.5 MB budget wins; dithering only adds noise a flat dark UI would pay for.
  for (const [colors, w, step] of [[32, 900, 1], [24, 900, 1], [16, 900, 1], [16, 760, 1], [16, 900, 2], [12, 760, 2]]) {
    const list = [];
    for (let i = 0; i < frames.length; i += step) {
      const next = frames[Math.min(i + step, frames.length - 1)];
      list.push(`file '${frames[i].f}'`, `duration ${(Math.max(next.t - frames[i].t, 60) / 1000).toFixed(3)}`);
    }
    list.push(`file '${frames.at(-1).f}'`);
    writeFileSync(join(tmp, "list.txt"), list.join("\n"));
    const pal = `palettegen=max_colors=${colors}[p];[b][p]paletteuse=dither=none`;
    execFileSync("ffmpeg", ["-y", "-f", "concat", "-safe", "0", "-i", join(tmp, "list.txt"), "-vf",
      `scale=${w}:-1:flags=lanczos,split[a][b];[a]${pal}`, "-loop", "0", videoPath], { stdio: "ignore" });
    const kb = statSync(videoPath).size / 1024, secs = (frames.at(-1).t - frames[0].t) / 1000;
    console.log(`gif ${videoPath} · ${kb.toFixed(0)} KB · ${Math.ceil(frames.length / step)} frames over ${secs.toFixed(1)}s · ${w}px · ${colors} colors`);
    if (kb <= 2440) break; // 2440 KiB = 2.49 MB, under the 2.5 MB README budget
  }
}

// ---- 7. the same numbers, with or without a camera -------------------------
console.log(`transcript: ${N} real messages from ${CMDS.length} commands in this repo · ${beforeTok} tok (≈ chars/4) · goal: ${GOAL}`);
console.log(`jev: ${calls} calls × ~${SLICE} check() questions · p50 ${p50(lat)} ms · latencies ${lat.join("/")} ms · ${jevIn}/${jevOut} tok (incl. the recall call)`);
console.log(`kept ${kept.length} · dropped ${dropped.length} · window ${WINDOW} tok: ${before}% → ${after}%`);
console.log(`${MODEL}: 1 call · ${sum.ms} ms · ${sum.inTok}/${sum.outTok} tok · ${sum.text.split(" ").length} words · ${traced}`);
console.log(`summary: ${sum.text}`);
for (const [i, f] of facts.entries()) console.log(`recall ${i + 1} ${hit(i) ? "✓" : "✗"} ${f.question} options ${f.options.join("|")} truth ${f.answer} answered ${rres.answers[`q${i}`].answer} conf ${rres.answers[`q${i}`].confidence.toFixed(2)}${rres.answers[`q${i}`].escalate ? " escalate:" + rres.answers[`q${i}`].reason : ""} (from dropped msg [${f.from}])`);
console.log(`recall ${recall}/${facts.length} · one extra batched judge call, ${rres.latencyMs} ms`);
// Exactly one markdown row, last line on stdout.
console.log(`| Context compaction | ${N} msgs judged in ${calls} calls (p50 ${p50(lat)} ms) · 1 LLM summary · window ${before}%→${after}% · recall ${recall}/${facts.length} |`);

/** The live page: one chat column, a context-window fill bar, a HUD, the check list. */
function pageHtml() {
  return `<!doctype html><meta charset=utf-8><style>
*{box-sizing:border-box;margin:0}body{width:900px;height:640px;background:#0b0d12;color:#c9d1d9;font:12px/1.4 ui-monospace,monospace;overflow:hidden}#hud{height:50px;display:flex;align-items:center;gap:10px;padding:0 14px;border-bottom:1px solid #1f2530}#body{display:flex;gap:12px;padding:12px 14px;height:556px}
#dot{width:9px;height:9px;border-radius:50%;background:#7ee787;flex:0 0 auto}#dot.llm{background:#79c0ff}#dot.done{background:#8b949e}#main{font-weight:700;font-size:13px;white-space:nowrap}#main.done{font-size:11.5px}#sub{color:#8b949e;font-size:11px;white-space:nowrap;overflow:hidden}#right{margin-left:auto;font-size:11px;white-space:nowrap}
#col{position:relative;width:548px;height:532px;background:#12151c;border:1px solid #262b36;border-radius:3px;overflow:hidden;padding:6px 8px}.row{height:16px;display:flex;gap:6px;align-items:center;overflow:hidden;opacity:1;transition:height .55s ease,opacity .35s ease,background .25s}.row.gone{height:0;opacity:0}
.row i{width:26px;text-align:right;color:#4d5666;font-style:normal;font-size:10px;flex:0 0 auto}.row s{width:58px;text-decoration:none;color:#6e7681;font-size:10px;flex:0 0 auto}.row span{font-size:10.5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:#8b949e}.row.user s,.row.assistant s{color:#9d8cd6}.row.user span,.row.assistant span{color:#c9d1d9}
.row.keep{background:rgba(126,231,135,.16)}.row.keep i{color:#7ee787}.row.drop{background:rgba(110,118,129,.07)}.row.drop span{color:#5b6270}#card{border:1px solid #79c0ff;border-radius:3px;background:rgba(121,192,255,.06);padding:6px 8px;margin:4px 0}#card b{color:#79c0ff;font-size:10px;font-weight:600;display:block;margin-bottom:4px}#card p{font-size:11px;line-height:1.5;color:#e6edf3;min-height:120px}
#rail{width:312px;display:flex;flex-direction:column;gap:10px}.lab{font-size:10px;color:#6e7681;text-transform:uppercase;letter-spacing:.06em}#barbox{display:flex;gap:10px;align-items:flex-end;height:246px}#bar{width:46px;height:246px;background:#12151c;border:1px solid #262b36;position:relative;overflow:hidden}
#fill{position:absolute;left:0;right:0;bottom:0;height:0;background:#d29922;transition:height .5s ease}#fill.low{background:#7ee787}#barpct{font-size:15px;font-weight:700;color:#e6edf3}#win{font-size:10px;color:#6e7681;margin-top:3px}#rl{display:flex;flex-direction:column;gap:7px;margin-top:3px}
.rr{font-size:10px;color:#8b949e;line-height:1.35;border-left:2px solid #262b36;padding-left:6px}.rr em{font-style:normal;color:#c9d1d9;display:block}.rr .v{color:#6e7681}.rr.ok{border-color:#7ee787}.rr.ok .v{color:#7ee787}.rr.no{border-color:#f85149}.rr.no .v{color:#f85149}
#foot{height:34px;display:flex;align-items:center;padding:0 14px;border-top:1px solid #1f2530;color:#6e7681;font-size:10.5px;gap:10px}#note{margin-left:auto;color:#8b949e}
</style>
<div id=hud><span id=dot></span><span id=main></span><span id=sub></span><span id=right></span></div>
<div id=body><div id=col><div id=list></div></div><div id=rail><div><div class=lab>context window</div><div id=win></div></div>
<div id=barbox><div id=bar><div id=fill></div></div><div><div id=barpct>0%</div><div class=lab>filled</div></div></div>
<div><div class=lab>honesty check · answers only in dropped msgs</div><div id=rl></div></div></div></div>
<div id=foot><span>transcript: real command outputs from this repo</span><span id=note></span></div>
<script>
const $ = (i) => document.getElementById(i), list = $("list"), col = $("col");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const esc = (s) => s.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));
const at = (n) => list.querySelector('[data-n="' + n + '"]');
window.ui = {
  init(o) { $("win").textContent = o.window.toLocaleString() + " tok (demo-sized; tok ≈ chars/4)"; $("note").textContent = "goal: " + o.goal; },
  hud(o) { $("dot").className = o.mode === "jev" ? "" : o.mode; $("main").className = o.mode === "done" ? "done" : ""; $("main").textContent = o.main; $("sub").textContent = o.sub ? "· " + o.sub : ""; $("right").textContent = o.right || ""; },
  add(items) { for (const m of items) { const d = document.createElement("div"); d.className = "row " + m.role; d.dataset.n = m.n; d.innerHTML = "<i>" + m.n + "</i><s>" + m.role + "</s><span>" + esc(m.text) + "</span>"; list.appendChild(d); } col.scrollTop = col.scrollHeight; },
  fill(o) { $("fill").style.height = Math.min(100, o.pct) + "%"; $("fill").className = o.pct < 60 ? "low" : ""; $("barpct").textContent = o.label; },
  toRow(n) { const r = at(n); if (r) col.scrollTop = Math.max(0, r.offsetTop - 4); },
  async marks(o) { for (const r of o.rows) { const e = at(r.n); if (e) e.classList.add(r.keep ? "keep" : "drop"); await sleep(o.stepMs); } },
  async collapse() { for (const e of list.querySelectorAll(".drop")) e.classList.add("gone"); await sleep(900); },
  summary(o) { const c = document.createElement("div"); c.id = "card"; c.innerHTML = "<b>" + esc(o.head) + "</b><p id=para></p>"; list.insertBefore(c, at(o.at) || list.firstChild); col.scrollTop = Math.max(0, c.offsetTop - 60); },
  async type(t) { const p = $("para"); for (let i = 0; i < t.length; i += 3) { p.textContent = t.slice(0, i + 3); await sleep(16); } p.textContent = t; },
  note(t) { $("note").textContent = t; },
  rq(o) { const d = document.createElement("div"); d.className = "rr"; d.id = "rr" + o.i; d.innerHTML = "<em>" + esc(o.q) + "</em><span class=v>asking jev…</span>"; $("rl").appendChild(d); },
  rres(o) { const d = $("rr" + o.i); d.className = "rr " + (o.ok ? "ok" : "no"); d.querySelector(".v").textContent = (o.ok ? "✓ " : "✗ ") + o.text; },
};
</script>`;
}
