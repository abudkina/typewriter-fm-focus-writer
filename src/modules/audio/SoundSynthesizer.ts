/**
 * Процедурная генерация звуков печатной машинки через Web Audio API.
 * Создаёт WAV data-URL для воспроизведения через Howler.js.
 */

export interface TypewriterTimbre {
  basePitch: number;
  noiseAmount: number;
  clickSharpness: number;
}

function writeString(view: DataView, offset: number, str: string): void {
  for (let i = 0; i < str.length; i++) {
    view.setUint8(offset + i, str.charCodeAt(i));
  }
}

/** Кодирует PCM-сэмплы в WAV ArrayBuffer */
export function encodeWav(samples: Float32Array, sampleRate: number): ArrayBuffer {
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);
  writeString(view, 0, 'RIFF');
  view.setUint32(4, 36 + samples.length * 2, true);
  writeString(view, 8, 'WAVE');
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeString(view, 36, 'data');
  view.setUint32(40, samples.length * 2, true);

  let offset = 44;
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]!));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
    offset += 2;
  }
  return buffer;
}

export function wavToDataUrl(wav: ArrayBuffer): string {
  const bytes = new Uint8Array(wav);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]!);
  }
  return `data:audio/wav;base64,${btoa(binary)}`;
}

function noise(_n: number): number {
  return Math.random() * 2 - 1;
}

/** Короткий удар клавиши */
export function synthesizeKeyClick(
  timbre: TypewriterTimbre,
  sampleRate = 22050,
  durationMs = 55
): Float32Array {
  const length = Math.floor((sampleRate * durationMs) / 1000);
  const out = new Float32Array(length);
  const freq = 180 * timbre.basePitch + 80 * timbre.clickSharpness;

  for (let i = 0; i < length; i++) {
    const t = i / sampleRate;
    const env = Math.exp(-t * (40 + timbre.clickSharpness * 60));
    const click = Math.sin(2 * Math.PI * freq * t) * (1 - timbre.noiseAmount);
    const n = noise(i) * timbre.noiseAmount;
    // Металлический обертон
    const metal = Math.sin(2 * Math.PI * freq * 3.2 * t) * 0.25 * timbre.clickSharpness;
    out[i] = (click + n + metal) * env * 0.85;
  }
  return out;
}

/** Пробел — более глухой и длинный */
export function synthesizeSpace(
  timbre: TypewriterTimbre,
  sampleRate = 22050
): Float32Array {
  const length = Math.floor(sampleRate * 0.08);
  const out = new Float32Array(length);
  const freq = 90 * timbre.basePitch;
  for (let i = 0; i < length; i++) {
    const t = i / sampleRate;
    const env = Math.exp(-t * 28);
    out[i] = (Math.sin(2 * Math.PI * freq * t) * 0.4 + noise(i) * 0.5) * env;
  }
  return out;
}

/** Рычаг перевода строки */
export function synthesizeReturn(
  timbre: TypewriterTimbre,
  sampleRate = 22050
): Float32Array {
  const length = Math.floor(sampleRate * 0.35);
  const out = new Float32Array(length);
  for (let i = 0; i < length; i++) {
    const t = i / sampleRate;
    const sweep = 400 * timbre.basePitch - t * 600;
    const env = t < 0.05 ? t / 0.05 : Math.exp(-(t - 0.05) * 8);
    const ding = t > 0.22 ? Math.sin(2 * Math.PI * 1200 * (t - 0.22)) * Math.exp(-(t - 0.22) * 40) * 0.5 : 0;
    out[i] = (Math.sin(2 * Math.PI * Math.max(40, sweep) * t) * 0.3 + noise(i) * 0.35 * timbre.noiseAmount + ding) * env;
  }
  return out;
}

/** Белый шум «дыхания» каретки */
export function synthesizeBreath(
  sampleRate = 22050,
  durationMs = 1200
): Float32Array {
  const length = Math.floor((sampleRate * durationMs) / 1000);
  const out = new Float32Array(length);
  for (let i = 0; i < length; i++) {
    const t = i / sampleRate;
    const breathEnv =
      0.5 + 0.5 * Math.sin((2 * Math.PI * t) / (durationMs / 1000));
    // Низкочастотный шум (имитация через сглаживание)
    const n = noise(i) * 0.08 * breathEnv;
    out[i] = n;
  }
  // Простое сглаживание
  for (let i = 1; i < length - 1; i++) {
    out[i] = (out[i - 1]! + out[i]! + out[i + 1]!) / 3;
  }
  return out;
}

/** Звук заправки бумаги */
export function synthesizePaperFeed(sampleRate = 22050): Float32Array {
  const length = Math.floor(sampleRate * 1.2);
  const out = new Float32Array(length);
  for (let i = 0; i < length; i++) {
    const t = i / sampleRate;
    const rustle = noise(i) * (0.15 + 0.1 * Math.sin(t * 12));
    const env = t < 0.1 ? t / 0.1 : t > 1.0 ? Math.max(0, 1 - (t - 1.0) / 0.2) : 1;
    const thud = t > 0.9 && t < 1.0 ? Math.sin(2 * Math.PI * 60 * t) * 0.4 : 0;
    out[i] = (rustle + thud) * env * 0.7;
  }
  return out;
}

export function makeSoundUrl(
  samples: Float32Array,
  sampleRate = 22050
): string {
  return wavToDataUrl(encodeWav(samples, sampleRate));
}
