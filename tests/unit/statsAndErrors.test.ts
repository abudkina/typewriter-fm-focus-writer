import { describe, expect, it } from 'vitest';
import { StatsWorkerClient } from '../../src/modules/stats/StatsWorkerClient';
import { toUserMessage, AppError } from '../../src/utils/errors';
import { logger } from '../../src/utils/logger';

describe('StatsWorkerClient.analyzeSync', () => {
  it('считает статистику синхронно', () => {
    const client = new StatsWorkerClient();
    const s = client.analyzeSync('Раз два три.\n\nНовый абзац.');
    expect(s.words).toBe(5);
    expect(s.lines).toBe(3);
    expect(s.paragraphs).toBe(2);
    expect(s.chars).toBeGreaterThan(0);
  });

  it('пустой текст', () => {
    const client = new StatsWorkerClient();
    expect(client.analyzeSync('').words).toBe(0);
  });
});

describe('toUserMessage', () => {
  it('достаёт русское сообщение из AppError', () => {
    expect(toUserMessage(new AppError('X', 'Что-то пошло не так'))).toBe(
      'Что-то пошло не так'
    );
  });

  it('обрабатывает неизвестное', () => {
    expect(toUserMessage(null)).toMatch(/неизвестная/i);
  });
});

describe('logger', () => {
  it('пишет в историю без console.log', () => {
    logger.clearHistory();
    logger.info('тест');
    logger.error('ошибка');
    expect(logger.getHistory().length).toBeGreaterThanOrEqual(2);
  });
});
