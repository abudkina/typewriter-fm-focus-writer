import themesData from '../../data/themes.json';
import { AppError } from '../../utils/errors';
import { logger } from '../../utils/logger';

export interface ThemeVars {
  '--bg-deep': string;
  '--bg-panel': string;
  '--paper': string;
  '--paper-edge': string;
  '--ink': string;
  '--accent': string;
  '--accent-hot': string;
  '--border': string;
}

export interface ThemeDefinition {
  id: string;
  name: string;
  description: string;
  vars: ThemeVars;
}

/**
 * Библиотека тем оформления (CSS-переменные на :root).
 */
export class ThemeService {
  readonly themes: ThemeDefinition[] = themesData as ThemeDefinition[];
  private currentId = 'classic';

  list(): ThemeDefinition[] {
    return this.themes;
  }

  getCurrentId(): string {
    return this.currentId;
  }

  getById(id: string): ThemeDefinition | undefined {
    return this.themes.find((t) => t.id === id);
  }

  apply(id: string, root: HTMLElement = document.documentElement): ThemeDefinition {
    const theme = this.getById(id);
    if (!theme) {
      throw new AppError('THEME_UNKNOWN', 'Неизвестная тема оформления.');
    }
    for (const [key, value] of Object.entries(theme.vars)) {
      root.style.setProperty(key, value);
    }
    root.dataset.theme = theme.id;
    this.currentId = theme.id;
    logger.info('Тема применена', { id: theme.id });
    return theme;
  }
}
