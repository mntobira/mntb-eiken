/** TOEIC Part 5 第1回の解説の追加項目（着眼点・ポイント・TOEICでのコツ・手がかり）。並びは第1回の問1〜問30と同じ。空の要素は「追加なし」 */
import type { ToeicP5Note } from './toeicPart5NoteTypes';

export const NOTES_01: ToeicP5Note[] = [
  { // 1 her
    h: '空所の直後を見る。findings は名詞なので、その前に置ける代名詞の格を考える。',
    r: '名詞の直前に置く代名詞は所有格（my／his／her／their など）。所有代名詞や再帰代名詞は名詞の前に置けない。',
    tip: '選択肢が she／her／hers／herself のような格違いなら、空所の直後が名詞かどうかを先に確かめる。',
    cues: [{ p: 'findings' }] },
  { // 2 delivery
    h: '空所の前の free と、さらに前の動詞 offers を見る。空所は offers の目的語の位置。',
    r: '形容詞の後ろで動詞の目的語になるのは名詞。-ery、-tion、-ment などの語尾が名詞の目印。',
    tip: '品詞の問題は語尾で名詞を探し、前後の1〜2語だけで決める。全文の訳は後回しでよい。',
    cues: [{ p: 'free' }, { p: 'offers' }] },
  { // 3 exceeded
    h: '文末の時を表す語句を探す。last month は過去のある時点を指している。',
    r: '時点が過去と決まっている語句（last 〜、〜 ago、yesterday）があれば過去形。現在完了とは並べない。',
    tip: '動詞の形の問題は、まず文中の時の語句に印をつけ、時制を絞ってから選択肢を見る。',
    cues: [{ p: 'last month' }] },
  { // 4 on
    h: '空所の直後を見る。Monday, May 12 は曜日と日付の組み合わせ。',
    r: '時の前置詞は、後ろの語が表す時間の幅で選ぶ。特定の日付や曜日には on、in はもっと長い期間、at は一点の時刻に使う。',
    tip: '時の前置詞は「時刻 at／日 on／月・年 in」と、狭い順に並べて覚えておくと素早く選べる。',
    cues: [{ p: 'Monday, May 12', w: '曜日・日付' }] },
  { // 5 easily
    h: '空所を消して読んでみる。can be set up 以下だけで文が完成しているかを確かめる。',
    r: '文の要素がそろい、空所が無くても成り立つなら、そこは修飾語の位置。動詞を修飾するのは副詞。',
    tip: '文が空所なしで完成していれば -ly の副詞から試す。friendly のような -ly の形容詞には注意。',
    cues: [{ p: 'can be set up' }] },
  { // 6 suitable
    h: '空所の直後の前置詞 for と、主語が会議室であることを見る。',
    r: '形容詞は後ろに続く前置詞と組で覚える。be suitable for は「〜に適した」、be capable of は「〜できる」。',
    tip: '意味の近い形容詞が並んだら、空所の直後の前置詞と合う組み合わせから絞り込む。',
    cues: [{ p: 'for', w: 'for' }] },
  { // 7 themselves
    h: 'introduce の目的語が誰かを考える。紹介される相手は、主語の New employees と同じ人たち。',
    r: '動詞の目的語が主語と同じ人・物のときは再帰代名詞（-self／-selves）。主語が複数なら -selves。',
    tip: 'introduce oneself や help oneself など、再帰代名詞と組む動詞の言い方をまとめて押さえておく。',
    cues: [{ p: 'New employees', w: '新入社員' }, { p: 'introduce', w: '紹介する' }] },
  { // 8 has received
    h: '文に述語動詞があるかを確かめ、次に主語の中心の語を探す。managers ではなく Each が中心。',
    r: 'Each of ＋複数名詞 は単数扱い。動詞は has／is／-s の付いた形にそろえる。',
    tip: '主語の後ろに of 〜 が入ると直前の名詞につられやすい。主語の先頭の語に戻って数を確かめる。',
    cues: [{ p: 'Each of' }] },
  { // 9 expenses
    h: '文の前半の receipts と accounting department から、空所が何の話かを先に決める。',
    r: '名詞を選ぶ語彙問題は、同じ文の中にある関連語が示す場面と結びつく名詞を選ぶ。',
    tip: 'travel expenses や shipping costs のように、ビジネスの場面で組になる名詞を語句単位で覚えておく。',
    cues: [{ p: 'receipts', w: '領収書' }, { p: 'accounting department', w: '経理部' }] },
  { // 10 Because
    h: '空所の後ろに主語と動詞があるかを見て、次にカンマの前後の内容の関係を考える。',
    r: '後ろに節が続くなら接続詞、名詞だけなら前置詞。接続詞は前後の意味の関係（理由・譲歩・条件）で選ぶ。',
    tip: '意味が近く品詞が違う組（Despite／Although）が並んだら、後ろが節か名詞かを先に見る。',
    cues: [{ p: 'the parts' }, { p: 'arrived' }] },
  { // 11 at
    h: '空所の直後の the front desk が、移動先か方向か、それとも1つの地点かを考える。',
    r: '1つの地点（受付・駅・入口など）は at、中へ入る動きは into、方向は toward で表す。',
    tip: '場所の前置詞は、動詞が「移動」か「その場での動作」かを先に見ると選択肢を減らせる。',
    cues: [{ p: 'front desk', w: '受付' }] },
  { // 12 reliable
    h: '空所の前後を見る。前に冠詞 a、後ろに名詞 reputation がある。',
    r: '冠詞と名詞にはさまれた空所は、後ろの名詞を説明する形容詞の位置。',
    tip: '形容詞の語尾（-able、-ive、-ful、-ous）を手がかりに、選択肢から形容詞を1つ見つける。',
    cues: [{ p: 'reputation' }] },
  { // 13 return
    h: '空所の直後の it（＝購入品）と、文末の full refund を見る。目的語を取る動詞が入る。',
    r: '似た形の動詞が並んだら、目的語を直接取る他動詞か、前置詞が要る自動詞かで分ける。',
    tip: 'refund、exchange、warranty など返品・保証の語が文にあれば、それに合う動詞を選択肢から探す。',
    cues: [{ p: 'within 30 days', w: '30日以内' }, { p: 'full refund', w: '全額返金' }] },
  { // 14 who
    h: '先行詞が人か物かを見て、次に空所の直後が動詞か名詞かを確かめる。',
    r: '先行詞が人で、後ろに動詞が続くなら主格の関係代名詞 who。物なら which か that。',
    tip: '関係詞の問題は、空所の後ろで主語が欠けているか、目的語が欠けているかを見ると格が決まる。',
    cues: [{ p: 'Applicants' }, { p: 'have' }] },
  { // 15 are inspected
    h: '主語の components が、検査をする側かされる側かを考える。空所の後ろに目的語があるかも見る。',
    r: '主語が動作を受ける側で、動詞の後ろに目的語が無いときは受動態（be＋過去分詞）。',
    tip: '能動態と受動態が並んだら、空所の直後に名詞（目的語）があるかどうかを最初に確かめる。',
    cues: [{ p: 'All components', w: '部品' }] },
  { // 16 thoroughly
    h: '空所の直後の revised と、目的を表す to reflect 以下を見る。どんな改訂かを表す副詞を選ぶ。',
    r: '副詞の語彙問題は、修飾する動詞と自然に結びつくかで選ぶ。revise には thoroughly が合う。',
    tip: 'thoroughly review や carefully check のような副詞と動詞の組は、組のまま覚えておくと速い。',
    cues: [{ p: 'revised' }, { p: 'reflect the new safety regulations', w: '新しい規則を反映' }] },
  { // 17 appointment
    h: '空所の前の The と、後ろの of を見る。冠詞と前置詞にはさまれた位置。',
    r: 'the と of にはさまれた空所は名詞の位置。appoint→appointment のように -ment で名詞になる動詞がある。',
    tip: 'The ＿ of の型は、選択肢から名詞の語尾を持つものを選べば、訳さずに答えられることがある。',
    cues: [{ p: 'The' }, { p: 'of' }] },
  { // 18 revenue
    h: 'online sales と accounted for nearly half から、空所が「何の半分か」を考える。',
    r: 'account for ＋割合 は「〜を占める」。後ろには全体を表す名詞（revenue、sales、budget）が来る。',
    tip: '割合や数字の話をしている文では、revenue、profit、budget など財務の名詞を優先して検討する。',
    cues: [{ p: 'online sales' }, { p: 'total' }] },
  { // 19 those
    h: 'than の前後で何と何を比べているかを見る。比べているのは複数の Sales figures 同士。',
    r: '比較の文で前に出た名詞の繰り返しを避けるときは、単数なら that、複数なら those を使う。',
    tip: 'than ＿ for 〜 や than ＿ of 〜 の形では、前に出た名詞が単数か複数かで that／those を選ぶ。',
    cues: [{ p: 'Sales figures', w: 'sales figures' }, { p: 'for', o: 2, w: 'for 〜' }] },
  { // 20 advisable
    h: 'so の前後の因果関係を見る。前半は満席になりやすいこと、後半は早めの予約についての評価。',
    r: '形容詞の語彙問題では、主語が人か物かを確かめる。eligible は人に、advisable は物事に使う。',
    tip: 'so や because で文がつながるときは、前半の事情から後半に来る評価を予想してから選択肢を読む。',
    cues: [{ p: 'fully booked', w: '満席' }, { p: 'early reservations', w: '早めの予約' }] },
  { // 21 until
    h: '空所の前の動詞 continue を見る。「続く」動作の終わりの時点を表す前置詞を選ぶ。',
    r: '期限までに一度起こることは by、ある時点まで続くことは until で表す。',
    tip: 'by と until が並んだら、動詞が「完了する」系か「続く」系かを見るだけで判断できることが多い。',
    cues: [{ p: 'continue' }] },
  { // 22 considerably
    h: '空所の直後の lighter が比較級であることに気づく。比較級の前に置ける品詞を考える。',
    r: '比較級を前から強めるのは副詞（much、far、considerably）。very は比較級を強めない。',
    tip: '空所の直後が比較級なら much・far・considerably を候補にし、very は外して考える。',
    cues: [{ p: 'lighter' }] },
  { // 23 put off
    h: '選択肢はどれも put で始まる。違いを決めるのは文末の until next Wednesday。',
    r: '句動詞は後ろの副詞・前置詞で意味が変わる。put off は「延期する」、put up with は「我慢する」。',
    tip: '同じ動詞で始まる句動詞が並んだら、目的語と時を表す語句から場面を決めて1つに絞る。',
    cues: [{ p: 'until next Wednesday' }] },
  { // 24 approve
    h: '選択肢の意味はどれも近い。空所の直後に、前置詞を挟まず名詞が来ているかを見る。',
    r: 'agree to、consent to、comply with のように前置詞が要る自動詞は、目的語を直接取れない。',
    tip: '意味の近い動詞が4つ並んだら、意味ではなく語法（前置詞が要るかどうか）で決まる問題だと考える。',
    cues: [{ p: 'the merger' }] },
  { // 25 lowest
    h: '空所の前の the と、後ろの of all our locations を見る。全体の中での順位を表す形が入る。',
    r: '「the ＋＿＋ of all 〜／in 〜」の形は最上級。比較級は than と組で使う。',
    tip: 'of all 〜 や in the region のような範囲を表す語句があれば、最上級の選択肢を最初に確かめる。',
    cues: [{ p: 'the' }, { p: 'of all our locations' }] },
  { // 26 opening
    h: '空所の直前の動詞 considering を見る。この動詞の目的語になる形を考える。',
    r: 'consider、avoid、finish、suggest などは、目的語に不定詞ではなく動名詞を取る。',
    tip: '動名詞と不定詞が並んだら、空所の前の動詞がどちらを取るかで決まる。動詞ごとに語句で覚えておく。',
    cues: [{ p: 'considering', w: 'consider' }] },
  { // 27 relatively
    h: '空所の直後の形容詞 stable と、文頭の Despite the slow economy を見る。',
    r: '形容詞の前には程度を表す副詞（relatively、fairly）を置く。approximately は数値の前に置く。',
    tip: '文頭の Despite や Although は、前半と後半の意味が逆になる合図。後半の内容を予想するのに使う。',
    cues: [{ p: 'stable' }, { p: 'Despite the slow economy', w: '景気が悪い' }] },
  { // 28 applicant
    h: '空所の前の Each と、述語動詞の submit を見る。推薦状を提出するのは人か物かを考える。',
    r: '人と物の名詞が並んだら、動詞の主語として意味が通る方を選ぶ。applicant は人、application は申し込み。',
    tip: '-ant／-er（人）と -tion（物・こと）の名詞が並んだら、文の動詞の主語になれるかで見分ける。',
    cues: [{ p: 'Each' }, { p: 'submit', w: '提出する' }] },
  { // 29 provided that
    h: '空所の後ろの「事前に上司に知らせる」が、前半の在宅勤務とどう関係するかを考える。',
    r: 'provided that、as long as、unless は条件を表す接続詞。so that は目的、even though は譲歩。',
    tip: '接続詞を選ぶときは、前後を「理由・条件・譲歩・目的」のどれでつなぐと自然かを一言で言ってみる。',
    cues: [{ p: 'inform their supervisors in advance', w: '事前に上司に知らせれば' }, { p: 'work from home', w: '在宅勤務' }] },
  { // 30 ambiguous
    h: 'Because の後ろが原因、カンマの後ろが結果。客が組み立てを間違えた原因になる説明書の性質を考える。',
    r: '原因と結果を表す文では、結果（ここでは組み立ての誤り）につながる意味の形容詞を選ぶ。',
    tip: 'Because の文は、結果の部分を先に読むと、原因の空所に入る語の意味を絞り込みやすい。',
    cues: [{ p: 'the instructions', w: '説明書' }, { p: 'assembled the shelf incorrectly', w: '組み立てを間違えた' }] },
];
