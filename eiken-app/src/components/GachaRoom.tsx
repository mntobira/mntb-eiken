import { useEffect, useMemo, useRef, useState } from 'react';
import { Gift, Coins, ArrowLeft, PlayCircle } from 'lucide-react';
import { RewardVideo } from './RewardVideo';
import { rewardedAdAvailable, preloadRewardedAd, showRewardedAd } from '../ads/rewardedAd';
import { GachaReveal } from './GachaReveal';
import { DEFAULT_GACHA_POOL, GACHA_POOLS, gachaPoolOf, type GachaPoolId } from '../battle/core/gachaPools';
import './gacha.css';
import { useGrowthProgress } from '../hooks/useGrowthProgress';
import {
  VIDEO_GACHA_DAILY_LIMIT,
  GACHA_COST,
  GACHA_MULTI_COST,
  gachaItems,
  gachaItemsByRarity,
} from '../battle/core/arenaEconomy';
import {
  completedVideoToken,
  drawVideoGacha,
  videoGachaPlaysLeft,
  drawGacha,
  drawGachaMulti,
  GACHA_MULTI_COUNT,
} from '../battle/data/growthStore';
import { type ItemDef, type GachaRarity } from '../battle/core/growth';
import { primeAudio } from '../battle/ui/feedback';
import { bestOf } from './GachaParts';
import { trackEvent } from '../utils/analytics';
import { safeGetItem, safeLocalStorage } from '../utils/safeLocalStorage';
import { GachaMultiResult, GachaSingleResult, type GachaDrawResult } from './gacha/GachaResultStage';
import { GachaCollectionModal } from './gacha/GachaCollectionModal';
import { GachaItemDetail } from './gacha/GachaItemDetail';
import { GachaPoolCarousel } from './gacha/GachaPoolCarousel';
import { GachaPickupModal } from './gacha/GachaPickupModal';

type GachaProps = {
  onBack: () => void;
  onMissions: () => void;
  embedded?: boolean;
};

// GachaDrawResult は gacha/GachaResultStage.tsx へ移した（結果表示と同じ所に置く）

export function GachaRoom(props: GachaProps) {
  const { uid } = useGrowthProgress();
  return <GachaRoomContent key={uid} owner={uid} {...props} />;
}

function GachaRoomContent({
  onBack,
  onMissions,
  owner,
  embedded = false,
}: GachaProps & { owner: string; key?: string }) {
  const { progress } = useGrowthProgress();
  const lock = useRef(false);
  const [busy, setBusy] = useState(false);
  const oddsDialog = useRef<HTMLDialogElement>(null);
  const detailDialog = useRef<HTMLDialogElement>(null);
  const [detailItem, setDetailItem] = useState<ItemDef | null>(null);
  const pickupDialog = useRef<HTMLDialogElement>(null);
  // ★2026-10-29 ガチャの種類（共通テスト／2次試験）。左右スワイプで切り替え、最後に見ていたものを覚えておく★
  const [pool, setPoolState] = useState<GachaPoolId>(readPool);
  const setPool = (next: GachaPoolId) => { setPoolState(next); writePool(next); };
  const poolDef = gachaPoolOf(pool);
  const openDetail = (item: ItemDef, from: GachaPoolId = pool) => { if (from !== pool) setPool(from); setDetailItem(item); requestAnimationFrame(() => detailDialog.current?.showModal()); };

  const items = useMemo(() => gachaItems(pool), [pool]);
  const tiers = useMemo(() => gachaItemsByRarity(pool), [pool]);
  const ownedCount = items.filter((item) => progress?.owned.includes(item.id)).length;

  const [confirm, setConfirm] = useState(false);
  const [error, setError] = useState('');
  const [revealing, setRevealing] = useState(false);
  const [revealKey, setRevealKey] = useState(0);
  const [result, setResult] = useState<GachaDrawResult | null>(null);
  const [multi, setMulti] = useState<GachaDrawResult[] | null>(null);
  const bestRarity: GachaRarity | null = result ? result.rarity : multi ? bestOf(multi) : null;

  const [confirmMulti, setConfirmMulti] = useState(false);
  const multiCost = GACHA_MULTI_COST;
  const [videoOpen, setVideoOpen] = useState(false);
  const [freeResult, setFreeResult] = useState(false);
  const videoLeft = videoGachaPlaysLeft();

  /*
   * ★「動画で1回」＝ アプリ公開後はリワード広告（2026-10-05）★
   *   広告が使えるとき（src/ads/adConfig.ts で ON・SDK 登録済み）は広告を見せ、最後まで見たら1回引く。
   *   使えないとき（今の Web 版・広告の在庫切れ・読み込み失敗）は、これまでどおりアプリ内の応援動画を出す。
   *   どちらでも「途中で閉じたら回数を消費しない」「1日5回まで」は同じ。抽選は drawVideoGacha 1か所。
   */
  const adMode = rewardedAdAvailable();
  useEffect(() => {
    preloadRewardedAd();
  }, []);

  const drawFree = async (token: object) => {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    try {
      const r = await drawVideoGacha(token, owner, pool);
      if (!r?.result) {
        setError('今日の上限に達したか、保存できませんでした。');
        return;
      }
      setFreeResult(true);
      setMulti(null);
      setResult(r.result);
      setRevealKey((k) => k + 1);
      setRevealing(true);
    } finally {
      lock.current = false;
      setBusy(false);
    }
  };

  const startFree = async () => {
    setError('');
    if (!adMode) {
      setVideoOpen(true);
      return;
    }
    setBusy(true);
    const r = await showRewardedAd();
    setBusy(false);
    if (r.status === 'rewarded') {
      await drawFree(completedVideoToken());
      return;
    }
    if (r.status === 'dismissed') {
      setError('最後まで見ると1回引けます。回数は消費していません。');
      return;
    }
    setVideoOpen(true); // 広告が出せないときは応援動画で代わりに
  };

  const drawMulti = async () => {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError('');
    setFreeResult(false);
    setConfirmMulti(false);
    primeAudio();
    try {
      const r = await drawGachaMulti(crypto.randomUUID(), owner, pool);
      if (r) trackEvent(pool === 'niji' ? 'gacha_draw11_niji' : 'gacha_draw11');
      if (!r?.results) {
        setError('抽選できませんでした。残高や保存設定を確認してください。');
        return;
      }
      setResult(null);
      setMulti(r.results);
      setRevealKey((k) => k + 1);
      setRevealing(true);
    } catch {
      setError('抽選できませんでした。再度お試しください。');
    } finally {
      lock.current = false;
      setBusy(false);
    }
  };

  const draw = async () => {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError('');
    setFreeResult(false);
    setConfirm(false);
    primeAudio();
    try {
      const r = await drawGacha(crypto.randomUUID(), owner, pool);
      if (r) trackEvent(pool === 'niji' ? 'gacha_draw_niji' : 'gacha_draw');
      if (!r?.result) {
        setError('抽選できませんでした。残高や保存設定を確認してください。');
        return;
      }
      setMulti(null);
      setResult(r.result);
      setRevealKey((k) => k + 1);
      setRevealing(true);
    } catch {
      setError('抽選できませんでした。再度お試しください。');
    } finally {
      lock.current = false;
      setBusy(false);
    }
  };

  const busyView = revealing || !!result || !!multi;
  const collectionLine = (
    <span
      className="gacha-collect-count"
      data-gacha-collection
      aria-label={`コレクション ${ownedCount} / ${items.length}`}
    >
      <span className="gacha-collect-word">コレクション </span>
      <b>{ownedCount}</b> / {items.length}
    </span>
  );

  /*
   * ★画面の流れ（C9）★ ① 今回の注目アイテム → ② 所持マナコイン → ③ ガチャを引く → ④ 結果 → ⑤ コレクションに追加
   *   注目アイテムは gachaFeatured()（ガチャデータから自動生成）。アイテム名は書かない（C23）。
   *   「注目」は見せ方で、割合は本物の抽選表（gachaItemRate）の値をそのまま出す（C8）。
   */
  return (
    <section
      className={`gacha-room ${result ? 'has-result' : ''} ${busyView ? 'is-busy' : ''}`}
      data-best-rarity={!revealing && bestRarity ? bestRarity : undefined}
    >
      {!embedded && (
        <button type="button" className="arena-back" onClick={onBack}>
          <ArrowLeft size={18} />
          マイページ
        </button>
      )}
      {/* ★2026-10-28 A10：モンストのガチャのように「バナー＋絵を押すと詳細」★
          ★2026-10-29：ガチャが2種類に（共通テスト／2次試験）。バナーを左右にスワイプして切り替える（縦には伸ばさない）★
          目玉（週がわり）を大きく、その下に今週のピックアップの絵。押すと「アイテムの詳細」。
          ピックアップ一覧・提供割合・ミッションは小さいボタンにまとめた。セット・かけらはショップの「種類」へ移した。 */}
      {!busyView && (
        <GachaPoolCarousel
          pool={pool}
          onPool={setPool}
          progress={progress}
          onDetail={openDetail}
          onPickup={() => pickupDialog.current?.showModal()}
          onOdds={() => oddsDialog.current?.showModal()}
          coinsLow={!!progress && progress.coins < GACHA_COST}
          onMissions={onMissions}
        />
      )}

      <div className="gacha-wallet" data-gacha-wallet>
        <p className="gacha-balance" aria-label={`所持 ${progress?.coins ?? 0} マナコイン`}>
          <Coins size={20} aria-hidden="true" />
          <span className="gacha-balance-word">所持</span>
          <b>{progress?.coins ?? '—'}</b>マナコイン
        </p>
        {collectionLine}
      </div>

      {/* 2026-09-30 確定演出：青→金→虹→大当たり と上がり、引いたレア度で止まる（それより上の色は出さない） */}
      {revealing && bestRarity ? (
        <GachaReveal key={revealKey} rarity={bestRarity} onDone={() => setRevealing(false)} />
      ) : result ? (
        <GachaSingleResult
          result={result}
          progress={progress}
          freeResult={freeResult}
          collectionLine={collectionLine}
          setResult={setResult}
          setError={setError}
        />
      ) : multi ? (
        <GachaMultiResult multi={multi} progress={progress} collectionLine={collectionLine} setMulti={setMulti} setError={setError} />
      ) : confirmMulti ? (
        <div className="gacha-confirm" role="group" aria-label="10＋1連ガチャ購入確認">
          <p>
            {multiCost}マナコインを使って「{poolDef.title}」を{GACHA_MULTI_COUNT}回まとめて引きますか？
            <br />
            <small>10＋1連は R 以上が1つ以上確定</small>
          </p>
          <button type="button" disabled={busy} onClick={() => void drawMulti()}>
            {multiCost}枚で確定する
          </button>
          <button type="button" onClick={() => setConfirmMulti(false)}>
            キャンセル
          </button>
        </div>
      ) : confirm ? (
        <div className="gacha-confirm" role="group" aria-label="ガチャ購入確認">
          <p>{GACHA_COST}マナコインを使って「{poolDef.title}」を1回引きますか？</p>
          <button type="button" disabled={busy} onClick={() => void draw()}>
            {GACHA_COST}枚で確定する
          </button>
          <button type="button" onClick={() => setConfirm(false)}>
            キャンセル
          </button>
        </div>
      ) : (
        <div className="gacha-pulls" data-gacha-pulls data-pool={pool} aria-label={`${poolDef.title}を引く`}>
          <button
            type="button"
            className="gacha-pull"
            disabled={busy || !progress || progress.coins < GACHA_COST}
            onClick={() => setConfirm(true)}
          >
            <Gift size={20} aria-hidden="true" />
            <span>
              1回引く<small>{GACHA_COST}枚</small>
            </span>
          </button>
          <button
            type="button"
            className="gacha-pull gacha-pull-multi"
            disabled={busy || !progress || progress.coins < multiCost}
            onClick={() => setConfirmMulti(true)}
            data-gacha-multi-pull
          >
            <Gift size={20} aria-hidden="true" />
            <span>
              10＋1連<small>{multiCost}枚・R以上1つ確定</small>
            </span>
          </button>
          <button
            type="button"
            className="gacha-pull gacha-pull-video"
            disabled={busy || !progress || videoLeft === 0}
            onClick={() => void startFree()}
            data-video-gacha
            data-ad-mode={adMode ? 'rewarded' : 'clip'}
          >
            <PlayCircle size={20} aria-hidden="true" />
            <span>
              動画で1回<small>無料・今日あと{videoLeft} / {VIDEO_GACHA_DAILY_LIMIT}回</small>
            </span>
          </button>
        </div>
      )}

      {videoOpen && (
        <RewardVideo
          onCancel={() => setVideoOpen(false)}
          onComplete={async (token) => {
            setVideoOpen(false);
            await drawFree(token);
          }}
        />
      )}
      {error && (
        <p role="status" className="gacha-message">
          {error}
        </p>
      )}
      <div className="gacha-collection-meter" aria-label={`コレクション ${ownedCount}/${items.length}種類`} hidden>
        <progress value={ownedCount} max={items.length} aria-label="装飾の収集状況" />
      </div>
      <GachaCollectionModal oddsDialog={oddsDialog} items={items} tiers={tiers} progress={progress} pool={pool} />
      <GachaItemDetail dialog={detailDialog} item={detailItem} progress={progress} pool={pool} />
      <GachaPickupModal dialog={pickupDialog} items={items} progress={progress} pool={pool} />
    </section>
  );
}

/** 最後に見ていたガチャの種類（端末ごと。保存できない環境では共通テストガチャ） */
const POOL_KEY = 'mntb:gachaPool';
function readPool(): GachaPoolId {
  const v = safeGetItem(POOL_KEY);
  return GACHA_POOLS.some((p) => p.id === v) ? (v as GachaPoolId) : DEFAULT_GACHA_POOL;
}
function writePool(pool: GachaPoolId) {
  try { safeLocalStorage()?.setItem(POOL_KEY, pool); } catch { /* 保存できなくても切り替えはできる */ }
}
