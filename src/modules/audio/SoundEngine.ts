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
      // Предзагрузка остальных бесплатных — смена модели без ожидания синтеза
      const freeRest = this.models.filter((m) => !m.premium && m.id !== primary.id);
      await Promise.all(freeRest.map((m) => this.buildModelAsync(m)));
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

  private createHowl(src: string, volume = 1): Promise<Howl> {
    return new Promise((resolve, reject) => {
      const howl = new Howl({
        src: [src],
        volume,
        preload: true,
        onload: () => resolve(howl),
        onloaderror: (_id, err) => {
          logger.error('Ошибка загрузки звука', err);
          reject(new AppError('AUDIO_LOAD', 'Не удалось загрузить звук машинки.'));
        },
      });
      if (howl.state() === 'loaded') {
        resolve(howl);
      }
    });
  }

  private async buildModelAsync(model: TypewriterModel, includeExtras = false): Promise<void> {
    if (this.sounds.has(model.id) && !includeExtras) return;

    const timbre: TypewriterTimbre = {
      basePitch: model.basePitch,
      noiseAmount: model.noiseAmount,
      clickSharpness: model.clickSharpness,
    };
    const pack = await this.synthPack(timbre, includeExtras);
    const [key, space, ret] = await Promise.all([
      this.createHowl(pack.key),
      this.createHowl(pack.space),
      this.createHowl(pack.return),
    ]);
    this.sounds.set(model.id, { key, space, return: ret });
    if (includeExtras && pack.breath && pack.paper) {
      this.breath = await this.createHowl(pack.breath, 0.12);
      this.paper = await this.createHowl(pack.paper, 0.55);
    }
  }

  isReady(): boolean {
    return this.ready;
  }

  /**
   * Разблокировка AudioContext синхронно в обработчике жеста
   * (до любых await — иначе браузер блокирует play).
   */
  unlock(): void {
    this.ensureAudioContext();
    void this.resumeContext();
    if (this.unlocked) return;
    this.unlocked = true;
    logger.info('Аудиоразблокировка выполнена');
  }

  /** Гарантирует наличие AudioContext до первого Howl (тихий data-URI) */
  private ensureAudioContext(): void {
    if (Howler.ctx) return;
    try {
      // Минимальный валидный WAV (тишина)
      const silent =
        'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=';
      const h = new Howl({ src: [silent], volume: 0, preload: true });
      h.once('load', () => {
        const id = h.play();
        h.stop(id);
      });
      h.play();
    } catch (err) {
      logger.warn('Не удалось создать AudioContext', err);
    }
  }

  private async resumeContext(): Promise<void> {
    this.ensureAudioContext();
    const ctx = Howler.ctx as AudioContext | undefined;
    if (ctx && ctx.state === 'suspended') {
      try {
        await ctx.resume();
      } catch (err) {
        logger.warn('Не удалось возобновить AudioContext', err);
      }
    }
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
    void this.resumeContext();
    this.paper.volume(this.baseVolume * 0.6);
    this.paper.play();
  }

  /**
   * Образец звука после смены модели.
   * Сначала resume контекста, затем play загруженного Howl.
   */
  async playSample(): Promise<void> {
    if (this.muted) return;
    await this.resumeContext();
    this.unlocked = true;

    const pack = this.sounds.get(this.currentModelId);
    if (!pack) {
      logger.warn('Нет звуков для образца', { id: this.currentModelId });
      return;
    }

    const howl = pack.key;
    if (howl.state() !== 'loaded') {
      await new Promise<void>((resolve, reject) => {
        const t = window.setTimeout(() => reject(new Error('load timeout')), 3000);
        howl.once('load', () => {
          clearTimeout(t);
          resolve();
        });
        howl.once('loaderror', () => {
          clearTimeout(t);
          reject(new Error('load error'));
        });
      }).catch((err) => {
        logger.warn('Образец не загрузился', err);
      });
    }

    howl.stop();
    howl.rate(1);
    howl.volume(Math.max(0.55, this.baseVolume));
    const playId = howl.play();
    logger.info('Образец машинки', { id: this.currentModelId, playId, state: howl.state() });
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
