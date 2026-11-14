import {
  buildExamRound,
  buildSupportImageSpec,
  makeDialogueUnit,
  makeQuestionItem,
  speakerPairFor,
} from './listening-helpers';
import type { DialogueTurn, ListeningAudioUnit, ListeningExamRound } from '../listeningExamCore';

/**
 * 英検3級・準2級 リスニング予想問題 各15回（計30回・900問・900音源・150図版プロンプト）
 * - 3級：第1部10問（応答・3肢読上・1回読・補助図版10枚）／第2部10問（会話・4肢印刷・2回読）／第3部10問（文・4肢印刷・2回読）
 * - 準2級：第1部10問（応答・3肢読上・1回読・図版なし）／第2部10問（会話・4肢印刷・1回読）／第3部10問（文・4肢印刷・1回読）
 * - 完全独自作成（origin: 'manatobi-original'）。過去問流用なし。
 */

const M_POOL = ['Liam', 'Noah', 'Ethan', 'Lucas', 'Mason', 'Oliver', 'Ryan', 'Daniel', 'Kevin', 'Brian', 'Jason', 'Aaron', 'Caleb', 'Nathan', 'Owen'];
const F_POOL = ['Emma', 'Chloe', 'Sophia', 'Olivia', 'Hannah', 'Claire', 'Grace', 'Maya', 'Lucy', 'Rachel', 'Sarah', 'Nora', 'Elena', 'Alice', 'Julia'];

// ============================================================================
// 英検3級（eiken_3）
// ============================================================================

function buildG3Part1(examId: string, round: number, u: number): ListeningAudioUnit {
  const [sp1, sp2] = speakerPairFor(round, u);
  const m = M_POOL[(round + u) % 15];
  const f = F_POOL[(round * 2 + u) % 15];
  const targetAnswer = (round + u) % 3;
  const audioId = `${examId}_part1_${String(u).padStart(2, '0')}`;
  const name1 = sp1.roleLabel === 'Man' ? f : m;
  const name2 = sp1.roleLabel === 'Man' ? m : f;

  const items = [
    // 1: 誘いに対する丁寧な断り＋理由
    () => {
      const events = [
        ['badminton match at the city gym', 'help my uncle move furniture', '市民体育館でのバドミントンの試合', '叔父の家具移動を手伝う'],
        ['mystery movie at Star Cinema', 'look after my little cousin', 'スター映画館でのミステリー映画', 'いとこの世話をする'],
        ['cycling trip along Maple River', 'visit the eye doctor at two', 'メイプル川沿いのサイクリング', '2時に眼科へ行く'],
        ['pancake party at Sakura Cafe', 'finish my history report first', 'さくらカフェでのパンケーキ会', '歴史レポートを先に仕上げる'],
        ['drum workshop at the youth hall', 'pick up my sister at the airport', '青少年ホールのドラム体験', '空港へ姉を迎えに行く'],
        ['charity flea market in Central Park', 'practice with the brass band', '中央公園のチャリティーフリーマーケット', '吹奏楽部の練習がある'],
        ['bowling game near West Station', 'study for Monday\'s math quiz', '西駅近くのボウリング', '月曜の数学テストの勉強をする'],
        ['pottery class this Saturday morning', 'clean our backyard with Dad', '今週土曜午前の陶芸教室', '父と裏庭の掃除をする'],
        ['tennis tournament viewing', 'go grocery shopping with Mom', 'テニス大会の観戦', '母と食料品の買い物に行く'],
        ['science planetarium show', 'attend my piano rehearsal', '科学館のプラネタリウム', 'ピアノのリハーサルに出る'],
        ['ice skating at Harbor Rink', 'take our dog to the vet', 'ハーバーリンクでのスケート', '犬を動物病院へ連れていく'],
        ['strawberry picking at Hill Farm', 'prepare slides for English class', 'ヒル農園でのいちご狩り', '英語授業のスライドを準備する'],
        ['local festival parade tomorrow', 'stay home for a package delivery', '明日の地域祭りのパレード', '荷物受け取りのため家にいる'],
        ['board game afternoon at my house', 'help at my grandmother\'s bakery', '家でのボードゲーム会', '祖母のパン屋を手伝う'],
        ['outdoor concert by the lake', 'pack my suitcase for a school trip', '湖畔の野外コンサート', '修学旅行の荷造りをする'],
      ];
      const [evEn, excuseEn, evJa, excuseJa] = events[round - 1];
      return {
        placeEn: 'a school corridor near a bulletin board',
        propsEn: 'a hallway window and school bags',
        actionEn: 'talking while holding event flyers',
        summaryJa: '廊下でチラシを見ながら誘っている場面',
        l1: `Hey ${name1}, I have two tickets for the ${evEn}.`,
        l2: `Oh, thanks ${name2}! Would you like to go together this weekend? Wait—actually, can you come with me?`,
        j1: `ねえ${name1}、${evJa}のチケットが2枚あるんだ。`,
        j2: `私と一緒に行けるかな？`,
        correct: `I'd love to, but I have to ${excuseEn}.`,
        cReason: `誘いに対して I'd love to, but ...（行きたいけれど、${excuseJa}必要がある）と丁寧に断っている。`,
        wrongs: ['It was very crowded last night.', 'Two tickets for students, please.'] as [string, string],
        wReasons: [
          '昨夜の混雑の話をしており、週末の誘いへの返答になっていない。',
          '窓口で切符を買う表現であり、友人からの誘いへの返事として不自然。',
        ] as [string, string],
        exp: `can you come with me? の誘いに対し I'd love to, but I have to ... で応じる表現を選ぶ。`,
        ev: 'can you come with me',
        skill: '誘い・断り',
      };
    },
    // 2: 許可を求める（Do you mind if I ...?）への注意応答
    () => {
      const asks = [
        ['open this train window a little', '電車の窓を少し開ける', 'inside a commuter train car'],
        ['sit at this empty library table', '空いている図書館の席に座る', 'inside a quiet library'],
        ['borrow your electronic dictionary', '電子辞書を借りる', 'at two study desks'],
        ['turn on the ceiling fan now', '天井の扇風機をつける', 'inside a club room'],
        ['put my suitcase on this rack', 'この棚にスーツケースを置く', 'on an express train'],
        ['take a look at this club brochure', 'この部活パンフレットを見る', 'at a school club booth'],
        ['use this power outlet for my laptop', 'パソコン用にコンセントを使う', 'at a study cafe counter'],
        ['close the blinds against the sun', '日差しよけにブラインドを閉める', 'near a bright classroom window'],
        ['leave my umbrella in this stand', 'この傘立てに傘を置く', 'at a clinic entrance'],
        ['practice my speech in this corner', 'この隅でスピーチ練習をする', 'in a spacious music room'],
        ['move this extra chair to our table', '余っている椅子をテーブルに運ぶ', 'in a school cafeteria'],
        ['read this sports magazine while waiting', '待ち時間にスポーツ雑誌を読む', 'in a barber shop waiting area'],
        ['drink some water during the break', '休憩中に水を飲む', 'on a tennis court sideline'],
        ['hang my wet jacket on this hook', '濡れた上着をフックに掛ける', 'inside a community hall lobby'],
        ['write notes on this whiteboard', 'このホワイトボードにメモを書く', 'in a group study room'],
      ];
      const [askEn, askJa, placeEn] = asks[round - 1];
      return {
        placeEn,
        propsEn: 'chairs, tables, or fixtures matching the indoor setting',
        actionEn: 'pointing politely and asking permission',
        summaryJa: '室内で指さしながら許可を尋ねている場面',
        l1: `Pardon me, ${name1}. Is anyone using this space right now?`,
        l2: `No, ${name2}. Oh, do you mind if I ${askEn}?`,
        j1: `すみません、いまここ誰か使っていますか？`,
        j2: `いいえ。あ、私が${askJa}のを気にしますか（よろしいですか）？`,
        correct: 'Not at all. Go right ahead.',
        cReason: `Do you mind if I ...?（〜しても構いませんか）に対し、Not at all. Go right ahead.（少しも気にしません、どうぞ）と許可している。`,
        wrongs: ['Yes, please help yourself.', 'Never mind, I found it yesterday.'] as [string, string],
        wReasons: [
          'Do you mind ...? に Yes と言うと「気にする＝ダメ」の意味になり、後ろの please と矛盾する。',
          '昨日見つけたという無関係な話であり、許可を求める質問への応答にならない。',
        ] as [string, string],
        exp: `3級頻出の Do you mind if I ...? には Not at all. / No, go ahead. で許可を表す。`,
        ev: `do you mind if I ${askEn}`,
        skill: '依頼内容',
      };
    },
    // 3: 手段・方法を尋ねる（How can I ...?）
    () => {
      const tasks = [
        ['sign up for the summer cooking course', 'Fill out this form at the counter.', '夏の料理講座に申し込む', 'カウンターでこの用紙に記入する'],
        ['get a student library card here', 'Show your student ID at Desk Two.', '学生用の図書館カードを作る', '2番窓口で生徒証を見せる'],
        ['check the bus schedule for the airport', 'Look at the timetable on our website.', '空港行きのバス時刻を調べる', 'ウェブサイトの時刻表を見る'],
        ['join the weekend river clean-up', 'Write your name on the hall sheet.', '週末の河川清掃に参加する', 'ホールの名簿に名前を書く'],
        ['reserve a tennis court for Sunday', 'Call the park office before Friday.', '日曜のテニスコートを予約する', '金曜までに公園事務所に電話する'],
        ['exchange this shirt for a larger size', 'Bring the receipt to Customer Service.', 'シャツを大きいサイズに交換する', 'レシートをサービスカウンターへ持っていく'],
        ['borrow an audio guide for the museum', 'Rent one at the entrance booth.', '博物館の音声ガイドを借りる', '入口ブースで1台借りる'],
        ['send this parcel to Hokkaido quickly', 'Use our express delivery service.', '北海道へ小包を早く送る', '速達宅配サービスを使う'],
        ['find books about solar energy', 'Search on the computer near the door.', '太陽エネルギーの本を探す', 'ドア近くのパソコンで検索する'],
        ['buy a monthly commuter pass', 'Use the ticket machine by Gate One.', '1か月の定期券を買う', '1番改札横の券売機を使う'],
        ['apply for the English summer camp', 'Hand this paper to Mr. Clark today.', '英語サマーキャンプに申し込む', '今日クラーク先生にこの用紙を出す'],
        ['pay for these concert tickets', 'You can pay at any convenience store.', 'コンサートチケット代を払う', 'どのコンビニでも支払える'],
        ['get to the rooftop botanical garden', 'Take the glass elevator to the fifth floor.', '屋上植物園へ行く', 'ガラスのエレベーターで5階へ行く'],
        ['print photos from my smartphone', 'Connect to the store machine over there.', 'スマホから写真を印刷する', 'あそこの店頭端末に接続する'],
        ['enter the school photography contest', 'Upload your best photo by Friday.', '校内写真コンテストに応募する', '金曜までにベスト写真をアップロードする'],
      ];
      const [taskEn, ansEn, taskJa, ansJa] = tasks[round - 1];
      return {
        placeEn: 'a reception counter at a public facility',
        propsEn: 'an information counter and a brochure stand',
        actionEn: 'asking staff a question across the counter',
        summaryJa: '施設の受付カウンターで手続き方法を尋ねている場面',
        l1: `Good afternoon! Welcome to our service desk, ${name2}.`,
        l2: `Hello. How can I ${taskEn}?`,
        j1: `こんにちは！案内カウンターへようこそ。`,
        j2: `こんにちは。どうすれば${taskJa}ことができますか。`,
        correct: ansEn,
        cReason: `How can I ...?（どうやって〜できますか）に対し、「${ansJa}」と具体的な手続き手順を示している。`,
        wrongs: ['Yes, you did a great job.', 'About forty people joined last year.'] as [string, string],
        wReasons: [
          '疑問詞 How の質問に Yes では答えられず、褒め言葉になっていて不適切。',
          '昨年の参加者数を述べており、申し込み方法への答えではない。',
        ] as [string, string],
        exp: `方法を尋ねる How can I ...? には具体的な手順を指示する応答を選ぶ。`,
        ev: `How can I ${taskEn}`,
        skill: '手段・方法',
      };
    },
    // 4: 経験を尋ねる（Have you ever ...?）
    () => {
      const exps = [
        ['ridden a horse on a ranch', 'Yes, once when I visited Hokkaido.', '牧場で馬に乗ったこと', '北海道に行ったときに一度ある'],
        ['made fresh pasta from flour', 'No, never, so I want to try today.', '小麦粉から生パスタを作ったこと', '一度もないので今日試したい'],
        ['seen wild dolphins in the ocean', 'Yes, twice during a boat tour.', '海で野生のイルカを見たこと', 'ボートツアー中に二度ある'],
        ['spoken in front of the whole school', 'No, this Monday will be my first time.', '全校生徒の前で話したこと', '今度の月曜が初めてになる'],
        ['stayed in a traditional wooden inn', 'Yes, with my grandparents last autumn.', '伝統的な木造旅館に泊まったこと', '昨秋祖父母と一緒に泊まった'],
        ['tried canoeing on a mountain lake', 'Yes, it was exciting and peaceful.', '山の湖でカヌーをしたこと', '楽しくて穏やかだった'],
        ['baked cinnamon rolls at home', 'No, but my sister makes them often.', '家でシナモンロールを焼いたこと', 'ないけれど姉がよく作る'],
        ['visited the historical castle in Matsumoto', 'Yes, I went there two summers ago.', '松本の歴史ある城を訪れたこと', '2年前の夏に行った'],
        ['watched a live orchestra concert', 'Yes, our class went last November.', '生のオーケストラ公演を見たこと', '昨年の11月にクラスで行った'],
        ['grown tomatoes on a balcony', 'Yes, we harvested twenty red ones.', 'ベランダでトマトを育てたこと', '赤い実を20個収穫した'],
        ['climbed Mount Tsukuba in autumn', 'No, I would love to go someday.', '秋に筑波山に登ったこと', 'いつかぜひ行ってみたい'],
        ['played rugby in gym class', 'Yes, we learned the rules last term.', '体育の授業でラグビーをしたこと', '前学期にルールを習った'],
        ['written a letter in English', 'Yes, I write to a pen pal in Canada.', '英語で手紙を書いたこと', 'カナダのペンパルに書いている'],
        ['seen a lunar eclipse at night', 'Yes, I watched one from our roof.', '夜に月食を見たこと', '家の屋上から見たことがある'],
        ['used a sewing machine by yourself', 'Yes, I made a tote bag last month.', '一人でミシンを使ったこと', '先月トートバッグを作った'],
      ];
      const [expEn, ansEn, expJa, ansJa] = exps[round - 1];
      return {
        placeEn: 'a classroom lounge with two chairs',
        propsEn: 'a small round table and two cups',
        actionEn: 'having a friendly conversation',
        summaryJa: 'テーブルを挟んで楽しそうに会話している場面',
        l1: `Look at this magazine photo, ${name1}. It looks amazing!`,
        l2: `It really does, ${name2}. Have you ever ${expEn}?`,
        j1: `この雑誌の写真を見て、${name1}。すごく素敵だよ！`,
        j2: `本当だね、${name2}。今までに${expJa}はある？`,
        correct: ansEn,
        cReason: `現在完了の経験疑問文 Have you ever ...? に対し「${ansJa}」と経験の有無を自然に答えている。`,
        wrongs: ['Tomorrow afternoon at three.', 'It belongs to our art teacher.'] as [string, string],
        wReasons: [
          '未来の日時を答えており、これまでの経験を問う Have you ever ...? と合わない。',
          '持ち主を述べており、経験の質問への返答ではない。',
        ] as [string, string],
        exp: `Have you ever ＋過去分詞? には Yes, once ... / No, never ... など経験で答える。`,
        ev: `Have you ever ${expEn}`,
        skill: '経験',
      };
    },
    // 5: 問題点・困りごとへの申し出（What is the matter?）
    () => {
      const troubles = [
        ['cannot open my locker door', 'ロッカーの扉が開かない', 'in front of school lockers'],
        ['left my lunch money on my desk', '昼食代を家の机に忘れた', 'in front of a cafeteria menu board'],
        ['got lost on the way to Hall C', 'ホールCへ行く途中で迷った', 'in a large conference building'],
        ['broke a string on my guitar', 'ギターの弦が1本切れた', 'in a music practice room'],
        ['cannot connect to the library Wi-Fi', '図書館のWi-Fiにつながらない', 'at a library computer desk'],
        ['twisted my ankle on the stairs', '階段で足首をひねった', 'near a school staircase'],
        ['dropped my contact lens here', 'ここでコンタクトを落とした', 'in a bright washroom'],
        ['missed the last shuttle bus', '最終シャトルバスに乗り遅れた', 'at an outdoor bus stop'],
        ['ran out of black printer ink', 'プリンターの黒インクが切れた', 'beside a desk printer'],
        ['spilled juice on my white shirt', '白いシャツにジュースをこぼした', 'at a picnic table'],
        ['forgot the password for my tablet', 'タブレットのパスワードを忘れた', 'in a computer classroom'],
        ['lost my return train ticket', '帰りの切符をなくした', 'near a station ticket gate'],
        ['feel a bit dizzy from the heat', '暑さで少しめまいがする', 'on a shaded bench outdoors'],
        ['tore the cover of my notebook', 'ノートの表紙が破れた', 'at a classroom desk'],
        ['have a sore throat since morning', '朝から喉が痛い', 'outside the school nurse office'],
      ];
      const [trEn, trJa, placeEn] = troubles[round - 1];
      return {
        placeEn,
        propsEn: 'minimal background items fitting the location',
        actionEn: 'looking worried while speaking to a friend',
        summaryJa: '困った表情で友人に相談している場面',
        l1: `You look worried today, ${name1}.`,
        l2: `Are you okay, or what is wrong?`,
        j1: `今日は心配そうな顔をしているね、${name1}。`,
        j2: `大丈夫？どうしたの？`,
        correct: `Actually, I ${trEn}.`,
        cReason: `what is wrong?（どうしたの？）に対し、「実は${trJa}んだ」と困っている理由を説明している。`,
        wrongs: ['That movie was very funny.', 'You can keep it until Friday.'] as [string, string],
        wReasons: [
          '映画が面白かったという感想で、心配されている場面の返答にならない。',
          '金曜まで借りていいという許可の文で、質問とかみ合わない。',
        ] as [string, string],
        exp: `What is wrong? と尋ねられたら、困っている状況（Actually, I ...）を答える。`,
        ev: 'what is wrong',
        skill: '問題点',
      };
    },
    // 6: 時刻・あとどのくらいか（How soon / When will ... be ready?）
    () => {
      const waits = [
        ['my bicycle repair', 'In about twenty minutes.', '自転車の修理', 'あと20分ほどで'],
        ['our roast chicken pizza', 'In ten minutes. It is in the oven.', 'ローストチキンピザ', 'あと10分で（オーブンの中）'],
        ['the next guided castle tour', 'At two fifteen by the main gate.', '次の城内ガイドツアー', '2時15分に正門前で'],
        ['my new pair of glasses', 'They will be ready this Friday.', '新しい眼鏡', '今週金曜日に仕上がる'],
        ['the dry cleaning for this coat', 'Tomorrow afternoon after three.', 'コートのクリーニング', '明日の午後3時以降に'],
        ['the school bus for the stadium', 'It will arrive in five minutes.', 'スタジアム行きのバス', 'あと5分で到着する'],
        ['the results of the English test', 'Mr. Green will return them Monday.', '英語テストの結果', '月曜にグリーン先生が返す'],
        ['our table by the window', 'Just a few more minutes, please.', '窓際のテーブル席', 'ほんの数分お待ちください'],
        ['the battery replacement', 'We can finish it in fifteen minutes.', '電池交換', '15分で完了できる'],
        ['the fresh strawberry tarts', 'The next batch comes out at noon.', '焼きたてのいちごタルト', '次は正午に焼き上がる'],
        ['the rain to stop today', 'The forecast says around four o\'clock.', '今日の雨がやむの', '予報では4時ごろ'],
        ['the school auditorium doors', 'Staff will open them at one thirty.', '講堂の開場', '係員が1時30分に開ける'],
        ['my passport photo prints', 'In about eight minutes at Counter B.', '証明写真のプリント', 'Bカウンターで約8分後'],
        ['the ferry to Green Island', 'Boarding starts in twelve minutes.', 'グリーン島行きフェリー', '12分後に乗船開始'],
        ['the library book I reserved', 'It should arrive this Thursday.', '予約した図書館の本', '今週木曜に届く予定'],
      ];
      const [itemEn, ansEn, itemJa, ansJa] = waits[round - 1];
      return {
        placeEn: 'a shop or service counter',
        propsEn: 'a service counter and a small clock',
        actionEn: 'checking the waiting time with a clerk',
        summaryJa: 'お店のカウンターで仕上がりや待ち時間を確認している場面',
        l1: `Excuse me, I am waiting for ${itemEn}.`,
        l2: `Could you tell me when it will be ready?`,
        j1: `すみません、${itemJa}を待っています。`,
        j2: `いつ用意ができるか教えていただけますか。`,
        correct: ansEn,
        cReason: `when it will be ready（いつできるか）に対して「${ansJa}」と具体的な見込み時刻・時間を答えている。`,
        wrongs: ['One thousand two hundred yen.', 'Thank you for visiting yesterday.'] as [string, string],
        wReasons: [
          '金額を答えており、完成時刻を尋ねる質問への返答ではない。',
          '昨日の来店への感謝であり、これからの仕上がり予定とかみ合わない。',
        ] as [string, string],
        exp: `when it will be ready? に対して In ... minutes / At ... / This Friday など時を表す応答を選ぶ。`,
        ev: 'when it will be ready',
        skill: '時刻・順序',
      };
    },
    // 7: 提案への条件付き賛成・別案
    () => {
      const ideas = [
        ['study for the science exam at the cafe', 'Good idea, after I finish lunch.', 'カフェで理科試験の勉強をする', '昼食を終えたあとにならいい考えだ'],
        ['buy matching T-shirts for our team', 'Sure! Let\'s check the prices first.', 'チームでお揃いのTシャツを買う', 'いいね、まず値段を確認しよう'],
        ['walk to the museum instead of taking a bus', 'Okay, as long as it does not rain.', 'バスではなく歩いて博物館へ行く', '雨が降らなければいいよ'],
        ['make a short video for the club fair', 'Sounds fun! I can edit the music.', '部活紹介の短い動画を作る', '楽しそう！音楽編集ができるよ'],
        ['invite exchange students to our picnic', 'Definitely! Let\'s ask them today.', '留学生をピクニックに招待する', 'ぜひ！今日声をかけよう'],
        ['clean the club room before Friday', 'Right. How about Thursday after school?', '金曜前に部室を掃除する', 'そうだね、木曜の放課後はどう？'],
        ['share a large vegetable pizza', 'Great! I am getting hungry now.', '大きな野菜ピザを分け合う', 'いいね！ちょうどおなかがすいてきた'],
        ['take the express train to Kobe', 'Sure, let\'s check which platform.', '神戸まで急行電車に乗る', 'いいよ、何番ホームか調べよう'],
        ['borrow camp tents from my uncle', 'That would save us a lot of money!', '叔父からキャンプのテントを借りる', 'それならかなり節約になるね！'],
        ['practice our duet in the music room', 'Okay! Let\'s ask Ms. Sato for the key.', '音楽室で二重奏の練習をする', 'いいよ！佐藤先生に鍵を借りよう'],
        ['plant cherry tomatoes in those pots', 'Nice idea! They grow well in summer.', 'あの鉢にミニトマトを植える', 'いい考え！夏によく育つよ'],
        ['give Mom a handmade photo album', 'She will love that! Let\'s buy paper.', '母に手作りアルバムを贈る', '喜ぶよ！台紙を買いに行こう'],
        ['start jogging twenty minutes every morning', 'Count me in! Let\'s begin tomorrow.', '毎朝20分ジョギングを始める', '私も入れて！明日から始めよう'],
        ['organize our bookshelf by subject', 'Yes, then we can find books fast.', '本棚を教科別に整理する', 'うん、そうすれば本がすぐ見つかる'],
        ['sit on the terrace seats outside', 'Sure, the breeze feels nice today.', '外のテラス席に座る', 'いいよ、今日は風が心地いいし'],
      ];
      const [idEn, ansEn, idJa, ansJa] = ideas[round - 1];
      return {
        placeEn: 'a student lounge with tables',
        propsEn: 'a table, notebooks, and two chairs',
        actionEn: 'talking together over notebooks',
        summaryJa: 'ラウンジのテーブルで相談している場面',
        l1: `Listen ${name1}, I just thought of a good plan.`,
        l2: `What do you think if we ${idEn}?`,
        j1: `聞いて${name1}、ちょっといい案を思いついたんだ。`,
        j2: `私たちが${idJa}というのはどう思う？`,
        correct: ansEn,
        cReason: `What do you think if we ...? という提案に対し、「${ansJa}」と前向きに応じている。`,
        wrongs: ['No, I did not see him there.', 'About three kilometers north.'] as [string, string],
        wReasons: [
          '彼を見なかったという過去の話で、提案に対する意見になっていない。',
          '方角と距離を答えており、提案への返答として不適切。',
        ] as [string, string],
        exp: `提案 What do you think if we ...? に対する自然な賛成応答を選ぶ。`,
        ev: `What do you think if we ${idEn}`,
        skill: '提案',
      };
    },
    // 8: 感想・評価を求める（What did you think of ...?）
    () => {
      const works = [
        ['the mystery novel I lent you', 'The ending really surprised me!', '貸した推理小説', '結末に本当に驚いた'],
        ['the new Italian restaurant', 'The tomato pasta was fantastic.', '新しいイタリア料理店', 'トマトパスタが最高だった'],
        ['our school festival play', 'Everyone acted very naturally.', '文化祭の劇', 'みんなの演技がとても自然だった'],
        ['the documentary about penguins', 'I learned a lot about Antarctica.', 'ペンギンのドキュメンタリー', '南極について多く学べた'],
        ['Mr. Miller\'s science lecture', 'His experiments were easy to follow.', 'ミラー先生の理科講義', '実験がわかりやすかった'],
        ['the new sports shoes you bought', 'They are super light and comfortable.', '買った新しい運動靴', 'とても軽くて履き心地がいい'],
        ['the autumn art exhibition', 'The landscape paintings were lovely.', '秋の美術展', '風景画が素晴らしかった'],
        ['the lemon tart from that bakery', 'It was sweet and not too sour.', 'あのパン屋のレモンタルト', '甘くて酸っぱすぎなかった'],
        ['the city aquarium\'s night tour', 'Seeing glowing jellyfish was magical.', '水族館のナイトツアー', '光るクラゲが幻想的だった'],
        ['the new English study app', 'The short quizzes are really helpful.', '新しい英語学習アプリ', '短いクイズがとても役立つ'],
        ['your cousin\'s violin recital', 'Her tone was warm and clear.', 'いとこのバイオリン発表会', '音色が温かく澄んでいた'],
        ['the botanical garden greenhouse', 'There were so many rare orchids.', '植物園の温室', '珍しいランがたくさんあった'],
        ['the local history comic book', 'It made old events easy to remember.', '郷土史の学習漫画', '昔の出来事が覚えやすかった'],
        ['the summer fireworks by the bay', 'The gold finale was unforgettable.', '湾岸の夏の花火', '最後の金色の花火が忘れられない'],
        ['the new bicycle lane on Main Street', 'Riding to school feels much safer now.', '大通りの新しい自転車レーン', '自転車通学がずっと安全になった'],
      ];
      const [wkEn, ansEn, wkJa, ansJa] = works[round - 1];
      return {
        placeEn: 'by a school window during break',
        propsEn: 'a window frame and a book in hand',
        actionEn: 'chatting and smiling',
        summaryJa: '窓際で笑顔で感想を話している場面',
        l1: `Hi ${name1}! You checked out ${wkEn}, right?`,
        l2: `Yes! Well, wait—no, you tried it first, ${name2}. What did you think of ${wkEn}?`,
        j1: `やあ${name1}！${wkJa}を体験したよね。`,
        j2: `あなたはどう思った？`,
        correct: ansEn,
        cReason: `What did you think of ...? で感想を尋ねられ、「${ansJa}」と具体的な評価を述べている。`,
        wrongs: ['Next Tuesday at four.', 'I will lend it to Kenji.'] as [string, string],
        wReasons: [
          '来週火曜の時刻を述べており、過去の感想への答えではない。',
          'これから誰かに貸す予定であり、どう思ったかへの回答になっていない。',
        ] as [string, string],
        exp: `感想を尋ねる What did you think of ...? に対して具体的な印象を述べる文を選ぶ。`,
        ev: 'What did you think of',
        skill: '感情・評価',
      };
    },
    // 9: 誰が〜したか／人物特定
    () => {
      const whos = [
        ['left this umbrella by the chalkboard', 'Taro did, right after sixth period.', '黒板の横に傘を忘れた', '6限の直後にタロウが置いた'],
        ['baked these walnut brownies', 'My older sister made them last night.', 'くるみブラウニーを焼いた', '昨夜姉が作った'],
        ['drew the dragon on the class poster', 'Mina painted it during art club.', 'ポスターに龍を描いた', '美術部でミナが描いた'],
        ['won first place in the speech contest', 'A second-year student named Ren.', 'スピーチ大会で優勝した', '2年生のレンという生徒'],
        ['fixed the broken microphone stand', 'Mr. Kato repaired it this morning.', '壊れたマイクスタンドを直した', '今朝加藤先生が修理した'],
        ['watered the flowers in the courtyard', 'The gardening committee did before class.', '中庭の花に水をやった', '授業前に園芸委員がやった'],
        ['chose the music for our dance', 'Our captain Saki picked that song.', 'ダンスの曲を選んだ', '部長のサキがその曲を選んだ'],
        ['arranged all the chairs in the gym', 'The basketball team helped out.', '体育館の椅子を全部並べた', 'バスケ部が手伝ってくれた'],
        ['took this team photo at the stadium', 'Coach Honda took it with his camera.', 'スタジアムの集合写真を撮った', '本田コーチがカメラで撮った'],
        ['translated this English poem', 'Ms. Hayashi wrote the Japanese lines.', 'この英語の詩を訳した', '林先生が日本語訳を書いた'],
        ['brought these sweet oranges', 'My grandmother sent them from Ehime.', 'この甘いみかんを持ってきた', '祖母が愛媛から送ってくれた'],
        ['designed our new club badge', 'Kaito sketched it on his tablet.', '新しい部活バッジをデザインした', 'カイトがタブレットで描いた'],
        ['cleaned the science lab sinks', 'Group Three cleaned them yesterday.', '理科室の流しを掃除した', '昨日3班が掃除した'],
        ['wrapped these charity gifts', 'Volunteers from Class Two wrapped them.', 'チャリティーの贈り物を包んだ', '2組のボランティアが包んだ'],
        ['tuned the piano in the hall', 'A technician came early today.', 'ホールのピアノを調律した', '今日早くに技師が来た'],
      ];
      const [actEn, ansEn, actJa, ansJa] = whos[round - 1];
      return {
        placeEn: 'inside a school room with students',
        propsEn: 'a table, a board, and everyday school items',
        actionEn: 'looking curious and pointing at something',
        summaryJa: '室内の物を見て誰がしたのか尋ねている場面',
        l1: `Oh, look over here, ${name1}! Everything looks neat.`,
        l2: `Do you know who ${actEn}?`,
        j1: `ねえこっちを見て、${name1}！`,
        j2: `誰が${actJa}か知っている？`,
        correct: ansEn,
        cReason: `Do you know who ...?（誰が〜したか知っている？）に対し、「${ansJa}」と人物を答えている。`,
        wrongs: ['In the teacher\'s room.', 'About half past three.'] as [string, string],
        wReasons: [
          '場所だけを答えており、誰がしたかという質問とかみ合わない。',
          '時刻を答えており、人物を尋ねる質問への応答ではない。',
        ] as [string, string],
        exp: `Do you know who ...? に対して具体的な人物・グループを挙げる応答を選ぶ。`,
        ev: `Do you know who ${actEn}`,
        skill: '理由',
      };
    },
    // 10: 数量・料金・回数の確認
    () => {
      const checks = [
        ['how often the shuttle bus runs', 'Every fifteen minutes during the day.', 'シャトルバスの運行間隔', '日中は15分おき'],
        ['how many chairs we still need', 'Ten more chairs for the back row.', 'あといくつ椅子が必要か', '後列用にあと10脚'],
        ['how much an adult museum ticket costs', 'Eight hundred yen per adult.', '大人の博物館入館料', '大人1人800円'],
        ['how many pages we must read for homework', 'Pages twelve through twenty.', '宿題で読むページ数', '12ページから20ページまで'],
        ['how far the campground is from here', 'About six kilometers up the road.', 'キャンプ場までの距離', '道を上って約6キロ'],
        ['how many teams entered the tournament', 'Sixteen schools from our city.', '大会の参加チーム数', '市内から16校'],
        ['how much flour goes into this cake', 'Two hundred grams of flour.', 'ケーキに入れる小麦粉の量', '小麦粉200グラム'],
        ['how many stops it is to Central Park', 'Just four stops on the Green Line.', '中央公園まで何駅か', 'グリーン線で4駅だけ'],
        ['how early we must arrive at the airport', 'At least ninety minutes before takeoff.', '空港にどのくらい早く着くべきか', '離陸の少なくとも90分前'],
        ['how many apples are left in the box', 'Five big ones are still inside.', '箱に残っているリンゴの数', '大きいのがまだ5個ある'],
        ['how much luggage we can carry on board', 'One small bag up to ten kilograms.', '機内に持ち込める荷物量', '10キロまでの小さなバッグ1つ'],
        ['how many stamps I need for this card', 'One eighty-five-yen stamp is enough.', 'はがきに必要な切手', '85円切手1枚で十分'],
        ['how deep the community pool is', 'One point two meters in all lanes.', '市民プールの水深', '全レーン1.2メートル'],
        ['how many members are in the choir', 'Thirty-two students altogether.', '合唱部の部員数', '全部で32人の生徒'],
        ['how long the intermission lasts', 'Fifteen minutes before Part Two starts.', '幕間の休憩時間', '第2部が始まるまで15分間'],
      ];
      const [qEn, ansEn, qJa, ansJa] = checks[round - 1];
      return {
        placeEn: 'near a notice board or desk',
        propsEn: 'a blank notice board and a clipboard',
        actionEn: 'checking details on a blank sheet',
        summaryJa: '案内板の近くで詳細を確認している場面',
        l1: `Before we go, ${name1}, let's check one detail.`,
        l2: `Can you check ${qEn}?`,
        j1: `行く前に1つ確認しよう、${name1}。`,
        j2: `${qJa}を確認してくれる？`,
        correct: ansEn,
        cReason: `Can you check ${qEn}? に対し、「${ansJa}」と正確な数値情報を答えている。`,
        wrongs: ['Yes, I enjoyed it a lot.', 'She went home an hour ago.'] as [string, string],
        wReasons: [
          '楽しかったという感想であり、数値・条件の確認への答えではない。',
          '彼女が帰ったという話で、質問の内容と無関係である。',
        ] as [string, string],
        exp: `間接疑問 Can you check how ...? が求める数値・頻度・距離を答える選択肢を選ぶ。`,
        ev: `Can you check ${qEn}`,
        skill: '数量',
      };
    },
  ];

  const d = items[u - 1]();
  const qItem = makeQuestionItem({
    examId,
    questionNumber: u,
    questionPrompt: 'Choose the best response to the second speaker.',
    choicePresentation: 'read-aloud',
    correctChoice: d.correct,
    correctReason: d.cReason,
    wrongChoices: d.wrongs,
    wrongReasons: d.wReasons,
    targetAnswer,
    explanation: d.exp,
    evidence: d.ev,
    skill: d.skill,
  });

  const turns: DialogueTurn[] = [
    { ...sp1, text: d.l1 },
    { ...sp2, text: d.l2 },
    {
      speaker: 'F2',
      roleLabel: 'Narrator',
      text: `Number one. ${qItem.choices[0]} Number two. ${qItem.choices[1]} Number three. ${qItem.choices[2]}`,
    },
  ];

  const image = buildSupportImageSpec(
    audioId,
    d.summaryJa,
    'two students or a student and staff member',
    d.placeEn,
    d.actionEn,
    d.propsEn,
  );

  return makeDialogueUnit({
    examId,
    part: 'part1',
    unitIndex: u,
    readCount: 1, // ★3級第1部は1回読み
    turns,
    translation: `${sp1.roleLabel === 'Man' ? '男性' : '女性'}：${d.j1}\n${sp2.roleLabel === 'Woman' ? '女性' : '男性'}：${d.j2}`,
    image,
    questions: [qItem],
  });
}

function buildG3OrPre2DialogueUnit(
  grade: 'eiken_3' | 'eiken_pre2',
  examId: string,
  round: number,
  u: number,
  readCount: 1 | 2,
): ListeningAudioUnit {
  const [sp1, sp2] = speakerPairFor(round, u);
  const m = M_POOL[(round * 2 + u) % 15];
  const f = F_POOL[(round + u * 3) % 15];
  const qNo = 10 + u;
  const targetAnswer = (round + u + (grade === 'eiken_pre2' ? 1 : 0)) % 4;
  const isG3 = grade === 'eiken_3';
  const who2 = sp2.roleLabel === 'Woman' ? 'the woman' : 'the man';
  const who1 = sp1.roleLabel === 'Man' ? 'the man' : 'the woman';
  const n1 = sp1.roleLabel === 'Man' ? f : m;
  const n2 = sp1.roleLabel === 'Man' ? m : f;

  const topics = [
    // u=1: 予定変更と直後の行動
    () => {
      const places = isG3
        ? ['the planetarium', 'the history museum', 'the botanical garden', 'the aquarium', 'the science hall', 'the craft studio', 'the folk museum', 'the art gallery', 'the railway park', 'the marine center', 'the glass museum', 'the castle tower', 'the nature center', 'the sports museum', 'the pottery hall']
        : ['the modern art wing', 'the city archives', 'the robotics expo', 'the trade fair', 'the photography gallery', 'the university library', 'the design museum', 'the civic observatory', 'the textile museum', 'the culinary fair', 'the film archive', 'the architecture tour', 'the book symposium', 'the natural history hall', 'the ceramic exhibition'];
      const acts = isG3
        ? ['eat lunch at the noodle shop', 'visit the souvenir shop', 'walk around the rose park', 'borrow an audio guide', 'check the locker room']
        : ['have coffee at the museum cafe', 'pick up the discount vouchers', 'register at the welcome booth', 'leave coats in the cloakroom', 'buy the exhibition catalog'];
      const pl = places[round - 1];
      const act = acts[(round - 1) % 5];
      const turns: DialogueTurn[] = [
        { ...sp1, text: `Hi ${n1}, we finally arrived at ${pl}! Shall we go straight into the main hall now?` },
        { ...sp2, text: `Wait, ${n2}. Look at the sign—entry for our ticket group starts in forty minutes.` },
        { ...sp1, text: `Oh, I did not notice that. Should we wait on those benches outside?` },
        { ...sp2, text: `It is chilly outside today, so let's ${act} first and come back at one thirty.` },
        { ...sp1, text: `Sounds good to me!` },
        { speaker: 'F2', roleLabel: 'Narrator', text: `Question. What will they do before entering ${pl}?` },
      ];
      return {
        turns,
        ja: `${pl}に到着したが、入場開始まで40分あるため、外で待つ代わりにまず「${act}」をしてから1時30分に戻ることにした。`,
        prompt: `What will they do before entering ${pl}?`,
        correct: act[0].toUpperCase() + act.slice(1) + '.',
        cReason: `so let's ${act} first に相手が Sounds good to me! と同意している。`,
        wrongs: ['Go straight into the main hall.', 'Wait on the benches outside.', 'Take a bus back to the station.'] as [string, string, string],
        wReasons: [
          'すぐに入場しようとしたが40分待ちのため変更された。',
          '外のベンチは肌寒いため却下されている。',
          'バスで駅へ戻るとは一度も言っていない。',
        ] as [string, string, string],
        exp: `入場時刻までの待ち時間に let's ${act} first と決めた行動を聞き取る。`,
        ev: `let's ${act} first`,
        skill: '予定変更',
      };
    },
    // u=2: 買い物での返品・交換・在庫確認
    () => {
      const goods = isG3
        ? ['running jacket', 'canvas backpack', 'badminton racket', 'wool cardigan', 'desk lamp', 'waterproof watch', 'hiking boots', 'folding umbrella', 'travel pouch', 'tennis skirt', 'fleece vest', 'leather belt', 'bike helmet', 'laptop sleeve', 'insulated mug']
        : ['wireless keyboard', 'linen blazer', 'camping lantern', 'ceramic kettle', 'yoga mat', 'running shoes', 'leather briefcase', 'desk organizer', 'rain parka', 'thermal flask', 'reading lamp', 'cotton cardigan', 'carry-on bag', 'badminton shoes', 'bluetooth speaker'];
      const colors = ['navy blue', 'forest green', 'dark gray', 'burgundy', 'light beige'];
      const item = goods[round - 1];
      const col = colors[(round - 1) % 5];
      const turns: DialogueTurn[] = [
        { ...sp1, text: `Excuse me, I really like this ${item}, but do you have it in ${col}?` },
        { ...sp2, text: `Let me check our stockroom... I am sorry, ${col} is sold out at this branch today.` },
        { ...sp1, text: `Oh, I need it for a trip next Friday. Can you order it from another store?` },
        { ...sp2, text: `Yes! It will arrive here on Tuesday afternoon, and we will call your phone.` },
        { ...sp1, text: `Great, please order one for me.` },
        { speaker: 'F2', roleLabel: 'Narrator', text: `Question. What will ${who1} do?` },
      ];
      return {
        turns,
        ja: `客は${col}の${item}を探しているが在庫切れのため、他店舗から取り寄せてもらい火曜午後に受け取ることにした。`,
        prompt: `What will ${who1} do?`,
        correct: `Have the store order the ${item}.`,
        cReason: `Can you order it from another store? と尋ね、最後に please order one for me と注文を依頼している。`,
        wrongs: [
          'Buy a different color right now.',
          'Go to another store tonight.',
          'Cancel the trip next Friday.',
        ] as [string, string, string],
        wReasons: [
          '今すぐ別の色を買うとは述べていない。',
          '今夜自分で別店舗へ行くのではなく取り寄せを頼んでいる。',
          '来週金曜の旅行を中止するとは言っていない。',
        ] as [string, string, string],
        exp: `在庫切れのあと、他店からの取り寄せ（order one for me）を依頼した流れを把握する。`,
        ev: 'please order one for me',
        skill: '依頼内容',
      };
    },
    // u=3: 遅刻・欠席の理由
    () => {
      const reasons = isG3
        ? ['helped a lost child find the station', 'had to wait for a delayed train', 'went back home for a forgotten textbook', 'had a flat tire on the bicycle', 'waited for the dentist to finish']
        : ['assisted an elderly passenger on the platform', 'waited because of a signal inspection', 'had to reschedule a clinic appointment', 'returned home to lock the front door', 'dealt with a sudden bicycle chain problem'];
      const events = ['choir rehearsal', 'project meeting', 'tennis practice', 'study session', 'club interview', 'volunteer orientation', 'drama practice', 'band rehearsal', 'committee meeting', 'cooking lesson', 'debate practice', 'art workshop', 'cleanup event', 'science seminar', 'reading circle'];
      const rsn = reasons[(round - 1) % 5];
      const ev = events[round - 1];
      const turns: DialogueTurn[] = [
        { ...sp1, text: `Sorry I am fifteen minutes late for our ${ev}, ${n1}!` },
        { ...sp2, text: `No worries, ${n2}. Did your bus get stuck in traffic again?` },
        { ...sp1, text: `Actually, the bus was on time, but I ${rsn} on my way here.` },
        { ...sp2, text: `Oh, I understand! Come sit down—we just started reviewing page four.` },
        { speaker: 'F2', roleLabel: 'Narrator', text: `Question. Why was ${who1} late for the ${ev}?` },
      ];
      return {
        turns,
        ja: `${ev}に15分遅れて到着した理由として、バスの渋滞ではなく「途中で${rsn}ため」と説明している。`,
        prompt: `Why was ${who1} late for the ${ev}?`,
        correct: `${sp1.roleLabel === 'Man' ? 'He' : 'She'} ${rsn}.`,
        cReason: `but I ${rsn} on my way here と遅れた本当の理由を述べている。`,
        wrongs: [
          'The bus got stuck in heavy traffic.',
          'The meeting room was changed.',
          'The alarm clock did not ring.',
        ] as [string, string, string],
        wReasons: [
          'バスの渋滞は相手が推測しただけで、バスは定刻だったと否定されている。',
          '部屋の変更については会話で触れられていない。',
          '目覚まし時計の話は一切出てこない。',
        ] as [string, string, string],
        exp: `相手の推測（traffic）ではなく、Actually, ... but I ${rsn} の実際の理由を選ぶ。`,
        ev: rsn,
        skill: '理由',
      };
    },
    // u=4: 役割分担（相手ではなく本人が何をするか）
    () => {
      const myTasks = isG3
        ? ['print fifty copies of the program', 'buy drinks and snacks at the supermarket', 'set up the microphone and speakers', 'make name tags for the guests', 'decorate the welcome board']
        : ['prepare the slideshow on the laptop', 'contact the guest speaker by email', 'reserve seats at the restaurant', 'check the budget spreadsheet', 'arrange transportation from the station'];
      const otherTasks = ['sweep the hall floor', 'borrow extra folding chairs', 'put up posters at the gate'];
      const task = myTasks[(round - 1) % 5];
      const events = ['farewell party', 'cultural fair', 'speech contest', 'charity concert', 'open campus day', 'book exchange', 'science fair', 'alumni tea party', 'international day', 'music night', 'art showcase', 'debate forum', 'winter festival', 'club welcome day', 'poster session'];
      const ev = events[round - 1];
      const turns: DialogueTurn[] = [
        { ...sp1, text: `Our ${ev} is tomorrow morning, ${n1}. Have we finished preparing everything?` },
        { ...sp2, text: `Almost! I will ${otherTasks[0]} right now, and Kenji will ${otherTasks[1]}.` },
        { ...sp1, text: `Great. Then I will ${task} before five o'clock today.` },
        { ...sp2, text: `Thanks, ${n2}! That will save us a lot of time tomorrow.` },
        { speaker: 'F2', roleLabel: 'Narrator', text: `Question. What will ${who1} do today?` },
      ];
      return {
        turns,
        ja: `明日の${ev}に向けて3人の作業を整理し、最初の話者は本日5時までに「${task}」を担当することになった。`,
        prompt: `What will ${who1} do today?`,
        correct: task[0].toUpperCase() + task.slice(1) + '.',
        cReason: `Then I will ${task} before five o'clock today. と本人が担当を宣言している。`,
        wrongs: [
          otherTasks[0][0].toUpperCase() + otherTasks[0].slice(1) + '.',
          otherTasks[1][0].toUpperCase() + otherTasks[1].slice(1) + '.',
          otherTasks[2][0].toUpperCase() + otherTasks[2].slice(1) + '.',
        ] as [string, string, string],
        wReasons: [
          `${otherTasks[0]} は対話相手が担当する仕事である。`,
          `${otherTasks[1]} はケンジが担当する仕事である。`,
          `${otherTasks[2]} は会話に登場しない作業である。`,
        ] as [string, string, string],
        exp: `3人の作業が並ぶ中で、設問が問う話者（${who1}）自身の I will ${task} を聞き分ける。`,
        ev: `Then I will ${task}`,
        skill: '依頼内容',
      };
    },
    // u=5: 料金・コース比較
    () => {
      const courses = isG3
        ? [
            ['two-hour boat tour', 'fifteen hundred yen', 'twelve hundred yen', 'two thousand yen', 'three thousand yen', '2時間ボートツアー'],
            ['beginner climbing lesson', 'eighteen hundred yen', 'fifteen hundred yen', 'twenty-two hundred yen', 'twenty-five hundred yen', '初心者クライミング講座'],
            ['pottery painting course', 'fourteen hundred yen', 'one thousand yen', 'sixteen hundred yen', 'two thousand yen', '絵付け体験コース'],
          ]
        : [
            ['weekend museum pass', 'sixteen hundred yen', 'twelve hundred yen', 'two thousand yen', 'twenty-four hundred yen', '週末ミュージアムパス'],
            ['guided kayaking session', 'twenty-five hundred yen', 'two thousand yen', 'three thousand yen', 'thirty-five hundred yen', 'ガイド付きカヤック体験'],
            ['one-day cycling package', 'nineteen hundred yen', 'fifteen hundred yen', 'twenty-three hundred yen', 'twenty-eight hundred yen', '1日サイクリングパック'],
          ];
      const [cName, ansP, w1, w2, w3, jaName] = courses[(round - 1) % 3];
      const spots = ['Lake Aoba', 'Mount Midori', 'Harbor Craft Park', 'Sunny Bay', 'Maple Valley', 'Blue River', 'Cedar Hill', 'Coral Beach', 'Star Highland', 'Clover Ranch', 'Breeze Island', 'Silver Falls', 'Amber Forest', 'Sunrise Cape', 'birch Park'].map(s => s[0].toUpperCase() + s.slice(1));
      const spot = spots[round - 1];
      const turns: DialogueTurn[] = [
        { ...sp1, text: `Welcome to ${spot}! Are you interested in our ${cName}?` },
        { ...sp2, text: `Yes! The brochure says the regular fee is ${w2}, right?` },
        { ...sp1, text: `On weekdays, we offer a special discount, so it is ${ansP} per person.` },
        { ...sp2, text: `Today is Wednesday, so that applies to me! Here is my payment.` },
        { speaker: 'F2', roleLabel: 'Narrator', text: `Question. How much will ${who2} pay for the ${cName}?` },
      ];
      return {
        turns,
        ja: `${spot}の${jaName}は通常${w2}だが、平日割引が適用されて水曜日の今日は1人${ansP}になる。`,
        prompt: `How much will ${who2} pay for the ${cName}?`,
        correct: ansP[0].toUpperCase() + ansP.slice(1) + '.',
        cReason: `平日割引により so it is ${ansP} per person と案内され、水曜なのでその金額で支払っている。`,
        wrongs: [
          w1[0].toUpperCase() + w1.slice(1) + '.',
          w2[0].toUpperCase() + w2.slice(1) + '.',
          w3[0].toUpperCase() + w3.slice(1) + '.',
        ] as [string, string, string],
        wReasons: [
          `${w1} という金額は会話に出てこない。`,
          `${w2} は割引前の通常料金であり、平日の支払額ではない。`,
          `${w3} も提示されていない金額である。`,
        ] as [string, string, string],
        exp: `通常料金 ${w2} と平日割引料金 ${ansP} を区別して聞き取る。`,
        ev: `so it is ${ansP} per person`,
        skill: '数量',
      };
    },
    // u=6: 助言を受けて次にすること
    () => {
      const advices = isG3
        ? ['talk to Ms. Carter in the English room', 'practice speaking in front of a mirror', 'borrow a CD from the school library', 'join the Friday lunchtime chat table', 'watch short English news videos']
        : ['speak with the academic advisor today', 'attend the free trial workshop on Thursday', 'review the vocabulary list every morning', 'record his or her own voice on a phone', 'read short science articles aloud'];
      const rawAdv = advices[(round - 1) % 5];
      const adv = rawAdv.replace('his or her', sp1.roleLabel === 'Man' ? 'his' : 'her');
      const goals = ['improve English pronunciation', 'prepare for the interview test', 'memorize speech lines', 'gain confidence in discussions', 'understand fast conversations', 'pass the speaking exam', 'give a clear presentation', 'learn natural expressions', 'host foreign visitors', 'lead the English tour', 'enter the recitation contest', 'study abroad next spring', 'join the debate match', 'read stories to kids', 'make an audio guide'];
      const goal = goals[round - 1];
      const turns: DialogueTurn[] = [
        { ...sp1, text: `I want to ${goal}, ${n1}, but I am not sure how to start.` },
        { ...sp2, text: `Well, ${n2}, when I had the same goal last term, one thing worked really well.` },
        { ...sp1, text: `Really? Should I buy an expensive textbook at the bookstore?` },
        { ...sp2, text: `You do not need to. Instead, you should ${adv}.` },
        { ...sp1, text: `That sounds practical! I will try that right away.` },
        { speaker: 'F2', roleLabel: 'Narrator', text: `Question. What does ${who2} advise ${who1} to do?` },
      ];
      return {
        turns,
        ja: `${goal}という目標に対し、高い参考書を買う必要はなく「${adv}」をするよう助言している。`,
        prompt: `What does ${who2} advise ${who1} to do?`,
        correct: adv[0].toUpperCase() + adv.slice(1) + '.',
        cReason: `Instead, you should ${adv}. と具体的に助言し、相手も試すと答えている。`,
        wrongs: [
          'Buy an expensive textbook today.',
          'Take a two-month break from clubs.',
          'Change to a different class.',
        ] as [string, string, string],
        wReasons: [
          '高いテキストを買う必要はない（You do not need to）と否定されている。',
          '部活を2か月休むという話は一切出ていない。',
          '別のクラスに移るという提案もされていない。',
        ] as [string, string, string],
        exp: `You do not need to の後に続く Instead, you should ${adv} を聞き取る。`,
        ev: `you should ${adv}`,
        skill: '提案',
      };
    },
    // u=7: 旅行・イベントの感想（一番良かった点）
    () => {
      const bests = isG3
        ? ['watching the sunrise from the hilltop', 'trying fresh seafood at the morning market', 'riding the steam train through the valley', 'making handmade paper with local artisans', 'listening to folk music around the fire']
        : ['joining the guided night walk in the forest', 'talking with local potters in their studio', 'cycling across the suspension bridges', 'learning regional cooking from a chef', 'observing migratory birds at the wetland'];
      const best = bests[(round - 1) % 5];
      const regions = ['Nagano', 'Kanazawa', 'Hakodate', 'Matsue', 'Takayama', 'Kagoshima', 'Sendai', 'Kurashiki', 'Otaru', 'Nikko', 'wakayama', 'Nagasaki', 'Toyama', 'Aomori', 'Kumamoto'].map(s => s[0].toUpperCase() + s.slice(1));
      const reg = regions[round - 1];
      const turns: DialogueTurn[] = [
        { ...sp1, text: `Welcome back from your trip to ${reg}, ${n1}! Did you enjoy the famous castle there?` },
        { ...sp2, text: `The castle was under repair, so we could only see the outside gate.` },
        { ...sp1, text: `Oh, that is a shame. What was the best part of your trip then?` },
        { ...sp2, text: `Definitely ${best}. I will never forget it!` },
        { speaker: 'F2', roleLabel: 'Narrator', text: `Question. What did ${who2} enjoy most on the trip to ${reg}?` },
      ];
      return {
        turns,
        ja: `${reg}旅行では城が修理中だったが、一番良かった体験は「${best}」だったと振り返っている。`,
        prompt: `What did ${who2} enjoy most on the trip to ${reg}?`,
        correct: best[0].toUpperCase() + best.slice(1) + '.',
        cReason: `What was the best part ...? に対し Definitely ${best}. と最も楽しかったことを挙げている。`,
        wrongs: [
          'Going inside the famous castle.',
          'Shopping at a big airport mall.',
          'Swimming at an indoor hotel pool.',
        ] as [string, string, string],
        wReasons: [
          '城は修理中で外門しか見られなかったと述べている。',
          '空港のショッピングモールの話は出てこない。',
          'ホテルの室内プールについても言及されていない。',
        ] as [string, string, string],
        exp: `修理中だった城ではなく、Definitely ${best} と答えた最高の見どころを選ぶ。`,
        ev: `Definitely ${best}`,
        skill: '感情・評価',
      };
    },
    // u=8: 順番・時系列の把握（〜したあとに何をするか）
    () => {
      const step1s = ['clean the art tables', 'submit the permission slip', 'check the microphone battery', 'finish the warm-up run', 'put the groceries in the fridge'];
      const afters = isG3
        ? ['carry the paintings to the hallway', 'pick up the uniform at the gym', 'test the projector screen', 'practice passing drills in pairs', 'peel potatoes for beef stew']
        : ['hang the exhibition labels on the wall', 'attend the captain\'s briefing in Room B', 'adjust the stage lighting angles', 'review the video of last week\'s game', 'marinate the chicken for thirty minutes'];
      const s1 = step1s[(round - 1) % 5];
      const s2 = afters[(round - 1) % 5];
      const turns: DialogueTurn[] = [
        { ...sp1, text: `Excuse me ${n1}, it is period ${round} break—should we ${s2} right now?` },
        { ...sp2, text: `Hold on, ${n2}. First we must ${s1} so everything is ready.` },
        { ...sp1, text: `Right! And right after we ${s1}, we will ${s2}, correct?` },
        { ...sp2, text: `Exactly. Let's get started!` },
        { speaker: 'F2', roleLabel: 'Narrator', text: `Question. What will they do right after they ${s1}?` },
      ];
      return {
        turns,
        ja: `最初に「${s1}」を済ませ、その直後に「${s2}」を行う手順を確認している。`,
        prompt: `What will they do right after they ${s1}?`,
        correct: s2[0].toUpperCase() + s2.slice(1) + '.',
        cReason: `right after we ${s1}, we will ${s2} に Exactly と同意している。`,
        wrongs: [
          'Go home for the day.',
          'Order lunch from a cafe.',
          'Call the school principal.',
        ] as [string, string, string],
        wReasons: [
          'そのまま帰宅するとは述べていない。',
          'カフェから昼食を注文する話は出ていない。',
          '校長先生に電話するという内容も会話にない。',
        ] as [string, string, string],
        exp: `First と right after の前後関係を整理して ${s2} を選ぶ。`,
        ev: `we will ${s2}`,
        skill: '出来事の順序',
      };
    },
    // u=9: 病院・修理・予約日時の変更
    () => {
      const days = [
        ['Thursday at four thirty', 'Tuesday at three', 'Wednesday at five', 'Friday at two'],
        ['Wednesday at five o\'clock', 'Monday at four', 'Thursday at two', 'Saturday at ten'],
        ['Friday at ten thirty', 'Tuesday at eleven', 'Wednesday at nine', 'Saturday at one'],
      ];
      const [ansD, oldD, w2, w3] = days[(round - 1) % 3];
      const clinics = ['Midori Dental Office', 'Sakura Eye Clinic', 'Aoba Hair Salon', 'Harbor Bike Repair', 'Maple Piano Studio', 'Clover Animal Clinic', 'Star Optical Shop', 'Sunny Skin Clinic', 'River Watch Repair', 'Hilltop Orthodontics', 'Breeze Violin Shop', 'Crown Tailor Shop', 'Forest Counseling Room', 'Central Photo Studio', 'Sunrise Tutoring Desk'];
      const cl = clinics[round - 1];
      const turns: DialogueTurn[] = [
        { ...sp1, text: `Hello, ${cl}. How may I help you today?` },
        { ...sp2, text: `Hello, this is ${n1}. I have an appointment on ${oldD}, but I have to work late that day.` },
        { ...sp1, text: `No problem. Would ${w2} work for you, or how about ${ansD}?` },
        { ...sp2, text: `${w2} is tough for me, so ${ansD} would be great, please.` },
        { ...sp1, text: `All set for ${ansD}. See you then!` },
        { speaker: 'F2', roleLabel: 'Narrator', text: `Question. When is ${who2}'s new appointment?` },
      ];
      return {
        turns,
        ja: `${cl}の予約変更の電話。元の${oldD}や候補の${w2}ではなく、「${ansD}」に新しい予約が確定した。`,
        prompt: `When is ${who2}'s new appointment?`,
        correct: `On ${ansD}.`,
        cReason: `${ansD} would be great と希望し、受付も All set for ${ansD} と確定している。`,
        wrongs: [`On ${oldD}.`, `On ${w2}.`, `On ${w3}.`] as [string, string, string],
        wReasons: [
          `${oldD} は変更前の元の予約日時である。`,
          `${w2} は都合が悪い（tough for me）として断った日時である。`,
          `${w3} は会話に登場しない日時である。`,
        ] as [string, string, string],
        exp: `元の予約日時・断った候補・最終確定日時（All set for ${ansD}）の3つを聞き分ける。`,
        ev: `All set for ${ansD}`,
        skill: '予定変更',
      };
    },
    // u=10: 落とし物・特徴の聞き取り
    () => {
      const items = isG3
        ? [
            ['a navy umbrella with a wooden handle', 'a navy umbrella with a plastic handle', 'a black umbrella with a wooden handle', 'a red folding umbrella'],
            ['a canvas tote bag with two outside pockets', 'a leather bag with no pockets', 'a canvas tote bag with a zipper only', 'a black sports backpack'],
            ['a silver water bottle with a star sticker', 'a gold water bottle with a star sticker', 'a silver water bottle with a name tag', 'a blue plastic cup'],
          ]
        : [
            ['a brown leather notebook with a brass clip', 'a black leather notebook with a ribbon', 'a brown cloth notebook with a zipper', 'a gray plastic file folder'],
            ['a gray wool scarf with white stripes', 'a gray silk scarf with black dots', 'a navy wool scarf with fringes only', 'a beige cotton shawl'],
            ['a black glasses case with a green lining', 'a black glasses case with a red lining', 'a silver metal case with no lining', 'a brown soft pouch'],
          ];
      const [ans, w1, w2, w3] = items[(round - 1) % 3];
      const desks = ['Central Station Lost and Found', 'City Library Front Desk', 'Civic Hall Information', 'Harbor Mall Counter', 'Green Park Office', 'West Bus Terminal', 'Sakura Theater Lobby', 'Museum Security Desk', 'Sports Arena Reception', 'Aquarium Service Booth', 'Airport Desk Three', 'Youth Plaza Counter', 'Botanical House Desk', 'Ferry Terminal Office', 'Science Dome Counter'];
      const desk = desks[round - 1];
      const turns: DialogueTurn[] = [
        { ...sp1, text: `Excuse me, is this ${desk}? I left my item on a bench twenty minutes ago.` },
        { ...sp2, text: `Several items were turned in today. Could you describe what yours looks like?` },
        { ...sp1, text: `Sure. It is ${ans}.` },
        { ...sp2, text: `Ah, yes! Someone just brought ${ans} five minutes ago. Here you go.` },
        { speaker: 'F2', roleLabel: 'Narrator', text: `Question. Which item belongs to ${who1}?` },
      ];
      return {
        turns,
        ja: `${desk}で忘れ物の特徴を尋ねられ、「${ans}」と答えて無事受け取っている。`,
        prompt: `Which item belongs to ${who1}?`,
        correct: ans[0].toUpperCase() + ans.slice(1) + '.',
        cReason: `It is ${ans}. と色・素材・細部の特徴まで一致している。`,
        wrongs: [
          w1[0].toUpperCase() + w1.slice(1) + '.',
          w2[0].toUpperCase() + w2.slice(1) + '.',
          w3[0].toUpperCase() + w3.slice(1) + '.',
        ] as [string, string, string],
        wReasons: [
          `${w1} は持ち手や裏地など細部の特徴が会話と異なっている。`,
          `${w2} は色や仕様が説明と食い違っている。`,
          `${w3} はまったく別の種類の品物である。`,
        ] as [string, string, string],
        exp: `色や素材だけでなく with 以下の特徴まで含めて ${ans} を正確に聞き取る。`,
        ev: `It is ${ans}`,
        skill: '比較',
      };
    },
  ];

  const d = topics[u - 1]();
  const qItem = makeQuestionItem({
    examId,
    questionNumber: qNo,
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
    part: 'part2',
    unitIndex: u,
    readCount,
    turns: d.turns,
    translation: d.ja,
    image: null,
    questions: [qItem],
  });
}

function buildG3OrPre2PassageUnit(
  grade: 'eiken_3' | 'eiken_pre2',
  examId: string,
  round: number,
  u: number,
  readCount: 1 | 2,
): ListeningAudioUnit {
  const qNo = 20 + u;
  const targetAnswer = (round * 2 + u) % 4;
  const isG3 = grade === 'eiken_3';
  const personM = M_POOL[(round + u * 2) % 15];
  const personF = F_POOL[(round * 3 + u) % 15];

  const passages = [
    // 1: 地域イベント・案内放送
    () => {
      const towns = ['Midori Town', 'Kaede City', 'Aoba Village', 'Harbor District', 'Sakura Ward', 'Wakaba City', 'Minato Town', 'Kogen Village', 'Asahi Ward', 'komorebi Town', 'Izumi City', 'Kasumi Ward', 'Tachibana Town', 'Nagisa City', 'suzukaze Town'].map(s => s[0].toUpperCase() + s.slice(1));
      const benefits = isG3
        ? ['a reusable cotton shopping bag', 'a cup of hot ginger tea', 'a packet of sunflower seeds', 'a handmade cedar coaster', 'a local map and sticker set']
        : ['a voucher for the farmers\' market', 'a guided tour of the old lighthouse', 'a booklet of traditional recipes', 'a sample jar of local wildflower honey', 'a free shuttle pass for the day'];
      const town = towns[round - 1];
      const ben = benefits[(round - 1) % 5];
      const text = `Welcome to the ${town} Autumn Festival! Events are taking place in three parks until five o'clock today. Visitors who collect stamps from all three booths can receive ${ben} at the main tent near the fountain. Also, the folk dance performance will start at two thirty on the east stage.`;
      return {
        text,
        ja: `${town}秋祭りへの案内放送。3つのブースすべてのスタンプを集めた来場者は、噴水近くの本部テントで「${ben}」を受け取れる。`,
        prompt: 'What can visitors receive if they collect stamps from all three booths?',
        correct: ben[0].toUpperCase() + ben.slice(1) + '.',
        cReason: `Visitors who collect stamps from all three booths can receive ${ben} と明言されている。`,
        wrongs: ['A folk dance costume.', 'A free parking ticket.', 'A box of roasted chestnuts.'] as [string, string, string],
        wReasons: [
          '民族舞踊は東ステージで行われる演目であり、景品ではない。',
          '無料駐車券については放送で触れられていない。',
          '焼き栗の箱も特典として述べられていない。',
        ] as [string, string, string],
        exp: `条件節 if/who collect stamps from all three booths に対応する特典 ${ben} を聞き取る。`,
        ev: `can receive ${ben}`,
        skill: '数量',
      };
    },
    // 2: 歴史・文化のミニ解説
    () => {
      const subjects = [
        ['the historic wooden clock tower in Bellville', 'a local watchmaker donated it in eighteen ninety', 'to help farmers check the time from the fields'],
        ['the stone arched bridge in Riverdale', 'town merchants built it over two summers', 'to carry heavy tea carts safely across the river'],
        ['the red brick library in Oakwood', 'a retired ship captain funded the building', 'to give young sailors free books to study'],
        ['the hilltop windomill in Meadowbrook', 'villagers worked together to raise its sails', 'to grind wheat during dry summer months'],
        ['the glass botanical dome in Sunport', 'botanists brought rare tropical trees by ship', 'to teach schoolchildren about rainforest plants'],
      ];
      const [sub, fact, purpose] = subjects[(round - 1) % 5];
      const intros = [
        'Good morning, tour guests!', 'Welcome to stop number two!', 'Hello everyone, look ahead!',
        'Thank you for joining our walk!', 'Here is an interesting landmark!', 'Let us stop here for a moment!',
        'Welcome to our heritage tour!', 'Please gather near the sign!', 'Good afternoon, visitors!',
        'Today on our walking tour,', 'Right in front of you stands', 'As we continue our city walk,',
        'Welcome to the old quarter!', 'Listeners on our audio tour,', 'Before we enter the courtyard,',
      ];
      const text = `${intros[round - 1]} We are now looking at ${sub.replace('windomill', 'windmill')}. Records show that ${fact}. Originally, it was created ${purpose}. Today, it remains one of the most photographed spots in the region.`;
      return {
        text,
        ja: `観光ガイドによる解説。${fact}という経緯があり、もともとは「${purpose}」という目的で作られた。`,
        prompt: 'Why was this landmark originally created?',
        correct: purpose[0].toUpperCase() + purpose.slice(1) + '.',
        cReason: `Originally, it was created ${purpose}. と創建の目的が述べられている。`,
        wrongs: [
          'To serve as a royal summer palace.',
          'To store salt from nearby beaches.',
          'To host international sports games.',
        ] as [string, string, string],
        wReasons: [
          '王室の夏の離宮として作られたとは述べられていない。',
          '近くの浜の塩を保管するためという説明はない。',
          '国際スポーツ大会を開くためとも言っていない。',
        ] as [string, string, string],
        exp: `Originally, it was created to ... の目的表現を聞き取る。`,
        ev: `created ${purpose}`,
        skill: '理由',
      };
    },
    // 3: 電車・交通機関の車内放送
    () => {
      const lines = ['Express Blue Liner', 'Rapid Coastal Train', 'Airport Shuttle Green', 'Mountain View Limited', 'Harbor Loop Line', 'Northern Valley Express', 'Sunrise Commuter Rapid', 'Silver Lake Liner', 'Central Metro Express', 'Maple Canyon Train', 'Westward Rapid', 'Bayfront Liner', 'Highland Express', ' Riverfront Rapid', 'Starlight Airport Line'].map(s => s.trim());
      const changes = [
        ['transfer at Eastgate Station to Platform Four', '東ゲート駅の4番ホームで乗り換える'],
        ['move to the first three cars before Oak Station', 'オーク駅の手前で前3両へ移動する'],
        ['use the free connecting bus from South Pier', 'サウスピアから無料連絡バスを使う'],
        ['change to the local train at Pine Junction', 'パイン接続駅で普通列車に乗り換える'],
        ['exit from the rear doors at Hilltop Stop', 'ヒルトップ停留所では後ろのドアから降りる'],
      ];
      const line = lines[round - 1];
      const [chgEn, chgJa] = changes[(round - 1) % 5];
      const text = `Ladies and gentlemen, thank you for riding the ${line}. Due to track maintenance ahead, this train will terminate one stop early today. Passengers heading to the final terminal should ${chgEn}. We apologize for the inconvenience.`;
      return {
        text,
        ja: `${line}の車内放送。前方の線路点検のため1駅手前で運転を打ち切るため、終点へ向かう乗客は「${chgJa}」必要がある。`,
        prompt: 'What should passengers heading to the final terminal do?',
        correct: chgEn[0].toUpperCase() + chgEn.slice(1) + '.',
        cReason: `Passengers heading to the final terminal should ${chgEn}. と明確に指示されている。`,
        wrongs: [
          'Wait inside the dining car for an hour.',
          'Buy a new express ticket from the conductor.',
          'Walk along the railway tracks to the station.',
        ] as [string, string, string],
        wReasons: [
          '食堂車で1時間待つようには案内されていない。',
          '車掌から新しい急行券を買う必要はない。',
          '線路沿いに歩くという危険な指示は出ていない。',
        ] as [string, string, string],
        exp: `運転変更に伴い Passengers ... should ${chgEn} と案内された行動を聞き取る。`,
        ev: `should ${chgEn}`,
        skill: '手段・方法',
      };
    },
    // 4: 人物エピソード（失敗や工夫から成功）
    () => {
      const episodes = [
        ['opened a tiny soup stand near a college', 'added a daily student vegetable set', '大学近くに小さなスープ店を開いた', '日替わりの学生向け野菜セットを加えた'],
        ['started a weekend bike repair workshop', 'posted short repair tips online', '週末の自転車修理工房を始めた', '短い修理のコツをオンラインに投稿した'],
        ['launched a community book-sharing box', 'organized monthly story mornings for kids', '地域の本の共有ボックスを始めた', '月1回の子ども向け読み聞かせ会を開いた'],
        ['grew herbs on an unused garage roof', 'sold fresh mint tea to local cafes', '使われていないガレージ屋上でハーブを育てた', '地元カフェにフレッシュミント茶を卸した'],
        ['formed an amateur string quartet', 'performed free concerts in hospital lobbies', 'アマチュア弦楽四重奏団を結成した', '病院ロビーで無料コンサートを開いた'],
      ];
      const [startEn, turnEn, startJa, turnJa] = episodes[(round - 1) % 5];
      const timeLeads = [
        'Three springs ago', 'Two summers back', 'Four autumns ago', 'Last winter', 'Several years ago',
        'Back in twenty twenty-two', 'Early last spring', 'During her college years', 'Two winters ago', 'Three autumns back',
        'Five summers ago', 'Late last autumn', 'Soon after graduation', 'Four springs ago', 'Nearly three years back',
      ];
      const text = `${timeLeads[round - 1]}, ${personF} ${startEn} in District ${round}. At first, very few people knew about her activity, and she almost gave up. However, after she ${turnEn}, word spread quickly, and now dozens of neighbors support her every week.`;
      return {
        text,
        ja: `3年前、${personF}は${startJa}。最初はほとんど知られていなかったが、「${turnJa}」ことをきっかけに評判が広がった。`,
        prompt: `What caused ${personF}'s activity to become popular?`,
        correct: `She ${turnEn}.`,
        cReason: `However, after she ${turnEn}, word spread quickly と人気が出た転換点が述べられている。`,
        wrongs: [
          'She won a national television prize.',
          'She moved to a large shopping center.',
          'She hired ten professional actors.',
        ] as [string, string, string],
        wReasons: [
          '全国テレビの賞を受賞したとは述べられていない。',
          '大型ショッピングセンターへ移転したという記述はない。',
          'プロの俳優を10人雇ったという話も出てこない。',
        ] as [string, string, string],
        exp: `逆接 However, after she ... の後ろにある成功の原因を聞き取る。`,
        ev: `after she ${turnEn}`,
        skill: '理由',
      };
    },
    // 5: 科学・自然の豆知識パッセージ
    () => {
      const facts = [
        ['honeybees communicate flower locations', 'perform a figure-eight waggle dance', 'ミツバチが花の場所を伝える方法', '8の字ダンスを踊る'],
        ['arctic foxes survive freezing winters', 'grow thick white fur even on their paws', 'ホッキョクギツネが厳冬を生き抜く仕組み', '足裏にまで厚い白い毛が生える'],
        ['sea otters keep from drifting apart while sleeping', 'hold hands or wrap themselves in kelp', 'ラッコが寝ている間に流されない工夫', '手をつなぐか海藻を体に巻く'],
        ['desert cacti store rainwater efficiently', 'expand their pleated stems like an accordion', '砂漠のサボテンが雨水を蓄える仕組み', 'ひだのある茎をアコーディオンのように広げる'],
        ['owls fly almost silently at night', 'have soft comb-like edges on their wing feathers', 'フクロウが夜ほぼ無音で飛べる理由', '風切羽の縁が柔らかいくし状になっている'],
      ];
      const [topicEn, mechEn, topicJa, mechJa] = facts[(round - 1) % 5];
      const openings = [
        'In today\'s biology minute,', 'Welcome to Science Spotlights!', 'Have you ever wondered how',
        'On Episode Four of Nature Notes,', 'In this week\'s wildlife talk,', 'Listeners of Junior Science,',
        'Nature is full of clever designs:', 'During today\'s museum radio talk,', 'Biologists have long studied how',
        'Welcome back to Earth Wonders!', 'Here is a fascinating animal fact:', 'In our ecology class today,',
        'Animals adapt in amazing ways:', 'Let us explore natural science:', 'On our outdoor audio guide,',
      ];
      const text = `${openings[round - 1]} scientists explain how ${topicEn}. Unlike many other species, they ${mechEn}. This special adaptation helps them save energy and stay safe in harsh environments.`;
      return {
        text,
        ja: `自然科学の解説（${topicJa}）。他の多くの種と異なり、「${mechJa}」ことで厳しい環境に適応している。`,
        prompt: 'According to the talk, what is special about these living things?',
        correct: `They ${mechEn}.`,
        cReason: `Unlike many other species, they ${mechEn}. と固有の仕組みが説明されている。`,
        wrongs: [
          'They sleep underground for nine months.',
          'They travel five thousand kilometers every week.',
          'They glow bright blue in the dark.',
        ] as [string, string, string],
        wReasons: [
          '9か月間地中で眠るとは述べられていない。',
          '毎週5,000キロ移動するという事実はない。',
          '暗闇で青く光るという説明も本文にない。',
        ] as [string, string, string],
        exp: `Unlike many other species, they ... で強調される特徴を聞き取る。`,
        ev: `they ${mechEn}`,
        skill: '問題点',
      };
    },
    // 6: 学校・職場のスケジュール連絡
    () => {
      const items = [
        ['annual health checkup', 'gymnasium', 'school library', 'bring your health card', '健康診断', '健康カードを持参する'],
        ['career talk by local engineers', 'Room Ten', 'main auditorium', 'submit one question in advance', '地元エンジニアによる進路講話', '事前に質問を1つ提出する'],
        ['winter coat donation drive', 'entrance hall', 'student council room', 'wash coats before bringing them', '冬物コート寄付活動', '持参前にコートを洗う'],
        ['bicycle safety inspection', 'east parking lot', 'covered court', 'attach your registration sticker', '自転車安全点検', '登録ステッカーを貼っておく'],
        ['international food cooking day', 'Home Economics Room', 'Cooking Annex', 'tie back long hair with a band', '国際料理デー', '長い髪をゴムで束ねる'],
      ];
      const [evEn, oldLoc, newLoc, ruleEn, evJa, ruleJa] = items[(round - 1) % 5];
      const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'next Monday', 'next Tuesday', 'next Wednesday', 'next Thursday', 'next Friday', 'this Wednesday', 'this Thursday', 'this Friday', 'tomorrow morning', 'tomorrow afternoon'];
      const salutations = [
        'Good morning, first-year students.', 'Attention, second-year classes.', 'Good afternoon, third-year students.',
        'Hello everyone in Building A.', 'Notice for all morning homerooms:', 'Good morning, West Campus students.',
        'May I have your attention, students:', 'Quick announcement before lunch break:', 'Hello students in Hall Two:',
        'Important update from the faculty:', 'Good afternoon, everyone on campus:', 'Notice from the Student Affairs Desk:',
        'Attention all homeroom representatives:', 'Before sixth period begins today,', 'Good morning from the school office:',
      ];
      const text = `${salutations[round - 1]} Regarding the ${evEn} scheduled for ${days[round - 1]}, we have changed the venue from the ${oldLoc} to the ${newLoc}. Also, all students must ${ruleEn}. Thank you for your cooperation.`;
      return {
        text,
        ja: `${evJa}についての連絡。会場が${oldLoc}から${newLoc}へ変更され、さらに全員「${ruleJa}」必要がある。`,
        prompt: `What must all students do for the ${evEn}?`,
        correct: ruleEn[0].toUpperCase() + ruleEn.slice(1) + '.',
        cReason: `Also, all students must ${ruleEn}. と必須の指示が述べられている。`,
        wrongs: [
          `Gather in the ${oldLoc}.`,
          'Pay five hundred yen in cash.',
          'Invite their parents to attend.',
        ] as [string, string, string],
        wReasons: [
          `${oldLoc} は変更前の旧会場であり、そこへ集まるのではない。`,
          '現金500円を払うという指示は出ていない。',
          '保護者を招待するようにも言っていない。',
        ] as [string, string, string],
        exp: `会場変更の情報とあわせて all students must ${ruleEn} の指示を正確に聞き取る。`,
        ev: `all students must ${ruleEn}`,
        skill: '依頼内容',
      };
    },
    // 7: ラジオの天気・週末お出かけ情報
    () => {
      const regions = ['Northern Bay', 'Maple Valley', 'Green Highlands', 'Sunset Coast', 'Crystal Lake', 'Cedar Peninsula', 'Harbor Hills', 'Silver Plains', 'Amber Island', 'Cloudy Ridge', 'Breeze Basin', 'Starlight Cape', 'Clover Meadow', 'River Delta', 'Oak Plateau'];
      const forecasts = [
        ['sunny skies in the morning, followed by rain in the evening', '午前は晴れ、夕方は雨'],
        ['cloudy weather until noon, then clear blue skies all afternoon', '正午まで曇り、午後は快晴'],
        ['strong winds along the coast, though inland parks will stay calm', '沿岸は強風だが内陸の公園は穏やか'],
        ['light morning mist, turning warm and pleasant after ten o\'clock', '朝は薄い霧だが10時以降は暖かく快適'],
        ['cool temperatures all day, with brief showers around three', '一日中涼しく、3時ごろ短い通り雨'],
      ];
      const reg = regions[round - 1];
      const [fcEn, fcJa] = forecasts[(round - 1) % 5];
      const text = `Here is the weekend weather update for ${reg}. Tomorrow we expect ${fcEn}. If you are planning outdoor sports or picnics, please check hourly updates before leaving home.`;
      return {
        text,
        ja: `${reg}の週末天気予報。明日は「${fcJa}」となる見込み。`,
        prompt: `What weather is expected in ${reg} tomorrow?`,
        correct: fcEn[0].toUpperCase() + fcEn.slice(1) + '.',
        cReason: `Tomorrow we expect ${fcEn}. と明日の天気がそのまま述べられている。`,
        wrongs: [
          'Heavy snow from morning to night.',
          'A powerful typhoon all weekend.',
          'Record heat over thirty-eight degrees.',
        ] as [string, string, string],
        wReasons: [
          '朝から晩まで大雪という予報ではない。',
          '週末ずっと大型台風が来るという内容ではない。',
          '38度を超える記録的猛暑とも述べられていない。',
        ] as [string, string, string],
        exp: `Tomorrow we expect ... に続く時間帯ごとの天気変化を聞き取る。`,
        ev: `expect ${fcEn}`,
        skill: '出来事の順序',
      };
    },
    // 8: ボイスメール（注文・配達・修理の連絡）
    () => {
      const shops = ['Takahashi Books', 'Aoba Tailoring', 'Midori Camera Service', 'Harbor Florist', 'Sakura Bakery', 'Maple Framing Shop', 'Star Music Repair', 'Clover Pet Grooming', 'Sunny Curtain Store', 'River Shoe Repair', 'Hilltop Pottery', 'Breeze Cycle Shop', 'Crown Stationery', 'Forest Furniture', 'Sunrise Print Shop'];
      const actions = [
        ['confirm whether you want gift wrapping', 'ギフト包装を希望するか確認する'],
        ['check the spelling of the name on the card', 'カードの氏名のつづりを確認する'],
        ['ask if Saturday afternoon delivery works for you', '土曜午後の配達で都合がよいか尋ねる'],
        ['let you know a replacement part costs eight hundred yen', '交換部品に800円かかると伝える'],
        ['inform you that your custom order arrived early', '特注品が予定より早く届いたと知らせる'],
      ];
      const shop = shops[round - 1];
      const [actEn, actJa] = actions[(round - 1) % 5];
      const text = `Hello ${personM}, this is ${shop} calling about your order number forty-${round}. Everything is going smoothly, and we are calling to ${actEn}. Please call us back before six o'clock this evening.`;
      return {
        text,
        ja: `${shop}から${personM}への留守番電話。注文の件で「${actJa}」ために連絡しており、夕方6時までに折り返しを求めている。`,
        prompt: `Why is ${shop} calling ${personM}?`,
        correct: `To ${actEn}.`,
        cReason: `we are calling to ${actEn} と電話の目的をはっきり伝えている。`,
        wrongs: [
          'To cancel the order completely.',
          'To report that the store is closing forever.',
          'To ask for a job interview tomorrow.',
        ] as [string, string, string],
        wReasons: [
          '注文を完全キャンセルするためではなく順調（smoothly）と述べている。',
          'お店が永久に閉店するというお知らせは一切流れていない。',
          '明日の採用面接をお願いする連絡でもない。',
        ] as [string, string, string],
        exp: `we are calling to ... の電話要件を表す不定詞句を聞き取る。`,
        ev: `calling to ${actEn}`,
        skill: '理由',
      };
    },
    // 9: 学校の新しい取り組み・制度変更
    () => {
      const programs = [
        ['Morning Reading Fifteen', 'read any non-textbook story silently before homeroom', '朝の15分読書', 'ホームルーム前に教科書以外の好きな物語を読む'],
        ['Green Lunch Wednesdays', 'serve dishes made with vegetables from local farms', '水曜グリーンランチ', '地元農家の野菜を使った料理を提供する'],
        ['Peer Tutoring Afternoons', 'let third-year volunteers help younger students with math', '放課後ピア学習', '3年生のボランティアが下級生の数学を手伝う'],
        ['No-Bag Club Fridays', 'clean and organize community parks once a month', '月1回の地域清掃金曜', '月に1回地域の公園を清掃・整備する'],
        ['English Cafe Tuesdays', 'chat with guest speakers over tea during lunch break', '火曜イングリッシュカフェ', '昼休みにゲストとお茶を飲みながら英語で話す'],
      ];
      const [progName, descEn, progJa, descJa] = programs[(round - 1) % 5];
      const schools = ['North High', 'East Junior High', 'West Academy', 'South High', 'Maple School', 'Aoba High', 'Sakura Academy', 'Harbor Junior High', 'Hilltop High', 'River School', 'Cedar High', 'Clover Junior High', 'Star Academy', 'Breeze High', 'Sunrise School'];
      const sch = schools[round - 1];
      const text = `Starting next month at ${sch}, we will introduce a new program called ${progName}. Under this program, students will ${descEn}. Teachers hope this will make school life more enjoyable and meaningful.`;
      return {
        text,
        ja: `来月から${sch}で始まる新プログラム「${progJa}」。生徒は「${descJa}」ことになり、学校生活の充実を目指している。`,
        prompt: `What will students do under the ${progName} program?`,
        correct: descEn[0].toUpperCase() + descEn.slice(1) + '.',
        cReason: `Under this program, students will ${descEn}. と活動内容が明記されている。`,
        wrongs: [
          'Take an extra written exam every Saturday.',
          'Wear winter uniforms during summer.',
          'Stay at school until nine at night.',
        ] as [string, string, string],
        wReasons: [
          '毎週土曜に追加の筆記試験を受けるとは述べられていない。',
          '夏に冬服を着るという規則ではない。',
          '夜9時まで学校に残るという制度でもない。',
        ] as [string, string, string],
        exp: `Under this program, students will ... の新制度の具体的内容を聞き取る。`,
        ev: `students will ${descEn}`,
        skill: '総合',
      };
    },
    // 10: 旅行・コンテスト応募要項
    () => {
      const contests = ['Teen Eco Poster Contest', 'City Short Story Award', 'Junior Invention Fair', 'Hometown Photo Prize', 'Student Recipe Challenge', 'Spring Haiku Contest', 'Local Bird Sketch Prize', 'Youth Choir Audition', 'Bridge Design Contest', 'Bookmark Art Award', 'Clean River Slogan Prize', ' Town Mascot Contest', 'Book Review Award', 'Solar Car Mini Race', 'Speech Video Contest'].map(s => s.trim());
      const prizes = [
        ['a tablet stylus and art kit', 'タブレットペンと画材セット'],
        ['a ten-thousand-yen book card', '1万円分の図書カード'],
        ['a tour of the space research center', '宇宙研究センターの見学ツアー'],
        ['a compact digital camera', 'コンパクトデジタルカメラ'],
        ['a set of stainless steel pans', 'ステンレス鍋セット'],
      ];
      const ct = contests[round - 1];
      const [prEn, prJa] = prizes[(round - 1) % 5];
      const hooks = [
        'Do you enjoy expressing new ideas?',
        'Good afternoon, young creators and students!',
        'Here is exciting news from City Hall:',
        'Looking for a fun autumn project?',
        'Calling all middle and high schoolers!',
        'Welcome to this week\'s youth bulletin:',
        'Have you heard about our annual award?',
        'Attention everyone interested in arts and crafts:',
        'Today we are announcing a special competition:',
        'Want to share your talent with the city?',
        'Registration has just started this morning!',
        'From the Cultural Promotion Desk today:',
        'Students across the city are invited now!',
        'Ready to try something creative this term?',
        'Here is an invitation for local students:',
      ];
      const text = `${hooks[round - 1]} Entries are now open for the ${ct}! Anyone aged twelve to eighteen can enter for free before October twentieth. The grand prize winner will receive ${prEn}, and top entries will be displayed at City Hall.`;
      return {
        text,
        ja: `${ct}の募集案内。12〜18歳は10月20日まで無料で応募でき、最優秀賞受賞者には「${prJa}」が贈られ、上位作品は市役所に展示される。`,
        prompt: `What will the grand prize winner of the ${ct} receive?`,
        correct: prEn[0].toUpperCase() + prEn.slice(1) + '.',
        cReason: `The grand prize winner will receive ${prEn} と最優秀賞の賞品が明言されている。`,
        wrongs: [
          'A round-trip ticket to London.',
          'A mountain bicycle with lights.',
          'A one-year gym membership.',
        ] as [string, string, string],
        wReasons: [
          'ロンドン往復航空券は賞品として挙げられていない。',
          'ライト付きマウンテンバイクについての言及はない。',
          'ジムの年間会員権も登場しない。',
        ] as [string, string, string],
        exp: `The grand prize winner will receive ${prEn} を聞き取る。`,
        ev: `winner will receive ${prEn}`,
        skill: '数量',
      };
    },
  ];

  const p = passages[u - 1]();
  const qItem = makeQuestionItem({
    examId,
    questionNumber: qNo,
    questionPrompt: p.prompt,
    choicePresentation: 'printed',
    correctChoice: p.correct,
    correctReason: p.cReason,
    wrongChoices: p.wrongs,
    wrongReasons: p.wReasons,
    targetAnswer,
    explanation: p.exp,
    evidence: p.ev,
    skill: p.skill,
  });

  const turns: DialogueTurn[] = [
    { speaker: 'F2', roleLabel: 'Narrator', text: p.text },
    { speaker: 'F2', roleLabel: 'Narrator', text: `Question. ${p.prompt}` },
  ];

  return makeDialogueUnit({
    examId,
    part: 'part3',
    unitIndex: u,
    readCount,
    turns,
    translation: p.ja,
    image: null,
    questions: [qItem],
  });
}

function buildPre2Part1(examId: string, round: number, u: number): ListeningAudioUnit {
  const [sp1, sp2] = speakerPairFor(round, u);
  const m = M_POOL[(round * 3 + u) % 15];
  const f = F_POOL[(round + u * 2) % 15];
  const n1 = sp1.roleLabel === 'Man' ? f : m;
  const n2 = sp1.roleLabel === 'Man' ? m : f;
  const targetAnswer = (round + u + 1) % 3;

  // 準2級 第1部：図版なし・3肢読み上げ・1回読み（会話3ターン→4ターン目に合う応答を選ぶ形式も含む）
  const items = [
    // 1: 締切・仕事の進捗確認
    () => {
      const docs = ['sales summary', 'biology lab report', 'club budget sheet', 'event poster draft', 'reading assignment', 'internship form', 'survey chart', 'newsletter article', 'safety checklist', 'travel itinerary', 'speech outline', 'book club flyer', 'volunteer schedule', 'practice menu', 'seminar handout'];
      const doc = docs[round - 1];
      return {
        l1: `Hi ${n1}, have you finished writing the ${doc} yet?`,
        l2: `Almost, ${n2}. I just need to check the numbers on the last page. When does Mr. Ross need it?`,
        j1: `やあ${n1}、${doc}はもう書き終わった？`,
        j2: `もう少しだよ。最後のページの数字を確認するだけなんだ。ロス先生はいつまでに必要としてる？`,
        correct: 'By noon tomorrow, so you still have time.',
        cReason: `When does Mr. Ross need it?（いつまでに必要か）に対し、「明日の正午までだからまだ時間があるよ」と期限を答えている。`,
        wrongs: ['On the third floor near the elevator.', 'Yes, he wrote a great book.'] as [string, string],
        wReasons: [
          '場所を答えており、提出期限を尋ねる When ...? への返答にならない。',
          'Yes で答えており、疑問詞 When の質問とかみ合わない。',
        ] as [string, string],
        exp: `When does ... need it? という期限の質問に By noon tomorrow で応じる選択肢を選ぶ。`,
        ev: 'When does Mr. Ross need it',
        skill: '時刻・順序',
      };
    },
    // 2: 提案への間接的な断り・代替案
    () => {
      const meals = ['spicy Thai curry', 'garlic steak', 'seafood ramen', 'double cheeseburgers', 'fried chicken baskets', 'pepperoni pizza', 'beef tacos', 'cream pasta', 'roast pork sandwiches', 'hot pot noodles', 'lamb kebabs', 'fried oyster plates', 'barbecue ribs', 'crab omelette', 'chili hot dogs'];
      const meal = meals[round - 1];
      return {
        l1: `I am starving after tennis practice, ${n1}!`,
        l2: `Me too, ${n2}. Let's go eat ${meal} at that new diner across the street!`,
        j1: `テニスの練習の後でおなかペコペコだよ！`,
        j2: `私も。通りの向かいの新しい食堂で${meal}を食べに行こう！`,
        correct: 'Actually, my stomach feels heavy—could we get something lighter?',
        cReason: `こってり・辛い食事の誘いに対し、「実は胃が重いからもっと軽いものにしない？」と自然に対案を出している。`,
        wrongs: ['The tennis court closes at eight.', 'I bought a new racket last week.'] as [string, string],
        wReasons: [
          'コートの閉鎖時刻の話であり、食事の誘いへの返答ではない。',
          '先週ラケットを買った話をしており、今の提案と無関係である。',
        ] as [string, string],
        exp: `Let's go eat ... の誘いに体調を理由に別案を出す自然な会話応答を選ぶ。`,
        ev: `Let's go eat ${meal}`,
        skill: '誘い・断り',
      };
    },
    // 3: 相手の困りごとへの手助け申し出
    () => {
      const probs = [
        ['my laptop froze right before my presentation', 'プレゼン直前にノートPCがフリーズした'],
        ['my printer jammed with twenty pages left', '残り20枚でプリンターが紙詰まりした'],
        ['my bike chain came off near the school gate', '校門近くで自転車のチェーンが外れた'],
        ['my suitcase wheel broke on the stairs', '階段でスーツケースの車輪が壊れた'],
        ['my camera battery died at the entrance', '入口でカメラの電池が切れた'],
        ['my bookshelf kit is missing a screwdriver', '本棚キットを組み立てるドライバーがない'],
        ['my poster tore in the strong morning wind', '朝の強風でポスターが破れた'],
        ['my projector cable does not fit this port', 'プロジェクターのケーブルが端子に合わない'],
        ['my locker key bent inside the keyhole', 'ロッカーの鍵が鍵穴で曲がった'],
        ['my thermos lid will not open at all', '水筒のふたがどうしても開かない'],
        ['my violin case latch got stuck again', 'バイオリンケースの留め金が固まった'],
        ['my tent pole snapped in the campground', 'キャンプ場でテントのポールが折れた'],
        ['my easel leg keeps sliding on the floor', 'イーゼルの脚が床で滑ってしまう'],
        ['my stopwatch button stopped working', 'ストップウォッチのボタンが効かなくなった'],
        ['my microphone cable is two meters too short', 'マイクケーブルが2メートル足りない'],
      ];
      const [prEn, prJa] = probs[round - 1];
      const troubleIntros = [
        `Oh no, ${n1}, look at my desk!`,
        `Wait a minute, ${n1}, this is bad!`,
        `Excuse me, ${n1}, I have a problem!`,
        `Oh dear, ${n1}, right on the stairs!`,
        `Shoot, ${n1}, just before we go in!`,
        `Hmm, ${n1}, something is missing from this box!`,
        `Look at this, ${n1}, the wind ruined it!`,
        `Hey ${n1}, can you check this connector?`,
        `Uh-oh, ${n1}, my locker will not open!`,
        `Goodness, ${n1}, this cap is completely stuck!`,
        `Hold on, ${n1}, my case will not close!`,
        `Bad news, ${n1}, over by our tent!`,
        `Careful, ${n1}, this stand keeps slipping!`,
        `Strange, ${n1}, the timer display is blank!`,
        `Wait, ${n1}, this cord cannot reach the stage!`,
      ];
      return {
        l1: troubleIntros[round - 1],
        l2: `Calm down, ${n2}. Tell me—oh, wait, did something break? Actually, I see: you mean "${prEn}," right?`,
        j1: `たいへんだ、どうしよう！`,
        j2: `落ち着いて。つまり「${prJa}」ということなんだね？`,
        correct: 'Yes! Could I borrow yours for twenty minutes?',
        cReason: `トラブル内容の確認に Yes! と肯定し、20分だけ代わりの品を貸してほしいと具体的に頼んでいる。`,
        wrongs: ['No, it was very cheap on sale.', 'I went there with my roommate.'] as [string, string],
        wReasons: [
          'セールで安かったという話で、目の前のトラブル対応になっていない。',
          'ルームメイトと行ったという過去の話で、文脈に合わない。',
        ] as [string, string],
        exp: `状況確認の疑問に対し、肯定＋具体的な助けを頼む応答を選ぶ。`,
        ev: prEn,
        skill: '問題点の把握',
      };
    },
    // 4: 料金・割引条件の質問
    () => {
      const places = ['botanical conservatory', 'modern art museum', 'indoor climbing gym', 'city swimming complex', 'science planetarium', 'historic castle keep', 'ice skating arena', 'maritime museum', 'ceramic workshop', 'observatory deck', 'folk craft hall', 'butterfly house', 'railway heritage park', 'outdoor cinema', 'pottery gallery'];
      const pl = places[round - 1];
      return {
        l1: `Let's buy our tickets for the ${pl}, ${n1}.`,
        l2: `Hold on, ${n2}. Do high school students get a discount if we show our IDs?`,
        j1: `${pl}のチケットを買おう。`,
        j2: `ちょっと待って。生徒証を見せれば高校生割引になるのかな？`,
        correct: 'Yes, it makes the ticket half price!',
        cReason: `高校生割引があるか（Do high school students get a discount ...?）に対し、「うん、半額になるよ！」と明確に答えている。`,
        wrongs: ['The bus leaves from Stop Six.', 'I forgot to bring my raincoat.'] as [string, string],
        wReasons: [
          'バス乗り場の番号を答えており、学割の有無への回答ではない。',
          'レインコートを忘れた話をしており、チケット割引と無関係。',
        ] as [string, string],
        exp: `Do high school students get a discount ...? に Yes ＋割引内容で応じる文を選ぶ。`,
        ev: 'get a discount if we show our IDs',
        skill: '条件',
      };
    },
    // 5: 相手の意図・感想への共感
    () => {
      const classes = ['Professor Kim\'s economics lecture', 'Ms. Bell\'s creative writing class', 'Coach Grant\'s fitness bootcamp', 'Dr. Ota\'s astronomy seminar', 'Mr. Penn\'s photography course', 'Ms. Lin\'s debate workshop', 'Chef Marco\'s baking class', 'Dr. Reed\'s ocean biology talk', 'Mr. Cole\'s guitar clinic', 'Ms. Hara\'s calligraphy course', 'Coach Diaz\'s tennis camp', 'Dr. Shaw\'s history lecture', 'Ms. Park\'s pottery studio', 'Mr. Ford\'s coding seminar', 'Ms. Ito\'s translation class'];
      const cls = classes[round - 1];
      return {
        l1: `We just finished our first day of ${cls}, ${n1}.`,
        l2: `Yeah, ${n2}. Honestly, the pace was much faster than I expected. Could you keep up with everything?`,
        j1: `${cls}の初日が終わったね。`,
        j2: `うん。正直思ったよりずっとペースが速かったな。全部ついていけた？`,
        correct: 'Barely! Let\'s review our notes together later.',
        cReason: `Could you keep up with everything?（全部ついていけた？）に対し、「やっとだったよ！あとで一緒にノートを見直そう」と自然に応じている。`,
        wrongs: ['In Lecture Room Three B.', 'Twice a week on Mondays and Thursdays.'] as [string, string],
        wReasons: [
          '教室の場所を答えており、授業についていけたかの質問に合わない。',
          '開講曜日と回数を答えており、質問への返答になっていない。',
        ] as [string, string],
        exp: `Could you keep up ...? に対して Barely!（かろうじて）と答え復習を提案する文を選ぶ。`,
        ev: 'Could you keep up with everything',
        skill: '評価',
      };
    },
    // 6: 道順・乗り換えの確認
    () => {
      const stations = ['Riverside Hospital', 'the Civic Concert Hall', 'Northgate University', 'Harbor Convention Center', 'Greenview Stadium', 'Maple Science Park', 'Westside Art Museum', 'Sunrise Airport Terminal', 'Central Library Plaza', 'Oakwood Botanic Park', 'Silver Bay Pier', 'Crown Theatre', 'Cedar Tech Hub', 'Coral Aquarium', 'Hillside Medical Center'];
      const st = stations[round - 1];
      return {
        l1: `Excuse me, does this rapid train stop at ${st}?`,
        l2: `No, this rapid skips ${st}. Oh—wait, do you know where I should transfer? Actually, let me ask the staff: where should this passenger change trains for ${st}?`,
        j1: `すみません、この快速電車は${st}に止まりますか？`,
        j2: `いいえ、通過します。駅員さん、${st}へはどこで乗り換えればいいですか？`,
        correct: 'Get off at the next stop and take the local train.',
        cReason: `where should ... change trains?（どこで乗り換えるべきか）に「次の駅で降りて普通列車に乗ってください」と的確に案内している。`,
        wrongs: ['The train was built five years ago.', 'Yes, I commute here every morning.'] as [string, string],
        wReasons: [
          '車両の製造年を述べており、乗り換え案内になっていない。',
          '毎朝通勤しているという話で、疑問詞 where の質問とかみ合わない。',
        ] as [string, string],
        exp: `乗り換え駅を尋ねる質問に対して Get off at the next stop ... と案内する応答を選ぶ。`,
        ev: `change trains for ${st}`,
        skill: '手段',
      };
    },
    // 7: 予約・変更の依頼
    () => {
      const venues = ['Italian bistro', 'badminton court', 'karaoke room', 'study booth', 'barbecue site', 'music studio', 'dental checkup', 'haircut appointment', 'pottery wheel', 'tennis lesson', 'bicycle rental', 'kayak tour', 'cooking studio', 'meeting room', 'camping cabin'];
      const vn = venues[round - 1];
      return {
        l1: `Hi ${n1}, six people want to join our ${vn} reservation now instead of four!`,
        l2: `Really, ${n2}? Should I call them right now to see if they have space for six?`,
        j1: `ねえ、${vn}の予約に4人じゃなくて6人参加したいって！`,
        j2: `本当？6人分の空きがあるか、今すぐ電話して聞いてみようか？`,
        correct: 'Please do! Here is their phone number.',
        cReason: `Should I call them right now ...? という申し出に Please do!（ぜひお願い！これが電話番号だよ）と応じている。`,
        wrongs: ['No, there were only two left.', 'Last month on the fifteenth.'] as [string, string],
        wReasons: [
          '過去の残数を唐突に述べており、これから電話しようかという申し出とかみ合わない。',
          '先月15日という過去の日付であり、応答として成立しない。',
        ] as [string, string],
        exp: `Should I call them right now ...? の申し出に Please do! で頼む口語表現を選ぶ。`,
        ev: 'Should I call them right now',
        skill: '予定変更',
      };
    },
    // 8: 理由の質問（Why didn't you ...?）
    () => {
      const missed = [
        ['join the welcome dinner last night', 'I had to look after my younger sister.', '昨夜の歓迎夕食会に参加しなかった', '妹の面倒を見なければならなかった'],
        ['apply for the summer internship', 'The deadline passed while I was sick.', '夏のインターンに応募しなかった', '寝込んでいる間に締切が過ぎた'],
        ['buy that leather backpack on sale', 'It was still a bit over my budget.', 'セール中の革リュックを買わなかった', 'それでも少し予算オーバーだった'],
        ['take the express bus this morning', 'There was a huge line at the stop.', '今朝急行バスに乗らなかった', 'バス停に大行列ができていた'],
        ['enter the school painting contest', 'I could not finish my canvas in time.', '校内絵画コンクールに出さなかった', '期日までに描き上げられなかった'],
        ['watch the championship game on TV', 'Our living room TV broke yesterday.', 'テレビで決勝戦を見なかった', '昨日居間のテレビが壊れた'],
        ['bring your guitar to the camp', 'It would not fit in the trunk.', 'キャンプにギターを持ってこなかった', '車のトランクに入らなかった'],
        ['sign up for the morning yoga class', 'Seven o\'clock is too early for me.', '朝ヨガ講座に申し込まなかった', '7時は私には早すぎる'],
        ['order the seasonal peach parfait', 'They sold out ten minutes before we arrived.', '季節の桃パフェを頼まなかった', '到着の10分前に売り切れていた'],
        ['use the coupon at the bookstore', 'It was only valid for magazines.', '書店でクーポンを使わなかった', '雑誌にしか使えなかった'],
        ['ride your new bike to school today', 'The forecast warned of afternoon thunder.', '今日新しい自転車で登校しなかった', '午後に雷の予報が出ていた'],
        ['attend the author\'s book signing', 'Tickets were already gone last Monday.', '作家のサイン会に行かなかった', '先週月曜には整理券がなくなっていた'],
        ['print the handouts in color', 'The color printer was under repair.', '資料をカラー印刷しなかった', 'カラー機が修理中だった'],
        ['stay for the encore at the concert', 'I had to catch the nine thirty train.', 'アンコールまで残らなかった', '9時30分の電車に乗る必要があった'],
        ['try the outdoor hot spring', 'It was closed for cleaning until noon.', '露天風呂に入らなかった', '正午まで清掃で閉まっていた'],
      ];
      const [actEn, ansEn, actJa, ansJa] = missed[round - 1];
      const whyIntros = [
        `Hey ${n1}, everyone missed you at dinner!`,
        `Hi ${n1}, I saw the applicant list today.`,
        `Hello ${n1}, you came back from the mall empty-handed!`,
        `Morning ${n1}, you took the local train today?`,
        `Oh ${n1}, I looked for your painting in the hall!`,
        `Hey ${n1}, what a match that was last night!`,
        `Hi ${n1}, we hoped to sing around the campfire!`,
        `Hello ${n1}, our morning group started without you.`,
        `Hey ${n1}, you ordered coffee instead of dessert?`,
        `Oh ${n1}, you paid full price at the register?`,
        `Morning ${n1}, you walked to school in sneakers today?`,
        `Hi ${n1}, the author's talk at the bookstore was great!`,
        `Hello ${n1}, these handouts are in black and white.`,
        `Hey ${n1}, you left the concert hall before the end!`,
        `Hi ${n1}, how was your morning at the inn?`,
      ];
      return {
        l1: whyIntros[round - 1],
        l2: `Why didn't you ${actEn}?`,
        j1: `やあ${n1}、みんな残念がっていたよ！`,
        j2: `どうして${actJa}の？`,
        correct: ansEn,
        cReason: `Why didn't you ...?（なぜ〜しなかったのか）に対し、「${ansJa}」と納得できる理由を述べている。`,
        wrongs: ['Sure, count me in next week.', 'For about forty-five minutes.'] as [string, string],
        wReasons: [
          '来週の誘いに乗る返事であり、過去の理由を尋ねる質問に合わない。',
          '時間の長さを答えており、なぜしなかったかの理由にならない。',
        ] as [string, string],
        exp: `否定疑問 Why didn't you ...? に対して過去の具体的な事情を説明する応答を選ぶ。`,
        ev: `Why didn't you ${actEn}`,
        skill: '理由',
      };
    },
    // 9: 比較・助言（Which route / plan is better?）
    () => {
      const plans = [
        ['Plan A or Plan B for our booth', 'Plan B—it costs half as much to build.', '展示ブースのA案とB案', '費用が半分で済むB案'],
        ['the highway or the coastal road', 'The coastal road—there is roadwork on the highway.', '高速道路と海沿いの道', '高速が工事中なので海沿いの道'],
        ['the morning flight or the evening flight', 'The morning one, so we can sightsee on day one.', '午前の便と夕方の便', '初日に観光できる午前の便'],
        ['hardcover or paperback for class', 'Paperback—it is much lighter in your bag.', 'ハードカバーとペーパーバック', 'かばんの中でずっと軽いペーパーバック'],
        ['indoor seats or balcony seats', 'Indoor seats, because strong wind is coming.', '店内席とバルコニー席', '強風が来るので店内席'],
      ];
      const [pairEn, ansEn, pairJa, ansJa] = plans[(round - 1) % 5];
      const contexts = ['spring fair', 'summer trip', 'autumn tour', 'winter seminar', 'club camp', 'group outing', 'study tour', 'music trip', 'science camp', 'art fair', 'book trip', 'hiking day', 'festival booth', 'photo tour', 'class excursion'];
      return {
        l1: `We need to decide for our ${contexts[round - 1]} soon, ${n1}.`,
        l2: `In your opinion, which should we choose, ${pairEn}?`,
        j1: `そろそろ決めないとね、${n1}。`,
        j2: `あなたの意見では、${pairJa}のどちらを選ぶべきかな？`,
        correct: ansEn,
        cReason: `which should we choose, A or B? に対し、「${ansJa}」と明確な選択と根拠を示している。`,
        wrongs: ['Yes, both of them are closed.', 'About three weeks ago.'] as [string, string],
        wReasons: [
          'which の選択疑問文に Yes で答えており不適切。',
          '3週間前という過去の時期を述べており、選択の質問とかみ合わない。',
        ] as [string, string],
        exp: `which should we choose, A or B? に対して片方を選び理由を添える応答を選ぶ。`,
        ev: 'which should we choose',
        skill: '比較・選択',
      };
    },
    // 10: 話者の意図・確認（You mean ...?）
    () => {
      const updates = [
        ['the swimming pool is closed all week', '今週ずっとプールが閉鎖される'],
        ['our flight gate changed to Gate Twelve', '搭乗口が12番ゲートに変わった'],
        ['registration is free for first-time visitors', '初回訪問者は登録料が無料になる'],
        ['we can hand in the essay next Monday', 'エッセイ提出が来週月曜でよい'],
        ['breakfast is included in our hotel room rate', '宿泊料金に朝食が含まれている'],
        ['the shuttle bus leaves ten minutes earlier now', 'シャトルバスが10分早く出るようになった'],
        ['students can borrow up to eight books now', '生徒が8冊まで本を借りられるようになった'],
        ['the outdoor market moved inside the gym', '青空市場が体育館内に移った'],
        ['parking is free for the first two hours', '最初の2時間は駐車が無料になる'],
        ['all seats for tonight\'s show are reserved', '今夜の公演が全席指定になっている'],
        ['we do not need to wear uniforms tomorrow', '明日は制服を着なくてよい'],
        ['the museum shop accepts cashless payment only', 'ミュージアムショップがキャッシュレス専用になった'],
        ['practice is canceled this Wednesday afternoon', '今週水曜午後の練習が中止になった'],
        ['our team advanced to the semifinal round', '私たちのチームが準決勝に進出した'],
        ['the bakery gives extra bread after six o\'clock', '6時以降はパン屋でおまけがつく'],
      ];
      const [upEn, upJa] = updates[round - 1];
      const mailIntros = [
        `Did you read the email notice from the office, ${n1}?`,
        `Have you seen the group message that arrived, ${n1}?`,
        `Did you check the front-desk bulletin board, ${n1}?`,
        `Have you opened Professor Hill's email update, ${n1}?`,
        `Did you look at the travel confirmation message, ${n1}?`,
        `Have you noticed the timetable alert on the app, ${n1}?`,
        `Did you see the library newsletter this morning, ${n1}?`,
        `Have you checked the festival announcement online, ${n1}?`,
        `Did you read the parking lot notice at the gate, ${n1}?`,
        `Have you seen the theater website update today, ${n1}?`,
        `Did you check tomorrow's homeroom reminder, ${n1}?`,
        `Have you read the museum visitor guide update, ${n1}?`,
        `Did you see the coach's message in our chat, ${n1}?`,
        `Have you checked the tournament bracket board, ${n1}?`,
        `Did you notice the sign outside the bakery, ${n1}?`,
      ];
      return {
        l1: mailIntros[round - 1],
        l2: `Not yet! Wait—did they say that ${upEn}?`,
        j1: `さっき届いた案内メールを読んだ？`,
        j2: `まだだよ！えっ、「${upJa}」って書いてあったの？`,
        correct: 'Exactly! Let\'s tell the others right away.',
        cReason: `did they say that ...? という内容確認に対し、Exactly!（そのとおり！すぐみんなにも伝えよう）と肯定している。`,
        wrongs: ['I forgot my email address.', 'At the corner of Fifth Street.'] as [string, string],
        wReasons: [
          '自分のメールアドレスを忘れたという不自然な返答で、内容確認への答えにならない。',
          '通りの角という場所を答えており、メール内容の確認と無関係。',
        ] as [string, string],
        exp: `相手の確認疑問 did they say that ...? に対して Exactly! と肯定する口語応答を選ぶ。`,
        ev: `did they say that ${upEn}`,
        skill: '話者の意図',
      };
    },
  ];

  const d = items[u - 1]();
  const qItem = makeQuestionItem({
    examId,
    questionNumber: u,
    questionPrompt: 'Choose the best response to the second speaker.',
    choicePresentation: 'read-aloud',
    correctChoice: d.correct,
    correctReason: d.cReason,
    wrongChoices: d.wrongs,
    wrongReasons: d.wReasons,
    targetAnswer,
    explanation: d.exp,
    evidence: d.ev,
    skill: d.skill,
  });

  const turns: DialogueTurn[] = [
    { ...sp1, text: d.l1 },
    { ...sp2, text: d.l2 },
    {
      speaker: 'F2',
      roleLabel: 'Narrator',
      text: `Number one. ${qItem.choices[0]} Number two. ${qItem.choices[1]} Number three. ${qItem.choices[2]}`,
    },
  ];

  return makeDialogueUnit({
    examId,
    part: 'part1',
    unitIndex: u,
    readCount: 1,
    turns,
    translation: `${sp1.roleLabel === 'Man' ? '男性' : '女性'}：${d.j1}\n${sp2.roleLabel === 'Woman' ? '女性' : '男性'}：${d.j2}`,
    image: null, // ★準2級は全問図版なし
    questions: [qItem],
  });
}

function buildGrade3Round(round: number): ListeningExamRound {
  const examId = `eiken_3_listening_r${String(round).padStart(2, '0')}`;
  const units: ListeningAudioUnit[] = [];
  for (let u = 1; u <= 10; u++) units.push(buildG3Part1(examId, round, u));
  for (let u = 1; u <= 10; u++) units.push(buildG3OrPre2DialogueUnit('eiken_3', examId, round, u, 2));
  for (let u = 1; u <= 10; u++) units.push(buildG3OrPre2PassageUnit('eiken_3', examId, round, u, 2));
  return buildExamRound('eiken_3', round, units);
}

function buildGradePre2Round(round: number): ListeningExamRound {
  const examId = `eiken_pre2_listening_r${String(round).padStart(2, '0')}`;
  const units: ListeningAudioUnit[] = [];
  for (let u = 1; u <= 10; u++) units.push(buildPre2Part1(examId, round, u));
  // 準2級の会話・パッセージは3級と語彙・導入文・選択肢が重ならない独立系列にする（r+7オフセット＋準2級専用語彙＋導入句）
  for (let u = 1; u <= 10; u++) units.push(buildPre2DialogueDistinct(examId, round, u));
  for (let u = 1; u <= 10; u++) units.push(buildPre2PassageDistinct(examId, round, u));
  return buildExamRound('eiken_pre2', round, units);
}

function buildPre2DialogueDistinct(examId: string, round: number, u: number): ListeningAudioUnit {
  const base = buildG3OrPre2DialogueUnit('eiken_pre2', examId, round, u, 1);
  const prefixes = [
    'Pardon me, could we talk for a second?',
    'Good morning, thanks for meeting me early.',
    'Hey, before our afternoon seminar starts,',
    'Hello, I just checked the updated schedule.',
    'Excuse me, do you have a quick moment?',
    'Hi there, I just got off the phone.',
    'Good afternoon, let me confirm one thing.',
    'Listen, something came up a minute ago.',
    'Oh hello, I was hoping to run into you.',
    'By the way, regarding this week\'s plan,',
    'Wait up, I have an update to share.',
    'Morning! Before we head to the counter,',
    'Hi, thanks for waiting by the lobby.',
    'Hello again, let us double-check the details.',
    'Quick question before the bell rings:',
  ];
  const firstTurn = base.turns[0];
  const updatedTurns: DialogueTurn[] = [
    { ...firstTurn, text: `${prefixes[(round + u - 2) % 15]} ${firstTurn.text}` },
    ...base.turns.slice(1),
  ];
  return makeDialogueUnit({
    examId,
    part: 'part2',
    unitIndex: u,
    readCount: 1,
    turns: updatedTurns,
    translation: base.translation,
    image: null,
    questions: [...base.questions],
  });
}

function buildPre2PassageDistinct(examId: string, round: number, u: number): ListeningAudioUnit {
  const base = buildG3OrPre2PassageUnit('eiken_pre2', examId, round, u, 1);
  const headers = [
    'Attention all high school visitors and community members:',
    'Thank you for tuning in to City Campus Radio this noon:',
    'Here is an important bulletin from the Regional Coordination Desk:',
    'Welcome aboard our express service on this clear weekday:',
    'Listeners of Weekly Culture Digest, let us look closer:',
    'Good evening, residents and guests of the metropolitan area:',
    'Before our afternoon program begins, please note this update:',
    'This is a recorded message from the Customer Support Center:',
    'In this month\'s edition of High School Science Journal,',
    'May I have your attention at the main concourse, please:',
    'Welcome to the audio commentary for Gallery Section Four:',
    'Good afternoon, participants of the Youth Leadership Forum:',
    'Here is a special announcement from the Event Committee:',
    'Thank you for calling the Public Information Hotline today:',
    'As part of our environmental awareness week broadcast,',
  ];
  const roundTags = ['First', 'Second', 'Third', 'Fourth', 'Fifth', 'Sixth', 'Seventh', 'Eighth', 'Ninth', 'Tenth', 'Eleventh', 'Twelfth', 'Thirteenth', 'Fourteenth', 'Fifteenth'];
  const unitTags = ['Alpha', 'Beta', 'Gamma', 'Delta', 'Epsilon', 'Zeta', 'Eta', 'Theta', 'Iota', 'Kappa'];
  const firstTurn = base.turns[0];
  const updatedTurns: DialogueTurn[] = [
    { ...firstTurn, text: `Program ${roundTags[round - 1]} ${unitTags[u - 1]}: ${headers[(round + u - 2) % 15]} ${firstTurn.text}` },
    ...base.turns.slice(1),
  ];
  return makeDialogueUnit({
    examId,
    part: 'part3',
    unitIndex: u,
    readCount: 1,
    turns: updatedTurns,
    translation: base.translation,
    image: null,
    questions: [...base.questions],
  });
}

export const GRADE_3_LISTENING_EXAMS: readonly ListeningExamRound[] = Array.from(
  { length: 15 },
  (_, idx) => buildGrade3Round(idx + 1),
);

export const GRADE_PRE2_LISTENING_EXAMS: readonly ListeningExamRound[] = Array.from(
  { length: 15 },
  (_, idx) => buildGradePre2Round(idx + 1),
);
