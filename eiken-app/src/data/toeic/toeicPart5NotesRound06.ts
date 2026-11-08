/** TOEIC Part 5 第6回の解説の追加項目（着眼点・ポイント・TOEICでのコツ・手がかり）。並びは第6回の問1〜問30と同じ。空の要素は「追加なし」 */
import type { ToeicP5Note } from './toeicPart5NoteTypes';

export const NOTES_06: ToeicP5Note[] = [
  { // 1 they
    h: 'カンマの後ろの節を見る。空所の直後に助動詞 can と動詞 call が続き、主語が欠けている。',
    r: '節の主語の位置に置く代名詞は主格（I／he／she／we／they）。前に出た複数の人を受けるなら they。',
    tip: '空所の直後が助動詞や動詞なら主語の位置。目的格や所有格の選択肢はその時点で外せる。',
    cues: [{ p: 'can' }] },
  { // 2 requirements
    h: '空所の前の meet と all the を見る。meet の目的語で、all the に続く語の形を考える。',
    r: 'all the の後ろは名詞。可算名詞なら複数形にする。require（動詞）は -ment を付けて名詞になる。',
    tip: '求人の文では meet the requirements、meet the deadline のように meet と組む名詞が使われる。',
    cues: [{ p: 'meet', w: 'meet' }, { p: 'all the' }] },
  { // 3 was preparing
    h: '後半の when the projector suddenly stopped working を見る。過去の一点で、そのとき何をしていたか。',
    r: '過去のある時点で途中だった動作は過去進行形（was／were＋-ing）。その時点は when ＋過去形で示す。',
    tip: '「〜していたとき、…が起きた」の型では、長く続く方が過去進行形、急に起きた方が過去形になる。',
    cues: [{ p: 'when' }] },
  { // 4 along
    h: '空所の後ろの the road を見る。木が道に対してどう植えられているかを考える。',
    r: 'along は細長い物（道・川・海岸）に「沿って」。across は「横切って」、through は「通り抜けて」。',
    tip: '場所の前置詞は、後ろの名詞の形（細長い・面・中のある空間）を思い浮かべると選びやすい。',
    cues: [{ p: 'the road', w: '道' }] },
  { // 5 responsible
    h: '空所の前の is と、後ろの for training を見る。be 動詞の後ろで for と組む語を考える。',
    r: 'be responsible for 〜 は「〜を担当している・〜に責任がある」。be 動詞の後ろの補語は形容詞。',
    tip: '人事・業務分担の文では be in charge of と be responsible for が同じ意味で使われる。',
    cues: [{ p: 'is', w: 'be 動詞' }, { p: 'for training', w: 'for 〜' }] },
  { // 6 itinerary
    h: '空所の後ろの including flight times and hotel details を見る。何に含まれる情報かを考える。',
    r: '名詞の語彙問題は、including 以下に挙がった中身をまとめて表す名詞を選ぶ。',
    tip: 'including 〜 は前の名詞の具体例。具体例を先に読むと、空所の名詞の意味が絞り込める。',
    cues: [{ p: 'flight times', w: '飛行機の時刻' }, { p: 'hotel details', w: 'ホテルの詳細' }] },
  { // 7 when
    h: '先行詞 August が時を表すことと、空所の後ろの the weather is usually warm に欠けが無いことを見る。',
    r: '先行詞が時で、後ろが完全な文なら関係副詞 when。カンマの後ろで説明を加える使い方もできる。',
    tip: 'which と when で迷ったら、後ろの文で主語や目的語が欠けているかを見る。欠けが無ければ when。',
    cues: [{ p: 'August' }] },
  { // 8 reserve
    h: '空所の後ろの a meeting room と、文末の at least one day in advance を見る。前もってすること。',
    r: '動詞の語彙問題は、目的語を前置詞なしで取れるかを確かめる。reserve a room は「部屋を予約する」。',
    tip: 'in advance や beforehand があれば、予約・申し込み・提出など前もって行う動作の動詞を探す。',
    cues: [{ p: 'a meeting room', w: '会議室' }] },
  { // 9 is being renovated
    h: '主語 The main lobby が改装する側かされる側かを考え、this week と後半の案内から今の状態を見る。',
    r: '「今〜されている最中」は進行形の受動態（is／are being＋過去分詞）。主語が動作を受ける側で使う。',
    tip: '工事中の案内では is being repaired や is being renovated の形で、今使えない理由が示される。',
    cues: [{ p: 'this week' }, { p: 'The main lobby', w: 'ロビー' }] },
  { // 10 regularly
    h: '空所を消しても Fire alarms in the building are tested で文が成り立つことを確かめる。',
    r: '文が完成していれば、空所は修飾語の位置。動詞の頻度や様子を表すのは副詞。',
    tip: '受動態の後ろの空所は副詞の位置になりやすい。-ly の語を選び、意味を後で確かめる。',
    cues: [{ p: 'are tested' }] },
  { // 11 Once
    h: '空所の後ろの the contract is signed と、カンマの後ろの construction will begin の順番を見る。',
    r: 'once は「いったん〜したら・〜するとすぐ」を表す接続詞。時の接続詞の節では未来でも現在形を使う。',
    tip: '前半が条件となる出来事、後半がその後に始まることなら、once や as soon as を候補にする。',
    cues: [{ p: 'the contract is signed', w: '契約が結ばれたら' }] },
  { // 12 affordable
    h: '空所の後ろの rates と、前半の clean, comfortable rooms を見る。料金を良く言う形容詞を考える。',
    r: '形容詞の語彙問題は、修飾する名詞との組み合わせで選ぶ。料金・価格が「手ごろな」は affordable。',
    tip: 'ホテルや店の宣伝文では affordable、reasonable、competitive などが価格を表す名詞と組む。',
    cues: [{ p: 'rates', w: '料金（rates）' }] },
  { // 13 each other
    h: '主語の The two departments と、空所の前の communicate with を見る。2つの部署の関係を考える。',
    r: 'each other は「お互い」を表す代名詞で、前置詞や動詞の目的語になる。主語にはならない。',
    tip: 'communicate with、work with、compete with の後ろで2者の関係を表すなら each other を確かめる。',
    cues: [{ p: 'The two departments', w: '2つの部署' }] },
  { // 14 via
    h: '空所の後ろの our new mobile app を見る。支払いがどんな手段で行われるかを表す語を考える。',
    r: 'via は「〜を経由して・〜を使って」と手段や経路を表す前置詞。by も手段を表すが、後ろは無冠詞が多い。',
    tip: '連絡手段や支払い方法の文では via e-mail、via the website の形が使われる。手段を表す語を探す。',
    cues: [{ p: 'mobile app', w: 'アプリ' }] },
  { // 15 feedback
    h: '空所の後ろの from customers と on how to improve our services を見る。客から寄せられるもの。',
    r: 'feedback は不可算名詞で「意見・感想」。a を付けず複数形にもしない形の決まりがある。',
    tip: '客の声を表す名詞には feedback、comments、suggestions がある。不可算かどうかで形を見分ける。',
    cues: [{ p: 'from customers', w: '客から' }, { p: 'improve our services', w: 'サービス改善' }] },
  { // 16 to reduce
    h: '空所の前で The factory installed solar panels と文が完成していることを確かめる。',
    r: '完成した文の後ろに不定詞を置くと「〜するために」と目的を表す。in order to も同じ意味。',
    tip: '文が空所の前で終わっていて、後ろに名詞が続くなら、目的を表す to＋原形を最初に確かめる。',
    cues: [{ p: 'installed solar panels', w: '文は空所の前で完成' }] },
  { // 17 look into
    h: "空所の後ろの the customer's complaint と、文末の right away を見る。苦情に対してすることを考える。",
    r: 'look into は「調べる」、look after は「世話をする」、look forward to は「楽しみに待つ」。',
    tip: '苦情や問題を目的語にした句動詞は「調べる・対処する」の意味になることが多い。look into、deal with など。',
    cues: [{ p: "the customer's complaint", w: '苦情' }] },
  { // 18 competitors
    h: '空所の前の our main と、前半の prices are lower than those of を見る。値段を比べる相手を考える。',
    r: '人や会社を表す名詞と、行為を表す名詞が並んだら、比べる相手として意味が通る方を選ぶ。',
    tip: 'compete／competition／competitor／competitive の並びでは、語尾で人・行為・形容詞を見分ける。',
    cues: [{ p: 'our main' }] },
  { // 19 promptly
    h: '空所の前の reply と、後半の so that we can confirm your reservation を見る。返信の仕方を表す語。',
    r: '副詞の語彙問題は、目的（so that 以下）に合う意味を選ぶ。早く確定したいなら promptly（速やかに）。',
    tip: 'メールの依頼文では reply promptly、respond as soon as possible など、急ぎを表す言い方が使われる。',
    cues: [{ p: 'confirm your reservation', w: '予約を確定' }] },
  { // 20 even
    h: '空所の直後の faster と、その後の than を見る。比較級を強める語が入る位置。',
    r: '比較級を強めるのは even、much、far、still。very や so は原級を強める語で、比較級には付けない。',
    tip: '比較級の前の空所で very が選択肢にあれば、まずそれを外す。残りから意味の合うものを選ぶ。',
    cues: [{ p: 'faster' }] },
  { // 21 postponed
    h: '文末の because of the approaching storm を見る。嵐が近づいたとき、屋外のコンサートはどうなるか。',
    r: '動詞の語彙問題は、理由と自然につながる結果を選ぶ。予定を後に延ばすことは postpone。',
    tip: '天候や事故が理由の文では postponed、canceled、delayed など予定の変更を表す動詞が使われる。',
    cues: [{ p: 'approaching storm', w: '嵐が近づいていた' }] },
  { // 22 extensive
    h: '空所の前の has と、後ろの名詞 experience を見る。経験の多さを表す形容詞を考える。',
    r: '名詞を修飾するのは形容詞。extend（動詞）から -sive を付けると形容詞 extensive になる。',
    tip: '経歴の紹介では extensive experience、considerable expertise など経験の量を表す組が使われる。',
    cues: [{ p: 'experience' }] },
  { // 23 Whoever
    h: '空所から first までが文の主語で、その後に述語 should turn off が続くことを見る。',
    r: '複合関係詞 whoever は「〜する人は誰でも」。それ自体が主語になり、先行詞を前に置かない。',
    tip: '文頭の空所の直後に動詞があり、さらに後ろにもう1つ動詞があれば whoever や what を確かめる。',
    cues: [{ p: 'first' }] },
  { // 24 agenda
    h: "空所の後ろの for tomorrow's meeting と、has been sent to all participants を見る。会議の前に送るもの。",
    r: '名詞の語彙問題は、場面（会議）と動作（参加者へ送る）の両方に合う名詞を選ぶ。',
    tip: '会議の文では agenda、minutes、handout などが使われる。会議の前か後かで、どれが合うかが変わる。',
    cues: [{ p: 'all participants', w: '参加者' }] },
  { // 25 whereas
    h: 'カンマの前後を比べる。北部の売上が伸びたことと、南部の売上が横ばいだったことが並んでいる。',
    r: 'whereas と while は2つの事柄を対比する接続詞で、後ろに節を取る。however は副詞で節をつながない。',
    tip: '前後で同じ種類の主語（Sales in 〜）が比べられていれば、対比の接続詞を最初に確かめる。',
    cues: [{ p: 'rose sharply', w: '伸びた' }, { p: 'remained flat', w: '横ばい' }] },
  { // 26 had departed
    h: '文頭の By the time Mr. Lim arrived を見る。過去のある時点より前に終わっていた出来事を表したい。',
    r: '過去のある時点までに完了していたことは過去完了（had＋過去分詞）。基準の時点は過去形で示す。',
    tip: 'By the time ＋過去形 があれば、主節は過去完了を最初に当てはめて確かめる。',
    cues: [{ p: 'Mr. Lim arrived', w: 'リムさんが着いた' }] },
  { // 27 approximately
    h: '空所の直後の three months を見る。数値の前に置いて、その数がおおよそであることを表す語を探す。',
    r: '数値の前に置く副詞は approximately、about、nearly、roughly など。数値の幅や近さを表す。',
    tip: '空所の直後が数字なら、approximately や nearly が候補になる。動詞や形容詞を修飾する副詞は外す。',
    cues: [{ p: 'three months', w: '3か月' }] },
  { // 28 employment
    h: '空所の前の provide と、後ろの for more than 500 local residents を見る。住民に与えるもの。',
    r: '動詞の目的語は名詞。employ（動詞）は -ment で名詞 employment、-ee で人の名詞 employee になる。',
    tip: '同じ語から作られた名詞が並んだら、人（employee）か事柄（employment）かを文の意味で選ぶ。',
    cues: [{ p: 'provide', w: 'provide' }] },
  { // 29 on behalf of
    h: '空所の後ろの the entire design team と、前半の accepted the award を見る。誰に代わって受け取ったか。',
    r: '群前置詞 on behalf of 〜 は、人や団体の代わりに何かを行うことを表し、後ろに名詞を取る。',
    tip: '受賞や挨拶の文では on behalf of が使われる。in spite of、instead of など形の似た語と取り違えない。',
    cues: [{ p: 'the entire design team', w: 'チーム全体' }] },
  { // 30 mandatory
    h: '空所の前の Attendance と、後ろの for all factory workers を見る。研修への出席がどういう扱いか。',
    r: '形容詞の語彙問題は、主語と for 以下の対象から意味を決める。義務であることは mandatory で表す。',
    tip: '規則の文では mandatory、required、optional など「義務か任意か」を表す形容詞が並ぶことがある。',
    cues: [{ p: 'Attendance', w: '出席' }, { p: 'for all factory workers', w: 'for 〜' }] },
];
