import { mc, type OriginalUnit } from './original-types'

export const FOUNDATION_UNITS: OriginalUnit[] = [
  {
    grade: '5', theme: '小さな工作室の一日', focus: '現在形・場所・時刻を、短い情報から取り出す', minutes: 12,
    vocabulary: [
      mc('主語と動詞の一致', 'Our class has a tiny workshop. Every Friday, Emi ( ___ ) paper stars there.', ['make', 'makes', 'making', 'to make'], 1, 'Every Friday', ['主語Emiは三人称単数なので現在形makeには-sが必要です。', 'Emiが主語で、毎週の習慣なのでmakesが正解です。', 'makingだけでは述語動詞になりません。', 'to makeだけではこの文の述語になりません。']),
      mc('場所の前置詞', 'The glue is in a box. The box is ( ___ ) two tall cabinets, one on its left and one on its right.', ['for', 'with', 'under', 'between'], 3, 'one on its left and one on its right', ['forは目的や対象を表し、二つの物の間という場所にはなりません。', 'withは「〜と一緒に」で、左右から挟まれた位置を示しません。', 'underは下です。左右に一つずつある戸棚との関係に合いません。', '二つの戸棚に左右から挟まれた位置なのでbetweenを使います。']),
    ],
    readings: [
      { title: 'Workshop board', text: 'Paper Boat Time\nRoom 2, Thursday\nStart: 3:20. Finish: 4:00.\nBring a pencil. Paper is on every desk.\nPut your boat in the big box by the window.', questions: [
        mc('必要な持ち物', 'What do students need to bring?', ['A box.', 'Some paper.', 'A pencil.', 'A boat.'], 2, 'Bring a pencil.', ['箱は部屋の窓際に置かれており、持参物ではありません。', '紙は各机に用意されているので、家から持って来る必要はありません。', 'Bring a pencil.という指示が根拠です。', '船は活動で作って箱に入れる物です。持って来る物ではありません。']),
        mc('場所の特定', 'Where do students put their boats?', ['In the box by the window.', 'Under their desks.', 'In Room 3.', 'On the teacher’s chair.'], 0, 'in the big box by the window', ['窓のそばの大きな箱に入れると指定されています。', '机の下という指示はありません。', '活動場所はRoom 2で、船の置き場所もRoom 3ではありません。', '先生の椅子は本文に出てきません。']),
      ] },
      { title: 'A helper at home', text: 'My name is Leo. My mother has a flower shop. I help her on Saturdays. I write the flower names on small cards. My sister puts water in the pots. We eat lunch at the shop at twelve.', questions: [
        mc('役割の区別', 'What does Leo do at the shop?', ['He cooks lunch.', 'He writes on cards.', 'He puts water in pots.', 'He sells books.'], 1, 'I write the flower names on small cards.', ['昼食を作るとは書かれていません。', '語り手Leoが花の名前をカードに書きます。', '水を入れるのはLeoではなくsister（姉または妹）です。', '店は花屋で、本を売るという記述はありません。']),
        mc('時刻の読み取り', 'When do they eat lunch?', ['At ten.', 'At eleven.', 'At one.', 'At twelve.'], 3, 'at twelve', ['tenではなくtwelveです。', 'elevenという時刻はありません。', 'oneという時刻はありません。', '最後の文にat twelveと明記されています。']),
      ] },
    ],
    listenings: [
      { title: 'A missing apron', script: ['A: I need my apron for the workshop. Is it on the chair?', 'B: No. Your bag is on the chair. The apron is next to the door.'], question: mc('聞き取り：物と場所', 'Where is the apron?', ['On the chair.', 'Inside a bag.', 'Next to the door.', 'Under a table.'], 2, 'The apron is next to the door.', ['椅子にあるのはエプロンではなくバッグです。', 'バッグの中とは言っていません。', 'エプロンはドアの隣と明言しています。', '机の下という場所は会話に出てきません。最後に示された場所はドアの隣です。']) },
      { title: 'The lunch order', script: ['A: Would you like rice or bread with your soup?', 'B: Bread, please. And water, not juice.'], question: mc('聞き取り：選択と否定', 'What does the second speaker want with the soup?', ['Bread and water.', 'Rice and juice.', 'Bread and juice.', 'Rice and water.'], 0, 'Bread, please. And water, not juice.', ['breadとwaterの両方を選んでいます。', 'riceもjuiceも選んでいません。', 'パンは正しいですが、ジュースはnot juiceで否定されています。', '水は正しいですが、米ではなくパンです。']) },
    ], writing: [],
  },
  {
    grade: '4', theme: '町の小さな活動に参加する', focus: '予定の変更・出来事の順序・理由を読み分ける', minutes: 15,
    vocabulary: [
      mc('過去形と時を示す表現', 'Yesterday our team ( ___ ) a wooden sign for the school garden. It is beside the gate now.', ['build', 'builds', 'built', 'building'], 2, 'Yesterday', ['Yesterdayで過去の出来事なので原形buildは使いません。', 'buildsは現在形で、昨日という時に合いません。', 'buildの過去形builtを使います。', 'buildingだけでは述語になりません。']),
      mc('比較級', 'The path by the river is 2 km long. The hill path is 5 km long, so it is ( ___ ) than the river path.', ['longer', 'longest', 'long', 'as long'], 0, 'than the river path', ['thanを伴う2つの道の比較なのでlongerです。', 'longestは最上級でthanとこの形では使いません。', '原級longだけではthanにつながりません。', '同じ長さならas long asですが、ここでは長さも異なります。']),
    ],
    readings: [
      { title: 'A changed meeting place', text: 'To the Garden Helpers\nWe planned to meet outside the station this Sunday. However, the road there will be closed. Please come to the library entrance instead. We will leave at 9:40 and walk to the garden together. Do not bring tools; Ms. Lane has enough for everyone. Bring a drink because the garden shop is closed in the morning.', questions: [
        mc('変更後の情報', 'Where should the helpers meet on Sunday?', ['At the station.', 'Inside the garden shop.', 'On the closed road.', 'At the library entrance.'], 3, 'come to the library entrance instead', ['駅は変更前の集合場所で、通行止めのため図書館の入口に変更されています。', '売店は午前中閉まっています。集合場所ではありません。', '通行止めの道に集合する指示はありません。', 'insteadの後に新しい集合場所が指定されています。']),
        mc('指示の理由', 'Why should helpers bring a drink?', ['The walk will take all day.', 'They cannot buy one at the garden shop in the morning.', 'Ms. Lane needs empty bottles.', 'They must wash the tools.'], 1, 'the garden shop is closed in the morning', ['一日中歩くとは書かれていません。', '午前中は庭の売店が閉まっているので、飲み物を持参します。', '空のボトルが必要だという情報はありません。', '道具洗いではなく、自分の飲み物の話です。']),
      ] },
      { title: 'A sound map', text: 'Nora wanted to make a map of quiet places near her house. On Monday, she listened in the park, but a machine was cutting the grass. The next day, she visited a small bridge. She could hear only the water there. On Wednesday, she returned to the park. It was quiet, too. She put both places on her map and showed it to her grandfather.', questions: [
        mc('出来事の順序', 'What did Nora do on Tuesday?', ['She drew a map with her grandfather.', 'She listened to a grass-cutting machine.', 'She visited a small bridge.', 'She returned to the park.'], 2, 'The next day, she visited a small bridge.', ['地図を祖父と一緒に描いたとは書かれていません。', '機械の音を聞いたのは月曜日です。', '月曜日のthe next dayなので火曜日に橋を訪ねました。', '公園へ戻ったのは水曜日です。火曜日の訪問先を尋ねる設問とは一致しません。']),
        mc('結果の把握', 'Which places did Nora put on her map?', ['The bridge and the park.', 'Only the bridge.', 'Only her grandfather’s house.', 'The park and a factory.'], 0, 'She put both places on her map', ['both placesは直前までの橋と公園を指します。', '橋だけではなく、静かになった公園も載せました。', '祖父の家を調べたとは書かれていません。', '工場は本文に登場しません。芝刈り機がある公園を工場と読み替えないようにします。']),
      ] },
    ],
    listenings: [
      { title: 'A library duty', script: ['A: Can you help me put these books away at four?', 'B: I have a music lesson then, but I can come at five.', 'A: That works. Please use the side door. The front door closes at half past four.'], question: mc('聞き取り：最終的な合意', 'What will the second speaker do?', ['Come at four through the front door.', 'Come at five through the side door.', 'Cancel a music lesson.', 'Close the front door at five.'], 1, 'I can come at five.', ['4時は音楽のレッスンがあるので来られません。', '5時に来る合意があり、その時は横の入口を使います。', 'レッスンを取り消すとは言っていません。', '正面入口が閉まるのは4時半で、話者が閉めるという話でもありません。']) },
      { title: 'Choosing a present', script: ['A: I found a notebook for Ben, but he already has three.', 'B: How about a small plant? He likes growing things.', 'A: Good idea. We can buy one after lunch.'], question: mc('聞き取り：提案の採用', 'What do the speakers decide to buy?', ['Three notebooks.', 'Some lunch.', 'A growing guide.', 'A small plant.'], 3, 'How about a small plant?', ['ノートは既に持っているため別の物を選びます。', '昼食後に買うと言っていますが、贈り物は昼食ではありません。', '栽培の本を買う話ではありません。育てるのが好きという理由で植物を提案しています。', '植物という提案にGood ideaと賛成しています。']) },
    ], writing: [],
  },
]
