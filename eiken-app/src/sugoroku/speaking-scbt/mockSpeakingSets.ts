import { validateSpeakingSet, type ScbtSpeakingSet } from './speakingTypes';

/**
 * ============================================================================
 * 完全オリジナル 英検S-CBT方式 スピーキング模擬課題（計6セット）
 *   - 英検2級 × 2セット
 *   - 英検準2級プラス（新設級）× 2セット
 *   - 英検準2級 × 2セット
 * ============================================================================
 * - すべて origin: 'manatobi-original' で新規書き起こし（過去問・市販参考書の流用ゼロ）
 * - 語彙帯は CEFR A2〜B1/B2前半（『パス単』2級・準2級コア語彙）に厳密制御し、不要なC1難語を排除
 * - スポーツ・学校生活・地域社会など高校生が意見を持ちやすいテーマを採用
 */

export const SCBT_SPEAKING_SETS: readonly ScbtSpeakingSet[] = [
  // ==========================================================================
  // 英検2級 オリジナル模擬 Set 1
  // ==========================================================================
  {
    id: 'scbt_g2_set01',
    origin: 'manatobi-original',
    grade: 'eiken_2',
    setNumber: 1,
    title: '2級 S-CBT模擬 第1回：地域のスポーツ用具シェアリング',
    themeSummaryJp: '地域の体育館でのスポーツ用具貸出制度と、運動習慣・用具管理の工夫',
    cardTitle: 'Sharing Sports Gear in Local Communities',
    passage:
      'Starting a new sport often requires expensive gear such as rackets, helmets, or shoes. Because of this cost, some teenagers hesitate to try unfamiliar sports. Recently, several community centers have started lending clean used equipment to local residents for free. In this way, young people can test different activities easily, and families can also reduce household waste at the same time.',
    passageTranslation:
      '新しいスポーツを始めるには、ラケットやヘルメット、シューズなどの高価な道具が必要になることがよくあります。この費用のため、なじみのないスポーツへの挑戦をためらう十代の若者もいます。最近、いくつかの地域センターが清潔な中古用具を地域住民へ無料で貸し出し始めました。このようにして、若者はさまざまな活動を気軽に試すことができ、同時に家庭での廃棄物も減らすことができます。',
    silentReadSeconds: 20,
    readAloudSeconds: 45,
    readAloudMaxScore: 5,
    illustrations: [
      {
        frameLabel: '1コマ目（1週間前・部室）',
        captionEn: 'One week ago — "Broken nets"',
        sceneDescriptionJp:
          'バドミントン部の美咲（Misaki）と顧問の先生が、破れた練習用ネットを見て困り、修理イベントのチラシを確認している場面。',
        svgType: 'sports_locker',
        frameIndex: 0,
      },
      {
        frameLabel: '2コマ目（土曜日・地域体育館）',
        captionEn: 'On Saturday — Repair Workshop',
        sceneDescriptionJp:
          '地域のボランティアスタッフと一緒に、美咲たちが古いネットの張り替えやラケットのグリップ交換を教わっている場面。',
        svgType: 'sports_locker',
        frameIndex: 1,
      },
      {
        frameLabel: '3コマ目（今週・放課後の練習）',
        captionEn: 'This week — New Junior Members',
        sceneDescriptionJp:
          'きれいになったコートで新入部員も加わって楽しそうに練習し、美咲が貸出用ラケット棚を整頓している場面。',
        svgType: 'sports_locker',
        frameIndex: 2,
      },
    ],
    questions: [
      {
        partId: 'q1',
        numberLabel: 'No. 1',
        questionType: 'passage_comprehension',
        promptAudioScript:
          'According to the passage, how can young people test different activities easily?',
        showPromptOnScreenByDefault: false,
        prepSeconds: 5,
        recordSeconds: 25,
        maxScore: 5,
        rubricPoints: [
          'By borrowing / using clean used equipment from community centers for free. の趣旨を主語＋動詞（または By ~ing）で答えているか',
          '本文の文を丸読みするだけでなく、必要な語を適切に補えているか',
        ],
        modelAnswer:
          'By borrowing clean used equipment from community centers for free.',
        modelTranslation:
          '地域センターから清潔な中古用具を無料で借りることによってです。',
      },
      {
        partId: 'q2',
        numberLabel: 'No. 2',
        questionType: 'picture_narration_3step',
        introAudioScript:
          'Now, please look at the picture and describe the situation. You have 20 seconds to prepare. Your story should begin with the sentence on the screen.',
        promptAudioScript:
          'Please begin your story with: One day, Misaki and her club teacher noticed that their practice nets were broken.',
        starterSentence:
          'One day, Misaki and her club teacher noticed that their practice nets were broken.',
        showPromptOnScreenByDefault: true,
        prepSeconds: 20,
        recordSeconds: 40,
        maxScore: 10,
        rubricPoints: [
          '過去時制（found, visited, taught, practiced など）を一貫して使えているか',
          '3コマすべての出来事と因果関係（壊れていた→修理講座に参加→新入部員と練習できた）が伝わるか',
        ],
        modelAnswer:
          'One day, Misaki and her club teacher noticed that their practice nets were broken. They found a poster about a local repair workshop. On Saturday, Misaki and her teammates visited the community gym, and a volunteer taught them how to fix the nets and rackets. This week, they were happy to practice with new junior members using the repaired equipment.',
        modelTranslation:
          'ある日、美咲と部活の先生は練習用ネットが壊れていることに気づきました。二人は地域の修理ワークショップのポスターを見つけました。土曜日、美咲と部員たちは地域体育館を訪れ、ボランティアからネットやラケットの直し方を教わりました。今週、彼らは修理した道具を使って新入部員と一緒に楽しく練習しました。',
      },
      {
        partId: 'q3',
        numberLabel: 'No. 3',
        questionType: 'social_topic_opinion',
        introAudioScript: 'Now, I will ask you a question about a social topic.',
        promptAudioScript:
          'Some people say that schools should open their gyms and sports fields to local residents on weekends. What do you think about that?',
        showPromptOnScreenByDefault: false,
        prepSeconds: 10,
        recordSeconds: 35,
        maxScore: 5,
        rubricPoints: [
          '冒頭で I agree. / I disagree. などの立場を明確に述べているか',
          '理由または具体例を2文以上で補足できているか',
        ],
        modelAnswer:
          'I agree with that idea. Many adults and children do not have enough safe places to exercise near their homes. If schools share their gyms on weekends, people of all ages can stay healthy and build stronger local relationships.',
        modelTranslation:
          '私はその考えに賛成です。多くの大人や子どもは自宅の近くに運動できる安全な場所が十分ありません。もし学校が週末に体育館を開放すれば、あらゆる年代の人が健康を保ち、地域のつながりも強められます。',
      },
      {
        partId: 'q4',
        numberLabel: 'No. 4',
        questionType: 'personal_opinion',
        promptAudioScript:
          'Today, many high school students watch training videos online to improve their skills. Do you think online videos are enough to learn a sport well? Yes or No — Why?',
        showPromptOnScreenByDefault: false,
        prepSeconds: 10,
        recordSeconds: 35,
        maxScore: 5,
        rubricPoints: [
          'Yes / No の立場と、それに整合する理由・具体例を明確に話せているか',
          '沈黙せず自分の言葉で最後まで話し切れているか',
        ],
        modelAnswer:
          'No, I do not think online videos are enough. Watching videos helps us understand basic forms, so it is useful at first. However, a real coach or teammate can notice bad habits immediately and help prevent injuries during practice.',
        modelTranslation:
          'いいえ、オンライン動画だけでは十分ではないと思います。動画を見ることは基本フォームの理解に役立つので最初は便利です。しかし、実際のコーチや仲間は悪い癖にすぐ気づき、練習中のケガを防ぐ手助けをしてくれます。',
      },
    ],
  },

  // ==========================================================================
  // 英検2級 オリジナル模擬 Set 2
  // ==========================================================================
  {
    id: 'scbt_g2_set02',
    origin: 'manatobi-original',
    grade: 'eiken_2',
    setNumber: 2,
    title: '2級 S-CBT模擬 第2回：学校食堂の事前注文と食品ロス削減',
    themeSummaryJp: 'タブレット事前予約による学校食堂の混雑緩和と食材ロス削減',
    cardTitle: 'Pre-Order Systems in School Cafeterias',
    passage:
      'In many high schools, the cafeteria becomes very crowded at lunchtime, and students sometimes wait in long lines. At the same time, kitchen staff often prepare extra meals, which can lead to leftover food. To solve both problems, some schools have introduced a morning pre-order system on school tablets. By checking exact orders early, staff can cook the right amount and serve hot lunches much faster.',
    passageTranslation:
      '多くの高校では昼休みに食堂が大変混雑し、生徒が長い列で待つことがあります。同時に、調理スタッフは多めに食事を用意することが多く、食べ残し（売れ残り）につながることもあります。両方の問題を解決するため、朝のタブレット事前注文制度を導入した学校もあります。早い時間に正確な注文数を確認することで、スタッフは適量を調理し、温かい昼食をより素早く提供できます。',
    silentReadSeconds: 20,
    readAloudSeconds: 45,
    readAloudMaxScore: 5,
    illustrations: [
      {
        frameLabel: '1コマ目（昨日の昼休み・食堂）',
        captionEn: 'Yesterday — "Sold Out!"',
        sceneDescriptionJp:
          '昼休みに食堂へ走ってきた拓海（Takumi）が、人気の日替わり定食が売り切れていてがっかりしている場面。',
        svgType: 'cafeteria_order',
        frameIndex: 0,
      },
      {
        frameLabel: '2コマ目（今朝・教室のホームルーム前）',
        captionEn: 'This morning — Morning Order App',
        sceneDescriptionJp:
          '友人に教えてもらい、拓海が朝の教室で学校のタブレットから昼食メニューを事前予約している場面。',
        svgType: 'cafeteria_order',
        frameIndex: 1,
      },
      {
        frameLabel: '3コマ目（今日の昼休み・受け取り窓口）',
        captionEn: 'Today at noon — Express Counter',
        sceneDescriptionJp:
          '専用レーンで待たずに温かい定食を受け取り、午後の部活ミーティング前に友人とゆっくり食事できている場面。',
        svgType: 'cafeteria_order',
        frameIndex: 2,
      },
    ],
    questions: [
      {
        partId: 'q1',
        numberLabel: 'No. 1',
        questionType: 'passage_comprehension',
        promptAudioScript:
          'According to the passage, how can kitchen staff cook the right amount and serve hot lunches much faster?',
        showPromptOnScreenByDefault: false,
        prepSeconds: 5,
        recordSeconds: 25,
        maxScore: 5,
        rubricPoints: [
          'By checking exact orders early (through a morning pre-order system). の核心を正確に答えているか',
        ],
        modelAnswer:
          'By checking exact orders early through a morning pre-order system on school tablets.',
        modelTranslation:
          '学校のタブレットの朝の事前注文システムで、早い時間に正確な注文数を確認することによってです。',
      },
      {
        partId: 'q2',
        numberLabel: 'No. 2',
        questionType: 'picture_narration_3step',
        introAudioScript:
          'Now, please look at the picture and describe the situation. You have 20 seconds to prepare. Your story should begin with the sentence on the screen.',
        promptAudioScript:
          'Please begin your story with: Yesterday at lunchtime, Takumi was disappointed because his favorite lunch set was sold out.',
        starterSentence:
          'Yesterday at lunchtime, Takumi was disappointed because his favorite lunch set was sold out.',
        showPromptOnScreenByDefault: true,
        prepSeconds: 20,
        recordSeconds: 40,
        maxScore: 10,
        rubricPoints: [
          '3コマの流れ（売り切れ→翌朝タブレット予約→昼にスムーズに受け取って食事）を過去時制で説明できているか',
        ],
        modelAnswer:
          'Yesterday at lunchtime, Takumi was disappointed because his favorite lunch set was sold out. This morning in his classroom, his friend showed him the morning order app, so Takumi reserved his meal on his school tablet. Today at noon, he picked up his lunch quickly at the express counter and enjoyed eating with his friend before his club meeting.',
        modelTranslation:
          '昨日の昼休み、拓海はお気に入りのランチセットが売り切れていたのでがっかりしました。今朝、教室で友人が朝の注文アプリを教えてくれたので、拓海は学校のタブレットで食事を予約しました。今日の正午、彼は専用カウンターで素早く昼食を受け取り、部活のミーティング前に友人と楽しく食べました。',
      },
      {
        partId: 'q3',
        numberLabel: 'No. 3',
        questionType: 'social_topic_opinion',
        introAudioScript: 'Now, I will ask you a question about a social topic.',
        promptAudioScript:
          'Some people say that supermarkets should give bigger discounts on food that is close to its expiration date. What do you think about that?',
        showPromptOnScreenByDefault: false,
        prepSeconds: 10,
        recordSeconds: 35,
        maxScore: 5,
        rubricPoints: [
          '賛否を明確にし、消費者側のメリットと食品ロス削減などの根拠を2〜3文で述べているか',
        ],
        modelAnswer:
          'I think that is a very good idea. First, bigger discounts encourage shoppers to buy food that will be eaten right away, which directly reduces food waste. Second, it helps students and families save money on daily groceries.',
        modelTranslation:
          'それはとても良い考えだと思います。第一に、より大きな割引はすぐ食べる食品の購入を促し、食品ロスを直接減らします。第二に、学生や家庭が日々の食費を節約する助けになります。',
      },
      {
        partId: 'q4',
        numberLabel: 'No. 4',
        questionType: 'personal_opinion',
        promptAudioScript:
          'In Japan, more restaurants are using self-checkout machines instead of cashiers. Do you think this trend will continue to grow in the future? Yes or No — Why?',
        showPromptOnScreenByDefault: false,
        prepSeconds: 10,
        recordSeconds: 35,
        maxScore: 5,
        rubricPoints: [
          'Yes / No と理由（人手不足の解消・待ち時間短縮、または高齢者への配慮など）を論理的に述べているか',
        ],
        modelAnswer:
          'Yes, I think it will continue to grow. Many restaurants face a shortage of workers, and self-checkout machines allow staff to focus on cooking and cleaning. Also, customers can pay quickly using smartphones or cards without waiting.',
        modelTranslation:
          'はい、今後も増え続けると思います。多くの飲食店は人手不足に直面しており、セルフレジがあればスタッフは調理や清掃に集中できます。また、客もスマートフォンやカードで待たずに素早く支払えます。',
      },
    ],
  },

  // ==========================================================================
  // 英検準2級プラス（新設級）オリジナル模擬 Set 1
  // ==========================================================================
  {
    id: 'scbt_pre2plus_set01',
    origin: 'manatobi-original',
    grade: 'eiken_pre2plus',
    setNumber: 1,
    title: '準2級プラス S-CBT模擬 第1回：駅のシェア傘スタンドと忘れ物対策',
    themeSummaryJp: '急な雨の日に駅で借りて後日返せるシェア傘制度とプラスチック削減',
    cardTitle: 'Shared Umbrellas at Train Stations',
    passage:
      'On rainy evenings, many commuters buy cheap plastic umbrellas at convenience stores near train stations. As a result, thousands of forgotten umbrellas collect at lost-and-found offices every month. Recently, several railway companies have placed shared umbrella stands at station exits. Passengers can borrow an umbrella with a train card and return it at another station the next day.',
    passageTranslation:
      '雨の夕方、多くの通勤・通学客が駅近くのコンビニで安価なビニール傘を買います。その結果、毎月何千本もの忘れられた傘が遺失物取扱所に集まります。最近、いくつかの鉄道会社が駅の出口にシェア傘スタンドを設置しました。乗客は交通系ICカードで傘を借り、翌日に別の駅へ返却することができます。',
    silentReadSeconds: 20,
    readAloudSeconds: 45,
    readAloudMaxScore: 5,
    illustrations: [
      {
        frameLabel: '1コマ目（昨日の夕方・駅改札前）',
        captionEn: 'Yesterday evening — Sudden Rain',
        sceneDescriptionJp:
          '部活帰りの陽菜（Hina）が駅を出ようとしたら急な雨が降っており、改札横の「Shared Umbrella」スタンドを見つけた場面。',
        svgType: 'station_umbrella',
        frameIndex: 0,
      },
      {
        frameLabel: '2コマ目（帰宅途中・雨の歩道）',
        captionEn: 'On the way home — Staying Dry',
        sceneDescriptionJp:
          '交通系ICカードで傘を借りた陽菜が、バッグの教科書を濡らさずに歩いて帰宅している場面。',
        svgType: 'station_umbrella',
        frameIndex: 1,
      },
      {
        frameLabel: '3コマ目（今朝・学校最寄り駅）',
        captionEn: 'This morning — Easy Return',
        sceneDescriptionJp:
          '晴れた翌朝、学校の最寄り駅のスタンドへ傘を差し込んで簡単に返却している場面。',
        svgType: 'station_umbrella',
        frameIndex: 2,
      },
    ],
    questions: [
      {
        partId: 'q1',
        numberLabel: 'No. 1',
        questionType: 'passage_comprehension',
        promptAudioScript:
          'According to the passage, why do thousands of forgotten umbrellas collect at lost-and-found offices every month?',
        showPromptOnScreenByDefault: false,
        prepSeconds: 5,
        recordSeconds: 25,
        maxScore: 5,
        rubricPoints: [
          'Because many commuters buy cheap plastic umbrellas (at convenience stores on rainy evenings). と因果関係を正しく答えられているか',
        ],
        modelAnswer:
          'Because many commuters buy cheap plastic umbrellas at convenience stores on rainy evenings.',
        modelTranslation:
          '雨の夕方に多くの通勤・通学客が駅近くのコンビニで安価なビニール傘を買うからです。',
      },
      {
        partId: 'q2',
        numberLabel: 'No. 2',
        questionType: 'picture_narration_3step',
        introAudioScript:
          'Now, please look at the picture and describe the situation. You have 20 seconds to prepare. Your story should begin with the sentence on the screen.',
        promptAudioScript:
          'Please begin your story with: Yesterday evening, Hina noticed that it was raining hard outside the station.',
        starterSentence:
          'Yesterday evening, Hina noticed that it was raining hard outside the station.',
        showPromptOnScreenByDefault: true,
        prepSeconds: 20,
        recordSeconds: 40,
        maxScore: 10,
        rubricPoints: [
          '急な雨でスタンドを発見→ICカードで借りて濡れずに帰宅→翌朝別の駅に返却、の流れを過去形で話せているか',
        ],
        modelAnswer:
          'Yesterday evening, Hina noticed that it was raining hard outside the station. She found a shared umbrella stand near the ticket gate and borrowed one with her train card. On the way home, she stayed dry and kept her textbooks safe. This morning, she easily returned the umbrella to the stand at the station near her school.',
        modelTranslation:
          '昨日の夕方、陽菜は駅の外で強い雨が降っていることに気づきました。彼女は改札近くでシェア傘スタンドを見つけ、交通系カードで1本借りました。帰り道、彼女は濡れずに教科書を守ることができました。今朝、彼女は学校の最寄り駅のスタンドへ簡単に傘を返しました。',
      },
      {
        partId: 'q3',
        numberLabel: 'No. 3',
        questionType: 'social_topic_opinion',
        introAudioScript: 'Now, I will ask you a question about daily life.',
        promptAudioScript:
          'Some people say that stores should charge extra money for disposable plastic forks and spoons. What do you think about that?',
        showPromptOnScreenByDefault: false,
        prepSeconds: 10,
        recordSeconds: 35,
        maxScore: 5,
        rubricPoints: [
          '賛成／反対の立場を示し、マイ箸の持参促進やゴミ削減（または外出時の不便さ）などの理由を2文以上で述べているか',
        ],
        modelAnswer:
          'I agree with that idea. Many people accept plastic spoons even when they eat lunch at home and throw them away unused. Charging a small fee will encourage customers to refuse unnecessary plastic items.',
        modelTranslation:
          '私はその考えに賛成です。多くの人は自宅で昼食を食べるときでさえプラスチックのスプーンを受け取り、使わずに捨ててしまいます。少額を有料化すれば、客が不要なプラスチック製品を断るきっかけになります。',
      },
      {
        partId: 'q4',
        numberLabel: 'No. 4',
        questionType: 'personal_opinion',
        promptAudioScript:
          'Do you check the weather forecast every morning before leaving home? Yes or No — Please tell me why.',
        showPromptOnScreenByDefault: false,
        prepSeconds: 10,
        recordSeconds: 30,
        maxScore: 5,
        rubricPoints: [
          'Yes / No に続けて具体的な行動（服装選び・自転車通学の判断・折りたたみ傘など）を話せているか',
        ],
        modelAnswer:
          'Yes, I check it on my smartphone every morning. I ride my bicycle to school, so I need to know if I should bring a raincoat or leave home ten minutes earlier.',
        modelTranslation:
          'はい、毎朝スマートフォンで確認しています。私は自転車で通学しているので、レインコートを持っていくべきか、いつもより10分早く家を出るべきか知る必要があるからです。',
      },
    ],
  },

  // ==========================================================================
  // 英検準2級プラス（新設級）オリジナル模擬 Set 2
  // ==========================================================================
  {
    id: 'scbt_pre2plus_set02',
    origin: 'manatobi-original',
    grade: 'eiken_pre2plus',
    setNumber: 2,
    title: '準2級プラス S-CBT模擬 第2回：高校と地域の共同農園プロジェクト',
    themeSummaryJp: '放課後のボランティア園芸活動を通じた世代間交流と地産地消',
    cardTitle: 'School and Neighborhood Garden Projects',
    passage:
      'In urban neighborhoods, children and teenagers rarely have a chance to grow vegetables by themselves. To change this situation, some high schools have created small rooftop or courtyard gardens with help from local farmers. Students water the plants between classes and learn how seasonal crops grow, while older volunteers enjoy sharing their farming skills with young people.',
    passageTranslation:
      '都市部の地域では、子どもや十代の若者が自分で野菜を育てる機会はめったにありません。この状況を変えるため、地域の農家の協力を得て屋上や中庭に小さな菜園を作った高校もあります。生徒は休み時間に水やりをして季節の作物の育ち方を学び、高齢のボランティアは若者に栽培技術を伝えることを楽しんでいます。',
    silentReadSeconds: 20,
    readAloudSeconds: 45,
    readAloudMaxScore: 5,
    illustrations: [
      {
        frameLabel: '1コマ目（5月・学校中庭の花壇）',
        captionEn: 'In May — Planting Seeds',
        sceneDescriptionJp:
          '健（Ken）たち生徒が、地域の農家のおじいさんからトマトの苗の植え方を教わっている場面。',
        svgType: 'community_garden',
        frameIndex: 0,
      },
      {
        frameLabel: '2コマ目（7月・放課後の水やり）',
        captionEn: 'In July — Watering Every Day',
        sceneDescriptionJp:
          '暑い夏の放課後、部活前に健と友人が交代で大きく育ったトマトに水をやっている場面。',
        svgType: 'community_garden',
        frameIndex: 1,
      },
      {
        frameLabel: '3コマ目（8月・調理室での試食会）',
        captionEn: 'In August — Fresh Salad Party',
        sceneDescriptionJp:
          '収穫した新鮮なトマトでサラダを作り、教えてくれた農家さんを招いて一緒に食べている場面。',
        svgType: 'community_garden',
        frameIndex: 2,
      },
    ],
    questions: [
      {
        partId: 'q1',
        numberLabel: 'No. 1',
        questionType: 'passage_comprehension',
        promptAudioScript:
          'According to the passage, how have some high schools created small rooftop or courtyard gardens?',
        showPromptOnScreenByDefault: false,
        prepSeconds: 5,
        recordSeconds: 25,
        maxScore: 5,
        rubricPoints: [
          'With help from local farmers. / They have created them with help from local farmers. と正確に答えられているか',
        ],
        modelAnswer: 'They have created them with help from local farmers.',
        modelTranslation: '地域の農家の協力を得て作りました。',
      },
      {
        partId: 'q2',
        numberLabel: 'No. 2',
        questionType: 'picture_narration_3step',
        introAudioScript:
          'Now, please look at the picture and describe the situation. You have 20 seconds to prepare. Your story should begin with the sentence on the screen.',
        promptAudioScript:
          'Please begin your story with: In May, Ken and his classmates learned how to plant tomato seedlings from a local farmer.',
        starterSentence:
          'In May, Ken and his classmates learned how to plant tomato seedlings from a local farmer.',
        showPromptOnScreenByDefault: true,
        prepSeconds: 20,
        recordSeconds: 40,
        maxScore: 10,
        rubricPoints: [
          '5月に苗植え→7月に毎日水やり→8月に収穫して農家さんとサラダを食べた、の3段階を過去形で語れているか',
        ],
        modelAnswer:
          'In May, Ken and his classmates learned how to plant tomato seedlings from a local farmer. In July, Ken and his friend took turns watering the plants every day after classes. In August, they harvested many fresh tomatoes, made salad in the cooking room, and enjoyed eating it together with the farmer.',
        modelTranslation:
          '5月、健とクラスメートは地域の農家からトマトの苗の植え方を学びました。7月、健と友人は放課後に毎日交代で水やりをしました。8月、彼らはたくさんの新鮮なトマトを収穫し、調理室でサラダを作って農家の方と一緒に楽しく食べました。',
      },
      {
        partId: 'q3',
        numberLabel: 'No. 3',
        questionType: 'social_topic_opinion',
        introAudioScript: 'Now, I will ask you a question about education.',
        promptAudioScript:
          'Some people say that high school students should have more classes about cooking and nutrition. What do you think about that?',
        showPromptOnScreenByDefault: false,
        prepSeconds: 10,
        recordSeconds: 35,
        maxScore: 5,
        rubricPoints: [
          '賛否と具体的な理由（一人暮らしへの備え・スポーツや勉強のための体調管理など）を2文以上で述べているか',
        ],
        modelAnswer:
          'I agree with that opinion. Many students will live alone when they enter university, so basic cooking skills are essential. Also, understanding nutrition helps teenage athletes stay strong and avoid getting tired.',
        modelTranslation:
          '私はその意見に賛成です。多くの生徒は大学進学時に一人暮らしをするため、基本的な料理技術は不可欠です。また、栄養を理解することは十代の運動部生が体を強く保ち疲労を防ぐのにも役立ちます。',
      },
      {
        partId: 'q4',
        numberLabel: 'No. 4',
        questionType: 'personal_opinion',
        promptAudioScript:
          'Would you like to join a volunteer activity in your town in the future? Yes or No — Please tell me why.',
        showPromptOnScreenByDefault: false,
        prepSeconds: 10,
        recordSeconds: 30,
        maxScore: 5,
        rubricPoints: [
          'Yes / No の後に、やってみたい活動（子ども向けスポーツ教室・清掃など）や理由を明確に述べているか',
        ],
        modelAnswer:
          'Yes, I would like to join one. I play soccer in my school club, so I want to help teach soccer to elementary school children in my town. Meeting people of different ages will also give me new perspectives.',
        modelTranslation:
          'はい、参加してみたいです。私は学校の部活でサッカーをしているので、町の小学生にサッカーを教える手伝いをしたいです。さまざまな年代の人と出会うことで新しい視点も得られると思います。',
      },
    ],
  },

  // ==========================================================================
  // 英検準2級 オリジナル模擬 Set 1
  // ==========================================================================
  {
    id: 'scbt_pre2_set01',
    origin: 'manatobi-original',
    grade: 'eiken_pre2',
    setNumber: 1,
    title: '準2級 S-CBT模擬 第1回：地域の自転車レーンと安全マナー',
    themeSummaryJp: '通学・買い物で増える自転車利用と、色分け自転車レーンの整備',
    cardTitle: 'Safer Cycling Lanes in Towns',
    passage:
      'Many people ride bicycles to go to school or local shops because cycling is healthy and good for the environment. However, narrow streets can be dangerous when bicycles and cars use the same space. Recently, more towns are painting blue lanes on roads so riders know where to go safely.',
    passageTranslation:
      '自転車は健康的で環境にも良いため、多くの人が通学や近所の店への買い物に自転車を使います。しかし、狭い道路で自転車と車が同じ場所を通ると危険なことがあります。最近では、自転車に乗る人が安全に走る場所がわかるよう、道路に青いレーンを塗る町が増えています。',
    silentReadSeconds: 20,
    readAloudSeconds: 40,
    readAloudMaxScore: 5,
    illustrations: [
      {
        frameLabel: '場面イラスト：公園前の駐輪スペースと歩道',
        captionEn: 'At the Park Entrance',
        sceneDescriptionJp:
          '公園入口の場面：①自転車のタイヤに空気を入れている少年、②ベンチで地図を広げている2人の女性、③案内板を拭いている係員、④水筒をベンチ横のバッグに入れようとしている少女、⑤かごがいっぱいで荷物を手に持って困っている男性。',
        svgType: 'cycling_park',
        frameIndex: 0,
      },
    ],
    questions: [
      {
        partId: 'q1',
        numberLabel: 'No. 1',
        questionType: 'passage_comprehension',
        promptAudioScript:
          'According to the passage, why are more towns painting blue lanes on roads?',
        showPromptOnScreenByDefault: false,
        prepSeconds: 5,
        recordSeconds: 20,
        maxScore: 5,
        rubricPoints: [
          'So riders / cyclists know where to go safely. を正しく応答できているか',
        ],
        modelAnswer: 'So riders know where to go safely.',
        modelTranslation: '自転車に乗る人が安全に走る場所がわかるようにするためです。',
      },
      {
        partId: 'q2',
        numberLabel: 'No. 2',
        questionType: 'picture_action_state',
        introAudioScript:
          'Now, please look at the people in Picture A. They are doing different things. Tell me as much as you can about what they are doing.',
        promptAudioScript:
          'Please describe what the people in the picture are doing using present progressive sentences.',
        showPromptOnScreenByDefault: true,
        prepSeconds: 10,
        recordSeconds: 30,
        maxScore: 5,
        rubricPoints: [
          '現在進行形（is / are + ~ing）を使って3つ以上の人物の動作を描写できているか',
        ],
        modelAnswer:
          'A boy is pumping air into his bicycle tire. Two women are looking at a map on a bench. A staff member is cleaning a sign, and a girl is putting a bottle into her bag.',
        modelTranslation:
          '少年が自転車のタイヤに空気を入れています。2人の女性がベンチで地図を見ています。係員が案内板を拭いていて、少女がバッグにボトルを入れています。',
      },
      {
        partId: 'q3',
        numberLabel: 'No. 3',
        questionType: 'picture_action_state',
        introAudioScript: 'Now, look at the man standing near the bicycle rack.',
        promptAudioScript:
          'Please describe the situation of the man near the bicycle rack and what he is thinking of doing.',
        showPromptOnScreenByDefault: true,
        prepSeconds: 10,
        recordSeconds: 25,
        maxScore: 5,
        rubricPoints: [
          '状況の原因（かごがいっぱいで袋が入らない等）を because や so を使って2文程度で説明できているか',
        ],
        modelAnswer:
          'He wants to put his shopping bag into his bicycle basket, because it is heavy. However, his basket is already full, so he cannot put it inside.',
        modelTranslation:
          '彼は買い物袋が重いので自転車のかごに入れたいと思っています。しかし、かごがすでにいっぱいなので中に入れられません。',
      },
      {
        partId: 'q4',
        numberLabel: 'No. 4',
        questionType: 'personal_opinion',
        promptAudioScript:
          'Do you think high school students should take a traffic safety class every year? Yes or No — Please tell me why.',
        showPromptOnScreenByDefault: false,
        prepSeconds: 10,
        recordSeconds: 30,
        maxScore: 10,
        rubricPoints: [
          'Yes / No の後に理由を2文以上で具体的に説明できているか',
        ],
        modelAnswer:
          'Yes, I think so. Many high school students ride bicycles to school every morning when roads are busy. Learning traffic rules every year helps them avoid accidents and stay safe.',
        modelTranslation:
          'はい、そう思います。多くの高校生は道路が混雑する毎朝、自転車で通学しています。毎年交通ルールを学ぶことは、事故を避けて安全を守るのに役立ちます。',
      },
    ],
  },

  // ==========================================================================
  // 英検準2級 オリジナル模擬 Set 2
  // ==========================================================================
  {
    id: 'scbt_pre2_set02',
    origin: 'manatobi-original',
    grade: 'eiken_pre2',
    setNumber: 2,
    title: '準2級 S-CBT模擬 第2回：学校図書館の朝開館と読書習慣',
    themeSummaryJp: '始業前の学校図書館開放と、静かな環境での朝学習メリット',
    cardTitle: 'Morning Hours at School Libraries',
    passage:
      'School libraries are usually busy after classes, but some students cannot stay late because of club practice. For these students, several schools have started opening their libraries thirty minutes before morning homeroom. Students can borrow books easily and review their lessons in a quiet room before class begins.',
    passageTranslation:
      '学校の図書館はたいてい放課後に混雑しますが、部活動の練習があるため遅くまで残れない生徒もいます。こうした生徒のために、朝のホームルームの30分前から図書館を開け始めた学校もあります。生徒は授業が始まる前に、気軽に本を借りたり静かな部屋で予習・復習をしたりできます。',
    silentReadSeconds: 20,
    readAloudSeconds: 40,
    readAloudMaxScore: 5,
    illustrations: [
      {
        frameLabel: '場面イラスト：朝の学校図書室',
        captionEn: 'In the School Library',
        sceneDescriptionJp:
          '朝の図書室の場面：①カウンターで本を返却している男子生徒、②本棚に本を戻している図書委員、③窓際でノートに単語を書いている女子生徒、④パソコンで本を検索している生徒、⑤高い棚の本に手が届かず困っている生徒。',
        svgType: 'morning_library',
        frameIndex: 0,
      },
    ],
    questions: [
      {
        partId: 'q1',
        numberLabel: 'No. 1',
        questionType: 'passage_comprehension',
        promptAudioScript:
          'According to the passage, why can some students not stay late at school libraries after classes?',
        showPromptOnScreenByDefault: false,
        prepSeconds: 5,
        recordSeconds: 20,
        maxScore: 5,
        rubricPoints: [
          'Because of club practice. / Because they have club practice. と簡潔・正確に答えられているか',
        ],
        modelAnswer: 'Because they have club practice after classes.',
        modelTranslation: '放課後に部活動の練習があるからです。',
      },
      {
        partId: 'q2',
        numberLabel: 'No. 2',
        questionType: 'picture_action_state',
        introAudioScript:
          'Now, please look at the people in the library picture. Tell me as much as you can about what they are doing.',
        promptAudioScript:
          'Please describe what the people in the library are doing.',
        showPromptOnScreenByDefault: true,
        prepSeconds: 10,
        recordSeconds: 30,
        maxScore: 5,
        rubricPoints: [
          'is returning / is putting / is writing / is searching など現在進行形で正確に描写できているか',
        ],
        modelAnswer:
          'A boy is returning a book at the counter. A student is putting books on a shelf. A girl near the window is writing in her notebook, and another student is searching for a book on a computer.',
        modelTranslation:
          '男子生徒がカウンターで本を返しています。生徒が棚に本を戻しています。窓際の女子生徒がノートに書き物をし、別の生徒がパソコンで本を探しています。',
      },
      {
        partId: 'q3',
        numberLabel: 'No. 3',
        questionType: 'picture_action_state',
        introAudioScript: 'Now, look at the student standing in front of the tall bookshelf.',
        promptAudioScript:
          'Please describe the situation of the student in front of the tall bookshelf.',
        showPromptOnScreenByDefault: true,
        prepSeconds: 10,
        recordSeconds: 25,
        maxScore: 5,
        rubricPoints: [
          '高い棚の本を取りたいが手が届かない（cannot reach the book because the shelf is too high）状況を説明できているか',
        ],
        modelAnswer:
          'She wants to take a dictionary from the top shelf, but she cannot reach it because the shelf is too high.',
        modelTranslation:
          '彼女は一番上の棚から辞書を取りたいと思っていますが、棚が高すぎるため手が届きません。',
      },
      {
        partId: 'q4',
        numberLabel: 'No. 4',
        questionType: 'personal_opinion',
        promptAudioScript:
          'Do you prefer reading paper books or reading books on a tablet or smartphone? Please tell me which you prefer and why.',
        showPromptOnScreenByDefault: false,
        prepSeconds: 10,
        recordSeconds: 30,
        maxScore: 10,
        rubricPoints: [
          'I prefer paper books / reading on a tablet と選択を明示し、理由を2文以上で述べているか',
        ],
        modelAnswer:
          'I prefer reading paper books. When I study for a long time, paper pages are easier on my eyes than a bright screen. Also, I can easily remember where important information is written on the page.',
        modelTranslation:
          '私は紙の本を読む方が好きです。長時間勉強するとき、明るい画面よりも紙のページの方が目に優しいからです。また、ページのどのあたりに大事な情報が書いてあったかも覚えやすいです。',
      },
    ],
  },
];

for (const set of SCBT_SPEAKING_SETS) {
  validateSpeakingSet(set);
}

export function findSpeakingSetById(setId: string): ScbtSpeakingSet | undefined {
  return SCBT_SPEAKING_SETS.find(s => s.id === setId);
}

export function speakingSetsForGrade(grade: string): ScbtSpeakingSet[] {
  const exact = SCBT_SPEAKING_SETS.filter(s => s.grade === grade);
  if (exact.length > 0) return exact;
  return [...SCBT_SPEAKING_SETS];
}
