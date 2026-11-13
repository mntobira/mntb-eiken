import {
  buildExamRound,
  buildMaterialImageSpec,
  makeDialogueUnit,
  makeQuestionItem,
} from './listening-helpers';
import type {
  DialogueTurn,
  ListeningAudioUnit,
  ListeningExamRound,
  RealLifeMaterialSpec,
} from '../listeningExamCore';
import {
  buildG1Part1Unit,
  buildG1Part2Unit,
  F_G1,
  G1_ROUNDS,
  G1_SLOTS,
  M_G1,
} from './listening-g1-p1p2';

/**
 * 英検1級 リスニング予想問題 全15回（計405問・315音源・75図版プロンプト）
 * - 第3部：Real-Life形式（5問／5音源・資料図版5枚）＋第4部：インタビュー（2問／1音源・M2 Interviewer＋Guest）
 * - 完全独自作成（origin: 'manatobi-original'）。過去問流用一切なし。
 */

function buildG1Part3Unit(examId: string, round: number, u: number): ListeningAudioUnit {
  const qNo = 20 + u;
  const audioId = `${examId}_part3_${String(u).padStart(2, '0')}`;
  const targetAnswer = (round + qNo - 1) % 4;
  const rWord = G1_ROUNDS[round - 1];
  const sWord = G1_SLOTS[u - 1];

  const specs = [
    // 1: 博士研究員フェローシップ研究助成金の申請区分選択
    () => {
      const material: RealLifeMaterialSpec = {
        title: `${rWord} Foundation — Postdoctoral Research Grant Tracks`,
        situation: 'You earned your PhD four years ago, hold a joint appointment with an overseas laboratory, and need funding that covers laboratory equipment purchases above $15,000.',
        questionText: 'Which grant track should you apply for?',
        headers: ['Grant Track', 'Years Since PhD', 'Overseas Co-Host', 'Equipment Cap'],
        rows: [
          ['Track Alpha (Seed)', 'Up to 3 years', 'Permitted', '$25,000'],
          ['Track Beta (Bridge)', 'Up to 6 years', 'Permitted', '$20,000'],
          ['Track Gamma (Domestic)', 'Up to 8 years', 'Not permitted', '$30,000'],
          ['Track Delta (Mobility)', 'Up to 5 years', 'Required', '$10,000'],
        ],
        notes: [
          'Under revised bylaws, Track Delta\'s equipment ceiling rises to $22,000 when co-hosted by an accredited public institute.',
        ],
      };
      const betaFrozen = round % 2 === 0;
      const spoken = betaFrozen
        ? `Grant Office Briefing ${rWord} ${sWord}: Welcome to the Foundation's autumn grant webinar. Before uploading your dossier, please take note of an administrative revision approved yesterday by our trustees. Due to multi-year commitments from the spring cycle, Track Beta Bridge will not accept new applications this autumn. However, applicants within five years of their doctorate who hold a joint appointment at an accredited overseas public institute may invoke the revised Track Delta Mobility bylaw, raising its equipment ceiling to twenty-two thousand dollars. Submit Annex Form Seven alongside your host-institute letter.`
        : `Grant Office Briefing ${rWord} ${sWord}: Welcome to the Foundation's autumn grant webinar. Please note one key clarification regarding equipment budgets for the current cycle. Trustees have temporarily suspended the Track Delta equipment-ceiling waiver while auditing international procurement rules, meaning Track Delta remains strictly capped at ten thousand dollars. Applicants within six years of their PhD who hold an overseas joint appointment and require over fifteen thousand dollars in lab apparatus should file under Track Beta Bridge using Portal Code Two.`;
      return {
        material,
        spoken,
        docTypeEn: 'postdoctoral research grant eligibility matrix',
        iconHintEn: 'a small microscope icon and a document seal icon',
        summaryJa: '博士研究員向け助成金トラック比較表（学位取得後年数・海外共同受入・設備上限額）の白紙枠レイアウト',
        ja: betaFrozen
          ? `博士取得後4年・海外研との共同所属・15,000ドル超の機器購入必須。Track Betaは今秋募集停止となったが、細則により海外公的研究機関との共同所属者はTrack Deltaの機器上限が22,000ドルに引き上げられるため、Track Delta＋様式7で申請する。`
          : `今期はTrack Deltaの上限緩和特例が一時停止され10,000ドル上限のままなので条件に届かず、学位後6年以内・海外共同可・上限20,000ドルのTrack BetaをPortal Code Twoで申請する。`,
        correct: betaFrozen
          ? 'Apply for Track Delta (Mobility) and attach Annex Form Seven.'
          : 'Apply for Track Beta (Bridge) using Portal Code Two.',
        cReason: betaFrozen
          ? '学位後4年（5年以内）・海外共同所属必須・特例適用で上限22,000ドルとなり全条件を満たす。'
          : '学位後4年（6年以内）・海外共同可・機器上限20,000ドルで15,000ドル超の条件をすべて満たす。',
        wrongs: betaFrozen
          ? [
              'Apply for Track Beta (Bridge) for up to $20,000.',
              'Apply for Track Alpha (Seed) for up to $25,000.',
              'Apply for Track Gamma (Domestic) for up to $30,000.',
            ]
          : [
              'Apply for Track Delta (Mobility) under the $22,000 waiver.',
              'Apply for Track Alpha (Seed) with a four-year-old PhD.',
              'Apply for Track Gamma (Domestic) with your overseas lab.',
            ],
        wReasons: [
          betaFrozen ? 'Track Betaは今秋の公募で新規申請の受付を停止している。' : 'Track Deltaの上限緩和特例は今期一時停止中で10,000ドルまでに制限されている。',
          'Track Alphaは学位取得後3年以内が条件であり、4年経過している応募者は対象外。',
          'Track Gammaは海外研究機関との共同所属が認められていない（Not permitted）。',
        ] as [string, string, string],
        exp: '学位取得後4年・海外共同所属・機器費$15,000超の3要件と注記特例の有効性を照合する。',
        ev: betaFrozen ? 'raising its equipment ceiling to twenty-two thousand dollars' : 'file under Track Beta Bridge using Portal Code Two',
        skill: 'Real-Life：条件照合',
      };
    },
    // 2: 国際商事仲裁センターの申立手続選択
    () => {
      const material: RealLifeMaterialSpec = {
        title: `${rWord} Commercial Arbitration Chamber — Filing Procedures`,
        situation: 'Your firm must resolve a $1.8 million cross-border supply contract dispute within 90 days. Both parties require a three-arbitrator panel and bilingual English-Japanese proceedings.',
        questionText: 'Which arbitration procedure should your legal team elect?',
        headers: ['Procedure', 'Claim Limit', 'Time to Award', 'Panel & Language'],
        rows: [
          ['Summary Fast-Track', '$1.2M max', '60 days', 'Sole arbitrator / English only'],
          ['Expedited Commercial', '$2.5M max', '85 days', '3 arbitrators / Bilingual'],
          ['Standard Plenary', 'Unlimited', '180 days', '3 arbitrators / Bilingual'],
          ['Maritime Special', '$3.0M max', '75 days', '3 arbitrators / English only'],
        ],
        notes: [
          'Maritime Special permits bilingual filings if a certified court interpreter is jointly retained at filing.',
        ],
      };
      const expSuspended = round % 2 === 1;
      const spoken = expSuspended
        ? `Registrar Notice ${rWord} ${sWord}: Counsel filing new cross-border disputes this month should note a docket adjustment from the Chamber Registrar. Because our bilingual commercial roster is fully committed through winter, Expedited Commercial timelines have been extended to one hundred thirty days, exceeding ninety-day mandates. Parties with claims under three million dollars needing a three-member panel and ninety-day resolution may instead file under Maritime Special—which covers general cross-border supply contracts under Rule Twelve—by jointly retaining a certified bilingual interpreter at filing.`
        : `Registrar Notice ${rWord} ${sWord}: Counsel filing new cross-border disputes this month should note a procedural update from the Chamber Registrar. Rule Twelve interpreter waivers for Maritime Special have been discontinued for non-shipping supply contracts, restricting Maritime Special to English-only maritime hull claims. Fortunately, two additional bilingual tribunal chairs joined our roster this week, keeping Expedited Commercial strictly on its eighty-five-day schedule for claims up to two point five million dollars with a three-arbitrator panel. File Schedule E electronically.`;
      return {
        material,
        spoken,
        docTypeEn: 'commercial arbitration procedure schedule',
        iconHintEn: 'a small balance scale icon and a gavel icon',
        summaryJa: '国際商事仲裁センターの申立手続比較表（請求上限・裁定日数・合議体人数と言語）の白紙枠レイアウト',
        ja: expSuspended
          ? `180万ドル・90日以内・仲裁人3名・日英二言語必須。Expedited Commercialは130日に延びて90日要件を超過するため、公認通訳の共同選任で二言語対応・75日裁定が可能なMaritime Specialを選ぶ。`
          : `Maritime Specialの通訳特例は一般供給契約には廃止となった一方、Expedited Commercialは増員により85日以内・上限250万ドル・3名合議・二言語対応が維持されているためSchedule Eで申し立てる。`,
        correct: expSuspended
          ? 'File under Maritime Special and jointly retain a certified interpreter.'
          : 'Elect Expedited Commercial by filing Schedule E electronically.',
        cReason: expSuspended
          ? '上限300万ドル・75日以内・3名合議に加え、通訳共同選任により日英二言語要件も満たす。'
          : '上限250万ドル・85日以内・3名合議・日英二言語の全要件をそのまま満たす。',
        wrongs: expSuspended
          ? [
              'Elect Expedited Commercial for an 85-day award.',
              'Choose Summary Fast-Track for a 60-day decision.',
              'Select Standard Plenary for unlimited claims.',
            ]
          : [
              'File under Maritime Special with a certified interpreter.',
              'Choose Summary Fast-Track with a sole arbitrator.',
              'Select Standard Plenary on the 180-day track.',
            ],
        wReasons: [
          expSuspended ? 'Expedited Commercialは名簿逼迫により裁定まで130日に延長され90日要件を超える。' : 'Maritime Specialは非海事の一般供給契約に対する二言語通訳特例が廃止されている。',
          'Summary Fast-Trackは上限120万ドル・単独仲裁人・英語のみで条件に合わない。',
          'Standard Plenaryは180日かかり90日以内の解決要件を満たせない。',
        ] as [string, string, string],
        exp: '金額・日数・3名パネル・二言語の4条件と事務局アナウンスの運用変更を照合する。',
        ev: expSuspended ? 'file under Maritime Special' : 'keeping Expedited Commercial strictly on its eighty-five-day schedule',
        skill: 'Real-Life：除外条件',
      };
    },
    // 3: 大学病院の高度画像診断検査紹介枠の選択
    () => {
      const material: RealLifeMaterialSpec = {
        title: `${rWord} University Hospital — Diagnostic Imaging Referral Slots`,
        situation: 'You are a referring physician scheduling a scan for an outpatient who has a titanium pacemaker, requires contrast media, and needs results before Friday noon.',
        questionText: 'Which imaging unit should you book?',
        headers: ['Imaging Suite', 'Pacemaker Protocol', 'Contrast Supervision', 'Report Turnaround'],
        rows: [
          ['Suite 1 (3T High-Field)', 'Contraindicated', 'On-site radiologist', '12 hours'],
          ['Suite 2 (1.5T Cardiac)', 'Approved with pacing tech', 'On-site radiologist', '24 hours'],
          ['Suite 3 (Open Bore)', 'Approved with pacing tech', 'Tue & Thu only', '36 hours'],
          ['Suite 4 (Dual-Source CT)', 'Approved (no reprogramming)', 'Daily 8:00–17:00', '6 hours'],
        ],
        notes: [
          'Today is Wednesday morning; reports must clear central radiology sign-off before Friday 12:00.',
        ],
      };
      const cardiacTechOff = round % 2 === 0;
      const spoken = cardiacTechOff
        ? `Radiology Dispatch ${rWord} ${sWord}: Attention referring clinicians calling on Wednesday morning. Our cardiac pacing electrophysiology technicians are attending an offsite accreditation board today and Thursday, meaning Suites Two and Three cannot scan pacemaker patients until Monday. For outpatients with titanium pacemakers requiring contrast imaging and rapid turnaround prior to Friday noon, Suite Four Dual-Source CT remains fully staffed with contrast supervision and six-hour reporting. Submit Order Code Nine on the clinical portal.`
        : `Radiology Dispatch ${rWord} ${sWord}: Attention referring clinicians calling on Wednesday morning. Suite Four Dual-Source CT is undergoing injector recalibration through Friday afternoon and can perform non-contrast scans only. If your outpatient carries a compatible titanium pacemaker, requires contrast media, and needs signed results before Friday noon, Suite Two One-Point-Five-T Cardiac has both pacing technicians and an on-site radiologist available this afternoon with twenty-four-hour reporting—delivering results by Thursday afternoon. Enter Referral Code Four.`;
      return {
        material,
        spoken,
        docTypeEn: 'hospital diagnostic imaging referral protocol table',
        iconHintEn: 'a small medical cross icon and a clock icon',
        summaryJa: '大学病院画像診断部門の紹介予約表（ペースメーカー対応・造影剤管理・読影所要時間）の白紙枠レイアウト',
        ja: cardiacTechOff
          ? `水曜午前の時点で、今日と木曜はペースメーカー技師が不在でSuite 2・3は不可のため、技師調整不要・造影対応・6時間報告のSuite 4をコード9で予約する。`
          : `Suite 4は金曜午後まで造影不可だが、Suite 2は本日午後に技師と放射線科医が揃い24時間報告で木曜午後に結果が出るためコード4で予約する。`,
        correct: cardiacTechOff
          ? 'Book Suite 4 (Dual-Source CT) using Order Code Nine.'
          : 'Schedule Suite 2 (1.5T Cardiac) using Referral Code Four.',
        cReason: cardiacTechOff
          ? 'ペースメーカー再設定不要・造影剤対応・6時間報告で金曜正午前に確実に結果が揃う。'
          : '技師・放射線科医立会いで造影可能かつ24時間報告により木曜午後に結果が確定する。',
        wrongs: cardiacTechOff
          ? [
              'Schedule Suite 2 (1.5T Cardiac) this afternoon.',
              'Book Suite 1 (3T High-Field) for 12-hour results.',
              'Select Suite 3 (Open Bore) on Thursday.',
            ]
          : [
              'Book Suite 4 (Dual-Source CT) with contrast media.',
              'Select Suite 1 (3T High-Field) for rapid turnaround.',
              'Wait until next Monday to use Suite 3.',
            ],
        wReasons: [
          cardiacTechOff ? '水・木はペースメーカー担当技師が不在のためSuite 2は利用できない。' : 'Suite 4は金曜午後まで造影剤インジェクター校正中で造影撮影ができない。',
          'Suite 1（3テスラ）はペースメーカー禁忌（Contraindicated）であり安全上不可。',
          cardiacTechOff ? 'Suite 3もペースメーカー技師不在のため月曜まで検査できない。' : '月曜まで待つと金曜正午までの結果報告期限に間に合わない。',
        ] as [string, string, string],
        exp: '医療安全条件（ペースメーカー・造影剤）と期限（水曜午前→金曜正午）を稼働アナウンスと突き合わせる。',
        ev: cardiacTechOff ? 'Suite Four Dual-Source CT remains fully staffed with contrast supervision' : 'Suite Two One-Point-Five-T Cardiac has both pacing technicians and an on-site radiologist',
        skill: 'Real-Life：優先順位',
      };
    },
    // 4: 産業見本市・精密機器展示ブースの出展区画選定
    () => {
      const material: RealLifeMaterialSpec = {
        title: `${rWord} Precision Engineering Expo — Exhibitor Zone Rules`,
        situation: 'Your company will demonstrate a 1,400 kg CNC prototype requiring three-phase 400V power and live compressed-air lines.',
        questionText: 'Which exhibitor zone should your operations manager reserve?',
        headers: ['Zone', 'Floor Load Limit', 'Power Supply', 'Compressed Air'],
        rows: [
          ['Hall North (Mezzanine)', '800 kg', '200V / 400V', 'Provided'],
          ['Hall East (Ground)', '2,500 kg', '400V three-phase', 'Provided'],
          ['Hall West (Pavilion)', '2,000 kg', '200V single-phase', 'Provided'],
          ['Hall South (Slab)', '3,000 kg', '400V three-phase', 'Portable compressor only'],
        ],
        notes: [
          'Hall West booths along Aisle 1 can connect to a temporary 400V transformer if ordered 30 days ahead.',
        ],
      };
      const eastSoldOut = round % 2 === 1;
      const spoken = eastSoldOut
        ? `Exhibitor Operations ${rWord} ${sWord}: Thank you for calling the Precision Engineering Expo technical desk. Because we are forty-five days ahead of opening day, early engineering orders are still open. Please note that Hall East Ground has sold its final booth this morning. However, exhibitors demonstrating machinery up to two thousand kilograms that requires live compressed-air piping and four-hundred-volt three-phase power can reserve an Aisle One booth in Hall West Pavilion and submit Transformer Request Form T today—well ahead of the thirty-day cutoff.`
        : `Exhibitor Operations ${rWord} ${sWord}: Thank you for calling the Precision Engineering Expo technical desk. Since opening day is now just eighteen days away, the thirty-day advance deadline for temporary four-hundred-volt transformers in Hall West Pavilion has already passed. Fortunately, two cancellations just freed up prime corner booths in Hall East Ground, which natively supports loads up to twenty-five hundred kilograms, four-hundred-volt three-phase power, and built-in compressed-air lines. Confirm via Exhibitor Desk B today.`;
      return {
        material,
        spoken,
        docTypeEn: 'industrial exhibition hall specification table',
        iconHintEn: 'a small gear icon and a lightning bolt icon',
        summaryJa: '精密機器展示会の出展ゾーン仕様表（床耐荷重・電源規格・圧縮空気配管）の白紙枠レイアウト',
        ja: eastSoldOut
          ? `開幕45日前でHall Eastは完売したが、30日前期限より前なので耐荷重2,000kg・圧縮空気完備のHall West通路1番区画＋変圧器申請フォームTで全要件を満たせる。`
          : `開幕18日前のためHall Westの仮設400V変圧器申請は締切済みだが、キャンセルで空きが出たHall East（耐荷重2,500kg・三相400V・圧縮空気常設）をDesk Bで確保できる。`,
        correct: eastSoldOut
          ? 'Reserve an Aisle 1 booth in Hall West and submit Form T.'
          : 'Book a corner booth in Hall East via Exhibitor Desk B.',
        cReason: eastSoldOut
          ? '開幕45日前なので30日前期限内の仮設400V変圧器が使え、耐荷重2,000kg・圧縮空気配管も満たす。'
          : '耐荷重2,500kg・三相400V・常設圧縮空気ラインが標準完備され空き区画が確保できる。',
        wrongs: eastSoldOut
          ? [
              'Book a booth in Hall East (Ground).',
              'Move the 1,400 kg machine to Hall North (Mezzanine).',
              'Select Hall South (Slab) for built-in air piping.',
            ]
          : [
              'Order a temporary 400V transformer in Hall West.',
              'Place the 1,400 kg prototype in Hall North.',
              'Use built-in compressed-air lines in Hall South.',
            ],
        wReasons: [
          eastSoldOut ? 'Hall Eastは今朝最後の区画が売れて満枠になっている。' : '開幕18日前のためHall Westの30日前変圧器申請期限はすでに過ぎている。',
          'Hall Northは中2階で耐荷重800kgまでしかなく1,400kgの機械は設置不可。',
          'Hall Southは常設圧縮空気ラインがなく携帯コンプレッサー限定のため要件を満たさない。',
        ] as [string, string, string],
        exp: '耐荷重1,400kg超・三相400V・常設空気配管の3条件と開幕までの残日数条件を照合する。',
        ev: eastSoldOut ? 'reserve an Aisle One booth in Hall West Pavilion and submit Transformer Request Form T' : 'prime corner booths in Hall East Ground',
        skill: 'Real-Life：条件照合',
      };
    },
    // 5: 工場排水モニタリング公認検査機関の選定
    () => {
      const material: RealLifeMaterialSpec = {
        title: `${rWord} Environmental Compliance — Certified Water Labs`,
        situation: 'Your beverage plant must submit an ISO-17025 accredited heavy-metal and PFAS report to prefectural regulators within 5 business days, including refrigerated weekend sample pickup.',
        questionText: 'Which laboratory service should your compliance officer contract?',
        headers: ['Laboratory', 'ISO-17025 Scope', 'Turnaround', 'Weekend Pickup'],
        rows: [
          ['AquaMetrics Lab', 'Heavy metals & PFAS', '4 business days', 'Sat & Sun'],
          ['BioClear Analytical', 'Heavy metals only', '3 business days', 'Sat & Sun'],
          ['EnviroTrace Institute', 'Heavy metals & PFAS', '5 business days', 'Weekdays only'],
          ['Delta ChemTest', 'Heavy metals & PFAS', '8 business days', 'Sat & Sun'],
        ],
        notes: [
          'EnviroTrace offers Saturday refrigerated courier pickup when paired with Express Couriers Zone 3.',
        ],
      };
      const aquaOffline = round % 2 === 0;
      const spoken = aquaOffline
        ? `Compliance Hotline ${rWord} ${sWord}: Advisory for industrial compliance officers scheduling statutory water audits this week. AquaMetrics Lab's mass-spectrometry line is undergoing annual prefectural recertification, pausing new PFAS intakes for two weeks. Plants requiring full ISO-seventeen-oh-two-five heavy-metal and PFAS reporting within five business days plus Saturday refrigerated collection should contract EnviroTrace Institute together with Express Couriers Zone Three. Quote Registry Code Six when booking.`
        : `Compliance Hotline ${rWord} ${sWord}: Advisory for industrial compliance officers scheduling statutory water audits this week. Express Couriers Zone Three has suspended weekend refrigerated transport due to fleet maintenance, meaning EnviroTrace Institute can accept weekday drop-offs only. Fortunately, AquaMetrics Lab's mass-spectrometry line is operating at full capacity, providing ISO-seventeen-oh-two-five heavy-metal and PFAS reports in four business days with direct Saturday and Sunday refrigerated pickup. Use Client Portal One.`;
      return {
        material,
        spoken,
        docTypeEn: 'accredited environmental testing laboratory comparison chart',
        iconHintEn: 'a small flask icon and a water droplet icon',
        summaryJa: '公認水質分析機関の比較表（ISO認定範囲・報告営業日数・週末冷蔵回収）の白紙枠レイアウト',
        ja: aquaOffline
          ? `AquaMetricsは再認定検査でPFAS受付停止中だが、EnviroTraceはExpress Couriers Zone 3併用で土曜冷蔵回収＋5営業日報告が可能なためコード6で契約する。`
          : `提携便の週末運休でEnviroTraceは平日持込のみとなったが、AquaMetricsが通常稼働しており重金属＋PFAS・4営業日・土日冷蔵回収をすべて満たすためPortal Oneで契約する。`,
        correct: aquaOffline
          ? 'Contract EnviroTrace Institute with Express Couriers Zone 3 using Code Six.'
          : 'Engage AquaMetrics Lab through Client Portal One.',
        cReason: aquaOffline
          ? '重金属＋PFASのISO認定・5営業日報告に加え、提携便による土曜冷蔵回収で全条件を満たす。'
          : '重金属＋PFASのISO認定・4営業日報告・土日冷蔵直接回収のすべてを単独で満たす。',
        wrongs: aquaOffline
          ? [
              'Engage AquaMetrics Lab for a 4-day report.',
              'Contract BioClear Analytical for 3-day turnaround.',
              'Select Delta ChemTest with weekend pickup.',
            ]
          : [
              'Contract EnviroTrace Institute with Express Couriers Zone 3.',
              'Use BioClear Analytical for heavy metals and PFAS.',
              'Hire Delta ChemTest for 5-business-day delivery.',
            ],
        wReasons: [
          aquaOffline ? 'AquaMetricsは質量分析計の年次再認定によりPFAS受付を2週間停止している。' : '提携便の週末運行休止によりEnviroTraceは週末の冷蔵回収が利用できない。',
          'BioClear Analyticalは重金属のみでPFASがISO認定範囲に含まれていない。',
          'Delta ChemTestは報告に8営業日かかり5営業日以内の提出期限に間に合わない。',
        ] as [string, string, string],
        exp: '認定項目（重金属＋PFAS）・納期（5営業日以内）・週末冷蔵回収の3要件と稼働情報を統合する。',
        ev: aquaOffline ? 'contract EnviroTrace Institute together with Express Couriers Zone Three' : 'AquaMetrics Lab\'s mass-spectrometry line is operating at full capacity',
        skill: 'Real-Life：除外条件',
      };
    },
  ];

  const spec = specs[u - 1]();
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

  const speaker = (round + u) % 2 === 0 ? 'M1' : 'F1';
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

function buildG1Part4Unit(examId: string, round: number): ListeningAudioUnit {
  const guestSpeaker = round % 2 === 1 ? 'F1' : 'M1';
  const guestName = round % 2 === 1 ? `Dr. ${F_G1[round - 1]}` : `Professor ${M_G1[round - 1]}`;
  const rWord = G1_ROUNDS[round - 1];
  const ans1 = (round + 25) % 4;
  const ans2 = (round + 26) % 4;

  const interviews = [
    {
      domain: 'adaptive reuse of industrial waterfronts',
      earlyFlaw: 'cities demolished historic brick warehouses wholesale, erasing neighborhood character and releasing massive embodied carbon',
      turningPoint: 'revising municipal building codes so timber-and-masonry shells could meet modern seismic standards through internal steel bracing',
      futureWarn: 'gentrification can price out small marine workshops unless port authorities reserve ground-floor leases at capped industrial rents',
      ja: '産業港湾地区の歴史的倉庫群を再生利用する都市計画家へのインタビュー。内部鉄骨ブレース補強で耐震基準を満たせるよう建築基準を改正したことが転換点となったが、1階区画を上限賃料付きで小規模事業者に確保しなければ職人が締め出されると警鐘を鳴らしている。',
    },
    {
      domain: 'orphan-drug manufacturing cooperatives',
      earlyFlaw: 'commercial pharmaceutical lines found ultra-rare pediatric formulations unprofitable due to tiny batch sizes',
      turningPoint: 'pooling procurement across twelve public children\'s hospitals to guarantee predictable multi-year production runs',
      futureWarn: 'relying on a single active-ingredient synthesizer abroad still exposes clinics to sudden export bottlenecks',
      ja: '希少小児疾患向け医薬品の製造協同組合に関するインタビュー。公立小児病院12施設が共同調達で複数年の生産量を保証したことが突破口になったが、海外の単一原薬工場への依存リスクに注意を促している。',
    },
    {
      domain: 'indigenous fire-stewardship in dry forests',
      earlyFlaw: 'a century of total wildfire suppression allowed dense brush and dead timber to accumulate into explosive fuel loads',
      turningPoint: 'restoring cool-season cultural burns led by trained indigenous fire practitioners alongside state forestry crews',
      futureWarn: 'short-term air-quality rules often restrict low-smoke winter burns while ignoring catastrophic summer megafire smoke',
      ja: '乾燥林における先住民の伝統的火入れ管理に関するインタビュー。低温期の計画的文化火入れを州林業隊と共同で復活させたことが転機となった一方、短期の大気基準が冬の低煙火入れを制限する制度的矛盾を指摘している。',
    },
    {
      domain: 'judicial translation and courtroom linguistics',
      earlyFlaw: 'untrained ad-hoc interpreters frequently flattened subtle hedging expressions, making witnesses sound evasive or overly certain',
      turningPoint: 'mandating accredited dual-channel recording and specialist legal-pragmatics certification for appellate-level interpreters',
      futureWarn: 'unedited real-time machine translation struggles with regional idioms and silent pauses that carry crucial legal weight',
      ja: '司法通訳と法廷言語学の専門家へのインタビュー。二系統録音と法語用論の専門認定を義務化したことが転機となったが、未編集のリアルタイム機械翻訳が方言慣用句や沈黙の法的意味を取りこぼす危険を警告している。',
    },
    {
      domain: 'grid-forming inverters in island microgrids',
      earlyFlaw: 'conventional solar inverters shut down whenever voltage flickered because they depended on spinning fossil turbines for frequency timing',
      turningPoint: 'deploying grid-forming battery software capable of synthesizing virtual inertia within milliseconds of a cloud shadow',
      futureWarn: 'salt-spray corrosion in tropical archipelagos still degrades outdoor switchgear unless enclosures are pressurized and sealed',
      ja: '離島マイクログリッドにおけるグリッドフォーミング・インバータ技術のインタビュー。数ミリ秒で仮想慣性を合成する制御ソフトの実用化が転換点となったが、熱帯群島での塩害腐食対策が引き続き鍵となる。',
    },
  ];

  const topic = interviews[(round - 1) % 5];
  const turns: DialogueTurn[] = [
    {
      speaker: 'M2',
      roleLabel: 'Interviewer',
      text: `Forum ${rWord} Interview: Welcome back. Today I am joined by ${guestName}, a leading specialist in ${topic.domain}. Looking back over the past two decades, what was the fundamental misstep in earlier approaches?`,
    },
    {
      speaker: guestSpeaker,
      roleLabel: 'Guest',
      text: `Thank you for having me. For years, policymakers meant well, yet ${topic.earlyFlaw}. Nobody accounted for those hidden systemic costs until field data made them impossible to ignore.`,
    },
    {
      speaker: 'M2',
      roleLabel: 'Interviewer',
      text: `And what proved to be the decisive turning point that made reform workable in practice?`,
    },
    {
      speaker: guestSpeaker,
      roleLabel: 'Guest',
      text: `The breakthrough came from ${topic.turningPoint}. Once that institutional mechanism was in place, skepticism faded remarkably quickly.`,
    },
    {
      speaker: 'M2',
      roleLabel: 'Interviewer',
      text: `Finally, as other regions rush to replicate your model, what pitfall still worries you most?`,
    },
    {
      speaker: guestSpeaker,
      roleLabel: 'Guest',
      text: `Complacency. Specifically, ${topic.futureWarn}. Addressing that vulnerability now is essential if these gains are to endure.`,
    },
    {
      speaker: 'F2',
      roleLabel: 'Narrator',
      text: `Question one. According to ${guestName}, what served as the decisive turning point in ${topic.domain}?`,
    },
    {
      speaker: 'F2',
      roleLabel: 'Narrator',
      text: `Question two. What ongoing risk does ${guestName} warn against at the end of the interview?`,
    },
  ];

  const q1 = makeQuestionItem({
    examId,
    questionNumber: 26,
    questionPrompt: `According to ${guestName}, what served as the decisive turning point in ${topic.domain}?`,
    choicePresentation: 'printed',
    correctChoice: topic.turningPoint[0].toUpperCase() + topic.turningPoint.slice(1) + '.',
    correctReason: `The breakthrough came from ${topic.turningPoint}. と転換点が明確に語られている。`,
    wrongChoices: [
      topic.earlyFlaw[0].toUpperCase() + topic.earlyFlaw.slice(1) + '.',
      'Abolishing all public oversight and safety standards nationwide.',
      'Abandoning empirical field data in favor of guesswork.',
    ],
    wrongReasons: [
      'これは過去の失敗例（fundamental misstep）として挙げられた内容であり転換点ではない。',
      '公的監督や安全基準を全廃したという発言は一切ない。',
      '実証データを捨てて当て推量に頼ったというのも発言と逆である。',
    ],
    targetAnswer: ans1,
    explanation: `The breakthrough came from ... の回答部分を正確に聞き取る。`,
    evidence: `breakthrough came from ${topic.turningPoint}`,
    skill: 'インタビュー：主張',
  });

  const q2 = makeQuestionItem({
    examId,
    questionNumber: 27,
    questionPrompt: `What ongoing risk does ${guestName} warn against at the end of the interview?`,
    choicePresentation: 'printed',
    correctChoice: topic.futureWarn[0].toUpperCase() + topic.futureWarn.slice(1) + '.',
    correctReason: `Specifically, ${topic.futureWarn}. と今後の懸念点として明言されている。`,
    wrongChoices: [
      'Complete lack of interest from any other region.',
      'Immediate bankruptcy of all participating universities.',
      'Total disappearance of demand within six months.',
    ],
    wrongReasons: [
      '他地域が競って模倣している（as other regions rush to replicate）と前提されている。',
      '参加大学がすべて即時破綻するという話は出ていない。',
      '半年以内に需要が完全消滅するという警告もなされていない。',
    ],
    targetAnswer: ans2,
    explanation: `終盤の what pitfall still worries you most? に対する Specifically, ... の警告内容を捉える。`,
    evidence: topic.futureWarn,
    skill: 'インタビュー：評価',
  });

  return makeDialogueUnit({
    examId,
    part: 'part4',
    unitIndex: 1,
    readCount: 1,
    turns,
    translation: topic.ja,
    image: null,
    questions: [q1, q2],
  });
}

function buildGrade1Round(round: number): ListeningExamRound {
  const examId = `eiken_1_listening_r${String(round).padStart(2, '0')}`;
  const units: ListeningAudioUnit[] = [];
  for (let u = 1; u <= 10; u++) units.push(buildG1Part1Unit(examId, round, u));
  for (let u = 1; u <= 5; u++) units.push(buildG1Part2Unit(examId, round, u));
  for (let u = 1; u <= 5; u++) units.push(buildG1Part3Unit(examId, round, u));
  units.push(buildG1Part4Unit(examId, round));
  return buildExamRound('eiken_1', round, units);
}

export const GRADE_1_LISTENING_EXAMS: readonly ListeningExamRound[] = Array.from(
  { length: 15 },
  (_, idx) => buildGrade1Round(idx + 1),
);
