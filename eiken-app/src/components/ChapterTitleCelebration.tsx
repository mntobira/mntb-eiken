/**
 * 章の称号ゲットのお祝い（C12・2026-10-29 ご要望「第1章 時制が満点取れたら称号ゲットみたいな感じを画面全体に出す」）。
 *
 * どの画面にいても、章の称号を手に入れた瞬間に画面全体へ出す。
 *   ・暗い背景＋光の輪＋紙ふぶき＋「称号ゲット！」のスタンプ＋称号名
 *   ・「称号をつける」でその場でプロフィールの称号にできる／「とじる」で閉じる
 * ミッション達成の演出（MissionToast）と同じ部品（mission-clear.css）を使い、色合いをそろえる。
 * 動きを減らす設定では光と紙ふぶきを止める（CSS 側）。通信はしない。
 */
import React, { useEffect, useState } from 'react';
import { Award, Check } from 'lucide-react';
import { equipBadgeTitle, subscribeChapterTitle, type ChapterTitleAnnouncement } from '../battle/data/growthStore';
import { play } from '../battle/ui/feedback';
import './mission-clear.css';
import './chapter-title-celebration.css';

export function ChapterTitleCelebration() {
  const [current, setCurrent] = useState<ChapterTitleAnnouncement | null>(null);
  const [equipped, setEquipped] = useState(false);

  useEffect(() => subscribeChapterTitle((a) => {
    setEquipped(false);
    setCurrent(a);
    try { play('levelup', true); } catch { /* 音が出せなくてもお祝いは出す */ }
  }), []);

  if (!current) return null;

  const equip = async () => {
    const next = await equipBadgeTitle(current.badgeId);
    if (next) setEquipped(true);
  };

  return (
    <div className="mission-clear chapter-title-celebration" role="dialog" aria-modal="true" aria-label={`称号ゲット：${current.label}`} data-chapter-title-celebration>
      <div className="mission-clear-rays" aria-hidden="true" />
      <div className="mission-clear-confetti" aria-hidden="true">
        {Array.from({ length: 18 }, (_, i) => <i key={i} style={{ '--i': i } as React.CSSProperties} />)}
      </div>
      <section className="mission-clear-card chapter-title-card">
        <p className="mission-clear-stamp chapter-title-stamp">称号ゲット！</p>
        <p className="chapter-title-chapter">{current.chapterTitle}　全部の回で満点</p>
        <p className="chapter-title-name"><Award size={22} aria-hidden="true" />{current.label}</p>
        <div className="chapter-title-actions">
          <button type="button" className="chapter-title-equip" onClick={equip} disabled={equipped} data-chapter-title-equip>
            {equipped ? <><Check size={16} aria-hidden="true" />称号をつけました</> : '称号をつける'}
          </button>
          <button type="button" className="chapter-title-close" onClick={() => setCurrent(null)} data-chapter-title-close>とじる</button>
        </div>
      </section>
    </div>
  );
}
