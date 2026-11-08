/** TOEIC Part 5 第7回の解説の追加項目（着眼点・ポイント・TOEICでのコツ・手がかり）。並びは第7回の問1〜問30と同じ。空の要素は「追加なし」 */
import type { ToeicP5Note } from './toeicPart5NoteTypes';

export const NOTES_07: ToeicP5Note[] = [
  { // 1 our
    h: '空所の直後の website を見る。案内している店の側のウェブサイトなので、持ち主は書き手。',
    r: '書き手の会社や店の持ち物を表す所有格は our。所有格の後ろには名詞を置き、ours は名詞の前に置けない。',
    tip: 'Please visit ＿ website の型は店や会社からの案内。書き手側を表す our を最初に当ててみる。',
    cues: [{ p: 'website' }] },
  { // 2 construction
    h: '空所の前の The と、後ろの of the new rail line を見る。述語 will shorten の主語の中心になる位置。',
    r: '冠詞と of にはさまれた主語の中心は名詞。construct（動詞）は -ion を付けて名詞 construction になる。',
    tip: '主語の名詞を選ぶときは、述語動詞（will shorten）の動作をする物事として意味が通るかも確かめる。',
    cues: [{ p: 'The' }, { p: 'of' }] },
  { // 3 has
    h: '空所の後ろの already left を見る。left は過去分詞として使われ、その前に置く助動詞を考える。',
    r: '現在完了は have／has＋過去分詞。主語が単数なら has。already や just は has と過去分詞の間に置く。',
    tip: 'already、just、yet、ever などの語が空所の近くにあれば、現在完了の have／has を候補にする。',
    cues: [{ p: 'already left', w: 'already left' }, { p: 'The shipment', w: '主語' }] },
  { // 4 across from
    h: '空所の前の is directly と、後ろの the hotel entrance を見る。バス停とホテルの位置関係を考える。',
    r: 'across from は「〜の向かいに」、next to は「隣に」、in front of は「〜の前に」。位置関係で選ぶ。',
    tip: '道案内の文で directly が前にあれば、across from や opposite など正面の位置を表す語を確かめる。',
    cues: [{ p: 'hotel entrance', w: '向かい' }] },
  { // 5 simple
    h: '空所の前の are と、後ろの and easy to follow を見る。and でつながる2つの語は同じ品詞になる。',
    r: 'and や or で並べる語は同じ品詞・同じ形にそろえる。easy が形容詞なら、空所も形容詞。',
    tip: '空所の後ろに and ＋形容詞 があれば、空所も形容詞を選べばよい。並列は品詞の大きな手がかり。',
    cues: [{ p: 'are' }, { p: 'and easy' }] },
  { // 6 shortage
    h: '文頭の Due to と、後半の production has slowed を見る。生産が遅れた原因になるものを考える。',
    r: '名詞の語彙問題は、原因と結果の関係から選ぶ。a shortage of 〜 は「〜の不足」。',
    tip: 'Due to の後ろは原因。後半の結果を先に読み、それを引き起こす名詞を選択肢から探す。',
    cues: [{ p: 'production at the Ridgeway plant has slowed', w: '生産が遅れた' }, { p: 'parts', w: '部品' }] },
  { // 7 that
    h: '先行詞の前の the most reliable と、空所の後ろの used に目的語が無いことを見る。',
    r: '先行詞に最上級や the only、the first が付くと、関係代名詞は that がよく使われる。',
    tip: '「the＋最上級＋名詞＋＿ we have ever」の型は that を選ぶ問題として覚えておく。',
    cues: [{ p: 'courier service' }, { p: 'used' }] },
  { // 8 handle
    h: '空所の後ろの the package と、後半の as it contains glass items を見る。荷物に対する動作を考える。',
    r: '動詞の語彙問題は、目的語と理由の両方に合うものを選ぶ。handle は「扱う・取り扱う」。',
    tip: '配送の注意書きでは handle with care、fragile などの語が使われる。中身が割れ物なら丁寧に扱う意味。',
    cues: [{ p: 'the package', w: '荷物' }] },
  { // 9 is manufactured
    h: '主語の furniture が作る側か作られる側かを考え、さらに furniture が可算か不可算かを確かめる。',
    r: '主語が動作を受け、後ろに目的語が無ければ受動態。不可算名詞の主語は単数扱いで is を使う。',
    tip: 'furniture、equipment、information などは不可算名詞。All of our furniture でも動詞は単数で受ける。',
    cues: [{ p: 'furniture', w: '家具' }] },
  { // 10 effortlessly
    h: '空所を消しても The new robot arm can lift heavy boxes で文が完成していることを確かめる。',
    r: '文が完成していれば、空所は修飾語の位置。動詞の様子を表すのは副詞で、文末にも置ける。',
    tip: '文末の空所は副詞のことが多い。形容詞を置くと前の名詞を説明する形になり、文が崩れる。',
    cues: [{ p: 'lift', w: 'lift' }] },
  { // 11 before
    h: '空所の後ろの you leave the factory floor が節であることと、機械を切る時期を考える。',
    r: 'before は接続詞としても前置詞としても使える。後ろが節なら接続詞で「〜する前に」を表す。',
    tip: '作業手順の文では before、after、once などの時の接続詞が並ぶ。動作の順番を思い描いて選ぶ。',
    cues: [{ p: 'you leave', w: 'you leave' }] },
  { // 12 prohibited
    h: '空所の前の smoking is と、文末の on all flights を見る。機内での喫煙がどういう扱いかを考える。',
    r: '形容詞（過去分詞）の語彙問題は、主語と場面から規則の内容を考える。禁止は prohibited で表す。',
    tip: '機内や施設の案内では prohibited、permitted、restricted が並ぶことがある。場面の常識で絞り込む。',
    cues: [{ p: 'smoking', w: '喫煙' }, { p: 'on all flights', w: '機内' }] },
  { // 13 none
    h: '空所の後ろの of them と、文頭の Although many applicants were interviewed を見る。',
    r: 'none of 〜 は「〜のうち誰も（何も）…ない」。後ろに of ＋複数名詞・代名詞を取る。',
    tip: 'Although の文は前後が逆の内容。前半が「多く面接した」なら、後半は「誰も〜なかった」と予想できる。',
    cues: [{ p: 'of them', w: 'none of 〜' }, { p: 'Although', w: 'Although' }] },
  { // 14 beyond
    h: '空所の後ろの its maximum capacity と、前半の cannot store を見る。容量との関係を表したい。',
    r: 'beyond は「〜を超えて」と範囲や限度の外を表す前置詞。within は「〜の範囲内で」。',
    tip: 'capacity、limit、budget などの限度を表す名詞の前では beyond と within の対比で考える。',
    cues: [{ p: 'maximum capacity', w: '最大容量' }] },
  { // 15 pass
    h: '空所の前の your boarding と、後半の until you have left the aircraft を見る。持っておく物を考える。',
    r: '名詞＋名詞で1つの物を表す組（複合名詞）は、組のまま覚える。boarding pass は「搭乗券」。',
    tip: '空港の文では boarding pass、baggage claim、departure gate など決まった複合名詞が使われる。',
    cues: [{ p: 'boarding' }, { p: 'until you have left the aircraft', w: '飛行機を降りるまで' }] },
  { // 16 to open
    h: '空所の前の is scheduled を見る。予定を表すこの形の後ろに続く動詞の形を考える。',
    r: 'be scheduled to do は「〜する予定だ」。be expected to do、be supposed to do も同じ型を取る。',
    tip: 'be scheduled の後ろは to＋原形 か for ＋日時。空所の後ろが動詞なら to do を選ぶ。',
    cues: [{ p: 'is scheduled', w: 'be scheduled to do' }] },
  { // 17 set up
    h: '空所の後ろの the new equipment と in the lab を見る。新しい機器を研究室でどうするか。',
    r: 'set up は「設置する・準備する」。set off は「出発する」、set aside は「取っておく」。',
    tip: '機器や会場が目的語なら set up や install など「据え付ける」意味の語を探す。',
    cues: [{ p: 'the new equipment', w: '新しい機器' }] },
  { // 18 visitor
    h: '空所の前の Each と、述語の must wear a hard hat を見る。ヘルメットをかぶるのは人か物か。',
    r: 'each の後ろは単数名詞。主語の名詞は、述語の動作をする者として意味が通るものを選ぶ。',
    tip: 'Each の後ろの空所では、-s の付いた複数形の選択肢を外すと、残りがかなり減る。',
    cues: [{ p: 'Each' }, { p: 'must wear a hard hat', w: 'ヘルメットをかぶる' }] },
  { // 19 badly
    h: '空所の後ろの damaged と、後半の the customer asked for a replacement を見る。壊れ方の程度を考える。',
    r: '副詞の語彙問題は、修飾する語と結果の両方に合うものを選ぶ。damaged には badly、severely が合う。',
    tip: 'so の後ろに結果があれば、その結果を引き起こすほどの程度を表す副詞を選ぶ。',
    cues: [{ p: 'asked for a replacement', w: '交換を求める' }, { p: 'damaged', w: '壊れていた' }] },
  { // 20 soon
    h: '空所の前後の as 〜 as possible を見る。2つの as の間に入る形を考える。',
    r: 'as 〜 as possible は「できるだけ〜」。as と as の間には形容詞か副詞の原級を置く。',
    tip: 'as ＿ as の空所では、比較級や最上級の選択肢をまず外す。残りの原級から意味で選ぶ。',
    cues: [{ p: 'as possible', w: 'as possible' }] },
  { // 21 reimburse
    h: '空所の後ろの passengers と、for any meals purchased during the delay を見る。人に何をするか。',
    r: 'reimburse 人 for 〜 は「〜の費用を人に払い戻す」。動詞は目的語と前置詞の組で語法が決まる。',
    tip: '経費や遅延の文では reimburse、refund、compensate が並ぶことがある。目的語が人か物かで見分ける。',
    cues: [{ p: 'meals', w: '食事代' }, { p: 'during the delay', w: '遅延中' }] },
  { // 22 advanced
    h: '空所の前の the most と、後ろの testing machines を見る。名詞を修飾し、most で比べられる語。',
    r: 'the most は形容詞や副詞の前に置いて最上級を作る。名詞の前に置くなら形容詞を選ぶ。',
    tip: 'the most ＿ ＋名詞 の形では、形容詞の選択肢を探す。advance（動詞・名詞）は置けない。',
    cues: [{ p: 'the most' }, { p: 'testing machines' }] },
  { // 23 whichever
    h: '空所の前の choose と、後ろの shipping option is を見る。choose の目的語であり、is の主語にもなる語。',
    r: '複合関係詞 whichever＋名詞 は「どちらの〜でも」。選択肢の中から選ぶ場面で使う。',
    tip: 'choose や select の後ろの空所で、直後に名詞と動詞が続けば whichever や whatever を確かめる。',
    cues: [{ p: 'choose' }, { p: 'is' }] },
  { // 24 transportation
    h: '空所の前の offers free と、後ろの to and from the airport を見る。シャトルが提供するもの。',
    r: '名詞の語彙問題は、場面（シャトルバス・空港）と前置詞句（to and from）に合う名詞を選ぶ。',
    tip: 'ホテルの案内では free transportation、shuttle service、airport pickup などの語が使われる。',
    cues: [{ p: 'to and from the airport', w: '空港との往復' }, { p: 'free' }] },
  { // 25 Now that
    h: '空所の後ろの the new highway is open が節であることと、カンマの後ろの短縮された配送時間を見る。',
    r: 'now that は「今や〜なので」と、新しく生じた状況を理由として示す接続詞。後ろに節を取る。',
    tip: '前半が「開通した・完成した」など新しい状況で、後半がその効果なら now that を候補にする。',
    cues: [{ p: 'the new highway is open', w: '新しい高速道路が開通した' }] },
  { // 26 were
    h: '主語の Neither the manager nor the employees を見る。動詞の数をどちらに合わせるかを考える。',
    r: 'neither A nor B、either A or B、not only A but also B が主語のとき、動詞は B に数を合わせる。',
    tip: '相関の語句が主語なら、動詞に近い方の名詞（B）を見る。ここでは the employees なので複数。',
    cues: [{ p: 'nor the employees', w: 'B（the employees）' }] },
  { // 27 typically
    h: '空所の後ろの responds が現在形であることと、within 24 hours を見る。いつもの対応を表す副詞。',
    r: '現在形は習慣を表す。習慣の頻度や「たいてい」を表す副詞（typically、usually）がよく組む。',
    tip: '現在形の動詞の直前の空所は、頻度の副詞の位置になりやすい。意味が「普段の様子」に合うかで選ぶ。',
    cues: [{ p: 'responds', w: '現在形 responds' }] },
  { // 28 patience
    h: '空所の前の Thank you for your と、後ろの during the system upgrade を見る。客に感謝する内容。',
    r: '所有格の後ろは名詞。patient（形容詞）は -ce で名詞 patience になる。',
    tip: 'Thank you for your ＿ の型では、patience、cooperation、understanding などの名詞が入る。',
    cues: [{ p: 'your' }] },
  { // 29 In addition to
    h: '空所の後ろの free shipping が名詞であることを確かめ、カンマの後ろの会員特典との関係を見る。',
    r: 'in addition to ＋名詞 は「〜に加えて」。後ろに名詞を取る群前置詞で、節は取らない。',
    tip: 'In addition（副詞）と In addition to（前置詞）を取り違えない。後ろに名詞が続くなら to が要る。',
    cues: [{ p: 'free shipping', w: '送料無料' }] },
  { // 30 versatile
    h: '空所の後ろの enough to handle both city routes and long-distance trips を見る。両方こなせる性質。',
    r: '形容詞の語彙問題は、enough to 以下の内容を可能にする性質を選ぶ。用途の広さは versatile で表す。',
    tip: 'both A and B が後ろにあれば、2つの異なる用途をこなす意味の語（versatile、flexible）を探す。',
    cues: [{ p: 'both city routes and long-distance trips', w: '市街地も長距離も' }] },
];
