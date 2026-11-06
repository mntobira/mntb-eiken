import type { FC } from 'hono/jsx'
import { SETS } from '../data/sets'

const GRADES = ['1級', '準1級', '2級', '準2級プラス', '準2級', '3級', '4級', '5級']

const PdfIcon: FC = () => (
  <span class="pill-icon" aria-hidden="true">
    PDF
  </span>
)

const SpeakerIcon: FC = () => <span class="pill-icon spk" aria-hidden="true" />

export const Home: FC = () => {
  return (
    <div class="page">
      <nav class="breadcrumb" aria-label="パンくずリスト">
        <a href="/">ホーム</a>
        <span class="sep">›</span>
        <a href="/">過去問・試験内容</a>
        <span class="sep">›</span>
        <span>5級の過去問・試験内容</span>
      </nav>

      <h1 class="page-title">5級の過去問・試験内容</h1>

      <p class="lead">5級の試験内容と、過去1年（3回分）の過去問をご紹介します。</p>

      <h2 class="sec-heading">過去問・サンプル問題</h2>

      <p class="body-text">
        5級は、英語の学習を始めて最初の目標となる級で、レベルはおよそ中学初級程度とされています。初歩的な英語を理解することができ、それを使って表現することが求められます。基礎的でかつ重要な内容が出題されます。5級は、英語学習のステップの始まりです。試験内容は、一次試験（リーディング・リスニング）に加え、スピーキングテストも導入します。なお、スピーキングテストは級認定には影響せず、スピーキングテスト単位で合否判定されます。
      </p>

      <section class="panel" id="written-exam">
        <h3 class="panel-heading">一次試験</h3>

        <p class="body-text">
          一次試験の問題と解答がPDFでダウンロードできます。また、リスニングも聞くことができます。
        </p>
        <ul class="note-list">
          <li>本会場・準会場F日程（2〜5級のみ）実施分のみダウンロードができます。</li>
          <li>問題数が多く、再生に時間がかかる場合があります。</li>
        </ul>

        <div class="menu-grid" id="drill-menu">
          <article class="menu-card">
            <h3>
              通し演習<span class="tag">おすすめ</span>
            </h3>
            <p>
              リーディング25問＋リスニング25問を、本番と同じ順番・制限時間で解きます。採点後に全問の解説が表示されます。
            </p>
            <div class="pill-row">
              <a class="pill" href="/exam/2026-2">
                <PdfIcon />
                2026年度 第2回を解く
              </a>
            </div>
          </article>

          <article class="menu-card">
            <h3>リーディングだけ</h3>
            <p>大問1〜3（25問）を25分で解きます。語彙・会話文・語句並べかえを集中的に練習できます。</p>
            <div class="pill-row">
              <a class="pill" href="/exam/2026-2?part=reading">
                <PdfIcon />
                リーディング25問
              </a>
            </div>
          </article>

          <article class="menu-card">
            <h3>
              オリジナル問題を自動生成<span class="tag">毎回ちがう</span>
            </h3>
            <p>
              過去問の出題形式をもとに、語彙・文法・会話・並べかえ・リスニングを組み合わせて、毎回ちがう問題を作ります。繰り返し練習したいときに。
            </p>
            <div class="pill-row">
              <a class="pill" href="/new">
                <PdfIcon />
                新しい問題を作る
              </a>
              <a class="pill" href="/new?part=listening">
                <SpeakerIcon />
                リスニングのみ
              </a>
            </div>
          </article>

          <article class="menu-card">
            <h3>リスニングだけ</h3>
            <p>第1部〜第3部（25問）を音声つきで解きます。音声は何度でも再生できます。</p>
            <div class="pill-row">
              <a class="pill" href="/exam/2026-2?part=listening">
                <SpeakerIcon />
                リスニング25問
              </a>
            </div>
          </article>
        </div>

        {SETS.map((set, idx) => (
          <div class="round-block">
            <h4 class="round-title">
              {set.round}
              <span class="round-caption">{set.date}</span>
            </h4>

            <p class="bullet-label">過去問</p>
            <div class="pill-row">
              <a class="pill" href={`/exam/${set.id}`}>
                <PdfIcon />
                {set.round} 問題冊子（演習する）
              </a>
              <a class="pill" href={`/script/${set.id}`}>
                <PdfIcon />
                {set.round} リスニング原稿
              </a>
            </div>

            <p class="bullet-label">リスニング音源</p>
            <div class="pill-row">
              <a class="pill" href={`/exam/${set.id}?part=listening#sec-L1`}>
                <SpeakerIcon />
                第1部
              </a>
              <a class="pill" href={`/exam/${set.id}?part=listening#sec-L2`}>
                <SpeakerIcon />
                第2部
              </a>
              <a class="pill" href={`/exam/${set.id}?part=listening#sec-L3`}>
                <SpeakerIcon />
                第3部
              </a>
            </div>

            <p class="bullet-label">解答</p>
            <div class="answer-row">
              {GRADES.map((g) => (
                <a class={g === '5級' ? 'grade-pill is-current' : 'grade-pill'} href={`/exam/${set.id}?show=answers`}>
                  {g}
                  <span class="tab-chev" aria-hidden="true">
                    ›
                  </span>
                </a>
              ))}
            </div>
          </div>
        ))}
      </section>

      <section class="panel" id="speaking-test">
        <h3 class="panel-heading">スピーキングテスト</h3>
        <p class="body-text">
          5級の一次試験に申し込んだ方全員に、スピーキングテストの受験資格があります。対面式の面接ではなく、コンピュータ端末を使って受験し、応答を録音する方式です。級の合否は一次試験のみで判定されます。
        </p>
        <ul class="note-list">
          <li>受験に必要な「英検ID」と「パスワード」は、一次試験の結果通知の際に成績表に記載されます。</li>
          <li>スピーキングテストの結果は、受験後1か月を目途にウェブ上で閲覧できます。</li>
        </ul>
      </section>

      <section class="panel" id="exam-format">
        <h3 class="panel-heading">5級の試験内容</h3>
        <p class="body-text">
          リーディングテスト（25分）とリスニングテスト（約22分）。リーディングは大問1〜3の25問、リスニングは第1部〜第3部の25問です。
        </p>

        <ul class="note-list">
          <li>リーディング：大問1（15問）／大問2（5問）／大問3（5問）</li>
          <li>リスニング：第1部（10問）／第2部（5問）／第3部（10問）</li>
          <li>解答はマークシートに記入します。問題冊子に書き込んでも採点されません。</li>
        </ul>

        <div class="pill-row">
          <a class="pill" href="/exam/2026-1">
            <PdfIcon />
            2026年度 第1回を解く
          </a>
          <a class="pill" href="/exam/2025-3">
            <PdfIcon />
            2025年度 第3回を解く
          </a>
        </div>
      </section>
    </div>
  )
}
