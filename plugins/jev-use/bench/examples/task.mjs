/**
 * Example: sweep Hacker News for the AI stories — the information-gathering
 * errand browser agents are actually pointed at, run without a chat model.
 * Three front pages, 90 story rows, ONE batched Jev call per page: 30 noul
 * questions ("is this story about AI?") answered together in a single forward
 * pass, then the verdicts painted back onto the live rows. A fourth call (one
 * choice over what was collected) picks the story worth opening, and the run
 * finishes by clicking that story's comments link.
 *
 * Environment: AI_GATEWAY_API_KEY serves the judge; PLAYWRIGHT_CORE and
 * CHROMIUM_PATH locate playwright-core and the browser binary; FFMPEG the
 * encoder (--video only); TASK_START / TASK_PAGES move the sweep elsewhere.
 *
 * Run: node bench/examples/task.mjs [--video assets/task.gif]
 *
 * --video records the real browser with a status HUD over the page and writes
 * the GIF itself, 1x and uncut. The row-by-row reveal and the scrolling it
 * needs are PRESENTATION ONLY (see markRows); their cost is measured and
 * subtracted, so the reported total is the task's own time in either mode.
 */

import { mkdirSync, mkdtempSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { tmpdir } from "node:os";
import { spawnSync } from "node:child_process";
import { Jev, check, pick } from "../../dist/index.js";
import { HUD_H, esc, installHud, paint } from "./hud.mjs";

const videoIdx = process.argv.indexOf("--video");
const videoOut = videoIdx > -1 ? process.argv[videoIdx + 1] : null;

const START = process.env.TASK_START ?? "https://news.ycombinator.com/";
const PAGES = Number(process.env.TASK_PAGES ?? 3);
const TOPIC = "AI, machine learning or LLMs";
const PICK_Q = "Which story is most substantive for someone tracking AI progress?";
const MAX_OPTIONS = 25; // Jev allows <= 30 options per choice question
const VIEW = { width: 640, height: 620 };
const HUE = "#3fb950";
// 1:1 with VIEW (no resampling blur). Every marked row repaints a full-width
// band of text, so the GIF budget is spent on the reveal: 16 colours at 6fps
// keeps a ~15s recording of this page under 2MB and still reads.
const GIF = { fps: 6, width: 640, colors: 16 };
const STAGGER = videoOut ? 110 : 0; // ms per row, presentation only

const jev = new Jev();
const { chromium } = await import(process.env.PLAYWRIGHT_CORE ?? "playwright-core");

const t0 = performance.now();
const secs = () => (performance.now() - t0) / 1000 - presentMs / 1000; // task clock
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const [B, D, G, C, R, X] = ["1m", "2m", "32m", "36m", "31m", "0m"].map((c) => `\x1b[${c}`);
const p50 = (a) => (a.length ? [...a].sort((x, y) => x - y)[Math.floor(a.length / 2)] : 0);
let presentMs = 0; // recording animation only — never billed to the task clock
const present = async (fn) => { const t = performance.now(); await fn(); presentMs += performance.now() - t; };

const HUD = videoOut
  ? { h: HUD_H, hue: HUE, label: "jev · typesafe-ai/jev", sub: "", meta: "", status: "", tone: "#9aa7b4", tick: false }
  : null; // without --video every paint below is a no-op
const hud = (page, patch) => paint(page, HUD, patch);

/* ------------------------------ the page ------------------------------- */

/** The 30 story rows as the page actually renders them. */
const readStories = (page) =>
  page.evaluate(() =>
    [...document.querySelectorAll("tr.athing")].flatMap((tr) => {
      const a = tr.querySelector("span.titleline > a");
      if (!a) return [];
      const sub = tr.nextElementSibling;
      // The comments link is the LAST item?id= link of the subtext row (the
      // first one is the "N hours ago" permalink).
      const cm = [...(sub?.querySelectorAll('a[href^="item?id="]') ?? [])].pop();
      return [{
        id: tr.id,
        rank: parseInt(tr.querySelector("span.rank")?.textContent ?? "0", 10) || 0,
        title: (a.textContent ?? "").trim().replace(/\s+/g, " "),
        domain: tr.querySelector("span.sitestr")?.textContent ?? "news.ycombinator.com",
        points: parseInt(sub?.querySelector("span.score")?.textContent ?? "0", 10) || 0,
        comments: Number((cm?.textContent ?? "").match(/\d+/)?.[0] ?? 0),
      }];
    }),
  );

/**
 * Paint the verdicts onto the rows: a match gets a green band, everything else
 * dims to 40%. The judgment was ONE call and all 30 verdicts arrived together
 * (the HUD shows that call's real latency) — walking the rows top-to-bottom
 * with a delay, and scrolling to keep the current row on screen, is
 * PRESENTATION ONLY so a viewer can see each answer land.
 */
const markRows = (page, marks, stagger) =>
  page.evaluate(
    ({ marks, stagger, hudH }) =>
      new Promise((done) => {
        let i = 0;
        const step = () => {
          const m = marks[i++];
          if (!m) return done();
          const top = document.getElementById(m.id);
          for (const tr of [top, top?.nextElementSibling]) {
            if (!tr) continue;
            if (m.hit) { tr.style.background = "#c8f0d2"; tr.style.boxShadow = "inset 4px 0 0 #1a7f37"; }
            else tr.style.opacity = ".4";
          }
          const a = top?.querySelector("span.titleline > a");
          if (a && m.hit) { a.style.color = "#0a5c2a"; a.style.fontWeight = "700"; }
          // Scroll down only, and only when the row has fallen off-screen —
          // one jump per screenful, so the recording stays cheap.
          const r = top?.getBoundingClientRect();
          if (stagger && r && r.bottom > innerHeight - 24) window.scrollBy(0, r.top - hudH - 12);
          stagger ? setTimeout(step, stagger) : step();
        };
        step();
      }),
    { marks, stagger, hudH: HUD_H },
  );

/** HN answers a burst of requests with a bare "Sorry." page. That is the site
 *  throttling a visitor, not a result: wait it out once, then carry on. */
async function settle(page) {
  await page.waitForLoadState("load").catch(() => {});
  for (let i = 0; i < 2; i++) {
    const body = await page.evaluate(() => document.body?.innerText?.trim().slice(0, 40) ?? "");
    if (!/^Sorry[.,]/.test(body)) return;
    console.log(`${R}HN is throttling (\"${body.split("\n")[0]}\") — waiting 8s and reloading${X}`);
    await sleep(8000);
    await page.reload({ waitUntil: "load" });
  }
  throw new Error("HN kept answering \"Sorry.\" — rate limited, stopping rather than reporting half a sweep");
}

/** Tag the LAST link matching `selector` so the click lands on exactly that
 *  element (HN's comments link is the last item?id= link in a subtext row).
 *  `dwell` holds the outlined target on screen first — presentation only. */
async function clickIn(page, selector, tag, dwell = 0) {
  const ok = await page.evaluate(({ selector, tag }) => {
    const el = [...document.querySelectorAll(selector)].pop();
    if (!el) return false;
    el.setAttribute("data-jev-click", tag);
    el.style.cssText += ";outline:3px solid #fb8500;outline-offset:2px";
    el.scrollIntoView({ block: "center" });
    return true;
  }, { selector, tag });
  if (!ok) throw new Error(`nothing to click for ${selector}`);
  if (dwell && videoOut) await present(() => sleep(dwell));
  const before = page.url();
  await page.click(`[data-jev-click="${tag}"]`, { timeout: 20_000 });
  await page.waitForFunction((b) => location.href !== b, before, { timeout: 30_000 });
  await settle(page);
}

/* ------------------------------- the task ------------------------------- */

/** One page: read the rows, ask all 30 questions in a single call, paint back. */
async function sweep(page, n, lat) {
  const stories = await readStories(page);
  if (!stories.length) throw new Error(`no story rows on ${page.url()} — HN markup changed or blocked`);
  const line = (s) => `${s.rank}. ${s.title} — ${s.domain} · ${s.points} points · ${s.comments} comments`;
  await hud(page, { status: `thinking… ${stories.length} stories on page ${n}`, tone: "#e3b341", tick: true,
    meta: `page ${n}/${PAGES} · ${secs().toFixed(1)}s` });

  const res = await jev.judge(
    `Hacker News list page ${n}, ${stories.length} story rows:\n${stories.map(line).join("\n")}`,
    // One question per row, keyed by rank: 30 answers, one call.
    Object.fromEntries(
      stories.map((s) => [
        `s${s.rank}`,
        check(`Is story ${s.rank} ("${s.title}") about ${TOPIC}?`, {
          true: `The story's main subject is ${TOPIC} — models, training, inference, AI products or AI research.`,
          false: "The story is mainly about something else.",
        }),
      ]),
    ),
  );
  const ms = Math.round(res.latencyMs ?? 0);
  lat.push(ms);
  const rows = stories.map((s) => {
    const v = res.answers[`s${s.rank}`];
    // noul answer = P(this story is about AI); `weak` = Jev's own escalate flag.
    const p = typeof v.answer === "number" ? v.answer : 0;
    return { ...s, p, weak: v.escalate, hit: p >= 0.5 };
  });
  const hits = rows.filter((r) => r.hit);
  console.log(
    `${D}${secs().toFixed(1).padStart(5)}s${X} page ${n} ${D}·${X} ${stories.length} stories in ` +
      `${C}1 call ${String(ms).padStart(4)}ms${X} ${D}·${X} ${G}${hits.length} AI${X}` +
      `${rows.some((r) => r.weak) ? ` ${D}· ${rows.filter((r) => r.weak).length} low-confidence${X}` : ""}`,
  );
  for (const r of hits) {
    console.log(`       ${G}AI${X} ${D}#${String(r.rank).padStart(2)}${X} ${r.title.slice(0, 58).padEnd(58)}` +
      ` ${D}p${r.p.toFixed(2)}${r.weak ? "~" : " "} ${r.points}pts · ${r.comments}c${X}`);
  }
  await hud(page, { status: `page ${n}: ${hits.length} of ${stories.length} are AI stories · ${ms}ms`, tone: HUE, tick: false });
  await present(() => markRows(page, rows.map((r) => ({ id: r.id, hit: r.hit })), STAGGER));
  return rows;
}

/* --------------------------------- drive -------------------------------- */

const exePath = process.env.CHROMIUM_PATH ?? chromium.executablePath();
const browser = await chromium.launch({ executablePath: exePath, args: ["--no-sandbox", "--disable-dev-shm-usage"] });
const videoDir = videoOut ? mkdtempSync(join(tmpdir(), "task-video-")) : null;
const ctx = await browser.newContext({
  viewport: VIEW,
  reducedMotion: "reduce",
  // A plain desktop Chrome identity: the headless-shell default UA is what HN
  // throttles first, and this run is an ordinary reader's three page loads.
  userAgent: "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36",
  ...(videoDir ? { recordVideo: { dir: videoDir, size: VIEW } } : {}),
});
const page = await ctx.newPage();
if (HUD) Object.assign(HUD, { sub: `judge via ${jev.backend.name}`, status: `collect every AI story on ${PAGES} HN pages` });
await installHud(page, HUD);

console.log(`${B}jev-use HN sweep${X} ${D}· ${PAGES} pages · one batched judge call per page · ${jev.via} · 0 chat-model calls${X}`);
const lat = [];
const all = [];
await page.goto(START, { waitUntil: "domcontentloaded", timeout: 60_000 });
await settle(page);
for (let n = 1; n <= PAGES; n++) {
  all.push(...(await sweep(page, n, lat)).map((r) => ({ ...r, page: n })));
  if (n === PAGES) break;
  await hud(page, { status: `clicking "More" → page ${n + 1}`, tone: "#58a6ff" });
  await clickIn(page, "a.morelink", `more${n}`, 500);
}

// One choice call over what was collected, then open that story's comments.
const matched = all.filter((r) => r.hit);
const shortlist = [...matched].sort((a, b) => b.points - a.points).slice(0, MAX_OPTIONS);
let winner = null;
if (shortlist.length) {
  await hud(page, { status: `thinking… ${PICK_Q}`, tone: "#e3b341", tick: true });
  const res = await jev.judge(
    `Collected ${matched.length} AI stories from ${PAGES} Hacker News pages. Shortlist (top ${shortlist.length} by points):\n` +
      shortlist.map((s) => `- ${s.title} — ${s.domain} · ${s.points} points · ${s.comments} comments`).join("\n"),
    {
      best: pick(
        PICK_Q,
        Object.fromEntries(
          shortlist.map((s) => [s.title, `${s.domain} · ${s.points} points · ${s.comments} comments`]),
        ),
      ),
    },
  );
  lat.push(Math.round(res.latencyMs ?? 0));
  const v = res.answers.best;
  winner = shortlist.find((s) => s.title === String(v.answer)) ?? null;
  console.log(`${D}${secs().toFixed(1).padStart(5)}s${X} pick ${D}·${X} ${shortlist.length} options in ${C}1 call ` +
    `${String(lat.at(-1)).padStart(4)}ms${X} ${D}->${X} ${G}${winner?.title ?? v.reason}${X} ${D}c${v.confidence.toFixed(2)}` +
    `${v.escalate ? ` (flat distribution over ${shortlist.length} options — would escalate)` : ""}${X}`);
  // A choice over 20+ near-equivalent options is a thin margin by construction;
  // print the runners-up so the pick is inspectable rather than asserted.
  for (const [label, p] of Object.entries(v.distribution ?? {}).sort((a, b) => b[1] - a[1]).slice(0, 3)) {
    console.log(`       ${D}${p.toFixed(3)} ${label.slice(0, 64)}${X}`);
  }
}
if (winner) {
  // The sweep left the browser on the last page; walk back to the winner's.
  for (let n = PAGES; n > winner.page; n--) {
    await hud(page, { status: `back to page ${n - 1} — where the pick lives`, tone: "#58a6ff",
      tick: false, meta: `page ${n - 1}/${PAGES} · ${secs().toFixed(1)}s` });
    await page.goBack({ waitUntil: "domcontentloaded" });
    await settle(page);
    if (videoOut) await present(() => sleep(400)); // let the HUD line be read
  }
  // Re-apply that page's marks: the back navigation re-rendered the document.
  const marks = all.filter((r) => r.page === winner.page).map((r) => ({ id: r.id, hit: r.hit }));
  await present(() => markRows(page, marks, 0));
  await hud(page, { status: `opening: ${esc(winner.title)} · ${winner.comments} comments`, tone: HUE, tick: false });
  await present(() => // tint the chosen row before the click — presentation only
    page.evaluate((id) => {
      const tr = document.getElementById(id);
      for (const el of [tr, tr?.nextElementSibling]) if (el) el.style.background = "#ffe0b8";
      tr?.scrollIntoView({ block: "center" });
    }, winner.id));
  await clickIn(page, `[id="${winner.id}"] + tr a[href^="item?id="]`, "pick", 1600);
}

const task = secs(); // the task clock stops here; everything below is video
const wall = (performance.now() - t0) / 1000; // real elapsed, presentation included
const opened = winner
  ? await page.evaluate(() => (/\/item\?id=/.test(location.href) ? document.querySelectorAll(".commtext").length : -1))
  : -1;

console.log();
for (const r of matched) console.log(`${G}·${X} ${r.title} ${D}· ${r.points} points · ${r.comments} comments${X}`);
console.log();
console.log(`${B}${matched.length}/${all.length} AI stories${X} ${D}· ${PAGES} batched calls + 1 pick · p50 ${Math.round(p50(lat))}ms` +
  ` · judge ${(lat.reduce((a, b) => a + b, 0) / 1000).toFixed(1)}s · task ${task.toFixed(1)}s` +
  (presentMs > 500 ? ` · wall ${wall.toFixed(1)}s incl. ${(presentMs / 1000).toFixed(1)}s presentation` : "") + X);
console.log(
  winner
    ? `${G}opened${X} ${winner.title} ${D}(${page.url()} · ${opened < 0 ? "NOT an item page" : `${opened} comments rendered`})${X}`
    : `${R}no pick — nothing matched${X}`,
);

if (videoOut) {
  await hud(page, {
    status: `DONE · ${matched.length}/${all.length} AI stories collected · ${PAGES}+1 calls · p50 ${Math.round(p50(lat))}ms · 0 LLM calls`,
    tone: HUE, tick: false, meta: `${task.toFixed(1)}s`,
  });
  await sleep(2500); // readable last frame, after the clock has stopped
}
const video = videoOut ? page.video() : null;
await page.close();
await ctx.close(); // flushes the webm
await browser.close();

if (videoOut) {
  const src = await video.path();
  mkdirSync(dirname(videoOut), { recursive: true });
  // webm → GIF, two-pass palette; mpdecimate + vfr drop the frames where
  // nothing moved and keep the real timing in the frame delays (1x, no cuts).
  const palette = join(dirname(src), "palette.png");
  const run = (args) => {
    const r = spawnSync(process.env.FFMPEG ?? "ffmpeg", ["-v", "error", "-y", ...args], { stdio: "inherit" });
    if (r.error) throw r.error;
    if (r.status !== 0) throw new Error(`ffmpeg exited ${r.status}`);
  };
  const encode = ({ fps, colors, width }) => {
    const scale = `fps=${fps},scale=${width}:-2:flags=area`;
    run(["-i", src, "-vf", `${scale},palettegen=max_colors=${colors}:stats_mode=diff`, palette]);
    run(["-i", src, "-i", palette, "-lavfi",
      `${scale},mpdecimate=hi=64*12:lo=64*5:frac=0.1[x];[x][1:v]paletteuse=dither=none:diff_mode=rectangle`,
      "-fps_mode", "vfr", videoOut]);
    return statSync(videoOut).size;
  };
  // A longer run (more matches, more scrolling) costs more frames, so the 2MB
  // README budget is enforced here rather than hoped for: narrower frame and
  // fewer of them until it fits. No cuts, no speed-up — 1x either way.
  let cfg = GIF, bytes = encode(GIF);
  for (const next of [{ fps: 5, colors: 16, width: 560 }, { fps: 4, colors: 16, width: 480 }]) {
    if (bytes <= 2_000_000) break;
    console.error(`${D}gif ${Math.round(bytes / 1024)}KB over budget — re-encoding at ${next.width}px/${next.fps}fps${X}`);
    bytes = encode((cfg = next));
  }
  console.error(`${D}${videoOut} ${Math.round(bytes / 1024)}KB · ${cfg.width}px · ${cfg.fps}fps · ${cfg.colors} colours · source ${src}${X}`);
}

// Exactly one markdown row, last line on stdout.
console.log(
  `| HN sweep: collect the AI stories | ${all.length} stories · ${PAGES} batched calls · ${matched.length} matched` +
    ` · p50 ${Math.round(p50(lat))}ms/call · ${task.toFixed(1)}s total · 0 LLM calls |`,
);
