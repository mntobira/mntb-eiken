/** TOEIC Part 5 第4回の解説の追加項目（着眼点・ポイント・TOEICでのコツ・手がかり）。並びは第4回の問1〜問30と同じ。空の要素は「追加なし」 */
import type { ToeicP5Note } from './toeicPart5NoteTypes';

export const NOTES_04: ToeicP5Note[] = [
  { // 1 its
    h: '空所の後ろの new electric truck と、それを作った主語 Fennick Motors を見る。持ち主は会社。',
    r: '会社・組織・物を受ける所有格は its。人の集まりを強く意識するときでも、社名は単数の its で受ける。',
    tip: '社名が主語の文で所有格を選ぶなら its を最初に当て、their や it\'s（＝it is）と取り違えない。',
    cues: [{ p: 'new electric truck' }, { p: 'Fennick Motors' }] },
  { // 2 inquiries
    h: '空所の前の direct と all を見る。direct の目的語で、all に続く語の形を考える。',
    r: 'all の後ろの名詞は、可算名詞なら複数形、不可算名詞なら単数形。動詞の目的語の位置は名詞。',
    tip: 'direct ＿ to 〜 は「〜へ回す・送る」。問い合わせ窓口の案内で使われる型として覚えておく。',
    cues: [{ p: 'direct' }, { p: 'all' }] },
  { // 3 serves
    h: '文末の every weekday と、主語の中心 The cafeteria を見る。くり返しの事柄で主語は単数。',
    r: '習慣や決まった予定は現在形で表す。主語が三人称単数なら動詞に -s を付ける。',
    tip: '営業時間や運行時刻の案内は現在形で書かれる。every 〜 があれば現在形の選択肢を確かめる。',
    cues: [{ p: 'every weekday' }, { p: 'The cafeteria', w: '主語' }] },
  { // 4 in
    h: '空所の直後の November を見る。日付まで決まっていない「月」だけが書かれている。',
    r: '月・年・季節の前は in、特定の日付・曜日の前は on。on November 5 のように日が付けば on に変わる。',
    tip: '時の前置詞は後ろの語が「月だけ」か「日付つき」かを最初に見る。そこで in と on が分かれる。',
    cues: [{ p: 'November', w: '月' }] },
  { // 5 convenient
    h: '空所の前の is very を見る。be 動詞の後ろで、very に強められる語が入る位置。',
    r: 'be 動詞の後ろで主語の性質を表す補語は形容詞。very は名詞を強めないので、名詞は入らない。',
    tip: 'is very ＿ の形なら、選択肢から形容詞の語尾（-ent、-ive、-ful など）を探すだけで答えが出る。',
    cues: [{ p: 'is very' }] },
  { // 6 workshop
    h: '空所の前の動詞 lead と、後ろの on time management を見る。「〜について」行うものを考える。',
    r: '名詞の語彙問題は、前の動詞（lead）と後ろの前置詞句（on 〜）の両方につながる名詞を選ぶ。',
    tip: '研修の場面では lead a workshop、hold a seminar、give a lecture のような動詞と名詞の組が使われる。',
    cues: [{ p: 'lead' }, { p: 'on time management', w: 'on 〜' }] },
  { // 7 whom
    h: '先行詞 The candidate が人であることと、空所の後ろの interviewed に目的語が無いことを見る。',
    r: '先行詞が人で、関係詞の後ろで目的語が欠けていれば目的格の whom（または that）。省略もできる。',
    tip: '関係詞の後ろに「主語＋他動詞」が続き目的語が無ければ目的格。主語が欠けていれば主格を選ぶ。',
    cues: [{ p: 'The candidate' }, { p: 'interviewed' }] },
  { // 8 present
    h: "空所の後ろの the results of the survey と、文末の Friday's meeting を見る。会議で結果をどうするか。",
    r: '動詞の語彙問題は、目的語を前置詞なしで取れるかを確かめる。present は他動詞で「発表する」。',
    tip: '会議の文では present、share、report などの「伝える」系の動詞が並ぶことがある。語法で絞る。',
    cues: [{ p: 'the results' }, { p: "Friday's meeting", w: '会議' }] },
  { // 9 has been closed
    h: '文末の since Monday morning と、主語 parking lot が閉める側か閉められる側かを見る。',
    r: 'since ＋過去の時点 は現在完了と組む。主語が動作を受ける側なら have／has been＋過去分詞。',
    tip: '完了と受動が重なる形は、since で完了、目的語の有無で受動を判断し、2段階で選ぶ。',
    cues: [{ p: 'since Monday morning' }, { p: 'parking lot', w: '駐車場' }] },
  { // 10 slightly
    h: '空所の直後の lower と、その後の than を見る。比較級の前に置ける語を考える。',
    r: '比較級を前から修飾するのは副詞。slightly は差が小さいこと、much や far は差が大きいことを表す。',
    tip: '比較級の前の空所では、意味より先に「副詞かどうか」で選択肢を半分に減らせる。',
    cues: [{ p: 'lower' }] },
  { // 11 while
    h: '空所の後ろに主語と動詞のある節があるかを見る。携帯電話を切っておく「期間」を表したい。',
    r: 'while は「〜している間」を表す接続詞で、後ろに節を取る。during は同じ意味の前置詞で名詞を取る。',
    tip: 'while と during が並んだら、空所の後ろに動詞（is など）があるかを見るだけで決まる。',
    cues: [{ p: 'the performance is in progress' }] },
  { // 12 compatible
    h: '空所の後ろの with と、ソフトウエアとスマートフォンという2つの物の関係を見る。',
    r: '形容詞は組む前置詞と一緒に覚える。be compatible with は「〜と互換性がある・両立できる」。',
    tip: '製品の説明文では compatible with、available in、suitable for など前置詞つきの形容詞が使われる。',
    cues: [{ p: 'with', w: 'with 〜' }, { p: 'smartphones', w: 'スマートフォン' }] },
  { // 13 himself
    h: '空所を消しても review important contracts で文が完成していることを確かめる。',
    r: '完成した文に再帰代名詞を足すと「自分で・本人が」と強める意味になる。主語が男性1人なら himself。',
    tip: 'rather than ask his assistant のように「人に頼まず」と対比されていれば、強調の再帰代名詞を考える。',
    cues: [{ p: 'review important contracts', w: '文はすでに完成' }] },
  { // 14 for
    h: '空所の後ろの two weeks を見る。数字で表された「期間の長さ」になっている。',
    r: '期間の長さ（two weeks、three days）の前は for。出来事の名前（the holiday）の前は during。',
    tip: '期間の前置詞は、後ろに数字があれば for を最初に当てはめると素早く判断できる。',
    cues: [{ p: 'two weeks' }] },
  { // 15 identification
    h: '空所の前の a valid form of と、文末の at the security desk を見る。警備の受付で見せるもの。',
    r: 'a form of ＋名詞 は「〜の一種」。of の後ろは名詞なので、identify ではなく identification を選ぶ。',
    tip: '建物の入館の文では photo ID、a form of identification、visitor badge などの語が組で使われる。',
    cues: [{ p: 'form of' }, { p: 'security desk', w: '警備の受付' }] },
  { // 16 considering
    h: '空所の前の After と、後ろの the proposal を見る。前置詞の後ろで、目的語も取れる形を考える。',
    r: '前置詞に動詞をつなげるには -ing 形（動名詞）にする。動名詞は動詞と同じように目的語を取れる。',
    tip: 'After／Before／By／Without の直後の空所では、まず -ing の選択肢を当ててみる。',
    cues: [{ p: 'After' }, { p: 'the proposal' }] },
  { // 17 turned down
    h: '後半の because the position required too much travel を見る。申し出をどうした理由かを考える。',
    r: 'turn down は「（申し出を）断る」、turn in は「提出する」、turn up は「現れる・音量を上げる」。',
    tip: 'because の後ろの理由が好ましくない内容なら、断る・延期するなど否定的な動作の句動詞を探す。',
    cues: [{ p: 'required too much travel', w: '出張が多すぎる' }, { p: 'the job offer', w: '採用の申し出' }] },
  { // 18 efficiency
    h: '空所の前の improve the と、後ろの of を見る。improve の目的語の中心になる語の位置。',
    r: 'the と of にはさまれ、動詞の目的語になる位置は名詞。efficient（形容詞）から -cy で名詞になる。',
    tip: 'improve の目的語には efficiency、quality、performance など「良くできる対象」を表す名詞が来る。',
    cues: [{ p: 'improve' }, { p: 'the' }, { p: 'of', w: 'of' }] },
  { // 19 carefully
    h: '空所の前の listening と、後ろの to their concerns を見る。聞き方を表す副詞が入る。',
    r: '動詞と前置詞の間の空所は副詞の位置。listen carefully to のように動詞のすぐ後ろに置ける。',
    tip: '信頼を得た・評価された理由を述べる文では、carefully、closely など丁寧さを表す副詞が合う。',
    cues: [{ p: 'listening', w: 'listen' }, { p: 'their concerns', w: '悩み' }] },
  { // 20 earlier
    h: '後半の the cheaper を見る。前半と後半が同じ形でそろう文になっている。',
    r: '「the＋比較級 〜, the＋比較級 …」は「〜すればするほど…」。前半も比較級にそろえる。',
    tip: 'カンマの後ろが the＋比較級で始まっていれば、前半の空所も比較級に決まる。意味は後で確かめる。',
    cues: [{ p: 'the cheaper' }, { p: 'book your flight', w: '予約' }] },
  { // 21 diagnose
    h: '空所の後ろの the problem with your heater と、後半の send you a repair estimate を見る。',
    r: '動詞の語彙問題では、文の中の動作の順番を考える。見積もりを出す前の段階は原因を調べること。',
    tip: '修理や点検の文では inspect、diagnose、repair など、作業の順番に沿った動詞が並ぶことがある。',
    cues: [{ p: 'repair estimate', w: '修理の見積もり' }, { p: 'the problem', w: '故障' }] },
  { // 22 general
    h: '空所の前の冠詞 a と、後ろの名詞 overview を見る。名詞を説明する語が入る位置。',
    r: '冠詞と名詞の間は形容詞の位置。generally（副詞）や generalize（動詞）は名詞を修飾できない。',
    tip: '入社研修の文では a general overview、a brief introduction など「おおまかな」を表す組が使われる。',
    cues: [{ p: 'overview' }] },
  { // 23 whatever
    h: '空所の前の ask と、後ろの questions you may have を見る。ask の目的語のまとまりを作る語を考える。',
    r: '複合関係詞 whatever＋名詞＋主語＋動詞 は「〜するどんな…でも」。全体で名詞のまとまりになり、目的語になれる。',
    tip: '関係詞の問題で空所の直後に冠詞の無い名詞が来たら、whatever や whose を候補に入れて確かめる。',
    cues: [{ p: 'ask' }, { p: 'questions' }] },
  { // 24 warranty
    h: '空所の前の a two-year と、後ろの on all of its kitchen appliances を見る。家電に付くものを考える。',
    r: '名詞の語彙問題は、期間を表す語（two-year）や対象（on 〜）と自然につながる名詞を選ぶ。',
    tip: '製品の販売の文では warranty、guarantee、refund などの語が使われる。期間と組むかで判断する。',
    cues: [{ p: 'two-year' }, { p: 'kitchen appliances', w: '家電' }] },
  { // 25 so that
    h: '前半の arrive fifteen minutes early と、後半の we can begin the factory tour on time の関係を見る。',
    r: 'so that ＋主語＋can／will は「〜できるように」と目的を表す接続詞。後ろに助動詞が来ることが多い。',
    tip: '空所の後ろの節に can や will が見えたら、目的の so that を候補の先頭に置いて意味を確かめる。',
    cues: [{ p: 'can' }, { p: 'on time', w: '時間どおり' }] },
  { // 26 will have opened
    h: '文頭の By the end of this year を見る。これから先の時点までに終わっていることを表したい。',
    r: 'by ＋未来の時点 は「〜までには」。その時点で完了している出来事は will have＋過去分詞（未来完了）。',
    tip: 'By the end of 〜 や By next month が文頭にあれば、未来完了の選択肢を最初に確かめる。',
    cues: [{ p: 'By the end of this year', w: 'By' }] },
  { // 27 closely
    h: '空所の前の working と、後ろの together を見る。協力の仕方を表す副詞を考える。',
    r: '副詞の語彙問題は、修飾する動詞と組んで自然な意味になるかで選ぶ。work closely は「緊密に働く」。',
    tip: '共同開発や提携の文では work closely、collaborate effectively など、協力の度合いを表す語が使われる。',
    cues: [{ p: 'working', w: 'work' }, { p: 'together' }] },
  { // 28 Fortunately
    h: '空所が文頭にあり、直後にカンマがあることを見る。後ろの文全体についての評価を表す位置。',
    r: '文頭でカンマを伴い、文全体を修飾するのは副詞。fortunate（形容詞）や fortune（名詞）は置けない。',
    tip: '文頭の「＿, 」の形では、-ly の副詞を選ぶ。意味は後ろの出来事が良い知らせか悪い知らせかで確かめる。',
    cues: [] },
  { // 29 within
    h: '空所の後ろの ten business days と、さらに後ろの of receiving the returned item を見る。',
    r: 'within ＋期間 は「〜以内に」。within 〜 of …の形で「…から〜以内に」と起点まで表せる。',
    tip: '返金や返品の規則の文では、within ＋日数 が期限を表す。by（期日）と for（期間の長さ）と比べて選ぶ。',
    cues: [{ p: 'ten business days', w: '10営業日' }, { p: 'of receiving', w: 'of 〜' }] },
  { // 30 eligible
    h: '空所の後ろの for promotion と、after only two years を見る。昇進について人が得た状態を考える。',
    r: 'be eligible for 〜 は「〜の資格がある」、be eligible to do は「〜する資格がある」。人を主語にする。',
    tip: '人事の文では eligible for、qualified for、responsible for など for と組む形容詞が並ぶことがある。',
    cues: [{ p: 'for promotion', w: '昇進' }, { p: 'after only two years', w: '入社2年' }] },
];
