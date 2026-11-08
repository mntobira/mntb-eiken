/**
 * 公開プロフィールに載せる「記録」を端末から集める（2026-10-26）。
 *   連続学習日数・解いた大問の数・称号の数・身につけている称号・とびら君の見た目。
 *   utils/publicStudyProfile.ts が battle 側に依存しないよう、ここで集めて差し込む
 *   （setPublicProfileStatsProvider）。どれも本人が「公開」にしているときだけ送られる。
 */
import { auth } from '../../firebase';
import { cachedGrowth } from '../../battle/data/growthStore';
import { equippedTitleLabel } from '../../battle/core/growth';
import { readSolvedMap } from '../../utils/progress';
import { streakKey } from '../../utils/userStorageKeys';
import { safeLocalStorage } from '../../utils/safeLocalStorage';
import { setPublicProfileStatsProvider, type PublicProfileStats } from '../../utils/publicStudyProfile';
import { readStudyTime } from '../../utils/studyTime';
import { calDays } from '../../utils/publicProfileCore';
import { readManualLog } from '../studylog/manualLogStore';

export function collectProfileStats(): PublicProfileStats {
  const uid = auth.currentUser?.uid || 'guest';
  const streak = parseInt(safeLocalStorage()?.getItem(streakKey(uid)) || '0', 10);
  const solved = Object.keys(readSolvedMap(uid)).length;
  const growth = cachedGrowth();
  const out: PublicProfileStats = {
    streak: Number.isFinite(streak) && streak > 0 ? streak : 0,
    solved,
  };
  // D6（2026-10-30）：公開したらマイページ全体（カレンダー・きせかえ・称号・マイPDF）を見せるための値
  try {
    const days = calDays();
    const app = readStudyTime(uid).days;
    const idx = new Map(days.map((d, i) => [d, i]));
    const cal = days.map((d) => app[d] ?? 0);
    const subjects: Record<string, number> = {};
    const appSum = cal.reduce((a, b) => a + b, 0);
    if (appSum > 0) subjects.app = appSum;
    for (const r of readManualLog(uid).records) {
      const i = r.deleted ? undefined : idx.get(r.day);
      if (i == null) continue;
      cal[i] += r.minutes * 60;
      subjects[r.subject] = (subjects[r.subject] ?? 0) + r.minutes * 60;
    }
    out.cal = cal;
    out.subjects = subjects;
  } catch { /* 記録が読めなくても公開は止めない */ }
  if (growth) {
    out.owned = growth.owned;
    out.badgeIds = Object.keys(growth.badges || {});
    out.badges = Object.keys(growth.badges || {}).length;
    // 身につけていて、本当に持っている称号だけ
    out.title = equippedTitleLabel(growth) ? growth.equipped.title : '';
    out.look = {
      pose: growth.owned.includes(growth.equipped.pose) ? growth.equipped.pose : '',
      frame: growth.owned.includes(growth.equipped.frame) ? growth.equipped.frame : '',
      hat: growth.equipped.hat && growth.owned.includes(growth.equipped.hat) ? growth.equipped.hat : '',
      glasses: growth.equipped.glasses && growth.owned.includes(growth.equipped.glasses) ? growth.equipped.glasses : '',
    };
  }
  return out;
}

let installed = false;
/** アプリ起動時に1回呼ぶ */
export function installProfileStatsProvider(): void {
  if (installed) return;
  installed = true;
  setPublicProfileStatsProvider(collectProfileStats);
}
