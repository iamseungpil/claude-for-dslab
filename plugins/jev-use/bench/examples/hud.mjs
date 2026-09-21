/**
 * The status bar the --video examples draw over a live page: lane/model name,
 * what is happening right now, and a running millisecond counter while a model
 * call is in flight. Shared by race.mjs and task.mjs so there is one HUD.
 *
 * Usage:
 *   const hud = { h: HUD_H, hue, label, sub, meta: "", status: "", tone, tick: false };
 *   await installHud(page, hud);                    // once, before the first goto
 *   await paint(page, hud, { status: "thinking…", tick: true });
 *
 * `paint(page, null, …)` is a no-op, so a caller that did not pass --video can
 * keep the same call sites with no branch of its own.
 */

export const HUD_H = 62;
const esc = (s) => String(s).replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c]);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
export { esc };

/**
 * Runs inside the page, re-run by the browser at the start of EVERY document:
 * it defines window.__jevPaint and immediately restores the last state from
 * sessionStorage, so clicking through to a new page never blanks the bar.
 */
export function hudBoot() {
  const KEY = "__jevHud";
  window.__jevPaint = (s) => {
    try { sessionStorage.setItem(KEY, JSON.stringify(s)); } catch { /* no storage */ }
    const host = document.body || document.documentElement;
    if (!host) return;
    let bar = document.getElementById("jev-hud");
    if (!bar) {
      bar = document.createElement("div");
      bar.id = "jev-hud";
      bar.style.cssText =
        `position:fixed;top:0;left:0;right:0;height:${s.h}px;z-index:2147483647;` +
        "box-sizing:border-box;padding:0 14px;display:flex;flex-direction:column;" +
        "justify-content:center;gap:5px;background:#0d1117;color:#e6edf3;" +
        `border-bottom:3px solid ${s.hue};box-shadow:0 4px 14px rgba(0,0,0,.45);` +
        "font-family:ui-sans-serif,-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";
    }
    if (bar.parentNode !== host) host.appendChild(bar); // re-home once <body> exists
    // Push the document down so the page's own heading stays visible.
    document.documentElement.style.setProperty("padding-top", `${s.h}px`, "important");
    bar.innerHTML =
      '<div style="display:flex;align-items:baseline;gap:9px;font-size:13px;line-height:1">' +
      `<b style="color:${s.hue};font-size:17px">${s.label}</b>` +
      `<span style="opacity:.62">${s.sub}</span>` +
      `<span style="margin-left:auto;opacity:.62">${s.meta}</span></div>` +
      `<div style="font-size:16px;font-weight:700;line-height:1.15;color:${s.tone}">` +
      `${s.status}<span id="jev-hud-ms"></span></div>`;
    clearInterval(window.__jevHudTimer);
    if (s.tick) {
      const started = Date.now();
      const el = bar.querySelector("#jev-hud-ms");
      window.__jevHudTimer = setInterval(() => { el.textContent = ` ${Date.now() - started}ms`; }, 50);
    }
  };
  // Document-start is before <html> exists and DOMContentLoaded is far too
  // late on a long page, so poll briefly until there is somewhere to draw.
  let tries = 0;
  const restore = () => {
    let s = null;
    try { s = JSON.parse(sessionStorage.getItem(KEY) || "null"); } catch { /* opaque origin */ }
    if (s && (document.body || document.documentElement)) window.__jevPaint(s);
    else if (++tries < 400) setTimeout(restore, 8);
  };
  restore();
  document.addEventListener("DOMContentLoaded", restore);
}

/**
 * Arm a page: seed the starting state so the bar is already painted on the
 * FIRST document too, then install the boot script. Order matters — the seed
 * must land before hudBoot's restore runs, and it only fills an empty slot so
 * a later navigation never resets the bar to the starting text.
 */
export async function installHud(page, state) {
  if (!state) return;
  await page.addInitScript((s) => {
    try {
      if (!sessionStorage.getItem("__jevHud")) sessionStorage.setItem("__jevHud", JSON.stringify(s));
    } catch { /* opaque origin */ }
  }, state);
  await page.addInitScript(hudBoot);
}

/**
 * Merge `patch` into `state` and repaint. A repaint fired while the page is
 * swapping documents loses its execution context, so it is retried once; one
 * still lost is reported rather than swallowed. A null `state` does nothing.
 */
export async function paint(page, state, patch, tag = "hud") {
  if (!state) return;
  Object.assign(state, patch);
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const drawn = await page.evaluate(
        (s) => (window.__jevPaint ? (window.__jevPaint(s), true) : false),
        state,
      );
      if (drawn) return;
    } catch (e) {
      if (attempt) console.error(`${tag}: ${String(e.message).split("\n")[0]}`);
    }
    await sleep(150);
  }
  console.error(`${tag}: lost repaint "${state.status}"`);
}
