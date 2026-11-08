/**
 * 英文法　⑲ 動詞を含む熟語・群動詞
 *
 * ★規約★ 各問の `topic` は englishGrammarData.ts の topics を一字一句写す。
 */

import { buildEgSet, type EgItem, type GrammarProblem } from './englishGrammarKit';

// =====================================================================
// eg5_1　⑲ 動詞を含む熟語・群動詞
// =====================================================================

const EG5_1_ITEMS: EgItem[] = [
  {
    topic: 'put / take / get / make / come / go の句動詞',
    focus: 'put off の意味',
    sentence: 'The meeting was ______ until next Monday because the manager caught a bad cold.',
    choices: ['put off', 'put on', 'put out', 'put up'],
    answer: '①',
    rate: 65,
    full: 'The meeting was put off until next Monday because the manager caught a bad cold.',
    translation: '部長がひどい風邪をひいたので、会議は次の月曜まで延期された。',
    keyPhrases: [
      { phrase: 'was put off until next Monday', meaning: '次の月曜まで延期された（put off＝延期する）' },
      { phrase: 'caught a bad cold', meaning: 'ひどい風邪をひいた' },
    ],
    theme: 'put off＝延期する。off は「離れる」→ 予定を先へ押しやるイメージ',
    type: '熟語判断型',
    difficulty: 2,
    steps: [
      '① until next Monday（次の月曜まで）という時の表現に注目する',
      '② 理由は「部長が風邪をひいた」＝開けなくなった',
      '③ 会議の日を先へずらす＝延期する',
      '④ put off を選ぶ',
    ],
    commentary: [
      'until next Monday（次の月曜まで）という時の表現と、「部長が風邪をひいた」という理由から、会議の日をあとへずらしたと読み取れます。「延期する」は put off なので ① が正解です。',
      '★off の中心イメージは「離れる」★ put off は予定を今から引き離して先へ送るイメージ。put off ＝ postpone と言い換えられます。',
      '② の put on は「（服を）着る」「（体重が）増える」。会議には使えません。',
      '③ の put out は「（火を）消す」。put out the fire のように使います。',
      '④ の put up は「（建物を）建てる」「掲示する」。put up with A（A を我慢する）とセットで覚えると混同しません。',
      '★同じ発想の句動詞★ call off（中止する）／ take off（脱ぐ・離陸する）／ see off（見送る）。★前置詞・副詞のイメージから意味を推測する★癖をつけると、未知の句動詞にも対応できます。',
    ],
  },
  {
    topic: '「動詞＋副詞」と「動詞＋前置詞」の目的語の位置',
    focus: '代名詞の位置',
    sentence: 'If you find any mistakes in my essay, please ______ in red ink.',
    choices: ['point out them', 'point them out', 'point out it', 'point to them'],
    answer: '②',
    rate: 55,
    full: 'If you find any mistakes in my essay, please point them out in red ink.',
    translation: '私のエッセイに間違いを見つけたら、赤ペンでそれを指摘してください。',
    keyPhrases: [
      { phrase: 'point them out', meaning: 'それらを指摘する（代名詞は動詞と副詞の間）' },
      { phrase: 'in red ink', meaning: '赤インクで' },
    ],
    theme: '「動詞＋副詞」型は代名詞を必ず間に入れる（× point out them）',
    type: '語順判断型',
    difficulty: 4,
    steps: [
      '① 前半の any mistakes（複数）を受ける代名詞は them',
      '② point out は「動詞＋副詞」型の句動詞',
      '③ 「動詞＋副詞」型は代名詞を動詞と副詞の間に置く',
      '④ point them out を選ぶ',
    ],
    commentary: [
      '前半の any mistakes を受けるので代名詞は them です。point out は★「動詞＋副詞」型★なので、代名詞は必ず動詞と副詞の間に入ります。よって ② point them out が正解です。',
      '★2つの型の見分け★ 動詞＋副詞（out / off / up / down / away など）は目的語が名詞なら前後どちらも可（point out the mistakes / point the mistakes out）。しかし★代名詞なら間に入れるしかない★。動詞＋前置詞（look at / listen to など）は常に後ろ（look at it）。',
      '① の point out them は最頻出の誤答です。名詞なら point out the mistakes と言えるので油断しますが、代名詞では不可です。',
      '③ の point out it は語順に加えて代名詞も誤りです。受けているのは複数の mistakes なので it ではなく them です。',
      '④ の point to them は「それらの方を指さす」という物理的な動作。文章の誤りを「指摘する」意味にはなりません。',
      '★覚え方★ 代名詞は情報として軽いので、文の後ろ（重要な位置）に置けない。★軽い語は前へ、重い語は後ろへ★という英語全体の傾向の一例です。',
    ],
  },
  {
    topic: 'be動詞＋形容詞＋前置詞（be aware of / be capable of）',
    focus: 'be capable of doing',
    // ★空所は「前置詞＋動名詞」をまとめて問う★
    //   もとは 'capable ______ storing all the data' と書いていたが、
    //   選択肢の側にも of storing と storing が入っているため、
    //   正解を空所に入れると「capable of storing storing」と storing が
    //   二重になり、音源の完成文（full）と一致しなくなっていた。
    //   前置詞だけを問う形にすると ② of だけが極端に浮くので、
    //   選択肢に合わせて空所側の storing を外し、
    //   「前置詞＋doing のセット」を選ばせる形にそろえた。
    sentence: 'This small device is capable ______ all the data from the entire library.',
    choices: ['to store', 'of storing', 'for storing', 'in store'],
    answer: '②',
    rate: 61,
    full: 'This small device is capable of storing all the data from the entire library.',
    translation: 'この小さな装置は、図書館全体のデータをすべて保存することができる。',
    keyPhrases: [
      { phrase: 'is capable of storing', meaning: '保存することができる（be capable of doing）' },
      { phrase: 'all the data from the entire library', meaning: '図書館全体のすべてのデータ' },
    ],
    theme: 'be capable of doing＝〜できる。be able to do と前置詞が違う',
    type: '熟語判断型',
    difficulty: 3,
    steps: [
      '① capable という形容詞に注目する',
      '② capable は前置詞 of と結びつく',
      '③ 前置詞のあとの動詞は doing にする',
      '④ of storing を選ぶ',
    ],
    commentary: [
      'capable は前置詞 of と結びつく形容詞です。前置詞のあとの動詞は必ず doing になるので、② of storing が正解です。',
      '★be capable of doing と be able to do★ 意味はどちらも「〜できる」ですが、capable は of＋doing、able は to＋do。★形容詞ごとに相棒の前置詞が決まっている★のがポイントです。',
      '① の to store は be able to do との混同です。capable のあとに to do は置けません。',
      '③ の for storing は前置詞が誤りです。capable for という組み合わせは使われません。',
      '④ の in store は「（将来）用意されている」という別の熟語（There is a surprise in store.）で、ここでは意味が通りません。',
      '★形容詞＋前置詞のまとめ★ be aware of（気づいている）／ be afraid of（恐れて）／ be proud of（誇りに思う）／ be good at（得意）／ be different from（異なる）／ be familiar with（詳しい）／ be responsible for（責任がある）。★前置詞ごとにグループで覚える★と定着します。',
    ],
  },
  {
    topic: '前置詞を含む慣用（in terms of / on behalf of / at the expense of）',
    focus: 'on behalf of',
    sentence: 'The vice president gave the speech ______ the company president, who was ill in bed.',
    choices: ['in terms of', 'on behalf of', 'at the expense of', 'in place'],
    answer: '②',
    rate: 53,
    full: 'The vice president gave the speech on behalf of the company president, who was ill in bed.',
    translation: '副社長が、病気で寝ていた社長を代表してスピーチを行った。',
    keyPhrases: [
      { phrase: 'on behalf of the company president', meaning: '社長を代表して／社長の代わりに' },
      { phrase: 'who was ill in bed', meaning: '病気で寝ていた（社長の説明）' },
    ],
    theme: 'on behalf of A＝A を代表して／A の代わりに',
    type: '熟語判断型',
    difficulty: 4,
    steps: [
      '① who was ill in bed から、社長は出席できなかったと読み取る',
      '② だから副社長が社長の代わりに話した',
      '③ 「A を代表して」は on behalf of A',
      '④ on behalf of を選ぶ',
    ],
    commentary: [
      'who was ill in bed（病気で寝ていた）から、社長は自分でスピーチできなかったとわかります。「A を代表して／A の代わりに」は on behalf of A なので ② が正解です。',
      '★behalf の意味★ behalf は「利益・側」という意味の名詞。「A の側に立って」＝A を代表して、という発想です。',
      '① の in terms of は「〜の観点から」（in terms of cost＝費用の面では）。人を代表する意味にはなりません。',
      '③ の at the expense of は「〜を犠牲にして」（at the expense of his health＝健康を犠牲にして）。社長を犠牲にした話ではありません。',
      '④ の in place は「所定の位置に」。「〜の代わりに」と言うには in place of A と of が必要で、of がない形では意味が通りません。',
      '★同じ「of 型」の慣用表現★ in case of（〜の場合には）／ in spite of（〜にもかかわらず）／ by means of（〜の手段で）／ for the sake of（〜のために）／ in favor of（〜に賛成して）。★どれも「前置詞＋名詞＋of」で1つの前置詞として働く★点が共通しています。',
    ],
  },
  {
    topic: '否定・強調の慣用表現（by no means / anything but）',
    focus: 'anything but の意味',
    sentence: 'His explanation was ______ clear, and in the end nobody understood what he meant.',
    choices: ['nothing but', 'anything but', 'no less than', 'none other than'],
    answer: '②',
    rate: 49,
    full: 'His explanation was anything but clear, and in the end nobody understood what he meant.',
    translation: '彼の説明は決して明確ではなく、結局だれも彼の言いたいことを理解できなかった。',
    keyPhrases: [
      { phrase: 'anything but clear', meaning: '決して明確ではない（anything but＝少しも〜でない）' },
      { phrase: 'nobody understood what he meant', meaning: 'だれも彼の言いたいことを理解できなかった' },
    ],
    theme: 'anything but A＝決して A ではない。nothing but A＝A にすぎない（＝only）',
    type: '熟語判断型',
    difficulty: 4,
    steps: [
      '① 後半の nobody understood から「わかりにくかった」と読み取る',
      '② よって clear を否定する表現が必要',
      '③ 「決して〜ない」は anything but',
      '④ anything but を選ぶ',
    ],
    commentary: [
      '後半の nobody understood what he meant（だれも理解できなかった）から、説明は明確ではなかったとわかります。「決して〜でない」は anything but なので ② が正解です。',
      '★anything but と nothing but★ anything but A＝決して A でない（強い否定）／ nothing but A＝A にすぎない（＝only）。★形は似ていても意味は正反対★なので、必ずペアで覚えます。',
      '① の nothing but clear だと「明確なだけだ」となり、後半の「だれも理解できなかった」と矛盾します。この文で最も選びやすい誤答です。',
      '③ の no less than は「〜も（数量の強調）」（no less than 100 people＝100人も）。形容詞 clear の前には置けません。',
      '④ の none other than は「まさに〜その人」（none other than the president）。人や物を特定する表現で、形容詞は続きません。',
      '★否定の慣用表現★ by no means（決して〜ない）／ far from A（A から遠い＝決して A でない）／ the last person to do（最も〜しそうにない人）／ have yet to do（まだ〜していない）。★not を使わずに強い否定を作る★のが英語らしい表現です。',
    ],
  },
];

export const egIdiomProblems: GrammarProblem[] = [
  buildEgSet(
    {
      chapterId: 'eg5_1',
      setNo: 1,
      unitTitle: '⑲ 動詞を含む熟語・群動詞',
      category: 'put off・代名詞の語順・be capable of・on behalf of・anything but',
      intro:
        '熟語は数が多く丸暗記に見えますが、★前置詞・副詞のイメージ★をつかむと一気に整理できます。off は「離れる」、up は「上へ／完全に」、out は「外へ／消える」。put off が「延期」になるのも、予定を今から引き離すからです。さらに句動詞では「動詞＋副詞」型と「動詞＋前置詞」型で代名詞の位置が変わるという、意味ではなく形の知識も問われます。形容詞＋前置詞（be capable of / be aware of）や anything but / nothing but のような紛らわしいペアは、必ず対にして覚えましょう。',
      summary: [
        'put off＝延期する。off は「離れる」イメージ。call off（中止）／take off（脱ぐ・離陸）も同系統。',
        '「動詞＋副詞」型は代名詞を間に入れる（point them out ○ / point out them ×）。',
        'be capable of doing と be able to do。前置詞は形容詞ごとに決まっている。',
        'on behalf of A＝A を代表して。in terms of（観点）／at the expense of（犠牲）と区別する。',
        'anything but A＝決して A でない。nothing but A＝A にすぎない（＝only）。意味は正反対。',
        'by no means / far from A / have yet to do は、not を使わない強い否定表現。',
      ],
      surroundingKnowledge: [
        'take after A（A に似ている）／take over A（引き継ぐ）／take up A（始める）。take は「取り込む」が中心。',
        'get over A（乗り越える・回復する）／get along with A（うまくやる）／get rid of A（取り除く）。',
        'come across A（偶然出会う）／come up with A（思いつく）／go through A（経験する・目を通す）。',
        'make up A（作り上げる・構成する）／make up for A（補う）／make out A（理解する・見分ける）。',
        'look up A（調べる）と look up to A（尊敬する）は to の有無で意味が変わる。',
      ],
      deepDiveTopics: [
        '句動詞で代名詞が動詞と副詞の間に入るのは、英語の「情報の重さ」の原則によるもの。すでに話題になった代名詞は情報が軽いので文末（＝最も強く読まれる位置）に置けない。逆に長い名詞句は後ろへ回る（point out all the mistakes he had made）。★語順は情報の重さで決まる★という原理は、他の構文にも共通する。',
        'anything but が強い否定になるのは、but が「〜以外」を意味する古い用法だから。「clear 以外の何でもある」＝「clear ではまったくない」。nothing but は「〜以外は何もない」＝「〜だけ」。同じ but が正反対の意味を生むのは、前に置かれた anything / nothing の違いによる。',
        'on behalf of の behalf は古英語 be healfe（by the side）に由来し、もともとは「〜の側で」という空間表現だった。抽象的な「代表して」という意味は、空間から社会関係へ拡張したもの。★前置詞句の多くは空間表現の比喩である★。',
        'be capable of と be able to のように、同じ意味の形容詞が別の前置詞を取るのは、語がラテン語系かゲルマン語系かという語源の違いによる場合が多い。capable はラテン語系で of と結びつきやすく、able は古くから to 不定詞と共に使われてきた。前置詞は暗記ではなく歴史の産物である。',
      ],
    },
    EG5_1_ITEMS,
  ),
];
