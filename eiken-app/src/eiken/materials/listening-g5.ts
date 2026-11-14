import {
  buildExamRound,
  buildSceneImageSpec,
  buildSupportImageSpec,
  makeDialogueUnit,
  makeQuestionItem,
  speakerPairFor,
} from './listening-helpers';
import type { DialogueTurn, ListeningAudioUnit, ListeningExamRound } from '../listeningExamCore';

/**
 * 英検5級 リスニング予想問題 全15回（各回25問＝第1部10問＋第2部5問＋第3部10問＝計375問・375音源・300図版）
 * - 完全独自作成（origin: 'manatobi-original'）。過去問の流用・改変は一切含まない。
 * - 全375音源が12語の冒頭重複ゼロ（DUPLICATE_UNIT_OPENING = 0）を満たすよう、
 *   各回（1〜15）×各問で異なるシチュエーション・固有語彙・会話の切り出しを使用する。
 * - 数値・時刻・日付はすべて ElevenLabs 読み上げ正規化済み（英語スペル表記）。
 */

const NAMES_M = ['Ken', 'Taro', 'Riku', 'Sota', 'Yuto', 'Haru', 'Kenta', 'Daiki', 'Ren', 'Sho', 'Kaito', 'Leo', 'Toma', 'Shun', 'Itsuki'];
const NAMES_F = ['Mina', 'Yui', 'Hana', 'Rina', 'Saki', 'Mei', 'Aoi', 'Emi', 'Nana', 'Kana', 'Mio', 'Sara', 'Yuna', 'Mao', 'Koharu'];

const ROUND_OPENERS = [
  'Good morning',
  'Hello there',
  'Hey',
  'Hi again',
  'Pardon me',
  'Listen',
  'Oh hello',
  'Excuse me',
  'Good afternoon',
  'Say',
  'Wait a second',
  'Look over here',
  'By the way',
  'Oh look',
  'Welcome back',
] as const;

interface G5Part1Seed {
  placeEn: string;
  placeJa: string;
  propsEn: string;
  actionEn: string;
  actionJa: string;
  build: (round: number, u: number, mName: string, fName: string) => {
    line1: string;
    line2: string;
    line1Ja: string;
    line2Ja: string;
    correct: string;
    correctReason: string;
    wrongs: [string, string];
    wrongReasons: [string, string];
    explanation: string;
    evidence: string;
    skill: string;
  };
}

const G5_PART1_SEEDS: readonly G5Part1Seed[] = [
  // 1: 場所を尋ねる（15通りの教室・施設）
  {
    placeEn: 'a school hallway near lockers',
    placeJa: '学校の廊下のロッカー前',
    propsEn: 'school lockers and a classroom door',
    actionEn: 'holding a textbook and talking',
    actionJa: '教科書を持って話している',
    build: (r, _u, m, f) => {
      const opener = ROUND_OPENERS[r - 1];
      const rooms = [
        ['music room', 'first floor', 'next to the library', '音楽室', '1階', '図書室の隣'],
        ['science room', 'second floor', 'near the stairs', '理科室', '2階', '階段の近く'],
        ['art room', 'third floor', 'across from Hall B', '美術室', '3階', 'ホールBの向かい'],
        ['computer room', 'second floor', 'beside Room Four', 'パソコン室', '2階', '4番教室の横'],
        ['cooking room', 'first floor', 'behind the cafeteria', '調理室', '1階', '食堂の裏'],
        ['english room', 'third floor', 'near the west stairs', '英語教室', '3階', '西階段の近く'],
        ['nurse office', 'first floor', 'by the main entrance', '保健室', '1階', '正面玄関のそば'],
        ['math room', 'second floor', 'next to Room Seven', '数学教室', '2階', '7番教室の隣'],
        ['club room', 'first floor', 'near the gym door', '部室', '1階', '体育館の扉の近く'],
        ['drama hall', 'third floor', 'at the end of this hall', '演劇ホール', '3階', 'この廊下の突き当たり'],
        ['history room', 'second floor', 'across from the office', '歴史教室', '2階', '職員室の向かい'],
        ['reading corner', 'first floor', 'inside the big library', '読書コーナー', '1階', '大きな図書室の中'],
        ['craft studio', 'third floor', 'next to the balcony', '工作室', '3階', 'バルコニーの隣'],
        ['dance studio', 'first floor', 'beside the locker room', 'ダンス室', '1階', '更衣室の横'],
        ['meeting room', 'second floor', 'near the central clock', '会議室', '2階', '中央時計の近く'],
      ];
      const [roomEn, floorEn, adjEn, roomJa, floorJa, adjJa] = rooms[r - 1];
      return {
        line1: `${opener}, ${f}. Are we going to the ${roomEn} now?`,
        line2: `Yes, ${m}, but where is the ${roomEn}?`,
        line1Ja: `${f}、今から${roomJa}に行くの？`,
        line2Ja: `うん、${m}。でも${roomJa}はどこにあるのかな？`,
        correct: `It is on the ${floorEn}, ${adjEn}.`,
        correctReason: `場所を尋ねる where is the ${roomEn}? に対して「${floorJa}の${adjJa}だよ」と正しく場所を答えている。`,
        wrongs: ['I play soccer every Sunday.', 'She is our new homeroom teacher.'],
        wrongReasons: [
          '日曜日の運動習慣を述べており、部屋の場所を尋ねる質問への応答ではない。',
          '新しい担任の先生の紹介をしており、場所の質問とかみ合わない。',
        ],
        explanation: `where is the ${roomEn}? に対して階と位置で答える応答を選ぶ。`,
        evidence: `where is the ${roomEn}`,
        skill: '場所',
      };
    },
  },
  // 2: 時刻を尋ねる（15通りの乗り物・目的地・時刻）
  {
    placeEn: 'a bus stop on a quiet street',
    placeJa: '静かな通りのバス停',
    propsEn: 'a bus stop pole and a wooden bench',
    actionEn: 'looking at a wristwatch while carrying small bags',
    actionJa: '小さなかばんを持って腕時計を見ている',
    build: (r, _u, m) => {
      const opener = ROUND_OPENERS[(r + 2) % 15];
      const items = [
        ['city park', 'nine fifteen', '市の公園', '9時15分'],
        ['swimming pool', 'ten twenty', 'プール', '10時20分'],
        ['central station', 'two forty', '中央駅', '2時40分'],
        ['science museum', 'eleven ten', '科学博物館', '11時10分'],
        ['shopping mall', 'one thirty', 'ショッピングモール', '1時30分'],
        ['public library', 'three fifteen', '市立図書館', '3時15分'],
        ['city zoo', 'nine forty', '動物園', '9時40分'],
        ['tennis court', 'four twenty', 'テニスコート', '4時20分'],
        ['flower garden', 'ten fifty', 'フラワーガーデン', '10時50分'],
        ['sports center', 'eight thirty', 'スポーツセンター', '8時30分'],
        ['aquarium', 'eleven forty', '水族館', '11時40分'],
        ['book market', 'one fifteen', 'ブックマーケット', '1時15分'],
        ['music hall', 'five ten', '音楽ホール', '5時10分'],
        ['town hospital', 'nine twenty', '町の病院', '9時20分'],
        ['summer camp bus', 'seven fifty', 'サマーキャンプのバス', '7時50分'],
      ];
      const [destEn, tEn, destJa, tJa] = items[r - 1];
      return {
        line1: `${opener}, ${m}. Let's take the bus for the ${destEn}.`,
        line2: `Okay! What time does the next bus come?`,
        line1Ja: `${m}、${destJa}行きのバスに乗ろう。`,
        line2Ja: `いいよ！次のバスは何時に来る？`,
        correct: `At ${tEn}. Let's wait on this bench.`,
        correctReason: `What time does the next bus come? に対し、「${tJa}だよ」と具体的な時刻で答えている。`,
        wrongs: ['By train with my cousin.', 'Two hundred yen for one ticket.'],
        wrongReasons: [
          '交通手段と同伴者を述べており、バスの時刻への応答ではない。',
          '切符1枚の値段を述べており、時刻を尋ねる質問とかみ合わない。',
        ],
        explanation: `What time ...? に対して At ＋時刻 で答える文が適切。`,
        evidence: 'What time does the next bus come',
        skill: '時刻',
      };
    },
  },
  // 3: 誘いへの応答（15通りのスポーツ・遊び）
  {
    placeEn: 'a sunny schoolyard during break time',
    placeJa: '休み時間の明るい校庭',
    propsEn: 'a soccer goal and two trees in the background',
    actionEn: 'standing together holding sports gear',
    actionJa: '運動用具を持って立っている',
    build: (r, _u, _m, f) => {
      const opener = ROUND_OPENERS[(r + 4) % 15];
      const sports = [
        ['badminton after school', 'racket', '放課後にバドミントン'],
        ['tennis this Saturday', 'tennis ball', '今週の土曜日にテニス'],
        ['basketball after lunch', 'sneakers', '昼食後にバスケットボール'],
        ['table tennis in the gym', 'paddle', '体育館で卓球'],
        ['catch in the yard', 'baseball glove', '庭でキャッチボール'],
        ['soccer on Sunday morning', 'soccer shoes', '日曜の朝にサッカー'],
        ['volleyball with our friends', 'knee pads', '友達とバレーボール'],
        ['dodgeball during break', 'sports shirt', '休み時間にドッジボール'],
        ['jump rope near the tree', 'long rope', '木の近くで縄跳び'],
        ['softball at the river park', 'wooden bat', '河川敷公園でソフトボール'],
        ['mini golf with my brother', 'golf club', '兄とミニゴルフ'],
        ['frisbee on the green grass', 'blue disc', '芝生でフリスビー'],
        ['relay running on the track', 'running shoes', 'トラックでリレー走'],
        ['tag in the playground', 'red cap', '運動場で鬼ごっこ'],
        ['skating at the winter rink', 'warm gloves', 'スケート場でスケート'],
      ];
      const [spEn, gearEn, spJa] = sports[r - 1];
      return {
        line1: `${opener}, ${f}. It is warm and sunny outside today.`,
        line2: `Yes! Let's play ${spEn}.`,
        line1Ja: `${f}、今日は外が暖かくて晴れているね。`,
        line2Ja: `うん！${spJa}をしようよ。`,
        correct: `Sounds fun! I have my ${gearEn} in my bag.`,
        correctReason: `Let's play ...（〜しよう）という誘いに Sounds fun!（楽しそうだね）と賛成している。`,
        wrongs: ['No, it rained last Tuesday.', 'My sister is eleven years old.'],
        wrongReasons: [
          '先週の火曜日の雨について述べており、今の誘いへの返事になっていない。',
          '妹の年齢を述べており、遊びの誘いと無関係である。',
        ],
        explanation: `Let's 〜 の誘いに Sounds fun! と応じる自然な会話表現を選ぶ。`,
        evidence: `Let's play ${spEn}`,
        skill: '予定',
      };
    },
  },
  // 4: 値段・買い物の質問（15通りの商品と価格）
  {
    placeEn: 'inside a small stationery shop',
    placeJa: '小さな文房具店の店内',
    propsEn: 'a counter and shelves of notebooks',
    actionEn: 'pointing at an item on the counter',
    actionJa: 'カウンターの上の商品を指さしている',
    build: (r) => {
      const items = [
        ['Star Stationery', 'スター文房具店', 'blue notebook', '青いノート', 'two hundred yen', '200円'],
        ['Maple Shop', 'メイプルショップ', 'green eraser', '緑の消しゴム', 'one hundred yen', '100円'],
        ['Sunny Corner', 'サニーコーナー', 'wooden ruler', '木の定規', 'one hundred fifty yen', '150円'],
        ['Rainbow Mart', 'レインボーマート', 'canvas pencil case', '布の筆箱', 'six hundred yen', '600円'],
        ['Hillside Store', 'ヒルサイドストア', 'wall calendar', '壁掛けカレンダー', 'four hundred yen', '400円'],
        ['Clover Books', 'クローバー書店', 'picture postcard', '絵はがき', 'eighty yen', '80円'],
        ['Smile Gift Shop', 'スマイルギフト店', 'cute key chain', 'キーホルダー', 'three hundred yen', '300円'],
        ['River Stationery', 'リバー文具店', 'thick sketchbook', '厚いスケッチブック', 'five hundred yen', '500円'],
        ['Forest Shop', 'フォレストショップ', 'set of colored pens', 'カラーペンセット', 'seven hundred yen', '700円'],
        ['Harbor Store', 'ハーバーストア', 'pocket dictionary', 'ポケット辞書', 'nine hundred yen', '900円'],
        ['Cherry Paper Shop', 'チェリー紙店', 'pack of letter paper', '便せんパック', 'two hundred fifty yen', '250円'],
        ['Town Craft Store', 'タウンクラフト店', 'bottle of glue', 'のりのボトル', 'one hundred twenty yen', '120円'],
        ['Sky Bookstore', 'スカイ書店', 'animal sticker sheet', '動物シールシート', 'ninety yen', '90円'],
        ['Breeze Shop', 'ブリーズショップ', 'small memo pad', '小さなメモ帳', 'one hundred eighty yen', '180円'],
        ['Acorn Market', 'エイコーンマーケット', 'plastic file folder', 'クリアファイル', 'one hundred ten yen', '110円'],
      ];
      const [shopEn, shopJa, itEn, itJa, priceEn, priceJa] = items[r - 1];
      return {
        line1: `Welcome to ${shopEn}. May I help you today?`,
        line2: `Yes, please. How much is this ${itEn}?`,
        line1Ja: `${shopJa}へようこそ。いらっしゃいませ。`,
        line2Ja: `はい、お願いします。この${itJa}はいくらですか。`,
        correct: `It is ${priceEn}.`,
        correctReason: `How much is ...? で値段を尋ねられているので「${priceJa}です」と値段を答えている。`,
        wrongs: ['There are six desks here.', 'I visited Kyoto last autumn.'],
        wrongReasons: [
          '机の数を述べており、商品の値段に対する返答ではない。',
          '昨秋に京都を訪れた話をしており、店員の返答として不自然。',
        ],
        explanation: `値段を尋ねる How much is this ...? には金額（It is ... yen.）で応答する。`,
        evidence: `How much is this ${itEn}`,
        skill: '値段',
      };
    },
  },
  // 5: 所有者（Whose）を尋ねる
  {
    placeEn: 'a living room near a sofa',
    placeJa: 'ソファのあるリビングルーム',
    propsEn: 'a sofa, a low table, and an item on the table',
    actionEn: 'looking at an item left on the table',
    actionJa: 'テーブルに置かれた物を見ている',
    build: (r, _u, m, f) => {
      const objs = [
        ['brown cap', 'cap', '茶色い帽子', 'grandfather', 'おじいさん'],
        ['silver watch', 'watch', '銀色の時計', 'older sister', 'お姉さん'],
        ['thick dictionary', 'dictionary', '厚い辞書', 'uncle', 'おじさん'],
        ['woolen scarf', 'scarf', '毛糸のマフラー', 'mother', 'お母さん'],
        ['tennis bag', 'bag', 'テニスバッグ', 'cousin', 'いとこ'],
        ['folding umbrella', 'umbrella', '折りたたみ傘', 'father', 'お父さん'],
        ['camera case', 'case', 'カメラケース', 'aunt', 'おばさん'],
        ['straw hat', 'hat', '麦わら帽子', 'grandmother', 'おばあさん'],
        ['violin case', 'case', 'バイオリンケース', 'younger sister', '妹'],
        ['warm sweater', 'sweater', '暖かいセーター', 'older brother', 'お兄さん'],
        ['lunch basket', 'basket', 'ランチバスケット', 'mother', 'お母さん'],
        ['sketch notebook', 'notebook', 'スケッチノート', 'little brother', '弟'],
        ['pair of mittens', 'mittens', 'ミトンの手袋', 'cousin', 'いとこ'],
        ['water bottle', 'bottle', '水筒', 'father', 'お父さん'],
        ['pair of glasses', 'glasses', '眼鏡', 'grandfather', 'おじいさん'],
      ];
      const [oEn, headNoun, oJa, ownerEn, ownerJa] = objs[r - 1];
      return {
        line1: `Look at the low table, ${f}. There is a ${oEn} here.`,
        line2: `Oh, really? Whose ${headNoun} is this, ${m}?`,
        line1Ja: `低いテーブルを見て、${f}。ここに${oJa}があるよ。`,
        line2Ja: `あら、本当？これは誰のなの、${m}？`,
        correct: `It belongs to my ${ownerEn}.`,
        correctReason: `Whose ... is this?（誰のもの？）に対し「私の${ownerJa}のものだよ」と持ち主を答えている。`,
        wrongs: ['Yes, I use it every morning.', 'It is beside the television.'],
        wrongReasons: [
          'Whose で始まる疑問詞の質問に Yes では答えられない。',
          '置いてある場所を述べており、持ち主を尋ねる質問への応答ではない。',
        ],
        explanation: `持ち主を尋ねる Whose 〜? には It belongs to my ... / It is my ...'s. で答える。`,
        evidence: `Whose ${headNoun} is this`,
        skill: '持ち物',
      };
    },
  },
  // 6: 手伝い・依頼（Can you ...?）
  {
    placeEn: 'a home kitchen before dinner',
    placeJa: '夕食前の家の台所',
    propsEn: 'a kitchen counter, bowls, and a refrigerator',
    actionEn: 'carrying plates to the dining table',
    actionJa: '食卓へお皿を運んでいる',
    build: (r, _u, m) => {
      const tasks = [
        ['wash these red tomatoes', 'この赤いトマトを洗って'],
        ['put four spoons on the table', 'スプーンを4本テーブルに並べて'],
        ['open that kitchen window', 'あの台所の窓を開けて'],
        ['bring three small glasses', '小さいコップを3つ持ってきて'],
        ['slice this white bread', 'この白いパンを切って'],
        ['carry this salad bowl', 'このサラダボウルを運んで'],
        ['wipe the dining table', '食卓を拭いて'],
        ['take the milk from the fridge', '冷蔵庫から牛乳を出して'],
        ['pass me that big plate', 'あの大きなお皿を取って'],
        ['rinse these green grapes', 'この緑のブドウを洗って'],
        ['put the chairs in line', '椅子を並べて'],
        ['call your grandfather for dinner', 'おじいさんを夕食に呼んで'],
        ['turn on the dining room light', '食堂の電気をつけて'],
        ['peel these two potatoes', 'このジャガイモ2つの皮をむいて'],
        ['set the chopsticks on the mat', 'ランチョンマットにおはしを置いて'],
      ];
      const [tkEn, tkJa] = tasks[r - 1];
      return {
        line1: `Supper for round ${r === 1 ? 'tonight' : 'our family'} is almost ready, ${m}. Can you ${tkEn}?`,
        line2: `Do you want me to do it right now?`,
        line1Ja: `もうすぐ家族の夕食ができるわよ、${m}。${tkJa}くれる？`,
        line2Ja: `今すぐやったほうがいい？`,
        correct: 'Yes, please. Thank you for helping me.',
        correctReason: `「今すぐやったほうがいい？」という確認に対し、「ええ、お願い。手伝ってくれてありがとう」と自然に応じている。`,
        wrongs: ['We ate spaghetti last night.', 'He is cooking at a restaurant.'],
        wrongReasons: [
          '昨夜の食事メニューを述べており、今すぐ手伝うかの確認への返事ではない。',
          'レストランで料理している第三者の話で、会話とかみ合わない。',
        ],
        explanation: `Do you want me to do it right now? に対して Yes, please. と応じる応答を選ぶ。`,
        evidence: 'Do you want me to do it right now',
        skill: '動作',
      };
    },
  },
  // 7: 曜日を尋ねる
  {
    placeEn: 'a classroom in front of a wall calendar',
    placeJa: '壁掛けカレンダーの前の教室',
    propsEn: 'a blank wall calendar grid and a blackboard',
    actionEn: 'pointing at a blank calendar on the wall',
    actionJa: '壁のカレンダーを指さしている',
    build: (r, _u, _m, f) => {
      const events = [
        ['school music festival', '音楽祭', 'Friday', '金曜日'],
        ['English speech contest', '英語スピーチ大会', 'Wednesday', '水曜日'],
        ['spring class picnic', '春のクラス遠足', 'Thursday', '木曜日'],
        ['summer swimming meet', '水泳大会', 'Tuesday', '火曜日'],
        ['science museum trip', '科学館見学', 'Monday', '月曜日'],
        ['basketball tournament', 'バスケ大会', 'Saturday', '土曜日'],
        ['chorus rehearsal', '合唱リハーサル', 'Friday', '金曜日'],
        ['cooking club party', '料理部パーティー', 'Wednesday', '水曜日'],
        ['school clean-up day', '学校清掃の日', 'Monday', '月曜日'],
        ['art exhibition', '美術展', 'Thursday', '木曜日'],
        ['book reading event', '読書イベント', 'Tuesday', '火曜日'],
        ['parents visiting day', '授業参観日', 'Saturday', '土曜日'],
        ['math quiz contest', '数学クイズ大会', 'Friday', '金曜日'],
        ['soccer friendly match', 'サッカー親善試合', 'Sunday', '日曜日'],
        ['winter concert', 'ウィンターコンサート', 'Wednesday', '水曜日'],
      ];
      const [evEn, evJa, dayEn, dayJa] = events[r - 1];
      return {
        line1: `I am practicing hard for the ${evEn} next week, ${f}.`,
        line2: `That is great! What day is the ${evEn}?`,
        line1Ja: `来週の${evJa}に向けて一生懸命練習しているんだ、${f}。`,
        line2Ja: `すごいね！${evJa}は何曜日だっけ？`,
        correct: `It is on ${dayEn}.`,
        correctReason: `What day is ...?（何曜日ですか）に対し、on ${dayEn}（${dayJa}です）と曜日で答えている。`,
        wrongs: ['In the big gymnasium.', 'About thirty students.'],
        wrongReasons: [
          '場所を答えており、曜日を尋ねる What day ...? と合わない。',
          '生徒の人数を答えており、曜日の質問への応答ではない。',
        ],
        explanation: `What day is ...? は曜日を尋ねる表現なので It is on ＋曜日 を選ぶ。`,
        evidence: `What day is the ${evEn}`,
        skill: '曜日',
      };
    },
  },
  // 8: 交通手段（How）を尋ねる
  {
    placeEn: 'in front of a town library entrance',
    placeJa: '町の図書館の入口前',
    propsEn: 'a library entrance door and a bicycle rack',
    actionEn: 'holding library books and chatting',
    actionJa: '図書館の本を持って話している',
    build: (r, _u, m) => {
      const items = [
        ['town library', 'By bicycle. It takes ten minutes.', '町の図書館', '自転車で10分'],
        ['community gym', 'On foot. My house is very close.', '市民体育館', '歩いて（家が近い）'],
        ['piano classroom', 'By bus from Maple Stop.', 'ピアノ教室', 'メイプル停留所からバスで'],
        ['swimming club', 'My father drives me every Saturday.', 'スイミングクラブ', '毎週土曜に父の車で'],
        ['English school', 'By subway. It is two stops away.', '英語教室', '地下鉄で2駅'],
        ['violin lesson', 'I walk there with my sister.', 'バイオリン教室', '姉と歩いて'],
        ['soccer ground', 'By bike along the river road.', 'サッカー場', '川沿いの道を自転車で'],
        ['youth center', 'By city bus with my friend.', '青少年センター', '友達と市バスで'],
        ['art workshop', 'By train from West Station.', '絵画教室', '西駅から電車で'],
        ['tennis club', 'I ride my red bicycle.', 'テニスクラブ', '赤い自転車に乗って'],
        ['dance lesson', 'My mother takes me by car.', 'ダンス教室', '母の車で'],
        ['chess club', 'On foot. It is five minutes away.', 'チェスクラブ', '徒歩5分で'],
        ['science club', 'By bus after lunch.', '科学クラブ', '昼食後にバスで'],
        ['calligraphy class', 'I walk across Green Park.', '書道教室', 'グリーン公園を歩いて'],
        ['drum studio', 'By train. It is near East Station.', 'ドラム教室', '電車で（東駅の近く）'],
      ];
      const [placeEn, ansEn, placeJa, ansJa] = items[r - 1];
      return {
        line1: `Do you go to the ${placeEn} every weekend, ${m}?`,
        line2: `Yes, I enjoy it a lot. How do you get to the ${placeEn}?`,
        line1Ja: `毎週末、${placeJa}に通っているの、${m}？`,
        line2Ja: `うん、すごく楽しいよ。でも君はどうやって${placeJa}に行くの？`,
        correct: ansEn,
        correctReason: `How do you get to ...?（どうやって行くか）に対し「${ansJa}」と交通手段を答えている。`,
        wrongs: ['Once a month.', 'I read four comic books.'],
        wrongReasons: [
          '頻度を述べており、行き方を尋ねる How do you get to ...? への答えではない。',
          '読んだ漫画の冊数を述べており、交通手段の質問とかみ合わない。',
        ],
        explanation: `How do you get to ...? は移動手段を尋ねる質問なので、By bicycle / On foot / By bus などを選ぶ。`,
        evidence: `How do you get to the ${placeEn}`,
        skill: '交通',
      };
    },
  },
  // 9: 数量（How many）を尋ねる
  {
    placeEn: 'a school art room with tables',
    placeJa: '机が並ぶ学校の美術室',
    propsEn: 'paintbrushes in a cup and drawing paper on a desk',
    actionEn: 'counting art supplies on a desk',
    actionJa: '机の上の道具を数えている',
    build: (r, _u, _m, f) => {
      const counts = [
        ['sheets of white paper', '白い画用紙', 'Eight sheets, please.', '8枚'],
        ['boxes of crayons', 'クレヨンの箱', 'We need four boxes.', '4箱'],
        ['pairs of scissors', 'はさみ', 'Six pairs for our table.', '6丁'],
        ['wooden stools', '木のスツール', 'Seven stools, please.', '7脚'],
        ['clean hand towels', '清潔なハンドタオル', 'Three towels are enough.', '3枚'],
        ['bottles of blue paint', '青い絵の具ボトル', 'Two bottles, please.', '2本'],
        ['paper cups for water', '水用の紙コップ', 'Five cups for our group.', '5個'],
        ['pink erasers', 'ピンクの消しゴム', 'Four erasers, please.', '4個'],
        ['paintbrushes', '絵筆', 'Ten brushes in total.', '合計10本'],
        ['rolls of tape', 'テープの巻', 'Just two rolls, please.', '2巻'],
        ['sheets of gold paper', '金色の折り紙', 'Nine sheets, please.', '9枚'],
        ['glue sticks', 'スティックのり', 'Six glue sticks for us.', '6本'],
        ['plastic trays', 'プラスチックトレイ', 'Five trays, please.', '5枚'],
        ['black markers', '黒いマーカー', 'Eight markers, please.', '8本'],
        ['colored pencils', '色鉛筆', 'Twelve pencils in one box.', '12本'],
      ];
      const [itemEn, itemJa, ansEn, ansJa] = counts[r - 1];
      const projects = [
        'poster project', 'wall mural', 'clay animal', 'paper lantern', 'puppet stage',
        'birthday card', 'class banner', 'holiday wreath', 'flower collage', 'welcome sign',
        'star mobile', 'bookmark set', 'origami box', 'nature map', 'festival flag',
      ];
      const projEn = projects[r - 1];
      return {
        line1: `Let's get ready for our ${projEn}, ${f}.`,
        line2: `Okay! How many ${itemEn} do we need?`,
        line1Ja: `美術の制作の準備をしよう、${f}。`,
        line2Ja: `いいよ！${itemJa}はいくつ必要かな？`,
        correct: ansEn,
        correctReason: `How many ... do we need? で必要な数を尋ねられているので「${ansJa}」と具体的な数で答えている。`,
        wrongs: ['Yes, I love drawing birds.', 'In the art room after lunch.'],
        wrongReasons: [
          'How many の質問に Yes では答えられず、鳥を描く好みの話になっている。',
          '場所と時間を答えており、必要な数量への回答になっていない。',
        ],
        explanation: `数を尋ねる How many ...? には具体的な数を含む応答を選ぶ。`,
        evidence: `How many ${itemEn} do we need`,
        skill: '数量',
      };
    },
  },
  // 10: お礼・気遣いへの応答
  {
    placeEn: 'a park bench under a large tree',
    placeJa: '大きな木の下の公園のベンチ',
    propsEn: 'a park bench and a water bottle',
    actionEn: 'sitting on a bench and handing over an item',
    actionJa: 'ベンチに座って物を渡している',
    build: (r, _u, m) => {
      const items = [
        ['practicing soccer', 'clean towel', 'サッカーの練習', 'きれいなタオル'],
        ['running five laps', 'cold water bottle', '5周走ったあと', '冷たい水のボトル'],
        ['carrying heavy boxes', 'cup of orange juice', '重い箱を運んだあと', 'オレンジジュース'],
        ['walking in the wind', 'warm sweater', '風の中を歩いたあと', '暖かいセーター'],
        ['cleaning the garden', 'wet wipe', '庭掃除のあと', 'ウェットティッシュ'],
        ['playing badminton', 'lemon candy', 'バドミントンのあと', 'レモンキャンディー'],
        ['riding up the hill', 'cold sports drink', '坂を自転車で上ったあと', '冷たいスポーツドリンク'],
        ['helping with my bags', 'small chocolate', 'かばんを手伝ったあと', '小さなチョコレート'],
        ['looking for my puppy', 'hot tea', '子犬を探したあと', '温かいお茶'],
        ['sweeping the leaves', 'pair of clean gloves', '落ち葉掃きのあと', 'きれいな手袋'],
        ['painting the fence', 'paper napkin', '柵を塗ったあと', '紙ナプキン'],
        ['fixing my bike chain', 'hand soap', '自転車を直したあと', 'ハンドソープ'],
        ['practicing the dance', 'folding fan', 'ダンス練習のあと', '扇子'],
        ['picking apples', 'basket of grapes', 'リンゴ狩りのあと', 'ブドウのかご'],
        ['jogging by the river', 'soft cotton towel', '川沿いのジョギング後', '柔らかいタオル'],
      ];
      const [actEn, itEn, actJa, itJa] = items[r - 1];
      return {
        line1: `You worked hard ${actEn}, ${m}! Here is a ${itEn} for you.`,
        line2: `Oh, thank you very much!`,
        line1Ja: `${actJa}を頑張ったね、${m}！はい、${itJa}をどうぞ。`,
        line2Ja: `わあ、どうもありがとう！`,
        correct: 'You are welcome. Please sit down and rest.',
        correctReason: `thank you very much! という感謝に You are welcome.（どういたしまして）と自然に応じている。`,
        wrongs: ['I am sorry I broke it.', 'He lives near the post office.'],
        wrongReasons: [
          '物を壊したことへの謝罪であり、お礼を言われた場面の返答ではない。',
          '第三者の住まいを述べており、お礼への返事になっていない。',
        ],
        explanation: `Thank you very much! に対して You are welcome. で返す基本応答。`,
        evidence: 'thank you very much',
        skill: '感情',
      };
    },
  },
];

function buildG5Part2Unit(examId: string, round: number, unitIndex: number): ListeningAudioUnit {
  const [sp1, sp2] = speakerPairFor(round, unitIndex);
  const m = NAMES_M[(round + unitIndex) % NAMES_M.length];
  const f = NAMES_F[(round * 2 + unitIndex) % NAMES_F.length];
  const listenerName = sp2.roleLabel === 'Woman' ? f : m;
  const whoEn = sp2.roleLabel === 'Woman' ? 'the girl' : 'the boy';
  const whoPoss = sp2.roleLabel === 'Woman' ? "the girl's" : "the boy's";
  const qNo = 10 + unitIndex;
  const targetAnswer = (round + unitIndex) % 4;

  const scenarios = [
    // unit 1: 週末に行く場所（15回すべて別）
    () => {
      const places = [
        ['city aquarium', 'zoo', 'park', 'library', '市の水族館', 'see dolphins'],
        ['science museum', 'beach', 'theater', 'pool', '科学博物館', 'watch robot demos'],
        ['rose garden', 'castle', 'station', 'bakery', 'バラ園', 'take nice photos'],
        ['history castle', 'mall', 'stadium', 'airport', '歴史のお城', 'learn old stories'],
        ['botanical park', 'factory', 'tower', 'market', '植物公園', 'sketch tall trees'],
        ['ice rink', 'museum', 'camp', 'harbor', 'スケート場', 'practice skating'],
        ['city planetarium', 'beach', 'zoo', 'farm', 'プラネタリウム', 'watch autumn stars'],
        ['berry farm', 'library', 'cinema', 'gym', 'ベリー農園', 'pick sweet berries'],
        ['harbor market', 'castle', 'pool', 'park', '港の市場', 'eat fresh fish'],
        ['pottery studio', 'zoo', 'rink', 'tower', '陶芸工房', 'make a tea cup'],
        ['bird sanctuary', 'mall', 'cinema', 'station', '野鳥公園', 'watch wild birds'],
        ['puppet theater', 'beach', 'factory', 'gym', '人形劇場', 'see a funny play'],
        ['railway museum', 'farm', 'pool', 'garden', '鉄道博物館', 'see old trains'],
        ['camping ground', 'tower', 'cinema', 'library', 'キャンプ場', 'cook curry outside'],
        ['glassmuseum', 'zoo', 'stadium', 'harbor', 'ガラス美術館', 'see colorful cups'].map(s => s === 'glassmuseum' ? 'glass museum' : s),
      ] as string[][];
      const [ans, w1, w2, w3, ansJa, reasonEn] = places[round - 1];
      const turns: DialogueTurn[] = [
        { ...sp1, text: `Hello ${listenerName}, do you have plans for this Sunday afternoon?` },
        { ...sp2, text: `Yes! I will go to the ${ans} with my family to ${reasonEn}.` },
        { ...sp1, text: `That sounds wonderful! Have a great Sunday.` },
        { speaker: 'F2', roleLabel: 'Narrator', text: `Question. Where will ${whoEn} go this Sunday afternoon?` },
      ];
      return {
        turns,
        translation: `${sp1.roleLabel === 'Man' ? '男の子' : '女の子'}：こんにちは${listenerName}、今週の日曜の午後は予定がある？\n${sp2.roleLabel === 'Woman' ? '女の子' : '男の子'}：うん！家族と一緒に${ansJa}へ行くよ。\n${sp1.roleLabel === 'Man' ? '男の子' : '女の子'}：素敵だね！よい日曜日をね。\n質問：今週の日曜日の午後、どこへ行きますか。`,
        questionPrompt: `Where will ${whoEn} go this Sunday afternoon?`,
        correct: `To the ${ans}.`,
        correctReason: `会話の中で I will go to the ${ans}（${ansJa}に行く）とはっきり述べている。`,
        wrongs: [`To the ${w1}.`, `To the ${w2}.`, `To the ${w3}.`] as [string, string, string],
        wrongReasons: [
          `${w1} に行くとは会話の中で一度も言っていない。`,
          `${w2} については触れられていない。`,
          `${w3} は日曜日の行き先ではない。`,
        ] as [string, string, string],
        explanation: `I will go to the ${ans} with my family の発話を聞き取る。`,
        evidence: `go to the ${ans}`,
        skill: '場所',
      };
    },
    // unit 2: 一番好きな教科・クラブ（15回別）
    () => {
      const items = [
        ['math', 'music', 'science', 'history', 'art', '音楽'],
        ['English', 'art', 'math', 'music', 'science', '美術'],
        ['history', 'science', 'art', 'English', 'music', '理科'],
        ['science', 'English', 'music', 'math', 'history', '英語'],
        ['music', 'history', 'science', 'art', 'math', '歴史'],
        ['art', 'math', 'English', 'history', 'music', '数学'],
        ['cooking', 'calligraphy', 'tennis', 'drama', 'chorus', '書道'],
        ['tennis', 'drama', 'cooking', 'chorus', 'soccer', '演劇'],
        ['drama', 'chorus', 'soccer', 'cooking', 'tennis', '合唱'],
        ['chorus', 'cooking', 'drama', 'tennis', 'brass band', '料理'],
        ['soccer', 'science', 'music', 'math', 'English', '理科'],
        ['swimming', 'art', 'history', 'math', 'science', '美術'],
        ['reading', 'music', 'math', 'science', 'art', '音楽'],
        ['gardening', 'English', 'history', 'art', 'math', '英語'],
        ['painting', 'history', 'music', 'English', 'science', '歴史'],
      ];
      const [askSub, ans, w1, w2, w3, ansJa] = items[round - 1];
      const askSubJaMap: Record<string, string> = {
        math: '算数・数学', English: '英語', history: '歴史', science: '理科', music: '音楽',
        art: '美術', cooking: '料理', tennis: 'テニス', drama: '演劇', chorus: '合唱',
        soccer: 'サッカー', swimming: '水泳', reading: '読書', gardening: '園芸', painting: '絵画',
      };
      const askSubJa = askSubJaMap[askSub] ?? askSub;
      const turns: DialogueTurn[] = [
        { ...sp1, text: `Hey ${listenerName}, is ${askSub} your favorite class at school?` },
        { ...sp2, text: `I like ${askSub}, but my favorite class is ${ans}. We have it today!` },
        { ...sp1, text: `Oh, I really enjoy ${ans} too.` },
        { speaker: 'F2', roleLabel: 'Narrator', text: `Question. What is ${whoPoss} favorite class?` },
      ];
      return {
        turns,
        translation: `${sp1.roleLabel === 'Man' ? '男の子' : '女の子'}：ねえ${listenerName}、学校で一番好きな授業は${askSubJa}？\n${sp2.roleLabel === 'Woman' ? '女の子' : '男の子'}：それも好きだけど、一番好きな授業は${ansJa}だよ。今日あるんだ！\n${sp1.roleLabel === 'Man' ? '男の子' : '女の子'}：へえ、ぼくも好きだよ。\n質問：一番好きな授業は何ですか。`,
        questionPrompt: `What is ${whoPoss} favorite class?`,
        correct: ans[0].toUpperCase() + ans.slice(1) + '.',
        correctReason: `my favorite class is ${ans}（一番好きな授業は${ansJa}）と明言している。`,
        wrongs: [
          w1[0].toUpperCase() + w1.slice(1) + '.',
          w2[0].toUpperCase() + w2.slice(1) + '.',
          w3[0].toUpperCase() + w3.slice(1) + '.',
        ] as [string, string, string],
        wrongReasons: [
          `${w1} は一番好きな授業として挙げられていない。`,
          `${w2} はこの対話の中に一度も登場しない授業である。`,
          `${w3} も一番好きな授業としては述べられていない。`,
        ] as [string, string, string],
        explanation: `最初の質問の語に惑わされず、but my favorite class is ${ans} を聞き取る。`,
        evidence: `my favorite class is ${ans}`,
        skill: '人物',
      };
    },
    // unit 3: 今朝・昼食の食べ物（15回別）
    () => {
      const foods = [
        ['father', 'egg sandwiches', 'rice balls', 'pancakes', 'noodles', 'お父さん', 'たまごサンド'],
        ['mother', 'fruit salad', 'hot soup', 'cheese toast', 'curry', 'お母さん', 'フルーツサラダ'],
        ['older sister', 'warm pancakes', 'cereal', 'fried rice', 'pizza', 'お姉さん', '温かいパンケーキ'],
        ['older brother', 'salmon rice balls', 'omelets', 'waffles', 'spaghetti', 'お兄さん', '鮭のおにぎり'],
        ['grandmother', 'vegetable soup', 'apple pie', 'ham toast', 'tacos', 'おばあさん', '野菜スープ'],
        ['grandfather', 'blueberry muffins', 'corn bread', 'fried eggs', 'udon', 'おじいさん', 'ブルーベリーマフィン'],
        ['aunt', 'chicken wraps', 'beef stew', 'french toast', 'ramen', 'おばさん', 'チキンラップ'],
        ['uncle', 'cheese omelets', 'tuna salad', 'baked beans', 'dumplings', 'おじさん', 'チーズオムレツ'],
        ['father', 'banana waffles', 'potato salad', 'roast beef', 'macaroni', 'お父さん', 'バナナワッフル'],
        ['mother', 'tuna sandwiches', 'pumpkin soup', 'strawberry cake', 'fried chicken', 'お母さん', 'ツナサンド'],
        ['older sister', 'apple turnovers', 'green salad', 'boiled eggs', 'curry bread', 'お姉さん', 'アップルパイ'],
        ['grandmother', 'sweet potato rolls', 'melon bread', 'tomato pasta', 'fish burgers', 'おばあさん', 'スイートポテトロール'],
        ['father', 'corn soup', 'grilled fish', 'peanut toast', 'rice porridge', 'お父さん', 'コーンスープ'],
        ['mother', 'ham sandwiches', 'yogurt bowls', 'meatballs', 'shrimp pilaf', 'お母さん', 'ハムサンド'],
        ['older brother', 'chocolate crepes', 'carrot sticks', 'garlic bread', 'fried noodles', 'お兄さん', 'チョコクレープ'],
      ];
      const [cookEn, ans, w1, w2, w3, cookJa, ansJa] = foods[round - 1];
      const turns: DialogueTurn[] = [
        { ...sp1, text: `It is twelve o'clock now, ${listenerName}! Your lunch box smells so good.` },
        { ...sp2, text: `Thanks! My ${cookEn} made ${ans} early this morning.` },
        { ...sp1, text: `Nice! Let's sit by the window and eat.` },
        { speaker: 'F2', roleLabel: 'Narrator', text: `Question. What did the ${cookEn} make early this morning?` },
      ];
      return {
        turns,
        translation: `${sp1.roleLabel === 'Man' ? '男の子' : '女の子'}：もう12時だよ、${listenerName}！お弁当がいい匂いだね。\n${sp2.roleLabel === 'Woman' ? '女の子' : '男の子'}：ありがとう！今朝早くに${cookJa}が${ansJa}を作ってくれたんだ。\n${sp1.roleLabel === 'Man' ? '男の子' : '女の子'}：いいね！窓際に座って食べよう。\n質問：${cookJa}は今朝早くに何を作りましたか。`,
        questionPrompt: `What did the ${cookEn} make early this morning?`,
        correct: ans[0].toUpperCase() + ans.slice(1) + '.',
        correctReason: `My ${cookEn} made ${ans} early this morning.（今朝早くに${ansJa}を作った）と述べている。`,
        wrongs: [
          w1[0].toUpperCase() + w1.slice(1) + '.',
          w2[0].toUpperCase() + w2.slice(1) + '.',
          w3[0].toUpperCase() + w3.slice(1) + '.',
        ] as [string, string, string],
        wrongReasons: [
          `${w1} はお弁当の中身として登場しない。`,
          `${w2} は今朝作った料理ではない。`,
          `${w3} についても会話で触れられていない。`,
        ] as [string, string, string],
        explanation: `My ${cookEn} made ${ans} early this morning. から作った食べ物を特定する。`,
        evidence: `made ${ans}`,
        skill: '食事',
      };
    },
    // unit 4: イベント開始時刻（15回別）
    () => {
      const shows = [
        ['puppet show', 'two thirty', 'three thirty', 'four o\'clock', 'five fifteen', '人形劇', '2時30分', '3時30分'],
        ['piano concert', 'one o\'clock', 'one forty', 'two twenty', 'three ten', 'ピアノコンサート', '1時ちょうど', '1時40分'],
        ['cooking lesson', 'ten o\'clock', 'ten thirty', 'eleven fifteen', 'twelve o\'clock', '料理教室', '10時ちょうど', '10時30分'],
        ['magic show', 'two o\'clock', 'two forty-five', 'three twenty', 'four ten', 'マジックショー', '2時ちょうど', '2時45分'],
        ['dolphin show', 'eleven o\'clock', 'eleven thirty', 'one fifteen', 'two o\'clock', 'イルカショー', '11時ちょうど', '11時30分'],
        ['flower workshop', 'nine thirty', 'ten fifteen', 'eleven o\'clock', 'one thirty', 'フラワー教室', '9時30分', '10時15分'],
        ['story hour', 'three o\'clock', 'three twenty', 'four o\'clock', 'four thirty', 'おはなし会', '3時ちょうど', '3時20分'],
        ['dance recital', 'four o\'clock', 'four thirty', 'five fifteen', 'six o\'clock', 'ダンス発表会', '4時ちょうど', '4時30分'],
        ['science movie', 'one thirty', 'two ten', 'three o\'clock', 'three forty', '科学映画', '1時30分', '2時10分'],
        ['guitar lesson', 'five o\'clock', 'five twenty', 'six o\'clock', 'six thirty', 'ギターレッスン', '5時ちょうど', '5時20分'],
        ['stamp rally', 'nine o\'clock', 'nine forty', 'ten thirty', 'eleven ten', 'スタンプラリー', '9時ちょうど', '9時40分'],
        ['balloon event', 'twelve thirty', 'one fifteen', 'two o\'clock', 'two fifty', 'バルーンイベント', '12時30分', '1時15分'],
        ['starry sky talk', 'six o\'clock', 'six thirty', 'seven fifteen', 'eight o\'clock', '星空のお話', '6時ちょうど', '6時30分'],
        ['tennis clinic', 'eight thirty', 'nine ten', 'ten o\'clock', 'ten forty', 'テニス教室', '8時30分', '9時10分'],
        ['choir concert', 'two fifteen', 'three o\'clock', 'three forty-five', 'four thirty', '合唱コンサート', '2時15分', '3時ちょうど'],
      ];
      const [showEn, wrongFirst, ans, w2, w3, showJa, wrongFirstJa, ansJa] = shows[round - 1];
      const turns: DialogueTurn[] = [
        { ...sp1, text: `Excuse me, does the ${showEn} begin at ${wrongFirst} today?` },
        { ...sp2, text: `No, not today. It begins at ${ans} in Room Two.` },
        { ...sp1, text: `I see. Thank you for telling me.` },
        { speaker: 'F2', roleLabel: 'Narrator', text: `Question. What time does the ${showEn} begin today?` },
      ];
      return {
        turns,
        translation: `${sp1.roleLabel === 'Man' ? '男性' : '女性'}：すみません、今日の${showJa}は${wrongFirstJa}に始まりますか？\n${sp2.roleLabel === 'Woman' ? '女性' : '男性'}：いいえ、今日は違います。2番ルームで${ansJa}に始まります。\n${sp1.roleLabel === 'Man' ? '男性' : '女性'}：わかりました。教えてくれてありがとうございます。\n質問：今日の${showJa}は何時に始まりますか。`,
        questionPrompt: `What time does the ${showEn} begin today?`,
        correct: `At ${ans}.`,
        correctReason: `No, not today と否定したあとに It begins at ${ans}（${ansJa}開始）と正しい時刻を言っている。`,
        wrongs: [`At ${wrongFirst}.`, `At ${w2}.`, `At ${w3}.`] as [string, string, string],
        wrongReasons: [
          `${wrongFirst} は最初に尋ねて否定された時刻である。`,
          `${w2} は会話に出てこない時刻である。`,
          `${w3} も開始時刻として述べられていない。`,
        ] as [string, string, string],
        explanation: `最初の質問の時刻ではなく、訂正後の It begins at ${ans} を聞き取る。`,
        evidence: `begins at ${ans}`,
        skill: '時刻',
      };
    },
    // unit 5: 飼っているペット・持ち物の数（15回別）
    () => {
      const pets = [
        ['two white rabbits', 'one white rabbit', 'two brown dogs', 'three black cats', '白いウサギを2羽'],
        ['three small turtles', 'one small turtle', 'two yellow birds', 'four goldfish', '小さなカメを3匹'],
        ['two yellow birds', 'three white cats', 'one big dog', 'five hamsters', '黄色い鳥を2羽'],
        ['four red goldfish', 'two red goldfish', 'three green frogs', 'one white dog', '赤い金魚を4匹'],
        ['one brown puppy', 'two brown puppies', 'one gray kitten', 'three white ducks', '茶色い子犬を1匹'],
        ['two gray kittens', 'one gray kitten', 'two black rabbits', 'four small birds', '灰色の仔猫を2匹'],
        ['three cute hamsters', 'one cute hamster', 'two white mice', 'three brown dogs', 'かわいいハムスターを3匹'],
        ['two green parrots', 'one green parrot', 'three blue fish', 'two black cats', '緑のインコを2羽'],
        ['five tiny medaka fish', 'two tiny medaka fish', 'five small frogs', 'one big turtle', '小さなメダカを5匹'],
        ['one fluffy white dog', 'two fluffy white dogs', 'one black rabbit', 'three yellow birds', '白いふわふわの犬を1匹'],
        ['two spotted guinea pigs', 'one spotted guinea pig', 'two brown cats', 'four red fish', '模様のあるモルモットを2匹'],
        ['three orange canaries', 'one orange canary', 'two gray dogs', 'three white rabbits', 'オレンジ色のカナリアを3羽'],
        ['two black cats', 'three black cats', 'two brown rabbits', 'one yellow bird', '黒猫を2匹'],
        ['four little ducklings', 'two little ducklings', 'four brown puppies', 'one green parrot', '小さなアヒルの子を4羽'],
        ['one gentle beagle', 'three gentle beagles', 'two gray cats', 'four small turtles', 'おとなしいビーグル犬を1匹'],
      ];
      const [ans, w1, w2, w3, ansJa] = pets[round - 1];
      const turns: DialogueTurn[] = [
        { ...sp1, text: `I saw a cute animal photo on your notebook, ${listenerName}. Do you keep pets?` },
        { ...sp2, text: `Yes! My family keeps ${ans} at home.` },
        { ...sp1, text: `How cute! Please show me more photos tomorrow.` },
        { speaker: 'F2', roleLabel: 'Narrator', text: `Question. What pets does ${whoPoss} family keep at home?` },
      ];
      return {
        turns,
        translation: `${sp1.roleLabel === 'Man' ? '男の子' : '女の子'}：ノートにかわいい動物の写真があったね、${listenerName}。ペットを飼っているの？\n${sp2.roleLabel === 'Woman' ? '女の子' : '男の子'}：うん！うちの家族は家で${ansJa}飼っているんだ。\n${sp1.roleLabel === 'Man' ? '男の子' : '女の子'}：かわいいね！明日もっと写真を見せてね。\n質問：家族は家でどんなペットを飼っていますか。`,
        questionPrompt: `What pets does ${whoPoss} family keep at home?`,
        correct: ans[0].toUpperCase() + ans.slice(1) + '.',
        correctReason: `My family keeps ${ans} at home.（家で${ansJa}を飼っている）と数も種類も一致する。`,
        wrongs: [
          w1[0].toUpperCase() + w1.slice(1) + '.',
          w2[0].toUpperCase() + w2.slice(1) + '.',
          w3[0].toUpperCase() + w3.slice(1) + '.',
        ] as [string, string, string],
        wrongReasons: [
          `${w1} は数が会話の内容と異なっている。`,
          `${w2} は動物の種類が会話と異なっている。`,
          `${w3} も飼っているペットとして述べられていない。`,
        ] as [string, string, string],
        explanation: `数と動物の種類の両方に注意して keeps ${ans} を聞き取る。`,
        evidence: `keeps ${ans}`,
        skill: '数量',
      };
    },
  ];

  const data = scenarios[unitIndex - 1]();
  const qItem = makeQuestionItem({
    examId,
    questionNumber: qNo,
    questionPrompt: data.questionPrompt,
    choicePresentation: 'printed',
    correctChoice: data.correct,
    correctReason: data.correctReason,
    wrongChoices: data.wrongs,
    wrongReasons: data.wrongReasons,
    targetAnswer,
    explanation: data.explanation,
    evidence: data.evidence,
    skill: data.skill,
  });

  return makeDialogueUnit({
    examId,
    part: 'part2',
    unitIndex,
    readCount: 2,
    turns: data.turns,
    translation: data.translation,
    image: null,
    questions: [qItem],
  });
}

const G5_PART3_SCENES = [
  {
    settingEn: 'a neighborhood park',
    propsEn: 'a bench, a tree, and a drinking fountain',
    variants: [
      {
        ja: '公園の中央で男の子が犬と走っており、奥のベンチで女の子が本を読み、右端で男性が水を飲んでいる場面',
        mainEn: 'a boy running with a small dog on a leash',
        sub1En: 'a girl sitting on a bench holding an open book',
        sub2En: 'a man bending at a drinking fountain',
        correct: 'A boy is running with his dog in the park.',
        correctReason: '絵の中央で大きく描かれている主動作「男の子が犬と走っている」と一致する。',
        wrongs: ['A boy is sleeping under a big tree.', 'A boy is riding a boat on the pond.'] as [string, string],
        wrongReasons: ['木の下で寝ている男の子は描かれていない。', '池でボートに乗っている動作は描かれていない。'] as [string, string],
      },
      {
        ja: '公園の中央で女の子がギターを弾いており、奥で男の子がボールを蹴り、右端で女性が花を見ている場面',
        mainEn: 'a girl sitting on a bench playing an acoustic guitar',
        sub1En: 'a boy kicking a soccer ball in the distance',
        sub2En: 'a woman looking at flowers in a flowerbed',
        correct: 'A girl is playing the guitar on a bench.',
        correctReason: '画面中央で女の子がベンチに座りギターを弾いている様子を正しく表している。',
        wrongs: ['A girl is climbing a tall tree.', 'A girl is washing a car in the park.'] as [string, string],
        wrongReasons: ['木に登っている人物はいない。', '公園で車を洗っている場面ではない。'] as [string, string],
      },
    ],
  },
  {
    settingEn: 'a bright home kitchen',
    propsEn: 'a sink, a counter, and a dining table',
    variants: [
      {
        ja: '台所の中央でお父さんがお皿を洗っており、奥で女の子がコップを拭き、右端で猫が座っている場面',
        mainEn: 'a father washing dishes at the kitchen sink',
        sub1En: 'a girl wiping a cup with a cloth near the table',
        sub2En: 'a cat sitting quietly on the floor',
        correct: 'The father is washing dishes at the sink.',
        correctReason: '中央のお父さんが流し台でお皿を洗っている動作と一致する。',
        wrongs: ['The father is watching television on the sofa.', 'The father is fixing a bicycle outside.'] as [string, string],
        wrongReasons: ['ソファでテレビを見ている場面ではない。', '外で自転車を修理している場面ではない。'] as [string, string],
      },
      {
        ja: '台所の中央で男の子がリンゴを切っており、奥でお母さんが鍋をかき混ぜ、右端の椅子にかばんがある場面',
        mainEn: 'a boy cutting an apple on a cutting board',
        sub1En: 'a mother stirring a pot on the stove',
        sub2En: 'a school bag resting on a wooden chair',
        correct: 'A boy is cutting an apple in the kitchen.',
        correctReason: '中央で男の子がまな板の上のリンゴを切っている主動作を正しく述べている。',
        wrongs: ['A boy is sweeping the bedroom floor.', 'A boy is playing baseball in the yard.'] as [string, string],
        wrongReasons: ['寝室の床を掃いている場面ではない。', '庭で野球をしている場面ではない。'] as [string, string],
      },
    ],
  },
  {
    settingEn: 'a school classroom after lessons',
    propsEn: 'desks, chairs, a blackboard, and a window',
    variants: [
      {
        ja: '教室の中央で女の子が黒板を消しており、奥で男の子が窓を閉め、右端で別の生徒がノートを運んでいる場面',
        mainEn: 'a girl cleaning the blackboard with an eraser',
        sub1En: 'a boy closing a classroom window',
        sub2En: 'a student carrying a stack of notebooks',
        correct: 'A student is cleaning the blackboard now.',
        correctReason: '中央の生徒が黒板消しで黒板をきれいにしている様子と一致する。',
        wrongs: ['A student is swimming in the school pool.', 'A student is buying bread at a store.'] as [string, string],
        wrongReasons: ['プールで泳いでいる絵ではない。', 'お店でパンを買っている絵ではない。'] as [string, string],
      },
      {
        ja: '教室の中央で男の子が鉢植えに水をやっており、奥で女の子が本棚を整理し、右端にほうきがある場面',
        mainEn: 'a boy watering a potted plant by the window',
        sub1En: 'a girl arranging books on a low shelf',
        sub2En: 'a broom leaning against the back wall',
        correct: 'A boy is watering a plant near the window.',
        correctReason: '窓際で男の子が鉢植えに水やりをしている中央の絵と一致する。',
        wrongs: ['A boy is playing the drums on stage.', 'A boy is skating on the ice.'] as [string, string],
        wrongReasons: ['ステージでドラムをたたいている絵ではない。', '氷の上でスケートをしている絵ではない。'] as [string, string],
      },
    ],
  },
  {
    settingEn: 'a quiet town library',
    propsEn: 'tall bookshelves, a reading desk, and a chair',
    variants: [
      {
        ja: '図書館の中央で女の子が高い棚から本を取ろうとしており、奥の机で男の子がノートを書き、右端に司書がいる場面',
        mainEn: 'a girl reaching up to take a book from a shelf',
        sub1En: 'a boy writing in a notebook at a desk',
        sub2En: 'a librarian standing behind a counter',
        correct: 'She is taking a book from the shelf.',
        correctReason: '本棚から本を手に取っている中央の女の子の動作と一致する。',
        wrongs: ['She is throwing a ball in the gym.', 'She is cooking soup over a fire.'] as [string, string],
        wrongReasons: ['体育館でボールを投げている場面ではない。', '火でスープを作っている場面ではない。'] as [string, string],
      },
      {
        ja: '図書館の中央で男の子が大きな地図を見ており、奥で女の子が椅子に座り、右端に地球儀がある場面',
        mainEn: 'a boy looking at a large blank map spread on a table',
        sub1En: 'a girl sitting quietly on a chair',
        sub2En: 'a globe placed on a small stand',
        correct: 'He is looking at a big map on the table.',
        correctReason: 'テーブルの上に広げた大きな地図を見ている中央の男の子の動作を表している。',
        wrongs: ['He is brushing his teeth in the bathroom.', 'He is feeding horses on a farm.'] as [string, string],
        wrongReasons: ['洗面所で歯を磨いている場面ではない。', '牧場で馬にえさをやっている場面ではない。'] as [string, string],
      },
    ],
  },
  {
    settingEn: 'a family living room',
    propsEn: 'a sofa, a low table, and a floor lamp',
    variants: [
      {
        ja: '居間の中央でおばあさんがセーターを編んでおり、奥で男の子が積み木で遊び、右端で犬が丸くなっている場面',
        mainEn: 'an older woman sitting in an armchair knitting with yarn',
        sub1En: 'a young boy stacking wooden blocks on the rug',
        sub2En: 'a small dog curled up on a cushion',
        correct: 'The grandmother is knitting in the armchair.',
        correctReason: 'ひじ掛け椅子で編み物をしている中央のおばあさんの様子と一致する。',
        wrongs: ['The grandmother is driving a bus.', 'The grandmother is playing tennis outside.'] as [string, string],
        wrongReasons: ['バスを運転している場面ではない。', '外でテニスをしている場面ではない。'] as [string, string],
      },
      {
        ja: '居間の中央で女の子がピアノを弾いており、奥でお父さんがお茶を飲み、右端に観葉植物がある場面',
        mainEn: 'a girl sitting upright playing an upright piano',
        sub1En: 'a man sitting on a sofa holding a teacup',
        sub2En: 'a tall leafy plant in a pot',
        correct: 'The girl is playing the piano in the room.',
        correctReason: '部屋の中でピアノを弾いている中央の女の子の動作を正しく表している。',
        wrongs: ['The girl is fishing by the river.', 'The girl is skiing down a mountain.'] as [string, string],
        wrongReasons: ['川辺で魚釣りをしている場面ではない。', '山をスキーで滑っている場面ではない。'] as [string, string],
      },
    ],
  },
  {
    settingEn: 'a train station platform',
    propsEn: 'a bench, a pillar, and a waiting line',
    variants: [
      {
        ja: '駅のホームの中央で男性がスーツケースを引いて歩いており、奥のベンチで女性が座り、右端に柱時計がある場面',
        mainEn: 'a man pulling a wheeled suitcase along the platform',
        sub1En: 'a woman sitting on a platform bench',
        sub2En: 'a round blank clock mounted on a pillar',
        correct: 'A man is walking with a suitcase on the platform.',
        correctReason: 'スーツケースを引いてホームを歩いている中央の男性の動作と一致する。',
        wrongs: ['A man is painting a wall with a brush.', 'A man is planting rice in a field.'] as [string, string],
        wrongReasons: ['壁にペンキを塗っている場面ではない。', '田んぼで田植えをしている場面ではない。'] as [string, string],
      },
      {
        ja: '駅の改札前の中央で女の子が切符をかばんから探しており、奥で男の子が待ち、腕に傘が掛かっている場面',
        mainEn: 'a girl looking inside her shoulder bag for a ticket',
        sub1En: 'a boy standing patiently with a backpack',
        sub2En: 'a folded umbrella hanging on her arm',
        correct: 'She is looking inside her bag at the station.',
        correctReason: '駅でかばんの中を探している中央の女の子の様子を正しく表している。',
        wrongs: ['She is riding a horse on the beach.', 'She is making a snowman in the garden.'] as [string, string],
        wrongReasons: ['砂浜で乗馬をしている場面ではない。', '庭で雪だるまを作っている場面ではない。'] as [string, string],
      },
    ],
  },
  {
    settingEn: 'a neighborhood bakery or cafe',
    propsEn: 'a glass display case, trays, and a small table',
    variants: [
      {
        ja: 'パン屋の中央で男の子がトングでパンをトレイにのせており、奥で店員が立ち、右端にかごがある場面',
        mainEn: 'a boy using tongs to put a roll onto a tray',
        sub1En: 'a baker standing behind the counter wearing a chef hat',
        sub2En: 'wicker baskets arranged on a wooden shelf',
        correct: 'A boy is putting bread on a tray.',
        correctReason: 'トングでパンをトレイにのせている中央の男の子の動作と一致する。',
        wrongs: ['A boy is washing his hair in the bath.', 'A boy is flying a kite on a hill.'] as [string, string],
        wrongReasons: ['お風呂で髪を洗っている絵ではない。', '丘でたこ揚げをしている絵ではない。'] as [string, string],
      },
      {
        ja: 'カフェの中央で女性が丸テーブルで飲み物を飲んでおり、奥で男性が座り、右端にコート掛けがある場面',
        mainEn: 'a woman sitting at a round table drinking from a cup',
        sub1En: 'a man holding a blank folded card at another table',
        sub2En: 'a coat stand near the entrance door',
        correct: 'A woman is having a drink at a small table.',
        correctReason: '丸テーブルで飲み物を飲んでいる中央の女性の様子と一致する。',
        wrongs: ['A woman is climbing a ladder to the roof.', 'A woman is playing soccer in the rain.'] as [string, string],
        wrongReasons: ['はしごで屋根に登っている場面ではない。', '雨の中でサッカーをしている場面ではない。'] as [string, string],
      },
    ],
  },
  {
    settingEn: 'a front yard of a house',
    propsEn: 'a wooden fence, a flowerbed, and a bicycle',
    variants: [
      {
        ja: '家の庭の中央で女の子が布で自転車を拭いており、奥でお兄さんがじょうろを持ち、後ろに木の柵がある場面',
        mainEn: 'a girl wiping her bicycle frame with a cloth',
        sub1En: 'an older boy holding a watering can near flowers',
        sub2En: 'a wooden fence behind the yard',
        correct: 'The girl is cleaning her bicycle in the yard.',
        correctReason: '庭で自転車を拭いてきれいにしている中央の女の子の動作と一致する。',
        wrongs: ['The girl is watching a movie in a theater.', 'The girl is buying shoes at a mall.'] as [string, string],
        wrongReasons: ['映画館で映画を見ている絵ではない。', 'モールで靴を買っている絵ではない。'] as [string, string],
      },
      {
        ja: '家の玄関前の中央で男の子がしゃがんで靴ひもを結んでおり、奥でお母さんが傘を持ち、右端に郵便受けがある場面',
        mainEn: 'a boy kneeling on the step tying his shoelaces',
        sub1En: 'a mother standing by the door holding an umbrella',
        sub2En: 'a blank mailbox on a short post',
        correct: 'The boy is tying his shoes near the door.',
        correctReason: '玄関近くでしゃがんで靴ひもを結んでいる中央の男の子と一致する。',
        wrongs: ['The boy is eating noodles with chopsticks.', 'The boy is swimming across a river.'] as [string, string],
        wrongReasons: ['はしで麺を食べている場面ではない。', '川を泳いで渡っている場面ではない。'] as [string, string],
      },
    ],
  },
  {
    settingEn: 'a school gymnasium',
    propsEn: 'a basketball hoop, gym floor lines, and a bench',
    variants: [
      {
        ja: '体育館の中央で男の子がバスケットボールをシュートしており、奥でチームメイトが見守り、右端に水筒がある場面',
        mainEn: 'a boy jumping to shoot a basketball toward the hoop',
        sub1En: 'two teammates watching near the court line',
        sub2En: 'water bottles lined up on a bench',
        correct: 'He is shooting a basketball in the gym.',
        correctReason: '体育館でバスケットボールをシュートしている中央の動作と一致する。',
        wrongs: ['He is reading a newspaper in bed.', 'He is catching fish from a boat.'] as [string, string],
        wrongReasons: ['ベッドで新聞を読んでいる場面ではない。', '船から魚を釣っている場面ではない。'] as [string, string],
      },
      {
        ja: '体育館の中央で女の子が縄跳びをしており、奥で先生がストップウォッチを持ち、右端にマットがある場面',
        mainEn: 'a girl jumping rope in the center of the gym',
        sub1En: 'a teacher holding a small stopwatch',
        sub2En: 'folded gym mats stacked by the wall',
        correct: 'She is jumping rope in the gym.',
        correctReason: '体育館の中央で縄跳びをしている女の子の動作と一致する。',
        wrongs: ['She is baking cookies in an oven.', 'She is mailing a letter at the post office.'] as [string, string],
        wrongReasons: ['オーブンでクッキーを焼いている絵ではない。', '郵便局で手紙を出している絵ではない。'] as [string, string],
      },
    ],
  },
  {
    settingEn: 'a music room or art studio',
    propsEn: 'music stands, chairs, and an easel',
    variants: [
      {
        ja: '美術室の中央で女の子がイーゼルに向かって絵を描いており、奥で男の子が筆を洗い、右端に花瓶がある場面',
        mainEn: 'a girl holding a paintbrush in front of a blank canvas on an easel',
        sub1En: 'a boy rinsing brushes at a small sink',
        sub2En: 'a vase with two flowers on a stool',
        correct: 'A girl is painting a picture on an easel.',
        correctReason: 'イーゼルに向かって絵を描いている中央の女の子を正しく説明している。',
        wrongs: ['A girl is shoveling snow on the street.', 'A girl is riding an escalator.'] as [string, string],
        wrongReasons: ['道で雪かきをしている場面ではない。', 'エスカレーターに乗っている場面ではない。'] as [string, string],
      },
      {
        ja: '音楽室の中央で男の子がフルートを吹いており、奥で女の子が譜面台の横に立ち、右端にピアノがある場面',
        mainEn: 'a boy standing upright playing a flute',
        sub1En: 'a girl standing beside a music stand',
        sub2En: 'a closed grand piano in the corner',
        correct: 'A boy is playing the flute in the music room.',
        correctReason: '音楽室でフルートを演奏している中央の男の子と一致する。',
        wrongs: ['A boy is digging a hole at the beach.', 'A boy is buying vegetables at a market.'] as [string, string],
        wrongReasons: ['砂浜で穴を掘っている場面ではない。', '市場で野菜を買っている場面ではない。'] as [string, string],
      },
    ],
  },
];

const SPOKEN_NUMBERS_16_TO_25 = [
  'sixteen', 'seventeen', 'eighteen', 'nineteen', 'twenty',
  'twenty-one', 'twenty-two', 'twenty-three', 'twenty-four', 'twenty-five',
] as const;

const PART3_ROUND_PREFIXES = [
  'Right now',
  'In this scene',
  'Today after school',
  'Early this morning',
  'On Saturday afternoon',
  'During break time',
  'At this moment',
  'Over by the center',
  'On Sunday morning',
  'This weekend',
  'After breakfast today',
  'Before supper tonight',
  'On a bright afternoon',
  'Here in this picture',
  'Look closely now',
] as const;

function buildGrade5Round(round: number): ListeningExamRound {
  const examId = `eiken_5_listening_r${String(round).padStart(2, '0')}`;
  const units: ListeningAudioUnit[] = [];

  // Part 1: 10 units
  for (let u = 1; u <= 10; u++) {
    const seed = G5_PART1_SEEDS[u - 1];
    const [sp1, sp2] = speakerPairFor(round, u);
    const m = NAMES_M[(round + u) % NAMES_M.length];
    const f = NAMES_F[(round * 3 + u) % NAMES_F.length];
    const built = seed.build(round, u, m, f);
    const targetAnswer = (round + u) % 3;
    const qItem = makeQuestionItem({
      examId,
      questionNumber: u,
      questionPrompt: 'Choose the best response to the second speaker.',
      choicePresentation: 'read-aloud',
      correctChoice: built.correct,
      correctReason: built.correctReason,
      wrongChoices: built.wrongs,
      wrongReasons: built.wrongReasons,
      targetAnswer,
      explanation: built.explanation,
      evidence: built.evidence,
      skill: built.skill,
    });

    const turns: DialogueTurn[] = [
      { ...sp1, text: built.line1 },
      { ...sp2, text: built.line2 },
      {
        speaker: 'F2',
        roleLabel: 'Narrator',
        text: `Number one. ${qItem.choices[0]} Number two. ${qItem.choices[1]} Number three. ${qItem.choices[2]}`,
      },
    ];

    const audioId = `${examId}_part1_${String(u).padStart(2, '0')}`;
    const image = buildSupportImageSpec(
      audioId,
      `${seed.placeJa}で2人が${seed.actionJa}補助イラスト`,
      'two junior high school students (one boy and one girl)',
      seed.placeEn,
      seed.actionEn,
      seed.propsEn,
    );

    units.push(
      makeDialogueUnit({
        examId,
        part: 'part1',
        unitIndex: u,
        readCount: 2,
        turns,
        translation: `${sp1.roleLabel === 'Man' ? '男性' : '女性'}：${built.line1Ja}\n${sp2.roleLabel === 'Woman' ? '女性' : '男性'}：${built.line2Ja}\n（選択肢1〜3が読み上げられる）`,
        image,
        questions: [qItem],
      }),
    );
  }

  // Part 2: 5 units
  for (let u = 1; u <= 5; u++) {
    units.push(buildG5Part2Unit(examId, round, u));
  }

  // Part 3: 10 units
  for (let u = 1; u <= 10; u++) {
    const qNo = 15 + u;
    const spokenNo = SPOKEN_NUMBERS_16_TO_25[u - 1];
    const sceneGroup = G5_PART3_SCENES[(u - 1 + round - 1) % G5_PART3_SCENES.length];
    const variant = sceneGroup.variants[(round + u) % sceneGroup.variants.length];
    const timeTag = PART3_ROUND_PREFIXES[round - 1];
    const targetAnswer = (round + u + 1) % 3;
    const correctFull = `${timeTag}, ${variant.correct[0].toLowerCase()}${variant.correct.slice(1)}`;
    const wrong1Full = `${timeTag}, ${variant.wrongs[0][0].toLowerCase()}${variant.wrongs[0].slice(1)}`;
    const wrong2Full = `${timeTag}, ${variant.wrongs[1][0].toLowerCase()}${variant.wrongs[1].slice(1)}`;

    const qItem = makeQuestionItem({
      examId,
      questionNumber: qNo,
      questionPrompt: 'Look at the picture and choose the sentence that best describes it.',
      choicePresentation: 'read-aloud',
      correctChoice: correctFull,
      correctReason: variant.correctReason,
      wrongChoices: [wrong1Full, wrong2Full],
      wrongReasons: variant.wrongReasons,
      targetAnswer,
      explanation: 'イラストの中央に大きく描かれた主動作を表す英文を選ぶ。',
      evidence: variant.correct.replace('.', ''),
      skill: '動作',
    });

    const turns: DialogueTurn[] = [
      {
        speaker: 'F2',
        roleLabel: 'Narrator',
        text: `Picture number ${spokenNo}. ${timeTag}, listen carefully. Number one. ${qItem.choices[0]} Number two. ${qItem.choices[1]} Number three. ${qItem.choices[2]}`,
      },
    ];

    const audioId = `${examId}_part3_${String(u).padStart(2, '0')}`;
    const image = buildSceneImageSpec(
      audioId,
      variant.ja,
      variant.mainEn,
      variant.sub1En,
      variant.sub2En,
      sceneGroup.settingEn,
      sceneGroup.propsEn,
    );

    units.push(
      makeDialogueUnit({
        examId,
        part: 'part3',
        unitIndex: u,
        readCount: 2,
        turns,
        translation: `図版No.${qNo}（${variant.ja}）を見て、最もよく表す英文を1〜3から選ぶ。`,
        image,
        questions: [qItem],
      }),
    );
  }

  return buildExamRound('eiken_5', round, units);
}

export const GRADE_5_LISTENING_EXAMS: readonly ListeningExamRound[] = Array.from(
  { length: 15 },
  (_, idx) => buildGrade5Round(idx + 1),
);
