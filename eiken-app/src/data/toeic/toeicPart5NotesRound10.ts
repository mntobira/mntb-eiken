/** TOEIC Part 5 第10回の解説の追加項目（着眼点・ポイント・TOEICでのコツ・手がかり）。並びは第10回の問1〜問30と同じ。空の要素は「追加なし」 */
import type { ToeicP5Note } from './toeicPart5NoteTypes';

export const NOTES_10: ToeicP5Note[] = [
  { // 1 dedication
    h: '空所の前の所有格 their と、後ろの to customer service を見る。店長がほめた中身を表す語が入る。',
    r: '所有格の後ろは名詞の位置。dedicate（動詞）に -ion を付けると名詞 dedication になり、to 〜 と組む。',
    tip: 'praise 人 for 〜 の for の後ろは、ほめる理由になる名詞。dedication、effort、contribution などが入る。',
    cues: [{ p: 'their' }, { p: 'to customer service', w: 'to 〜' }] },
  { // 2 beautifully
    h: '空所の前の is と、後ろの過去分詞 decorated を見る。受動態の間にはさまれた位置。',
    r: 'be 動詞と過去分詞の間に入り、その動作の様子を表すのは副詞。形容詞はこの位置に置けない。',
    tip: 'is ＿ decorated のように受動態が分かれていれば、-ly の副詞を選ぶ。形容詞 beautiful は外す。',
    cues: [{ p: 'decorated' }] },
  { // 3 durable
    h: '空所の前の a more と、後ろの名詞 battery を見る。名詞を説明し、more で比べられる語。',
    r: '冠詞と名詞の間で more の後ろに置くのは形容詞（比較級の形）。duration（名詞）は置けない。',
    tip: '製品の説明では durable、reliable、lightweight など性能を表す形容詞が使われる。品詞で先に絞る。',
    cues: [{ p: 'battery' }] },
  { // 4 relevant
    h: '空所の前の with と、後ろの名詞 experience を見る。どんな経験かを説明する語が入る。',
    r: '名詞を前から修飾するのは形容詞。relevance（名詞）や relevantly（副詞）は名詞の前に置けない。',
    tip: '求人の文では relevant experience、previous experience など experience と組む形容詞が使われる。',
    cues: [{ p: 'experience' }] },
  { // 5 traveler
    h: '空所の前の Each と、述語の will receive a printed map を見る。地図を受け取るのは人か物か。',
    r: 'each の後ろは可算名詞の単数形。主語の名詞は、述語の動作をする者として意味が通るものを選ぶ。',
    tip: 'Each の後ろの空所では、まず複数形を外し、残りから人の名詞（-er、-or、-ant）を探す。',
    cues: [{ p: 'Each' }] },
  { // 6 independently
    h: '空所の前の was と、後ろの過去分詞 reviewed、さらに by an outside accounting firm を見る。',
    r: '受動態の be と過去分詞の間は副詞の位置。independently は「第三者として・独立して」を表す。',
    tip: '監査や点検の文では independently reviewed、thoroughly checked など副詞＋過去分詞の組が使われる。',
    cues: [{ p: 'reviewed' }] },
  { // 7 is locked
    h: '主語 The parking garage が施錠する側かされる側かを考え、every night で時制を決める。',
    r: '毎日くり返すことは現在形。主語が動作を受け、目的語が無ければ is＋過去分詞 の受動態。',
    tip: 'every night や every day があれば現在形。受動態か能動態かは、空所の後ろに目的語があるかで決める。',
    cues: [{ p: 'every night', w: '毎晩' }, { p: 'The parking garage', w: '駐車場' }] },
  { // 8 was posted
    h: '主語の中心 The list と、文末の yesterday を見る。数・態・時制の3つを決める。',
    r: '主語が「名詞＋of＋名詞」なら of の前の名詞で数を決める。動作を受ける側で過去なら was＋過去分詞。',
    tip: '数・態・時制を同時に問う問題は、1つずつ確かめると迷わない。主語の中心語を最初に見つける。',
    cues: [{ p: 'The list' }, { p: 'yesterday' }] },
  { // 9 has managed
    h: '文頭の Since joining the firm in 2019 を見る。過去の時点から今までの期間を表している。',
    r: 'since ＋過去の時点（または -ing）は「〜以来」。今まで続いていることは現在完了で表す。',
    tip: 'Since が文頭にあり、後ろが動名詞の形でも時の起点を表す。主節には現在完了を当てはめる。',
    cues: [{ p: 'Since' }] },
  { // 10 passed
    h: '後半の主節の would begin を見る。主節に would があるとき、if 節の動詞の形に決まりがある。',
    r: '主節が would＋原形 の仮定法過去では、if 節の動詞は過去形を使う。現実と違う仮定や見込みを表す。',
    tip: 'if の文で主節に would、could があれば、if 節は過去形。will があれば if 節は現在形と覚えておく。',
    cues: [{ p: 'would begin' }] },
  { // 11 during
    h: '空所の後ろの the entire flight が名詞であることを見る。シートベルトを締めておく期間を表したい。',
    r: 'during ＋名詞 は「〜の間（ずっと）」。while は同じ意味の接続詞で、後ろに節を取る。',
    tip: 'during と while が並んだら、空所の後ろに動詞があるかを見る。名詞だけなら during を選ぶ。',
    cues: [{ p: 'the entire flight' }] },
  { // 12 Due to
    h: '空所の後ろの recent changes to the schedule が名詞句であることと、カンマの後ろの変更を見る。',
    r: 'due to ＋名詞 は「〜のために」と原因を表す群前置詞。because は節を取り、because of は名詞を取る。',
    tip: '理由の語が並んだら、空所の後ろが名詞か節かを先に見る。名詞なら due to や because of を選ぶ。',
    cues: [{ p: 'recent changes' }] },
  { // 13 from
    h: '空所の後ろの 7 A.M. to 9 P.M. を見る。to と組んで時間の範囲を表す語を考える。',
    r: '前置詞 from は to と組み、from A to B で「AからBまで」の範囲を表す。後ろに to があれば前は from。',
    tip: '営業時間の案内では from 〜 to 〜 や between 〜 and 〜 が使われる。後ろの to か and を手がかりにする。',
    cues: [{ p: 'to 9 P.M.', w: 'to' }] },
  { // 14 yourselves
    h: '空所の前の help と、後ろの to the coffee and pastries を見る。会議の参加者に呼びかけている。',
    r: 'help oneself to 〜 は「〜を自由に取る」。呼びかける相手が複数なら yourselves を使う。',
    tip: 'please help ＿ to 〜 の型は再帰代名詞が入る決まった言い方。相手が1人か複数かで形を選ぶ。',
    cues: [{ p: 'help', w: 'help oneself to' }] },
  { // 15 several
    h: '空所の後ろの of them と、前半の the new blenders を見る。返品されたのは複数の中のいくつか。',
    r: 'several of 〜 は「〜のうちのいくつか」。of の後ろには複数名詞や them などの代名詞が来る。',
    tip: '「＿ of them」の空所は、数量を表す代名詞（some、several、none、each）から意味で選ぶ。',
    cues: [{ p: 'of them' }] },
  { // 16 whether
    h: '空所の前の let us know を見る。know の目的語になるまとまりを、空所から文末までで作る。',
    r: '「〜かどうか」を表す名詞節は接続詞 whether（または if）で始める。後ろに節を取り、動詞の目的語になる。',
    tip: 'let us know、ask、decide の後ろの空所で、出席するかしないかの二択なら whether を当てはめる。',
    cues: [{ p: 'know' }] },
  { // 17 not only
    h: '空所の後ろの reduce costs と、その先の but also shorten delivery times を見る。2つの効果が並んでいる。',
    r: '相関の接続詞 not only A but also B は「AだけでなくBも」。A と B は同じ形（ここでは動詞の原形）にそろえる。',
    tip: '文の後ろに but also が見えたら、前の空所は not only に決まる。both なら and、either なら or と組む。',
    cues: [{ p: 'but also' }] },
  { // 18 whom
    h: '先行詞 The consultant が人であることと、空所の後ろの we hired に目的語が無いことを見る。',
    r: '先行詞が人で、関係詞節の中の他動詞に目的語が欠けていれば目的格の whom。主語が欠けていれば who。',
    tip: '「人＋空所＋主語＋他動詞」の後ろに述語動詞（has finished）が続く型は、目的格の関係代名詞を選ぶ。',
    cues: [{ p: 'consultant' }, { p: 'hired' }] },
  { // 19 how
    h: '空所の前の explains と、後ろの the coffee machine should be cleaned に欠けが無いことを見る。',
    r: '後ろが完全な節で「どのように〜か」を表すなら how。関係代名詞 what や which は後ろに欠けが要る。',
    tip: '説明書や案内の文で explain、show、learn の後ろが完全な節なら、how を最初に当てはめて確かめる。',
    cues: [{ p: 'the coffee machine should be cleaned', w: '完全な文' }] },
  { // 20 least
    h: '文頭の Of the three proposals と、空所の前の by far the を見る。3つの中での順位を表している。',
    r: '最上級は the most／the least ＋形容詞、または -est。by far は最上級を強めて「群を抜いて」を表す。',
    tip: 'Of the three や by far the があれば最上級。less（比較級）は than と組むので外して考える。',
    cues: [{ p: 'Of the three' }, { p: 'by far the' }] },
  { // 21 check out
    h: '空所の後ろの at the front desk と、文末の on the day of departure を見る。出発の日にする手続き。',
    r: 'check out は「（ホテルなどを）出る手続きをする」、check in は「到着の手続きをする」。',
    tip: 'ホテルの案内では出発日・時刻の指定があれば check out、到着の話なら check in を選ぶ。',
    cues: [{ p: 'day of departure' }, { p: 'front desk', w: 'フロント' }] },
  { // 22 offer
    h: '空所の後ろの free samples と、主語の The bakery を見る。店が客に対して試食品をどうするか。',
    r: '動詞の語彙問題は、主語と目的語の組み合わせで選ぶ。客に物やサービスを差し出すのは offer。',
    tip: '店の宣伝文では offer free samples、offer a discount など offer と特典の組が使われる。',
    cues: [{ p: 'free samples' }] },
  { // 23 reservation
    h: '空所の前の change their hotel と、後ろの online、until the day before arrival を見る。',
    r: '名詞の語彙問題は、前の名詞（hotel）と動詞（change）の両方と組んで意味が通るものを選ぶ。',
    tip: '旅行の文では hotel reservation、flight booking、cancellation policy などの組が使われる。',
    cues: [{ p: 'online', w: 'オンライン' }, { p: 'hotel', w: 'ホテル' }] },
  { // 24 portable
    h: '空所の前の lightweight and と、後半の easy to carry around job sites を見る。',
    r: '形容詞の語彙問題は、so の後ろの結果と結びつく性質を選ぶ。持ち運べることは portable で表す。',
    tip: 'lightweight and ＿ のように形容詞が並ぶ文では、空所も同じ方向の長所を表す語になる。',
    cues: [{ p: 'easy to carry around' }] },
  { // 25 unanimously
    h: '空所の後ろの selected と、by the committee を見る。委員会での選ばれ方を表す副詞を考える。',
    r: '副詞の語彙問題は、修飾する動詞と動作をする者に合うかで選ぶ。全員一致で決めることは unanimously。',
    tip: 'committee、board、members など複数の人が決める文では、unanimously や jointly が意味に合いやすい。',
    cues: [{ p: 'by the committee' }] },
  { // 26 conference
    h: '空所の前の held a press と、後ろの to announce its new line of electric scooters を見る。',
    r: '名詞の語彙問題は、前の語と組んで決まった言い方になるかで選ぶ。press conference は「記者会見」。',
    tip: '発表の場を表す組には press conference、press release、trade show がある。目的（to announce）から選ぶ。',
    cues: [{ p: 'to announce its new line', w: '新製品を発表する' }, { p: 'press' }] },
  { // 27 allocate
    h: '空所の後ろの an additional $2 million と、toward research and development を見る。お金の使い道。',
    r: 'allocate A to／toward B は「AをBに割り当てる」。動詞は目的語と前置詞の組で選ぶ。',
    tip: '予算の文で金額と使い道（toward 〜、for 〜）が並べば、allocate や set aside を候補にする。',
    cues: [{ p: 'research and development', w: '研究開発' }, { p: 'toward' }] },
  { // 28 available
    h: '空所の前の Free parking is と、後ろの to all visitors を見る。駐車場が来館者にとってどういう状態か。',
    r: 'be available to 人 は「人が利用できる」、be available for 〜 は「〜に使える」。前置詞と組で覚える。',
    tip: '施設の案内で「無料の〜が使える」と言うときは available が使われる。to や for と組むかで確かめる。',
    cues: [{ p: 'to all visitors', w: '来館者' }, { p: 'Free parking', w: '駐車場' }] },
  { // 29 positively
    h: '空所の前の has been と、後ろの received by younger viewers を見る。受け止められ方を表す副詞。',
    r: 'be received は評価の副詞と組む。positively／well は良い評価、poorly は悪い評価を表す。',
    tip: '広告や製品の評判の文では、according to 以下の調査結果と同じ向きの評価の副詞を選ぶ。',
    cues: [{ p: 'received' }] },
  { // 30 permission
    h: "空所の前の obtain their manager's と、後ろの before taking more than five days off を見る。",
    r: '名詞の語彙問題は、obtain の目的語として意味が通り、場面（休暇の申請）に合う名詞を選ぶ。',
    tip: '休暇や出張の規則の文では obtain permission、get approval など「許可を得る」組が使われる。',
    cues: [{ p: 'before taking more than five days off', w: '長い休みを取る前' }, { p: "their manager's", w: '上司' }] },
];
