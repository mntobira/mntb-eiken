/**
 * 英文法　⑱ 前置詞の語法
 *
 * ★規約★ 各問の `topic` は englishGrammarData.ts の topics を一字一句写す。
 */

import { buildEgSet, type EgItem, type GrammarProblem } from './englishGrammarKit';

// =====================================================================
// eg4_4　⑱ 前置詞の語法
// =====================================================================

const EG4_4_ITEMS: EgItem[] = [
  {
    topic: '時を表す前置詞（in / on / at / by / until / for / during）',
    focus: 'by と until の区別',
    sentence: 'You have to submit the report ______ Friday afternoon, or you will lose ten points.',
    choices: ['until', 'by', 'till', 'in'],
    answer: '②',
    rate: 66,
    full: 'You have to submit the report by Friday afternoon, or you will lose ten points.',
    translation: '金曜の午後までにレポートを提出しなければならない。さもないと10点失うことになる。',
    keyPhrases: [
      { phrase: 'by Friday afternoon', meaning: '金曜の午後までに（期限）' },
      { phrase: 'submit the report', meaning: 'レポートを提出する' },
    ],
    theme: 'by は「期限（それまでに1回)」、until は「継続の終わり（それまでずっと）」',
    type: '語法判断型',
    difficulty: 2,
    steps: [
      '① 動詞 submit（提出する）は「一瞬で終わる動作」だと確認する',
      '② 一瞬の動作なら「その時までに1回すませる」＝期限',
      '③ 期限を表す前置詞は by',
      '④ 継続を表す until / till は使えないので ② を選ぶ',
    ],
    commentary: [
      'submit（提出する）は一瞬で完了する動作なので、「金曜の午後までに1回すませる」という★期限★の意味になります。期限を表す前置詞は by なので、② が正解です。',
      '★by と until の見分け方★ 動詞が「一瞬の動作」なら by（期限）、「継続する状態」なら until（〜までずっと）。I must finish it by five.（5時までに終える）／ I will wait until five.（5時まで待つ）。',
      '① の until と ③ の till は同じ意味で「〜までずっと」。submit を金曜の午後までずっと続けることはできないので不自然です。',
      '④ の in は「in three days（3日後に）」「in April（4月に）」のように期間や月・年に使い、特定の曜日の午後を指す期限には使えません。',
      '★時の前置詞の整理★ at＋時刻（at seven）／ on＋日付・曜日（on Monday）／ in＋月・年・季節（in May）。ただし on Friday afternoon のように「特定の日の午前・午後」は on を使い、in the afternoon（一般的な午後）とは区別します。',
      '★for と during★ for＋期間の長さ（for three hours）、during＋出来事や期間を表す名詞（during the summer / during the meeting）。「どれだけ長く」なら for、「いつの間に」なら during です。',
    ],
  },
  {
    topic: '場所・方向（in / at / on / to / into / for）',
    focus: 'leave for と方向の前置詞',
    sentence: 'My sister left ______ Osaka early this morning and will arrive there before noon.',
    choices: ['to', 'for', 'into', 'at'],
    answer: '②',
    rate: 60,
    full: 'My sister left for Osaka early this morning and will arrive there before noon.',
    translation: '姉は今朝早く大阪へ向けて出発し、正午前にはそこに到着する予定だ。',
    keyPhrases: [
      { phrase: 'left for Osaka', meaning: '大阪へ向けて出発した（leave for＝〜へ出発する）' },
      { phrase: 'arrive there before noon', meaning: '正午前にそこへ到着する' },
    ],
    theme: 'leave for A は「A へ向けて出発する」。leave A は「A を去る」で意味が逆になる',
    type: '語法判断型',
    difficulty: 3,
    steps: [
      '① 後半の will arrive there から、まだ大阪に着いていないと読み取る',
      '② つまり「大阪へ向かって出発した」という方向の意味が必要',
      '③ leave for A で「A へ向けて出発する」',
      '④ for を選ぶ',
    ],
    commentary: [
      '後半に will arrive there（そこに到着する予定）とあるので、大阪は★目的地★です。「A へ向けて出発する」は leave for A なので、② for が正解です。',
      '★leave の3つの形★ leave A（A を去る：left Osaka＝大阪を出た）／ leave for A（A へ向けて出発する）／ leave A for B（B へ向けて A を出発する）。前置詞の有無で意味が正反対になります。',
      '① の to は「到達点」を表すので go to Osaka のように使いますが、leave to Osaka という形は存在しません。',
      '③ の into は「外から内へ」の移動（walk into the room）。都市名と結びついて「出発する」の意味にはなりません。',
      '④ の at は「点としての場所」を表す前置詞で、移動の方向を示せません。',
      '★方向の for が使える動詞★ start for / head for / set out for / be bound for。いずれも「出発・進行の向き」を表し、到着したかどうかは含みません。★for は「向き」だけを示す★のがポイントです。',
    ],
  },
  {
    topic: '手段・原因・材料（by / with / of / from / through）',
    focus: '材料の of と from',
    sentence: 'Cheese is made ______ milk, so people who cannot drink milk should be careful.',
    choices: ['of', 'from', 'by', 'into'],
    answer: '②',
    rate: 63,
    full: 'Cheese is made from milk, so people who cannot drink milk should be careful.',
    translation: 'チーズは牛乳から作られるので、牛乳が飲めない人は注意すべきだ。',
    keyPhrases: [
      { phrase: 'is made from milk', meaning: '牛乳から作られる（原形が残らない材料）' },
      { phrase: 'should be careful', meaning: '注意すべきだ' },
    ],
    theme: 'be made of＝材料の姿が見える、be made from＝姿が変わる、be made into＝製品になる',
    type: '語法判断型',
    difficulty: 3,
    steps: [
      '① 主語 Cheese と材料 milk の関係を確認する',
      '② 牛乳はチーズになると、もとの液体の姿が残らない',
      '③ 姿が変わる材料は be made from',
      '④ from を選ぶ',
    ],
    commentary: [
      '牛乳がチーズになると、もとの液体としての姿は残りません。★見た目が変わる材料★には be made from を使うので、② が正解です。',
      '★made の3点セット★ be made of（材料の姿が見える：This desk is made of wood.）／ be made from（姿が変わる：Wine is made from grapes.）／ be made into（材料を主語にして製品を言う：Grapes are made into wine.）。',
      '① の of は「木のつくえ」のように材料がそのまま見えるときに使います。チーズを見て「これは牛乳だ」とはわからないので不適切です。',
      '③ の by は「手段・行為者」を表します（The cake was made by my mother.）。milk は行為者ではないので合いません。',
      '④ の into は Milk is made into cheese. のように、★材料が主語★のときに使います。この文の主語は Cheese（製品）なので逆です。',
      '★原因の前置詞★ die of（病気などの直接原因）／ die from（けが・外的要因）／ result from（〜が原因で生じる）／ result in（〜という結果になる）。from は「そこから離れて出てくる」というイメージが共通しています。',
    ],
  },
  {
    topic: '譲歩・対比（despite / in spite of / instead of）',
    focus: 'despite は前置詞',
    sentence: '______ the heavy rain, the outdoor concert was held as originally planned.',
    choices: ['Although', 'Despite', 'Despite of', 'Even'],
    answer: '②',
    rate: 58,
    full: 'Despite the heavy rain, the outdoor concert was held as originally planned.',
    translation: '激しい雨にもかかわらず、野外コンサートは当初の予定どおり開催された。',
    keyPhrases: [
      { phrase: 'Despite the heavy rain', meaning: '激しい雨にもかかわらず' },
      { phrase: 'as originally planned', meaning: '当初の予定どおりに' },
    ],
    theme: 'despite / in spite of は前置詞（＋名詞）、although / though は接続詞（＋S V）',
    type: '構造判断型',
    difficulty: 3,
    steps: [
      '① 空所の直後は the heavy rain という「名詞」だけで、S＋V がない',
      '② 名詞を続けられるのは前置詞（相当語句）',
      '③ 「〜にもかかわらず」の前置詞は despite / in spite of',
      '④ despite に of は不要なので ② を選ぶ',
    ],
    commentary: [
      '空所のあとは the heavy rain という名詞のかたまりだけで、S＋V がありません。名詞を続けられるのは前置詞なので、② Despite が正解です。',
      '★譲歩の使い分け★ despite＋名詞 ／ in spite of＋名詞 ／ although（though）＋S＋V。意味はほぼ同じでも、後ろに置けるものが違います。',
      '① の Although は接続詞なので Although it rained heavily, ... のように S＋V が必要です。名詞だけを続けることはできません。',
      '③ の Despite of は最頻出の誤答です。in spite of には of がありますが、★despite には of を付けません★。2つの表現が頭の中で混ざるのが原因なので、「despite は1語で前置詞」と覚えてください。',
      '④ の Even は単独では譲歩の意味を作れません。even if / even though のように接続詞と組み合わせる必要があります。',
      '★instead of★ 「〜の代わりに」で、of のあとは名詞または doing（instead of going）。despite（対立）と instead of（交替）は日本語では似て見えても関係が違うので、文の意味で判断します。',
    ],
  },
  {
    topic: '前置詞と接続詞の混同（because / because of, during / while）',
    focus: 'during と while',
    sentence: 'I took a lot of notes ______ the professor was explaining the experiment.',
    choices: ['during', 'while', 'for', 'in'],
    answer: '②',
    rate: 68,
    full: 'I took a lot of notes while the professor was explaining the experiment.',
    translation: '教授が実験について説明している間、私はたくさんメモを取った。',
    keyPhrases: [
      { phrase: 'while the professor was explaining', meaning: '教授が説明している間（while＋S V）' },
      { phrase: 'took a lot of notes', meaning: 'たくさんメモを取った' },
    ],
    theme: 'during＋名詞、while＋S＋V。「〜の間」でも後ろの形で選ぶ',
    type: '構造判断型',
    difficulty: 2,
    steps: [
      '① 空所のあとを見ると the professor was explaining と S＋V がそろっている',
      '② S＋V を続けられるのは接続詞',
      '③ 「〜している間」の接続詞は while',
      '④ while を選ぶ',
    ],
    commentary: [
      '空所のあとは the professor（S）was explaining（V）と文の形になっています。S＋V を続けられるのは接続詞なので、② while が正解です。',
      '★同じ意味でも品詞が違うペア★ during（前置詞）＋名詞 ／ while（接続詞）＋S V。because of（前置詞）＋名詞 ／ because（接続詞）＋S V。日本語訳が同じでも、★後ろの形で決まる★のが英語のルールです。',
      '① の during は前置詞なので during the explanation のように名詞が必要です。was explaining という動詞を続けられません。',
      '③ の for は「for two hours」のように期間の長さを表す前置詞で、S＋V を続けられません。',
      '④ の in も前置詞なので、そのまま S＋V を続けることはできません。',
      '★同じ発想で判断できる組★ owing to / due to（前置詞）↔ since / as（接続詞）、in spite of（前置詞）↔ although（接続詞）。★迷ったら空所のあとに S＋V があるかを確認する★ という一手で、この単元の問題はほぼ解けます。',
    ],
  },
];

export const egPrepositionProblems: GrammarProblem[] = [
  buildEgSet(
    {
      chapterId: 'eg4_4',
      setNo: 1,
      unitTitle: '⑱ 前置詞の語法',
      category: 'by と until・leave for・made from・despite・during と while',
      intro:
        '前置詞の問題は「意味を覚える」よりも★後ろに何が来ているかを見る★のが最短ルートです。during / because of / despite は前置詞なので名詞しか続けられず、while / because / although は接続詞なので S＋V が必要になります。日本語訳が同じ表現ほどこの区別が効きます。また by と until、of と from のように、意味の違いが「一瞬か継続か」「姿が残るか変わるか」というイメージで決まるものは、そのイメージごと覚えると未知の語にも応用できます。',
      summary: [
        'by は期限（一瞬の動作）、until は継続の終わり（〜までずっと）。動詞の性質で決まる。',
        'leave A は「A を去る」、leave for A は「A へ向けて出発する」。for は「向き」を表す。',
        'be made of（姿が見える）／be made from（姿が変わる）／be made into（材料が主語）。',
        'despite に of は付けない。in spite of には of が付く。どちらも前置詞＋名詞。',
        'during＋名詞／while＋S V、because of＋名詞／because＋S V。後ろの形で選ぶ。',
        '迷ったら「空所のあとに S＋V があるか」を確認する。これだけで前置詞か接続詞かが決まる。',
      ],
      surroundingKnowledge: [
        'in＋時間 は「〜後に」（in three days＝3日後に）。within＋時間 は「〜以内に」。混同しやすいので区別する。',
        'at は点（at the station）、in は内部（in the room）、on は接触（on the wall）。壁の絵は on the wall。',
        '手段の by と with：by は方法・手段（by bus / by e-mail）、with は道具（with a pen / with a knife）。',
        'through は「通り抜けて」。時間なら「〜の間ずっと（through the night）」、原因なら「〜のせいで」。',
        '前置詞の後ろに動詞を置くときは必ず doing にする（good at swimming / look forward to seeing）。',
      ],
      deepDiveTopics: [
        'なぜ by が「期限」を表すのか。by の中心イメージは「近接（そばに）」で、時間軸では「その点のそばまで」＝それまでに、という意味になる。until は un-（〜まで）＋till で「終点まで線を引く」イメージ。★点か線か★という違いが、そのまま動詞の選び方に対応している。',
        'despite に of を付けてしまう誤りは、in spite of との類推（アナロジー）で起こる。言語には「似た表現に形をそろえる」力が働くため、母語話者の子どもも同じ間違いをする。文法の誤りには理由があると知ると、覚え方も変わってくる。',
        'be made of と be made from の違いは、化学変化があるかどうかとよく説明されるが、より正確には「話者がもとの材料を認識できるか」という認知の問題。だから木の机は of、パンは from（小麦の姿が見えない）になる。★文法は物理ではなく人の見方を反映している★。',
        'during と while が同じ意味なのに品詞が違うのは、英語が「名詞をつなぐ語」と「文をつなぐ語」を厳密に分けているため。日本語の「〜の間」は名詞にも文にも付けられるので、日本語話者はこの区別を意識的に学ぶ必要がある。逆に言えば、ここを見る癖をつけるだけで得点源になる。',
      ],
    },
    EG4_4_ITEMS,
  ),
];
