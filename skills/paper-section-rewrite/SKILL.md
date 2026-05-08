---
name: paper-section-rewrite
description: 학술 논문의 한 섹션(서론/관련 연구/방법/결과/논의)을 구조 우선 계획→critic loop→두괄식 prose→ML 비전공자 가독성 점검→수식·notation 감사→LaTeX 빌드 검증까지 돌리는 섹션 단위 윤문 워크플로우. paper-digest의 insight-first, iterative-academic-writing의 두괄식, humanize-writing의 ML-beginner 친화 원칙을 한 섹션 단위로 묶어서 적용한다. 사용자가 "이 섹션 다시 써줘", "비전공자도 이해할 수 있게 정리해줘", "두괄식으로 다시", "수식 notation 점검해줘", "이 섹션 풀어쓰기" 같은 요청을 할 때 사용한다. KO/EN 양쪽 지원. MANDATORY TRIGGERS - 섹션 다시 쓰기, 섹션 윤문, 풀어쓰기, 두괄식, paper section rewrite, ML-beginner accessibility, notation audit, em-dash 0
---

# Paper Section Rewrite

학술 논문의 한 섹션을 받아서 두 단계의 critic loop로 다듬는다.

1. **구조 critic loop**: 단락 outline을 먼저 짜고 self-eval로 다듬는다.
2. **본문 critic loop**: 작성된 prose를 self-eval로 다듬는다.

마지막에 수식·notation 감사 + LaTeX 빌드 검증을 수행한다.

## When to use

- "이 섹션 다시 써줘 / restructure this section"
- "비전공자도 이해할 수 있게 / ML 처음 접하는 사람도"
- "두괄식으로 / insight 중심으로 / 풀어쓰기"
- "수식 notation 점검해줘"
- "구조부터 잡고 critic loop로"
- 한국어/영어 학술 논문 섹션 윤문

## When NOT to use

- 논문 PDF 전체에 마진 코멘트 달기 → `paper-readability-review` 사용
- 논문 처음부터 작성 → `iterative-academic-writing` 사용
- 단일 단락 social-share 요약 → `paper-digest` 사용
- 일반적 humanize → `humanize-writing` 또는 `humanize-korean` 사용

## Workflow

```
[Phase 0] 입력 정리
    │
    ↓
[Phase 1] 구조 plan + critic loop  (CONVERGED → Phase 2)
    │       (max 3 round)
    ↓
[Phase 2] 본문 작성 (확정된 outline 따라)
    │
    ↓
[Phase 3] 본문 critic loop  (CONVERGED → Phase 4)
    │       (max 3 round)
    ↓
[Phase 4] 수식·notation 감사
    │
    ↓
[Phase 5] LaTeX 빌드 검증
    │
    ↓
출력: 수정된 섹션 + 변경 요약 + 페이지 분포 + 잔존 워닝
```

## Phase 0: 입력 정리

다음을 확인한다.
- 섹션 텍스트 (LaTeX 또는 prose)
- 페이지 budget (예: 6쪽 본문)
- 언어 (KO/EN)
- 선행 섹션 요약 (중복 회피용)
- 사용 가능한 인용 키 / 수식 심볼 / 약어 사전

## Phase 1: 구조 plan + critic loop

먼저 단락 outline을 구성한다. 각 단락에 대해 다음을 명시한다.
- **Lead sentence**: 그 단락의 insight 한 줄
- **Function**: 의도(질문) / 방법 / 결과 / 해석 중 어느 역할인지
- **Citations to include / defer**

그 다음 self-eval로 다음을 점검한다.

| 항목 | 통과 기준 |
|---|---|
| 두괄식 (lead-with-conclusion) | 모든 단락이 핵심 주장으로 시작 |
| 의도→방법→결과→해석 순서 | 단락들이 이 순서를 자연스럽게 따라가는가 |
| 중복 / 패러프레이즈 | 다른 섹션·단락과 같은 표현이 없는가 |
| 자기 완결성 | 다른 섹션 안 봐도 이해 가능한가 |
| ML 비전공자 접근성 | jargon이 inline gloss와 함께 도입되는가 |

발견된 문제는 outline에 반영해 다시 critic 돌린다. CONVERGED 될 때까지 최대 3 라운드.

## Phase 2: 본문 작성

확정된 outline을 따라 본문을 작성한다. 다음 원칙을 적용한다.

- **명사형 → 서술식 안긴 문장**: "X의 환원" → "X를 어떻게 환원하는가"
- **Inline gloss**: 첫 등장 jargon에 plain-language 풀이를 붙인다 (예: "도구적 부분 목표(다른 목표를 이루기 위해 자기 작동을 유지하려는 구조)")
- **No em-dash**: `—` 그리고 `---` 0개. parens, periods, commas, semicolons로 대체
- **No bold leaders**: `\textbf{X.}`, `\paragraph{X.}`, `\emph{label.}\quad` 0개
- **No bullet lists**: 본문 prose 안에서. 증명·진정 sequential인 것만 예외
- **Scope-honest hedging**: "관찰", "시사", "보고된다" 사용 / "증명", "확립" 회피
- **Korean academic register**: "행동 layer" → "행동 층", "instruction-following" → "지시 따르기"

## Phase 3: 본문 critic loop

작성된 prose를 self-eval로 점검한다.

| 항목 | 점검 |
|---|---|
| 가독성 | 첫 문장부터 ML 비전공자가 이해 가능 |
| 두괄식 | 단락 첫 문장이 thesis인가 |
| Insight 전달 | 단순 나열 X, "왜 중요한가" 명시 |
| Hallucination | 본문에 없는 fact·숫자 X |
| Overclaim | 결론 강도가 증거를 넘지 않는가 |
| 명사형 누적 | 한 문장에 명사형 3개 이상 X |
| Em-dash 잔존 | grep으로 `—` count == 0 |
| 중복 표현 | 다른 섹션과 동일 표현 X |
| 자기 완결성 | 다른 섹션 미참조로 읽혀야 |

NEEDS_WORK이면 punch list를 도출한 뒤 적용하고 다시 critic 돌린다. CONVERGED 될 때까지 최대 3 라운드.

## Phase 4: 수식·notation 감사

본문과 부록을 통틀어 다음을 감사한다.

1. **심볼 인벤토리 작성**: `grep -oE "[a-z]_\{?[a-z0-9]+\}?"`, `grep -oE "\\\\(ref|eqref|cite)\{[^}]+\}"` 등으로 모든 수식 심볼·인용을 수집
2. **First-use 정의 검증**: 각 심볼이 처음 등장하는 곳에서만 정의되어 있는가. 재정의 없는가
3. **심볼 중복 사용 검증**: 같은 letter가 두 가지 다른 의미로 쓰이지 않았는가 (예: `p_d` vs `p_self`)
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
- Body 페이지 수가 budget 내인가 (예: 6쪽 KDD-UC body)
- Em-dash 잔존 0
- Cosmetic 워닝 외 신규 워닝 0
- References 페이지 수 적정한가

## Korean academic register notes

| EN/jargon | KO 권장 |
|---|---|
| behavior layer | 행동 층 |
| factorial benchmark | 요인 설계 벤치마크 |
| instruction-following | 지시 따르기 |
| chain-of-thought | 사고 사슬 |
| instrumental sub-goal | 다른 목표를 이루기 위한 부분 목표 |
| 강도-only 평가 | 강도만 보는 평가 |
| 도구적 수렴 전통 | 충분히 능력 있는 AI라면 자기 작동을 보전하는 일을 다른 목표를 이루기 위한 부분 목표로 삼을 것이라는 이론적 예측 |

## Forbidden phrases

- "we now turn to"
- "in summary"
- "it is worth noting"
- "additionally"
- "moreover"
- "first attempt to our knowledge" (overclaim)

## Output

- 수정된 섹션 파일 (.tex)
- 변경 요약 (한 줄 commit message용)
- 페이지 분포 ("body N쪽 + refs M쪽")
- 잔존 워닝 / 잔존 to-do 목록
- Critic loop 라운드 수 + 최종 verdict (CONVERGED / NEEDS_WORK with reason)

## Composition order

1. **Content first**: 섹션이 무엇을 주장할지 (thesis sentence) 먼저 lock
2. **Structure next**: 단락별 역할(motivation/method/result/interpretation) 먼저 lock
3. **Expression last**: prose 작성은 위 두 결정이 끝난 뒤. 두괄식 + paper-digest 룰을 문장 단위로 적용

## Iteration discipline

- 매 substantive rewrite 뒤 critic loop 실행
- WEAK ACCEPT에서 멈추지 않는다. STOP 또는 잔존이 cosmetic으로만 남을 때까지 반복
- KO/EN 양쪽 paper면 한쪽 수정 후 paragraph-by-paragraph mirror
- LaTeX 빌드 검증 통과 전에 commit 금지
- 매 commit 후 audit: 두괄식? undefined terms? cross-section paraphrase? circular logic? scope-honest? appendix vs body duplication?
