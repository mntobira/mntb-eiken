/** TOEIC Part 5 第3回の解説の追加項目（着眼点・ポイント・TOEICでのコツ・手がかり）。並びは第3回の問1〜問30と同じ。空の要素は「追加なし」 */
import type { ToeicP5Note } from './toeicPart5NoteTypes';

export const NOTES_03: ToeicP5Note[] = [
  { // 1 me
    h: '空所の直前の動詞 contact を見る。空所は連絡する相手、つまり動詞の目的語の位置。',
    r: '動詞や前置詞の直後に置く代名詞は目的格（me／him／her／us／them）。主格は主語の位置にだけ置く。',
    tip: 'please contact ＿ の形は、問い合わせ先を示す案内文で使われる。目的格を選べば済む。',
    cues: [{ p: 'contact' }] },
  { // 2 selection
    h: '空所の前の a wide と、後ろの of dishes を見る。「幅広い〜の料理」の「〜」に当たる語を探す。',
    r: '冠詞＋形容詞の後ろで of につながる位置は名詞。select に -ion を付けると名詞 selection になる。',
    tip: 'a wide range of、a wide variety of、a wide selection of は品ぞろえの広さを表す決まった言い方。',
    cues: [{ p: 'a wide' }] },
  { // 3 upgrading
    h: "空所の前の is currently と、後ろの目的語 the company's e-mail system を見る。",
    r: 'be＋-ing は「〜している最中」。主語が動作をする側で目的語があれば、受動ではなく能動の進行形。',
    tip: 'currently、now、at the moment は進行形と組みやすい語。見つけたら -ing の選択肢を確かめる。',
    cues: [{ p: 'is currently' }] },
  { // 4 between
    h: '空所の後ろの the airport and the convention center を見る。2つの場所が and で結ばれている。',
    r: '2つのものの間は between A and B、3つ以上の間は among。from A to B は出発点と到着点を表す。',
    tip: '空所の後ろに A and B の形が見えたら、between を最初に当てはめてみる。',
    cues: [{ p: 'the airport and the convention center', w: '空港と会議場' }] },
  { // 5 informative
    h: '空所の前の very と、後ろの名詞 presentation を見る。very で強められ、名詞を説明する語が入る。',
    r: 'very は形容詞や副詞を強める。冠詞と名詞の間で very の後ろにある空所は形容詞の位置。',
    tip: 'inform／information／informative のように、同じ語から作られた語は語尾（-ive）で品詞を見分ける。',
    cues: [{ p: 'very' }, { p: 'presentation' }] },
  { // 6 store
    h: '空所の後ろの their luggage と at the front desk、after checking out の流れを見る。',
    r: '動詞の語彙問題は、目的語との組み合わせで選ぶ。荷物に対して自然な動作は store（保管する）。',
    tip: 'ホテルの場面では check in、check out、store luggage など、手続きと動詞の組を語句で押さえる。',
    cues: [{ p: 'after checking out', w: 'チェックアウト後' }, { p: 'their luggage', w: '荷物' }, { p: 'at the front desk', w: '受付' }] },
  { // 7 where
    h: '空所の後ろの the conference will take place に、主語や目的語の欠けがあるかを確かめる。',
    r: '関係詞の後ろが完全な文で、先行詞が場所なら関係副詞 where。後ろに欠けがあれば関係代名詞を使う。',
    tip: 'which と where で迷ったら、後ろの文に足りない語があるかを見る。欠けが無ければ関係副詞。',
    cues: [{ p: 'The hotel' }] },
  { // 8 contract
    h: '空所の前の the terms of と、文末の before you sign it を見る。署名する書類を考える。',
    r: '名詞の語彙問題は、同じ文の別の語（ここでは terms と sign）と自然につながる名詞を選ぶ。',
    tip: 'terms and conditions、sign a contract、renew an agreement など契約の語は組で覚えると速い。',
    cues: [{ p: 'terms', w: '条件（terms）' }, { p: 'sign it', w: '署名' }] },
  { // 9 is
    h: '空所の前の長い主語を見る。中心の語は The list で、of approved vendors はそれを説明する語句。',
    r: '主語が「名詞＋of＋名詞」のときは、of の前の名詞で数を決める。The list なら単数で受ける。',
    tip: '動詞の直前の名詞（vendors）につられやすい。主語の先頭の名詞に戻って単数か複数かを確かめる。',
    cues: [{ p: 'The list' }, { p: 'of approved vendors' }] },
  { // 10 remarkably
    h: '空所の直後の well を見る。well はここでは「うまく」という副詞として performed を修飾している。',
    r: '副詞を前から強めるのも副詞。形容詞は名詞を修飾し、副詞・形容詞・動詞は修飾しない。',
    tip: '空所の後ろが well、quickly などの副詞なら、-ly の付いた副詞を選べば形の上で合う。',
    cues: [{ p: 'well' }] },
  { // 11 If
    h: 'カンマの前後の関係を見る。前半は「助けが必要な場合」、後半は対応できる時間帯。',
    r: 'if は「もし〜なら」と条件を表す接続詞。後ろに主語と動詞のある節を取る。',
    tip: '案内文で「〜の場合は…できます」と言うときは if が使われる。後半の案内の内容も手がかりになる。',
    cues: [{ p: 'need help with your order', w: '注文で助けが必要なら' }] },
  { // 12 valid
    h: "空所の後ろの driver's license を見る。運転の仕事に応募する人が持っているべき免許の状態を考える。",
    r: '形容詞の語彙問題は、修飾する名詞との組み合わせで選ぶ。免許・旅券・切符が「有効な」は valid。',
    tip: 'valid passport、valid ID、valid ticket のように、書類と組む形容詞として覚えておく。',
    cues: [{ p: "driver's license", w: '免許' }] },
  { // 13 the one
    h: '前半の the printer と、空所の後ろの on the third floor を見る。同じ種類の別の1台を指している。',
    r: '前に出た名詞と同じ種類の別の1つを指すときは the one（複数なら the ones）。it は同じものを指す。',
    tip: 'it と the one で迷ったら、指しているのが前に出た物そのものか、同じ種類の別の物かを考える。',
    cues: [{ p: 'on the third floor', w: '3階のプリンター' }] },
  { // 14 According to
    h: '空所の後ろの the weather forecast が名詞であることを確かめ、カンマの後ろとの関係を見る。',
    r: 'according to ＋名詞 は「〜によると」と情報の出どころを表す群前置詞。後ろに節は取らない。',
    tip: '文頭の空所の後ろに report、survey、forecast などの情報源が来たら according to を確かめる。',
    cues: [{ p: 'the weather forecast', w: '天気予報' }] },
  { // 15 venue
    h: '空所の前の larger と、後ろの for its annual awards dinner を見る。夕食会のために探しているもの。',
    r: '名詞の語彙問題は、前の形容詞と後ろの目的（for 〜）の両方とつながる名詞を選ぶ。',
    tip: '催しの話で場所を表す名詞は venue、location、site など。larger や suitable と組むかで判断する。',
    cues: [{ p: 'larger' }, { p: 'awards dinner', w: '夕食会' }] },
  { // 16 submitted
    h: '空所の前の Applications と、文の述語動詞 will not be considered を見る。空所は主語を説明する位置。',
    r: '名詞を後ろから説明する分詞は、名詞が「〜される」側なら過去分詞、「〜する」側なら現在分詞。',
    tip: '文の述語動詞がすでにある場合、空所に入るのは述語ではなく分詞。まず述語動詞を探す。',
    cues: [{ p: 'Applications', w: '申込書' }] },
  { // 17 fill out
    h: '空所の後ろの a registration card と、文末の at the reception desk を見る。受付でカードにすること。',
    r: 'fill out は「（用紙に）記入する」。fill in も同じ意味で使う。fill up は「いっぱいにする」。',
    tip: '受付・手続きの文では fill out a form、sign in、pick up a badge のような句動詞が使われる。',
    cues: [{ p: 'registration card', w: 'カード' }] },
  { // 18 contributions
    h: '空所の前の her と、後ろの to the local community を見る。賞を受けた理由になる語を探す。',
    r: '所有格の後ろは名詞の位置。contribute（貢献する）の名詞は contribution で、to 〜 と組む。',
    tip: 'contribution to、commitment to、dedication to のように to と組む名詞は表彰の文で使われる。',
    cues: [{ p: 'her' }] },
  { // 19 temporarily
    h: '空所の後ろの out of service と、後半の please use the stairs を見る。使えない状態の長さを考える。',
    r: '副詞の語彙問題では、文の状況に合う「時間の長さ」や「程度」を表す語を選ぶ。',
    tip: '設備の案内文では temporarily closed や temporarily unavailable の組み合わせで一時的な停止を伝える。',
    cues: [] },
  { // 20 as
    h: '空所の前の twice as fast を見る。as 〜 as の前半の as がすでにあることに気づく。',
    r: '倍数は「twice／three times＋as 〜 as …」で表す。as で始めたら後ろも as でそろえる。',
    tip: 'as 〜 as の問題は、前半の as を見つけたら than を外し、後半の as を選ぶ。',
    cues: [{ p: 'twice' }, { p: 'as fast' }] },
  { // 21 specializes
    h: '空所の直後の前置詞 in を見る。選択肢の動詞が、それぞれどの前置詞と組むかを比べる。',
    r: 'specialize in、focus on、participate in のように、動詞は組む前置詞が決まっている。',
    tip: '意味の近い動詞が並び、空所の後ろに前置詞があれば、前置詞との組み合わせで1つに絞れる。',
    cues: [{ p: 'in designing', w: 'in' }] },
  { // 22 pleased
    h: "主語の The staff と、空所の後ろの by the president's announcement を見る。喜ばされたのは誰か。",
    r: '感情の動詞から作った形容詞は、感情を持つ人には -ed、感情を起こさせる物事には -ing を使う。',
    tip: 'pleased／pleasing、surprised／surprising の組は、主語が人か物事かを見ればすぐ決まる。',
    cues: [{ p: 'The staff', w: '職員' }] },
  { // 23 What
    h: '空所から most までが文の主語になっている。value の後ろに目的語があるかを確かめる。',
    r: 'what は先行詞を含む関係代名詞で「〜するもの・こと」。後ろの節に主語か目的語が欠けている。',
    tip: '文頭の空所の後ろに「主語＋動詞」があり、その後に is が続くなら what を最初に確かめる。',
    cues: [{ p: 'value' }, { p: 'most' }] },
  { // 24 extension
    h: '後半の because she needed more time を見る。時間が足りなかった人が頼むものを考える。',
    r: '名詞の語彙問題は、because の後ろの理由と結びつく意味の名詞を選ぶ。期限を延ばすことは extension。',
    tip: 'deadline、due date の話では extension、postponement など「延ばす」系の名詞が使われる。',
    cues: [{ p: 'needed more time', w: 'もっと時間が必要だった' }] },
  { // 25 either
    h: '空所の後ろの by credit card と、その後の or by bank transfer を見る。2つの方法が or で並んでいる。',
    r: '相関の接続詞は組で使う。either A or B は「AかBのどちらか」、neither A nor B は「どちらも〜ない」。',
    tip: '相関の語句は後ろの or／nor／and で決まる。空所より後ろを先に見て、対になる語を探す。',
    cues: [{ p: 'or' }] },
  { // 26 repair
    h: '空所の前の had a technician を見る。have＋人＋〜の形で、技術者がする動作が空所に入る。',
    r: '使役の have は「have＋人＋動詞の原形」で「人に〜してもらう」。物が主なら have＋物＋過去分詞。',
    tip: 'have／make／let の後ろに人が来たら、その次は動詞の原形。to や -ing は選ばない。',
    cues: [{ p: 'had', w: 'have' }, { p: 'a technician', w: '技術者' }] },
  { // 27 officially
    h: '空所の後ろの take effect と、文末の on April 1 を見る。規則が効力を持ち始める様子を表す副詞。',
    r: '副詞の語彙問題は、修飾する動詞と組んで自然な意味になるかで選ぶ。take effect は「発効する」。',
    tip: '規則や制度の文では officially、effective immediately など、始まり方を表す語が組で使われる。',
    cues: [{ p: 'take effect' }, { p: 'April 1', w: '4月1日' }] },
  { // 28 designer
    h: '空所の前の hired と a freelance を見る。雇う対象なので、空所には人を表す名詞が入る。',
    r: '人と物・行為の名詞が並んだら、動詞の主語や目的語として意味が通る方を選ぶ。-er、-ist、-ant は人。',
    tip: 'design／designer／designed のような選択肢では、雇う・連絡するなどの動詞から人の名詞を選ぶ。',
    cues: [{ p: 'hired', w: 'hire' }, { p: 'a freelance' }] },
  { // 29 except
    h: '空所の前の open every day と、後ろの national holidays を見る。毎日のうち、外れる日を表したい。',
    r: 'except ＋名詞 は「〜を除いて」。every、all、any など全体を表す語と組んで例外を示す。',
    tip: '営業日の案内文では every day except 〜 の形が使われる。全体を表す語が前にあるかを見る。',
    cues: [{ p: 'national holidays', w: '祝日' }, { p: 'every day', w: '毎日' }] },
  { // 30 overwhelming
    h: '空所の後ろの demand と、後半の sold out within an hour を見る。早く売り切れた理由を考える。',
    r: '形容詞の語彙問題は、後ろの結果の原因として意味が通るかで選ぶ。需要の大きさは overwhelming で表す。',
    tip: 'Because of の後ろの名詞句は理由。後半の結果を先に読み、その原因に合う形容詞を探す。',
    cues: [{ p: 'sold out within an hour', w: '1時間で売り切れた' }, { p: 'demand', w: '需要' }] },
];
