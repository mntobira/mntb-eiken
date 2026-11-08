import { PICTURE_GRID_SPLITS } from '../data/pictureGrid.generated';
import { LISTENING_PICTURE_ASPECT } from '../../data/listeningPictureAspect';
import type { BattleQuestion } from '../core/types';
import './review-picture-grid.css';

/**
 * ★対戦の答え合わせにも絵を出す（2026-10-11 ご要望）★
 *   第1問B・第2問のような「絵を選ぶ」問題は、答えが「②」だけでは何の問題だったか分からない。
 *   問題の 2×2 の絵から4コマを小さく並べ、正解とあなたの答えに印をつける。
 *   画像は問題と同じものを背景の位置で切り出して使い回す（新しい画像は作らない）。
 */
export function pictureCellsOf(question: Pick<BattleQuestion, 'imageUrl' | 'options' | 'format'>): string | null {
  const url = question.imageUrl;
  if (!url || question.options.length !== 4 || question.format === 'kana' || question.format === 'panel') return null;
  if (!PICTURE_GRID_SPLITS[url] && !/^\/listening_(q1b|q2)\//.test(url)) return null;
  return url;
}

export function ReviewPictureGrid({ question, mine }: { question: BattleQuestion; mine?: string }) {
  const url = pictureCellsOf(question);
  if (!url) return null;
  const aspect = LISTENING_PICTURE_ASPECT[url] ?? 1;
  const mineIndex = mine ? question.options.findIndex(o => o.trim() === mine.trim()) : -1;
  return (
    <ol className="rpg" aria-label="選択肢のイラスト" data-review-pictures>
      {question.options.map((opt, i) => {
        const right = i === question.answerIndex;
        const isMine = i === mineIndex;
        return (
          <li key={opt + i} data-tone={right ? 'right' : isMine ? 'wrong' : 'plain'}>
            <span className="rpg-pic" role="img" aria-label={`${opt} のイラスト`}
              style={{ backgroundImage: `url("${url}")`, backgroundPosition: `${(i % 2) * 100}% ${Math.floor(i / 2) * 100}%`, aspectRatio: String(aspect) }} />
            <span className="rpg-mark">{opt}{right ? ' 正解' : isMine ? ' あなた' : ''}</span>
          </li>
        );
      })}
    </ol>
  );
}
