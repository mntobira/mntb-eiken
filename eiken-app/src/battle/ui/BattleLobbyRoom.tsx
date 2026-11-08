/**
 * ===================================================================
 * BattleLobbyRoom — F10（2026-11-05）全国対戦の「対戦の部屋」
 * ===================================================================
 *   全国対戦で1回マッチしたら、2人はこの部屋に入る。
 *     1. それぞれが希望の単元（英単語・リスニング・英文法…どれでも）をえらぶ
 *     2. 2人ともえらんだら、2つのうちどちらかをランダムに選んで試合を始める
 *        （抽選と試合作りは部屋主＝players[0] の端末。data/battleLobby.ts の startLobbyRound）
 *     3. 試合が終わって「対戦の部屋に戻る」を押すと、この部屋に戻ってくる → またえらんで再戦
 *   どちらかが「部屋を出る」と部屋は閉じ、相手には「相手が部屋を出ました」と出る。
 *
 * ★試合に入る合図は「部屋の round が、この画面を開いたときより進んだこと」★
 *   試合から戻ってきたとき、部屋の roomId は「さっきの試合」のままなので、roomId だけ見ると
 *   戻った瞬間にさっきの試合へ入り直してしまう。開いたときの round を覚えておき、それより進んだら入る。
 */
import { useEffect, useRef, useState } from 'react';
import { Copy, DoorOpen, ListChecks, Loader2, RotateCcw, Shuffle } from 'lucide-react';
import { auth } from '../../firebase';
import {
  bothPicked,
  leaveLobby,
  setLobbyPick,
  startLobbyRound,
  watchLobby,
  type BattleLobbyDoc,
  type LobbyChosen,
  type LobbyCount,
  type LobbyPick,
} from '../data/battleLobby';
import { BattleSubjectSelect } from './BattleSubjectSelect';
import { BattleButton, BattleLoading, BattleNotice, BattleShell, BattleTitle, PlayerBadge } from './BattleParts';
import { lobbyPickTitle } from './lobbyPickTitle';
import './battle-lobby-room.css';

/** 2人ともえらんでから抽選するまでの間（「2人ともえらびました」を読める長さ・直前のえらび直しを拾う） */
const DRAW_DELAY_MS = 900;
/** 抽選の結果を見せてから試合に入るまで */
const REVEAL_HOLD_MS = 1800;

export function BattleLobbyRoom({
  lobbyId,
  kind = 'national',
  onEnterRoom,
  onExit,
  onNationalAgain,
}: {
  lobbyId: string;
  kind?: 'national' | 'friend';
  /** 部屋が変わったら画面ごと作り直す（BattleRoomScreen と同じ書き方） */
  key?: string;
  /** 試合（battle_rooms）ができたら、その部屋へ */
  onEnterRoom: (roomId: string) => void;
  /** 対戦メニューに戻る（部屋は閉じる） */
  onExit: () => void;
  /** 相手が出たあとの「ちがう相手と全国対戦」 */
  onNationalAgain: () => void;
}) {
  const uid = auth.currentUser?.uid || '';
  const [lobby, setLobby] = useState<BattleLobbyDoc | null | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const [picking, setPicking] = useState(false);
  const [saving, setSaving] = useState(false);
  const [drawError, setDrawError] = useState<string | null>(null);
  const [reveal, setReveal] = useState<LobbyChosen | null>(null);
  /** この画面を開いたときの round（これより進んだら試合に入る） */
  const entryRound = useRef<number | null>(null);
  const enteredRef = useRef(false);
  const enterTimerRef = useRef<number | null>(null);
  /** 入るのは1回だけ（enteredRef）。親が onEnterRoom を作り直しても、いちばん新しいものを呼ぶ */
  const onEnterRef = useRef(onEnterRoom);
  onEnterRef.current = onEnterRoom;
  const drawingRef = useRef(false);
  const [drawTry, setDrawTry] = useState(0);
  const [copied, setCopied] = useState(false);

  useEffect(() => watchLobby(lobbyId, (next) => {
    setLobby(next);
    if (next && entryRound.current === null) entryRound.current = next.round;
  }, (e) => setError(e.message)), [lobbyId]);

  const me = lobby?.profiles[uid];
  const otherUid = lobby?.players.find((p) => p !== uid) || '';
  const other = otherUid ? lobby?.profiles[otherUid] : undefined;
  const myPick = lobby?.picks?.[uid];
  const otherPick = otherUid ? lobby?.picks?.[otherUid] : undefined;
  const isHost = !!lobby && lobby.players[0] === uid;
  const ready = !!lobby && lobby.status === 'open' && bothPicked(lobby);
  const isFriend = kind === 'friend' || lobby?.kind === 'friend';
  const modeLabel = isFriend ? 'フレンド対戦' : '全国対戦';

  // ------------------------------------------------------------
  // 試合ができた（round が進んだ）→ 抽選の結果を見せてから入る
  // ------------------------------------------------------------
  useEffect(() => {
    if (!lobby || enteredRef.current || entryRound.current === null) return;
    if (lobby.round <= entryRound.current || !lobby.roomId || !lobby.chosen) return;
    enteredRef.current = true;
    setPicking(false);
    setReveal(lobby.chosen);
    const roomId = lobby.roomId;
    // ★タイマーは lobby が変わっても止めない★（書き込み直後とサーバー確定で知らせが2回来るため。止めるのは画面を閉じたときだけ）
    enterTimerRef.current = window.setTimeout(() => onEnterRef.current(roomId), REVEAL_HOLD_MS);
  }, [lobby]);
  useEffect(() => () => { if (enterTimerRef.current !== null) window.clearTimeout(enterTimerRef.current); }, []);

  // ------------------------------------------------------------
  // 部屋主：2人ともえらんだら抽選して試合を作る
  // ------------------------------------------------------------
  useEffect(() => {
    if (!isHost || !ready || !lobby || enteredRef.current || drawingRef.current || drawError) return;
    const snapshot = lobby;
    const timer = window.setTimeout(() => {
      drawingRef.current = true;
      void startLobbyRound(snapshot)
        .catch((e: Error) => {
          // 相手がえらび直した → 次の知らせで自動でやり直す。それ以外は理由を出して、押せばやり直せる
          if (!/えらび直しました/.test(e.message)) setDrawError(e.message);
        })
        .finally(() => { drawingRef.current = false; });
    }, DRAW_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [isHost, ready, lobby, drawError, drawTry]);

  const choose = async (subject: string, count?: number, chapterId?: string) => {
    const pick: LobbyPick = {
      subject,
      chapterId: chapterId || '',
      count: ([5, 10, 15].includes(count ?? 10) ? (count ?? 10) : 10) as LobbyCount,
      title: lobbyPickTitle(subject, chapterId),
    };
    setSaving(true);
    setError(null);
    setDrawError(null);
    try {
      await setLobbyPick(lobbyId, pick);
      setPicking(false);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  /** えらび直す：いったん取り消してから選ぶ（えらび直している間に抽選が始まらない） */
  const repick = async () => {
    setError(null);
    setDrawError(null);
    try {
      await setLobbyPick(lobbyId, null);
      setPicking(true);
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const leave = () => {
    void leaveLobby(lobbyId);
    onExit();
  };

  // ------------------------------------------------------------
  // 単元をえらぶ（部屋の購読は続けたまま、中身だけ差し替える）
  // ------------------------------------------------------------
  if (picking && lobby?.status === 'open') {
    return (
      <BattleSubjectSelect
        title={`${modeLabel} ／ 希望の単元をえらぶ`}
        allowQuestionCount
        currentSubject={myPick?.subject}
        onPick={(subject, count, chapterId) => { if (!saving) void choose(subject, count, chapterId); }}
        onBack={() => setPicking(false)}
      />
    );
  }

  if (lobby === undefined) {
    return (
      <BattleShell>
        <BattleTitle subtitle={`${modeLabel} ／ 対戦の部屋`} />
        <BattleLoading message="対戦の部屋に入っています…" />
      </BattleShell>
    );
  }

  const exitButton = (
    <BattleButton variant="ghost" onClick={onExit} icon={<DoorOpen size={18} />}>
      対戦メニューにもどる
    </BattleButton>
  );

  // ------------------------------------------------------------
  // 部屋が無い／閉じた
  // ------------------------------------------------------------
  if (!lobby || (lobby.status === 'closed' && !reveal)) {
    const otherLeft = !!lobby && !!lobby.left && Object.keys(lobby.left).some((u) => u !== uid);
    return (
      <BattleShell footer={<div className="grid gap-2.5"><BattleButton onClick={onNationalAgain} icon={<Shuffle size={18} />}>{isFriend ? 'フレンド対戦にもどる' : 'ちがう相手と全国対戦'}</BattleButton>{exitButton}</div>}>
        <BattleTitle subtitle={`${modeLabel} ／ 対戦の部屋`} />
        <div className="flex flex-1 items-center justify-center py-10" data-lobby-closed>
          <BattleNotice message={error || (otherLeft ? '相手が部屋を出ました。' : 'この対戦の部屋は閉じました。')} />
        </div>
      </BattleShell>
    );
  }

  // ------------------------------------------------------------
  // 抽選の結果（試合に入る直前）
  // ------------------------------------------------------------
  if (reveal) {
    const mine = reveal.uid === uid;
    return (
      <BattleShell className="arena-matching">
        <BattleTitle subtitle={`${modeLabel} ／ 対戦の部屋`} />
        <div className="lobby-reveal" data-lobby-reveal role="status">
          <Shuffle size={36} className="battle-pop lobby-reveal-icon" aria-hidden />
          <p className="lobby-reveal-kicker">抽選の結果</p>
          <p className="battle-pop lobby-reveal-title">{reveal.title}</p>
          <p className="lobby-reveal-meta">{reveal.count}問しょうぶ ／ {mine ? 'あなたの希望' : '相手の希望'}に決まりました</p>
          <p className="lobby-reveal-meta"><Loader2 size={14} className="animate-spin" aria-hidden /> 試合をはじめます…</p>
        </div>
      </BattleShell>
    );
  }

  // ------------------------------------------------------------
  // 部屋（2人の希望）
  // ------------------------------------------------------------
  const status = ready
    ? (drawError ? null : '2人ともえらびました。抽選中…')
    : !myPick ? '希望の単元をえらんでください'
      : '相手が単元をえらぶのを待っています…';
  const roundNo = lobby.round + 1;

  return (
    <BattleShell
      className="lobby-room"
      footer={
        <div className="lobby-footer-actions">
          {myPick
            ? <BattleButton variant="ghost" onClick={() => void repick()} disabled={ready && !drawError} icon={<RotateCcw size={18} />} data-lobby-repick>えらび直す</BattleButton>
            : <BattleButton onClick={() => setPicking(true)} icon={<ListChecks size={18} />} data-lobby-pick>単元をえらぶ</BattleButton>}
          <BattleButton variant="danger" onClick={leave} icon={<DoorOpen size={18} />} data-lobby-leave>部屋を出る</BattleButton>
        </div>
      }
    >
      <BattleTitle subtitle={`${modeLabel} ／ 対戦の部屋（${roundNo}戦目）`} />
      {isFriend && lobby.joinCode && (
        <section className="lobby-code mb-3 rounded-2xl border-2 border-amber-300 bg-amber-50 p-3 text-center" aria-label="フレンドコード" data-friend-code={lobby.joinCode}>
          <p className="lobby-code-label text-xs font-bold text-stone-600">フレンドに伝える4文字コード</p>
          <p className="lobby-code-value font-mono text-3xl font-black tracking-[0.35em] text-stone-900" aria-live="polite">{lobby.joinCode}</p>
          <button type="button" className="lobby-code-copy inline-flex min-h-10 items-center gap-1.5 rounded-xl border-2 border-amber-300 bg-white px-3 text-xs font-black text-amber-800" onClick={() => {
            if (!navigator.clipboard) { setError('コードをコピーできませんでした。表示中の4文字を伝えてください。'); return; }
            void navigator.clipboard.writeText(lobby.joinCode!).then(() => setCopied(true)).catch(() => setError('コードをコピーできませんでした。表示中の4文字を伝えてください。'));
          }}><Copy size={15} aria-hidden />{copied ? 'コピーしました' : 'コードをコピー'}</button>
        </section>
      )}
      <p className="lobby-howto">
        {isFriend && lobby.players.length < 2
          ? '4文字コードを友達に伝えてください。友達も単元をえらぶと、どちらかの希望からランダムで出題します。'
          : <>2人がえらんだ単元のうち、<b>どちらか1つ</b>をランダムで出題します。</>}
      </p>

      <ul className="lobby-seats" aria-label="2人の希望の単元">
        <li className="lobby-seat is-me" data-lobby-seat="me">
          <PlayerBadge nickname={me?.nickname || 'あなた'} photoURL={me?.photoURL} rating={me?.rating ?? 1500} isMe />
          <LobbyPickLine pick={myPick} empty="まだえらんでいません" />
        </li>
        <li className="lobby-seat" data-lobby-seat="opponent">
          <PlayerBadge nickname={other?.nickname || '対戦相手'} photoURL={other?.photoURL} rating={other?.rating ?? 1500} mask />
          <LobbyPickLine pick={otherPick} empty={isFriend && lobby.players.length < 2 ? 'フレンドの入室を待っています…' : 'えらんでいます…'} />
        </li>
      </ul>

      {lobby.chosen && <p className="lobby-last">前回：{lobby.chosen.title}（{lobby.chosen.uid === uid ? 'あなた' : '相手'}の希望）</p>}

      <div className="lobby-status">
        {status && <p className="lobby-status-text" role="status">{ready && !drawError && <Loader2 size={14} className="animate-spin" aria-hidden />}{status}</p>}
        {(drawError || error) && <BattleNotice message={(drawError || error)!} />}
        {drawError && isHost && <BattleButton onClick={() => { setDrawError(null); setDrawTry((n) => n + 1); }}>もう一度抽選する</BattleButton>}
      </div>
    </BattleShell>
  );
}

function LobbyPickLine({ pick, empty }: { pick?: LobbyPick; empty: string }) {
  if (!pick) return <p className="lobby-pick is-empty">{empty}</p>;
  return (
    <p className="lobby-pick" data-lobby-pick-title>
      <span className="lobby-pick-title">{pick.title}</span>
      <span className="lobby-pick-count">{pick.count}問</span>
    </p>
  );
}
