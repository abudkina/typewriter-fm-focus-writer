import { describe, expect, it } from 'vitest';
import {
  encodeWav,
  makeSoundUrl,
  synthesizeBreath,
  synthesizeKeyClick,
  synthesizePaperFeed,
  synthesizeReturn,
  synthesizeSpace,
} from '../../src/modules/audio/SoundSynthesizer';

const timbre = { basePitch: 1, noiseAmount: 0.3, clickSharpness: 0.8 };

describe('SoundSynthesizer', () => {
  it('генерирует ненулевые сэмплы клавиши', () => {
    const samples = synthesizeKeyClick(timbre);
    expect(samples.length).toBeGreaterThan(100);
    const energy = samples.reduce((a, b) => a + Math.abs(b), 0);
    expect(energy).toBeGreaterThan(0);
  });

  it('генерирует пробел, перевод строки, дыхание и бумагу', () => {
    expect(synthesizeSpace(timbre).length).toBeGreaterThan(50);
    expect(synthesizeReturn(timbre).length).toBeGreaterThan(100);
    expect(synthesizeBreath().length).toBeGreaterThan(100);
    expect(synthesizePaperFeed().length).toBeGreaterThan(100);
  });

  it('кодирует WAV с заголовком RIFF', () => {
    const samples = synthesizeKeyClick(timbre, 8000, 20);
    const wav = encodeWav(samples, 8000);
    const view = new DataView(wav);
    const riff = String.fromCharCode(
      view.getUint8(0),
      view.getUint8(1),
      view.getUint8(2),
      view.getUint8(3)
    );
    expect(riff).toBe('RIFF');
  });

  it('создаёт data-URL', () => {
    const url = makeSoundUrl(synthesizeKeyClick(timbre, 8000, 20), 8000);
    expect(url.startsWith('data:audio/wav;base64,')).toBe(true);
  });
});
