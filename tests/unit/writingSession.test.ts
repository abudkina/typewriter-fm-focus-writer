import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { WritingSessionStats } from '../../src/modules/stats/WritingSessionStats';

describe('WritingSessionStats', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('форматирует длительность', () => {
    expect(WritingSessionStats.formatDuration(0)).toBe('00:00');
    expect(WritingSessionStats.formatDuration(65_000)).toBe('01:05');
    expect(WritingSessionStats.formatDuration(3_661_000)).toBe('1:01:01');
  });

  it('считает символы и скорость', () => {
    const t0 = 1_000_000;
    vi.setSystemTime(t0);
    const s = new WritingSessionStats(5000, t0);
    s.recordText('Привет', t0);
    // Несколько нажатий внутри окна активности
    vi.setSystemTime(t0 + 2000);
    s.recordText('Привет ', t0 + 2000);
    vi.setSystemTime(t0 + 4000);
    s.recordText('Привет мир', t0 + 4000);
    const snap = s.getSnapshot(t0 + 4000);
    expect(snap.charsTyped).toBe(10);
    expect(snap.activeMs).toBe(4000);
    expect(snap.cpm).toBeGreaterThan(0);
    expect(snap.wpm).toBeGreaterThan(0);
  });

  it('не считает длинный простой как активное время', () => {
    const t0 = 5_000;
    const s = new WritingSessionStats(5000, t0);
    s.recordText('а', t0);
    s.recordText('аб', t0 + 10_000);
    expect(s.getSnapshot(t0 + 10_000).activeMs).toBe(0);
  });

  it('seedText не начисляет символы', () => {
    const s = new WritingSessionStats();
    s.seedText('уже готовый текст');
    const snap = s.getSnapshot();
    expect(snap.charsTyped).toBe(0);
    expect(snap.wordsNow).toBeGreaterThan(0);
  });

  it('сбрасывает сессию', () => {
    const t0 = 1000;
    const s = new WritingSessionStats(5000, t0);
    s.recordText('тест', t0);
    s.reset(t0 + 100, true);
    expect(s.getSnapshot(t0 + 100).charsTyped).toBe(0);
    expect(s.getSnapshot(t0 + 100).elapsedMs).toBe(0);
  });
});
