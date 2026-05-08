# Stage 2 — 내용 1문장 작성 양식

Stage 1의 의도를 ‘무엇으로’ 달성하는지 1문장으로 적어주세요.

## 채점 기준 (만점 9, 통과 6)

- 구체성: "X를 한다" 1 / "Y를 통해 X" 2 / 방법·장치까지 명시 3
- 의도 정합: 모순 1 / 대체로 정합 2 / 완벽 정합 3
- 단일 claim: 다중 claim 1 / 한 claim 우세 2 / 단일 claim 명확 3

## 권장 구조

```
구체적으로, [수단/방법]을 통해 [구체적 결과]를 [동사]한다.

또는

[수단]은 [기존 한계]를 [어떻게] 극복하여 [결과]를 가능하게 한다.
```

## 자동 점검 — R5 초점-내용 일치

**경고 신호:** Stage 1이 "X 모델 제안"인데 Stage 2가 "Y 도구 사용"이면 경고.

❌ 본 연구는 새 모델을 제안한다 (Stage 1)
   + 와서스타인 거리를 사용한다 (Stage 2) → R5 위반: 도구만 부각

✅ 본 연구는 새 모델을 제안한다 (Stage 1)
   + 모델은 사용자 궤적과 프로그램 합성을 결합해 작동하며, 와서스타인 거리를
     활용한 인코더로 skill을 표현한다 (Stage 2) → 모델 자체가 thesis

## 예시

KO:
> 구체적으로, 본 연구는 사용자 궤적에서 학습한 가치 예측 모델로 프로그램 합성
> 모델을 안내함으로써 학습하지 않은 작업까지 해결하는 능력을 보인다.

EN:
> Specifically, we guide a program-synthesis model with a value-predictor
> learned from user trajectories, demonstrating the ability to solve
> previously unseen tasks.

## 본인 내용 1문장:

[여기에 작성]
