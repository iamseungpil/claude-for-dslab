/**
 * Example: one real browser errand split between two models by the KIND of step
 * rather than its difficulty. `route()` makes the split on screen — called
 * before every step, an enumerable one routes `{to:"jev"}` and one that must
 * produce content routes `{to:"llm", reason:"writing"}` — so the HUD flips
 * colour exactly where the work changes hands.
 *
 * Task: walking directions from the Eiffel Tower to the Louvre on the real
 * openstreetmap.org. Jev picks the control that opens the directions panel (out
 * of every control the page offers), picks the travel mode, checks each field
 * the chat model filled, picks the action that submits, and judges the rendered
 * route against the goal. claude-haiku-4.5 writes the two place queries, typed
 * character by character into the real fields.
 *
 * The map starts at the site's default world view, so the geocoder has no hint
 * about which Paris is meant and "Eiffel Tower, Paris" routinely lands on the
 * replica in Paris, TEXAS. Nothing here is staged: when it happens Jev rejects
 * the rendered route and the field goes back to the model with what the
 * geocoder actually returned — the same handoff `route` makes, one call later.
 *
 * Environment: AI_GATEWAY_API_KEY serves BOTH sides (the Jev backend and the
 * chat model); PLAYWRIGHT_CORE and CHROMIUM_PATH locate playwright-core and the
 * browser binary; FFMPEG the encoder (--video only); COLLAB_MODEL swaps the
 * chat model (default anthropic/claude-haiku-4.5).
 *
 * Run: node bench/examples/collab.mjs [--video assets/collab.gif]
 *
 * --video records the real browser with the HUD over the page and writes the
 * GIF itself, 1x and uncut. The only presentation cost is the dwell holding a
 * decision on screen long enough to read; it is measured and subtracted, so the
 * reported total is the task's own time in either mode. Typing IS the task and
 * is billed to it.
 */

import { mkdirSync, mkdtempSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { tmpdir } from "node:os";
import { spawnSync } from "node:child_process";
import { Jev, check, pick, route } from "../../dist/index.js";
import { HUD_H, esc, installHud, paint } from "./hud.mjs";

const videoOut = process.argv.includes("--video") ? process.argv[process.argv.indexOf("--video") + 1] : null;

const START = "https://www.openstreetmap.org/";
const GOAL = "get walking directions from the Eiffel Tower to the Louvre";
const ENDS = [
  { field: "From", sel: "#route_from", what: "the starting point, the Eiffel Tower in Paris" },
  { field: "To", sel: "#route_to", what: "the destination, the Louvre in Paris" },
];
const ACTIONS = {
  "submit the form": "compute the route between what the two fields now hold",
  "reverse the endpoints": "swap From and To",
  "close the panel": "dismiss the directions panel",
  "change the travel mode": "pick a different travel mode",
};
const MODEL = process.env.COLLAB_MODEL ?? "anthropic/claude-haiku-4.5";
const GATEWAY = "https://ai-gateway.vercel.sh/v1/chat/completions";
const VIEW = { width: 820, height: 640 };
const GIF = { fps: 8, width: 820, colors: 16 };
const TYPE_MS = 45; // per character, into the real field
const DWELL = videoOut ? 850 : 0; // holds one decision on screen — presentation only
const [JEV_HUE, LLM_HUE, BAD_HUE] = ["#3fb950", "#58a6ff", "#f85149"];

const jev = new Jev();
const { chromium } = await import(process.env.PLAYWRIGHT_CORE ?? "playwright-core");

const t0 = performance.now();
let presentMs = 0; // dwell only — never billed to the task clock
const secs = () => (performance.now() - t0 - presentMs) / 1000;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const present = async (fn) => { const t = performance.now(); await fn(); presentMs += performance.now() - t; };
const [B, D, G, C, Y, R, X] = ["1m", "2m", "32m", "36m", "33m", "31m", "0m"].map((c) => `\x1b[${c}`);
const p50 = (a) => (a.length ? [...a].sort((x, y) => x - y)[Math.floor(a.length / 2)] : 0);
const clip = (s, n) => (s.length > n ? s.slice(0, n - 1) + "…" : s);

const jevMs = []; // one entry per Jev decision
const writes = []; // one entry per chat-model call: { field, text, ms }
const trail = []; // what has happened, fed to every later decision
const tally = () => `Jev decisions: ${jevMs.length} · LLM writes: ${writes.length} · ${secs().toFixed(1)}s`;
const HUD = videoOut
  ? { h: HUD_H, hue: JEV_HUE, label: "jev · deciding", sub: "", meta: "", status: GOAL, tone: "#9aa7b4", tick: false }
  : null; // without --video every paint below is a no-op
const hud = (patch) => paint(page, HUD, patch);
const vis = (sel) => page.locator(sel).locator("visible=true").first(); // the site ships a hidden mobile copy of every control
/** Presentation only: the HUD takes the site header's place, so the bar covers
 *  nothing the task needs and the map/sidebar keep the full viewport below it. */
const layout = () => (videoOut
  ? page.evaluate((h) => {
      const header = document.querySelector("header");
      if (header) header.style.display = "none";
      const content = document.querySelector("#content");
      if (content) content.style.top = `${h}px`;
      else console.warn("no #content — layout unchanged");
    }, HUD_H)
  : Promise.resolve());
const stateOf = (extra) =>
  `Browser agent on openstreetmap.org, ${VIEW.width}x${VIEW.height} viewport.\nGoal: ${GOAL}.\n` +
  `Done so far: ${trail.length ? trail.join("; ") : "nothing yet — the map just loaded"}.\n${extra}`;

/* ------------------------------ the two sides ---------------------------- */

/** One Jev decision: route() first, then one typed question over live state. */
async function decide(label, state, question) {
  const r = route({ producesContent: false, enumerable: true });
  await hud({ hue: JEV_HUE, label: "jev · deciding", sub: `route() → to:"${r.to}"`,
    status: `${esc(label)}…`, tone: "#e3b341", tick: true, meta: tally() });
  const res = await jev.judge(state, { it: question });
  const v = res.answers.it;
  const ms = Math.round(res.latencyMs ?? 0);
  jevMs.push(ms);
  const shown = typeof v.answer === "number" ? v.answer.toFixed(2) : String(v.answer ?? "—");
  await hud({ status: `${esc(label)} → ${esc(clip(shown, 42))} · ${ms}ms`, tone: JEV_HUE, tick: false, meta: tally() });
  console.log(`${D}${secs().toFixed(1).padStart(5)}s${X} ${G}jev${X} ${label.slice(0, 34).padEnd(34)} ${D}->${X} ` +
    `${clip(shown, 42).padEnd(42)} ${C}${String(ms).padStart(4)}ms${X} ${D}c${v.confidence.toFixed(2)}` +
    `${v.escalate ? ` escalate:${v.reason}` : ""}${X}`);
  if (DWELL) await present(() => sleep(DWELL));
  return v;
}

/** One chat-model call over the same gateway key: normal settings, one line back. */
async function askModel(instruction) {
  const started = Date.now();
  const r = await fetch(GATEWAY, {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.AI_GATEWAY_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: MODEL, max_tokens: 300, messages: [{ role: "user", content: instruction }] }),
  });
  const ms = Date.now() - started;
  if (!r.ok) throw new Error(`gateway HTTP ${r.status}: ${(await r.text()).slice(0, 160)}`);
  const choice = (await r.json()).choices?.[0];
  const raw = choice?.message?.content ?? "";
  return { text: raw.trim().split("\n")[0].replace(/^["'`]+|["'`]+$/g, "").trim(), raw, ms, finish: choice?.finish_reason };
}

/** One writing step: route() hands it to the model, which types it for real. */
async function write(end, note) {
  const r = route({ producesContent: true, enumerable: false });
  await hud({ hue: LLM_HUE, label: `${MODEL.split("/")[1]} · writing`, sub: `route() → to:"${r.to}" · ${r.reason}`,
    status: `composing the "${end.field}" query…`, tone: LLM_HUE, tick: true, meta: tally() });
  const { text, raw, ms, finish } = await askModel(
    `You are filling in the directions form on openstreetmap.org.\nGoal: ${GOAL}.\n` +
    `Write the exact text to type into the "${end.field}" field so the map's geocoder finds ${end.what}.\n` +
    (note ? `${note}\n` : "") + "Reply with that search text only — no quotes, no explanation, one line.");
  writes.push({ field: end.field, text, ms });
  await hud({ status: `"${esc(clip(text, 38))}" · ${ms}ms — typing it in`, tick: false, meta: tally() });
  console.log(`${D}${secs().toFixed(1).padStart(5)}s${X} ${C}llm${X} ${`writes the "${end.field}" query`.padEnd(34)} ${D}->${X} ` +
    `${clip(JSON.stringify(raw), 42).padEnd(42)} ${C}${String(ms).padStart(4)}ms${X} ${D}${MODEL} finish=${finish}${X}`);
  const field = vis(end.sel);
  await field.click();
  await field.fill("");
  await field.pressSequentially(text, { delay: TYPE_MS }); // real keystrokes, one visible at a time
  return text;
}

/** Model writes the field, Jev checks what landed in it; unconvinced once = one rewrite. */
async function fill(end, note = "") {
  const text = await write(end, note);
  const typed = await vis(end.sel).inputValue();
  const ok = await decide(`is the "${end.field}" text usable`, stateOf(`The "${end.field}" field now reads: "${typed}".`),
    check(`Will the map's geocoder resolve "${typed}" to ${end.what}?`, {
      true: "the text names that place specifically enough for a geocoder to find it",
      false: "the text is empty, ambiguous, or names somewhere else entirely",
    }));
  if ((Number(ok.answer) < 0.5 || ok.escalate) && !note) {
    console.log(`${Y}      jev is not convinced by "${text}" — the field goes back to the model${X}`);
    return fill(end, `Your previous text, "${text}", was rejected as too vague. Write a more specific query.`);
  }
  trail.push(`${end.field} = "${typed}"`);
}

/* --------------------------------- drive --------------------------------- */

const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH ?? chromium.executablePath(),
  args: ["--no-sandbox", "--disable-dev-shm-usage"],
});
const videoDir = videoOut ? mkdtempSync(join(tmpdir(), "collab-video-")) : null;
const ctx = await browser.newContext({
  viewport: VIEW,
  reducedMotion: "reduce",
  // The HUD is injected markup carrying inline styles, and this site's CSP
  // drops those (its own behaviour is unaffected either way).
  bypassCSP: true,
  userAgent: "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36",
  ...(videoDir ? { recordVideo: { dir: videoDir, size: VIEW } } : {}),
});
const page = await ctx.newPage();
if (HUD) Object.assign(HUD, { sub: `jev ${jev.backend.name} + ${MODEL.split("/")[1]}` });
await installHud(page, HUD);

console.log(`${B}jev-use collaboration${X} ${D}· ${GOAL}${X}`);
console.log(`${D}every click decided by jev (${jev.via}) · every keystroke written by ${MODEL} · one key${X}`);
await page.goto(START, { waitUntil: "domcontentloaded", timeout: 60_000 });
await vis("form.search_form").waitFor({ timeout: 30_000 });
await sleep(2000); // let the first map tiles land
await layout();
// The first-visit welcome panel covers the sidebar; dismissing it is
// housekeeping, not a decision.
await page.evaluate(() => document.querySelector(".welcome .btn-close")?.click());

// 1. Which of the controls the page actually offers starts a directions search?
const controls = await page.evaluate(() =>
  [...document.querySelectorAll("#sidebar [title], .leaflet-control [title]")]
    .filter((e) => e.offsetParent && e.getAttribute("title"))
    .map((e) => e.getAttribute("title"))
    .filter((t, i, a) => a.indexOf(t) === i));
const control = await decide("which control opens directions",
  stateOf(`Controls the page offers right now: ${controls.join(", ")}.`),
  pick("Which control should be clicked next to move toward the goal?",
    Object.fromEntries(controls.map((c) => [c, `click the control titled "${c}"`]))));
await vis(`[title="${control.answer}"]`).click();
trail.push(`clicked "${control.answer}"`);
await vis("#route_from").waitFor({ timeout: 15_000 }).catch(() => {
  throw new Error(`the directions panel never opened after jev clicked "${control.answer}"`);
});

// 2. Which travel mode — the three the panel offers, read off the page.
const modes = await page.evaluate(() =>
  [...document.querySelectorAll(".routing_modes label")].filter((e) => e.offsetParent).map((e) => e.title));
const mode = await decide("which travel mode",
  stateOf(`The directions panel offers these travel modes: ${modes.join(", ")}.`),
  pick("Which travel mode matches the goal?", Object.fromEntries(modes.map((m) => [m, `route for: ${m.toLowerCase()}`]))));
await vis(`.routing_modes label[title="${mode.answer}"]`).click();
trail.push(`travel mode ${mode.answer}`);

// 3-6. Both endpoints: the model writes and types, Jev checks what landed.
for (const end of ENDS) await fill(end);

// 7-8, at most twice: Jev decides to submit, then judges the route the site
// rendered against the goal. Wrong endpoints are a text problem, so the repair
// is the model's — with the geocoder's own answer as the correction.
let reached = false;
let summary = "";
let panelSeen = ""; // the panel text jev judged last round, so a stale one is never judged twice
let resolved = ["", ""];
for (let round = 1; round <= 2 && !reached; round++) {
  const act = await decide("what to do with the filled form",
    stateOf("Both endpoints are filled in and the travel mode is set; nothing is submitted yet."),
    pick("What is the next action?", ACTIONS));
  if (act.answer !== "submit the form") {
    throw new Error(`jev chose "${act.answer}" over submitting — stopping rather than overriding the decision`);
  }
  await vis("#route_to").click();
  await page.keyboard.press("Enter");
  await layout();
  await hud({ hue: JEV_HUE, label: "jev · deciding", sub: "", status: "route requested — waiting for the map…",
    tone: "#e3b341", tick: true, meta: tally() });
  // A panel this round has not already judged, carrying a distance and a
  // duration: the site geocodes both endpoints and calls a routing engine, and
  // it starts as soon as a field changes, so the route is sometimes already
  // there when the submit lands. What must never pass is the PREVIOUS round's
  // panel, which is what `panelSeen` rules out.
  await page.waitForFunction((prev) => {
    const t = (document.querySelector("#sidebar_content")?.innerText ?? "").replace(/\s+/g, " ").trim();
    return t !== prev && /\d+(\.\d+)?\s?(km|m|mi|ft)\b[^|]*\d+:\d\d/.test(t);
  }, panelSeen, { timeout: 45_000 })
    .catch(() => console.log(`${R}      no route summary after 45s — asking jev about whatever the panel shows${X}`));
  await sleep(600); // let the turn list finish painting before it is read
  resolved = await Promise.all(ENDS.map((e) => vis(e.sel).inputValue()));
  [summary, panelSeen] = await page.evaluate(() => {
    const t = document.querySelector("#sidebar_content")?.innerText ?? "";
    return [t.replace(/[ \t]+/g, " ").replace(/\n{2,}/g, "\n").trim().slice(0, 700), t.replace(/\s+/g, " ").trim()];
  });
  const done = await decide("is this the route the goal asked for",
    `Goal: ${GOAL}.\nThe geocoder resolved the endpoints to:\nFrom: ${resolved[0]}\nTo: ${resolved[1]}\n` +
      `The directions panel now reads:\n${summary}`,
    check("Is the walking route the goal asked for now on screen?", {
      true: "both endpoints are the places the goal named, and a distance and a duration are shown",
      false: "no route at all, or a route between the wrong places",
    }));
  reached = Number(done.answer) >= 0.5 && !done.escalate;
  if (reached || round === 2) break;
  console.log(`${Y}      jev rejects the rendered route — the endpoint text goes back to the model${X}`);
  await hud({ hue: BAD_HUE, label: "jev · deciding", status: "wrong place — handing the fields back to the model",
    tone: BAD_HUE, tick: false, meta: tally() });
  // Keep the two UI facts (the click, the travel mode), drop the endpoint text
  // that is about to be rewritten, and say why it is being rewritten.
  trail.splice(2, trail.length, "the first attempt routed to the wrong place");
  for (const [i, end] of ENDS.entries()) {
    await fill(end, `Your previous text resolved to "${clip(resolved[i], 90)}", which is the wrong place, and the route ` +
      `came out as "${(summary.match(/Distance:[^\n]*/) ?? ["nothing"])[0].trim()}". Write a fully qualified query — include the city AND the country.`);
  }
}

const task = secs(); // the task clock stops here; everything below is video
const headline = (summary.match(/Distance:[^\n]*/) ?? ["no route summary rendered"])[0].trim();
console.log();
for (const w of writes) console.log(`${C}·${X} ${MODEL} wrote the ${w.field} field ${D}(${w.ms}ms)${X}: "${w.text}"`);
console.log(`${reached ? G : R}·${X} ${headline} ${D}· from ${clip(resolved[0], 46)} · to ${clip(resolved[1], 46)}${X}`);
console.log(`${B}${jevMs.length} jev decisions${X} ${D}p50 ${p50(jevMs)}ms · sum ${(jevMs.reduce((a, b) => a + b, 0) / 1000).toFixed(1)}s${X} ` +
  `${B}· ${writes.length} llm writes${X} ${D}${writes.map((w) => `${w.ms}ms`).join(", ")} · task ${task.toFixed(1)}s` +
  (presentMs > 500 ? ` · wall ${((performance.now() - t0) / 1000).toFixed(1)}s incl. ${(presentMs / 1000).toFixed(1)}s dwell` : "") + X);

if (videoOut) {
  await hud({ hue: reached ? JEV_HUE : BAD_HUE, label: `jev + ${MODEL.split("/")[1]}`, sub: "clicks decided · text written",
    status: `${reached ? "DONE" : "NOT REACHED"} · ${esc(headline)}`, tone: reached ? JEV_HUE : BAD_HUE, tick: false, meta: tally() });
  await sleep(2600); // readable last frame, after the clock has stopped
}
const video = videoOut ? page.video() : null;
await page.close();
await ctx.close(); // flushes the webm
await browser.close();

if (videoOut) {
  const src = await video.path();
  mkdirSync(dirname(videoOut), { recursive: true });
  // webm → GIF, two-pass palette, constant frame rate. Dropping still frames
  // (mpdecimate + vfr) would be smaller, but measured against this recording it
  // also shaved 3.3s off a 29.5s timeline — so every frame is kept and the GIF
  // lasts exactly as long as the run did: 1x, no cuts.
  const palette = join(dirname(src), "palette.png");
  const run = (args) => {
    const r = spawnSync(process.env.FFMPEG ?? "ffmpeg", ["-v", "error", "-y", ...args], { stdio: "inherit" });
    if (r.error) throw r.error;
    if (r.status !== 0) throw new Error(`ffmpeg exited ${r.status}`);
  };
  const encode = ({ fps, colors, width }) => {
    const scale = `fps=${fps},scale=${width}:-2:flags=area`;
    run(["-i", src, "-vf", `${scale},palettegen=max_colors=${colors}:stats_mode=diff`, palette]);
    run(["-i", src, "-i", palette, "-lavfi", `${scale}[x];[x][1:v]paletteuse=dither=none:diff_mode=rectangle`, videoOut]);
    return statSync(videoOut).size;
  };
  // Map tiles are expensive frames, so the 2.5MB budget is enforced rather than
  // hoped for: a narrower frame and a lower rate until it fits. Never a cut and
  // never a speed-up — the clock in the GIF stays the clock in the report.
  let cfg = GIF, bytes = encode(GIF);
  for (const next of [{ fps: 7, colors: 16, width: 700 }, { fps: 6, colors: 16, width: 600 }, { fps: 5, colors: 16, width: 520 }]) {
    if (bytes <= 2_500_000) break;
    console.error(`${D}gif ${Math.round(bytes / 1024)}KB over budget — re-encoding at ${next.width}px/${next.fps}fps${X}`);
    bytes = encode((cfg = next));
  }
  console.error(`${D}${videoOut} ${Math.round(bytes / 1024)}KB · ${cfg.width}px · ${cfg.fps}fps · ${cfg.colors} colours · source ${src}${X}`);
}

// Exactly one markdown row, last line on stdout.
console.log(`| Click-and-type task: ${GOAL} | ${jevMs.length} Jev decisions (p50 ${p50(jevMs)} ms) · ` +
  `${writes.length} LLM writes (${writes.map((w) => `${w.ms} ms`).join(", ")}) · ${task.toFixed(1)}s total |`);
