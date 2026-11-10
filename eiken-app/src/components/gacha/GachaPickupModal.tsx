import type { RefObject } from 'react';
import { printOf, gachaRarityOf, type GrowthProgress, type ItemDef } from '../../battle/core/growth';
import { gachaItemRate } from '../../battle/core/arenaEconomy';
import { ItemArt, RarityTag, pct } from '../GachaParts';
import { DEFAULT_GACHA_POOL, gachaPoolOf, type GachaPoolId } from '../../battle/core/gachaPools';
import { featuredWeek } from '../../battle/core/gachaFeatured';
import { weeklyHero, weeklyPickup } from './GachaItemDetail';

/** バナーと同じ実在景品を表示する。存在しない大学受験PDFのプレビューに依存しない。 */
export function pickupItems(items: readonly ItemDef[]): ItemDef[] {
  const week = featuredWeek();
  const hero = weeklyHero(items, week, null);
  return hero ? [hero, ...weeklyPickup(items, week, hero.id)] : [];
}

export function GachaPickupModal({ dialog, items, progress, pool = DEFAULT_GACHA_POOL }: {
  dialog: RefObject<HTMLDialogElement | null>;
  items: readonly ItemDef[];
  progress: GrowthProgress | null;
  pool?: GachaPoolId;
}) {
  const list = pickupItems(items);
  const def = gachaPoolOf(pool);
  return <dialog ref={dialog} className="game-details-dialog mt-dialog" aria-labelledby="gacha-pickup-title" data-gacha-pickup>
    <header><h2 id="gacha-pickup-title">{def.title} ピックアップ</h2>
      <button type="button" autoFocus onClick={() => dialog.current?.close()}>閉じる</button>
    </header>
    <div className="game-details-body gacha-pickup">
      <p className="gacha-pickup-lead">今週の注目の着せ替えです。注目表示による排出率の上昇はありません。割合は通常の1回抽選の値です。</p>
      <p>{def.lrNote}</p>
      {list.map(item => <section key={item.id} className="gacha-pickup-item" data-gacha-pickup-item={item.id}>
        <ItemArt item={item} progress={progress} size={64} />
        <RarityTag rarity={gachaRarityOf(item)} /><strong>{item.label}</strong>
        <p>1種あたり {pct(gachaItemRate(item, 'N', pool))}%{progress?.owned.includes(item.id) ? ' · 所持済み' : ''}</p>
        <p>{printOf(item.id) ? '獲得後は「マイPDF」で開いて保存できます。' : '手に入れたアイテムは「着せ替え」で使えます。'}</p>
      </section>)}
      {!list.length && <p role="status">景品を読み込めませんでした。一度閉じて開き直してください。</p>}
    </div>
  </dialog>;
}
