# Interactive Report — Experiment Results Visualization

연구 보고서(LaTeX/Markdown)의 핵심 분석과 결과를 interactive HTML 컨텐츠로 변환하는 스킬입니다.
보고서 전체를 옮기는 것이 아니라, **핵심 발견(Key Findings)을 시각적으로 강조**하는 데 집중합니다.

## Usage

```
/interactive-report <report_path> <data_dir> <output.html>
```

- `report_path`: LaTeX (.tex) 또는 Markdown (.md) 보고서 파일
- `data_dir`: 데이터 파일 디렉토리 (JSON, CSV, figures/)
- `output.html`: 출력 HTML 파일 경로

## Core Principles

1. **Main Point First**: 모든 시각화의 첫 번째 요소는 핵심 발견 (숫자, 비교, 결론)
2. **Candidate Selection**: 각 인사이트에 대해 3개 이상 시각화 후보를 검토하고 최적 선택
3. **Self-Contained**: 단일 HTML 파일, 외부 의존성 없음, offline 작동
4. **No Hallucination**: 보고서와 데이터에 있는 수치만 사용, 추정 금지

## Workflow

```
Phase 1: Extract Key Points
  ├── 보고서 파싱 (Executive Summary, Key Findings, Tables, Figures)
  ├── 핵심 인사이트 추출 (최대 8-10개)
  └── 각 인사이트 분류: comparison | trend | case-study | metric | distribution

Phase 2: Candidate Visualization
  ├── 각 인사이트에 대해 3+ 시각화 후보 생성
  ├── 적합도 평가 (clarity, information density, visual impact)
  └── 최적 시각화 선택 + 선택 이유 기록

Phase 3: Build HTML
  ├── Dark-mode responsive layout
  ├── Navigation sidebar (인사이트 목록)
  ├── 각 섹션: Hero metric + visualization + 1-2 line explanation
  └── Interactive elements: hover, click-to-expand, tab switching

Phase 4: Validate
  ├── 모든 수치가 원본 데이터/보고서와 일치하는지 검증
  ├── 시각화가 데이터를 정확히 반영하는지 확인
  └── 깨진 레이아웃/기능 체크
```

## Visualization Candidate Pool

각 인사이트 유형에 따른 시각화 후보:

### comparison (조건/그룹 간 비교)
| 후보 | 적합 상황 | 장점 | 단점 |
|------|----------|------|------|
| **Heatmap** | 2D matrix (조건 × 태스크) | 전체 패턴 한눈에 | 개별 값 읽기 어려움 |
| **Grouped Bar** | 소수 그룹 비교 (2-5) | 직관적 크기 비교 | 그룹 많으면 복잡 |
| **Radar/Spider** | 다차원 프로필 비교 | 형태 차이 명확 | 3개 이상이면 혼란 |
| **Diverging Bar** | 기준선 대비 +/- | 방향성 강조 | 절대값 비교 약함 |
| **Dot Plot** | 정확한 값 비교 | 값 읽기 쉬움 | 시각적 임팩트 약함 |

→ **선택 기준**: 축 2개 이상 → Heatmap, 단일 축 비교 → Grouped Bar, 기준선 대비 → Diverging Bar

### trend (시간/라운드 변화)
| 후보 | 적합 상황 |
|------|----------|
| **Line Chart + Annotations** | 연속 변화, 특정 시점 강조 |
| **Step Chart** | 이산 단계 (라운드별) |
| **Area Chart** | 누적/비중 변화 |
| **Sparkline + KPI Card** | 요약 + 미니 트렌드 |

→ **선택 기준**: 핵심 전환점이 있으면 → Annotated Line, 단계별 → Step Chart

### case-study (개별 사례 분석)
| 후보 | 적합 상황 |
|------|----------|
| **Side-by-Side Diff** | 두 조건 비교 (NS vs SIER) |
| **Timeline Cards** | 순차적 행동 비교 |
| **Tabbed Panel** | 여러 조건 전환 |
| **Accordion** | 상세 내용 접기/펼치기 |

→ **선택 기준**: 2개 비교 → Side-by-Side, 3+ 비교 → Tabbed Panel

### metric (핵심 수치 강조)
| 후보 | 적합 상황 |
|------|----------|
| **KPI Card** | 단일 핵심 수치 |
| **Gauge** | 목표 대비 달성도 |
| **Big Number + Context** | 수치 + 비교 대상 |
| **Progress Bar** | 달성률 |

→ **선택 기준**: 핵심 1개 → Big Number, 여러 개 → KPI Cards row

## HTML Template Structure

```html
<!DOCTYPE html>
<html>
<head>
  <!-- Self-contained: all CSS inline -->
  <style>
    /* Dark mode, responsive, monospace code blocks */
    /* Navigation sidebar */
    /* Card/section layouts */
    /* Chart styles (CSS-only where possible, inline SVG/Canvas) */
  </style>
</head>
<body>
  <nav id="sidebar"><!-- Insight navigation --></nav>
  <main>
    <header><!-- Title, subtitle, metadata --></header>

    <section class="hero">
      <!-- 1-2 most important findings as large KPI cards -->
    </section>

    <section class="insight" id="insight-1">
      <h2>Finding Title</h2>
      <div class="viz"><!-- Primary visualization --></div>
      <p class="explanation"><!-- 1-2 sentence interpretation --></p>
    </section>

    <!-- More insight sections... -->

    <section class="methodology">
      <!-- Compact experiment setup info -->
    </section>
  </main>
  <script>
    // Interactivity: hover tooltips, click-to-expand, tab switching
    // Data embedded as const DATA = {...}
  </script>
</body>
</html>
```

## Selection Decision Process

시각화를 선택할 때 다음 순서로 판단:

```
1. 인사이트 유형 분류 (comparison | trend | case-study | metric)
2. 데이터 차원 수 확인 (1D: bar/KPI, 2D: heatmap/scatter, 3D+: faceted)
3. 주요 메시지 확인:
   - "A가 B보다 높다" → 직접 비교 (bar, dot)
   - "시간에 따라 변한다" → 트렌드 (line, step)
   - "패턴이 있다" → 매트릭스 (heatmap)
   - "이것이 핵심 수치다" → 강조 (KPI card)
4. 후보 3개 중 가장 '1초 안에 메시지가 전달되는' 것 선택
5. 선택 이유를 HTML 주석으로 기록
```

## Quality Criteria

| 기준 | 설명 | 필수 |
|------|------|:----:|
| **Accuracy** | 모든 수치가 원본과 일치 | ✓ |
| **Clarity** | 핵심 메시지가 1초 안에 전달 | ✓ |
| **Responsiveness** | 모바일에서도 깨지지 않음 | ✓ |
| **Self-contained** | 외부 CDN/라이브러리 없음 | ✓ |
| **Interactivity** | hover/click으로 상세 정보 | ○ |
| **Aesthetic** | 일관된 색상, 폰트, 간격 | ○ |

## Cautions

1. **데이터에 없는 수치를 시각화에 넣지 않는다** (hallucination 방지)
2. **보고서의 모든 내용을 담으려 하지 않는다** (핵심 8-10개만)
3. **시각화가 텍스트를 대체하는 게 아니라 강조하는 것이다**
4. **색상은 colorblind-safe palette 사용** (viridis, 또는 red-green 구분 회피)
5. **모든 차트에 범례와 단위를 명시한다**
6. **인쇄 시에도 읽을 수 있도록 한다** (색상만으로 구분하지 않음)
