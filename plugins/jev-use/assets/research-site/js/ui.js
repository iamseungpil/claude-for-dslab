/* 공용: 작은 도우미, 필터 바 컴포넌트, 탭·주차 셸. 상담 파일럿의 static/js/ui.js를 일반화한 것이다 —
   그쪽은 상수 표(플랫폼·대상·축)가 코드 안에 있었지만, 여기서는 전부 data/meta.json의 facets가 준다.
   필터 값은 쿼리스트링 그대로 들고 다니고(다중값은 쉼표), 필터 바는 한 번만 그린 뒤 sync만 부른다. */
window.Site = (function () {
  const $ = (id) => document.getElementById(id);
  const esc = (v) => String(v ?? "").replace(/[&<>"]/g, (c) => ({"&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;"}[c]));
  const num = (n) => Number(n || 0).toLocaleString();
  const pct = (n, d) => (d > 0 ? (n / d * 100) : 0).toFixed(1);
  const split = (raw) => (raw ? String(raw).split(",").map((v) => v.trim()).filter(Boolean) : []);
  // 누를 수 있는 것은 전부 data-f(JSON patch)만 갖는다. 클릭 처리는 각 탭이 위임으로 받는다.
  const fa = (patch) => `data-f="${esc(JSON.stringify(patch))}"`;
  const NUMRE = /^num_ge:(.+)$/;

  // 검색 입력(한글 IME 안전): 조합 중에는 적용하지 않고 입력 노드를 갈아 끼우지 않는다.
  function bindSearch(el, apply) {
    let composing = false, timer = null;
    const fire = () => { clearTimeout(timer); if (!composing) apply(el.value.trim()); };
    const schedule = () => { clearTimeout(timer); timer = setTimeout(fire, 350); };
    el.addEventListener("compositionstart", () => { composing = true; });
    el.addEventListener("compositionend", () => { composing = false; if (document.activeElement === el) schedule(); else fire(); });
    el.addEventListener("input", () => { if (!composing) schedule(); });
    el.addEventListener("keydown", (e) => { if (e.key === "Enter" && !e.isComposing && !composing) fire(); });
    el.addEventListener("blur", fire);
  }

  function banner(msg, kind) {
    const el = $("banner");
    el.hidden = !msg;
    el.className = kind === "info" ? "info" : "";
    el.innerHTML = msg ? `<span>${esc(msg)}</span><button class="x" title="닫기">×</button>` : "";
    if (msg) el.querySelector(".x").addEventListener("click", () => { el.hidden = true; });
  }

  /* 필터 바. facets(meta.json)만 보고 드롭다운·칩·검색창을 만든다.
     facet = {key, label, desc, group, scope, field, type:"enum"|"num_ge"|"text", multi, values:[[v,label,n]]}
     상태 F는 쿼리스트링 값 그대로. onApply(patch, mode) 는 페이지가 받는다. */
  class FilterBar {
    constructor(root, facets, onApply) {
      this.root = root; this.facets = facets; this.onApply = onApply;
      this.keys = facets.map((f) => f.key);
      this.byKey = Object.fromEntries(facets.map((f) => [f.key, f]));
      this.F = Object.fromEntries(this.keys.map((k) => [k, ""]));
      this.counts = {};
      const groups = [];
      for (const f of facets) {
        if (f.type === "text" || f.type === "num_ge") continue;
        let g = groups.find((x) => x.name === (f.group || "필터"));
        if (!g) groups.push(g = {name: f.group || "필터", id: "g" + groups.length, facets: []});
        g.facets.push(f);
      }
      this.groups = groups;
    }
    multi(k) { const f = this.byKey[k]; return !f || f.multi !== false; }
    read(qs) { for (const k of this.keys) this.F[k] = qs.get(k) || ""; }
    qs(extra) {
      const out = new URLSearchParams();
      for (const k of this.keys) if (this.F[k]) out.set(k, this.F[k]);
      for (const [k, v] of Object.entries(extra || {})) if (v) out.set(k, v);
      return out.toString().replace(/%2C/g, ",");
    }
    has(k, v) { return v === "" ? !this.F[k] : this.multi(k) ? split(this.F[k]).includes(v) : this.F[k] === v; }
    matches(patch) { return Object.entries(patch).every(([k, v]) => k in this.F && this.has(k, v)); }
    // mode: toggle(칩·드롭다운) · replace(프리셋·차트 — 그 값으로 바꾼다)
    apply(patch, mode = "toggle") {
      for (const [k, v] of Object.entries(patch)) {
        if (!(k in this.F)) continue;
        if (mode === "replace" || v === "") this.F[k] = v;
        else if (this.multi(k)) { const l = split(this.F[k]); this.F[k] = (l.includes(v) ? l.filter((x) => x !== v) : [...l, v]).join(","); }
        else this.F[k] = this.F[k] === v ? "" : v;
      }
    }
    clear() { for (const k of this.keys) this.F[k] = ""; }
    label(k, v) {
      const f = this.byKey[k];
      if (!f) return v;
      if (f.type === "text") return `${f.label} “${v}”`;
      if (f.type === "num_ge") return `${f.label} ≥ ${v}`;
      const hit = (f.values || []).find((x) => String(x[0]) === String(v));
      return `${f.label} ${hit ? hit[1] : v}`;
    }
    bits() {
      const out = [];
      for (const k of this.keys) for (const v of (this.multi(k) ? split(this.F[k]) : this.F[k] ? [this.F[k]] : []))
        out.push({k, v, label: this.label(k, v)});
      return out;
    }
    text() { return this.bits().map((b) => b.label).join(" × ") || "전체"; }
    build() {
      const texts = this.facets.filter((f) => f.type === "text");
      const nums = this.facets.filter((f) => f.type === "num_ge");
      const ck = (f, v, lab, n) => `<label class="ck" data-ck="${esc(f.key)}|${esc(v)}"><input type="checkbox" ${fa({[f.key]: v})}>${esc(lab)}<em>${n != null ? " " + num(n) : ""}</em></label>`;
      const pops = this.groups.map((g) => `<div class="pop" id="pop-${g.id}">` + g.facets.map((f) =>
        `<span class="g" title="${esc(f.desc || "")}">${esc(f.label)}</span>`
        + `<button ${fa({[f.key]: ""})}>전체</button>`
        + (f.values || []).map(([v, lab, n]) => ck(f, v, lab, n)).join("")).join("") + `</div>`);
      this.root.innerHTML =
        texts.map((f) => `<input type="search" id="f-${esc(f.key)}" placeholder="${esc(f.label)}">`).join("")
        + nums.map((f) => `<input type="number" min="0" id="f-${esc(f.key)}" placeholder="${esc(f.label)}" style="width:96px">`).join("")
        + this.groups.map((g, i) => `<span class="ddw"><button class="dd" data-dd="${g.id}">${esc(g.name)}</button>${pops[i]}</span>`).join("")
        + `<span id="fchips"></span><button id="f-clear" data-act="clear" hidden>지우기</button>`;
      const setH = () => {
        document.documentElement.style.setProperty("--hd-h", document.querySelector("header").offsetHeight + "px");
        document.documentElement.style.setProperty("--fbar-h", getComputedStyle(this.root).position === "sticky" ? this.root.offsetHeight + "px" : "0px");
      };
      const ro = new ResizeObserver(setH);
      ro.observe(this.root); ro.observe(document.querySelector("header"));
      setH();
      this.root.addEventListener("click", (e) => {
        const dd = e.target.closest("[data-dd]");
        if (dd) { const p = $("pop-" + dd.dataset.dd), open = p.classList.contains("on"); this.closePops(); p.classList.toggle("on", !open); return; }
        if (e.target.closest("[data-act=clear]")) { this.clear(); this.onApply(null, "cleared"); return; }
        const el = e.target.closest("[data-f]");
        if (!el) return;
        if (el.type !== "checkbox") this.closePops();   // 체크박스는 여러 개 고르도록 팝업을 열어 둔다
        this.onApply(JSON.parse(el.dataset.f), "toggle");
      });
      document.addEventListener("click", (e) => { if (!e.target.closest(".ddw")) this.closePops(); });
      for (const f of texts) bindSearch($("f-" + f.key), (v) => { if (v !== this.F[f.key]) this.onApply({[f.key]: v}, "replace"); });
      for (const f of nums) {
        const el = $("f-" + f.key);
        el.addEventListener("change", () => { const v = el.value.trim(); if (v !== this.F[f.key]) this.onApply({[f.key]: v}, "replace"); });
      }
    }
    setCounts(counts) { this.counts = counts || {}; }
    sync() {
      for (const b of this.root.querySelectorAll(".pop [data-f]")) {
        const on = this.matches(JSON.parse(b.dataset.f));
        if (b.type === "checkbox") { b.checked = on; b.parentNode.classList.toggle("on", on); }
        else b.classList.toggle("on", on);
      }
      // 값에 따옴표·괄호가 들어갈 수 있어 선택자로 찾지 않고 한 번 훑는다 (CSS.escape가 없는 환경도 있다).
      for (const el of this.root.querySelectorAll("[data-ck]")) {
        const i = el.dataset.ck.indexOf("|");
        const n = (this.counts[el.dataset.ck.slice(0, i)] || {})[el.dataset.ck.slice(i + 1)];
        const em = el.querySelector("em");
        if (em) em.textContent = n ? " " + num(n) : "";
      }
      for (const g of this.groups) {
        const cap = g.facets.filter((f) => this.F[f.key]).map((f) => split(this.F[f.key]).map((v) => this.label(f.key, v)).join(", ")).join(" · ");
        const b = this.root.querySelector(`[data-dd="${g.id}"]`);
        b.textContent = cap ? `${g.name} · ${cap}` : g.name;
        b.title = cap || (g.facets.map((f) => f.label).join(" · "));
        b.classList.toggle("on", !!cap);
      }
      const bits = this.bits();
      $("fchips").innerHTML = bits.map((b) => `<span class="fc">${esc(b.label)}<button ${fa({[b.k]: b.v})} title="이 필터 제거">×</button></span>`).join("");
      $("f-clear").hidden = !bits.length;
      for (const f of this.facets) {
        if (f.type !== "text" && f.type !== "num_ge") continue;
        const el = $("f-" + f.key);
        if (el && document.activeElement !== el && el.value !== this.F[f.key]) el.value = this.F[f.key];
      }
    }
    closePops() { let was = false; for (const p of document.querySelectorAll(".pop.on")) { p.classList.remove("on"); was = true; } return was; }
  }

  /* ── 셸: 데이터 적재, 탭, 주차 선택, 주소 ── */
  const S = {$, esc, num, pct, split, fa, bindSearch, banner, FilterBar, NUMRE,
             meta: null, rows: [], stats: null, live: null, tab: "data", week: "", data: {}};

  S.writeUrl = function (push) {
    const qs = S.list ? S.list.qsWith() : new URLSearchParams();
    if (S.tab !== "data") qs.set("tab", S.tab);
    if (S.week) qs.set("week", S.week);
    const url = location.pathname + (qs.toString() ? "?" + qs.toString().replace(/%2C/g, ",") : "");
    if (push) history.pushState({}, "", url); else history.replaceState({}, "", url);
  };
  S.setTab = function (t, silent) {
    S.tab = t;
    for (const b of document.querySelectorAll("#tabs button")) b.classList.toggle("on", b.dataset.tab === t);
    $("tab-data").hidden = t !== "data";
    $("tab-stats").hidden = t !== "stats";
    $("tab-live").hidden = t !== "live";
    if (t === "stats") S.stats_render();
    if (t === "live") { S.live_render(); if (S.live_start) S.live_start(); }
    if (t === "data") S.list.render();
    if (!silent) S.writeUrl();
  };
  S.setWeek = function (w, silent) {
    S.week = w;
    for (const b of document.querySelectorAll("#weeksel button")) b.classList.toggle("on", (b.dataset.week || "") === w);
    S.list.onWeek();
    if (S.tab === "stats") S.stats_render();
    if (S.tab === "live") S.live_render();
    if (!silent) S.writeUrl();
  };

  async function load(name, optional) {
    try {
      const r = await fetch("data/" + name + "?v=" + (window.__BUILD || ""));
      if (!r.ok) throw new Error("HTTP " + r.status);
      return await r.json();
    } catch (e) {
      if (!optional) banner(`data/${name} 을 불러오지 못했습니다 (${e.message})`);
      return null;
    }
  }

  S.boot = async function () {
    const meta = await load("meta.json");
    if (!meta) return;
    S.meta = meta;
    document.title = meta.title || "연구판";
    $("site-title").textContent = meta.title || "연구판";
    $("upd").textContent = meta.built_at ? "갱신 " + meta.built_at : "";
    $("archlinks").innerHTML = (meta.links || []).map((l) => `<a href="${esc(l.href)}">${esc(l.label)}</a>`).join(" · ");
    $("weeksel").innerHTML = `<button data-week="">전체</button>`
      + (meta.weeks || []).map((w) => `<button data-week="${esc(w.id)}" title="${esc(w.range || "")}">${esc(w.label)}`
        + (w.legacy ? `<small>${esc(w.legacy)}</small>` : "") + `</button>`).join("");
    $("weeksel").addEventListener("click", (e) => { const b = e.target.closest("button"); if (b) S.setWeek(b.dataset.week || ""); });
    $("tabs").addEventListener("click", (e) => { const b = e.target.closest("button"); if (b) S.setTab(b.dataset.tab); });
    const qs = new URLSearchParams(location.search);
    S.week = qs.get("week") || "";
    for (const b of document.querySelectorAll("#weeksel button")) b.classList.toggle("on", (b.dataset.week || "") === S.week);
    const [rows, stats, live, reports] = await Promise.all(
      [load("rows.json"), load("stats.json", true), load("live.json", true), load("reports.json", true)]);
    S.rows = (rows && rows.rows) || [];
    S.stats = stats; S.live = live;
    // 얼린 보고서(스냅샷)는 그때의 자료만 보여 주고 실시간 갱신을 하지 않는다.
    S.frozen = !!(meta.frozen_at);
    if (S.frozen) {
      $("frozen").hidden = false;
      $("frozen").textContent = `이 화면은 ${meta.frozen_at} 에 얼린 보고서입니다 — 그때의 자료만 들어 있고 실시간 갱신을 하지 않습니다.`;
    }
    S.reports = (reports && reports.reports) || [];
    if (S.reports.length) {
      $("reportsw").hidden = false;
      $("reportspop").innerHTML = `<span class="d">주차가 끝날 때 얼려 둔 보고서입니다.</span>`
        + S.reports.map((r) => `<a class="ck" href="${esc(r.path)}">${esc(r.label)}<em> ${esc(r.frozen_at || "")}</em></a>`).join("")
        + (S.frozen ? `<a class="ck" href="/">지금 보고서로 →</a>` : "");
      $("reportsbtn").addEventListener("click", () => $("reportspop").classList.toggle("on"));
      document.addEventListener("click", (e) => { if (!e.target.closest("#reportsw")) $("reportspop").classList.remove("on"); });
    }
    S.list.init(qs);
    S.setTab(qs.get("tab") || "stats", true);
    S.writeUrl();
    window.addEventListener("popstate", () => {
      const q = new URLSearchParams(location.search);
      S.week = q.get("week") || "";
      for (const b of document.querySelectorAll("#weeksel button")) b.classList.toggle("on", (b.dataset.week || "") === S.week);
      S.list.readUrl(q);
      S.setTab(q.get("tab") || "data", true);
    });
  };
  return S;
})();
