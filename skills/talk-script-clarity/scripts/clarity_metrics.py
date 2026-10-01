#!/usr/bin/env python3
"""Per-slide clarity metrics for a spoken talk script.

Input is either an HTML deck whose <section> tags carry data-speaker-notes
(deck-stage / Claude Design export), or a text/markdown script where each slide
starts with a header like "[12 · Contents · 20초]" (bold markers are ignored).

Usage:
  python clarity_metrics.py deck/index.html --metaphor 함정
  python clarity_metrics.py script.md --metaphor 함정 --aliases "주입,붙이기,끼워 넣"
  python clarity_metrics.py script.md --json > before.json
"""
import argparse
import html
import json
import re
import sys

DEFAULT_JARGON = [
    '로짓', '상한', '하한', '순위 상관', '은닉 상태', '항진식', '엔트로피', '임베딩', '어텐션',
    '가우시안', '등방', '분포', '그래디언트', 'gradient', 'logit', 'KV', 'greedy', '샘플링',
    'SAE', 'LoRA', 'SFT', 'RL', 'latent', 'prefix', 'suffix', 'infix', 'Pass@',
]
SHORT = 50          # characters; Korean short-sentence threshold
NUM_WARN = 8        # spoken numbers per slide
NUM_RE = re.compile(r'(?<![A-Za-z])\d+(?:[.,]\d+)?')
SENT_RE = re.compile(r'(?<=[.?!])\s+')
HEAD_RE = re.compile(r'^\**\[(\w+)\s*·\s*([^\]]*?)\s*·\s*(\d+)초\]\**\s*', re.M)


def load(path):
    text = open(path, encoding='utf-8').read()
    slides = []
    if '<section' in text and 'data-speaker-notes' in text:
        for m in re.finditer(r'<section\b[^>]*?data-label="([^"]*)"[^>]*?data-speaker-notes="([^"]*)"', text):
            label, notes = m.group(1), html.unescape(m.group(2))
            sec = re.match(r'\[(\d+)초\]\s*', notes)
            slides.append({'id': label.split(' ')[0], 'title': label, 'sec': int(sec.group(1)) if sec else None,
                           'text': notes[sec.end():] if sec else notes})
        return slides
    heads = list(HEAD_RE.finditer(text))
    for i, h in enumerate(heads):
        end = heads[i + 1].start() if i + 1 < len(heads) else len(text)
        body = re.sub(r'\s+', ' ', text[h.end():end]).strip()
        slides.append({'id': h.group(1), 'title': h.group(2), 'sec': int(h.group(3)), 'text': body})
    return slides


def measure(slide, jargon, metaphor, aliases):
    t = slide['text']
    sents = [s for s in SENT_RE.split(t) if s.strip()]
    n = max(1, len(sents))
    short = sum(len(s) <= SHORT for s in sents)
    run, max_run = 0, 0
    for s in sents:
        run = run + 1 if len(s) <= 25 else 0
        max_run = max(max_run, run)
    return {
        'id': slide['id'], 'title': slide['title'], 'sec': slide['sec'],
        'chars': len(t), 'chars_per_sec': round(len(t) / slide['sec'], 1) if slide['sec'] else None,
        'sentences': len(sents), 'avg_len': round(len(t) / n), 'short_ratio': round(short / n, 2),
        'very_short_run': max_run,
        'numbers': len(NUM_RE.findall(t)),
        'jargon': sorted({j for j in jargon if j in t}),
        'metaphor': t.count(metaphor) if metaphor else 0,
        'aliases': {g: {a: t.count(a) for a in g.split(',')} for g in aliases},
        'history': re.findall(r'리뷰|리버탈|rebuttal|다시 돌|재분석|수정본|갱신', t),
    }


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('path')
    ap.add_argument('--metaphor', default='', help='master metaphor word to track, e.g. 함정')
    ap.add_argument('--aliases', action='append', default=[], help='comma-separated names for one concept (repeatable)')
    ap.add_argument('--jargon', default='', help='extra jargon terms, comma-separated')
    ap.add_argument('--json', action='store_true')
    a = ap.parse_args()

    slides = load(a.path)
    if not slides:
        sys.exit('no slides found: expected data-speaker-notes or [NN · title · Ns] headers')
    jargon = DEFAULT_JARGON + [j for j in a.jargon.split(',') if j]
    rows = [measure(s, jargon, a.metaphor, a.aliases) for s in slides]

    if a.json:
        json.dump(rows, sys.stdout, ensure_ascii=False, indent=1)
        return

    print(f"{'slide':<6}{'sec':>4}{'chars':>6}{'c/s':>5}{'avg':>5}{'short':>7}{'nums':>6}  flags / jargon")
    for r in rows:
        flags = []
        if r['numbers'] >= NUM_WARN:
            flags.append('NUM')
        if r['short_ratio'] < 0.6:
            flags.append('LONG')
        if r['very_short_run'] >= 4:
            flags.append('CHOPPY')
        if r['history']:
            flags.append('HISTORY')
        if r['metaphor']:
            flags.append(f"M×{r['metaphor']}")
        print(f"{r['id']:<6}{r['sec'] or '-':>4}{r['chars']:>6}{r['chars_per_sec'] or '-':>5}{r['avg_len']:>5}"
              f"{int(r['short_ratio'] * 100):>6}%{r['numbers']:>6}  {' '.join(flags)}  {', '.join(r['jargon'])}")

    tot_s = sum(r['sentences'] for r in rows)
    tot_short = sum(r['short_ratio'] * r['sentences'] for r in rows)
    secs = sum(r['sec'] or 0 for r in rows)
    print('\n== summary')
    print(f"slides {len(rows)} · spoken {secs // 60}m {secs % 60:02d}s · chars {sum(r['chars'] for r in rows)}")
    print(f"numbers {sum(r['numbers'] for r in rows)} · short-sentence ratio {round(tot_short / max(1, tot_s) * 100)}%")
    print('slides with >= %d numbers: %s' % (NUM_WARN, [r['id'] for r in rows if r['numbers'] >= NUM_WARN]))
    print('slides under 60%% short: %s' % [r['id'] for r in rows if r['short_ratio'] < 0.6])
    if a.metaphor:
        print(f"metaphor '{a.metaphor}' appears on: {[r['id'] for r in rows if r['metaphor']]}")
    for g in a.aliases:
        tot = {k: sum(r['aliases'][g][k] for r in rows) for k in g.split(',')}
        print(f'aliases {tot}')
    hist = [(r['id'], r['history']) for r in rows if r['history']]
    if hist:
        print(f'history words (rename by content): {hist}')


if __name__ == '__main__':
    main()
