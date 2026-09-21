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

## 2판에 더해진 것

### 주차 요약 (weekly.json)
설정의 `weekly` 가 가리키는 파일이 주차 카드를 준다. 카드 하나:

```json
{"week":"3","title":"…","intent":"알아보려던 것","method":"한 일","result":"결과 한 줄",
 "number":"194 대 35","status":"ok|un|rt|run","source":"근거 파일 경로와 칸 이름",
 "cases":[{"label":"교사만 푼 문제","patch":{"cmp":"교사만 풂"}}],
 "retracted":["철회한 문장"]}
```

빌드가 `cases[].patch` 를 실제 사례(줄 열쇠 + 모델)로 바꿔 `stats.json.weekly` 에 담는다.
**숫자는 `source` 에 적힌 파일에 실제로 있는 것만 쓴다.** 확실하지 않으면 숫자를 빼고 말로만 적는다.

### 진행 중 실험 패널 (live.panels)
`prepare.live()` 가 만든다. 한 장:

```json
{"id":"proposer","title":"…","plain":"쉬운 설명","headline":"한 줄 요약","gate_pass":false,
 "rounds":[{"round":4,"metrics":[{"label":"남음","v":2,"of":null}],"gate":{"threshold":3,"pass":false},
            "cards":[{"claim":"…","target":"…","verdict":"남음|기각|미정","rates":[{"label":"…","v":36.1}],
                      "ci":[0.07,0.34],"reason":"…","full":{"card":{},"verdict_json":{}}}],
            "report":"제안자 보고서 원문","report_path":"…"}]}
```

화면은 수치 → 카드 표 → **원문(카드 JSON · 판정 JSON · 보고서)** 순으로 펼친다. 비밀 파일(정답지 등)은 절대 싣지 않는다.

### 지도 (live.map)
`{goals:[{id,label,desc,questions:[{id,label,running,experiments:[{id,name,phase,intent,method,result}]}]}]}`.
`phase` 는 `past|running|next` 이고, running 노드에 "여기" 표시가 붙는다. 노드를 누르면 기록·큐가 그 실험으로 좁혀진다.

### 실시간 (KV) — 선택
- `kv_push.py` 가 기록 꼬리·루프·큐·창고·패널을 KV 키 `live` 에 넣는다(REST API, 토큰은 환경변수).
- `functions/api/live.js` 가 그것을 읽어 준다. 라이브 탭은 보일 때 10초마다 부르고, 없으면 조용히 정적 자료를 쓴다.
- `functions/api/control.js` 는 사람이 남기는 의도(다음 순서·중단 요청·메모)를 `control` 키에 쓴다.
  쓰기는 Access JWT 검증을 통과해야 하고, `ACCESS_AUD` 가 없으면 읽기 전용(503)으로 떨어진다.
- 설정: `"kv": {"account_id": "...", "namespace_id": "...", "binding": "LIVE"}`.

### 쌓이는 보고서 (snapshot.py)
`python research-site/snapshot.py --site site --week 2026-W39 --week-id 4 --label "4주차 보고서"`
→ `site/reports/<주차>/` 에 화면과 그때의 자료를 얼리고 `reports/index.json`·`data/reports.json` 에 줄을 더한다.
`--max-week` 를 주면 그 주차까지의 자료만 남긴다. 얼린 화면은 실시간 갱신을 하지 않고 띠로 그 사실을 알린다.

### 자가 점검
`AUDIT_RUBRIC.md` 의 아홉 줄(W1·S1·S2·D1·L1·L2·L3·V1·R1)을 스크린샷을 보고 0~2로 매겨 `site/AUDIT.md` 에 남긴다.

## 파이프라인 판 (pipeline.json)

연구 전체를 번호 붙은 상자 한 판으로 그린다. 설정의 `live` 또는 prepare 의 `live()` 가 `pipeline` 을 넘겨 준다.

```json
{"bands":[{"id":"b1","label":"왜 지는지 찾기","color":"var(--c1)","from":1,"to":6}],
 "nodes":[{"n":9,"id":"harness","label":"가설 하네스 5바퀴","band":"b2","exp":"e12","weeks":["4"],
           "state":"done|running|failed|returned|next|blocked","status":"진행 중","number":"2 / 4",
           "one_line":"아이도 따라올 결과 한 줄","stats_block":"bank","cases_filter":{"cmp":"교사만 풂"},
           "back_to":"pairs","back_reason":"…","blocked_reason":"…",
           "modules":[{"id":"q","label":"자료 조회","state":"running"}]}],
 "side_nodes":[{"id":"footprint","label":"패치 발자국","state":"failed","back_to":"anatomy","back_reason":"…"}]}
```

- 상자를 누르면 `stats_block` 의 차트와 `cases_filter` 의 사례가 서랍에 열리고, `modules` 가 있으면 2층 판이 그려진다.
- 모듈을 누르면 `data/artifacts/<종류>_<바퀴>.json` 을 받아 원문을 보여 준다(각 200KB 상한, 넘으면 '잘림').
- 모듈 상태는 `prepare` 가 파일에서 추론한다(방금 커진 기록 = "응답 중", 다음 산출물이 없으면 "대기").
  사람이 정확히 적고 싶으면 `emit.py node --id … --state … [--module … --module-state …]` 를 쓴다.
- 주차를 고르면 같은 판이 그 주에 움직인 상자만 진하게 보여 주는 주차 요약이 된다.
