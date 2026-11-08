/** TOEIC Part 5 第9回の解説の追加項目（着眼点・ポイント・TOEICでのコツ・手がかり）。並びは第9回の問1〜問30と同じ。空の要素は「追加なし」 */
import type { ToeicP5Note } from './toeicPart5NoteTypes';

export const NOTES_09: ToeicP5Note[] = [
  { // 1 its
    h: '空所の後ろの final decision を見る。決定を下すのは主語の The planning committee。',
    r: '委員会・部署・会社など組織を受ける所有格は its。組織は1つのまとまりとして単数で受ける。',
    tip: 'committee や board が主語の文で所有格を選ぶときは、its と their の数の違いに注意して選ぶ。',
    cues: [{ p: 'final decision' }, { p: 'committee' }] },
  { // 2 approval
    h: "空所の前の The と、後ろの of next year's budget を見る。述語 is expected の主語の中心。",
    r: '冠詞と of にはさまれた主語の中心は名詞。approve（動詞）は -al を付けて名詞 approval になる。',
    tip: '-al は形容詞の語尾にも名詞の語尾にもなる。approval、proposal、arrival は名詞として覚える。',
    cues: [{ p: 'The' }, { p: 'of' }] },
  { // 3 will discuss
    h: "文末の next week's meeting を見る。話し合いが行われるのはこれから先の会議。",
    r: '未来の時を表す語句（next 〜、tomorrow）があれば、予定は will＋原形 で表す。',
    tip: "時制の手がかりが所有格の形（next week's）で書かれていることがある。文末まで目を通して探す。",
    cues: [{ p: "next week's meeting" }] },
  { // 4 inside
    h: '空所の後ろの the blue folder を見る。契約書をフォルダーに対してどこに置くかを考える。',
    r: 'inside は「〜の内側に」、on は「〜の表面に接して」、under は「〜の下に」。物の位置関係で選ぶ。',
    tip: '書類や荷物の置き場所を指示する文では、入れ物の名詞（folder、box、drawer）と inside が組みやすい。',
    cues: [{ p: 'the blue folder', w: 'フォルダー' }] },
  { // 5 intuitive
    h: '空所の前の find the new inventory software very を見る。find＋目的語＋〜 の型になっている。',
    r: 'find O C は「OをCだと思う」。C には形容詞を置き、very などの副詞で強めることができる。',
    tip: 'find や consider の後ろに「名詞＋very＋空所」が続けば、空所は形容詞。副詞は選ばない。',
    cues: [{ p: 'find', w: 'find' }, { p: 'very' }] },
  { // 6 units
    h: '空所の前の about 800 と、後ろの of the compact refrigerator を見る。製品の数を数えている。',
    r: '製品の台数や個数は units で数える。800 units of 〜 は「〜を800台」。数字の後ろは複数形。',
    tip: '生産や在庫の文で数字と of ＋製品名 が並べば、units を当てはめて意味が通るか確かめる。',
    cues: [{ p: '800' }] },
  { // 7 who
    h: '先行詞 Employees が人であることと、空所の直後が動詞 complete であることを見る。',
    r: '先行詞が人で、関係詞の後ろに主語が無く動詞が続くなら主格の who（または that）を使う。',
    tip: '「名詞＋空所＋動詞」の型は主格の関係代名詞。whom や whose は後ろの形が合わない。',
    cues: [{ p: 'Employees' }, { p: 'complete' }] },
  { // 8 process
    h: '空所の後ろの your expense claim と、後半の once your manager signs it を見る。経理部がすること。',
    r: '動詞の語彙問題は、目的語との組み合わせで選ぶ。申請や注文を「処理する」は process。',
    tip: '経理や事務の文では process a claim、process an order など process と書類の組が使われる。',
    cues: [{ p: 'your expense claim' }] },
  { // 9 is distributed
    h: '主語 The annual report が配る側か配られる側かを考え、every April で時制を決める。',
    r: '毎年くり返すことは現在形。主語が動作を受け、目的語が無ければ is／are＋過去分詞 の受動態。',
    tip: 'every ＋時 は習慣の目印。受動態の選択肢が並んだら、will be や was ではなく現在形を選ぶ。',
    cues: [{ p: 'every April' }, { p: 'The annual report', w: '報告書' }] },
  { // 10 sharply
    h: '空所の前の has risen と、後ろの over the past six months を見る。上がり方を表す語が入る。',
    r: '自動詞の直後で、その動作の様子を表すのは副詞。rise や fall には sharply、gradually などが合う。',
    tip: '値段や数量が上がった・下がった文では、空所に増減の速さを表す -ly の副詞を当てる。',
    cues: [{ p: 'has risen' }] },
  { // 11 As
    h: '空所の後ろの節と、カンマの後ろの節の関係を見る。会議室が使えず、食堂で集まった。',
    r: 'as は「〜なので」と理由を表す接続詞にもなる。後ろに節を取り、文頭にも置ける。',
    tip: '文頭の As は「〜なので」「〜するとき」「〜のように」と意味が多い。後ろの内容で見分ける。',
    cues: [{ p: 'was already booked', w: '予約済み' }, { p: 'cafeteria', w: '食堂' }] },
  { // 12 confidential
    h: '空所の前の keep the details of the merger と、後ろの until the official announcement を見る。',
    r: 'keep O C は「OをCの状態にしておく」。C には形容詞を置く。confidential は「秘密の・内密の」。',
    tip: '発表前の情報を扱う文では confidential、private、secret などが使われる。until 以下が手がかり。',
    cues: [{ p: 'until the official announcement', w: '正式発表まで' }, { p: 'keep', w: 'keep' }] },
  { // 13 I
    h: '空所が Ms. Garcia and の後ろにあり、その後に述語 will represent が続くことを見る。',
    r: 'A and B が主語のとき、代名詞は主格を使う。and でつながっていても格は文の中の役割で決まる。',
    tip: '「人名＋and＋空所」の格は、人名を消して残りだけで読むと分かる（＿ will represent）。',
    cues: [{ p: 'will represent' }] },
  { // 14 through
    h: '空所の前の Monday と、後ろの Wednesday を見る。2つの曜日の間の期間を表したい。',
    r: 'Monday through Wednesday は「月曜から水曜まで（水曜も含む）」。from A to B と近い意味を表す。',
    tip: '曜日や日付が2つ並び、その間に空所があれば through を候補にする。米国式の言い方として覚える。',
    cues: [{ p: 'Monday' }, { p: 'Wednesday' }] },
  { // 15 agreement
    h: '空所の前の signed an と、後ろの to share their research data を見る。2社が署名したもの。',
    r: 'sign の目的語には文書や約束を表す名詞が来る。agree（動詞）は -ment を付けて名詞 agreement になる。',
    tip: '企業間の取引の文では sign an agreement、sign a contract などの組が使われる。冠詞 an にも注意する。',
    cues: [{ p: 'signed', w: '署名' }, { p: 'to share their research data', w: 'データを共有' }] },
  { // 16 sending
    h: '空所の直前の動詞 recommended を見る。この動詞の後ろに続けられる形を考える。',
    r: 'recommend は目的語に動名詞を取る。「人に〜を勧める」なら recommend that 人＋原形 の形も使う。',
    tip: 'recommend、suggest、consider は不定詞を取らない動詞の組として覚え、to do を最初に外す。',
    cues: [{ p: 'recommended', w: 'recommend' }] },
  { // 17 go over
    h: "空所の後ろの the attached sales report と、文末の before tomorrow's meeting を見る。",
    r: 'go over は「（書類などに）目を通す・見直す」。go through も近い意味で使う。go off は「鳴る」。',
    tip: '会議の前に資料をどうするかを問う文では、go over、review、look over など確認の意味の語を探す。',
    cues: [{ p: "before tomorrow's meeting", w: '会議の前' }, { p: 'sales report', w: '報告書' }] },
  { // 18 supervisor
    h: '空所の前の The と後ろの of the production line、さらに述語 showed the visitors を見る。',
    r: '主語の名詞は、述語の動作をする者として意味が通るものを選ぶ。案内するのは人なので人の名詞。',
    tip: 'supervise／supervision／supervisor の並びでは、語尾 -or が人。動詞の主語として読めるかで確かめる。',
    cues: [{ p: 'showed' }] },
  { // 19 noticeably
    h: '空所の後ろの higher than in April と、mainly because of the holiday sale を見る。',
    r: '比較級を前から修飾するのは副詞。noticeably は差が「目に見えて分かるほど」であることを表す。',
    tip: '比較級の前の空所では、まず副詞に絞り、次に理由（because of 〜）と程度が合うかで選ぶ。',
    cues: [{ p: 'higher' }, { p: 'holiday sale', w: 'セール' }] },
  { // 20 second
    h: '空所の前の the と、後ろの largest を見る。最上級の前に置いて順位を表す語を考える。',
    r: 'the＋序数（second、third）＋最上級 で「〜番目に…な」。順位は序数で表す。',
    tip: '最上級の直前の空所に序数の選択肢があれば、the second largest のような型を思い出す。',
    cues: [{ p: 'largest' }] },
  { // 21 allow
    h: '空所の後ろの employees to work を見る。「人＋to＋原形」を続けられる動詞を選択肢から探す。',
    r: 'allow、enable、encourage は「動詞＋人＋to do」の型を取る。let、make、have は to の無い原形を続ける。',
    tip: '意味の近い動詞（let／allow）が並んだら、空所の後ろに to があるかどうかで型が決まる。',
    cues: [{ p: 'employees to work' }] },
  { // 22 helpful
    h: '空所の前の have found the new scheduling system extremely を見る。find＋目的語＋〜 の型。',
    r: 'find O C の C には形容詞を置く。help（動詞・名詞）に -ful を付けると形容詞 helpful になる。',
    tip: 'extremely、very、quite などの後ろの空所は形容詞か副詞。find O C の型なら形容詞を選ぶ。',
    cues: [{ p: 'extremely' }] },
  { // 23 why
    h: '先行詞の the reason と、空所の後ろの the shipment was delayed に欠けが無いことを見る。',
    r: '先行詞が the reason で、後ろが完全な文なら関係副詞 why。後ろに欠けがあれば which を使う。',
    tip: 'the reason の直後の空所は why を最初に当てる。the reason why は「〜した理由」を表す型。',
    cues: [{ p: 'the reason' }] },
  { // 24 applications
    h: '空所の前の received more than 300 と、後ろの for the open sales position を見る。',
    r: '名詞の語彙問題は、数字と目的（for 〜）の両方に合う名詞を選ぶ。求人に対して届くのは応募。',
    tip: '求人の文では application、applicant、candidate が並ぶことがある。受け取る物か人かで見分ける。',
    cues: [{ p: 'open sales position', w: '営業職' }] },
  { // 25 as long as
    h: '前半の may use the company car と、後半の return it by Monday morning の関係を見る。',
    r: 'as long as は「〜する限り・〜しさえすれば」と条件を表す接続詞。後ろに節を取る。',
    tip: '許可（may、can）の文の後ろに守るべき条件が続けば、as long as や provided that を候補にする。',
    cues: [{ p: 'return it by Monday morning', w: '月曜の朝までに返す' }] },
  { // 26 are
    h: '空所の前の There と、後ろの several errors を見る。be 動詞の数を決めるのは後ろの名詞。',
    r: 'There＋be＋名詞 の構文では、be 動詞は後ろの名詞に数を合わせる。複数名詞なら are／were。',
    tip: 'There の後ろの空所では、There を主語と思わず、その後ろの名詞が単数か複数かを確かめる。',
    cues: [{ p: 'There' }, { p: 'several errors' }] },
  { // 27 greatly
    h: '空所の後ろの improved と、後半の staff morale is now much higher を見る。改善の度合いを考える。',
    r: '副詞の語彙問題は、and の後ろの結果と程度が合うものを選ぶ。improve には greatly、significantly が合う。',
    tip: '後半に much higher など大きな変化があれば、前半の空所にも程度の大きさを表す副詞が入る。',
    cues: [{ p: 'improved', w: '改善' }] },
  { // 28 merger
    h: '空所の前の The と、後ろの of the two companies を見る。2社に関係する主語の中心になる語。',
    r: '冠詞と of にはさまれた主語の中心は名詞。merge（動詞）に -er を付けると名詞 merger になる。',
    tip: '-er は人を表すことが多いが、merger や order のように人でない名詞もある。文の意味で確かめる。',
    cues: [{ p: 'The' }, { p: 'of' }] },
  { // 29 Upon
    h: '空所の直後の arrival を見る。到着と同時に起きることを表す前置詞を考える。',
    r: 'upon／on ＋名詞・動名詞 は「〜するとすぐに・〜した時点で」。upon arrival は「到着時に」。',
    tip: 'ホテルや会場の案内では upon arrival、upon request など upon と名詞の組が使われる。',
    cues: [{ p: 'arrival' }] },
  { // 30 productive
    h: '後半の both sides agreed to meet again next week を見る。最初の交渉がどうだったかを考える。',
    r: '形容詞の語彙問題は、and の後ろの結果と同じ向きの意味を選ぶ。成果があったことは productive で表す。',
    tip: '交渉や会議の評価を問う文では、productive、fruitful など成果を表す形容詞が使われる。',
    cues: [{ p: 'agreed to meet again', w: '次の会合に合意' }] },
];
