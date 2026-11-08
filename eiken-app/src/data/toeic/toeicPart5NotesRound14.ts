/** TOEIC Part 5 第14回の解説の追加項目（着眼点・ポイント・TOEICでのコツ・手がかり）。並びは第14回の問1〜問30と同じ。空の要素は「追加なし」 */
import type { ToeicP5Note } from './toeicPart5NoteTypes';

export const NOTES_14: ToeicP5Note[] = [
  { // 1 inspection
    h: '空所の前の a careful と、後ろの before を見る。冠詞と形容詞の後ろで、製品が受けるものを表す語が入る。',
    r: '冠詞＋形容詞の後ろは名詞の位置。inspect（動詞）に -ion を付けた inspection が名詞になる。',
    tip: 'go through a careful inspection、pass a safety check のように、品質管理の文では検査の名詞が続く。',
    cues: [{ p: 'careful' }] },
  { // 2 gradually
    h: '空所の前の has と、後ろの increased を見る。現在完了の間に入り、増え方を表す語。',
    r: 'have/has と過去分詞の間は副詞の位置。形容詞 gradual に -ly を付けた gradually が副詞。',
    tip: 'over the last two years のような期間の語句があると、変化の速さを表す副詞（gradually、steadily）が合いやすい。',
    cues: [{ p: 'increased', w: 'has increased' }] },
  { // 3 reasonable
    h: '空所の前の are と、後ろの for the high quality を見る。値段がどうなのかを表す語が入る。',
    r: 'be 動詞の後ろの補語で主語の性質を表すのは形容詞。reason（名詞）に -able を付けた reasonable が形容詞。',
    tip: '値段について述べる文では reasonable、affordable、competitive などの形容詞が補語に使われる。',
    cues: [{ p: 'are' }] },
  { // 4 organizers
    h: '空所の前の All と、後ろの will receive a name tag を見る。名札を受け取る人を表す語が入る。',
    r: 'All の後ろは複数名詞。organize（動詞）や organization（組織）ではなく、人を表す organizers を選ぶ。',
    tip: '名札や受付の話題では attendees、participants、organizers など人を表す名詞が主語になりやすい。',
    cues: [{ p: 'All' }] },
  { // 5 impressive
    h: '空所の前の received と、後ろの reviews を見る。批評家からの評価がどうだったかを表す語。',
    r: '名詞の前で名詞を修飾するのは形容詞。impress（動詞）に -ive を付けた impressive が形容詞になる。',
    tip: 'received ＿ reviews の空所は、positive、favorable のような評価を表す形容詞の位置になる。',
    cues: [{ p: 'reviews' }] },
  { // 6 strictly
    h: '空所の前の are available と、後ろの to members を見る。対象をしぼる意味を加える語。',
    r: '形容詞 available と前置詞句の間に入り、範囲を限定するのは副詞。strict に -ly を付けた形。',
    tip: 'available only to、strictly for のように、対象を限定する副詞は利用条件の説明に使われる。',
    cues: [{ p: 'available' }] },
  { // 7 will be traveling
    h: '空所の後ろの this time next week を見る。来週の今ごろ、どういう状況にあるかを表す形。',
    r: '未来のある時点で進行中の動作は未来進行形 will be -ing。過去形や現在完了は時制が合わない。',
    tip: 'this time next week、at noon tomorrow のような未来の一時点があれば、未来進行形を考える。',
    cues: [{ p: 'this time next week' }] },
  { // 8 has been approved
    h: '主語の The budget と、空所の後ろの by the finance director を見る。予算は承認する側か、される側か。',
    r: '主語が動作を受ける側なら受動態 be＋過去分詞。完了形と組むと has been＋過去分詞になる。',
    tip: '空所の直後に by ＋人 があり目的語がなければ、受動態の選択肢を先に確かめる。',
    cues: [{ p: 'by the finance director' }] },
  { // 9 to accommodate
    h: '空所の前の added more tables で文が完成していることと、後ろの the growing number を見る。',
    r: '完成した文の後ろで「〜するために」と目的を加えるのは to 不定詞。動詞の原形や -ing 形は続けられない。',
    tip: '文が完成した後の空所に to ＋動詞の原形 があれば、目的を表す用法をまず考える。',
    cues: [{ p: 'added more tables', w: '目的' }] },
  { // 10 Located
    h: 'コンマの後ろの主語 the Ridgeway Hotel を見る。ホテルが場所に「置かれている」関係かどうか。',
    r: '分詞構文の主語は主節の主語と同じ。ホテルは位置づけられる側なので過去分詞 Located を使う。',
    tip: 'Located in 〜, Founded in 〜 のように、建物や会社の説明は過去分詞の分詞構文で始まることが多い。',
    cues: [{ p: 'the Ridgeway Hotel', w: 'ホテル' }] },
  { // 11 behind
    h: '空所の後ろの the building と、next to the loading dock を見る。駐車場の位置を表す語。',
    r: '場所を表す前置詞は、位置関係で選ぶ。建物の裏側にあることを表すのは behind。',
    tip: 'next to、across from などの位置の語句が続くとき、空所も場所の前置詞であることが多い。',
    cues: [{ p: 'the building' }] },
  { // 12 in exchange for
    h: '前の receive a free tote bag と、後ろの completing a short online survey を見る。2つの関係を考える。',
    r: '前置詞の後ろは名詞か動名詞。何かをする見返りに何かを得る関係は in exchange for で表す。',
    tip: 'free gift、discount などの特典と行動が並ぶ文では、in exchange for、in return for が合いやすい。',
    cues: [{ p: 'a free tote bag', w: 'バッグ' }, { p: 'completing a short online survey', w: 'アンケート' }] },
  { // 13 As of
    h: '空所の後ろの April 1 と、will be required を見る。新しい決まりがいつから始まるかを示す語。',
    r: '日付の前に置き、変更が始まる時点を示す前置詞は as of。未来の文でも過去の文でも使える。',
    tip: '規則・料金・担当者の変更を知らせる文では、As of ＋日付 や Effective ＋日付 が文頭に来やすい。',
    cues: [{ p: 'April 1', w: '始まる日' }, { p: 'will be required', w: '規則' }] },
  { // 14 them
    h: '空所の前の deliver と、前半の The boxes を見る。届けるものを指す語で、数は複数。',
    r: '動詞の後ろの目的語には目的格の代名詞を使う。複数の名詞を指すので them を選ぶ。',
    tip: '代名詞の空所は、指している名詞を前の節から探し、単数か複数かと格の両方を確かめる。',
    cues: [{ p: 'The boxes' }, { p: 'deliver' }] },
  { // 15 anything
    h: '文頭の If there is と、空所の後ろの you would like to add を見る。if 節の中で「何か」を表す語。',
    r: '疑問文や if 節で「何か」を表す不定代名詞は anything。肯定の平叙文で使う something と区別する。',
    tip: 'If there is anything 〜, please let me know は、会議や依頼の文の締めくくりに使われる形。',
    cues: [{ p: 'If', w: 'if 節' }, { p: 'you would like to add' }] },
  { // 16 By the time
    h: '空所の後ろの the sales report is finished（主語＋動詞）と、主節の will have left を見る。',
    r: '主語と動詞のある節を導くのは接続詞。主節が未来完了なら「〜するころには」の by the time が合う。',
    tip: '主節に will have ＋過去分詞 があれば、By the time や by 〜 などの期限の語句と組むことが多い。',
    cues: [{ p: 'the sales report is finished', w: '主語と動詞のある節' }, { p: 'will have left', w: '未来完了' }] },
  { // 17 only if
    h: '前の will be reimbursed と、後ろの the original receipts are attached を見る。払い戻しの条件の関係。',
    r: '後ろが主語と動詞のある節なので接続詞を選ぶ。条件を一つにしぼって示すのは only if。',
    tip: '払い戻しや割引の文では、only if、provided that、as long as など条件の接続詞が使われる。',
    cues: [{ p: 'reimbursed', w: '払い戻し' }] },
  { // 18 what
    h: '空所の前の find と、後ろの you are looking for を見る。for の後ろに目的語が欠けている。',
    r: '先行詞がなく、後ろの節に名詞が欠けているときは関係代名詞 what。what 節全体が find の目的語になる。',
    tip: '空所の前に名詞がなく、後ろが前置詞で終わる節なら、what を最初に確かめる。',
    cues: [{ p: 'find' }, { p: 'looking for' }] },
  { // 19 during which
    h: 'コンマの前の three days と、後ろの new employees learn about company policies を見る。後ろの節は完成している。',
    r: '後ろの節が欠けずに完成していれば、前置詞＋関係代名詞を使う。期間の中で起きることは during which。',
    tip: '関係詞の空所で後ろが完全な文なら、in which、during which など前置詞つきの形を探す。',
    cues: [{ p: 'new employees learn about company policies', w: 'new employees learn about policies' }] },
  { // 20 better
    h: '空所の前の performs much と、後ろの than を見る。動詞 performs の様子を比べている。',
    r: 'than があるので比較級を選ぶ。動詞を修飾する副詞 well の比較級は better で、much は差を強める。',
    tip: 'much、far、even が空所の前にあれば、後ろに比較級が続く目印として使える。',
    cues: [{ p: 'than', w: 'than' }, { p: 'performs', w: '動詞 performs' }] },
  { // 21 sign up
    h: '空所の後ろの for the free language course を見る。講座に対して何をするのかを表す語。',
    r: '動詞と前置詞のまとまりで覚える。sign up for 〜 は「〜に申し込む」で、for と組む形が合う。',
    tip: '講座・イベント・会員の案内では、sign up for、register for、enroll in などの申し込みの表現が使われる。',
    cues: [{ p: 'for the free language course', w: 'sign up for' }] },
  { // 22 confirm
    h: '空所の後ろの your reservation と、before you arrive を見る。到着前に予約をどうするか。',
    r: '動詞の語彙問題は、目的語との組み合わせで選ぶ。予約を確かめることは confirm a reservation で表す。',
    tip: 'ホテルや航空券の文では confirm、cancel、change と reservation の組み合わせが使われる。',
    cues: [{ p: 'reservation', w: 'reservation' }] },
  { // 23 acquire
    h: '空所の後ろの a small bakery chain と、to expand its business を見る。事業を広げるために会社をどうするか。',
    r: '目的語に会社名や店のチェーンが来て、事業拡大につながる動詞は acquire（買収する）。',
    tip: '会社の発表の文では acquire、merge with、expand などの企業活動を表す動詞が使われる。',
    cues: [{ p: 'to expand its business', w: '事業拡大' }] },
  { // 24 receipt
    h: '空所の前の keep your と、後ろの in case you need to return or exchange を見る。返品のために取っておくもの。',
    r: '所有格の後ろは名詞。返品や交換の場面で取っておくものは receipt（レシート）で、p は発音しない。',
    tip: '返品・交換・払い戻しの話題では receipt、proof of purchase などの語が一緒に使われる。',
    cues: [{ p: 'return or exchange', w: '返品や交換' }] },
  { // 25 inventory
    h: '空所の前の checks the と、後ろの to make sure no parts are missing を見る。部品の不足を確かめる対象。',
    r: '冠詞の後ろは名詞。倉庫で数を確かめる対象は inventory（在庫）。目的の to 不定詞が意味の手がかりになる。',
    tip: 'warehouse、stock、parts などの語があると、inventory、shipment などの物流の名詞が合いやすい。',
    cues: [{ p: 'no parts are missing', w: '部品が足りない' }] },
  { // 26 commute
    h: '空所の前の their long daily と、後ろの to the city を見る。在宅勤務で避けられる毎日のこと。',
    r: '所有格と形容詞の後ろは名詞。家から職場への毎日の移動は commute（通勤）で表す。',
    tip: 'work from home、remote work の話題では commute、travel time などの語が対になりやすい。',
    cues: [{ p: 'work from home', w: '在宅勤務' }] },
  { // 27 outstanding
    h: '空所の前の gave Ms. Abara an award と、後ろの work as a director を見る。賞を受けた仕事の質。',
    r: '名詞 work の前で性質を表す形容詞を選ぶ。賞につながるほど優れていることは outstanding で表す。',
    tip: 'award、honor などの語があれば、outstanding、exceptional のような高い評価の形容詞が合いやすい。',
    cues: [{ p: 'an award', w: '賞' }] },
  { // 28 confident
    h: '空所の前の is と、後ろの that the company will reach を見る。that 節と組む形容詞。',
    r: 'be 動詞の後ろの形容詞は、後ろにどの形が続くかでも選べる。be confident that 〜 で「〜だと確信している」。',
    tip: 'be ＿ that 〜 の空所では、confident、aware、certain など that 節をとる形容詞を確かめる。',
    cues: [{ p: 'that', w: 'that' }] },
  { // 29 tentatively
    h: '空所の後ろの scheduled for May 12 と、but the date may change を見る。日付が決まりきっていない様子。',
    r: '過去分詞 scheduled を修飾するのは副詞。後半の but とのつながりから「仮に」の tentatively が合う。',
    tip: 'but 〜 may change のように変更の可能性が続けば、tentatively、temporarily のような副詞が合いやすい。',
    cues: [{ p: 'but the date may change', w: 'でも日付は変わるかもしれない' }] },
  { // 30 nearly
    h: '空所の後ろの finished と、and it will reopen next month を見る。まだ再開していない点に注目する。',
    r: '過去分詞 finished を修飾する副詞の語彙問題。来月再開するという内容から、完成に近いことを表す nearly。',
    tip: 'nearly、almost は完了の一歩手前を表す副詞で、finished、complete、full などと組む。',
    cues: [{ p: 'it will reopen next month', w: '来月再開する' }] },
];
