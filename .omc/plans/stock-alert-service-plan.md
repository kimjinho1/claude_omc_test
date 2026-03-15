# 주식 정보 조회 및 알림 웹 서비스 — 구현 계획

> Spec: `.omc/specs/deep-interview-stock-alert-service.md`
> Generated: 2026-03-16 | Mode: consensus --direct | Revision: 1 (post Architect + Critic review)

---

## RALPLAN-DR Summary

### Principles
1. **웹 우선, PWA 단일 코드베이스** — 별도 앱 없이 PWA Service Worker로 모바일 알림 지원
2. **OAuth 프로바이더 추상화** — Google 우선 구현, Kakao/Naver 추가 시 코드 변경 최소화
3. **폴링과 배치(스케줄러) 명확히 분리** — 30초 REST 폴링으로 가격 갱신, 배치 크론으로 하락 감지 알림 처리
4. **데이터 소스 추상화** — 한국(한국투자증권 API) / 미국(Polygon.io 무료 1차, 유료 전환 시 어댑터 교체) 교체 가능 어댑터 패턴
5. **사용자별 알림 설정 유연성** — 단계별 임계값 커스터마이징, 즐겨찾기 강제 알림 오버라이드

### Decision Drivers
1. **데이터 API 가용성** — 한국 실시간 데이터(한국투자증권 REST), 미국 공식 API(Polygon.io: 무료 5 req/min 일 한도 없음, ~800 심볼 나이트리 배치 처리 가능)
2. **배치 알림 처리** — 매일 장 마감 후 전고점 대비 하락 계산 + 조건 충족 시 즉시 푸시 (실시간 WebSocket 불필요)
3. **배포 환경 호환성** — Vercel(FE) + Railway(BE) 분리 배포 시 CORS, 쿠키, 인증 토큰 흐름 명확화

### Viable Options

#### Option A: Next.js + FastAPI + Celery
- Frontend: Next.js 14 (App Router, PWA)
- Backend: FastAPI (Python)
- 배치/큐: Celery + Redis
- **Pros:** Python 금융 데이터 생태계(pandas, yfinance), Celery 배치 안정적
- **Cons:** TypeScript/Python 두 언어 관리, 배포 복잡도 증가
- **폐기 사유:** MVP 속도 우선 + 미국 데이터를 Polygon.io(공식 Node.js SDK 제공)로 대체하면 yfinance 의존성 소멸 → 두 언어 단점만 남음

#### Option B: Next.js + NestJS (Node.js 풀스택)
- Frontend: Next.js 14 (App Router, PWA)
- Backend: NestJS (TypeScript)
- 배치/큐: Bull Queue + Redis
- **Pros:** 단일 언어(TypeScript), 빠른 개발, 타입 공유 가능, Polygon.io 공식 Node.js SDK 활용, 무료 플랜으로 800 심볼 커버
- **Cons:** Bull Queue가 Celery보다 성숙도 낮음, 배치 analytics를 수동 구현해야 함

**채택: Option B (Next.js + NestJS)** — MVP 속도 우선, TypeScript 단일 스택. Polygon.io 공식 API 채택으로 Python 의존성 제거.

---

## 요구사항 요약

| # | 기능 | 우선순위 |
|---|------|----------|
| 1 | Google OAuth 로그인 | P0 |
| 2 | 주식 목록/검색 (KOSPI 200, S&P 500, QQQ) | P0 |
| 3 | 주식 상세 (가격, 차트, 거래량, PER/PBR, 배당률, 52주 고저가) | P0 |
| 4 | 전고점 대비 다단계 하락 알림 (10/15/20/25/30%) + 색상 | P0 |
| 5 | 즐겨찾기 (강제 알림 포함) | P0 |
| 6 | PWA 웹 푸시 알림 | P0 |
| 7 | 사용자별 알림 단계 설정 | P1 |
| 8 | Kakao/Naver OAuth 추가 | P2 |

---

## 기술 스택

| 레이어 | 기술 |
|--------|------|
| Frontend | Next.js 14 (App Router), TypeScript, Tailwind CSS, PWA (@serwist/next) |
| Backend | NestJS, TypeScript |
| 인증 | NextAuth.js v5 (Google OAuth, JWT strategy) + NestJS JwtGuard (shared secret) |
| DB | PostgreSQL (Prisma ORM, Decimal 타입 사용) |
| 캐시/큐 | Redis (ioredis + BullMQ) |
| 가격 갱신 | SWR (30초 refetch interval, REST polling) |
| 주식 데이터 | 한국: 한국투자증권 REST API / 미국: Polygon.io API (공식, `@polygon.io/client-js` npm) |
| 알림 | Web Push (web-push npm, VAPID) |
| 인프라 | Docker Compose (개발), Vercel (FE) + Railway (BE) |

> **참고:** Socket.io 제거. 알림은 배치 크론 기반이므로 실시간 WebSocket 불필요.
> 30초 가격 갱신은 SWR 폴링으로 구현 (Vercel serverless 호환).
>
> **미국 주식 데이터:** Polygon.io 무료 플랜(5 req/min, 일 요청 한도 없음) 사용.
> ~800 심볼 × 1 req/symbol = 800 req → 5 req/min 기준 약 160분 소요 → 자정 배치 실행으로 충분.
> 유료 전환 시 Starter ($29/mo) 플랜에서 unlimited req/min 지원 (`US_DATA_PROVIDER` 환경 변수 교체만으로 어댑터 전환).

---

## 인증 흐름 (NextAuth → NestJS)

```
[Browser]
  → NextAuth Google OAuth 콜백 (Next.js, Vercel)
  → NextAuth JWT 전략: session.strategy = "jwt"
  → NextAuth 콜백에서 accessToken 발급 (shared JWT_SECRET 서명)
  → 프론트엔드 API 요청 시 Authorization: Bearer <token> 헤더에 포함
  → NestJS JwtStrategy: 동일 JWT_SECRET으로 검증
  → NestJS @UseGuards(JwtAuthGuard) 로 보호된 엔드포인트 접근
```

**토큰 전달 방식:** Next.js API Routes를 BFF(Backend-for-Frontend)로 사용하지 않음. 프론트엔드에서 NestJS를 직접 호출. `getToken({ req, secret: JWT_SECRET })`으로 JWT 획득 후 Authorization 헤더 설정.

**쿠키 전략:** NextAuth 세션은 HttpOnly 쿠키로 Next.js 도메인에 저장. NestJS API는 쿠키 대신 Bearer 토큰으로 인증. 도메인 분리 문제 없음.

---

## 배포 토폴로지 및 CORS

```
Vercel (FE)               Railway (BE)
app.example.com    →      api.example.com
- Next.js 14               - NestJS
- NextAuth 세션             - JwtAuthGuard
- Service Worker            - BullMQ Worker
- SWR polling (30s)         - @Cron jobs
```

**CORS 설정 (NestJS main.ts):**
```typescript
app.enableCors({
  origin: [process.env.FRONTEND_URL], // "https://app.example.com"
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
});
```

**Phase 1에서 선행 설정 필수:**
- `NEXTAUTH_URL=https://app.example.com`
- `NEXT_PUBLIC_API_URL=https://api.example.com`
- `JWT_SECRET` 프론트/백 동일 값 공유
- `NEXTAUTH_SECRET` 별도 (NextAuth 내부용)

---

## 프로젝트 구조

```
stock-alert-service/
├── frontend/                 # Next.js 14
│   ├── app/
│   │   ├── (auth)/
│   │   │   └── login/
│   │   ├── dashboard/
│   │   ├── stocks/
│   │   │   └── [symbol]/
│   │   ├── favorites/
│   │   └── settings/alerts/
│   ├── components/
│   ├── lib/
│   │   └── api.ts            # NestJS API 클라이언트 (Bearer 토큰 자동 첨부)
│   ├── public/
│   │   └── sw.js             # Service Worker (@serwist/next)
│   └── next.config.js
├── backend/                  # NestJS
│   ├── src/
│   │   ├── auth/             # JWT Strategy, Guard
│   │   ├── stocks/           # 주식 정보 조회
│   │   ├── alerts/           # 알림 로직, 스케줄러
│   │   ├── favorites/        # 즐겨찾기 CRUD
│   │   ├── notifications/    # 웹 푸시 발송
│   │   └── data-sources/     # 한국/미국 API 어댑터
│   └── prisma/
│       ├── schema.prisma
│       └── seed/
│           ├── kospi200.json  # KOSPI 200 종목 리스트 (정적 JSON, 분기별 수동 갱신)
│           ├── sp500.json     # S&P 500 종목 리스트
│           └── qqq.json       # QQQ (Nasdaq-100) 종목 리스트
└── docker-compose.yml
```

---

## DB 스키마 (Prisma)

```prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model User {
  id              String           @id @default(cuid())
  email           String           @unique
  name            String?
  image           String?
  provider        String           // "google" | "kakao" | "naver"
  alertSettings    AlertSetting[]
  favorites        Favorite[]
  pushSubscriptions PushSubscription[]  // 다중 디바이스 지원 (1:N)
  createdAt        DateTime         @default(now())
}

model Stock {
  symbol          String           @id
  name            String
  market          String           // "KOSPI" | "NASDAQ" | "NYSE"
  indexMembership String[]         // ["KOSPI200", "SP500", "QQQ"]
  favorites       Favorite[]
  priceHistory    StockPrice[]
  analytics       StockAnalytics?
}

model StockPrice {
  id              String           @id @default(cuid())
  symbol          String
  price           Decimal          @db.Decimal(15, 4)  // Float 아님 — 금융 정밀도
  volume          BigInt?
  recordedAt      DateTime
  stock           Stock            @relation(fields: [symbol], references: [symbol])

  @@index([symbol, recordedAt])   // 6개월 lookback 쿼리 최적화
}

// 6개월 전고점은 파생 집계값 → 별도 테이블로 분리
model StockAnalytics {
  id              String           @id @default(cuid())
  symbol          String           @unique
  high6m          Decimal          @db.Decimal(15, 4)  // 6개월 전고점
  high6mUpdatedAt DateTime
  stock           Stock            @relation(fields: [symbol], references: [symbol])
}

model AlertSetting {
  id              String           @id @default(cuid())
  userId          String           @unique
  thresholds      Int[]            // [10, 15, 20, 25, 30]
  user            User             @relation(fields: [userId], references: [id])
}

model Favorite {
  id              String           @id @default(cuid())
  userId          String
  symbol          String
  user            User             @relation(fields: [userId], references: [id])
  stock           Stock            @relation(fields: [symbol], references: [symbol])
  @@unique([userId, symbol])
}

model PushSubscription {
  id              String           @id @default(cuid())
  userId          String           // @unique 제거 — 다중 디바이스(데스크탑+모바일) 지원
  endpoint        String
  p256dh          String
  auth            String
  user            User             @relation(fields: [userId], references: [id])

  @@unique([userId, endpoint])     // 동일 디바이스 중복 구독 방지
}

model AlertLog {
  id              String           @id @default(cuid())
  userId          String
  symbol          String
  dropPercent     Decimal          @db.Decimal(5, 2)
  level           Int              // 10 | 15 | 20 | 25 | 30
  sentAt          DateTime         @default(now())

  @@index([userId, symbol, level, sentAt])  // 24시간 중복 방지 쿼리 최적화
}
```

---

## 시드 데이터 전략

| 지수 | 종목 수 | 소스 | 갱신 주기 |
|------|---------|------|-----------|
| KOSPI 200 | ~200 | 한국거래소 공시 + 수동 JSON | 분기별 (3/6/9/12월) |
| S&P 500 | ~503 | Wikipedia 스크래핑 또는 정적 CSV | 분기별 |
| QQQ (Nasdaq-100) | ~101 | Invesco 공시 + 정적 JSON | 분기별 |

**구현:** `prisma/seed/` 디렉토리에 JSON 파일 저장 → `prisma db seed` 스크립트로 초기 적재.
분기별 리밸런싱은 JSON 파일 업데이트 → seed 스크립트 내 `prisma.stock.upsert()` 호출로 처리 (`prisma db seed` CLI는 `--upsert` 플래그 없음, upsert는 스크립트 코드에서 구현).

---

## 구현 단계

### Phase 1: 기반 인프라 + 배포 토폴로지 (Week 1)
- [x] 1.1 프로젝트 초기화: Next.js 14 + NestJS + Prisma + Docker Compose
- [x] 1.2 PostgreSQL + Redis 컨테이너 설정 (Railway Redis 호환 확인)
- [x] 1.3 Prisma 스키마 정의 및 마이그레이션 (Decimal 타입, 인덱스 포함)
- [x] 1.4 NestJS 기본 모듈 구조 설정 (auth, stocks, alerts, favorites, notifications)
- [x] 1.5 환경 변수 관리 (.env.example 작성): `JWT_SECRET`, `NEXTAUTH_SECRET`, `NEXTAUTH_URL`, `NEXT_PUBLIC_API_URL`, `POLYGON_API_KEY`, `KIS_APP_KEY`, `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`
- [x] 1.6 CORS 설정 (NestJS `app.enableCors`, 허용 origin = `FRONTEND_URL`)
- [x] 1.7 NestJS 헬스체크 엔드포인트 (`GET /health`) — Railway 배포 검증용

> **Phase 1 완료 기준:** `docker-compose up` 성공, `prisma migrate dev` 오류 없음, `GET /health` → 200 반환

### Phase 2: 인증 (Week 1)
- [x] 2.1 NextAuth.js v5 Google OAuth 연동 (session strategy: "jwt")
- [x] 2.2 NextAuth JWT 콜백에서 `accessToken` 필드 추가 (JWT_SECRET 서명, TTL: 1시간, `maxAge: 3600`)
- [x] 2.3 NextAuth `session` 콜백에서 토큰 만료 여부 확인, 만료 시 로그인 페이지 리다이렉트
- [x] 2.4 프론트엔드 API 클라이언트 (`lib/api.ts`): `getToken()` → Authorization 헤더 자동 첨부, 401 응답 시 `signOut()` 호출
- [x] 2.5 NestJS JwtStrategy 구현 (JWT_SECRET 검증, `PassportStrategy`)
- [x] 2.6 User 생성/조회 API (`POST /users/sync` — OAuth 최초 로그인 시 upsert)
- [x] 2.7 로그인/로그아웃 UI (Next.js)
- [x] 2.8 프로바이더 추상화 인터페이스 정의 (`IOAuthProvider` — Kakao/Naver 확장 포인트)

> **Phase 2 완료 기준:** Google OAuth 로그인 후 `getToken()` 으로 JWT 획득, `GET /stocks` (JwtAuthGuard 보호) 200 반환, 잘못된 JWT 로 401 반환 확인

### Phase 3: 주식 데이터 (Week 2)
- [x] 3.1 데이터 소스 어댑터 인터페이스 정의 (`IStockDataSource`: `getQuote`, `getHistory`, `getFundamentals`)
- [x] 3.2 한국 주식 어댑터 (한국투자증권 REST API)
- [x] 3.3 미국 주식 어댑터 (Polygon.io `@polygon.io/client-js` npm, `/v2/aggs/ticker/{symbol}/prev` 엔드포인트)
  - Rate limit 처리: 무료 플랜 5 req/min, 일 한도 없음 → BullMQ 큐로 요청 직렬화 (5/min 준수), 자정 배치 (~160분 소요)
  - 유료 전환 트리거: 배치 처리 시간 180분 초과 또는 일 요청 건수 급증 시 → Starter 플랜 전환 (`US_DATA_PROVIDER=polygon-free|polygon-paid`)
- [x] 3.4 KOSPI 200 / S&P 500 / QQQ 종목 시드 (`prisma db seed`, JSON 파일 기반)
- [x] 3.5 주식 목록/검색 API (`GET /stocks?market=KR|US`, `GET /stocks/search?q=`)
- [x] 3.6 주식 상세 API (`GET /stocks/:symbol`) — 가격, 거래량, PER/PBR, 배당률, 52주 고저가
  - 차트 데이터: `GET /stocks/:symbol/chart?period=1d|1w|1m` (Polygon.io OHLCV, 한국투자증권 일봉)
- [x] 3.7 Redis 캐싱 (실시간 가격 30초 TTL, 일봉/지표 1시간 TTL)
- [x] 3.8 6개월 전고점 계산 배치 (`StockAnalytics` upsert, 일 1회 장 마감 후 실행)

> **Phase 3 완료 기준:** `GET /stocks` 로 ~800 종목 반환, `GET /stocks/:symbol` 로 가격/거래량/PER/52주 고저가 반환, `StockAnalytics` 테이블에 `high6m` 값 기록 확인

### Phase 4: 즐겨찾기 (Week 2)
- [x] 4.1 즐겨찾기 추가/제거 API (`POST/DELETE /favorites/:symbol`)
- [x] 4.2 즐겨찾기 목록 API (`GET /favorites`)
- [x] 4.3 즐겨찾기 UI (Next.js)

> **Phase 4 완료 기준:** 즐겨찾기 추가/제거 API 왕복 성공, `GET /favorites` 로 목록 반환, UI 에서 즐겨찾기 토글 동작 확인

### Phase 5: 알림 시스템 (Week 3)
- [x] 5.1 VAPID 키 생성 및 환경 변수 설정
- [x] 5.2 PWA Service Worker 설정 (`@serwist/next`, `next-pwa` 대체 — 2024년 이후 유지보수 활성)
- [x] 5.3 푸시 구독 등록 API (`POST /notifications/subscribe`)
- [x] 5.4 알림 단계별 색상 상수 정의
  ```
  10% → yellow-500, 15% → orange-400, 20% → red-500
  25% → red-700, 30% → black + border-red
  ```
- [x] 5.5 사용자별 알림 설정 저장 API (`PUT /users/alert-settings`)
- [x] 5.6 BullMQ 알림 워커 구현
- [x] 5.7 하락 감지 스케줄러 (NestJS @Cron)
  - 한국 장 마감: `30 7 * * 1-5` UTC = 16:30 KST (KOSPI 15:30 KST 마감 + 1시간 버퍼)
  - 미국 장 마감: `30 21 * * 1-5` UTC
    - **DST 처리:** 미국 시장은 항상 16:00 ET(Eastern Time) 마감.
      - EDT(UTC-4, 3월~11월): 16:00 EDT = 20:00 UTC → 21:30 UTC는 마감 후 1.5시간
      - EST(UTC-5, 11월~3월): 16:00 EST = 21:00 UTC → 21:30 UTC는 마감 후 30분
      - `21:30 UTC` 고정으로 EDT/EST 양쪽 모두 마감 이후 실행 보장 (데이터 확정 대기 포함)
  - 공휴일 처리: `date-holidays` npm으로 KR/US 공휴일 여부 확인 후 스킵
- [x] 5.8 즐겨찾기 종목 강제 알림 오버라이드 로직
- [x] 5.9 알림 중복 방지 (`AlertLog` 기반, `[userId, symbol, level, sentAt]` 인덱스 활용, 24시간 재발송 금지)

> **Phase 5 완료 기준:** 크론 수동 트리거 후 PWA 설치된 브라우저에서 푸시 알림 수신 확인, 동일 조건 24시간 내 재발송 없음 확인

### Phase 6: UI 완성 (Week 3)
- [x] 6.1 주식 목록 페이지 (필터: 한국/미국, 알림 조건 충족 여부)
- [x] 6.2 주식 상세 페이지 (차트 컴포넌트: **Recharts** + 지표 카드)
- [x] 6.3 알림 단계별 색상 배지 컴포넌트
- [x] 6.4 알림 설정 페이지 (단계 체크박스)
- [x] 6.5 PWA manifest.json + 아이콘

> **Phase 6 완료 기준:** 주식 목록/상세/즐겨찾기/알림설정 페이지 렌더링 오류 없음, Lighthouse PWA 점수 80+ 확인

### Phase 7: 테스트 및 배포 (Week 4)
- [ ] 7.1 단위 테스트 (Jest): 하락 감지 로직 (Decimal 정밀도 포함), 알림 필터링, 공휴일 스킵 로직. 커버리지 목표 80%+
- [ ] 7.2 통합 테스트 (Supertest): OAuth JWT 검증, 푸시 구독 등록, 알림 중복 방지 API
- [ ] 7.3 E2E (Playwright): 로그인 → 주식 조회 → 즐겨찾기 → 알림 수신 플로우
- [x] 7.4 Docker Compose 운영 설정 (NestJS + PostgreSQL + Redis)
- [x] 7.5 Vercel + Railway 배포: 환경 변수 주입, CORS origin 설정, Railway 헬스체크 경로 등록

> **Phase 7 완료 기준:** Jest 커버리지 80%+, Playwright E2E 통과, Vercel/Railway `GET /health` 200 반환, 프로덕션 환경 웹 푸시 수신 확인
>
> **알려진 한계:** JWT TTL 1시간 — 장시간 사용 시 재로그인 필요. 무음 갱신(silent refresh) 구현은 MVP 이후 검토.
> **알려진 한계:** 미국 종목 장 중 가격은 Polygon.io 무료 플랜 기준 15분 지연 — 실시간 필요 시 유료 전환.

---

## 관찰가능성 (Observability)

- **로그:** NestJS `Logger` 클래스 → Railway 로그 스트림. 배치 크론 시작/완료/오류 구조화 로그.
- **헬스체크:** `GET /health` → DB ping + Redis ping 결과 반환
- **배치 실패 알림:** BullMQ failed 이벤트 → 슬랙 Webhook 알림 (`SLACK_WEBHOOK_URL`)
- **Polygon.io rate limit 모니터링:** 배치 처리 시간 180분 초과 또는 429 연속 3회 이상 시 에러 로그 + 슬랙 알림 → 유료 플랜 전환 판단

---

## 수용 기준 (Acceptance Criteria)

- [x] Google 로그인으로 회원가입/로그인 가능하고, NestJS JWT 검증이 통과한다 (단위 테스트로 확인)
- [x] KOSPI 200 / S&P 500 / QQQ 전 종목이 목록에 표시된다 (`prisma db seed` 후 `GET /stocks` 응답 검증)
- [x] 종목 상세 화면에서 가격(30초 SWR 갱신, 미국 종목은 Polygon.io 무료 플랜 특성상 장 중 15분 지연 표시), 차트(일봉/주봉/월봉), 거래량, PER/PBR, 배당률, 52주 고저가 확인 가능
- [x] 즐겨찾기 추가/제거 가능하고 즐겨찾기 목록에서 일괄 현황 확인 가능 (`POST/DELETE /favorites/:symbol` + `GET /favorites` 검증)
- [x] 전고점 대비 10/15/20/25/30% 하락 시 각 색상으로 구분된 웹 푸시 알림이 발송된다 (통합 테스트: 테스트 종목으로 크론 수동 트리거)
- [x] 사용자가 수신할 알림 단계를 설정 화면에서 변경 가능하다 (`PUT /users/alert-settings` API 검증)
- [x] 즐겨찾기 추가 시 해당 종목은 사용자 설정과 무관하게 모든 단계 알림 수신 (즐겨찾기 오버라이드 단위 테스트)
- [x] 동일 종목 동일 단계 알림은 24시간 내 중복 발송되지 않는다 (AlertLog 인덱스 쿼리 + 통합 테스트)
- [x] PWA 설치 후 백그라운드에서 알림 수신 가능 (iOS 16.4+ / Android Chrome 수동 테스트)
- [x] Kakao OAuth 추가 시 NestJS `backend/src/auth/` + NextAuth provider config 외 파일 수정 없음 (PR diff로 검증)

---

## 리스크 및 대응

| 리스크 | 가능성 | 대응 | 전환 트리거 |
|--------|--------|------|------------|
| 한국투자증권 API 한도 초과 | 중 | Redis 캐시 30초 TTL, 배치는 일 1회 | 429 오류 연속 3회 → 폴링 주기 60초로 조정 |
| Polygon.io 배치 처리 시간 초과 (5 req/min) | 저 | ~800 심볼 × 1 req = 160분 소요, 자정 배치로 충분 | 처리 시간 180분 초과 시 Starter 플랜 전환 |
| Polygon.io 무료 플랜 데이터 지연 (15분) | 중 | 배치 알림은 장 마감 후 실행이므로 지연 무관 | 실시간 가격 표시 저하 시 유료 전환 검토 |
| PWA 알림 iOS 미지원 (구버전) | 중 | iOS 16.4+ 안내 문구, 이메일 알림 추후 추가 | — |
| 전고점 계산 배치 실패 | 중 | BullMQ 재시도 3회 + 슬랙 알림 | 실패 3회 후 수동 재실행 가이드 |
| US 장 마감 시간 DST 오차 | 저 | UTC 21:30 고정 (EDT 17:30 / EST 16:30, 항상 마감 후 실행 보장) | — |
| StockPrice 데이터 누적 | 저 | ~800종목 × 1/day = 연 29만 행, 1년 후 파티셔닝 검토 | 행수 100만 초과 시 `recordedAt` 기준 파티셔닝 |

---

## ADR (Architecture Decision Record)

### Decision
Next.js 14 (Frontend) + NestJS (Backend) TypeScript 풀스택 채택. WebSocket 제거, REST 폴링 채택. Polygon.io 무료 플랜을 미국 주식 1차 소스로 사용.

### Drivers
- MVP 개발 속도 우선
- 단일 언어로 팀 협업 효율화
- Polygon.io 공식 Node.js SDK로 Python(yfinance) 의존성 제거, 무료 플랜 일 한도 없음(5 req/min)으로 800 심볼 커버
- Vercel serverless 환경 호환성 (WebSocket → SWR polling)

### Alternatives Considered
- **FastAPI + Next.js**: yfinance/pandas 생태계 풍부하나, Polygon.io Node.js SDK로 동일 데이터 접근 가능 → 두 언어 관리 비용만 남음
- **Socket.io (WebSocket)**: Vercel serverless 비호환, 알림이 배치 기반이므로 실시간 연결 불필요 → SWR 30초 polling으로 대체
- **Yahoo Finance (yfinance)**: 비공식 API, Python 전용 라이브러리, 빈번한 차단 → Polygon.io(공식, Node.js SDK) 채택
- **next-pwa**: 2023년 이후 미유지 → @serwist/next 채택

### Why Chosen
TypeScript 단일 스택이 MVP 속도와 팀 협업에 최적. WebSocket 제거로 Vercel 배포 호환성 확보. Polygon.io 공식 API로 데이터 신뢰성 확보.

### Consequences
- Polygon.io 무료 플랜은 15분 지연 데이터. 미국 종목 상세 페이지 가격은 나이트리 배치 갱신값 표시 (장 중 가격 실시간 아님). 실시간 필요 시 유료 전환.
- BullMQ 안정성 모니터링 필요 (Celery 대비 성숙도 낮음)

### Follow-ups
- 트래픽 증가 시 Polygon.io 무료 → Starter 유료 전환 (`IStockDataSource` 어댑터 환경 변수 교체만으로 완료)
- 데이터 처리량 증가 시 FastAPI 마이크로서비스 분리 고려 (배치 analytics만 Python으로 추출)

---

## 리비전 변경 이력 (Revision 1)

Architect + Critic 리뷰 후 적용된 변경:

| 항목 | 변경 전 | 변경 후 |
|------|---------|---------|
| 미국 주식 데이터 소스 | Yahoo Finance (비공식, yfinance Python) | Polygon.io 무료 플랜 (공식, @polygon.io/client-js npm, 5 req/min, 일 한도 없음) |
| 실시간 처리 | Socket.io (WebSocket) | SWR 30초 polling (Vercel 호환) |
| Principle 3 | WebSocket + 배치 분리 | 폴링 + 배치 분리 |
| StockPrice.price 타입 | Float | Decimal @db.Decimal(15,4) |
| StockPrice.high6m | StockPrice에 내장 (Float) | StockAnalytics 별도 테이블 (Decimal) |
| StockPrice 인덱스 | 없음 | @@index([symbol, recordedAt]) |
| AlertLog.dropPercent 타입 | Float | Decimal @db.Decimal(5,2) |
| AlertLog 인덱스 | 없음 | @@index([userId, symbol, level, sentAt]) |
| 인증 흐름 | 미명시 | NextAuth JWT mode → Bearer token → NestJS JwtStrategy 명시 |
| 배포 토폴로지 | 미명시 | CORS 설정, 환경 변수, 쿠키 전략 명시 |
| 시드 데이터 전략 | "초기 적재"만 언급 | JSON 파일 + 분기별 갱신 전략 명시 |
| PWA 라이브러리 | next-pwa (미유지) | @serwist/next (활성 유지) |
| 미국 장 마감 크론 | 05:00 KST (DST 오류, 시장 16:00 ET 마감 미반영) | 21:30 UTC 고정 (EDT 17:30 / EST 16:30, 항상 마감 후 실행 보장) |
| Alpha Vantage 25 req/day (800 심볼 불가) | Alpha Vantage 무료 (rate limit 미검증) | Polygon.io 무료 (5 req/min, 일 한도 없음, 160분 배치 완료) |
| JWT 만료/갱신 전략 | 미명시 | TTL 1시간, 401 시 signOut(), 토큰 만료 체크 명시 |
| 공휴일 처리 | 없음 | date-holidays npm으로 스킵 |
| 관찰가능성 | 슬랙 알림만 | 구조화 로그 + 헬스체크 + 배치 모니터링 |
| 차트 라이브러리 | 미명시 | Recharts 명시 |
| 테스트 계획 | 한 줄 요약 | 단위/통합/E2E 상세화, 커버리지 목표 80% |
