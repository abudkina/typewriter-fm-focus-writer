import { describe, expect, it } from 'vitest';
import {
  clampVolume,
  countChars,
  countWords,
  validatePomodoroMinutes,
  validateTextFile,
  validateUrl,
  MAX_TEXT_FILE_SIZE,
} from '../../src/utils/validation';
import { AppError } from '../../src/utils/errors';

describe('validateUrl', () => {
  it('принимает корректный https-адрес', () => {
    expect(validateUrl('https://example.com/path')).toBe('https://example.com/path');
  });

  it('отклоняет пустую строку', () => {
    expect(() => validateUrl('  ')).toThrow(AppError);
    expect(() => validateUrl('')).toThrow(/Укажите адрес/);
  });

  it('отклоняет не-http протоколы', () => {
    expect(() => validateUrl('ftp://files.local')).toThrow(/http/);
  });

  it('отклоняет мусор', () => {
    expect(() => validateUrl('не ссылка')).toThrow(AppError);
  });
});

describe('validateTextFile', () => {
  it('принимает .txt файл', () => {
    const file = new File(['привет'], 'черновик.txt', { type: 'text/plain' });
    expect(() => validateTextFile(file)).not.toThrow();
  });

  it('отклоняет пустой файл', () => {
    const file = new File([], 'пустой.txt', { type: 'text/plain' });
    expect(() => validateTextFile(file)).toThrow(/пуст/i);
  });

  it('отклоняет слишком большой файл', () => {
    const big = new File([new Uint8Array(MAX_TEXT_FILE_SIZE + 1)], 'big.txt', {
      type: 'text/plain',
    });
    expect(() => validateTextFile(big)).toThrow(/большой/);
  });

  it('отклоняет неподдерживаемый формат', () => {
    const file = new File(['x'], 'photo.png', { type: 'image/png' });
    expect(() => validateTextFile(file)).toThrow(/формат/i);
  });
});

describe('clampVolume', () => {
  it('ограничивает диапазон', () => {
    expect(clampVolume(0.5)).toBe(0.5);
    expect(clampVolume(-1)).toBe(0);
    expect(clampVolume(2)).toBe(1);
  });

  it('бросает ошибку на NaN', () => {
    expect(() => clampVolume(Number.NaN)).toThrow(/Громкость/);
  });
});

describe('validatePomodoroMinutes', () => {
  it('принимает валидные минуты', () => {
    expect(validatePomodoroMinutes(25)).toBe(25);
  });

  it('отклоняет вне диапазона', () => {
    expect(() => validatePomodoroMinutes(0)).toThrow();
    expect(() => validatePomodoroMinutes(200)).toThrow();
  });
});

describe('countWords / countChars', () => {
  it('считает русские и английские слова', () => {
    expect(countWords('Привет мир hello')).toBe(3);
    expect(countWords('')).toBe(0);
    expect(countWords('   ')).toBe(0);
  });

  it('считает символы', () => {
    expect(countChars('абв')).toBe(3);
  });
});
