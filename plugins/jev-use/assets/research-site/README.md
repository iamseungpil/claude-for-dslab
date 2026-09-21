# 연구판 템플릿 (research-site)

설정 파일 하나와 시행 표 하나로 세 탭짜리 정적 연구 사이트를 만든다. 주제는 코드에 없다 —
전부 `site.config.json` 과 설정이 가리키는 `prepare` 모듈에 있다.

- **자료** — 과제 행렬. 한 줄이 한 과제, 한 칸이 한 모델의 결과. 칸을 누르면 그 시행의 상세.
- **통계** — 질문 하나 = 블록 하나. 차트 + 한 줄 결론 + 상태 배지(확정/미확인/철회/진행).
- **라이브** — 루프 띠 · 피드 · 실험 큐 · 가설 창고.
- 주차 선택은 세 탭 모두에 걸린다.

외부 요청이 하나도 없다(폰트·CDN·아이콘 없음). 차트는 CSS 막대와 인라인 SVG뿐이다. 어두운 화면과 휴대폰 폭을 지원한다.

## 쓰는 법

```bash
python research-site/build_site_data.py site.config.json          # data/*.json 생성
cp -r research-site/index.html research-site/css research-site/js site/   # 화면 파일
```

`deploy.sh` 는 이 두 줄에 배포 한 줄을 붙인 예시다.

## 자료 계약 (data/*.json)

빌드가 만드는 파일은 넷이고, 화면은 이것 말고는 아무것도 읽지 않는다.

### meta.json
| 키 | 뜻 |
|---|---|
| `title`, `built_at`, `links` | 제목 · 갱신 시각 · 헤더 오른쪽 링크 |
| `weeks[]` | `{id, label, range, legacy}` — `legacy` 는 옛 사이트 라벨(작게 같이 보인다) |
| `matrix` | `{columns[], col_labels{}, outcomes{}, row_columns[], focus_facet, default_columns}` |
| `matrix.outcomes` | 결과 종류 → `{cls, short}`. `cls` 는 `ok`·`bad`·`warn`·`mid`·`""` 다섯 |
| `facets[]` | `{key, label, desc, group, scope, field, type, multi, values[[값,이름,건수]]}` |
| `presets[]` | `{id, label, desc, patch}` — patch 는 facet key → 값 |
| `kv_labels[]` | 상세의 key-value 이름표(칸에는 번호만 들어 있다) |

`facets[].type` 은 셋뿐이다: `enum`(다중 선택 OR) · `text`(본문 검색, `fields[]`) · `num_ge`(이상).
`scope` 는 `row`(과제 줄) 또는 `cell`(모델 칸)이다. 칸 필터는 기준 모델(`focus_facet`)이 정해져 있으면
그 모델의 칸만, 아니면 아무 칸이나 하나가 조건을 모두 만족하면 그 줄이 남는다.

### rows.json
`{built_at, rows: [...]}`. 줄 하나:

```json
{"k": "3|SWE-Pro|instance_ansible__…", "week": "3", "week_label": "3주차", "bench": "SWE-Pro",
 "task": "…", "title": "…", "repo": "ansible/ansible", "lang": "python", "files": "4+",
 "cmp": ["교사만 풂"], "solvers": 3, "n_models": 5,
 "cells": {"K-EXAONE-2": {"o": "P 일부 통과", "e": "첫 오류 줄", "h": "archive/…#trial/…",
                           "kv": [[0, 161], [1, "Submitted"]], "turns": 161}}}
```

- `k` 는 줄 열쇠(주소의 `r=<k>||<model>` 에 쓰인다). `o` 는 결과 종류, `e` 는 첫 오류 줄, `h` 는 원본 궤적 링크.
- 칸의 나머지 키는 `cell.fields` 가 정한 필터용 값이다.

### stats.json
`{built_at, blocks: [...]}`. 블록 하나:

```json
{"id": "paired", "question": "쉬운 말로 된 질문", "status": "ok|un|rt|run", "status_label": "확정",
 "week": "3", "takeaway": "아이도 따라올 한 줄", "note": "덧붙임", "go": {"cmp": "교사만 풂"},
 "chart": {"kind": "bars|grouped|ci|stacked|table", "title": "…", "rows": [...], "cap": "…"}}
```

자료가 없으면 차트를 지어내지 말고 `missing` 을 넣는다 — 화면이 "자료 없음"과 찾은 경로를 그대로 보여 준다.

```json
{"id": "x", "question": "…", "status": "un", "missing": {"paths": ["runs/views/tally.parquet"], "why": "아직 안 돌렸다"}}
```

차트의 `rows[].patch` 나 블록의 `go` 는 facet key → 값이고, 누르면 그 조건으로 자료 탭이 열린다.
철회된 주장은 지우지 말고 `status: "rt"` 로 남긴다.

### live.json
`{updated, loop, feed[], queue, bank}`.
- `loop`: `{steps:[{id,short,name}], at, back_note, note}` — `at` 이 지금 단계, `back_note` 가 되돌아간 곳.
- `feed[]`: `{ts, kind, title, plain, body, author, status, numbers{}, links[], week}`.
  `plain`(아이도 따라올 설명)이 있으면 그것이 크게 나오고 `body` 는 "자세히" 뒤에 접힌다. 없으면 제목+본문 그대로.
- `queue`: `{note, experiments:[{id,name,state,phase,intent,hypothesis,method,gate,result,cost}]}`.
- `bank`: `{cards:[{id,title,status,round,stratum,reason,rates{}}]}`.

## prepare 모듈 (선택)

설정의 `prepare` 가 가리키는 파이썬 파일은 다음 셋 중 있는 것만 불린다.

| 함수 | 언제 | 하는 일 |
|---|---|---|
| `enrich(root, trials, cfg) -> trials` | 줄로 접기 전 | 시행마다 결과 종류·비교 꼬리표 같은 칸을 덧붙인다 |
| `blocks(root, rows, trials, cfg) -> [block]` | 줄을 다 만든 뒤 | 통계 탭의 질문 블록 |
| `live(root, cfg) -> dict` | 마지막 | 라이브 탭 자료 (없으면 설정의 `live` 경로를 그대로 읽는다) |

DeepSWE 판의 구현은 `tools/deepswe_prepare.py` 에 있다.

## functions/api/emit.js (선택 · 배포 안 함)

피드 한 줄을 실시간으로 받는 Cloudflare Pages Functions 엔드포인트다. Access JWT로 사람을 확인하고
KV(`FEED`)에 이어 붙인다. **지금은 KV 바인딩 권한이 없어 배포하지 않는다** — 붙일 때 `wrangler.toml` 에
`ACCESS_AUD` 와 KV 바인딩을 넣고 `functions/` 를 배포 대상에 포함시키면 된다.
