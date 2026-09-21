/* 라이브 탭. 지금 어디에 있고 어디로 되돌아갔는지(루프 띠) · 피드 · 실험 큐 · 가설 창고.
   피드 한 줄에 plain(아이도 따라올 설명)이 있으면 그것을 크게 보이고 기술적인 body는 '자세히' 뒤에 접는다.
   plain이 없는 줄은 예전처럼 제목 + 본문 그대로 나온다. 종류 타일은 필터이고, 최신이 위다. */
(function () {
  const S = window.Site, {$, esc, num} = S;
  const ST = {확정: "ok", 미확인: "un", 잡음: "rt", 기각: "rt", "답 나옴": "ok", "진행 중": "run", 막힘: "un"};
  let kind = "";

  const pill = (t) => t ? `<span class="st ${ST[t] || "un"}">${esc(t)}</span>` : "";
  const when = (ts) => String(ts || "").replace("T", " ").replace("Z", "").slice(0, 16);

  function loopStrip(loop) {
    if (!loop || !loop.steps) return "";
    const at = String(loop.at ?? loop.current ?? "");
    const back = new Set((loop.went_back || []).map(String));
    return `<section><h2>루프 — 지금 어디에 있나</h2><div class="loopstrip">`
      + loop.steps.map((s, i) => (i ? `<span class="ar">→</span>` : "")
        + `<span class="sp${String(s.id) === at ? " on" : ""}${back.has(String(s.id)) ? " back" : ""}" title="${esc(s.name || "")}">${esc(s.short || s.name || s.id)}</span>`).join("")
      + `</div>` + (loop.note ? `<p class="note">${esc(loop.note)}</p>` : "")
      + (loop.back_note ? `<p class="note">되돌아간 곳: ${esc(loop.back_note)}</p>` : "") + `</section>`;
  }
  function feedSection(feed) {
    if (!feed || !feed.length) return `<section><h2>피드</h2><p class="miss">자료 없음 — <code>feed.jsonl</code></p></section>`;
    const kinds = {};
    for (const f of feed) kinds[f.kind || "기타"] = (kinds[f.kind || "기타"] || 0) + 1;
    const shown = feed.filter((f) => !kind || (f.kind || "기타") === kind);
    const tiles = `<div class="kinds"><button class="kt${kind ? "" : " on"}" data-kind="">전체<b>${num(feed.length)}</b></button>`
      + Object.entries(kinds).map(([k, n]) => `<button class="kt${kind === k ? " on" : ""}" data-kind="${esc(k)}">${esc(k)}<b>${num(n)}</b></button>`).join("") + `</div>`;
    const items = shown.map((f) => {
      const nums = Object.entries(f.numbers || {}).map(([k, v]) => `${esc(k)} ${esc(String(v))}`).join(" · ");
      const links = (f.links || []).map((l) => `<a href="${esc(l.href)}">${esc(l.label)}</a>`).join(" · ");
      const body = f.body ? (f.plain ? `<details><summary>자세히</summary><p class="body">${esc(f.body)}</p></details>` : `<p class="body">${esc(f.body)}</p>`) : "";
      return `<li><div class="ft"><b>${esc(f.title || "")}</b>${pill(f.status)}`
        + `<span class="meta">${esc(when(f.ts))}${f.author ? " · " + esc(f.author) : ""}${f.stage ? " · 단계 " + esc(f.stage) : ""}</span></div>`
        + (f.plain ? `<p class="plain">${esc(f.plain)}</p>` : "") + body
        + (nums || links ? `<p class="nums">${nums}${nums && links ? " · " : ""}${links}</p>` : "") + `</li>`;
    }).join("");
    return `<section><h2>피드 <span class="tag">최신이 위</span></h2>${tiles}<ul class="feed">${items}</ul></section>`;
  }
  function queueSection(q) {
    if (!q || !q.experiments) return `<section><h2>실험 큐</h2><p class="miss">자료 없음 — <code>queue.json</code></p></section>`;
    const items = q.experiments.map((e) => `<div class="exp"><div class="eh"><b>${esc(e.name || e.id)}</b>${pill(e.state)}`
      + `<span class="meta">${esc(e.phase || "")}${e.cost ? " · " + esc(e.cost) : ""}</span></div><dl>`
      + [["왜", e.intent], ["가설", e.hypothesis], ["어떻게", e.method], ["통과 기준", e.gate], ["결과", e.result]]
        .filter(([, v]) => v).map(([k, v]) => `<dt>${k}</dt><dd>${esc(v)}</dd>`).join("") + `</dl></div>`).join("");
    return `<section><h2>실험 큐 <span class="tag">${num(q.experiments.length)}개</span></h2>${items}`
      + (q.note ? `<p class="note">${esc(q.note)}</p>` : "") + `</section>`;
  }
  function bankSection(b) {
    if (!b || !b.cards) return `<section><h2>가설 창고</h2><p class="miss">자료 없음 — <code>bank_public.json</code></p></section>`;
    const items = b.cards.map((c) => `<div class="card"><div class="ch"><b>${esc((c.title || c.id).slice(0, 120))}</b>${pill(c.status === "rejected" ? "기각" : c.status === "accepted" ? "확정" : "미확인")}`
      + `<span class="meta">${c.round ? "R" + esc(String(c.round)) : ""}${c.stratum ? " · " + esc(c.stratum) : ""}</span></div>`
      + (c.reason ? `<div class="cl">사유: ${esc(c.reason)}</div>` : "")
      + (c.rates ? `<div class="cl">${Object.entries(c.rates).map(([k, v]) => `${esc(k)} ${esc(String(v))}`).join(" · ")}</div>` : "") + `</div>`).join("");
    return `<section><h2>가설 창고 <span class="tag">${num(b.cards.length)}장</span></h2>${items}</section>`;
  }

  S.live_render = function () {
    const wrap = $("livewrap"), L = S.live;
    if (!L) { wrap.innerHTML = `<section><p class="miss">자료 없음 — <code>data/live.json</code> 을 읽지 못했습니다.</p></section>`; return; }
    const feed = (L.feed || []).filter((f) => !S.week || !f.week || f.week === S.week);
    wrap.innerHTML = `<p class="note" style="margin:8px 2px">마지막 갱신 ${esc(L.updated || "알 수 없음")}</p>`
      + loopStrip(L.loop) + feedSection(feed) + queueSection(L.queue) + bankSection(L.bank);
  };
  document.addEventListener("click", (e) => {
    if (S.tab !== "live") return;
    const t = e.target.closest("[data-kind]");
    if (!t) return;
    kind = t.dataset.kind;
    S.live_render();
  });
})();
