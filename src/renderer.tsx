import { jsxRenderer } from 'hono/jsx-renderer'

// Existing answer-index view imports this list; only grade 5 is available.
export const GRADES = ['5級']

export const renderer = jsxRenderer(({ children }) => (
  <html lang="ja">
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <meta name="description" content="マナトビの英検5級演習。本試験の構成に沿ったリーディング25問・リスニング25問。" />
      <title>マナトビ | 英検5級 演習問題</title>
      <link rel="stylesheet" href="/static/style.css" />
    </head>
    <body>
      <a class="skip-link" href="#main">本文へスキップ</a>
      <header id="site-header" class="site-header manatobi-header">
        <a class="manatobi-brand" href="/" aria-label="マナトビ ホーム">
          <img src="/static/manatobi-logo-gray.png" alt="マナトビ" width="158" height="50" />
        </a>
        <span class="site-edition">英検5級 / PRACTICE BOOK</span>
        <nav class="book-nav" aria-label="メインメニュー">
          <a href="/">問題一覧</a>
          <a href="/#exam-format">試験の構成</a>
          <a href="/new?part=reading">新しい演習</a>
        </nav>
      </header>
      <main id="main">{children}</main>
      <footer id="site-footer" class="site-footer">
        <div class="footer-inner">
          <img class="footer-logo" src="/static/manatobi-logo-gray.png" alt="マナトビ" width="126" height="40" />
          <p class="footer-note">マナトビの学習用演習教材です。日本英語検定協会・神戸大学の公式教材ではなく、両者とは関係ありません。<br />音声はブラウザによる合成音声です。試験冊子の完全再現ではありません。</p>
        </div>
      </footer>
      <button type="button" class="to-top" id="to-top" aria-label="ページの先頭へ戻る">↑</button>
      <script dangerouslySetInnerHTML={{ __html: `window.__MANATOBI_FIREBASE_CONFIG__ = ${JSON.stringify({
        apiKey: 'AIzaSyB4MEgQ3EJyR8ImE5b-Pm-EtJVPC3apdkw',
        authDomain: 'manatobi-eiken.firebaseapp.com',
        projectId: 'manatobi-eiken',
        storageBucket: 'manatobi-eiken.firebasestorage.app',
        messagingSenderId: '643126129869',
        appId: '1:643126129869:web:fd89acc67e503b9439e584',
      })};` }} />
      <script src="https://www.gstatic.com/firebasejs/10.14.1/firebase-app-compat.js"></script>
      <script src="https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore-compat.js"></script>
      <script src="/static/app.js" defer></script>
    </body>
  </html>
))
