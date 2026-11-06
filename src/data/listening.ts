// リスニング問題素材（第1部・第2部・第3部）
// 過去問の傾向（日常会話・教室・買い物・天気・時刻・持ち物など）に合わせて作成。

export type RawL1 = {
  lines: string[]
  choices: string[]
  answer: number // 0 始まり
  jp: string
  exp: string
}

export type RawL2 = {
  lines: string[]
  question: string
  choices: string[]
  answer: number
  jp: string
  exp: string
}

export type RawL3 = {
  scene: string
  sceneJp: string
  choices: string[]
  answer: number
  jp: string
  exp: string
}

/* ---------- 第1部：応答を選ぶ（3択） ---------- */
export const L1: RawL1[] = [
  {
    lines: ['☆Which cap do you want?'],
    choices: ['I like it.', 'A blue one, please.', 'Too many.'],
    answer: 1,
    jp: 'どちらの帽子が欲しいですか。→ 青いのをお願いします。',
    exp: 'Which（どちら）と聞かれたら、One を使って「～のもの」と答えます。',
  },
  {
    lines: ['☆What are you looking at, Amanda?'],
    choices: ['That’s nice.', 'A letter from my brother.', 'I want cookies.'],
    answer: 1,
    jp: 'アマンダ、何を見ているの？→ 兄からの手紙です。',
    exp: 'What に対する答えは「もの」。A letter from ～ が適切です。',
  },
  {
    lines: ['☆Let’s play a video game.'],
    choices: ['Ten dollars.', 'All right.', 'My brother.'],
    answer: 1,
    jp: 'テレビゲームをしようよ。→ いいよ。',
    exp: '提案に対する返事は All right.（いいよ）が自然です。',
  },
  {
    lines: ['☆When do you go to the park?'],
    choices: ['Every weekend.', 'With Grandma.', 'Of course.'],
    answer: 0,
    jp: 'いつ公園に行きますか。→ 毎週末です。',
    exp: 'When（いつ）なので、時を表す Every weekend. が答えです。',
  },
  {
    lines: ['☆What are you making, Kevin?'],
    choices: ['Fifteen dollars.', 'It is an apple pie.', 'In the kitchen.'],
    answer: 1,
    jp: 'ケビン、何を作っているの？→ アップルパイだよ。',
    exp: 'What are you making? には作っているものを答えます。',
  },
  {
    lines: ['☆Do you come to school by bus?'],
    choices: ['Yes, you can.', 'I’m a student.', 'No, by bicycle.'],
    answer: 2,
    jp: 'バスで学校に来ますか。→ いいえ、自転車です。',
    exp: 'by bus と聞かれたら by bicycle のように手段で答えます。',
  },
  {
    lines: ['★Can Sara swim well?'],
    choices: ['Wow, you’re great!', 'Yes. They’re by the river.', 'No. She can’t swim.'],
    answer: 2,
    jp: 'サラは上手に泳げますか。→ いいえ、泳げません。',
    exp: 'Can ～? と聞かれたら can / can’t で答えます。',
  },
  {
    lines: ['★Can I have this cake, Mom?'],
    choices: ['Good job.', 'Sure.', 'I’m here.'],
    answer: 1,
    jp: 'お母さん、このケーキをもらってもいい？→ いいわよ。',
    exp: '許可を求める Can I ～? には Sure.（いいよ）が合います。',
  },
  {
    lines: ['☆Excuse me. Where is the post office?'],
    choices: ['I can’t run.', 'No, I’m not.', 'I don’t know.'],
    answer: 2,
    jp: 'すみません、郵便局はどこですか。→ わかりません。',
    exp: 'Where に対する答えとして、I don’t know.（知りません）も自然です。',
  },
  {
    lines: ['★How is the weather there?'],
    choices: ['I’m here.', 'It’s snowy.', 'It’s Thursday.'],
    answer: 1,
    jp: 'そちらの天気はどうですか。→ 雪です。',
    exp: '天気を聞かれたら、天気を表す語で答えます。',
  },
  {
    lines: ['☆What time is it now?'],
    choices: ['It’s seven thirty.', 'It’s Tuesday.', 'It’s near the door.'],
    answer: 0,
    jp: '今何時ですか。→ ７時30分です。',
    exp: 'What time には時刻を答えます。',
  },
  {
    lines: ['★Whose umbrella is this?'],
    choices: ['It’s raining.', 'It’s my sister’s.', 'In my bag.'],
    answer: 1,
    jp: 'これはだれの傘ですか。→ 妹のです。',
    exp: 'Whose には「～のもの」と所有を答えます。',
  },
  {
    lines: ['☆How old is your brother?'],
    choices: ['He’s ten.', 'He’s fine.', 'He’s in the park.'],
    answer: 0,
    jp: 'あなたの兄は何歳ですか。→ 10歳です。',
    exp: 'How old（何歳）には年齢を答えます。',
  },
  {
    lines: ['☆What do you want for breakfast?'],
    choices: ['At seven.', 'Some bread, please.', 'In the kitchen.'],
    answer: 1,
    jp: '朝食に何が欲しいですか。→ パンをいくつかお願いします。',
    exp: 'What には食べ物を答えます。for breakfast は「朝食に」。',
  },
  {
    lines: ['★Do you know that girl?'],
    choices: ['Yes, she’s my classmate.', 'Yes, it is.', 'No, I’m not.'],
    answer: 0,
    jp: 'あの女の子を知っていますか。→ ええ、私のクラスメートです。',
    exp: 'Do you ～? には do で答えるか、Yes, she’s ～ と続けます。',
  },
  {
    lines: ['☆Please close the door.'],
    choices: ['You’re welcome.', 'OK, I will.', 'No, thank you.'],
    answer: 1,
    jp: 'ドアを閉めてください。→ わかりました。',
    exp: '依頼に対する返事は OK, I will.（わかりました）です。',
  },
  {
    lines: ['★Where are my glasses?'],
    choices: ['They’re on the table.', 'They’re blue.', 'Yes, they are.'],
    answer: 0,
    jp: '私のめがねはどこ？→ テーブルの上だよ。',
    exp: 'Where には場所を答えます。',
  },
  {
    lines: ['☆How do you go to the library?'],
    choices: ['By bike.', 'Every day.', 'With my sister.'],
    answer: 0,
    jp: 'どうやって図書館に行きますか。→ 自転車で。',
    exp: 'How（どうやって）には手段を答えます。',
  },
  {
    lines: ['★Let’s go to the beach on Sunday.'],
    choices: ['I’m sorry, I can’t.', 'It’s a beach.', 'Yes, I am.'],
    answer: 0,
    jp: '日曜日に海に行こう。→ ごめん、行けないんだ。',
    exp: '誘いを断るときは I’m sorry, I can’t. を使います。',
  },
  {
    lines: ['☆Who is that man?'],
    choices: ['He’s my uncle.', 'He’s in the car.', 'It’s nine.'],
    answer: 0,
    jp: 'あの男の人はだれですか。→ 私のおじです。',
    exp: 'Who には人を答えます。',
  },
]

/* ---------- 第2部：対話＋質問（4択） ---------- */
export const L2: RawL2[] = [
  {
    lines: ['A: Do you eat bananas?', 'B: No, I don’t. I eat oranges.'],
    question: 'What fruit does the boy eat?',
    choices: ['Oranges.', 'Bananas.', 'Grapes.', 'Apples.'],
    answer: 0,
    jp: 'A：バナナを食べますか。B：いいえ。オレンジを食べます。→ 男の子が食べる果物は。',
    exp: 'No のあとに続く I eat oranges. が答えです。',
  },
  {
    lines: ['A: Do you work at the hospital?', 'B: Yes. I’m a doctor.'],
    question: 'Who is a doctor?',
    choices: ['The woman.', 'The woman’s mother.', 'The man’s father.', 'The man.'],
    answer: 3,
    jp: 'A：病院で働いていますか。B：はい。医者です。→ だれが医者ですか。',
    exp: '答えた男性（B）が医者です。男性の声に注目します。',
  },
  {
    lines: ['A: My birthday is September 13th. When is yours, Olivia?', 'B: It’s October 30th.'],
    question: 'When is Olivia’s birthday?',
    choices: ['September 13th.', 'September 30th.', 'October 13th.', 'October 30th.'],
    answer: 3,
    jp: 'A：私の誕生日は９月13日。オリビアは？B：10月30日です。→ オリビアの誕生日は。',
    exp: 'Olivia の発言（女性Ｂ）の日付を選びます。',
  },
  {
    lines: ['A: Excuse me. How much are these shirts?', 'B: The blue one is 25 dollars, and the white one is 30 dollars.'],
    question: 'How much is the white shirt?',
    choices: ['20 dollars.', '25 dollars.', '30 dollars.', '35 dollars.'],
    answer: 2,
    jp: 'A：このシャツはいくらですか。B：青いのが25ドル、白いのが30ドルです。→ 白いシャツは。',
    exp: 'the white one の値段を聞いています。',
  },
  {
    lines: ['A: I usually study math on Sunday mornings.', 'B: I play computer games.'],
    question: 'What does the boy usually do on Sunday mornings?',
    choices: ['He studies English.', 'He studies math.', 'He plays games.', 'He watches TV.'],
    answer: 1,
    jp: 'A：日曜の朝はたいてい数学を勉強します。B：私はゲームをします。→ 男の子は。',
    exp: '質問の the boy は A のこと。A は数学を勉強しています。',
  },
  {
    lines: ['A: What time does the movie start?', 'B: At three fifteen.'],
    question: 'What time does the movie start?',
    choices: ['At two fifteen.', 'At three fifteen.', 'At three fifty.', 'At five fifteen.'],
    answer: 1,
    jp: 'A：映画は何時に始まりますか。B：３時15分です。→ 映画が始まる時刻は。',
    exp: '時刻を正確に聞き取ります。fifteen と fifty の違いに注意。',
  },
  {
    lines: ['A: Where is my bag, Mom?', 'B: It’s under the chair in your room.'],
    question: 'Where is the bag?',
    choices: ['On the bed.', 'Under the chair.', 'By the door.', 'In the kitchen.'],
    answer: 1,
    jp: 'A：お母さん、僕のかばんは？B：あなたの部屋の椅子の下よ。→ かばんはどこ。',
    exp: 'under（～の下）を聞き取ります。',
  },
  {
    lines: ['A: How many students are in your class?', 'B: Thirty-two.'],
    question: 'How many students are in the class?',
    choices: ['13.', '30.', '32.', '40.'],
    answer: 2,
    jp: 'A：クラスに生徒は何人いますか。B：32人です。→ 生徒の数は。',
    exp: 'thirty-two（32）を選びます。',
  },
  {
    lines: ['A: It’s very hot today.', 'B: Yes. Let’s go swimming.'],
    question: 'What will they do?',
    choices: ['Go swimming.', 'Play tennis.', 'Study at home.', 'Go shopping.'],
    answer: 0,
    jp: 'A：今日はとても暑いね。B：そうだね。泳ぎに行こう。→ 二人は何をしますか。',
    exp: 'Let’s go swimming. から、これから泳ぎに行くことがわかります。',
  },
  {
    lines: ['A: Does your sister play the piano?', 'B: No. She plays the violin.'],
    question: 'What does the sister play?',
    choices: ['The piano.', 'The guitar.', 'The violin.', 'The drums.'],
    answer: 2,
    jp: 'A：お姉さんはピアノを弾きますか。B：いいえ。バイオリンを弾きます。→ お姉さんが弾くのは。',
    exp: 'No のあとに続く楽器を聞き取ります。',
  },
  {
    lines: ['A: I’m hungry. Is there a restaurant near here?', 'B: Yes. It’s next to the post office.'],
    question: 'Where is the restaurant?',
    choices: ['Next to the post office.', 'In the station.', 'By the river.', 'Next to the school.'],
    answer: 0,
    jp: 'A：おなかがすいた。この近くにレストランはありますか。B：はい。郵便局の隣です。→ レストランはどこ。',
    exp: 'next to（～の隣）を聞き取ります。',
  },
]

/* ---------- 第3部：イラストに合う英文を選ぶ（3択） ---------- */
// 2026年度第2回リスニング第3部は公式解答（202602F5kyu.pdf）に合わせています。
export const L3: RawL3[] = [
  {
    scene: '🍽️',
    sceneJp: 'ナイフが皿の上に置かれている絵',
    choices: ['The knife is under the plate.', 'The knife is on the plate.', 'The knife is by the plate.'],
    answer: 1,
    jp: 'ナイフは皿の上にあります。',
    exp: 'on（～の上に）を表す文が絵と一致します。',
  },
  {
    scene: '🕖',
    sceneJp: 'ブルースが７時40分に学校へ行く絵',
    choices: ['Bruce goes to school at 7:04.', 'Bruce goes to school at 7:14.', 'Bruce goes to school at 7:40.'],
    answer: 2,
    jp: 'ブルースは７時40分に学校へ行きます。',
    exp: '絵の中の時計の時刻と合う文を選びます。fourteen と forty の聞き分けに注意。',
  },
  {
    scene: '📞',
    sceneJp: 'トムが電話で話している絵',
    choices: ['Tom is talking on the phone.', 'Tom is making dinner.', 'Tom is using chopsticks.'],
    answer: 0,
    jp: 'トムは電話で話しています。',
    exp: 'talking on the phone が受話器を持っている絵と一致します。',
  },
  {
    scene: '👧🍍',
    sceneJp: 'ケイトがパイナップルを持っている絵',
    choices: ['Kate is holding a dog.', 'Kate is holding a dictionary.', 'Kate is holding a pineapple.'],
    answer: 2,
    jp: 'ケイトはパイナップルを持っています。',
    exp: 'holding（持っている）＋ 絵に描かれたもの（a pineapple）を選びます。',
  },
  {
    scene: '👴',
    sceneJp: 'ポールが87歳の絵',
    choices: ['Paul is seventy-nine years old.', 'Paul is eighty-seven years old.', 'Paul is twenty-seven years old.'],
    answer: 1,
    jp: 'ポールは87歳です。',
    exp: 'eighty-seven（87）を選びます。数字の語順に注意。',
  },
  {
    scene: '🏢',
    sceneJp: '高さ30メートルの建物の絵',
    choices: ['The building is 13 meters tall.', 'The building is 30 meters tall.', 'The building is 300 meters tall.'],
    answer: 1,
    jp: 'その建物は高さ30メートルです。',
    exp: 'thirty と three hundred を聞き分けます。',
  },
  {
    scene: '🎭',
    sceneJp: 'タクが演劇部に入っている絵',
    choices: ['Taku is in the drama club.', 'Taku is in the cooking club.', 'Taku is in the swimming club.'],
    answer: 0,
    jp: 'タクは演劇部に入っています。',
    exp: '絵の活動（演劇）と合う club を選びます。',
  },
  {
    scene: '🧑‍🏫➗',
    sceneJp: '鈴木先生が数学の授業をしている絵',
    choices: ['Mr. Suzuki is teaching a music class.', 'Mr. Suzuki is teaching an art class.', 'Mr. Suzuki is teaching a math class.'],
    answer: 2,
    jp: '鈴木先生は数学の授業をしています。',
    exp: '黒板の計算式から math class だとわかります。',
  },
  {
    scene: '📖🌊',
    sceneJp: 'ヘンリーが川のそばで読書をしている絵',
    choices: ['Henry often reads by the river.', 'Henry often reads at a restaurant.', 'Henry often reads in the library.'],
    answer: 0,
    jp: 'ヘンリーはよく川のそばで読書をします。',
    exp: 'by the river（川のそばで）が絵と一致します。',
  },
  {
    scene: '🐦',
    sceneJp: 'ティムが鳥をながめている絵',
    choices: ['Tim likes flowers.', 'Tim likes trees.', 'Tim likes birds.'],
    answer: 2,
    jp: 'ティムは鳥が好きです。',
    exp: '絵に描かれているもの（birds）を選びます。',
  },
  {
    scene: '🐱🛏️',
    sceneJp: '猫がベッドの上で寝ている絵',
    choices: ['The cat is sleeping on the bed.', 'The cat is eating fish.', 'The cat is under the desk.'],
    answer: 0,
    jp: '猫はベッドの上で寝ています。',
    exp: 'sleeping on the bed の語順と意味を確認します。',
  },
  {
    scene: '🧑‍🍳🎂',
    sceneJp: '女性がオーブンでケーキを焼いている絵',
    choices: ['The woman is baking a cake.', 'The woman is buying a cake.', 'The woman is cutting a cake.'],
    answer: 0,
    jp: '女性はケーキを焼いています。',
    exp: 'baking（焼いている）がオーブンの絵と合います。',
  },
  {
    scene: '🚌🎒',
    sceneJp: '子どもたちがバスに乗りこむ絵',
    choices: ['The children are getting on the bus.', 'The children are playing soccer.', 'The children are swimming.'],
    answer: 0,
    jp: '子どもたちはバスに乗っています。',
    exp: 'getting on the bus（バスに乗る）を選びます。',
  },
  {
    scene: '☔',
    sceneJp: '男の人が傘をさしている絵',
    choices: ['The man is opening a window.', 'The man is using an umbrella.', 'The man is riding a bicycle.'],
    answer: 1,
    jp: '男の人は傘を使っています。',
    exp: 'using an umbrella（傘をさしている）を選びます。',
  },
  {
    scene: '🎨',
    sceneJp: '女の子が絵を描いている絵',
    choices: ['The girl is drawing a picture.', 'The girl is reading a book.', 'The girl is washing a car.'],
    answer: 0,
    jp: '女の子は絵を描いています。',
    exp: 'drawing a picture（絵を描いている）が絵に合います。',
  },
  {
    scene: '🧑‍🌾🥕',
    sceneJp: 'おじいさんが畑で野菜を育てている絵',
    choices: ['The man is growing vegetables.', 'The man is driving a car.', 'The man is playing the piano.'],
    answer: 0,
    jp: 'その男性は野菜を育てています。',
    exp: 'growing vegetables（野菜を育てる）が畑の絵に合います。',
  },
  {
    scene: '⚽',
    sceneJp: '男の子たちが公園でサッカーをしている絵',
    choices: ['The boys are playing soccer in the park.', 'The boys are studying in the library.', 'The boys are cooking in the kitchen.'],
    answer: 0,
    jp: '男の子たちは公園でサッカーをしています。',
    exp: 'playing soccer in the park が絵と一致します。',
  },
  {
    scene: '🧑‍⚕️🏥',
    sceneJp: '女性が病院で働いている絵',
    choices: ['The woman works at a school.', 'The woman works at a hospital.', 'The woman works at a bank.'],
    answer: 1,
    jp: 'その女性は病院で働いています。',
    exp: '白衣と病院の絵なので at a hospital が合います。',
  },
]
