/**
 * 手動の学習記録の保存（端末 localStorage）。
 *   キー：manual_log_v1_<uid>（ゲストは guest）。
 *   ログイン中は userDataSync が変化に気づいて user_data/{uid}.s_manualLog へ送る（端末をまたいで残る）。
 *   ゲストの記録はログインしたときにアカウントへ移る（migrateGuestData）。
 *
 * 保存に失敗したとき（容量不足など）は例外を投げる。画面は「保存できませんでした」と出し、成功表示はしない。
 */
import { useEffect, useState } from 'react';
import { auth } from '../../firebase';
import { requireLocalStorage, safeLocalStorage, setItemOrThrow } from '../../utils/safeLocalStorage';
import { USER_DATA_SYNCED_EVENT } from '../../utils/userDataSyncEvent';
import { parseStore, prune, type ManualLogStore } from './manualLogCore';
import { perUserKey } from '../../utils/userStorageKeys';

export const manualLogKey = (uid: string | null | undefined) => perUserKey('manual_log_v1_', uid);
const CHANGED = 'manatobi:manual-log-changed';
const currentUid = () => auth.currentUser?.uid || 'guest';

export function readManualLog(uid: string = currentUid()): ManualLogStore {
  try { return parseStore(JSON.parse(safeLocalStorage()?.getItem(manualLogKey(uid)) || 'null')); } catch { return parseStore(null); }
}

/** 書く。失敗したら投げる */
export function writeManualLog(store: ManualLogStore, uid: string = currentUid()): void {
  requireLocalStorage();
  setItemOrThrow(manualLogKey(uid), JSON.stringify(prune(store)));
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent(CHANGED));
}

/** 読んで、変えて、書く（書けなければ投げる）。書いた後の値を返す */
export function updateManualLog(change: (s: ManualLogStore) => ManualLogStore, uid: string = currentUid()): ManualLogStore {
  const next = change(readManualLog(uid));
  writeManualLog(next, uid);
  return next;
}

/** 画面用：記録が変わったら（この画面・ほかの端末からの同期・アカウント切替）読み直す */
export function useManualLog(): [ManualLogStore, string] {
  const [uid, setUid] = useState(currentUid);
  const [store, setStore] = useState(() => readManualLog(uid));
  useEffect(() => {
    const reload = () => { const u = currentUid(); setUid(u); setStore(readManualLog(u)); };
    const offAuth = auth.onAuthStateChanged ? auth.onAuthStateChanged(reload) : () => {};
    window.addEventListener(CHANGED, reload);
    window.addEventListener(USER_DATA_SYNCED_EVENT, reload);
    window.addEventListener('storage', reload);
    return () => { offAuth(); window.removeEventListener(CHANGED, reload); window.removeEventListener(USER_DATA_SYNCED_EVENT, reload); window.removeEventListener('storage', reload); };
  }, []);
  return [store, uid];
}
