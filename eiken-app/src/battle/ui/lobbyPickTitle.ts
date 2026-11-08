/**
 * F10（2026-11-05）対戦の部屋で「えらんだ単元」を1行の名前にする。
 *   例）英単語・システム英単語 1〜100語 ／ 化学基礎・物質の構成 ／ 英文法・全単元
 * 名前は部屋（battle_lobbies.picks）に保存して相手にも見せるので、80文字以内に収める（ルールの上限）。
 */
import { getChapterIndexOfSubject } from '../../data/chapterIndex.generated';
import { externalChapterTitleOf, externalSubjectOf } from '../../data/externalSubjects';
import { labelOfSubject } from '../../data/subjectLabels';

export function lobbyUnitTitle(subject: string, chapterId?: string | null): string {
  if (!chapterId) return '全単元';
  const vocab = /^vocab:([a-z0-9]+):(\d+):(\d+)$/.exec(chapterId);
  if (vocab) {
    const book = externalChapterTitleOf(subject, vocab[1]) || vocab[1];
    return `${book} ${vocab[2]}〜${vocab[3]}語`;
  }
  // 外部教科（英単語・理科など）は本体の索引に無い。未知の教科で先頭教科の索引を引かないよう先に分ける
  if (externalSubjectOf(subject)) return externalChapterTitleOf(subject, chapterId) || chapterId;
  const entry = getChapterIndexOfSubject(subject).find((c) => c.id === chapterId);
  return entry?.abstractTitle || entry?.realTitle || entry?.title || chapterId;
}

export function lobbyPickTitle(subject: string, chapterId?: string | null): string {
  return `${labelOfSubject(subject)}・${lobbyUnitTitle(subject, chapterId)}`.slice(0, 80);
}
