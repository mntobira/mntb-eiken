import {
  makeDialogueUnit,
  makeQuestionItem,
  speakerPairFor,
} from './listening-helpers';
import type {
  DialogueTurn,
  ListeningAudioUnit,
} from '../listeningExamCore';

export const G1_ROUNDS = [
  'Premier', 'Second', 'Third', 'Fourth', 'Fifth',
  'Sixth', 'Seventh', 'Eighth', 'Ninth', 'Tenth',
  'Eleventh', 'Twelfth', 'Thirteenth', 'Fourteenth', 'Fifteenth',
] as const;

export const G1_SLOTS = [
  'Amber', 'Beryl', 'Cobalt', 'Diamond', 'Emerald',
  'Flint', 'Garnet', 'Helix', 'Indigo', 'Jade',
] as const;

export const M_G1 = [
  'Alistair', 'Barnaby', 'Cornelius', 'Desmond', 'Edmund',
  'Ferdinand', 'Gideon', 'Humphrey', 'Ignatius', 'Julian',
  'Kingsley', 'Lysander', 'Montgomery', 'Nathaniel', 'Oswald',
];

export const F_G1 = [
  'Arabella', 'Beatrix', 'Cordelia', 'Dorothea', 'Evangeline',
  'Felicity', 'Guinevere', 'Henrietta', 'Imogen', 'Josephine',
  'Katarina', 'Lavinia', 'Millicent', 'Nerissa', 'Ophelia',
];

export function buildG1Part1Unit(examId: string, round: number, u: number): ListeningAudioUnit {
  const [sp1, sp2] = speakerPairFor(round + 1, u);
  const m = M_G1[(round * 2 + u) % 15];
  const f = F_G1[(round * 3 + u) % 15];
  const nTo1 = sp1.roleLabel === 'Man' ? f : m;
  const nTo2 = sp1.roleLabel === 'Man' ? m : f;
  const targetAnswer = (round + u - 1) % 4;
  const rWord = G1_ROUNDS[round - 1];
  const sWord = G1_SLOTS[u - 1];

  const items = [
    // 1: 企業買収デューデリジェンスと契約条項の修正
    () => {
      const assets = ['patent portfolio in solid-state sensors', 'regional cold-chain warehousing subsidiary', 'specialty polymer manufacturing division', 'maritime telemetry software platform', 'precision optical coating facility'];
      const clauses = [
        ['hold fifteen percent of the purchase price in escrow pending environmental sign-off', '環境監査の承認が下りるまで買収代金の15%をエスクロー口座に留保する'],
        ['insert a two-year non-solicitation covenant covering senior R&D engineers', '上級研究開発エンジニアを対象とする2年間の引き抜き禁止条項を盛り込む'],
        ['tie the final earn-out payment to verified renewal rates among hospital clients', '最終アーンアウト支払いを病院顧客の契約更新実績に連動させる'],
      ];
      const asset = assets[(round - 1) % 5];
      const [clEn, clJa] = clauses[(round - 1) % 3];
      const turns: DialogueTurn[] = [
        { ...sp1, text: `Good morning ${nTo1}. Following our ${rWord.toLowerCase()} ${sWord.toLowerCase()} legal audit of the ${asset}, the valuation metrics look compelling, yet one contingent liability still troubles our board.` },
        { ...sp2, text: `Let me guess, ${nTo2}—the seller wants an unconditional closing before quarter-end, whereas your directors worry about unresolved compliance exposure?` },
        { ...sp1, text: `Precisely. Walking away over this would squander six months of negotiation, yet signing the draft agreement as written leaves us unprotected.` },
        { ...sp2, text: `Then let us bridge the divide structurally: we keep their headline valuation intact provided we ${clEn}.` },
        { ...sp1, text: `That strikes a judicious balance—I will instruct outside counsel to redraft Clause Nine accordingly.` },
        { speaker: 'F2', roleLabel: 'Narrator', text: `Question. How have the speakers agreed to address the board's concern about acquiring the ${asset}?` },
      ];
      return {
        turns,
        ja: `${asset}の買収監査をめぐる協議。交渉決裂は避けたいが無条件クロージングはリスクが高いため、表面上の評価額は維持しつつ「${clJa}」条項を第9条に盛り込むことで合意した。`,
        prompt: `How have the speakers agreed to address the board's concern about acquiring the ${asset}?`,
        correct: `They will ${clEn}.`,
        cReason: `provided we ${clEn} という構造的折衷案に That strikes a judicious balance と同意している。`,
        wrongs: [
          'They will terminate the acquisition talks immediately.',
          'They will sign the draft agreement without any conditions.',
          'They will slash the headline valuation by forty percent.',
        ] as [string, string, string],
        wReasons: [
          '交渉打ち切りは squander six months of negotiation として避けている。',
          '現状のまま署名するのは leaves us unprotected として拒否している。',
          '表面上の評価額は keep their headline valuation intact と維持する方針である。',
        ] as [string, string, string],
        exp: `評価額を維持する代わりにリスクをヘッジする条件（provided we ${clEn}）を聞き取る。`,
        ev: `provided we ${clEn}`,
        skill: '会話：多者交渉',
      };
    },
    // 2: 学術誌の査読コメントに対する反論と追加検証（3話者会話 M1/F1/M2）
    () => {
      const fields = ['paleoclimate ice-core chronology', 'urban heat-island micro-modeling', 'bilingual lexical retrieval latency', 'antimicrobial peptide folding', 'electoral redistricting econometrics'];
      const steps = [
        ['run a sensitivity check excluding outlier stations and put it in an online appendix', '外れ値観測点を除いた感度分析を回しオンライン補遺に掲載する'],
        ['re-analyze the raw spectral files with an independent calibration curve', '独立した検量線で生の分光ファイルを再解析する'],
        ['replicate the regression across a second longitudinal cohort from northern districts', '北部地区の別コホートデータで回帰分析を再現検証する'],
      ];
      const fld = fields[(round - 1) % 5];
      const [stEn, stJa] = steps[round % 3];
      const turns: DialogueTurn[] = [
        { speaker: 'M1', roleLabel: 'Man', text: `Colleagues, in our ${rWord.toLowerCase()} ${sWord.toLowerCase()} editorial debrief on the ${fld} manuscript, Referee Two claims our sample timeframe skews the variance.` },
        { speaker: 'F1', roleLabel: 'Woman', text: `With respect, ${m}, Referee Two overlooked Table Four, where we already controlled for seasonal drift. Surely we can rebut that critique in our cover letter?` },
        { speaker: 'M2', roleLabel: 'Man', text: `A purely verbal rebuttal rarely sways a skeptical editor, ${f}. Even if our original model holds up, furnishing fresh empirical proof will disarm the objection completely.` },
        { speaker: 'F1', roleLabel: 'Woman', text: `Fair point. We can ${stEn} within ten days without altering our main text.` },
        { speaker: 'M1', roleLabel: 'Man', text: `Agreed—let us execute that run first thing tomorrow.` },
        { speaker: 'F2', roleLabel: 'Narrator', text: 'Question. What have the researchers decided to do in response to Referee Two?' },
      ];
      return {
        turns,
        ja: `${fld}論文に対する査読者2の批判への3名による対応協議。手紙での反論だけでは編集者を説得しにくいため、本文は変えずに10日以内で「${stJa}」追加実証を行うことで合意した。`,
        prompt: 'What have the researchers decided to do in response to Referee Two?',
        correct: stEn[0].toUpperCase() + stEn.slice(1) + '.',
        cReason: `We can ${stEn} within ten days に全員が Agreed と合意している。`,
        wrongs: [
          'Send a purely verbal rebuttal without any additional analysis.',
          'Withdraw the manuscript and submit it to another journal.',
          'Delete Table Four because its seasonal figures were flawed.',
        ] as [string, string, string],
        wReasons: [
          '口頭・文章だけの反論は rarely sways a skeptical editor として不十分とされた。',
          '論文を取り下げて他誌へ出すという話は出ていない。',
          'Table Fourはすでに季節変動を統制した根拠であり削除しない。',
        ] as [string, string, string],
        exp: `3人目の助言を受けて合意された実証対応（${stEn}）を聞き取る。`,
        ev: `We can ${stEn}`,
        skill: '会話：含意',
      };
    },
    // 3〜10: 8分野の高度な実務・政策・学術対話
    ...Array.from({ length: 8 }, (_, k) => () => {
      const catalog = [
        {
          ctx: 'municipal desalination plant tender',
          problem: 'the lowest bidder relies on proprietary membrane cartridges available from only a single vendor',
          trap: 'selecting the lowest upfront bid regardless of lifecycle lock-in',
          decision: 'award the contract to the second-lowest consortium that uses standardized open-spec membranes',
          decisionJa: '標準化されたオープン規格膜を採用する次点コンソーシアムに発注する',
          sk: '会話：皮肉・婉曲',
        },
        {
          ctx: 'symphony hall acoustic refurbishment',
          problem: 'replacing the aged plaster ceiling panels threatens to dull the hall\'s signature warm reverberation',
          trap: 'installing synthetic foam tiles to speed up winter construction',
          decision: 'cast custom high-density lime-plaster replicas molded directly from the original panels',
          decisionJa: '元のパネルから型取りした高密度漆喰の特注レプリカを鋳造する',
          sk: '会話：前提の共有',
        },
        {
          ctx: 'clinical trial recruitment protocol',
          problem: 'weekday daytime screening hours inadvertently exclude full-time shift workers from the study cohort',
          trap: 'extrapolating results solely from retired volunteers',
          decision: 'open mobile Saturday and evening screening clinics near industrial transit hubs',
          decisionJa: '工業地帯の交通拠点近くに土曜・夜間の移動スクリーニング外来を開設する',
          sk: '会話：含意',
        },
        {
          ctx: 'archival digitization grant agreement',
          problem: 'a private sponsor requested twelve months of exclusive paywall access before public release',
          trap: 'granting private paywall exclusivity that violates the library charter',
          decision: 'decline the exclusivity clause and co-fund the scanning with a public university consortium',
          decisionJa: '独占公開条項を断り公立大学コンソーシアムとの共同出資でスキャンを進める',
          sk: '会話：多者交渉',
        },
        {
          ctx: 'grid-scale battery siting proposal',
          problem: 'locating the transformer station on the floodplain risks inundation during once-in-fifty-year storm surges',
          trap: 'building a higher concrete seawall around the low-lying parcel',
          decision: 'relocate the substation to the elevated quarry parcel two kilometers inland',
          decisionJa: '変電設備を2キロ内陸の高台にある旧採石場区画へ移設する',
          sk: '会話：前提の共有',
        },
        {
          ctx: 'pharmaceutical cold-storage audit',
          problem: 'manual paper temperature logs at regional depots failed to flag brief weekend power dips',
          trap: 'hiring extra night guards to read wall thermometers every hour',
          decision: 'deploy tamper-evident cellular telemetry loggers with automated SMS escalation',
          decisionJa: '自動SMS警報付きの改ざん防止セルラー遠隔温度ロガーを配備する',
          sk: '会話：含意',
        },
        {
          ctx: 'international art loan indemnity',
          problem: 'maritime humidity fluctuations make sea freight perilous for seventeenth-century panel paintings',
          trap: 'packing all twelve oil panels into a single ocean container',
          decision: 'split the loan across two climate-stabilized cargo flights accompanied by a courier conservator',
          decisionJa: 'クーリエ修復士が同乗する空調管理貨物便2便に作品を分散輸送する',
          sk: '会話：皮肉・婉曲',
        },
        {
          ctx: 'pension fund ESG rebalancing',
          problem: 'blanket divestment from heavy industry would prevent the fund from voting on decarbonization targets',
          trap: 'selling off every manufacturing share before next month\'s annual meetings',
          decision: 'retain a strategic stake and co-file binding shareholder resolutions on emissions reporting',
          decisionJa: '戦略的持分を維持し排出量開示に関する拘束力ある株主提案を共同提出する',
          sk: '会話：多者交渉',
        },
      ];
      const item = catalog[k];
      const turns: DialogueTurn[] = [
        { ...sp1, text: `Reviewing our ${rWord.toLowerCase()} ${sWord.toLowerCase()} briefing on the ${item.ctx}, ${nTo1}, I must say ${item.trap} would be remarkably shortsighted.` },
        { ...sp2, text: `Couldn't agree more, ${nTo2}. On paper it looks expedient, yet ${item.problem}.` },
        { ...sp1, text: `Exactly—short-term convenience would saddle us with far greater institutional risk down the road.` },
        { ...sp2, text: `That leaves one prudent course: we ought to ${item.decision}.` },
        { ...sp1, text: `Unquestionably. Let us put that recommendation before the steering committee this afternoon.` },
        { speaker: 'F2', roleLabel: 'Narrator', text: `Question. What course of action will the speakers recommend for the ${item.ctx}?` },
      ];
      return {
        turns,
        ja: `${item.ctx}に関する協議。一見手っ取り早い案（${item.trap}）は「${item.problem}」という重大な欠陥を抱えているため退け、「${item.decisionJa}」方針を運営委員会へ勧告することで一致した。`,
        prompt: `What course of action will the speakers recommend for the ${item.ctx}?`,
        correct: item.decision[0].toUpperCase() + item.decision.slice(1) + '.',
        cReason: `we ought to ${item.decision} に Unquestionably と完全合意している。`,
        wrongs: [
          item.trap[0].toUpperCase() + item.trap.slice(1) + '.',
          'Postpone any decision until the next decade.',
          'Dissolve the steering committee without filing a report.',
        ] as [string, string, string],
        wReasons: [
          `${item.trap} は remarkably shortsighted（著しく近視眼的）として冒頭で否定されている。`,
          '次の10年まで決定を先送りするという話は出ていない。',
          '報告書を出さずに運営委員会を解散するとも言っていない。',
        ] as [string, string, string],
        exp: `反語・批判的評価で退けられた案ではなく、最終合意した ${item.decision} を選ぶ。`,
        ev: `ought to ${item.decision}`,
        skill: item.sk,
      };
    }),
  ];

  const d = items[u - 1]();
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

export function buildG1Part2Unit(examId: string, round: number, u: number): ListeningAudioUnit {
  const qNo1 = 10 + (u - 1) * 2 + 1;
  const qNo2 = qNo1 + 1;
  const rWord = G1_ROUNDS[round - 1];
  const sWord = G1_SLOTS[u - 1];
  const ans1 = (round + qNo1 - 1) % 4;
  const ans2 = (round + qNo2 - 1) % 4;

  const passages = [
    // 1: 地球化学・促進岩石風化
    () => {
      const regions = ['temperate cereal plains', 'humid subtropical river basins', 'volcanic highland terraces', 'irrigated alluvial valleys', 'acidic pastureland plateaus'];
      const coBenefits = [
        ['neutralized soil acidity and reduced farmers\' need for quarried agricultural lime', '土壌酸性度を中和し農業用石灰の散布量を減らした'],
        ['released trace silicate and magnesium that strengthened crop stalks against lodging', '微量ケイ酸とマグネシウムを放出し作物の倒伏耐性を高めた'],
        ['stabilized rhizosphere pH and curbed nitrous oxide emissions from fertilized plots', '根圏pHを安定させ施肥区画からの一酸化二窒素排出を抑えた'],
      ];
      const reg = regions[(round - 1) % 5];
      const [cbEn, cbJa] = coBenefits[(round - 1) % 3];
      const body = `Geoscience Monograph ${rWord} ${sWord}: Enhanced rock weathering seeks to accelerate a slow planetary thermostat by spreading finely pulverized basalt across cropland. As rainwater carbonic acid reacts with silicate grains, atmospheric carbon is locked into dissolved bicarbonate ions that eventually wash into the oceans for millennial storage. Multi-year field trials across ${reg} confirmed a welcome agronomic bonus: the crushed mineral dust ${cbEn}. Yet geochemists warn of a measurement hurdle—verifying net carbon removal requires tracking downstream river alkalinity rather than relying solely on theoretical dissolution models, especially where dry spells temporarily stall chemical reactions.`;
      return {
        body,
        ja: `粉砕玄武岩を農地に散布する促進岩石風化の解説。${reg}での試験では炭素固定に加え「${cbJa}」効果も確認されたが、乾燥期の反応停滞を踏まえ下流河川のアルカリ度追跡が不可欠と警告されている。`,
        q1Prompt: `What agronomic benefit was observed in field trials across ${reg}?`,
        q1Correct: `The crushed basalt ${cbEn}.`,
        q1CReason: `the crushed mineral dust ${cbEn} と野外試験で確認された副次効果が述べられている。`,
        q1Wrongs: [
          'It eliminated the need for rainwater altogether.',
          'It turned ocean water acidic within a single season.',
          'It doubled grain harvests without any sunlight.',
        ] as [string, string, string],
        q1WReasons: [
          '雨水が不要になったのではなく雨水中の炭酸と反応する仕組みである。',
          '海水を酸性化させるのではなく重炭酸イオンとして貯留される。',
          '日光なしで収量が2倍になるという記述は存在しない。',
        ] as [string, string, string],
        q1Exp: `welcome agronomic bonus として挙げられた ${cbEn} を聞き取る。`,
        q1Ev: `mineral dust ${cbEn}`,
        q1Skill: '文：論旨と根拠',
        q2Prompt: 'What challenge do geochemists highlight regarding net carbon verification?',
        q2Correct: 'Downstream alkalinity must be monitored instead of relying only on models.',
        q2CReason: 'requires tracking downstream river alkalinity rather than relying solely on theoretical dissolution models と明言されている。',
        q2Wrongs: [
          'Basalt dust evaporates rapidly under humid conditions.',
          'Bicarbonate ions release all trapped carbon within days.',
          'Cropland soils reject volcanic minerals entirely.',
        ] as [string, string, string],
        q2WReasons: [
          '玄武岩粉末が湿潤下で蒸発するという事実は述べられていない。',
          '重炭酸イオンは数千年規模（millennial storage）で貯留される。',
          '農地土壌が火山性鉱物を拒絶するとも述べられていない。',
        ] as [string, string, string],
        q2Exp: `verifying net carbon removal requires tracking downstream river alkalinity を捉える。`,
        q2Ev: 'tracking downstream river alkalinity',
        q2Skill: '文：批判的読解',
      };
    },
    // 2: 経済史・海上保険制度の成立
    () => {
      const ports = ['Genoese merchant syndicates', 'Venetian Adriatic convoys', 'Antwerp bourse underwriters', 'Hanseatic Baltic guilds', 'Amsterdam maritime chambers'];
      const innovations = [
        ['splitting a single hull risk across dozens of fractional investors who had never met the captain', '面識のない多数の小口出資者に1隻の船体リスクを分散引き受けさせたこと'],
        ['publishing standardized premium tables graded by season, hull age, and convoy escort', '季節・船齢・護衛船の有無で段階化した標準保険料率表を公表したこと'],
        ['establishing specialized commercial courts empowered to settle cargo disputes within days', '積荷紛争を数日以内に裁定できる専門海事裁判所を創設したこと'],
      ];
      const port = ports[(round - 1) % 5];
      const [inEn, inJa] = innovations[round % 3];
      const body = `Economic History ${rWord} ${sWord}: Long before modern joint-stock corporations emerged, ${port} pioneered financial instruments to tame maritime uncertainty. Early sea loans bundled credit with catastrophe protection: a lender advanced capital for spices or timber and forfeited repayment if the vessel sank. While effective on familiar coastal runs, sea loans tied up vast capital in single voyages. The decisive institutional breakthrough came with ${inEn}. By separating capital lending from pure risk pricing, merchants with modest savings could finance distant trade routes without risking personal ruin.`;
      return {
        body,
        ja: `${port}による海上保険制度の発展史。初期の冒険貸借は単一航海に巨額資本が拘束されたが、「${inJa}」という制度革新で融資とリスク価格付けが分離され遠隔交易が広がった。`,
        q1Prompt: 'What limitation of early sea loans is mentioned in the lecture?',
        q1Correct: 'They locked large amounts of capital into individual voyages.',
        q1CReason: 'sea loans tied up vast capital in single voyages と限界が指摘されている。',
        q1Wrongs: [
          'Borrowers had to repay loans in full even after a shipwreck.',
          'They could only be used for overland caravan trade.',
          'Governments outlawed all spice and timber shipments.',
        ] as [string, string, string],
        q1WReasons: [
          '沈没時は返済免除（forfeited repayment if the vessel sank）であり逆である。',
          '陸上キャラバン限定ではなく海上交易の仕組みである。',
          '香辛料や木材の輸送が違法化されたという記述はない。',
        ] as [string, string, string],
        q1Exp: `sea loans tied up vast capital in single voyages の弱点を聞き取る。`,
        q1Ev: 'tied up vast capital in single voyages',
        q1Skill: '文：歴史的因果',
        q2Prompt: `What breakthrough by ${port} transformed long-distance trade?`,
        q2Correct: inEn[0].toUpperCase() + inEn.slice(1) + '.',
        q2CReason: `The decisive institutional breakthrough came with ${inEn}. と明言されている。`,
        q2Wrongs: [
          'Replacing wooden merchant ships with nuclear submarines.',
          'Abolishing all written contracts in maritime commerce.',
          'Requiring every investor to sail aboard the cargo ship.',
        ] as [string, string, string],
        q2WReasons: [
          '時代錯誤な記述であり本文に一切存在しない。',
          '書面契約を全廃したという事実もない。',
          '出資者全員に同乗を義務付けたのではなく逆である。',
        ] as [string, string, string],
        q2Exp: `The decisive institutional breakthrough came with ... の核心部分を捉える。`,
        q2Ev: inEn,
        q2Skill: '文：論旨と根拠',
      };
    },
    // 3: 神経科学・グリンパティック系
    () => {
      const waves = ['slow-wave delta oscillations', 'synchronized thalamocortical spindles', 'deep non-REM vascular pulses', 'nocturnal astrocytic channel shifts', 'coupled cerebrospinal fluid waves'];
      const wave = waves[(round - 1) % 5];
      const caveats = [
        ['sedative sleeping pills can induce unconsciousness while suppressing the very wave patterns needed for clearance', '鎮静系睡眠薬は意識を落とせても老廃物排出に必要な脳波パターン自体を抑制してしまう'],
        ['fragmented sleep with frequent brief awakenings disrupts fluid transport even when total hours appear normal', '細切れの覚醒があると合計睡眠時間が正常に見えても髄液輸送が阻害される'],
        ['excessive late-evening alcohol blunts slow-wave amplitude during the second half of the night', '夜遅い過度な飲酒が夜間後半の徐波振幅を鈍らせる'],
      ];
      const [cvEn, cvJa] = caveats[(round + 1) % 3];
      const body = `Neuroscience Seminar ${rWord} ${sWord}: Unlike peripheral organs, the human brain lacks conventional lymphatic vessels to clear metabolic waste. Over the past decade, neuroimaging studies have illuminated the glymphatic pathway, a perivascular plumbing network driven by ${wave}. During deep sleep, interstitial spaces between neurons expand markedly, allowing cerebrospinal fluid to flush out misfolded proteins accumulated during waking hours. Crucially, clinical neurologists note that ${cvEn}, underscoring that sleep architecture matters far more than sheer time spent in bed.`;
      return {
        body,
        ja: `脳内の老廃物排出を担うグリンパティック系と「${wave}」の講義。深い睡眠中に細胞間隙が広がり異常タンパク質が洗い流されるが、「${cvJa}」ため睡眠構造の質が重要である。`,
        q1Prompt: 'How does the glymphatic pathway clear metabolic waste during deep sleep?',
        q1Correct: 'Expanded spaces between neurons let cerebrospinal fluid flush proteins out.',
        q1CReason: 'interstitial spaces between neurons expand markedly, allowing cerebrospinal fluid to flush out misfolded proteins と説明されている。',
        q1Wrongs: [
          'Conventional lymphatic vessels pump blood out of the skull.',
          'Neurons burn misfolded proteins only during intense exercise.',
          'Interstitial spaces shrink completely while a person sleeps.',
        ] as [string, string, string],
        q1WReasons: [
          '脳には従来のリンパ管がない（lacks conventional lymphatic vessels）と冒頭で述べている。',
          '激しい運動中にのみ燃焼させるという記述はない。',
          '細胞間隙は縮むのではなく expand markedly（著しく広がる）である。',
        ] as [string, string, string],
        q1Exp: `interstitial spaces ... expand markedly のメカニズムを聞き取る。`,
        q1Ev: 'allowing cerebrospinal fluid to flush out misfolded proteins',
        q1Skill: '文：学術的定義',
        q2Prompt: 'What clinical point do neurologists emphasize at the end of the talk?',
        q2Correct: cvEn[0].toUpperCase() + cvEn.slice(1) + '.',
        q2CReason: `clinical neurologists note that ${cvEn} と結論部で強調されている。`,
        q2Wrongs: [
          'Spending twelve hours in bed guarantees optimal waste clearance.',
          'Glymphatic flow operates solely while people read complex texts.',
          'Adults over thirty no longer produce cerebrospinal fluid.',
        ] as [string, string, string],
        q2WReasons: [
          '臥床時間より睡眠構造が重要（architecture matters far more than sheer time）と否定している。',
          '覚醒読書中のみ働くというのは深い睡眠中に活発化する説明と逆である。',
          '30歳以上で脳脊髄液が作られなくなるという記述はない。',
        ] as [string, string, string],
        q2Exp: `Crucially, clinical neurologists note that ... の臨床上の注意点を捉える。`,
        q2Ev: cvEn,
        q2Skill: '文：批判的読解',
      };
    },
    // 4: 考古学・同位体産地分析
    () => {
      const artifacts = ['Bronze Age cobalt-blue glass beads', 'Roman hydraulic harbor mortars', 'Phoenician silver ingot hoards', 'Tang-era celadon glaze shards', 'Minoan copper oxhide ingots'];
      const surprises = [
        ['raw flux minerals traveled over two thousand kilometers along river portages previously thought impassable', '通行不能と考えられていた河川連水陸路を経て原料鉱物が2,000km以上運ばれていた'],
        ['local workshops recycled imported scrap cullet rather than smelting virgin ore on site', '現地の工房は原鉱石を精錬せず輸入ガラス屑を再溶解して成形していた'],
        ['two rival city-states actually shared a single highland quarry despite decades of intermittent warfare', '断続的に交戦していた2都市国家が実際には同一の高地採掘場を共有していた'],
      ];
      const artf = artifacts[(round - 1) % 5];
      const [spEn, spJa] = surprises[(round + 2) % 3];
      const body = `Archaeometry Report ${rWord} ${sWord}: Stylistic comparison once led archaeologists to assume that ${artf} were produced exclusively near royal palaces where they were excavated. Laser-ablation isotope analysis, which samples microscopic traces without visibly scarring artifacts, has overturned that consensus. By matching strontium and neodymium ratios against geological reference maps, analysts demonstrated that ${spEn}. Nevertheless, specialists stress that chemical provenance reveals where raw materials originated, not necessarily the cultural identity of the artisans who shaped the finished objects.`;
      return {
        body,
        ja: `同位体分析による「${artf}」の産地推定研究。王宮周辺生産説を覆し「${spJa}」と判明したが、原料産地と職人の文化的帰属は同一とは限らないと指摘している。`,
        q1Prompt: `What did laser-ablation isotope analysis reveal about ${artf}?`,
        q1Correct: spEn[0].toUpperCase() + spEn.slice(1) + '.',
        q1CReason: `analysts demonstrated that ${spEn} と分析結果が明示されている。`,
        q1Wrongs: [
          'Every piece had to be crushed into powder to measure ratios.',
          'All raw materials came from royal palace gardens.',
          'The artifacts were twentieth-century museum forgeries.',
        ] as [string, string, string],
        q1WReasons: [
          'without visibly scarring artifacts（傷をつけず微量を採取）と述べている。',
          '王宮周辺のみで生産されたという旧説は overturned（覆された）とある。',
          '20世紀の贋作だったという記述は一切ない。',
        ] as [string, string, string],
        q1Exp: `旧説を覆した実証結果（demonstrated that ${spEn}）を聞き取る。`,
        q1Ev: spEn,
        q1Skill: '文：歴史的因果',
        q2Prompt: 'What methodological caution do specialists raise?',
        q2Correct: 'Raw-material origin does not automatically identify the artisans\' culture.',
        q2CReason: 'chemical provenance reveals where raw materials originated, not necessarily the cultural identity of the artisans と述べている。',
        q2Wrongs: [
          'Strontium ratios change randomly every week in museum cases.',
          'Laser equipment works only on modern synthetic plastics.',
          'Geological reference maps cannot be compiled for highlands.',
        ] as [string, string, string],
        q2WReasons: [
          '展示ケース内で毎週ランダムに同位体比が変わることはない。',
          '現代プラスチックにしか使えないという記述もない。',
          '高地の地質参照図が作れないとも述べられていない。',
        ] as [string, string, string],
        q2Exp: `Nevertheless, specialists stress that ... の解釈上の限界を捉える。`,
        q2Ev: 'not necessarily the cultural identity of the artisans',
        q2Skill: '文：統計の解釈',
      };
    },
    // 5: 海底光ケーブル網の保護規制
    () => {
      const threats = ['deep-sea bottom trawling and dragged ship anchors', 'uncharted turbidity landslides along continental slopes', 'congested chokepoint straits shared with dredging barges', 'delayed coastal repair permits in overlapping jurisdictions', 'aging repeater housings near seismically active trenches'];
      const reforms = [
        ['pre-authorizing mutual repair-ship access across neighboring exclusive economic zones', '隣接する排他的経済水域間で修理船の相互立入を事前承認しておく協定'],
        ['establishing acoustic anchor-drag alert corridors around high-capacity fiber landings', '大容量光ケーブル陸揚げ周辺に音響式の走錨警報回廊を設ける対策'],
        ['requiring geographic route diversity before critical financial clearing networks are certified', '重要金融決済網の認証要件として地理的な複数ルート分散を義務づける規制'],
      ];
      const thr = threats[(round - 1) % 5];
      const [rfEn, rfJa] = reforms[(round - 1) % 3];
      const body = `Infrastructure Analysis ${rWord} ${sWord}: Although satellites capture public imagination, more than ninety-five percent of intercontinental data traffic—including daily sovereign bond settlements—travels through hair-thin glass fibers on the seabed. Most outages stem not from deliberate sabotage but from ${thr}. Because international treaties governing subsea cables largely date back to nineteenth-century telegraph conventions, repair vessels often wait weeks for bureaucratic transit clearances. Consequently, telecommunications regulators are now championing ${rfEn} to slash restoration times from weeks to days.`;
      return {
        body,
        ja: `大陸間通信の95%以上を担う海底光ケーブルの障害主因（「${thr}」）と、復旧期間短縮のため規制当局が推進する「${rfJa}」についての解説。`,
        q1Prompt: 'According to the speaker, what causes the majority of subsea cable outages?',
        q1Correct: thr[0].toUpperCase() + thr.slice(1) + '.',
        q1CReason: `Most outages stem not from deliberate sabotage but from ${thr}. と明言されている。`,
        q1Wrongs: [
          'Solar flares knocking out orbital communication satellites.',
          'Deliberate sabotage by competing bond traders.',
          'Saltwater dissolving pure glass fibers within six months.',
        ] as [string, string, string],
        q1WReasons: [
          '衛星ではなく海底ケーブルの障害原因についての話である。',
          'not from deliberate sabotage と意図的破壊工作を主因から除外している。',
          '海水で半年以内にガラス繊維が溶けるという記述はない。',
        ] as [string, string, string],
        q1Exp: `not from A but from B 構文で強調される主因（${thr}）を聞き取る。`,
        q1Ev: `not from deliberate sabotage but from ${thr}`,
        q1Skill: '文：統計の解釈',
        q2Prompt: 'What measure are telecommunications regulators promoting to speed up repairs?',
        q2Correct: rfEn[0].toUpperCase() + rfEn.slice(1) + '.',
        q2CReason: `regulators are now championing ${rfEn} to slash restoration times と述べられている。`,
        q2Wrongs: [
          'Shifting ninety-five percent of financial traffic to balloons.',
          'Banning all commercial shipping across the Atlantic Ocean.',
          'Replacing fiber-optic cables with nineteenth-century copper wire.',
        ] as [string, string, string],
        q2WReasons: [
          '金融通信の95%を気球に移すという話は一切ない。',
          '大西洋の商用航行を全面禁止するという記述もない。',
          '19世紀の銅線に戻すのではなく古い条約枠組みが課題とされている。',
        ] as [string, string, string],
        q2Exp: `regulators are now championing ... の改革案を捉える。`,
        q2Ev: `championing ${rfEn}`,
        q2Skill: '文：論旨と根拠',
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

  const speaker = u % 2 === 1 ? 'F1' : 'M1';
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
