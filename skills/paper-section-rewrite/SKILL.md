---
name: paper-section-rewrite
description: 학술 논문의 한 섹션을 LLM이 자율적으로 분석·개선하는 윤문 스킬. 의도 1문장 → 내용 1문장 → 단락 lead + R1~R5 → 문장 카테고리 라벨링 + 단문 게이트 → 통합 critic → 수식 감사 → LaTeX 빌드 순서. 한 문장 한 역할(One Sentence One Role) 강제 — 두 카테고리 짊어진 문장은 즉시 분할. KO 50자 / EN 20 words 단문 디폴트. 노션 4축 평가, R1~R5 합평 패턴, 9가지 서술 방식 모두 적용. KO/EN 지원. critic은 Claude 본인이 같은 대화 안에서 수행. MANDATORY TRIGGERS - 섹션 다시 쓰기, 섹션 윤문, 풀어쓰기, 두괄식, paper section rewrite, ML-beginner accessibility, notation audit, em-dash 0, 단문, 한 문장 한 역할, one sentence one role
---

# Paper Section Rewrite v3

학술 논문의 한 섹션을 받아서 **LLM이 자율적으로** 7단계 분석·개선 후 출력. **사용자에게 추가 질문 없음.** 모든 단계가 입력 텍스트만으로 진행되며, 분석 결과는 transparency를 위해 출력에 포함된다.

분석 순서는 academic-writing-trainer의 학습 단계와 동일: 의도(1문장) → 내용(1문장) → outline + R1~R5 → 단락별 문장 카테고리 흐름 → 통합. 차이점은 **사용자 질의 없이 LLM이 내부에서 순차 실행**한다는 것.

```
[Phase 0]   입력 정리
[Phase 0.5] 장르 라벨 + 의무 단락 자동 도출
[Phase 1]   의도/내용 1문장 자동 추출 (trainer Stage 1·2와 동일 분석)  ★ NEW
[Phase 2]   단락 lead 분석 + R1~R5 자체 점검 + outline critic loop
[Phase 3]   단락별 prose 재작성 with 문장 카테고리 라벨링 + 권장 흐름 비교  ★ NEW
[Phase 4]   섹션 통합 critic + 정량 grep
[Phase 5]   수식·notation 감사
[Phase 6]   LaTeX 빌드 검증
```

각 critic loop는 **최대 3 라운드** 또는 **점수 정체 시** 종료.

## When to use

- "이 섹션 다시 써줘 / restructure this section"
- "비전공자도 이해할 수 있게 / ML 처음 접하는 사람도"
- "두괄식으로 / insight 중심으로 / 풀어쓰기"
- "수식 notation 점검해줘"
- "구조부터 잡고 critic loop로"
- 한국어/영어 학술 논문 섹션 윤문

## When NOT to use

- 논문 PDF 전체에 마진 코멘트 달기 → `paper-readability-review`
- 처음부터 단계적으로 작성하며 학습 → `academic-writing-trainer` (사용자가 직접 작성, Coach 코칭)
- 단일 단락 social-share 요약 → `paper-digest`
- 일반적 humanize → `humanize-writing` 또는 `humanize-korean`

## References

본 스킬은 다음 reference 파일을 critic 시 참조한다 (academic-writing-trainer와 공유).

- `references/writing-principles-ko.md` — 노션 4축, 9 서술 방식 + 단락 역할별 권장 흐름, 문단 3원칙·5유형, 문장 6원칙
- `references/genre-rubrics.md` — 5장르의 의무 단락
- `references/feedback-corpus.md` — 승필 합평 원문 (R1~R5 few-shot)
- `references/banned-phrases-ko.md` — 한국어 금지어 + grep 패턴
- `references/banned-phrases-en.md` — 영어 banned phrases
- `references/scoring-rubrics.md` — 4축 채점표 + 통과 임계

critic 출력 시 reference의 R 라벨과 카테고리 라벨을 그대로 인용한다.

---

## Phase 0: 입력 정리

다음을 확인한다 (사용자에게 묻지 않고 입력 텍스트·문맥에서 자동 식별):

- 섹션 텍스트 (LaTeX 또는 prose)
- 페이지 budget — 명시 없으면 입력 텍스트의 분량을 그대로 유지하는 것을 디폴트로
- 언어 — KO/EN 자동 감지
- 사용 가능한 인용 키 / 수식 심볼 / 약어 사전 (입력 안에 있는 것만)

명시 정보 부족 시 합리적 디폴트 적용 (질문 X).

## Phase 0.5: 장르 라벨 + 의무 단락 자동 도출

`genre-rubrics.md` 참조. R1·R2 적용.

1. 섹션의 장르를 입력 텍스트에서 자동 추론 (서론 / 관련 연구 / 방법 / 결과 / 논의 등). 명시 없으면 본문 단서로 결정.
2. 그 장르의 의무 단락 목록 인출
3. 현재 섹션이 의무 단락을 모두 포함하는지 자체 점검
4. 누락 시 Phase 2에서 새 단락 추가 (R2 fail-fast)

**예: "방법" 섹션의 의무 단락**:

| # | 역할 |
|---|---|
| 1 | 방법의 동기 (왜 이 방법) |
| 2 | high-level 흐름 |
| 3 | 구성 요소 (모듈·수식) |
| 4 | 작동 예시 (입력→출력 한 사례) |

## Phase 1: 의도/내용 1문장 자동 추출 ★

trainer의 Stage 1·2와 동일한 분석을 LLM이 자율적으로 수행. **사용자에게 묻지 않고** 입력 섹션에서 다음 두 문장을 직접 추출.

### Step 1.1 — 섹션 의도 1문장

입력 섹션이 무엇을 하려는지 1문장으로 요약. 동사 명시 (제안한다 / 보인다 / 분석한다 / 보고한다).

```
[자동 추출] 섹션 의도:
   "본 섹션은 ... 프레임워크의 3-모듈 구조를 설명한다."
```

### Step 1.2 — 섹션 내용 claim 1문장

의도를 어떤 구체 내용으로 달성하는지.

```
[자동 추출] 섹션 내용 claim:
   "구체적으로, 뉴로-심볼릭 모듈이 사전 지식을 갱신하고, 실행 모듈이 궤적을 생성하며,
    평가 모듈이 사람 궤적과 비교해 일치 비율을 계산한다."
```

### Step 1.3 — R5 정렬 자체 점검

의도와 내용이 정합되는지, 글의 thesis가 도구가 아닌 모델·방법 자체인지 자체 점검.

R5 위반 발견 시 (예: 의도가 "모델 제안"인데 내용이 "와서스타인 거리만 강조"이면) Phase 3에서 재배치.

## Phase 2: 단락 lead 분석 + R1~R5 자체 점검 + outline critic loop

### Step 2.1 — 현재 단락 lead 추출

입력 섹션의 단락별 첫 문장을 lead로 추출. 단락 N개에 lead N개.

### Step 2.2 — 단락 역할 자동 라벨링

각 lead에 장르 의무 단락 중 어느 역할인지 자동 라벨.

```
P1 lead [배경]: "최근 ... 연구가 활발하다."
P2 lead [한계]: "기존 모델은 ... 한계가 있다."
P3 lead [???]: "본 연구의 모델 구조는 다음과 같다."  ← [제안] 라벨 가능
P4 lead [???]: "예를 들어 ARC 벤치마크에서..."  ← [평가]에 더 가까움
P5 lead [???]: 부재  ← [차별성] 누락 (R2 fail-fast)
```

### Step 2.3 — R1~R5 자체 점검

| R | 자체 점검 | 위반 시 조치 |
|---|---|---|
| R1 | 장르 라벨링 완료 (Phase 0.5에서) | — |
| R2 | 의무 단락 모두 채워졌는가 | 누락 단락 추가 (Phase 3) |
| R3 | 인접 단락 흐름 정상 (배경→한계→제안→차별성→평가) | 단락 순서 재배열 |
| R4 | 인접 단락 의미 중복 | 두 단락 통합 |
| R5 | 모든 lead가 섹션 thesis 지지 | 잉여 단락 제거 또는 재할당 |

### Step 2.4 — outline critic loop (최대 3 라운드)

R1~R5 위반 발견 시 LLM이 자체적으로 단락 구조를 재배치하고, 새 outline에 대해 다시 R1~R5 점검. 모든 R 통과 시 Phase 3.

**critic 출력 형태:**

```
=== Phase 2 Round N — outline 자체 점검 ===

현재 단락 구조:
  P1 [배경] / P2 [한계] / P3 [제안] / P4 [차별성] / P5 [평가]

R 점검:
  R1 ✓ R2 ✓ R3 ✓ R4 ⚠ (P2와 P3 의미 30% 겹침) R5 ✓

조치 (다음 라운드):
  P2와 P3을 한 단락으로 통합하고, 빈 자리에 [차별성] 신설

verdict: NEEDS_WORK / CONVERGED
```

CONVERGED 시 Phase 3.

## Phase 3: 단락별 재작성 with 문장 카테고리 라벨링 ★

trainer의 Stage 4와 동일한 분석을 LLM이 자율적으로 수행. **단락 하나씩** 처리.

### 단락별 substep (각 단락 P_i에 대해)

#### Step 3.i.1 — 현재 문장 카테고리 라벨링

P_i의 모든 문장에 9가지 서술 방식 중 하나로 라벨 (`writing-principles-ko.md` 시그널 표현 사용).

```
P_i 현재 문장 라벨:
S1 [정의]   "본 연구는 ... 프레임워크를 제안한다."
S2 [정의]   "이 프레임워크는 ... 모델이다."   ← 정의 중복
S3 [정의]   "또한 ... 또 다른 정의."         ← 정의 또
S4 [인과]   "이는 학습할 수 있게 한다."

흐름: 정의 → 정의 → 정의 → 인과
```

#### Step 3.i.2 — 권장 흐름과 비교

`writing-principles-ko.md`의 단락 역할별 권장 흐름 표 참조.

```
P_i 역할: [제안]
권장 흐름: 정의 → 분석 → 과정
의무 카테고리: 정의, 분석
회피: 인과만 (왜만 강조하면 무엇 모호)

현재 vs 권장:
  현재 흐름: 정의 → 정의 → 정의 → 인과  ❌
  권장:      정의 → 분석 → 과정          ✓
  
누락 의무: [분석], [과정]
잉여 회피: [정의] 2개 (S2, S3 — R4 인접 중복)
```

#### Step 3.i.3 — 단락 재작성

위 분석에 따라 LLM이 P_i를 재작성.

- 정의 중복 (S2, S3)을 1개의 [분석] 문장으로 합침
- [과정] 문장 추가 (작동 절차 한 줄)
- 인과 문장은 차별성 단락으로 이동 또는 삭제

#### Step 3.i.4 — 재작성 후 라벨 재점검

```
P_i 재작성 후 라벨:
S1 [정의]   "본 연구는 ... 프레임워크를 제안한다."   ✓ lead
S2 [분석]   "이 프레임워크는 뉴로-심볼릭, 실행, 평가 모듈로 구성된다." ✓
S3 [과정]   "먼저 뉴로-심볼릭 모듈이 ... 그 뒤 ... 마지막에 ..." ✓

흐름: 정의 → 분석 → 과정  ✓ 권장 정확히 일치
역할 정합도: 5/5
```

#### Step 3.i.4b — 단문 게이트 (Hard Rule) ★

재작성된 모든 문장이 **정확히 하나의 카테고리**만 가지는지 점검. 두 카테고리를 짊어진 문장(예: 정의+인과)이 하나라도 남아 있으면 substep 자동 fail → 분할 후 재라벨.

```
P_i 단문 게이트:
S1 [정의]              ✓ 단일 카테고리
S2 [혼합:비교+평가]    ✗ "X는 Y와 달리 Z를 더 잘 처리한다"
                          → 분할: "X는 Y와 다르다.[비교] X는 Z를 Y보다 더 잘 처리한다.[평가]"
S3 [정의]              ✓
```

**검출 규칙**: 한 문장 안에 다른 두 서술 방식이 동시에 들어 있는가. `-며 / -고 / -지만 / -에 의해` 등으로 두 절을 잇고 각 절이 다른 카테고리면 분할.

**예외**: 시간·장소 부사절, 인용절은 카테고리 외로 인정 (`2024년 보고된 GPT-4 결과는 X를 보여준다` → [보고] 단일).

**길이 가이드**: KO 50자 / EN 20 words 이내 권장. 길이만으로 fail은 아니지만 길이 + 카테고리 2개가 함께 잡히면 우선순위 최상.

**하이브리드 라벨 금지**: `[정의(+인과)]` 형태는 사용 금지 — 그건 분할 회피다. 무조건 `[혼합:A+B] ✗`로 표기하고 분할 처리한다.

상세 규약은 `references/writing-principles-ko.md`의 "단문 원칙 — One Sentence, One Role" 절 참조.

#### Step 3.i.5 — 정량 grep + 4축 critic

`banned-phrases-ko.md` (또는 -en.md)의 regex로 자체 카운트:

**한국어 임계:**
- `것이다 / 것이며 / 수 있다` 단락당 ≥ 3 → 표현축 -1
- `에 대한 / 에 의해 / 을 통해` 단락당 ≥ 3 → -1
- `[가-힣]+적인 / [가-힣]+적으로` ≥ 3 → -1
- `됩니다 / 되어진다 / 지게 된다` 0 권장
- `—` (em-dash) 0 강제

**영어 임계:**
- `clearly / obviously / various / it is worth noting` 0 권장
- `moreover / furthermore / additionally` ≥ 2 → -1
- `—` 0

4축(통일·연결·완결·표현) 9/12 미만이면 같은 단락 재작성 (최대 3 라운드).

#### 단락 substep 출력 형태

```
=== P_i ([역할]) 재작성 ===

[Before]
S1 [정의]   "..."
S2 [정의]   "..."   ← 정의 중복 (R4)
...

흐름: 정의 → 정의 → 정의 → 인과
역할 정합도: 1/5

[조치]
- S2, S3 통합 → S2 [분석]
- S4 [인과] 제거 (차별성 단락 영역)
- [과정] 문장 신설

[After]
S1 [정의]   "..."   ✓ lead
S2 [분석]   "..."   ✓
S3 [과정]   "..."   ✓

흐름: 정의 → 분석 → 과정  ✓ 권장 일치
역할 정합도: 5/5

[정량 grep]
   것이다: 0 / 에 대한: 1 / 명사형: 1 / em-dash: 0  ✓

[점수]
   통일 3 / 연결 3 / 완결 3 / 표현 3 = 12/12  ✓
```

모든 단락이 substep 통과 시 Phase 4.

## Phase 4: 섹션 통합 critic + 정량 grep

### Step 4.1 — 섹션 단위 정량 grep

전체 섹션에 대해 banned-phrases regex 카운트.

### Step 4.2 — 4축 통합 critic

`scoring-rubrics.md` 4축으로 종합 채점.

| 항목 | 점검 |
|---|---|
| 가독성 | 첫 문장부터 ML 비전공자가 이해 가능 |
| 두괄식 | 단락 첫 문장이 thesis인가 |
| Insight 전달 | 단순 나열 X, "왜 중요한가" 명시 |
| Hallucination | 본문에 없는 fact·숫자 X |
| Overclaim | 결론 강도가 증거를 넘지 않는가 |
| 명사형 누적 | 한 문장에 명사형 ≥ 3 X |
| Em-dash 잔존 | grep으로 `—` count == 0 |
| 중복 표현 | 다른 섹션과 동일 표현 X |
| 자기 완결성 | 다른 섹션 미참조로 읽혀야 |
| **전환** | 인접 단락 접속어 정합 |
| **일관성** | 용어·약어 통일 |
| **균형** | 단락 분량 균형 |
| **호응** | 도입↔결론 호응 |

### Step 4.3 — critic 출력

```
=== Phase 4 — 섹션 통합 critic ===

정량 grep (전체 섹션):
   것이다: N개 (단락 X에서 가장 많음)
   에 대한: N개
   명사형: N개
   em-dash: N개  ← 0이어야

4축 종합 점수: X/42 = 주제 X/9 + 내용 X/9 + 구성 X/12 + 표현 X/12

verdict: PASS / MINOR / MAJOR
```

NEEDS_WORK이면 punch list 적용 후 다시 round. CONVERGED 시 Phase 5.

## Phase 5: 수식·notation 감사

본문과 부록을 통틀어 다음을 감사한다.

1. **심볼 인벤토리 작성**: `grep -oE "[a-z]_\{?[a-z0-9]+\}?"`, `grep -oE "\\\\(ref|eqref|cite)\{[^}]+\}"`로 수집
2. **First-use 정의 검증**: 각 심볼이 처음 등장하는 곳에서만 정의되는가
3. **심볼 중복 사용 검증**: 같은 letter가 두 가지 의미로 쓰이지 않았는가
4. **첨자 컨벤션**: subscript/superscript 일관성
5. **수식 cross-reference**: `\eqref`, `\ref`, `\cite` 깨짐 없는지
6. **Body vs Appendix 일관성**: 동일 정의가 두 곳에서 다르지 않은가
7. **단위 일관성**: 토큰 수, 시간, 확률 표기 일관

## Phase 6: LaTeX 빌드 검증

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

본 스킬의 최종 출력은 **수정된 섹션 + transparency 분석 보고서**.

```
=== Section Rewrite Output ===

[Internal Analysis Summary]
   섹션 의도 (1줄):    "..."
   섹션 내용 (1줄):    "..."
   장르:               [방법 / 서론 / ...]
   의무 단락:          [동기 / 흐름 / 구성요소 / 예시]

[Outline Before/After]
   Before P1 [배경] / P2 [???] / P3 [한계] / P4 [평가]      
                      R 점검: R2 ✗ (제안 누락), R3 ✗ (역전)
   After  P1 [배경] / P2 [한계] / P3 [제안] / P4 [차별성] / P5 [평가]
                      R 점검: 모두 ✓

[Per-paragraph sentence-flow analysis]
   P1 (배경): 정의 → 인과 → 예시 ✓ 의무 [정의, 인과] 충족
   P2 (한계): 비교/대조 → 분석 → 인과 ✓
   P3 (제안) [신설]: 정의 → 분석 → 과정 ✓
   P4 (차별성): 비교/대조 → 인과 ✓
   P5 (평가): 정의 → 과정 → 인과 ✓

[Quantitative grep]
   것이다: 1개 / 에 대한: 2개 / 명사형: 2개 / em-dash: 0개

[Final 4축 score]
   주제 8/9 / 내용 8/9 / 구성 11/12 / 표현 11/12 = 38/42

[Pages]
   Body 5.8 / 6.0 budget ✓

[Critic loop rounds]
   Phase 2 (outline): 2 rounds → CONVERGED
   Phase 3 (per-paragraph): P3에서 2 rounds, 나머지 1 round → CONVERGED
   Phase 4 (integration): 1 round → CONVERGED

[Final Section]
   [수정된 LaTeX/prose]

[Changes summary (commit message)]
   "Restructure section: add proposal paragraph, fix flow inversion in P3-P4,
    rebalance sentence categories per role"
```

## Composition order (LLM 자율 순서)

1. **Genre first** — Phase 0.5: 장르 + 의무 단락 도출
2. **Thesis next** — Phase 1: 의도 + 내용 1문장씩 (R5 정렬 점검)
3. **Outline next** — Phase 2: 단락 lead + R1~R5
4. **Sentence flow last** — Phase 3: 단락별 카테고리 라벨링 + 권장 흐름 + 재작성
5. **Integration** — Phase 4: 섹션 통합 critic + grep
6. **Math + Build** — Phase 5·6

## Iteration discipline

- 매 substantive rewrite 뒤 critic 자체 실행
- WEAK ACCEPT에서 멈추지 않는다. CONVERGED 또는 잔존 cosmetic까지 반복
- KO/EN 양쪽 paper면 한쪽 수정 후 paragraph-by-paragraph mirror
- LaTeX 빌드 검증 통과 전 commit 금지
- 매 commit 후 audit: 두괄식? undefined terms? cross-section paraphrase? circular logic? scope-honest? appendix vs body duplication? **R2 (의무 단락) 통과? 단락 역할별 권장 흐름 일치?**

## 사용자에게 묻지 않는 원칙

본 스킬은 **자율 윤문 도구**다. 입력 섹션만 받으면 모든 분석을 내부에서 수행하고 수정본 + 분석 보고서를 출력한다.

질문하지 말 것:
- "장르가 뭐예요?" — 본문에서 자동 추론
- "의도를 한 줄로 알려주세요" — 본문에서 자동 추출
- "어느 단락부터 다듬을까요?" — 모든 단락 자동 처리
- "분량은?" — 입력 분량 유지를 디폴트

질문해야 하는 예외 (드뭄):
- 본문이 너무 짧거나 모호해 의도 추출 불가능
- 인용 키 / 수식 심볼 사전이 필요한데 입력에 없음
- LaTeX 빌드 환경 정보 부재

이 경우만 명시적 질문. 그 외엔 합리적 디폴트로 자동 진행.

대조: `academic-writing-trainer`는 **사용자와 대화하며 단계적으로 작성**한다. 본 스킬은 **이미 작성된 글을 자율적으로 다듬는다**.
