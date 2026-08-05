/**
 * Скрипт снятия скриншотов для README.
 * Запуск: npx vite --port 8765 & node scripts/capture-screens.mjs
 */
import { chromium } from 'playwright';

const BASE = process.env.TW_URL || 'http://127.0.0.1:8765';

async function main() {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto(BASE, { waitUntil: 'networkidle' });
  await page.waitForSelector('#editor', { timeout: 15000 });
  await page.waitForTimeout(1800);
  await page.locator('#editor').fill(
    'Глубокая работа начинается здесь.\nЗвук машинки, чистый лист, никаких уведомлений.'
  );
  await page.screenshot({ path: 'docs/screenshot-desktop.png' });

  await page.setViewportSize({ width: 320, height: 640 });
  await page.waitForTimeout(400);
  await page.screenshot({ path: 'docs/screenshot-mobile.png' });

  await page.setViewportSize({ width: 768, height: 900 });
  await page.waitForTimeout(400);
  await page.screenshot({ path: 'docs/screenshot-tablet.png' });

  await browser.close();
  console.info('Скриншоты сохранены в docs/');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
