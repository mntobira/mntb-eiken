/** TOEIC Part 5 第5回の解説の追加項目（着眼点・ポイント・TOEICでのコツ・手がかり）。並びは第5回の問1〜問30と同じ。空の要素は「追加なし」 */
import type { ToeicP5Note } from './toeicPart5NoteTypes';

export const NOTES_05: ToeicP5Note[] = [
  { // 1 your
    h: '空所の直後の reading needs を見る。読書の用事は誰のものか、話しかけている相手を考える。',
    r: '客に向けたお礼や案内の文で、相手の持ち物を表す所有格は your。所有格の後ろには名詞が続く。',
    tip: 'Thank you for 〜 で始まる文は客への呼びかけ。所有格の空所なら your を最初に当ててみる。',
    cues: [{ p: 'reading needs' }] },
  { // 2 publication
    h: '空所の前の冠詞 The と、後ろの of the annual report を見る。文の主語の中心になる位置。',
    r: '冠詞と of にはさまれた主語の中心は名詞。動詞 publish は -ation を付けて名詞 publication になる。',
    tip: '述語動詞 has been delayed の主語として、遅れることができる「行為・出来事」の名詞を選ぶ。',
    cues: [{ p: 'The' }, { p: 'of' }] },
  { // 3 printed
    h: '文末の yesterday を見る。新聞が記事を載せた時期は過去に決まっている。',
    r: '過去の一点を表す語（yesterday、last 〜、〜 ago）があれば過去形。現在完了とは一緒に使わない。',
    tip: '時制の問題は文末に時の語句が置かれやすい。空所の前後で迷ったら、まず文の最後まで目を通す。',
    cues: [{ p: 'yesterday' }] },
  { // 4 next to
    h: '空所の前の is located と、後ろの the main post office を見る。2つの建物の位置関係を表したい。',
    r: '場所の前置詞は位置関係で選ぶ。next to は「隣に」、across from は「向かいに」、behind は「後ろに」。',
    tip: '道案内や店舗の紹介文では、is located の後ろに位置を表す前置詞が来る。建物どうしの関係を思い描く。',
    cues: [{ p: 'The new copy center', w: '建物' }] },
  { // 5 competitive
    h: '空所の前の動詞 offers と、後ろの名詞 prices を見る。名詞を説明する語が入る位置。',
    r: '動詞の目的語になる名詞の前に1語足すなら形容詞。compete（動詞）から -itive で形容詞になる。',
    tip: '販売の文では competitive prices、reasonable rates など値段を表す名詞と形容詞の組が使われる。',
    cues: [{ p: 'offers' }, { p: 'prices' }] },
  { // 6 editor
    h: '空所の前の send your article to the と、後半の appear in the next issue を見る。記事の送り先は誰か。',
    r: '人と物の名詞が並んだら、文の中の役割（送る相手・連絡する人）として意味が通るものを選ぶ。',
    tip: '出版の場面では editor、issue、article、submit などの語が組で使われる。送り先は人の名詞になる。',
    cues: [{ p: 'your article', w: '記事' }, { p: 'next issue', w: '次の号' }] },
  { // 7 that
    h: '先行詞 The report が人か物かを見て、空所の後ろの submitted に目的語があるかを確かめる。',
    r: '先行詞が物で、関係詞の後ろの他動詞に目的語が欠けていれば、目的格の which か that（省略も可）。',
    tip: '関係詞の後ろが「人名＋動詞」で終わっていれば目的格。人を表す who や whose は外して考える。',
    cues: [{ p: 'The report' }, { p: 'submitted' }] },
  { // 8 unveil
    h: '空所の後ろの its new logo と、文末の at a press conference を見る。記者会見でロゴをどうするか。',
    r: '動詞の語彙問題は、目的語と場面の両方に合うものを選ぶ。unveil は新しい物を初めて公開すること。',
    tip: '新製品や新デザインの話では unveil、launch、introduce などの語が使われる。目的語との組で選ぶ。',
    cues: [{ p: 'press conference', w: '記者会見' }, { p: 'its new logo', w: '新しいロゴ' }] },
  { // 9 will be announced
    h: '主語の The winners が発表する側かされる側かを考え、文末の next month で時を決める。',
    r: '未来の受動態は will be＋過去分詞。主語が動作を受け、時がこれから先なら、この形を選ぶ。',
    tip: '態と時制が同時に問われたら、目的語の有無で態を、時の語句で時制を決めると選択肢が1つ残る。',
    cues: [{ p: 'The winners', w: '受賞者' }, { p: 'next month' }] },
  { // 10 quietly
    h: '空所の前の動詞 operates と、後ろの enough to be used を見る。動き方を表す語が入る位置。',
    r: '動詞を修飾するのは副詞。enough は形容詞や副詞の後ろに置いて「〜できるほど」と程度を表す。',
    tip: '空所の後ろに enough があれば、その前は形容詞か副詞。前の語が動詞なら副詞を選ぶ。',
    cues: [{ p: 'operates' }, { p: 'enough' }] },
  { // 11 Since
    h: '空所の後ろが節であることを確かめ、インク切れとコピーセンターへの依頼の関係を見る。',
    r: '理由を表す接続詞には because、since、as がある。文頭に置いて理由を先に言うときは since も使える。',
    tip: '文頭の Since は「〜以来」と「〜なので」の2つの意味がある。後ろの時制と内容で見分ける。',
    cues: [{ p: 'is out of ink', w: 'インク切れ' }, { p: 'copy center', w: 'コピーセンター' }] },
  { // 12 favorable
    h: '空所の後ろの reviews from critics と、後半の became a box-office success を見る。',
    r: '形容詞の語彙問題は、文の後半の結果（ここでは興行的な成功）と同じ向きの意味の語を選ぶ。',
    tip: 'and で2つの内容がつながる文では、前後が同じ向き（良い・悪い）になっているかを手がかりにする。',
    cues: [{ p: 'box-office success', w: '興行的にも成功' }, { p: 'reviews', w: '批評' }] },
  { // 13 Those
    h: '空所の直後の who を見る。空所が文の主語になり、who 以下で説明を受けている。',
    r: 'those who 〜 は「〜する人々」。代名詞 those は後ろに関係代名詞や修飾語句を続けて主語にできる。',
    tip: '文頭の空所の後ろに who が続けば、those を最初に確かめる。they や them は who を続けられない。',
    cues: [{ p: 'who' }] },
  { // 14 regarding
    h: '空所の前の questions と、後ろの the press release を見る。どんな質問かを説明する語が入る。',
    r: 'regarding、concerning、about は「〜に関して」と話題を表す前置詞。後ろに名詞を取る。',
    tip: '問い合わせ先を案内する文では questions regarding 〜 の形が使われる。話題を表す前置詞を探す。',
    cues: [{ p: 'the press release', w: '報道発表' }, { p: 'questions', w: '質問' }] },
  { // 15 decision
    h: '空所の後ろの to expand into overseas markets と、述語の surprised many analysts を見る。',
    r: 'decision to do、plan to do、ability to do のように、名詞の中には後ろに不定詞を続けるものがある。',
    tip: '所有格の後ろの空所に名詞を選ぶとき、後ろの to do と組めるかで意味の近い名詞を絞り込む。',
    cues: [{ p: 'to expand into overseas markets', w: '海外進出' }, { p: 'surprised many analysts', w: 'アナリストを驚かせた' }] },
  { // 16 moving
    h: '空所の直前の動詞 suggested を見る。この動詞の後ろに続けられる形を考える。',
    r: 'suggest は目的語に動名詞を取り、不定詞は取らない。recommend や consider も同じ型で使う。',
    tip: 'suggest の後ろは「-ing」か「that＋主語＋原形」の2つの型。to do の選択肢は外してよい。',
    cues: [{ p: 'suggested', w: 'suggest' }] },
  { // 17 call off
    h: '空所の後ろの their merger talks と、文末の because of legal concerns を見る。',
    r: 'call off は「中止する・取りやめる」。call for は「求める」、call back は「折り返し電話する」。',
    tip: '懸念や問題が理由として書かれていれば、中止・延期の意味の句動詞を候補にして確かめる。',
    cues: [{ p: 'legal concerns', w: '法的な懸念' }, { p: 'merger talks', w: '交渉' }] },
  { // 18 donations
    h: '空所の前の前置詞 on と、後ろの from local businesses を見る。前置詞の後ろに来る形を考える。',
    r: '前置詞の後ろは名詞の位置。可算名詞で数が多いものを表すときは複数形にする。',
    tip: 'rely on ＿ from 〜 の形では、from の後ろの出どころから受け取る物（寄付・支援）の名詞を探す。',
    cues: [{ p: 'on' }, { p: 'from', w: 'from' }] },
  { // 19 highly
    h: '空所の後ろの successful と、後半の increasing sales by 30 percent を見る。成功の度合いを考える。',
    r: '形容詞を強める副詞は組み合わせで決まる。successful には highly、aware には fully などが合う。',
    tip: '結果を数字で示す文では、その数字の大きさから程度の副詞（highly、slightly）の向きを判断する。',
    cues: [{ p: 'increasing sales by 30 percent', w: '売上30パーセント増' }, { p: 'successful', w: '成功' }] },
  { // 20 most
    h: '空所の前の the と、後ろの widely read、文末の in the region を見る。範囲の中での1番を表す。',
    r: '副詞の最上級は most＋副詞（the most widely）。-ly の副詞は -est を付けず most を前に置く。',
    tip: '範囲を表す in the region や of all 〜 があれば最上級。more（比較級）は than がある文で使う。',
    cues: [{ p: 'the' }, { p: 'widely', w: 'widely' }, { p: 'in the region' }] },
  { // 21 anticipate
    h: '空所の後ろの that 節を見る。利益が伸びるという内容を、アナリストがどう扱うかを考える。',
    r: 'that 節を目的語に取る動詞は限られる。anticipate、expect、predict は that 節で予想の中身を示せる。',
    tip: '意味の近い動詞が並んだら、空所の後ろが that 節か名詞か不定詞かを見て、語法で絞り込む。',
    cues: [{ p: 'that', w: 'that 節' }, { p: 'profits will rise', w: '利益が伸びる' }] },
  { // 22 innovative
    h: '空所の前の所有格 its と、後ろの名詞 approach を見る。名詞を説明する語が入る位置。',
    r: '所有格と名詞の間は形容詞の位置。innovate（動詞）から -ive を付けると形容詞 innovative になる。',
    tip: 'is known for its ＿ 〜 の形では、会社の特徴を表す形容詞が入る。語尾で形容詞を見つける。',
    cues: [{ p: 'its' }, { p: 'approach' }] },
  { // 23 in which
    h: '空所の後ろの Ms. Lee works に目的語や場所の語が無いことと、先行詞 The department を見る。',
    r: '関係詞の後ろで前置詞の目的語が欠けていれば「前置詞＋関係代名詞」。場所なら where とも言える。',
    tip: '前置詞つきの関係詞は、先行詞を後ろの文に戻して読むと、どの前置詞が要るかが分かる。',
    cues: [{ p: 'Ms. Lee works' }, { p: 'The department', w: 'the department' }] },
  { // 24 discount
    h: '前半の spend over $100 と、空所の後ろの on their next purchase を見る。客が受け取る特典を考える。',
    r: '名詞の語彙問題は、数字（10 percent）と後ろの前置詞（on 〜）の両方に合う名詞を選ぶ。',
    tip: '販売促進の文では discount、coupon、voucher などが使われる。割合の数字と組むかで判断する。',
    cues: [{ p: 'spend over $100', w: '100ドル以上買った' }, { p: 'next purchase', w: '次回の買い物' }] },
  { // 25 unless
    h: '前半の cannot enter the server room と、後半の have special permission の関係を見る。',
    r: 'unless は「〜しない限り」と条件を表す接続詞。if 〜 not に近い意味で、後ろに節を取る。',
    tip: '前半に否定の内容（cannot、will not）があり、後半が例外の条件なら unless を当てはめてみる。',
    cues: [{ p: 'special permission', w: '特別な許可' }, { p: 'cannot enter', w: '入れない' }] },
  { // 26 attend
    h: '文頭の It is essential that を見る。that の後ろの動詞の形に決まりがある型かどうかを考える。',
    r: 'essential、necessary、important などの後ろの that 節では、主語が単数でも動詞は原形を使う。',
    tip: 'It is ＿ that 〜 や request that 〜 を見たら、that 節の動詞に -s や will の無い原形を選ぶ。',
    cues: [{ p: 'essential' }] },
  { // 27 widely
    h: '空所の後ろの distributed と、文末の all major newspapers in the country を見る。配られた範囲を考える。',
    r: '副詞の語彙問題は、修飾する動詞と組んで自然かで選ぶ。distribute には widely（広く）が合う。',
    tip: '報道や広告の文では widely distributed、widely read、widely used など widely の組が使われる。',
    cues: [{ p: 'all major newspapers in the country', w: '国内の主要紙すべて' }, { p: 'distributed', w: '配られた' }] },
  { // 28 director
    h: '空所の前の The と後ろの of、さらに述語の will speak を見る。話すのは人なので人の名詞が入る。',
    r: '主語になる名詞を選ぶときは、述語動詞の動作をする者として意味が通るかを確かめる。',
    tip: 'direct／director／direction のように同じ語から作られた名詞は、人か物事かを語尾で見分ける。',
    cues: [{ p: 'The' }, { p: 'of' }, { p: 'will speak' }] },
  { // 29 prior to
    h: '空所の後ろの departure が名詞であることを確かめる。名詞の前に置けて「〜の前に」を表す語を探す。',
    r: 'prior to は「〜より前に」を表す群前置詞で、後ろに名詞を取る。before も前置詞として名詞を取れる。',
    tip: '空港や手続きの案内では prior to departure の形が使われる。接続詞の選択肢は後ろが名詞なので外す。',
    cues: [{ p: 'departure' }] },
  { // 30 concise
    h: '空所の前の make the article more と、後ろの by removing unnecessary details を見る。',
    r: '形容詞の語彙問題は、by 以下の方法から目指す状態を考える。不要な部分を削れば記事は短く簡潔になる。',
    tip: 'by ＋-ing は手段を表す。手段を先に読むと、その結果としてどんな状態になるかが予想できる。',
    cues: [{ p: 'removing unnecessary details', w: '不要な部分を削って' }, { p: 'more', w: 'もっと' }] },
];
