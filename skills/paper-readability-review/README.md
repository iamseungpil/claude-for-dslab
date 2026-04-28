# paper-readability-review

논문 PDF에 가독성 피드백을 **내용 / 구조 / 문장** 세 층위로 진단해, 본문 위에 색상 하이라이트와 마진 카드(진단 + 대안 방향)를 붙인 리뷰 PDF를 만든다.

## What it does

```
[원고 PDF]
    ↓
[Phase 1] 전체 읽기 + 섹션 구조 파악
[Phase 2] 3 층위 진단 (각 항목별 본문 phrase 추출)
[Phase 3] 우선순위 부여 (★ 최우선 / ▲ 중요 / 일반)
[Phase 4] annotations.json → build_review_pdf.py
[Phase 5] critic-loop: 페이지 PNG 렌더링 → 자체 검토 → 재생성
    ↓
[리뷰 PDF: 표지 + 원본+카드 마진 + 우선순위 로드맵]
```

## Quick usage

1. Claude가 SKILL.md의 진단 가이드를 따라 `annotations.json` 작성
2. Build:

```bash
python3 build_review_pdf.py \
  --input  paper.pdf \
  --annotations annotations.json \
  --output paper_review.pdf
```

3. Critic-loop:

```bash
python3 -c "
import fitz, os
os.makedirs('critic', exist_ok=True)
doc = fitz.open('paper_review.pdf')
for i in range(len(doc)):
    doc[i].get_pixmap(dpi=140).save(f'critic/p{i:02d}.png')
"
```

## Output structure

- 페이지 1: 표지 (한 줄 진단 + 색상/우선순위 범례 + 분포 안내)
- 페이지 2~N: 원본 페이지 우측에 340pt 마진을 추가하고, 각 진단 항목을 카드로 배치
- 마지막 페이지: 우선순위 순서로 정리된 수정 로드맵

## Color & priority

| 카테고리 | 의미 |
|---------|------|
| 내용 (content)   | 통찰·기여·stake가 substantively 빠진 경우 |
| 구조 (structure) | 순서·배치 — architecture-first, 갑툭튀, 분산 |
| 문장 (sentence)  | verbosity·문체 — 수식 침투, 삽입구, 수동태 |

| 우선순위 | 사용 시점 |
|---------|----------|
| highest (★ 최우선) | 글의 핵심 통찰과 직결, 한 줄만 옮겨도 가독성 크게 개선 |
| high (▲ 중요)      | 문제 인과 사슬에 핵심, 함께 고쳐야 효과 |
| normal (일반)      | 다듬으면 좋음 정도 |

## Requirements

```bash
pip install pymupdf
```

한국어 폰트(NanumGothic)는 처음 실행 시 자동으로 `~/.fonts/`에 다운로드된다.

## Files

- `SKILL.md` — Claude가 읽는 메인 가이드
- `build_review_pdf.py` — annotations.json → 리뷰 PDF 빌더
- `example_annotations.json` — 작성 예시
- `README.md` — 본 문서
