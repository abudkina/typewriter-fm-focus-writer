import { Howl, Howler } from 'howler';
import typewriters from '../../data/typewriters.json';
import { logger } from '../../utils/logger';
import { AppError } from '../../utils/errors';
import { clampVolume } from '../../utils/validation';
import type { TypewriterTimbre } from './SoundSynthesizer';
import { TypingDynamics } from './TypingDynamics';
import type { SynthRequest, SynthResponse } from '../../workers/audio.worker';

export interface TypewriterModel {
  id: string;
  name: string;
  description: string;
  premium: boolean;
  basePitch: number;
  noiseAmount: number;
  clickSharpness: number;
}

interface ModelSounds {
  key: Howl;
  space: Howl;
  return: Howl;
}

/**
 * Движок звуков: Howler.js + синтез в Web Worker.
 */
export class SoundEngine {
  readonly models: TypewriterModel[] = typewriters as TypewriterModel[];
  readonly dynamics = new TypingDynamics();

  private currentModelId = 'remington';
  private baseVolume = 0.7;
  private muted = false;
  private unlocked = false;
  private sounds = new Map<string, ModelSounds>();
  private breath: Howl | null = null;
  private paper: Howl | null = null;
  private breathTimer: ReturnType<typeof setTimeout> | null = null;
  private idleBreathMs = 8000;
  private hasPremium = false;
  private worker: Worker | null = null;
  private reqId = 0;
  private pending = new Map<number, (r: SynthResponse) => void>();
  private ready = false;

  private ensureWorker(): Worker {
    if (this.worker) return this.worker;
    this.worker = new Worker(new URL('../../workers/audio.worker.ts', import.meta.url), {
      type: 'module',
    });
    this.worker.onmessage = (event: MessageEvent<SynthResponse>) => {
      const msg = event.data;
      const resolve = this.pending.get(msg.requestId);
      if (resolve) {
        this.pending.delete(msg.requestId);
        resolve(msg);
      }
    };
    this.worker.onerror = (err) => logger.error('Ошибка аудио-воркера', err);
    return this.worker;
  }

  private synthPack(timbre: TypewriterTimbre, includeExtras: boolean): Promise<SynthResponse> {
    const worker = this.ensureWorker();
    const requestId = ++this.reqId;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(requestId);
        reject(new AppError('AUDIO_TIMEOUT', 'Таймаут синтеза звука.'));
      }, 8000);
      this.pending.set(requestId, (r) => {
        clearTimeout(timer);
        resolve(r);
      });
      const msg: SynthRequest = { type: 'build-pack', requestId, timbre, includeExtras };
      worker.postMessage(msg);
    });
  }

  async init(hasPremium: boolean): Promise<void> {
    this.hasPremium = hasPremium;
    try {
      const primary =
        this.models.find((m) => m.id === this.currentModelId && (!m.premium || hasPremium)) ??
        this.models.find((m) => !m.premium)!;
      this.currentModelId = primary.id;
      await this.buildModelAsync(primary, true);
      this.ready = true;
      logger.info('Звуковой движок готов', { models: this.sounds.size });
    } catch (err) {
      logger.error('Ошибка инициализации звука', err);
      throw new AppError(
        'AUDIO_INIT',
        'Не удалось инициализировать звук. Проверьте разрешения браузера.'
      );
    }
  }

  private async buildModelAsync(model: TypewriterModel, includeExtras = false): Promise<void> {
    const timbre: TypewriterTimbre = {
      basePitch: model.basePitch,
      noiseAmount: model.noiseAmount,
      clickSharpness: model.clickSharpness,
    };
    const pack = await this.synthPack(timbre, includeExtras);
    this.sounds.set(model.id, {
      key: new Howl({ src: [pack.key], volume: 1 }),
      space: new Howl({ src: [pack.space], volume: 1 }),
      return: new Howl({ src: [pack.return], volume: 1 }),
    });
    if (includeExtras && pack.breath && pack.paper) {
      this.breath = new Howl({ src: [pack.breath], volume: 0.12 });
      this.paper = new Howl({ src: [pack.paper], volume: 0.55 });
    }
  }

  unlock(): void {
    if (this.unlocked || !this.ready) return;
    this.unlocked = true;
    const pack = this.sounds.get(this.currentModelId);
    if (pack) {
      pack.key.volume(0);
      pack.key.play();
      pack.key.volume(1);
    }
    logger.info('Аудиоразблокировка выполнена');
  }

  setPremium(hasPremium: boolean): void {
    this.hasPremium = hasPremium;
  }

  getAvailableModels(): TypewriterModel[] {
    return this.models.filter((m) => !m.premium || this.hasPremium);
  }

  async setModel(id: string): Promise<void> {
    const model = this.models.find((m) => m.id === id);
    if (!model) {
      throw new AppError('MODEL_UNKNOWN', 'Неизвестная модель машинки.');
    }
    if (model.premium && !this.hasPremium) {
      throw new AppError(
        'PREMIUM_REQUIRED',
        'Эта машинка доступна по подписке. Оформите премиум за 2 $/мес.'
      );
    }
    if (!this.sounds.has(id)) {
      await this.buildModelAsync(model);
    }
    this.currentModelId = id;
  }

  /** Синхронный выбор уже загруженной модели (для настроек) */
  setModelSync(id: string): void {
    const model = this.models.find((m) => m.id === id);
    if (!model) {
      throw new AppError('MODEL_UNKNOWN', 'Неизвестная модель машинки.');
    }
    if (model.premium && !this.hasPremium) {
      throw new AppError(
        'PREMIUM_REQUIRED',
        'Эта машинка доступна по подписке. Оформите премиум за 2 $/мес.'
      );
    }
    this.currentModelId = id;
  }

  getModelId(): string {
    return this.currentModelId;
  }

  setVolume(volume: number): void {
    this.baseVolume = clampVolume(volume);
  }

  getVolume(): number {
    return this.baseVolume;
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
    Howler.mute(muted);
  }

  isMuted(): boolean {
    return this.muted;
  }

  playPaperFeed(): void {
    if (this.muted || !this.paper) return;
    this.paper.volume(this.baseVolume * 0.6);
    this.paper.play();
  }

  playForKey(key: string): void {
    if (!this.ready) return;
    this.unlock();
    this.dynamics.recordKeystroke();
    this.scheduleBreathWatch();

    if (this.muted) return;

    const pack = this.sounds.get(this.currentModelId);
    if (!pack) return;

    const vol = this.dynamics.getDynamicVolume(this.baseVolume);
    let howl: Howl;

    if (key === 'Enter') {
      howl = pack.return;
      howl.volume(vol * 0.9);
    } else if (key === ' ' || key === 'Spacebar') {
      howl = pack.space;
      howl.volume(vol);
    } else if (key.length === 1 || key === 'Backspace') {
      howl = pack.key;
      howl.volume(vol);
    } else {
      return;
    }

    howl.rate(0.92 + Math.random() * 0.16);
    howl.play();
  }

  private scheduleBreathWatch(): void {
    if (this.breathTimer) clearTimeout(this.breathTimer);
    this.breathTimer = setTimeout(() => this.playBreathIfIdle(), this.idleBreathMs);
  }

  private playBreathIfIdle(): void {
    if (this.muted || !this.breath) return;
    if (this.dynamics.getIdleMs() < this.idleBreathMs) return;
    this.breath.volume(0.08 * this.baseVolume);
    this.breath.play();
    this.breathTimer = setTimeout(() => this.playBreathIfIdle(), 2500);
  }

  destroy(): void {
    if (this.breathTimer) clearTimeout(this.breathTimer);
    this.sounds.forEach((pack) => {
      pack.key.unload();
      pack.space.unload();
      pack.return.unload();
    });
    this.breath?.unload();
    this.paper?.unload();
    this.worker?.terminate();
    this.worker = null;
  }
}
