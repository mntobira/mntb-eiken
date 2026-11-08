/**
 * 英文法　⑮ 動詞の語法（自他・語形・型）
 *
 * ★規約★ 各問の `topic` は englishGrammarData.ts の topics を一字一句写す。
 */

import { buildEgSet, type EgItem, type GrammarProblem } from './englishGrammarKit';

// =====================================================================
// eg4_1　⑮ 動詞の語法（自他・語形・型）
// =====================================================================

const EG4_1_ITEMS: EgItem[] = [
  {
    topic: '混同しやすい自動詞と他動詞（rise / raise, lie / lay, sit / seat）',
    focus: 'rise と raise',
    sentence: 'The price of imported wheat has ______ sharply over the past three months.',
    choices: ['raised', 'risen', 'rose', 'been raising'],
    answer: '②',
    rate: 63,
    full: 'The price of imported wheat has risen sharply over the past three months.',
    translation: '輸入小麦の価格はこの3か月で急激に上昇した。',
    keyPhrases: [
      { phrase: 'has risen sharply', meaning: '急激に上昇した（rise は自動詞）' },
      { phrase: 'over the past three months', meaning: 'この3か月にわたって（現在完了の目印）' },
    ],
    theme: 'rise は自動詞（上がる）、raise は他動詞（上げる）。目的語の有無で決まる',
    type: '語法判断型',
    difficulty: 2,
    steps: [
      '① 空所の後ろに目的語（名詞）があるかを確認する → sharply（副詞）だけ',
      '② 目的語がないので自動詞が必要',
      '③ 「上がる」の自動詞は rise、活用は rise - rose - risen',
      '④ has のあとなので過去分詞 risen を選ぶ',
    ],
    commentary: [
      '空所の後ろは sharply（副詞）だけで目的語がありません。よって自動詞が必要で、has のあとは過去分詞なので ② risen が正解です。',
      '自他のペアは活用ごと覚えます。★rise - rose - risen★（自：上がる）／★raise - raised - raised★（他：上げる）。★lie - lay - lain★（自：横たわる）／★lay - laid - laid★（他：横たえる）。★sit - sat - sat★（自：座る）／★seat - seated - seated★（他：座らせる）。',
      '① の raised は他動詞の過去分詞です。目的語がないので使えません。日本語の「価格が上昇した」を「上げた」と混同すると選んでしまいます。',
      '③ の rose は過去形です。has のあとには過去分詞が必要なので形が合いません。',
      '④ の been raising は現在完了進行形の受動でもない中途半端な形で、他動詞 raise を使っているうえ目的語もありません。',
      '★判定手順は1つだけ★ 「後ろに目的語があるか」を見る。あれば他動詞（raise / lay / seat）、なければ自動詞（rise / lie / sit）。意味から考えると日本語に引きずられるので、必ず形から判定してください。',
    ],
  },
  {
    topic: '第4文型をとらない動詞（explain / suggest には to が必要）',
    focus: 'explain の語法',
    sentence: 'Could you please explain ______ why this method is more efficient than the old one?',
    choices: ['us', 'to us', 'for us', 'us about'],
    answer: '②',
    rate: 57,
    full: 'Could you please explain to us why this method is more efficient than the old one?',
    translation: 'なぜこの方法が旧来のものより効率的なのか、私たちに説明していただけますか。',
    keyPhrases: [
      { phrase: 'explain to us why', meaning: '私たちに〜を説明する（explain は to が必要）' },
      { phrase: 'more efficient than', meaning: '〜より効率的な' },
    ],
    theme: 'explain / suggest / propose / describe は第4文型を取らず、人の前に to が必要',
    type: '語法判断型',
    difficulty: 3,
    steps: [
      '① explain が第4文型（SVOO）を取れる動詞かを確認する → 取れない',
      '② 人を示すときは前置詞 to が必要',
      '③ 語順は explain＋to＋人＋内容',
      '④ to us を選ぶ',
    ],
    commentary: [
      'explain は第4文型（SVOO）を取れない動詞なので、人を示すときは前置詞 to が必要です。よって ② to us が正解です。',
      '★第4文型を取れない動詞★ explain / suggest / propose / describe / introduce / announce / mention。いずれも「〜に」を示すには to が必要です。日本語で「私たちに説明する」と言えるので、つい explain us としてしまうのが最頻出の誤りです。',
      '① の us は第4文型の形（explain us why）です。give us a book のように SVOO を取れる動詞なら正しいのですが、explain では使えません。',
      '③ の for us は「私たちのために」という利益を表します。explain は方向を示す to を使います。',
      '④ の us about は語順が誤りです。explain about ~ という形もありますが、その場合 about のあとには話題（名詞）が来ます（explain about the plan）。人は about のあとには来ません。',
      '★対比で覚える★ tell / give / show は第4文型を取れる（tell us the truth）。explain / suggest / describe は取れない（explain to us the reason）。両者の違いは「相手に手渡す」イメージがあるかどうかです。',
    ],
  },
  {
    topic: 'V＋O＋to do / V＋O＋do の型の区別（tell / let / make）',
    focus: '動詞の型の区別',
    sentence: 'The coach made all the players ______ around the field five times before practice.',
    choices: ['to run', 'running', 'run', 'ran'],
    answer: '③',
    rate: 71,
    full: 'The coach made all the players run around the field five times before practice.',
    translation: 'コーチは練習前に選手全員をグラウンド5周走らせた。',
    keyPhrases: [
      { phrase: 'made all the players run', meaning: '選手全員を走らせた（make＋O＋原形）' },
      { phrase: 'five times before practice', meaning: '練習前に5周' },
    ],
    theme: 'make / have / let は O のあとに原形、tell / ask / want は O のあとに to do',
    type: '語法判断型',
    difficulty: 2,
    steps: [
      '① 空所の前の動詞が何かを確認する → made（使役動詞 make）',
      '② make は V＋O＋原形の型を取る',
      '③ tell / ask / want / allow なら V＋O＋to do になると区別する',
      '④ 原形 run を選ぶ',
    ],
    commentary: [
      'make は使役動詞で V＋O＋原形の型を取ります。よって ③ run が正解です。',
      '★型で分類する★ 原形を取る：make / have / let（使役）、see / hear / feel / watch（知覚）。to do を取る：tell / ask / want / allow / advise / enable / force / persuade。help は両方可（help A (to) do）。get は to do のみ（get A to do）。',
      '① の to run は tell / ask / want なら正しい形です。The coach told all the players to run とすれば成立します。動詞が変われば型も変わります。',
      '② の running は知覚動詞なら可能です（I saw him running）。make は進行の意味を取らないので不可です。',
      '④ の ran は過去形で、made と述語が二重になります。',
      '★受動態での注意★ make が受動態になると to が復活します。All the players were made to run around the field. 能動では原形、受動では to do。この非対称が入試で狙われます。',
    ],
  },
  {
    topic: 'say / speak / talk / tell の使い分け',
    focus: 'say / tell / speak / talk',
    sentence: 'She ______ me that the meeting had been moved to the following Monday afternoon.',
    choices: ['said', 'told', 'spoke', 'talked'],
    answer: '②',
    rate: 68,
    full: 'She told me that the meeting had been moved to the following Monday afternoon.',
    translation: '彼女は会議が翌週の月曜午後に移されたと私に告げた。',
    keyPhrases: [
      { phrase: 'told me that', meaning: '私に〜と告げた（tell＋人＋that 節）' },
      { phrase: 'had been moved', meaning: '移されていた（時制の一致＋受動態）' },
    ],
    theme: 'tell は人を直接目的語に取れる。say は人を目的語に取らず say to 人 になる',
    type: '語法判断型',
    difficulty: 2,
    steps: [
      '① 空所の直後に me（人）があることを確認する',
      '② 人を直接目的語に取れるのは tell',
      '③ say なら said to me、speak / talk なら spoke / talked to me になる',
      '④ tell の過去形 told を選ぶ',
    ],
    commentary: [
      '直後に me（人）が前置詞なしで置かれているので、人を直接目的語に取れる ② told が正解です。tell＋人＋that 節の形です。',
      '★4つの使い分け★ tell＋人＋内容（人を直接置ける）／say＋内容（人は say to 人）／speak（言語を話す・演説する。相手は to）／talk（会話する。相手は to / with、話題は about）。',
      '① の said は say の過去形で、人を直接目的語に取れません。She said to me that ~ なら正しい形です。',
      '③ の spoke は speak の過去形で、She spoke to me のように前置詞が必要です。また speak は that 節を目的語に取りません。',
      '④ の talked も同じく前置詞が必要で、that 節を取れません。',
      '★セットで覚える表現★ tell a lie（嘘をつく）／tell the truth／tell the difference（区別する）／say hello to／speak English／talk about。★それぞれが取れる形が違う★ ので、動詞と形をペアで記憶するのが確実です。',
    ],
  },
  {
    topic: 'borrow / lend / rent、hear / listen などの対立ペア',
    focus: 'borrow と lend',
    sentence: 'Would you mind if I ______ your umbrella until tomorrow morning? Mine is broken.',
    choices: ['lent', 'borrowed', 'rented', 'hired'],
    answer: '②',
    rate: 65,
    full: 'Would you mind if I borrowed your umbrella until tomorrow morning? Mine is broken.',
    translation: '明日の朝まであなたの傘を借りてもよろしいですか。私のは壊れているのです。',
    keyPhrases: [
      { phrase: 'if I borrowed your umbrella', meaning: '私が傘を借りたら（borrow＝無料で借りる）' },
      { phrase: 'Mine is broken', meaning: '私のは壊れている（借りたい理由）' },
    ],
    theme: 'borrow は「借りる」、lend は「貸す」。方向が正反対の対立ペア',
    type: '語法判断型',
    difficulty: 2,
    steps: [
      '① 主語が I で、傘の持ち主が you であることを確認する',
      '② 私は借りる側なので borrow',
      '③ lend は貸す側の動詞なので、主語が you のときに使う',
      '④ 傘は無料で借りるものなので rent / hire ではない',
    ],
    commentary: [
      '主語 I は借りる側なので、② borrowed が正解です。傘は無料で借りるものなので borrow が適切です。',
      '★方向が逆のペア★ borrow（借りる：自分の方へ）／lend（貸す：相手の方へ）。同じ発想で teach（教える）／learn（学ぶ）、bring（持ってくる）／take（持っていく）も方向で使い分けます。',
      '① の lent は「貸した」で方向が逆です。If you lent me your umbrella なら正しい文になります。主語が誰かを必ず確認してください。',
      '③ の rented は「有料で借りる」で、家や車など料金を払って一定期間借りるときに使います。傘を友人から借りるのに rent は不自然です。',
      '④ の hired はイギリス英語で「短期間有料で借りる」意味です。これも料金が前提なので合いません。',
      '★hear と listen も対立ペア★ hear は「聞こえる」（意図せず耳に入る／他動詞）、listen to は「耳を傾ける」（意図的／前置詞が必要）。同様に see（見える）／look at（目を向ける）／watch（動くものを見続ける）も区別します。',
    ],
  },
];

export const egVerbUsageProblems: GrammarProblem[] = [
  buildEgSet(
    {
      chapterId: 'eg4_1',
      setNo: 1,
      unitTitle: '⑮ 動詞の語法（自他・語形・型）',
      category: '自他の対立・第4文型不可の動詞・V＋O＋to do / do・say と tell・方向の対立ペア',
      intro:
        '語法は「意味」ではなく「形」で決まります。この単元で使う判定は3つだけです。(1) 後ろに目的語があるか（自動詞か他動詞か）、(2) 人を直接置けるか、前置詞が必要か、(3) O のあとが原形か to do か。日本語の訳が同じでも取れる形が違う、というのが語法問題の本質なので、★動詞と形をセットで覚える★ ことが最短ルートになります。とくに rise / raise、explain、tell / say は毎年どこかで問われる最重要項目です。',
      summary: [
        'rise - rose - risen（自）／raise - raised - raised（他）。lie - lay - lain（自）／lay - laid - laid（他）。',
        '判定は「後ろに目的語があるか」だけ。訳から考えると日本語に引きずられる。',
        'explain / suggest / propose / describe は第4文型不可。人の前に to が必要。',
        'make / have / let ＋O＋原形。tell / ask / want / allow ＋O＋to do。get A to do、help A (to) do。',
        'tell＋人＋内容／say＋内容（人は say to 人）／speak（言語・演説）／talk（会話）。',
        'borrow（借りる）／lend（貸す）、hear（聞こえる）／listen to（耳を傾ける）は方向・意図で使い分ける。',
      ],
      surroundingKnowledge: [
        '他動詞なのに前置詞を付けたくなる動詞：discuss / marry / enter / reach / attend / approach。前置詞は不要。',
        '自動詞なのに前置詞を忘れやすい動詞：graduate from / apologize to / object to / complain about。',
        'lay の過去形 laid と lie の過去形 lay が同形なので、文中の位置で判断する必要がある。',
        'remind A of B / inform A of B / accuse A of B など「A に B を〜する」型は of を使う。',
        'suggest は that 節中に（should）＋原形を取る（仮定法現在）。第4文型は取れない。',
      ],
      deepDiveTopics: [
        'なぜ rise / lie は自動詞で raise / lay は他動詞なのか。語源的に raise / lay は「〜させる」という使役の意味を持つ形（causative）で、rise / lie に使役の接辞が付いた形が変化したもの。だから他動詞になる。sit / seat も同じ関係。',
        'explain が第4文型を取れないのは、この動詞がフランス語・ラテン語系の借用語だから。英語本来の give / tell / show などのゲルマン語系動詞は二重目的語を取れるが、借用語は前置詞を必要とする傾向が強い。語源が語法を決めている。',
        'make が受動態で to を復活させるのは、原形不定詞が能動態の特殊な構造に依存しているため。受動態にすると通常の不定詞構造に戻るので to が現れる。let は受動態にできず be allowed to で代用する。',
        'hear と listen to の違いは「状態動詞と動作動詞」の対立でもある。hear は知覚の状態なので進行形にしにくく、listen は意図的な動作なので進行形になる（I am listening.）。自他の違いが相（アスペクト）にも影響する。',
      ],
    },
    EG4_1_ITEMS,
  ),
];
