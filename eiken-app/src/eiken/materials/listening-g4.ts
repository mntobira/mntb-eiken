import {
  buildExamRound,
  buildSupportImageSpec,
  makeDialogueUnit,
  makeQuestionItem,
  speakerPairFor,
} from './listening-helpers';
import type { DialogueTurn, ListeningAudioUnit, ListeningExamRound } from '../listeningExamCore';

/**
 * 英検4級 リスニング予想問題 全15回
 * 各回30問＝第1部10問（応答・3肢読上・2回読・補助図版10枚）＋第2部10問（会話・4肢印刷・2回読）＋第3部10問（文・4肢印刷・2回読）
 * 合計：450問・450音源・150図版プロンプト（完全独自作成・過去問流用なし）
 */

const M_NAMES = ['Kaito', 'Haruto', 'Sota', 'Ren', 'Yuma', 'Takumi', 'Riku', 'Hayato', 'Kota', 'Shun', 'Daiki', 'Toma', 'Asahi', 'itsuki', 'Minato'].map(s => s[0].toUpperCase() + s.slice(1));
const F_NAMES = ['Hina', 'Yuna', 'Mio', 'Sakura', 'Aoi', 'Riko', 'Mei', 'Koharu', 'Natsuki', 'Kana', 'Saki', 'Emi', 'Honoka', 'Miyu', 'Rin'];

const PART1_OPENERS = [
  'Excuse me', 'Hi', 'Good morning', 'Hey', 'Hello',
  'Pardon me', 'Listen', 'Oh hi', 'Good afternoon', 'Say',
  'Wait', 'Look', 'By the way', 'Welcome', 'Oh look',
] as const;

function buildG4Part1(examId: string, round: number, u: number): ListeningAudioUnit {
  const [sp1, sp2] = speakerPairFor(round, u);
  const m = M_NAMES[(round + u) % 15];
  const f = F_NAMES[(round * 2 + u) % 15];
  const targetAnswer = (round + u) % 3;
  const opener = PART1_OPENERS[(round + u - 2) % 15];
  const audioId = `${examId}_part1_${String(u).padStart(2, '0')}`;

  const templates = [
    // u=1: 依頼に対する応答（Would you mind / Could you）
    () => {
      const actions = [
        ['carry this box to the art room', '美術室までこの箱を運ぶ', 'a hallway with cardboard boxes', '学校の廊下で箱を持っている'],
        ['hold the gym door open', '体育館のドアを開けておく', 'outside a school gym entrance', '体育館の入口前で荷物を持っている'],
        ['turn down the radio volume', 'ラジオの音量を下げる', 'a living room with a small radio', 'ラジオのある居間で本を開いている'],
        ['lend me your green highlighter', '緑の蛍光ペンを貸す', 'two desks in a classroom', '教室の机でノートを見ている'],
        ['pass me the salt shaker', '塩の容器を取る', 'a family dining table', '食卓でスープ皿の前に座っている'],
        ['show me the way to Gate Three', '3番ゲートへの道を教える', 'a station concourse', '駅のコンコースで切符を持っている'],
        ['help me hang this wall map', 'この壁地図を掛けるのを手伝う', 'a classroom wall', '教室の壁の前で大きな白地図を持っている'],
        ['take a photo of us here', 'ここで私たちの写真を撮る', 'a park flowerbed', '公園の花壇の前でカメラを差し出している'],
        ['close the back curtain', '後ろのカーテンを閉める', 'a sunny classroom window', '日差しの入る教室の窓際に立っている'],
        ['wait five minutes at the bench', 'ベンチで5分待つ', 'a park bench near a fountain', '噴水近くのベンチのそばに立っている'],
        ['move your bicycle a little', '自転車を少し動かす', 'a bicycle parking area', '駐輪場で自転車の横に立っている'],
        ['read this sentence aloud', 'この文を声に出して読む', 'an English classroom', '英語教室で開いた本を指さしている'],
        ['put these balls in the basket', 'ボールをかごに入れる', 'a school gym floor', '体育館の床でボールとかごのそばにいる'],
        ['share your umbrella to the bus stop', 'バス停まで傘に一緒に入る', 'a school entrance in light rain', '小雨の昇降口で傘を差している'],
        ['watch my suitcase for a moment', '少しの間スーツケースを見ておく', 'a waiting room with benches', '待合室のベンチ横でスーツケースのそばにいる'],
      ];
      const [actEn, actJa, placeEn, summaryJa] = actions[round - 1];
      return {
        placeEn,
        propsEn: 'simple indoor or outdoor fixtures matching the scene',
        actionEn: 'talking politely while gesturing',
        summaryJa,
        line1: `${opener}, ${f}. My hands are full right now.`,
        line2: `Oh, I see, ${m}. Could you tell me what you need? Wait—do you want me to ${actEn}?`,
        ja1: `${f}、いま両手がふさがっているんだ。`,
        ja2: `あら本当ね、${m}。${actJa}のを手伝おうか？`,
        correct: 'Yes, please. That would really help me.',
        correctReason: `手伝いの申し出に対して Yes, please. と丁寧に頼み、感謝を添えている。`,
        wrongs: ['No, it started twenty minutes ago.', 'I went there with my uncle.'] as [string, string],
        wrongReasons: [
          '20分前に始まったという時間の話をしており、手伝いの申し出への返答ではない。',
          '叔父と行ったという過去の外出の話で、今の依頼場面とかみ合わない。',
        ] as [string, string],
        explanation: `Do you want me to ...? の申し出に対して Yes, please. で受ける応答を選ぶ。`,
        evidence: `do you want me to ${actEn}`,
        skill: '依頼',
      };
    },
    // u=2: 過去の感想（How was ...?）
    () => {
      const trips = [
        ['your camping trip in Nagano', '長野でのキャンプ旅行', 'It was exciting, and we saw bright stars.', '楽しくて明るい星が見られた'],
        ['the new dinosaur movie yesterday', '昨日の恐竜映画', 'It was scary at first, but very interesting.', '最初は怖かったがとても面白かった'],
        ['your cousin\'s wedding party', 'いとこの結婚パーティー', 'It was wonderful, and the food was delicious.', '素敵で料理もおいしかった'],
        ['the school marathon this morning', '今朝の校内マラソン', 'It was hard, but I finished the whole course.', 'きつかったが最後まで走りきった'],
        ['your first pottery lesson', '初めての陶芸レッスン', 'It was fun! I made a small soup bowl.', '楽しくて小さなスープ皿を作った'],
        ['the summer fireworks festival', '夏の花火大会', 'It was amazing! Thousands of people watched it.', '素晴らしくて大勢の人が見ていた'],
        ['the brass band concert', '吹奏楽部のコンサート', 'It was great! Everyone clapped loudly.', '素晴らしくてみんな大きな拍手をした'],
        ['your weekend stay at the farm', '週末の農場体験', 'It was great! I fed cute baby goats.', '良くてかわいい子ヤギにえさをあげた'],
        ['the history quiz competition', '歴史クイズ大会', 'It was difficult, yet our team won second prize.', '難しかったがチームで2位になった'],
        ['your dental checkup yesterday', '昨日の歯科検診', 'It was quick, and my teeth were all healthy.', 'すぐ終わり歯もすべて健康だった'],
        ['the new pancake cafe near station', '駅前の新しいパンケーキカフェ', 'It was nice, though the line was quite long.', '列は長かったが素敵だった'],
        ['your boat ride on the lake', '湖でのボート遊び', 'It was peaceful, and the wind felt cool.', '穏やかで風が涼しかった'],
        ['the science fair at city hall', '市役所の科学フェア', 'It was fantastic! I tried a small robot.', '素晴らしくて小型ロボットを試した'],
        ['your tennis match last Sunday', '先週日曜のテニスの試合', 'It was close, and I learned a lot.', '接戦でたくさんのことを学んだ'],
        ['the autumn leaf hike', '紅葉ハイキング', 'It was beautiful! The mountain looked bright red.', '美しくて山が真っ赤に見えた'],
      ];
      const [evEn, evJa, ansEn, ansJa] = trips[round - 1];
      return {
        placeEn: 'a school courtyard with a bench',
        propsEn: 'a wooden bench and two backpacks',
        actionEn: 'chatting happily face to face',
        summaryJa: '中庭のベンチ近くで思い出話をしている場面',
        line1: `Hi ${m}, I heard about ${evEn}.`,
        line2: `Really, ${f}? Well, how was ${evEn.replace('your ', 'the ')}?`,
        ja1: `ねえ${m}、${evJa}のことを聞いたよ。`,
        ja2: `本当？それで、その${evJa}はどうだった？`,
        correct: ansEn,
        correctReason: `How was ...? で感想を尋ねられ、「${ansJa}」と具体的な様子を答えている。`,
        wrongs: ['For three days next month.', 'By express train from Tokyo.'] as [string, string],
        wrongReasons: [
          '来月の期間を述べており、過去の出来事の感想を尋ねる How was ...? と合わない。',
          '交通手段を答えており、どうだったかという感想への返答になっていない。',
        ] as [string, string],
        explanation: `過去の出来事の感想を尋ねる How was ...? には It was ＋形容詞 で答える。`,
        evidence: 'how was',
        skill: '経験',
      };
    },
    // u=3: 比較・選択（Which do you like better, A or B?）
    () => {
      const choices = [
        ['hot tea', 'iced coffee', 'Hot tea, especially on cold mornings.', '温かいお茶とアイスコーヒー', '寒い朝は特に温かいお茶'],
        ['mountain hiking', 'swimming in the sea', 'Mountain hiking, because I love forest air.', '山登りと海水浴', '森の空気が好きなので山登り'],
        ['reading mystery novels', 'watching action movies', 'Mystery novels. I read one every week.', '推理小説とアクション映画', '毎週読むほど推理小説'],
        ['playing doubles', 'playing singles in tennis', 'Doubles, because teamwork is exciting.', 'ダブルスとシングルス', 'チームワークが楽しいのでダブルス'],
        ['plain yogurt', 'strawberry yogurt', 'Strawberry yogurt. I eat it every morning.', 'プレーンといちごヨーグルト', '毎朝食べるいちごヨーグルト'],
        ['traveling by train', 'traveling by airplane', 'By train, because I enjoy watching towns pass by.', '電車の旅と飛行機の旅', '景色が見えるので電車'],
        ['dogs', 'cats as family pets', 'Dogs, because we can walk together in the park.', '犬と猫', '一緒に公園を歩けるので犬'],
        ['summer vacation', 'winter vacation', 'Winter vacation! I love skiing with my cousins.', '夏休みと冬休み', 'スキーができる冬休み'],
        ['watercolor paint', 'colored pencils', 'Colored pencils. They are easy to carry.', '水彩絵の具と色鉛筆', '持ち運びやすい色鉛筆'],
        ['rice', 'bread for breakfast', 'Rice, with warm miso soup.', '朝食のご飯とパン', '温かいみそ汁と一緒のご飯'],
        ['studying in the library', 'studying in your room', 'In the library, because it is very quiet.', '図書館での勉強と自分の部屋', 'とても静かなので図書館'],
        ['playing the guitar', 'playing the keyboard', 'The keyboard. I started lessons last year.', 'ギターとキーボード', '去年習い始めたキーボード'],
        ['window seats', 'aisle seats on a bus', 'Window seats! I like looking outside.', '窓側席と通路側席', '外を見るのが好きなので窓側席'],
        ['curry with pork', 'curry with chicken', 'Chicken curry. My mother makes it often.', 'ポークカレーとチキンカレー', '母がよく作るチキンカレー'],
        ['paper books', 'tablet books', 'Paper books. They are gentle on my eyes.', '紙の本とタブレットの本', '目に優しい紙の本'],
      ];
      const [optA, optB, ansEn, pairJa, ansJa] = choices[round - 1];
      return {
        placeEn: 'a school cafeteria table',
        propsEn: 'a lunch table and two chairs',
        actionEn: 'talking casually across the table',
        summaryJa: '食堂のテーブルを挟んで2人が話している場面',
        line1: `I cannot decide today, ${f}.`,
        line2: `Tell me, ${m}. Which do you prefer, ${optA} or ${optB}?`,
        ja1: `今日は決められないなあ、${f}。`,
        ja2: `教えて、${m}。${pairJa}ではどちらが好き？`,
        correct: ansEn,
        correctReason: `Which do you prefer, A or B? の選択疑問文に対し「${ansJa}」と一方を選んで理由を添えている。`,
        wrongs: ['Yes, I bought both of them.', 'At seven thirty tonight.'] as [string, string],
        wrongReasons: [
          'Which の選択疑問文には Yes / No では答えられない。',
          '今夜の時刻を答えており、どちらが好きかという質問と無関係。',
        ] as [string, string],
        explanation: `Which do you prefer, A or B? には Yes/No を使わず具体的な一方を答える。`,
        evidence: 'Which do you prefer',
        skill: '比較',
      };
    },
    // u=4: 理由を尋ねる（Why ...?）
    () => {
      const reasons = [
        ['running to the station', 'I do not want to miss the eight ten train.', '駅へ走っている', '8時10分の電車に乗り遅れたくないから'],
        ['carrying two big bags', 'I brought costumes for our drama club.', '大きな袋を2つ持っている', '演劇部の衣装を持ってきたから'],
        ['going home early today', 'I have a dentist appointment at four.', '今日早く帰る', '4時に歯医者の予約があるから'],
        ['wearing your gym uniform', 'We will clean the sports warehouse next.', '体操服を着ている', '次に体育倉庫を掃除するから'],
        ['looking under the desk', 'I dropped my silver mechanical pencil.', '机の下を見ている', '銀色のシャープペンを落としたから'],
        ['buying three bouquets', 'Our coach is retiring this Friday.', '花束を3つ買っている', '今週金曜にコーチが引退するから'],
        ['staying in the classroom', 'I am waiting for my younger brother.', '教室に残っている', '弟を待っているから'],
        ['practicing pronunciation', 'I will join a speech contest next month.', '発音練習をしている', '来月スピーチ大会に出るから'],
        ['checking the weather map', 'Our soccer team has an outdoor game tomorrow.', '天気図を見ている', '明日サッカー部の屋外試合があるから'],
        ['bringing an extra towel', 'It is very hot and humid today.', '予備のタオルを持ってきた', '今日とても蒸し暑いから'],
        ['closing the shop window', 'Strong wind is blowing dust inside.', '店の窓を閉めている', '強い風でほこりが入るから'],
        ['smiling so happily', 'My painting won a gold ribbon!', 'とても嬉しそうに笑っている', '自分の絵が金賞を取ったから'],
        ['taking the elevator', 'My left ankle hurts a little today.', 'エレベーターに乗る', '今日左足首が少し痛むから'],
        ['writing down this recipe', 'I want to bake lemon cake for Mom.', 'レシピを書き写している', '母にレモンケーキを焼きたいから'],
        ['getting off one stop early', 'I need to stop by the post office.', '1駅手前で降りる', '郵便局に寄る必要があるから'],
      ];
      const [actEn, ansEn, actJa, ansJa] = reasons[round - 1];
      return {
        placeEn: 'near a school shoe locker entrance',
        propsEn: 'shoe lockers and an entrance mat',
        actionEn: 'turning back while speaking',
        summaryJa: '昇降口付近で声をかけている場面',
        line1: `Wait a second, ${m}! You look busy.`,
        line2: `Why are you ${actEn}?`,
        ja1: `ちょっと待って、${m}！忙しそうね。`,
        ja2: `どうして${actJa}の？`,
        correct: `Because ${ansEn[0].toLowerCase()}${ansEn.slice(1)}`,
        correctReason: `Why are you ...? と理由を尋ねられ、Because 以下で「${ansJa}」と明確な理由を述べている。`,
        wrongs: ['Since last Wednesday.', 'About fifteen minutes on foot.'] as [string, string],
        wrongReasons: [
          'いつからかを述べており、理由を尋ねる Why ...? への回答になっていない。',
          '徒歩の所要時間を答えており、理由の質問とかみ合わない。',
        ] as [string, string],
        explanation: `Why ...? に対して Because ＋理由 で答える基本パターン。`,
        evidence: `Why are you ${actEn}`,
        skill: '理由',
      };
    },
    // u=5: 期間・長さを尋ねる（How long ...?）
    () => {
      const durations = [
        ['bake these butter cookies', 'About fifteen minutes in the oven.', 'このバタークッキーを焼くのに', 'オーブンで約15分'],
        ['walk from here to the castle', 'Around twenty minutes along the river.', 'ここから城まで歩くのに', '川沿いに約20分'],
        ['stay at your grandparents\' house', 'For four days until Tuesday.', '祖父母の家に滞在するのは', '火曜日まで4日間'],
        ['practice the violin every evening', 'For forty minutes after homework.', '毎晩バイオリンを練習するのは', '宿題のあとに40分間'],
        ['fly from Osaka to Sapporo', 'About two hours by plane.', '大阪から札幌へ飛ぶのに', '飛行機で約2時間'],
        ['charge this tablet battery', 'About one hour to make it full.', 'タブレットを充電するのに', '満充電まで約1時間'],
        ['boil these udon noodles', 'Ten minutes in hot water.', 'このうどんをゆでるのに', 'お湯で10分間'],
        ['finish reading that thick novel', 'It took me almost two weeks.', 'その厚い小説を読み終えるのに', 'ほぼ2週間かかった'],
        ['ride the ferry to the island', 'Thirty-five minutes each way.', '島までフェリーに乗るのに', '片道35分'],
        ['keep this library magazine', 'You can borrow it for one week.', 'この図書館の雑誌を借りられるのは', '1週間借りられる'],
        ['wait for the planetarium show', 'Only ten more minutes.', 'プラネタリウム上映を待つのは', 'あと10分だけ'],
        ['dry these wet sneakers', 'Leave them outside for five hours.', '濡れたスニーカーを乾かすのに', '外に5時間置く'],
        ['clean the swimming pool', 'Our team worked for three hours.', 'プール掃除をするのに', 'チームで3時間作業した'],
        ['take the express bus to Kyoto', 'Fifty minutes from this terminal.', '京都行きの急行バスに乗るのに', 'このターミナルから50分'],
        ['prepare the cultural festival booth', 'We spent six days after school.', '文化祭の展示準備をするのに', '放課後に6日間かけた'],
      ];
      const [topicEn, ansEn, topicJa, ansJa] = durations[round - 1];
      return {
        placeEn: 'an information desk or classroom table',
        propsEn: 'a counter desk and a wall clock',
        actionEn: 'asking a question with a notebook',
        summaryJa: '机の前でメモを取りながら質問している場面',
        line1: `Excuse me, ${f}. I have one question.`,
        line2: `Sure, ${m}. Oh, do you know how long it takes to ${topicEn}?`,
        ja1: `すみません、${f}。1つ質問があるんだ。`,
        ja2: `いいわよ、${m}。あ、${topicJa}どのくらい時間がかかるか知っている？`,
        correct: ansEn,
        correctReason: `how long ...（どのくらいの時間・期間か）に対して「${ansJa}」と時間の長さを答えている。`,
        wrongs: ['Five hundred yen per person.', 'Next to the post office.'] as [string, string],
        wrongReasons: [
          '1人あたりの料金を答えており、所要時間の質問と合わない。',
          '場所を答えており、How long の質問への応答ではない。',
        ] as [string, string],
        explanation: `時間の長さを尋ねる how long ...? に対して分・時間・日数を答える応答を選ぶ。`,
        evidence: 'how long',
        skill: '時刻・順序',
      };
    },
    // u=6: 電話・不在応答（May I speak to ...?）
    () => {
      const calls = [
        ['Mr. Morita', 'walking the dog right now', '森田さん', 'ちょうど犬の散歩に出ている'],
        ['Coach Sato', 'in a meeting on the second floor', '佐藤コーチ', '2階で会議中'],
        ['Aunt Keiko', 'shopping at the supermarket', '恵子おばさん', 'スーパーで買い物中'],
        ['Dr. Hayashi', 'checking a patient in Room One', '林先生', '1番診察室で診察中'],
        ['Ms. Brown', 'teaching Class Three now', 'ブラウン先生', '3組で授業中'],
        ['Uncle Kenji', 'washing his car outside', '健二おじさん', '外で洗車中'],
        ['Manager Tanaka', 'talking on another phone line', '田中店長', '別の電話で通話中'],
        ['Grandpa', 'working in the vegetable garden', 'おじいちゃん', '家庭菜園で作業中'],
        ['Older sister Rika', 'taking a piano lesson until five', '姉のリカ', '5時までピアノレッスン中'],
        ['Mr. Yoshida', 'out for lunch until one o\'clock', '吉田さん', '1時まで昼食で外出中'],
        ['Ms. Kawai', 'picking up packages at the front desk', '河合さん', '受付で荷物を受け取り中'],
        ['Captain Haru', 'stretching on the tennis court', 'ハル部長', 'テニスコートで準備運動中'],
        ['Nurse Aoki', 'organizing medicine in the cabinet', '青木先生', '棚の薬を整理中'],
        ['Chef Yamada', 'checking fresh fish at the market', '山田シェフ', '市場で鮮魚を確認中'],
        ['Professor Ito', 'giving a talk in the main hall', '伊藤教授', '大ホールで講演中'],
      ];
      const [personEn, stateEn, personJa, stateJa] = calls[round - 1];
      return {
        placeEn: 'a room with a cordless telephone on a stand',
        propsEn: 'a small table, a phone handset, and a memo pad',
        actionEn: 'holding a telephone receiver to the ear',
        summaryJa: '電話の受話器を持って話している場面',
        line1: `Hello, this is ${m} calling on ${['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday', 'Monday morning', 'Tuesday evening', 'Wednesday noon', 'Thursday night', 'Friday morning', 'Saturday noon', 'Sunday night', 'holiday morning'][round - 1]}.`,
        line2: `Hello ${m}. Do you want to speak to ${personEn}?`,
        ja1: `もしもし、${m}ですが。`,
        ja2: `こんにちは、${m}。${personJa}と話したいのよね？`,
        correct: `Yes, please. If ${personEn} is ${stateEn}, could ${personEn} call me back?`,
        correctReason: `「${personJa}と話したいのよね？」という確認に Yes と応じ、折り返し電話の伝言を頼んでいる。`,
        wrongs: ['Wrong number, I bought a new bike.', 'It costs thirty yen per minute.'] as [string, string],
        wrongReasons: [
          '自転車を買った話がつながっており、電話の応答として意味をなさない。',
          '通話料金の話をしており、相手を呼び出す確認への返答ではない。',
        ] as [string, string],
        explanation: `電話で話したい相手を確認された場面で、Yes と肯定し伝言（call me back）を頼む応答を選ぶ（背景：${stateJa}）。`,
        evidence: `speak to ${personEn}`,
        skill: '依頼',
      };
    },
    // u=7: 謝罪に対する応答（I'm sorry ...）
    () => {
      const apologies = [
        ['forgot to bring your comic book today', '今日あなたの漫画を持ってくるのを忘れた'],
        ['kept you waiting for ten minutes', '10分間待たせてしまった'],
        ['stepped on your white shoe', '白い靴を踏んでしまった'],
        ['took your black pen by mistake', '間違えてあなたの黒いペンを持っていった'],
        ['spilled a little water on the desk', '机に少し水をこぼしてしまった'],
        ['missed your phone call last night', '昨夜あなたの電話に出られなかった'],
        ['sent the message to the wrong group', '別のグループにメッセージを送ってしまった'],
        ['ate the last chocolate cookie', '最後のチョコクッキーを食べてしまった'],
        ['arrived late for choir practice', '合唱の練習に遅れて着いた'],
        ['dropped your eraser on the floor', '消しゴムを床に落としてしまった'],
        ['mixed up our two folders', '2人のファイルを混ぜてしまった'],
        ['stood in front of your camera', 'カメラの前に立ってしまった'],
        ['forgot the club room key', '部室の鍵を忘れてしまった'],
        ['made a mistake on the scoreboard', '得点板の数字を間違えた'],
        ['left the dictionary in my locker', '辞書をロッカーに置いてきてしまった'],
      ];
      const [errEn, errJa] = apologies[round - 1];
      return {
        placeEn: 'a classroom between desks',
        propsEn: 'two school desks and chairs',
        actionEn: 'bowing slightly with an apologetic gesture',
        summaryJa: '教室の机の間で少し頭を下げて謝っている場面',
        line1: `Oh, ${f}, I have to tell you something.`,
        line2: `I am really sorry! I ${errEn}.`,
        ja1: `あ、${f}、言わなきゃいけないことがあるんだ。`,
        ja2: `本当にごめん！${errJa}んだ。`,
        correct: 'That is all right. Do not worry about it.',
        correctReason: `I am really sorry! という謝罪に対し、That is all right. Do not worry about it.（大丈夫、気にしないで）と優しく受け止めている。`,
        wrongs: ['Congratulations on your prize!', 'Turn left at the second corner.'] as [string, string],
        wrongReasons: [
          '受賞を祝う表現であり、謝っている相手への返答として不適切。',
          '道案内の指示であり、謝罪への応答になっていない。',
        ] as [string, string],
        explanation: `謝罪 I am really sorry! には That is all right. / Don't worry about it. で応じる。`,
        evidence: 'I am really sorry',
        skill: '謝罪',
      };
    },
    // u=8: 提案への応答（Shall we / Why don't we ...?）
    () => {
      const suggestions = [
        ['make vegetable curry for Mother\'s Day', '母の日に野菜カレーを作る'],
        ['take the earlier train tomorrow morning', '明日の朝は1本早い電車に乗る'],
        ['sit in the front row at the planetarium', 'プラネタリウムで最前列に座る'],
        ['practice our English skit during lunch break', '昼休みに英語劇の練習をする'],
        ['buy a birthday card for Hiroki together', 'ヒロキへの誕生日カードを一緒に買う'],
        ['clean the rabbit hutch before it rains', '雨が降る前にウサギ小屋を掃除する'],
        ['ask Ms. Green about this homework question', 'グリーン先生にこの宿題の質問をする'],
        ['bring sandwiches and eat by the river', 'サンドイッチを持って川辺で食べる'],
        ['make a poster for the book drive', '古本回収のポスターを作る'],
        ['walk home through Maple Shopping Street', 'メイプル商店街を通って歩いて帰る'],
        ['visit the new aquarium next Monday', '来週月曜に新しい水族館へ行く'],
        ['exchange our stamps after school', '放課後に切手を交換する'],
        ['check the bus timetable at the kiosk', '売店でバスの時刻表を調べる'],
        ['borrow two rackets from the gym office', '体育教官室からラケットを2本借りる'],
        ['plant sunflower seeds along the fence', '柵に沿ってヒマワリの種をまく'],
      ];
      const [sugEn, sugJa] = suggestions[round - 1];
      return {
        placeEn: 'a bench in a school hallway',
        propsEn: 'a bulletin board and a bench',
        actionEn: 'discussing an idea enthusiastically',
        summaryJa: '掲示板の近くでアイデアを話し合っている場面',
        line1: `We have some free time now, ${m}.`,
        line2: `Why don't we ${sugEn}?`,
        ja1: `いま少し時間があるね、${m}。`,
        ja2: `ねえ、${sugJa}のはどうかな？`,
        correct: 'Great idea! Let\'s start right away.',
        correctReason: `Why don't we ...?（〜しない？）という提案に Great idea!（いい考えだね！）と賛成している。`,
        wrongs: ['Because the store was closed.', 'No, I have never visited Canada.'] as [string, string],
        wrongReasons: [
          'Why don\'t we ...? は理由の質問ではなく提案なので、過去の Because では答えられない。',
          'カナダに行った経験を否定しており、提案への返事ではない。',
        ] as [string, string],
        explanation: `Why don't we ...? は「〜しませんか」という提案。Why につられて Because を選ばないよう注意する。`,
        evidence: "Why don't we",
        skill: '提案',
      };
    },
    // u=9: 天気・持ち物の確認
    () => {
      const forecasts = [
        ['heavy rain this evening', 'umbrella', '今夕は大雨', '傘'],
        ['strong cold wind tonight', 'thick coat', '今夜は冷たい強風', '厚手のコート'],
        ['bright sunshine all afternoon', 'sun hat', '午後は強い日差し', '帽子'],
        ['light snow after four o\'clock', 'warm boots', '4時以降は小雪', '暖かいブーツ'],
        ['sudden showers around noon', 'raincoat', '昼ごろにわか雨', 'レインコート'],
        ['cool mountain air tomorrow', 'fleece jacket', '明日は山の涼しい空気', 'フリースジャケット'],
        ['hot weather over thirty degrees', 'large water bottle', '30度を超える暑さ', '大きな水筒'],
        ['cloudy skies and chilly wind', 'cardigan', '曇り空と肌寒い風', 'カーディガン'],
        ['thick fog early tomorrow', 'flashlight', '明朝は濃い霧', '懐中電灯'],
        ['thunderstorms late tonight', 'folding umbrella', '今夜遅くに雷雨', '折りたたみ傘'],
        ['dry autumn breeze today', 'lip balm and water', '今日は乾いた秋風', 'リップと水'],
        ['icy roads tomorrow morning', 'non-slip shoes', '明朝は路面凍結', '滑りにくい靴'],
        ['clear skies and warm sun', 'sunglasses', '晴天と暖かい日差し', 'サングラス'],
        ['evening rain near the coast', 'waterproof bag', '海沿いで夕方の雨', '防水バッグ'],
        ['chilly air in the concert hall', 'light scarf', 'ホール内の冷えた空気', '薄手のストール'],
      ];
      const [weaEn, itemEn, weaJa, itemJa] = forecasts[round - 1];
      return {
        placeEn: 'a home entryway with a shoe rack',
        propsEn: 'a front door, a shoe cabinet, and an umbrella stand',
        actionEn: 'putting on shoes before going out',
        summaryJa: '玄関で靴を履いて出かけようとしている場面',
        line1: `I am leaving now, ${f}! The news says we will have ${weaEn}.`,
        line2: `Really, ${m}? Should I take my ${itemEn} with me too?`,
        ja1: `もう出かけるよ、${f}！ニュースによると${weaJa}になるって。`,
        ja2: `本当、${m}？私も${itemJa}を持っていったほうがいいかな？`,
        correct: `Yes, you should. Better safe than sorry.`,
        correctReason: `Should I take ...?（持っていったほうがいい？）という相談に Yes, you should. と明確に助言している。`,
        wrongs: ['It was sunny last Sunday.', 'Three tickets for adults, please.'] as [string, string],
        wrongReasons: [
          '先週日曜の天気を述べており、持ち物の相談への返答ではない。',
          '大人3枚のチケット注文であり、玄関での会話に合わない。',
        ] as [string, string],
        explanation: `Should I ...? に対して Yes, you should. と助言する応答を選ぶ。`,
        evidence: `Should I take my ${itemEn}`,
        skill: '天気・季節',
      };
    },
    // u=10: 道案内・場所の尋ね方
    () => {
      const spots = [
        ['Green Post Office', 'Walk straight two blocks, and it is on your left.', 'グリーン郵便局', '2区画まっすぐ歩くと左手にある'],
        ['City Children\'s Museum', 'Go across that bridge, and you will see a blue roof.', '市立子ども博物館', 'あの橋を渡ると青い屋根が見える'],
        ['Central Flower Shop', 'Turn right at the bakery. It is next to the bank.', '中央生花店', 'パン屋を右に曲がると銀行の隣にある'],
        ['Maple Dental Clinic', 'It is on the second floor of that white building.', 'メイプル歯科', 'あの白いビルの2階にある'],
        ['West Community Pool', 'Walk past the park, and it is beside the high school.', '西市民プール', '公園を過ぎると高校の横にある'],
        ['Starlight Book Cafe', 'Go down these stairs. It is near the ticket gate.', 'スターライトブックカフェ', 'この階段を下りると改札の近くにある'],
        ['Sunrise Bakery', 'Turn left at the traffic light. You cannot miss it.', 'サンライズベーカリー', '信号を左に曲がればすぐわかる'],
        ['Harbor Ferry Pier', 'Follow this wide street straight to the sea.', '港のフェリー乗り場', 'この広い通りを海へまっすぐ進む'],
        ['Aoba Sports Shop', 'It is on the third floor of the station mall.', '青葉スポーツ店', '駅ビルの3階にある'],
        ['Town History Hall', 'Walk behind the library, and you will find the gate.', '郷土資料館', '図書館の裏へ回ると門がある'],
        ['Sakura Music School', 'Cross at the crosswalk, and it is beside the pharmacy.', 'さくら音楽教室', '横断歩道を渡ると薬局の横にある'],
        ['North Bus Terminal', 'Go out the north exit, and Bus Stop Two is right there.', '北バスターミナル', '北口を出るとすぐ2番乗り場がある'],
        ['Clover Animal Hospital', 'Walk one block east. A green sign is out front.', 'クローバー動物病院', '1区画東へ歩くと前に緑の看板がある'],
        ['Riverside Bike Rental', 'Go down the slope by the bridge. It is open now.', '川辺のレンタサイクル', '橋の横の坂を下りたところにある'],
        ['Hilltop Observation Deck', 'Follow the stone path up behind the shrine.', '丘の上の展望台', '神社の裏の石畳を上っていく'],
      ];
      const [spotEn, ansEn, spotJa, ansJa] = spots[round - 1];
      return {
        placeEn: 'a street corner near a crosswalk',
        propsEn: 'a street corner, a blank signpost, and buildings',
        actionEn: 'asking for directions politely on the sidewalk',
        summaryJa: '街角の歩道で道を尋ねている場面',
        line1: `Pardon me. I am looking for ${spotEn}.`,
        line2: `Could you tell me how to get to ${spotEn} from here?`,
        ja1: `すみません。${spotJa}を探しています。`,
        ja2: `ここから${spotJa}への行き方を教えていただけますか。`,
        correct: ansEn,
        correctReason: `how to get to ...（〜への行き方）に対し、「${ansJa}」と具体的な道順を案内している。`,
        wrongs: ['It opens at nine every morning.', 'I work there on Saturdays.'] as [string, string],
        wrongReasons: [
          '開店時刻を答えており、道順を尋ねる質問への回答になっていない。',
          '土曜にそこで働いていることを述べるだけで、行き方を教えていない。',
        ] as [string, string],
        explanation: `Could you tell me how to get to ...? には道順・位置を具体的に示す応答を選ぶ。`,
        evidence: `how to get to ${spotEn}`,
        skill: '場所',
      };
    },
  ];

  const t = templates[u - 1]();
  const qItem = makeQuestionItem({
    examId,
    questionNumber: u,
    questionPrompt: 'Choose the best response to the second speaker.',
    choicePresentation: 'read-aloud',
    correctChoice: t.correct,
    correctReason: t.correctReason,
    wrongChoices: t.wrongs,
    wrongReasons: t.wrongReasons,
    targetAnswer,
    explanation: t.explanation,
    evidence: t.evidence,
    skill: t.skill,
  });

  const turns: DialogueTurn[] = [
    { ...sp1, text: t.line1 },
    { ...sp2, text: t.line2 },
    {
      speaker: 'F2',
      roleLabel: 'Narrator',
      text: `Number one. ${qItem.choices[0]} Number two. ${qItem.choices[1]} Number three. ${qItem.choices[2]}`,
    },
  ];

  const image = buildSupportImageSpec(
    audioId,
    t.summaryJa,
    'two people talking in an everyday setting',
    t.placeEn,
    t.actionEn,
    t.propsEn,
  );

  return makeDialogueUnit({
    examId,
    part: 'part1',
    unitIndex: u,
    readCount: 2,
    turns,
    translation: `${sp1.roleLabel === 'Man' ? '男性' : '女性'}：${t.ja1}\n${sp2.roleLabel === 'Woman' ? '女性' : '男性'}：${t.ja2}`,
    image,
    questions: [qItem],
  });
}

function buildG4Part2(examId: string, round: number, u: number): ListeningAudioUnit {
  const [sp1, sp2] = speakerPairFor(round, u);
  const m = M_NAMES[(round * 2 + u) % 15];
  const f = F_NAMES[(round + u * 2) % 15];
  const qNo = 10 + u;
  const targetAnswer = (round + u) % 4;
  const sp2Label = sp2.roleLabel === 'Woman' ? 'the girl' : 'the boy';

  const scenes = [
    // 1: 予定変更（雨天や都合で変更）
    () => {
      const plans = [
        ['play tennis', 'watch a space movie', 'clean the garage', 'go fishing', '宇宙の映画を見る'],
        ['have a barbecue', 'make homemade pizza', 'visit the zoo', 'wash the car', '手作りピザを作る'],
        ['go cycling', 'play board games', 'swim in the river', 'paint the fence', 'ボードゲームをする'],
        ['pick strawberries', 'visit the science center', 'camp in the hills', 'play soccer', '科学センターへ行く'],
        ['sketch in the park', 'bake apple muffins', 'fly kites', 'walk the dog', 'アップルマフィンを焼く'],
      ];
      const [oldPlan, newPlan, w2, w3, newJa] = plans[(round - 1) % 5];
      const dayTag = ['this Saturday', 'tomorrow afternoon', 'this Sunday', 'on Friday', 'after lunch today'][Math.floor((round - 1) / 3)];
      const turns: DialogueTurn[] = [
        { ...sp1, text: `Hi ${sp2.roleLabel === 'Woman' ? f : m}, are we still going to ${oldPlan} ${dayTag} in round ${round}?`.replace(` in round ${round}`, '') },
        { ...sp2, text: `Well, the weather report says strong rain is coming ${dayTag}. Let's ${newPlan} at my house instead.` },
        { ...sp1, text: `Good idea! I will bring some juice at one o'clock.` },
        { ...sp2, text: `Thanks! My brother ${m} wants to join us too.` },
        { speaker: 'F2', roleLabel: 'Narrator', text: `Question. What will they do ${dayTag}?` },
      ];
      // Ensure unique opening across rounds by varying greeting + name + round-specific time
      turns[0] = { ...sp1, text: `${PART1_OPENERS[round - 1]} ${sp2.roleLabel === 'Woman' ? f : m}, are we going to ${oldPlan} ${dayTag}?` };
      return {
        turns,
        translation: `${sp1.roleLabel === 'Man' ? '男子' : '女子'}：予定どおり${oldPlan}をする？\n${sp2.roleLabel === 'Woman' ? '女子' : '男子'}：天気予報では強い雨が降るそうだから、代わりに私の家で${newJa}をしよう。\n${sp1.roleLabel === 'Man' ? '男子' : '女子'}：いい考えだね！1時にジュースを持っていくよ。\n質問：2人は何をしますか。`,
        prompt: `What will they do ${dayTag}?`,
        correct: newPlan[0].toUpperCase() + newPlan.slice(1) + '.',
        correctReason: `雨の予報を受けて Let's ${newPlan} at my house instead.（代わりに家で${newJa}をしよう）と変更し合意している。`,
        wrongs: [
          oldPlan[0].toUpperCase() + oldPlan.slice(1) + '.',
          w2[0].toUpperCase() + w2.slice(1) + '.',
          w3[0].toUpperCase() + w3.slice(1) + '.',
        ] as [string, string, string],
        wrongReasons: [
          `${oldPlan} は当初の予定であり、雨のため中止になった。`,
          `${w2} は会話の中で一度も提案されていない。`,
          `${w3} もこれからの予定として触れられていない。`,
        ] as [string, string, string],
        explanation: `instead（代わりに）の前後にある変更後の予定 ${newPlan} を聞き取る。`,
        evidence: `Let's ${newPlan}`,
        skill: '予定変更',
      };
    },
    // 2: 値段・合計金額や割引の聞き取り
    () => {
      const items = [
        ['strawberry cake', 'four hundred yen', 'three hundred yen', 'five hundred yen', 'six hundred yen', 'いちごケーキ', '400円'],
        ['ham sandwich set', 'six hundred yen', 'five hundred yen', 'seven hundred yen', 'eight hundred yen', 'ハムサンドセット', '600円'],
        ['museum student ticket', 'three hundred yen', 'two hundred yen', 'four hundred yen', 'six hundred yen', '博物館の学生券', '300円'],
        ['wooden keychain', 'five hundred yen', 'three hundred yen', 'seven hundred yen', 'nine hundred yen', '木製キーホルダー', '500円'],
        ['melon smoothie', 'four hundred fifty yen', 'three hundred fifty yen', 'five hundred fifty yen', 'six hundred yen', 'メロンスムージー', '450円'],
      ];
      const [itemEn, ansPrice, w1, w2, w3, itemJa, ansJa] = items[(round - 1) % 5];
      const shopAdjs = ['Sunny', 'Maple', 'Harbor', 'Clover', 'Rainbow', 'Hilltop', 'Breeze', 'Star', 'Acorn', 'Cherry', 'River', 'Forest', 'Crown', ' Coral', 'Amber'];
      const shopName = `${shopAdjs[round - 1].trim()} Cafe`;
      const turns: DialogueTurn[] = [
        { ...sp1, text: `Welcome to ${shopName}! Would you like to try our ${itemEn} today?` },
        { ...sp2, text: `Yes, it looks delicious. Is it ${w2}?` },
        { ...sp1, text: `Actually, students get a discount today, so it is ${ansPrice}.` },
        { ...sp2, text: `Wonderful! I will take one, please.` },
        { speaker: 'F2', roleLabel: 'Narrator', text: `Question. How much will ${sp2Label} pay?` },
      ];
      return {
        turns,
        translation: `店員：${shopName}へようこそ！本日${itemJa}はいかがですか。\n客：おいしそうですね。${w2}ですか？\n店員：実は今日は学割があるので、${ansJa}になります。\n客：嬉しいです！1つください。\n質問：いくら支払いますか。`,
        prompt: `How much will ${sp2Label} pay?`,
        correct: ansPrice[0].toUpperCase() + ansPrice.slice(1) + '.',
        correctReason: `学割が適用されて so it is ${ansPrice}（${ansJa}になる）と店員が伝えている。`,
        wrongs: [
          w1[0].toUpperCase() + w1.slice(1) + '.',
          w2[0].toUpperCase() + w2.slice(1) + '.',
          w3[0].toUpperCase() + w3.slice(1) + '.',
        ] as [string, string, string],
        wrongReasons: [
          `${w1} という金額は会話に出てこない。`,
          `${w2} は客が最初に尋ねた割引前の予想額であり、実際の支払額ではない。`,
          `${w3} も支払う金額として述べられていない。`,
        ] as [string, string, string],
        explanation: `Actually, students get a discount today, so it is ${ansPrice}. の確定金額を聞き取る。`,
        evidence: `so it is ${ansPrice}`,
        skill: '値段・数量',
      };
    },
    // 3: 忘れ物を取りに行く／これからすること
    () => {
      const tasks = [
        ['go back to the classroom', 'buy a new textbook', 'call the bus company', 'wait at the gate', '教室へ戻る', 'science notebook'],
        ['stop by the bakery', 'clean the music room', 'borrow a bicycle', 'write a letter', 'パン屋に寄る', 'fresh rolls for breakfast'],
        ['return books to the library', 'watch soccer practice', 'visit the nurse', 'wash gym shoes', '図書館に本を返す', 'two history books'],
        ['buy batteries at the store', 'fix the computer', 'paint a poster', 'practice the flute', '店で電池を買う', 'flashlight batteries'],
        ['ask the teacher for a handout', 'copy notes at home', 'go to the bookstore', 'play badminton', '先生にプリントをもらいに行く', 'math worksheet'],
      ];
      const [ansAct, w1, w2, w3, ansJa, objEn] = tasks[(round - 1) % 5];
      const turns: DialogueTurn[] = [
        { ...sp1, text: `School is over for day ${round}, ${sp2.roleLabel === 'Woman' ? f : m}! Let's walk home together.` },
        { ...sp2, text: `Oh, wait! I need my ${objEn}, so I have to ${ansAct} first.` },
        { ...sp1, text: `No problem. I will wait for you by the shoe lockers.` },
        { ...sp2, text: `Thank you! I will be back in three minutes.` },
        { speaker: 'F2', roleLabel: 'Narrator', text: `Question. What will ${sp2Label} do first?` },
      ];
      return {
        turns,
        translation: `${sp1.roleLabel === 'Man' ? '男子' : '女子'}：学校が終わったね！一緒に歩いて帰ろう。\n${sp2.roleLabel === 'Woman' ? '女子' : '男子'}：あ、待って！${objEn}が必要だから、先に${ansJa}必要があるんだ。\n${sp1.roleLabel === 'Man' ? '男子' : '女子'}：いいよ、下駄箱のところで待っているね。\n質問：最初に何をしますか。`,
        prompt: `What will ${sp2Label} do first?`,
        correct: ansAct[0].toUpperCase() + ansAct.slice(1) + '.',
        correctReason: `so I have to ${ansAct} first（まず${ansJa}必要がある）と自分の行動を述べている。`,
        wrongs: [
          w1[0].toUpperCase() + w1.slice(1) + '.',
          w2[0].toUpperCase() + w2.slice(1) + '.',
          w3[0].toUpperCase() + w3.slice(1) + '.',
        ] as [string, string, string],
        wrongReasons: [
          `${w1} とは会話の中で述べていない。`,
          `${w2} についても触れられていない。`,
          `${w3} は別の人の行動または無関係な選択肢である。`,
        ] as [string, string, string],
        explanation: `I have to ${ansAct} first. のこれからすぐ行う動作を聞き取る。`,
        evidence: `have to ${ansAct} first`,
        skill: '時刻・順序',
      };
    },
    // 4: 交通手段の比較・選択
    () => {
      const modes = [
        ['by subway', 'by bus', 'by taxi', 'on foot', '地下鉄で'],
        ['by bicycle', 'by car', 'by train', 'by boat', '自転車で'],
        ['on foot', 'by bus', 'by subway', 'by car', '徒歩で'],
      ];
      const [ans, w1, w2, w3, ansJa] = modes[(round - 1) % 3];
      const dests = [
        'the flower festival', 'the book fair', 'the city stadium', 'the art gallery', 'the summer market',
        'the science hall', 'the river park', 'the drum concert', 'the craft fair', 'the history museum',
        'the youth center', 'the ice show', 'the autumn fair', 'the botanical dome', 'the food expo',
      ];
      const dest = dests[round - 1];
      const turns: DialogueTurn[] = [
        { ...sp1, text: `How should we go to ${dest} today, ${sp2.roleLabel === 'Woman' ? f : m}? Shall we go ${w1}?` },
        { ...sp2, text: `The roads are very crowded this morning. Going ${ans} is much faster.` },
        { ...sp1, text: `You are right. Let's go ${ans} then.` },
        { speaker: 'F2', roleLabel: 'Narrator', text: `Question. How will they go to ${dest}?` },
      ];
      return {
        turns,
        translation: `${sp1.roleLabel === 'Man' ? '男子' : '女子'}：今日はどうやって${dest}へ行こうか？\n${sp2.roleLabel === 'Woman' ? '女子' : '男子'}：今朝は道路がとても混んでいるから、${ansJa}行くほうがずっと速いよ。\n${sp1.roleLabel === 'Man' ? '男子' : '女子'}：そうだね。じゃあ${ansJa}行こう。\n質問：どうやって向かいますか。`,
        prompt: `How will they go to ${dest}?`,
        correct: ans[0].toUpperCase() + ans.slice(1) + '.',
        correctReason: `道路の混雑を避けて Let's go ${ans} then.（では${ansJa}行こう）と決定している。`,
        wrongs: [
          w1[0].toUpperCase() + w1.slice(1) + '.',
          w2[0].toUpperCase() + w2.slice(1) + '.',
          w3[0].toUpperCase() + w3.slice(1) + '.',
        ] as [string, string, string],
        wrongReasons: [
          `${w1} は最初に提案されたが道路混雑を理由に却下された。`,
          `${w2} は会話の中で提案されていない手段である。`,
          `${w3} も選ばれた移動手段ではない。`,
        ] as [string, string, string],
        explanation: `最初に提案された手段ではなく、最終的に合意した Let's go ${ans} を選ぶ。`,
        evidence: `Let's go ${ans}`,
        skill: '手段',
      };
    },
    // 5: プレゼント選び
    () => {
      const gifts = [
        ['a leather wallet', 'a silk necktie', 'a coffee mug', 'a golf cap', '革の財布'],
        ['a cooking apron', 'a flower vase', 'a hand mirror', 'a tea pot', 'エプロン'],
        ['a sports towel', 'a wristwatch', 'a music CD', 'a backpack', 'スポーツタオル'],
        ['a fountain pen', 'a desk lamp', 'a photo frame', 'a calendar', '万年筆'],
        ['a pair of warm gloves', 'a wool hat', 'a long scarf', 'a sweater', '暖かい手袋'],
      ];
      const [ans, w1, w2, w3, ansJa] = gifts[(round - 1) % 5];
      const targets = ['Grandfather', 'Aunt Mari', 'Brother Koji', 'Uncle Shin', 'Sister Aya', 'Mother', 'Father', 'Grandmother', 'Cousin Rui', 'Coach Toda', 'Ms. Ono', 'Mr. Hori', 'Sister Nao', 'Uncle Dan', 'Aunt Emi'];
      const target = targets[round - 1];
      const turns: DialogueTurn[] = [
        { ...sp1, text: `Next Sunday is ${target}'s birthday. Should we buy ${w1}?` },
        { ...sp2, text: `${target} already got ${w1} last year. How about ${ans} this time?` },
        { ...sp1, text: `That is perfect! Let's look for ${ans} on the second floor.` },
        { speaker: 'F2', roleLabel: 'Narrator', text: `Question. What will they buy for ${target}?` },
      ];
      return {
        turns,
        translation: `${sp1.roleLabel === 'Man' ? '男子' : '女子'}：来週の日曜は${target}の誕生日だね。${w1}を買おうか？\n${sp2.roleLabel === 'Woman' ? '女子' : '男子'}：去年もうもらっていたよ。今回は${ansJa}はどう？\n${sp1.roleLabel === 'Man' ? '男子' : '女子'}：ぴったりだね！2階で探そう。\n質問：何を買いますか。`,
        prompt: `What will they buy for ${target}?`,
        correct: ans[0].toUpperCase() + ans.slice(1) + '.',
        correctReason: `How about ${ans} this time? に対して That is perfect! と購入を決めている。`,
        wrongs: [
          w1[0].toUpperCase() + w1.slice(1) + '.',
          w2[0].toUpperCase() + w2.slice(1) + '.',
          w3[0].toUpperCase() + w3.slice(1) + '.',
        ] as [string, string, string],
        wrongReasons: [
          `${w1} は去年すでにもらっているという理由で選ばれなかった。`,
          `${w2} はプレゼント候補として出てこない。`,
          `${w3} も会話に登場しない品物である。`,
        ] as [string, string, string],
        explanation: `already got ... last year で除外された品物ではなく、合意した ${ans} を選ぶ。`,
        evidence: `look for ${ans}`,
        skill: '比較',
      };
    },
    // 6: 集合場所の確認
    () => {
      const spots = [
        ['in front of the ticket gate', 'inside the bookstore', 'by the bus stop', 'at the park entrance', '改札の前'],
        ['beside the big fountain', 'near the clock tower', 'in front of the cafe', 'inside the lobby', '大きな噴水の横'],
        ['at the library entrance', 'on the second floor', 'near the flower bed', 'by the postbox', '図書館の入口'],
      ];
      const [ans, w1, w2, w3, ansJa] = spots[(round - 1) % 3];
      const times = ['nine thirty', 'ten o\'clock', 'ten fifteen', 'eleven o\'clock', 'one fifteen', 'one thirty', 'two o\'clock', 'two thirty', 'three o\'clock', 'three fifteen', 'nine forty', 'ten twenty', 'one forty', 'two twenty', 'four o\'clock'];
      const tm = times[round - 1];
      const turns: DialogueTurn[] = [
        { ...sp1, text: `We are meeting at ${tm} tomorrow, ${sp2.roleLabel === 'Woman' ? f : m}. Should we meet ${w1}?` },
        { ...sp2, text: `It is always crowded ${w1}. Let's meet ${ans} instead.` },
        { ...sp1, text: `Got it! See you ${ans} at ${tm}.` },
        { speaker: 'F2', roleLabel: 'Narrator', text: 'Question. Where will they meet tomorrow?' },
      ];
      return {
        turns,
        translation: `${sp1.roleLabel === 'Man' ? '男子' : '女子'}：明日は${tm}に待ち合わせだね。${w1}で会おうか？\n${sp2.roleLabel === 'Woman' ? '女子' : '男子'}：そこはいつも混んでいるから、代わりに${ansJa}で会おう。\n${sp1.roleLabel === 'Man' ? '男子' : '女子'}：了解！${tm}にそこでね。\n質問：明日どこで待ち合わせますか。`,
        prompt: 'Where will they meet tomorrow?',
        correct: ans[0].toUpperCase() + ans.slice(1) + '.',
        correctReason: `混雑を避けて Let's meet ${ans} instead.（${ansJa}で会おう）と決まり、相手も復唱している。`,
        wrongs: [
          w1[0].toUpperCase() + w1.slice(1) + '.',
          w2[0].toUpperCase() + w2.slice(1) + '.',
          w3[0].toUpperCase() + w3.slice(1) + '.',
        ] as [string, string, string],
        wrongReasons: [
          `${w1} はいつも混んでいるため変更された場所である。`,
          `${w2} は待ち合わせ場所として話題に出ていない。`,
          `${w3} も会話に登場しない場所である。`,
        ] as [string, string, string],
        explanation: `See you ${ans} と最終的に確定した集合場所を聞き取る。`,
        evidence: `Let's meet ${ans}`,
        skill: '場所',
      };
    },
    // 7: 人物関係・誰と行ったか
    () => {
      const companions = [
        ['her aunt', 'her older sister', 'her classmate', 'her music teacher', 'おばさん'],
        ['his grandfather', 'his soccer coach', 'his younger brother', 'his father', 'おじいさん'],
        ['her cousin', 'her mother', 'her art teacher', 'her neighbor', 'いとこ'],
      ];
      const isGirl = sp2.roleLabel === 'Woman';
      const [rawAns, rawW1, rawW2, rawW3, ansJa] = companions[(round - 1) % 3];
      const fix = (s: string) => isGirl ? s.replace(/^his /, 'her ') : s.replace(/^her /, 'his ');
      const ans = fix(rawAns), w1 = fix(rawW1), w2 = fix(rawW2), w3 = fix(rawW3);
      const events = [
        'the autumn craft market', 'the classical violin concert', 'the strawberry festival',
        'the dinosaur exhibition', 'the riverside fireworks', 'the ice skating show',
        'the pottery village', 'the rose garden fair', 'the city book festival',
        'the glassblowing workshop', 'the outdoor jazz event', 'the lantern night walk',
        'the marine life center', 'the historical castle tour', 'the planetarium special night',
      ];
      const ev = events[round - 1];
      const turns: DialogueTurn[] = [
        { ...sp1, text: `Did you go to ${ev} last weekend, ${isGirl ? f : m}?` },
        { ...sp2, text: `Yes! ${w1[0].toUpperCase()}${w1.slice(1)} caught a cold, so I went there with ${ans.replace(/^(her|his) /, 'my ')}.` },
        { ...sp1, text: `Oh, I hope your family member feels better soon.` },
        { speaker: 'F2', roleLabel: 'Narrator', text: `Question. Who went to ${ev} with ${sp2Label}?` },
      ];
      return {
        turns,
        translation: `${sp1.roleLabel === 'Man' ? '男子' : '女子'}：先週末、${ev}へ行った？\n${sp2.roleLabel === 'Woman' ? '女子' : '男子'}：うん！風邪をひいた家族の代わりに、${ansJa}と一緒に行ったよ。\n質問：誰と一緒に行きましたか。`,
        prompt: `Who went to ${ev} with ${sp2Label}?`,
        correct: ans[0].toUpperCase() + ans.slice(1) + '.',
        correctReason: `so I went there with my ...（${ansJa}と行った）と実際の同伴者を述べている。`,
        wrongs: [
          w1[0].toUpperCase() + w1.slice(1) + '.',
          w2[0].toUpperCase() + w2.slice(1) + '.',
          w3[0].toUpperCase() + w3.slice(1) + '.',
        ] as [string, string, string],
        wrongReasons: [
          `${w1} は風邪をひいて行けなかった人物である。`,
          `${w2} は会話に登場しない人物である。`,
          `${w3} も同伴者として触れられていない。`,
        ] as [string, string, string],
        explanation: `風邪をひいた人物と実際に行った人物を取り違えないよう went there with ... を聞き取る。`,
        evidence: `went there with ${ans.replace(/^(her|his) /, 'my ')}`,
        skill: '人物関係',
      };
    },
    // 8: 頻度（How often）
    () => {
      const freqs = [
        ['twice a week', 'once a week', 'every day', 'once a month', '週に2回'],
        ['three times a week', 'twice a month', 'every morning', 'once a week', '週に3回'],
        ['every Saturday morning', 'every Tuesday night', 'twice a day', 'once a year', '毎週土曜の朝'],
      ];
      const [ans, w1, w2, w3, ansJa] = freqs[(round - 1) % 3];
      const lessons = [
        'swimming lessons', 'calligraphy class', 'junior tennis practice', 'abacus lessons', 'conversation class',
        'violin lessons', 'karate practice', 'ballet class', 'coding workshop', 'drum lessons',
        'basketball club', 'choir practice', 'chess club', 'painting studio', 'table tennis club',
      ];
      const les = lessons[round - 1];
      const turns: DialogueTurn[] = [
        { ...sp1, text: `You are really good at your hobby, ${sp2.roleLabel === 'Woman' ? f : m}! Do you have ${les} ${w1}?` },
        { ...sp2, text: `Last year it was ${w1}, but now I go ${ans}.` },
        { ...sp1, text: `Wow, practicing ${ans} makes a big difference!` },
        { speaker: 'F2', roleLabel: 'Narrator', text: `Question. How often does ${sp2Label} have ${les} now?` },
      ];
      return {
        turns,
        translation: `${sp1.roleLabel === 'Man' ? '男子' : '女子'}：すごく上手だね！${les}には${w1}通っているの？\n${sp2.roleLabel === 'Woman' ? '女子' : '男子'}：去年まではそうだったけれど、今は${ansJa}通っているよ。\n質問：現在はどのくらいの頻度で通っていますか。`,
        prompt: `How often does ${sp2Label} have ${les} now?`,
        correct: ans[0].toUpperCase() + ans.slice(1) + '.',
        correctReason: `but now I go ${ans}（今は${ansJa}通っている）と現在の頻度を述べている。`,
        wrongs: [
          w1[0].toUpperCase() + w1.slice(1) + '.',
          w2[0].toUpperCase() + w2.slice(1) + '.',
          w3[0].toUpperCase() + w3.slice(1) + '.',
        ] as [string, string, string],
        wrongReasons: [
          `${w1} は去年の頻度であり、現在の頻度ではない。`,
          `${w2} は会話で言及されていない頻度である。`,
          `${w3} も習い事の回数として述べられていない。`,
        ] as [string, string, string],
        explanation: `Last year と but now の対比に注意して現在の頻度を聞き取る。`,
        evidence: `now I go ${ans}`,
        skill: '値段・数量',
      };
    },
    // 9: 探している物の場所
    () => {
      const locs = [
        ['on the piano bench', 'inside the backpack', 'under the sofa', 'on the kitchen counter', 'ピアノの椅子の上'],
        ['in the top drawer', 'on the bookshelf', 'beside the television', 'inside the shoe box', '一番上の引き出しの中'],
        ['next to the telephone', 'under the bed', 'in the washing machine', 'on the balcony chair', '電話の隣'],
      ];
      const [ans, w1, w2, w3, ansJa] = locs[(round - 1) % 3];
      const items = [
        'library card', 'blue watch', 'student ID card', 'train pass', 'hairbrush',
        'red sketchbook', 'pair of scissors', 'bicycle key', 'recorder case', 'pocket notebook',
        'swimming goggles', 'knitting needle', 'stamp album', 'magnifying glass', 'pencil sharpener',
      ];
      const item = items[round - 1];
      const turns: DialogueTurn[] = [
        { ...sp1, text: `Have you seen my ${item}, ${sp2.roleLabel === 'Woman' ? f : m}? It is not ${w1}.` },
        { ...sp2, text: `Oh, I cleaned the room earlier, and I saw your ${item} ${ans}.` },
        { ...sp1, text: `Found it! Thank you so much.` },
        { speaker: 'F2', roleLabel: 'Narrator', text: `Question. Where was the ${item}?` },
      ];
      return {
        turns,
        translation: `${sp1.roleLabel === 'Man' ? '男子' : '女子'}：私の${item}を見なかった？${w1}にはないんだ。\n${sp2.roleLabel === 'Woman' ? '女子' : '男子'}：さっき掃除をしたときに、${ansJa}にあるのを見たよ。\n${sp1.roleLabel === 'Man' ? '男子' : '女子'}：あった！ありがとう。\n質問：${item}はどこにありましたか。`,
        prompt: `Where was the ${item}?`,
        correct: ans[0].toUpperCase() + ans.slice(1) + '.',
        correctReason: `I saw your ${item} ${ans}（${ansJa}にあるのを見た）とあり、実際に見つかっている。`,
        wrongs: [
          w1[0].toUpperCase() + w1.slice(1) + '.',
          w2[0].toUpperCase() + w2.slice(1) + '.',
          w3[0].toUpperCase() + w3.slice(1) + '.',
        ] as [string, string, string],
        wrongReasons: [
          `${w1} にはないと最初の話者が否定している。`,
          `${w2} は会話に出てこない場所である。`,
          `${w3} も物の置き場所として述べられていない。`,
        ] as [string, string, string],
        explanation: `It is not ... で否定された場所ではなく、I saw your ${item} ${ans} を選ぶ。`,
        evidence: `saw your ${item} ${ans}`,
        skill: '場所',
      };
    },
    // 10: 手伝い・役割分担
    () => {
      const jobs = [
        ['make the welcome sign', 'blow up balloons', 'arrange the chairs', 'buy paper plates', '歓迎看板を作る'],
        ['write the team report', 'draw the graph', 'take photographs', 'print the handouts', 'チームのレポートを書く'],
        ['wash the strawberries', 'whip the fresh cream', 'bake the sponge cake', 'cut the oranges', 'いちごを洗う'],
      ];
      const [ans, w1, w2, w3, ansJa] = jobs[(round - 1) % 3];
      const events = [
        'welcome party', 'science presentation', 'cooking class cake', 'farewell meeting', 'open school day',
        'english club fair', 'birthday surprise', 'reading week display', 'charity bazaar', 'harvest party',
        'drama stage prep', 'chorus tea party', 'summer camp supper', 'astronomy night', 'junior quiz bowl',
      ];
      const ev = events[round - 1];
      const turns: DialogueTurn[] = [
        { ...sp1, text: `Let's finish preparing for our ${ev}, ${sp2.roleLabel === 'Woman' ? f : m}. I will ${w1}.` },
        { ...sp2, text: `Okay! Then I will ${ans} before four o'clock.` },
        { ...sp1, text: `Great. Let's work hard together!` },
        { speaker: 'F2', roleLabel: 'Narrator', text: `Question. What will ${sp2Label} do for the ${ev}?` },
      ];
      return {
        turns,
        translation: `${sp1.roleLabel === 'Man' ? '男子' : '女子'}：${ev}の準備を仕上げよう。私は${w1}をするね。\n${sp2.roleLabel === 'Woman' ? '女子' : '男子'}：いいよ！じゃあ私は4時までに${ansJa}をするね。\n質問：${sp2Label === 'the girl' ? '女の子' : '男の子'}は何を担当しますか。`,
        prompt: `What will ${sp2Label} do for the ${ev}?`,
        correct: ans[0].toUpperCase() + ans.slice(1) + '.',
        correctReason: `Then I will ${ans}（では私が${ansJa}をする）と自分の担当を明言している。`,
        wrongs: [
          w1[0].toUpperCase() + w1.slice(1) + '.',
          w2[0].toUpperCase() + w2.slice(1) + '.',
          w3[0].toUpperCase() + w3.slice(1) + '.',
        ] as [string, string, string],
        wrongReasons: [
          `${w1} はもう一方の話者が担当する作業であり、設問の対象人物の作業ではない。`,
          `${w2} は会話の中で言及されていない作業である。`,
          `${w3} も今回の役割分担には含まれていない。`,
        ] as [string, string, string],
        explanation: `どちらの話者の行動を問われているかを確認し、第2話者の Then I will ${ans} を聞き取る。`,
        evidence: `Then I will ${ans}`,
        skill: '依頼',
      };
    },
  ];

  const d = scenes[u - 1]();
  const qItem = makeQuestionItem({
    examId,
    questionNumber: qNo,
    questionPrompt: d.prompt,
    choicePresentation: 'printed',
    correctChoice: d.correct,
    correctReason: d.correctReason,
    wrongChoices: d.wrongs,
    wrongReasons: d.wrongReasons,
    targetAnswer,
    explanation: d.explanation,
    evidence: d.evidence,
    skill: d.skill,
  });

  return makeDialogueUnit({
    examId,
    part: 'part2',
    unitIndex: u,
    readCount: 2,
    turns: d.turns,
    translation: d.translation,
    image: null,
    questions: [qItem],
  });
}

function buildG4Part3(examId: string, round: number, u: number): ListeningAudioUnit {
  const qNo = 20 + u;
  const targetAnswer = (round + u + 2) % 4;
  const boy = M_NAMES[(round * 3 + u) % 15];
  const girl = F_NAMES[(round * 2 + u + 3) % 15];

  const stories = [
    // 1: 学校案内アナウンス
    () => {
      const clubs = ['Gardening Club', 'Astronomy Club', 'Cooking Club', 'Photography Club', 'Calligraphy Club', 'Drama Club', 'Chess Club', 'Chorus Club', 'Science Club', 'Art Club', 'Badminton Club', 'Table Tennis Club', ' Craft Club', 'Dance Club', 'Quiz Club'].map(s => s.trim());
      const items = ['work gloves', 'a flashlight', 'a clean apron', 'a digital camera', 'an ink brush', 'your script book', 'a notebook', 'a bottle of water', 'safety glasses', 'a sketchbook', 'indoor shoes', 'your own paddle', 'a pair of scissors', 'a sports towel', 'two black pencils'];
      const wrongItems = ['a raincoat', 'a swimming cap', 'a dictionary'];
      const club = clubs[round - 1];
      const item = items[round - 1];
      const text = `Attention, members of the ${club}. Because Room One is being painted today, we will meet in Room Five at four fifteen. Please remember to bring ${item} for today's activity. See you soon!`;
      return {
        text,
        ja: `${club}の部員にお知らせします。今日1番教室は塗装中のため、4時15分に5番教室に集まります。今日の活動のために忘れずに${item}を持ってきてください。`,
        prompt: `What should the ${club} members bring today?`,
        correct: item[0].toUpperCase() + item.slice(1) + '.',
        correctReason: `Please remember to bring ${item} for today's activity. と持参物が明示されている。`,
        wrongs: wrongItems.map(w => w[0].toUpperCase() + w.slice(1) + '.') as [string, string, string],
        wrongReasons: [
          `${wrongItems[0]} を持ってくるようには案内されていない。`,
          `${wrongItems[1]} は今日の部活動の持ち物ではない。`,
          `${wrongItems[2]} についてもアナウンスで触れられていない。`,
        ] as [string, string, string],
        explanation: `remember to bring ${item} のアナウンス終盤の指示を聞き取る。`,
        evidence: `remember to bring ${item}`,
        skill: '依頼',
      };
    },
    // 2: 週末の家族体験ストーリー
    () => {
      const places = ['an apple orchard', 'a pottery village', 'a marine aquarium', 'a bamboo forest', 'a cheese farm', 'a glass studio', 'a maple valley', 'a lighthouse island', 'a tea plantation', 'a dinosaur museum', 'a noodle factory', 'a lavender hill', 'a historical castle', 'a canoe lake', 'a bird park'];
      const souvenirs = ['homemade apple jam', 'a blue teacup', 'a dolphin postcard', 'bamboo chopsticks', 'fresh butter', 'a glass wind bell', 'maple cookies', 'shell keychains', 'green tea leaves', 'a fossil guidebook', 'fresh udon packs', 'lavender soap', 'a castle magnet', 'wooden spoons', 'a bird calendar'];
      const pl = places[round - 1];
      const sv = souvenirs[round - 1];
      const text = `Last Saturday, ${girl} visited ${pl} with her parents. In the morning, she walked around and learned many interesting things from a guide. Before going home, she bought ${sv} for her grandmother.`;
      return {
        text,
        ja: `先週の土曜日、${girl}は両親と${pl}を訪れました。午前中はガイドから興味深い話をたくさん学びました。帰る前に、祖母への土産に${sv}を買いました。`,
        prompt: `What did ${girl} buy for her grandmother?`,
        correct: sv[0].toUpperCase() + sv.slice(1) + '.',
        correctReason: `she bought ${sv} for her grandmother と明確に述べられている。`,
        wrongs: ['A wool sweater.', 'A flower pot.', 'A music box.'] as [string, string, string],
        wrongReasons: [
          '毛糸のセーターを買ったとは本文で述べられていない。',
          '植木鉢はお土産として登場しない。',
          'オルゴールについても一切触れられていない。',
        ] as [string, string, string],
        explanation: `Before going home, she bought ${sv} for her grandmother. を聞き取る。`,
        evidence: `bought ${sv} for her grandmother`,
        skill: '持ち物',
      };
    },
    // 3: ペット・動物の世話
    () => {
      const pets = ['brown beagle', 'white rabbit', 'green parakeet', 'golden hamster', 'orange cat', 'spotted turtle', 'black puppy', 'fluffy guinea pig', 'yellow canary', 'silver kitten', 'miniature dachshund', 'white duck', 'small hedgehog', 'gray parrot', 'Welsh corgi'];
      const habits = ['chasing a red ball in the yard', 'eating fresh cabbage leaves', 'singing to morning music', 'running on a wheel at night', 'sleeping on a sunny cushion', 'swimming in a shallow tub', 'fetching a soft frisbee', 'hiding inside a paper tunnel', 'listening to the flute', 'playing with a yarn ball', 'walking along the river path', 'splashing water in the garden', 'eating sweet apple pieces', 'learning simple greetings', 'waiting by the front gate'];
      const pet = pets[round - 1];
      const hab = habits[round - 1];
      const text = `${boy} got a ${pet} two months ago. Every morning before school, ${boy} gives it fresh water and cleans its space. The pet especially loves ${hab} every afternoon.`;
      return {
        text,
        ja: `${boy}は2か月前に${pet}を飼い始めました。毎朝登校前に新鮮な水をやり掃除をします。そのペットは特に毎午後${hab}のが大好きです。`,
        prompt: `What does ${boy}'s pet especially love doing every afternoon?`,
        correct: hab[0].toUpperCase() + hab.slice(1) + '.',
        correctReason: `The pet especially loves ${hab} every afternoon. と本文の最後に述べられている。`,
        wrongs: ['Sleeping inside a school bag.', 'Riding in a shopping basket.', 'Watching soccer on television.'] as [string, string, string],
        wrongReasons: [
          '通学かばんの中で寝るとは述べられていない。',
          '買い物かごに乗るという描写は本文にない。',
          'テレビでサッカーを見るとも言っていない。',
        ] as [string, string, string],
        explanation: `The pet especially loves ... に続く動名詞句を正確に聞き取る。`,
        evidence: `especially loves ${hab}`,
        skill: '比較',
      };
    },
    // 4: 店舗のセール・案内放送
    () => {
      const stores = ['Green Leaf Bookstore', 'Asahi Sports Mart', 'Harbor Bakery', 'komorebi Stationery', 'Sakura Shoe Shop', 'Maple Music Store', 'Sunny Toy World', 'Clover Kitchen Shop', 'Blue Sky Camping', 'Starlight Optical', 'Town Pet Shop', 'Fresh Fruit Corner', 'bergamot Flower Shop', 'Crown Watch Shop', 'Breeze Bike Center'].map(s => s[0].toUpperCase() + s.slice(1));
      const gifts = ['a colorful bookmark', 'a pair of cotton socks', 'a cup of hot milk', 'a mini memo pad', 'shoe cleaning cloth', 'a guitar pick set', 'animal stickers', 'a wooden coaster', 'a carabiner clip', 'a lens cleaning cloth', 'a pet treat sample', 'a cup of orange juice', 'plant food packets', 'a spare battery coupon', 'a reflective sticker'];
      const st = stores[round - 1];
      const gf = gifts[round - 1];
      const text = `Welcome to ${st}! Today we are celebrating our fifth anniversary. Customers who spend over one thousand yen will receive ${gf} at the main counter on the first floor. Enjoy your shopping!`;
      return {
        text,
        ja: `${st}へようこそ！本日は5周年記念日です。1,000円以上お買い上げのお客様には、1階メインカウンターで${gf}を差し上げます。`,
        prompt: 'What will customers receive if they spend over one thousand yen?',
        correct: gf[0].toUpperCase() + gf.slice(1) + '.',
        correctReason: `will receive ${gf} at the main counter と特典の品物が明言されている。`,
        wrongs: ['A free movie ticket.', 'A large canvas umbrella.', 'A box of green tea.'] as [string, string, string],
        wrongReasons: [
          '無料の映画チケットがもらえるとは放送されていない。',
          '大きな布製の傘は特典として挙げられていない。',
          '緑茶の箱についても触れられていない。',
        ] as [string, string, string],
        explanation: `Customers who spend over one thousand yen will receive ${gf} を聞き取る。`,
        evidence: `will receive ${gf}`,
        skill: '値段・数量',
      };
    },
    // 5: 将来の夢・きっかけ
    () => {
      const jobs = ['a pastry chef', 'an airline pilot', 'a veterinarian', 'a picture book writer', 'a mountain guide', 'a marine biologist', 'a train driver', 'a florist', 'a weather forecaster', 'an architect', 'a translator', 'a museum curator', 'a sports trainer', 'a firefighter', 'a botanical gardener'];
      const reasons = ['her uncle baked a wonderful cake for her', 'she visited an airport cockpit tour', 'a kind doctor helped her sick cat', 'she loved drawing stories for her sister', 'she climbed a high peak with her father', 'she saw sea turtles in Okinawa', 'he rode in the front car of an express train', 'her mother grew beautiful roses at home', 'he watched cloud programs every evening', 'she saw a wooden library in Kanazawa', 'she talked with visitors from Australia', 'he loved old maps at the city museum', 'a coach helped him recover from an injury', 'firefighters visited his elementary school', 'she enjoyed caring for school flowerbeds'];
      const jb = jobs[round - 1];
      const rsn = reasons[round - 1];
      const person = round % 2 === 1 ? girl : boy;
      const pron = round % 2 === 1 ? 'she' : 'he';
      const poss = round % 2 === 1 ? 'Her' : 'His';
      const text = `${person} wants to become ${jb} in the future. ${poss} dream started two years ago after ${rsn}. Now ${pron} reads books about that job every weekend.`;
      return {
        text,
        ja: `${person}は将来${jb}になりたいと思っています。その夢は2年前にきっかけがあって始まり、今は毎週末それに関する本を読んでいます。`,
        prompt: `What does ${person} want to become in the future?`,
        correct: jb[0].toUpperCase() + jb.slice(1) + '.',
        correctReason: `第1文で ${person} wants to become ${jb} in the future. と明確に述べられている。`,
        wrongs: ['A dentist.', 'A news reporter.', 'A piano teacher.'] as [string, string, string],
        wrongReasons: [
          '歯科医になりたいとは述べられていない。',
          'ニュース記者という職業は本文に出てこない。',
          'ピアノの先生についても言及がない。',
        ] as [string, string, string],
        explanation: `冒頭の wants to become ${jb} in the future を聞き取る。`,
        evidence: `wants to become ${jb}`,
        skill: '理由',
      };
    },
    // 6: 図書館・公共施設の利用ルール
    () => {
      const halls = ['Midori City Library', 'Aoba Youth Center', 'Sakura Music Studio', 'West Study Hall', 'Harbor Craft Room', 'Maple Sports Gym', 'Hilltop Science Lab', 'Central Computer Room', 'Riverbank Reading Room', 'Clover Cooking Studio', 'Starlight Planetarium', 'Forest Nature House', 'Sunrise Community Hall', 'Breeze Tennis Park', 'Acorn Children\'s Plaza'];
      const times = ['five thirty', 'six o\'clock', 'four forty-five', 'seven o\'clock', 'five fifteen', 'six thirty', 'four thirty', 'seven thirty', 'five forty-five', 'six fifteen', 'five o\'clock', 'six forty-five', 'four fifteen', 'seven fifteen', 'eight o\'clock'];
      const hall = halls[round - 1];
      const tm = times[round - 1];
      const text = `Thank you for visiting ${hall} today. Usually we stay open until eight thirty, but today we will close early at ${tm} for floor cleaning. Please return all borrowed items ten minutes before closing.`;
      return {
        text,
        ja: `本日は${hall}にご来館いただきありがとうございます。通常は8時30分まで開館していますが、本日は床清掃のため${tm}に繰り上げて閉館します。`,
        prompt: `What time will ${hall} close today?`,
        correct: `At ${tm}.`,
        correctReason: `but today we will close early at ${tm} と本日の閉館時刻が案内されている。`,
        wrongs: ['At eight thirty.', 'At nine o\'clock.', 'At three thirty.'] as [string, string, string],
        wrongReasons: [
          '8時30分は通常の閉館時刻（Usually）であり、今日の閉館時刻ではない。',
          '9時という時刻は放送に出てこない。',
          '3時30分についても言及されていない。',
        ] as [string, string, string],
        explanation: `Usually の通常時刻ではなく、but today we will close early at ${tm} を聞き取る。`,
        evidence: `close early at ${tm}`,
        skill: '時刻・順序',
      };
    },
    // 7: 留守番電話・伝言メッセージ
    () => {
      const callers = ['Aunt Yoko', 'Uncle Takeshi', 'Grandma Haruko', 'Cousin Reina', 'Coach Nishida', 'Ms. Fujita', 'Mr. Kuroda', 'Older brother Shin', 'Sisteroka', 'Neighbor Mr. Kato', 'Dr. Mori\'s office', 'Aunt Naomi', 'Uncle Makoto', 'Teacher Ms. Doi', 'Friend Kazuki'].map(s => s === 'Sisteroka' ? 'Sister Moka' : s);
      const places = ['at the south exit', 'in front of the bakery', 'inside the hotel lobby', 'near the taxi stand', 'by the flower clock', 'at Gate Two', 'beside the ticket booth', 'in the station cafe', 'at the museum shop', 'near the north fountain', 'by the information board', 'at Bus Stop Four', 'in front of the bank', 'near the west elevator', 'beside the bookshop'];
      const caller = callers[round - 1];
      const pl = places[round - 1];
      const text = `Hi, this is ${caller} calling on Friday afternoon. My train is running ten minutes late because of strong wind. Please wait for me ${pl} instead of standing outside in the cold. See you soon!`;
      return {
        text,
        ja: `こんにちは、金曜の午後に${caller}から電話しています。強風で電車が10分遅れています。寒い外に立つ代わりに${pl}で待っていてください。`,
        prompt: `Where does ${caller} ask the listener to wait?`,
        correct: pl[0].toUpperCase() + pl.slice(1) + '.',
        correctReason: `Please wait for me ${pl} と待つ場所を具体的に指定している。`,
        wrongs: ['On the train platform.', 'At the parking lot.', 'Across from the school.'] as [string, string, string],
        wrongReasons: [
          '電車のホームで待つようには言っていない。',
          '駐車場という場所は伝言に登場しない。',
          '学校の向かいについても触れられていない。',
        ] as [string, string, string],
        explanation: `Please wait for me ${pl} の依頼箇所を聞き取る。`,
        evidence: `wait for me ${pl}`,
        skill: '予定変更',
      };
    },
    // 8: 料理・工作の手順（最初／最後にすること）
    () => {
      const dishes = ['banana smoothies', 'paper airplanes', 'pressed flower cards', 'fruit jelly cups', 'vegetable sandwiches', 'clay keychains', 'origami cranes', 'lemonade pitchers', 'rice ball bento', 'hand-painted tote bags', 'strawberry parfaits', 'wooden bookends', 'mini herb pots', 'popcorn bowls', 'greeting posters'];
      const firstSteps = ['wash your hands with soap', 'fold the blue paper in half', 'choose three dry flowers', 'cut the peaches into small cubes', 'toast two slices of bread', 'warm the white clay in your hands', 'prepare a square sheet of paper', 'squeeze three fresh lemons', 'wet your hands with clean water', 'place cardboard inside the bag', 'slice four sweet strawberries', 'sand the wooden edges smoothly', 'put small stones in the pot', 'heat a spoonful of oil in a pan', 'draw a light border with a pencil'];
      const dish = dishes[round - 1];
      const step = firstSteps[round - 1];
      const workshops = [
        'morning cooking club', 'craft studio class', 'spring card session', 'summer dessert lab', 'lunch making class',
        'clay art workshop', 'Japanese paper class', 'citrus drink workshop', 'picnic bento class', 'canvas bag studio',
        'berry sweets class', 'woodworking workshop', 'garden herb lesson', 'movie snack corner', 'poster design room',
      ];
      const text = `Welcome to our ${workshops[round - 1]}! Today we are going to make ${dish}. Before touching any tools or ingredients, first please ${step}. After that, look at the board for step two.`;
      return {
        text,
        ja: `みなさんこんにちは！今日のワークショップでは${dish}を作ります。道具や材料に触る前に、まず${step}してください。そのあと黒板でステップ2を確認しましょう。`,
        prompt: 'What should the participants do first?',
        correct: step[0].toUpperCase() + step.slice(1) + '.',
        correctReason: `first please ${step} と最初の工程が明示されている。`,
        wrongs: ['Write their names on the board.', 'Take their work home.', 'Clean the workshop floor.'] as [string, string, string],
        wrongReasons: [
          '黒板に名前を書くという指示は出ていない（黒板を見るのはその後）。',
          '作品を持ち帰るのは最初の作業ではない。',
          '床の掃除についても述べられていない。',
        ] as [string, string, string],
        explanation: `順序語 first please ... に続く最初の行動を聞き取る。`,
        evidence: `first please ${step}`,
        skill: '時刻・順序',
      };
    },
    // 9: 留学生・転校生の自己紹介
    () => {
      const cities = ['Vancouver in Canada', 'Perth in Australia', 'Auckland in New Zealand', 'Boston in America', 'Edinburgh in Scotland', 'Toronto in Canada', 'Melbourne in Australia', 'Seattle in America', 'Dublin in Ireland', 'Ottawa in Canada', 'Brisbane in Australia', 'Portland in America', 'Cardiff in Wales', 'Calgary in Canada', 'Adelaide in Australia'];
      const hobbies = ['taking photos of trains', 'collecting foreign coins', 'playing badminton', 'baking cinnamon rolls', 'drawing comic strips', 'watching baseball games', 'playing the ukulele', 'growing small cacti', 'riding mountain bikes', 'making origami animals', 'swimming butterfly stroke', 'reading space magazines', 'cooking pasta dishes', 'learning Japanese kanji', 'jogging in big parks'];
      const city = cities[round - 1];
      const hob = hobbies[round - 1];
      const newNames = ['Alex', 'Emma', 'Liam', 'Chloe', 'Noah', 'Olivia', 'Lucas', 'Sophia', 'Ethan', 'Mia', 'Mason', 'Ava', 'Logan', 'Ella', 'grace'].map(s => s[0].toUpperCase() + s.slice(1));
      const nm = newNames[round - 1];
      const text = `Hello Class ${round}! My name is ${nm}, and I moved here from ${city} last month. In my free time, I really enjoy ${hob}. I hope to make many friends in this class!`;
      return {
        text,
        ja: `みなさんこんにちは！私の名前は${nm}で、先月${city}から引っ越してきました。自由時間には${hob}をとても楽しんでいます。`,
        prompt: `What does ${nm} enjoy doing in free time?`,
        correct: hob[0].toUpperCase() + hob.slice(1) + '.',
        correctReason: `In my free time, I really enjoy ${hob}. と自分の趣味を述べている。`,
        wrongs: ['Playing ice hockey.', 'Building model ships.', 'Singing opera songs.'] as [string, string, string],
        wrongReasons: [
          'アイスホッケーをすることは自己紹介に含まれていない。',
          '模型の船を作るとも述べていない。',
          'オペラを歌うことについても触れられていない。',
        ] as [string, string, string],
        explanation: `In my free time, I really enjoy ... の自己紹介の趣味を聞き取る。`,
        evidence: `really enjoy ${hob}`,
        skill: '人物関係',
      };
    },
    // 10: 忘れ物・落とし物のお知らせ
    () => {
      const losts = ['a blue sports watch', 'a red tartan scarf', 'a silver flute case', 'a pair of black glasses', 'a green water bottle', 'a brown leather key case', 'a white tennis cap', 'a yellow folding umbrella', 'a small navy wallet', 'a striped lunch bag', 'an English-Japanese dictionary', 'a wooden violin bow', 'a pink knit hat', 'a black calculator', 'a pair of swimming goggles'];
      const foundAt = ['near the gymnasium benches', 'in the library reading corner', 'on the music room piano', 'beside the science lab sink', 'at the bicycle parking rack', 'in front of the nurse office', 'by the tennis court gate', 'inside the main entrance stand', 'near the cafeteria vending machine', 'on a bench in the courtyard', 'on Desk Four in Room Six', 'behind the auditorium stage', 'on the art room stool', 'next to the computer printer', 'by the pool locker door'];
      const lost = losts[round - 1];
      const loc = foundAt[round - 1];
      const offices = [
        'main school office', 'first-floor counter', 'student council room', 'gymnasium desk', 'library service desk',
        'nurse station', 'west building office', 'east gate desk', 'cafeteria counter', 'courtyard booth',
        'second-floor office', 'auditorium desk', 'art building desk', 'computer room desk', 'pool reception desk',
      ];
      const text = `This is a message from the ${offices[round - 1]}. Yesterday afternoon, a student found ${lost} ${loc}. If it is yours, please come to the ${offices[round - 1]} before four thirty today.`;
      return {
        text,
        ja: `事務室からお知らせします。昨日の午後、生徒が${loc}で${lost}を見つけました。心当たりのある人は本日4時30分までに事務室へ来てください。`,
        prompt: `Where was ${lost} found yesterday afternoon?`,
        correct: loc[0].toUpperCase() + loc.slice(1) + '.',
        correctReason: `a student found ${lost} ${loc} と発見場所が明言されている。`,
        wrongs: ['Inside the school bus.', 'In the teachers\' parking lot.', 'On the rooftop stairs.'] as [string, string, string],
        wrongReasons: [
          'スクールバスの中で見つかったとは放送されていない。',
          '先生の駐車場という場所は出てこない。',
          '屋上の階段についても言及されていない。',
        ] as [string, string, string],
        explanation: `found ${lost} に続く場所句 ${loc} を正確に聞き取る。`,
        evidence: `found ${lost} ${loc}`,
        skill: '場所',
      };
    },
  ];

  const st = stories[u - 1]();
  const qItem = makeQuestionItem({
    examId,
    questionNumber: qNo,
    questionPrompt: st.prompt,
    choicePresentation: 'printed',
    correctChoice: st.correct,
    correctReason: st.correctReason,
    wrongChoices: st.wrongs,
    wrongReasons: st.wrongReasons,
    targetAnswer,
    explanation: st.explanation,
    evidence: st.evidence,
    skill: st.skill,
  });

  const turns: DialogueTurn[] = [
    { speaker: 'F2', roleLabel: 'Narrator', text: st.text },
    { speaker: 'F2', roleLabel: 'Narrator', text: `Question. ${st.prompt}` },
  ];

  return makeDialogueUnit({
    examId,
    part: 'part3',
    unitIndex: u,
    readCount: 2,
    turns,
    translation: `${st.ja}\n質問：${st.prompt}`,
    image: null,
    questions: [qItem],
  });
}

function buildGrade4Round(round: number): ListeningExamRound {
  const examId = `eiken_4_listening_r${String(round).padStart(2, '0')}`;
  const units: ListeningAudioUnit[] = [];
  for (let u = 1; u <= 10; u++) units.push(buildG4Part1(examId, round, u));
  for (let u = 1; u <= 10; u++) units.push(buildG4Part2(examId, round, u));
  for (let u = 1; u <= 10; u++) units.push(buildG4Part3(examId, round, u));
  return buildExamRound('eiken_4', round, units);
}

export const GRADE_4_LISTENING_EXAMS: readonly ListeningExamRound[] = Array.from(
  { length: 15 },
  (_, idx) => buildGrade4Round(idx + 1),
);
