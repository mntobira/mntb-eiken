import { ArrowRight, ChevronLeft, Headphones, Swords } from 'lucide-react';
import type { SubjectId } from '../data/subjectLabels';
import { getSubjectStats } from '../data/chapterIndex.generated';
import { EIKEN_GRADES } from '../eiken/config';
import { isSubjectEnabled } from '../config/features';
import './listening-home.css';
import { KineticText } from '../motion';

export interface ListeningSubjectSelectionProps {
  onSelectSubject: (subject: SubjectId) => void;
  currentSubject?: SubjectId;
  backLabel?: string;
  isGuest: boolean;
  onBack?: () => void;
  onBattle?: () => void;
}

/** リスニング版のカード・余白・戻る操作を維持し、選択肢だけを英検の級にする。 */
export function ListeningSubjectSelection({ onSelectSubject, currentSubject, onBack, onBattle, backLabel = 'ホームに戻る' }: ListeningSubjectSelectionProps) {
  return <main className="listening-home ls-subjects" data-eiken-grades>
    <div className="lh-container">
      <header className="lh-header">
        {onBack ? <button className="ls-subjects-back" onClick={onBack} aria-label={backLabel}><ChevronLeft size={18} />{backLabel}</button> : <span />}
        <div className="lh-brand"><img src="/brand/manatobi-logo.webp" alt="マナトビ" width={1008} height={321} /></div>
      </header>
      <section className="ls-subjects-title">
        <p className="lh-eyebrow">なにを学ぶ？</p>
        <h1><KineticText text="英検の級を選択" step={55} variant="wave" /></h1>
        <p>目標の級を選び、読む・聞く・語彙文法を練習しよう。</p>
      </section>
      <section className="ls-grade-grid" aria-label="英検の級">
        {EIKEN_GRADES.map(grade => {
          const enabled = isSubjectEnabled(grade.id);
          const stats = getSubjectStats(grade.id);
          return <button type="button" key={grade.id} className="ls-subject-main" data-eiken-grade={grade.id}
            aria-current={currentSubject === grade.id ? 'true' : undefined} disabled={!enabled}
            onClick={() => { if (enabled) onSelectSubject(grade.id); }}>
            <span className="lh-main-icon"><Headphones size={28} aria-hidden="true" /></span>
            <span><strong>{grade.label}</strong><span>{enabled ? `${stats.chapters}単元・${stats.marks}問（第1〜6回分野別＋基礎）` : '教材準備中'}</span></span>
            <ArrowRight size={22} aria-hidden="true" />
          </button>;
        })}
      </section>
      {onBattle && <button className="ls-foundation-battle" onClick={onBattle}>
        <Swords size={22} aria-hidden="true" /><span><strong>対戦で固める</strong><small>対戦のメニューを開く</small></span><ArrowRight size={18} aria-hidden="true" />
      </button>}
      <p className="ls-subjects-note">各級の重点練習です。本試験1回分ではありません。進捗と復習は級ごとに保存されます。</p>
    </div>
  </main>;
}
