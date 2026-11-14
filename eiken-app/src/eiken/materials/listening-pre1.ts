import {
  buildExamRound,
  buildMaterialImageSpec,
  makeDialogueUnit,
  makeQuestionItem,
  speakerPairFor,
} from './listening-helpers';
import type {
  DialogueTurn,
  ListeningAudioUnit,
  ListeningExamRound,
  RealLifeMaterialSpec,
} from '../listeningExamCore';

/**
 * 英検準1級 リスニング予想問題 全15回（計435問・345音源・75図版プロンプト）
 * - 第1部：会話の内容一致選択（12問／12音源・4肢印刷・1回読み・図版なし）
 * - 第2部：文の内容一致選択（12問／6音源・1パッセージ2問・4肢印刷・1回読み・図版なし）
 * - 第3部：Real-Life形式の内容一致選択（5問／5音源・4肢印刷・1回読み・資料図版5枚）
 * - 完全独自作成（origin: 'manatobi-original'）。過去問流用一切なし。
 */

const PRE1_ROUNDS = [
  'First', 'Second', 'Third', 'Fourth', 'Fifth',
  'Sixth', 'Seventh', 'Eighth', 'Ninth', 'Tenth',
  'Eleventh', 'Twelfth', 'Thirteenth', 'Fourteenth', 'Fifteenth',
] as const;

const PRE1_SLOTS = [
  'Alpha', 'Bravo', 'Cedar', 'Delta', 'Echo', 'Falcon',
  'Granite', 'Harbor', 'Ivory', 'Jasper', 'Kestrel', 'Linden',
] as const;

const M_PRE1 = [
  ' Adrian', 'Bennett', 'Cameron', 'Damian', 'Elliot',
  'Franklin', 'Garrett', 'Howard', 'ian', 'Jeremy',
  'Leonard', 'Malcolm', 'Norman', 'Preston', 'Quentin',
].map(s => s.trim()[0].toUpperCase() + s.trim().slice(1));

const F_PRE1 = [
  'Adrienne', 'Belinda', 'Camilla', 'Daphne', 'Estelle',
  'Francesca', 'Genevieve', 'Helena', 'Ingrid', 'Juliet',
  'Katrina', 'Lorraine', 'Miriam', 'Nadine', 'Octavia',
];

function buildPre1Part1Unit(examId: string, round: number, u: number): ListeningAudioUnit {
  const [sp1, sp2] = speakerPairFor(round, u);
  const m = M_PRE1[(round * 2 + u) % 15];
  const f = F_PRE1[(round * 3 + u) % 15];
  const nTo1 = sp1.roleLabel === 'Man' ? f : m;
  const nTo2 = sp1.roleLabel === 'Man' ? m : f;
  const who2 = sp2.roleLabel === 'Woman' ? 'the woman' : 'the man';
  const targetAnswer = (round + u) % 4;
  const rWord = PRE1_ROUNDS[round - 1];
  const sWord = PRE1_SLOTS[u - 1];

  const scenarios = [
    // 1: 企業・研究所での予算配分と優先順位の見直し
    () => {
      const depts = ['biochemistry wing', 'materials testing lab', 'acoustic research unit', 'clean-energy division', 'packaging design studio'];
      const cuts = [
        ['postpone upgrading the hallway display monitors until next fiscal year', '廊下の表示モニター更新を来年度まで延期する'],
        ['consolidate two external software subscriptions into a single license', '外部ソフトウェア契約2件を1つのライセンスに統合する'],
        ['hold the quarterly regional workshops online rather than booking hotels', '四半期ごとの地域研修をホテル手配ではなくオンライン開催にする'],
      ];
      const dept = depts[(round - 1) % 5];
      const [cutEn, cutJa] = cuts[(round - 1) % 3];
      const turns: DialogueTurn[] = [
        { ...sp1, text: `Good morning ${nTo1}, regarding our ${rWord.toLowerCase()} ${sWord.toLowerCase()} budget review for the ${dept}, finance asked us to trim expenses by eight percent before Friday.` },
        { ...sp2, text: `Eight percent is steeper than we anticipated, ${nTo2}. Does that mean we have to freeze hiring for the two junior technician posts?` },
        { ...sp1, text: `Fortunately, no. Staffing remains untouched as long as we reduce operational overhead elsewhere.` },
        { ...sp2, text: `That is a huge relief. In that case, why don't we ${cutEn}? That alone should cover almost the entire reduction without slowing down daily experiments.` },
        { ...sp1, text: `Spot on. I will revise the spreadsheet right away and send it to the director.` },
        { speaker: 'F2', roleLabel: 'Narrator', text: `Question. How have the speakers decided to reduce expenses in the ${dept}?` },
      ];
      return {
        turns,
        ja: `${dept}の予算を8%削減するよう財務部から求められたが、若手技師2名の採用凍結は避け、「${cutJa}」ことで削減目標を賄う方針で合意した。`,
        prompt: `How have the speakers decided to reduce expenses in the ${dept}?`,
        correct: `They will ${cutEn}.`,
        cReason: `why don't we ${cutEn}? に対して相手が Spot on. I will revise the spreadsheet と賛同している。`,
        wrongs: [
          'They will cancel hiring for two junior technician posts.',
          'They will shut down daily laboratory experiments for a month.',
          'They will ask the finance office to increase their budget.',
        ] as [string, string, string],
        wReasons: [
          '技師の採用凍結については Fortunately, no. Staffing remains untouched と明確に否定されている。',
          '日々の実験を止めるのではなく without slowing down daily experiments と述べている。',
          '財務部に増額を求めるという話は出ておらず、削減案を提出する流れである。',
        ] as [string, string, string],
        exp: `採用枠を維持する条件のもとで提案・合意された ${cutEn} を聞き取る。`,
        ev: `why don't we ${cutEn}`,
        skill: '会話：交渉',
      };
    },
    // 2: 大学ゼミ・学会発表の原稿修正
    () => {
      const topics = ['coastal wetland restoration', 'nineteenth-century textile trade', 'municipal transit electrification', 'adolescent sleep chronobiology', 'medieval manuscript preservation'];
      const fixes = [
        ['add a comparison table contrasting rural and metropolitan data', '地方と大都市のデータを対比する比較表を追加する'],
        ['shorten the literature review and expand the methodology section', '先行研究の要約を縮めて調査手法の節を拡充する'],
        ['include interviews with three local practitioners as case evidence', '実務家3名への聞き取りを事例根拠として盛り込む'],
      ];
      const tp = topics[(round - 1) % 5];
      const [fxEn, fxJa] = fixes[(round + 1) % 3];
      const turns: DialogueTurn[] = [
        { ...sp1, text: `Hello ${nTo1}, I just finished reading your ${rWord.toLowerCase()} ${sWord.toLowerCase()} draft on ${tp} for next month's colloquium.` },
        { ...sp2, text: `Thank you so much for looking it over, Professor ${nTo2}. Were my statistical conclusions convincing enough?` },
        { ...sp1, text: `Your core numbers are solid, and your opening thesis is crystal clear. However, the reviewers on the panel can be quite skeptical if the middle section feels too abstract.` },
        { ...sp2, text: `I see what you mean. Would it strengthen my argument if I ${fxEn} before submitting the final version?` },
        { ...sp1, text: `Definitely. Do that by Wednesday, and your paper will be in excellent shape.` },
        { speaker: 'F2', roleLabel: 'Narrator', text: `Question. What will ${who2} do before submitting the final paper?` },
      ];
      return {
        turns,
        ja: `${tp}に関する発表草稿の講評。数値と冒頭の主張は明確だが中盤が抽象的なため、水曜までに「${fxJa}」対応を行うことになった。`,
        prompt: `What will ${who2} do before submitting the final paper?`,
        correct: fxEn[0].toUpperCase() + fxEn.slice(1) + '.',
        cReason: `Would it strengthen my argument if I ${fxEn} ...? に教授が Definitely と承認している。`,
        wrongs: [
          'Rewrite the opening thesis from scratch.',
          'Recalculate all of the statistical figures.',
          'Withdraw from next month\'s colloquium.',
        ] as [string, string, string],
        wReasons: [
          '冒頭の主張は crystal clear（非常に明快）と高く評価されている。',
          '統計数値も Your core numbers are solid と問題なしとされている。',
          '来月の研究集会を辞退するという話は一切出ていない。',
        ] as [string, string, string],
        exp: `高く評価された箇所と、改善点として合意した ${fxEn} を区別して聞き取る。`,
        ev: `if I ${fxEn}`,
        skill: '会話：評価',
      };
    },
    // 3: 賃貸・店舗契約・施設修繕の交渉
    () => {
      const properties = ['corner bakery space', 'second-floor dental clinic', 'riverside design office', 'downtown bookshop unit', 'station-front tutoring suite'];
      const terms = [
        ['waive the first month\'s rent while the ventilation ducts are replaced', '換気ダクト交換の工事期間にあたる初月賃料を免除する'],
        ['cover half the cost of installing soundproof double-pane windows', '防音複層ガラス窓の設置費用の半分を負担する'],
        ['include two dedicated parking spaces behind the building at no extra charge', '建物裏の専用駐車場2台分を追加料金なしで含める'],
      ];
      const prop = properties[(round - 1) % 5];
      const [tmEn, tmJa] = terms[round % 3];
      const turns: DialogueTurn[] = [
        { ...sp1, text: `Good afternoon ${nTo1}, calling from ${rWord} ${sWord} Realty about the lease for the ${prop} you inspected yesterday.` },
        { ...sp2, text: `Thanks for getting back to me, ${nTo2}. My partner and I love the natural lighting and foot traffic, yet we are hesitant about the upfront renovation expenses.` },
        { ...sp1, text: `I spoke with the building owner this morning about your concern. Although the monthly base rent cannot be lowered, the owner offered a compromise.` },
        { ...sp2, text: `Oh, really? What kind of arrangement is on the table?` },
        { ...sp1, text: `If you sign a two-year agreement this week, the owner will ${tmEn}.` },
        { ...sp2, text: `That makes a big difference—please send over the contract so we can sign it.` },
        { speaker: 'F2', roleLabel: 'Narrator', text: `Question. What concession did the building owner offer regarding the ${prop}?` },
      ];
      return {
        turns,
        ja: `${prop}の賃貸交渉。基本家賃の引き下げは不可だが、2年契約を今週結べばオーナーが「${tmJa}」という譲歩案を出し、借主も契約に同意した。`,
        prompt: `What concession did the building owner offer regarding the ${prop}?`,
        correct: `To ${tmEn}.`,
        cReason: `the owner will ${tmEn} という提案に対して契約書を送るよう応じている。`,
        wrongs: [
          'To reduce the monthly base rent by twenty percent.',
          'To allow a short three-month trial lease.',
          'To pay for all interior furniture and signage.',
        ] as [string, string, string],
        wReasons: [
          '月額基本家賃は cannot be lowered と明確に否定されている。',
          '3か月の短期お試し契約ではなく two-year agreement が条件である。',
          '内装家具や看板を全額負担するという話は出ていない。',
        ] as [string, string, string],
        exp: `Although the monthly base rent cannot be lowered の後に続く実際の譲歩条件 ${tmEn} を聞き取る。`,
        ev: `the owner will ${tmEn}`,
        skill: '会話：条件',
      };
    },
    // 4: 医療・健康相談での生活習慣と検査提案
    () => {
      const symptoms = ['persistent afternoon headaches', 'stiffness in your right shoulder', 'frequent eye fatigue after noon', 'mild dizziness when standing up', 'trouble falling asleep before midnight'];
      const advices = [
        ['switch to an anti-glare monitor filter and take brief breaks every hour', '反射防止モニターフィルターに替え、1時間ごとに小休止を取る'],
        ['keep a two-week hydration and meal log before trying any medication', '薬を試す前に2週間の水分摂取・食事記録をつける'],
        ['work with a physical therapist on posture exercises twice a week', '週2回理学療法士と姿勢改善エクササイズに取り組む'],
      ];
      const sym = symptoms[(round - 1) % 5];
      const [advEn, advJa] = advices[(round + 2) % 3];
      const turns: DialogueTurn[] = [
        { ...sp1, text: `Come in, ${nTo1}. Looking at your ${rWord.toLowerCase()} ${sWord.toLowerCase()} checkup chart, your blood work came back completely normal, yet you mentioned ${sym}.` },
        { ...sp2, text: `Yes, Doctor ${nTo2}. It started right after our accounting team moved to a paperless system and my screen hours doubled.` },
        { ...sp1, text: `That timing tells us a lot. People often jump straight to strong painkillers, which I would rather avoid in your case.` },
        { ...sp2, text: `I prefer avoiding unnecessary pills too. What do you recommend I start with instead?` },
        { ...sp1, text: `First, please ${advEn}, and let us reassess your progress in a fortnight.` },
        { speaker: 'F2', roleLabel: 'Narrator', text: `Question. What does the doctor advise ${who2} to do first?` },
      ];
      return {
        turns,
        ja: `血液検査は正常だったが「${sym}」が続いている患者に対し、強い鎮痛薬は避け、まず「${advJa}」を行って2週間後に再評価するよう医師が助言した。`,
        prompt: `What does the doctor advise ${who2} to do first?`,
        correct: advEn[0].toUpperCase() + advEn.slice(1) + '.',
        cReason: `First, please ${advEn} と医師が最初の対処法を具体的に指示している。`,
        wrongs: [
          'Start taking strong prescription painkillers immediately.',
          'Undergo inpatient surgery at a general hospital.',
          'Take a three-month leave of absence from accounting.',
        ] as [string, string, string],
        wReasons: [
          '強い鎮痛薬は which I would rather avoid と医師が避ける方針を示している。',
          '総合病院での入院手術という話は一切出ていない。',
          '経理の仕事を3か月休職するようにも指示していない。',
        ] as [string, string, string],
        exp: `医師が避けたい選択肢（painkillers）と推奨する初手（First, please ${advEn}）を区別する。`,
        ev: `First, please ${advEn}`,
        skill: '会話：意図',
      };
    },
    // 5: 製造・物流サプライチェーンの遅延と代替手配
    () => {
      const parts = ['tempered glass panels', 'ceramic heating elements', 'recycled aluminum frames', 'lithium sensor modules', 'precision brass valves'];
      const solutions = [
        ['source an emergency batch from our certified supplier in Nagoya', '名古屋の認定サプライヤーから緊急ロットを調達する'],
        ['air-freight the critical components ahead of the bulk sea shipment', '船便の本貨物に先立って重要部品だけ航空便で取り寄せ'],
        ['prioritize assembling the domestic orders while export crates wait', '輸出向け梱包を後回しにして国内受注分の組立を優先する'],
      ];
      const pt = parts[(round - 1) % 5];
      const [solEn, solJa] = solutions[(round - 1) % 3];
      const turns: DialogueTurn[] = [
        { ...sp1, text: `Hi ${nTo1}, urgent ${rWord.toLowerCase()} ${sWord.toLowerCase()} logistics update: port congestion has delayed our shipment of ${pt} by nine days.` },
        { ...sp2, text: `Nine days? ${nTo2}, our assembly line only has enough inventory to run through Thursday afternoon!` },
        { ...sp1, text: `I know, and halting the entire plant would trigger steep late-delivery penalties from our retail clients.` },
        { ...sp2, text: `We cannot let that happen. Can we ${solEn} to bridge the gap until the vessel docks?` },
        { ...sp1, text: `I already checked capacity—it will add a modest surcharge, yet it keeps the line running uninterrupted. Let's authorize it now.` },
        { speaker: 'F2', roleLabel: 'Narrator', text: `Question. How will the speakers deal with the delayed shipment of ${pt}?` },
      ];
      return {
        turns,
        ja: `港湾混雑で${pt}の到着が9日遅れる事態に対し、工場停止による違約金を防ぐため「${solJa}」ことでラインを止めずに乗り切る決定をした。`,
        prompt: `How will the speakers deal with the delayed shipment of ${pt}?`,
        correct: `They will ${solEn}.`,
        cReason: `Can we ${solEn} ...? に対し Let's authorize it now. と承認している。`,
        wrongs: [
          'They will shut down the assembly plant for nine days.',
          'They will pay late-delivery penalties to all retail clients.',
          'They will permanently redesign the product without the part.',
        ] as [string, string, string],
        wReasons: [
          '工場全体の停止は違約金を招くため避けるべき事態として挙げられている。',
          '違約金を払うのではなく、それを防ぐための代替策を承認している。',
          '部品なしで製品を恒久的に再設計するという話は出ていない。',
        ] as [string, string, string],
        exp: `納期遅延への対応として Let's authorize it now と決まった ${solEn} を捉える。`,
        ev: `Can we ${solEn}`,
        skill: '会話：問題点',
      };
    },
    // 6: 博物館・文化イベントでの広報戦略変更
    () => {
      const exhibits = ['Edo botanical woodblock exhibition', 'Nordic glassblowing retrospective', 'ancient Silk Road coin collection', 'contemporary kinetic sculpture show', 'oceanographic cartography exhibit'];
      const tactics = [
        ['offer free twilight admission for university students on Thursday evenings', '木曜夕方に大学生向けの夜間無料入館を実施する'],
        ['partner with commuter rail lines to display QR preview posters in stations', '通勤鉄道と提携して駅構内にQRプレビュー付きポスターを掲示する'],
        ['host live weekend demonstrations by master artisans in the courtyard', '週末に中庭で熟練職人による実演イベントを開催する'],
      ];
      const ex = exhibits[(round - 1) % 5];
      const [tcEn, tcJa] = tactics[round % 3];
      const turns: DialogueTurn[] = [
        { ...sp1, text: `Looking at our ${rWord.toLowerCase()} ${sWord.toLowerCase()} attendance figures, ${nTo1}, weekday turnout for the ${ex} is strong among retirees, whereas visitors in their twenties remain scarce.` },
        { ...sp2, text: `True, ${nTo2}. Newspaper reviews praised the curation, yet print ads alone rarely reach younger audiences anymore.` },
        { ...sp1, text: `Should we pour the remaining marketing budget into paid television commercials?` },
        { ...sp2, text: `TV spots are prohibitively expensive for a mid-run push. Instead, it would be far more effective to ${tcEn}.` },
        { ...sp1, text: `Clever thinking—that fits our remaining budget and encourages word-of-mouth sharing. Let's launch it next week.` },
        { speaker: 'F2', roleLabel: 'Narrator', text: `Question. What will the museum do to attract younger visitors to the ${ex}?` },
      ];
      return {
        turns,
        ja: `${ex}で20代の来場者が少ない課題に対し、高額なテレビCMではなく「${tcJa}」施策を来週から実施することにした。`,
        prompt: `What will the museum do to attract younger visitors to the ${ex}?`,
        correct: tcEn[0].toUpperCase() + tcEn.slice(1) + '.',
        cReason: `Instead, it would be far more effective to ${tcEn}. に Let's launch it next week. と合意している。`,
        wrongs: [
          'Buy prime-time television commercials across the region.',
          'Double the number of newspaper print advertisements.',
          'Close the exhibition two weeks ahead of schedule.',
        ] as [string, string, string],
        wReasons: [
          'テレビCMは prohibitively expensive（高すぎて手が出ない）として却下されている。',
          '新聞広告だけでは若年層に届かないと指摘されており増枠はしない。',
          '会期を2週間前倒しで終了するという話は出ていない。',
        ] as [string, string, string],
        exp: `却下された案（print ads / TV spots）と採用された ${tcEn} を明確に区別する。`,
        ev: `effective to ${tcEn}`,
        skill: '会話：含意',
      };
    },
    // 7〜12: 残り6スロット（職場・自治体・IT・出版・教育・消費者対応）
    ...Array.from({ length: 6 }, (_, k) => () => {
      const idx = k; // 0..5 -> u = 7..12
      const themes = [
        {
          ctx: 'municipal recycling pilot',
          issue: 'residents in apartment complexes are mixing food scraps into plastic bins',
          rejected: 'imposing immediate municipal fines',
          chosen: 'distribute color-coded countertop caddies with illustrated sorting magnets',
          chosenJa: 'イラスト付き分別マグネットと色分け卓上容器を配布する',
          sk: '会話：問題点',
        },
        {
          ctx: 'software platform migration',
          issue: 'regional sales reps find the new reporting dashboard confusing',
          rejected: 'reverting to the legacy spreadsheet system',
          chosen: 'record five-minute interactive walkthrough clips for the three core tasks',
          chosenJa: '主要3業務について5分間の対話型解説動画を収録する',
          sk: '会話：意図',
        },
        {
          ctx: 'historical biography publication',
          issue: 'obtaining copyright clearance for six archival photographs is taking months',
          rejected: 'delaying the autumn hardcover release until spring',
          chosen: 'commission an illustrator to draw accurate architectural maps instead',
          chosenJa: '代わりにイラストレーターへ正確な建築地図の作画を依頼する',
          sk: '会話：交渉',
        },
        {
          ctx: 'hospital cafeteria overhaul',
          issue: 'night-shift nurses have no hot meal options after nine p.m.',
          rejected: 'keeping the full kitchen staff on duty all night',
          chosen: 'install refrigerated smart lockers stocked daily with freshly prepared bowls',
          chosenJa: '毎日作りたての食事を補充する冷蔵スマートロッカーを設置する',
          sk: '会話：条件',
        },
        {
          ctx: 'botanical conservatory tour program',
          issue: 'narrow glasshouse pathways get overcrowded when two school buses arrive together',
          rejected: 'cutting the total number of school visits in half',
          chosen: 'stagger group entries by thirty minutes and rotate half through the seed lab',
          chosenJa: '入場を30分ずらし半数を種子ラボ見学とローテーションさせる',
          sk: '会話：評価',
        },
        {
          ctx: 'independent coffee roastery expansion',
          issue: 'peak morning queues are causing commuters to walk away without ordering',
          rejected: 'removing pour-over coffee from the menu altogether',
          chosen: 'set up a dedicated express pickup window for mobile pre-orders',
          chosenJa: 'モバイル事前注文専用のエクスプレス受取窓口を設ける',
          sk: '会話：含意',
        },
      ];
      const th = themes[idx];
      const turns: DialogueTurn[] = [
        { ...sp1, text: `Hi ${nTo1}, reviewing our ${rWord.toLowerCase()} ${sWord.toLowerCase()} progress report on the ${th.ctx}, one bottleneck stands out: ${th.issue}.` },
        { ...sp2, text: `Yes, ${nTo2}, several team members flagged that yesterday. Some suggested ${th.rejected}, though that seems counterproductive.` },
        { ...sp1, text: `Agreed—that would create more frustration than it solves. We need a practical fix we can roll out within two weeks.` },
        { ...sp2, text: `What if we ${th.chosen}? Other branches tested a similar approach and saw immediate improvement.` },
        { ...sp1, text: `Excellent proposal. Let's put you in charge of drafting the implementation timeline today.` },
        { speaker: 'F2', roleLabel: 'Narrator', text: `Question. What have the speakers decided to do regarding the ${th.ctx}?` },
      ];
      return {
        turns,
        ja: `${th.ctx}の進捗確認。「${th.issue}」という課題に対し、極端な案（${th.rejected}）は避け、「${th.chosenJa}」施策を導入することで合意した。`,
        prompt: `What have the speakers decided to do regarding the ${th.ctx}?`,
        correct: th.chosen[0].toUpperCase() + th.chosen.slice(1) + '.',
        cReason: `What if we ${th.chosen}? に対して Excellent proposal. と採用が決定している。`,
        wrongs: [
          th.rejected[0].toUpperCase() + th.rejected.slice(1) + '.',
          'Cancel the entire project at the end of this month.',
          'Hire an overseas consulting firm for a year-long audit.',
        ] as [string, string, string],
        wReasons: [
          `${th.rejected} は counterproductive（逆効果）として明確に退けられている。`,
          '今月末でプロジェクト自体を中止するという話は出ていない。',
          '海外コンサル会社に1年間の監査を依頼するとも言っていない。',
        ] as [string, string, string],
        exp: `逆効果として退けられた案ではなく、合意に至った ${th.chosen} を選ぶ。`,
        ev: `What if we ${th.chosen}`,
        skill: th.sk,
      };
    }),
  ];

  const d = scenarios[u - 1]();
  const qItem = makeQuestionItem({
    examId,
    questionNumber: u,
    questionPrompt: d.prompt,
    choicePresentation: 'printed',
    correctChoice: d.correct,
    correctReason: d.cReason,
    wrongChoices: d.wrongs,
    wrongReasons: d.wReasons,
    targetAnswer,
    explanation: d.exp,
    evidence: d.ev,
    skill: d.skill,
  });

  return makeDialogueUnit({
    examId,
    part: 'part1',
    unitIndex: u,
    readCount: 1,
    turns: d.turns,
    translation: d.ja,
    image: null,
    questions: [qItem],
  });
}

function buildPre1Part2Unit(examId: string, round: number, u: number): ListeningAudioUnit {
  // Part 2: 6 passages per round, 2 questions per passage (No.13..24)
  const qNo1 = 12 + (u - 1) * 2 + 1;
  const qNo2 = qNo1 + 1;
  const rWord = PRE1_ROUNDS[round - 1];
  const sWord = PRE1_SLOTS[u - 1];
  const ans1 = (round + qNo1 - 1) % 4;
  const ans2 = (round + qNo2 - 1) % 4;

  const passages = [
    // Passage 1: 生態学・土壌菌根ネットワーク研究
    () => {
      const trees = ['Douglas fir stands', 'northern birch groves', 'subalpine spruce forests', 'coastal cedar woodlands', 'temperate beech canopies'];
      const nutrients = ['phosphorus compounds', 'dissolved nitrogen', 'trace magnesium ions', 'carbon isotopes', 'soluble potassium'];
      const tree = trees[(round - 1) % 5];
      const nut = nutrients[(round + 1) % 5];
      const body = `Academic Briefing ${rWord} ${sWord}: Forest ecologists have long known that tree roots partner with underground fungi to exchange sugars for minerals. Recent field experiments in ${tree}, however, revealed something more intricate. When researchers shaded young saplings to restrict photosynthesis, mature neighboring trees transferred measurable amounts of ${nut} through shared fungal threads. Even more surprisingly, the fungal network did not distribute resources evenly; instead, it directed larger shares toward genetically diverse saplings, increasing overall stand resilience against drought. Critics caution, nevertheless, that logging heavy machinery compacts topsoil and severs these delicate filaments, meaning restoration projects must protect soil structure rather than merely planting seedlings.`;
      return {
        body,
        ja: `${tree}での最新野外実験に関する学術解説。日陰に置かれた若木に対し、周囲の成木が菌糸ネットワークを通じて「${nut}」を供給し、特に遺伝的多様性の高い若木へ多く配分して乾燥耐性を高めていた。一方、重機による土壌圧縮は菌糸を切断するため、植林だけでなく土壌構造の保全が不可欠だと指摘されている。`,
        q1Prompt: `What did researchers observe in the shaded saplings in ${tree}?`,
        q1Correct: `They received ${nut} from mature trees via fungal threads.`,
        q1CReason: `mature neighboring trees transferred measurable amounts of ${nut} through shared fungal threads と明言されている。`,
        q1Wrongs: [
          'They grew twice as fast without any underground fungi.',
          'They stopped absorbing minerals during dry summer months.',
          'They severed connections with genetically diverse neighbors.',
        ] as [string, string, string],
        q1WReasons: [
          '地下の菌類なしで2倍速く育ったという事実は述べられていない。',
          '夏の間ミネラル吸収を止めたという記述はない。',
          '遺伝的に多様な近隣木との結合を切ったというのは内容と正反対である。',
        ] as [string, string, string],
        q1Exp: `日陰にされた若木へ成木から ${nut} が菌糸経由で送られた実験結果を聞き取る。`,
        q1Ev: `transferred measurable amounts of ${nut}`,
        q1Skill: '文：原因',
        q2Prompt: 'What warning is mentioned at the end of the talk?',
        q2Correct: 'Heavy machinery can compact soil and damage fungal filaments.',
        q2CReason: 'logging heavy machinery compacts topsoil and severs these delicate filaments と警告されている。',
        q2Wrongs: [
          'Planting diverse seedlings reduces resistance to drought.',
          'Fungal threads consume too much rainwater in coastal woods.',
          'Chemical fertilizers permanently double fungal growth.',
        ] as [string, string, string],
        q2WReasons: [
          '多様な苗は乾燥への回復力を高める（increasing overall stand resilience）と述べられている。',
          '菌糸が雨水を過剰消費するという話は出ていない。',
          '化学肥料で菌の成長が恒久的に2倍になるとも言っていない。',
        ] as [string, string, string],
        q2Exp: `終盤の Critics caution ... that logging heavy machinery compacts topsoil の指摘を捉える。`,
        q2Ev: 'logging heavy machinery compacts topsoil',
        q2Skill: '文：論旨',
      };
    },
    // Passage 2: 都市交通・渋滞課金とバス専用レーンの効果
    () => {
      const cities = ['Porthaven', 'Veridian Bay', 'Northbridge', 'Calderon', 'westerham'].map(s => s[0].toUpperCase() + s.slice(1));
      const uses = [
        ['expanding electric tram frequency during early morning rush hours', '早朝ラッシュ時の電動トラム運行本数の拡充'],
        ['building covered bicycle highways connecting suburban rail hubs', '郊外鉄道駅を結ぶ屋根付き自転車専用道の整備'],
        ['subsidizing off-peak freight deliveries using quiet electric vans', '静音電動バンによるオフピーク貨物配送への補助'],
      ];
      const city = cities[(round - 1) % 5];
      const [useEn, useJa] = uses[(round - 1) % 3];
      const body = `Policy Review ${rWord} ${sWord}: Three years ago, the port municipality of ${city} introduced a variable congestion fee for private cars entering its historic downtown between seven and ten a.m. Initially, downtown retailers feared that motorists would shop at suburban malls instead. Follow-up tax receipts, however, showed a twelve percent rise in foot-traffic sales within eighteen months, largely because faster bus lanes brought more commuters straight to shopping streets. Equally important, city law required every dollar collected from the fee to be earmarked for ${useEn}, which helped win durable public backing from skeptical suburban voters.`;
      return {
        body,
        ja: `${city}が3年前に導入した朝ラッシュ時の変動型渋滞課金の政策検証。当初は小売店が売上減を懸念したが、バス高速化により18か月で来店売上が12%増加した。さらに徴収金をすべて「${useJa}」に充当する法的義務を設けたことで郊外有権者の支持も定着した。`,
        q1Prompt: `What happened in downtown ${city} within eighteen months of introducing the fee?`,
        q1Correct: 'Retail sales from pedestrian traffic rose by twelve percent.',
        q1CReason: 'showed a twelve percent rise in foot-traffic sales within eighteen months と結果が明示されている。',
        q1Wrongs: [
          'Most downtown stores relocated to suburban shopping malls.',
          'Commuter bus speeds dropped due to narrower lanes.',
          'The city council repealed the fee after six months.',
        ] as [string, string, string],
        q1WReasons: [
          '郊外モールへ客が流れるというのは当初の懸念（feared）であり実際の結果ではない。',
          'バスは遅くなったのではなく faster bus lanes と速くなっている。',
          '半年で廃止されたという事実はなく3年後の成功検証である。',
        ] as [string, string, string],
        q1Exp: `当初の懸念（Initially ... feared）と実際の結果（twelve percent rise in foot-traffic sales）を区別する。`,
        q1Ev: 'twelve percent rise in foot-traffic sales',
        q1Skill: '文：対比',
        q2Prompt: 'How did the municipality gain support from suburban voters?',
        q2Correct: `By dedicating all fee revenue to ${useEn}.`,
        q2CReason: `every dollar collected from the fee to be earmarked for ${useEn} が支持獲得につながったと述べている。`,
        q2Wrongs: [
          'By exempting all private cars on weekday mornings.',
          'By cutting property taxes in half for downtown offices.',
          'By building free multi-story garages in the historic core.',
        ] as [string, string, string],
        q2WReasons: [
          '平日朝の自家用車が課金対象であり免除はされていない。',
          'オフィス向け固定資産税を半減したという記述はない。',
          '歴史地区に無料立体駐車場を建てたとも述べられていない。',
        ] as [string, string, string],
        q2Exp: `earmarked for ${useEn}（特定財源として充当）という制度設計を聞き取る。`,
        q2Ev: `earmarked for ${useEn}`,
        q2Skill: '文：数値',
      };
    },
    // Passage 3: 科学史・海図とクロノメーター／気象観測の歴史
    () => {
      const instruments = ['standardized marine barometers', 'copper-sheathed hull plates', 'chromatic lighthouse lenses', 'printed wind-current atlases', 'sealed botanical wardian cases'];
      const inst = instruments[(round - 1) % 5];
      const benefits = [
        ['shortened transoceanic voyage times by nearly three weeks on average', '大洋横断の航海日数を平均で約3週間短縮した'],
        ['enabled small merchant vessels to anticipate sudden coastal gales hours ahead', '小型商船が突発的な沿岸暴風を数時間前に予測できるようにした'],
        ['prevented fragile cargo and live specimens from spoiling during equatorial crossings', '赤道通過中に壊れやすい積荷や生体標本が傷むのを防いだ'],
      ];
      const [benEn, benJa] = benefits[(round + 2) % 3];
      const body = `Historical Lecture ${rWord} ${sWord}: Maritime historians often credit steam engines alone for transforming nineteenth-century sea trade, yet earlier adoption of ${inst} played a decisive role even during the age of sail. At first, veteran captains distrusted the unfamiliar gear because early prototypes were expensive and awkward to calibrate on rolling decks. Once naval observatories began lending calibrated units free of charge in exchange for standardized logbook entries, adoption spread rapidly. Within a decade, widespread use of the system ${benEn}, reshaping insurance rates across global ports.`;
      return {
        body,
        ja: `19世紀の海運を変えた「${inst}」の歴史講義。当初は高価で揺れる甲板での調整が難しく船長たちに敬遠されたが、海軍天文台が航海日誌データの提供と引き換えに校正済み機器を無償貸与したことで普及し、10年以内に「${benJa}」という成果を生んだ。`,
        q1Prompt: `Why were captains initially reluctant to use ${inst}?`,
        q1Correct: 'Early models were costly and difficult to adjust at sea.',
        q1CReason: 'early prototypes were expensive and awkward to calibrate on rolling decks と理由が述べられている。',
        q1Wrongs: [
          'Steam engines made all navigation tools illegal.',
          'Insurance companies forbade ships from carrying them.',
          'Naval observatories charged heavy annual fines.',
        ] as [string, string, string],
        q1WReasons: [
          '蒸気機関が航海器具を違法にしたという記述はない。',
          '保険会社が積載を禁じたのではなく、後に保険料率の変化につながった。',
          '海軍天文台は罰金を科したのではなく無償貸与（free of charge）を行った。',
        ] as [string, string, string],
        q1Exp: `At first, veteran captains distrusted ... because 以下の初期抵抗の理由を捉える。`,
        q1Ev: 'expensive and awkward to calibrate',
        q1Skill: '文：原因',
        q2Prompt: 'What accelerated the adoption of the technology?',
        q2Correct: 'Observatories lent calibrated units in return for logbook data.',
        q2CReason: 'lending calibrated units free of charge in exchange for standardized logbook entries と明言されている。',
        q2Wrongs: [
          'Captains were paid cash bonuses for abandoning sails.',
          'Foreign ports banned wooden vessels altogether.',
          'Private shipyards gave away free steamships.',
        ] as [string, string, string],
        q2WReasons: [
          '帆を捨てる見返りに現金賞与が出たという記述はない。',
          '外国港が木造船を全面禁止したとも言っていない。',
          '民間造船所が蒸気船を無料配布した事実もない。',
        ] as [string, string, string],
        q2Exp: `Once naval observatories began lending ... in exchange for ... の普及要因を聞き取る。`,
        q2Ev: 'in exchange for standardized logbook entries',
        q2Skill: '文：論旨',
      };
    },
    // Passage 4: 医療・遠隔リハビリとウェアラブルセンサー
    () => {
      const conditions = ['post-knee-surgery recovery', 'chronic lower-back rehabilitation', 'wrist tendon physical therapy', 'cardiac endurance conditioning', 'balance training for seniors'];
      const findings = [
        ['patients completed eighty-five percent of assigned routines when given instant posture audio cues', '即時の姿勢音声ガイドがあると患者が課題の85%を完遂した'],
        ['clinicians detected subtle range-of-motion plateaus two weeks earlier than in monthly clinic visits', '月1回の通院よりも2週間早く可動域の停滞を臨床医が検知できた'],
        ['rural participants saved an average of four hours of travel per week without sacrificing recovery speed', '地方の参加者が回復速度を落とさずに週平均4時間の移動時間を節約できた'],
      ];
      const cond = conditions[(round - 1) % 5];
      const [fdEn, fdJa] = findings[round % 3];
      const body = `Medical Report ${rWord} ${sWord}: Outpatient clinics managing ${cond} have long struggled with low adherence once patients return home. Printed exercise sheets are easily forgotten, and patients often perform movements too rapidly without realizing it. To address this, a consortium of regional hospitals tested lightweight fabric sensors paired with a tablet app over six months. Data from four hundred participants showed that ${fdEn}. Researchers emphasized, however, that digital coaching worked best when combined with a brief biweekly video check-in from a human therapist rather than full automation.`;
      return {
        body,
        ja: `${cond}の外来リハビリにおける軽量布センサーの6か月・400人臨床試験。紙の指示書では動作が速くなりがちだったが、試験の結果「${fdJa}」。ただし完全自動化ではなく2週間に1度の療法士との短いビデオ面談を併用したときに最も効果が高かった。`,
        q1Prompt: `What did the six-month hospital study on ${cond} reveal?`,
        q1Correct: fdEn[0].toUpperCase() + fdEn.slice(1) + '.',
        q1CReason: `Data from four hundred participants showed that ${fdEn}. とそのまま述べられている。`,
        q1Wrongs: [
          'Printed paper handouts outperformed wearable sensors.',
          'Most participants quit the trial during the first week.',
          'Sensors caused severe skin irritation in half the group.',
        ] as [string, string, string],
        q1WReasons: [
          '紙の資料は忘れられやすい課題として冒頭で挙げられており逆である。',
          '第1週で大半が脱落したという記述はない。',
          '半数に重い皮膚炎が起きたという副作用報告もない。',
        ] as [string, string, string],
        q1Exp: `Data from four hundred participants showed that ... の調査結果を正確に聞き取る。`,
        q1Ev: fdEn,
        q1Skill: '文：数値',
        q2Prompt: 'What did the researchers emphasize about using digital coaching?',
        q2Correct: 'It was most effective alongside periodic check-ins with a therapist.',
        q2CReason: 'worked best when combined with a brief biweekly video check-in from a human therapist と強調されている。',
        q2Wrongs: [
          'It completely eliminated the need for human therapists.',
          'It worked only for competitive professional athletes.',
          'It required patients to visit the hospital every morning.',
        ] as [string, string, string],
        q2WReasons: [
          'rather than full automation と完全自動化を否定し人間の面談併用を重視している。',
          'プロ選手限定という記述は一切ない。',
          '毎朝通院が必要というのも遠隔リハビリの趣旨と逆である。',
        ] as [string, string, string],
        q2Exp: `Researchers emphasized, however, that ... の留保条件を捉える。`,
        q2Ev: 'combined with a brief biweekly video check-in',
        q2Skill: '文：対比',
      };
    },
    // Passage 5: 芸術保存・美術館の照明技術と顔料劣化防止
    () => {
      const artworks = ['sixteenth-century silk tapestries', 'early Japanese woodblock prints', 'nineteenth-century watercolor sketches', 'ancient mineral-pigment murals', 'illuminated parchment manuscripts'];
      const techs = [
        ['narrow-spectrum LEDs tuned to omit the specific wavelengths that trigger dye fading', '染料退色を引き起こす特定波長を除去した狭帯域LED照明'],
        ['micro-climate display cases buffered with silica gel to stabilize humidity swings', '湿度変動を抑えるシリカゲル緩衝マイクロクライメート展示ケース'],
        ['motion-activated dimming systems that lower light levels whenever galleries are empty', '展示室が無人のときに照度を下げる人感調光システム'],
      ];
      const art = artworks[(round - 1) % 5];
      const [tcEn, tcJa] = techs[(round + 1) % 3];
      const body = `Conservation Note ${rWord} ${sWord}: Displaying ${art} presents curators with a persistent dilemma: bright light reveals delicate brushwork to visitors, yet cumulative exposure irreversibly alters organic dyes. Historically, museums rotated fragile works into dark storage after just six weeks on view. Recently, conservation scientists tested ${tcEn}. Spectrophotometer readings after twelve months confirmed negligible color shift while preserving crisp visual contrast for viewers. Even so, conservators still enforce strict total-exposure budgets for irreplaceable masterpieces.`;
      return {
        body,
        ja: `${art}の展示保存におけるジレンマと新技術。「${tcJa}」を試験導入したところ、12か月後の分光測色でも色変化がごくわずかに抑えられ視認性も保たれた。それでも代替不可能な名品には総露光量の上限管理が継続されている。`,
        q1Prompt: `How did museums traditionally protect ${art} from light damage?`,
        q1Correct: 'They returned them to dark storage after brief display periods.',
        q1CReason: 'rotated fragile works into dark storage after just six weeks on view と従来の方法が説明されている。',
        q1Wrongs: [
          'They coated the surfaces with thick synthetic varnish.',
          'They displayed only black-and-white photographs instead.',
          'They hung them outdoors under natural sunlight.',
        ] as [string, string, string],
        q1WReasons: [
          '厚い合成ニスを塗ったという記述はない。',
          '白黒写真だけを展示したとも述べられていない。',
          '屋外の直射日光下に掛けたというのは保存方針と真逆である。',
        ] as [string, string, string],
        q1Exp: `Historically, museums rotated ... の従来の保存慣行を聞き取る。`,
        q1Ev: 'rotated fragile works into dark storage',
        q1Skill: '文：論旨',
        q2Prompt: 'What did conservation scientists recently test with positive results?',
        q2Correct: tcEn[0].toUpperCase() + tcEn.slice(1) + '.',
        q2CReason: `conservation scientists tested ${tcEn} と述べ、12か月後に良好な結果が確認されている。`,
        q2Wrongs: [
          'Allowing visitors to use flash photography close up.',
          'Eliminating all exposure limits for fragile masterpieces.',
          'Washing organic dyes weekly with alkaline solutions.',
        ] as [string, string, string],
        q2WReasons: [
          'フラッシュ撮影を許可したという話は一切ない。',
          '総露光量の上限は still enforce strict total-exposure budgets と維持されている。',
          '毎週アルカリ溶液で洗うという記述もない。',
        ] as [string, string, string],
        q2Exp: `Recently, conservation scientists tested ${tcEn} の新技術を捉える。`,
        q2Ev: `scientists tested ${tcEn}`,
        q2Skill: '文：語彙推測',
      };
    },
    // Passage 6: 農業経済・再生型農業とコーヒー／カカオ日陰栽培
    () => {
      const crops = ['highland arabica coffee', 'fine-flavor cacao beans', 'organic cardamom pods', 'artisanal vanilla vines', 'shade-grown tea cultivars'];
      const gains = [
        ['stabilized soil moisture and cut irrigation costs by thirty percent during dry spells', '土壌水分を安定させ乾季の灌漑コストを30%削減した'],
        ['attracted insect-eating songbirds that naturally suppressed crop-damaging beetles', '害虫の甲虫を自然に抑える食虫性の野鳥を呼び寄せた'],
        ['provided farmers with secondary autumn income from timber and fruit trees', '果樹や木材による秋の副収入を農家にもたらした'],
      ];
      const crop = crops[(round - 1) % 5];
      const [gnEn, gnJa] = gains[(round - 1) % 3];
      const body = `Economic Commentary ${rWord} ${sWord}: For decades, growers of ${crop} were encouraged to clear canopy trees and plant dense single-crop rows to maximize short-term yields. Although harvests spiked during the first few seasons, exposed hillsides soon suffered rapid erosion and rising fertilizer bills. Over the past eight years, farmer cooperatives have reintroduced native shade trees across thousands of hectares. Field audits show that while per-hectare yield is slightly lower in year one, the mixed canopy ${gnEn}, resulting in higher net farm profit by the fourth year.`;
      return {
        body,
        ja: `${crop}栽培における単一密植から在来日陰樹の再導入への転換。単一栽培は短期収量こそ増えたが土壌侵食と肥料費高騰を招いた。日陰樹の混植は初年度収量こそやや下がるものの「${gnJa}」効果を生み、4年目までに純利益を上回らせた。`,
        q1Prompt: `What problem resulted from clearing canopy trees to grow ${crop}?`,
        q1Correct: 'Hillsides experienced erosion and higher fertilizer expenses.',
        q1CReason: 'exposed hillsides soon suffered rapid erosion and rising fertilizer bills と明記されている。',
        q1Wrongs: [
          'Short-term yields fell to zero in the very first season.',
          'Native shade trees grew too tall to harvest any beans.',
          'Cooperatives banned exports for more than twenty years.',
        ] as [string, string, string],
        q1WReasons: [
          '最初の数シーズンは harvests spiked（収量が急増した）と述べられている。',
          '樹を伐採したときの弊害を問うており、日陰樹が高すぎたという話ではない。',
          '協同組合が20年以上輸出を禁じたという記述はない。',
        ] as [string, string, string],
        q1Exp: `Although harvests spiked ... に続く単一栽培の弊害（erosion and rising fertilizer bills）を聞き取る。`,
        q1Ev: 'suffered rapid erosion and rising fertilizer bills',
        q1Skill: '文：原因',
        q2Prompt: 'What benefit did reintroducing native shade trees bring?',
        q2Correct: `The mixed canopy ${gnEn}.`,
        q2CReason: `the mixed canopy ${gnEn}, resulting in higher net farm profit と述べられている。`,
        q2Wrongs: [
          'It doubled per-hectare yield in the very first year.',
          'It eliminated the need for harvesting labor altogether.',
          'It allowed crops to grow in freezing polar climates.',
        ] as [string, string, string],
        q2WReasons: [
          '初年度の収量は slightly lower in year one と述べられており2倍ではない。',
          '収穫労働が不要になったという記述はない。',
          '極地の氷点下気候で育つようになったという話もない。',
        ] as [string, string, string],
        q2Exp: `初年度のわずかな収量減の後に述べられる長期的メリット ${gnEn} を捉える。`,
        q2Ev: `mixed canopy ${gnEn}`,
        q2Skill: '文：予測',
      };
    },
  ];

  const p = passages[u - 1]();
  const q1 = makeQuestionItem({
    examId,
    questionNumber: qNo1,
    questionPrompt: p.q1Prompt,
    choicePresentation: 'printed',
    correctChoice: p.q1Correct,
    correctReason: p.q1CReason,
    wrongChoices: p.q1Wrongs,
    wrongReasons: p.q1WReasons,
    targetAnswer: ans1,
    explanation: p.q1Exp,
    evidence: p.q1Ev,
    skill: p.q1Skill,
  });
  const q2 = makeQuestionItem({
    examId,
    questionNumber: qNo2,
    questionPrompt: p.q2Prompt,
    choicePresentation: 'printed',
    correctChoice: p.q2Correct,
    correctReason: p.q2CReason,
    wrongChoices: p.q2Wrongs,
    wrongReasons: p.q2WReasons,
    targetAnswer: ans2,
    explanation: p.q2Exp,
    evidence: p.q2Ev,
    skill: p.q2Skill,
  });

  const speaker = u % 2 === 1 ? 'M1' : 'F1';
  const turns: DialogueTurn[] = [
    { speaker, roleLabel: 'Narrator', text: p.body },
    { speaker: 'F2', roleLabel: 'Narrator', text: `Question one. ${p.q1Prompt}` },
    { speaker: 'F2', roleLabel: 'Narrator', text: `Question two. ${p.q2Prompt}` },
  ];

  return makeDialogueUnit({
    examId,
    part: 'part2',
    unitIndex: u,
    readCount: 1,
    turns,
    translation: p.ja,
    image: null,
    questions: [q1, q2],
  });
}

function buildPre1Part3Unit(examId: string, round: number, u: number): ListeningAudioUnit {
  // Part 3: Real-Life 5 items (No.25..29), each with printed material + blank-frame ChatGPT prompt
  const qNo = 24 + u;
  const audioId = `${examId}_part3_${String(u).padStart(2, '0')}`;
  const targetAnswer = (round + qNo - 1) % 4;
  const rWord = PRE1_ROUNDS[round - 1];
  const sWord = PRE1_SLOTS[u - 1];

  const realLifeSpecs = [
    // 1: 大学図書館の特別資料室予約ルール
    () => {
      const cols = ['Collection Room', 'Hours', 'Laptops', 'Group Discussion'];
      const rows = [
        ['Room A (East Wing)', '9:00–17:00', 'Permitted', 'Not allowed'],
        ['Room B (North Annex)', '9:00–20:00', 'Not allowed', 'Not allowed'],
        ['Room C (West Gallery)', '10:00–20:00', 'Permitted', 'Permitted until 19:00'],
        ['Room D (South Vault)', '13:00–18:00', 'Permitted', 'Permitted all hours'],
      ];
      const material: RealLifeMaterialSpec = {
        title: `${rWord} University Special Archives — Reading Room Guide`,
        situation: 'You and a classmate need to work together on a thesis project from 18:00 to 19:00 today. You both must use laptops and speak quietly together.',
        questionText: 'Which room should you reserve after hearing the announcement?',
        headers: cols,
        rows,
        notes: [
          'Student ID registration is required at least 15 minutes before entry.',
          'Rooms undergoing maintenance are closed to all students.',
        ],
      };
      // Vary which room or follow-up action is required by round % 2
      const cClosed = round % 2 === 0;
      const spoken = cClosed
        ? `Archive Notice ${rWord} ${sWord}: Welcome to the University Special Archives. Please listen carefully to today's facility update before submitting a room slip. Although our printed guide lists four reading rooms, air-conditioning repairs have closed Room C in the West Gallery starting at five p.m. today. To accommodate evening thesis pairs who need both laptop access and quiet discussion space until seven p.m., we have extended Room D in the South Vault by one extra hour until seven p.m. this evening. Remember to validate your student cards at Desk Two before heading downstairs.`
        : `Archive Notice ${rWord} ${sWord}: Welcome to the University Special Archives. Please listen carefully to today's facility update before submitting a room slip. Room D in the South Vault is reserved exclusively for visiting faculty after five p.m. today, so students cannot use it this evening. Fortunately, Room C in the West Gallery remains open on its regular schedule until eight p.m., with quiet pair discussion and laptop use permitted until seven p.m. as listed. Please pick up a green pass at Counter One at least fifteen minutes prior to six o'clock.`;
      return {
        material,
        spoken,
        docTypeEn: 'archive room comparison schedule',
        iconHintEn: 'a small book icon and a clock icon',
        summaryJa: '大学特別資料室の閲覧室比較表（時間帯・PC可否・会話可否）',
        ja: cClosed
          ? `18〜19時に2人でノートPCを使い小声で相談したい状況。印刷表では本来Room Cが条件に合うが、放送で本日17時以降Room Cが空調修理で閉鎖され、代わりにRoom Dが19時まで1時間延長されると案内されているため、Room Dを選んで2番カウンターで学生証認証を受けるのが正解。`
          : `18〜19時に2人でノートPCを使い小声で相談したい状況。放送でRoom Dは17時以降客員教員専用と案内される一方、Room Cは通常どおり利用可能で19時までPC・相談とも可のため、Room Cを予約して1番カウンターでパスを受け取るのが正解。`,
        correct: cClosed
          ? 'Reserve Room D and validate student IDs at Desk Two.'
          : 'Reserve Room C and pick up a green pass at Counter One.',
        cReason: cClosed
          ? 'Room Cが17時以降閉鎖される一方、PC・会話可能なRoom Dが本日19時まで延長されているため全条件を満たす。'
          : 'Room Dが17時以降利用不可で、18〜19時にPCと会話の両方が認められるRoom C＋1番カウンターの手続きが全条件に合致する。',
        wrongs: cClosed
          ? [
              'Reserve Room C in the West Gallery as printed.',
              'Reserve Room A because laptops are permitted there.',
              'Reserve Room B since it stays open until 20:00.',
            ]
          : [
              'Reserve Room D in the South Vault until 19:00.',
              'Reserve Room A and bring laptops at 18:00.',
              'Reserve Room B and discuss the project quietly.',
            ],
        wReasons: [
          cClosed ? 'Room Cは本日17時以降空調修理のため閉鎖されている。' : 'Room Dは本日17時以降客員教員専用で学生は利用できない。',
          'Room Aは17時閉室かつグループ相談不可なので条件を満たさない。',
          'Room Bは20時まで開いているがノートPCも相談も禁止されている。',
        ] as [string, string, string],
        exp: '印刷表の3条件（18〜19時・PC可・会話可）と音声の当日変更（閉鎖または延長）を統合して判断する。',
        ev: cClosed ? 'extended Room D in the South Vault by one extra hour until seven' : 'Room C in the West Gallery remains open on its regular schedule',
        skill: 'Real-Life：条件照合',
      };
    },
    // 2: 国際学会シャトルバス・空港アクセス案内
    () => {
      const material: RealLifeMaterialSpec = {
        title: `${rWord} Biotech Congress — Airport Transfer Options`,
        situation: 'You land at Terminal 2 at 14:20 with two large poster tubes. You must reach the Harbor Venue before 15:30 and need a receipt for corporate reimbursement.',
        questionText: 'Which transfer option should you take?',
        headers: ['Service', 'Departs Terminal 2', 'Arrival Time', 'Oversized Tubes'],
        rows: [
          ['Express Coach Blue', '14:35', '15:10', 'Allowed in lower hold'],
          ['Metro Rapid Line', 'Every 10 min', '42 min ride', 'Not allowed during peak'],
          ['Shuttle Van Green', '14:40', '15:20', 'Allowed (max 2 items)'],
          ['Harbor Water Taxi', '14:50', '15:45', 'Allowed'],
        ],
        notes: [
          'Printed reimbursement receipts are issued only at staffed ticket machines or onboard card terminals.',
        ],
      };
      const coachFull = round % 2 === 1;
      const spoken = coachFull
        ? `Terminal Announcement ${rWord} ${sWord}: Attention delegates attending the Biotech Congress at the Harbor Venue. Due to highway lane paving, the fourteen thirty-five Express Coach Blue departure from Terminal Two has been canceled. Shuttle Van Green will depart on schedule at fourteen forty from Curbside Bay Six, accommodates up to two poster tubes per passenger, and prints corporate tax receipts directly from the driver's card reader. Please proceed to Bay Six outside Arrivals.`
        : `Terminal Announcement ${rWord} ${sWord}: Attention delegates attending the Biotech Congress at the Harbor Venue. Please note that Shuttle Van Green's onboard receipt printer is out of service today, and drivers can accept mobile vouchers only without issuing paper or digital tax receipts. Express Coach Blue at fourteen thirty-five is operating normally from Platform Three, stores poster tubes in the lower luggage bay, and issues official corporate receipts at the platform kiosk.`;
      return {
        material,
        spoken,
        docTypeEn: 'airport transfer timetable chart',
        iconHintEn: 'a small bus icon and a suitcase icon',
        summaryJa: '国際学会参加者向け空港アクセス比較表（出発時刻・到着時刻・大型筒持込可否）',
        ja: coachFull
          ? `14:20着・ポスター筒2本携行・15:30前到着・精算用領収書必須という条件。14:35のExpress Coach Blueは道路工事で運休となったため、14:40発・15:20着・筒2本可・車内端末で領収書発行可のShuttle Van Green（6番乗り場）を選ぶ。`
          : `14:20着・ポスター筒2本・15:30前着・領収書必須という条件。Shuttle Van Greenは領収書プリンター故障で発行不可のため、通常運行し下部トランクに筒を積め券売機で公式領収書が出るExpress Coach Blue（3番乗り場）を選ぶ。`,
        correct: coachFull
          ? 'Board Shuttle Van Green at Curbside Bay Six.'
          : 'Take Express Coach Blue from Platform Three.',
        cReason: coachFull
          ? '15:20着で時刻条件を満たし、ポスター筒2本と領収書発行の両方に対応している。'
          : '15:10着で時刻条件を満たし、ポスター筒預け入れと公式領収書発行の両方が可能である。',
        wrongs: coachFull
          ? [
              'Take Express Coach Blue at 14:35.',
              'Board the Harbor Water Taxi at 14:50.',
              'Ride the Metro Rapid Line with the two tubes.',
            ]
          : [
              'Board Shuttle Van Green at 14:40.',
              'Take the Harbor Water Taxi arriving at 15:45.',
              'Ride the Metro Rapid Line without a receipt.',
            ],
        wReasons: [
          coachFull ? '14:35発のExpress Coach Blueは車線舗装工事により運休になった。' : 'Shuttle Van Greenは本日領収書プリンター故障で経費精算用領収書が出せない。',
          'Harbor Water Taxiは到着が15:45となり15:30前の必着条件に間に合わない。',
          'Metro Rapid Lineは大型ポスター筒の持ち込み制限に抵触する。',
        ] as [string, string, string],
        exp: '到着時刻（15:30前）・大型筒2本・領収書発行の3条件と放送の運行変更を突き合わせる。',
        ev: coachFull ? 'Shuttle Van Green will depart on schedule at fourteen forty' : 'Express Coach Blue at fourteen thirty-five is operating normally',
        skill: 'Real-Life：除外条件',
      };
    },
    // 3: 社員研修ワークショップ選択
    () => {
      const material: RealLifeMaterialSpec = {
        title: `${rWord} Corporate Academy — Friday Afternoon Courses`,
        situation: 'You are a first-year project coordinator. Your manager wants you to earn at least 4 training credits this Friday afternoon, and your department budget caps course fees at $120.',
        questionText: 'Which course should you enroll in?',
        headers: ['Course Code', 'Target Level', 'Credits', 'Fee'],
        rows: [
          ['PM-101 Agile Scheduling', 'All staff', '4 credits', '$95'],
          ['PM-204 Risk Auditing', 'Senior managers only', '5 credits', '$110'],
          ['PM-108 Client Negotiation', 'All staff', '4 credits', '$140'],
          ['PM-112 Budget Forecasting', 'All staff', '3 credits', '$80'],
        ],
        notes: [
          'Employees using an early-department code receive $30 off courses priced above $130.',
        ],
      };
      const pm101Full = round % 2 === 0;
      const spoken = pm101Full
        ? `HR Training Line ${rWord} ${sWord}: Thank you for calling the Corporate Academy desk. If you are registering for this Friday's session, please note two updates. First, PM-one-oh-one Agile Scheduling has reached full capacity and enrollment is closed. Second, our HR office has activated the thirty-dollar departmental discount code for all first-year coordinators, bringing PM-one-oh-eight Client Negotiation down from one hundred forty dollars to one hundred ten dollars—well within a one-hundred-twenty-dollar cap. Submit form B on the intranet before four p.m.`
        : `HR Training Line ${rWord} ${sWord}: Thank you for calling the Corporate Academy desk. Please note an update for Friday's afternoon lineup: the thirty-dollar departmental discount code has expired for this quarter, so listed fees apply in full. Fortunately, three extra seats have just opened in PM-one-oh-one Agile Scheduling at ninety-five dollars for four credits, open to all staff levels. To claim a seat, submit form A on the intranet right away.`;
      return {
        material,
        spoken,
        docTypeEn: 'corporate training course table',
        iconHintEn: 'a small clipboard icon and a checkmark icon',
        summaryJa: '社内研修講座の一覧表（対象階層・単位数・受講料・割引注記）',
        ja: pm101Full
          ? `1年目社員・4単位以上・予算上限120ドルの条件。PM-101は満席締切となったが、30ドル割引コードが1年目社員に適用されPM-108が140ドル→110ドルになるため、PM-108をフォームBで申し込むのが正解。`
          : `1年目社員・4単位以上・上限120ドルの条件。30ドル割引コードは期限切れのためPM-108は140ドルのままで予算超過となるが、PM-101（95ドル・4単位・全社員対象）に3席空きが出たためフォームAで申し込むのが正解。`,
        correct: pm101Full
          ? 'Enroll in PM-108 Client Negotiation using form B.'
          : 'Enroll in PM-101 Agile Scheduling using form A.',
        cReason: pm101Full
          ? '30ドル割引適用で110ドルとなり上限120ドル以内・4単位・全社員対象の全条件を満たす。'
          : '95ドル・4単位・全社員対象で空き席があり、上限120ドル以内の条件を完全に満たす。',
        wrongs: pm101Full
          ? [
              'Enroll in PM-101 Agile Scheduling at $95.',
              'Enroll in PM-204 Risk Auditing for 5 credits.',
              'Enroll in PM-112 Budget Forecasting at $80.',
            ]
          : [
              'Enroll in PM-108 Client Negotiation at $140.',
              'Enroll in PM-204 Risk Auditing for senior managers.',
              'Enroll in PM-112 Budget Forecasting for 3 credits.',
            ],
        wReasons: [
          pm101Full ? 'PM-101は満席（full capacity）で受付終了している。' : '割引コード期限切れのためPM-108は140ドルとなり上限120ドルを超える。',
          'PM-204は上級管理職限定（Senior managers only）のため1年目社員は受講不可。',
          'PM-112は3単位しか取得できず、最低4単位の要件に足りない。',
        ] as [string, string, string],
        exp: '対象職位・必要単位数（4以上）・予算上限（$120）に割引有無と満席情報を掛け合わせて選ぶ。',
        ev: pm101Full ? 'bringing PM-one-oh-eight Client Negotiation down from one hundred forty dollars to one hundred ten' : 'three extra seats have just opened in PM-one-oh-one Agile Scheduling',
        skill: 'Real-Life：優先順位',
      };
    },
    // 4: 市立スポーツセンターのクリニック／健康診断予約
    () => {
      const material: RealLifeMaterialSpec = {
        title: `${rWord} Municipal Wellness Center — Checkup Packages`,
        situation: 'You need an annual health checkup next week on Wednesday morning. Your company requires vision and hearing tests, and you cannot fast the night before.',
        questionText: 'Which package should you book?',
        headers: ['Package', 'Available Days', 'Fasting Required', 'Vision & Hearing'],
        rows: [
          ['Standard Care', 'Mon / Wed / Fri AM', 'No', 'Included'],
          ['Executive Plus', 'Tue / Wed AM', 'Yes (10 hours)', 'Included'],
          ['Quick Screen', 'Mon–Fri AM', 'No', 'Vision only'],
          ['Comprehensive A', 'Wed / Thu AM', 'Yes (12 hours)', 'Included'],
        ],
        notes: [
          'Optional audiometry (hearing test) can be added to Quick Screen on Wednesdays if Nurse Station 2 is open.',
        ],
      };
      const stdBooked = round % 2 === 1;
      const spoken = stdBooked
        ? `Clinic Voicemail ${rWord} ${sWord}: Hello, you have reached the Municipal Wellness Center booking line. For next week's Wednesday morning slots, Standard Care is completely booked out. However, Nurse Station Two will operate all Wednesday morning, allowing patients who book Quick Screen to add the full hearing test on the spot with no overnight fasting required. Please select Option Four on our keypad to reserve Quick Screen plus the hearing add-on.`
        : `Clinic Voicemail ${rWord} ${sWord}: Hello, you have reached the Municipal Wellness Center booking line. Please note that Nurse Station Two will be closed for equipment calibration next Wednesday, meaning optional hearing tests cannot be added to Quick Screen. Fortunately, we still have four Wednesday morning openings in Standard Care, which includes both vision and hearing checks and requires no fasting. Press Option Two to confirm your slot.`;
      return {
        material,
        spoken,
        docTypeEn: 'medical checkup package schedule',
        iconHintEn: 'a small stethoscope icon and a calendar icon',
        summaryJa: '健康診断パッケージ比較表（実施曜日・絶食要否・視力聴力検査の有無）',
        ja: stdBooked
          ? `来週水曜午前・視力＆聴力必須・前夜絶食不可の条件。Standard Careは水曜満枠だが、当日はナースステーション2が開いておりQuick Screenに聴力検査を追加でき絶食も不要なため、Quick Screen＋聴力追加を選ぶ。`
          : `来週水曜午前・視力＆聴力必須・絶食不可の条件。水曜はナースステーション2が機器校正で閉鎖されQuick Screenへの聴力追加は不可だが、Standard Careに4枠空きがあるためそれを選ぶ。`,
        correct: stdBooked
          ? 'Book Quick Screen with the hearing add-on via Option Four.'
          : 'Book Standard Care for Wednesday morning via Option Two.',
        cReason: stdBooked
          ? '水曜午前・絶食不要・視力＋追加聴力検査のすべての条件を満たす唯一の選択肢である。'
          : '水曜午前・絶食不要・視力聴力込みのStandard Careに空きがあるため全条件を満たす。',
        wrongs: stdBooked
          ? [
              'Book Standard Care for Wednesday morning.',
              'Book Executive Plus on Wednesday morning.',
              'Book Comprehensive A on Wednesday morning.',
            ]
          : [
              'Book Quick Screen and add the hearing test.',
              'Book Executive Plus with ten-hour fasting.',
              'Book Comprehensive A with twelve-hour fasting.',
            ],
        wReasons: [
          stdBooked ? 'Standard Careの来週水曜午前枠は満枠（completely booked out）である。' : 'ナースステーション2が閉鎖されるため水曜はQuick Screenに聴力検査を追加できない。',
          'Executive Plusは10時間の絶食が必要で「絶食不可」の条件に反する。',
          'Comprehensive Aも12時間の絶食が必要であり条件を満たさない。',
        ] as [string, string, string],
        exp: '水曜午前・絶食なし・視力＋聴力の3条件に、注記（Notes）と留守電の空き状況を重ねて判断する。',
        ev: stdBooked ? 'book Quick Screen to add the full hearing test' : 'four Wednesday morning openings in Standard Care',
        skill: 'Real-Life：条件照合',
      };
    },
    // 5: 美術館・博物館の団体ガイドツアー申込規定
    () => {
      const material: RealLifeMaterialSpec = {
        title: `${rWord} Maritime Museum — Group Tour Plans`,
        situation: 'You are organizing a Saturday visit for 18 high school students, including one student in a wheelchair. You want an English-speaking guide.',
        questionText: 'Which tour plan should you select?',
        headers: ['Plan', 'Max Group Size', 'Step-Free Route', 'English Guide'],
        rows: [
          ['Harbor Heritage', '25 visitors', 'Yes', 'Sat & Sun'],
          ['Shipwright Deck', '20 visitors', 'No (steep ladders)', 'Daily'],
          ['Navigator Hall', '15 visitors', 'Yes', 'Daily'],
          ['Ocean Discovery', '30 visitors', 'Yes', 'Weekdays only'],
        ],
        notes: [
          'Groups of 16–20 may use Navigator Hall if split into two sub-groups, provided two guides are on duty.',
        ],
      };
      const heritagePaused = round % 2 === 0;
      const spoken = heritagePaused
        ? `Museum Group Desk ${rWord} ${sWord}: Thank you for calling the Maritime Museum group office. For this Saturday's bookings, elevator maintenance in the East Dock has temporarily suspended step-free access on the Harbor Heritage route. However, we have scheduled two English-speaking docents for Navigator Hall all day Saturday, so groups of up to twenty students can split into two sub-groups on its fully step-free route. Email our education coordinator to lock in that arrangement.`
        : `Museum Group Desk ${rWord} ${sWord}: Thank you for calling the Maritime Museum group office. Please note that only one English-speaking docent is on duty in Navigator Hall this Saturday, so groups larger than fifteen cannot be split there. Fortunately, the Harbor Heritage tour is running on its full step-free route for up to twenty-five visitors with English commentary all Saturday. Complete the online group form to reserve Harbor Heritage.`;
      return {
        material,
        spoken,
        docTypeEn: 'museum group tour eligibility chart',
        iconHintEn: 'a small anchor icon and an accessibility ramp icon',
        summaryJa: '海洋博物館の団体ツアープラン比較表（定員・バリアフリー対応・英語ガイド有無）',
        ja: heritagePaused
          ? `土曜・高校生18人・車椅子1名（バリアフリー必須）・英語ガイド希望。Harbor Heritageはエレベーター保守で土曜は段差なしルート休止だが、Navigator Hallに土曜は英語ガイド2名が配置され2班分割で20人までバリアフリー案内が可能なためそちらを選ぶ。`
          : `土曜・18人・バリアフリー必須・英語ガイド希望。Navigator Hallは土曜の英語ガイドが1名のみで16人以上の分割受入が不可だが、Harbor Heritage（25人まで・バリアフリー・土日英語対応）が通常催行されるためそちらを選ぶ。`,
        correct: heritagePaused
          ? 'Book Navigator Hall split into two sub-groups by emailing the coordinator.'
          : 'Reserve the Harbor Heritage tour using the online group form.',
        cReason: heritagePaused
          ? '英語ガイド2名体制により18名を2班に分けてバリアフリーのNavigator Hallを利用でき全条件に合致する。'
          : '定員25名・完全バリアフリー・土曜英語ガイド対応のHarbor Heritageが通常運行しており全条件を満たす。',
        wrongs: heritagePaused
          ? [
              'Reserve the Harbor Heritage tour for all 18 students.',
              'Select the Shipwright Deck tour on Saturday.',
              'Choose the Ocean Discovery tour on Saturday.',
            ]
          : [
              'Split the 18 students into two sub-groups in Navigator Hall.',
              'Select the Shipwright Deck tour for 20 visitors.',
              'Book the Ocean Discovery tour with an English guide.',
            ],
        wReasons: [
          heritagePaused ? 'Harbor Heritageは今週土曜エレベーター保守によりバリアフリールートが休止されている。' : '今週土曜はNavigator Hallの英語ガイドが1名のみで15名超の分割受入ができない。',
          'Shipwright Deckは急な梯子がありバリアフリー非対応である。',
          'Ocean Discoveryの英語ガイドは平日限定（Weekdays only）で土曜は対象外。',
        ] as [string, string, string],
        exp: '18名・土曜・車椅子対応・英語ガイドの4条件に注記の分割規定と音声の稼働状況を重ねて選ぶ。',
        ev: heritagePaused ? 'two English-speaking docents for Navigator Hall all day Saturday' : 'Harbor Heritage tour is running on its full step-free route',
        skill: 'Real-Life：除外条件',
      };
    },
  ];

  const spec = realLifeSpecs[u - 1]();
  const qItem = makeQuestionItem({
    examId,
    questionNumber: qNo,
    questionPrompt: spec.material.questionText,
    choicePresentation: 'printed',
    correctChoice: spec.correct,
    correctReason: spec.cReason,
    wrongChoices: spec.wrongs as [string, string, string],
    wrongReasons: spec.wReasons,
    targetAnswer,
    explanation: spec.exp,
    evidence: spec.ev,
    skill: spec.skill,
  });

  const speaker = (round + u) % 2 === 0 ? 'F1' : 'M1';
  const turns: DialogueTurn[] = [
    { speaker, roleLabel: 'Narrator', text: spec.spoken },
    { speaker: 'F2', roleLabel: 'Narrator', text: `Question. ${spec.material.questionText}` },
  ];

  const image = buildMaterialImageSpec(
    audioId,
    spec.summaryJa,
    spec.docTypeEn,
    (spec.material.rows?.length ?? 4) + 1,
    spec.material.headers?.length ?? 4,
    spec.iconHintEn,
  );

  return makeDialogueUnit({
    examId,
    part: 'part3',
    unitIndex: u,
    readCount: 1,
    turns,
    translation: spec.ja,
    image,
    material: spec.material,
    questions: [qItem],
  });
}

function buildGradePre1Round(round: number): ListeningExamRound {
  const examId = `eiken_pre1_listening_r${String(round).padStart(2, '0')}`;
  const units: ListeningAudioUnit[] = [];
  for (let u = 1; u <= 12; u++) units.push(buildPre1Part1Unit(examId, round, u));
  for (let u = 1; u <= 6; u++) units.push(buildPre1Part2Unit(examId, round, u));
  for (let u = 1; u <= 5; u++) units.push(buildPre1Part3Unit(examId, round, u));
  return buildExamRound('eiken_pre1', round, units);
}

export const GRADE_PRE1_LISTENING_EXAMS: readonly ListeningExamRound[] = Array.from(
  { length: 15 },
  (_, idx) => buildGradePre1Round(idx + 1),
);

