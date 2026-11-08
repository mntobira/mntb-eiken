import React from 'react';

/**
 * QuestionFigure
 * ------------------------------------------------------------------
 * 問題・解説に付随する図版（PDF由来のイラストやグラフ）を、
 * アクセシブルかつ統一されたスタイルで表示するための共通コンポーネント。
 *
 * 目的（C1: 図・画像の改善）:
 *  - 図番号の自動採番（図1・図2 …）を figcaption 冒頭に付与する
 *  - alt テキストを必ず意味のある内容にする（キャプション→デフォルト文の順でフォールバック）
 *  - Quiz / Explanation で重複していた figure マークアップを一元化する
 *
 * ★ご要望「画像のある問題の画像が小さいので確認して。クリックしてズーム機能はいらない。」★
 *
 * ■ 実測（Playwright / getComputedStyle・390x844・化学基礎「ろ過」）
 *     naturalSize 1024x288 の図が 358x102 で描画されていた。
 *     リスニングの4コマ（1254x1254 の正方形）は Quiz 側の
 *     max-h-[22vh]（=186px）に当たり、横幅が余っているのに
 *     186px 角まで縮められていた＝「小さい」の実体。
 *
 * ■ 直し方（2点）
 *   (1) <img> を w-auto → w-full h-auto にする。
 *       w-auto だと「原寸より大きくならない」ので、原寸の小さい図は
 *       枠が余っていても小さいまま出ていた。w-full なら
 *       与えられた横幅いっぱいまで使う（縦は h-auto で比率維持）。
 *   (2) 高さ上限は呼び出し側（Quiz）で緩める。
 *       これまでは「小さくても、タップで拡大できるから情報は失わない」
 *       という前提で上限を強くしていたが、その拡大機能を外すので
 *       最初から読める大きさで出す必要がある。
 *
 * ■ ズーム（ライトボックス）は撤去した
 *     ご要望どおり「クリックしてズーム」は無くした。
 *     これにより
 *       ・図が <button> でなくなる（誤タップで全画面が出ない）
 *       ・右上の拡大アイコン（44px角）が図に重ならない
 *       ・createPortal / body の overflow 固定が消えてスクロールが素直になる
 *     という副作用の改善もある。
 */

interface QuestionFigureProps {
  /** 画像URL（public 配下の絶対パス等） */
  src: string;
  /** 図のキャプション（例: 「中和滴定に用いる器具（ア）〜（エ）」） */
  caption?: string;
  /**
   * 図番号。指定すると figcaption 冒頭に「図{number}」を表示する。
   * 省略時は番号を表示しない。
   */
  figureNumber?: number;
  /**
   * 明示的な代替テキスト。未指定の場合は caption、それも無ければ
   * 汎用的な説明文にフォールバックする。
   */
  alt?: string;
  /** 配色モード（小テスト=明色 / 演習=暗色）に合わせた文字色調整用 */
  tone?: 'light' | 'dark';
  /** figure の追加クラス（余白調整など） */
  className?: string;
  /**
   * <img> に足すクラス。
   *
   * 「スクロールとかしなくても選択肢の英文と図が一目に映るようにしてほしい」
   * に対応するため、リスニングの問題ブロックでは図に高さ上限を与えて
   * 1 画面に収める。ただし上限を強くしすぎると図が読めなくなるので、
   * ズーム撤去に合わせて上限は呼び出し側で緩めている。
   */
  imgClassName?: string;
  /**
   * 「親からもらえた高さいっぱいに図を伸ばす」モード。
   *
   * ★なぜ imgClassName に max-h-full を渡すだけでは駄目なのか★
   *   <img> の max-height:100% は「親の高さが確定しているとき」しか効かない。
   *   通常このコンポーネントの figure は高さ auto なので、
   *   パーセント指定の max-height は none として扱われ、
   *   画像は原寸で伸びて親からはみ出す（＝スクロールしないと見えない
   *   ＝ご指摘の「図が隠れてる」）。
   *
   *   そこで fill=true のときは figure → 画像ラッパ → img の全段に
   *   flex と min-h-0 を通し、高さの連鎖を成立させる。
   *   これで「余った高さだけを使って、縦を基準に縮小した図」になり、
   *   4コマイラスト全体が切れずに 1 画面へ収まる。
   *
   *   使う側（親）は flex コンテナで min-h-0 を持っていること。
   */
  fill?: boolean;
}

export function QuestionFigure({
  src,
  caption,
  figureNumber,
  alt,
  tone = 'light',
  className = 'mt-5',
  imgClassName = '',
  fill = false,
}: QuestionFigureProps) {
  // 図番号ラベル（例: 「図3」）
  const figureLabel = typeof figureNumber === 'number' ? `図${figureNumber}` : '';

  // alt テキストの決定（アクセシビリティ）。
  // 明示 alt > 「図N: キャプション」> キャプション > 汎用文 の優先順位。
  const resolvedAlt =
    alt ||
    (caption
      ? figureLabel
        ? `${figureLabel}：${caption}`
        : caption
      : figureLabel
        ? `${figureLabel}（問題の図）`
        : '問題に付随する図');

  const captionColor = tone === 'dark' ? 'text-[#E0E1DD]/70' : 'text-gray-500';
  const numberColor = tone === 'dark' ? 'text-[#5BC0BE]' : 'text-[#2C3E50]';

  /**
   * ★横長の図がスマホで極端に潰れる問題★
   *
   * ■ 実測（Playwright・390x844・化学基礎「ろ過」の (ア)〜(エ)）
   *     原寸 1024x288（比 3.56）を横幅 366px に合わせると高さ 103px。
   *     4つの器具が横に並ぶ図なので、1つあたり約 90x100px しかなく
   *     ガラス棒の位置・ろうとの足の接触といった判別点が読めない。
   *     ＝これがご指摘「画像のある問題の画像が小さい」の実体。
   *
   * ■ 直し方：潰れる図だけ「高さ基準」に切り替えて横スクロールさせる
   *     幅に合わせる（w-full h-auto）と、比が大きいほど高さが削られる。
   *     そこで高さを FIG_TARGET_VH（26vh＝390x844 で約 220px）に据え、
   *     幅は比なりに伸ばして親を溢れさせ、横スクロールで見せる。
   *     ろ過の図なら 220px 高 x 775px 幅（実測）になり、器具1つが
   *     約 190x220px。ズームを外しても判別できる大きさになる。
   *
   * ■ しきい値は「読める高さ」から逆算する（マジックナンバーにしない）
   *     スマホの問題ペインの実効幅は実測 366px。ここに幅を合わせたときの
   *     高さは 366/比 なので、
   *         366/比 < 220（=26vh）  ⇔  比 > 366/220 ≒ 1.66
   *     つまり比が約 1.7 を超える図は「幅に合わせると目標より低くなる」。
   *     この 1 本の条件だけで、
   *         3.56 / 3.28 / 3.16 / 2.18 / 2.11（実在する横長図）→ 高さ基準
   *         1.61 / 1.49 / 1.43（幅に合わせても 228〜257px 出る図）→ 従来どおり
   *     と自動的に振り分かれる。図を差し替えても閾値の再調整が要らない。
   *
   * ■ 判定は「画像そのものの事実」で行う（決め打ちしない）
   *     問題データに「横長フラグ」を足す方式は、図を差し替えたときに
   *     必ず食い違う。onLoad で naturalWidth/naturalHeight を読み、
   *     実際の比で判断する。
   *
   * ■ PC は変更しない
   *     PC は問題ペインが広く（実測 700px 超）、幅に合わせても
   *     高さが十分に出るので従来どおり。md: で元の指定に戻す。
   */
  const FIG_ASPECT_THRESHOLD = 1.7;
  const [aspect, setAspect] = React.useState<number | null>(null);

  /**
   * ★しきい値 1.7 だけでは「縦の短い端末」で逆に小さくなる★
   *
   * ■ 実測で見つけた不具合（地理 第4回「エネルギー自給率」900x524 / 比 1.718）
   *     390x844（26vh=219px）… 高さ基準 375x219  ／ 幅基準なら 358x208 → 高さ基準が正しい
   *     390x664（26vh=173px）… 高さ基準 295x173  ／ 幅基準なら 358x208 → ★幅基準の方が大きい★
   *   26vh は端末の高さで変わるのに、しきい値 1.7 は
   *   390x844（26vh=219px）だけを前提に 366/220 から逆算した固定値だった。
   *   画面の低い端末（iPhone SE や、URL バーが出ている状態）では
   *   26vh が 173px まで縮むため、
   *   「大きく見せるための切り替え」が ★かえって図を縮める★ ことになる。
   *   実測すると 295x173（面積 51,000px²）＜ 358x208（74,500px²）で、
   *   1.4 倍ほど小さい。しかも横スクロールという手間まで増える。
   *
   * ■ 直し方：比の固定値ではなく「どちらが実際に大きいか」で決める
   *     高さ基準の幅 = 26vh * 比
   *     幅基準の高さ = 枠の幅 / 比
   *   高さ基準が有利なのは 26vh > 枠の幅 / 比、すなわち
   *       比 > 枠の幅 / (26vh)
   *   という関係で、これは元の 366/220≒1.66 と同じ式である。
   *   違うのは ★分母の 26vh を実際の window.innerHeight から採る★ 点だけ。
   *   これで端末の高さが変わっても自動で正しい側に倒れる。
   *
   *   実測での振り分け（枠 358px）：
   *     844px 端末（26vh=219）→ しきい値 1.63：比 3.0 / 2.57 / 1.718 が高さ基準
   *     664px 端末（26vh=173）→ しきい値 2.07：比 3.0 / 2.57 が高さ基準、
   *                                            1.718（第4回）は幅基準＝大きい方
   *   どちらの端末でも「大きく表示される側」が選ばれる。
   *
   * ■ FIG_ASPECT_THRESHOLD は下限として残す
   *   計算式だけにすると、極端に横幅の狭い枠で比 1.2 の図まで
   *   高さ基準に倒れてしまう。元の意図（横長の図だけを対象にする）は
   *   保ちたいので、1.7 は「これ未満は対象にしない」下限として使う。
   */
  const scrollerRef = React.useRef<HTMLDivElement | null>(null);
  const [frameWidth, setFrameWidth] = React.useState<number | null>(null);
  const [viewportH, setViewportH] = React.useState<number | null>(null);

  React.useEffect(() => {
    const read = () => {
      const el = scrollerRef.current;
      // 枠の幅は「横スクロールしない状態での見えている幅」＝clientWidth
      if (el) setFrameWidth(el.clientWidth);
      setViewportH(window.innerHeight);
    };
    read();
    window.addEventListener('resize', read);
    return () => window.removeEventListener('resize', read);
  }, [aspect]);

  /**
   * 高さ基準に切り替えると本当に大きくなるか（実測値から判定）。
   * 測れていないあいだ（初回描画）は従来どおり幅基準にしておく。
   * ＝図が一瞬横スクロールしてから戻る、という揺れを起こさない。
   */
  const heightBasedIsBigger =
    aspect !== null &&
    frameWidth !== null &&
    viewportH !== null &&
    frameWidth > 0 &&
    // 高さ基準で得られる高さ（26vh）が、幅基準の高さ（枠幅/比）より大きいか
    viewportH * 0.26 > frameWidth / aspect;

  const isWide =
    !fill &&
    aspect !== null &&
    // 横長の図だけを対象にする（下限）
    aspect >= FIG_ASPECT_THRESHOLD &&
    // かつ、実際に高さ基準の方が大きくなる端末のときだけ
    heightBasedIsBigger;

  /**
   * ★fill モードでは「幅基準に切り替える」ことでは図は大きくならない★
   * ---------------------------------------------------------------
   * ご指摘（手書きの指示書）：
   *   第1問B・第2問の図を「大きめに」（縦も横も）。
   *
   * ■ 症状（390x664・第2問・問1 で実測）
   *     図の原寸 900x900（比 1.00）に対して描画は ★96x96★。
   *     横幅は 366px 空いているのに 270px を左右の空白として捨てていた。
   *
   * ■ 一度は「幅基準（w-full）に倒す」直し方を試したが、効かなかった
   *     img には max-h-full と object-contain が必要（枠から溢れさせない）。
   *     この状態で w-full を付けても、絵の実寸は
   *         min(枠の幅 / 比, 枠の高さ)
   *     ＝つまり★枠の高さで律速されたまま★で 1px も大きくならない。
   *     広がるのは img ボックスと、そこに付いている border だけ。
   *     実測でも 236x236 の絵に 366px 幅の枠が付き、
   *     「図の枠の中で絵が中央に浮く」不自然な見た目になった
   *     （枠は冊子の図枠を再現したものなので、絵より広いと意味が壊れる）。
   *     そのため w-full は撤回した。
   *
   * ■ 正しい直し方は「枠の高さそのものを増やす」
   *     figure は flex-1 なので、枠の高さは
   *       左ペインの高さ −（見出し ＋ 設問文 ＋ 音源バー ＋ 余白）
   *     で決まる。だから図を大きくするには
   *       ・figcaption を出さない（20px）        … ProblemPane
   *       ・音源ボタンを 44px → 36px に（8px）   … ListeningAudioPlayer
   *       ・短い英語の設問文を見出し行に載せる（36px）… ProblemPane
   *       ・①〜④ を4列1行にする（64px）         … MultipleChoiceControl
   *       ・見出し／図の上余白を詰める（8px）    … ProblemPane
   *     と、高さを食っている側を1つずつ削るしかない。
   *     実測：第2問 96x96 → 236x236（面積 6.0 倍）。
   *
   * ★同じ「幅基準に倒せば直る」という思い込みで戻さないこと★
   */

  /**
   * 「（横にスクロールできます）」の案内は、比ではなく
   * 実際に溢れているかどうかで出す。
   * 比 1.7〜2.0 の図は端末幅によっては溢れないことがあり、
   * 溢れていないのに「スクロールできます」と書くのは嘘になる。
   */
  const [overflowing, setOverflowing] = React.useState(false);
  React.useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const check = () => setOverflowing(el.scrollWidth > el.clientWidth + 1);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, [aspect, isWide]);

  return (
    <figure className={`${fill ? 'flex min-h-0 flex-1 flex-col' : ''} ${className}`}>
      {/* 画像本体。
          ここは <button> ではなく <div>。ズームを外したのでクリックしても何も起きない。
          fill のときだけ高さの連鎖（flex + min-h-0 + flex-1）を通す。 */}
      <div
        ref={scrollerRef}
        className={`w-full ${
          fill ? 'flex min-h-0 flex-1 items-start justify-center' : 'block'
        } ${
          // 横長の図はスマホだけ横スクロールで見せる（PC は溢れないので無効）。
          isWide ? 'overflow-x-auto md:overflow-x-visible' : ''
        }`}
      >
        <img
          src={src}
          alt={resolvedAlt}
          loading="lazy"
          decoding="async"
          onLoad={(e) => {
            const el = e.currentTarget;
            if (el.naturalWidth > 0 && el.naturalHeight > 0) {
              setAspect(el.naturalWidth / el.naturalHeight);
            }
          }}
          /*
            ★ご要望「四角囲みなど用いてもう少し見やすくして」（図の枠）★

            ■ 実測した変更前の値（390x664・地理 第1回の気候グラフ）
                border-top-width : 1px
                border-top-color : oklch(0.928 0.006 264.531)  ← gray-200
                                   対白コントラスト比 約 1.2:1
                border-radius    : 28px（rounded-xl ＝ --radius-xl: 1.75rem）
              つまり「ほぼ見えない線の、大きく丸まった角」で、
              図が本文に溶けていた（枠として機能していない）。

            ■ 実物の冊子（添付 tiri.pdf 5ページ・図1）
                図は ★細い黒の直線で四角く囲まれ★、角は立っている。
              枠があることで「ここからここまでが図」が一目で分かる。

            ■ 直し方（スマホのみ）
                角  : 28px → 2px（線を残しつつ冊子の角に寄せる）
                色  : gray-200 → slate-400（対白 約2.8:1／表の罫線と同じ濃さ）
                影  : shadow-sm を外す。冊子は影で浮かせず線で区切るため。
              PC は md: で従来値（rounded-xl / gray-200 / shadow-sm）へ戻す。
          */
          className={`mx-auto rounded-[2px] border border-slate-400 bg-white md:rounded-xl md:border-gray-200 md:shadow-sm ${
            // 高さの連鎖が通っているので、ここで初めて max-h-full が効く。
            // fill のときは「高さ基準で縮める」モードなので幅は auto のまま
            // （w-full にすると縦長の枠で横に伸びて比率が破綻する）。
            fill
              ? 'w-auto max-w-full min-h-0 max-h-full object-contain'
              : isWide
                // 横長：スマホは高さ基準（幅は比なり＝親を溢れる）。PC は従来どおり幅基準。
                ? 'h-[26vh] w-auto max-w-none md:h-auto md:w-full md:max-w-full'
                : 'w-full h-auto max-w-full'
          } ${imgClassName}`}
        />
      </div>

      {(caption || figureLabel) && (
        /*
          ★キャプションの並べ方（実物の冊子に合わせる）★

          ■ 実測した変更前の出力（390x664）
              「図1資料1　3地点の気候グラフ（A：バンコク／…）（横にスクロールできます）」
            図番号・資料名・操作案内が ★1行に連結★ されており、
            さらに mr-1 の右余白が全角スペースに吸われて
            「図1資料1」と ★くっついて読めていた★（実測の textContent どおり）。

          ■ 実物の冊子（tiri.pdf 5ページ）
              枠の下に注記が小さく置かれ、その下に「図1」だけが
              ★独立した中央寄せの1行★ として入る。
            図番号が単独行になることで、本文から図を参照するときの
            目印として機能する。

          ■ 直し方（スマホのみ）
              1行目：図N（中央・太字）を独立させる
              2行目：資料名（＝caption）
              3行目：横スクロールの案内（溢れているときだけ）
            PC は md: でインライン（従来の1行）に戻すため見た目は変わらない。
        */
        <figcaption className={`mt-2 shrink-0 text-center text-xs font-modern leading-relaxed ${captionColor}`}>
          {figureLabel && (
            <span className={`block font-bold md:mr-1 md:inline ${numberColor}`}>{figureLabel}</span>
          )}
          {caption && <span className="block md:inline">{caption}</span>}
          {/* 横長の図はスマホで画面外に続くので、そのことを明示する。
              （拡大ボタンを外した代わりの案内。実際に溢れているときだけ出す） */}
          {isWide && overflowing && (
            <span className="block md:hidden">（横にスクロールできます）</span>
          )}
        </figcaption>
      )}
    </figure>
  );
}
