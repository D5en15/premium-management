import { test, expect } from '@playwright/test';

test('production never allows demo or hash links to bypass login', async ({ page }) => {
  const firestoreRequests: string[] = [];
  page.on('request', request => { if (request.url().includes('firestore.googleapis.com')) firestoreRequests.push(request.url()); });
  await page.goto('/?demo=1#members');
  await expect(page.getByRole('heading', { name: 'ยินดีต้อนรับกลับมา' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'เข้าสู่ระบบด้วย Google' })).toBeEnabled();
  await expect(page.getByRole('button', { name: 'เข้าสู่โหมดทดลอง' })).toHaveCount(0);
  await expect(page.locator('.member-card')).toHaveCount(0);
  await page.evaluate(() => { location.hash = 'dashboard'; });
  await expect(page.getByRole('heading', { name: 'ยินดีต้อนรับกลับมา' })).toBeVisible();
  await expect(page.locator('.subscription-row')).toHaveCount(0);
  expect(firestoreRequests).toEqual([]);
});
