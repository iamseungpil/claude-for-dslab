/* 라이브 탭. 네 층으로 읽는다:
   ① 지금 하는 일 — 돌고 있는 실험과 가장 새 기록 한 줄 (맨 위 고정)
   ② 진행 중인 실험 — 바퀴별 수치, 카드 표, 그리고 펼치면 원문(카드 JSON · 판정 JSON · 제안자 보고서)
   ③ 지도 — 의도 → 질문 → 실험. 지난 것은 채우고, 지금 것은 '여기', 다음 것은 테두리만.
   ④ 피드 · 큐 · 가설 창고.
   자료는 data/live.json 이 기본이고, /api/live 가 있으면 10초마다 그것으로 갈아 끼운다(KV 실시간). */
(function () {
  const S = window.Site, {$, esc, num} = S;
  const ST = {확정: "ok", 미확인: "un", 잡음: "rt", 기각: "rt", 남음: "ok", "답 나옴": "ok", "진행 중": "run", 막힘: "un"};
  let kind = "", node = "", timer = null, ctl = null, ctlErr = "";

  const pill = (t) => t ? `<span class="st ${ST[t] || "un"}">${esc(t)}</span>` : "";
  const when = (ts) => String(ts || "").replace("T", " ").replace("Z", "").slice(0, 16);
  const ko = (k) => ((S.live && S.live.kinds_ko) || {})[k] || k || "기타";
  const jsonBlock = (label, obj) => `<details class="full"><summary>${esc(label)}</summary><pre>${esc(JSON.stringify(obj, null, 1))}</pre></details>`;

  /* ① 지금 하는 일 */
  function nowBar(L) {
    const n = L.now || {};
    const run = n.running || [];
    const body = run.length ? run.map((e) => `<b>${esc(e.name)}</b> ${pill(e.state)}`
      + `<dl><dt>왜</dt><dd>${esc(e.intent || "-")}</dd><dt>어떻게</dt><dd>${esc(e.method || "-")}</dd>`
      + `<dt>통과 기준</dt><dd>${esc(e.gate || "-")}</dd></dl>`).join("<hr style='border:0;border-top:1px solid rgba(128,128,128,.3);margin:8px 0'>")
      : `<b>지금 돌고 있는 실험이 없습니다.</b><div class="note" style="color:inherit">큐의 '다음' 항목이 시작되면 여기에 나옵니다.</div>`;
    const last = n.latest ? `<div class="last"><b>가장 새 기록</b> · ${esc(when(n.latest.ts))} · ${esc(n.latest.author || "")}<br>`
      + `${esc(n.latest.plain || n.latest.title || "")}</div>` : "";
    return `<div class="nowbar"><h2>지금 하는 일</h2>${body}${last}</div>`;
  }

  /* ② 진행 중인 실험 패널 */
  function miniRates(rates, ci) {
    if (!rates || !rates.length) return "";
    const max = Math.max(1, ...rates.map((r) => r.v));
    return `<span class="mini">` + rates.map((r) => `<em>${esc(r.label)} ${r.v}%</em><i style="width:${(100 * r.v / max).toFixed(1)}%"></i>`).join("")
      + (ci ? `<em>194−35 차이 95% 구간 [${(100 * ci[0]).toFixed(0)}, ${(100 * ci[1]).toFixed(0)}]%p</em>` : "") + `</span>`;
  }
  function panel(p) {
    if (p.missing) return `<section><h2>${esc(p.title)}</h2><div class="miss">자료 없음 — ${(p.missing.paths || []).map((x) => `<code>${esc(x)}</code>`).join(", ")}</div></section>`;
    const rounds = [...(p.rounds || [])].reverse().map((r, i) => {
      const mets = `<div class="mrow">` + r.metrics.map((m) => `<span class="met"><b>${num(m.v)}${m.of ? ` / ${m.of}` : ""}</b><span>${esc(m.label)}</span></span>`).join("") + `</div>`;
      const rows = r.cards.map((c) => `<tr><td data-l="가설">${esc(c.claim)}${jsonBlock("카드 JSON", c.full.card)}${jsonBlock("판정 JSON", c.full.verdict_json)}</td>`
        + `<td data-l="대상">${esc(c.target || "-")}</td><td data-l="판정">${pill(c.verdict)}</td>`
        + `<td data-l="세 집단에서">${miniRates(c.rates, c.ci) || "-"}</td>`
        + `<td data-l="사유">${esc(c.reason || "-")}</td></tr>`).join("");
      return `<details class="rnd" ${i === 0 ? "open" : ""}><summary>${r.round}바퀴`
        + `<span class="meta">카드 ${r.cards.length}장 · 남음 ${r.metrics[1].v} · 회수 ${r.metrics[3].v}/4`
        + ` · 관문 ${r.gate.threshold ?? "?"}개 ${r.gate.pass ? "통과" : "미달"} · Jev 호출 ${r.jev_calls}회</span></summary>`
        + `<div class="rb">${mets}<div class="wrap"><table class="ctab"><thead><tr><th>가설(원문 요약)</th><th>대상</th><th>판정</th><th>세 집단에서 얼마나 나타나나</th><th>사유</th></tr></thead><tbody>${rows}</tbody></table></div>`
        + (r.report ? `<details class="full"><summary>제안자 보고서 (${esc(r.report_path)})</summary><pre>${esc(r.report)}</pre></details>` : `<p class="note">이 바퀴의 제안자 보고서는 저장돼 있지 않습니다.</p>`)
        + `</div></details>`;
    }).join("");
    return `<section><h2>진행 중인 실험 — ${esc(p.title)}</h2>`
      + `<p class="note" style="font-size:13px;color:var(--fg);line-height:1.7">${esc(p.plain || "")}</p>`
      + `<p class="tk">${esc(p.headline)} · 관문 ${p.gate_pass ? "통과" : "아직 미달"}</p>${rounds}</section>`;
  }

  /* ③ 지도 */
  function mapSection(M) {
    if (!M) return "";
    const goals = M.goals.map((g) => `<div class="mg"><b>${esc(g.label)}</b><div class="gd">${esc(g.desc || "")}</div>`
      + g.questions.map((q) => `<div class="mq"><div class="qn${q.running ? " run" : ""}">${esc(q.label)}${q.running ? `<span class="here">여기</span>` : ""}</div>`
        + `<div class="ex">` + q.experiments.map((e, i) => (i ? `<span class="arr">→</span>` : "")
          + `<button class="mn ${e.phase}${node === e.id ? " on" : ""}" data-node="${esc(e.id)}" `
          + `title="${esc(e.intent || "")}\n방법: ${esc(e.method || "")}\n결과: ${esc(e.result || "")}">`
          + `${esc(e.name)}${e.phase === "running" ? `<span class="here">여기</span>` : ""}</button>`).join("")
        + `</div></div>`).join("") + `</div>`).join("");
    return `<section><h2>지도 — 왜 이 실험을 하고 있나</h2><div class="map">${goals}</div>`
      + `<p class="note">${esc(M.note || "")}${node ? ` · 지금 <b>${esc(node)}</b> 하나만 아래에 보이는 중 — 다시 누르면 전체` : ""}</p></section>`;
  }

  /* ④ 루프 · 피드 · 큐 · 창고 */
  function loopStrip(loop) {
    if (!loop || !loop.steps) return "";
    const at = String(loop.at ?? "");
    return `<section><h2>연구 한 바퀴 — 지금 어디에 있나</h2><div class="loopstrip">`
      + loop.steps.map((s, i) => (i ? `<span class="ar">→</span>` : "")
        + `<span class="sp${String(s.id) === at ? " on" : ""}" title="${esc(s.name || "")}">${esc(s.short || s.id)}`
        + (String(s.id) === at ? ` <span class="here">여기</span>` : "") + `</span>`).join("")
      + `</div>` + (loop.note ? `<p class="note">${esc(loop.note)}</p>` : "")
      + ((loop.backs || []).length ? `<p class="note">되돌아간 적: ` + loop.backs.map((b) => `↩ ${esc(b.from)} — ${esc(b.why)}`).join(" · ") + `</p>` : "")
      + `<p class="note">이 줄의 기준 시각: ${esc(when(loop.updated))} (기록이 오래됐으면 실제 진행과 다를 수 있습니다)</p></section>`;
  }
  function feedSection(feed) {
    if (!feed || !feed.length) return `<section><h2>기록</h2><p class="miss">자료 없음 — <code>feed.jsonl</code></p></section>`;
    const kinds = {};
    for (const f of feed) kinds[f.kind || "기타"] = (kinds[f.kind || "기타"] || 0) + 1;
    const shown = feed.filter((f) => (!kind || (f.kind || "기타") === kind) && (!node || (f.node || f.exp) === node));
    const tiles = `<div class="kinds"><button class="kt${kind ? "" : " on"}" data-kind="">전체<b>${num(feed.length)}</b></button>`
      + Object.entries(kinds).map(([k, n]) => `<button class="kt${kind === k ? " on" : ""}" data-kind="${esc(k)}">${esc(ko(k))}<b>${num(n)}</b></button>`).join("") + `</div>`;
    const items = shown.map((f) => {
      const nums = Object.entries(f.numbers || {}).map(([k, v]) => `${esc(k)} ${esc(String(v))}`).join(" · ");
      const links = (f.links || []).map((l) => `<a href="${esc(l.href)}">${esc(l.label)}</a>`).join(" · ");
      const body = f.body ? (f.plain ? `<details><summary>자세히</summary><p class="body">${esc(f.body)}</p></details>` : `<p class="body">${esc(f.body)}</p>`) : "";
      return `<li><div class="ft"><b>${esc(f.title || "")}</b>${pill(f.status)}<span class="tag">${esc(ko(f.kind))}</span>`
        + `<span class="meta">${esc(when(f.ts))}${f.author ? " · " + esc(f.author) : ""}</span></div>`
        + (f.plain ? `<p class="plain">${esc(f.plain)}</p>` : "") + body
        + (nums || links ? `<p class="nums">${nums}${nums && links ? " · " : ""}${links}</p>` : "") + `</li>`;
    }).join("");
    return `<section><h2>기록 <span class="tag">새것이 위</span></h2>${tiles}<ul class="feed">${items || `<li class="empty">이 조건의 기록이 없습니다.</li>`}</ul></section>`;
  }
  function queueSection(q) {
    if (!q || !q.experiments) return "";
    const items = q.experiments.filter((e) => !node || e.id === node).map((e) => `<div class="exp"><div class="eh"><b>${esc(e.name || e.id)}</b>${pill(e.state)}`
      + `<span class="meta">${esc(e.phase || "")}${e.cost ? " · " + esc(e.cost) : ""}</span></div><dl>`
      + [["왜", e.intent], ["가설", e.hypothesis], ["어떻게", e.method], ["통과 기준", e.gate], ["결과", e.result]]
        .filter(([, v]) => v).map(([k, v]) => `<dt>${k}</dt><dd>${esc(v)}</dd>`).join("") + `</dl></div>`).join("");
    return `<section><h2>실험 큐 <span class="tag">${num(q.experiments.length)}개</span></h2>${items}${controlUI(q)}</section>`;
  }
  function bankSection(b) {
    if (!b || !b.cards) return "";
    const items = b.cards.map((c) => `<div class="card"><div class="ch"><b>${esc((c.title || c.id).slice(0, 110))}</b>`
      + pill(c.status === "rejected" ? "기각" : c.status === "kept" ? "남음" : "미확인")
      + `<span class="meta">${c.round ? "R" + esc(String(c.round)) : ""}${c.stratum ? " · " + esc(c.stratum) : ""}</span></div>`
      + (c.reason ? `<div class="cl">사유: ${esc(c.reason)}</div>` : "") + `</div>`).join("");
    return `<section><h2>가설 창고 <span class="tag">${num(b.cards.length)}장</span></h2>${items}</section>`;
  }
  /* 사용자 의도 — 다음 순서 바꾸기 · 중단 요청 · 메모. 쓰기가 막혀 있으면 이유를 적고 읽기 전용으로 둔다. */
  function controlUI(q) {
    const next = (q.experiments || []).filter((e) => e.phase === "next");
    const order = (ctl && ctl.queue_order && ctl.queue_order.length ? ctl.queue_order : next.map((e) => e.id))
      .map((id) => next.find((e) => e.id === id)).filter(Boolean);
    const run = (q.experiments || []).filter((e) => e.phase === "running");
    return `<div class="exp"><div class="eh"><b>다음 순서와 중단 요청</b>${ctlErr ? `<span class="st un">읽기 전용</span>` : ""}</div>`
      + `<div class="ord">` + order.map((e, i) => `<div class="oi"><button data-mv="${esc(e.id)}:-1" ${i === 0 ? "disabled" : ""}>↑</button>`
        + `<button data-mv="${esc(e.id)}:1" ${i === order.length - 1 ? "disabled" : ""}>↓</button> ${i + 1}. ${esc(e.name)}</div>`).join("") + `</div>`
      + `<div class="ctl">` + run.map((e) => `<button class="tb" data-stop="${esc(e.id)}">${esc(e.name.slice(0, 24))} 중단 요청</button>`).join("")
      + `<textarea id="ctl-note" placeholder="사람이 남기는 메모 (하네스가 다음 바퀴에 읽습니다)">${esc((ctl && ctl.note) || "")}</textarea>`
      + `<button class="tb" id="ctl-save">보내기</button></div>`
      + (ctlErr ? `<p class="note">${esc(ctlErr)}</p>` : `<p class="note">보낸 값은 하네스가 다음 바퀴에 읽습니다.</p>`) + `</div>`;
  }

  S.live_render = function () {
    const wrap = $("livewrap"), L = S.live;
    if (!L) { wrap.innerHTML = `<section><p class="miss">자료 없음 — <code>data/live.json</code> 을 읽지 못했습니다.</p></section>`; return; }
    const feed = (L.feed || []).filter((f) => !S.week || !f.week || f.week === S.week);
    wrap.innerHTML = nowBar(L)
      + `<p class="note" style="margin:0 2px 8px">마지막 갱신 ${esc(when(L.updated) || "알 수 없음")}`
      + (S.liveSource ? ` · ${esc(S.liveSource)}` : "") + `</p>`
      + (L.panels || []).map(panel).join("")
      + mapSection(L.map) + loopStrip(L.loop) + feedSection(feed) + queueSection(L.queue) + bankSection(L.bank);
  };

  /* 실시간 — /api/live 가 있으면 10초마다 갈아 끼운다. 없으면 정적 파일 그대로 둔다(조용히). */
  async function poll() {
    if (S.tab !== "live" || document.hidden) return;
    try {
      const r = await fetch("api/live", {cache: "no-store"});
      if (!r.ok) throw new Error("HTTP " + r.status);
      const d = await r.json();
      if (!d || !d.feed) return;
      Object.assign(S.live, d);
      S.liveSource = "실시간(KV) · " + when(d.updated || "");
      S.live_render();
    } catch { /* 정적 자료로 그대로 둔다 */ }
  }
  S.live_start = function () {
    if (S.frozen) return;           // 얼린 보고서는 그때의 기록만 보여 준다
    if (!timer) timer = setInterval(poll, 10000);
    poll();
    loadControl();
  };
  async function loadControl() {
    if (S.frozen) return;
    try {
      const r = await fetch("api/control", {cache: "no-store"});
      if (!r.ok) throw new Error("HTTP " + r.status);
      ctl = await r.json();
      ctlErr = ctl && ctl.read_only ? (ctl.why || "이 배포에서는 쓰기가 막혀 있습니다.") : "";
    } catch { ctl = null; ctlErr = "제어 기능이 이 배포에는 없습니다 (읽기 전용)."; }
    if (S.tab === "live") S.live_render();
  }
  async function save(patch) {
    try {
      const r = await fetch("api/control", {method: "POST", headers: {"Content-Type": "application/json"}, body: JSON.stringify(patch)});
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { ctlErr = `보내지 못했습니다 (${r.status}) ${d.error || ""}`; }
      else { ctl = d.control || d; ctlErr = ""; S.banner("보냈습니다 — 하네스가 다음 바퀴에 읽습니다", "info"); }
    } catch (e) { ctlErr = "보내지 못했습니다: " + e.message; }
    S.live_render();
  }

  document.addEventListener("click", (e) => {
    if (S.tab !== "live") return;
    const t = e.target.closest("[data-kind]");
    if (t) { kind = t.dataset.kind; S.live_render(); return; }
    const n = e.target.closest("[data-node]");
    if (n) { node = node === n.dataset.node ? "" : n.dataset.node; S.live_render(); return; }
    const mv = e.target.closest("[data-mv]");
    if (mv) {
      const [id, d] = mv.dataset.mv.split(":");
      const q = (S.live.queue || {}).experiments || [];
      const cur = (ctl && ctl.queue_order && ctl.queue_order.length ? ctl.queue_order : q.filter((x) => x.phase === "next").map((x) => x.id)).slice();
      const i = cur.indexOf(id), j = i + Number(d);
      if (i >= 0 && j >= 0 && j < cur.length) { cur[i] = cur[j]; cur[j] = id; ctl = {...(ctl || {}), queue_order: cur}; save({queue_order: cur}); }
      return;
    }
    const st = e.target.closest("[data-stop]");
    if (st) { save({stop: [st.dataset.stop]}); return; }
    if (e.target.closest("#ctl-save")) save({note: ($("ctl-note") || {}).value || ""});
  });
})();
