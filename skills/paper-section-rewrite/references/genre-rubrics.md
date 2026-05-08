# 장르별 의무 단락 (Genre Rubrics)

학술 글의 장르를 가장 먼저 라벨링하면, 그 장르가 요구하는 **의무 단락 N개**가 자동 도출된다. 이 문서는 5가지 장르의 의무 구성을 정의한다.

승필 합평에서 추출된 R1·R2 원리: "글의 종류 명명 → 그 장르가 요구하는 단락이 모두 있는가" 점검. 누락 시 즉시 fail-fast.

---

## 사용 방법

1. Stage 0.5에서 사용자가 글의 장르 한 줄로 라벨 (예: "5문단 연구 제안서")
2. 이 문서에서 해당 장르의 의무 단락 목록을 가져옴
3. Stage 3 outline에서 각 lead가 어느 의무 단락에 해당하는지 라벨링 의무화
4. 라벨 못 붙는 lead = 잉여, 라벨 비는 의무 단락 = 누락 (R2 fail-fast)

---

## 장르 1: 연구 제안서 (Research Proposal) — 5문단 디폴트

> 정의: 새로운 모델·방법·접근의 설명과 그 차별성을 논증하는 글
>
> 합평 톤(승필): "새로운 모델의 설명과 그 차별성을 논증하는 제안서"

| # | 역할 | lead의 사명 | 주된 서술 방식 |
|---|---|---|---|
| 1 | **배경/동기** | 이 분야에서 무엇이 미해결 / 왜 중요한지 한 문장 | 정의 / 인과 |
| 2 | **기존 한계** | 기존 방법의 구체적 한계 (단순 나열 X, 본인 제안과 직결되는 한계만) | 분석 / 대조 |
| 3 | **제안** | 본 연구가 무엇을 제안하는가 (모델·방법의 핵심 발상) | 정의 / 분석 |
| 4 | **차별성** | 기존 대비 본 제안이 다른 점 (R5 핵심) | 비교/대조 |
| 5 | **평가/기여** | 어떻게 검증할 것인가 + 기대 효과 | 과정 / 인과 |

### 한국어 5문단 lead 예시

```
1. 인공지능에서 일반화와 적응력은 별개로 다뤄져 왔다.
2. 기존 LLM·생성 모델은 일반화는 강하나 적응력은 부족하다.
3. 본 연구는 사용자 궤적 + 프로그램 합성을 결합한 프레임워크를 제안한다.
4. 기존 뉴로-심볼릭과 달리 사람 궤적으로 사전 지식을 갱신한다.
5. ARC 벤치마크에서 zero-shot/few-shot으로 검증한다.
```

### 영어 5-paragraph lead example

```
1. Generality and adaptation in AI have been studied separately.
2. Existing LLMs and generative models excel at generality but lack adaptation.
3. We propose a framework that combines user trajectories with program synthesis.
4. Unlike prior neuro-symbolic work, we update prior knowledge from human trajectories.
5. We evaluate on ARC under zero- and few-shot conditions.
```

---

## 장르 2: 방법론 설명 (Method Explanation) — 4문단

| # | 역할 | lead의 사명 |
|---|---|---|
| 1 | 동기 | 왜 이 방법이 필요한가 |
| 2 | 전체 구조 | 방법의 high-level 흐름 |
| 3 | 구성 요소 | 주요 모듈·수식·하이퍼파라미터 |
| 4 | 작동 예시 | 입력 → 출력 한 사례 |

---

## 장르 3: 실험 보고 (Experiment Report) — 5문단

| # | 역할 | lead의 사명 |
|---|---|---|
| 1 | 가설 | 무엇을 검증하는가 |
| 2 | 셋업 | 데이터·모델·평가 지표 |
| 3 | 결과 | 핵심 수치 한 문장 |
| 4 | 해석 | 결과가 가설을 어떻게 지지·반박하는가 |
| 5 | 한계 | 일반화 가능 범위와 위협 |

### 결과/논의 섹션 내부 권장 흐름 ★

논문의 결과·논의 섹션을 본 스킬이 다룰 때 단락 lead들이 다음 4단으로 배열되는 것이 권장된다. paper-section-rewrite Level 2 Step 2.4의 게이트가 이 흐름을 점검한다.

```
의도(질문) → 방법 요약 → 결과 → 해석
```

| 단계 | lead의 사명 | 권장 시그널 표현 | 길이 |
|---|---|---|---|
| **의도(질문)** | 본 실험·본 단락이 어떤 질문을 푸는지 한 문장 | "본 실험은 ~를 검증한다 / ~인지 묻는다" | 1문장 |
| **방법 요약** | 그 질문을 어떤 셋업으로 검증하는지 한 문장 (디테일은 부록·이전 섹션 참조 X — **자기 완결적 1줄 요약** 패러프레이징) | "ARC 1k에 X 모델을 zero-shot으로 평가한다" | 1문장 |
| **결과** | 핵심 수치를 본 단락의 thesis로 (단순 나열 X, 가장 중요한 수치 한 줄) | "X는 zero-shot 78%로 baseline 대비 +12%p" | 1문장 |
| **해석** | 그 결과가 무엇을 의미하는지 (단순 재진술 X, **왜 그런 차이가 났는지**에 답) | "이 차이는 사전 지식 갱신 모듈이 OOD 구조를 부분적으로 일반화하기 때문이다" | 1-2문장 |

### 자주 보는 안티패턴

| 위반 | 모습 | 처리 |
|---|---|---|
| 결과부터 시작 | P1 lead가 수치, 의도 누락 | 의도 단락 신설 |
| 방법 디테일 나열 | P2가 하이퍼파라미터·시드 나열 | 1줄 요약 + 디테일은 부록 인용 (자기 완결 1줄 우선) |
| 해석 누락 | P3에서 끝, 해석 단락 부재 | 해석 단락 신설 |
| 해석이 결과 재진술 | "X는 78%였다. 따라서 X는 78%였다" | "왜" 추가 — 메커니즘 가설 한 줄 |
| 비약 | 결과 → 해석에서 baseline·통계 유의성 빠짐 | 비교 한정 표현 추가 |

### 영어 4-step 예시

```
P1 [intent]      We test whether updating prior knowledge from human trajectories closes
                 the OOD generalization gap.
P2 [method]      We evaluate on ARC 1k under zero-shot using the same backbone as baseline.
P3 [result]      Our model reaches 78% zero-shot, +12%p over the strongest baseline.
P4 [interpret]   The gap aligns with prior-update activation, suggesting the mechanism
                 partially generalizes OOD structure rather than memorizing.
```

이 4단 흐름은 **결과/논의 장르일 때만** 적용. 다른 장르(서론·관련 연구·방법)는 기존 5문단 표를 따른다.

---

## 장르 4: 리뷰/서베이 (Review / Survey) — 5문단

| # | 역할 | lead의 사명 |
|---|---|---|
| 1 | 분야 정의 | 무엇을 다루는 분야인가, 왜 지금 정리가 필요한가 |
| 2 | 축 분류 | 분야를 어떤 축으로 분류해 정리하는가 |
| 3 | 축별 정리 | 각 축의 대표 연구·접근 |
| 4 | 공통 문제 | 모든 축에 공통된 미해결 과제 |
| 5 | 전망 | 향후 연구 방향 |

---

## 장르 5: 비평/논평 (Critique) — 5문단

| # | 역할 | lead의 사명 |
|---|---|---|
| 1 | 논점 | 비평하는 대상의 핵심 주장은 무엇인가 |
| 2 | 증거 검토 | 그 주장의 증거가 충분한가 |
| 3 | 반론 | 대안적 해석·반증 |
| 4 | 재반박 | 본 비평에 가능한 재반박과 응답 |
| 5 | 결론 | 본 비평이 도달한 입장 |

---

## R1·R2 자동 점검 (구현)

Stage 3 outline 채점 시 다음 의무 점검:

1. 사용자가 라벨한 장르의 의무 단락 목록을 인출
2. 각 lead sentence에 사용자가 단락 역할 라벨을 붙이도록 강제
3. 라벨 누락된 의무 단락이 있으면 → **R2 fail-fast** (즉시 NEEDS_WORK)
4. 의무 단락에 안 들어가는 잉여 lead가 있으면 → **R5 경고** (focus 어긋남 가능)

---

## 장르 모호 시

사용자가 라벨한 장르가 위 5종에 안 맞으면:
- 가장 가까운 장르로 매핑하고 그 의무 단락을 시작점으로 제시
- 또는 "이 글은 어떤 의무 구성을 가져야 할까요?" Q&A로 사용자가 정의하게 함 (장문 mode의 Stage 3-A와 같은 방식)
