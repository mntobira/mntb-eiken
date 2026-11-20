import type { SugorokuSpeakingAudioExt } from '../shared/types';

export interface SelectedAudioFormat {
  mimeType: string;
  extension: SugorokuSpeakingAudioExt;
  label: string;
}

export const PREFERRED_AUDIO_CANDIDATES: readonly SelectedAudioFormat[] = [
  { mimeType: 'audio/webm;codecs=opus', extension: 'webm', label: 'WebM (Opus)' },
  { mimeType: 'audio/webm', extension: 'webm', label: 'WebM' },
  { mimeType: 'audio/mp4;codecs=mp4a.40.2', extension: 'm4a', label: 'MP4 / M4A (AAC)' },
  { mimeType: 'audio/mp4', extension: 'm4a', label: 'MP4 / M4A' },
  { mimeType: 'audio/aac', extension: 'm4a', label: 'AAC (M4A)' },
];

export function detectPreferredAudioMimeType(
  isTypeSupported?: (mime: string) => boolean,
  userAgent?: string,
): SelectedAudioFormat {
  const check =
    isTypeSupported ??
    (typeof MediaRecorder !== 'undefined' && typeof MediaRecorder.isTypeSupported === 'function'
      ? (m: string) => MediaRecorder.isTypeSupported(m)
      : undefined);

  const ua =
    userAgent ?? (typeof navigator !== 'undefined' ? navigator.userAgent : '');
  const isAppleTouchOrSafari =
    /iPad|iPhone|iPod/i.test(ua) ||
    (/Safari/i.test(ua) && !/Chrome|Chromium|CriOS|Edg|Firefox/i.test(ua));

  const ordered = isAppleTouchOrSafari
    ? [
        ...PREFERRED_AUDIO_CANDIDATES.filter(c => c.extension === 'm4a'),
        ...PREFERRED_AUDIO_CANDIDATES.filter(c => c.extension === 'webm'),
      ]
    : PREFERRED_AUDIO_CANDIDATES;

  if (check) {
    for (const candidate of ordered) {
      try {
        if (check(candidate.mimeType)) {
          return candidate;
        }
      } catch {
        // continue
      }
    }
  }

  return isAppleTouchOrSafari
    ? { mimeType: 'audio/mp4', extension: 'm4a', label: 'MP4 / M4A (既定)' }
    : { mimeType: 'audio/webm', extension: 'webm', label: 'WebM (既定)' };
}

export type MicErrorCode =
  | 'unsupported'
  | 'insecure_context'
  | 'permission_denied'
  | 'device_not_found'
  | 'device_busy'
  | 'unknown';

export interface FriendlyMicError {
  code: MicErrorCode;
  title: string;
  guidance: string;
}

export function classifyMediaError(error: unknown): FriendlyMicError {
  if (typeof window !== 'undefined' && window.isSecureContext === false) {
    return {
      code: 'insecure_context',
      title: '安全な接続（HTTPS）が必要です',
      guidance:
        'マイク録音は https:// または localhost のみで動作します。公式URLから開き直してください。',
    };
  }
  if (
    typeof navigator === 'undefined' ||
    !navigator.mediaDevices?.getUserMedia ||
    typeof MediaRecorder === 'undefined'
  ) {
    return {
      code: 'unsupported',
      title: 'このブラウザは録音機能に対応していません',
      guidance:
        'iPad / iPhone の場合は標準の「Safari」、PC / Android の場合は「Google Chrome」の最新版で開いてください（LINE内ブラウザからは右上メニューで「ブラウザで開く」を選んでください）。',
    };
  }

  const name =
    error && typeof error === 'object' && 'name' in error
      ? String((error as { name?: unknown }).name || '')
      : '';
  const msg = error instanceof Error ? error.message : String(error ?? '');

  if (
    name === 'NotAllowedError' ||
    name === 'PermissionDeniedError' ||
    name === 'SecurityError' ||
    /permission|not allowed|denied/i.test(msg)
  ) {
    return {
      code: 'permission_denied',
      title: 'マイクの使用が許可されていません',
      guidance:
        'アドレスバー左側の「ぁあ」または鍵アイコン →「Webサイトの設定」→「マイク」を【許可】に変更し、ページを再読み込みしてください。',
    };
  }

  if (
    name === 'NotFoundError' ||
    name === 'DevicesNotFoundError' ||
    /not found|requested device/i.test(msg)
  ) {
    return {
      code: 'device_not_found',
      title: 'マイクが見つかりません',
      guidance:
        'イヤホンマイクやヘッドセットが正しく接続されているか、端末の設定で入力マイクが有効になっているか確認してください。',
    };
  }

  if (
    name === 'NotReadableError' ||
    name === 'TrackStartError' ||
    name === 'AbortError' ||
    /in use|not readable|could not start/i.test(msg)
  ) {
    return {
      code: 'device_busy',
      title: 'マイクが他のアプリで使用中です',
      guidance:
        'Zoom・LINE通話など他のアプリや別タブの録音画面がマイクを使っている場合は一度閉じてから、もう一度「マイクを確認」を押してください。',
    };
  }

  return {
    code: 'unknown',
    title: 'マイクの起動に失敗しました',
    guidance: `端末のマイク設定を確認のうえ、もう一度お試しください。（詳細: ${name || msg || '不明なエラー'}）`,
  };
}

/**
 * 100ms 間隔の音量レベル配列（0..100）から「発話率(%)」と「最長連続無音秒数」を純粋計算する。
 * 単体テスト可能・S-CBT 特有の「沈黙フリーズ」客観評価に用いる。
 */
export function computeVoiceActivityMetrics(
  levelSamples: readonly number[],
  sampleIntervalMs = 100,
  activeThreshold = 8,
): { speechRatio: number; maxSilenceSec: number } {
  if (levelSamples.length === 0) {
    return { speechRatio: 0, maxSilenceSec: 0 };
  }
  let activeFrames = 0;
  let currentSilentFrames = 0;
  let maxSilentFrames = 0;
  for (const lvl of levelSamples) {
    if (lvl >= activeThreshold) {
      activeFrames++;
      currentSilentFrames = 0;
    } else {
      currentSilentFrames++;
      if (currentSilentFrames > maxSilentFrames) {
        maxSilentFrames = currentSilentFrames;
      }
    }
  }
  const speechRatio = Math.round((activeFrames / levelSamples.length) * 100);
  const maxSilenceSec =
    Math.round(((maxSilentFrames * sampleIntervalMs) / 1000) * 10) / 10;
  return { speechRatio, maxSilenceSec };
}

export interface RecordedClip {
  blob: Blob;
  objectUrl: string;
  mimeType: string;
  extension: SugorokuSpeakingAudioExt;
  durationSec: number;
  sizeBytes: number;
  /** 有効発話フレーム率（0〜100%） */
  speechRatio?: number;
  /** 録音中の最長連続無音秒数 */
  maxSilenceSec?: number;
  /** ブラウザ標準 SpeechRecognition による英語自動書き起こし（API課金ゼロ） */
  transcript?: string;
}

export interface ActiveRecordingHandle {
  stop: () => Promise<RecordedClip>;
  cancel: () => void;
  getLevel: () => number;
  getTranscript: () => string;
}

interface MinimalSpeechRecognition {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((event: {
    resultIndex: number;
    results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }>;
  }) => void) | null;
  onerror: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
}

function startOptionalBrowserSpeechRecognition(): {
  getText: () => string;
  stop: () => void;
} {
  if (typeof window === 'undefined') {
    return { getText: () => '', stop: () => undefined };
  }
  const w = window as unknown as {
    SpeechRecognition?: new () => MinimalSpeechRecognition;
    webkitSpeechRecognition?: new () => MinimalSpeechRecognition;
  };
  const Ctor = w.SpeechRecognition || w.webkitSpeechRecognition;
  if (!Ctor) {
    return { getText: () => '', stop: () => undefined };
  }

  let finalized = '';
  let interim = '';
  let rec: MinimalSpeechRecognition | null = null;
  try {
    rec = new Ctor();
    rec.lang = 'en-US';
    rec.continuous = true;
    rec.interimResults = true;
    rec.onresult = ev => {
      let nextInterim = '';
      for (let i = ev.resultIndex; i < ev.results.length; i++) {
        const res = ev.results[i];
        const piece = String(res?.[0]?.transcript ?? '').trim();
        if (!piece) continue;
        if (res.isFinal) {
          finalized = finalized ? `${finalized} ${piece}` : piece;
        } else {
          nextInterim = nextInterim ? `${nextInterim} ${piece}` : piece;
        }
      }
      interim = nextInterim;
    };
    rec.onerror = () => undefined;
    rec.start();
  } catch {
    rec = null;
  }

  return {
    getText: () => [finalized, interim].filter(Boolean).join(' ').replace(/\s+/g, ' ').trim(),
    stop: () => {
      if (!rec) return;
      try {
        rec.stop();
      } catch {
        // ignore
      }
      rec = null;
    },
  };
}

export async function startAudioRecording(): Promise<ActiveRecordingHandle> {
  const format = detectPreferredAudioMimeType();
  let stream: MediaStream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        channelCount: 1,
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
    });
  } catch (err) {
    const friendly = classifyMediaError(err);
    const wrapped = new Error(`${friendly.title}：${friendly.guidance}`);
    (wrapped as Error & { friendly?: FriendlyMicError }).friendly = friendly;
    throw wrapped;
  }

  let audioCtx: AudioContext | null = null;
  let analyser: AnalyserNode | null = null;
  let dataArray: Uint8Array<ArrayBuffer> | null = null;
  try {
    const Ctx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (Ctx) {
      audioCtx = new Ctx();
      const source = audioCtx.createMediaStreamSource(stream);
      analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      dataArray = new Uint8Array(new ArrayBuffer(analyser.frequencyBinCount));
    }
  } catch {
    analyser = null;
  }

  let recorder: MediaRecorder;
  try {
    recorder = new MediaRecorder(stream, {
      mimeType: format.mimeType,
      audioBitsPerSecond: 32_000,
    });
  } catch {
    recorder = new MediaRecorder(stream);
  }

  const speechRec = startOptionalBrowserSpeechRecognition();
  const levelSamples: number[] = [];

  const readCurrentRmsLevel = (): number => {
    if (!analyser || !dataArray) return 0;
    analyser.getByteTimeDomainData(dataArray);
    let sumSq = 0;
    for (let i = 0; i < dataArray.length; i++) {
      const centered = (dataArray[i] - 128) / 128;
      sumSq += centered * centered;
    }
    const rms = Math.sqrt(sumSq / dataArray.length);
    return Math.min(100, Math.round(rms * 320));
  };

  const sampleTimer = setInterval(() => {
    levelSamples.push(readCurrentRmsLevel());
  }, 100);

  const chunks: BlobPart[] = [];
  const startedAt = Date.now();
  recorder.ondataavailable = event => {
    if (event.data && event.data.size > 0) {
      chunks.push(event.data);
    }
  };

  const cleanupResources = () => {
    clearInterval(sampleTimer);
    speechRec.stop();
    stream.getTracks().forEach(track => {
      try {
        track.stop();
      } catch {
        // ignore
      }
    });
    if (audioCtx && audioCtx.state !== 'closed') {
      void audioCtx.close().catch(() => undefined);
    }
  };

  recorder.start(250);

  return {
    getLevel(): number {
      return readCurrentRmsLevel();
    },
    getTranscript(): string {
      return speechRec.getText();
    },
    cancel(): void {
      try {
        if (recorder.state !== 'inactive') recorder.stop();
      } catch {
        // ignore
      }
      cleanupResources();
    },
    stop(): Promise<RecordedClip> {
      return new Promise((resolve, reject) => {
        const finalize = () => {
          const finalTranscript = speechRec.getText();
          cleanupResources();
          const actualMime =
            recorder.mimeType || format.mimeType || 'audio/webm';
          const ext: SugorokuSpeakingAudioExt =
            actualMime.includes('mp4') ||
            actualMime.includes('aac') ||
            actualMime.includes('m4a')
              ? 'm4a'
              : format.extension;
          const blob = new Blob(chunks, { type: actualMime });
          const durationSec = Math.max(
            1,
            Math.round(((Date.now() - startedAt) / 1000) * 10) / 10,
          );
          if (blob.size === 0) {
            reject(
              new Error(
                '音声データが記録されませんでした。マイク設定を確認してもう一度録音してください。',
              ),
            );
            return;
          }
          const objectUrl =
            typeof URL !== 'undefined' && typeof URL.createObjectURL === 'function'
              ? URL.createObjectURL(blob)
              : '';
          const metrics =
            analyser !== null && levelSamples.length > 0
              ? computeVoiceActivityMetrics(levelSamples, 100, 8)
              : { speechRatio: undefined, maxSilenceSec: undefined };
          resolve({
            blob,
            objectUrl,
            mimeType: actualMime,
            extension: ext,
            durationSec,
            sizeBytes: blob.size,
            speechRatio: metrics.speechRatio,
            maxSilenceSec: metrics.maxSilenceSec,
            transcript: finalTranscript || undefined,
          });
        };

        if (recorder.state === 'inactive') {
          finalize();
          return;
        }
        recorder.onstop = finalize;
        recorder.onerror = () => {
          cleanupResources();
          reject(new Error('録音中にエラーが発生しました。'));
        };
        try {
          recorder.stop();
        } catch (err) {
          cleanupResources();
          reject(err instanceof Error ? err : new Error('録音の停止に失敗しました。'));
        }
      });
    },
  };
}
