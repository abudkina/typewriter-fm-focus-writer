import { validatePomodoroMinutes } from '../../utils/validation';
import { logger } from '../../utils/logger';

export type PomodoroPhase = 'idle' | 'work' | 'break' | 'paused';

export interface PomodoroState {
  phase: PomodoroPhase;
  remainingMs: number;
  workMinutes: number;
  breakMinutes: number;
}

type Listener = (state: PomodoroState) => void;

/**
 * Таймер сессии Pomodoro без внешних зависимостей.
 */
export class PomodoroTimer {
  private phase: PomodoroPhase = 'idle';
  private remainingMs = 0;
  private workMinutes = 25;
  private breakMinutes = 5;
  private tickId: ReturnType<typeof setInterval> | null = null;
  private lastTick = 0;
  private phaseBeforePause: 'work' | 'break' = 'work';
  private listeners = new Set<Listener>();

  subscribe(fn: Listener): () => void {
    this.listeners.add(fn);
    fn(this.getState());
    return () => this.listeners.delete(fn);
  }

  private emit(): void {
    const state = this.getState();
    this.listeners.forEach((fn) => fn(state));
  }

  getState(): PomodoroState {
    return {
      phase: this.phase,
      remainingMs: this.remainingMs,
      workMinutes: this.workMinutes,
      breakMinutes: this.breakMinutes,
    };
  }

  setDurations(workMinutes: number, breakMinutes: number): void {
    this.workMinutes = validatePomodoroMinutes(workMinutes);
    this.breakMinutes = validatePomodoroMinutes(breakMinutes);
    if (this.phase === 'idle') {
      this.remainingMs = this.workMinutes * 60_000;
    }
    this.emit();
  }

  start(): void {
    if (this.phase === 'paused') {
      this.phase = this.phaseBeforePause;
      if (this.remainingMs <= 0) {
        this.phase = 'work';
        this.remainingMs = this.workMinutes * 60_000;
      }
    } else if (this.phase === 'idle') {
      this.phase = 'work';
      this.remainingMs = this.workMinutes * 60_000;
    }
    this.lastTick = Date.now();
    this.startTicking();
    logger.info('Помодоро: старт');
    this.emit();
  }

  pause(): void {
    if (this.phase !== 'work' && this.phase !== 'break') return;
    this.phaseBeforePause = this.phase;
    this.phase = 'paused';
    this.stopTicking();
    logger.info('Помодоро: пауза');
    this.emit();
  }

  reset(): void {
    this.stopTicking();
    this.phase = 'idle';
    this.remainingMs = this.workMinutes * 60_000;
    this.emit();
  }

  private startTicking(): void {
    this.stopTicking();
    this.tickId = setInterval(() => this.tick(), 250);
  }

  private stopTicking(): void {
    if (this.tickId) {
      clearInterval(this.tickId);
      this.tickId = null;
    }
  }

  private tick(): void {
    const now = Date.now();
    const delta = now - this.lastTick;
    this.lastTick = now;
    if (this.phase !== 'work' && this.phase !== 'break') return;

    this.remainingMs = Math.max(0, this.remainingMs - delta);
    if (this.remainingMs <= 0) {
      if (this.phase === 'work') {
        this.phase = 'break';
        this.remainingMs = this.breakMinutes * 60_000;
        logger.info('Помодоро: переход к отдыху');
      } else {
        this.phase = 'idle';
        this.remainingMs = this.workMinutes * 60_000;
        this.stopTicking();
        logger.info('Помодоро: сессия завершена');
      }
    }
    this.emit();
  }

  /** Форматирование мм:сс */
  static format(ms: number): string {
    const totalSec = Math.max(0, Math.ceil(ms / 1000));
    const m = Math.floor(totalSec / 60);
    const s = totalSec % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }

  destroy(): void {
    this.stopTicking();
    this.listeners.clear();
  }
}
