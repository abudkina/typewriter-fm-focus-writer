/**
 * Статистика сессии письма: время, скорость (слов/символов в минуту).
 */
export interface WritingSnapshot {
  /** Миллисекунды с начала сессии (настенные часы) */
  elapsedMs: number;
  /** Активное время печати (исключая паузы простоя > idleGapMs) */
  activeMs: number;
  /** Символов набрано за сессию (нетто: рост длины текста) */
  charsTyped: number;
  /** Слов на момент снимка */
  wordsNow: number;
  /** Символов в минуту по активному времени */
  cpm: number;
  /** Слов в минуту по активному времени */
  wpm: number;
}

export class WritingSessionStats {
  private sessionStartedAt: number;
  private lastActivityAt: number;
  private activeMs = 0;
  private charsTyped = 0;
  private lastTextLength = 0;
  private wordsNow = 0;
  private readonly idleGapMs: number;

  constructor(idleGapMs = 5000, now = Date.now()) {
    this.idleGapMs = idleGapMs;
    this.sessionStartedAt = now;
    this.lastActivityAt = now;
  }

  /**
   * Регистрирует изменение текста.
   * Учитывает только прирост длины (удаления не уменьшают charsTyped).
   */
  recordText(text: string, now = Date.now()): void {
    const len = text.length;
    const delta = len - this.lastTextLength;
    if (delta > 0) {
      this.charsTyped += delta;
    }
    this.lastTextLength = len;
    this.wordsNow = countWordsLocal(text);

    const gap = now - this.lastActivityAt;
    if (gap > 0 && gap < this.idleGapMs) {
      this.activeMs += gap;
    }
    this.lastActivityAt = now;
  }

  /**
   * Синхронизирует длину текста без начисления набранных символов
   * (после загрузки черновика).
   */
  seedText(text: string, now = Date.now()): void {
    this.lastTextLength = text.length;
    this.wordsNow = countWordsLocal(text);
    this.lastActivityAt = now;
  }

  /** Сброс сессии (время и счётчики скорости) */
  reset(now = Date.now(), keepTextLength = true): void {
    this.sessionStartedAt = now;
    this.lastActivityAt = now;
    this.activeMs = 0;
    this.charsTyped = 0;
    this.wordsNow = 0;
    if (!keepTextLength) {
      this.lastTextLength = 0;
    }
  }

  getSnapshot(now = Date.now()): WritingSnapshot {
    const elapsedMs = Math.max(0, now - this.sessionStartedAt);
    const activeMinutes = this.activeMs / 60_000;
    const cpm = activeMinutes > 0 ? this.charsTyped / activeMinutes : 0;
    const wpm = activeMinutes > 0 ? this.wordsNow / activeMinutes : 0;
    return {
      elapsedMs,
      activeMs: this.activeMs,
      charsTyped: this.charsTyped,
      wordsNow: this.wordsNow,
      cpm: Math.round(cpm),
      wpm: Math.round(wpm),
    };
  }

  static formatDuration(ms: number): string {
    const totalSec = Math.max(0, Math.floor(ms / 1000));
    const h = Math.floor(totalSec / 3600);
    const m = Math.floor((totalSec % 3600) / 60);
    const s = totalSec % 60;
    if (h > 0) {
      return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    }
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }
}

function countWordsLocal(text: string): number {
  if (!text.trim()) return 0;
  const matches = text.trim().match(/[\p{L}\p{N}'’\-]+/gu);
  return matches ? matches.length : 0;
}
