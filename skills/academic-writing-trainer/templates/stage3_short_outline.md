# Stage 3 (단문) — 5개 단락 lead sentence 양식

5문단 outline. 각 단락의 첫 문장(lead) 1줄씩만. **prose는 아직 쓰지 마세요.**

## 채점 기준 (만점 12 + R 점검, 통과 9 + R2 통과)

| 항목 | 1점 | 2점 | 3점 |
|---|---|---|---|
| 짜임새 | 단락 배열 무질서 | 큰 흐름 보임 | 5개 의무 단락 모두 채워짐 |
| 간결 구조화 | 같은 내용 중복 | 큰 중복 없음 | 단락 budget 효율적 |
| 핵심 추출 | 핵심 묻힘 | lead만 봐도 흐름 추정 가능 | lead들만 읽어도 메시지 명확 |
| 논리 연결 | 단락 간 연결 끊김 | 인접 인과 통함 | 모든 인접 단락 인과 명시적 |

R2 fail-fast: 5개 의무 단락 중 하나라도 비면 즉시 NEEDS_WORK.

## 연구 제안서 의무 단락 (디폴트)

| # | 역할 | lead의 사명 |
|---|---|---|
| 1 | **배경** | 무엇이 미해결, 왜 중요 |
| 2 | **한계** | 기존 방법의 구체적 한계 |
| 3 | **제안** | 본 연구가 무엇을 제안 |
| 4 | **차별성** | 기존 대비 다른 점 |
| 5 | **평가** | 어떻게 검증 |

## 예시 (KO 5문단 lead)

```
1. (배경) 인공지능에서 일반화와 적응력은 별개로 다뤄져 왔다.
2. (한계) 기존 LLM·생성 모델은 일반화는 강하나 적응력은 부족하다.
3. (제안) 본 연구는 사용자 궤적과 프로그램 합성을 결합한 프레임워크를 제안한다.
4. (차별성) 기존 뉴로-심볼릭과 달리 사람 궤적으로 사전 지식을 갱신한다.
5. (평가) ARC 벤치마크에서 zero-shot/few-shot으로 검증한다.
```

## 예시 (EN 5-paragraph lead)

```
1. (Background) Generality and adaptation in AI have been studied separately.
2. (Limitation) Existing LLMs and generative models excel at generality but lack adaptation.
3. (Proposal) We propose a framework combining user trajectories with program synthesis.
4. (Distinction) Unlike prior neuro-symbolic work, we update prior knowledge from human trajectories.
5. (Evaluation) We evaluate on ARC under zero- and few-shot.
```

## 자동 점검 (Coach가 자동 실행)

- R1: 사용자가 장르 라벨링 했는가 (Stage 0.5에서 완료)
- R2: 5 lead가 5 의무 단락에 모두 매핑되는가 (누락 시 fail-fast)
- R3: 인접 lead 인과 정상 (배경→한계→제안→차별성→평가)
- R4: 인접 lead 의미 중복 없는가
- R5: 모든 lead가 Stage 2 thesis 지지

## 본인 5 lead:

```
1. (배경)
2. (한계)
3. (제안)
4. (차별성)
5. (평가)
```
