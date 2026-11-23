import { auth, FIREBASE_CONFIGURED, USE_EMULATORS } from '../../firebase';

/** AI 4 の storage.rules 上限と完全一致させる（5MB 以下） */
export const MAX_SPEAKING_AUDIO_BYTES = 5 * 1024 * 1024;

export const ALLOWED_SPEAKING_MIME_PREFIXES = [
  'audio/webm',
  'audio/mp4',
  'audio/aac',
  'audio/x-m4a',
  'audio/mpeg',
  'audio/ogg',
  'audio/wav',
] as const;

export function isAllowedSpeakingMimeType(mimeType: string): boolean {
  const normalized = String(mimeType || '').trim().toLowerCase();
  return ALLOWED_SPEAKING_MIME_PREFIXES.some(prefix => normalized.startsWith(prefix));
}

export function validateSpeakingAudioBlob(blob: { size: number; type: string }): void {
  if (!blob || blob.size <= 0) {
    throw new Error('録音データが空です。マイクに向かって話してから停止してください。');
  }
  if (blob.size > MAX_SPEAKING_AUDIO_BYTES) {
    const mb = (blob.size / (1024 * 1024)).toFixed(2);
    throw new Error(`録音サイズが上限（5MB）を超えています（現在 ${mb}MB）。もう少し短く録音してください。`);
  }
  if (!isAllowedSpeakingMimeType(blob.type)) {
    throw new Error(`未対応の音声形式です（${blob.type || '不明'}）。Chrome または Safari でお試しください。`);
  }
}

function getStorageBaseEndpoint(): { baseUrl: string; bucket: string } {
  const env = import.meta.env;
  const projectId = String(env.VITE_EIKEN_FIREBASE_PROJECT_ID || 'demo-manatobi-eiken').trim();
  const bucket =
    String(env.VITE_EIKEN_FIREBASE_STORAGE_BUCKET || '').trim() ||
    `${projectId}.appspot.com`;
  const baseUrl = USE_EMULATORS
    ? 'http://127.0.0.1:9199/v0'
    : 'https://firebasestorage.googleapis.com/v0';
  return { baseUrl, bucket };
}

async function buildAuthHeaders(extra?: Record<string, string>): Promise<Record<string, string>> {
  const headers: Record<string, string> = { ...(extra ?? {}) };
  const user = auth.currentUser;
  if (user) {
    const token = await user.getIdToken();
    headers.Authorization = `Firebase ${token}`;
  }
  return headers;
}

// ----------------------------------------------------------------------------
// ローカル（デモ／クラウド未接続時）用の IndexedDB + メモリキャッシュ保存層
// ----------------------------------------------------------------------------

const IDB_NAME = 'sugoroku_speaking_audio_v1';
const IDB_STORE = 'blobs';
const memoryAudioStore = new Map<string, Blob>();
const objectUrlCache = new Map<string, string>();

function openAudioIdb(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === 'undefined') return Promise.resolve(null);
  return new Promise(resolve => {
    try {
      const req = indexedDB.open(IDB_NAME, 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(IDB_STORE)) {
          db.createObjectStore(IDB_STORE);
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

async function saveLocalAudioBlob(storagePath: string, blob: Blob): Promise<void> {
  memoryAudioStore.set(storagePath, blob);
  const idb = await openAudioIdb();
  if (!idb) return;
  await new Promise<void>(resolve => {
    try {
      const tx = idb.transaction(IDB_STORE, 'readwrite');
      tx.objectStore(IDB_STORE).put(blob, storagePath);
      tx.oncomplete = () => {
        idb.close();
        resolve();
      };
      tx.onerror = () => {
        idb.close();
        resolve();
      };
    } catch {
      idb.close();
      resolve();
    }
  });
}

async function loadLocalAudioBlob(storagePath: string): Promise<Blob | null> {
  const fromMem = memoryAudioStore.get(storagePath);
  if (fromMem) return fromMem;
  const idb = await openAudioIdb();
  if (!idb) return null;
  return new Promise<Blob | null>(resolve => {
    try {
      const tx = idb.transaction(IDB_STORE, 'readonly');
      const req = tx.objectStore(IDB_STORE).get(storagePath);
      req.onsuccess = () => {
        const found = req.result instanceof Blob ? req.result : null;
        if (found) memoryAudioStore.set(storagePath, found);
        idb.close();
        resolve(found);
      };
      req.onerror = () => {
        idb.close();
        resolve(null);
      };
    } catch {
      idb.close();
      resolve(null);
    }
  });
}

/**
 * 録音 Blob を Firebase Storage（またはローカル IndexedDB）へアップロードする。
 * `firebase/storage` SDK の肥大な型・バンドルを持ち込まず公式 v0 Storage エンドポイントを直接叩くことで、
 * 680MB 省メモリビルド制限を守りつつ `storage.rules`（auth / size <= 5MB / contentType）と100%連携する。
 */
export async function uploadSpeakingAudio(
  storagePath: string,
  blob: Blob,
  mimeType: string,
): Promise<{ storagePath: string; sizeBytes: number; uploadedToCloud: boolean }> {
  const effectiveMime = mimeType || blob.type || 'audio/webm';
  validateSpeakingAudioBlob({ size: blob.size, type: effectiveMime });
  await saveLocalAudioBlob(storagePath, blob);

  if ((FIREBASE_CONFIGURED || USE_EMULATORS) && auth.currentUser) {
    const { baseUrl, bucket } = getStorageBaseEndpoint();
    const url = `${baseUrl}/b/${encodeURIComponent(bucket)}/o?uploadType=media&name=${encodeURIComponent(
      storagePath,
    )}`;
    const headers = await buildAuthHeaders({ 'Content-Type': effectiveMime });
    const res = await fetch(url, {
      method: 'POST',
      headers,
      body: blob,
    });
    if (!res.ok) {
      throw new Error(`音声のクラウド保存に失敗しました（HTTP ${res.status}）。権限または通信状態を確認してください。`);
    }
    return { storagePath, sizeBytes: blob.size, uploadedToCloud: true };
  }

  return { storagePath, sizeBytes: blob.size, uploadedToCloud: false };
}

/**
 * 再生用 URL を解決する。
 * 1) デモサンプルパス（demo://...）はブラウザ内合成 WAV URL を返す
 * 2) ローカルキャッシュに Blob があれば即 Object URL を返す
 * 3) クラウド有効時は Firebase Storage から認証付き取得して Object URL 化する（公開トークン漏洩も防止）
 */
export async function resolveSpeakingAudioUrl(storagePath: string): Promise<string> {
  if (storagePath.startsWith('demo://')) {
    return getDemoSynthesizedAudioUrl(storagePath);
  }
  const cachedUrl = objectUrlCache.get(storagePath);
  if (cachedUrl) return cachedUrl;

  const localBlob = await loadLocalAudioBlob(storagePath);
  if (localBlob && typeof URL !== 'undefined' && typeof URL.createObjectURL === 'function') {
    const url = URL.createObjectURL(localBlob);
    objectUrlCache.set(storagePath, url);
    return url;
  }

  if ((FIREBASE_CONFIGURED || USE_EMULATORS) && auth.currentUser) {
    const { baseUrl, bucket } = getStorageBaseEndpoint();
    const url = `${baseUrl}/b/${encodeURIComponent(bucket)}/o/${encodeURIComponent(
      storagePath,
    )}?alt=media`;
    const headers = await buildAuthHeaders();
    const res = await fetch(url, { method: 'GET', headers });
    if (res.ok) {
      const remoteBlob = await res.blob();
      await saveLocalAudioBlob(storagePath, remoteBlob);
      if (typeof URL !== 'undefined' && typeof URL.createObjectURL === 'function') {
        const objUrl = URL.createObjectURL(remoteBlob);
        objectUrlCache.set(storagePath, objUrl);
        return objUrl;
      }
    }
  }

  throw new Error('音声データが見つかりませんでした（別端末のローカル提出または未同期データの可能性があります）。');
}

function getDemoSynthesizedAudioUrl(seedKey: string): string {
  const existing = objectUrlCache.get(seedKey);
  if (existing) return existing;

  const sampleRate = 16000;
  const durationSec = 2.4;
  const numSamples = Math.floor(sampleRate * durationSec);
  const buffer = new ArrayBuffer(44 + numSamples * 2);
  const view = new DataView(buffer);

  const writeStr = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
  };

  writeStr(0, 'RIFF');
  view.setUint32(4, 36 + numSamples * 2, true);
  writeStr(8, 'WAVE');
  writeStr(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeStr(36, 'data');
  view.setUint32(40, numSamples * 2, true);

  let hash = 0;
  for (let i = 0; i < seedKey.length; i++) hash = (hash * 31 + seedKey.charCodeAt(i)) | 0;
  const baseFreq = 240 + (Math.abs(hash) % 140);

  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    const phraseFreq = t < 0.8 ? baseFreq : t < 1.6 ? baseFreq * 1.25 : baseFreq * 1.5;
    const envelope = Math.sin(Math.min(1, t * 12) * (Math.PI / 2)) * Math.exp(-((t % 0.8) * 1.8));
    const sample = Math.sin(2 * Math.PI * phraseFreq * t) * 0.28 * envelope;
    const int16 = Math.max(-32768, Math.min(32767, Math.round(sample * 32767)));
    view.setInt16(44 + i * 2, int16, true);
  }

  const blob = new Blob([buffer], { type: 'audio/wav' });
  if (typeof URL !== 'undefined' && typeof URL.createObjectURL === 'function') {
    const url = URL.createObjectURL(blob);
    objectUrlCache.set(seedKey, url);
    return url;
  }
  return '';
}
