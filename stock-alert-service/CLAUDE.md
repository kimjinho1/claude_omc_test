# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Stock Alert Service — a full-stack app that monitors US and Korean stocks and sends Web Push / Slack notifications when prices drop from their 6-month high by user-defined thresholds (10–30%).

## Commands

### Backend (`stock-alert-service/backend/`)
```bash
npm run start:dev       # Dev server with watch mode (port 3001)
npm run build           # Compile NestJS
npm run test            # Unit tests (Jest)
npm run test:cov        # Coverage report
npm run test:e2e        # E2E tests (jest-e2e.json config)
npm run lint            # ESLint with auto-fix
npm run format          # Prettier
npx prisma migrate dev  # Apply DB migrations
npx prisma generate     # Regenerate Prisma client after schema changes
npx prisma studio       # GUI to inspect DB
```

### Frontend (`stock-alert-service/frontend/`)
```bash
npm run dev    # Dev server (port 3000)
npm run build  # Next.js production build (standalone output)
npm run lint   # ESLint
```

### Full Stack
```bash
docker-compose up -d         # Start postgres + redis + backend + frontend
docker-compose up -d postgres redis  # Just infrastructure
```

## Architecture

### Request Flow
1. **Auth:** Google OAuth via NextAuth.js (frontend) → session callback calls `POST /users/sync` → backend issues JWT → stored in NextAuth session → sent as `Bearer` token on API calls.
2. **Internal vs External API URL:** `INTERNAL_API_URL` is used server-side in Next.js (Docker service name); `NEXT_PUBLIC_API_URL` is used client-side (exposed browser fetch).
3. **Alert Pipeline:**
   - Scheduled tasks fetch prices (Polygon.io for US, KIS API for Korea)
   - `AnalyticsService` maintains `StockAnalytics.high6m` per symbol
   - `DropDetectorService` computes drop %: `((high6m - currentPrice) / high6m) * 100`
   - On threshold breach → dispatches job to BullMQ `notifications` queue
   - `NotificationsService` consumes queue → sends Web Push to all user devices + optional Slack

### Key Backend Modules
| Module | Responsibility |
|--------|---------------|
| `AuthModule` | JWT + Passport, Google OAuth callback, `POST /users/sync` |
| `StocksModule` | Polygon.io + KIS API data fetching, price ingestion |
| `AlertsModule` | Drop detection, `AlertLog` deduplication, BullMQ dispatch |
| `NotificationsModule` | Web Push (VAPID), Slack webhook, push subscription management |
| `FavoritesModule` | User watchlist (N:M `User ↔ Stock`) |
| `HealthModule` | `/health` liveness/readiness probes for Docker |

### Database (Prisma)
Schema at `backend/prisma/schema.prisma`. Key relationships:
- `User` → `PushSubscription[]` (one user, many devices)
- `User` → `AlertSetting` (per-user thresholds)
- `User` → `Favorite[]` → `Stock`
- `Stock` → `StockPrice[]`, `StockAnalytics` (one-to-one)
- `AlertLog` deduplicates on `(userId, symbol, threshold, alertedAt)` to prevent repeat pushes

### Frontend Structure
- `app/` — Next.js App Router; all pages under `app/(protected)/` require auth via NextAuth middleware
- `auth.ts` — NextAuth v5 config; `jwt` callback stores backend JWT, `session` callback syncs user
- `next.config.ts` — Serwist (PWA/Service Worker) + standalone output for Docker

## Environment Setup

Copy and fill:
- `backend/.env.example` → `backend/.env`
- `frontend/.env.local.example` → `frontend/.env.local`

Required external services: PostgreSQL 16, Redis 7, Google OAuth app, Polygon.io API key, KIS API credentials, VAPID key pair (`npx web-push generate-vapid-keys`).

## Testing Notes

- Backend unit tests live in `src/**/__tests__/*.spec.ts`
- Alert deduplication and drop detector logic have dedicated spec files
- E2E tests use Playwright; config at `frontend/playwright.config.ts` and `backend/test/jest-e2e.json`
- Run a single test file: `npx jest src/alerts/__tests__/drop-detector.service.spec.ts`
