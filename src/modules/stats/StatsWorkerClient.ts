import { logger } from '../../utils/logger';
import type { StatsRequest, StatsResponse } from '../../workers/stats.worker';

export interface TextStats {
  words: number;
  chars: number;
  charsNoSpaces: number;
  lines: number;
  paragraphs: number;
}

const EMPTY: TextStats = {
  words: 0,
  chars: 0,
  charsNoSpaces: 0,
  lines: 0,
  paragraphs: 0,
};

/**
 * Клиент Web Worker для анализа текста.
 */
export class StatsWorkerClient {
  private worker: Worker | null = null;
  private requestId = 0;
  private pending = new Map<
    number,
    { resolve: (s: TextStats) => void; reject: (e: Error) => void }
  >();

  start(): void {
    if (this.worker) return;
    try {
      this.worker = new Worker(new URL('../../workers/stats.worker.ts', import.meta.url), {
        type: 'module',
      });
      this.worker.onmessage = (event: MessageEvent<StatsResponse>) => {
        const msg = event.data;
        const pending = this.pending.get(msg.requestId);
        if (!pending) return;
        this.pending.delete(msg.requestId);
        pending.resolve({
          words: msg.words,
          chars: msg.chars,
          charsNoSpaces: msg.charsNoSpaces,
          lines: msg.lines,
          paragraphs: msg.paragraphs,
        });
      };
      this.worker.onerror = (err) => {
        logger.error('Ошибка воркера статистики', err);
      };
    } catch (err) {
      logger.warn('Worker недоступен, статистика на главном потоке', err);
      this.worker = null;
    }
  }

  analyze(text: string): Promise<TextStats> {
    if (!this.worker) {
      return Promise.resolve(this.analyzeSync(text));
    }
    const id = ++this.requestId;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      const msg: StatsRequest = { type: 'analyze', text, requestId: id };
      this.worker!.postMessage(msg);
      // Таймаут на случай зависания
      setTimeout(() => {
        if (this.pending.has(id)) {
          this.pending.delete(id);
          resolve(this.analyzeSync(text));
        }
      }, 2000);
    });
  }

  analyzeSync(text: string): TextStats {
    if (!text) return { ...EMPTY };
    const wordsMatch = text.trim() ? text.trim().match(/[\p{L}\p{N}'’\-]+/gu) : null;
    return {
      words: wordsMatch ? wordsMatch.length : 0,
      chars: text.length,
      charsNoSpaces: text.replace(/\s/g, '').length,
      lines: text.split(/\n/).length,
      paragraphs: text.trim()
        ? text
            .trim()
            .split(/\n\s*\n/)
            .filter((p) => p.trim()).length
        : 0,
    };
  }

  destroy(): void {
    this.worker?.terminate();
    this.worker = null;
    this.pending.clear();
  }
}
