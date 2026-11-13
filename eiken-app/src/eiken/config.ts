export const EIKEN_APP_ID = 'manatobi-eiken';
export const EIKEN_STORAGE_PREFIX = 'eiken:v1:';
export const EIKEN_GRADES = [
  { id: 'eiken_5', label: '英検5級', shortLabel: '5級', available: true },
  { id: 'eiken_4', label: '英検4級', shortLabel: '4級', available: true },
  { id: 'eiken_3', label: '英検3級', shortLabel: '3級', available: true },
  { id: 'eiken_pre2', label: '英検準2級', shortLabel: '準2級', available: true },
  { id: 'eiken_pre2plus', label: '英検準2級プラス', shortLabel: '準2級プラス', available: true },
  { id: 'eiken_2', label: '英検2級', shortLabel: '2級', available: true },
  { id: 'eiken_pre1', label: '英検準1級', shortLabel: '準1級', available: true },
  { id: 'eiken_1', label: '英検1級', shortLabel: '1級', available: true },
] as const;
export type EikenGrade = typeof EIKEN_GRADES[number]['id'];
export function isEikenGrade(value: unknown): value is EikenGrade {
  return EIKEN_GRADES.some(grade => grade.id === value);
}
export const LEGACY_PROJECT_IDS = ['mntb-listening', 'mntb-4ef06', 'demo-manatobi-listening'];
export function validateEikenTarget(env: Record<string, unknown>) {
  const enabled = env.VITE_EIKEN_ENABLE_CLOUD === 'true';
  const projectId = String(env.VITE_EIKEN_FIREBASE_PROJECT_ID || '').trim();
  if (Object.keys(env).some(key => key.startsWith('VITE_FIREBASE_') && env[key])) throw new Error('旧版のFirebase環境変数は使用できません。VITE_EIKEN_FIREBASE_* に分離してください。');
  if (projectId && (LEGACY_PROJECT_IDS.includes(projectId) || !/^manatobi-eiken(?:-[a-z0-9-]+)?$/.test(projectId))) throw new Error('英検専用の manatobi-eiken または manatobi-eiken-* プロジェクトだけが接続対象です。');
  if (enabled) {
    for (const field of ['API_KEY', 'AUTH_DOMAIN', 'PROJECT_ID', 'STORAGE_BUCKET', 'MESSAGING_SENDER_ID', 'APP_ID']) {
      if (!String(env[`VITE_EIKEN_FIREBASE_${field}`] || '').trim()) throw new Error(`英検版Firebaseの設定が不足しています: ${field}`);
    }
    const domain = String(env.VITE_EIKEN_FIREBASE_AUTH_DOMAIN);
    const bucket = String(env.VITE_EIKEN_FIREBASE_STORAGE_BUCKET);
    if (domain !== `${projectId}.firebaseapp.com`) throw new Error('認証ドメインは英検専用プロジェクトのものを指定してください。');
    if (![`${projectId}.appspot.com`, `${projectId}.firebasestorage.app`].includes(bucket)) throw new Error('Storageバケットが英検版プロジェクトと一致しません。');
  }
  return { enabled, projectId };
}
export function eikenCollection(name: string): string {
  if (!/^[a-z][a-z0-9_]*$/.test(name)) throw new Error('Invalid collection name');
  return name.startsWith('eiken_') ? name : `eiken_${name}`;
}
