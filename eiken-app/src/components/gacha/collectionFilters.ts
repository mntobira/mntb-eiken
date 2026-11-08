import { gachaRarityOf, type GachaRarity, type ItemDef } from '../../battle/core/growth';

export type CollectionRarityFilter = 'all' | GachaRarity;

/** PDFコレクション内に実在するレアリティを、提供割合と同じ順序で返す。 */
export function availableCollectionRarities(items: readonly ItemDef[]): GachaRarity[] {
  const present = new Set(items.map(gachaRarityOf));
  return (['LR', 'UR', 'SR', 'R', 'N'] as const).filter((rarity) => present.has(rarity));
}

/** 選んだレアリティに合うアイテムだけを返す。 */
export function filterCollectionByRarity(
  items: readonly ItemDef[],
  rarity: CollectionRarityFilter,
): ItemDef[] {
  return rarity === 'all' ? [...items] : items.filter((item) => gachaRarityOf(item) === rarity);
}
