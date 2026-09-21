/* 파이프라인 판. 연구 전체를 번호 붙은 상자 한 줄로 그리고, 상태를 색으로 보인다.
   상자를 누르면 그 걸음의 통계·사례가 아래 서랍에 열리고, 그 안에 그 실험의 모듈(2층 판)이 같은 모양으로 그려진다.
   모듈을 누르면 그 모듈이 실제로 남긴 원문(조회 기록·카드·판정·채점·보고서)을 그대로 보여 준다.
   자료는 data/live.json 의 `pipeline` 과 data/artifacts/*.json 이다. 주제 이야기는 한 줄도 없다. */
window.Site.board = (function () {
  const S = window.Site, {$, esc, num, fa} = S;
  const SKO = {done: "끝남", running: "진행 중", failed: "실패", returned: "되돌아감",
               next: "아직", blocked: "막힘", waiting: "대기"};
  const cache = {};
  let node = "", mod = "", round = 0;

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
      + (n.number ? `<span class="nm">${esc(n.number)}</span>` : "")
      + (opts && opts.showLine && n.one_line ? `<span class="ol">${esc(n.one_line)}</span>` : "")
      + `</button>`;
  }
  const legend = () => `<div class="pblg">` + ["done", "running", "returned", "failed", "next", "blocked"]
    .map((s) => `<span><i class="pb ${s}"></i>${SKO[s]}</span>`).join("") + `</div>`;

  function bands(P) {
    const per = (P.bands || []).map((b) => {
      const ns = (P.nodes || []).filter((n) => n.band === b.id);
      return `<div class="pbband" style="--bc:${b.color || "var(--c1)"}">`
        + `<div class="bh">${esc(b.label)}<small>${ns.length}걸음</small></div>`
        + `<div class="pbrow">` + ns.map((n, i) => (i ? `<span class="pbar">→</span>` : "") + box(n, boardOpts)).join("") + `</div></div>`;
    }).join("");
    const side = (P.side_nodes || []).length
      ? `<div class="pbside"><span class="meta">되돌아간 갈래</span>`
        + P.side_nodes.map((n) => box(n, boardOpts)
          + `<span class="backr">↩ ${esc(n.back_reason || "")}</span>`).join("") + `</div>` : "";
    const backs = (P.nodes || []).filter((n) => n.back_to).map((n) =>
      `<span class="backr">↩ ${esc(n.label)} → ${esc((byId(P, n.back_to) || {}).label || n.back_to)} · ${esc(n.back_reason || "")}</span>`).join("");
    return per + side + (backs ? `<div class="pbside">${backs}</div>` : "");
  }

  let boardOpts = {};
  function render(P, opts) {
    boardOpts = opts || {};
    if (!P || !P.nodes) return `<p class="miss">자료 없음 — <code>pipeline.json</code></p>`;
    return `<div class="pbwrap">${bands(P)}${legend()}</div>`;
  }

  /* ── 2층: 모듈 판 ── */
  function modules(n) {
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
    return `<h3>이 실험 안에서 무엇이 도는가 ${cur ? `· ${cur}바퀴` : ""}</h3>${sel}`
      + `<div class="pbrow lvl2">${mods}</div>${legend()}`
      + `<div id="modview">${modView(n, cur)}</div>`;
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
      + charts
      + (n.cases_filter ? `<div class="caselinks"><span class="meta">사례</span>${cases}`
        + `<button ${fa(n.cases_filter)}>자료에서 보기 →</button></div>` : "")
      + (n.modules ? modules(n) : "")
      + (n.state === "running" && step ? `<p class="note">이 실험은 연구 한 바퀴의 “${esc(step.short || step.id)}” 단계에 있습니다.</p>` : "")
      + `</div>`;
  }

  function onClick(e) {
    const b = e.target.closest("[data-node]");
    if (b) { node = node === b.dataset.node ? "" : b.dataset.node; mod = ""; round = 0; S.writeUrl(); return true; }
    const m = e.target.closest("[data-mod]");
    if (m) { mod = mod === m.dataset.mod ? "" : m.dataset.mod; return true; }
    const r = e.target.closest("[data-round]");
    if (r) { round = Number(r.dataset.round); mod = mod || "cards"; return true; }
    return false;
  }
  return {render, drawer, onClick,
          get node() { return node; }, set node(v) { node = v; },
          SKO};
})();
