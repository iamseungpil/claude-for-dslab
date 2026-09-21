/* 그래프. 전부 CSS 막대와 인라인 SVG다(외부 라이브러리·외부 요청 없음). 상담 파일럿의 static/js/charts.js에서
   hbars · stackRow · ci · legend 를 그대로 가져왔고, 한 장의 차트가 build 결과(JSON)만 보고 그려지도록 일반화했다.
   누를 수 있는 곳은 data-f(필터 patch)를 갖고, 클릭은 통계 탭이 받아 자료 탭을 연다. */
window.Site.charts = (function () {
  const S = window.Site, {esc, num, pct, fa} = S;
  const w = (v, max) => (max > 0 ? 100 * v / max : 0).toFixed(2) + "%";
  const BC = ["var(--b1)", "var(--b2)", "var(--b3)", "var(--b4)"];
  const SC = {ok: "var(--c3)", bad: "var(--c2)", mid: "var(--mark-fg)", warn: "var(--warn-fg)", "": "var(--c1)"};
  const color = (c, i) => SC[c] != null ? SC[c] : (c || BC[i % BC.length]);

  // rows: {label, value, n, color, patch, title, sel}. o.max = 막대가 꽉 차는 값(비율은 100).
  function hbars(rows, o) {
    o = o || {};
    const max = o.max || Math.max(1, ...rows.map((r) => r.value));
    return rows.map((r, i) => `<div class="hb${r.sel ? " sel" : ""}">`
      + `<span class="lb" ${r.patch ? fa(r.patch) : ""} title="${esc(r.title || r.label)}">${esc(r.label)}</span>`
      + `<span class="tr"><i style="width:${w(r.value, max)};background:${color(r.color, i)}" ${r.patch ? fa(r.patch) : ""} title="${esc(r.title || r.label)}"></i></span>`
      + `<span class="n">${esc(r.n != null ? r.n : num(r.value))}</span></div>`).join("");
  }
  // 묶은 막대: 한 항목에 계열 여러 개(모델 비교). rows: {label, values:[...], patches:[...]}
  function grouped(rows, series, o) {
    o = o || {};
    const max = o.max || Math.max(1, ...rows.flatMap((r) => r.values));
    return rows.map((r) => `<div class="hb"><span class="lb" title="${esc(r.label)}">${esc(r.label)}</span>`
      + `<span class="tr" style="height:auto;background:none;display:flex;flex-direction:column;gap:2px">`
      + r.values.map((v, i) => { const s = series[i] || {name: "계열 " + (i + 1)};
        return `<i style="position:relative;height:6px;width:${w(v, max)};background:${color(s.color, i)}" `
          + `${r.patches && r.patches[i] ? fa(r.patches[i]) : ""} title="${esc(s.name)} ${v}${o.unit || ""}"></i>`; }).join("")
      + `</span><span class="n">${r.values.map((v) => esc(String(v))).join(" · ")}${esc(o.unit || "")}</span></div>`).join("");
  }
  // 누적 막대 한 줄. segs: {v, color, patch, title, label}
  function stackRow(label, segs, tail) {
    const tot = segs.reduce((a, s) => a + s.v, 0);
    return `<div class="hb"><span class="lb" title="${esc(label)}">${esc(label)}</span><span class="stack">`
      + segs.map((s, i) => s.v ? `<i style="width:${pct(s.v, tot)}%;background:${color(s.color, i)}" ${s.patch ? fa(s.patch) : ""} title="${esc(s.title || s.label || "")}"></i>` : "").join("")
      + `</span><span class="n">${esc(tail || "")}</span></div>`;
  }
  const legend = (items) => `<span class="lg">${items.map(([t, c], i) => `<span><i style="background:${color(c, i)}"></i>${esc(t)}</span>`).join("")}</span>`;
  // 신뢰구간 SVG. rows: {label, point, lo, hi, n, patch, title}
  function ci(rows, o) {
    const W = 560, L = 150, R = 74, H = 22, top = 16, h = top + rows.length * H + 18;
    const x = (v) => L + (W - L - R) * Math.min(100, Math.max(0, v)) / 100;
    const grid = [0, 25, 50, 75, 100].map((v) => `<line class="ax" x1="${x(v)}" y1="${top - 6}" x2="${x(v)}" y2="${h - 16}"/><text x="${x(v)}" y="${h - 4}" text-anchor="middle">${v}%</text>`).join("");
    const body = rows.map((r, i) => {
      const y = top + i * H + H / 2, f = r.patch ? fa(r.patch) : "";
      return `<text class="lb" x="${L - 8}" y="${y + 4}" text-anchor="end" ${f}>${esc(r.label)}</text>`
        + `<line class="iv" x1="${x(r.lo)}" y1="${y}" x2="${x(r.hi)}" y2="${y}" ${f}><title>${esc(r.title || "")}</title></line>`
        + `<circle cx="${x(r.point)}" cy="${y}" r="4" ${f}><title>${esc(r.title || "")}</title></circle>`
        + `<text class="v" x="${W - R + 6}" y="${y + 4}">${r.point}%${r.n != null ? ` (${num(r.n)})` : ""}</text>`;
    }).join("");
    return `<svg class="ci" viewBox="0 0 ${W} ${h}" role="img" aria-label="${esc((o && o.label) || "신뢰구간")}">${grid}${body}</svg>`;
  }
  function table(cols, rows) {
    return `<div class="wrap"><table><thead><tr>${cols.map((c) => `<th>${esc(c)}</th>`).join("")}</tr></thead><tbody>`
      + rows.map((r) => `<tr ${r.patch ? fa(r.patch) : ""} ${r.patch ? 'style="cursor:pointer"' : ""}>`
        + r.cells.map((c) => `<td>${esc(c)}</td>`).join("") + `</tr>`).join("")
      + `</tbody></table></div>`;
  }

  /* 블록 하나(build가 만든 chart 객체) → HTML. 종류는 다섯뿐이고, 모르는 종류는 '그릴 수 없음'으로 적는다. */
  function render(ch) {
    if (!ch || !ch.kind) return "";
    const lg = ch.series ? legend(ch.series.map((s, i) => [s.name, s.color || BC[i % BC.length]])) : "";
    let body = "";
    if (ch.kind === "bars") body = hbars(ch.rows || [], {max: ch.max});
    else if (ch.kind === "grouped") body = grouped(ch.rows || [], ch.series || [], {max: ch.max, unit: ch.unit});
    else if (ch.kind === "ci") body = ci(ch.rows || [], {label: ch.label});
    else if (ch.kind === "stacked") body = (ch.rows || []).map((r) => stackRow(r.label, (r.segs || []), r.tail)).join("")
      + (ch.series ? `<p class="cap">${ch.series.map((s, i) => `<i class="sw" style="background:${color(s.color, i)}"></i> ${esc(s.name)}`).join(" &nbsp; ")}</p>` : "");
    else if (ch.kind === "table") body = table(ch.cols || [], ch.rows || []);
    else return `<p class="empty">그릴 수 없는 차트 종류: ${esc(ch.kind)}</p>`;
    return `<div class="cc"><h2>${esc(ch.title || "")}${lg}</h2>${body}${ch.cap ? `<p class="cap">${esc(ch.cap)}</p>` : ""}</div>`;
  }
  return {hbars, grouped, stackRow, legend, ci, table, render, BC, color};
})();
