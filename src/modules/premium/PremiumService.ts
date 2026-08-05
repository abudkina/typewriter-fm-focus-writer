import { storage } from '../storage/StorageService';
import { logger } from '../../utils/logger';

export interface PremiumState {
  active: boolean;
  activatedAt: number | null;
  /** Локальная «подписка» без бэкенда — демо-режим */
  planLabel: string;
}

const PRICE_LABEL = '2 $/мес';

/**
 * Мок-подписка: хранится в LocalStorage.
 * Реальных платежей нет (no-backend).
 */
export class PremiumService {
  private state: PremiumState;

  constructor() {
    this.state = storage.getSetting<PremiumState>('premium', {
      active: false,
      activatedAt: null,
      planLabel: PRICE_LABEL,
    });
  }

  getState(): PremiumState {
    return { ...this.state };
  }

  isActive(): boolean {
    return this.state.active;
  }

  getPriceLabel(): string {
    return PRICE_LABEL;
  }

  /**
   * «Оформление» подписки локально.
   * Пользователь подтверждает, что понимает: это локальный доступ.
   */
  subscribe(): PremiumState {
    this.state = {
      active: true,
      activatedAt: Date.now(),
      planLabel: PRICE_LABEL,
    };
    storage.setSetting('premium', this.state);
    logger.info('Премиум активирован локально');
    return this.getState();
  }

  unsubscribe(): PremiumState {
    this.state = {
      active: false,
      activatedAt: null,
      planLabel: PRICE_LABEL,
    };
    storage.setSetting('premium', this.state);
    logger.info('Премиум отключён');
    return this.getState();
  }
}
