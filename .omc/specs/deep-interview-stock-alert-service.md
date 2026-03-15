# Deep Interview Spec: 주식 정보 조회 및 알림 웹 서비스

## Metadata
- Interview ID: stock-alert-service-20260316
- Rounds: 5
- Final Ambiguity Score: 13%
- Type: greenfield
- Generated: 2026-03-16
- Threshold: 20%
- Status: PASSED

## Clarity Breakdown
| 차원 | 점수 | 가중치 | 기여 |
|------|------|--------|------|
| 목표 명확도 | 0.92 | 40% | 0.37 |
| 제약 명확도 | 0.85 | 30% | 0.26 |
| 성공 기준 | 0.82 | 30% | 0.25 |
| **총 명확도** | | | **0.87** |
| **모호도** | | | **13%** |

## Goal
한국(KOSPI 200) + 미국(S&P 500, QQQ) 대형 우량주를 대상으로, 최근 6개월 전고점 대비 다단계 하락(10~30%) 시 웹 푸시 알림을 발송하는 주식 정보 조회 웹 서비스. 소셜 로그인(구글 우선), 즐겨찾기, 상세 지표 제공.

---

## 기능 명세

### 1. 소셜 로그인
- **초기 구현:** Google OAuth 2.0
- **확장 가능 구조:** Kakao, Naver 추후 추가 가능하도록 OAuth provider 추상화
- **앱 확장:** 추후 모바일 앱 대응을 위해 JWT 기반 인증 사용

### 2. 주식 정보 조회
- **대상:** 한국(KOSPI 200 편입) + 미국(S&P 500, QQQ 편입) 종목
- **상세 화면 표시 지표:**
  - 실시간 가격 (호가, 등락률)
  - 차트 (일봉/주봉/월봉)
  - 거래량 (일평균 대비 현재 비교)
  - PER / PBR
  - 배당률 / 배당수익률
  - 52주 최고가 / 최저가 + 현재가 대비 위치

### 3. 주식 분석 및 알림
- **대상 종목:** KOSPI 200 + S&P 500 + QQQ 편입 종목 (즐겨찾기 종목은 지수 편입 무관 알림)
- **전고점 기준:** 최근 6개월 내 최고가
- **알림 단계:**

| 단계 | 하락률 | 색상 |
|------|--------|------|
| 1단계 | -10% | 노란색 |
| 2단계 | -15% | 주황색 |
| 3단계 | -20% | 빨간색 |
| 4단계 | -25% | 진한 빨간색 |
| 5단계 | -30% | 검은색/경보 |

- **알림 방식:** 웹 푸시 (PWA Service Worker)
- **사용자 설정:** 수신할 단계 직접 선택 가능 (예: 20% 이상만 수신)
- **즐겨찾기 종목:** 사용자 설정과 무관하게 모든 단계 알림 수신

### 4. 즐겨찾기
- 사용자별 관심 종목 저장
- 즐겨찾기 종목 → 3번 알림 무조건 수신 (대형주 여부 무관)
- 즐겨찾기 목록 화면에서 일괄 현황 확인

---

## Constraints
- **플랫폼:** 웹 우선, PWA로 모바일 대응 (추후 네이티브 앱 확장 고려)
- **인증:** Google OAuth 우선, 구조는 멀티 프로바이더 확장 가능
- **알림:** 웹 푸시 (Service Worker) — SMS/이메일은 초기 범위 외
- **대형주 필터:** 지수 편입 여부 기반 (KOSPI 200 / S&P 500 / QQQ)
- **전고점:** 최근 6개월 최고가 기준
- **실시간 데이터:** 주식 데이터 API 필요 (한국: 한국투자증권 API / 미국: Yahoo Finance 또는 Polygon.io 검토)

## Non-Goals
- 초기 버전에서 Kakao/Naver 로그인 구현
- SMS/이메일 알림
- 주식 매매 기능
- 포트폴리오 수익률 계산
- AI 기반 투자 추천

## Acceptance Criteria
- [ ] Google 로그인으로 회원가입/로그인 가능
- [ ] KOSPI 200 / S&P 500 / QQQ 종목 목록 조회 가능
- [ ] 종목 상세 화면에서 실시간 가격, 차트, 거래량, PER/PBR, 배당률, 52주 고저가 표시
- [ ] 전고점 대비 10/15/20/25/30% 하락 시 각 단계별 색상으로 구분된 웹 푸시 알림 발송
- [ ] 사용자가 수신할 알림 단계 설정 가능
- [ ] 종목 즐겨찾기 추가/제거 가능
- [ ] 즐겨찾기 종목은 사용자 설정 무관하게 모든 단계 알림 수신
- [ ] PWA 설치 후 백그라운드 알림 동작
- [ ] Kakao/Naver 로그인 추가 시 코드 변경 최소화되는 구조

## Assumptions Exposed & Resolved
| 가정 | 질문 | 결론 |
|------|------|------|
| 한국 주식만 | "어느 나라 주식?" | 한국 + 미국 모두 |
| 앱 푸시 필요 | "알림 방식?" | 웹 푸시 (PWA)로 충분 |
| 고정 임계값 | "알림 기준 % ?" | 10~30% 다단계 + 사용자 설정 |
| 대형주 = 시총 기준 | "'대형 우량주' 정의?" | 지수 편입 종목 (KOSPI 200, S&P 500, QQQ) |
| 차트만 표시 | "추가 지표?" | 거래량, PER/PBR, 배당률, 52주 고저가 전부 |

## Ontology (Key Entities)

| Entity | Type | Fields | Relationships |
|--------|------|--------|---------------|
| User | core domain | id, email, provider, alertSettings | has many Favorites, receives Alerts |
| Stock | core domain | symbol, name, market, currentPrice, change | belongs to IndexMembership |
| IndexMembership | supporting | index(KOSPI200/SP500/QQQ), stock | filters BlueChipStock |
| StockDetail | supporting | price, volume, per, pbr, dividendYield, week52High, week52Low | belongs to Stock |
| Chart | supporting | period, dataPoints | belongs to Stock |
| AlertCondition | core domain | dropThresholds[], userCustomizable | triggers Alert |
| Alert | core domain | stock, level, dropPercent, color, timestamp | sent to User |
| Favorite | core domain | userId, stockId | User has many Favorites |
| SocialLogin | supporting | provider(google/kakao/naver), token | authenticates User |
| PWANotification | supporting | serviceWorker, subscription | delivers Alert |

## Ontology Convergence
| Round | Entity Count | New | Changed | Stable | Stability Ratio |
|-------|-------------|-----|---------|--------|----------------|
| 1 | 8 | 8 | - | - | N/A |
| 2 | 8 | 0 | 0 | 8 | 100% |
| 3 | 9 | 1 | 0 | 8 | 89% |
| 4 | 10 | 1 | 0 | 9 | 90% |
| 5 | 10 | 0 | 0 | 10 | 100% |

## Interview Transcript
<details>
<summary>전체 Q&A (5 라운드)</summary>

### Round 1
**Q:** 어느 나라 주식을 대상으로 하나요?
**A:** 한국 + 미국 모두
**모호도:** 52%

### Round 2
**Q:** 알림 방식을 어떻게 할까요?
**A:** 웹 푸시 (PWA)
**모호도:** 42%

### Round 3
**Q:** 전고점 대비 몇 % 하락 시 알림, 사용자 설정 가능?
**A:** 10%, 15%, 20%, 25%, 30% 다단계 + 색상 구분 + 사용자 지정 가능
**모호도:** 30%

### Round 4 (Contrarian Mode)
**Q:** '대형 우량주' 정의가 무엇인가요?
**A:** KOSPI 200, S&P 500, QQQ 편입 종목 + 즐겨찾기는 무관
**모호도:** 21%

### Round 5
**Q:** 차트·실시간 가격 외 어떤 지표를 보여줄까요?
**A:** 거래량, PER/PBR, 배당률, 52주 최고가/최저가 전부
**모호도:** 13% ✓

</details>
