---
name: paper-section-rewrite
description: 학술 논문의 한 섹션(서론/관련 연구/방법/결과/논의)을 장르 라벨링→구조 plan→본문 critic loop→수식·notation 감사→LaTeX 빌드 검증으로 다듬는 섹션 단위 윤문 워크플로우. 노션 4축 평가(주제·내용·구성·표현)와 R1~R5 합평 패턴을 적용한다. paper-digest의 insight-first, iterative-academic-writing의 두괄식, humanize-writing의 ML-beginner 친화 원칙을 결합. KO/EN 양쪽 지원. critic은 Claude 본인이 같은 대화 안에서 수행 (외부 도구 불필요). MANDATORY TRIGGERS - 섹션 다시 쓰기, 섹션 윤문, 풀어쓰기, 두괄식, paper section rewrite, ML-beginner accessibility, notation audit, em-dash 0
---

# Paper Section Rewrite v2

학술 논문의 한 섹션을 받아서 다음 6단계로 다듬는다. **모든 critic은 Claude 본인이 rubric을 적용해 수행한다 — 외부 CLI 호출 없음.**

```
[Phase 0]   입력 정리
[Phase 0.5] 글의 종류 라벨 + 의무 단락 점검         ★ NEW
[Phase 1]   구조 plan + 내부 critic loop  (CONVERGED → Phase 2)
[Phase 2]   본문 작성 (확정된 outline 따라)
[Phase 3]   본문 critic loop + 한국어 정량 grep    (CONVERGED → Phase 4)
[Phase 4]   수식·notation 감사
[Phase 5]   LaTeX 빌드 검증
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

- 논문 PDF 전체에 마진 코멘트 달기 → `paper-readability-review` 사용
- 처음부터 단계적으로 작성하며 학습 → `academic-writing-trainer` 사용
- 단일 단락 social-share 요약 → `paper-digest` 사용
- 일반적 humanize → `humanize-writing` 또는 `humanize-korean` 사용

## References

본 스킬은 다음 reference 파일을 critic 시 참조한다.

- `references/writing-principles-ko.md` — 노션 4축, 9 서술 방식, 문단 3원칙·5유형, 문장 6원칙
- `references/genre-rubrics.md` — 5장르의 의무 단락
- `references/feedback-corpus.md` — 승필 합평 원문 (R1~R5 few-shot)
- `references/banned-phrases-ko.md` — 한국어 금지어 + grep 패턴
- `references/banned-phrases-en.md` — 영어 banned phrases
- `references/scoring-rubrics.md` — 4축 채점표 + 통과 임계

critic 출력 시 reference의 R 라벨을 그대로 인용한다.

---

## Phase 0: 입력 정리

다음을 확인한다.

- 섹션 텍스트 (LaTeX 또는 prose)
- 페이지 budget (예: 6쪽 본문)
- 언어 (KO/EN)
- 선행 섹션 요약 (중복 회피용)
- 사용 가능한 인용 키 / 수식 심볼 / 약어 사전

## Phase 0.5: 글의 종류 라벨 + 의무 단락 점검 ★

R1·R2 패턴 적용. `genre-rubrics.md` 참조.

1. 섹션의 장르를 한 줄로 라벨 (서론 / 관련 연구 / 방법 / 결과 / 논의 등)
2. 그 장르의 의무 단락 목록 인출
3. 현재 섹션이 의무 단락을 모두 포함하는지 점검
4. 누락 시 **즉시 NEEDS_WORK** (Phase 1 outline 단계로 진입)

**예: "방법" 섹션의 의무 단락**:

| # | 역할 |
|---|---|
| 1 | 방법의 동기 (왜 이 방법) |
| 2 | high-level 흐름 |
| 3 | 구성 요소 (모듈·수식) |
| 4 | 작동 예시 (입력→출력 한 사례) |

라벨 못 다는 단락 = 잉여 (R5 경고). 라벨 비는 의무 단락 = 누락 (R2 fail-fast).

## Phase 1: 구조 plan + 내부 critic loop

### Step 1.1 — outline 작성

각 단락에 대해 명시한다.

- **Lead sentence**: 그 단락의 insight 한 줄
- **Function**: 의도(질문) / 방법 / 결과 / 해석 중 어느 역할인지 (또는 장르별 의무 단락 라벨)
- **Citations to include / defer**

### Step 1.2 — 내부 critic loop (최대 3 라운드)

Claude가 다음 rubric으로 직접 채점한다 (`scoring-rubrics.md` 참조).

| 항목 | 통과 기준 |
|---|---|
| 두괄식 | 모든 단락이 핵심 주장으로 시작 |
| 의도→방법→결과→해석 순서 | 단락들이 이 순서를 자연스럽게 따라가는가 |
| 중복 / 패러프레이즈 | 다른 섹션·단락과 같은 표현이 없는가 |
| 자기 완결성 | 다른 섹션 안 봐도 이해 가능한가 |
| ML 비전공자 접근성 | jargon이 inline gloss와 함께 도입되는가 |
| **R2** | 장르 의무 단락 모두 채워졌는가 |
| **R3** | 인접 단락 흐름 역전 없는가 |
| **R4** | 인접 단락 의미 중복 없는가 |
| **R5** | 모든 lead가 섹션 thesis 지지 |

**critic 출력 형태:**

```
=== Phase 1 Round N — outline critic ===

잘 된 점: [강점 1]

개선점:
  [가장 큰 개선점 1] (원칙: R3 흐름 역전 / R5 thesis 정렬 등)

verdict: PASS / MINOR / MAJOR
점수: 구성 X/12

다음 행동: [통과까지 가장 빠른 길 1가지]
```

NEEDS_WORK이면 outline에 반영해 다시 round. CONVERGED 또는 점수 정체 시 Phase 2.

## Phase 2: 본문 작성

확정된 outline을 따라 본문을 작성한다. 다음 원칙을 적용한다.

- **명사형 → 서술식 안긴 문장**: "X의 환원" → "X를 어떻게 환원하는가"
- **Inline gloss**: 첫 등장 jargon에 plain-language 풀이 (예: "도구적 부분 목표(다른 목표를 위해 자기 작동을 유지하려는 구조)")
- **No em-dash**: `—` 그리고 `---` 0개. parens, periods, commas, semicolons로 대체
- **No bold leaders**: `\textbf{X.}`, `\paragraph{X.}`, `\emph{label.}\quad` 0개
- **No bullet lists**: 본문 prose 안에서. 증명·진정 sequential인 것만 예외
- **Scope-honest hedging**: "관찰", "시사", "보고된다" 사용 / "증명", "확립" 회피
- **Korean academic register**: writing-principles-ko.md 참조
- **금지어 회피**: banned-phrases-ko.md / -en.md 임계 준수

## Phase 3: 본문 critic loop + 정량 grep

### Step 3.1 — 정량 grep 점검 (Claude가 직접 실행)

`banned-phrases-ko.md` (또는 -en.md)의 regex로 카운트:

**한국어:**
- `것이다 / 것이며 / 수 있다` 단락당 ≥ 3 → 표현축 -1
- `에 대한 / 에 의해 / 을 통해` 단락당 ≥ 3 → 번역투 경고
- `[가-힣]+적인 / [가-힣]+적으로` 단락당 ≥ 3 → 명사형 누적 경고
- `됩니다 / 되어진다 / 지게 된다` 0개 권장

**영어:**
- `clearly / obviously / various / it is worth noting` 0개 권장
- `moreover / furthermore / additionally` 단락당 ≥ 2 → -1
- `—` 0개 (em-dash 금지)

### Step 3.2 — 4축 통합 critic

`scoring-rubrics.md` 4축으로 채점.

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

### Step 3.3 — critic 출력

```
=== Phase 3 Round N — prose critic ===

잘 된 점: [강점 1]

정량 grep:
  것이다: N개 (단락 X에서 가장 많음)
  에 대한: N개
  명사형: N개
  em-dash: N개

개선점:
  [가장 큰 개선점 1] (원칙: R 또는 축)

verdict: PASS / MINOR / MAJOR
점수: 4축 종합 X/42 = 주제 X/9 + 내용 X/9 + 구성 X/12 + 표현 X/12

다음 행동: [통과까지 가장 빠른 길 1가지]
```

NEEDS_WORK이면 punch list 적용 후 다시 round. CONVERGED 또는 점수 정체 시 Phase 4.

## Phase 4: 수식·notation 감사

본문과 부록을 통틀어 다음을 감사한다.

1. **심볼 인벤토리 작성**: `grep -oE "[a-z]_\{?[a-z0-9]+\}?"`, `grep -oE "\\\\(ref|eqref|cite)\{[^}]+\}"` 등으로 수집
2. **First-use 정의 검증**: 각 심볼이 처음 등장하는 곳에서만 정의되는가. 재정의 없는가
3. **심볼 중복 사용 검증**: 같은 letter가 두 가지 의미로 쓰이지 않았는가
4. **첨자 컨벤션**: subscript/superscript 일관성
5. **수식 cross-reference**: `\eqref`, `\ref`, `\cite` 깨짐 없는지
6. **Body vs Appendix 일관성**: 동일 정의가 두 곳에서 다르지 않은가
7. **단위 일관성**: 토큰 수, 시간, 확률 표기 일관

## Phase 5: LaTeX 빌드 검증

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

## Output

- 수정된 섹션 파일 (.tex)
- 변경 요약 (한 줄 commit message용)
- 페이지 분포 ("body N쪽 + refs M쪽")
- 잔존 워닝 / 잔존 to-do 목록
- Critic loop 라운드 수 + 최종 verdict (CONVERGED / NEEDS_WORK with reason)
- 최종 점수 (4축, scoring-rubrics 기준)

## Composition order

1. **Genre first**: Phase 0.5 — 장르 명명 + 의무 단락 lock
2. **Content next**: 섹션 thesis sentence lock
3. **Structure next**: 단락별 역할(motivation/method/result/interpretation) lock
4. **Expression last**: prose 작성. 두괄식 + 정량 grep 임계 준수

## Iteration discipline

- 매 substantive rewrite 뒤 critic loop 실행
- WEAK ACCEPT에서 멈추지 않는다. CONVERGED 또는 잔존 cosmetic까지 반복
- KO/EN 양쪽 paper면 한쪽 수정 후 paragraph-by-paragraph mirror
- LaTeX 빌드 검증 통과 전 commit 금지
- 매 commit 후 audit: 두괄식? undefined terms? cross-section paraphrase? circular logic? scope-honest? appendix vs body duplication? **R2 (의무 단락) 통과?**
