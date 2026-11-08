/**
 * 英文法　⑳ 会話表現と多義語・語い
 *
 * ★規約★ 各問の `topic` は englishGrammarData.ts の topics を一字一句写す。
 */

import { buildEgSet, type EgItem, type GrammarProblem } from './englishGrammarKit';

// =====================================================================
// eg5_2　⑳ 会話表現と多義語・語い
// =====================================================================

const EG5_2_ITEMS: EgItem[] = [
  {
    topic: '定型応答（Why don\'t you ~? / How come ~? / What if ~?）',
    focus: 'How come の語順',
    sentence: '"______ you didn\'t come to the party last night?" "I had to look after my little brother."',
    choices: ['How come', 'How come did', 'Why come', 'What come'],
    answer: '①',
    rate: 57,
    // ★音源は会話の「応答」まで入れる★
    //   もとは問いかけの1文だけを読み上げていたが、この問題は
    //   応答（I had to look after my little brother.）で理由が返ってくることが
    //   空所に理由を尋ねる表現が入る根拠で、解説の最後でもそこを説明している。
    //   応答を読み上げないと、音で確認する人だけ肝心の手がかりを聞けない。
    //   同じ会話問題の問2 は最初から両方入っているので、そちらにそろえた。
    full: 'How come you didn\'t come to the party last night? I had to look after my little brother.',
    translation: 'どうして昨夜パーティーに来なかったの？—弟の世話をしなければならなかったんだ。',
    keyPhrases: [
      { phrase: 'How come you didn\'t come', meaning: 'どうして来なかったの（How come＋S＋V）' },
      { phrase: 'look after my little brother', meaning: '弟の世話をする' },
    ],
    theme: 'How come のあとは疑問文の語順にせず、そのまま S＋V を置く',
    type: '会話表現型',
    difficulty: 3,
    steps: [
      '① 空所のあとは you didn\'t come と平叙文の語順',
      '② 理由を尋ねる表現で、語順を変えないものを探す',
      '③ How come＋S＋V で「どうして〜なのか」',
      '④ How come を選ぶ',
    ],
    commentary: [
      '空所のあとが you didn\'t come という★平叙文の語順★になっています。理由を尋ねる表現のうち語順を変えないのは How come なので、① が正解です。',
      '★Why と How come★ Why didn\'t you come?（疑問文の語順）／ How come you didn\'t come?（S＋V の語順）。意味はほぼ同じですが How come は口語的で、驚きの気持ちを含みます。',
      '② の How come did は語順が二重になっています。How come のあとに did を入れる必要はありません。',
      '③ の Why come、④ の What come はいずれも存在しない形です。come が動詞として浮いてしまいます。',
      '★覚えておきたい会話の型★ Why don\'t you do ~?（〜したらどう？＝提案）／ Why don\'t we do ~?（〜しようよ＝勧誘）／ What if S V?（もし〜ならどうする？）／ What do you say to doing?（〜するのはどう？）。',
      '★答え方に注目★ この会話の応答は I had to look after my little brother. と理由を述べています。理由が返ってきていることが、空所に「理由を尋ねる表現」が入る根拠になります。',
    ],
  },
  {
    topic: '依頼・提案・申し出への自然な返し方',
    focus: 'Would you mind への答え',
    sentence: '"Would you mind opening the window?" "______ It\'s getting hot in here."',
    choices: ['Yes, I would.', 'Not at all.', 'No, thank you.', 'Never mind.'],
    answer: '②',
    rate: 52,
    full: 'Would you mind opening the window? Not at all. It\'s getting hot in here.',
    translation: '窓を開けていただけませんか。—まったく構いませんよ。ここは暑くなってきましたから。',
    keyPhrases: [
      { phrase: 'Would you mind opening', meaning: '開けていただけませんか（mind＋doing）' },
      { phrase: 'Not at all.', meaning: 'まったく構いません（承諾）' },
    ],
    theme: 'mind は「気にする」。承諾は No / Not at all、断るときは I\'m afraid ...',
    type: '会話表現型',
    difficulty: 4,
    steps: [
      '① 応答の後半 It\'s getting hot in here から、窓を開けたい状況だと読む',
      '② つまり依頼を承諾している',
      '③ mind（気にする）への承諾は「気にしません」＝否定で答える',
      '④ Not at all. を選ぶ',
    ],
    commentary: [
      '後半の It\'s getting hot in here.（暑くなってきた）から、窓を開けることに賛成していると読めます。mind は「気にする」なので、承諾は★否定で答える★のがルールです。よって ② Not at all. が正解です。',
      '★Would you mind doing? の答え方★ 承諾＝No, not at all. / Of course not. / Certainly not. ／ 断り＝I\'m afraid I would. / I\'d rather you didn\'t.。日本語の「はい、いいですよ」に引かれて Yes と答えると逆の意味になります。',
      '① の Yes, I would. は「気にします」＝断りになり、後半の「暑くなってきた」と矛盾します。★この単元で最も多い誤答★です。',
      '③ の No, thank you. は「いいえ、結構です」で、申し出（Would you like ~?）を断る返事。依頼への応答には合いません。',
      '④ の Never mind. は「気にしないで」と相手を慰める表現で、依頼への承諾にはなりません。',
      '★申し出と依頼の区別★ Would you like some tea?（申し出）→ Yes, please. / No, thank you.。Would you mind doing?（依頼）→ Not at all. / I\'m afraid ...。★何を尋ねられているかで答え方が変わります★。',
    ],
  },
  {
    topic: '多義語（bear / hold / stand / matter / practice）',
    focus: 'stand の「我慢する」',
    sentence: 'I can\'t ______ the noise from the construction site any longer; I\'m going to complain.',
    choices: ['stand', 'stand for', 'stand by', 'stand out'],
    answer: '①',
    rate: 59,
    full: 'I can\'t stand the noise from the construction site any longer; I\'m going to complain.',
    translation: '工事現場の騒音をこれ以上我慢できない。文句を言うつもりだ。',
    keyPhrases: [
      { phrase: 'can\'t stand the noise', meaning: '騒音を我慢できない（stand＝耐える）' },
      { phrase: 'any longer', meaning: 'これ以上（否定文で）' },
    ],
    theme: 'stand は「立つ」以外に「耐える」の意味。can\'t stand A＝A を我慢できない',
    type: '語い判断型',
    difficulty: 3,
    steps: [
      '① any longer と I\'m going to complain から「限界だ」という内容をつかむ',
      '② 空所の直後は the noise という目的語',
      '③ 「我慢できない」は can\'t stand A（前置詞は不要）',
      '④ stand を選ぶ',
    ],
    commentary: [
      'any longer（これ以上）と I\'m going to complain（文句を言う）から、「もう我慢できない」という意味だとわかります。can\'t stand A で「A を我慢できない」なので ① が正解です。',
      '★stand の多義★ 立つ／耐える（can\'t stand）／stand for A（A を表す・略す）／stand by A（A を支持する・待機する）／stand out（目立つ）。★同じ動詞でも後ろの形で意味が変わります★。',
      '② の stand for は「〜を表す」（UN stands for the United Nations.）。騒音を「表す」では意味が通りません。',
      '③ の stand by は「支持する・傍観する」。目的語 the noise と結びつきません。',
      '④ の stand out は自動詞句で「目立つ」。直後に目的語を置けません。',
      '★同じ「我慢する」の仲間★ bear（bear the pain）／ put up with（put up with the noise）／ tolerate。bear は「重さを支える」が原義で、「耐える」以外に「（子を）産む」「（実を）つける」の意味もあります。★多義語は原義から枝分かれを見る★と整理できます。',
    ],
  },
  {
    topic: '接続表現・ディスコースマーカー（however / therefore / nevertheless）',
    focus: 'however は副詞',
    sentence: 'The plan looked perfect on paper. ______, it failed completely when we actually tried it.',
    choices: ['However', 'But however', 'Although', 'Despite'],
    answer: '①',
    rate: 64,
    full: 'The plan looked perfect on paper. However, it failed completely when we actually tried it.',
    translation: 'その計画は書類の上では完璧に見えた。しかし、実際に試してみると完全に失敗した。',
    keyPhrases: [
      { phrase: 'However, it failed completely', meaning: 'しかし、それは完全に失敗した' },
      { phrase: 'looked perfect on paper', meaning: '書類の上では完璧に見えた' },
    ],
    theme: 'however は副詞。前の文と切って使う（However, S V.）',
    type: '構造判断型',
    difficulty: 2,
    steps: [
      '① 空所の前はピリオドで文が終わっている',
      '② 空所のあとは it failed という独立した文',
      '③ 文と文をつなぐのは接続副詞（however / therefore など）',
      '④ However を選ぶ',
    ],
    commentary: [
      '空所の前でピリオドにより文が終わり、あとにも独立した文が続いています。独立した2文の間で対比を示すのは★接続副詞★の however なので ① が正解です。',
      '★接続副詞とは★ however / therefore / nevertheless / moreover / thus。文と文の論理関係を示しますが、文法上は副詞なので、2つの文を1文にまとめることはできません（× It looked perfect, however it failed. は不可）。',
      '② の But however は but（接続詞）と however（副詞）の意味が重複しており、標準的な英語では使いません。',
      '③ の Although は接続詞なので、Although the plan looked perfect, it failed. のように★1つの文の中★で使います。ピリオドで区切ったあとに単独で置けません。',
      '④ の Despite は前置詞なので直後に名詞が必要です（Despite the perfect plan, ...）。it failed という文を続けられません。',
      '★論理関係で整理する★ 逆接＝however / nevertheless / on the contrary。因果＝therefore / consequently / thus。追加＝moreover / furthermore / in addition。★長文では接続表現が段落の流れを示す標識になります★。',
    ],
  },
  {
    topic: '紛らわしい語の使い分け（affect / effect, adapt / adopt）',
    focus: 'affect と effect',
    sentence: 'Scientists are studying how rising temperatures ______ the migration of birds.',
    choices: ['effect', 'affect', 'effect on', 'affect on'],
    answer: '②',
    rate: 56,
    full: 'Scientists are studying how rising temperatures affect the migration of birds.',
    translation: '科学者たちは、気温の上昇が鳥の渡りにどのように影響するかを研究している。',
    keyPhrases: [
      { phrase: 'affect the migration of birds', meaning: '鳥の渡りに影響する（affect＝他動詞）' },
      { phrase: 'rising temperatures', meaning: '上昇する気温' },
    ],
    theme: 'affect は動詞「影響する」（他動詞・前置詞不要）、effect は名詞「影響」',
    type: '語い判断型',
    difficulty: 4,
    steps: [
      '① how のあとは rising temperatures（S）＋空所（V）という形',
      '② つまり空所には動詞が必要',
      '③ 「影響する」の動詞は affect',
      '④ affect は他動詞なので前置詞を付けずに ② を選ぶ',
    ],
    commentary: [
      'how のあとが rising temperatures（S）＋空所 という形なので、空所には★動詞★が入ります。「影響する」の動詞は affect で、しかも他動詞なので前置詞は不要です。よって ② が正解です。',
      '★affect と effect★ affect＝動詞「影響する」／ effect＝名詞「影響・効果」。名詞で言うなら have an effect on A の形になります。★a が付けられるのが effect（名詞）★と覚えると確実です。',
      '① の effect は名詞なので、動詞の位置には置けません。つづりが1文字違いなので最も混同しやすい誤答です。',
      '③ の effect on は have an effect on A の一部を切り出した形で、動詞がありません。',
      '④ の affect on は誤りです。have an effect on A の on が記憶に残っているために付けてしまう典型的なミスですが、★affect は他動詞なので on は不要★です。',
      '★同系統の紛らわしいペア★ adapt（適応する・改作する）／ adopt（採用する・養子にする）／ adept（熟練した）。rise（自動詞）／ raise（他動詞）。lie（横たわる）／ lay（横たえる）。★品詞と自他をセットで確認する★のが対策です。',
    ],
  },
];

export const egConversationProblems: GrammarProblem[] = [
  buildEgSet(
    {
      chapterId: 'eg5_2',
      setNo: 1,
      unitTitle: '⑳ 会話表現と多義語・語い',
      category: 'How come・Would you mind の答え方・stand の多義・however・affect と effect',
      intro:
        '会話表現と語いは、文法規則ではなく★やりとりの型★で覚える単元です。How come のあとは語順を変えない、Would you mind への承諾は No で答える——どちらも理屈より慣習ですが、応答文の内容から必ず判断できるようになっています。多義語は原義から枝分かれを追うこと、紛らわしい語は品詞と自他をセットで確認することが決め手です。★答えの根拠は必ず相手の発言や後続文にある★という読み方を身につけましょう。',
      summary: [
        'How come＋S＋V（語順を変えない）。Why＋疑問文の語順、と区別する。',
        'Would you mind doing? への承諾は No / Not at all。Yes は断りになる。',
        'can\'t stand A＝A を我慢できない。stand for（表す）／stand by（支持）／stand out（目立つ）。',
        'however / therefore / nevertheless は接続副詞。文と文を1文にはまとめられない。',
        'affect＝動詞「影響する」（他動詞）、effect＝名詞「影響」。have an effect on A。',
        'adapt（適応）／adopt（採用）、rise（自動詞）／raise（他動詞）も品詞と自他で判断する。',
      ],
      surroundingKnowledge: [
        'What do you say to doing?（〜するのはどう？）の to は前置詞なので doing が続く。',
        'Help yourself to A（A を自由に取って食べて）。I couldn\'t agree more.（大賛成）。',
        'I\'m afraid ... は断りや悪い知らせの前置き。丁寧に否定する定番表現。',
        'matter は名詞「事柄・問題」と動詞「重要である」（It doesn\'t matter.）。',
        'practice は名詞「練習・慣習・（医師などの）業務」と動詞「練習する」。多義語の代表。',
      ],
      deepDiveTopics: [
        'Would you mind への答えが「No」で承諾になるのは、mind が「気にする」という動詞だから。日本語では「はい、いいですよ」と肯定で答えるので、母語の癖がそのまま誤答につながる。★訳ではなく動詞の意味に立ち返る★ことが唯一の対策になる。',
        'How come が疑問文の語順を取らないのは、もともと How does it come that ~? という文の省略形だから。that 以下は従属節なので平叙文の語順のまま残った。★不規則に見える語順にも歴史的な理由がある★。',
        'affect と effect の混同は英語の母語話者でも頻繁に起こる。発音がほぼ同じで（/əˈfekt/ と /ɪˈfekt/）、意味も近いためである。ラテン語 afficere（働きかける）と efficere（成し遂げる）に由来し、ad-（〜へ）と ex-（外へ）という接頭辞の違いが本来の区別だった。',
        'stand や bear のような基本動詞が多くの意味を持つのは、語の使用頻度が高いほど意味が拡張しやすいという言語の一般傾向による。逆に難しい語（tolerate など）は意味が1つに限定される。★基本語こそ多義であり、多義語こそ入試で問われる★。',
      ],
    },
    EG5_2_ITEMS,
  ),
];
