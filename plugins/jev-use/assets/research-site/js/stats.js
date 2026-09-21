/* 통계 탭 = 주차 요약 + 질문 블록.
   주차 요약(weekly.json): 이번 주에 알아보려던 것 → 한 일 → 결과(숫자 하나) → 상태 → 대표 사례 → 철회된 것.
   질문 블록: 쉬운 말 질문 · 차트(여러 장 가능) · 한 줄 결론 · 상태 배지 · 덧붙임 목록 · 대표 사례.
   숫자는 전부 빌드 때 파일에서 센 것이고, 자료가 없으면 '자료 없음'과 찾은 경로를 그대로 보여 준다. */
(function () {
  const S = window.Site, {$, esc, num, fa} = S;
  const ST = {ok: ["확정", "ok"], un: ["미확인", "un"], rt: ["철회", "rt"], run: ["진행 중", "run"]};
  const pill = (st, label) => { const [l, c] = ST[st] || ST.un; return `<span class="st ${c}">${esc(label || l)}</span>`; };
  const open = new Set();   // '모두 보기'를 누른 차트

  function caseLinks(cases, extra) {
    if (!cases || !cases.cases || !cases.cases.length) return "";
    const all = `<button ${fa(cases.patch)} title="이 조건의 과제 전부">${num(cases.n)}개 전부 보기 →</button>`;
    return `<div class="caselinks"><span class="meta">대표 사례</span>`
      + cases.cases.map((c) => `<button data-case="${esc(c.k)}" data-model="${esc(c.model)}" data-patch="${esc(JSON.stringify(cases.patch))}" `
        + `title="${esc(c.task)} · ${esc(c.outcome || "")}">${esc(c.repo || "")} · ${esc(c.title || c.task.slice(0, 24))}</button>`).join("")
      + all + (extra || "") + `</div>`;
  }
  function chart(ch, bid, i) {
    if (!ch) return "";
    const key = bid + ":" + i;
    const lim = ch.limit && ch.rows && ch.rows.length > ch.limit && !open.has(key);
    const shown = lim ? {...ch, rows: ch.rows.slice(0, ch.limit)} : ch;
    return S.charts.render(shown)
      + (lim ? `<p class="note"><button class="tb" data-more="${esc(key)}">나머지 ${num(ch.rows.length - ch.limit)}줄 모두 보기</button></p>` : "");
  }

  function block(b) {
    const head = `<div class="qh"><span class="qq">${esc(b.question)}</span>${pill(b.status, b.status_label)}`
      + (b.status_note ? `<span class="meta">${esc(b.status_note)}</span>` : "") + `</div>`;
    if (b.missing) {
      return `<section class="qb">${head}<div class="miss">자료 없음 — 이 블록이 찾은 경로:<br>`
        + (b.missing.paths || []).map((p) => `<code>${esc(p)}</code>`).join("<br>")
        + (b.missing.why ? `<br>${esc(b.missing.why)}` : "") + `</div></section>`;
    }
    const charts = (b.charts || (b.chart ? [b.chart] : [])).map((c, i) => chart(c, b.id, i)).join("");
    const notes = (b.notes || []).length
      ? `<ul class="notes">` + b.notes.map((n) => `<li class="${n.status === "rt" ? "rt" : ""}">${pill(n.status)}<span class="t">${esc(n.text)}</span></li>`).join("") + `</ul>`
      : "";
    return `<section class="qb">${head}${charts || `<p class="empty">차트 없음</p>`}`
      + (b.takeaway ? `<p class="tk">${esc(b.takeaway)}</p>` : "")
      + (b.note ? `<p class="note">${esc(b.note)}</p>` : "") + notes + caseLinks(b.cases) + `</section>`;
  }

  function weekCard(c) {
    const snap = (S.reports || []).find((r) => String(r.week_id) === String(c.week));
    const links = (c.cases || []).map((cs) => `<div class="caselinks" style="margin-top:2px"><span class="meta">${esc(cs.label || "")}</span></div>` + caseLinks(cs.resolved, "")).join("")
      || (c.cases_note ? `<p class="note">${esc(c.cases_note)}</p>` : "");
    return `<div class="wk"><div class="wh"><b>${esc(c.week)}주차 · ${esc(c.title)}</b>${pill(c.status)}`
      + (c.number ? `<span class="num">${esc(c.number)}</span>` : "") + `</div>`
      + `<dl><dt>알아보려던 것</dt><dd>${esc(c.intent)}</dd>`
      + `<dt>한 일</dt><dd>${esc(c.method)}</dd>`
      + `<dt>결과</dt><dd>${esc(c.result)}</dd></dl>`
      + links
      + ((c.retracted || []).length ? `<ul class="rt notes">${c.retracted.map((r) => `<li>${pill("rt")}<span class="t">${esc(r)}</span></li>`).join("")}</ul>` : "")
      + (c.source ? `<p class="src">근거 파일: ${esc(c.source)}</p>` : "")
      + (snap ? `<p class="note"><a href="${esc(snap.path)}">당시 보고서 보기 →</a></p>` : "")
      + `</div>`;
  }

  S.stats_render = function () {
    const wrap = $("statswrap"), wk = $("weeklywrap");
    if (!S.stats) { wrap.innerHTML = `<section><p class="miss">자료 없음 — <code>data/stats.json</code> 을 읽지 못했습니다.</p></section>`; return; }
    const cards = (S.stats.weekly || []).filter((c) => !S.week || c.week === S.week);
    wk.innerHTML = cards.length
      ? `<section><h2>주차 요약 — 무엇을 알아보려 했고, 무엇이 나왔나</h2>`
        + [...cards].reverse().map(weekCard).join("")
        + `<p class="note">${esc(S.stats.weekly_note || "")}</p></section>`
      : `<section><h2>주차 요약</h2><p class="empty">이 주차의 요약 카드가 아직 없습니다.</p></section>`;
    const blocks = (S.stats.blocks || []).filter((b) => !S.week || !b.week || b.week === S.week);
    wrap.innerHTML = `<section style="padding-bottom:6px"><h2>질문 ${num(blocks.length)}개 — 숫자는 빌드 때 파일에서 직접 센 값입니다`
      + (S.stats.built_at ? ` · 갱신 ${esc(S.stats.built_at)}` : "") + `</h2></section>`
      + (blocks.length ? blocks.map(block).join("") : `<section><p class="empty">이 주차에 해당하는 질문이 없습니다.</p></section>`);
  };
  document.addEventListener("click", (e) => {
    if (S.tab !== "stats") return;
    const more = e.target.closest("[data-more]");
    if (more) { open.add(more.dataset.more); S.stats_render(); return; }
    const cs = e.target.closest("[data-case]");
    if (cs) { S.list.openCase(cs.dataset.case, cs.dataset.model, JSON.parse(cs.dataset.patch || "{}")); return; }
    const el = e.target.closest("[data-f]");
    if (el) S.list.goto(JSON.parse(el.dataset.f));
  });
})();
