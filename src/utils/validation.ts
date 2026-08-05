import { AppError } from './errors';

/** Максимальный размер текстового файла: 2 МБ */
export const MAX_TEXT_FILE_SIZE = 2 * 1024 * 1024;

/** Допустимые расширения для импорта */
export const ALLOWED_TEXT_EXTENSIONS = ['.txt', '.md', '.markdown', '.text'] as const;

/**
 * Проверяет, что строка — валидный абсолютный URL (http/https).
 */
export function validateUrl(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) {
    throw new AppError('URL_EMPTY', 'Укажите адрес ссылки.');
  }
  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    throw new AppError('URL_INVALID', 'Некорректный адрес. Пример: https://example.com');
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new AppError('URL_PROTOCOL', 'Разрешены только ссылки http и https.');
  }
  return parsed.href;
}

/**
 * Проверяет файл перед импортом текста.
 */
export function validateTextFile(file: File): void {
  if (!file) {
    throw new AppError('FILE_MISSING', 'Файл не выбран.');
  }
  if (file.size === 0) {
    throw new AppError('FILE_EMPTY', 'Файл пуст. Выберите другой файл.');
  }
  if (file.size > MAX_TEXT_FILE_SIZE) {
    throw new AppError(
      'FILE_TOO_LARGE',
      `Файл слишком большой (макс. ${Math.round(MAX_TEXT_FILE_SIZE / 1024 / 1024)} МБ).`
    );
  }
  const name = file.name.toLowerCase();
  const okExt = ALLOWED_TEXT_EXTENSIONS.some((ext) => name.endsWith(ext));
  const okMime =
    !file.type ||
    file.type.startsWith('text/') ||
    file.type === 'application/octet-stream' ||
    file.type === 'application/markdown';
  if (!okExt && !okMime) {
    throw new AppError(
      'FILE_FORMAT',
      'Неподдерживаемый формат. Допустимы: .txt, .md, .markdown, .text'
    );
  }
}

/**
 * Ограничивает громкость диапазоном 0–1.
 */
export function clampVolume(value: number): number {
  if (Number.isNaN(value) || !Number.isFinite(value)) {
    throw new AppError('VOLUME_INVALID', 'Громкость должна быть числом от 0 до 100%.');
  }
  return Math.min(1, Math.max(0, value));
}

/**
 * Проверяет длительность помодоро в минутах.
 */
export function validatePomodoroMinutes(minutes: number): number {
  if (!Number.isFinite(minutes) || minutes < 1 || minutes > 120) {
    throw new AppError(
      'POMODORO_INVALID',
      'Длительность сессии должна быть от 1 до 120 минут.'
    );
  }
  return Math.floor(minutes);
}

/**
 * Подсчёт слов в тексте (кириллица и латиница).
 */
export function countWords(text: string): number {
  if (!text || !text.trim()) return 0;
  const matches = text.trim().match(/[\p{L}\p{N}'’\-]+/gu);
  return matches ? matches.length : 0;
}

/**
 * Подсчёт символов без учёта пробелов по краям.
 */
export function countChars(text: string): number {
  return text.length;
}
