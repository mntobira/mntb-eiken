/** TOEIC Part 5 第13回の解説の追加項目（着眼点・ポイント・TOEICでのコツ・手がかり）。並びは第13回の問1〜問30と同じ。空の要素は「追加なし」 */
import type { ToeicP5Note } from './toeicPart5NoteTypes';

export const NOTES_13: ToeicP5Note[] = [
  { // 1 maintenance
    h: '空所の前の for routine を見る。前置詞 for と形容詞 routine の後ろで、閉鎖の理由を表す語が入る。',
    r: '前置詞＋形容詞の後ろは名詞の位置。maintain（動詞）の名詞は maintenance で、つづりが変わる点に注意。',
    tip: '設備の閉鎖を知らせる文では routine maintenance、scheduled repairs など点検・修理の名詞が使われる。',
    cues: [{ p: 'for' }, { p: 'routine' }] },
  { // 2 directly
    h: '空所を消しても report any damaged packages で文が成り立つことと、後ろの to the shipping department を見る。',
    r: '文が完成していれば空所は修飾語の位置。動詞と前置詞句の間で動作の仕方を表すのは副詞。',
    tip: 'report directly to、contact directly のように、報告や連絡の相手を示す前に directly がよく置かれる。',
    cues: [{ p: 'report any damaged packages' }] },
  { // 3 comfortable
    h: '空所の前の is much more と、後ろの than the old one を見る。比較級を作る more の後ろの語。',
    r: '主語の性質を表す補語なので形容詞が入る。more＋形容詞＋than で比較級になり、much がその差を強める。',
    tip: 'more ＿ than の空所は、形容詞か副詞の原級。be 動詞の後ろなら形容詞を選ぶ。',
    cues: [{ p: 'is' }] },
  { // 4 supplier
    h: '空所の前の a contract with a new と、後ろの of recycled packaging materials を見る。契約の相手。',
    r: 'contract with ＋相手 の相手は会社や人。supply（動詞・名詞）に -er を付けると人・会社を表す名詞になる。',
    tip: 'supply／supplier／supplies の並びでは、契約や取引の相手として読めるかで人・会社の名詞を選ぶ。',
    cues: [{ p: 'a contract with', w: 'a contract with 〜' }] },
  { // 5 profitable
    h: '空所の前の the most と、後ろの名詞 period、さらに in the history of を見る。最上級の形容詞が入る。',
    r: '名詞を修飾する最上級は the most＋形容詞。profit（名詞）に -able を付けると形容詞 profitable になる。',
    tip: '業績の文で in the history of 〜 があれば最上級。the most の後ろは形容詞を探す。',
    cues: [{ p: 'period' }] },
  { // 6 efficiently
    h: '空所の前の handle customer requests more を見る。文の形は完成していて、more の後ろに修飾語が入る。',
    r: '動詞を修飾する副詞も比較級にできる。-ly の副詞は more＋副詞 で比較級を作る。',
    tip: '文末の more ＿ は、前の動詞を修飾するなら副詞、be 動詞の補語なら形容詞。文の形で見分ける。',
    cues: [{ p: 'handle customer requests' }] },
  { // 7 will have completed
    h: '文頭の By next March を見る。これから先の時点までに終わっていることを表したい。',
    r: 'by ＋未来の時点 の文では、その時点で完了していることを未来完了（will have＋過去分詞）で表す。',
    tip: 'By next 〜、By the end of 〜 が未来を指していれば、will have＋過去分詞 を最初に確かめる。',
    cues: [{ p: 'By next March' }] },
  { // 8 must be received
    h: '主語 Applications が受け取る側か受け取られる側かを考え、選択肢の助動詞の形も見る。',
    r: '助動詞の後ろの受動態は「助動詞＋be＋過去分詞」。主語が動作を受け、目的語が無ければこの形。',
    tip: 'no later than ＋日付 は締め切りを表す。締め切りの文では must be received や must be submitted が使われる。',
    cues: [{ p: 'Applications', w: '応募書類' }] },
  { // 9 repaired
    h: '空所の前の have the copy machine と、後ろの by a technician を見る。コピー機は修理する側かされる側か。',
    r: '使役の have は、目的語が物で「〜される」側なら have＋物＋過去分詞。人なら have＋人＋原形。',
    tip: 'have や get の後ろの目的語が物で、後ろに by ＋人 があれば過去分詞を選ぶ。',
    cues: [{ p: 'the copy machine', w: 'コピー機' }, { p: 'by a technician' }] },
  { // 10 building
    h: '空所の前の are considering を見る。consider の目的語として続けられる動詞の形を考える。',
    r: 'consider は目的語に動名詞を取る動詞。進行形 are considering でも後ろは -ing の形になる。',
    tip: '動詞が進行形でも、後ろの目的語の形は変わらない。consider の後ろなら -ing を選ぶ。',
    cues: [{ p: 'considering', w: 'consider' }] },
  { // 11 without
    h: '空所の後ろの a safety badge が名詞であることと、前半の may not enter を見る。入れない条件を考える。',
    r: '前置詞 without ＋名詞 は「〜なしで」。with は「〜を持って」、within は「〜以内に」を表す。',
    tip: '入室や参加の規則では without ＋必要な物 の形で禁止の条件を示す。否定の動詞と組むかを確かめる。',
    cues: [{ p: 'a safety badge' }] },
  { // 12 ahead of
    h: '空所の前の two days と、後ろの schedule を見る。予定に対していつ終わったかを表したい。',
    r: '前置詞句 ahead of schedule は「予定より早く」、behind schedule は「予定より遅れて」。',
    tip: 'schedule の前の空所では ahead of、behind、on のどれかを入れる。前に日数があれば早さや遅さの話。',
    cues: [{ p: 'two days', w: 'two days' }] },
  { // 13 among
    h: '空所の前の popular と、後ろの younger employees を見る。人気がある集団を表す語を考える。',
    r: '3人以上の集団の「間で」は among、2つの「間で」は between。popular among 〜 は「〜の間で人気」。',
    tip: '後ろに複数の人の集団（employees、students）が来ていれば among を当てはめてみる。',
    cues: [{ p: 'popular' }] },
  { // 14 ourselves
    h: '空所を消しても organize the company anniversary party で文が成り立つことと、主語 We を見る。',
    r: '完成した文に再帰代名詞を足すと「自分たちで」と強める意味になる。主語が We なら ourselves。',
    tip: 'instead of hiring 〜（業者に頼まず）のように人に任せないことが書かれていれば、強調の再帰代名詞を考える。',
    cues: [{ p: 'We' }] },
  { // 15 others
    h: '文頭の Some employees と、空所の後ろの enjoy を見る。Some と対になる語が入る。',
    r: 'some 〜, others … は「〜する人もいれば…する人もいる」。others は複数扱いで、動詞に -s を付けない。',
    tip: '前半が Some で始まり while や but で後半が続けば、others や some を候補にする。another は単数。',
    cues: [{ p: 'Some', w: 'Some 〜' }, { p: 'enjoy' }] },
  { // 16 even if
    h: '前半の will go ahead と、後半の because a large tent has been set up を見る。雨との関係を考える。',
    r: '接続詞 even if は「たとえ〜しても」と、起こるか分からない条件があっても結果が変わらないことを表す。',
    tip: '雨天でも開催する根拠（テント・屋内会場）が書かれていれば、even if を候補の先頭に置いて確かめる。',
    cues: [{ p: 'a large tent', w: '大きなテント' }] },
  { // 17 both
    h: '空所の後ろの thin and affordable を見る。2つの形容詞が and で結ばれている。',
    r: '相関の接続詞 both A and B は「AもBも両方」。A と B は同じ品詞（ここでは形容詞）でそろえる。',
    tip: '空所の少し後ろに and があれば both、or があれば either、nor があれば neither と組を合わせる。',
    cues: [{ p: 'and affordable', w: 'and' }] },
  { // 18 when
    h: '先行詞の the day が時を表すことと、空所の後ろの most customers visit the store に欠けが無いことを見る。',
    r: '関係副詞 when は時を表す先行詞（day、year、time）を受け、後ろに完全な文を取る。',
    tip: 'the day ＿ の空所は、後ろの文で visit の目的語がそろっていれば when。欠けていれば which を考える。',
    cues: [{ p: 'the day' }] },
  { // 19 by which
    h: '先行詞の a date と、空所の後ろの all of the budget forms must be submitted を見る。日付との関係は期限。',
    r: '前置詞＋関係代名詞は、先行詞を後ろの節に戻したときに要る前置詞を前に出す。期限なら by which。',
    tip: '前置詞つきの関係詞は「その日までに提出する」のように、先行詞を入れて読み直すと前置詞が決まる。',
    cues: [{ p: 'must be submitted' }] },
  { // 20 sooner
    h: '後半の the lower the fare will usually be を見る。前半と後半が the＋比較級 でそろう文。',
    r: '比較級を2つ並べる「the＋比較級 〜, the＋比較級 …」は「〜するほど…」。前半も比較級にする。',
    tip: '後半が the lower、the cheaper で始まれば、前半の空所も比較級。soon の比較級は sooner になる。',
    cues: [{ p: 'the lower' }] },
  { // 21 hand in
    h: '空所の後ろの their evaluation forms と、before leaving the seminar room を見る。退室前に用紙をどうするか。',
    r: 'hand in は「提出する」、hand out は「配る」、hand over は「引き渡す」。後ろの副詞で意味が変わる。',
    tip: '用紙・課題・報告書を目的語に取る句動詞は、hand in、turn in、submit などの提出の意味になりやすい。',
    cues: [{ p: 'evaluation forms', w: '評価用紙' }] },
  { // 22 renew
    h: '空所の後ろの their fitness center membership と、文末の before it expires を見る。会員資格をどうするか。',
    r: '動詞の語彙問題は、目的語と時の条件の両方に合うものを選ぶ。期限の前に続けることは renew で表す。',
    tip: 'expire、expiration date が文にあれば、renew や extend など「期限を延ばす」動詞を候補にする。',
    cues: [{ p: 'expires' }, { p: 'membership', w: '会員資格' }] },
  { // 23 capacity
    h: '空所の前の a seating と、後ろの of 500 people を見る。席の数を人数で表す名詞を考える。',
    r: 'seating capacity は「座席数・収容人数」。名詞＋名詞の組は、後ろの名詞が中心の意味を表す。',
    tip: '会場の紹介で数字＋people が続けば、capacity を当てはめて意味が通るか確かめる。',
    cues: [{ p: 'seating' }] },
  { // 24 spacious
    h: '空所の前の bright and と、後ろの with enough room for up to 80 desks を見る。事務所の広さを表す語。',
    r: '形容詞の語彙問題は、with 以下の具体的な説明に合う性質を選ぶ。机を多く置ける広さは spacious で表す。',
    tip: '物件や事務所の紹介文では spacious、bright、modern など部屋の長所を表す形容詞が並んで使われる。',
    cues: [{ p: 'enough room for up to 80 desks', w: '80台の机を置ける広さ' }] },
  { // 25 currently
    h: '空所の前の is と後ろの vacant、さらに後半の but interviews will begin next week を見る。',
    r: '副詞の語彙問題は、but の後ろの「これから」と対になる時を選ぶ。今の状態を表すのは currently。',
    tip: '後半に未来の予定（will begin）があれば、前半は「今は〜」と現在の状態を表す副詞が合いやすい。',
    cues: [{ p: 'interviews will begin next week', w: '来週面接が始まる' }] },
  { // 26 estimate
    h: '空所の前の a cost と、後ろの for repairing the roof を見る。工事の前に業者が送ってくるもの。',
    r: 'cost estimate は「費用の見積もり」。名詞＋名詞の組は、後ろの名詞が中心の意味を表す。',
    tip: '修理や工事の文では estimate、quote、invoice が並ぶことがある。作業の前か後かで使い分ける。',
    cues: [{ p: 'contractor', w: '業者' }, { p: 'cost' }] },
  { // 27 verify
    h: '空所の後ろの your shipping address carefully と、before you place your order を見る。',
    r: '動詞の語彙問題は、目的語と時の条件に合うものを選ぶ。注文の前に住所が正しいか調べることは verify。',
    tip: 'carefully や before 〜 が添えられた依頼文では、verify、check、confirm など確認の動詞を探す。',
    cues: [{ p: 'before you place your order', w: '注文前' }, { p: 'shipping address', w: '配送先住所' }] },
  { // 28 complimentary
    h: '空所の後ろの breakfast と、文末の at no charge を見る。無料であることを表す形容詞を考える。',
    r: 'complimentary は「無料の・サービスの」。つづりの似た complementary（補い合う）とは意味が違う。',
    tip: 'ホテルの案内で at no charge や free of charge があれば、complimentary を当てはめて確かめる。',
    cues: [{ p: 'at no charge' }] },
  { // 29 brochure
    h: '空所の前の designed a colorful と、後ろの to promote the summer tour packages を見る。宣伝のために作るもの。',
    r: '名詞の語彙問題は、目的（to promote 〜）と前の形容詞（colorful）の両方に合う名詞を選ぶ。',
    tip: '宣伝・販売促進の文では brochure、flyer、advertisement などが使われる。作る・配る動詞と組むかで選ぶ。',
    cues: [{ p: 'to promote', w: '宣伝する（promote）' }] },
  { // 30 dramatically
    h: '空所の前の rose と、後ろの in the third quarter、thanks to strong overseas sales を見る。増え方を表す副詞。',
    r: '副詞の語彙問題は、修飾する動詞と理由の両方に合うものを選ぶ。大きく増えたことは dramatically で表す。',
    tip: 'thanks to ＋良い理由 が後ろにあれば、増加の大きさを表す副詞（dramatically、sharply）が合いやすい。',
    cues: [{ p: 'rose', w: 'rose' }] },
];
