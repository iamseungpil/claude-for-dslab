/* 파이프라인 판. 연구 전체를 번호 붙은 상자 한 줄로 그리고, 상태를 색으로 보인다.
   상자를 누르면 그 걸음의 통계·사례가 아래 서랍에 열리고, 그 안에 그 실험의 모듈(2층 판)이 같은 모양으로 그려진다.
   모듈을 누르면 그 모듈이 실제로 남긴 원문(조회 기록·카드·판정·채점·보고서)을 그대로 보여 준다.
   자료는 data/live.json 의 `pipeline` 과 data/artifacts/*.json 이다. 주제 이야기는 한 줄도 없다. */
window.Site.board = (function () {
  const S = window.Site, {$, esc, num, fa} = S;
  const SKO = {done: "끝남", running: "진행 중", failed: "막히거나 되돌아감", returned: "막히거나 되돌아감",
               next: "다음", blocked: "막히거나 되돌아감", waiting: "대기"};
  const cache = {};
  let node = "", mod = "", round = 0, picked = false;   // picked: 사람이 직접 고른 것인가

  const byId = (P, id) => [...(P.nodes || []), ...(P.side_nodes || [])].find((n) => n.id === id);

  function box(n, opts) {
    const st = n.state || "next";
    const dim = opts && opts.dimUnless && !(n.weeks || []).includes(opts.dimUnless);
    return `<button class="pb ${st}${node === n.id ? " on" : ""}${dim ? " dim" : ""}" data-node="${esc(n.id)}"`
      + ` title="${esc(n.one_line || n.label)}">`
      + (n.n ? `<span class="nn">${n.n}</span>` : `<span class="nn side">↩</span>`)
      + `<span class="lb">${esc(n.label)}</span>`
      + (st === "running" ? `<span class="tag run">진행 중</span>` : "")
      + (st === "blocked" ? `<span class="tag">🔒 막힘</span>` : "")
      + (n.number ? `<span class="nm"><b>${esc(n.number)}</b>${n.number_caption ? ` ${esc(n.number_caption)}` : ""}</span>` : "")
      + (n.back_reason && (st === "returned" || st === "failed" || st === "blocked")
         ? `<span class="why">${esc(n.back_reason || n.blocked_reason)}</span>` : "")
      + (n.blocked_reason && st === "blocked" ? `<span class="why">${esc(n.blocked_reason)}</span>` : "")
      + (opts && opts.showLine && n.one_line ? `<span class="ol">${esc(n.one_line)}</span>` : "")
      + `</button>`;
  }
  const legend = () => `<div class="pblg">` + [["done", "끝남"], ["running", "진행 중"], ["next", "다음"], ["returned", "막히거나 되돌아감"]]
    .map(([s, t]) => `<span><i class="pb ${s}"></i>${t}</span>`).join("") + `</div>`;

  function bands(P) {   // 목표를 고르면 그 목표의 띠만 진하게 남는다
    const per = (P.bands || []).map((b) => {
      const ns = (P.nodes || []).filter((n) => n.band === b.id);
      const dimB = goalOn && !((P.goals || []).find((g) => g.id === goalOn) || {bands: []}).bands.includes(b.id);
      return `<div class="pbband${dimB ? " dimb" : ""}" style="--bc:${b.color || "var(--c1)"}">`
        + `<div class="bh">${esc(b.label)}<small>${ns.length}걸음</small></div>`
        + `<div class="pbrow">` + ns.map((n, i) => (i ? `<span class="pbar">→</span>` : "") + box(n, boardOpts)).join("") + `</div></div>`;
    }).join("");
    const side = (P.side_nodes || []).length
      ? `<div class="pbside"><span class="meta">되돌아간 갈래</span>`
        + P.side_nodes.map((n) => box(n, boardOpts)).join("") + `</div>` : "";
    return per + side;
  }

  let goalOn = "";
  function goals(P) {
    const gs = P.goals || [];
    if (!gs.length) return "";
    const CF = {"확정": "ok", "일부 확정": "un", "미확인": "un", "철회": "rt", "진행 중": "run"};
    return `<div class="goals">` + gs.map((g) => {
      const pctv = g.total ? Math.round(100 * g.done / g.total) : 0;
      return `<button class="goal${goalOn === g.id ? " on" : ""}" data-goal="${esc(g.id)}">`
        + `<span class="gh"><b>${esc(g.label)}</b><span class="st ${CF[g.confidence] || "un"}">${esc(g.confidence || "")}</span></span>`
        + `<span class="ga">${esc(g.answer || "")}</span>`
        + (g.lead ? `<span class="glead">미확인 단서: ${esc(String(g.lead).replace(/^아직 못 박지 못한 단서:\s*/, ""))}</span>` : "")
        + `<span class="gm"><i style="width:${pctv}%"></i></span>`
        + `<span class="gn">${g.done} / ${g.total} 걸음 끝남${g.running ? " · 지금 진행 중" : ""}</span></button>`;
    }).join("") + `</div>`;
  }
  let boardOpts = {};
  function render(P, opts) {
    boardOpts = opts || {};
    if (!P || !P.nodes) return `<p class="miss">자료 없음 — <code>pipeline.json</code></p>`;
    const id = (opts && opts.id) || "pbwrap";   // 탭마다 판이 하나씩 있으므로 id 를 나눈다
    return goals(P) + `<div class="pbwrap" id="${id}">${bands(P)}<svg class="pbarrows"></svg>${legend()}</div>`;
  }
  // 되돌아간 곳을 판 위의 곡선 화살표로 그린다. 글로 적지 않고 눈에 보이게.
  function drawArrows(P, id) {
    const wrap = document.getElementById(id || "pbwrap");
    const svg = wrap && wrap.querySelector(".pbarrows");
    if (!wrap || !svg || !P) return;
    const W = wrap.getBoundingClientRect();
    if (!W.width) return;                                    // 숨은 탭의 판은 재지 않는다
    svg.setAttribute("viewBox", `0 0 ${Math.round(W.width)} ${Math.round(W.height)}`);
    svg.setAttribute("width", Math.round(W.width));
    svg.setAttribute("height", Math.round(W.height));
    // 값에 따옴표가 들어갈 수 있어 선택자 대신 한 번 훑는다 (CSS.escape 가 없는 환경도 있다).
    const all = [...wrap.querySelectorAll("[data-node]")];
    const pos = (id) => {
      const el = all.find((x) => x.dataset.node === id);
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return {x: r.left - W.left + r.width / 2, y: r.top - W.top, b: r.bottom - W.top, w: r.width};
    };
    const parts = [`<defs><marker id="ah" markerWidth="7" markerHeight="7" refX="6" refY="3.2" orient="auto">`
      + `<path d="M0,0 L7,3.2 L0,6.4 z" fill="var(--warn-fg)"/></marker></defs>`];
    // 화살표는 '지금 되돌아간 것' 하나만 그린다 — 지난 갈래까지 다 그으면 판이 실타래가 된다.
    // 나머지는 상자 안의 한 줄(↩ 이유)로 남는다.
    for (const n of (P.nodes || []).filter((x) => x.state === "returned" && x.back_to)) {
      const a = pos(n.id), b = pos(n.back_to);
      if (!a || !b) continue;
      const y = Math.max(a.b, b.b) + 12, mid = (a.x + b.x) / 2;
      parts.push(`<path d="M${a.x},${a.b + 2} C${a.x},${y} ${b.x},${y} ${b.x},${b.b + 2}" fill="none"`
        + ` stroke="var(--warn-fg)" stroke-width="1.6" stroke-dasharray="5 3" marker-end="url(#ah)"/>`
        + `<text x="${mid}" y="${y + 11}" text-anchor="middle" font-size="10.5" fill="var(--warn-fg)">`
        + `${esc(n.back_kind || "되돌아감")}</text>`);
    }
    svg.innerHTML = parts.join("");
  }

  /* ── 2층: 모듈 판 ── */
  function modules(n, boardOnly) {
    const rs = n.rounds || [];
    const cur = round || n.current_round || (rs.length ? rs[rs.length - 1] : 0);
    const sel = rs.length ? `<div class="rsel"><span class="meta">바퀴</span>`
      + rs.map((r) => `<button class="tb${r === cur ? " on" : ""}" data-round="${r}">${r}</button>`).join("") + `</div>` : "";
    const c = (n.round_counts || {})[cur] || {};
    const cnt = {q: c.queries, cards: c.cards, bank: c.cards, judge: c.cards, score: c.recovered, report: null};
    const mods = (n.modules || []).map((m, i) => (i ? `<span class="pbar">→</span>` : "")
      + `<button class="pb ${m.state || "done"}${mod === m.id ? " on" : ""}" data-mod="${esc(m.id)}">`
      + `<span class="nn">${i + 1}</span><span class="lb">${esc(m.label)}</span>`
      + (m.state === "running" ? `<span class="tag run">응답 중</span>` : m.state === "waiting" ? `<span class="tag">대기</span>` : "")
      + (cnt[m.id] != null ? `<span class="nm">${num(cnt[m.id])}${m.id === "score" ? " / 4" : m.id === "q" ? "회" : "장"}</span>` : "")
      + `</button>`).join("");
    if (boardOnly) return `<h3>이 걸음 안에서 무엇이 도는가 ${cur ? `· ${cur}바퀴` : ""}</h3>${sel}`
      + `<div class="pbrow lvl2">${mods}</div>${legend()}`
      + `<p class="note">칸을 누르면 '응답 전문'에서 그 칸이 남긴 기록을 볼 수 있습니다.</p>`;
    return `${sel}<div class="pbrow lvl2">${mods}</div><div id="modview">${modView(n, cur)}</div>`;
  }

  /* ── 3층: 모듈이 남긴 원문 ── */
  function modView(n, cur) {
    if (!mod) return `<p class="note">모듈을 누르면 그 모듈이 실제로 남긴 기록이 그대로 보입니다.</p>`;
    const key = ({q: "q", cards: "cards", bank: "cards", judge: "judge", score: "score", report: "report"})[mod];
    const file = `${key}_${cur}.json`;
    const d = cache[file];
    if (d === undefined) { load(file); return `<p class="note">불러오는 중…</p>`; }
    if (d === null) return `<p class="miss">자료 없음 — <code>data/artifacts/${esc(file)}</code></p>`;
    if (key === "q") {
      return `<p class="note">${esc(d.note || "")} · ${num(d.n)}회</p><div class="wrap"><table class="ctab">`
        + `<thead><tr><th>무엇을 봤나</th><th>조건</th><th>나온 줄</th></tr></thead><tbody>`
        + d.rows.map((r) => `<tr><td data-l="본 것">${esc(r.view)}</td>`
          + `<td data-l="조건"><code>${esc(JSON.stringify(r.args))}</code></td>`
          + `<td data-l="줄 수">${num(r.n_rows)}</td></tr>`).join("") + `</tbody></table></div>`;
    }
    if (key === "cards") {
      return d.cards.map((c) => `<div class="card"><div class="ch"><b>${esc(c.claim_ko || c.id)}</b></div>`
        + (c.why_ko ? `<div class="cl">맞다면 → ${esc(c.why_ko)}</div>` : "")
        + `<details class="full"><summary>카드 원문(JSON)</summary><pre>${esc(JSON.stringify(c.card, null, 1))}</pre></details></div>`).join("");
    }
    if (key === "judge") {
      const V = d.verdicts || {};
      return Object.entries(V).map(([id, v]) => `<div class="card"><div class="ch"><b>${esc(id)}</b>`
        + `<span class="st ${d.kept.includes(id) ? "ok" : d.rejected.includes(id) ? "rt" : "un"}">`
        + `${d.kept.includes(id) ? "남음" : d.rejected.includes(id) ? "기각" : "미정"}</span></div>`
        + `<details class="full"><summary>판정 원문(JSON)</summary><pre>${esc(JSON.stringify(v, null, 1))}</pre></details></div>`).join("");
    }
    if (key === "score") {
      return `<p class="note">${esc(d.note || "")}</p><pre class="art">${esc(JSON.stringify(d.score, null, 1))}</pre>`;
    }
    return d.text ? `<p class="note">${esc(d.path || "")}</p><pre class="art">${esc(d.text)}</pre>`
      : `<p class="miss">이 바퀴의 보고서는 저장돼 있지 않습니다.</p>`;
  }
  async function load(file) {
    cache[file] = undefined;
    try {
      const r = await fetch("data/artifacts/" + file);
      cache[file] = r.ok ? await r.json() : null;
    } catch { cache[file] = null; }
    if (S.tab === "live") S.live_render(); else S.stats_render();
  }

  /* ── 서랍: 상자 하나의 결과 ── */
  let dtab = "result";
  function drawer(P) {
    if (!node) return `<p class="note">상자를 누르면 그 걸음의 결과와 사례가 여기에 열립니다.</p>`;
    const n = byId(P, node);
    if (!n) return "";
    const st = {확정: "ok", 미확인: "un", 철회: "rt", "진행 중": "run"}[n.status] || "un";
    const blk = n.stats_block && S.stats ? (S.stats.blocks || []).find((b) => b.id === n.stats_block) : null;
    const charts = blk && !blk.missing ? (blk.charts || (blk.chart ? [blk.chart] : [])).map((c) => S.charts.render(c)).join("") : "";
    const cases = blk && blk.cases && blk.cases.cases ? blk.cases.cases.map((c) =>
      `<button data-case="${esc(c.k)}" data-model="${esc(c.model)}" data-patch="${esc(JSON.stringify(blk.cases.patch))}">`
      + `${esc(c.repo || "")} · ${esc(c.title || c.task)}</button>`).join("") : "";
    const loop = (S.live && S.live.loop) || {};
    const step = (loop.steps || []).find((s) => String(s.id) === String(loop.at));
    return `<div class="pbdraw"><div class="dh"><b>${n.n ? n.n + ". " : ""}${esc(n.label)}</b>`
      + `<span class="st ${st}">${esc(n.status || "")}</span>`
      + (n.number ? `<span class="num">${esc(n.number)}</span>` : "") + `</div>`
      + `<p class="tk">${esc(n.one_line || "")}</p>`
      + (n.blocked_reason ? `<p class="miss">막힌 이유: ${esc(n.blocked_reason)}</p>` : "")
      + (n.back_reason ? `<p class="miss">되돌아간 이유: ${esc(n.back_reason)}</p>` : "")
      + (n.blocked_reason || n.back_reason ? "" : "")
      + `<div class="dtabs">` + [["result", "결과"], ["how", "과정"], ["raw", "응답 전문"]]
        .filter(([k]) => k === "result" || n.modules)
        .map(([k, t]) => `<button class="tb${dtab === k ? " on" : ""}" data-dtab="${k}">${t}</button>`).join("") + `</div>`
      + (dtab === "result" ? charts + (n.panel && S.panelFor ? S.panelFor(n.panel) : "")
          + (n.cases_filter ? `<div class="caselinks"><span class="meta">사례</span>${cases}`
            + `<button ${fa(n.cases_filter)}>자료에서 보기 →</button></div>` : "")
        : dtab === "how" ? (n.modules ? modules(n, true) : "")
        : (n.modules ? modules(n, false) : ""))
      + (n.state === "running" && step ? `<p class="note">이 걸음은 연구 한 바퀴의 “${esc(step.short || step.id)}” 자리에 있습니다.</p>` : "")
      + `</div>`;
  }

  function onClick(e) {
    const b = e.target.closest("[data-node]");
    if (b) { const same = node === b.dataset.node && picked;
             node = same ? "" : b.dataset.node; picked = !same; mod = ""; round = 0; S.writeUrl(); return true; }
    const dt = e.target.closest("[data-dtab]");
    if (dt) { dtab = dt.dataset.dtab; return true; }
    const m = e.target.closest("[data-mod]");
    if (m) { mod = mod === m.dataset.mod ? "" : m.dataset.mod; dtab = "raw"; return true; }
    const g = e.target.closest("[data-goal]");
    if (g) { goalOn = goalOn === g.dataset.goal ? "" : g.dataset.goal; return true; }
    const r = e.target.closest("[data-round]");
    if (r) { round = Number(r.dataset.round); mod = mod || "cards"; return true; }
    return false;
  }
  return {render, drawer, onClick, drawArrows,
          get node() { return node; }, set node(v) { node = v; },
          get picked() { return picked; }, set picked(v) { picked = v; },
          SKO};
})();
