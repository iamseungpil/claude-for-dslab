# Experiment Interpretation Template

실험 해석 섹션 작성 시 이 템플릿을 따르세요.

---

## 기본 구조

```markdown
---

### [NEW] Experiment: {experiment_name} ({YYYY-MM-DD})

#### Configuration

| Parameter | Value |
|-----------|-------|
| Config | `{yaml_path}` |
| Mode | {mode_description} |
| Compressor | {compressor_type} |
| Key Params | {relevant_params} |
| Training | {epochs, lr, batch_size} |

#### Results

| Metric | Value | Source |
|--------|-------|--------|
| Accuracy | {X.XX%} | `{log_file}:L{line}` |
| Train Loss (final) | {X.XXXX} | `{log_file}:L{line}` |
| Grad Norm (final) | {X.XX} | `{log_file}:L{line}` |
| Total Cycles | {N} | `{log_file}:L{line}` |

#### Comparison with Prior Results

| Experiment | Accuracy | Δ |
|-----------|----------|---|
| {baseline_1} | {X.XX%} | baseline |
| **This (E{N})** | {X.XX%} | {+/-X.XX%p} |
| {previous_1} | {X.XX%} | {+/-X.XX%p} |

#### Interpretation

{Definition-first 원칙에 따른 해석}

{Experiment name}은 {무엇을 하는 실험인지 정의}이다. 이 실험의 핵심 결과는 {핵심 수치}로, 이는 {baseline 대비 비교}를 의미한다.

{Compare-contrast 분석}

이전 실험({previous_experiment})과 비교하면, {구체적 차이점}. 이러한 차이가 발생한 이유는 {가설적 설명}으로 추정된다.

{Insight depth - "왜"에 대한 분석}

{예상과 다른 결과 또는 예상과 일치하는 결과}에 대해, 가능한 설명은 {mechanism 설명}이다. 이는 {supporting evidence}에 의해 뒷받침된다.

#### Hypotheses

**H{N}: {One-sentence falsifiable claim}**
- Based on: {specific results from this experiment}
- Mechanism: {proposed explanation}
- Prediction: {testable prediction - "만약 X라면 Y가 관찰될 것이다"}
- Falsification: {what would disprove this - "Z가 관찰되면 이 가설은 기각된다"}

**H{N+1}: {Another hypothesis}**
- Based on: {different result}
- Mechanism: {explanation}
- Prediction: {prediction}
- Falsification: {falsification criteria}

#### Next Experiments

**E{N+1}: {Experiment name}**
- Tests: H{N}
- Config changes:
  ```yaml
  recursive_memory:
    {parameter}: {new_value}  # was: {old_value}
  ```
- Expected: {predicted outcome if H{N} is correct}
- Priority: {High/Medium/Low}

**E{N+2}: {Another experiment}**
- Tests: H{N+1}
- Config changes:
  ```yaml
  {config_changes}
  ```
- Expected: {prediction}
- Priority: {High/Medium/Low}
```

---

## 작성 지침

### 1. Configuration 섹션

- 모든 파라미터 값은 로그/config 파일에서 직접 확인
- 학습 관련 핵심 파라미터만 포함 (불필요한 상세 생략)
- 이전 실험과 다른 파라미터는 **굵게** 표시

### 2. Results 섹션

- **모든 수치에 출처 필수**: `{log_file}:L{line}` 형식
- 소수점 일관성 유지 (accuracy: 2자리, loss: 4자리)
- 핵심 메트릭 우선 배치 (accuracy → loss → grad_norm → cycles)

### 3. Comparison 섹션

- 반드시 baseline과 비교
- 직전 실험과 비교
- 동일 계열 실험들과 비교 (있는 경우)
- Δ는 퍼센트포인트(%p) 단위로 표기

### 4. Interpretation 섹션

**Definition-First 원칙**:
- 첫 문장: 실험이 무엇인지 정의
- "X는 Y이다" 형태로 시작

**Topic-First 원칙**:
- 각 문단의 첫 문장 = 핵심 주장/결과
- 뒤따르는 문장은 근거/설명

**Compare-Contrast 원칙**:
- 새 결과 vs 이전 결과 명시적 비교
- 차이의 원인 분석 포함

**Insight Depth**:
- "왜"에 대한 가설적 설명 필수
- 표면적 기술 지양 ("accuracy가 높다" → "왜 높은가?")

### 5. Hypotheses 섹션

**Falsifiable 요건**:
- Prediction: 구체적이고 측정 가능한 예측
- Falsification: 명확한 기각 조건

**좋은 예**:
```
**H3: Cross-attention은 context와 latent 간 정보 흐름을 개선한다**
- Prediction: Cross-attention 제거 시 accuracy가 5%p 이상 하락할 것이다
- Falsification: Cross-attention 제거 후 accuracy 변화가 2%p 미만이면 기각
```

**나쁜 예**:
```
**H3: Cross-attention이 도움이 된다**  ← 모호함
- Prediction: 성능이 좋아질 것이다  ← 측정 불가
- Falsification: 없음  ← 기각 조건 없음
```

### 6. Next Experiments 섹션

- Config 변경 사항 구체적으로 명시
- 어떤 가설을 검증하는지 연결
- 예상 결과와 그 근거 제시
- Priority 기준:
  - High: 핵심 가설 검증, 큰 성능 개선 예상
  - Medium: 보조 가설 검증, 중간 규모 개선
  - Low: 탐색적 실험, 작은 변형

---

## Source Citation 규칙

```
✓ 올바른 예:
| Accuracy | 87.34% | `logs/evolve_h_only_train.log:L1542` |

✗ 잘못된 예:
| Accuracy | 87.34% |  (출처 없음)
| Accuracy | ~87% | `logs/evolve_h_only_train.log` (라인 번호 없음)
| Accuracy | 87.34% | 로그 참조 (파일명 없음)
```

---

## 품질 체크리스트

작성 완료 후 확인:

- [ ] 모든 수치에 `{file}:L{line}` 출처가 있는가?
- [ ] 실험 정의가 첫 문장에 있는가?
- [ ] 이전 실험과의 비교가 있는가?
- [ ] "왜"에 대한 분석이 있는가?
- [ ] 모든 가설이 falsifiable한가?
- [ ] 다음 실험이 가설과 연결되어 있는가?
