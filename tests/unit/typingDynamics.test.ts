import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { TypingDynamics } from '../../src/modules/audio/TypingDynamics';

describe('TypingDynamics', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('возвращает 0 CPM без нажатий', () => {
    const d = new TypingDynamics();
    expect(d.getCpm()).toBe(0);
  });

  it('увеличивает громкость при быстрой печати', () => {
    const d = new TypingDynamics(2000);
    const t0 = 1_000_000;
    vi.setSystemTime(t0);
    for (let i = 0; i < 20; i++) {
      vi.setSystemTime(t0 + i * 50);
      d.recordKeystroke(t0 + i * 50);
    }
    const fastVol = d.getDynamicVolume(1, t0 + 1000);
    d.reset();
    vi.setSystemTime(t0);
    d.recordKeystroke(t0);
    vi.setSystemTime(t0 + 1500);
    d.recordKeystroke(t0 + 1500);
    const slowVol = d.getDynamicVolume(1, t0 + 1500);
    expect(fastVol).toBeGreaterThan(slowVol);
  });

  it('считает простой idle', () => {
    const d = new TypingDynamics();
    const t0 = 5000;
    d.recordKeystroke(t0);
    expect(d.getIdleMs(t0 + 3000)).toBe(3000);
  });
});
