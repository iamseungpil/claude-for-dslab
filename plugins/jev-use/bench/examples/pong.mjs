/**
 * Example: Pong, one paddle decision per ball step.
 *
 * Three independent Pong lanes run CONCURRENTLY for 20s of wall time: Jev's typed
 * judge, and two chat models over the Vercel AI Gateway. A lane's ball advances
 * exactly ONE step per COMPLETED decision — the sim blocks on its model, applies
 * the paddle move, steps the ball, then fires the next call immediately. So the
 * ball's speed on screen IS the model's decision rate, and a slow lane crawls.
 *
 * Fairness is mechanical: identical initial state, identical deterministic
 * physics, identical compact JSON state (ball x/y/velocity, paddle, field) and one
 * identical question with the same three options {up, down, stay}. The chat lanes
 * run at normal settings with max_tokens 1000, nothing disabled; an answer that
 * names an option inside prose is accepted (counted "unwrapped"), and only a text
 * naming no option counts as `stay` — each of those is printed verbatim. A
 * transport error yields NO decision: no step is applied, so that call's whole
 * duration becomes part of the wait for the next one. A call still in flight when
 * the 20s bell rings is abandoned, never counted.
 *
 * With --video the logged events replay 1:1 at their real timestamps in a canvas
 * page, recorded with Playwright and converted to a GIF. The renderer TWEENS the
 * ball and paddle between consecutive events, so a lane's ball glides for exactly
 * the interval its next decision really took: ball speed IS decision latency and
 * every lane is always visibly in motion. Interpolation is presentation only —
 * each event still lands on its own logged millisecond.
 *
 * Environment: AI_GATEWAY_API_KEY (all three lanes), plus PLAYWRIGHT_CORE and
 * CHROMIUM_PATH for --video.
 *
 * Run:   node bench/examples/pong.mjs [--video assets/pong.gif] [--log out.json]
 */

import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { Jev, pick } from "../../dist/index.js";

const arg = (f) => (process.argv.indexOf(f) > -1 ? process.argv[process.argv.indexOf(f) + 1] : null);
const videoPath = arg("--video");
const logPath = arg("--log");

const RUN_MS = 20_000;
const FIELD = { w: 280, h: 272 };
const PADDLE = { x: 268, w: 8, h: 56, step: 22 };
const BALL = { r: 6, x: 40, y: 80, vx: 16, vy: 11 };
const MOVES = ["up", "down", "stay"];
const QUESTION = "Move the paddle to intercept the ball. Which move?";
const OPTIONS = { up: "move the paddle up", down: "move the paddle down", stay: "keep the paddle where it is" };
const MAX_TOKENS = 1000;
const GATEWAY = process.env.AI_GATEWAY_BASE_URL ?? "https://ai-gateway.vercel.sh";
const LANES = [
  { key: "jev", model: "jev judge", color: "#7ee787" },
  { key: "haiku", model: "anthropic/claude-haiku-4.5", color: "#79c0ff" },
  { key: "gemini", model: "google/gemini-3-flash", color: "#ffa657" },
];

const jev = new Jev();
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const r0 = (v) => Math.round(v);
const p50 = (a) => (a.length ? r0([...a].sort((x, y) => x - y)[Math.floor(a.length / 2)]) : 0);

/** Fresh sim. Every lane starts here, so lane divergence comes only from decisions. */
const newSim = () => ({ ball: { ...BALL }, paddleY: (FIELD.h - PADDLE.h) / 2, hits: 0, misses: 0, resets: 0 });

/** The state handed to the model — same shape, same rounding, for every lane. */
const stateOf = (s) => ({
  ball: { x: r0(s.ball.x), y: r0(s.ball.y), vx: s.ball.vx, vy: s.ball.vy },
  paddle: { x: PADDLE.x, y: r0(s.paddleY), h: PADDLE.h },
  field: FIELD,
});

/** Deterministic physics: move the paddle, then advance the ball exactly one step. */
function advance(s, decision) {
  if (decision === "up") s.paddleY -= PADDLE.step;
  else if (decision === "down") s.paddleY += PADDLE.step;
  s.paddleY = clamp(s.paddleY, 0, FIELD.h - PADDLE.h);
  const b = s.ball;
  b.x += b.vx;
  b.y += b.vy;
  if (b.y < BALL.r) (b.y = BALL.r), (b.vy = -b.vy);
  if (b.y > FIELD.h - BALL.r) (b.y = FIELD.h - BALL.r), (b.vy = -b.vy);
  if (b.x < BALL.r) (b.x = BALL.r), (b.vx = -b.vx);
  if (b.vx <= 0 || b.x + BALL.r < PADDLE.x) return null;
  if (b.y >= s.paddleY - BALL.r && b.y <= s.paddleY + PADDLE.h + BALL.r) {
    s.hits++;
    (b.x = PADDLE.x - BALL.r), (b.vx = -b.vx);
    return "hit";
  }
  s.misses++;
  s.resets++;
  Object.assign(b, { x: BALL.x, y: BALL.y, vx: BALL.vx, vy: s.resets % 2 ? -BALL.vy : BALL.vy });
  return "miss";
}

/** Jev lane: one typed choice question per ball step. */
async function jevDecide(state) {
  const res = await jev.judge(state, { move: pick(QUESTION, OPTIONS) });
  const v = res.answers.move;
  const raw = v.answer === null ? "" : String(v.answer);
  const ok = MOVES.includes(raw);
  return { decision: ok ? raw : "stay", flag: ok ? "clean" : "unparsed", raw, ms: res.latencyMs ?? 0, escalate: v.escalate };
}

/**
 * Read a move out of a free-text answer, as generously as a caller plausibly could.
 * A bare option is `clean`; otherwise take the LAST option word in the text, which is
 * where a model that reasons first puts its verdict. Only a text naming no option at
 * all is `unparsed`, and that one counts as `stay`.
 */
function parseMove(raw) {
  const text = (raw ?? "").toLowerCase();
  const bare = text.trim().replace(/[^a-z ]+/g, " ").trim();
  if (MOVES.includes(bare)) return { decision: bare, flag: "clean" };
  const found = [...text.matchAll(/\b(up|down|stay)\b/g)];
  if (found.length) return { decision: found.at(-1)[1], flag: "unwrapped" };
  return { decision: "stay", flag: "unparsed" };
}

/** Chat lane: normal chat completion, the same state as JSON and the same question. */
const chatDecide = (model, signal) => async (state) => {
  const started = performance.now();
  try {
    const res = await fetch(`${GATEWAY}/v1/chat/completions`, {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.AI_GATEWAY_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        max_tokens: MAX_TOKENS,
        messages: [{ role: "user", content: `Pong state (JSON): ${JSON.stringify(state)}\n\n${QUESTION}\nAnswer with exactly one word: up, down, or stay.` }],
      }),
      signal,
    });
    const j = await res.json();
    const ms = performance.now() - started;
    if (!res.ok) return { error: (j?.error?.message ?? `HTTP ${res.status}`).slice(0, 52), ms };
    const raw = j.choices?.[0]?.message?.content ?? "";
    return { ...parseMove(raw), raw, ms, outTok: j.usage?.completion_tokens ?? 0, finish: j.choices?.[0]?.finish_reason };
  } catch (err) {
    // An abort is OUR 20s bell, not a model failure — flagged so it is not counted as an error.
    return { error: String(err.message).slice(0, 52), ms: performance.now() - started, aborted: signal?.aborted === true };
  }
};

/** One lane: decide → apply → step → decide again, until the bell. */
async function runLane(lane, decide, t0, deadline, log) {
  const sim = newSim();
  const st = { ...lane, decisions: 0, lat: [], errors: 0, unwrapped: 0, escalated: 0, outTok: 0, unparsed: [], inflight: 0 };
  while (performance.now() < deadline) {
    const d = await decide(stateOf(sim));
    const t = r0(performance.now() - t0);
    if (d.aborted || t > RUN_MS) { st.inflight = 1; break; } // in flight at the bell: abandoned, never counted
    const base = { t, lane: lane.key, latencyMs: r0(d.ms) };
    if (d.error) { st.errors++; log({ ...base, kind: "error", note: d.error }); continue; }
    const event = advance(sim, d.decision);
    st.decisions++;
    st.lat.push(d.ms);
    st.outTok += d.outTok ?? 0;
    if (d.flag === "unwrapped") st.unwrapped++;
    if (d.flag === "unparsed") st.unparsed.push(JSON.stringify(d.raw ?? ""));
    if (d.escalate) st.escalated++;
    log({ ...base, kind: "decision", n: st.decisions, decision: d.decision, flag: d.flag, ball: { x: r0(sim.ball.x), y: r0(sim.ball.y) }, paddle: r0(sim.paddleY), event });
  }
  return Object.assign(st, { hits: sim.hits, misses: sim.misses, steps: st.decisions });
}

// ---- live phase -------------------------------------------------------------
const abort = new AbortController();
const events = [];
const t0 = performance.now();
const timer = setTimeout(() => abort.abort(), RUN_MS);
const log = (e) => {
  events.push(e);
  process.stderr.write(`${String(e.t).padStart(6)}ms ${e.lane.padEnd(7)} ${e.kind === "error" ? `ERROR ${e.note}` : `${e.decision.padEnd(4)} ball ${String(e.ball.x).padStart(3)},${String(e.ball.y).padStart(3)} paddle ${String(e.paddle).padStart(3)} ${String(e.latencyMs).padStart(5)}ms${e.event ? " " + e.event : ""}${e.flag === "clean" ? "" : " " + e.flag}`}\n`);
};
console.log(`jev-use pong · 3 lanes, ${RUN_MS / 1000}s wall, one decision per ball step · backend ${jev.backend.name} (${jev.via})`);
const stats = await Promise.all(
  LANES.map((l) => runLane(l, l.key === "jev" ? jevDecide : chatDecide(l.model, abort.signal), t0, t0 + RUN_MS, log)),
);
clearTimeout(timer);
events.sort((a, b) => a.t - b.t);

for (const s of stats) {
  const note = (n, txt) => (n ? ` · ${n} ${txt}` : "");
  console.log(
    `${s.key.padEnd(7)} ${String(s.decisions).padStart(3)} decisions · p50 ${String(p50(s.lat)).padStart(5)}ms · ` +
      `${s.steps} ball steps · ${s.hits} hits / ${s.misses} misses` + note(s.errors, "errors") +
      note(s.unwrapped, "unwrapped") + note(s.outTok && r0(s.outTok / s.decisions), "out-tok/decision") +
      note(s.unparsed.length, "unreadable") + note(s.escalated, "low-confidence escalate") +
      (s.inflight ? " · 1 call in flight at the bell (dropped)" : ""),
  );
  for (const raw of s.unparsed) console.log(`        unreadable answer, counted as stay: ${raw}`);
}
if (logPath) writeFileSync(logPath, JSON.stringify({ runMs: RUN_MS, stats, events }, null, 1));

// ---- replay phase -----------------------------------------------------------
if (videoPath) {
  const { chromium } = await import(process.env.PLAYWRIGHT_CORE ?? "playwright-core");
  const VIEW = { width: 980, height: 428 }; // must match H in replayHtml
  const tmp = mkdtempSync(join(tmpdir(), "pong-"));
  writeFileSync(join(tmp, "replay.html"), replayHtml(events));
  const exe = process.env.CHROMIUM_PATH ?? chromium.executablePath();
  const browser = await chromium.launch({ executablePath: exe, args: ["--no-sandbox", "--disable-dev-shm-usage"] });
  const ctx = await browser.newContext({ viewport: VIEW, recordVideo: { dir: join(tmp, "vid"), size: VIEW } });
  const pg = await ctx.newPage();
  await pg.goto("file://" + join(tmp, "replay.html"));
  await pg.evaluate(() => window.startReplay());
  await pg.waitForFunction(() => window.replayDone === true, null, { timeout: RUN_MS + 30_000 });
  await ctx.close();
  await browser.close();
  const webm = join(tmp, "vid", readdirSync(join(tmp, "vid")).find((f) => f.endsWith(".webm")));
  mkdirSync(dirname(videoPath), { recursive: true });
  // First preset that clears the 2.5 MB budget wins; the first is the nicest. Frame rate
  // is spent before palette depth — tweened motion reads on fps, not on colour count —
  // and the flat dark UI has no gradients, so dithering only adds noise the GIF must pay for.
  for (const [fps, w, colors] of [[12, 980, 64], [12, 980, 48], [12, 980, 32], [11, 980, 32], [10, 980, 32], [10, 880, 24]]) {
    const pal = `palettegen=max_colors=${colors}[p];[b][p]paletteuse=dither=none`;
    execFileSync("ffmpeg", ["-y", "-i", webm, "-vf", `fps=${fps},scale=${w}:-1:flags=lanczos,split[a][b];[a]${pal}`, "-loop", "0", videoPath], { stdio: "ignore" });
    const kb = statSync(videoPath).size / 1024;
    console.log(`gif ${videoPath} · ${kb.toFixed(0)} KB · ${fps} fps · ${w}px · ${colors} colors · webm ${webm}`);
    if (kb <= 2440) break; // 2440 KiB = 2.49 MB, under the 2.5 MB budget the way a README counts it
  }
}

/** The replay page: real timestamps, three canvas lanes, motion tweened between events. */
function replayHtml(events) {
  return `<!doctype html><meta charset=utf-8><body style="margin:0;background:#0b0d12"><canvas id=c></canvas><script>
const LOG = ${JSON.stringify(events)}, LANES = ${JSON.stringify(LANES)};
const W = 980, H = 428, S = 2, PW = 316, PH = 392, PT = 8, FX = 18, FY = 30;
const FW = ${FIELD.w}, FH = ${FIELD.h}, R = ${BALL.r}, PADW = ${PADDLE.w}, PADH = ${PADDLE.h}, PADX = ${PADDLE.x};
const RUN = ${RUN_MS}, END = RUN + 900;
const START = { x: ${BALL.x}, y: ${BALL.y}, vx: ${BALL.vx}, vy: ${BALL.vy}, paddle: ${(FIELD.h - PADDLE.h) / 2} };
const cl = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

/**
 * Tween segments — PRESENTATION of the very same timestamps, not altered timing.
 *
 * The log says "decision n landed at t_n and put the ball here". Drawing only that
 * makes a slow lane teleport once and then sit dead for seconds, which reads as a
 * broken lane rather than as a slow one. So each lane gets one segment per landed
 * decision, spanning [t_(n-1), t_n] — exactly the real interval that decision took —
 * and the ball (and paddle) move LINEARLY across it. Constant speed over the real
 * duration means on-screen ball speed IS the decision latency: nothing is smoothed
 * away, no event moves by a millisecond, and every lane is always in motion.
 */
const SEG = {}, PACE = {};
for (const l of LANES) {
  const ev = LOG.filter((e) => e.lane === l.key && e.kind === "decision"), segs = [];
  let prev = { t: 0, x: START.x, y: START.y, paddle: START.paddle }, d = { x: START.vx, y: START.vy };
  for (const e of ev) {
    let bx = e.ball.x, by = e.ball.y, reset = null;
    if (e.event === "miss") {
      // A miss logs the position AFTER the respawn. The ball the viewer has to follow
      // first travels past the paddle, so glide to that projected exit point (one step
      // along the incoming direction — the sim's own step) and respawn at the segment
      // end, i.e. on the logged millisecond.
      bx = cl(prev.x + d.x, R, FW + R); by = cl(prev.y + d.y, R, FH - R);
      reset = { x: e.ball.x, y: e.ball.y };
    }
    segs.push({ t0: prev.t, t1: e.t, ax: prev.x, ay: prev.y, bx, by, pa: prev.paddle, pb: e.paddle, reset });
    d = { x: bx - prev.x, y: by - prev.y };
    prev = { t: e.t, x: reset ? reset.x : bx, y: reset ? reset.y : by, paddle: e.paddle };
  }
  const durs = segs.map((s) => s.t1 - s.t0).sort((a, b) => a - b);
  PACE[l.key] = durs.length ? Math.max(durs[Math.floor(durs.length / 2)], 1) : 1000;
  // FINAL segment: the call that was in flight at the bell never landed, so its target
  // is unknown. The ball keeps gliding toward the PROJECTED next step at this lane's own
  // pace but stalls at 90% while the ticker runs on — the lane ends visibly mid-wait,
  // which is what was truly happening at t=20s, instead of parked on a dead frame. The
  // paddle holds: the undelivered decision is the one that would have moved it.
  segs.push({ t0: prev.t, t1: Infinity, ax: prev.x, ay: prev.y, pa: prev.paddle, pb: prev.paddle,
    bx: cl(prev.x + d.x, R, FW + R), by: cl(prev.y + d.y, R, FH - R), reset: null, hold: PACE[l.key] });
  SEG[l.key] = segs;
}

const c = document.getElementById("c"), g = c.getContext("2d");
c.width = W * S; c.height = H * S; c.style.width = W + "px"; c.style.height = H + "px"; g.scale(S, S);
const st = {};
for (const l of LANES) st[l.key] = { si: 0, waitFrom: 0, trail: [], n: 0, ms: 0, dec: "-",
  hits: 0, misses: 0, errors: 0, err: "", bad: 0, flash: null };
let i = 0, t0 = null;

function apply(e) {
  const s = st[e.lane];
  s.waitFrom = e.t; // a lane fires its next call the instant one returns: the ticker times THAT wait
  if (e.kind === "error") { s.errors++; s.err = e.note; s.flash = { c: "#f85149", t: e.t, label: "ERROR" }; return; }
  s.err = ""; s.n = e.n; s.ms = e.latencyMs; s.dec = e.decision;
  if (e.flag === "unparsed") s.bad++;
  if (e.event) {
    s[e.event === "hit" ? "hits" : "misses"]++;
    s.flash = { c: e.event === "hit" ? "#7ee787" : "#f85149", t: e.t, label: e.event === "miss" ? "MISS" : null };
  }
  // The trail marks LANDED decisions, so its density is the lane's decision rate.
  if (e.event === "miss") s.trail = []; else s.trail.push({ x: e.ball.x, y: e.ball.y });
  if (s.trail.length > 18) s.trail.shift();
}

/** Where a lane's ball/paddle are at tau: linear interpolation inside the active segment. */
function poseOf(l, tau) {
  const segs = SEG[l.key], s = st[l.key];
  while (s.si < segs.length - 1 && tau >= segs[s.si].t1) s.si++;
  const q = segs[s.si];
  const u = q.hold !== undefined
    ? Math.min(0.9, (tau - q.t0) / q.hold)                        // final segment: stalls at 90%
    : cl((tau - q.t0) / Math.max(q.t1 - q.t0, 1), 0, 1);
  return { x: q.ax + (q.bx - q.ax) * u, y: q.ay + (q.by - q.ay) * u, p: q.pa + (q.pb - q.pa) * u };
}

const F = (px, col, bold) => { g.font = (bold ? "bold " : "") + px + "px ui-monospace,monospace"; g.fillStyle = col; };
const dot = (x, y, r) => { g.beginPath(); g.arc(x, y, r, 0, 7); g.fill(); };

function panel(l, x, tau) {
  const s = st[l.key], fx = x + FX, fy = PT + FY, foot = fy + FH, pose = poseOf(l, tau);
  const flash = s.flash && tau - s.flash.t < 420 ? s.flash : null;
  g.fillStyle = "#12151c"; g.fillRect(x, PT, PW, PH);
  g.strokeStyle = flash ? flash.c : "#262b36"; g.lineWidth = flash ? 2 : 1;
  g.strokeRect(x + 0.5, PT + 0.5, PW - 1, PH - 1);
  F(15, l.color, 1); g.fillText(l.key, x + 14, PT + 21);
  const keyW = g.measureText(l.key).width;
  F(11, "#8b949e"); g.fillText(l.model, x + 24 + keyW, PT + 21);
  g.fillStyle = "#0b0d12"; g.fillRect(fx, fy, FW, FH);
  g.strokeStyle = "#1f2530"; g.lineWidth = 1; g.strokeRect(fx + 0.5, fy + 0.5, FW - 1, FH - 1);
  g.setLineDash([5, 7]); g.beginPath(); g.moveTo(fx + FW / 2, fy); g.lineTo(fx + FW / 2, fy + FH); g.stroke(); g.setLineDash([]);
  g.save(); g.beginPath(); g.rect(fx, fy, FW, FH); g.clip();
  g.fillStyle = l.color;
  s.trail.forEach((p, k) => { g.globalAlpha = 0.06 + 0.32 * (k / s.trail.length); dot(fx + p.x, fy + p.y, R * 0.7); });
  g.globalAlpha = 1; g.fillStyle = l.color; dot(fx + pose.x, fy + pose.y, R);
  g.restore();
  g.fillStyle = "#c9d1d9"; g.fillRect(fx + PADX, fy + pose.p, PADW, PADH);
  if (s.err || s.errors) {
    F(11, s.err ? "#f85149" : "#d29922");
    g.fillText(s.err ? "error: " + s.err : s.errors + " error(s) this run", fx + 8, fy + 16);
  }
  if (flash && flash.label) { F(13, flash.c, 1); g.fillText(flash.label, fx + FW - 10 - g.measureText(flash.label).width, fy + 16); }
  F(24, l.color, 1);
  const nTxt = String(s.n), nW = g.measureText(nTxt).width;
  g.fillText(nTxt, fx + 6, foot + 26);
  F(11, "#8b949e"); g.fillText("decisions", fx + 14 + nW, foot + 26);
  g.fillText("last " + s.ms + "ms \\u00b7 " + s.dec, fx + 6, foot + 44);
  g.fillText(s.hits + " hits / " + s.misses + " misses" + (s.bad ? " \\u00b7 " + s.bad + " unreadable" : ""), fx + 6, foot + 60);
  // Live ticker: how long this lane's next decision has been in flight, in replay time.
  F(11, "#8b949e"); g.fillText("deciding\\u2026", fx + 6, foot + 78);
  F(11, l.color); g.fillText(Math.round(tau - s.waitFrom) + "ms", fx + 6 + g.measureText("deciding\\u2026 ").width, foot + 78);
}

function frame() {
  const raw = performance.now() - t0, tau = Math.min(raw, RUN); // past the bell the last frame holds
  while (i < LOG.length && LOG[i].t <= tau) apply(LOG[i++]);
  g.fillStyle = "#0b0d12"; g.fillRect(0, 0, W, H);
  LANES.forEach((l, k) => panel(l, 8 + k * (PW + 8), tau));
  g.font = "12px ui-monospace,monospace"; g.fillStyle = "#6e7681";
  g.fillText("1\\u00d7 replay of a live run \\u2014 ball speed = decision speed, real latencies", 14, H - 11);
  const clock = "t = " + (tau / 1000).toFixed(1) + "s";
  g.fillText(clock, W - 14 - g.measureText(clock).width, H - 11);
  if (raw > END) { window.replayDone = true; return; }
  requestAnimationFrame(frame);
}
window.startReplay = () => { t0 = performance.now(); requestAnimationFrame(frame); };
g.fillStyle = "#0b0d12"; g.fillRect(0, 0, W, H); LANES.forEach((l, k) => panel(l, 8 + k * (PW + 8), 0));
</script></body>`;
}

// Exactly one markdown row, last line on stdout.
const cell = (s, first) => `${s.key} ${s.decisions}${first ? " decisions" : ""} (p50 ${p50(s.lat)}ms)`;
console.log(
  `| Pong, one decision per ball step | ${cell(stats[0], true)} vs ${cell(stats[1])} vs ${cell(stats[2])} in ${RUN_MS / 1000}s |`,
);
