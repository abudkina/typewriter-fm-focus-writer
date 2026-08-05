import { describe, expect, it } from 'vitest';
import { ThemeService } from '../../src/modules/themes/ThemeService';
import { AppError } from '../../src/utils/errors';

describe('ThemeService', () => {
  it('содержит библиотеку тем', () => {
    const svc = new ThemeService();
    expect(svc.list().length).toBeGreaterThanOrEqual(3);
    expect(svc.getById('classic')?.name).toBe('Классика');
  });

  it('применяет CSS-переменные', () => {
    const root = document.createElement('div');
    const svc = new ThemeService();
    const theme = svc.apply('north', root);
    expect(theme.id).toBe('north');
    expect(root.style.getPropertyValue('--bg-deep')).toBe('#0e1418');
    expect(root.dataset.theme).toBe('north');
    expect(svc.getCurrentId()).toBe('north');
  });

  it('бросает ошибку на неизвестную тему', () => {
    const svc = new ThemeService();
    expect(() => svc.apply('нет-такой')).toThrow(AppError);
  });
});
