import { jsxRenderer } from 'hono/jsx-renderer'

const NAV = [
  { jp1: '英検に', jp2: 'ついて', en: 'About Eiken', href: '/' },
  { jp1: '試験日程・', jp2: '受験案内', en: 'Schedule', href: '/' },
  { jp1: 'お申', jp2: 'し込み', en: 'Apply', href: '/' },
  { jp1: '試験結', jp2: '果・解答', en: 'Results', href: '/' },
  { jp1: '過去問・', jp2: '試験内容', en: 'Past Exams', href: '/', active: true },
]

export const GRADES = ['1級', '準1級', '2級', '準2級プラス', '準2級', '3級', '4級', '5級']

export const renderer = jsxRenderer(({ children }) => {
  return (
    <html lang="ja">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>5級の過去問・試験内容 | 英検 | 公益財団法人 日本英語検定協会</title>
        <link rel="stylesheet" href="/static/style.css" />
      </head>
      <body>
        <a class="skip-link" href="#main">
          本文へスキップ
        </a>

        <div class="gray-band" aria-hidden="true"></div>

        <header id="site-header" class="site-header">
          <div class="utility-bar">
            <div class="utility-inner">
              <a href="/">受験者マイページ</a>
              <a href="/">お知らせ</a>
              <a href="/">よくあるご質問・お問い合わせ</a>
              <a href="/" class="utility-en">
                English Site
              </a>
              <button type="button" class="search-btn" aria-label="サイト内検索">
                <span class="search-icon" aria-hidden="true"></span>
              </button>
            </div>
          </div>

          <div class="header-inner">
            <div class="header-left">
              <a class="brand" href="/" aria-label="英検トップページ">
                <span class="brand-mark">英検</span>
                <span class="brand-sub">
                  実用英語技能検定
                  <br />
                  EIKEN
                </span>
              </a>

              <nav id="global-nav" class="global-nav" aria-label="グローバルナビゲーション">
                {NAV.map((item) => (
                  <a class={item.active ? 'nav-link is-active' : 'nav-link'} href={item.href}>
                    <span class="nav-jp">
                      {item.jp1}
                      {item.jp2}
                    </span>
                    <span class="nav-en">{item.en}</span>
                  </a>
                ))}
              </nav>
            </div>

            <div class="header-actions">
              <a class="group-btn" href="/">
                団体・学校
                <br />
                関係者の方
                <span class="chev" aria-hidden="true">
                  ›
                </span>
              </a>
              <a class="account-btn" href="/">
                <span class="account-icon" aria-hidden="true">
                  👤
                </span>
                <span class="account-label">
                  生涯
                  <br />
                  学習
                  <br />
                  アカウント
                </span>
              </a>
            </div>
          </div>
        </header>

        <main id="main">{children}</main>

        <footer id="site-footer" class="site-footer">
          <div class="footer-inner">
            <p class="footer-brand">英検</p>
            <p class="footer-note">
              公益財団法人 日本英語検定協会
              <br />
              本アプリは学習用に構成したローカル演習ツールです。問題は公式過去問の出題形式・傾向に基づいて作成しています。
            </p>
          </div>
        </footer>

        <nav id="grade-tabs" class="grade-tabs" aria-label="級の切り替え">
          {GRADES.map((g) => (
            <a class={g === '5級' ? 'grade-tab is-current' : 'grade-tab'} href="/" data-grade={g}>
              {g}
              <span class="tab-chev" aria-hidden="true">
                ›
              </span>
            </a>
          ))}
        </nav>

        <button type="button" class="to-top" id="to-top" aria-label="ページの先頭へ戻る">
          ︿
        </button>

        <script src="/static/app.js" defer></script>
      </body>
    </html>
  )
})
