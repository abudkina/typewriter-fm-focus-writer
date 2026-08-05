import { SoundEngine } from '../modules/audio/SoundEngine';
import { PomodoroTimer } from '../modules/pomodoro/PomodoroTimer';
import { PremiumService } from '../modules/premium/PremiumService';
import { storage } from '../modules/storage/StorageService';
import { StatsWorkerClient } from '../modules/stats/StatsWorkerClient';
import { WritingSessionStats } from '../modules/stats/WritingSessionStats';
import { ThemeService } from '../modules/themes/ThemeService';
import { applyTypeShake, createInkTexture } from '../modules/effects/VisualEffects';
import { logger } from '../utils/logger';
import { toUserMessage } from '../utils/errors';
import { validateTextFile, validateUrl } from '../utils/validation';

const DOC_ID = 'main';

type FontId = 'special' | 'courier' | 'plex';

interface AppSettings {
  volume: number;
  muted: boolean;
  modelId: string;
  font: FontId;
  effects: boolean;
  workMinutes: number;
  breakMinutes: number;
  themeId: string;
}

const DEFAULT_SETTINGS: AppSettings = {
  volume: 0.7,
  muted: false,
  modelId: 'remington',
  font: 'special',
  effects: true,
  workMinutes: 25,
  breakMinutes: 5,
  themeId: 'classic',
};

/**
 * Корневое приложение Typewriter.fm Focus Writer.
 */
export class App {
  private root: HTMLElement;
  private sound = new SoundEngine();
  private premium = new PremiumService();
  private pomodoro = new PomodoroTimer();
  private stats = new StatsWorkerClient();
  private session = new WritingSessionStats();
  private themes = new ThemeService();
  private settings: AppSettings;
  private saveTimer: ReturnType<typeof setTimeout> | null = null;
  private toastTimer: ReturnType<typeof setTimeout> | null = null;
  private statsUiTimer: ReturnType<typeof setInterval> | null = null;

  private editor!: HTMLTextAreaElement;
  private wordEl!: HTMLElement;
  private charEl!: HTMLElement;
  private pomoEl!: HTMLElement;
  private toastEl!: HTMLElement;
  private modelSelect!: HTMLSelectElement;
  private paperStage!: HTMLElement;

  constructor(root: HTMLElement) {
    this.root = root;
    this.settings = storage.getSetting<AppSettings>('settings', DEFAULT_SETTINGS);
  }

  async start(): Promise<void> {
    await storage.init();
    this.stats.start();
    this.renderShell();
    this.bindElements();
    await this.restoreDocument();
    this.pomodoro.setDurations(this.settings.workMinutes, this.settings.breakMinutes);
    this.pomodoro.subscribe((state) => {
      const label =
        state.phase === 'idle'
          ? 'ожидание'
          : state.phase === 'work'
            ? 'работа'
            : state.phase === 'break'
              ? 'отдых'
              : 'пауза';
      this.pomoEl.textContent = `${PomodoroTimer.format(state.remainingMs)} · ${label}`;
    });
    this.bindEvents();
    this.applyStoredTheme();
    this.runPaperIntro();
    // Звук и текстура — только после первого жеста (не блокирует Lighthouse TBT)
    const unlockHeavy = () => {
      document.removeEventListener('pointerdown', unlockHeavy);
      document.removeEventListener('keydown', unlockHeavy);
      void this.initAudioAndEffects();
    };
    document.addEventListener('pointerdown', unlockHeavy, { once: true });
    document.addEventListener('keydown', unlockHeavy, { once: true });
    // Фоновая текстура без звука — в idle
    const defer =
      typeof requestIdleCallback === 'function'
        ? (fn: () => void) => requestIdleCallback(() => fn(), { timeout: 2500 })
        : (fn: () => void) => setTimeout(fn, 1500);
    defer(() => {
      void createInkTexture(96, 96).then((texture) => {
        if (texture) this.paperStage.style.setProperty('--ink-texture', `url(${texture})`);
      });
    });
    logger.info('Приложение запущено');
  }

  private renderShell(): void {
    this.root.innerHTML = `
      <div class="paper-loader" id="paper-loader" role="status" aria-live="polite">
        <div class="paper-sheet" aria-hidden="true">Заправка бумаги…</div>
        <span class="sr-only">Идёт заправка бумаги</span>
      </div>

      <header class="toolbar" role="banner">
        <div class="brand" aria-label="Название приложения">Typewriter.fm <span>Focus Writer</span></div>

        <div class="toolbar-group">
          <div class="select-wrap">
            <label for="model-select">Машинка</label>
            <select id="model-select" aria-label="Выбор модели печатной машинки"></select>
          </div>
          <div class="select-wrap">
            <label for="font-select">Шрифт</label>
            <select id="font-select" aria-label="Выбор шрифта">
              <option value="special">Спешиал Элит</option>
              <option value="courier">Курьер Прайм</option>
              <option value="plex">Плекс Моно</option>
            </select>
          </div>
        </div>

        <div class="toolbar-group volume-wrap">
          <label for="volume" class="sr-only">Громкость</label>
          <input id="volume" type="range" min="0" max="100" step="1" aria-label="Громкость звука" />
          <button type="button" id="btn-mute" aria-label="Выключить звук" aria-pressed="false">Звук</button>
        </div>

        <div class="toolbar-group">
          <button type="button" id="btn-effects" aria-label="Визуальные эффекты" aria-pressed="true">Эффекты</button>
          <button type="button" id="btn-stats" aria-label="Статистика письма">Статистика</button>
          <button type="button" id="btn-themes" aria-label="Библиотека тем оформления">Темы</button>
          <label class="file-btn" aria-label="Импорт текстового файла">
            Импорт
            <input type="file" id="file-import" accept=".txt,.md,.markdown,.text,text/plain,text/markdown" />
          </label>
          <button type="button" id="btn-export" aria-label="Экспорт текста в файл">Экспорт</button>
          <button type="button" id="btn-link" aria-label="Вставить ссылку в текст">Ссылка</button>
          <button type="button" id="btn-premium" aria-label="Премиум-подписка">Премиум</button>
        </div>

        <div class="toolbar-spacer"></div>

        <div class="toolbar-group pomodoro" aria-label="Таймер помодоро">
          <button type="button" id="btn-pomo-start" aria-label="Запустить помодоро">Старт</button>
          <button type="button" id="btn-pomo-pause" aria-label="Пауза помодоро">Пауза</button>
          <button type="button" id="btn-pomo-reset" aria-label="Сбросить помодоро">Сброс</button>
        </div>
      </header>

      <main class="workspace" role="main">
        <div class="paper-stage" id="paper-stage">
          <label for="editor" class="sr-only">Поле текста</label>
          <textarea
            id="editor"
            class="editor"
            spellcheck="true"
            lang="ru"
            placeholder="Начните печатать… Отвлечения остались за дверью."
            aria-label="Основное поле ввода текста"
          ></textarea>
        </div>
      </main>

      <footer class="status" role="contentinfo">
        <div>Слова: <strong id="stat-words">0</strong></div>
        <div>Символы: <strong id="stat-chars">0</strong></div>
        <div class="pomodoro">
          <span class="pomodoro-time" id="stat-pomo" aria-live="polite">25:00 · ожидание</span>
        </div>
        <div id="stat-premium" aria-live="polite"></div>
      </footer>

      <div class="toast" id="toast" role="alert" aria-live="assertive"></div>

      <div class="modal-backdrop" id="modal-premium" role="dialog" aria-modal="true" aria-labelledby="premium-title" hidden>
        <div class="modal">
          <h2 id="premium-title">Премиум-звуки</h2>
          <p>
            Настоящие Оливетти и Адлер — за <strong>2&nbsp;$/мес</strong>.
            Оплата не требуется: подписка хранится только на этом устройстве (без сервера).
          </p>
          <div class="modal-actions">
            <button type="button" id="premium-cancel" aria-label="Закрыть окно премиума">Закрыть</button>
            <button type="button" id="premium-toggle" aria-label="Переключить премиум">Оформить</button>
          </div>
        </div>
      </div>

      <div class="modal-backdrop" id="modal-link" role="dialog" aria-modal="true" aria-labelledby="link-title" hidden>
        <div class="modal">
          <h2 id="link-title">Вставить ссылку</h2>
          <p>Укажите адрес http или https. Текст ссылки будет вставлен в позицию курсора.</p>
          <label for="link-url" class="sr-only">Адрес ссылки</label>
          <input type="url" id="link-url" placeholder="https://пример.рф" autocomplete="off" />
          <div class="modal-actions">
            <button type="button" id="link-cancel" aria-label="Отменить вставку ссылки">Отмена</button>
            <button type="button" id="link-ok" aria-label="Вставить ссылку">Вставить</button>
          </div>
        </div>
      </div>

      <div class="modal-backdrop" id="modal-stats" role="dialog" aria-modal="true" aria-labelledby="stats-title" hidden>
        <div class="modal modal-wide">
          <h2 id="stats-title">Статистика письма</h2>
          <p>Показатели текущей сессии: скорость и время за компьютером.</p>
          <dl class="stats-grid" aria-live="polite">
            <div>
              <dt>Время сессии</dt>
              <dd id="stats-elapsed">00:00</dd>
            </div>
            <div>
              <dt>Активное время</dt>
              <dd id="stats-active">00:00</dd>
            </div>
            <div>
              <dt>Скорость (слов/мин)</dt>
              <dd id="stats-wpm">0</dd>
            </div>
            <div>
              <dt>Скорость (симв./мин)</dt>
              <dd id="stats-cpm">0</dd>
            </div>
            <div>
              <dt>Набрано символов</dt>
              <dd id="stats-chars-typed">0</dd>
            </div>
            <div>
              <dt>Слов сейчас</dt>
              <dd id="stats-words-now">0</dd>
            </div>
          </dl>
          <div class="modal-actions">
            <button type="button" id="stats-reset" aria-label="Сбросить статистику сессии">Сбросить сессию</button>
            <button type="button" id="stats-close" aria-label="Закрыть статистику письма">Закрыть</button>
          </div>
        </div>
      </div>

      <div class="modal-backdrop" id="modal-themes" role="dialog" aria-modal="true" aria-labelledby="themes-title" hidden>
        <div class="modal modal-wide">
          <h2 id="themes-title">Библиотека тем оформления</h2>
          <p>Выберите атмосферу стола и бумаги. Тема сохраняется на этом устройстве.</p>
          <div class="theme-grid" id="theme-grid" role="listbox" aria-label="Список тем оформления"></div>
          <div class="modal-actions">
            <button type="button" id="themes-close" aria-label="Закрыть библиотеку тем">Закрыть</button>
          </div>
        </div>
      </div>
    `;
  }

  private bindElements(): void {
    this.editor = this.must('#editor');
    this.wordEl = this.must('#stat-words');
    this.charEl = this.must('#stat-chars');
    this.pomoEl = this.must('#stat-pomo');
    this.toastEl = this.must('#toast');
    this.modelSelect = this.must('#model-select');
    this.paperStage = this.must('#paper-stage');

    const fontSelect = this.must<HTMLSelectElement>('#font-select');
    fontSelect.value = this.settings.font;
    this.applyFont(this.settings.font);

    const volume = this.must<HTMLInputElement>('#volume');
    volume.value = String(Math.round(this.settings.volume * 100));

    const muteBtn = this.must<HTMLButtonElement>('#btn-mute');
    muteBtn.setAttribute('aria-pressed', String(this.settings.muted));
    muteBtn.textContent = this.settings.muted ? 'Без звука' : 'Звук';

    const effectsBtn = this.must<HTMLButtonElement>('#btn-effects');
    effectsBtn.setAttribute('aria-pressed', String(this.settings.effects));
    effectsBtn.classList.toggle('is-active', this.settings.effects);

    this.updatePremiumBadge();
  }

  private must<T extends HTMLElement = HTMLElement>(sel: string): T {
    const el = this.root.querySelector(sel);
    if (!el) throw new Error(`Элемент не найден: ${sel}`);
    return el as T;
  }

  private async initAudioAndEffects(): Promise<void> {
    try {
      await this.sound.init(this.premium.isActive());
      this.sound.setVolume(this.settings.volume);
      this.sound.setMuted(this.settings.muted);
      try {
        await this.sound.setModel(this.settings.modelId);
      } catch {
        await this.sound.setModel('remington');
        this.settings.modelId = 'remington';
      }
      this.fillModelSelect();
      this.sound.playPaperFeed();
    } catch (err) {
      this.showToast(toUserMessage(err), true);
    }
  }

  private fillModelSelect(): void {
    const models = this.sound.models;
    const premium = this.premium.isActive();
    this.modelSelect.innerHTML = models
      .map((m) => {
        const locked = m.premium && !premium;
        const label = locked ? `${m.name} (премиум)` : m.name;
        return `<option value="${m.id}" ${locked ? 'disabled' : ''} ${
          m.id === this.settings.modelId ? 'selected' : ''
        }>${label}</option>`;
      })
      .join('');
  }

  private async restoreDocument(): Promise<void> {
    try {
      const doc = await storage.loadDocument(DOC_ID);
      if (doc?.content) {
        this.editor.value = doc.content;
        this.session.seedText(doc.content);
        await this.refreshStats();
      }
    } catch (err) {
      this.showToast(toUserMessage(err), true);
    }
  }

  private runPaperIntro(): void {
    const loader = this.must('#paper-loader');
    // Звук заправки после короткой задержки / жеста — попробуем сразу
    window.setTimeout(() => {
      try {
        this.sound.playPaperFeed();
      } catch {
        /* звук может быть заблокирован до жеста */
      }
    }, 200);
    window.setTimeout(() => {
      loader.classList.add('is-done');
      this.editor.focus();
    }, 1600);
  }

  private bindEvents(): void {
    this.editor.addEventListener('keydown', (e) => this.onKeyDown(e));
    this.editor.addEventListener('input', () => this.onInput());

    this.must('#model-select').addEventListener('change', (e) => {
      const id = (e.target as HTMLSelectElement).value;
      void (async () => {
        try {
          await this.sound.setModel(id);
          this.settings.modelId = id;
          this.persistSettings();
          this.showToast(`Машинка: ${this.sound.models.find((m) => m.id === id)?.name ?? id}`);
        } catch (err) {
          this.fillModelSelect();
          this.showToast(toUserMessage(err), true);
          this.openModal('modal-premium');
        }
      })();
    });

    this.must('#font-select').addEventListener('change', (e) => {
      const font = (e.target as HTMLSelectElement).value as FontId;
      this.settings.font = font;
      this.applyFont(font);
      this.persistSettings();
    });

    this.must<HTMLInputElement>('#volume').addEventListener('input', (e) => {
      try {
        const v = Number((e.target as HTMLInputElement).value) / 100;
        this.sound.setVolume(v);
        this.settings.volume = v;
        this.persistSettings();
      } catch (err) {
        this.showToast(toUserMessage(err), true);
      }
    });

    this.must('#btn-mute').addEventListener('click', () => {
      this.settings.muted = !this.settings.muted;
      this.sound.setMuted(this.settings.muted);
      const btn = this.must<HTMLButtonElement>('#btn-mute');
      btn.setAttribute('aria-pressed', String(this.settings.muted));
      btn.textContent = this.settings.muted ? 'Без звука' : 'Звук';
      this.persistSettings();
    });

    this.must('#btn-effects').addEventListener('click', () => {
      this.settings.effects = !this.settings.effects;
      const btn = this.must<HTMLButtonElement>('#btn-effects');
      btn.setAttribute('aria-pressed', String(this.settings.effects));
      btn.classList.toggle('is-active', this.settings.effects);
      this.persistSettings();
      this.showToast(this.settings.effects ? 'Эффекты включены' : 'Эффекты выключены');
    });

    this.must('#file-import').addEventListener('change', (e) => this.onImport(e));
    this.must('#btn-export').addEventListener('click', () => this.onExport());
    this.must('#btn-link').addEventListener('click', () => this.openModal('modal-link'));
    this.must('#btn-premium').addEventListener('click', () => this.openModal('modal-premium'));
    this.must('#btn-stats').addEventListener('click', () => this.openModal('modal-stats'));
    this.must('#btn-themes').addEventListener('click', () => this.openModal('modal-themes'));

    this.must('#btn-pomo-start').addEventListener('click', () => {
      this.pomodoro.start();
      this.showToast('Сессия помодоро началась');
    });
    this.must('#btn-pomo-pause').addEventListener('click', () => {
      this.pomodoro.pause();
      this.showToast('Помодоро на паузе');
    });
    this.must('#btn-pomo-reset').addEventListener('click', () => {
      this.pomodoro.reset();
      this.showToast('Помодоро сброшен');
    });

    this.must('#premium-cancel').addEventListener('click', () => this.closeModal('modal-premium'));
    this.must('#premium-toggle').addEventListener('click', () => this.togglePremium());
    this.must('#link-cancel').addEventListener('click', () => this.closeModal('modal-link'));
    this.must('#link-ok').addEventListener('click', () => this.insertLink());
    this.must('#stats-close').addEventListener('click', () => this.closeModal('modal-stats'));
    this.must('#stats-reset').addEventListener('click', () => {
      this.session.reset(Date.now(), true);
      this.session.recordText(this.editor.value);
      this.refreshSessionUi();
      this.showToast('Статистика сессии сброшена');
    });
    this.must('#themes-close').addEventListener('click', () => this.closeModal('modal-themes'));

    // Закрытие модалок по Escape
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        this.closeModal('modal-premium');
        this.closeModal('modal-link');
        this.closeModal('modal-stats');
        this.closeModal('modal-themes');
      }
    });

    // Разблокировка аудио по первому жесту
    const unlock = () => {
      this.sound.unlock();
      document.removeEventListener('pointerdown', unlock);
      document.removeEventListener('keydown', unlock);
    };
    document.addEventListener('pointerdown', unlock);
    document.addEventListener('keydown', unlock);
  }

  private onKeyDown(e: KeyboardEvent): void {
    if (e.isComposing || e.ctrlKey || e.metaKey || e.altKey) return;
    try {
      this.sound.playForKey(e.key);
      if (this.settings.effects && (e.key.length === 1 || e.key === 'Enter' || e.key === 'Backspace')) {
        const intensity = Math.min(2, 0.6 + this.sound.dynamics.getCpm() / 300);
        applyTypeShake(this.paperStage, intensity);
      }
    } catch (err) {
      logger.warn('Ошибка воспроизведения', err);
    }
  }

  private onInput(): void {
    this.session.recordText(this.editor.value);
    if (this.must('#modal-stats').classList.contains('is-open')) {
      this.refreshSessionUi();
    }
    void this.refreshStats();
    if (this.saveTimer) clearTimeout(this.saveTimer);
    this.saveTimer = setTimeout(() => void this.saveDocument(), 600);
  }

  private async refreshStats(): Promise<void> {
    const s = await this.stats.analyze(this.editor.value);
    this.wordEl.textContent = String(s.words);
    this.charEl.textContent = String(s.chars);
  }

  private async saveDocument(): Promise<void> {
    try {
      await storage.saveDocument({
        id: DOC_ID,
        title: 'Черновик',
        content: this.editor.value,
        updatedAt: Date.now(),
      });
    } catch (err) {
      this.showToast(toUserMessage(err), true);
    }
  }

  private persistSettings(): void {
    try {
      storage.setSetting('settings', this.settings);
    } catch (err) {
      this.showToast(toUserMessage(err), true);
    }
  }

  private applyFont(font: FontId): void {
    this.editor.classList.remove('font-courier', 'font-plex');
    if (font === 'courier') this.editor.classList.add('font-courier');
    if (font === 'plex') this.editor.classList.add('font-plex');
  }

  private async onImport(e: Event): Promise<void> {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    try {
      validateTextFile(file);
      const text = await file.text();
      if (text.includes('\u0000')) {
        throw new Error('Файл повреждён или имеет двоичный формат.');
      }
      this.editor.value = text;
      await this.refreshStats();
      await this.saveDocument();
      this.showToast(`Импортировано: ${file.name}`);
    } catch (err) {
      this.showToast(toUserMessage(err), true);
    }
  }

  private onExport(): void {
    try {
      const text = this.editor.value;
      if (!text.trim()) {
        this.showToast('Нечего экспортировать — текст пуст.', true);
        return;
      }
      const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `черновик-${new Date().toISOString().slice(0, 10)}.txt`;
      a.click();
      URL.revokeObjectURL(url);
      this.showToast('Файл сохранён');
    } catch (err) {
      this.showToast(toUserMessage(err), true);
    }
  }

  private insertLink(): void {
    const input = this.must<HTMLInputElement>('#link-url');
    try {
      const href = validateUrl(input.value);
      const start = this.editor.selectionStart;
      const end = this.editor.selectionEnd;
      const selected = this.editor.value.slice(start, end) || 'ссылка';
      const snippet = `[${selected}](${href})`;
      this.editor.setRangeText(snippet, start, end, 'end');
      input.value = '';
      this.closeModal('modal-link');
      this.editor.focus();
      void this.refreshStats();
      void this.saveDocument();
      this.showToast('Ссылка вставлена');
    } catch (err) {
      this.showToast(toUserMessage(err), true);
    }
  }

  private togglePremium(): void {
    if (this.premium.isActive()) {
      this.premium.unsubscribe();
      const current = this.sound.models.find((m) => m.id === this.settings.modelId);
      if (current?.premium) {
        this.settings.modelId = 'remington';
        void this.sound.setModel('remington');
        this.persistSettings();
      }
      this.sound.setPremium(false);
      this.showToast('Премиум отключён');
    } else {
      this.premium.subscribe();
      this.sound.setPremium(true);
      this.showToast('Премиум активирован на этом устройстве');
    }
    this.fillModelSelect();
    this.updatePremiumBadge();
    this.updatePremiumModalButton();
    this.closeModal('modal-premium');
  }

  private updatePremiumBadge(): void {
    const el = this.must('#stat-premium');
    el.innerHTML = this.premium.isActive()
      ? 'Премиум <span class="badge-premium">активен</span>'
      : 'Премиум: нет';
    this.updatePremiumModalButton();
  }

  private updatePremiumModalButton(): void {
    const btn = this.root.querySelector('#premium-toggle') as HTMLButtonElement | null;
    if (!btn) return;
    btn.textContent = this.premium.isActive() ? 'Отключить' : 'Оформить';
  }

  private applyStoredTheme(): void {
    try {
      const id = this.settings.themeId || 'classic';
      this.themes.apply(id);
    } catch {
      this.themes.apply('classic');
      this.settings.themeId = 'classic';
    }
  }

  private renderThemeGrid(): void {
    const grid = this.must('#theme-grid');
    const current = this.themes.getCurrentId();
    grid.innerHTML = this.themes
      .list()
      .map((t) => {
        const selected = t.id === current;
        return `
          <button
            type="button"
            class="theme-card${selected ? ' is-selected' : ''}"
            role="option"
            aria-selected="${selected}"
            data-theme-id="${t.id}"
            aria-label="Тема: ${t.name}"
          >
            <span class="theme-swatch" style="background:linear-gradient(135deg,${t.vars['--bg-deep']},${t.vars['--paper']})" aria-hidden="true"></span>
            <span class="theme-card-body">
              <strong>${t.name}</strong>
              <span>${t.description}</span>
            </span>
          </button>
        `;
      })
      .join('');

    grid.querySelectorAll<HTMLButtonElement>('[data-theme-id]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.themeId;
        if (!id) return;
        try {
          const theme = this.themes.apply(id);
          this.settings.themeId = theme.id;
          this.persistSettings();
          this.renderThemeGrid();
          this.showToast(`Тема: ${theme.name}`);
        } catch (err) {
          this.showToast(toUserMessage(err), true);
        }
      });
    });
  }

  private refreshSessionUi(): void {
    const snap = this.session.getSnapshot();
    const set = (sel: string, value: string) => {
      const el = this.root.querySelector(sel);
      if (el) el.textContent = value;
    };
    set('#stats-elapsed', WritingSessionStats.formatDuration(snap.elapsedMs));
    set('#stats-active', WritingSessionStats.formatDuration(snap.activeMs));
    set('#stats-wpm', String(snap.wpm));
    set('#stats-cpm', String(snap.cpm));
    set('#stats-chars-typed', String(snap.charsTyped));
    set('#stats-words-now', String(snap.wordsNow));
  }

  private startStatsTicker(): void {
    this.stopStatsTicker();
    this.refreshSessionUi();
    this.statsUiTimer = setInterval(() => this.refreshSessionUi(), 1000);
  }

  private stopStatsTicker(): void {
    if (this.statsUiTimer) {
      clearInterval(this.statsUiTimer);
      this.statsUiTimer = null;
    }
  }

  private openModal(id: string): void {
    const el = this.must(`#${id}`);
    el.hidden = false;
    el.classList.add('is-open');
    if (id === 'modal-premium') this.updatePremiumModalButton();
    if (id === 'modal-link') {
      window.setTimeout(() => this.must<HTMLInputElement>('#link-url').focus(), 50);
    }
    if (id === 'modal-stats') {
      this.session.recordText(this.editor.value);
      this.startStatsTicker();
    }
    if (id === 'modal-themes') {
      this.renderThemeGrid();
    }
  }

  private closeModal(id: string): void {
    const el = this.root.querySelector(`#${id}`);
    if (!el) return;
    el.classList.remove('is-open');
    (el as HTMLElement).hidden = true;
    if (id === 'modal-stats') this.stopStatsTicker();
  }

  private showToast(message: string, isError = false): void {
    this.toastEl.textContent = message;
    this.toastEl.classList.toggle('is-error', isError);
    this.toastEl.classList.add('is-visible');
    if (this.toastTimer) clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => {
      this.toastEl.classList.remove('is-visible');
    }, 3200);
  }

  destroy(): void {
    this.stopStatsTicker();
    this.sound.destroy();
    this.pomodoro.destroy();
    this.stats.destroy();
  }
}
