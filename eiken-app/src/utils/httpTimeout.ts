/**
 * ===================================================================
 * タイムアウト付き fetch（外部送信の共通の口）
 * ===================================================================
 *
 * ■ なぜこのファイルがあるか
 *   外部（Google Apps Script のウェブアプリ）へ POST する処理が
 *   アプリに2つある。
 *     src/utils/feedback.ts     … フィードバックをスプレッドシートへ
 *     src/utils/userRegistry.ts … ユーザー記録をスプレッドシートへ
 *
 *   この2つは「同じ GAS ウェブアプリの同じURL」へ、同じ作法で送る。
 *   userRegistry.ts 側のコメントにも
 *     「送信タイムアウト（フィードバックと揃える）」
 *     「フィードバックと同じ URL・同じ作法（text/plain で simple
 *       request、CORS で落ちたら no-cors で撃ち直し）」
 *   と、揃えるべきだという意図が明記されていた。
 *
 *   ところが実装は2つに分かれていて（どちらも同じ8行）、
 *   タイムアウト値 15000 も2箇所に手書きされていた。
 *   つまり「揃えたい」と書きながら、片方だけ変えても誰も気づかない
 *   状態だった。実装とタイムアウト値を、ここ1つに寄せている。
 *
 * ■ このモジュールが何も import していない理由
 *   feedback.ts と userRegistry.ts の両方から使われるため、ここが
 *   何かを import すると、その依存が両方の送信経路に広がる。
 *   ブラウザ標準の AbortController / fetch / setTimeout だけを使う
 *   葉モジュール（src 内の何も import しない）にしてある。
 *
 * ■ 設計上の意図（変えると壊れるところ）
 *   1. 返り値は fetch の Response を「そのまま」返す。
 *      呼び出し側は response.ok / response.status を見て
 *      GAS 側のエラー（「アクセスできるユーザー」設定ミス等）を
 *      判定しているので、包んで別物にしてはいけない。
 *   2. init は展開してコピーし、signal だけを足す。
 *      呼び出し側は同じ init を no-cors で撃ち直すのに再利用する
 *      （{ ...init, mode: 'no-cors' }）ため、渡された init オブジェクト
 *      自体を書き換えてはいけない。
 *   3. clearTimeout は finally で必ず呼ぶ。
 *      成功しても失敗しても、無応答用のタイマーを残さない。
 *   4. タイムアウト時は fetch が AbortError を投げる。
 *      呼び出し側は error?.name === 'AbortError' で
 *      「再試行しても無駄」と判断して分岐しているので、
 *      ここでエラーを握りつぶしたり別の型に変換してはいけない。
 */

/**
 * 送信のタイムアウト（ミリ秒）。
 * 無応答のまま「送信中…」で固まるのを防ぐ。
 * フィードバックとユーザー記録は同じ GAS へ送るので同じ値を使う。
 */
export const WEBHOOK_TIMEOUT_MS = 15000;

/** AbortController でタイムアウト付きの fetch を行う */
export async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}
