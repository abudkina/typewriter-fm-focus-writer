/**
 * Визуальные эффекты: дрожание каретки и «грязные» чернила.
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
  for (let i = 0; i < 220; i++) {
    const x = Math.random() * width;
    const y = Math.random() * height;
    const r = 0.6 + Math.random() * 3.5;
    const alpha = 0.06 + Math.random() * 0.14;
    ctx.beginPath();
    ctx.fillStyle = `rgba(35, 24, 14, ${alpha})`;
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  for (let i = 0; i < 14; i++) {
    const y = Math.random() * height;
    ctx.strokeStyle = `rgba(50, 32, 16, ${0.05 + Math.random() * 0.08})`;
    ctx.lineWidth = 0.8 + Math.random() * 1.8;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y + (Math.random() - 0.5) * 6);
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

/** Дрожание бумаги + вспышка чернильного пятна */
export function applyTypeShake(el: HTMLElement, intensity = 1): void {
  const clamped = Math.min(2.5, Math.max(0.8, intensity));
  el.style.setProperty('--shake-intensity', String(clamped));

  el.classList.remove('is-shaking', 'is-ink-flash');
  // Force reflow — перезапуск CSS-анимации
  void el.offsetWidth;
  el.classList.add('is-shaking', 'is-ink-flash');

  window.setTimeout(() => {
    el.classList.remove('is-shaking');
  }, 180);
  window.setTimeout(() => {
    el.classList.remove('is-ink-flash');
  }, 220);
}

/** Включить/выключить слой чернил на бумаге */
export function setInkLayerVisible(el: HTMLElement, visible: boolean): void {
  el.classList.toggle('has-ink-effects', visible);
}
