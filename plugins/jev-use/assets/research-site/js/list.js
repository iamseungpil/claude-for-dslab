/* 자료 탭 = 과제 행렬. 한 줄이 한 과제(주차·벤치 기준), 한 칸이 한 모델(+스캐폴드)의 결과다.
   상담 파일럿 static/js/list.js에서 가져온 것: 필터→URL→목록의 단일 진입점, 페이징, j/k·Enter·Esc 키 조작,
   검색어 <mark> 강조, 목록↔상세 전환. 바뀐 것: 서버 API 대신 data/rows.json 하나를 메모리에서 거르고,
   목록이 아니라 행렬이라 '행 하나 + 칸 하나'가 현재 위치다. */
(function () {
  const S = window.Site, {$, esc, num, pct, fa, split} = S;
  const PAGE = 150;
  let facets = [], rowFacets = [], cellFacets = [], fb = null;
  let view = [], idx = 0, cur = null, shown = PAGE, mode = "list", cols = [], allCols = [], sortKey = "";

  const F = () => fb.F;
  const arr = (v) => (Array.isArray(v) ? v : v == null || v === "" ? [] : [v]);
  const focusKey = () => (S.meta.matrix && S.meta.matrix.focus_facet) || "focus";
  const focusModel = () => F()[focusKey()] || "";

  function matchFacet(f, val, raw) {
    if (f.type === "num_ge") return Number(val || 0) >= Number(raw);
    if (f.type === "text") {
      const t = raw.toLowerCase();
      return (f.fields || [f.field]).some((k) => String((val && val[k]) ?? "").toLowerCase().includes(t));
    }
    const want = split(raw);
    if (!want.length) return true;
    const have = arr(val).map(String);
    return want.some((v) => have.includes(v));
  }
  function cellOk(c) {
    if (!c) return false;
    for (const f of cellFacets) {
      const raw = F()[f.key];
      if (!raw) continue;
      if (!matchFacet(f, f.type === "text" ? c : c[f.field], raw)) return false;
    }
    return true;
  }
  function rowOk(r) {
    if (S.week && r.week !== S.week) return false;
    for (const f of rowFacets) {
      const raw = F()[f.key];
      if (!raw) continue;
      if (!matchFacet(f, f.type === "text" ? r : r[f.field], raw)) return false;
    }
    const fm = focusModel();
    const anyCell = cellFacets.some((f) => F()[f.key]);
    if (!fm && !anyCell) return true;
    const cs = fm ? [r.cells[fm]] : Object.values(r.cells);
    return cs.some((c) => c && cellOk(c));
  }
  function recompute() {
    view = S.rows.filter(rowOk);
    if (sortKey) view = view.slice().sort((a, b) => (Number(b[sortKey] || 0) - Number(a[sortKey] || 0)));
    if (idx >= view.length) idx = 0;
    shown = PAGE;
  }
  // 드롭다운 옆 숫자 = 지금 필터에서 그 값을 켜면 남는 행 수가 아니라, 지금 걸러진 행 안에서의 빈도다.
  function counts() {
    const out = {};
    for (const f of rowFacets) {
      if (f.type !== "enum") continue;
      const m = out[f.key] = {};
      for (const r of view) for (const v of arr(r[f.field])) m[v] = (m[v] || 0) + 1;
    }
    for (const f of cellFacets) {
      if (f.type !== "enum") continue;
      const m = out[f.key] = {}, fm = focusModel();
      for (const r of view) for (const [mm, c] of Object.entries(r.cells)) {
        if (fm && mm !== fm) continue;
        for (const v of arr(c[f.field])) m[v] = (m[v] || 0) + 1;
      }
    }
    return out;
  }

  const outMeta = (o) => (S.meta.matrix.outcomes || {})[o] || {cls: "", short: o};
  const benchKey = () => S.meta.matrix.bench_facet || "";

  // 벤치 전환 — 시험지가 다르면 모델도 과제도 다르다. 섞어 놓으면 빈 칸만 가득한 표가 된다.
  function renderBenchBar() {
    const bk = benchKey();
    if (!bk) return;
    const f = fb.byKey[bk];
    const vals = (f && f.values) || [];
    $("benchbar").innerHTML = `<span class="seglbl">시험지</span><span class="seg">`
      + vals.map(([v, lab, n]) => `<button ${fa({[bk]: v})} data-seg="1" class="${F()[bk] === v ? "on" : ""}">${esc(lab)} <span style="opacity:.7">${num(n)}</span></button>`).join("")
      + `<button ${fa({[bk]: ""})} data-seg="1" class="${F()[bk] ? "" : "on"}">전부</button></span>`
      + `<span class="seglbl">${F()[bk] ? "이 시험지를 푼 모델만 열로 나옵니다" : "시험지를 고르면 그 모델만 열로 나옵니다"}</span>`;
  }
  // 지금 걸러진 줄에 시행이 하나라도 있는 열만 그린다 (빈 열은 아예 만들지 않는다).
  function colsShown() {
    const live = new Set();
    for (const r of view) for (const m of Object.keys(r.cells)) live.add(m);
    const out = cols.filter((c) => live.has(c));
    return out.length ? out : allCols.filter((c) => live.has(c));
  }
  function renderTiles() {
    const ps = S.meta.presets || [];
    if (!ps.length) { $("tiles").innerHTML = ""; return; }
    const base = S.rows.filter((r) => (!S.week || r.week === S.week) && (!F()[benchKey()] || String(r[fb.byKey[benchKey()].field]) === F()[benchKey()]));
    $("tiles").innerHTML = `<div class="tg">` + ps.map((p) => {
      const key = Object.keys(p.patch)[0], val = p.patch[key], f = fb.byKey[key];
      const n = !f ? 0 : base.filter((r) => arr(r[f.field]).map(String).includes(String(val))).length;
      const on = fb.matches(p.patch);
      return `<button class="tile${on ? " on" : ""}" data-pre="${esc(p.id)}" title="${esc(p.desc || "누르면 이 과제만 봅니다")}">`
        + `<span class="v">${num(n)}</span><span class="k">${esc(p.label)}</span>`
        + `<span class="s">${esc(p.desc || "누르면 이 과제만")}</span></button>`;
    }).join("") + `</div>`;
  }
  function renderLegend() {
    const om = S.meta.matrix.outcomes || {};
    const seen = new Set();
    for (const r of view.slice(0, 400)) for (const c of Object.values(r.cells)) seen.add(c.o);
    const items = Object.entries(om).filter(([k]) => seen.has(k));
    $("legend").innerHTML = `<b style="font-weight:600;color:var(--fg)">칸 읽는 법</b>`
      + items.map(([k, v]) => `<span class="cel ${v.cls}" style="cursor:default">${esc(v.short || k)}</span><span>${esc(k)}</span>`).join("")
      + `<span class="cel na" style="cursor:default">·</span><span>이 조건에는 시행 없음</span>`;
  }
  function hl(text, term) {
    if (!term) return esc(text);
    const re = new RegExp(term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi");
    let out = "", last = 0, m;
    while ((m = re.exec(text))) { out += esc(text.slice(last, m.index)) + "<mark>" + esc(m[0]) + "</mark>"; last = m.index + m[0].length; }
    return out + esc(text.slice(last));
  }
  const searchTerm = () => { const f = facets.find((x) => x.type === "text"); return f ? F()[f.key] : ""; };

  function renderMatrix() {
    const wrap = $("matwrap"), M = S.meta.matrix;
    const term = searchTerm();
    const extra = M.row_columns || [];
    if (!view.length) {
      wrap.innerHTML = `<p class="empty" style="padding:16px 4px">이 조건에 맞는 과제가 없습니다. 필터를 지우거나 주차를 넓혀 보세요.</p>`;
      return;
    }
    const cols = colsShown();
    const head = `<tr><th>과제</th>` + cols.map((c) => `<th title="${esc(c)}">${esc(shortCol(c))}</th>`).join("")
      + extra.map((c) => `<th data-sort="${esc(c.field)}" title="누르면 이 열로 정렬">${esc(c.label)}</th>`).join("") + `</tr>`;
    const body = view.slice(0, shown).map((r, i) => {
      const cells = cols.map((c) => {
        const cl = r.cells[c];
        if (!cl) return `<td><span class="cel na" title="이 조건에는 이 과제의 시행이 없습니다">·</span></td>`;
        const om = outMeta(cl.o);
        const on = cur && cur.row === r && cur.model === c;
        return `<td><span class="cel ${om.cls}${on ? " cur" : ""}" data-cell="${esc(c)}" data-row="${esc(r.k)}" `
          + `title="${esc(c + " · " + cl.o + (cl.e ? " · " + cl.e.slice(0, 90) : ""))}">${esc(om.short || cl.o)}</span></td>`;
      }).join("");
      return `<tr data-i="${i}" class="${i === idx ? "cur" : ""}"><td class="tk"><b>${hl(r.title || r.task_short || r.task, term)}</b>`
        + `<span class="sub">${hl(r.task_short || r.task, term)}</span></td>${cells}`
        + extra.map((c) => `<td>${esc(String(r[c.field] ?? ""))}</td>`).join("") + `</tr>`;
    }).join("");
    wrap.innerHTML = `<table><thead>${head}</thead><tbody>${body}</tbody></table>`
      + (view.length > shown ? `<button id="more">더 불러오기 (${num(shown)} / ${num(view.length)})</button>` : `<p class="note" style="padding:0 0 4px">${num(view.length)}개 과제 전부 표시</p>`);
    const b = $("more");
    if (b) b.addEventListener("click", () => { shown += PAGE; renderMatrix(); });
  }
  const shortCol = (c) => (S.meta.matrix.col_labels || {})[c] || c;

  function renderDetail() {
    if (!cur) { $("record").hidden = true; return; }
    const r = cur.row, c = r.cells[cur.model];
    $("r-model").textContent = shortCol(cur.model);
    $("r-out").textContent = c ? c.o : "시행 없음";
    $("r-task").textContent = `${r.repo || ""} · ${r.lang || ""} · 고칠 파일 ${r.files || "?"}개`;
    $("r-title").innerHTML = `<b>${esc(r.task)}</b><br>${esc(r.title || "(문제 설명 요약 없음)")}`
      + `<br><span class="meta">${esc(r.week_label || r.week)} · ${esc(r.bench)} · 이 과제를 푼 모델 ${r.solvers} / ${r.n_models}`
      + (r.cmp && r.cmp.length ? ` · ${esc(r.cmp.join(", "))}` : "") + `</span>`;
    const raw = c && c.h;
    $("r-raw").hidden = !raw;
    if (raw) $("r-raw").href = raw;
    const names = S.meta.kv_labels || [];
    const kv = ((c && c.kv) || []).map(([i, v]) => [names[i] ?? i, v]);
    $("r-kv").innerHTML = kv.filter(([, v]) => v != null && v !== "")
      .map(([k, v]) => `<span class="k">${esc(k)}</span><span>${esc(String(v))}</span>`).join("")
      || `<span class="k">기록</span><span>이 시행에는 남은 사실이 없습니다</span>`;
    $("r-err").textContent = (c && c.e) || "기록 없음 (오류 줄이 남지 않았습니다)";
    $("r-others").innerHTML = colsShown().filter((m) => r.cells[m]).map((m) => {
      const cl = r.cells[m], om = cl ? outMeta(cl.o) : {cls: "na", short: "·"};
      return `<button class="o${m === cur.model ? " cur" : ""}" data-cell="${esc(m)}" data-row="${esc(r.k)}">`
        + `<b>${esc(shortCol(m))}</b><span class="cel ${om.cls}">${esc(cl ? cl.o : "시행 없음")}</span></button>`;
    }).join("");
    $("record").hidden = false;
  }

  function setMode(m, silent) {
    mode = m;
    $("m-list").classList.toggle("on", m === "list");
    $("m-detail").classList.toggle("on", m === "detail");
    $("matwrap").hidden = m !== "list";
    $("rnav").hidden = m !== "detail";
    render();
    if (!silent) S.writeUrl();
  }
  function openCell(rowKey, model, silent) {
    const i = view.findIndex((r) => r.k === rowKey);
    if (i < 0) return;
    idx = i;
    cur = {row: view[i], model};
    setMode("detail", silent);
  }
  function move(step) {
    if (!view.length) return;
    idx = Math.min(Math.max(idx + step, 0), view.length - 1);
    if (mode === "detail") {
      const r = view[idx], m = r.cells[cur && cur.model] ? cur.model : (cols.find((c) => r.cells[c]) || cols[0]);
      cur = {row: r, model: m};
      S.writeUrl();
    } else if (idx >= shown) shown += PAGE;
    render();
    const el = $("matwrap").querySelector("tr.cur");
    if (el) el.scrollIntoView({block: "nearest"});
  }

  function render() {
    $("ltitle").textContent = "과제 · " + num(view.length) + "개";
    const total = S.rows.filter((r) => !S.week || r.week === S.week).length;
    $("counter").textContent = `${num(view.length)} / ${num(total)} 과제`
      + (mode === "detail" && view.length ? ` · ${idx + 1}번째` : "") + (fb.bits().length ? ` · ${fb.text()}` : "");
    renderBenchBar();
    renderTiles();
    if (mode === "list") { renderLegend(); renderMatrix(); } else renderDetail();
    $("legend").hidden = mode !== "list";
    $("record").hidden = mode !== "detail" || !cur;
  }
  function applyAndShow(patch, m) {
    if (patch) fb.apply(patch, m); // null = 지우기 (FilterBar가 이미 비웠다)
    recompute();
    fb.setCounts(counts());
    fb.sync();
    S.writeUrl();
    if (mode === "detail" && (!cur || !view.some((r) => r.k === cur.row.k))) setMode("list", true);
    render();
  }

  function renderColPop() {
    $("colpop").innerHTML = `<span class="d">행렬에 보일 모델 열입니다. 끄면 열만 숨고 필터에는 영향이 없습니다.</span>`
      + allCols.map((c) => `<label class="ck${cols.includes(c) ? " on" : ""}"><input type="checkbox" data-col="${esc(c)}" ${cols.includes(c) ? "checked" : ""}>${esc(shortCol(c))}</label>`).join("");
  }

  function onKey(e) {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    if (S.tab !== "data") return;
    if (e.key === "Escape" && fb.closePops()) return;
    const el = document.activeElement;
    if (el && (el.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName))) return;
    if (e.key === "j" || e.key === "ArrowDown") move(1);
    else if (e.key === "k" || e.key === "ArrowUp") move(-1);
    else if (e.key === "Enter" && mode === "list" && view[idx]) {
      const r = view[idx];
      openCell(r.k, focusModel() && r.cells[focusModel()] ? focusModel() : (cols.find((c) => r.cells[c]) || cols[0]));
    } else if (e.key === "Escape") setMode("list");
    else return;
    e.preventDefault();
  }

  S.list = {
    init(qs) {
      facets = S.meta.facets || [];
      rowFacets = facets.filter((f) => f.scope !== "cell" && f.key !== focusKey());
      cellFacets = facets.filter((f) => f.scope === "cell");
      allCols = S.meta.matrix.columns || [];
      cols = allCols.slice(0, S.meta.matrix.default_columns || allCols.length);
      fb = new S.FilterBar($("fbar"), facets, (patch, m) => applyAndShow(patch, m === "cleared" ? "toggle" : m));
      fb.read(qs);
      // 첫 진입은 시험지 하나를 골라 둔다 — 섞어 놓으면 빈 칸만 가득한 표가 먼저 보인다.
      const bk = benchKey(), db = S.meta.matrix.default_bench;
      if (bk && db && !qs.has(bk)) fb.F[bk] = db;
      fb.build();
      renderColPop();
      recompute();
      fb.setCounts(counts());
      fb.sync();
      const rid = qs.get("r");
      if (rid) { const [rk, mm] = rid.split("||"); openCell(rk, mm, true); }
      document.addEventListener("keydown", onKey);
      document.addEventListener("click", (e) => {
        if (S.tab !== "data") return;
        const cell = e.target.closest("[data-cell]");
        if (cell) { openCell(cell.dataset.row || (cur && cur.row.k), cell.dataset.cell); return; }
        const pre = e.target.closest("[data-pre]");
        if (pre) {
          const p = (S.meta.presets || []).find((x) => x.id === pre.dataset.pre);
          if (p) { for (const k of Object.keys(p.patch)) fb.F[k] = ""; applyAndShow(fb.matches(p.patch) ? {} : p.patch, "replace"); }
          return;
        }
        const seg = e.target.closest("[data-seg]");   // 벤치 전환은 그 값으로 바꾼다(토글이 아니다)
        if (seg) { applyAndShow(JSON.parse(seg.dataset.f), "replace"); return; }
        const sort = e.target.closest("[data-sort]");
        if (sort) { sortKey = sortKey === sort.dataset.sort ? "" : sort.dataset.sort; recompute(); render(); return; }
        const tr = e.target.closest("#matwrap tbody tr");
        if (tr) {
          const r = view[Number(tr.dataset.i)];
          if (r) openCell(r.k, focusModel() && r.cells[focusModel()] ? focusModel() : (cols.find((c) => r.cells[c]) || cols[0]));
        }
      });
      $("colpop").addEventListener("change", (e) => {
        const c = e.target.dataset.col;
        if (!c) return;
        cols = e.target.checked ? allCols.filter((x) => cols.includes(x) || x === c) : cols.filter((x) => x !== c);
        renderColPop(); render();
      });
      $("colbtn").addEventListener("click", () => { $("colpop").hidden = !$("colpop").hidden; });
      $("m-list").addEventListener("click", () => setMode("list"));
      $("m-detail").addEventListener("click", () => { if (!cur && view.length) { const r = view[idx]; cur = {row: r, model: cols.find((c) => r.cells[c]) || cols[0]}; } setMode("detail"); });
      render();   // 다른 탭에서 시작해도 행렬은 미리 그려 둔다
      $("r-prev").addEventListener("click", () => move(-1));
      $("r-next").addEventListener("click", () => move(1));
    },
    // 통계 탭의 막대 클릭 → 그 조건으로 자료 탭을 연다.
    goto(patch) {
      fb.clear();
      fb.apply(patch || {}, "replace");
      const bk = benchKey();
      if (bk && !fb.F[bk]) {   // 시험지를 안 적어 준 조건은 맞는 줄이 가장 많은 시험지로 맞춘다
        recompute();
        const c = {};
        for (const r of view) c[r[fb.byKey[bk].field]] = (c[r[fb.byKey[bk].field]] || 0) + 1;
        const top = Object.entries(c).sort((a, b) => b[1] - a[1])[0];
        if (top) fb.F[bk] = top[0];
      }
      setMode("list", true);
      cur = null;
      applyAndShow(null, "replace");
      S.setTab("data");
    },
    // 통계·주차 카드의 '대표 사례' 링크 — 그 사례 하나를 바로 연다.
    openCase(k, model, patch) {
      fb.clear();
      fb.apply(patch || {}, "replace");
      const bk = benchKey();
      if (bk && !fb.F[bk]) fb.F[bk] = String(k).split("|")[1] || "";
      recompute();
      fb.setCounts(counts()); fb.sync();
      if (view.some((r) => r.k === k)) openCell(k, model, true);
      else { cur = null; setMode("list", true); }
      S.writeUrl();
      render();
      S.setTab("data");
    },
    onWeek() { recompute(); fb.setCounts(counts()); fb.sync(); render(); },
    readUrl(qs) { fb.read(qs); recompute(); fb.setCounts(counts()); fb.sync(); const rid = qs.get("r"); if (rid) { const [rk, mm] = rid.split("||"); openCell(rk, mm, true); } else setMode("list", true); },
    qsWith() {
      const q = new URLSearchParams(fb.qs());
      if (mode === "detail" && cur) q.set("r", cur.row.k + "||" + cur.model);
      return q;
    },
    render,
  };
})();
