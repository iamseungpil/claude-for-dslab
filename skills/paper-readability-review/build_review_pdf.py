#!/usr/bin/env python3
"""build_review_pdf.py — Paper Readability Review PDF builder.

Usage:
    python3 build_review_pdf.py \
        --input paper.pdf \
        --annotations annotations.json \
        --output paper_review.pdf

annotations.json schema (see SKILL.md for full doc).
"""
from __future__ import annotations

import argparse
import json
import os
import sys
import urllib.request
from pathlib import Path
from typing import Any

try:
    import fitz  # PyMuPDF
except ImportError:
    sys.exit("ERROR: PyMuPDF not installed. Run: pip install pymupdf")


# Constants
MARGIN_W = 340
PAGE_W_ORIG = 612
PAGE_H = 792
TOP_Y = 56
BOTTOM_Y = 770

DEFAULT_FONTFILE = os.path.expanduser("~/.fonts/NanumGothic.ttf")
NANUMGOTHIC_URL = (
    "https://github.com/google/fonts/raw/main/ofl/nanumgothic/"
    "NanumGothic-Regular.ttf"
)
FONT_ALIAS = "kor"

COLORS: dict[str, dict[str, Any]] = {
    "content":   {"hl": (1.00, 0.65, 0.65), "fill": (1.00, 0.93, 0.93), "label": "내용"},
    "structure": {"hl": (0.55, 0.80, 1.00), "fill": (0.90, 0.95, 1.00), "label": "구조"},
    "sentence":  {"hl": (1.00, 0.88, 0.40), "fill": (1.00, 0.97, 0.82), "label": "문장"},
}

PRIORITY_LABEL = {"highest": "★ 최우선", "high": "▲ 중요", "normal": None}
PRIORITY_COLOR = {
    "highest": (0.85, 0.15, 0.15),
    "high":    (0.85, 0.45, 0.05),
    "normal":  (0.5, 0.5, 0.5),
}
PRIORITY_RANK = {"highest": 0, "high": 1, "normal": 2}


def ensure_font(fontfile: str) -> str:
    if fontfile and Path(fontfile).is_file():
        return fontfile
    target = Path(DEFAULT_FONTFILE)
    if target.is_file():
        return str(target)
    target.parent.mkdir(parents=True, exist_ok=True)
    print(f"[font] downloading NanumGothic → {target}")
    urllib.request.urlretrieve(NANUMGOTHIC_URL, target)
    return str(target)


def estimate_text_lines(text: str, fontsize: float, body_width: float) -> int:
    char_w = fontsize * 0.95
    chars_per_line = max(1, int(body_width / char_w))
    n = 0
    for line in (text or "").split("\n"):
        n += max(1, (len(line) + chars_per_line - 1) // chars_per_line)
    return n


def card_height(diagnosis: str, alt: str, fontsize: float, body_width: float) -> float:
    line_h = fontsize * 1.32
    n_lines = (
        estimate_text_lines(diagnosis, fontsize, body_width)
        + 1
        + estimate_text_lines("→ " + alt, fontsize, body_width)
    )
    pad = 5
    header = 18
    return header + 2 + n_lines * line_h + 2 * pad


def fit_card_to_slot(diagnosis: str, alt: str, slot_h: float,
                     body_width: float = 290.0,
                     base_fontsize: float = 8.0) -> tuple[float, float]:
    for fs in [base_fontsize, 7.5, 7.0, 6.5]:
        h = card_height(diagnosis, alt, fs, body_width)
        if h <= slot_h - 4:
            return fs, h
    return 6.5, card_height(diagnosis, alt, 6.5, body_width)


def draw_card(page, y_top: float, height: float, fontsize: float,
              category: str, priority: str,
              diagnosis: str, alt: str, font: str, fontfile: str) -> None:
    color = COLORS[category]
    label = color["label"]
    fill = color["fill"]
    hl = color["hl"]

    x0 = PAGE_W_ORIG + 12
    x1 = PAGE_W_ORIG + MARGIN_W - 12

    label_rect = fitz.Rect(x0, y_top, x0 + 38, y_top + 16)
    page.draw_rect(label_rect, color=hl, fill=hl, width=0)
    page.insert_textbox(label_rect, label, fontsize=9.5, color=(0, 0, 0),
                        align=fitz.TEXT_ALIGN_CENTER,
                        fontname=font, fontfile=fontfile)

    pri_label = PRIORITY_LABEL.get(priority)
    if pri_label:
        pri_rect = fitz.Rect(x0 + 42, y_top, x1, y_top + 16)
        page.insert_textbox(pri_rect, pri_label, fontsize=8.5,
                            color=PRIORITY_COLOR[priority],
                            align=fitz.TEXT_ALIGN_LEFT,
                            fontname=font, fontfile=fontfile)

    body_top = y_top + 18
    body_rect = fitz.Rect(x0, body_top, x1, y_top + height)
    page.draw_rect(body_rect, color=hl, fill=fill, width=0.6)

    pad = 5
    text_rect = fitz.Rect(x0 + pad, body_top + pad,
                          x1 - pad, y_top + height - pad)
    body_text = f"{diagnosis}\n\n→ {alt}"
    page.insert_textbox(text_rect, body_text, fontsize=fontsize,
                        color=(0.05, 0.05, 0.05),
                        fontname=font, fontfile=fontfile,
                        align=fitz.TEXT_ALIGN_LEFT)


def add_cover_page(doc, title: str, subtitle: str,
                   one_line_diag: str | None,
                   annotations: list[dict],
                   font: str, fontfile: str) -> None:
    cover = doc.new_page(0, width=PAGE_W_ORIG, height=PAGE_H)

    cover.insert_textbox(fitz.Rect(60, 70, 552, 115),
                         title, fontsize=22, color=(0, 0, 0),
                         fontname=font, fontfile=fontfile)
    cover.insert_textbox(fitz.Rect(60, 118, 552, 145),
                         subtitle, fontsize=12, color=(0.4, 0.4, 0.4),
                         fontname=font, fontfile=fontfile)

    if one_line_diag:
        box_y = 165
        cover.draw_rect(fitz.Rect(60, box_y, 552, box_y + 140),
                        color=(0.7, 0.7, 0.7), fill=(0.96, 0.96, 0.96), width=0.5)
        cover.insert_textbox(fitz.Rect(75, box_y + 10, 540, box_y + 30),
                             "한 줄 진단",
                             fontsize=11, color=(0.2, 0.2, 0.2),
                             fontname=font, fontfile=fontfile)
        cover.insert_textbox(fitz.Rect(75, box_y + 35, 540, box_y + 135),
                             one_line_diag, fontsize=10.5, color=(0, 0, 0),
                             fontname=font, fontfile=fontfile)

    legend_y = 325
    cover.insert_textbox(fitz.Rect(60, legend_y, 552, legend_y + 22),
                         "색상 범례 (3 층위)",
                         fontsize=12, color=(0, 0, 0),
                         fontname=font, fontfile=fontfile)
    items = [
        ("내용 (content)",   "통찰·기여·stake가 substantively 빠진 경우",  COLORS["content"]),
        ("구조 (structure)", "순서·배치 — architecture-first, 갑툭튀, 분산", COLORS["structure"]),
        ("문장 (sentence)",  "verbosity·문체 — 수식 침투, 삽입구, 수동태",     COLORS["sentence"]),
    ]
    y = legend_y + 28
    for name, desc, col in items:
        cover.draw_rect(fitz.Rect(60, y, 100, y + 18),
                        color=col["hl"], fill=col["hl"], width=0)
        cover.insert_textbox(fitz.Rect(60, y, 100, y + 18), col["label"],
                             fontsize=10, color=(0, 0, 0),
                             fontname=font, fontfile=fontfile,
                             align=fitz.TEXT_ALIGN_CENTER)
        cover.insert_textbox(fitz.Rect(110, y + 1, 552, y + 18),
                             f"{name}  ·  {desc}",
                             fontsize=10.5, color=(0, 0, 0),
                             fontname=font, fontfile=fontfile)
        y += 25

    pri_y = 430
    cover.insert_textbox(fitz.Rect(60, pri_y, 552, pri_y + 22),
                         "우선순위 뱃지",
                         fontsize=12, color=(0, 0, 0),
                         fontname=font, fontfile=fontfile)
    pri_items = [
        ("★ 최우선", "글의 통찰과 직결 — 이것만 고쳐도 가독성 크게 개선", (0.85, 0.15, 0.15)),
        ("▲ 중요",   "문제 인과 사슬에 핵심 — 함께 고쳐야 효과",          (0.85, 0.45, 0.05)),
        ("(미표시)", "일반 — 다듬으면 좋음 정도",                          (0.5, 0.5, 0.5)),
    ]
    y = pri_y + 28
    for badge, desc, c in pri_items:
        cover.insert_textbox(fitz.Rect(60, y, 130, y + 16), badge,
                             fontsize=10, color=c,
                             fontname=font, fontfile=fontfile)
        cover.insert_textbox(fitz.Rect(140, y, 552, y + 16), desc,
                             fontsize=10, color=(0, 0, 0),
                             fontname=font, fontfile=fontfile)
        y += 18

    by_page: dict[int, int] = {}
    by_pri: dict[str, int] = {"highest": 0, "high": 0, "normal": 0}
    for a in annotations:
        by_page[a["page"]] = by_page.get(a["page"], 0) + 1
        by_pri[a.get("priority", "normal")] += 1
    pages_str = " · ".join(f"p{p}: {by_page[p]}건" for p in sorted(by_page))
    info = (
        f"다음 페이지(원본 1쪽)부터 {len(annotations)}개 주석이 시작됩니다.\n\n"
        "각 카드는 [진단] + 화살표(→)로 표시된 [대안 방향]으로 구성됩니다. "
        "카드는 우측 마진에 분포하며, 본문의 색칠된 부분과 가는 회색 선으로 연결됩니다.\n\n"
        f"분포: {pages_str}.\n"
        f"★ 최우선 {by_pri['highest']}건 · ▲ 중요 {by_pri['high']}건 · "
        f"일반 {by_pri['normal']}건.\n\n"
        "본 PDF 마지막 페이지에는 우선순위 순서대로 정리한 수정 로드맵이 있습니다."
    )
    cover.insert_textbox(fitz.Rect(60, 540, 552, 720),
                         info, fontsize=10.5, color=(0, 0, 0),
                         fontname=font, fontfile=fontfile)


def add_roadmap_page(doc, annotations: list[dict],
                     font: str, fontfile: str) -> None:
    ranked = sorted(
        enumerate(annotations, 1),
        key=lambda x: PRIORITY_RANK.get(x[1].get("priority", "normal"), 2)
    )
    page = doc.new_page(width=952, height=PAGE_H)
    page.insert_textbox(fitz.Rect(60, 60, 892, 100),
                        "수정 로드맵 — 우선순위 순서",
                        fontsize=20, color=(0, 0, 0),
                        fontname=font, fontfile=fontfile)
    page.insert_textbox(fitz.Rect(60, 105, 892, 130),
                        "위에서 아래로 작업하면 가독성 개선 효과가 가장 큽니다.",
                        fontsize=11, color=(0.4, 0.4, 0.4),
                        fontname=font, fontfile=fontfile)
    y = 140
    h = 50
    for i, (orig_idx, ann) in enumerate(ranked, 1):
        if y + h > 770:
            page = doc.new_page(width=952, height=PAGE_H)
            page.insert_textbox(fitz.Rect(60, 60, 892, 100),
                                "수정 로드맵 (cont'd)",
                                fontsize=16, color=(0, 0, 0),
                                fontname=font, fontfile=fontfile)
            y = 110
        cat = ann["category"]
        pri = ann.get("priority", "normal")
        c = COLORS[cat]
        rect = fitz.Rect(60, y, 892, y + h)
        page.draw_rect(rect, color=c["hl"], fill=c["fill"], width=0.5)
        page.draw_rect(fitz.Rect(60, y, 90, y + h),
                       color=c["hl"], fill=c["hl"], width=0)
        page.insert_textbox(fitz.Rect(60, y + h/2 - 8, 90, y + h/2 + 8),
                            c["label"], fontsize=10, color=(0, 0, 0),
                            fontname=font, fontfile=fontfile,
                            align=fitz.TEXT_ALIGN_CENTER)
        phrase = ann["phrase"]
        header = f"#{i:02d}  ·  p.{ann['page']}  ·  '{phrase[:60]}{'...' if len(phrase) > 60 else ''}'"
        if PRIORITY_LABEL.get(pri):
            header += f"   {PRIORITY_LABEL[pri]}"
        page.insert_textbox(fitz.Rect(100, y + 4, 882, y + 18),
                            header, fontsize=9.5, color=(0.15, 0.15, 0.15),
                            fontname=font, fontfile=fontfile)
        diag = ann["diagnosis"]
        alt = ann["alt"]
        body = (
            f"{diag[:130]}{'...' if len(diag) > 130 else ''}\n"
            f"→ {alt[:160]}{'...' if len(alt) > 160 else ''}"
        )
        page.insert_textbox(fitz.Rect(100, y + 19, 882, y + h - 4),
                            body, fontsize=8.5, color=(0, 0, 0),
                            fontname=font, fontfile=fontfile)
        y += h + 4


def build(input_pdf: str, annotations_json: str, output_pdf: str) -> None:
    spec = json.loads(Path(annotations_json).read_text(encoding="utf-8"))
    annotations = spec["annotations"]
    fontfile = ensure_font(spec.get("fontfile", DEFAULT_FONTFILE))

    title = spec.get("title", Path(input_pdf).stem.replace("_", " "))
    subtitle = spec.get("subtitle",
                        "by Claude · 가독성 / 구조 / 문장 층위 피드백")
    one_line_diag = spec.get("one_line_diagnosis")

    doc = fitz.open(input_pdf)

    for page in doc:
        old = page.rect
        new = fitz.Rect(0, 0, old.width + MARGIN_W, old.height)
        page.set_mediabox(new)
        page.set_cropbox(new)

    by_page: dict[int, list[dict]] = {}
    for ann in annotations:
        page_idx = ann["page"] - 1
        by_page.setdefault(page_idx, []).append(ann)

    body_width = (PAGE_W_ORIG + MARGIN_W - 12) - (PAGE_W_ORIG + 12) - 10

    n_warnings = 0
    for page_idx, anns in by_page.items():
        if page_idx >= len(doc):
            print(f"  [WARN] page {page_idx + 1} out of range")
            continue
        page = doc[page_idx]
        n = len(anns)
        available = BOTTOM_Y - TOP_Y
        gap = 4
        slot_h = (available - (n - 1) * gap) / n

        for i, ann in enumerate(anns):
            phrase = ann["phrase"]
            cat = ann["category"]
            pri = ann.get("priority", "normal")
            diag = ann["diagnosis"]
            alt = ann["alt"]

            if cat not in COLORS:
                print(f"  [WARN] unknown category '{cat}' — skipping")
                n_warnings += 1
                continue

            hits = page.search_for(phrase)
            if not hits:
                print(f"  [WARN] page {page_idx + 1}: phrase not found: '{phrase[:50]}'")
                n_warnings += 1
                continue
            hl_rect = hits[0]
            color = COLORS[cat]

            highlight = page.add_highlight_annot(hl_rect)
            highlight.set_colors(stroke=color["hl"])
            pri_tag = f"[{PRIORITY_LABEL[pri]}] " if PRIORITY_LABEL.get(pri) else ""
            highlight.set_info(content=f"{pri_tag}[{color['label']}] {diag}\n\n→ {alt}")
            highlight.update()

            target_y = TOP_Y + i * (slot_h + gap)
            fontsize, ch = fit_card_to_slot(diag, alt, slot_h, body_width=body_width)
            draw_card(page, target_y, ch, fontsize, cat, pri,
                      diag, alt, FONT_ALIAS, fontfile)

            line_y_src = (hl_rect.y0 + hl_rect.y1) / 2
            line_y_dst = target_y + 8
            page.draw_line(
                fitz.Point(hl_rect.x1 + 2, line_y_src),
                fitz.Point(PAGE_W_ORIG + 12, line_y_dst),
                color=(0.5, 0.5, 0.5), width=0.5
            )
            print(f"  ✓ p{page_idx + 1} [{color['label']}|fs={fontsize}|"
                  f"h={ch:.0f}/slot={slot_h:.0f}] {phrase[:40]}")

    add_cover_page(doc, title, subtitle, one_line_diag, annotations,
                   FONT_ALIAS, fontfile)
    add_roadmap_page(doc, annotations, FONT_ALIAS, fontfile)

    doc.save(output_pdf, garbage=4, deflate=True)
    doc.close()

    sz = os.path.getsize(output_pdf)
    print(f"\n저장: {output_pdf} ({sz / 1024:.1f} KB)")
    if n_warnings:
        print(f"⚠ {n_warnings} warning(s) — check phrase matching")


def main() -> None:
    ap = argparse.ArgumentParser(description="Build a paper-readability-review PDF")
    ap.add_argument("--input", "-i", required=True, help="Input paper PDF")
    ap.add_argument("--annotations", "-a", required=True,
                    help="Annotations JSON (see SKILL.md for schema)")
    ap.add_argument("--output", "-o", required=True, help="Output review PDF")
    args = ap.parse_args()
    build(args.input, args.annotations, args.output)


if __name__ == "__main__":
    main()
