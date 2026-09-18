# Sankey 다이어그램 생성 가이드

## 개요

매출 세그먼트 → 총매출 → 비용 → 이익 흐름을 시각화.

## 패키지 설치

```bash
pip install plotly kaleido --break-system-packages
```

## 안정적인 코드 (한글 깨짐 방지)

```python
import plotly.graph_objects as go
import plotly.io as pio

# 영문 라벨 사용 (한글 깨짐 방지)
labels = [
    "Data Center",      # 0
    "Gaming",           # 1
    "Pro Visualization",# 2
    "Automotive",       # 3
    "Total Revenue",    # 4
    "COGS",             # 5
    "Gross Profit",     # 6
    "OpEx",             # 7
    "Operating Income"  # 8
]

# source → target 흐름 정의
source = [0, 1, 2, 3, 4, 4, 6, 6]
target = [4, 4, 4, 4, 5, 6, 7, 8]
value = [1152, 114, 19, 15, 326, 974, 204, 770]  # 억 달러

# 색상
node_colors = [
    "#1f77b4", "#1f77b4", "#1f77b4", "#1f77b4",  # 세그먼트 (파란색)
    "#7f7f7f",  # 총매출 (회색)
    "#d62728",  # COGS (빨간색)
    "#2ca02c",  # 매출총이익 (녹색)
    "#ff7f0e",  # OpEx (주황색)
    "#2ca02c"   # 영업이익 (녹색)
]

link_colors = [
    "rgba(31,119,180,0.3)", "rgba(31,119,180,0.3)", 
    "rgba(31,119,180,0.3)", "rgba(31,119,180,0.3)",
    "rgba(214,39,40,0.3)", "rgba(44,160,44,0.3)",
    "rgba(255,127,14,0.3)", "rgba(44,160,44,0.3)"
]

fig = go.Figure(data=[go.Sankey(
    node=dict(
        pad=20, thickness=25,
        line=dict(color="black", width=0.5),
        label=labels, color=node_colors
    ),
    link=dict(source=source, target=target, value=value, color=link_colors)
)])

fig.update_layout(
    title="Revenue Structure ($ Billion)",
    font=dict(size=12, family="Arial"),
    width=1000, height=600,
    paper_bgcolor="white"
)

# 저장 (에러 핸들링)
try:
    fig.write_image("sankey.png", scale=2)
    print("저장 완료: sankey.png")
except Exception as e:
    print(f"PNG 저장 실패: {e}")
    fig.write_html("sankey.html")
    print("HTML로 대체 저장: sankey.html")
```

## docx 삽입

```python
from docx import Document
from docx.shared import Inches

doc = Document()
doc.add_picture('sankey.png', width=Inches(6))
doc.save('report.docx')
```

## 한글 라벨 필요 시

```bash
# Noto Sans KR 설치
apt-get install -y fonts-noto-cjk
fc-cache -fv
```

```python
# 한글 라벨 버전
labels_kr = ["데이터센터", "게이밍", "프로 시각화", "자동차", 
             "총매출", "매출원가", "매출총이익", "영업비용", "영업이익"]
```

## 체크리스트

- [ ] source에서 나가는 값 = target으로 들어오는 값 (합계 일치)
- [ ] 비용은 빨간색, 이익은 녹색
- [ ] 왼쪽→오른쪽 흐름
