/**
 * Расчёт скорости печати и динамической громкости.
 */
export class TypingDynamics {
  private timestamps: number[] = [];
  private readonly windowMs: number;

  constructor(windowMs = 2000) {
    this.windowMs = windowMs;
  }

  /** Регистрирует нажатие клавиши */
  recordKeystroke(now = Date.now()): void {
    this.timestamps.push(now);
    this.prune(now);
  }

  private prune(now: number): void {
    const cutoff = now - this.windowMs;
    while (this.timestamps.length > 0 && this.timestamps[0]! < cutoff) {
      this.timestamps.shift();
    }
  }

  /** Символов в минуту за окно */
  getCpm(now = Date.now()): number {
    this.prune(now);
    if (this.timestamps.length < 2) return 0;
    const span = now - this.timestamps[0]!;
    if (span <= 0) return 0;
    return (this.timestamps.length / span) * 60_000;
  }

  /**
   * Громкость 0.35–1.0 в зависимости от скорости.
   * Медленная печать — тише, быстрая — громче.
   */
  getDynamicVolume(baseVolume: number, now = Date.now()): number {
    const cpm = this.getCpm(now);
    // Нормализация: 0–400 CPM → множитель 0.35–1.0
    const factor = Math.min(1, Math.max(0.35, 0.35 + (cpm / 400) * 0.65));
    return Math.min(1, Math.max(0, baseVolume * factor));
  }

  /** Миллисекунды с последнего нажатия */
  getIdleMs(now = Date.now()): number {
    if (this.timestamps.length === 0) return Number.POSITIVE_INFINITY;
    return now - this.timestamps[this.timestamps.length - 1]!;
  }

  reset(): void {
    this.timestamps = [];
  }
}
