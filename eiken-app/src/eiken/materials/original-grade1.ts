import { mc, type OriginalUnit } from './original-types';

export const GRADE_1_UNIT: OriginalUnit = {
  grade: '1',
  theme: '科学的認識・制度設計・歴史的解釈',
  focus: '多層的な因果関係、方法論的限界、言外の前提・含意を精密に読み解く',
  minutes: 40,
  vocabulary: [
    mc(
      '語彙：主張の根拠を覆す',
      'Newly digitized harbor ledgers have ( ___ ) the long-held assumption that the medieval port traded almost exclusively in timber.',
      ['corroborated', 'upended', 'placated', 'sequestered'],
      1,
      'Newly digitized harbor ledgers ... long-held assumption',
      [
        'corroboratedは「裏づけた」であり、通説を覆す文脈と逆になります。',
        'upendedは「（従来の前提・通説などを）根底から覆した」で文脈に一致します。',
        'placatedは「（怒りや不満を）なだめた」で対象が合いません。',
        'sequesteredは「隔離した・差し押さえた」で文意に合いません。',
      ],
    ),
    mc(
      '語彙：一時しのぎの緩和策',
      'Critics contended that subsidizing diesel ferries without upgrading harbor rail links offered merely a ( ___ ) rather than a structural cure for island freight delays.',
      ['panacea', 'palliation', 'palliative', 'prerogative'],
      2,
      'rather than a structural cure',
      [
        'panaceaは「万能薬」であり、merely（単なる）やstructural cureとの対比と矛盾します。',
        'palliationは不可算名詞が基本で不定冠詞 a palliation とは通常しません。',
        'a palliativeは「一時しのぎの対症療法・緩和策」として可算名詞で用いられ、structural cureとの対比に厳密に合致します。',
        'prerogativeは「特権・大権」で文脈に合いません。',
      ],
    ),
  ],
  readings: [
    {
      title: 'When Proxy Indicators Outlive Their Purpose',
      text: 'Public institutions frequently evaluate complex missions through proxy indicators because ultimate goals, such as scholarly originality or ecosystem resilience, resist rapid annual counting. At first, a well-chosen proxy tracks the underlying goal closely enough to expose genuine neglect. Trouble begins once budgets, promotions, or institutional prestige become formally tied to the proxy itself. Organizations then reorganize daily routines around maximizing the score rather than sustaining the condition the score originally represented. When forestry agencies were judged solely by the number of saplings planted each spring, contractors favored fast-growing monocultures on accessible slopes over diverse native seedlings that required years of browsing protection, inflating planting totals while leaving watersheds ecologically fragile. Correcting this distortion rarely means abandoning quantitative records altogether; rather, it requires rotating or pairing indicators with qualitative field audits so no single number becomes synonymous with success.',
      questions: [
        mc(
          'メカニズムの把握',
          'According to the passage, why do proxy indicators often lose their reliability over time?',
          [
            'Statistical software cannot compare annual counts across different geographical regions.',
            'Attaching rewards directly to a metric encourages actors to optimize the number at the expense of the underlying goal.',
            'Field auditors routinely refuse to share qualitative observations with central budget offices.',
            'Public agencies replace their indicators too frequently for long-term trends to emerge.',
          ],
          1,
          'reorganize daily routines around maximizing the score rather than sustaining the condition',
          [
            '地域間の統計比較が技術的に不可能だとは述べられていません。',
            '予算や評価が指標自体に直結すると、本来の目的ではなく数値の最大化へ行動が歪むという本文の核心と一致します。',
            '現場監査官が共有を拒むという記述はありません。',
            '頻繁に変えすぎるのが原因ではなく、単一指標の固定化が問題とされています。',
          ],
        ),
        mc(
          '具体例の役割',
          'Why does the author mention spring sapling counts in forestry programs?',
          [
            'To demonstrate that native hardwood trees cannot survive on steep mountain slopes.',
            'To argue that private contractors outperform state forestry departments in cost control.',
            'To illustrate how pursuing high numerical output can undermine long-term ecological health.',
            'To show that watershed restoration succeeds best without any numerical monitoring.',
          ],
          2,
          'inflating planting totals while leaving watersheds ecologically fragile',
          [
            '在来種が斜面で育たないという主張ではなく、保護の手間がかかるため敬遠されたという例です。',
            '民間業者のコスト優位を論じているのではありません。',
            '植樹本数という数値目標の追求が単一植林を招き、本来の流域生態系の健全性を損ねた具体例として機能しています。',
            '数値記録の全廃は後半で明確に否定（rarely means abandoning quantitative records altogether）されています。',
          ],
        ),
      ],
    },
    {
      title: 'Survivorship Bias in Architectural History',
      text: 'Visitors admiring medieval stone cathedrals or Edo-period merchant storehouses often conclude that premodern builders possessed universally superior craftsmanship compared with contemporary construction. Architectural historians caution, however, that standing monuments represent a heavily filtered sample. Everyday timber dwellings built with shallow foundations, green lumber, or cheap lime mortar rotted, burned, or collapsed centuries ago, leaving few traces above ground. Structures that endured did so not only because they were unusually well funded at the outset, but also because successive generations judged them prestigious or useful enough to reroof, underpin, and repair. Excavations of ordinary urban neighborhoods routinely uncover cramped tenements whose warped beams and hasty repairs contradict romantic narratives of uniform past excellence. Appreciating historic architecture therefore requires separating admiration for surviving masterpieces from sweeping generalizations about how most buildings in an era were actually made.',
      questions: [
        mc(
          '論証の焦点',
          'What misconception among modern observers does the passage challenge?',
          [
            'That stone cathedrals required repeated roof repairs over the centuries.',
            'That surviving historic landmarks reflect the typical building quality of their era.',
            'That archaeological excavations can identify how ordinary urban residents lived.',
            'That wealthy patrons invested substantial sums in monumental buildings.',
          ],
          1,
          'standing monuments represent a heavily filtered sample',
          [
            '屋根の修繕が繰り返されたことは歴史家の説明の一部であり誤解ではありません。',
            '現存する歴史的建造物は淘汰を経た偏った標本であり、当時の平均的な建築品質を示すものではないという指摘と一致します。',
            '発掘調査で庶民の住居が分かることは事実として述べられています。',
            '裕福な資金投入があったこと自体は事実として認められています。',
          ],
        ),
        mc(
          '含意の推論',
          'Which factor contributed to the survival of historic monuments alongside their initial construction quality?',
          [
            'Strict municipal laws forbidding any alteration to residential timber houses.',
            'The complete absence of fires and floods in premodern commercial districts.',
            'Ongoing maintenance by later generations who valued those particular buildings.',
            'The widespread use of standardized steel fasteners across medieval towns.',
          ],
          2,
          'successive generations judged them prestigious or useful enough to reroof, underpin, and repair',
          [
            '木造住宅の改修禁止法については述べられていません。',
            '火災や崩壊が多かったことが第3文で述べられています。',
            '当初の潤沢な資金に加え、後の世代が価値を認めて屋根の葺き替えや基礎補強を続けたことが残存要因として挙げられています。',
            '中世の標準化された鋼製留め具という記述はありません。',
          ],
        ),
      ],
    },
  ],
  listenings: [],
  writing: [
    {
      id: 'summary',
      title: '学術・政策評論文の精密要約',
      instruction: '以下の英文を読み、その内容を90〜110語の英語で要約しなさい。本文に書かれていない自分の意見は加えず、自分の言葉でパラフレーズすること。',
      source:
        'In recent decades, major public science agencies and charitable foundations have increasingly required grant recipients to publish their research findings under open-access licenses so that anyone with an internet connection can read taxpayer-funded discoveries without paying steep subscription fees. Advocates contend that removing paywalls accelerates medical and environmental innovation, enables clinicians, teachers, and municipal planners at smaller institutions to consult up-to-date evidence, and ensures citizens can inspect the scholarship their taxes finance.\n\nAt the same time, shifting revenue away from reader subscriptions has created unintended inequities through article-processing charges. Many prominent commercial publishers now bill authors several thousand dollars per accepted manuscript to cover editorial management, digital hosting, and peer-review administration. While well-endowed laboratories in wealthy nations can absorb these charges through institutional grants, independent scholars, early-career researchers, and universities in lower-income countries risk being priced out of publishing in leading venues, even though they can read those journals freely. Unscrupulous predatory outlets have also exploited the author-pays model by accepting flawed manuscripts with minimal scrutiny simply to collect fees.\n\nTo preserve universal readership without erecting financial barriers to authorship, coalitions of university libraries and public funders are increasingly backing diamond open-access journals financed through shared institutional infrastructure rather than per-article author fees, paired with transparent peer-review standards and strict editorial auditing.',
      target: '本番目安：90〜110語（約305語の原文3段落の要旨・副作用・打開策を網羅）。',
      model:
        'Public research funders increasingly mandate open-access publishing so taxpayer-supported discoveries can be read freely worldwide, accelerating innovation and helping practitioners at smaller institutions consult current evidence. However, replacing subscriptions with substantial author publication fees has generated new inequities: scholars from lower-income nations or modestly funded departments struggle to afford leading journals, while predatory outlets profit by publishing weakly reviewed papers for fees. To maintain free global readership without pricing out authors, university library coalitions and public agencies are expanding diamond open-access journals supported by shared institutional funding alongside transparent, rigorous editorial oversight.',
      commentary:
        '第1段落（公的助成研究のオープンアクセス義務化と知識共有・革新促進の利点）、第2段落（高額な論文掲載料による資金力の乏しい研究者・途上国機関の排除と粗悪学術誌の横行）、第3段落（図書館連合や公的機関による機関共同助成型のダイヤモンドOAと厳格な編集審査）を92語で的確に言い換えています。',
      checklist: [
        'オープンアクセス化の目的と利点（無料閲覧・小規模機関のアクセス向上）を要約した',
        '著者負担の掲載料が生む格差と粗悪誌の問題を漏らさず含めた',
        '機関助成によるダイヤモンドOAと厳格審査という解決策で結んだ',
        '原文の丸写しや私見を避け、90〜110語に収めた',
      ],
    },
    {
      id: 'essay',
      title: '国際社会・公共政策のエッセイ（理由3つ）',
      instruction:
        'TOPIC: Should wealthy nations bear a legally binding financial obligation to compensate countries severely affected by climate change?\n賛否の立場を明確にし、異なる3つの理由（序論・本論3段落・結論の5段落構成）で論述しなさい。',
      target: '本番目安：200〜240語（POINTSなし・理由3つ必須）。',
      model:
        'I strongly contend that wealthy nations should accept a legally binding financial obligation to compensate countries suffering severe damage from climate change, rather than relying on optional aid.\nFirst, historical responsibility justifies formal legal duties over voluntary charity. Industrialized economies built much of their modern infrastructure and national wealth through two centuries of carbon-intensive manufacturing, whereas many low-lying island nations and agrarian regions contributed negligibly to cumulative greenhouse gas emissions yet confront the most destructive sea-level rise and prolonged droughts.\nSecond, predictable statutory funding is indispensable for long-term adaptation planning. Voluntary pledges announced at diplomatic summits routinely fall short whenever domestic political priorities shift. Legally enforceable contributions allow vulnerable governments to finance multi-year civil engineering projects, such as coastal seawalls, resilient power grids, and drought-tolerant crop systems, before catastrophic weather strikes.\nThird, stabilizing climate-vulnerable regions safeguards global economic and humanitarian security. Uncompensated agricultural collapse and mass displacement disrupt international food supply chains, strain neighboring states, and trigger expensive emergency relief operations that ultimately burden wealthy economies far more than preventive investment.\nIn conclusion, establishing binding climate compensation grounded in historical fairness, reliable infrastructure planning, and shared international stability is both ethically justified and practically prudent.',
      commentary:
        '1級本番形式（POINTSなし・理由3つ・200〜240語）に合わせ、序論で賛成立場を明示し、①歴史的排出責任と被害の不均衡、②任意拠出の不安定さと長期防災インフラ計画に必要な法的確実性、③国際食料供給網・人道安定という相互利益の3軸を5段落・203語で展開しています。',
      checklist: [
        '序論でTOPICに対する明確な立場を宣言した',
        '互いに独立した3つの理由を別々の本論段落（計3段落）で展開した',
        '1級水準の学術語彙と複文構造を正確に用いた',
        '結論で3つの論点を束ね、200〜240語に収めた',
      ],
    },
  ],
};
