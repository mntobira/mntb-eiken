/** TOEIC Part 5 第15回の解説の追加項目（着眼点・ポイント・TOEICでのコツ・手がかり）。並びは第15回の問1〜問30と同じ。空の要素は「追加なし」 */
import type { ToeicP5Note } from './toeicPart5NoteTypes';

export const NOTES_15: ToeicP5Note[] = [
  { // 1 participation
    h: '空所の前の Thank you for your と、後ろの in を見る。お礼の対象になる語が入る。',
    r: '所有格の後ろは名詞の位置。participate（動詞）の名詞形は participation で、in と組んで参加先を示す。',
    tip: 'Thank you for your ＿ の空所は、participation、cooperation、patience など名詞の位置になる。',
    cues: [{ p: 'your' }] },
  { // 2 securely
    h: '空所の前の are と、後ろの sealed を見る。受動態の間に入り、封の仕方を表す語。',
    r: 'be 動詞と過去分詞の間は副詞の位置。形容詞 secure に -ly を付けた securely が副詞になる。',
    tip: '発送や梱包の文では securely packed、carefully wrapped のように副詞＋過去分詞の形が使われる。',
    cues: [{ p: 'are', w: 'are sealed' }] },
  { // 3 responsive
    h: '空所の前の quick and と、後ろの to their questions を見る。and が何と何を並べているかを確かめる。',
    r: 'and は同じ働きの語を並べる。形容詞 quick と並ぶので形容詞 responsive を選び、名詞や動詞は合わない。',
    tip: 'A and ＿ の空所は、A の品詞をそのまま当てはめると候補をしぼりやすい。',
    cues: [{ p: 'quick' }] },
  { // 4 manufacturer
    h: '主語の Orvane Industries と、空所の前の the largest、後ろの of kitchen appliances を見る。',
    r: '形容詞の最上級の後ろは名詞の位置。主語の会社とイコールになるので、作る側を表す manufacturer。',
    tip: '会社が主語で be 動詞の後ろが空所なら、supplier、provider など会社を表す名詞が合いやすい。',
    cues: [{ p: 'Orvane Industries' }] },
  { // 5 revised
    h: '空所の前の the と、後ろの schedule を見る。予定表が自分で改訂するのか、改訂されたのか。',
    r: '名詞の前で修飾する分詞は、名詞との関係で選ぶ。予定表は改訂される側なので過去分詞 revised。',
    tip: '変更を知らせるメールでは revised schedule、updated list など過去分詞＋名詞の形が使われる。',
    cues: [{ p: 'schedule' }] },
  { // 6 originally
    h: '空所の前の was と、後ろの built as a train station を見る。建物が最初は何だったかを述べている。',
    r: 'be 動詞と過去分詞の間は副詞の位置。形容詞 original に -ly を付けた originally が副詞になる。',
    tip: '建物や会社の歴史を述べる文では originally、formerly、previously のような副詞が使われる。',
    cues: [{ p: 'was', w: 'was built' }] },
  { // 7 reviewing
    h: '空所の前の has almost finished と、後ろの the contracts を見る。finish の後ろに続く動詞の形。',
    r: '動詞 finish は目的語に動名詞（-ing）をとり、to 不定詞はとらない。enjoy、avoid も同じ型。',
    tip: 'finish、consider、suggest の直後の空所では、選択肢の -ing 形を先に確かめる。',
    cues: [{ p: 'finished', w: 'finish' }] },
  { // 8 would have arrived
    h: 'if 節の had left（過去完了）を見る。実際には遅れた過去のことを仮定している。',
    r: 'if 節が過去完了なら仮定法過去完了で、主節は would have ＋過去分詞。過去の事実と反対の内容を表す。',
    tip: 'If ＋ had ＋過去分詞 を見たら、主節に would have、could have の形を探す。',
    cues: [{ p: 'had left' }] },
  { // 9 are displayed
    h: '主語の New seasonal products と、空所の後ろに目的語がないことを見る。商品は並べる側か、並べられる側か。',
    r: '主語が動作を受ける側なら受動態 be＋過去分詞。主語が複数で習慣的なことなので現在形 are displayed。',
    tip: '空所の後ろに目的語がなく場所の語句が続くときは、受動態の選択肢を確かめる。',
    cues: [{ p: 'New seasonal products', w: '商品' }] },
  { // 10 to remind
    h: '空所の前の would like と、後ろの all staff that 〜 を見る。would like に続く動詞の形。',
    r: 'would like の後ろは to 不定詞。remind は 人＋that 節 をとり、念のため知らせる意味になる。',
    tip: '社内連絡の書き出しでは We would like to remind / inform you that 〜 の形が使われる。',
    cues: [{ p: 'would like' }, { p: 'all staff that', w: 'remind 人 that' }] },
  { // 11 toward
    h: '空所の後ろの the end of December を見る。月末に向けて売上が増える時期を表す語。',
    r: '時期を表す前置詞は、示す範囲で選ぶ。ある時期に近づいていくころを表すのは toward。',
    tip: 'toward the end of、by the end of は似ているが、by は期限、toward はそのころを表す。',
    cues: [{ p: 'the end of December', w: 'the end of' }] },
  { // 12 Aside from
    h: '空所の後ろの a few minor scratches（名詞句）と、コンマの後ろの in excellent condition を見る。',
    r: '後ろが名詞句なので前置詞を選ぶ。小さな例外を除いて全体を述べるのは aside from（〜を除いて）。',
    tip: '例外のあとに良い評価が続く文では、Aside from、Except for、Apart from が文頭に来やすい。',
    cues: [{ p: 'a few minor scratches' }] },
  { // 13 against
    h: '空所の前の protects hikers と、後ろの wind and heavy rain を見る。何から守るのかを示す語。',
    r: '動詞 protect は前置詞 against や from と組み、守る対象と害になるものを示す。',
    tip: 'protect、guard、insure などの動詞の後ろは、against ＋危険 の組み合わせを考える。',
    cues: [{ p: 'protects hikers', w: 'protect A' }] },
  { // 14 mine
    h: '空所の前の was longer than と、主語の presentation を見る。誰の何と比べているのか。',
    r: '同じ名詞のくり返しを避けるときは所有代名詞を使う。my presentation を1語にした mine。',
    tip: 'than の後ろの代名詞の空所は、比べている2つが同じ種類かどうかで所有代名詞を選ぶ。',
    cues: [{ p: 'presentation', w: '発表どうし' }] },
  { // 15 someone
    h: '空所の後ろの at the service counter と、will be happy to assist you を見る。手伝う人を表す語。',
    r: '主語になり、特定しない人を表す不定代名詞は someone。単数として扱うので動詞と合う。',
    tip: 'お客への案内文では someone、a staff member が主語になり、assist、help が続くことが多い。',
    cues: [{ p: 'will be happy to assist' }] },
  { // 16 whenever
    h: '空所の後ろの they need to travel（主語＋動詞）と、前の can use the free shuttle bus を見る。',
    r: '主語と動詞のある節をつなぐのは接続詞。「〜するときはいつでも」と時の条件を広げるのは whenever。',
    tip: 'can use、are welcome to のような利用案内の文では、whenever、as long as などの接続詞が使われる。',
    cues: [{ p: 'they need to travel', w: '主語と動詞のある節' }] },
  { // 17 Given that
    h: '空所の後ろの demand for electric bicycles is rising（節）と、主節の double its production を見る。',
    r: '後ろが節なので接続詞の働きをする語を選ぶ。状況をふまえて判断を述べる理由の形は given that。',
    tip: '需要の増加と増産・採用などの対応が並ぶ文では、Given that、Since、Because が文頭に来やすい。',
    cues: [{ p: 'demand for electric bicycles is rising', w: '主語と動詞のある節' }, { p: 'double its production', w: '増産' }] },
  { // 18 of whom
    h: 'コンマの前の 20 new engineers と、空所の前の many を見る。「その技術者の多く」という関係。',
    r: '数量の語＋of＋関係代名詞の形。先行詞が人なので whom を使い、many of whom で後ろの節の主語になる。',
    tip: 'many、some、all、none の直後の関係詞の空所では、of whom（人）か of which（物）を選ぶ。',
    cues: [{ p: '20 new engineers', w: '先行詞は人' }, { p: 'many', w: 'many of them' }] },
  { // 19 to whom
    h: '空所の前の The reporter と、後ろの you spoke last week を見る。spoke の後ろに相手を示す語がない。',
    r: '前置詞の目的語が欠けた関係詞節では、前置詞＋関係代名詞を使える。先行詞が人なので to whom。',
    tip: 'speak to、talk with、refer to のような動詞＋前置詞が節の中にあると、前置詞＋whom の形が合う。',
    cues: [{ p: 'you spoke', w: 'you spoke to the reporter' }, { p: 'The reporter', w: '記者' }] },
  { // 20 higher
    h: '空所の前の slightly と、後ろの than last year を見る。今年と昨年の予算を比べている。',
    r: 'than があるので比較級を選ぶ。予算の多さは high で表し、比較級は higher。slightly は差の小ささを表す。',
    tip: 'slightly、much、far などの直後の空所は比較級の位置。予算や価格には higher、lower が使われる。',
    cues: [{ p: 'than' }, { p: 'slightly', w: 'slightly higher' }] },
  { // 21 pick up
    h: '空所の前の A driver from the hotel と、後ろの you at the airport を見る。空港で運転手が客にすること。',
    r: '動詞と副詞のまとまりで意味が決まる。人を車で迎えに行くことは pick up で、目的語の人が続く。',
    tip: 'ホテルや出張の案内では pick up（迎えに行く）、drop off（降ろす）の組み合わせが使われる。',
    cues: [{ p: 'at the airport', w: '空港' }] },
  { // 22 subscription
    h: '空所の前の a one-year と、後ろの to Garden Monthly magazine を見る。雑誌を1年間どうするのか。',
    r: '冠詞と形容詞の後ろは名詞の位置。雑誌を一定期間受け取る契約は subscription で、to と組む。',
    tip: '雑誌・新聞・オンラインサービスの話題では subscription、renew、expire などの語が一緒に使われる。',
    cues: [{ p: 'magazine', w: '雑誌' }, { p: 'one-year', w: '1年間' }] },
  { // 23 enclosed
    h: '空所の後ろの form と、return it in the envelope provided を見る。用紙と封筒の関係を考える。',
    r: '名詞 form の前で性質を表す形容詞を選ぶ。手紙と一緒に入れてある用紙は enclosed form で表す。',
    tip: '手紙の文では enclosed、attached、provided など「付いている」ことを表す語が名詞の前後に置かれる。',
    cues: [{ p: 'in the envelope provided', w: '封筒' }] },
  { // 24 deadline
    h: '空所の後ろの for submitting entries と、is October 31 を見る。提出に関係する日付。',
    r: '冠詞の後ろは名詞。提出期限を表す deadline は for ＋動名詞 と組み、日付が補語に来る。',
    tip: 'コンテストや申し込みの案内では deadline、submit、entry が一つの文にそろうことが多い。',
    cues: [{ p: 'submitting entries', w: '提出する' }, { p: 'October 31', w: '10月31日' }] },
  { // 25 ingredients
    h: '空所の後ろの used in our sandwiches と、come from farms を見る。料理に使われ、農場から届くもの。',
    r: 'All of the の後ろは名詞で、動詞 come から複数形とわかる。料理の材料は ingredients で表す。',
    tip: '飲食店の紹介では fresh ingredients、local farms のような産地と材料の語句が使われる。',
    cues: [{ p: 'used in our sandwiches', w: 'サンドイッチに使われ' }, { p: 'come from farms', w: '農場から来る' }] },
  { // 26 collaborate
    h: '空所の後ろの with engineers と、to develop a lighter version を見る。設計者と技術者がどう関わるか。',
    r: '動詞の語彙問題は、後ろの前置詞との組み合わせでも選べる。collaborate は with と組んで共同作業を表す。',
    tip: '開発や企画の文では collaborate with、work closely with、partner with などの表現が使われる。',
    cues: [{ p: 'with engineers' }] },
  { // 27 unexpectedly
    h: '空所の前の closed と、後ろの because of a power outage を見る。閉館が予定どおりかどうか。',
    r: '動詞 closed を修飾するのは副詞。停電という急な理由に合うのは、予期しないことを表す unexpectedly。',
    tip: 'because of ＋急な出来事 が後ろにあれば、unexpectedly、suddenly、temporarily のような副詞が合いやすい。',
    cues: [{ p: 'a power outage', w: 'power outage' }] },
  { // 28 renowned
    h: '空所の前の will feature performances by と、後ろの musicians from around the world を見る。',
    r: '名詞 musicians の前で性質を表す形容詞を選ぶ。催しの目玉になる演奏者には renowned（名高い）が合う。',
    tip: 'feature、invite などの語と人の名詞が並ぶと、renowned、acclaimed、distinguished が候補に入りやすい。',
    cues: [{ p: 'feature', w: 'feature' }] },
  { // 29 assemble
    h: '前半の comes with simple instructions と、空所の後ろの it at home を見る。説明書を使って家ですること。',
    r: '助動詞 can の後ろは動詞の原形。本棚と説明書の内容から、部品を組み立てる assemble が合う。',
    tip: '家具や機器の説明文では assemble、install、instructions、manual などの語が一緒に使われる。',
    cues: [{ p: 'simple instructions', w: '簡単な説明書' }, { p: 'at home', w: '家で' }] },
  { // 30 relocate
    h: '空所の後ろの to a larger building on Pine Avenue と、next spring を見る。場所が変わる話。',
    r: '動詞の語彙問題は、後ろの前置詞と目的地で選ぶ。relocate to 〜 で、店や事務所の移転を表す。',
    tip: '移転の知らせでは relocate、move、new address、larger space などの語が一つの文にそろいやすい。',
    cues: [{ p: 'to a larger building' }] },
];
