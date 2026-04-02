# Experiment Report Template

실험 보고서 작성 시 이 템플릿을 따르세요.
`filtering_effect_seungpil_lee_en.pdf` 수준의 종합 보고서를 목표로 합니다.

---

## 전체 구조

```markdown
# {Title} Experiment Report

**Author**: {name} **Date**: {date} **Project**: {project}

## Executive Summary

{핵심 발견 1-2문단 요약. 과제별 비교 결과를 테이블로 제시.}

| Task | Expected Complexity | Baseline | Proposed | Difference |
|------|-------------------|----------|----------|------------|
| {Task A} | {~N calls} | {X.X%} | {Y.Y%} | {+Z.Z%p} |
| {Task B} | {~M calls} | {X.X%} | {Y.Y%} | {+Z.Z%p} |

---

## 1. Implementation

### 1.1 Overview

{기능/기법 개요. "X는 Y이다" 형식으로 시작.}

### 1.2 Implementation Structure

{단계별 구현 설명. 각 단계에 코드 스니펫 포함.}

**Stage 1: {단계명}**

{설명}

```python
# {코드 설명}
{핵심 코드 스니펫}
```

**Stage 2: {단계명}**

{설명 + 코드}

**Stage 3: {단계명}**

{설명 + 코드}

---

## 2. Experimental Results

### 2.1 {Task A}: {핵심 결과 한줄 (e.g., "+15.3%p Improvement")}

{Figure 1 설명 + 4가지 관점 해석}

Figure 1은 {무엇을 보여주는가}를 나타낸다.

Figure 1(a)는 {metric A}의 변화를 보여준다. {조건 A}에서는 {수치}를 달성했고,
{조건 B}에서는 {수치}에서 정체되었다. 이 {차이}는 {원인 분석}을 시사한다.

Figure 1(b)는 {metric B}의 변화를 보여준다. {해석}.

![Figure 1: {캡션}](figures/fig1_{name}.png)

### 2.2 {Task B}: {핵심 결과 한줄}

{Figure 2 설명 + 해석}

![Figure 2: {캡션}](figures/fig2_{name}.png)

### 2.3 {현상 분석 제목 (e.g., "Filtering Effect Varies with Trajectory Length")}

{비교 테이블 + Figure + mechanism 분석}

| Comparison Item | Condition A | Condition B |
|----------------|-------------|-------------|
| Effect | {수치} | {수치} |
| Observation | {설명} | {설명} |
| Problem Type | {유형} | {유형} |

{Figure 3 참조하여 해석. "왜 이런 차이가 발생하는가?" 분석 필수.}

![Figure 3: {캡션}](figures/fig3_{name}.png)

### 2.4 {한계점 분석 제목 (e.g., "Information Loss from Incorrect Answers")}

{Figure + 근거로 뒷받침되는 분석}

{이 한계점이 왜 발생하는지 mechanism 설명.}
{실험 데이터로 뒷받침되는 구체적 근거 제시.}

![Figure 4: {캡션}](figures/fig4_{name}.png)

### 2.5 Experimental Setup

| Item | Setting |
|------|---------|
| Model | {model_name} |
| GPU | {gpu_spec} |
| Dataset | {datasets} |
| Algorithm | {algorithm} |
| Batch size | {batch_size} |
| Learning rate | {lr} |
| Max turns | {max_turns} |

---

## 3. Proposed Improvements

### 3.1 {방법 A 제목 (e.g., "Dynamic Filtering: Trajectory-level Threshold Adaptation")}

{문제 정의}: Section 2.3에서 확인한 바와 같이, {문제 설명}.

{해결 방법}: {핵심 아이디어 설명}.

```python
# {구현 예시}
{pseudo-code 또는 실제 코드}
```

{기대 효과}: {예상되는 개선점 + 근거}

### 3.2 {방법 B 제목}

{문제 → 해결책 → 코드 → 기대 효과}

---

## 4. Limitations

{실험의 제한사항을 솔직하게 기술}

- **실험 환경**: {모델 크기, GPU 수 등의 제약}
- **일반화**: {threshold/파라미터의 일반화 가능성}
- **Task 범위**: {실험된 task의 범위와 미검증 영역}

---

## 5. Conclusion

{핵심 발견 요약 (수치 포함)}
{교훈: 왜 이 결과가 중요한가}
{향후 방향: 구체적인 다음 단계}

---

## 6. Next Experiments

### E{N+1}: {실험명}
- **Tests**: H{N} ({가설 한줄 요약})
- **Config changes**:
  ```yaml
  {parameter}: {new_value}  # was: {old_value}
  ```
- **Expected**: {가설이 맞다면 예상되는 결과}
- **Priority**: {High/Medium/Low}

### E{N+2}: {실험명}
- **Tests**: H{N+1}
- **Config changes**: {변경사항}
- **Expected**: {예상 결과}
- **Priority**: {High/Medium/Low}

---

## References

1. {Reference 1}
2. {Reference 2}
```

---

## 작성 지침

### Executive Summary

- 한눈에 핵심 결과를 파악할 수 있어야 함
- 비교 테이블 필수 (Task × Condition × Result)
- 가장 중요한 발견을 1-2문장으로 요약

### Implementation 섹션

- 각 Stage에 코드 스니펫 포함
- "왜 이렇게 구현했는가?" 설명
- 이전 구현(baseline)과의 차이점 명시

### Experimental Results 섹션

- **모든 Figure에 대해 4가지 관점**:
  1. **무엇을 보여주는가** (Figure 설명)
  2. **핵심 관찰** (수치 기반)
  3. **원인 분석** ("왜" + mechanism)
  4. **시사점** (다음 실험에 대한 함의)

- Figure 설명은 서브플롯별로 개별 해석
  - "Figure 1(a)는 ... Figure 1(b)는 ..."

### Proposed Improvements 섹션

- 문제 → 해결책 → 코드 → 기대 효과 구조
- 코드 예시는 실행 가능한 수준
- 실현 가능성과 복잡도 명시

### Next Experiments 섹션

- 반드시 가설(H)과 연결
- Config 변경사항 구체적으로 (YAML diff)
- 예상 결과와 그 근거 제시

---

## Figure 생성 가이드

### scripts/generate_plots.py 사용

```bash
# 4-subplot panel (학습 동태)
python scripts/generate_plots.py panel \
    --data-files baseline.csv proposed.csv \
    --labels "Baseline" "Proposed" \
    --metrics accuracy ratio reward_std count \
    --title "Task A Training Dynamics" \
    --output figures/fig1_training_dynamics.png

# 조건별 비교 차트
python scripts/generate_plots.py comparison \
    --data-files task_a.csv task_b.csv \
    --labels "Task A" "Task B" \
    --metric accuracy \
    --title "Effect Comparison" \
    --output figures/fig3_comparison.png

# 단일 metric 추이 + annotation
python scripts/generate_plots.py trend \
    --data-files experiment.csv \
    --labels "Experiment" \
    --metric unexpected_tool_call_ratio \
    --annotate "318-345:EXPLOSION (max 56%)" \
    --threshold 20 \
    --title "Ratio During Training" \
    --output figures/fig6_ratio_trend.png
```

---

## Source Citation 규칙

```
올바른 예:
| Accuracy | 74.1% | `logs/gsm8k_filter_on.log:L1542` |

잘못된 예:
| Accuracy | 74.1% |  (출처 없음)
| Accuracy | ~74% | `logs/gsm8k.log` (라인 번호 없음)
```

---

## 품질 체크리스트

- [ ] Executive Summary에 비교 테이블이 있는가?
- [ ] 모든 수치에 출처(file:line)가 있는가?
- [ ] 모든 Figure에 4가지 관점 해석이 있는가?
- [ ] "왜"에 대한 mechanism 분석이 있는가?
- [ ] Proposed Improvements에 코드 예시가 있는가?
- [ ] Limitations가 솔직하게 기술되어 있는가?
- [ ] Next Experiments가 가설과 연결되어 있는가?
- [ ] Config 변경사항이 구체적인가?
