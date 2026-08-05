/**
 * Визуальные эффекты «грязных чернил» через OffscreenCanvas (если доступен)
 * или обычный canvas. Результат — CSS-паттерн / data-URL для фона бумаги.
 */
import { logger } from '../../utils/logger';

export async function createInkTexture(
  width = 256,
  height = 256
): Promise<string> {
  try {
    if (typeof OffscreenCanvas !== 'undefined') {
      const canvas = new OffscreenCanvas(width, height);
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('2d context');
      paintInk(ctx, width, height);
      const blob = await canvas.convertToBlob({ type: 'image/png' });
      return await blobToDataUrl(blob);
    }

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('2d context');
    paintInk(ctx, width, height);
    return canvas.toDataURL('image/png');
  } catch (err) {
    logger.warn('Не удалось создать текстуру чернил', err);
    return '';
  }
}

function paintInk(
  ctx: OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D,
  width: number,
  height: number
): void {
  ctx.clearRect(0, 0, width, height);
  for (let i = 0; i < 120; i++) {
    const x = Math.random() * width;
    const y = Math.random() * height;
    const r = 0.4 + Math.random() * 2.2;
    const alpha = 0.03 + Math.random() * 0.08;
    ctx.beginPath();
    ctx.fillStyle = `rgba(40, 28, 18, ${alpha})`;
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  // Лёгкие горизонтальные «смазы»
  for (let i = 0; i < 8; i++) {
    const y = Math.random() * height;
    ctx.strokeStyle = `rgba(60, 40, 20, ${0.02 + Math.random() * 0.04})`;
    ctx.lineWidth = 0.5 + Math.random();
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y + (Math.random() - 0.5) * 4);
    ctx.stroke();
  }
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

/** Класс дрожания букв на контейнере редактора */
export function applyTypeShake(el: HTMLElement, intensity = 1): void {
  el.classList.remove('is-shaking');
  // Перезапуск анимации
  void el.offsetWidth;
  el.style.setProperty('--shake-intensity', String(intensity));
  el.classList.add('is-shaking');
  window.setTimeout(() => el.classList.remove('is-shaking'), 120);
}
