# Bull/Bear/Base 추세선 그래프 가이드

## 핵심 원칙: 내러티브 기반 예측

**숫자는 작성된 내러티브에서 논리적으로 도출한다.**

| 시나리오 | 내러티브 근거 | 성장률 |
|----------|--------------|--------|
| Bull | "AI 투자 2027년까지 지속, CUDA 해자 유지" | 연 25% |
| Base | "성장 둔화지만 지속, 경쟁 심화" | 연 15-20% |
| Bear | "AI 버블 붕괴, 설비투자 50% 축소" | 정체/역성장 |

## 코드

```python
import matplotlib.pyplot as plt
import numpy as np

# 과거 실적 (Fact Base에서 검증된 데이터)
hist_years = [2021, 2022, 2023, 2024, 2025]
hist_revenue = [269, 270, 609, 609, 1305]  # 억 달러

# 미래 연도
forecast_years = [2025, 2026, 2027, 2028, 2029, 2030]

# 내러티브 기반 성장률 계산
def forecast(base, rates):
    result = [base]
    for r in rates:
        result.append(result[-1] * (1 + r))
    return result

# Bull: 점진적 둔화 (30%→20%)
bull = forecast(1305, [0.30, 0.28, 0.25, 0.22, 0.20])

# Base: 성장 둔화 (35%→15%)
base = forecast(1305, [0.35, 0.20, 0.18, 0.15, 0.15])

# Bear: 정체/역성장
bear = forecast(1305, [0.15, 0.05, 0.00, -0.05, -0.03])

# 그래프
fig, ax = plt.subplots(figsize=(12, 7))

# 과거 (실선)
ax.plot(hist_years, hist_revenue, 'o-', color='#333', lw=2.5, ms=8, label='Historical')

# 미래 (점선)
ax.plot(forecast_years, bull, 's--', color='#2ca02c', lw=2, ms=6, label='Bull')
ax.plot(forecast_years, base, '^--', color='#1f77b4', lw=2, ms=6, label='Base')
ax.plot(forecast_years, bear, 'v--', color='#d62728', lw=2, ms=6, label='Bear')

# 불확실성 영역
ax.fill_between(forecast_years, bull, bear, alpha=0.15, color='gray')

# 과거/미래 구분선
ax.axvline(x=2025, color='gray', ls=':', lw=1.5, alpha=0.7)

# 최종값 주석
for val, color in [(bull[-1], '#2ca02c'), (base[-1], '#1f77b4'), (bear[-1], '#d62728')]:
    ax.annotate(f'${val:.0f}B', xy=(2030, val), xytext=(10, 0),
                textcoords='offset points', fontsize=10, fontweight='bold', color=color)

ax.set_xlabel('Year', fontweight='bold')
ax.set_ylabel('Revenue ($ Billion)', fontweight='bold')
ax.set_title('Revenue Forecast: Bull / Base / Bear', fontweight='bold')
ax.legend(loc='upper left')
ax.grid(True, alpha=0.3, ls='--')
ax.set_xlim(2020.5, 2030.5)

plt.tight_layout()
plt.savefig('forecast.png', dpi=200, bbox_inches='tight', facecolor='white')
```

## 성장률 도출 예시

```
Bull Case 내러티브:
"AI 투자 사이클이 2027년까지 지속. 하이퍼스케일러 설비투자 6,000억 달러,
Blackwell 2.2배 성능으로 교체 수요, CUDA 해자 유지"

→ 도출:
2026: 30% (Blackwell 출시)
2027: 28% (지속 수요)
2028: 25% (점진적 둔화)
2029: 22% (성숙기)
2030: 20% (안정 성장)
```

## 색상 표준

| 시나리오 | 색상 | Hex |
|----------|------|-----|
| Bull | 녹색 | #2ca02c |
| Base | 파란색 | #1f77b4 |
| Bear | 빨간색 | #d62728 |
| Historical | 검정 | #333333 |
