/** TOEIC Part 5 第12回の解説の追加項目（着眼点・ポイント・TOEICでのコツ・手がかり）。並びは第12回の問1〜問30と同じ。空の要素は「追加なし」 */
import type { ToeicP5Note } from './toeicPart5NoteTypes';

export const NOTES_12: ToeicP5Note[] = [
  { // 1 orientation
    h: '空所の前の an と、後ろの session を見る。session と組んで新入社員の初日の行事を表す語が入る。',
    r: '名詞の前の名詞は、形容詞のように後ろの名詞の種類を表せる（複合名詞）。orientation session は「新人研修」。',
    tip: '入社初日の話では orientation、training、welcome などの語が session や program と組んで使われる。',
    cues: [{ p: 'session' }] },
  { // 2 specifically
    h: '空所の前の is と、後ろの過去分詞 designed を見る。受動態の間にはさまれた位置。',
    r: 'be と過去分詞の間で、その動作の様子を表すのは副詞。specific（形容詞）は -ally で副詞になる。',
    tip: 'is ＿ designed to do の型では、specifically や especially のように目的を強める副詞がよく入る。',
    cues: [{ p: 'designed' }] },
  { // 3 detailed
    h: '空所の前の冠詞 a と、後ろの名詞 analysis を見る。分析の性質を説明する語が入る位置。',
    r: '冠詞と名詞の間は形容詞の位置。detailed は過去分詞から生まれた形容詞で「詳しい」を表す。',
    tip: '報告書や分析の文では detailed analysis、thorough review、comprehensive report など詳しさを表す組が使われる。',
    cues: [{ p: 'analysis' }] },
  { // 4 announcement
    h: '空所の前の made a public と、後ろの about the safety を見る。made の目的語の中心になる語。',
    r: '冠詞＋形容詞の後ろで動詞の目的語になるのは名詞。announce（動詞）は -ment を付けて名詞になる。',
    tip: 'make an announcement、make a decision のように make と組む名詞は、まとまりで覚えておく。',
    cues: [{ p: 'a public', w: 'a public ______' }, { p: 'made', w: 'make' }] },
  { // 5 persuasive
    h: '空所の前後の a very と presentation を見る。リサイクル計画の発表がどんな発表だったかを表す語が入る。',
    r: '名詞 presentation を修飾し、副詞 very に強められるのは形容詞。persuade（動詞）は -sive で形容詞になる。',
    tip: 'persuade／persuasion／persuasive のような派生語は、語尾 -ive を手がかりに形容詞を選ぶ。',
    cues: [{ p: 'very' }, { p: 'presentation' }] },
  { // 6 conveniently
    h: '空所の前の are と、後ろの過去分詞 located、さらに near the airport を見る。',
    r: 'be と過去分詞の間は副詞の位置。conveniently located は「便利な場所にある」と立地を表す。',
    tip: '不動産や施設の紹介文では conveniently located、centrally located など副詞＋located の組が使われる。',
    cues: [{ p: 'located', w: 'located' }] },
  { // 7 had already left
    h: '後半の by the time Mr. Wade finally reached the terminal を見る。到着より前に起きたことを表したい。',
    r: '過去のある時点（到着）より前に完了していたことは過去完了（had＋過去分詞）。already は had の後ろに置く。',
    tip: 'by the time ＋過去形 が後ろにあれば、前半の動詞は過去完了。過去形や現在完了は外して考える。',
    cues: [{ p: 'by the time', w: 'by the time S reached' }] },
  { // 8 to lead
    h: '空所の前の has agreed を見る。この動詞の後ろに続ける動詞の形を考える。',
    r: 'agree、decide、plan、promise など、これからの行動を表す動詞は不定詞（to＋原形）を目的語に取る。',
    tip: 'agree to do は「〜することに同意する」、agree with 人 は「人に賛成する」。後ろの形で使い分ける。',
    cues: [{ p: 'has agreed', w: 'agree to do' }] },
  { // 9 purchased
    h: '空所の前の Items と、文の述語 cannot be exchanged を見る。空所は主語を後ろから説明する位置。',
    r: '名詞を後ろから説明する分詞は、名詞が「〜される」側なら過去分詞。品物は購入される側。',
    tip: '文に述語動詞がすでにあれば、空所は分詞。名詞が動作をする側か受ける側かで -ing と -ed を選ぶ。',
    cues: [{ p: 'Items', w: '品物' }, { p: 'cannot be exchanged', w: 'cannot be exchanged' }] },
  { // 10 comes
    h: '主語の Each of the new coffee makers を見る。中心は Each で、of 以下はその範囲を示す語句。',
    r: 'each of ＋複数名詞 は単数扱い。現在形なら動詞に -s を付ける。come with 〜 は「〜が付いている」。',
    tip: '動詞の直前の複数名詞（coffee makers）につられないよう、主語の先頭の Each に戻って数を決める。',
    cues: [{ p: 'Each of', w: 'Each of 〜' }] },
  { // 11 to
    h: '空所の前の has been moved と、後ろの Thursday at 10 A.M. を見る。予定の移動先を表したい。',
    r: 'move A to B は「AをBに移す」。変更後の日時や場所の前には to を置く。from は元の日時に使う。',
    tip: 'moved、changed、rescheduled などの後ろの日時は、変更先なら to、変更元なら from を選ぶ。',
    cues: [{ p: 'moved', w: 'move A to B' }] },
  { // 12 Regardless of
    h: '空所の後ろの the increase in material costs が名詞句であることと、カンマの後ろの「価格を変えない」を見る。',
    r: 'regardless of ＋名詞 は「〜にかかわらず」。後ろに名詞を取る群前置詞で、節は取らない。',
    tip: '費用の増加と価格の据え置きのように逆の内容が並べば、regardless of や despite を候補にする。',
    cues: [{ p: 'the increase', w: 'the increase' }] },
  { // 13 after
    h: '空所の後ろの their stay が名詞であることと、アンケートが届く時期を考える。',
    r: '前置詞 after ＋名詞 は「〜の後で」。before は「〜の前に」、during は「〜の間に」を表す。',
    tip: '時の前置詞は出来事の前後関係で選ぶ。アンケートや請求書は滞在や利用の後に届くことが多い。',
    cues: [{ p: 'their stay' }] },
  { // 14 it
    h: '空所の前の bring と、後ろの back、前半の the jacket を見る。持ってくる物は1着の上着。',
    r: '動詞の目的語の位置に置く代名詞は目的格。前に出た単数の物を受けるなら it を使う。',
    tip: 'bring ＿ back、pick ＿ up のように句動詞の間に入る代名詞は目的格。前に出た名詞の数で選ぶ。',
    cues: [{ p: 'the jacket' }] },
  { // 15 Neither
    h: '空所の後ろの of the two finalists has と、後半の so both will receive leadership training を見る。',
    r: 'neither of ＋複数名詞 は「2つのどちらも〜ない」。単数扱いで動詞は has などで受ける。',
    tip: '後半に both が出てきて、2人とも研修を受ける理由を述べていれば、前半は「どちらも経験がない」と考える。',
    cues: [{ p: 'so both will receive', w: 'so both will receive training' }, { p: 'has', w: 'has' }] },
  { // 16 in case
    h: '前半の print a few extra copies と、後半の more people attend than expected の関係を見る。',
    r: '接続詞 in case は「〜する場合に備えて」。前もって準備する理由を表し、後ろに節を取る。',
    tip: '予備や念のための準備（extra、spare）が前半にあれば、in case を候補の先頭に置いて確かめる。',
    cues: [{ p: 'extra copies', w: '予備' }] },
  { // 17 yet
    h: 'カンマの前の performed well in testing と、後ろの still found a few minor problems を見る。',
    r: '逆接の接続詞 yet は「けれども」。but と同じく2つの節をつなぎ、前と逆の内容を続ける。',
    tip: '後半に still や a few problems のような「それでも」の内容があれば、逆接の but や yet を選ぶ。',
    cues: [{ p: 'performed well', w: 'うまく機能した' }, { p: 'still found a few minor problems', w: 'それでも問題が見つかった' }] },
  { // 18 where
    h: '先行詞 The Harbor View Hotel が場所であることと、空所の後ろの節に欠けが無いことを見る。',
    r: '関係副詞 where は場所を表す先行詞を受け、後ろに完全な文を取る。カンマの後ろでも使える。',
    tip: '「場所＋カンマ＋空所＋完全な文」の型では where を最初に当てる。which は後ろに欠けが要る。',
    cues: [{ p: 'Hotel', w: 'hotel' }] },
  { // 19 However
    h: '空所の直後の busy が形容詞で、その後に the store becomes が続くことを見る。',
    r: '複合関係副詞 however＋形容詞・副詞＋主語＋動詞 は「どんなに〜でも」。程度を問わないことを表す。',
    tip: '文頭の空所の直後が形容詞なら However を確かめる。副詞の however（しかし）とは形が違う。',
    cues: [{ p: 'busy' }] },
  { // 20 much
    h: '空所の後ろの shorter と、than the one を見る。比較級を強める語が入る位置。',
    r: '比較級の差を大きく見せる語は much、far、even、still。very は比較級の前に置かないので外す。',
    tip: '比較級の前の空所に very と much が並んでいれば、much を選ぶ。意味は「ずっと〜」。',
    cues: [{ p: 'shorter' }] },
  { // 21 write up
    h: "空所の後ろの the notes from today's meeting と、and send them to everyone を見る。",
    r: '句動詞 write up は「（メモを）文書にまとめる」。write down は「書き留める」、write off は「帳消しにする」。',
    tip: '会議のメモを後で配る文では write up や type up のように「清書してまとめる」意味の語が合う。',
    cues: [{ p: 'notes', w: 'メモ' }] },
  { // 22 extend
    h: '空所の後ろの its business hours と、during the holiday season を見る。繁忙期に営業時間をどうするか。',
    r: '動詞の語彙問題は、目的語との組み合わせで選ぶ。時間や期間を長くすることは extend で表す。',
    tip: '店の営業時間の文では extend、shorten、change などが使われる。時期（繁忙期）から向きを決める。',
    cues: [{ p: 'business hours', w: 'extend business hours' }, { p: 'holiday season', w: '繁忙期' }] },
  { // 23 fee
    h: '空所の前の charges a small と、後ろの for guests who check out after noon を見る。',
    r: '名詞の語彙問題は、動詞（charge）と場面（遅いチェックアウト）に合う名詞を選ぶ。サービスの料金は fee。',
    tip: '料金を表す名詞には fee、fare、rate がある。fare は乗り物の運賃なので、場面で使い分ける。',
    cues: [{ p: 'charges', w: '払う料金' }] },
  { // 24 flexible
    h: '空所の後ろの hours と、including some evenings and weekends を見る。どんな勤務時間かを考える。',
    r: '形容詞の語彙問題は、including 以下の具体例に合う性質を選ぶ。時間帯が変わることは flexible で表す。',
    tip: '求人の文では flexible hours、part-time position など働き方を表す形容詞と名詞の組が使われる。',
    cues: [{ p: 'including some evenings and weekends', w: '夜や週末も含む' }] },
  { // 25 markedly
    h: '空所の後ろの higher と、than the company originally predicted を見る。比較級を強める副詞。',
    r: '比較級を前から修飾するのは副詞。markedly は差が「著しく・目立って」大きいことを表す。',
    tip: '予測と実際を比べる文では、markedly、considerably、slightly など差の大きさを表す副詞を探す。',
    cues: [{ p: 'higher' }] },
  { // 26 guidelines
    h: '空所の前の follow the safety と、後ろの posted on the wall を見る。壁に貼られ、従うべきもの。',
    r: '名詞の語彙問題は、動詞（follow）と前の名詞（safety）の両方と組んで意味が通るものを選ぶ。',
    tip: '工場や作業場の文では safety guidelines、safety regulations などが follow や comply with と組む。',
    cues: [{ p: 'posted on the wall', w: '壁に掲示' }, { p: 'follow', w: '従う' }] },
  { // 27 feature
    h: '空所の前の The next issue of Kitchen Life magazine と、後ろの an interview を見る。雑誌が記事をどう扱うか。',
    r: '動詞の語彙問題は、主語と目的語の組み合わせで選ぶ。雑誌が記事を目玉として載せることは feature。',
    tip: '雑誌や番組の文では feature、include、cover などが使われる。主語が媒体なら feature を確かめる。',
    cues: [{ p: 'an interview', w: 'feature an interview' }] },
  { // 28 famous
    h: '空所の前の is と、後ろの for its beautiful ceiling paintings を見る。劇場の評判を表す語。',
    r: '形容詞は組む前置詞と一緒に覚える。be famous for 〜 は「〜で有名だ」、be known as 〜 は「〜として知られる」。',
    tip: '観光地や施設の紹介文では famous for、known for、popular with など前置詞つきの形容詞が使われる。',
    cues: [{ p: 'for its beautiful ceiling paintings', w: '天井画' }] },
  { // 29 minutes
    h: "空所の前の The と後ろの of this morning's meeting、さらに will be emailed to all participants を見る。",
    r: '名詞の語彙問題は、場面（会議の後）と動作（参加者へ送る）に合う名詞を選ぶ。議事録は minutes（複数形）。',
    tip: '会議の後に配るものは minutes、会議の前に配るものは agenda。時の前後で使い分ける。',
    cues: [{ p: 'participants', w: '参加者' }] },
  { // 30 punctually
    h: '空所の前の arrive と、後半の as each one lasts exactly 20 minutes を見る。面接への来方を表す副詞。',
    r: '副詞の語彙問題は、as 以下の理由に合う意味を選ぶ。時間がきっちり決まっていれば、時間どおりに来る必要がある。',
    tip: '面接や会議の案内で時間の厳しさが書かれていれば、punctually や on time を候補にする。',
    cues: [{ p: 'exactly 20 minutes', w: '時間がきっちり決まっている' }] },
];
