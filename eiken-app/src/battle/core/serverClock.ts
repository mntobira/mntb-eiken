/**
 * ===================================================================
 * 対戦モード: サーバ時刻の推定（端末の時計ずれを吸収する）
 * ===================================================================
 *
 * ■ なぜこれが必要か（実際に起きる壊れ方）
 *
 * 対戦の残り時間は「締切時刻 − 現在時刻」で出している。
 * このうち
 *   ・締切時刻（deadlineAt）… 部屋主の★端末時刻★＋制限時間 で作られる
 *   ・受付の可否               … Firestore ルールが★サーバ時刻★と比べて決める
 * と、2つの時計が混ざっている。
 *
 * 端末の時計がずれていると、こうなる:
 *
 *   (1) 部屋主の時計が進んでいる（例：+2分）
 *       → deadlineAt が「サーバ時刻＋2分10秒」になる。
 *         ルールは「締切は今から60秒以内」しか許さないので★書き込みが拒否される★。
 *         利用者に出るのは「この操作は許可されていません」。
 *         対戦が始まらないのに、理由がまったく分からない。
 *
 *   (2) 部屋主の時計が遅れている（例：−2分）
 *       → deadlineAt が過去になり、これも拒否される（締切は未来でなければならない）。
 *
 *   (3) 解答する側の時計が遅れている（例：−5秒）
 *       → 画面には「残り3秒」と出ているのに、サーバではもう締切を過ぎている。
 *         押しても弾かれ、★答えたのに解答が消える★。
 *         本人は間に合ったと思っているので、不正やバグを疑うことになる。
 *
 * スマホは自動時刻合わせが既定なので普段は問題にならない。
 * だが手動設定・時計用電池切れ・時差の設定間違いは実際に起きる。
 * そして起きたとき★症状が「許可されていません」なので誰も原因に辿り着けない★。
 * だから端末時刻をそのまま使うのをやめ、ここでサーバ時刻に寄せる。
 *
 * -------------------------------------------------------------------
 * ■ 追加の通信は一切しない
 * -------------------------------------------------------------------
 * 時刻合わせのために専用の読み書きをすると無料枠を食う。
 * 対戦では元々
 *   ・書き込みのたびに updatedAt: serverTimestamp() を入れている
 *   ・その結果が onSnapshot で返ってくる
 * ので、★既にある通信からサーバ時刻を拾うだけ★にする。読み書きは増えない。
 *
 * -------------------------------------------------------------------
 * ■ 2種類の観測を使い分ける
 * -------------------------------------------------------------------
 * ① 往復が分かる観測（自分が書いたとき）… observeRoundTrip()
 *    送信時刻 t0 と応答時刻 t1 を自分で測れる。サーバが時刻を刻んだ瞬間は
 *    必ず t0〜t1 の間にあるので、中点と比べれば誤差は片道遅延ぶん（数百ms）で収まる。
 *    こちらが本命。
 *
 * ② 片側しか分からない観測（相手の書き込みが届いたとき）… observeLowerBound()
 *    いつ送られたか分からないので、分かるのは
 *    「サーバ時刻は少なくともこの値以上だった」という下限だけ。
 *    ずれを正確に測るには使えないが、
 *    ★数分単位の大きなずれを最初の1通で見つける★のには十分使える。
 *    そのため「推定が下限を下回っているときだけ持ち上げる」用途に限定する。
 *
 * -------------------------------------------------------------------
 * ■ 状態を持つが、テストできる形にしてある
 * -------------------------------------------------------------------
 * 画面のあちこちから使うのでモジュール内に値を持つ。
 * ただし resetServerClock() で必ず初期状態に戻せるようにし、
 * 判定そのものは引数だけで決まる純粋な関数に切り出してある。
 */

/**
 * 往復観測を採用するかどうかの上限（ms）。
 *
 * ★上限を設ける理由★
 * 電波が悪いときの往復は数秒に達することがある。
 * そのときの中点は誤差が大きく、良い観測を上書きすると
 * かえって時刻がずれる。極端に遅い往復は捨てる。
 */
export const MAX_USABLE_ROUND_TRIP_MS = 5_000;

/**
 * 観測が古くなったとみなす時間（ms）。
 *
 * ★古い観測を捨てる理由★
 * 端末の時計は試合中でも動きうる（自動時刻合わせが働く、
 * 利用者が設定を直す、機種によっては復帰時に補正される）。
 * 良い観測を永久に持ち続けると、時計が直った後も
 * 古いずれを足し続けてしまう。
 */
export const OBSERVATION_STALE_MS = 5 * 60_000;

/**
 * この幅を超えるずれを「時計がずれている」とみなす閾値（ms）。
 *
 * ★30秒にした理由★
 * ルールは「締切は今から60秒以内」しか許さない。
 * 制限時間の上限が30秒なので、ずれが30秒を超えると
 * 締切の書き込みが拒否されはじめる。つまりここが実害の出る境目。
 */
export const CLOCK_SKEW_WARN_MS = 30_000;

interface Observation {
  /** サーバ時刻 − 端末時刻（これを端末時刻に足すとサーバ時刻になる） */
  offsetMs: number;
  /** この観測の誤差の見込み（小さいほど良い） */
  uncertaintyMs: number;
  /** いつ観測したか（端末時刻） */
  atMs: number;
}

let best: Observation | null = null;

/**
 * 現在の観測を捨てる。
 * 試験のたびに前の試験の状態が残らないようにするため必須。
 * ログアウト時にも呼ぶ（別の端末・別の環境になる可能性があるため）。
 */
export function resetServerClock(): void {
  best = null;
}

/**
 * 新しい観測を採用すべきか決める。
 *
 * ★純粋な関数として切り出している理由★
 * 「どんなときに上書きするか」がこの部品のいちばん間違えやすい所なので、
 * モジュールの状態と切り離して試験できるようにしてある。
 *
 * 採用する条件は次のいずれか:
 *   ・まだ何も観測していない
 *   ・今の観測が古くなっている（時計が直っている可能性がある）
 *   ・新しい観測の方が誤差が小さい（より確かな値で置き換える）
 */
export function shouldAdoptObservation(
  current: { uncertaintyMs: number; atMs: number } | null,
  next: { uncertaintyMs: number; atMs: number },
): boolean {
  if (!current) return true;
  if (next.atMs - current.atMs >= OBSERVATION_STALE_MS) return true;
  return next.uncertaintyMs <= current.uncertaintyMs;
}

/**
 * 自分の書き込みからサーバ時刻を観測する（本命の経路）。
 *
 * @param serverMs     サーバが刻んだ時刻（updatedAt などを ms にしたもの）
 * @param localSentMs  書き込みを始めた端末時刻
 * @param localAckMs   応答が返った端末時刻
 *
 * サーバが時刻を刻んだ瞬間は必ず localSentMs〜localAckMs の間にある。
 * よって中点と比べれば、誤差は往復の半分（＝片道遅延）に収まる。
 */
export function observeRoundTrip(
  serverMs: number,
  localSentMs: number,
  localAckMs: number,
): void {
  if (!Number.isFinite(serverMs) || serverMs <= 0) return;
  if (!Number.isFinite(localSentMs) || !Number.isFinite(localAckMs)) return;

  const roundTrip = localAckMs - localSentMs;
  // 負の往復（時計が測定中に飛んだ）や、極端に遅い往復は信用しない。
  if (roundTrip < 0 || roundTrip > MAX_USABLE_ROUND_TRIP_MS) return;

  const midpoint = localSentMs + roundTrip / 2;
  const next: Observation = {
    offsetMs: serverMs - midpoint,
    uncertaintyMs: roundTrip / 2,
    atMs: localAckMs,
  };
  if (shouldAdoptObservation(best, next)) best = next;
}

/**
 * 届いた書き込み（相手のものを含む）から下限だけを観測する。
 *
 * @param serverMs        サーバが刻んだ時刻
 * @param localReceivedMs それを受け取った端末時刻
 *
 * いつ送られたか分からないので「サーバ時刻はこれ以上だった」しか言えない。
 * したがって★推定が下限を下回っているときだけ持ち上げる★。
 * 下限より上にいるときは何もしない（下げると悪化するだけなので触らない）。
 */
export function observeLowerBound(serverMs: number, localReceivedMs: number): void {
  if (!Number.isFinite(serverMs) || serverMs <= 0) return;
  if (!Number.isFinite(localReceivedMs)) return;

  const lowerBoundOffset = serverMs - localReceivedMs;
  const currentOffset = best ? best.offsetMs : 0;
  if (currentOffset >= lowerBoundOffset) return;

  // 下限そのものを採用する（片道遅延ぶん控えめな値になるが、
  // 「実際より遅れて見える」側に倒れるので締切を延ばす方向には働かない）。
  best = {
    offsetMs: lowerBoundOffset,
    // 往復観測より必ず劣る扱いにして、良い観測に上書きされるようにする。
    uncertaintyMs: best ? Math.max(best.uncertaintyMs, 1) : MAX_USABLE_ROUND_TRIP_MS,
    atMs: localReceivedMs,
  };
}

/** 端末時刻に足すとサーバ時刻になる補正値（ms）。観測が無ければ 0 */
export function serverClockOffsetMs(): number {
  return best ? best.offsetMs : 0;
}

/**
 * 推定したサーバ時刻。
 *
 * ★Date.now() の代わりにこれを使う★
 * 残り時間の計算と締切の作成の両方でこれを使うことで、
 * 端末の時計がずれていても
 *   ・締切の書き込みが拒否されない
 *   ・画面の残り時間とサーバの受付期限が一致する
 * ようになる。
 */
export function serverNow(): number {
  return Date.now() + serverClockOffsetMs();
}

/**
 * 端末の時計が実害の出るほどずれているか。
 * 画面に注意を出すために使う（黙って直すだけだと、
 * 利用者は自分の端末の設定がおかしいことに気付けない）。
 */
export function isClockSkewed(): boolean {
  return Math.abs(serverClockOffsetMs()) >= CLOCK_SKEW_WARN_MS;
}

/**
 * Firestore の Timestamp / Date / 数値 などを ms に直す。
 *
 * ★型を緩くしている理由★
 * 部屋のフィールドは unknown で扱っている（Timestamp 型を core に持ち込まないため）。
 * また serverTimestamp() の直後は端末側で null に見える瞬間があるので、
 * 読めないときは null を返して呼び側に判断させる。
 */
export function toMillis(value: unknown): number | null {
  if (value == null) return null;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  const asTimestamp = value as { toMillis?: () => number };
  if (typeof asTimestamp.toMillis === 'function') {
    const ms = asTimestamp.toMillis();
    return Number.isFinite(ms) ? ms : null;
  }
  if (value instanceof Date) {
    const ms = value.getTime();
    return Number.isFinite(ms) ? ms : null;
  }
  return null;
}
