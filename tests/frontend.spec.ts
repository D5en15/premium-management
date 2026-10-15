import { test, expect, type Page } from '@playwright/test';

async function navigate(page: Page, label: string) {
  if (await page.getByRole('button', { name: 'เปิดเมนู', exact: true }).isVisible()) await page.getByRole('button', { name: 'เปิดเมนู', exact: true }).click();
  await page.getByRole('navigation').getByRole('button', { name: label, exact: true }).click();
}
test('all pages, renewal, export and service edits work', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.setViewportSize({ width: 1440, height: 960 });
  await page.goto('/?demo=1');
  await expect(page.getByRole('heading', { name: 'ภาพรวมของคุณ.' })).toBeVisible();
  await expect(page.locator('.subscription-row')).toHaveCount(15);
  await expect(page.locator('.copy-button')).toHaveCount(5);
  await page.screenshot({ path: '/tmp/premium-desktop.png', fullPage: true });
  const first = page.locator('.subscription-row').first();
  const original = await first.locator('.expiry-cell > span').first().textContent();
  await first.getByRole('button', { name: /ต่ออายุ/ }).click();
  await page.getByRole('spinbutton').fill('2');
  await expect(page.locator('.date-preview .green')).not.toHaveText('—');
  const preview = await page.getByRole('textbox', { name: 'ตัวอย่างข้อความหลังบันทึก' }).inputValue();
  expect(preview).toContain('YouTube Premium ต่ออายุ 2 เดือน');
  await page.getByRole('button', { name: 'บันทึกการต่ออายุ' }).click();
  await expect(page.getByRole('heading', { name: 'ต่ออายุเรียบร้อยแล้ว' })).toBeVisible();
  await expect(page.getByRole('textbox', { name: 'ข้อความแจ้งต่ออายุ' })).toHaveValue(preview);
  const expiresOn = await page.evaluate(() => JSON.parse(localStorage.getItem('premium-preview-v1')!).subscriptions.find((s: { id: string }) => s.id === 'sub-0').expiresOn as string);
  const [year, month, day] = expiresOn.split('-').map(Number);
  expect(preview).toContain(`กำหนดจ่ายครั้งถัดไปวันที่ ${day}/${month}/${year}`);
  await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.getByRole('button', { name: 'คัดลอกข้อความต่ออายุ' }).click();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(preview);
  await page.getByRole('button', { name: 'ปิด', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.locator('.subscription-row').first().locator('.expiry-cell > span').first()).not.toHaveText(original!);
  await page.reload();
  await expect(page.locator('.subscription-row')).toHaveCount(15);
  await page.getByRole('button', { name: 'คัดลอกข้อมูลทั้งหมด', exact: true }).click();
  await expect(page.getByRole('textbox', { name: 'ข้อความสำหรับคัดลอก' })).toHaveValue(/YouTube Premium 75/);
  await expect(page.getByRole('textbox', { name: 'ข้อความสำหรับคัดลอก' })).not.toHaveValue(/example.com/);
  await page.getByRole('button', { name: 'ปิดหน้าต่าง', exact: true }).click();
  await navigate(page, 'บริการพรีเมี่ยม');
  await page.locator('.service-card').first().getByRole('button', { name: 'แก้ไขบริการ' }).click();
  await page.getByRole('textbox', { name: 'ชื่อบริการ' }).fill('Video Club');
  await page.getByRole('spinbutton').fill('99');
  await page.getByRole('button', { name: 'บันทึกบริการ' }).click();
  await expect(page.getByRole('heading', { name: 'Video Club' })).toBeVisible();
  await page.locator('.service-card').first().getByRole('switch').click();
  await expect(page.locator('.service-card').first().getByRole('switch')).toHaveAttribute('aria-checked', 'false');
  await navigate(page, 'รูปแบบข้อความ');
  await expect(page.locator('.template-card')).toHaveCount(5);
  await expect(page.locator('.message-preview').first()).toContainText('Video Club');
  await navigate(page, 'ภาพรวม');
  await expect(page.locator('.service-cell').filter({ hasText: 'Video Club' })).toHaveCount(5);
  expect(errors).toEqual([]);
});
test('create and edit a member with two services, inspect details and end one', async ({ page }) => {
  await page.goto('/?demo=1#members');
  await page.getByRole('button', { name: 'เพิ่มสมาชิก', exact: true }).click();
  await page.getByRole('textbox', { name: /ชื่อสมาชิก/ }).fill('สมาชิกทดสอบ UI');
  await page.getByRole('button', { name: 'เพิ่มบริการ', exact: true }).click();
  await page.getByRole('button', { name: 'เพิ่มบริการ', exact: true }).click();
  await expect(page.locator('.subscription-editor')).toHaveCount(2);
  await page.locator('.subscription-editor').first().getByRole('textbox', { name: 'บัญชี / อีเมล / โปรไฟล์' }).fill('test@example.com');
  await page.getByRole('button', { name: 'บันทึกสมาชิก' }).click();
  await page.locator('.member-card').filter({ hasText: 'สมาชิกทดสอบ UI' }).click();
  await expect(page.locator('.detail-sub')).toHaveCount(2);
  await expect(page.locator('.detail-sub').first()).toContainText('test@example.com');
  await page.locator('.detail-sub').first().getByRole('button', { name: 'ลบบริการของสมาชิก' }).click();
  await page.getByRole('button', { name: 'ลบถาวร', exact: true }).click();
  await page.locator('.member-card').filter({ hasText: 'สมาชิกทดสอบ UI' }).click();
  await expect(page.locator('.detail-sub')).toHaveCount(1);
  await expect(page.locator('.detail-sub')).not.toContainText('test@example.com');
  await page.reload();
  await page.locator('.member-card').filter({ hasText: 'สมาชิกทดสอบ UI' }).click();
  await expect(page.locator('.detail-sub')).toHaveCount(1);
  await page.getByRole('button', { name: 'แก้ไข', exact: true }).click();
  await page.getByRole('textbox', { name: /ชื่อสมาชิก/ }).fill('แก้ไขชื่อแล้ว');
  await page.getByRole('button', { name: 'บันทึกสมาชิก' }).click();
  await expect(page.getByRole('heading', { name: 'แก้ไขชื่อแล้ว' })).toBeVisible();
});
test('mobile navigation, forms, login and empty search fit viewport', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto('/?demo=1');
  await page.screenshot({ path: '/tmp/premium-mobile.png', fullPage: true });
  for (const name of ['ภาพรวม', 'สมาชิก', 'บริการพรีเมี่ยม', 'รูปแบบข้อความ']) {
    await navigate(page, name);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
  await navigate(page, 'สมาชิก');
  await page.getByRole('textbox', { name: 'ค้นหาสมาชิก' }).fill('no-such-person');
  await expect(page.getByRole('heading', { name: 'ไม่พบสมาชิก' })).toBeVisible();
  await page.getByRole('button', { name: 'เพิ่มสมาชิก', exact: true }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'เปิดเมนู', exact: true }).click();
  await page.getByRole('button', { name: 'ออกจากระบบ / ดูหน้าเข้าสู่ระบบ' }).click();
  await expect(page.getByRole('heading', { name: 'ยินดีต้อนรับกลับมา' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByRole('button', { name: 'เข้าสู่โหมดทดลอง' }).click();
  await expect(page.getByRole('heading', { name: 'ภาพรวมของคุณ.' })).toBeVisible();
});

test('normal mode requires Google login and hashes do not grant access', async ({ page }) => {
  await page.goto('/#members');
  await expect(page.getByRole('heading', { name: 'ยินดีต้อนรับกลับมา' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'เข้าสู่ระบบด้วย Google' })).toBeEnabled();
  await expect(page.getByRole('button', { name: 'เข้าสู่โหมดทดลอง' })).toHaveCount(0);
  await expect(page.locator('.member-card')).toHaveCount(0);
  await page.evaluate(() => { location.hash = 'dashboard'; });
  await expect(page.getByRole('heading', { name: 'ยินดีต้อนรับกลับมา' })).toBeVisible();
  await expect(page.locator('.subscription-row')).toHaveCount(0);
  expect(await page.evaluate(() => localStorage.getItem('premium-preview-v1'))).toBeNull();
});

test('edited messages persist and are used for reminders and renewal on mobile', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.goto('/?demo=1#templates');
  await page.getByRole('textbox', { name: 'ข้อความ เหลือ 5 วัน', exact: true }).fill('{ชื่อแอพ} จ่ายวันที่ {วันหมดอายุ} อีก {จำนวนวันที่เหลือ} วัน');
  await page.getByRole('textbox', { name: 'ข้อความ หลังต่ออายุ', exact: true }).fill('{ชื่อแอพ} ต่อ {จำนวนเดือนที่ต่อ} เดือน จ่าย {กำหนดจ่ายครั้งถัดไป}');
  await page.getByRole('button', { name: 'บันทึกรูปแบบข้อความ', exact: true }).click();
  await page.reload();
  await expect(page.getByRole('textbox', { name: 'ข้อความ เหลือ 5 วัน', exact: true })).toHaveValue(/จ่ายวันที่/);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await navigate(page, 'ภาพรวม');
  const row = page.locator('.subscription-row').filter({ hasText: 'เหลือ 5 วัน' }).first();
  await row.getByRole('button', { name: /คัดลอกข้อความ/ }).click();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toMatch(/จ่ายวันที่ .* อีก 5 วัน/);
  await row.getByRole('button', { name: /ต่ออายุ/ }).click();
  await page.getByRole('spinbutton').fill('2');
  await expect(page.getByRole('textbox', { name: 'ตัวอย่างข้อความหลังบันทึก' })).toHaveValue(/ต่อ 2 เดือน จ่าย/);
});

test('member deletion can be cancelled and removes only the selected member and their services', async ({ page }) => {
  await page.goto('/?demo=1#members');
  const card = page.locator('.member-card').first();
  const name = await card.locator('h3').innerText();
  const before = await page.evaluate(() => JSON.parse(localStorage.getItem('premium-preview-v1')!));
  const memberId = before.members.find((m: { name: string }) => m.name === name).id;
  await card.click();
  await page.getByRole('button', { name: 'ลบสมาชิก', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'ลบสมาชิกถาวร?' })).toBeVisible();
  await page.getByRole('button', { name: 'ยกเลิก', exact: true }).click();
  await expect(page.locator('.member-card').filter({ hasText: name })).toHaveCount(1);
  await page.locator('.member-card').filter({ hasText: name }).click();
  await page.getByRole('button', { name: 'ลบสมาชิก', exact: true }).click();
  await page.getByRole('button', { name: 'ยืนยันลบสมาชิก', exact: true }).click();
  await page.reload();
  await expect(page.locator('.member-card').filter({ hasText: name })).toHaveCount(0);
  const after = await page.evaluate(() => JSON.parse(localStorage.getItem('premium-preview-v1')!));
  expect(after.members).toEqual(before.members.filter((m: { id: string }) => m.id !== memberId));
  expect(after.subscriptions).toEqual(before.subscriptions.filter((s: { memberId: string }) => s.memberId !== memberId));
  expect(after.services).toEqual(before.services);
});

test('member without services stays until explicitly deleted', async ({ page }) => {
  await page.goto('/?demo=1#members');
  await page.getByRole('button', { name: 'เพิ่มสมาชิก', exact: true }).click();
  await page.getByRole('textbox', { name: /ชื่อสมาชิก/ }).fill('ไม่มีบริการทดสอบ');
  await page.getByRole('button', { name: 'บันทึกสมาชิก', exact: true }).click();
  await page.reload();
  await page.locator('.member-card').filter({ hasText: 'ไม่มีบริการทดสอบ' }).click();
  await page.getByRole('button', { name: 'ลบสมาชิก', exact: true }).click();
  await expect(page.getByText(/\(0 รายการ\)/)).toBeVisible();
  await page.getByRole('button', { name: 'ยืนยันลบสมาชิก', exact: true }).click();
  await expect(page.locator('.member-card').filter({ hasText: 'ไม่มีบริการทดสอบ' })).toHaveCount(0);
});
