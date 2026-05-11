---
name: paper-section-rewrite
description: 학술 논문·연구계획서 한 섹션을 LLM이 자율적으로 4-Level critic loop로 분석·개선하는 윤문 스킬. 설계 순서를 강제 — Level 1 내용 → Level 2 문단 간 구성 → Level 3 문단 내 구성 → Level 4 문장. Level 1·2·3는 CONVERGED skip 금지. 두괄식 + 의도(질문)→방법→결과→해석. paper-digest의 insight-first(단순 나열 X), iterative-academic-writing의 논리적 비약 0, humanize의 자연스러움(em-dash 0, 번역투 0, 계사 대용 관용구 "~에 해당한다/~로 기능한다/~에 위치한다/자리매김" 0, 동족어·중복어 stacking 0, "~하고자 한다" 비율 ≤ 30%, register 일관성, 개념어 과반복 회전, 종결어미 다양성). 한 문장 한 역할(One Sentence One Role) + 단문 비율 ≥ 60% 강제. ML 비전공자 가독성 게이트(약어 풀어쓰기 / 수식 전 자연어 / jargon ≤ 3 / 서술형 풀어쓰기 — 명사형 종결 금지). 섹션 자기 완결성. 본문+부록 전체 수식·notation 감사 (중복/혼용/오용/Orphan 검출). KO/EN + 연구계획서 장르 지원. MANDATORY TRIGGERS - 섹션 다시 쓰기, 섹션 윤문, 풀어쓰기, 두괄식, paper section rewrite, 연구계획서 윤문, 자연스럽게, AI 티 빼줘, ML-beginner, notation audit, em-dash 0, 단문, 단문 비율, 한 문장 한 역할, insight-first, 자기 완결, 논리적 비약, 서술형 풀어쓰기, 명사형 종결 금지, 계사 대용, 해당한다 위치한다 기능한다, 동족어 stacking, 하고자 한다 줄이기, register 일관성, 개념어 과반복, 종결어미 다양성
---

# Paper Section Rewrite v4

학술 논문 한 섹션을 받아서 **LLM이 자율적으로** 4-Level critic loop로 분석·개선 후 출력. **사용자에게 추가 질문 없음.** 모든 분석은 입력 텍스트만으로 진행되며, 분석 결과는 transparency를 위해 출력에 포함된다.

## 핵심 설계 — 4-Level Critic Loop ★

설계 순서를 위에서 아래로 강제한다. **각 Level은 CONVERGED 게이트를 통과한 후에만 다음 Level로 진행**한다 — 문장부터 손대지 않는다.

```
Level 1 [내용]         의도·내용 1문장 + insight-first  →  CONVERGED
Level 2 [문단 간 구성]  단락 outline + R1~R5 + 의도→방법→결과→해석  →  CONVERGED
Level 3 [문단 내 구성]  단락별 카테고리 흐름 + 권장 흐름 일치  →  CONVERGED
Level 4 [문장]         단문 게이트 + 자연스러움 + 논리적 비약 + ML-beginner  →  CONVERGED
```

위 4 Level이 모두 CONVERGED 후 통합 단계:

```
[Phase 0]   입력 정리
[Phase 0.5] 장르 라벨 + 의무 단락 자동 도출
[Phase 1]   Level 1 critic loop — 내용
[Phase 2]   Level 2 critic loop — 문단 간 구성
[Phase 3]   Level 3 critic loop — 문단 내 구성 (단락별)
[Phase 4]   Level 4 critic loop — 문장 (단락별)
[Phase 5]   섹션 통합 critic + 자기 완결성
[Phase 6]   본문+부록 수식·notation 감사
[Phase 7]   LaTeX 빌드 검증
```

각 critic loop는 **최대 3 라운드** 또는 **점수 정체 시** 종료. **Level 1·2·3는 CONVERGED 강제** — 구조가 안 잡힌 채로 다음 Level로 내려가지 않는다. 3 라운드 안에 못 잡으면 사용자에게 한 번만 보고 후 재시도하거나 가장 약한 게이트만 cosmetic으로 표시. Level 4는 cosmetic 잔존(예: 자연스러움 패턴 1~2개 잔존) 표시 후 다음 Phase 진행 가능.

## When to use

- "이 섹션 다시 써줘 / restructure this section"
- "구조부터 잡고 critic loop로 / 설계 순서대로"
- "비전공자도 이해할 수 있게 / ML 처음 접하는 사람도"
- "두괄식으로 / insight 중심으로 / 단순 나열 말고"
- "논리적 비약 없이 / 자연스럽게 / 번역투 빼줘 / AI 티 없게"
- "‘~에 해당한다 / ~로 기능한다’ 같은 표현 자연스럽게 / ‘~하고자 한다’ 좀 줄여줘"
- "수식 notation 본문·부록 같이 점검"
- "섹션 자기 완결적으로"
- 한국어/영어 학술 논문 섹션 윤문
- 한국어 연구계획서·제안서 한 절 윤문 (필요성 / 선행연구 / 방법 / 활용·기대효과 / 일정 / 예산)

## When NOT to use

- 논문 PDF 전체에 마진 코멘트 달기 → `paper-readability-review`
- 처음부터 단계적으로 작성하며 학습 → `academic-writing-trainer` (사용자가 직접 작성, Coach 코칭)
- 단일 단락 social-share 요약 → `paper-digest`
- 일반적 humanize → `humanize-writing` 또는 `humanize-korean`

## References

본 스킬은 다음 reference 파일을 critic 시 참조한다 (academic-writing-trainer와 공유).

- `references/writing-principles-ko.md` — 4축, 9 서술 방식, 단락 권장 흐름, 단문 원칙, 자연스러움 원칙, 서술형 풀어쓰기(ML + 비-ML 예시), 개념어 과반복 회전, 종결어미 다양성, 자기 완결 원칙
- `references/genre-rubrics.md` — 6장르의 의무 단락 (연구계획서 full 포함) + 결과 섹션 내부 권장 흐름(의도→방법→결과→해석)
- `references/feedback-corpus.md` — 합평 원문 (R1~R5 문단 간 few-shot + R6 문장 단위 자연스러움 few-shot — 연구계획서 worked example)
- `references/banned-phrases-ko.md` / `references/banned-phrases-en.md` — 금지어 + grep 패턴 (§7 계사 대용, §8 동족어 stacking, §9 register 불일치 포함)
- `references/scoring-rubrics.md` — 4축 채점표 + Pass/Fail 게이트 + 통과 임계

critic 출력 시 reference의 R 라벨, 카테고리 라벨, 게이트 이름을 그대로 인용한다.

---

## Phase 0: 입력 정리

다음을 입력 텍스트·문맥에서 자동 식별한다 (사용자에게 묻지 않음):

- 섹션 텍스트 (LaTeX 또는 prose)
- 부록 텍스트 (있으면 — Phase 6에서 본문과 함께 감사)
- 페이지 budget — 명시 없으면 입력 분량 유지가 디폴트
- 언어 — KO/EN 자동 감지
- 사용 가능한 인용 키 / 수식 심볼 / 약어 사전 (입력 안에 있는 것만)

명시 정보 부족 시 합리적 디폴트 적용 (질문 X).

## Phase 0.5: 장르 라벨 + 의무 단락 자동 도출

`genre-rubrics.md` 참조. R1·R2 적용.

1. 섹션의 장르를 입력 텍스트에서 자동 추론 (서론 / 관련 연구 / 방법 / 결과 / 논의 등)
2. 그 장르의 의무 단락 목록 인출
3. 결과/논의 섹션이면 **내부 권장 흐름**(의도(질문) → 방법 요약 → 결과 → 해석)도 같이 인출
4. 현재 섹션이 의무 단락을 모두 포함하는지 자체 점검 — 누락 시 Phase 2에서 신설 (R2 fail-fast)

---

## Phase 1: Level 1 critic loop — 내용

trainer Stage 1·2와 동일한 분석을 LLM이 자율적으로 수행. **여기서는 단락도 문장도 손대지 않는다.** 의도·내용 명제만 다룬다.

### Step 1.1 — 의도 1문장 자동 추출

입력 섹션이 무엇을 하려는지 1문장으로 요약. 동사 명시 (제안한다 / 보인다 / 분석한다 / 보고한다).

### Step 1.2 — 내용 claim 1문장 자동 추출

의도를 어떤 구체 내용으로 달성하는지 1문장.

### Step 1.3 — Insight-first 게이트 ★ NEW

`paper-digest`의 핵심 원칙: **단순 나열 X. "왜 중요한가"가 첫 문장에 와야 한다.** 의도·내용 두 문장이 단순 사실 나열인지 insight-first인지 자체 점검.

```
의도 1문장 insight-first 점검:
  ✗ 단순 나열:  "본 연구는 모듈 A, B, C를 제안한다."
  ✓ insight:   "본 연구는 OOD 일반화 격차를 사전 지식 갱신으로 메우는 프레임워크를 제안한다."
                — 무엇이 새로운지(WHY)가 첫 문장에 들어옴.
```

판정: 의도·내용 1문장이 "what을 한다"에 머물면 ✗. "why가 새롭다 / 무엇을 푼다"가 명시되면 ✓.

### Step 1.4 — R5 정렬 자체 점검

의도와 내용이 정합되는지, 글의 thesis가 도구가 아닌 모델·방법 자체인지 자체 점검.

R5 위반 발견 시 (예: 의도가 "모델 제안"인데 내용이 "와서스타인 거리만 강조"이면) Level 2 outline 단계에서 재배치하도록 메모.

### Step 1.5 — Level 1 critic loop

| 게이트 | 통과 조건 |
|---|---|
| 의도 1문장 명확성 | 동사 lock + 1문장 |
| 내용 1문장 정합 | 의도와 supporting 관계 |
| Insight-first | "what 나열" → "why 명시"로 재작성 완료 |
| R5 thesis 정렬 | 도구가 아닌 방법·결과 자체가 thesis |

미달이면 LLM이 두 문장을 자율 재작성 (최대 3 라운드). 4 게이트 모두 통과 = **Level 1 CONVERGED → Level 2 진행**.

---

## Phase 2: Level 2 critic loop — 문단 간 구성

**문단을 어떻게 배열할지**만 다룬다. 문장은 아직 손대지 않는다.

### Step 2.1 — 현재 단락 lead 추출

입력 섹션의 단락별 첫 문장을 lead로 추출. 단락 N개에 lead N개.

### Step 2.2 — 단락 역할 자동 라벨링

각 lead에 장르 의무 단락 중 어느 역할인지 자동 라벨.

### Step 2.3 — R1~R5 자체 점검

| R | 자체 점검 | 위반 시 조치 |
|---|---|---|
| R1 | 장르 라벨링 완료 (Phase 0.5에서) | — |
| R2 | 의무 단락 모두 채워졌는가 | 누락 단락 추가 |
| R3 | 인접 단락 흐름 정상 (배경→한계→제안→차별성→평가) | 단락 순서 재배열 |
| R4 | 인접 단락 의미 중복 | 두 단락 통합 |
| R5 | 모든 lead가 섹션 thesis 지지 | 잉여 단락 제거 또는 재할당 |

### Step 2.4 — 결과 섹션 내부 권장 흐름 점검 ★ NEW

장르가 **결과/논의/실험 보고**일 때 추가 게이트. `genre-rubrics.md`의 결과 섹션 내부 흐름:

```
의도(질문) → 방법 요약 → 결과 → 해석
```

이 4단이 단락 lead 시퀀스에 그대로 매핑되는지 점검. 예:

```
P1 lead [의도/질문]: "본 실험은 ~를 검증한다."           ✓ 의도
P2 lead [방법 요약]: "ARC 1k 문제에 ~ 모델을 ~ 조건으로 평가한다."  ✓ 방법
P3 lead [결과]:     "본 모델은 zero-shot 78%로 baseline 대비 +12%p."  ✓ 결과
P4 lead [해석]:     "이 차이는 사전 지식 갱신 모듈의 역할로 설명된다."  ✓ 해석
```

위반 (예: 결과가 먼저 나오고 의도가 뒤) → Step 2.5에서 재배치.

### Step 2.5 — Insight-first 게이트 (단락 lead) ★ NEW

각 lead가:
- ✗ 단순 사실 나열 ("본 모델은 ~ 모듈로 구성된다") — what만
- ✓ Insight 제시 ("본 모델은 사전 지식 갱신으로 OOD 격차를 메운다") — why가 보임

위반 lead는 Phase 3에서 재작성하도록 메모.

### Step 2.6 — Level 2 critic loop (최대 3 라운드)

| 게이트 | 통과 조건 |
|---|---|
| R1·R2 | 장르 라벨 + 의무 단락 누락 0 |
| R3 | 인접 흐름 역전 0 |
| R4 | 인접 단락 중복 0 |
| R5 | 모든 lead가 thesis 지지 |
| 결과 섹션 내부 흐름 | 의도→방법→결과→해석 (해당 장르 시) |
| Insight-first lead | 모든 lead가 insight 제시 |

모두 통과 = **Level 2 CONVERGED → Level 3 진행**.

---

## Phase 3: Level 3 critic loop — 문단 내 구성 (단락별)

**단락 내부의 문장 카테고리 흐름**만 다룬다. 문장 표현은 아직 손대지 않는다.

### 단락별 substep (각 단락 P_i에 대해)

#### Step 3.i.1 — 현재 문장 카테고리 라벨링

P_i의 모든 문장에 9가지 서술 방식 중 하나로 라벨 (`writing-principles-ko.md` 시그널 표현 사용).

#### Step 3.i.2 — 권장 흐름과 비교

`writing-principles-ko.md`의 단락 역할별 권장 흐름 표 참조. 누락 의무 카테고리 / 잉여 회피 카테고리 식별.

#### Step 3.i.3 — 단락 재구조

위 분석에 따라 LLM이 P_i를 재구조 (문장 추가·제거·이동·순서 재배치). 표현 다듬기는 다음 Level에서.

#### Step 3.i.4 — 재구조 후 라벨 재점검

흐름이 권장 흐름과 일치하는지 다시 라벨링. 역할 정합도 5/5 목표.

### Step 3 — Level 3 critic loop

| 게이트 | 통과 조건 |
|---|---|
| 카테고리 흐름 일치 | 모든 단락 역할 정합도 ≥ 4/5 |
| 의무 카테고리 충족 | 단락별 의무 카테고리 모두 등장 |
| 잉여 회피 제거 | 회피 카테고리 0 또는 단락 역할에 합당 |

모두 통과 = **Level 3 CONVERGED → Level 4 진행**.

---

## Phase 4: Level 4 critic loop — 문장 (단락별)

여기서 비로소 **문장 표현**을 손댄다. 4개 게이트가 동시에 작동.

### 단락별 substep (각 단락 P_i에 대해)

#### Step 4.i.1 — 단문 게이트 (Hard Rule) ★

재작성된 모든 문장이 **정확히 하나의 카테고리**만 가지는지 점검. 두 카테고리를 짊어진 문장은 즉시 ✗ → 분할.

```
P_i 단문 게이트:
S1 [정의]              ✓ 단일 카테고리
S2 [혼합:비교+평가]    ✗ "X는 Y와 달리 Z를 더 잘 처리한다"
                          → 분할: "X는 Y와 다르다.[비교] X는 Z를 Y보다 더 잘 처리한다.[평가]"
```

검출 규칙: `-며 / -고 / -지만 / -에 의해`로 두 절을 잇고 각 절이 다른 카테고리면 분할. 시간·장소 부사절·인용절은 카테고리 외로 단일 인정.

길이 가이드: KO 50자 / EN 20 words 이내. 길이만으로 ✗는 아니지만, 길이 + 카테고리 2개 동시 발생 시 우선순위 최상.

**단문 비율 게이트 (Hard)** ★ NEW: 단락 안 단문(KO 50자 / EN 20w 이내) 비율 **≥ 60%** 강제. 미만이면 prose가 무거워지고 ML 비전공자 가독성이 떨어진다. 60% 미만 단락은 substep 자동 fail → 긴 문장을 분할하거나 압축해 비율 통과시킨 뒤 재라벨. 80% 이상은 호평.

하이브리드 라벨 `[정의(+인과)]` **금지** — 무조건 `[혼합:A+B] ✗`로 표기 후 분할.

상세: `writing-principles-ko.md` "단문 원칙 — One Sentence, One Role" 절.

#### Step 4.i.2 — 자연스러움 게이트 ★ NEW

`humanize-writing` / `humanize-korean`의 핵심 패턴 검출. **em-dash 0은 정량 게이트지만, 자연스러움은 다음 패턴들의 누적으로 본다.**

| 패턴 | 한국어 시그널 | 영어 시그널 |
|---|---|---|
| **번역투 대조구문** | "~에 대한 / ~에 의해 / ~을 통해" | "with respect to / by means of / through which" |
| **계사 대용 관용구** ★ NEW | "~에 해당한다 / ~에 위치한다 / ~로 기능한다 / ~로 자리매김하다 / ~방향에 있다 / ~핵심에 해당한다 / 입력으로 기능한다" (`banned-phrases-ko.md` §7) | "serves as / functions as / is positioned within / amounts to" 남발 |
| **동족어·중복어 stacking** ★ NEW | "산출물을 산출 / 연구의 연구 / 다시 재구성 / 가능한 도달 가능한 / 동일한 X3" (`banned-phrases-ko.md` §8) | repeated cognate within a sentence |
| **기계적 병렬** | "첫째 ~ 둘째 ~ 셋째" 의도 없는 나열 | "first ~ second ~ third" 무의미 나열 |
| **메타인지 표현 남발** | "~라고 할 수 있다 / ~라고 볼 수 있다 / ~로 사료된다" | "it can be argued that / it is worth noting" |
| **격식체 과다** | "~함으로써 / ~에 있어 / ~에 다름 아니다" | "vis-à-vis / in light of / inasmuch as" |
| **명사형 누적** | "~의 ~의 ~의" / "분석을 통한 모색" | nominalization chains |
| **Register 불일치** ★ NEW | 갑작스런 문어체("아니한다 / 상기 / 전술한") ↔ 갑작스런 구어체("끌려간 / 흔들림 / 넓게 모은다 / 막고 / 가져온다") (`banned-phrases-ko.md` §9) | archaic ("hereinabove") ↔ casual ("grab / a bunch of") 혼재 |
| **Em-dash 남발** | `—` 사용 ≥ 1 | `—` 사용 ≥ 1 |

판정: 단락당 위 패턴 **누적 ≥ 3** = ✗. 자연스러운 단정문·접속어로 재작성. (한 문장에 두 패턴이 동시 등장하면 더 명백한 쪽 1개만 카운트 — 이중 카운트 X.)

**리듬 (soft ⚠ only)**: 한 단락의 모든 문장이 같은 종결어미("~한다" 일변도)거나 길이가 모두 비슷하면 ⚠ "종결/리듬 단조" 메모. **단문 비율 ≥ 60% Hard Rule을 절대 못 뒤집는다.** 처리: 긴 문장 한두 개를 짧은 두 문장으로 쪼개거나(단문 비율도 ↑) 한 문장의 종결을 자연스럽게 바꿈. 점수에 반영 X (`writing-principles-ko.md` "종결어미 다양성·문장 리듬" 참조).

#### Step 4.i.3 — 논리적 비약 게이트 ★ NEW

`iterative-academic-writing`의 핵심 원칙: **인접 문장 사이 논리 연결이 명시적이어야**. 비약 검출 패턴:

1. **결론 비약** — "X이다. 따라서 Y이다." 인데 X→Y 추론 단계가 빠짐. (예: "loss가 떨어졌다. 따라서 일반화가 향상됐다." ✗)
2. **암묵적 가정** — 독자가 모르는 사실을 전제로 함. 예: "이는 cosine similarity가 0.8을 넘어 의미 있는 클러스터링이다." → 0.8이 왜 임계인지 안 밝힘.
3. **수치 → 결론 비약** — "정확도가 78%이다. 본 방법이 우월하다." → 비교 대상·통계적 유의성 빠짐.
4. **시점 혼동** — "기존 방법은 X를 못 한다 (현재형). 본 방법은 X를 한다 (과거형 결과)." → 시제 혼용으로 비교 흐려짐.

판정: 단락당 비약 **≥ 1** = ✗. 중간 추론 단계 한 문장 추가 또는 한정 표현으로 약화.

#### Step 4.i.4 — ML-beginner 게이트 ★

각 단락 **첫 문장**(lead)과 단락 본문이 ML 비전공자에게 이해 가능한지 점검. 4개 항목.

1. **약어 first-use 풀어쓰기**: 단락에 처음 등장하는 약어가 풀어쓰기 없이 등장 → ✗
   - 예: "RLHF는 ..." (첫 등장) → ✗ → "사람 피드백 강화 학습(RLHF)은 ..."
2. **수식 도입 전 자연어 설명**: 수식이 자연어 설명 없이 갑자기 등장 → ✗
   - 예: 갑자기 `\theta = \arg\min_\theta \mathbb{E}_x [\ell(f_\theta(x))]` → ✗ → "본 모델은 평균 손실을 최소화하는 파라미터를 학습한다. 즉, $\theta = \arg\min \ldots$" 순서
3. **고밀도 jargon 4개 이상**: 한 문장에 ML jargon 4개↑ (transformer, attention, KV-cache, FlashAttention 등) → ✗ → 두 문장 이상으로 분리
4. **서술형 풀어쓰기 — 명사형 종결 금지** ★ NEW: **정의된 단어·복잡한 jargon을 명사형으로 끝내지 말고 동사로 풀어 설명**한다. "X는 Y이다 (명사형으로 굳혀 끝)" 대신 "X는 ~을 ~한다 (서술형, 어떻게 작동하는지 풀어쓰기)"로.

**4번 항목 상세** — 가장 자주 잡히는 안티패턴:

| 패턴 | ✗ 명사형 종결 | ✓ 서술형 풀어쓰기 |
|---|---|---|
| 정의 후 명사형으로 굳힘 | "본 방법은 메타인지 표현의 효과적 활용을 통한 일반화 능력 향상이다." | "본 방법은 메타인지 표현을 학습 신호로 쓴다. 이 신호는 분포 밖 입력에서도 일반화를 끌어올린다." |
| jargon을 jargon으로 정의 | "Self-distillation은 자체 지식 증류 학습이다." | "Self-distillation은 모델이 자기 출력을 정답처럼 다시 학습하는 방식이다." |
| 명사구 chain | "사전 지식 갱신 메커니즘의 도입을 통한 OOD 일반화 성능의 향상" | "사전 지식 갱신 메커니즘을 도입해 분포 밖 입력에서도 일반화 성능을 끌어올린다." |
| 추상 명사로 끝맺음 | "본 모듈은 trajectory matching의 구현이다." | "본 모듈은 사람의 풀이 궤적과 모델의 풀이 궤적을 한 단계씩 맞춰 본다." |

**검출 시그널** (한국어):
- `[가-힣]+의 [가-힣]+의 [가-힣]+` (명사구 3겹 이상)
- `~을 통한 ~`, `~에 의한 ~`, `~의 ~화/~성/~력`
- 문장이 "~이다 / ~다" 명사형 종결로 끝나면서 그 명사가 처음 정의된 jargon인 경우

**검출 시그널** (영어):
- noun phrase chain ≥ 3 (e.g., "the introduction of prior-update mechanism for OOD generalization improvement")
- nominalization (e.g., "the realization of X by means of Y" → "X realizes Y by ...")

판정: lead와 본문 모두에서 위 4개 항목 점검. 한 항목이라도 위반 ≥ 1 = ✗. 풀어쓰기 보충 후 재라벨.

#### Step 4.i.5 — 정량 grep + 4축 critic

`banned-phrases-ko.md` (또는 -en.md)의 regex로 자체 카운트:

**한국어 임계:**
- `것이다 / 것이며 / 수 있다` 단락당 ≥ 3 → 표현축 -1
- `에 대한 / 에 의해 / 을 통해` 단락당 ≥ 3 → -1
- `[가-힣]+적인 / [가-힣]+적으로` ≥ 3 → -1
- `해당한다 / 위치한다 / 기능한다 / 자리매김 / 방향에 있다` (계사 대용, §7) 섹션당 ≥ 3 → -1
- `하고자 한다 / 할 것이다 / 하려 한다` 비율 (§5.1): `goja / 평서종결` **> 0.5** → -1, 목표 ≤ 0.3
- 비표준 개념어(글쓴이가 만든 2자+ 합성어) 한 섹션 ≥ 5회 → 회전 권고, ≥ 8회 → -1 (회전표 = `writing-principles-ko.md`)
- 동족어 stacking (`산출물을 산출`, `연구의 연구` 등, §8) 문장당 ≥ 1 → ✗ 분할/치환
- `아니한다 / 상기 / 전술한` (문어체) + `끌려간 / 흔들림 / 넓게 모은다 / 막고` (구어체) 합산 ≥ 2 → register ⚠
- `됩니다 / 되어진다 / 지게 된다` 0 권장
- `—` (em-dash) 0 강제

**영어 임계:**
- `clearly / obviously / various / it is worth noting` 0 권장
- `moreover / furthermore / additionally` ≥ 2 → -1
- `serves as / functions as / is positioned within / amounts to` 남발 → -1
- `—` 0

### Step 4 — Level 4 critic loop (최대 3 라운드)

| 게이트 | 통과 조건 |
|---|---|
| 단문 (One Role) | 모든 문장 단일 카테고리 |
| **단문 비율** ★ | 단락당 단문(KO 50자/EN 20w 이내) 비율 ≥ 60% |
| 자연스러움 | 단락당 AI tell 패턴 누적 < 3 (계사 대용·동족어 stacking·register 이탈 포함) |
| 계사 대용 ★ NEW | "해당한다 / 위치한다 / 기능한다 / 자리매김 / 방향에 있다" 단정문으로 — 단락당 0 (`banned-phrases-ko.md` §7) |
| 동족어 stacking ★ NEW | "산출물을 산출 / 연구의 연구 / 다시 재구성" 류 문장당 0 (§8) |
| register 일관성 ★ NEW | 갑작스런 문어체("아니한다")·구어체("끌려간/흔들림") 0 (§9) |
| 논리적 비약 | 단락당 비약 0 |
| ML-beginner | lead·본문 4개 항목 통과 (약어 풀어쓰기 / 수식 전 자연어 / jargon ≤ 3 / **서술형 풀어쓰기 — 명사형 종결 X**) |
| 정량 grep | 모든 임계 통과 (것이다·에 대한·계사 대용·"~하고자 한다" 비율 ≤ 0.3 포함) |
| 4축 통합 | 9/12 이상 |

모두 통과 = **Level 4 CONVERGED**. 그 단락은 다음 단락으로 진행. 모든 단락 통과 = **Phase 5 진행**. (리듬 단조 ⚠는 cosmetic — Phase 5 진행을 막지 않음.)

#### 단락 substep 출력 형태

```
=== P_i ([역할]) Level 4 ===

[단문 게이트]      ✓ 모든 문장 단일 카테고리 / 단문 비율 67%
[자연스러움]       ✓ AI tell 1개 ("에 대한" 1회) — 임계(3) 미만
[계사 대용]        ⚠ S2 "맥락에 위치한다" 1건 → "이 흐름과 연결된다"
[동족어 stacking]  ✓ 0건
[register]        ✓ 문어체·구어체 이탈 0
[리듬]             ⚠ 종결 "~한다" 4연속 — 1문장 변형 권고 (cosmetic)
[논리적 비약]      ⚠ S3에서 수치→결론 비약 1건 (보완 필요)
[ML-beginner]     ⚠ S1 lead의 RLHF 약어 풀어쓰기 누락
[정량 grep]       것이다: 0 / 에 대한: 1 / 해당한다: 0 / 하고자 한다 비율: 0.20 / em-dash: 0  ✓
[4축]             통일 3 / 연결 3 / 완결 3 / 표현 2 = 11/12

조치:
- S2 "맥락에 위치한다" → "이 흐름과 연결된다" (계사 대용 §7)
- S1 lead에 "사람 피드백 강화 학습(RLHF)" first-use 풀어쓰기
- S3 수치 78% 다음에 baseline 대비·통계 유의성 한 문장 추가

다음 라운드 진행
```

---

## Phase 5: 섹션 통합 critic + 자기 완결성 게이트

### Step 5.1 — 섹션 단위 정량 grep

전체 섹션에 대해 banned-phrases regex 카운트. 단락 단위(Phase 4)에서 못 잡는 **섹션 전역 패턴**을 여기서 본다:

- **계사 대용 관용구 누적** (`해당한다 / 위치한다 / 기능한다 / 자리매김 / 방향에 있다`, §7) — 섹션 전체 ≥ 3 → ✗ → 단정문으로 재작성
- **"~하고자 한다" 비율** (§5.1) — `goja / 평서종결 > 0.5` → ✗ → 절반 이상 단정형으로
- **개념어 과반복 회전** — 글쓴이가 만든 비표준 개념어가 섹션 전체에서 ≥ 5회면 회전 권고, ≥ 8회면 ✗ → `writing-principles-ko.md`의 회전표로 분산. (표준 학술 용어는 반복 OK — 통일이 더 중요)
- **register 일관성** (§9) — 문어체("아니한다 / 상기 / 전술한")와 구어체("끌려간 / 흔들림 / 넓게 모은다 / 막고") 합산 ≥ 2 → ⚠ → 학술 평서형 한 register로 통일
- **1차 등장 후 약어화** — "LLM에 의존하지 않는 보조 점검" 첫 등장 → 이후 "LLM 비의존 보조 점검", "한국어 공개 SNS에 나타난 회상" → 이후 "SNS 회상" 식으로 첫 등장만 풀어쓰기

### Step 5.2 — 자기 완결성 게이트 ★ NEW

섹션·단락이 다른 섹션을 인용하지 않고도 읽히는지 점검. 다음 패턴 grep:

| 패턴 | 한국어 | 영어 |
|---|---|---|
| 섹션 참조 | `Section [0-9]`, `§[0-9]`, `[0-9]장`, `위에서 다룬`, `앞서 언급한` | `Section [0-9]+`, `§[0-9]+`, `as discussed in`, `as we will see`, `aforementioned` |
| 부록 참조 | `부록 [A-Z]`, `appendix` | `Appendix [A-Z]`, `App. [A-Z]` |
| Forward reference | `다음 섹션에서` | `in the next section`, `we will show` |

검출 시 처리:

1. 본문에 핵심 정의·식이 흩어져 있으면 → 본 섹션에 자기 완결적 1줄 요약을 패러프레이징해 삽입
2. 부록 의존이 클 경우 → 부록 핵심 결과를 본문에 1줄 요약 (반복 X, 패러프레이징 ✓)
3. Forward reference는 가능하면 제거 (필요한 경우만 남김)

판정: 섹션 참조 **0개** 권장. 1~2개는 ⚠. 3개 이상이면 자기 완결성 ✗.

### Step 5.3 — 섹션 간 중복 표현 게이트 ★ NEW

같은 표현·문장이 다른 섹션에서 반복되는지 검출 (입력에 다른 섹션이 함께 제공된 경우).

처리: 반복 발견 시 **패러프레이징 강제**. 한 섹션은 정의, 다른 섹션은 활용 시점 등 역할 분담.

### Step 5.4 — 4축 통합 critic

`scoring-rubrics.md` 4축으로 종합 채점.

| 항목 | 점검 |
|---|---|
| 가독성 | 첫 문장부터 ML 비전공자가 이해 가능 |
| 두괄식 | 단락 첫 문장이 thesis인가 |
| Insight 전달 | 단순 나열 X, "왜 중요한가" 명시 |
| Hallucination | 본문에 없는 fact·숫자 X |
| Overclaim | 결론 강도가 증거를 넘지 않는가 |
| 명사형 누적 | 한 문장에 명사형 ≥ 3 X |
| 계사 대용 | "해당한다 / 위치한다 / 기능한다 / 자리매김 / 방향에 있다" 섹션당 < 3 |
| "~하고자 한다" 비율 | 평서종결 대비 ≤ 0.3 (>0.5 ✗) |
| 개념어 과반복 | 비표준 개념어 섹션당 < 5 (8↑ ✗) — 회전 적용 |
| Register 일관성 | 문어체+구어체 이탈 합산 < 2 |
| Em-dash 잔존 | grep으로 `—` count == 0 |
| 자기 완결성 | 섹션 참조 ≤ 2 |
| 중복 표현 | 다른 섹션과 동일 표현 X (패러프레이징 적용) |
| 전환 | 인접 단락 접속어 정합 |
| 일관성 | 용어·약어 통일 |
| 균형 | 단락 분량 균형 |
| 호응 | 도입↔결론 호응 |

NEEDS_WORK이면 punch list 적용 후 다시 round. CONVERGED 시 Phase 6.

---

## Phase 6: 본문+부록 수식·notation 감사 ★ STRENGTHENED

**본문과 부록을 통틀어 sweep.** 단일 섹션만 보지 않고 전체 글 범위에서 감사한다.

### Step 6.1 — 심볼 인벤토리

```bash
grep -oE "[a-zA-Z]_\{?[a-z0-9]+\}?"           # 첨자 있는 letter
grep -oE "\\\\(mathbf|mathcal|bm)\{[^}]+\}"   # 강조 letter
grep -oE "\\\\(ref|eqref|cite)\{[^}]+\}"      # cross-reference
```

본문·부록 각각에서 수집해 인벤토리 작성.

### Step 6.2 — First-use 정의 검증

각 심볼이 처음 등장하는 곳에서만 정의되는가. 본문에서 정의되지 않은 채 등장하면 → 부록에서 first-use 검사 → 부록도 없으면 **Orphan ✗**.

### Step 6.3 — 심볼 중복 사용 검출 (혼용)

같은 letter가 두 가지 의미로 쓰이지 않았는가. 예: 본문 `\theta` = 모델 파라미터, 부록 `\theta` = 각도 → ✗ → 부록 심볼 변경 권고.

### Step 6.4 — 첨자·서식 컨벤션

| 항목 | 점검 |
|---|---|
| Subscript/superscript 일관 | `x_i` vs `x_{i}` 혼용 X |
| `\mathbf` vs `\bm` vs `\boldsymbol` | 한 가지로 lock |
| Greek vs Latin 혼용 | `\beta` vs `b`로 같은 변수 표기 X |
| Capitalization | `\mathcal{D}` vs `\mathcal{d}` 일관 |

### Step 6.5 — 수식 cross-reference 무결성

`\eqref{eq:foo}` 깨짐 0, `\ref{sec:bar}` 깨짐 0, `\cite{key}` 미정의 0.

### Step 6.6 — Body vs Appendix 일관성

동일 정의가 두 곳에서 다르지 않은가. 검출 시:

- 본문이 정의·부록이 확장 → 일관성 OK
- 본문·부록이 다른 정의를 줌 → ✗ → 본문 정의로 통일 + 부록은 본문 인용

### Step 6.7 — 수식 오용 검출 (Misuse) ★ NEW

수식이 본문 의미와 mismatch:

1. **수식 자체 오류** — 차원 mismatch (예: 행렬 × 벡터 차원 불일치)
2. **본문 설명과 수식의 mismatch** — 본문은 "평균"이라 적었는데 수식은 sum (정규화 누락)
3. **단위 불일치** — 토큰 수, 시간(초/ms), 확률(0~1 vs %) 표기 일관성
4. **부등호 방향 오류** — 본문은 "이상"인데 수식은 `<`

### Step 6.8 — Orphan equation 검출 ★ NEW

수식이 정의·참조 없이 등장. 본문에서 `\eqref` 없이 등장하는 등번호 수식은 ✗ (본문에서 한 번도 안 가리키면 잉여).

### Step 6.9 — 감사 보고서 출력

```
=== Phase 6 감사 보고 ===

심볼 인벤토리: 본문 N개 / 부록 M개
  중복 사용 (혼용):  [\theta (body=param, app=angle) → 부록 심볼 변경 권고]
  Orphan:           [\xi 등장 1회, 정의 없음]
  Misuse:           [eq.(7) — 본문 "평균" 설명 vs 수식 sum, 정규화 누락]
  Cross-ref 깨짐:    [\eqref{eq:proof} 미정의]
  Body vs Appendix: [Loss 정의 부록과 다름 — 본문 정의로 통일 권고]
  단위 일관성:        [time을 ms와 s 혼용 — ms로 통일]

verdict: PASS / NEEDS_FIX
```

NEEDS_FIX이면 본문·부록 수정 후 재감사.

---

## Phase 7: LaTeX 빌드 검증

```bash
xelatex -interaction=nonstopmode main.tex && bibtex main && \
xelatex -interaction=nonstopmode main.tex && \
xelatex -interaction=nonstopmode main.tex
```

검증 항목:
- Body 페이지 수가 budget 내인가
- Em-dash 잔존 0
- Cosmetic 워닝 외 신규 워닝 0
- References 페이지 수 적정한가

## Output Format

본 스킬의 최종 출력은 **수정된 섹션 + 4-Level transparency 분석 보고서**.

```
=== Section Rewrite Output (v4) ===

[Level 1 Summary — 내용]
   섹션 의도 (1줄):    "..."
   섹션 내용 (1줄):    "..."
   Insight-first:     ✓ "what" → "why" 재작성 완료
   R5 thesis 정렬:     ✓
   Level 1 rounds:    1 → CONVERGED

[Level 2 Summary — 문단 간 구성]
   장르:               [방법 / 서론 / 결과 ...]
   의무 단락:          [동기 / 흐름 / 구성요소 / 예시]
   Outline Before:    P1 [???] / P2 [한계] / P3 [평가]
                      R 점검: R2 ✗ (제안 누락), R3 ✗ (역전)
   Outline After:     P1 [배경] / P2 [한계] / P3 [제안] / P4 [차별성] / P5 [평가]
                      R 점검: 모두 ✓
   결과 섹션 흐름:     의도→방법→결과→해석  ✓ (해당 시)
   Insight lead:      모든 lead가 insight 제시  ✓
   Level 2 rounds:    2 → CONVERGED

[Level 3 Summary — 문단 내 구성]
   P1 (배경): 정의 → 인과 → 예시 ✓ 의무 [정의, 인과] 충족
   P2 (한계): 비교/대조 → 분석 → 인과 ✓
   P3 (제안) [신설]: 정의 → 분석 → 과정 ✓
   P4 (차별성): 비교/대조 → 인과 ✓
   P5 (평가): 정의 → 과정 → 인과 ✓
   Level 3 rounds:    P3 2 rounds, 나머지 1 round → CONVERGED

[Level 4 Summary — 문장]
   단문 게이트:        ✓ 모든 문장 단일 카테고리 / 단문 비율 67%
   자연스러움:         ✓ AI tell 누적 단락당 평균 1.2 (임계 3 미만)
   계사 대용:          ✓ "해당한다/위치한다/기능한다" 0건 (단정문 재작성 2건)
   동족어 stacking:    ✓ 0건 ("산출물을 산출" → "구축" 1건)
   "~하고자 한다" 비율: ✓ 0.18 (≤ 0.3)
   register 일관성:    ✓ 문어체·구어체 이탈 0
   리듬:               ⚠ P2 종결 단조 ("~한다" 4연속) — 1문장 변형 권고
   논리적 비약:        ✓ 0건 (보완 후)
   ML-beginner:       ✓ 약어 first-use 풀어쓰기 적용
   정량 grep:         것이다 1 / 에 대한 2 / 명사형 2 / 해당한다 0 / em-dash 0
   Level 4 rounds:    1 → CONVERGED

[Phase 5 — 섹션 통합]
   자기 완결성:        ✓ 섹션 참조 1개 (허용 범위)
   섹션 간 중복:       0 (패러프레이징 1건 적용)
   개념어 과반복:      ✓ 최다 "분석 틀" 4회 (<5) — 회전 불필요
   register/계사대용:  ✓ 섹션 전역 통과
   4축 종합:          주제 8/9 / 내용 8/9 / 구성 11/12 / 표현 11/12 = 38/42

[Phase 6 — 수식·notation 감사 (본문+부록)]
   심볼 혼용:         0
   Orphan:           0
   Misuse:           0 (보완: eq.(7) 정규화 추가)
   Cross-ref:        ✓
   Body vs App:       ✓
   단위:              ✓ (ms로 통일)

[Phase 7 — Build]
   Body 5.8 / 6.0 budget ✓
   신규 워닝 0

[Final Section]
   [수정된 LaTeX/prose]

[Changes summary (commit message)]
   "Restructure section: insight-first leads, 의도→방법→결과→해석 flow,
    add proposal paragraph, fix sentence-level leaps, RLHF first-use unfold,
    self-contain (drop §3.2 reference, paraphrase from appendix)"
```

## Composition order (LLM 자율 강제 순서)

1. **Genre first** — Phase 0.5
2. **Thesis next (Level 1)** — Phase 1: 의도 + 내용 + insight-first
3. **Outline next (Level 2)** — Phase 2: 단락 lead + R1~R5 + 의도→방법→결과→해석
4. **Paragraph flow (Level 3)** — Phase 3: 단락별 카테고리 흐름
5. **Sentence last (Level 4)** — Phase 4: 단문 + 자연스러움 + 비약 + ML-beginner
6. **Integration** — Phase 5: 섹션 통합 + 자기 완결성
7. **Math + Build** — Phase 6 (본문+부록) · Phase 7

**문장부터 손대는 일은 없다.** 위→아래 순서를 LLM이 자율적으로 강제한다.

## Iteration discipline

- **Level 1·2·3는 CONVERGED 강제 — skip 금지.** 구조가 안 잡힌 채로 문장 손대지 않는다.
- Level 4는 CONVERGED 또는 잔존 cosmetic 표시 후 Phase 5 진행 가능
- 매 substantive rewrite 뒤 critic 자체 실행
- WEAK ACCEPT에서 멈추지 않는다 (Level 1·2·3는 CONVERGED까지)
- KO/EN 양쪽 paper면 한쪽 수정 후 paragraph-by-paragraph mirror
- LaTeX 빌드 검증 통과 전 commit 금지
- 매 commit 후 audit: 4-Level CONVERGED? insight-first? 단문 비율 ≥ 60%? 서술형 풀어쓰기? 자기 완결? 수식 혼용 0? **R2 통과? 단락 권장 흐름 일치? 계사 대용 < 3? "~하고자 한다" 비율 ≤ 0.3? 개념어 과반복 < 5? register 일관?**

## 사용자에게 묻지 않는 원칙

본 스킬은 **자율 윤문 도구**다. 입력 섹션만 받으면 모든 분석을 내부에서 수행하고 수정본 + 4-Level 분석 보고서를 출력한다.

질문하지 말 것:
- "장르가 뭐예요?" — 본문에서 자동 추론
- "의도를 한 줄로 알려주세요" — 본문에서 자동 추출
- "어느 단락부터 다듬을까요?" — Level 2부터 단락 단위 자동 처리
- "분량은?" — 입력 분량 유지를 디폴트

질문해야 하는 예외 (드뭄):
- 본문이 너무 짧거나 모호해 의도 추출 불가능
- 인용 키 / 수식 심볼 사전이 필요한데 입력에 없음
- LaTeX 빌드 환경 정보 부재

이 경우만 명시적 질문. 그 외엔 합리적 디폴트로 자동 진행.

대조: `academic-writing-trainer`는 **사용자와 대화하며 단계적으로 작성**한다. 본 스킬은 **이미 작성된 글을 자율적으로 다듬는다**.
