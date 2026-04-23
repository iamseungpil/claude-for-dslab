---
name: paper-banana
description: |
  논문 텍스트에서 publication-ready 학술 일러스트레이션(methodology diagram, statistical plot, system architecture)을 자동 생성하는 스킬.
  Google의 PaperBanana 멀티 에이전트 파이프라인(Retriever→Planner→Stylist→Visualizer→Critic)을 사용하여
  논문 figure를 자동으로 생성, 수정, 평가한다.

  이 스킬은 다음 상황에서 반드시 사용한다:
  - 논문 figure/diagram 생성 요청 ("논문 그림 그려줘", "methodology diagram", "figure 생성", "architecture diagram")
  - 통계 차트/plot 생성 ("결과 차트", "bar chart", "plot 그려줘", "statistical plot")
  - 학술 일러스트레이션 관련 ("시스템 구조도", "pipeline 그림", "모델 아키텍처 시각화")
  - PaperBanana 직접 호출 ("paperbanana", "paper banana")
  - 논문 figure 품질 평가 ("figure 평가", "diagram 비교", "그림 품질 확인")
  - 논문 작성 중 시각 자료 필요 시 ("이 방법론을 그림으로", "이 결과를 차트로")

  MANDATORY TRIGGERS: paperbanana, paper banana, 논문 figure, 논문 그림, methodology diagram,
  architecture diagram, statistical plot, 학술 일러스트레이션, figure 생성, 차트 생성,
  시스템 구조도, pipeline diagram, 모델 아키텍처 시각화, figure 평가, diagram 비교
---

# PaperBanana — Academic Illustration Generator

논문 텍스트로부터 publication-ready 학술 일러스트레이션을 자동 생성한다.
5개 에이전트(Retriever, Planner, Stylist, Visualizer, Critic)가 협력하여
방법론 다이어그램, 통계 차트, 시스템 아키텍처 등을 생성하고 반복 개선한다.

## 사전 요구사항

- `paperbanana[mcp]` 패키지: `pip install paperbanana[mcp]`
- 환경변수 `GOOGLE_API_KEY` 설정 (Google AI Studio 발급)
- MCP 서버 등록 시: `claude mcp add paperbanana -e GOOGLE_API_KEY=<key> -- uvx --from "paperbanana[mcp]" paperbanana-mcp`

## 핵심 명령어

### Methodology Diagram 생성

논문 방법론 텍스트를 입력하면 publication-quality 다이어그램을 생성한다.

```bash
paperbanana generate \
  --input <텍스트_파일.txt> \
  --caption "<Figure 캡션>" \
  --optimize --auto
```

주요 옵션:
- `--input` / `-i`: 방법론 텍스트 파일(.txt) 또는 논문 PDF(.pdf)
- `--caption` / `-c`: communicative intent (그림이 전달해야 할 핵심 메시지)
- `--optimize`: 입력 전처리로 품질 향상
- `--auto`: Critic이 만족할 때까지 자동 반복
- `--iterations N` / `-n`: 수동 반복 횟수 (기본 3)
- `--format [png|jpeg|webp]`: 출력 포맷

PDF 입력 시:
```bash
paperbanana generate \
  --input paper.pdf \
  --caption "Overview of our framework" \
  --pdf-pages "3-8" \
  --optimize --auto
```

### Statistical Plot 생성

CSV 데이터에서 통계 차트를 Matplotlib 코드로 생성한다(수학적 정확성 보장).

```bash
paperbanana plot \
  --data <결과.csv> \
  --intent "<원하는 차트 설명>"
```

### 품질 평가

생성된 다이어그램을 참조 이미지와 비교 평가한다.
Faithfulness, Readability, Conciseness, Aesthetics 4가지 기준.

```bash
paperbanana evaluate \
  --generated <생성된_이미지.png> \
  --reference <참조_이미지.png> \
  --context <원본_텍스트.txt> \
  --caption "<캡션>"
```

### 이전 결과 수정

사용자 피드백을 반영하여 이전 결과에서 이어서 수정한다.

```bash
paperbanana generate --continue --feedback "화살표를 더 굵게 해줘"
paperbanana generate --continue-run <run_ID> --iterations 3
```

### 배치 생성

논문 내 여러 figure를 한 번에 생성한다.

```bash
paperbanana batch --manifest manifest.yaml --optimize
```

manifest 형식:
```yaml
items:
  - input: method1.txt
    caption: "Encoder-decoder overview"
    id: fig1
  - input: method2.txt
    caption: "Training pipeline"
    id: fig2
```

## Python API

코드 레벨에서 직접 호출할 때:

```python
import asyncio
from paperbanana import PaperBananaPipeline, GenerationInput, DiagramType
from paperbanana.core.config import Settings

settings = Settings(
    vlm_provider="google",
    vlm_model="gemini-2.5-pro",
    image_provider="google",
    image_model="gemini-2.5-flash",
    optimize_inputs=True,
    auto_refine=True,
)

pipeline = PaperBananaPipeline(settings=settings)
result = asyncio.run(pipeline.generate(
    GenerationInput(
        source_context="Our framework consists of...",
        communicative_intent="Overview of the proposed method.",
        diagram_type=DiagramType.METHODOLOGY,
    )
))
print(f"Output: {result.image_path}")
```

## 워크플로우

1. 사용자가 논문 텍스트나 PDF를 제공하면, figure로 만들 부분을 파악한다
2. 적절한 caption(communicative intent)을 함께 작성한다 — 이것이 그림의 핵심 메시지가 된다
3. `paperbanana generate`로 생성하고 결과 이미지를 사용자에게 보여준다
4. 사용자 피드백이 있으면 `--continue --feedback`으로 수정한다
5. 최종 결과물을 workspace 폴더에 저장한다

## 출력 구조

```
outputs/run_<timestamp>_<hash>/
├── final_output.png      # 최종 이미지
├── metadata.json         # 생성 메타데이터
├── iterations/           # 반복 과정
│   ├── iteration_0.png
│   └── iteration_1.png
└── intermediate_states/  # 중간 상태
```

## 사용 한도 참고 (Gemini API Tier 2)

그림 1장당 약 10~20 API 호출을 소비한다.
Tier 2 기준 일일 500요청이면 하루 약 25~50장의 figure를 생성할 수 있다.
Rate limit 에러 시 잠시 후 재시도하거나 Flash-Lite 모델로 전환한다.
