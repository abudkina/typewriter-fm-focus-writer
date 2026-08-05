import { describe, expect, it, beforeEach } from 'vitest';
import { PremiumService } from '../../src/modules/premium/PremiumService';

describe('PremiumService', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('по умолчанию неактивен', () => {
    const p = new PremiumService();
    expect(p.isActive()).toBe(false);
    expect(p.getPriceLabel()).toContain('2');
  });

  it('активирует и отключает подписку', () => {
    const p = new PremiumService();
    p.subscribe();
    expect(p.isActive()).toBe(true);
    expect(p.getState().activatedAt).toBeTypeOf('number');
    p.unsubscribe();
    expect(p.isActive()).toBe(false);
  });

  it('сохраняет состояние в localStorage', () => {
    const a = new PremiumService();
    a.subscribe();
    const b = new PremiumService();
    expect(b.isActive()).toBe(true);
  });
});
