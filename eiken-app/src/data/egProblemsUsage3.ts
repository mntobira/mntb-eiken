/**
 * 英文法　⑰ 形容詞・副詞の語法
 *
 * ★規約★ 各問の `topic` は englishGrammarData.ts の topics を一字一句写す。
 */

import { buildEgSet, type EgItem, type GrammarProblem } from './englishGrammarKit';

// =====================================================================
// eg4_3　⑰ 形容詞・副詞の語法
// =====================================================================

const EG4_3_ITEMS: EgItem[] = [
  {
    topic: '人が主語にできない形容詞（It is impossible for A to do）',
    focus: '人を主語にできない形容詞',
    sentence: '______ for a beginner to master this instrument in only a few weeks.',
    choices: ['He is impossible', 'It is impossible', 'It is impossible that', 'There is impossible'],
    answer: '②',
    rate: 62,
    full: 'It is impossible for a beginner to master this instrument in only a few weeks.',
    translation: '初心者がわずか数週間でこの楽器を習得するのは不可能だ。',
    keyPhrases: [
      { phrase: 'It is impossible for A to do', meaning: 'A が〜するのは不可能だ（形式主語）' },
      { phrase: 'master this instrument', meaning: 'この楽器を習得する' },
    ],
    theme: 'impossible / necessary / convenient は人を主語にできない。形式主語 It を使う',
    type: '語法判断型',
    difficulty: 3,
    steps: [
      '① 文中に for a beginner to master という「for A to do」があることを確認する',
      '② impossible は人を主語にできない形容詞',
      '③ 形式主語 It で始め、真主語を to 不定詞にする',
      '④ It is impossible for A to do の形を選ぶ',
    ],
    commentary: [
      'for a beginner to master という「for A to do」の形があるので、形式主語構文です。impossible は人を主語にできない形容詞なので、② It is impossible が正解です。',
      '★人を主語にできない形容詞★ impossible / possible / necessary / convenient / difficult（意味によって可）。「〜が〜するのは…だ」は It is ... for A to do の形で表します。',
      '① の He is impossible は「彼は（性格的に）どうしようもない」という別の意味になり、しかも後ろの for a beginner to master とつながりません。',
      '③ の It is impossible that は形としては可能ですが、そのあとに続くのは S＋V の節です。ここは for A to do の形なので合いません。',
      '④ の There is impossible は There is 構文に形容詞が来ており、形として成立しません。',
      '★be 動詞＋形容詞＋to do で人が主語になれる形★ He is easy to please.（彼は喜ばせやすい）のように、to do の目的語が主語になる場合は人を主語にできます。impossible にはこの用法もありますが（The problem is impossible to solve.）、for A to do を続けるときは形式主語です。',
    ],
  },
  {
    topic: '紛らわしい形容詞（imaginable / imaginary / imaginative）',
    focus: '語尾で意味が変わる形容詞',
    sentence: 'Dragons are ______ creatures, but they appear in the myths of many different cultures.',
    choices: ['imaginable', 'imaginary', 'imaginative', 'imagining'],
    answer: '②',
    rate: 51,
    full: 'Dragons are imaginary creatures, but they appear in the myths of many different cultures.',
    translation: 'ドラゴンは架空の生き物だが、多くの異なる文化の神話に登場する。',
    keyPhrases: [
      { phrase: 'imaginary creatures', meaning: '架空の生き物（実在しない）' },
      { phrase: 'appear in the myths', meaning: '神話に登場する' },
    ],
    theme: 'imaginary（架空の）/ imaginable（想像できる）/ imaginative（想像力豊かな）',
    type: '語い判断型',
    difficulty: 4,
    steps: [
      '① 修飾される名詞が creatures（生き物）であることを確認する',
      '② ドラゴンは実在しないので「架空の」という意味が必要',
      '③ 「架空の」は imaginary',
      '④ -able（できる）／-ive（性質がある）と語尾で意味が変わることを確認する',
    ],
    commentary: [
      'ドラゴンは実在しない生き物なので、「架空の」を表す ② imaginary が正解です。',
      '★語尾で意味が分かれる3語★ imaginary（架空の／実在しない）／imaginable（想像できる／可能性がある）／imaginative（想像力に富んだ／人や作品に使う）。★-able は「〜できる」、-ive は「〜する性質がある」★ という接尾辞の意味から導けます。',
      '① の imaginable は「想像できる」で、the worst thing imaginable（想像しうる最悪のこと）のように使います。ドラゴンを「想像できる生き物」と言うと意味がずれます。',
      '③ の imaginative は「想像力豊かな」で、人や作品を評価する語です。an imaginative writer のように使います。生き物の実在性とは無関係です。',
      '④ の imagining は動名詞・現在分詞で、名詞を修飾する形容詞としては不自然です。',
      '★同じ型の3兄弟★ respectable（立派な）／respectful（礼儀正しい）／respective（それぞれの）。considerable（かなりの）／considerate（思いやりのある）。economic（経済の）／economical（節約になる）。★接尾辞の意味から推測する★ 習慣をつけましょう。',
    ],
  },
  {
    topic: '数と量の形容詞（high / large / heavy の相性）',
    focus: '形容詞と名詞の相性',
    sentence: 'The city recorded a ______ population growth of nearly ten percent last year.',
    choices: ['many', 'much', 'large', 'high'],
    answer: '③',
    rate: 49,
    full: 'The city recorded a large population growth of nearly ten percent last year.',
    translation: 'その市は昨年、10パーセント近くという大きな人口増加を記録した。',
    keyPhrases: [
      { phrase: 'a large population growth', meaning: '大きな人口増加（population には large）' },
      { phrase: 'nearly ten percent', meaning: '10パーセント近く' },
    ],
    theme: 'population / audience には large、price / salary には high、rain / traffic には heavy',
    type: '語法判断型',
    difficulty: 4,
    steps: [
      '① 修飾される名詞を特定する → population growth',
      '② population は many / much では修飾しない',
      '③ population の大小は large / small で表す',
      '④ large を選ぶ',
    ],
    commentary: [
      'population（人口）の大小は large / small で表します。よって ③ large が正解です。',
      '★名詞ごとに相棒の形容詞が決まっている★ のが英語の特徴です。population / audience / family / income → large / small。price / salary / temperature / cost → high / low。rain / snow / traffic / smoker → heavy / light。',
      '① の many は可算名詞の複数形を修飾します。population growth は不可算的な単数なので合いません。',
      '② の much は不可算名詞を修飾できますが、a much ... という形は作れません（a が付いている）。また population に much は使いません。',
      '④ の high は価格・温度・給料などに使います。人口には large を使うのが慣用です。ここが最も選ばれやすい誤答です。',
      '★覚え方★ 「数の多さを面積で捉えるもの（人口・聴衆・収入）＝large」「目盛りの高さで捉えるもの（価格・温度）＝high」「重さで捉えるもの（雨・交通量）＝heavy」。★イメージで束ねる★ と定着します。',
    ],
  },
  {
    topic: '副詞の位置と意味（already / yet / still / almost）',
    focus: '副詞の使い分け',
    sentence: 'I have been waiting for over an hour, but the delivery has not arrived ______.',
    choices: ['already', 'still', 'yet', 'almost'],
    answer: '③',
    rate: 70,
    full: 'I have been waiting for over an hour, but the delivery has not arrived yet.',
    translation: '1時間以上待っているが、配達はまだ届いていない。',
    keyPhrases: [
      { phrase: 'has not arrived yet', meaning: 'まだ届いていない（否定文＋yet）' },
      { phrase: 'have been waiting for over an hour', meaning: '1時間以上待ち続けている' },
    ],
    theme: 'yet は否定文・疑問文で「まだ」。already は肯定文で「すでに」',
    type: '語法判断型',
    difficulty: 2,
    steps: [
      '① 文が否定文（has not arrived）であることを確認する',
      '② 否定文で「まだ」を表すのは yet',
      '③ 位置は文末が基本',
      '④ already は肯定文専用だと確認する',
    ],
    commentary: [
      '否定文で「まだ〜していない」を表すのは yet なので、③ が正解です。位置は文末が基本です。',
      '★使い分け★ already（すでに／肯定文、文中または文末）／yet（まだ／否定文・疑問文、文末）／still（今もなお／肯定文、be 動詞の後・一般動詞の前）。★文の種類（肯定・否定・疑問）で決まる★ のが最大のポイントです。',
      '① の already は肯定文で使います。否定文に入れると「すでに届いていない」という不自然な意味になります（驚きを表す特別な用法はありますが、この文脈では不適切です）。',
      '② の still は「今もなお」で、still has not arrived という語順なら成立します。しかし位置が文末なので、この選択肢では合いません。★still の位置は not の前★ です。',
      '④ の almost は「ほとんど」で程度を表し、「まだ」という意味はありません。',
      '★almost の注意★ almost は副詞なので名詞を直接修飾できません。× almost students → ○ almost all students / most students。頻出の誤りです。',
    ],
  },
  {
    topic: 'ago / before、late / lately、hard / hardly の区別',
    focus: 'hard と hardly',
    sentence: 'The room was so dark that I could ______ see the numbers written on the door.',
    choices: ['hard', 'hardly', 'hardly not', 'not hardly'],
    answer: '②',
    rate: 64,
    full: 'The room was so dark that I could hardly see the numbers written on the door.',
    translation: '部屋がとても暗かったので、ドアに書かれた数字がほとんど見えなかった。',
    keyPhrases: [
      { phrase: 'could hardly see', meaning: 'ほとんど見えなかった（hardly＝ほとんど〜ない）' },
      { phrase: 'so dark that', meaning: 'とても暗かったので（結果を導く）' },
    ],
    theme: 'hard は「熱心に／固い」、hardly は「ほとんど〜ない」。-ly で意味が変わる',
    type: '語法判断型',
    difficulty: 3,
    steps: [
      '① 前半の so dark that から「見えなかった」という否定の結果を予測する',
      '② 「ほとんど〜ない」を表す副詞は hardly',
      '③ hard は「熱心に」で意味が逆になる',
      '④ hardly 自体が否定語なので not と重ねない',
    ],
    commentary: [
      '前半の「とても暗かったので」から否定の結果が来ると予測できます。「ほとんど〜ない」は hardly なので ② が正解です。',
      '★-ly が付くと意味が変わる副詞★ hard（熱心に／激しく）／hardly（ほとんど〜ない）。late（遅く）／lately（最近）。near（近くに）／nearly（ほとんど）。most（最も）／mostly（主に）。★形が似ているのに意味が無関係★ という点が狙われます。',
      '① の hard は「熱心に」なので、could hard see という形も作れず、意味も逆になります。',
      '③ の hardly not は否定を2つ重ねた形で成立しません。hardly はそれ自体が否定語です。',
      '④ の not hardly も二重否定で不可です。',
      '★ago と before の区別★ ago は「今から〜前」で過去形とともに使い（three days ago）、before は「そのときから〜前」で過去完了とともに使う（three days before）。★基準点が現在か過去か★ で決まります。',
    ],
  },
];

export const egAdjAdverbProblems: GrammarProblem[] = [
  buildEgSet(
    {
      chapterId: 'eg4_3',
      setNo: 1,
      unitTitle: '⑰ 形容詞・副詞の語法',
      category: '形式主語の形容詞・接尾辞で変わる意味・名詞との相性・already と yet・hard と hardly',
      intro:
        '形容詞・副詞の語法は「名詞との相性」と「接尾辞の意味」の2本柱で攻略できます。population には large、price には high、rain には heavy というように、★英語では名詞ごとに相棒の形容詞が決まっています★。また imaginary / imaginable / imaginative のように語尾だけが違う語は、-able（できる）／-ive（性質がある）という接尾辞の意味から推測できます。副詞では already / yet / still の使い分けと、hard / hardly のような -ly で意味が変わるペアが最重要です。',
      summary: [
        'impossible / necessary / convenient は人を主語にできない。It is ... for A to do の形にする。',
        'imaginary（架空の）／imaginable（想像できる）／imaginative（想像力豊かな）。接尾辞で意味が決まる。',
        'population / audience / income → large。price / salary / temperature → high。rain / traffic → heavy。',
        'already（肯定文）／yet（否定文・疑問文）／still（肯定文、not の前）。',
        'hard（熱心に）／hardly（ほとんど〜ない）、late（遅く）／lately（最近）、near（近くに）／nearly（ほとんど）。',
        'almost は副詞なので名詞を直接修飾しない（almost all students / most students）。',
      ],
      surroundingKnowledge: [
        '叙述用法のみの形容詞：afraid / alive / asleep / alone / awake。名詞の前には置けない（× an asleep baby）。',
        '限定用法のみの形容詞：mere / only / very（強調）／upper / former。',
        '数量の形容詞と単位：a three-year-old boy（ハイフンで結ぶと単数形）。',
        'enough は形容詞・副詞を後ろから修飾する（good enough / fast enough）。',
        '感覚動詞（look / sound / taste / feel / smell）のあとは形容詞（副詞にしない）：It looks good.',
      ],
      deepDiveTopics: [
        'なぜ impossible は人を主語にできないのか。impossible は「事柄の実現可能性」を評価する形容詞で、評価の対象が「行為・出来事」だから。だから真主語は to do（行為）になり、形式主語 It が必要になる。一方 easy / difficult は「人にとっての難易度」も表せるため用法が広い。',
        'hardly / scarcely / barely はいずれも「ほとんど〜ない」だが、hardly は程度、scarcely は数量、barely は「かろうじて〜する」という肯定寄りのニュアンスを持つ。同じ訳語でも焦点が違う。',
        'population に large を使い high を使わないのは、英語が人口を「広がりの面積」として捉えているため。逆に price は「目盛りの高さ」として捉えるので high。★語の背後にあるメタファーが語法を決めている★ という視点は、未知の組み合わせを推測するのにも役立つ。',
        'already が否定文に入ると「もう〜ないのか（驚き）」という含みが生じる。文法的に禁止されているのではなく、意味的に特殊な効果を生む。副詞の位置と文の種類が、話者の態度を伝える手段になっている。',
      ],
    },
    EG4_3_ITEMS,
  ),
];
