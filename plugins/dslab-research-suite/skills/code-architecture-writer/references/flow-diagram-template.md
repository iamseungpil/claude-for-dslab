# flow 모드 출력 템플릿

이 문서는 `/code-architecture-writer flow` 모드의 출력 형식을 정의합니다. 실제 생성 시 이 템플릿의 구조를 따르되, 내용은 분석 결과로 채웁니다.

---

## 템플릿 구조

```markdown
# {프로젝트명} 실행 흐름

**Purpose**: `{entrypoint}`를 실행하면 어떤 코드가 어떤 순서로 호출되는지 정리
**Date**: {YYYY-MM-DD}

---

## 핵심 요약: 한눈에 보는 실행 흐름

```
{entrypoint}:main()
  -> {step_1}()
    -> {step_2}(config)
    -> {step_3}(algorithm, n_runners)
    -> {step_4}.fit(agent, train_data, val_data)
        -> strategy.execute(...)
            +-- [Process A]
            |   -> {process_a_flow}
            |
            +-- [Process B x N]
                -> {process_b_flow}
```

---

## 1단계: {단계 이름} ({파일명})

**파일**: `{파일 경로}`

```{언어}
{핵심 코드 발췌 -- Read tool로 실제 파일에서 복사}
```

**역할**: {이 단계가 하는 일 한 줄 요약}
**다음**: -> {다음 단계에서 호출하는 함수/클래스}

---

## 2단계: {단계 이름} ({파일명})

**파일**: `{파일 경로}`

```{언어}
{핵심 코드 발췌}
```

**역할**: {한 줄 요약}

---

(중간 단계 반복...)

---

## N단계: {최종 단계 이름} ({파일명})

**파일**: `{파일 경로}`

```{언어}
{핵심 코드 발췌}
```

**역할**: {한 줄 요약}

---

## 데이터 흐름 요약

```
[{데이터 소스}]
    |
    v
[{처리 단계 1}] --- {데이터 형태} ---> [{처리 단계 2}]
    |                                        |
    |                                        v
    |                                   [{중간 저장소}]
    |                                        |
    v                                        v
[{처리 단계 3}] <---- {데이터 회수}
    |
    |  (여기서 핵심 변환 발생)
    |
    v
[{출력 데이터 형태}]
    |
    v
[{최종 처리}]
    |
    v
[{결과 저장/로깅}]
```

---

## 핵심 파일 역할 정리

| 파일 | 역할 | 한줄 설명 |
|------|------|----------|
| `{entry_point}` | Entry Point | {설명} |
| `{file_1}` | {역할명} | {설명} |
| `{file_2}` | {역할명} | {설명} |
| ... | ... | ... |

---

## 왜 {핵심 파일}을 수정했는가?

**{핵심 파일}의 `{함수명}()`이 {핵심 역할 설명}이기 때문이다.**

{아키텍처 관점에서 왜 이 위치가 적절한지 근거 테이블:}

| 위치 | 가능 여부 | 이유 |
|------|-----------|------|
| {위치 A} | 불가능 | {이유} |
| {위치 B} | 부적절 | {이유} |
| **{선택된 위치}** | **적절** | {왜 여기가 최적인지} |
| {위치 D} | 가능하나 비효율 | {이유} |

따라서 **{선택된 위치}에서 {핵심 작업}하는 것이 가장 자연스러운 위치**다.
```

---

## 작성 규칙

### 단계 번호와 제목

형식: `## N단계: {단계 이름} ({파일명})`

- 단계 번호는 실행 순서를 반영
- 단계 이름은 해당 단계의 역할을 한국어로 명명 (예: "진입점", "Algorithm 생성", "학습 루프")
- 괄호 안 파일명은 해당 코드가 위치한 파일

### 핵심 요약 다이어그램

문서 상단의 "한눈에 보는 실행 흐름"은 전체 호출 체인을 트리 형태로 보여준다.

규칙:
- 들여쓰기로 호출 깊이 표현
- `->` 로 순차 호출 표현
- `+--` 로 병렬/분기 표현
- `[대괄호]`로 프로세스 그룹 표현
- 각 줄 끝에 주석으로 역할 설명 가능

```
train.py:main()
  -> train()
    -> Algorithm(config)               # Algorithm 생성
    -> Trainer(algorithm, n_runners)    # Trainer 생성
    -> trainer.fit(agent, data)
        -> strategy.execute(...)
            +-- [Algorithm Process]
            |   -> Algorithm.run() -> run_training()
            |
            +-- [Runner Processes x N]
                -> Runner.iter()
```

### 코드 발췌 규칙

각 단계의 코드 발췌는 해당 단계의 핵심 로직만 포함한다.

- 전체 함수를 복사하지 않고 핵심 흐름만 발췌
- 생략 부분은 `# ...` 또는 `...`으로 표시
- 변수명과 함수명은 실제 코드와 정확히 일치해야 함
- 주석은 이해를 돕기 위해 추가 가능

```python
def main():
    args = parser.parse_args()
    train(
        train_file=args.train_file,
        val_file=args.val_file,
        # ...
    )

def train(...):
    config = default_config()
    # config override (model, lora, filter 등)

    algorithm = Algorithm(config)            # -> 2단계
    trainer = Trainer(                       # -> 3단계
        n_runners=10,
        algorithm=algorithm,
    )
    trainer.fit(agent, train_dataset)        # -> 4단계
```

### 데이터 흐름 다이어그램

데이터가 시스템을 통해 어떻게 변환되는지를 보여준다.

규칙:
- `[대괄호]`로 처리 단계/컴포넌트 표현
- `|` + `v` 로 순방향 흐름
- `<----` 로 역방향 데이터 회수
- 화살표 사이에 데이터 형태 설명 가능
- 핵심 변환 지점은 괄호 주석으로 강조

```
[Dataset]
    |
    v
[Trainer] --- batch_dict(문제 목록) ---> [Daemon.setup]
    |                                        |
    |                                        v
    |                                   [Store] <- 요청 등록
    |                                        |
    |                                        v
    |                                   [Runner x N]
    |                                        | agent 실행
    |                                        v
    |                                   [Store] <- 결과 저장
    |                                        |
    v                                        v
[Daemon.get_data] <---- trace 회수
    |
    |  (핵심 변환: trace -> tensor)
    |
    v
[TensorDict]
    |
    v
[compute_advantage] (GRPO)
    |
    v
[update_actor] (Policy Gradient)
```

### "왜 이 파일을 수정했는가?" 섹션

문서 말미에 아키텍처 관점에서 왜 특정 파일이 수정 대상으로 적합한지를 근거 테이블로 제시한다.

- 가능한 모든 위치를 나열
- 각 위치의 가능 여부와 이유를 설명
- 선택된 위치를 **볼드**로 강조
- 결론 문장으로 마무리

---

## 실제 예시 (참고)

아래는 실제 프로젝트에서 생성된 문서의 일부이다.

### 핵심 요약 예시

```
train_calc_agent.py:main()
  -> train()
    -> agl.VERL(config)                    # Algorithm 생성
    -> agl.Trainer(algorithm, n_runners)    # Trainer 생성
    -> trainer.fit(agent, train_data, val_data)
        -> strategy.execute(algorithm_bundle, runner_bundle, store)
            +-- [Algorithm Process]
            |   -> VERL.run() -> run_ppo() -> TaskRunner.run()
            |   -> AgentLightningTrainer.fit()
            |     FOR each step:
            |       -> daemon.set_up_data_and_server()
            |       -> daemon.run_until_all_finished()
            |       -> daemon.get_train_data_batch()
            |       -> compute_advantage()
            |       -> update_actor()
            |
            +-- [Runner Processes x N]
                -> LitAgentRunner.iter()
                  LOOP:
                    -> store.claim_rollout()
                    -> agent(task, llm)
                    -> agl.emit_reward(reward)
                    -> store 에 결과 저장
```

### 단계 설명 예시

```markdown
## 1단계: 진입점 (train_calc_agent.py)

**파일**: `examples/calc_x/train_calc_agent.py`

```python
def main():
    args = parser.parse_args()
    train(
        train_file=args.train_file,
        val_file=args.val_file,
        filter_unexpected_tool_calls=args.filter_unexpected_tool_calls,
        n_gpus=args.n_gpus,
        checkpoint_dir=args.checkpoint_dir,
        ...
    )

def train(...):
    config = verl_default_config()
    # config override (model, lora, filter 등)

    algorithm = agl.VERL(config)           # -> 2단계
    trainer = agl.Trainer(                 # -> 3단계
        n_runners=10,
        algorithm=algorithm,
    )
    trainer.fit(calc_agent, train_dataset, val_dataset=val_dataset)  # -> 4단계
```

**역할**: CLI 파싱 -> config 구성 -> Algorithm/Trainer 생성 -> 학습 시작
```

### 핵심 파일 역할 정리 예시

```markdown
| 파일 | 역할 | 한줄 설명 |
|------|------|----------|
| `train_calc_agent.py` | Entry Point | CLI -> config -> Trainer.fit() |
| `interface.py` | Algorithm | VERL config 합성 -> run_ppo() 호출 |
| `trainer.py` | Trainer | Strategy로 Algorithm+Runner 병렬 실행 |
| `entrypoint.py` | Ray Launcher | Ray 클러스터에서 TaskRunner 시작 |
| `trainer.py` | Training Loop | _train_step() 반복 (rollout -> GRPO update) |
| `daemon.py` | Data Bridge | trace -> tensor 변환 + tool call filtering |
| `config.yaml` | Config | VERL 기본 설정값 |
| `calc_agent.py` | Agent | MCP Calculator로 수학 문제 풀기 |
```

### "왜 수정했는가?" 예시

```markdown
## 왜 daemon.py를 수정했는가?

**daemon.py의 `get_train_data_batch()`가 trace -> tensor 변환의 유일한 지점이기 때문이다.**

학습 파이프라인에서 필터링을 적용할 수 있는 위치는 제한적이다:

| 위치 | 가능 여부 | 이유 |
|------|-----------|------|
| Runner (agent 실행 중) | 불가능 | 실행 시점에서는 "unexpected"인지 판단 불가 |
| Store (결과 저장 시) | 부적절 | Store는 데이터 저장소일 뿐, 학습 로직 무관 |
| **Daemon (trace -> tensor)** | **적절** | rollout 완료 후, GRPO loss 계산 직전. gradient에 포함되기 직전에 제거 가능 |
| Trainer (loss 계산 시) | 가능하나 비효율 | 이미 tensor화 된 후 제거하면 padding 낭비 |

따라서 **daemon.py의 `get_train_data_batch()`에서 trace_list를 순회하며
invalid turn을 제거하는 것이 가장 자연스러운 위치**다.
```
