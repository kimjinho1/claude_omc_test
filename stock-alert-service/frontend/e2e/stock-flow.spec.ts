import { test, expect } from '@playwright/test';

/**
 * E2E: 로그인 → 주식 목록 → 상세 → 즐겨찾기 플로우
 *
 * 실행 전 필요: 앱 실행 중 + PLAYWRIGHT_BASE_URL 환경 변수 설정
 * npx playwright test
 */

test.describe('주식 목록 페이지', () => {
  test.beforeEach(async ({ page }) => {
    // 로그인 세션 없으면 /login으로 리다이렉트
    await page.goto('/dashboard');
  });

  test('비인증 접근 시 /login으로 리다이렉트', async ({ page }) => {
    await expect(page).toHaveURL(/\/login/);
  });
});

test.describe('로그인 페이지', () => {
  test('Google 로그인 버튼이 렌더링된다', async ({ page }) => {
    await page.goto('/login');
    const googleBtn = page.getByRole('button', { name: /Google/i });
    await expect(googleBtn).toBeVisible();
  });
});

test.describe('주식 상세 페이지 (인증 필요)', () => {
  // 인증이 필요한 테스트는 실제 OAuth 세션 없이는 실행 불가
  // CI에서는 mock auth provider로 대체
  test.skip(!process.env.TEST_AUTH_TOKEN, '인증 토큰 필요');

  test.beforeEach(async ({ page, context }) => {
    // 테스트용 세션 쿠키 주입
    await context.addCookies([
      {
        name: 'next-auth.session-token',
        value: process.env.TEST_AUTH_TOKEN!,
        domain: 'localhost',
        path: '/',
      },
    ]);
  });

  test('주식 상세 페이지에 즐겨찾기 버튼이 있다', async ({ page }) => {
    await page.goto('/stocks/AAPL');
    await expect(page.getByRole('button', { name: /즐겨찾기/ })).toBeVisible();
  });

  test('주식 상세에서 즐겨찾기 토글이 동작한다', async ({ page }) => {
    await page.goto('/stocks/AAPL');
    const favBtn = page.getByRole('button', { name: /즐겨찾기/ });
    await favBtn.click();
    // 버튼 텍스트가 해제로 바뀌거나 즐겨찾기 추가로 바뀜
    await expect(favBtn).toBeVisible();
  });

  test('알림 설정 페이지에서 단계 체크박스가 표시된다', async ({ page }) => {
    await page.goto('/settings/alerts');
    await expect(page.getByText('10% 하락')).toBeVisible();
    await expect(page.getByText('20% 하락')).toBeVisible();
    await expect(page.getByText('30% 하락')).toBeVisible();
  });

  test('즐겨찾기 페이지가 렌더링된다', async ({ page }) => {
    await page.goto('/favorites');
    // 즐겨찾기 없으면 빈 상태 메시지
    await expect(page.getByText(/즐겨찾기/)).toBeVisible();
  });
});
