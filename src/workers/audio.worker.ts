/**
 * Web Worker: синтез WAV печатной машинки вне главного потока.
 */
import {
  makeSoundUrl,
  synthesizeBreath,
  synthesizeKeyClick,
  synthesizePaperFeed,
  synthesizeReturn,
  synthesizeSpace,
  type TypewriterTimbre,
} from '../modules/audio/SoundSynthesizer';

export interface SynthRequest {
  type: 'build-pack';
  requestId: number;
  timbre: TypewriterTimbre;
  includeExtras?: boolean;
}

export interface SynthResponse {
  type: 'pack';
  requestId: number;
  key: string;
  space: string;
  return: string;
  breath?: string;
  paper?: string;
}

self.onmessage = (event: MessageEvent<SynthRequest>) => {
  const msg = event.data;
  if (msg.type !== 'build-pack') return;
  const { timbre } = msg;
  const response: SynthResponse = {
    type: 'pack',
    requestId: msg.requestId,
    key: makeSoundUrl(synthesizeKeyClick(timbre)),
    space: makeSoundUrl(synthesizeSpace(timbre)),
    return: makeSoundUrl(synthesizeReturn(timbre)),
  };
  if (msg.includeExtras) {
    response.breath = makeSoundUrl(synthesizeBreath());
    response.paper = makeSoundUrl(synthesizePaperFeed());
  }
  self.postMessage(response);
};
