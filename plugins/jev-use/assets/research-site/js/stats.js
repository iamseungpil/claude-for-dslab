/* 통계 탭. 블록 하나 = 질문 하나다: 쉬운 말 질문 · 차트 · 한 줄 결론 · 상태 배지(확정/미확인/철회/진행).
   숫자는 전부 build 단계에서 파일을 세어 넣은 것이고, 자료가 없으면 블록 자리에 '자료 없음'과 찾은 경로를 적는다.
   막대를 누르면 그 조건으로 자료 탭이 열린다(Site.list.goto) — 상담 파일럿의 '차트 → 목록'과 같은 규칙이다. */
(function () {
  const S = window.Site, {$, esc, num} = S;
  const ST = {ok: ["확정", "ok"], un: ["미확인", "un"], rt: ["철회", "rt"], run: ["진행 중", "run"]};

  function block(b) {
    const [label, cls] = ST[b.status] || ST.un;
    const head = `<div class="qh"><span class="qq">${esc(b.question)}</span><span class="st ${cls}" title="${esc(b.status_note || "")}">${esc(b.status_label || label)}</span>`
      + (b.week_label ? `<span class="tag">${esc(b.week_label)}</span>` : "") + `</div>`;
    if (b.missing) {
      return `<section class="qb">${head}<div class="miss">자료 없음 — 이 블록이 찾은 경로:<br>`
        + (b.missing.paths || []).map((p) => `<code>${esc(p)}</code>`).join("<br>")
        + (b.missing.why ? `<br>${esc(b.missing.why)}` : "") + `</div></section>`;
    }
    const chart = S.charts.render(b.chart);
    const go = b.go ? `<p class="note"><button class="tb" ${S.fa(b.go)}>이 조건으로 자료 보기 →</button></p>` : "";
    return `<section class="qb">${head}${chart || `<p class="empty">차트 없음</p>`}`
      + (b.takeaway ? `<p class="tk">${esc(b.takeaway)}</p>` : "")
      + (b.note ? `<p class="note">${esc(b.note)}</p>` : "") + go + `</section>`;
  }

  S.stats_render = function () {
    const wrap = $("statswrap");
    if (!S.stats) { wrap.innerHTML = `<section><p class="miss">자료 없음 — <code>data/stats.json</code> 을 읽지 못했습니다.</p></section>`; return; }
    const blocks = (S.stats.blocks || []).filter((b) => !S.week || !b.week || b.week === S.week);
    wrap.innerHTML = `<p class="note" style="margin:8px 2px">질문 ${num(blocks.length)}개 · 숫자는 빌드 때 파일에서 직접 센 값입니다`
      + (S.stats.built_at ? ` · 갱신 ${esc(S.stats.built_at)}` : "") + `</p>`
      + (blocks.length ? blocks.map(block).join("") : `<section><p class="empty">이 주차에 해당하는 질문이 없습니다.</p></section>`);
  };
  document.addEventListener("click", (e) => {
    if (S.tab !== "stats") return;
    const el = e.target.closest("[data-f]");
    if (!el) return;
    S.list.goto(JSON.parse(el.dataset.f));
  });
})();
