/**
 * Example: de-clutter a page in ONE judgment call.
 *
 * A real headless browser opens a news-article page, the script enumerates its
 * visible top-level boxes, and a single batched jev.judge() call answers one typed
 * choice question per box — keep (part of the article) or clutter (ad, banner,
 * popup, promo, junk). Every clutter verdict gets display:none, and the before
 * and after viewport are screenshotted. No text is generated at any point.
 *
 * The page is a LOCAL FIXTURE, not a live site: bench/examples/fixtures/
 * cluttered.html, invented outlet, invented byline, invented numbers. That is
 * deliberate — a live site would redesign and rot the demo, and a fixture can
 * carry ground truth. Each enumerable block in it has data-truth="article |
 * clutter | chrome"; this script reads that attribute ONLY to score the result
 * and asserts (hard failure) that it never reaches the state sent to Jev.
 * "chrome" = site masthead/footer, defensible either way, so those verdicts are
 * printed but excluded from the accuracy numbers.
 *
 * With --video the same real run is recorded in the browser and written out as
 * a GIF: the cluttered page sits there for a moment, the one jev.judge() call
 * returns, and every box it called clutter is outlined and dropped, one after
 * another, before the cleaned article is scrolled end to end. The verdicts in
 * that recording are live, exactly as in every other mode; only the *timing* of
 * the hides is staged, so a viewer can see what was removed (see PHASE 3).
 *
 * Environment:
 *   AI_GATEWAY_API_KEY  (or another Jev credential) — picks the backend
 *   PLAYWRIGHT_CORE     module id/path for playwright-core, when it is not
 *                       resolvable from here (default: "playwright-core")
 *   CHROMIUM_PATH       chromium / headless-shell binary to launch
 *                       (default: chromium.executablePath())
 *   FFMPEG              ffmpeg binary used by --video (default: "ffmpeg")
 *
 * Run:    node bench/examples/strip.mjs [--cast out.cast] [--video out.gif]
 * Render: agg out.cast strip.gif   (--video renders its own GIF)
 */

import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, statSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { tmpdir } from "node:os";
import { Jev, pick } from "../../dist/index.js";

const castIdx = process.argv.indexOf("--cast");
const castPath = castIdx > -1 ? process.argv[castIdx + 1] : null;
const videoIdx = process.argv.indexOf("--video");
const videoOut = videoIdx > -1 ? process.argv[videoIdx + 1] : null;

const FIXTURE = new URL("./fixtures/cluttered.html", import.meta.url);
const ASSETS = new URL("../../assets/", import.meta.url);
const BEFORE = new URL("strip-before.png", ASSETS).pathname;
const AFTER = new URL("strip-after.png", ASSETS).pathname;
// The recording wants a GIF-shaped frame; every other mode keeps the tall
// screenshot viewport it always used.
const VIEWPORT = videoOut ? { width: 900, height: 700 } : { width: 1024, height: 900 };

const VIDEO = {
  settleMs: 400, //  page paint settles before anything is timed
  phase1Ms: 1500, //  PHASE 1 — the page exactly as it ships
  hudMs: 850, //      PHASE 2 — verdicts are back, HUD reads the real latency
  flashMs: 230, //    PHASE 3 — red outline on a box …
  gapMs: 70, //       … then it is gone, and on to the next one
  downMs: 1150, //    PHASE 4 — scroll the cleaned article to the end …
  bottomMs: 350,
  upMs: 800, //       … and back to the top
  endMs: 450,
  // GIF budget: a dense text page costs ~50KB per full frame, and a hide
  // reflows everything below it, so most frames ARE full. 640px/32 colours at
  // 8fps, with duplicate frames dropped, keeps ~12s under 2MB and still reads.
  fps: 8,
  width: 640,
  colors: 32,
};

const jev = new Jev();
const { chromium } = await import(process.env.PLAYWRIGHT_CORE ?? "playwright-core");

const t0 = performance.now();
const events = [];
const say = (line = "") => {
  process.stdout.write(line + "\n");
  events.push([(performance.now() - t0) / 1000, "o", line + "\r\n"]);
};

const [B, D, G, Y, R, C, X] = ["1m", "2m", "32m", "33m", "31m", "36m", "0m"]
  .map((c) => `\x1b[${c}`);

/**
 * Enumerate the page's top-level visible boxes.
 *
 * Generic rule, no fixture-specific selectors: walk down from <body>; descend
 * through pure LAYOUT containers (flex/grid wrappers that split into >= 2 large
 * children) and emit the first content-bearing block on every other branch.
 * Depth is capped so a card grid stays one box instead of exploding into cards.
 * `truth` is carried out for scoring only and stripped before Jev sees anything.
 */
const enumerateBoxes = (page) =>
  page.evaluate(
    ({ MIN_AREA, SPLIT_AREA, MAX_DEPTH }) => {
      const SKIP_TAGS = /^(script|style|link|meta|noscript|template|br|hr)$/i;
      const area = (el) => {
        const r = el.getBoundingClientRect();
        return { a: r.width * r.height, w: Math.round(r.width), h: Math.round(r.height) };
      };
      const shown = (el) => {
        const s = getComputedStyle(el);
        return s.display !== "none" && s.visibility !== "hidden" && Number(s.opacity) > 0.01;
      };
      const label = (el) =>
        el.tagName.toLowerCase() +
        (el.id ? `#${el.id}` : "") +
        [...el.classList].slice(0, 2).map((c) => `.${c}`).join("");

      const boxes = [];
      const walk = (parent, depth) => {
        for (const el of parent.children) {
          if (SKIP_TAGS.test(el.tagName) || !shown(el)) continue;
          const { a, w, h } = area(el);
          if (a < MIN_AREA) continue;
          const s = getComputedStyle(el);
          const bigKids = [...el.children].filter((c) => {
            const r = c.getBoundingClientRect();
            return r.width * r.height >= SPLIT_AREA;
          }).length;
          const isLayout = (s.display === "flex" || s.display === "grid") && bigKids >= 2;
          if (isLayout && depth < MAX_DEPTH) {
            walk(el, depth + 1);
            continue;
          }
          const i = boxes.length;
          el.setAttribute("data-strip-box", String(i));
          boxes.push({
            i,
            sel: label(el),
            w,
            h,
            text: (el.innerText || "").trim().replace(/\s+/g, " ").slice(0, 80),
            truth: el.getAttribute("data-truth") ?? "unlabelled",
          });
        }
      };
      walk(document.body, 1);
      return { boxes, title: document.title };
    },
    { MIN_AREA: 1200, SPLIT_AREA: 4000, MAX_DEPTH: 3 },
  );

// ---- --video helpers (no effect on any other mode) --------------------------

/** A small receipt pinned to the corner: what the one call covered, and its real ms. */
const installHud = (page) =>
  page.evaluate(() => {
    const el = document.createElement("div");
    el.id = "jev-hud";
    el.style.cssText = [
      "position:fixed",
      "top:14px",
      "right:14px",
      "z-index:2147483647",
      "font:700 15px/1 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace",
      "color:#eafff3",
      "background:#0c1a14",
      "border:1px solid #2f8a5c",
      "border-radius:7px",
      "padding:11px 15px",
      "letter-spacing:.2px",
      "box-shadow:0 8px 26px rgba(0,0,0,.45)",
      "opacity:0",
      "transition:opacity .2s ease",
    ].join(";");
    document.body.appendChild(el);
  });

const showHud = (page, text) =>
  page.evaluate((text) => {
    const el = document.getElementById("jev-hud");
    if (!el) return;
    el.textContent = text;
    el.style.opacity = "1";
  }, text);

/**
 * Hide order for the recording. The judgment was ONE batched call and every
 * verdict came back together — the HUD above shows that call's real latency.
 * Spacing the hides out, overlays (paywall modal, cookie bar) first and then
 * the in-flow boxes top to bottom, is PRESENTATION ONLY: it exists so a viewer
 * can see each thing leave instead of the page blinking once.
 */
const hideOrder = (page, idxs) =>
  page.evaluate((idxs) => {
    const overlay = [];
    const inFlow = [];
    for (const i of idxs) {
      const el = document.querySelector(`[data-strip-box="${i}"]`);
      if (!el) continue;
      (getComputedStyle(el).position === "fixed" ? overlay : inFlow).push(i);
    }
    return [...overlay, ...inFlow];
  }, idxs);

const flashBox = (page, i) =>
  page.evaluate((i) => {
    const el = document.querySelector(`[data-strip-box="${i}"]`);
    if (!el) return;
    el.style.outline = "3px solid #e23b46";
    el.style.outlineOffset = "-2px";
    el.style.boxShadow = "inset 0 0 0 9999px rgba(226,59,70,.13)";
  }, i);

const hideBox = (page, i) =>
  page.evaluate((i) => {
    const el = document.querySelector(`[data-strip-box="${i}"]`);
    if (el) el.style.display = "none";
  }, i);

/** Eased scroll to the bottom of the cleaned page, or back to the top. */
const glideTo = (page, where, ms) =>
  page.evaluate(
    ({ where, ms }) =>
      new Promise((done) => {
        const from = window.scrollY;
        const to =
          where === "bottom"
            ? Math.max(0, document.documentElement.scrollHeight - window.innerHeight)
            : 0;
        const t0 = performance.now();
        const guard = setTimeout(() => {
          window.scrollTo(0, to);
          done();
        }, ms + 400); // never hang the run on a missing animation frame
        const step = (now) => {
          const p = Math.min(1, (now - t0) / ms);
          const e = p < 0.5 ? 2 * p * p : 1 - (-2 * p + 2) ** 2 / 2;
          window.scrollTo(0, from + (to - from) * e);
          if (p < 1) requestAnimationFrame(step);
          else {
            clearTimeout(guard);
            done();
          }
        };
        requestAnimationFrame(step);
      }),
    { where, ms },
  );

/**
 * webm → GIF, palette-optimized two-pass, small enough to sit in a README.
 * `area` scaling and no dithering keep flat colour runs intact (lanczos ringing
 * and dither noise both cost LZW dearly); mpdecimate + -fps_mode vfr drop the
 * frames where nothing moved and keep the real timing in the frame delays.
 */
const toGif = (src, out, { fps, width, colors }) => {
  const ffmpeg = process.env.FFMPEG ?? "ffmpeg";
  const scale = `fps=${fps},scale=${width}:-1:flags=area`;
  const dedupe = "mpdecimate=hi=64*12:lo=64*5:frac=0.1";
  const palette = join(dirname(src), "palette.png");
  const run = (args) => {
    const r = spawnSync(ffmpeg, ["-v", "error", "-y", ...args], { stdio: "inherit" });
    if (r.error) throw r.error;
    if (r.status !== 0) throw new Error(`ffmpeg exited ${r.status}`);
  };
  run(["-i", src, "-vf", `${scale},palettegen=max_colors=${colors}:stats_mode=diff`, palette]);
  run([
    "-i", src,
    "-i", palette,
    "-lavfi", `${scale},${dedupe}[x];[x][1:v]paletteuse=dither=none:diff_mode=rectangle`,
    "-fps_mode", "vfr",
    out,
  ]);
};

// -----------------------------------------------------------------------------

const exePath = process.env.CHROMIUM_PATH ?? chromium.executablePath();
const browser = await chromium.launch({
  executablePath: exePath,
  args: ["--no-sandbox", "--disable-dev-shm-usage"],
});
const videoDir = videoOut ? mkdtempSync(join(tmpdir(), "strip-video-")) : null;
const context = videoOut
  ? await browser.newContext({ viewport: VIEWPORT, recordVideo: { dir: videoDir, size: VIEWPORT } })
  : null;
const page = context ? await context.newPage() : await browser.newPage({ viewport: VIEWPORT });

say(`${B}jev-use de-clutter${X} ${D}· one page, one judgment call · ${jev.backend.name}${X}`);
say(`${D}fixture: bench/examples/fixtures/cluttered.html · synthetic, labelled${X}`);
say();

await page.goto(FIXTURE.href, { waitUntil: "load", timeout: 30_000 });
mkdirSync(ASSETS.pathname, { recursive: true });
// --video records at its own viewport, so it leaves the committed PNGs alone.
if (!videoOut) await page.screenshot({ path: BEFORE });

const { boxes } = await enumerateBoxes(page);
if (boxes.length === 0) throw new Error("enumerated 0 boxes — fixture or rule broken");

if (videoOut) {
  // PHASE 1 — the page as it ships: paywall modal over the headline, cookie
  // bar, ads. The HUD goes in only now, AFTER enumeration, so it can never be
  // enumerated, judged, or seen by Jev.
  await installHud(page);
  await page.waitForTimeout(VIDEO.settleMs + VIDEO.phase1Ms);
}

// What Jev sees: the box inventory, built field by field from a whitelist.
// The ground-truth attribute must not be in it — assert, do not hope.
const inventory = boxes
  .map((b) => `#${b.i} <${b.sel}> ${b.w}x${b.h}px :: ${b.text || "(no text)"}`)
  .join("\n");
const state =
  `A news article page is open in a browser at ${VIEWPORT.width}x${VIEWPORT.height}. Its visible top-level boxes,\n` +
  `each with its tag/id/classes, rendered size, and the first 80 characters of its text:\n\n` +
  inventory;
if (/data-truth|data-strip-box/.test(state)) {
  throw new Error("ground-truth marker leaked into the state sent to Jev");
}

const KEEP = "part of the article the reader came for";
const CLUTTER = "ad, banner, popup, promo, or other junk";
// One question per box, keyed by box number, so every answer is addressable.
const questions = Object.fromEntries(
  boxes.map((b) => [
    `box${b.i}`,
    pick(`Box #${b.i} (<${b.sel}>): is this part of the article, or clutter?`, {
      keep: KEEP,
      clutter: CLUTTER,
    }),
  ]),
);

const res = await jev.judge(state, questions);

const rows = boxes.map((b) => {
  const v = res.answers[`box${b.i}`];
  const answer = v.answer === null ? "keep" : String(v.answer); // unreachable Jev = keep nothing away
  return { ...b, answer, conf: v.confidence, escalate: v.escalate, reason: v.reason };
});

const hide = rows.filter((r) => r.answer === "clutter");
if (videoOut) {
  // PHASE 2 — the verdicts are already back; the HUD states what that cost.
  await showHud(page, `jev_judge · ${boxes.length} boxes · 1 call · ${res.latencyMs}ms`);
  await page.waitForTimeout(VIDEO.hudMs);

  // PHASE 3 — one box at a time: outline it red, then drop it. Staggered for
  // the viewer only; all of these verdicts arrived together, in that one call.
  for (const i of await hideOrder(page, hide.map((r) => r.i))) {
    await flashBox(page, i);
    await page.waitForTimeout(VIDEO.flashMs);
    await hideBox(page, i);
    await page.waitForTimeout(VIDEO.gapMs);
  }

  // PHASE 4 — the whole article is still there: scroll it end to end.
  await page.waitForTimeout(VIDEO.hudMs);
  await glideTo(page, "bottom", VIDEO.downMs);
  await page.waitForTimeout(VIDEO.bottomMs);
  await glideTo(page, "top", VIDEO.upMs);
  await page.waitForTimeout(VIDEO.endMs);
} else {
  await page.evaluate(
    (idxs) => {
      for (const i of idxs) {
        const el = document.querySelector(`[data-strip-box="${i}"]`);
        if (el) el.style.display = "none";
      }
    },
    hide.map((r) => r.i),
  );
  await page.screenshot({ path: AFTER });
}

let videoSrc = null;
if (context) {
  const video = page.video();
  await context.close(); // flushes the webm
  videoSrc = await video.path();
}
await browser.close();

// ---- scoring against the fixture's own labels -------------------------------
const scored = rows.filter((r) => r.truth === "article" || r.truth === "clutter");
const chrome = rows.filter((r) => r.truth === "chrome");
const unlabelled = rows.filter((r) => r.truth === "unlabelled");
const clutterTotal = scored.filter((r) => r.truth === "clutter");
const clutterFound = clutterTotal.filter((r) => r.answer === "clutter");
const articleTotal = scored.filter((r) => r.truth === "article");
const falseHides = articleTotal.filter((r) => r.answer === "clutter");
const lowConf = rows.filter((r) => r.escalate);

for (const r of rows) {
  const mark =
    r.truth === "chrome" || r.truth === "unlabelled"
      ? `${D}--${X}`
      : (r.truth === "clutter") === (r.answer === "clutter")
        ? `${G}ok${X}`
        : r.truth === "article"
          ? `${R}FALSE HIDE${X}`
          : `${Y}missed${X}`;
  const col = r.answer === "clutter" ? Y : G;
  say(
    `${D}#${String(r.i).padStart(2)}${X} ${r.sel.slice(0, 22).padEnd(22)} ` +
      `${col}${r.answer.padEnd(7)}${X} ${D}${r.conf.toFixed(2)}${r.escalate ? "~" : " "}${X} ` +
      `${D}${r.truth.padEnd(7)}${X} ${mark}`,
  );
}

const wall = (performance.now() - t0) / 1000;
const kb = (p) => Math.round(statSync(p).size / 1024);

say();
say(
  `${B}${boxes.length} boxes judged in 1 call${X} ${D}· ${res.latencyMs}ms Jev · ` +
    `wall ${wall.toFixed(1)}s · ${res.usage?.inputTokens ?? 0}/${res.usage?.outputTokens ?? 0} tok${X}`,
);
say(
  `${B}${hide.length} hidden${X} ${D}(${rows.length - hide.length} kept) · ` +
    `${lowConf.length} below the confidence bar (~, hidden anyway)${X}`,
);
say(
  `${G}clutter found ${clutterFound.length}/${clutterTotal.length}${X} ${D}·${X} ` +
    (falseHides.length === 0
      ? `${G}0 article boxes falsely hidden${X}`
      : `${R}${falseHides.length} article boxes FALSELY HIDDEN${X}`),
);
for (const r of falseHides) {
  say(`  ${R}FALSE HIDE${X} #${r.i} <${r.sel}> ${D}"${r.text.slice(0, 44)}"${X}`);
}
for (const r of clutterTotal.filter((c) => c.answer !== "clutter")) {
  say(`  ${Y}missed${X} #${r.i} <${r.sel}> ${D}"${r.text.slice(0, 44)}"${X}`);
}
if (chrome.length) {
  // Site furniture: neither the article nor an ad. Reported, never scored.
  say(
    `${D}unscored chrome: ` +
      chrome.map((r) => `${r.sel.split(".").pop()}=${r.answer}`).join(", ") + X,
  );
}
if (unlabelled.length) {
  say(`${Y}${unlabelled.length} box(es) carry no ground-truth label — fixture drift${X}`);
}
if (videoOut) {
  mkdirSync(dirname(videoOut), { recursive: true });
  toGif(videoSrc, videoOut, VIDEO);
  say(
    `${D}${videoOut} ${kb(videoOut)}KB · ${VIDEO.width}px · ${VIDEO.fps}fps · ` +
      `source webm ${videoSrc}${X}`,
  );
} else {
  say(`${D}assets/strip-before.png ${kb(BEFORE)}KB · assets/strip-after.png ${kb(AFTER)}KB${X}`);
}

if (castPath) {
  writeFileSync(
    castPath,
    [
      JSON.stringify({ version: 2, width: 80, height: 42, title: "jev-use de-clutter" }),
      ...events.map((e) => JSON.stringify(e)),
    ].join("\n") + "\n",
  );
  console.error(`cast written: ${castPath} (${jev.via}, ${exePath})`);
}

// Exactly one markdown row, last line on stdout (wider than the 80-col cast).
console.log(
  `| De-clutter: 1 page, 1 call | ${boxes.length} boxes → ${hide.length} hidden in ` +
    `${res.latencyMs}ms · false hides: ${falseHides.length} |`,
);
