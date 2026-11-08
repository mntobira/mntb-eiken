/** TOEIC Part 5 第2回の解説の追加項目（着眼点・ポイント・TOEICでのコツ・手がかり）。並びは第2回の問1〜問30と同じ。空の要素は「追加なし」 */
import type { ToeicP5Note } from './toeicPart5NoteTypes';

export const NOTES_02: ToeicP5Note[] = [
  { // 1 their
    h: '空所の直後の vacation requests を見る。休暇届は誰のものか、主語の Employees とのつながりも確かめる。',
    r: '所有格は後ろの名詞の持ち主を表す。持ち主が複数の人なら their、物なら its を選ぶ。',
    tip: '主語が複数形で、空所の後ろに名詞があれば their を最初に当ててみると確認が速い。',
    cues: [{ p: 'vacation requests' }] },
  { // 2 installation
    h: '空所の前の冠詞 The と、後ろの of を見る。この位置は文全体の主語の中心になる。',
    r: '主語の中心になる語は名詞。動詞 install に -ation を付けると「導入・設置」という名詞になる。',
    tip: '文頭が The ＿ of 〜 の形なら、述語動詞 has reduced の主語になれる名詞を探せばよい。',
    cues: [{ p: 'The' }, { p: 'of' }] },
  { // 3 will visit
    h: '文中の時を表す語句を探す。next Tuesday はこれから先の日を指している。',
    r: 'next 〜、tomorrow、in 〜（今から〜後）など未来の時を表す語句があれば、will＋原形 で予定を表す。',
    tip: '時制の選択肢が並んだら、文の中から時の語句を1つ見つけるのが最初の作業になる。',
    cues: [{ p: 'next Tuesday' }] },
  { // 4 by
    h: '空所の前の must be submitted を見る。提出という1回で終わる動作の締め切りを表したい。',
    r: '「〜までに（済ませる）」という期限は by。「〜までずっと（続く）」は until。',
    tip: 'submit、complete、return などの動詞の後ろの時刻・曜日には、まず by を当ててみる。',
    cues: [{ p: 'must be submitted', w: '提出' }] },
  { // 5 additional
    h: '空所の前の動詞 provide と、後ろの名詞 assistance を見る。名詞を説明する語が入る位置。',
    r: '動詞の目的語になる名詞の直前に1語足すなら、その名詞を修飾する形容詞を置く。',
    tip: 'add／addition／additional／additionally のような派生語は、語尾で品詞を見分けて形容詞を選ぶ。',
    cues: [{ p: 'provide' }, { p: 'assistance' }] },
  { // 6 shipment
    h: '後半の order number と、前半の track the status から、追跡するものが何かを考える。',
    r: '名詞の語彙問題では、動詞 track と組んで使え、文脈（注文）に合う名詞を選ぶ。',
    tip: '配送の場面では shipment、delivery、package などの語が並ぶことがある。動詞との組み合わせで選ぶ。',
    cues: [{ p: 'track the status', w: '状況を追跡' }, { p: 'order number', w: '注文番号' }] },
  { // 7 which
    h: '先行詞 The workshop が人か物かを見る。空所の前にカンマがあることにも注意する。',
    r: 'カンマの後ろで先行詞に説明を加える関係代名詞（非制限用法）は、物なら which、人なら who。that は使わない。',
    tip: 'カンマの直後の空所に関係代名詞を入れる問題では、that を最初に候補から外してよい。',
    cues: [{ p: 'The workshop' }] },
  { // 8 complete
    h: '空所の直後の the attached form と、後半の return it を見る。用紙に対してする動作を考える。',
    r: 'complete a form は「用紙に記入を済ませる」。動詞の語彙問題は、目的語との組み合わせで選ぶ。',
    tip: 'fill out、complete、submit など書類にまつわる動詞は、目的語の form や application と組で覚える。',
    cues: [{ p: 'the attached form', w: '用紙' }, { p: 'return it to the human resources office', w: '人事部へ返す' }] },
  { // 9 were sent
    h: '主語の regulations が送る側か送られる側かを考え、文末の last week で時を決める。',
    r: '受動態の時制は be 動詞で表す。過去の出来事で主語が複数なら were＋過去分詞。',
    tip: '態と時制の両方を問う問題は、「態→時制→主語の数」の順に1つずつ選択肢を減らす。',
    cues: [{ p: 'regulations', w: '規則' }, { p: 'last week' }] },
  { // 10 precisely
    h: '空所の前の be と、後ろの過去分詞 measured を見る。受動態の動詞の間にはさまれた位置。',
    r: 'be と過去分詞の間、助動詞と動詞の間は、動作の仕方を表す副詞の位置。',
    tip: 'must be ＿ measured のように動詞の部品にはさまれた空所は、形容詞ではなく副詞を選ぶ。',
    cues: [{ p: 'measured' }] },
  { // 11 Although
    h: '空所の後ろが節かどうかを見て、カンマの前後の内容が同じ向きか逆の向きかを比べる。',
    r: '節と節を「〜だが」でつなぐのは接続詞 although／though。前置詞の despite は後ろに名詞を取る。',
    tip: '前半が好ましくない内容で後半が好ましい内容なら、譲歩の接続詞を候補の先頭に置く。',
    cues: [{ p: 'ran long', w: '長引いた' }, { p: 'very useful', w: '役に立った' }] },
  { // 12 accessible
    h: '空所の直後の to visitors と、文末の wheelchairs を見る。建物の性質を表す形容詞を考える。',
    r: 'be accessible to 〜 は「〜が利用しやすい・入りやすい」。形容詞と組む前置詞まで含めて覚える。',
    tip: '施設の案内文では、accessible、available、open など「利用できる」系の形容詞が並ぶことがある。',
    cues: [{ p: 'visitors who use wheelchairs', w: '車いすの来館者' }] },
  { // 13 Every
    h: '空所の直後の名詞 employee と、動詞 is を見る。名詞が単数か複数かを確かめる。',
    r: 'every、each は単数名詞の前に置き、動詞も単数で受ける。all、many は複数名詞の前に置く。',
    tip: '数量を表す語の問題は、空所の直後の名詞に -s が付いているかを見るだけで絞り込める。',
    cues: [{ p: 'employee' }, { p: 'is' }] },
  { // 14 throughout
    h: '空所の後ろの the three-day conference が期間を表す名詞であることを確かめる。',
    r: 'throughout ＋期間 は「〜の間ずっと」。during も期間を取るが、「始めから終わりまで」を強めるのは throughout。',
    tip: '期間の前置詞は、後ろが数字（for three days）か、出来事の名前（during the conference）かで分けて考える。',
    cues: [{ p: 'the three-day conference' }] },
  { // 15 demand
    h: '空所の前の strong と後ろの for its electric bicycles、そして profits have grown を見る。',
    r: 'demand for 〜 は「〜への需要」。strong や growing などの形容詞と組んで、売れ行きの良さを表す。',
    tip: '業績の文では、利益が伸びた・減った理由を表す名詞（demand、sales、costs）を空所に当ててみる。',
    cues: [{ p: 'profits have grown', w: '利益が伸びた' }, { p: 'strong' }] },
  { // 16 to launch
    h: '空所の直前の動詞 hopes を見る。この動詞の後ろに続ける形を考える。',
    r: 'hope、plan、decide、expect など、これからのことを表す動詞は、目的語に不定詞（to＋原形）を取る。',
    tip: '不定詞と動名詞が並んだら、空所の前の動詞が「これから」を表すか「すでに・普段」を表すかで分ける。',
    cues: [{ p: 'hopes', w: 'hope' }] },
  { // 17 take over
    h: '後半の when Ms. Price retires を見る。退職する人の後に、誰かがすることを考える。',
    r: 'take over は「（仕事・役職を）引き継ぐ」。take on は「引き受ける」、take off は「離陸する・休む」。',
    tip: '人事の文では、退職・異動の話と組んで take over や succeed などの「後を継ぐ」語が使われる。',
    cues: [{ p: 'Ms. Price retires', w: '退職' }, { p: 'the accounting team', w: 'チーム' }] },
  { // 18 representatives
    h: '空所の前の One of our と、後ろの will contact you を見る。連絡してくるのが人か物かを考える。',
    r: 'one of ＋複数名詞 は「〜のうちの1人・1つ」。of の後ろの名詞は複数形にする。',
    tip: '-tive で終わる語は形容詞が多いが、representative は「担当者」という名詞でもある。文の位置で判断する。',
    cues: [{ p: 'One of our' }, { p: 'will contact you', w: '連絡' }] },
  { // 19 significantly
    h: '空所の直後の reduced を見る。減り方の度合いを表す副詞を考える。',
    r: '増減を表す動詞（reduce、increase、rise）には、significantly、sharply などの程度の副詞が合う。',
    tip: '程度の副詞は、修飾される動詞が「増減」か「完了」か「頻度」かで合うものが変わる。',
    cues: [{ p: 'reduced' }] },
  { // 20 more
    h: '空所の後ろの名詞 exhibitors と、その後ろの than を見る。数を比べている文。',
    r: 'than があれば比較級。数えられる名詞の数を比べるときは more、数えられない量なら more／less を使う。',
    tip: 'than を見つけたら原級・最上級を外し、比較級の選択肢だけを比べると速い。',
    cues: [{ p: 'than' }, { p: 'exhibitors' }] },
  { // 21 review
    h: '空所の直後の the proposal と、後半の before making a final decision を見る。',
    r: 'review は目的語を直接取り「検討する・見直す」。look は look at／look over のように前置詞が要る。',
    tip: '会議の文で決定の前の段階を表すときは、review、discuss、consider などの他動詞を候補にする。',
    cues: [{ p: 'the proposal', w: '提案' }, { p: 'before making a final decision', w: '最終決定の前' }] },
  { // 22 consistent
    h: '空所の前の were と、後ろの with を見る。be 動詞の後ろで主語の様子を表す位置。',
    r: '主語の様子や性質を述べる補語の位置には形容詞を置く。名詞を置くと主語とイコールの意味になる。',
    tip: 'be ＿ with の形では、consistent with や familiar with など with と組む形容詞を探す。',
    cues: [{ p: 'were', w: 'be 動詞' }, { p: 'with' }] },
  { // 23 whose
    h: '空所の後ろに名詞 products と動詞 meet が続くことを確かめる。主語も目的語も欠けていない。',
    r: '関係詞の後ろに「名詞＋動詞」がそろい、先行詞がその名詞の持ち主なら所有格の関係代名詞 whose。',
    tip: '関係詞の直後に冠詞の付かない名詞が来ていれば、whose を候補にして先行詞との関係を確かめる。',
    cues: [{ p: 'products' }, { p: 'meet' }] },
  { // 24 as soon as
    h: '前半の call the front desk と、後半の notice any problem の時間の前後関係を考える。',
    r: 'as soon as は「〜するとすぐに」と時を表す接続詞。時の接続詞の後ろでは未来のことも現在形で表す。',
    tip: '依頼文（Please 〜）の後ろの時の接続詞は、as soon as、when、before などから意味で選ぶ。',
    cues: [{ p: 'call the front desk', w: 'フロントに電話する' }, { p: 'notice any problem', w: '問題に気づいたら' }] },
  { // 25 limited
    h: '空所の前の Seating と、後半の register as early as possible の因果関係を見る。',
    r: '形容詞の語彙問題は、後ろの内容の理由になる意味の語を選ぶ。席数が少ないことは limited で表す。',
    tip: 'イベントの案内では Space is limited や Seating is limited が早めの申し込みを促す理由として使われる。',
    cues: [{ p: 'register as early as possible', w: '早めに申し込む' }, { p: 'Seating' }] },
  { // 26 has opened
    h: '文頭の Since its founding in 2009 を見る。過去の時点から今までの期間を表している。',
    r: 'since ＋過去の時点 は「〜以来ずっと」。今まで続くことや今までの積み重ねは現在完了で表す。',
    tip: 'since、for ＋期間、so far、over the past 〜 を見たら、現在完了の選択肢を最初に確かめる。',
    cues: [{ p: 'Since' }] },
  { // 27 authorization
    h: '空所の前の obtain と、後ろの from their supervisors、before working overtime を見る。',
    r: 'obtain は「得る」。上司から得るものとして意味が通る名詞（許可・承認）を選ぶ。',
    tip: '社内規則の文では、approval、permission、authorization など「許可」を表す名詞が使われることがある。',
    cues: [{ p: 'obtain' }, { p: 'before working overtime', w: '残業の前' }, { p: 'from their supervisors', w: '上司から' }] },
  { // 28 Despite
    h: '空所の後ろの the heavy snow が名詞か節かを見て、後半の arrived on time との関係を考える。',
    r: '後ろに名詞だけが続き「〜にもかかわらず」を表すのは前置詞 despite／in spite of。although は節を取る。',
    tip: '譲歩の語が2つ並んだら、空所の後ろに動詞があるかどうかで前置詞と接続詞を分ける。',
    cues: [{ p: 'the heavy snow' }, { p: 'arrived on time', w: '時間どおりに着いた' }] },
  { // 29 routinely
    h: '空所の直後の meets its monthly targets と、後半の so 以下の内容を見る。',
    r: '頻度を表す副詞は、後ろに述べた結果（ここでは賞与の見込み）の理由として意味が通るものを選ぶ。',
    tip: 'so の後ろに結論があるときは、前半の空所にその結論を支える意味の語が入ると考えて選ぶ。',
    cues: [{ p: 'its quarterly bonus is almost guaranteed', w: 'ボーナスはほぼ確実' }, { p: 'monthly targets', w: '目標' }] },
  { // 30 instructions
    h: '空所の前の the safety と、さらに前の動詞 read を見る。read の目的語の中心になる語を考える。',
    r: '名詞の前の名詞は形容詞のように後ろを説明できる（複合名詞）。中心になる後ろの語は名詞を置く。',
    tip: 'safety instructions や customer service のような名詞＋名詞の組は、ひとまとまりの語として覚える。',
    cues: [{ p: 'read' }, { p: 'safety' }] },
];
