---
name: update-study
description: This skill should be used when the user asks to "update study", "analyze new experiments", "update experiment document", or "refresh study notes". Produces academic-paper-quality experiment reports with matplotlib plots, executive summary with comparison tables, implementation structure, experimental results with figure interpretation, proposed improvements with code examples, hypotheses, limitations, and LaTeX PDF export with figures. Features incremental detection (only analyze NEW experiments), data extraction to DataFrame, automated plot generation, iterative writing improvement loop with quality criteria, zero-hallucination verification, and LaTeX PDF export. Usage - `/update-study logs/experiment.log study.md` or `/update-study "logs/exp1.log logs/exp2.log" results/ablation_study.md`
version: 3.0.0
---

# Update Study - Academic-Quality Experiment Report Generation

실험 로그를 분석하여 학술 논문 수준의 실험 보고서를 생성하는 스킬입니다.
matplotlib 시각화, Executive Summary, 구현 구조, 결과 해석, 개선안, LaTeX PDF 변환을 포함합니다.

## Core Features

1. **Incremental Detection** - 새 실험만 분석 (이미 문서화된 실험 스킵)
2. **Data Extraction** - W&B/로그 파일에서 메트릭 시계열 추출, pandas DataFrame 구조화
3. **Automated Plot Generation** - matplotlib 기반 비교 차트, 트렌드 패널, 조건별 분석 차트
4. **Iterative Writing Loop** - 학술 논문 수준 품질 개선 루프 (>=80점 통과)
5. **Zero Hallucination** - 로그 레벨 교차 검증
6. **LaTeX PDF Export** - Figure 포함 LaTeX 변환 및 PDF 생성

## Usage

```
/update-study <log_path(s)> <study_md_path>
```

- `log_path(s)`: 실험 로그 파일 경로 (공백으로 구분하여 여러 개 가능, W&B export CSV 포함)
- `study_md_path`: 업데이트할 study markdown 파일 경로

## Arguments Parsing

`$ARGUMENTS`에서 마지막 인자가 `.md` 파일이면 study 파일, 나머지는 로그 파일로 파싱합니다.

```
예시:
  /update-study logs/exp1.log results/study.md
  → log_files: ["logs/exp1.log"]
  → study_file: "results/study.md"

  /update-study logs/exp1.log logs/exp2.log memgen_ablation_study.md
  → log_files: ["logs/exp1.log", "logs/exp2.log"]
  → study_file: "memgen_ablation_study.md"
```

---

## Report Template

최종 보고서는 다음 구조를 따릅니다. 학술 논문 수준의 형식을 유지합니다.

```markdown
# {Title} Experiment Report

**Author**: {name}  **Date**: {date}  **Project**: {project}

## Executive Summary

| Task | Key Metric | Baseline | Proposed | Difference |
|------|-----------|----------|----------|------------|
| {task_a} | {metric} | {baseline_val} | {proposed_val} | {delta} |
| {task_b} | {metric} | {baseline_val} | {proposed_val} | {delta} |

{1-2 sentence overall conclusion}

## 1. Implementation

### 1.1 Overview

{실험의 목적과 접근 방식을 Definition-First 원칙으로 기술}

### 1.2 Implementation Structure

{핵심 코드 구조를 코드 스니펫으로 제시}

```python
class ProposedModule(nn.Module):
    """모듈 설명 - 무엇을, 왜 하는지"""
    def __init__(self, config):
        ...
    def forward(self, x):
        ...
```

## 2. Experimental Results

### 2.1 {Task A}: {핵심 결과 한 줄 요약}

{결과 테이블 + Figure 참조 + 해석}

![Figure 1: {caption}](figures/{figure_name}.png)

**Figure 1 해석**: {figure에서 관찰되는 패턴, 의미, baseline 대비 차이}

### 2.2 {Task B}: {핵심 결과 한 줄 요약}

{동일 구조}

### 2.3 {분석 제목}: {교차 분석 또는 상관 분석}

{여러 실험/조건 간 비교 분석}

### 2.4 {한계 분석 제목}

{실험 결과에서 발견된 한계점, 예상과 다른 결과에 대한 분석}

### 2.5 Experimental Setup

| Parameter | Value |
|-----------|-------|
| Model | {model_name} |
| Dataset | {dataset} |
| Epochs | {N} |
| Learning Rate | {lr} |
| Batch Size | {batch_size} |
| Hardware | {gpu_info} |

## 3. Proposed Improvements

### 3.1 {Method A}

**Problem**: {현재 결과에서 발견된 구체적 문제, 수치 근거}

**Solution**: {제안하는 해결 방법과 근거}

```python
# 구현 예시
class ImprovedModule(nn.Module):
    def __init__(self, config):
        ...
```

**Expected Effect**: {예상되는 개선 효과와 근거}

### 3.2 {Method B}

{동일 구조: Problem → Solution → Code → Expected Effect}

## 4. Limitations

- {한계 1}: {구체적 설명 + 영향 범위}
- {한계 2}: {구체적 설명 + 영향 범위}
- {한계 3}: {구체적 설명 + 영향 범위}

## 5. Conclusion

{주요 발견 요약, 기여, 의미}

## 6. Next Experiments

### E{N}: {실험 이름}
- **Tests**: H{N}
- **Config changes**:
  ```yaml
  {parameter}: {new_value}  # was: {old_value}
  ```
- **Expected**: {가설이 맞다면 예상되는 결과}

### E{N+1}: {실험 이름}
- **Tests**: H{N+1}
- **Config changes**:
  ```yaml
  {config_changes}
  ```
- **Expected**: {prediction}

## References

- {관련 논문/자료 목록}
```

---

## Workflow Overview

```
Phase 0: Incremental Detection
  ├── logs/ 스캔
  ├── 기존 study 파싱 (이미 분석된 실험 식별)
  └── 새 실험 목록 생성 → 없으면 "No new experiments" 출력 후 종료

Phase 1: File Verification
  ├── 로그 파일 존재 확인
  └── study.md 읽기

Phase 2: Data Extraction (NEW)
  ├── 로그/W&B 파일에서 메트릭 시계열 추출
  ├── pandas DataFrame으로 구조화
  └── 메트릭: accuracy, loss, ratio, entropy 등

Phase 3: Plot Generation (NEW)
  ├── scripts/generate_plots.py 호출
  ├── Training curve 비교 (Filter OFF vs ON 스타일)
  ├── Metric trend (multi-subplot panel)
  ├── 조건별 비교 차트
  └── 출력: figures/ 디렉토리에 PNG 저장

Phase 4: Interpretation + Writing (확장)
  ├── experiment-interpreter 에이전트 호출
  ├── Executive Summary 비교 테이블 생성
  ├── 각 Figure에 대한 해석 작성
  ├── Proposed Improvements 섹션 (Problem → Solution → Code → Expected Effect)
  ├── Limitations, Conclusion, Next Experiments 작성
  └── Writing Quality Loop (>=80점, 최대 3회 반복)

Phase 5: Verification
  ├── experiment-verifier 에이전트 호출
  ├── 숫자 정확성 검증
  └── 논리 일관성 검증

Phase 6: Export (확장)
  ├── Markdown 최종 확정
  ├── LaTeX 변환 + Figure 포함 (scripts/export_latex_pdf.py)
  ├── PDF 생성
  └── Fallback: scripts/export_pdf.py (기존 pandoc/weasyprint 방식)
```

---

## Phase 0: Incremental Detection

### Step 0.1: 로그 디렉토리 스캔

```
1. logs/ 디렉토리에서 모든 로그 파일 목록 생성
   - 패턴: *_train.log, *_eval.log, *.log, *.csv (W&B export)
   - 파일 수정 시간 기준 정렬

2. 입력된 로그 파일 목록과 교차 확인
```

### Step 0.2: 기존 Study 분석

```
기존 study.md에서 이미 문서화된 실험 식별:

1. 실험 헤더 패턴 검색:
   - `### E{N}:` 또는 `### Experiment:`
   - `## Experiment {N}:`

2. 로그 파일 참조 추출:
   - `[*_train.log:*]` 형식의 출처 표기
   - `Source:` 열의 파일명

3. 문서화된 실험 목록 구축:
   documented_experiments = {
       "evolve_h_only_train.log",
       "cross_attn_train.log",
       ...
   }
```

### Step 0.3: 새 실험 결정

```python
new_experiments = set(input_logs) - set(documented_experiments)

if len(new_experiments) == 0:
    print("No new experiments to analyze")
    print(f"  Already documented: {len(documented_experiments)} experiments")
    exit()  # 종료
else:
    print(f"Found {len(new_experiments)} new experiment(s) to analyze:")
    for exp in new_experiments:
        print(f"  - {exp}")
```

---

## Phase 1: File Verification

### Step 1.1: 파일 확인

```
1. 새 실험 로그 파일 존재 확인
   - 각 log_path에 대해 파일 존재 여부 확인
   - 존재하지 않으면 에러 메시지 출력 후 중단

2. study.md 파일 확인
   - 파일이 존재하면 Read tool로 전체 내용 읽기
   - 파일이 없으면 새로 생성할 것임을 안내

3. 로그 파일 요약 정보 추출 (빠른 스캔)
   - 실험 config 파일 경로
   - 실험 모드 (train/evaluate)
   - 최종 metric 라인 위치
```

### Step 1.2: 기존 study.md 분석

```
기존 study.md에서 확인할 사항:
- 이미 기록된 실험 목록
- 비교 가능한 baseline 결과
- 미해결 가설 목록
- 계획된 실험 목록 (이번 실험이 기존 계획에 해당하는지)
```

---

## Phase 2: Data Extraction

로그 파일 및 W&B export에서 메트릭 시계열 데이터를 추출하여 구조화합니다.

### Step 2.1: 메트릭 시계열 추출

```
1. 로그 파일 파싱
   - 정규표현식으로 epoch/step별 메트릭 추출
   - 패턴 예시:
     - "Epoch {N}: accuracy={X.XX}, loss={X.XXXX}"
     - "Step {N} | train_loss: {X.XXXX} | eval_acc: {X.XX}"
     - W&B CSV: 컬럼 기반 직접 로드

2. W&B API/CSV 지원
   - wandb export CSV 파일 자동 인식
   - 컬럼명 표준화 (step, epoch, metric_name)
```

### Step 2.2: pandas DataFrame 구조화

```python
# 추출 결과 구조
import pandas as pd

# 각 실험별 DataFrame
df = pd.DataFrame({
    'step': [...],
    'epoch': [...],
    'train_loss': [...],
    'eval_accuracy': [...],
    'learning_rate': [...],
    'grad_norm': [...],
    # 실험별 추가 메트릭
    'ratio': [...],        # 필터링 비율 등
    'entropy': [...],      # 분포 엔트로피 등
})

# 메타데이터
metadata = {
    'experiment_name': '...',
    'config_path': '...',
    'log_path': '...',
    'total_epochs': N,
    'final_metrics': {
        'accuracy': X.XX,
        'loss': X.XXXX,
    }
}
```

### Step 2.3: 대상 메트릭

```
필수 메트릭 (로그에 존재하는 경우):
- accuracy (eval/test)
- loss (train/eval)
- learning_rate
- grad_norm

선택 메트릭 (실험 유형에 따라):
- ratio (필터링 비율, 압축 비율 등)
- entropy (분포 엔트로피)
- perplexity
- BLEU / ROUGE
- custom metrics (로그에서 자동 감지)
```

---

## Phase 3: Plot Generation

`scripts/generate_plots.py`를 호출하여 matplotlib 기반 시각화를 생성합니다.

### Step 3.1: 차트 유형

```
1. Training Curve 비교 (필수)
   - X축: epoch 또는 step
   - Y축: loss / accuracy
   - 여러 실험을 한 차트에 오버레이
   - 스타일: "Filter OFF vs Filter ON" 비교 형태
   - 범례, 그리드, 타이틀 포함

2. Metric Trend Panel (필수)
   - Multi-subplot 레이아웃 (2x2 또는 3x2)
   - 각 subplot: 하나의 메트릭 시계열
   - 예: loss, accuracy, grad_norm, learning_rate
   - 실험 간 동일 스케일 사용

3. 조건별 비교 차트 (조건부)
   - Bar chart: 최종 메트릭 비교 (실험별)
   - Grouped bar: 여러 메트릭을 실험별로 그룹화
   - 예: baseline vs proposed 최종 accuracy 비교

4. 분포 차트 (조건부)
   - Histogram: metric 분포 비교
   - Box plot: 실험 간 변동성 비교
```

### Step 3.2: 스크립트 호출

```bash
python scripts/generate_plots.py \
  --data extracted_metrics.json \
  --output-dir figures/ \
  --experiments "exp1,exp2,baseline" \
  --plots training_curve,metric_panel,comparison_bar
```

### Step 3.3: 출력

```
figures/
  ├── training_curve_comparison.png    # Loss/accuracy 비교 곡선
  ├── metric_trend_panel.png           # Multi-subplot 메트릭 패널
  ├── final_metric_comparison.png      # Bar chart 최종 비교
  └── {custom_name}.png                # 실험별 추가 차트
```

### Step 3.4: Figure 스타일 기준

```python
# 학술 논문 수준 matplotlib 설정
import matplotlib.pyplot as plt

plt.rcParams.update({
    'figure.figsize': (10, 6),
    'figure.dpi': 150,
    'font.size': 12,
    'font.family': 'serif',
    'axes.labelsize': 13,
    'axes.titlesize': 14,
    'legend.fontsize': 11,
    'xtick.labelsize': 11,
    'ytick.labelsize': 11,
    'axes.grid': True,
    'grid.alpha': 0.3,
    'lines.linewidth': 2.0,
    'figure.constrained_layout.use': True,
})

# 색상 팔레트 (colorblind-friendly)
COLORS = ['#0072B2', '#D55E00', '#009E73', '#CC79A7', '#F0E442', '#56B4E9']
```

---

## Phase 4: Interpretation + Writing

### Step 4.1: Experiment-Interpreter 에이전트 호출

```
Task tool 사용:
- subagent_type: "experiment-interpreter"
- prompt:

  "다음 실험 로그와 생성된 Figure를 분석하여
   학술 논문 수준의 실험 보고서를 작성해주세요.

  ## 데이터
  {추출된 DataFrame 요약}

  ## 생성된 Figure 목록
  {figures/ 디렉토리의 PNG 파일 목록과 각 차트 설명}

  ## 로그 파일
  {각 로그 파일의 전체 경로}

  ## 기존 study.md 내용 (비교용)
  {기존 study.md의 결과 요약 테이블}

  ## 이전 검증 피드백 (있는 경우)
  {verifier의 feedback_summary - 첫 iteration에는 없음}

  ## 요구사항
  1. Report Template 구조를 따를 것
  2. Executive Summary 비교 테이블 생성
  3. 각 Figure에 대한 구체적 해석 작성
     - 패턴, 추세, 이상점 기술
     - baseline 대비 차이 설명
     - Figure 번호로 참조 (Figure 1, Figure 2, ...)
  4. Implementation Structure 섹션에 핵심 코드 스니펫 포함
  5. Proposed Improvements: Problem → Solution → Code → Expected Effect
  6. Limitations 섹션: 구체적 한계와 영향 범위
  7. Conclusion: 주요 발견 요약
  8. Next Experiments: 가설과 연결된 구체적 계획
  9. 모든 수치에 출처 표기 (source: filepath:L행번호)
  10. 각 가설은 falsifiable + prediction + falsification 포함
  11. 출력은 Report Template 형식의 markdown

  ## 출력 형식
  references/interpretation-template.md 템플릿을 따르되,
  Report Template의 전체 구조에 맞게 확장해주세요."
```

### Step 4.2: Executive Summary 생성

```markdown
## Executive Summary

| Task | Key Metric | Baseline | Proposed | Difference |
|------|-----------|----------|----------|------------|
| {각 실험 task별 핵심 비교 결과} |

생성 규칙:
- Baseline은 기존 study에 기록된 vanilla/default 결과
- Proposed는 이번 실험의 결과
- Difference는 절대값 + 방향 (+/-) 포함
- 가장 중요한 메트릭 우선 배치
```

### Step 4.3: Figure 해석 작성

```
각 Figure에 대해:

1. Figure 참조 삽입:
   ![Figure N: {descriptive caption}](figures/{filename}.png)

2. 해석 문단 작성 (Topic-First 원칙):
   **Figure N 해석**: {핵심 관찰}. {상세 설명}. {baseline 대비 차이}.
   {가능한 원인/메커니즘 분석}.

3. 해석 품질 기준:
   - 정량적: 수치로 차이를 기술
   - 비교적: baseline 또는 이전 실험과 대비
   - 인과적: 왜 이런 패턴이 나타나는지 가설 제시
```

### Step 4.4: Proposed Improvements 작성

```
각 개선안에 대해 4-part 구조:

### 3.N {Method Name}

**Problem**: {실험 결과에서 발견된 구체적 문제}
  - 수치 근거 포함 (source: filepath:L행번호)
  - Figure 참조 포함 (Figure N 참조)

**Solution**: {제안하는 해결 방법}
  - 기존 연구/이론적 근거 제시
  - 구현 방향 설명

```python
# 구현 예시 코드
class ImprovedComponent:
    ...
```

**Expected Effect**: {예상 개선 효과}
  - 정량적 예측 (예: "accuracy +2-3%p 향상 예상")
  - 근거 설명
```

### Step 4.5: Writing Quality Loop

작성된 초안에 대해 품질 평가 수행:

```
평가 기준 (references/quality-criteria.md 참조, 가중치 업데이트):

1. Definition-First (25점)
   - 모든 전문 용어가 "X is Y" 형태로 정의되었는가?
   - 새로운 개념이 사용 전에 정의되었는가?

2. Topic-First Paragraphs (20점)
   - 모든 문단이 핵심 결과/주장으로 시작하는가?
   - 첫 문장만 읽어도 문단 내용을 파악할 수 있는가?

3. Compare-Contrast (15점)
   - 새 결과가 이전 실험과 비교되었는가?
   - 차이의 원인/해석이 제시되었는가?

4. Insight Depth (15점)
   - 표면적 기술을 넘어 "왜"에 대한 분석이 있는가?
   - 예상과 다른 결과에 대한 가설이 있는가?

5. Minimal Adjectives (5점)
   - 불필요한 수식어가 없는가?
   - 주관적 표현 대신 구체적 수치가 사용되었는가?

6. Figure Quality (10점) [NEW]
   - 모든 Figure에 해석 문단이 있는가?
   - Figure caption이 내용을 정확히 기술하는가?
   - Figure 참조가 본문에서 올바르게 연결되었는가?

7. Next Steps Clarity (10점) [NEW]
   - 다음 실험이 가설과 명확히 연결되었는가?
   - Config 변경 사항이 구체적인가?
   - 예상 결과와 근거가 제시되었는가?

총점: /100
통과 기준: >= 80점
```

### Step 4.6: Revision (점수 < 80인 경우)

```
1. [Critical: Definition Missing]
   - 미정의 용어 목록 작성
   - 각 용어에 대해 "X is Y" 정의 추가

2. [Critical: Topic-Last Paragraph]
   - 문단 재구성: 핵심 → 설명 → 근거 순서로

3. [Warning: No Comparison]
   - 이전 실험과의 비교 테이블 추가
   - 차이 분석 문단 추가

4. [Warning: Shallow Insight]
   - "왜 이런 결과가 나왔는가?" 분석 추가
   - 가설 강화

5. [Minor: Excessive Adjectives]
   - "significantly improved" → "+12.5%p"
   - "much faster" → "2.3x speedup"

6. [Warning: Figure Without Interpretation]
   - 해석 없는 Figure에 해석 문단 추가
   - Caption이 부정확한 경우 수정

7. [Warning: Vague Next Steps]
   - 가설과의 연결 명확화
   - Config 변경 구체화
```

### Step 4.7: Iteration Control

```
최대 반복: 3회

Iteration 1: 초안 → 품질 평가 → 수정 (필요시)
  → Score >= 80: Phase 5로 진행
  → Score < 80: feedback 수집

Iteration 2: 수정안 → 재평가
  → Score >= 80: Phase 5로 진행
  → Score < 80: feedback 수집

Iteration 3: 최종 수정 → 재평가
  → Score >= 80: Phase 5로 진행
  → Score < 80: 현재 최선 버전으로 진행 + 이슈 보고
```

---

## Phase 5: Verification (experiment-verifier)

### Task Tool 호출

```
Task tool 사용:
- subagent_type: "experiment-verifier"
- prompt:

  "다음 study.md 업데이트 내용을 검증해주세요.

  ## 검증 대상 (새로 추가된 섹션)
  {Phase 4에서 작성한 내용}

  ## 원본 로그 파일 경로
  {각 로그 파일의 전체 경로}

  ## 기존 study.md (변경 여부 확인용)
  {기존 study.md 내용}

  ## 생성된 Figure 목록
  {figures/ 디렉토리 내용}

  ## 검증 요구사항
  1. 모든 수치를 원본 로그와 대조 (파일:라인 직접 확인)
  2. Executive Summary 테이블의 수치 정확성
  3. Figure 해석이 실제 데이터와 일치하는지 확인
  4. 해석의 논리적 타당성 검증
  5. 모든 가설의 falsifiability 확인
  6. 다음 실험의 실행 가능성 확인
  7. 기존 결과 변경 여부 확인
  8. 코드 스니펫의 문법 정확성

  ## 출력
  JSON 형식의 검증 보고서를 반환해주세요."
```

### 결과 처리

```python
if verdict == "PASS":
    # Phase 6로 진행
elif iteration < 3:
    # feedback_summary를 Phase 4로 전달
    # interpreter에게 수정 요청
else:
    # 최대 반복 도달
    # 현재 최선 버전 저장
    # 미해결 이슈 사용자에게 보고
```

---

## Phase 6: Export

### Step 6.1: Markdown 확정

```
1. study.md 최종 내용 저장
2. [NEW] 태그가 포함된 섹션 확인
3. Figure 참조 경로 검증 (figures/*.png 존재 확인)
4. 상대 경로 정규화
```

### Step 6.2: LaTeX 변환 + PDF 생성 (우선 방식)

```bash
# scripts/export_latex_pdf.py 사용 (Figure 포함 LaTeX 변환)
python scripts/export_latex_pdf.py \
  study.md \
  study.pdf \
  --figures-dir figures/ \
  --template academic

기능:
- Markdown → LaTeX 변환
- Figure 자동 삽입 (\includegraphics)
- 학술 논문 레이아웃 (twocolumn 옵션 가능)
- TOC (Table of Contents) 포함
- [NEW] 태그 시각적 강조
- 테이블 포맷팅 (booktabs 스타일)
- 코드 블록 문법 강조 (listings/minted)
- 참고문헌 섹션
```

### Step 6.3: Fallback PDF 변환

```bash
# LaTeX 변환 실패 시 기존 방식 사용
python scripts/export_pdf.py study.md study.pdf

Fallback 순서:
1. scripts/export_latex_pdf.py (LaTeX + Figure, 최상의 품질)
2. scripts/export_pdf.py → pandoc + LaTeX (Figure 수동 포함)
3. scripts/export_pdf.py → weasyprint (HTML 기반)
4. Markdown만 저장 (PDF 변환 실패 시 경고)
```

### Step 6.4: 완료 보고

```
Update Complete!
  Markdown: study.md
  PDF: study.pdf
  Figures: figures/ ({N}개 PNG)
  New experiments: {N}개
  Writing quality: {score}/100
  Hypotheses: {N}개
  Next experiments: {N}개
```

---

## Document Update Rules

### Append Only 원칙

1. **Append Only**: 기존 내용 뒤에 새 섹션 추가. 기존 내용 수정 금지.
2. **[NEW] 태그**: 새로 추가된 실험에 `[NEW]` 태그 표시 (다음 업데이트 시 제거)
3. **구분선**: 새 실험 전에 `---` 구분선 삽입
4. **날짜 표기**: 실험 실행 날짜 (로그 타임스탬프 기반)
5. **일관된 포맷**: Report Template + references/interpretation-template.md 준수

### [NEW] 태그 처리

```markdown
---

### [NEW] Experiment: {experiment_name} ({YYYY-MM-DD})

...
```

다음 `/update-study` 실행 시:
1. 이전에 추가된 `[NEW]` 태그 모두 제거
2. 새로 추가되는 섹션에만 `[NEW]` 태그 부여

---

## Progress Reporting

실행 중 사용자에게 상태를 보고합니다:

```
[Phase 0] Incremental Detection...
  Scanned logs/: {N}개 파일
  Already documented: {M}개 실험
  New experiments: {K}개 발견

[Phase 1] File Verification...
  로그 파일 확인: {K}개
  study.md 읽기 완료

[Phase 2] Data Extraction...
  메트릭 추출: {N}개 시계열
  DataFrame 구조화 완료
  메트릭 종류: accuracy, loss, grad_norm, ...

[Phase 3] Plot Generation...
  Training curve comparison: figures/training_curve_comparison.png
  Metric trend panel: figures/metric_trend_panel.png
  Final metric comparison: figures/final_metric_comparison.png
  총 {N}개 Figure 생성

[Phase 4] Interpretation + Writing...
  Executive Summary 생성 완료
  Figure 해석 작성: {N}개
  Proposed Improvements: {N}개
  → Writing Quality Loop:
    Iteration 1: Score 72/100
      - Critical: Definition missing (2)
      - Warning: Figure without interpretation (1)
    Iteration 2: Score 85/100
      All critical issues resolved

[Phase 5] Verification...
  → Numerical: {verified}/{total}
  → Logic: {sound}/{total}
  → Figure consistency: {matched}/{total}
  → Verdict: PASS

[Phase 6] Export...
  LaTeX 변환 완료
  PDF 생성 완료: study.pdf

Complete!
  - New experiments: {experiment_names}
  - Writing quality: {score}/100
  - Figures: {N}개
  - Hypotheses: {N}개
  - Next experiments: {N}개
```

---

## Quality Criteria Summary

| Criterion | Weight | Description |
|-----------|--------|-------------|
| Definition-First | 25점 | 용어 100% 정의, "X is Y" 형태 |
| Topic-First | 20점 | 문단 90% 두괄식 |
| Compare-Contrast | 15점 | 비교 테이블 + 차이 분석 필수 |
| Insight Depth | 15점 | "왜" 분석 + mechanism 가설 포함 |
| Minimal Adjectives | 5점 | 수치 기반 표현, 형용사 최소화 |
| Figure Quality | 10점 | Figure 해석 + caption + 참조 연결 |
| Next Steps Clarity | 10점 | 가설 연결 + config 구체성 + 예측 |

**Overall Pass: >= 80점**

---

## Additional Resources

- `references/interpretation-template.md` - 실험 해석 템플릿
- `references/quality-criteria.md` - 글 품질 평가 상세 기준
- `scripts/generate_plots.py` - matplotlib 기반 차트 생성 유틸리티
- `scripts/export_latex_pdf.py` - LaTeX 변환 + Figure 포함 PDF 생성
- `scripts/export_pdf.py` - PDF 변환 유틸리티 (Fallback)

---

## Cautions

1. **로그 파일이 ground truth**: 로그에 없는 수치는 사용 불가
2. **Append Only**: 이전 결과를 절대 수정하지 않음
3. **매 수치에 출처**: `(source: filepath:L행번호)` 필수
4. **가설은 falsifiable**: 검증 불가능한 가설은 삭제
5. **최대 3회 반복**: Writing Quality Loop + Verification 각각 최대 3회
6. **새 실험 우선**: 이미 문서화된 실험은 자동 스킵
7. **[NEW] 태그**: 새 추가분 명확히 표시
8. **Figure 필수**: 모든 실험 보고서에 최소 1개 이상의 Figure 포함
9. **코드 스니펫 검증**: Implementation/Improvements 코드는 문법 정확성 확인
10. **LaTeX 호환성**: Markdown 내 특수문자 이스케이프 확인 (_, %, #, & 등)
