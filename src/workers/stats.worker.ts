/**
 * Web Worker: подсчёт статистики текста без блокировки UI.
 */
export interface StatsRequest {
  type: 'analyze';
  text: string;
  requestId: number;
}

export interface StatsResponse {
  type: 'stats';
  requestId: number;
  words: number;
  chars: number;
  charsNoSpaces: number;
  lines: number;
  paragraphs: number;
}

function analyze(text: string): Omit<StatsResponse, 'type' | 'requestId'> {
  const wordsMatch = text.trim() ? text.trim().match(/[\p{L}\p{N}'’\-]+/gu) : null;
  const words = wordsMatch ? wordsMatch.length : 0;
  const chars = text.length;
  const charsNoSpaces = text.replace(/\s/g, '').length;
  const lines = text.length === 0 ? 0 : text.split(/\n/).length;
  const paragraphs = text.trim()
    ? text
        .trim()
        .split(/\n\s*\n/)
        .filter((p) => p.trim()).length
    : 0;
  return { words, chars, charsNoSpaces, lines, paragraphs };
}

self.onmessage = (event: MessageEvent<StatsRequest>) => {
  const data = event.data;
  if (data.type !== 'analyze') return;
  const result = analyze(data.text);
  const response: StatsResponse = {
    type: 'stats',
    requestId: data.requestId,
    ...result,
  };
  self.postMessage(response);
};
