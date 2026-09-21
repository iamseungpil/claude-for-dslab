/**
 * Example: a two-lane Wikipedia race — one lane decided by Jev's judge, the
 * other by a frontier chat model. Each drives its OWN browser page, and the
 * lanes run concurrently off one shared clock so the cast interleaves in true
 * time. Fairness is the whole point, so it is mechanical: identical state
 * string, identical <=25 links (same extractor, same visited filter), same hop
 * budget. The baseline runs at normal settings, generous token budget, nothing
 * disabled; an off-list answer costs it a RETRY of the same step, never a free
 * hop. Page-load time is measured per lane and never billed to a model.
 *
 * Environment:
 *   AI_GATEWAY_API_KEY  serves BOTH lanes (Jev judge + chat baseline)
 *   PLAYWRIGHT_CORE     module id/path for playwright-core, when it is not
 *                       resolvable from here (default: "playwright-core")
 *   CHROMIUM_PATH       chromium / headless-shell binary to launch
 *   RACE_LLM_MODEL      baseline model id (default: anthropic/claude-haiku-4.5)
 *
 * Run:    node bench/examples/race.mjs [--cast out.cast] [--video dir]
 * Render: agg out.cast race.gif
 *
 * --video records one real browser video per lane (dir/jev.webm, dir/llm.webm)
 * with a status HUD painted over each page, and prints the ffmpeg hstack line
 * that joins them. It adds no waiting to the race itself: the lanes decide and
 * navigate exactly as they do without it, and the clock in every reported
 * number is the same clock. The only extra time is AFTER both lanes are done,
 * where the finished pages are held on screen so the summary is readable.
 */

import { renameSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { Jev, pick } from "../../dist/index.js";
import { HUD_H, esc, installHud, paint } from "./hud.mjs";

const castIdx = process.argv.indexOf("--cast");
const castPath = castIdx > -1 ? process.argv[castIdx + 1] : null;
const videoIdx = process.argv.indexOf("--video");
const videoDir = videoIdx > -1 ? process.argv[videoIdx + 1] : null;

const START = "https://en.wikipedia.org/wiki/Coffee";
const TARGET = "Ethiopia";
const MAX_STEPS = 8;
const MAX_LINKS = 25; // Jev allows <= 30 options per choice question
const MAX_RETRIES = 3; // per step, then the lane stalls instead of guessing

const LLM_MODEL = process.env.RACE_LLM_MODEL ?? "anthropic/claude-haiku-4.5";
const LLM_MAX_TOKENS = 512; // generous; nothing truncated, nothing disabled
const GATEWAY = process.env.AI_GATEWAY_BASE_URL ?? "https://ai-gateway.vercel.sh";

const jev = new Jev();
const { chromium } = await import(process.env.PLAYWRIGHT_CORE ?? "playwright-core");

const t0 = performance.now();
const events = [];
const secs = () => (performance.now() - t0) / 1000;
const say = (line = "") => {
  process.stdout.write(line + "\n");
  events.push([secs(), "o", line + "\r\n"]);
};

const [B, D, G, Y, R, C, U, X] = ["1m", "2m", "32m", "33m", "31m", "36m", "34m", "0m"]
  .map((c) => `\x1b[${c}`);
const clip = (s, n) => (s.length > n ? s.slice(0, n - 1) + "…" : s).padEnd(n);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* ------------------------------ video mode ------------------------------ *
 * The HUD itself lives in hud.mjs, shared with task.mjs. Everything below is
 * inert unless --video was passed: a null `st.hud` makes every paint a no-op. */

const VIEW = { width: 640, height: 500 };
const HUD_HUE = { jev: "#3fb950", llm: "#58a6ff" };
const hud = (page, st, patch) => paint(page, st.hud, patch, `hud ${st.tag}`);

// Both lanes hold their last frame until the other lane is also done, so the
// finished video shows one lane waiting at the target while the other runs on.
let releaseLanes;
const bothLanesDone = new Promise((r) => (releaseLanes = r));
let lanesDone = 0;
const laneFinished = () => { if (++lanesDone === 2) releaseLanes(); };

/** Read the open article's lead paragraph and its first in-content links. */
const readPage = (page, max) =>
  page.evaluate((max) => {
    const root =
      document.querySelector("#mw-content-text > .mw-parser-output") ??
      document.querySelector("#mw-content-text");
    // Non-article namespaces: files, categories, project pages, talk.
    const NS = "File|Image|Media|Help|Special|Wikipedia|Category|Template|Portal|Talk|Draft|Module|MediaWiki|User";
    const BAD = new RegExp(`^(${NS})(_talk)?:`, "i");
    const SKIP = "sup, .reflist, .navbox, .hatnote, .mw-editsection, .metadata, .sistersitebox";
    let lead = "";
    const links = [];
    if (!root) return { lead, links };
    for (const p of root.querySelectorAll("p")) {
      const t = p.innerText.trim().replace(/\s+/g, " ");
      if (t.length > 140) { lead = t.slice(0, 500); break; }
    }
    const seenPath = new Set(), seenText = new Set();
    for (const a of root.querySelectorAll("a[href]")) {
      if (a.closest(SKIP)) continue; // citation markers, navboxes, hatnotes
      let u, slug;
      try { u = new URL(a.getAttribute("href"), location.href); } catch { continue; }
      if (u.host !== location.host || !u.pathname.startsWith("/wiki/")) continue;
      try { slug = decodeURIComponent(u.pathname.slice(6)); } catch { continue; }
      if (!slug || BAD.test(slug)) continue;
      const text = (a.textContent || "").trim().replace(/\s+/g, " ").slice(0, 46);
      const key = text.toLowerCase();
      if (!text || seenPath.has(u.pathname) || seenText.has(key)) continue;
      seenPath.add(u.pathname);
      seenText.add(key);
      links.push({ text, title: slug.replace(/_/g, " "), url: u.origin + u.pathname });
      if (links.length >= max) break;
    }
    return { lead, links };
  }, max);

/** The one question, worded identically for both lanes. */
const ASK = `Which link most directly leads toward the article '${TARGET}'?`;
const stateOf = (here, lead, path) =>
  `Wikipedia article open in the browser: "${here}"\nTarget article: "${TARGET}"\n` +
  `Path so far: ${path.join(" -> ")}\nLead paragraph: ${lead}`;

/** Jev lane: one judge call per step, options = the same link set. */
async function jevPick(state, links) {
  const res = await jev.judge(state, {
    // label = the link text as rendered; meaning = the article it opens
    click: pick(
      ASK,
      Object.fromEntries(links.map((l) => [l.text, `opens the article "${l.title}"`])),
    ),
  });
  const v = res.answers.click;
  return {
    answer: v.answer === null ? null : String(v.answer),
    note: v.answer === null ? `${v.reason} — ${v.hint}` : `c${v.confidence.toFixed(2)}`,
    ms: res.latencyMs ?? 0,
    inTok: res.usage?.inputTokens ?? 0,
    outTok: res.usage?.outputTokens ?? 0,
  };
}

/**
 * Resolve the baseline's reply to one entry of the SAME link list. Deliberately
 * generous about spelling, so the harness never scores formatting as a wrong
 * answer: JSON or bare text, fences/quotes/numbering stripped, and the entry may
 * be named by link text, article title or list number — all three are printed in
 * the prompt and each names exactly one listed link. Anything else is off-list.
 */
function parseLlm(raw, links) {
  let s = (raw ?? "").trim().replace(/^```[a-z]*\s*/i, "").replace(/```\s*$/, "").trim();
  try {
    const o = JSON.parse(s);
    if (o && typeof o === "object") s = String(o.link ?? o.answer ?? o.choice ?? "");
  } catch { /* plain text is equally acceptable */ }
  s = s.trim().replace(/^\d+[.)]\s+/, "").replace(/^["'“”]+|["'“”.]+$/g, "").trim();
  const k = s.toLowerCase();
  const hit =
    links.find((l) => l.text.toLowerCase() === k) ??
    links.find((l) => l.title.toLowerCase() === k) ??
    (/^\d{1,2}$/.test(s) ? links[Number(s) - 1] : undefined);
  return { hit, seen: s.split("\n")[0].slice(0, 40) };
}

/** Baseline lane: normal chat completion, retried on an off-list answer. */
async function llmPick(state, links, onRetry) {
  const list = links.map((l, i) => `${i + 1}. ${l.text} — opens the article "${l.title}"`);
  const body = {
    model: LLM_MODEL,
    max_tokens: LLM_MAX_TOKENS,
    messages: [
      { role: "system", content: "You are playing the Wikipedia game in a live browser." },
      {
        role: "user",
        content:
          `${state}\n\nLinks on this page:\n${list.join("\n")}\n\n${ASK}\n` +
          `Answer with exactly one link from the list above. Name it by its ` +
          `link text, by its article title, or by its list number — bare text ` +
          `or {"link": "..."} both fine. No explanation.`,
      },
    ],
  };
  let ms = 0, inTok = 0, outTok = 0, retries = 0;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const started = performance.now();
    let raw = "", err = null;
    try {
      const r = await fetch(`${GATEWAY}/v1/chat/completions`, {
        method: "POST",
        headers: { Authorization: `Bearer ${process.env.AI_GATEWAY_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(90_000),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j?.error?.message ?? `HTTP ${r.status}`);
      raw = j.choices?.[0]?.message?.content ?? "";
      inTok += j.usage?.prompt_tokens ?? 0;
      outTok += j.usage?.completion_tokens ?? 0;
    } catch (e) { err = e; }
    ms += performance.now() - started; // retries cost the lane real model time
    const { hit, seen } = err ? {} : parseLlm(raw, links);
    if (hit) return { answer: hit.text, note: retries ? `+${retries} retry` : "", ms, inTok, outTok };
    retries++;
    onRetry(
      err ? `error: ${String(err.message).slice(0, 40)}`
        : seen ? `off-list "${seen}"` : "unparsable (empty answer)",
    );
  }
  return { answer: null, note: `${MAX_RETRIES + 1} rejected answers`, ms, inTok, outTok };
}

/** One lane: its own page, its own route, its own clock accounting. */
async function runLane({ tag, col, choose, label, sub }, browser) {
  const ctx = videoDir
    ? await browser.newContext({
        viewport: VIEW,
        reducedMotion: "reduce",
        recordVideo: { dir: videoDir, size: VIEW },
      })
    : null;
  const page = ctx ? await ctx.newPage() : await browser.newPage();
  const st = { tag, col, hops: 0, modelMs: 0, loadMs: 0, inTok: 0, outTok: 0, retries: 0, lat: [], reached: false };
  // No --video: st.hud stays null and every paint below is a no-op.
  st.hud = videoDir
    ? { h: HUD_H, hue: HUD_HUE[tag], label, sub, meta: "step 1", status: `racing to ${TARGET}`, tone: "#9aa7b4", tick: false }
    : null;
  await installHud(page, st.hud);

  const path = ["Coffee"];
  const visited = new Set(path);
  let url = START;
  const head = `${col}${tag}${X} `;

  for (let step = 1; step <= MAX_STEPS; step++) {
    const tLoad = performance.now();
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60_000 });
    st.loadMs += performance.now() - tLoad;
    await hud(page, st, { meta: `step ${step} · ${secs().toFixed(1)}s` }); // fresh document

    const here = (await page.title()).replace(/\s*[-–]\s*Wikipedia$/, "").trim();
    if (here === TARGET) { st.reached = true; break; }

    const { lead, links: all } = await readPage(page, MAX_LINKS + visited.size);
    const links = all.filter((l) => !visited.has(l.title)).slice(0, MAX_LINKS);
    if (links.length < 2) { say(`${stamp()}${head}${R}dead end on ${here}${X}`); break; }
    await hud(page, st, { status: `thinking… ${links.length} links on ${esc(here)}`, tone: "#e3b341", tick: true });

    // onRetry fires once per rejected answer; it is the only retry counter.
    const r = await choose(stateOf(here, lead, path), links, (why) => {
      st.retries++;
      say(`${stamp()}${head}${Y}retry ${st.retries}: ${clip(why, 44).trimEnd()}${X}`);
      hud(page, st, { status: `retry ${st.retries}: ${esc(clip(why, 44).trimEnd())}`, tone: "#f85149", tick: true });
    });
    st.modelMs += r.ms; st.lat.push(r.ms); st.inTok += r.inTok; st.outTok += r.outTok;
    if (r.answer === null) { say(`${stamp()}${head}${R}stalled: ${clip(r.note, 44).trimEnd()}${X}`); break; }

    const hit = links.find((l) => l.text === r.answer);
    say(
      `${stamp()}${head}${clip(here, 14)} ${D}->${X} ${col}${clip(hit.title, 22)}${X}` +
        ` ${C}${String(Math.round(r.ms)).padStart(5)}ms${X}${r.note ? ` ${D}${r.note}${X}` : ""}`,
    );
    // Stays on screen through the click and the next page load — no extra wait.
    await hud(page, st, {
      status: `picked: ${esc(hit.title)} · ${Math.round(r.ms)}ms`,
      tone: HUD_HUE[tag], tick: false,
    });
    path.push(hit.title); visited.add(hit.title); url = hit.url; st.hops++;
  }
  st.wall = secs(); st.path = path;

  if (videoDir) {
    await hud(page, st, {
      status: st.reached ? `ARRIVED · ${TARGET}` : `stopped after ${st.hops} hops`,
      tone: st.reached ? HUD_HUE[tag] : "#e3b341",
      tick: false,
      meta: `${st.hops} hops · model ${(st.modelMs / 1000).toFixed(1)}s · p50 ${Math.round(p50(st.lat))}ms`,
    });
    laneFinished();
    await bothLanesDone;
    await sleep(2600); // readable final frame; both lanes are already clocked
    st.video = await page.video().path();
  }
  await page.close();
  if (ctx) { await ctx.close(); renameSync(st.video, (st.video = join(videoDir, `${tag}.webm`))); }
  return st;
}

const stamp = () => `${D}${secs().toFixed(1).padStart(5)}s${X} `;
const p50 = (a) => (a.length ? [...a].sort((x, y) => x - y)[Math.floor(a.length / 2)] : 0);

const exePath = process.env.CHROMIUM_PATH ?? chromium.executablePath();
const browser = await chromium.launch({
  executablePath: exePath,
  args: ["--no-sandbox", "--disable-dev-shm-usage"],
});

say(`${B}jev-use race${X} ${D}· Coffee -> ${TARGET} · <=${MAX_STEPS} hops · own page per lane${X}`);
say(`${G}jev${X} ${D}judge via ${jev.backend.name}${X}  ${U}llm${X} ${D}${LLM_MODEL}${X}`);
say(`${D}llm settings: max_tokens ${LLM_MAX_TOKENS}, temperature+reasoning left at${X}`);
say(`${D}provider defaults (nothing disabled). Same state, same <=${MAX_LINKS} links,${X}`);
say(`${D}same visited filter; link text, article title or list number all count.${X}`);
say(`${D}Off-list answer = retry the SAME step, no hop advanced.${X}`);
say();

const [jevLane, llmLane] = await Promise.all([
  runLane({ tag: "jev", col: G, choose: jevPick, label: "jev · typesafe-ai/jev", sub: `judge via ${jev.backend.name}` }, browser),
  runLane({ tag: "llm", col: U, choose: llmPick, label: `llm · ${LLM_MODEL.split("/").pop()}`, sub: "chat completion" }, browser),
]);
await browser.close();

// Per-lane arrival summary, then the two-line head-to-head comparison.
for (const s of [jevLane, llmLane]) {
  say(`${s.col}${s.tag}${X} ${s.reached ? `${G}arrived${X}` : `${Y}no arrival${X}`} ${D}${s.hops}h` +
    ` · model ${(s.modelMs / 1000).toFixed(1)}s · pages ${(s.loadMs / 1000).toFixed(1)}s` +
    ` · ${s.inTok}/${s.outTok} tok${X}`);
}
say();
for (const s of [jevLane, llmLane]) {
  say(`${s.col}${s.tag}${X} ${D}p50 ${String(Math.round(p50(s.lat))).padStart(5)}ms` +
    ` · ${s.hops} hops · wall ${s.wall.toFixed(1)}s · ${s.retries} retries${X}`);
}

if (videoDir) {
  console.error(`videos: ${jevLane.video} ${llmLane.video} (${jev.via}, ${exePath})`);
  console.error(`jev route: ${jevLane.path.join(" -> ")}`);
  console.error(`llm route: ${llmLane.path.join(" -> ")}`);
  // Side by side; hstack repeats the shorter lane's last frame to the longer
  // one's end, so neither lane is cut and neither is sped up.
  console.error(
    `hstack: ffmpeg -i ${join(videoDir, "jev.webm")} -i ${join(videoDir, "llm.webm")} -filter_complex ` +
      `"[0:v][1:v]hstack=inputs=2:shortest=0,fps=10,scale=1024:-2:flags=lanczos,split[x][y];` +
      `[x]palettegen=max_colors=128[p];[y][p]paletteuse=dither=none" -y assets/race.gif`,
  );
}

if (castPath) {
  const head = { version: 2, width: 80, height: 24, title: "jev-use wiki race" };
  writeFileSync(castPath, [head, ...events].map((e) => JSON.stringify(e)).join("\n") + "\n");
  console.error(`cast written: ${castPath} (${jev.via}, ${exePath})`);
  console.error(`jev route: ${jevLane.path.join(" -> ")}`);
  console.error(`llm route: ${llmLane.path.join(" -> ")}`);
}

const leg = (s) => `${s.hops} hops · ${(s.modelMs / 1000).toFixed(1)}s model / ${s.wall.toFixed(1)}s wall`;
// Exactly one markdown row, last line on stdout (wider than the 80-col cast).
console.log(
  `| Race: Coffee → ${TARGET}, Jev vs ${LLM_MODEL.split("/").pop()} | ` +
    `jev: ${leg(jevLane)} vs haiku: ${leg(llmLane)} (${llmLane.retries} off-list retries) |`,
);
