/** TOEIC Part 5 第11回の解説の追加項目（着眼点・ポイント・TOEICでのコツ・手がかり）。並びは第11回の問1〜問30と同じ。空の要素は「追加なし」 */
import type { ToeicP5Note } from './toeicPart5NoteTypes';

export const NOTES_11: ToeicP5Note[] = [
  { // 1 satisfaction
    h: '文頭の Customer と、空所の直後の動詞 has improved を見る。空所までが文の主語になっている。',
    r: '名詞＋名詞で主語を作るとき、中心になる後ろの語も名詞。satisfy（動詞）は -faction で名詞になる。',
    tip: 'customer satisfaction、customer service のように customer と組む名詞は、まとまりで覚えておく。',
    cues: [{ p: 'has improved' }, { p: 'Customer', w: 'Customer ______' }] },
  { // 2 accurately
    h: '空所の前の are と、後ろの過去分詞 recorded を見る。受動態の間にはさまれた位置。',
    r: 'be と過去分詞の間で、その動作の仕方を表すのは副詞。accurate（形容詞）は -ly で副詞になる。',
    tip: '経理や記録の文では accurately recorded、properly filed など副詞＋過去分詞の組が使われる。',
    cues: [{ p: 'recorded' }] },
  { // 3 attractive
    h: '空所の前の offers と、後ろの名詞 rates を見る。料金を説明する語が入る位置。',
    r: '動詞の目的語になる名詞の直前は形容詞の位置。attract（動詞）は -ive を付けて形容詞になる。',
    tip: '団体割引など料金の案内では attractive rates、special rates など rates と組む形容詞が使われる。',
    cues: [{ p: 'rates' }] },
  { // 4 development
    h: '空所の前の The と、後ろの of the new Silvermere factory を見る。述語 will create の主語の中心。',
    r: '冠詞と of にはさまれた主語の中心は名詞。develop（動詞）は -ment を付けて名詞 development になる。',
    tip: '主語の名詞は、述語（will create about 200 jobs）の動作の主として意味が通るかも確かめる。',
    cues: [{ p: 'The' }, { p: 'of' }] },
  { // 5 experienced
    h: '空所の前の冠詞 an と、後ろの名詞 guide を見る。案内係の性質を説明する語が入る。',
    r: '名詞を修飾する分詞形容詞は、名詞が「〜された・〜を積んだ」側なら -ed。experienced は「経験豊富な」。',
    tip: 'an の後ろの空所では、母音で始まる形容詞が入ることを確かめる。experience（名詞）は置けない。',
    cues: [{ p: 'guide' }] },
  { // 6 frequently
    h: '空所の前の the most と、後ろの過去分詞 asked を見る。asked を修飾する語が入る。',
    r: '過去分詞を前から修飾するのは副詞。the most＋副詞＋過去分詞 で「最も〜される」を表す。',
    tip: 'frequently asked questions（よくある質問）は決まった言い方。the most と組む形も覚えておく。',
    cues: [{ p: 'asked' }] },
  { // 7 working
    h: '空所の前の looks forward to を見る。この to が不定詞か前置詞かを考える。',
    r: 'look forward to の to は不定詞ではなく前置詞。続く動詞は動名詞（-ing）の形にする。',
    tip: 'look forward to、be used to、be committed to の to は前置詞。原形を選ばないよう注意する。',
    cues: [{ p: 'looks forward to', w: 'look forward to' }] },
  { // 8 will be introduced
    h: "主語の The café's new lunch menu が導入する側かされる側かを考え、starting next Monday で時を決める。",
    r: '主語が動作を受ける側で、時がこれから先なら未来の受動態（will be＋過去分詞）を使う。',
    tip: 'starting ＋日時 は「〜から」と開始時期を表す。未来の日時なら will の選択肢を確かめる。',
    cues: [{ p: 'starting next Monday' }] },
  { // 9 provide
    h: '空所の前の requested that と、that 節の主語 every applicant を見る。要求の内容を表す節。',
    r: 'request、require、recommend などの後ろの that 節では、主語が単数でも動詞は原形を使う。',
    tip: 'that 節の主語が三人称単数なのに -s の無い選択肢があれば、要求・提案の動詞が前にないか確かめる。',
    cues: [{ p: 'requested that', w: 'request that S' }] },
  { // 10 is meeting
    h: '空所の前の because she と、文中の right now を見る。今この時点で何をしているかを表したい。',
    r: 'right now、at the moment は今まさに進行中のことを表す目印。動作は現在進行形で表す。',
    tip: '電話に出られない理由を述べる文では、is meeting、is attending など現在進行形がよく使われる。',
    cues: [{ p: 'right now' }] },
  { // 11 opposite
    h: '空所の前の is located と、後ろの the city hall を見る。2つの建物の位置関係を表したい。',
    r: 'opposite は「〜の向かい側に」を表す前置詞。across from と同じ意味で使う。',
    tip: '道案内で建物の位置を表す前置詞（opposite、next to、behind）は、後ろの建物との関係で選ぶ。',
    cues: [{ p: 'the city hall', w: '建物どうし' }] },
  { // 12 over
    h: '空所の前の have increased と、後ろの the past six months を見る。期間を表す名詞が続いている。',
    r: 'over the past 〜 は「この〜の間に」と、今までの期間を表す。現在完了とよく組む前置詞。',
    tip: 'the past ＋期間 の前の空所では、over、during、for などが候補になる。現在完了なら over を確かめる。',
    cues: [{ p: 'the past six months' }] },
  { // 13 instead of
    h: '空所の前の online と、後ろの on paper を見る。2つの方法が対比されている。',
    r: '前置詞 instead of は「〜の代わりに」。後ろに名詞や前置詞句を取り、選ばなかった方を示す。',
    tip: '「AではなくB」の対比を表したいときは instead of や rather than を探す。in addition to は逆の意味。',
    cues: [{ p: 'on paper', w: '紙' }, { p: 'online', w: 'オンライン' }] },
  { // 14 hers
    h: '空所の前の use と、空所の後ろに名詞が無いことを見る。誰のノートパソコンを使うのかを考える。',
    r: '所有代名詞（mine、yours、hers、ours、theirs）は「〜のもの」をまとめて言う形で、後ろに名詞を続けない。',
    tip: '所有格（her）と所有代名詞（hers）が並んだら、空所の後ろに名詞があるかどうかで決まる。',
    cues: [{ p: 'use' }] },
  { // 15 Anyone
    h: '空所の直後の who wishes を見る。空所は文の主語で、who 以下の説明を受けている。',
    r: 'anyone who 〜 は「〜する人は誰でも」。anyone は単数扱いなので、続く動詞にも -s が付く。',
    tip: '文頭の空所の後ろに who と -s の付いた動詞が続けば、Anyone や Those の数の違いで選ぶ。',
    cues: [{ p: 'wishes', w: 'wishes' }, { p: 'who' }] },
  { // 16 so
    h: '空所の後ろの fast と、さらに後ろの that it can produce を見る。that と組む語を考える。',
    r: '接続詞 that と組む so＋形容詞・副詞＋that 〜 は「とても…なので〜」。名詞を挟むときは such を使う。',
    tip: '形容詞の後ろに that 節が続けば so、冠詞つきの名詞が続けば such。空所の直後の語で見分ける。',
    cues: [{ p: 'that it can produce', w: 'that' }] },
  { // 17 or
    h: '空所の前の by phone と、後ろの by email を見る。返金を求める2つの方法が並んでいる。',
    r: '等位接続詞 or は「または」と、同じ形の語句（ここでは by ＋名詞）を2つ並べて選択を表す。',
    tip: 'and と or で迷ったら、2つを両方使うのか、どちらか一方でよいのかを文の意味から考える。',
    cues: [{ p: 'by phone', w: '電話' }] },
  { // 18 of which
    h: '空所の前の most と、先行詞の 40 stores を見る。most of them（店のほとんど）を関係詞の形にする。',
    r: '数量＋of＋関係代名詞 は先行詞の一部を表す。先行詞が物なら of which、人なら of whom を使う。',
    tip: 'カンマの後ろの most／some／all の後ろの空所は、先行詞が人なら of whom、物なら of which の形になる。',
    cues: [{ p: 'most' }, { p: 'stores' }] },
  { // 19 wherever
    h: '空所の後ろの they are と、前半の can access client files を見る。場所を問わないことを表したい。',
    r: '複合関係副詞 wherever は「どこで〜しても」。後ろに完全な節を取り、場所の条件を広げる。',
    tip: 'mobile app や remote などの語がある文では、wherever や whenever など「どこでも・いつでも」の語が合う。',
    cues: [{ p: 'they are', w: 'wherever they are' }] },
  { // 20 far
    h: '空所の前の twice as と、後ろの as the older model を見る。as と as の間に入る形を考える。',
    r: '倍数表現は twice／three times＋as 原級 as。as と as の間には形容詞か副詞の原級を置く。',
    tip: 'as ＿ as の空所で比較級（farther）や最上級を選ばない。原級だけに絞って意味で決める。',
    cues: [{ p: 'twice' }, { p: 'as the older model', w: 'as …' }] },
  { // 21 carry out
    h: '空所の後ろの a survey of local residents を見る。調査を目的語に取る句動詞を考える。',
    r: 'carry out は「実施する・実行する」。調査・計画・試験などを目的語に取る。carry on は「続ける」。',
    tip: 'survey、study、inspection が目的語なら、carry out や conduct を候補にする。',
    cues: [{ p: 'survey', w: 'carry out a survey' }] },
  { // 22 article
    h: '空所の前の his と、後ろの to 800 words before publication を見る。編集者が短くさせたいもの。',
    r: '名詞の語彙問題は、場面（編集・出版）と動詞（shorten）に合う名詞を選ぶ。語数で測るのは文章。',
    tip: '数字＋words は文章の長さを表す。article、report、essay などが候補になる。',
    cues: [{ p: '800 words', w: '800語' }, { p: 'editor', w: '編集者' }] },
  { // 23 recruit
    h: '空所の後ろの ten new drivers と、by the end of this year を見る。新しい運転手をどうするか。',
    r: '動詞の語彙問題は、目的語との組み合わせで選ぶ。新しい人材を集めて雇うことは recruit。',
    tip: '人を目的語にする採用の動詞には recruit、hire、employ がある。new ＋職種 と組むかで選ぶ。',
    cues: [{ p: 'ten new drivers', w: '新しい運転手' }] },
  { // 24 modest
    h: '文頭の Despite difficult market conditions と、空所の後ろの increase in profits を見る。',
    r: '形容詞の語彙問題では、増減の大きさを表す語を文の流れで選ぶ。modest は「控えめな・小幅な」。',
    tip: 'Despite の後ろに悪い条件があれば、後半は「それでも〜した」。小幅でも増えたという内容が合う。',
    cues: [{ p: 'increase in profits', w: '利益の増加' }] },
  { // 25 shortly
    h: '空所の前の will depart と、後半の so passengers should board now を見る。出発までの時間を考える。',
    r: '副詞の語彙問題は、so の後ろの結果に合う意味を選ぶ。すぐに乗るべきなのは出発が近いから。',
    tip: '駅や空港の案内では depart shortly、arrive shortly など shortly（まもなく）と動詞の組が使われる。',
    cues: [{ p: 'board now', w: '今乗車すべき' }] },
  { // 26 opinions
    h: '空所の前の share their と、後ろの on the proposed park、at a public meeting を見る。',
    r: 'opinion on 〜 は「〜についての意見」。名詞の語彙問題は、後ろの前置詞と場面の両方で選ぶ。',
    tip: '住民や客の声を集める文では opinions、feedback、comments などの名詞が使われる。',
    cues: [{ p: 'on the proposed park', w: 'on 〜' }] },
  { // 27 resolve
    h: '空所の後ろの the software problem と、before the product launch を見る。問題をどうしたいかを考える。',
    r: '動詞の語彙問題は、目的語との組み合わせで選ぶ。problem や issue を目的語にするなら resolve。',
    tip: '問題や苦情を目的語に取る動詞は resolve、address、fix など。意味の近い語は目的語との組で選ぶ。',
    cues: [{ p: 'problem', w: 'resolve a problem' }] },
  { // 28 distinctive
    h: '空所の前の simple yet と、後半の customers can easily remember it を見る。覚えやすい理由になる性質。',
    r: 'yet は「〜だが」と対比をつなぐ。形容詞の語彙問題は、so の後ろの結果の理由になる語を選ぶ。',
    tip: 'A yet B の形では、A と少し違う方向の長所が B に来る。simple の後なら目立つ・特徴的などが合う。',
    cues: [{ p: 'simple yet', w: 'simple yet 〜' }] },
  { // 29 refund
    h: '空所の前の a full と、後ろの to customers who return unused items を見る。返品した客が受け取るもの。',
    r: '名詞の語彙問題は、前の形容詞（full）と場面（返品）に合う名詞を選ぶ。a full refund は「全額返金」。',
    tip: '返品の規則の文では refund、exchange、receipt などが使われる。full と組むかで判断する。',
    cues: [{ p: 'return unused items', w: '未使用品を返品' }, { p: 'a full', w: 'a full' }] },
  { // 30 supervise
    h: '空所の後ろの the new interns と、during their first week at the firm を見る。新しい実習生に対してすること。',
    r: '動詞の語彙問題は、目的語との組み合わせで選ぶ。人の仕事を見守り指導することは supervise。',
    tip: '研修や新人の文では supervise、train、mentor など人を目的語に取る動詞が使われる。',
    cues: [{ p: 'the new interns' }] },
];
