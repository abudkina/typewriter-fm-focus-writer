import { test, expect } from '@playwright/test';

test.describe('Typewriter.fm Focus Writer', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await expect(page.getByLabel('Основное поле ввода текста')).toBeVisible({
      timeout: 15_000,
    });
    // Дожидаемся класса завершения анимации (элемент скрыт, но в DOM)
    await page.waitForSelector('#paper-loader.is-done', {
      state: 'attached',
      timeout: 10_000,
    });
  });

  test('открывает редактор на русском', async ({ page }) => {
    await expect(page.getByText('Typewriter.fm')).toBeVisible();
    await expect(page.getByLabel('Основное поле ввода текста')).toBeVisible();
    await expect(page.getByLabel('Выбор модели печатной машинки')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Запустить помодоро' })).toBeVisible();
  });

  test('печатает текст и обновляет счётчик слов', async ({ page }) => {
    const editor = page.getByLabel('Основное поле ввода текста');
    await editor.click();
    await editor.fill('Раз два три четыре');
    await expect(page.locator('#stat-words')).toHaveText('4', { timeout: 3000 });
    await expect(page.locator('#stat-chars')).not.toHaveText('0');
  });

  test('переключает звук', async ({ page }) => {
    const mute = page.getByLabel('Выключить звук');
    await mute.click();
    await expect(mute).toHaveAttribute('aria-pressed', 'true');
    await expect(mute).toHaveText('Без звука');
    await mute.click();
    await expect(mute).toHaveAttribute('aria-pressed', 'false');
  });

  test('управляет помодоро', async ({ page }) => {
    await page.getByLabel('Запустить помодоро').click();
    await expect(page.locator('#stat-pomo')).toContainText('работа');
    await page.getByLabel('Пауза помодоро').click();
    await expect(page.locator('#stat-pomo')).toContainText('пауза');
    await page.getByLabel('Сбросить помодоро').click();
    await expect(page.locator('#stat-pomo')).toContainText('ожидание');
  });

  test('открывает и закрывает премиум', async ({ page }) => {
    await page.getByLabel('Премиум-подписка').click();
    await expect(page.getByRole('heading', { name: 'Премиум-звуки' })).toBeVisible();
    await page.getByLabel('Закрыть окно премиума').click();
    await expect(page.locator('#modal-premium')).toBeHidden();
  });

  test('валидирует ссылку', async ({ page }) => {
    await page.getByLabel('Вставить ссылку в текст').click();
    await page.getByLabel('Адрес ссылки').fill('не-ссылка');
    await page.locator('#link-ok').click();
    await expect(page.locator('#toast')).toBeVisible();
    await expect(page.locator('#toast')).toContainText(/адрес|ссылк|Некорректн/i);
  });

  test('вставляет валидную ссылку', async ({ page }) => {
    const editor = page.getByLabel('Основное поле ввода текста');
    await editor.fill('текст');
    await editor.focus();
    await editor.press('Control+A');
    await page.getByLabel('Вставить ссылку в текст').click();
    await page.getByLabel('Адрес ссылки').fill('https://example.com');
    await page.locator('#link-ok').click();
    await expect(editor).toHaveValue(/\[.*\]\(https:\/\/example\.com\/?\)/);
  });

  test('меняет шрифт', async ({ page }) => {
    await page.getByLabel('Выбор шрифта').selectOption('courier');
    await expect(page.getByLabel('Основное поле ввода текста')).toHaveClass(/font-courier/);
  });

  test('экспорт пустого текста показывает ошибку', async ({ page }) => {
    await page.getByLabel('Экспорт текста в файл').click();
    await expect(page.locator('#toast')).toContainText(/пуст/i);
  });

  test('мобильная ширина 320px', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 640 });
    await expect(page.getByLabel('Основное поле ввода текста')).toBeVisible();
    await expect(page.getByText('Typewriter.fm')).toBeVisible();
    const box = await page.getByLabel('Основное поле ввода текста').boundingBox();
    expect(box).not.toBeNull();
    expect(box!.width).toBeLessThanOrEqual(320);
  });
});
