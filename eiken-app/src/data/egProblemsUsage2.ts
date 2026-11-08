/**
 * 英文法　⑯ 名詞・代名詞・冠詞の語法
 *
 * ★規約★ 各問の `topic` は englishGrammarData.ts の topics を一字一句写す。
 */

import { buildEgSet, type EgItem, type GrammarProblem } from './englishGrammarKit';

// =====================================================================
// eg4_2　⑯ 名詞・代名詞・冠詞の語法
// =====================================================================

const EG4_2_ITEMS: EgItem[] = [
  {
    topic: '不可算名詞（information / advice / furniture / news）',
    focus: '不可算名詞',
    sentence: 'The guidebook gave us a lot of useful ______ about local restaurants and public transport.',
    choices: ['informations', 'information', 'an information', 'informations about'],
    answer: '②',
    rate: 74,
    full: 'The guidebook gave us a lot of useful information about local restaurants and public transport.',
    translation: 'そのガイドブックは、地元のレストランや公共交通機関について有用な情報をたくさん与えてくれた。',
    keyPhrases: [
      { phrase: 'a lot of useful information', meaning: '有用な情報をたくさん（information は不可算）' },
      { phrase: 'public transport', meaning: '公共交通機関' },
    ],
    theme: 'information / advice / furniture / news / baggage は不可算名詞。複数形にも a も付けない',
    type: '語法判断型',
    difficulty: 2,
    steps: [
      '① information が可算名詞か不可算名詞かを確認する → 不可算',
      '② 不可算名詞は複数形にせず、a / an も付けない',
      '③ a lot of は可算・不可算どちらにも使えるので手がかりにならない',
      '④ 原形のまま information を選ぶ',
    ],
    commentary: [
      'information は不可算名詞なので、複数形にも a を付けた形にもできません。よって ② information が正解です。',
      '★頻出の不可算名詞★ information / advice / furniture / news / baggage / luggage / equipment / machinery / homework / progress / damage / evidence。日本語では数えられそうに感じるものが多いので、リストで覚えるのが確実です。',
      '① の informations は複数形で、不可算名詞には作れません。最も多い誤答です。',
      '③ の an information も a / an が付いており不可です。「1つの情報」と言いたいときは ★a piece of information★ という形を使います。',
      '④ の informations about は複数形になっているうえ、about が重複します（文中に about がすでにある）。',
      '★数え方の表現★ a piece of information / advice / furniture、a slice of bread、an item of news、two pieces of baggage。★piece / item / slice を使って数える★ のがルールです。',
    ],
  },
  {
    topic: '数量表現（many / much / few / little / a number of）',
    focus: 'few と little',
    sentence: 'I had ______ time to prepare for the presentation, so I stayed up almost all night.',
    choices: ['few', 'little', 'a few', 'a little'],
    answer: '②',
    rate: 61,
    full: 'I had little time to prepare for the presentation, so I stayed up almost all night.',
    translation: '発表の準備をする時間がほとんどなかったので、私はほぼ徹夜した。',
    keyPhrases: [
      { phrase: 'had little time', meaning: '時間がほとんどなかった（不可算＋否定）' },
      { phrase: 'stayed up almost all night', meaning: 'ほぼ徹夜した（時間がなかった結果）' },
    ],
    theme: 'few / little は「ほとんどない」（否定）、a few / a little は「少しある」（肯定）',
    type: '語法判断型',
    difficulty: 3,
    steps: [
      '① 修飾する名詞 time が可算か不可算かを確認する → 不可算',
      '② 不可算名詞に使うのは little / a little（few / a few は可算）',
      '③ 後半の「ほぼ徹夜した」から、時間が足りなかったと読み取る',
      '④ 否定の意味を持つ little を選ぶ',
    ],
    commentary: [
      'time は不可算名詞なので little / a little のどちらかです。後半の「ほぼ徹夜した」から時間が足りなかったと分かるので、否定の意味を持つ ② little が正解です。',
      '★2軸で決まる★ 可算か不可算か（few 系か little 系か）× a が付くか（肯定か否定か）。few＝ほとんどない（可算）／a few＝少しある（可算）／little＝ほとんどない（不可算）／a little＝少しある（不可算）。',
      '① の few は可算名詞に使います。time は不可算なので合いません。',
      '③ の a few も可算名詞用で、加えて「少しはあった」という肯定になり、徹夜した状況と矛盾します。',
      '④ の a little は不可算名詞用ですが「少しはあった」という肯定です。徹夜するほど足りなかったのだから、否定の little が適切です。',
      '★a がつくと肯定になる理由★ a は「1つの存在」を示すので、「少なくとも存在する」という肯定の含みが生まれます。a のない few / little は「あるかないかで言えばない」という否定寄りの評価になります。',
    ],
  },
  {
    topic: '再帰代名詞・it の特別用法・one / another / the other',
    focus: 'one / the other',
    sentence: 'I have two cousins in Osaka. One is a nurse, and ______ works at a design company.',
    choices: ['another', 'the other', 'other', 'others'],
    answer: '②',
    rate: 66,
    full: 'I have two cousins in Osaka. One is a nurse, and the other works at a design company.',
    translation: '大阪にいとこが2人いる。1人は看護師で、もう1人はデザイン会社で働いている。',
    keyPhrases: [
      { phrase: 'One is a nurse, and the other', meaning: '1人は〜、もう1人は（2人の場合）' },
      { phrase: 'works at a design company', meaning: 'デザイン会社で働いている' },
    ],
    theme: '2つのうち残りの1つは the other。3つ以上のうち別の1つは another',
    type: '語法判断型',
    difficulty: 2,
    steps: [
      '① 全体がいくつあるかを確認する → two cousins（2人）',
      '② One で1人を指したので、残りは1人に特定される',
      '③ 特定される「もう一方」は the other',
      '④ another は3つ以上のうちの「別の1つ」なので選ばない',
    ],
    commentary: [
      'いとこは2人で、One で1人を指したので残りは1人に特定されます。特定される「もう一方」は ② the other が正解です。',
      '★数で使い分ける★ 2つ：One ~, the other ...／3つ：One ~, another ~, the other ...／不特定多数：One ~, another ~, others ~／残り全部：the others。★特定されるかどうかで the が付く★ のが判断の核です。',
      '① の another は「（3つ以上のうち）別の1つ」で、残りが1つに特定される場面では使えません。an＋other なので不特定です。',
      '③ の other は形容詞なので、単独では代名詞になれません。other people のように名詞が必要です。',
      '④ の others は複数を指します。残りは1人なので数が合いません。',
      '★it との違い★ it は「同じもの」を指し、one は「同じ種類の別のもの」を指します。I lost my pen, so I bought one.（別のペン）／I lost my pen, but I found it.（同じペン）。',
    ],
  },
  {
    topic: 'both / either / neither / none の呼応と動詞の数',
    focus: 'neither の呼応',
    sentence: 'Neither of the two explanations ______ convincing enough to persuade the committee.',
    choices: ['are', 'were', 'was', 'have been'],
    answer: '③',
    rate: 54,
    full: 'Neither of the two explanations was convincing enough to persuade the committee.',
    translation: '2つの説明はどちらも、委員会を説得するには十分に納得のいくものではなかった。',
    keyPhrases: [
      { phrase: 'Neither of the two explanations was', meaning: 'どちらも〜でなかった（単数扱い）' },
      { phrase: 'convincing enough to persuade', meaning: '説得するのに十分納得のいく' },
    ],
    theme: 'neither / either は単数扱い。of のあとの複数名詞に引かれない',
    type: '語法判断型',
    difficulty: 3,
    steps: [
      '① 主語の中心語（主語の頭）を特定する → Neither',
      '② neither は「2つのうちどちらも〜ない」で単数扱い',
      '③ of the two explanations は修飾部分なので動詞の数に影響しない',
      '④ 文脈が過去なので was を選ぶ',
    ],
    commentary: [
      '主語の中心は Neither で、これは単数扱いです。文脈が過去なので ③ was が正解です。',
      '★呼応のルール★ both＋複数扱い／either＋単数扱い／neither＋単数扱い／none＋単数・複数どちらも可（可算なら複数が普通）。★of のあとの複数名詞に引かれて複数にしてしまう★ のが最頻出のミスです。',
      '① の are は複数形かつ現在形で、数も時制も合いません。',
      '② の were は複数扱いになっています。explanations に引かれて選びやすい誤答です。動詞の数は必ず ★主語の頭★ で決めます。',
      '④ の have been も複数扱いです（has been なら単数）。加えて現在完了は「〜だった」という過去の一回の判断とは合いません。',
      '★関連する呼応★ each＋単数／every＋単数／a number of＋複数（多数の）／the number of＋単数（〜の数）。数量表現は動詞の数に直結するので、セットで覚えてください。',
    ],
  },
  {
    topic: '冠詞（a / an / the / 無冠詞）と by the hour などの慣用',
    focus: '慣用の the',
    sentence: 'The part-time workers at that cafe are paid ______ hour, not by the month.',
    choices: ['by a', 'by the', 'for the', 'in an'],
    answer: '②',
    rate: 58,
    full: 'The part-time workers at that cafe are paid by the hour, not by the month.',
    translation: 'あのカフェのアルバイトは月給ではなく時給で支払われている。',
    keyPhrases: [
      { phrase: 'are paid by the hour', meaning: '時間単位で支払われる（慣用の by the）' },
      { phrase: 'not by the month', meaning: '月単位ではなく（同じ形の対比）' },
    ],
    theme: '単位を表すときは by the＋単位（by the hour / by the pound / by the dozen）',
    type: '慣用判断型',
    difficulty: 3,
    steps: [
      '① 文末の not by the month が同じ形の対比になっていることに気づく',
      '② 単位を表す慣用は by the＋単位',
      '③ by an hour では「1時間分だけ」という別の意味になる',
      '④ by the を選ぶ',
    ],
    commentary: [
      '文末に not by the month という同じ形の対比があります。単位を表す慣用は by the＋単位なので、② by the が正解です。',
      '★by the＋単位★ は「〜単位で」を表す決まった形です。by the hour（時間給）／by the day（日給）／by the dozen（ダース単位）／by the pound（ポンド単位）／by the meter。この the は「その単位そのもの」を指す総称の the です。',
      '① の by a hour は冠詞が誤りです（hour は母音で始まるので an）。加えて by an hour は「1時間だけ（差として）」という意味になり、単位の意味が出ません。',
      '③ の for the hour は「その1時間のあいだ」という期間になり、支払い単位の意味になりません。',
      '④ の in an hour は「1時間後に」という時の表現で、文脈と合いません。',
      '★体の部分を打つ慣用★ hit him on the head / take him by the arm のように、身体部位には the を使います（his head ではなく the head）。★所有者は目的語で示し、部位は the で受ける★ という英語独特の型です。',
    ],
  },
];

export const egNounArticleProblems: GrammarProblem[] = [
  buildEgSet(
    {
      chapterId: 'eg4_2',
      setNo: 1,
      unitTitle: '⑯ 名詞・代名詞・冠詞の語法',
      category: '不可算名詞・few と little・one と another・neither の呼応・by the＋単位',
      intro:
        '名詞・代名詞・冠詞の語法は、暗記に見えて実は3つの問いに整理できます。(1) その名詞は数えられるか（information は数えられない）、(2) 残りが特定されるか（the other か another か）、(3) 主語の頭はどれか（動詞の数はそこで決まる）。この3つを毎回同じ順で確認すれば、of のあとの複数名詞に引かれるような事故は起きません。冠詞は理屈より慣用が強い領域なので、by the hour のような形はフレーズごと覚えるのが得策です。',
      summary: [
        '不可算名詞：information / advice / furniture / news / baggage / equipment / homework / progress。',
        '数えるときは a piece of / an item of / a slice of を使う。',
        'few / little＝ほとんどない（否定）、a few / a little＝少しある（肯定）。few 系は可算、little 系は不可算。',
        '2つなら One ~, the other ...／3つ以上なら One ~, another ~, the other ...。残り全部は the others。',
        'either / neither / each / every は単数扱い。of のあとの複数名詞に引かれない。',
        'by the＋単位（by the hour / by the dozen）。身体部位は the で受ける（hit him on the head）。',
      ],
      surroundingKnowledge: [
        '集合名詞 family / team / audience は、まとまりなら単数、個々なら複数扱い。',
        '複数形で意味が変わる名詞：arms（武器）／customs（税関）／manners（作法）／glasses（眼鏡）。',
        'the＋形容詞で「〜な人々」（the rich / the young）は複数扱い。',
        '固有名詞に the が付く場合：川・海・山脈・国名の一部（the Nile / the Alps / the Netherlands）。',
        'a number of＋複数（多数の／複数扱い）と the number of＋複数（〜の数／単数扱い）は動詞の数が逆。',
      ],
      deepDiveTopics: [
        'なぜ information は不可算なのか。英語では「境界が明確な個体」を可算、「境界のない広がり」を不可算として扱う。情報・助言・家具は「まとまりとして広がるもの」と捉えられている。一方で日本語は助数詞で数えるので直感がずれる。',
        'few と a few の差は「評価」の差。a は「存在する」ことに焦点を当てるので肯定的、a のない few は「量として不足している」という話者の評価を含む。文法ではなく話者の視点が形に現れている例。',
        'the other の the は「残りが1つに決まる」ことを示す。定冠詞の本質は「聞き手が特定できる」ことであり、2つのうち1つを取れば残りは自動的に決まるため the が必要になる。数の情報が冠詞を決めている。',
        'by the hour の the は「単位としての1時間」を指す総称用法。The lion is a strong animal.（ライオンという種）と同じ用法で、個体ではなく種類・単位そのものを指している。',
      ],
    },
    EG4_2_ITEMS,
  ),
];
