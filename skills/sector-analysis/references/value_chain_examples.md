# 테마별 밸류 체인 예시

## AI / 데이터센터

```
[설계/IP] → [파운드리] → [패키징] → [메모리] → [시스템] → [클라우드] → [앱]
    │          │           │          │          │          │          │
  NVIDIA     TSMC       Amkor     SK하이닉스   Dell       AWS      OpenAI
  AMD        삼성        ASE       Micron    Supermicro  Azure    Anthropic
  ARM       Intel                  삼성        HPE        GCP      Google
  Broadcom                                   Nvidia DGX
```

**핵심 노드**: GPU 설계, 파운드리, HBM 메모리

**수요 원천**: AI 모델 학습/추론에 병렬 연산 필수 → GPU 수요 폭발

---

## 반도체 리쇼어링 (CHIPS Act)

```
[팹 설계] → [건설] → [장비] → [소재] → [제조] → [후공정]
    │         │        │        │        │         │
  설계사    건설사    ASML    Entegris  Intel     Amkor
                     AMAT     Linde   TSMC(AZ)    ASE
                     Lam    Air Liquide 삼성(TX)
                     KLA     DuPont    Micron
                    Tokyo Electron
```

**핵심 노드**: 장비 (ASML EUV 독점), 소재 (특수가스/화학)

**수요 원천**: 미국 반도체 자급률 12% → 공급망 안보 우려 → 정책 지원

---

## 자율주행

```
[센서] → [반도체] → [소프트웨어] → [차량 OEM] → [모빌리티 서비스]
   │         │           │            │              │
 Luminar   NVIDIA     Waymo        Tesla         Waymo
 Velodyne  Mobileye   Cruise        GM           Cruise
 Hesai     Qualcomm   Aurora       Ford          Uber
           NXP       Mobileye     현대/기아      Lyft
```

**핵심 노드**: 센서 (LiDAR), AI 칩, 소프트웨어 스택

**수요 원천**: 인건비 상승 + 안전 + 효율 → 자율주행 경제성 확보 시점 도래

---

## 로보틱스 / 휴머노이드

```
[액추에이터] → [센서] → [AI/제어] → [통합] → [애플리케이션]
      │          │         │          │           │
 Harmonic    Intel    NVIDIA    Tesla Bot    물류 자동화
 Nabtesco   Cognex    Figure    Agility      제조 자동화
            Keyence   Boston    Unitree      가사/돌봄
                     Dynamics
```

**핵심 노드**: 액추에이터 (감속기), AI 칩

**수요 원천**: 노동력 부족 + AI 발전 → 범용 로봇 경제성 임계점 접근

---

## 우주 산업

```
[발사체] → [위성 제조] → [지상 인프라] → [서비스]
    │           │             │            │
 SpaceX     Maxar        Viasat      Starlink
 Rocket Lab  Lockheed    Iridium     OneWeb
 Blue Origin Northrop    SES         Planet
             Boeing
```

**핵심 노드**: 발사체 (재사용), 위성 제조 (대량 생산)

**수요 원천**: 발사 비용 급락 (SpaceX) → 위성 인터넷/관측 경제성 확보

---

## 에너지 전환

```
[발전] → [송배전] → [저장] → [소비]
   │         │        │        │
 원전(SMR)   Grid    ESS      EV
 태양광    변압기   배터리   히트펌프
 풍력     인버터    CATL    
NextEra   Quanta   LG에너지솔루션
          Eaton    삼성SDI
```

**핵심 노드**: SMR (원전), ESS (배터리), 그리드 인프라

**수요 원천**: AI 데이터센터 전력 수요 폭증 + 탈탄소 정책

---

## 핵심 노드 평가 템플릿

| 노드 | 병목(0-3) | 대체불가(0-3) | 마진집중(0-3) | 레버리지(0-3) | 합계 |
|------|----------|--------------|--------------|--------------|------|
| [노드명] | | | | | |

**8점 이상 = 핵심 노드 ⭐**
