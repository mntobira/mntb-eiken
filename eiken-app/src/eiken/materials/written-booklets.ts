import { WRITTEN_5_R2, WRITTEN_5_R3 } from './reading-round-five';
import { WRITTEN_5_R4, WRITTEN_5_R5, WRITTEN_5_R6 } from './reading-round-five-s1';
import { READING_4 } from './reading-round-foundation';
import { READING_4_R2, READING_4_R3 } from './reading-round-foundation-more';
import { READING_4_R4, READING_4_R5, READING_4_R6 } from './reading-round-foundation-s1';
import { READING_3 } from './reading-round-three';
import { READING_3_R2, READING_3_R3 } from './reading-round-three-more';
import { READING_3_R4, READING_3_R5, READING_3_R6 } from './reading-round-three-s1';
import { READING_PRE2 } from './reading-round-pre-two';
import { READING_PRE2_R2, READING_PRE2_R3 } from './reading-round-pre-two-more';
import { READING_PRE2_R4, READING_PRE2_R5, READING_PRE2_R6 } from './reading-round-pre-two-s1';
import { READING_PLUS } from './reading-round-bridge';
import { READING_PLUS_R2, READING_PLUS_R3 } from './reading-round-bridge-more';
import { READING_PLUS_R4, READING_PLUS_R5, READING_PLUS_R6 } from './reading-round-bridge-s1';
import { READING_2 } from './reading-round-two';
import { READING_2_R2, READING_2_R3 } from './reading-round-two-more';
import { READING_2_R4, READING_2_R5, READING_2_R6 } from './reading-round-two-s1';
import { READING_PRE1 } from './reading-round-pre-one';
import { READING_PRE1_R2, READING_PRE1_R3 } from './reading-round-pre-one-more';
import { READING_PRE1_R4, READING_PRE1_R5, READING_PRE1_R6 } from './reading-round-pre-one-s1';
import { validateWrittenExam, type WrittenExam, type WrittenItem } from '../writtenExamCore';

const id='eiken_5_written_01';
const choice=(number:number,prompt:string,choices:[string,string,string,string],answer:number,explanation:string,reasons:[string,string,string,string],translation:string,section:WrittenItem['section']='short'):WrittenItem=>({id:`${id}_q${String(number).padStart(2,'0')}`,section,kind:'choice',prompt,choices,answer,explanation,distractorReasons:reasons,translation});
const order=(number:number,japanese:string,prefix:string,tokens:string[],answerOrder:number[],pairs:[string,string,string,string],answer:number,sentence:string,explanation:string):WrittenItem=>({
 ...choice(number,`${japanese}\n${prefix} ( ____ / ____ / ____ / ____ )${sentence.endsWith('?')?'?':'.'}\n並べ替えた1番目・3番目に入る語句の番号の組を選んでください。`,pairs,answer,explanation,pairs.map((pair,index)=>index===answer?`正しい語順では1番目・3番目は${pair}。`:`${pair}の組では正しい1番目・3番目になりません。`)as[string,string,string,string],japanese,'reorder'),
 orderTokens:tokens,orderAnswer:answerOrder,orderPrefix:prefix,completedSentence:sentence,
});

/** Independently authored complete written round. NOT a source-text substitution of a past paper.
 * Review='approved' means internal authoring/answer consistency review, NOT external calibration.
 * Five-grade format: 15 short blanks + 5 conversations + 5 four-chunk ordering items (25 min).
 */
export const WRITTEN_BOOKLETS:readonly WrittenExam[]=[{
 id,grade:'eiken_5',round:1,revision:'original-20261110-r1',origin:'manatobi-original',review:'approved',items:[
  choice(1,'A: What is the (     ) now?\nB: It is ten thirty.',['date','time','name','color'],1,'ten thirtyは時刻を答えているのでtime（時刻）。',['dateは日付。時刻の答えと合わない。','timeは時刻。ten thirtyと対応する。','nameは名前。時刻を尋ねられない。','colorは色。答えと合わない。'],'A：今何時？ B：10時30分だよ。'),
  choice(2,'I have a new bag. There is a small pocket on (     ) bag.',['my','me','I','mine'],0,'名詞bagの直前で「私の」を表すmyを使う。',['my＋名詞で「私の〜」。','meは「私を／私に」。名詞の前に置いて所有を表せない。','Iは主語の「私は」。','mineは「私のもの」。後ろにbagを続けない。'],'私は新しいかばんを持っています。私のかばんには小さなポケットがあります。'),
  choice(3,'There are four (     ) on the table. Please take one.',['cup','milk','cups','water'],2,'数fourに続く、数えられる名詞の複数形cupsが必要。',['cupは単数形。fourとは使わない。','milkは通常数えない名詞。four milkとはしない。','cupsはcupの複数形。four cupsで4つのコップ。','waterは通常数えない名詞。four waterとはしない。'],'テーブルにコップが4つあります。1つ取ってください。'),
  choice(4,'A: Can Rina play the piano?\nB: Yes, she (     ). She plays every day.',['is','does','has','can'],3,'Canで始まる質問には、ここではYes, she can.で答える。',['isはbe動詞の質問への答えで使う。','doesはDoesで始まる一般動詞の質問に対応する。','hasはこのCanの質問への短い答えにならない。','canで能力を肯定する。'],'A：リナはピアノを弾けますか？ B：はい。毎日弾いています。'),
  choice(5,'The baby is sleeping. Please (     ) quiet.',['make','be','read','eat'],1,'be quietで「静かにする」。Pleaseに続けて動詞の原形beを使う。',['make quietではこの依頼を表せない。','be quietは「静かにして」。','readは「読む」。quietを続けて「静かにする」を表せない。','eatは「食べる」でquietにつながらない。'],'赤ちゃんが眠っています。静かにしてください。'),
  choice(6,'A: (     ) is the school library?\nB: It is next to the music room.',['Where','Who','When','What'],0,'next to the music roomは場所の説明。場所を尋ねるWhereを使う。',['Whereは場所を尋ねる。','Whoは人を尋ねる。','Whenは時を尋ねる。','Whatは物事を尋ねる。ここでは場所を直接尋ねる。'],'A：学校の図書室はどこですか？ B：音楽室の隣です。'),
  choice(7,'My father (     ) breakfast at six every morning.',['eat','eating','eats','to eat'],2,'主語My fatherは3人称単数。習慣を表す現在形はeats。',['eatはこの主語の現在形では語尾sが必要。','eatingだけでは文の述語にならない。','eatsは3人称単数の現在形。','to eatだけでは文の述語にならない。'],'父は毎朝6時に朝食を食べます。'),
  choice(8,'A: What day comes after Thursday?\nB: (     ).',['Monday','Tuesday','Sunday','Friday'],3,'Thursday（木曜日）の次はFriday（金曜日）。',['Mondayは月曜日。','Tuesdayは火曜日。','Sundayは日曜日。','Fridayは金曜日で、木曜日の次。'],'A：木曜日の次は何曜日ですか？ B：金曜日です。'),
  choice(9,'A: Do you have a pencil?\nB: Yes. You can (     ) this one for the test.',['open','drink','use','sing'],2,'鉛筆をテストに「使う」なのでuse。',['openは「開ける」。鉛筆を使う意味にならない。','drinkは「飲む」。','useは「使う」。this oneは鉛筆を指す。','singは「歌う」。'],'A：鉛筆を持っていますか？ B：はい。この鉛筆をテストに使っていいですよ。'),
  choice(10,'A: Does your sister like carrots?\nB: No, she (     ).',['does not','is not','can not','has not'],0,'Doesで始まる質問への否定の答えはNo, she does not.。',['does notはDoesの質問への否定。','is notはbe動詞の否定。','can notは能力などの否定。好みを尋ねるDoesの質問とは合わない。','has notはこの一般動詞の短い答えにならない。'],'A：妹さんはニンジンが好きですか？ B：いいえ、好きではありません。'),
  choice(11,'It is raining today. Take an (     ) when you go out.',['apple','umbrella','eraser','orange'],1,'雨の日の外出で持っていく物はumbrella（傘）。',['appleはリンゴ。雨への備えではない。','umbrellaは傘。雨の日の外出に対応する。','eraserは消しゴム。','orangeはオレンジ。'],'今日は雨が降っています。外に出るときは傘を持っていきなさい。'),
  choice(12,'A: How (     ) are you, Toma?\nB: I am eleven.',['many','much','long','old'],3,'How oldで年齢を尋ねる。I am eleven.は11歳という答え。',['How manyは数を尋ねる。','How muchは量や値段を尋ねる。','How longは長さや期間を尋ねる。','How oldは年齢を尋ねる。'],'A：トウマ、何歳ですか？ B：11歳です。'),
  choice(13,'The art club meets (     ) Wednesday afternoon.',['on','in','at','under'],0,'曜日の前にはonを使う。Wednesday afternoonも同じ。',['on＋曜日（曜日の午後も含む）。','inは月・年などに使う。','atは時刻などに使う。','underは「〜の下に」で時の説明に合わない。'],'美術部は水曜日の午後に集まります。'),
  choice(14,'We have no eggs at home. Let us go to the (     ) to buy some.',['pool','zoo','supermarket','station'],2,'卵を買う場所として文脈に合うのはsupermarket。',['poolはプール。卵を買う目的に合わない。','zooは動物園。','supermarketは食品などを買う店。','stationは駅。ここでは卵を買う店を選ぶ。'],'家に卵がありません。いくつか買いにスーパーへ行きましょう。'),
  choice(15,'A: Please look at the two pictures. Do you like (     )?\nB: Yes. They are very nice.',['it','them','he','she'],1,'two picturesを受ける目的語なので、複数の物を指すthem。',['itは単数の物を指す。','themは複数の物や人を受ける目的語。','heは男性1人を指す主語。','sheは女性1人を指す主語。'],'A：2枚の絵を見てください。気に入りましたか？ B：はい。とても素敵です。'),
  choice(16,'A: Let us make a small kite this afternoon.\nB: (     )',['I am ten years old.','It is under the chair.','No, I am not a teacher.','That sounds fun.'],3,'作ろうという誘いにThat sounds fun.（楽しそうだね）で応じる。',['年齢を答えており、誘いへの応答でない。','場所を答えており、誘いへの応答でない。','職業を否定しており、誘いへの応答でない。','提案を楽しそうだと受け入れている。'],'A：今日の午後、小さなたこを作ろう。 B：楽しそうだね。','conversation'),
  choice(17,'A: Thank you for carrying my books.\nB: (     )',['You are welcome.','I am from Canada.','It is eight o\'clock.','I have two cats.'],0,'お礼にはYou are welcome.（どういたしまして）と応じる。',['お礼への自然な応答。','出身地を述べており、お礼への応答でない。','時刻を述べている。','飼っている猫の数を述べている。'],'A：本を運んでくれてありがとう。 B：どういたしまして。','conversation'),
  choice(18,'A: May I sit here?\nB: (     )',['I like the blue one.','Yes, please.','At nine thirty.','My name is Leo.'],1,'座ってよいかという許可の依頼に、Yes, please.（どうぞ）で応じる。',['好みを述べており、座る許可への答えでない。','相手に座るよう許可している。','時刻を答えている。','自己紹介で、許可への答えでない。'],'A：ここに座ってもいいですか？ B：はい、どうぞ。','conversation'),
  choice(19,'A: You look tired. Are you all right?\nB: (     )',['It is a red bag.','There are five desks.','I need some water.','She is my aunt.'],2,'疲れている様子を気遣われ、水が必要だと自身の状態を伝えている。',['かばんの説明で、自分の状態を答えていない。','机の数で、気遣いへの応答でない。','今必要なものを答える自然な応答。','別の人物を説明しており、気遣いへの応答でない。'],'A：疲れているみたいだけど大丈夫？ B：水が欲しいです。','conversation'),
  choice(20,'A: I must go now. See you at the club tomorrow.\nB: (     )',['I have a new ruler.','It is on page five.','Yes, this is a window.','See you then.'],3,'明日会おうという別れのあいさつにSee you then.と返す。',['持ち物の説明で、別れの応答でない。','ページを答えている。','物の確認で、別れの応答でない。','「では、そのときに」で次回会う約束に応じている。'],'A：もう行かなければ。明日クラブで会おう。 B：また明日。','conversation'),
  order(21,'私たちは昼食の前、いつも手を洗います。','We',['before lunch','wash','our hands','always'],[4,2,3,1],['2－3','4－3','4－1','1－2'],1,'We always wash our hands before lunch.','頻度を表すalwaysは一般動詞washの前。wash our handsで「手を洗う」。1番目は④always、3番目は③our hands。'),
  order(22,'私は傘を棚に置きます。','I',['on','my umbrella','put','the shelf'],[3,2,1,4],['1－2','2－4','3－4','3－1'],3,'I put my umbrella on the shelf.','put＋物＋場所で「物をある場所に置く」。1番目は③put、3番目は①on。'),
  order(23,'私の兄は今、おなかがすいていません。','My brother',['not','is','now','hungry'],[2,1,4,3],['2－4','1－3','2－3','4－1'],0,'My brother is not hungry now.','be動詞の否定はis not。hungryは「空腹の」。1番目は②is、3番目は④hungry。'),
  order(24,'あなたはどうやって学校へ行きますか。','How',['get','you','to school','do'],[4,2,1,3],['2－1','4－3','4－1','1－2'],2,'How do you get to school?','How＋do＋主語＋動詞で手段を尋ねる。1番目は④do、3番目は①get。'),
  order(25,'その本をこの机の上に置いてください。','Please',['the book','this desk','on','put'],[4,1,3,2],['4－3','1－2','3－4','4－2'],0,'Please put the book on this desk.','put＋物＋場所で「物をある場所に置く」。on this deskは「この机の上に」。1番目は④put、3番目は③on。'),
 ]
},WRITTEN_5_R2,WRITTEN_5_R3,WRITTEN_5_R4,WRITTEN_5_R5,WRITTEN_5_R6,READING_4,READING_4_R2,READING_4_R3,READING_4_R4,READING_4_R5,READING_4_R6,READING_3,READING_3_R2,READING_3_R3,READING_3_R4,READING_3_R5,READING_3_R6,READING_PRE2,READING_PRE2_R2,READING_PRE2_R3,READING_PRE2_R4,READING_PRE2_R5,READING_PRE2_R6,READING_PLUS,READING_PLUS_R2,READING_PLUS_R3,READING_PLUS_R4,READING_PLUS_R5,READING_PLUS_R6,READING_2,READING_2_R2,READING_2_R3,READING_2_R4,READING_2_R5,READING_2_R6,READING_PRE1,READING_PRE1_R2,READING_PRE1_R3,READING_PRE1_R4,READING_PRE1_R5,READING_PRE1_R6];
WRITTEN_BOOKLETS.forEach(booklet=>validateWrittenExam(booklet));
