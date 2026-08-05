import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { PomodoroTimer } from '../../src/modules/pomodoro/PomodoroTimer';

describe('PomodoroTimer', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('форматирует время', () => {
    expect(PomodoroTimer.format(0)).toBe('00:00');
    expect(PomodoroTimer.format(65_000)).toBe('01:05');
    expect(PomodoroTimer.format(25 * 60_000)).toBe('25:00');
  });

  it('запускает рабочую фазу', () => {
    const t = new PomodoroTimer();
    t.setDurations(25, 5);
    t.start();
    expect(t.getState().phase).toBe('work');
    expect(t.getState().remainingMs).toBe(25 * 60_000);
    t.destroy();
  });

  it('ставит на паузу и возобновляет', () => {
    const t = new PomodoroTimer();
    t.setDurations(1, 1);
    t.start();
    vi.advanceTimersByTime(1000);
    t.pause();
    expect(t.getState().phase).toBe('paused');
    const left = t.getState().remainingMs;
    t.start();
    expect(t.getState().phase).toBe('work');
    expect(t.getState().remainingMs).toBe(left);
    t.destroy();
  });

  it('сбрасывает в idle', () => {
    const t = new PomodoroTimer();
    t.setDurations(10, 5);
    t.start();
    t.reset();
    expect(t.getState().phase).toBe('idle');
    expect(t.getState().remainingMs).toBe(10 * 60_000);
    t.destroy();
  });

  it('переходит к отдыху после работы', () => {
    const t = new PomodoroTimer();
    t.setDurations(1, 2);
    t.start();
    vi.advanceTimersByTime(61_000);
    expect(t.getState().phase).toBe('break');
    expect(t.getState().remainingMs).toBeLessThanOrEqual(2 * 60_000);
    t.destroy();
  });
});
