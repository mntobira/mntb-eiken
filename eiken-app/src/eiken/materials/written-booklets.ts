import { WRITTEN_5_R2 } from './written-round2-five';
import { WRITTEN_5_R3 } from './reading-round-five';
import { WRITTEN_5_R4, WRITTEN_5_R5, WRITTEN_5_R6 } from './reading-round-five-s1';
import { WRITTEN_5_R7, WRITTEN_5_R8, WRITTEN_5_R9 } from './reading-round-five-s2';
import { WRITTEN_5_R10, WRITTEN_5_R11, WRITTEN_5_R12 } from './reading-round-five-s3';
import { WRITTEN_5_R13, WRITTEN_5_R14, WRITTEN_5_R15 } from './reading-round-five-s4';
import { READING_4 } from './reading-round-foundation';
import { WRITTEN_4_R2 } from './written-round2-four';
import { READING_4_R3 } from './reading-round-foundation-more';
import { READING_4_R4, READING_4_R5, READING_4_R6 } from './reading-round-foundation-s1';
import { READING_4_R7, READING_4_R8, READING_4_R9 } from './reading-round-foundation-s2';
import { READING_4_R10, READING_4_R11, READING_4_R12 } from './reading-round-foundation-s3';
import { READING_4_R13, READING_4_R14, READING_4_R15 } from './reading-round-foundation-s4';
import { READING_3 } from './reading-round-three';
import { WRITTEN_3_R2 } from './written-round2-three';
import { WRITTEN_3_R3 } from './written-round3-three';
import { WRITTEN_3_R4 } from './written-round4-three';
import { WRITTEN_3_R5 } from './written-round5-three';
import { WRITTEN_3_R6 } from './written-round6-three';
import { WRITTEN_3_R7 } from './written-round7-three';
import { WRITTEN_3_R8 } from './written-round8-three';
import { WRITTEN_3_R9 } from './written-round9-three';
import { WRITTEN_3_R10 } from './written-round10-three';
import { WRITTEN_3_R11 } from './written-round11-three';
import { WRITTEN_3_R12 } from './written-round12-three';
import { WRITTEN_3_R13 } from './written-round13-three';
import { WRITTEN_3_R14 } from './written-round14-three';
import { WRITTEN_3_R15 } from './written-round15-three';
import { READING_PRE2 } from './reading-round-pre-two';
import { WRITTEN_PRE2_R2 } from './written-round2-pre-two';
import { WRITTEN_PRE2_R3 } from './written-round3-pre-two';
import { READING_PRE2_R4, READING_PRE2_R5, READING_PRE2_R6 } from './reading-round-pre-two-s1';
import { READING_PRE2_R7, READING_PRE2_R8, READING_PRE2_R9 } from './reading-round-pre-two-s2';
import { READING_PRE2_R10, READING_PRE2_R11, READING_PRE2_R12 } from './reading-round-pre-two-s3';
import { READING_PRE2_R13, READING_PRE2_R14, READING_PRE2_R15 } from './reading-round-pre-two-s4';
import { READING_PLUS } from './reading-round-bridge';
import { WRITTEN_PLUS_R2 } from './written-round2-bridge';
import { READING_PLUS_R3 } from './reading-round-bridge-more';
import { READING_PLUS_R4, READING_PLUS_R5, READING_PLUS_R6 } from './reading-round-bridge-s1';
import { READING_PLUS_R7, READING_PLUS_R8, READING_PLUS_R9 } from './reading-round-bridge-s2';
import { READING_PLUS_R10, READING_PLUS_R11, READING_PLUS_R12 } from './reading-round-bridge-s3';
import { READING_PLUS_R13, READING_PLUS_R14, READING_PLUS_R15 } from './reading-round-bridge-s4';
import { READING_2 } from './reading-round-two';
import { WRITTEN_2_R2 } from './written-round2-two';
import { WRITTEN_2_R3 } from './written-round3-two';
import { READING_2_R4, READING_2_R5, READING_2_R6 } from './reading-round-two-s1';
import { READING_2_R7, READING_2_R8, READING_2_R9 } from './reading-round-two-s2';
import { READING_2_R10, READING_2_R11, READING_2_R12 } from './reading-round-two-s3';
import { READING_2_R13, READING_2_R14, READING_2_R15 } from './reading-round-two-s4';
import { READING_PRE1 } from './reading-round-pre-one';
import { WRITTEN_PRE1_R2 } from './written-round2-pre-one';
import { READING_PRE1_R3 } from './reading-round-pre-one-more';
import { READING_PRE1_R4, READING_PRE1_R5, READING_PRE1_R6 } from './reading-round-pre-one-s1';
import { READING_PRE1_R7, READING_PRE1_R8, READING_PRE1_R9 } from './reading-round-pre-one-s2';
import { READING_PRE1_R10, READING_PRE1_R11, READING_PRE1_R12 } from './reading-round-pre-one-s3';
import { READING_PRE1_R13, READING_PRE1_R14, READING_PRE1_R15 } from './reading-round-pre-one-s4';
import { READING_1 } from './reading-round-one';
import { WRITTEN_1_R2 } from './written-round2-one';
import { READING_1_R3 } from './reading-round-one-more';
import { READING_1_R4, READING_1_R5, READING_1_R6 } from './reading-round-one-s1';
import { READING_1_R7, READING_1_R8, READING_1_R9 } from './reading-round-one-s2';
import { READING_1_R10, READING_1_R11, READING_1_R12 } from './reading-round-one-s3';
import { READING_1_R13, READING_1_R14, READING_1_R15 } from './reading-round-one-s4';
import { validateReleasedBooklets, type WrittenExam, type WrittenItem } from '../writtenExamCore';

const id='eiken_5_written_01';
const choice=(number:number,prompt:string,choices:[string,string,string,string],answer:number,explanation:string,reasons:[string,string,string,string],translation:string,section:WrittenItem['section']='short'):WrittenItem=>({id:`${id}_q${String(number).padStart(2,'0')}`,section,kind:'choice',prompt,choices,answer,explanation,distractorReasons:reasons,translation});
const order=(number:number,japanese:string,prefix:string,tokens:string[],answerOrder:number[],pairs:[string,string,string,string],answer:number,sentence:string,explanation:string):WrittenItem=>({
 ...choice(number,`${japanese}\n${prefix} ( ____ / ____ / ____ / ____ )${sentence.endsWith('?')?'?':'.'}\n1番目・3番目の語句番号の組を選んでください。`,pairs,answer,explanation,pairs.map((pair,index)=>index===answer?`正しい語順の1番目・3番目は${pair}。`:`${pair}は完成文の1番目・3番目と一致しない。`)as[string,string,string,string],japanese,'reorder'),
 orderTokens:tokens,orderAnswer:answerOrder,orderPrefix:prefix,completedSentence:sentence,
});

/** Independently authored written/reading rounds. NOT a source-text substitution of a past paper.
 * Review='approved' means internal authoring/answer consistency review, NOT external calibration.
 * Five-grade format: 15 short blanks + 5 conversations + 5 four-chunk ordering items (25 min).
 */
export const WRITTEN_BOOKLETS:readonly WrittenExam[]=[{
 id,grade:'eiken_5',round:1,revision:'original-20261110-r1',origin:'manatobi-original',review:'approved',items:[
  choice(1,'A: What is the (     ) now?\nB: It is ten thirty.',['time','date','name','color'],0,'ten thirtyは時刻を答えているのでtime（時刻）。',['timeは時刻。ten thirtyと対応する。','dateは日付。時刻の答えと合わない。','nameは名前。時刻を尋ねられない。','colorは色。答えと合わない。'],'A：今何時？ B：10時30分だよ。'),
  choice(2,'There are four (     ) on the table. Please take one.',['cups','milk','cup','water'],0,'数fourに続く、数えられる名詞の複数形cupsが必要。',['cupsはcupの複数形。four cupsで4つのコップ。','milkは通常数えない名詞。four milkとはしない。','cupは単数形。fourとは使わない。','waterは通常数えない名詞。four waterとはしない。'],'テーブルにコップが4つあります。1つ取ってください。'),
  choice(3,'The baby is sleeping. Please (     ) quiet.',['eat','read','be','make'],2,'be quietで「静かにする」。Pleaseに続けて動詞の原形beを使う。',['eatは「食べる」でquietにつながらない。','readは「読む」。quietを続けて「静かにする」を表せない。','be quietは「静かにして」。','make quietではこの依頼を表せない。'],'赤ちゃんが眠っています。静かにしてください。'),
  choice(4,'A: What day comes after Thursday?\nB: (     ).',['Monday','Sunday','Friday','Tuesday'],2,'Thursday（木曜日）の次はFriday（金曜日）。',['Mondayは月曜日。','Sundayは日曜日。','Fridayは金曜日で、木曜日の次。','Tuesdayは火曜日。'],'A：木曜日の次は何曜日ですか？ B：金曜日です。'),
  choice(5,'A: Do you have a pencil?\nB: Yes. You can (     ) this one for the test.',['sing','drink','open','use'],3,'鉛筆をテストに「使う」なのでuse。',['singは「歌う」。','drinkは「飲む」。','openは「開ける」。鉛筆を使う意味にならない。','useは「使う」。this oneは鉛筆を指す。'],'A：鉛筆を持っていますか？ B：はい。この鉛筆をテストに使っていいですよ。'),
  choice(6,'It is raining today. Take an (     ) when you go out.',['apple','orange','umbrella','eraser'],2,'雨の日の外出で持っていく物はumbrella（傘）。',['appleはリンゴ。雨への備えではない。','orangeはオレンジ。','umbrellaは傘。雨の日の外出に対応する。','eraserは消しゴム。'],'今日は雨が降っています。外に出るときは傘を持っていきなさい。'),
  choice(7,'We have no eggs at home. Let us go to the (     ) to buy some.',['pool','zoo','supermarket','station'],2,'卵を買う場所として文脈に合うのはsupermarket。',['poolはプール。卵を買う目的に合わない。','zooは動物園。','supermarketは食品などを買う店。','stationは駅。ここでは卵を買う店を選ぶ。'],'家に卵がありません。いくつか買いにスーパーへ行きましょう。'),
  choice(8,'A: Please look at the two pictures. Do you like (     )?\nB: Yes. They are very nice.',['it','them','he','she'],1,'two picturesを受ける目的語なので、複数の物を指すthem。',['itは単数の物を指す。','themは複数の物や人を受ける目的語。','heは男性1人を指す主語。','sheは女性1人を指す主語。'],'A：2枚の絵を見てください。気に入りましたか？ B：はい。とても素敵です。'),
  choice(9,'A: How (     ) are you, Toma?\nB: I am eleven.',['long','old','many','much'],1,'How oldで年齢を尋ねる。I am eleven.は11歳という答え。',['How longは長さや期間を尋ねる。','How oldは年齢を尋ねる。','How manyは数を尋ねる。','How muchは量や値段を尋ねる。'],'A：トウマ、何歳ですか？ B：11歳です。'),
  choice(10,'I have a new bag. There is a small pocket on (     ) bag.',['mine','I','me','my'],3,'名詞bagの直前で「私の」を表すmyを使う。',['mineは「私のもの」。後ろにbagを続けない。','Iは主語の「私は」。','meは「私を／私に」。名詞の前に置いて所有を表せない。','my＋名詞で「私の〜」。'],'私は新しいかばんを持っています。私のかばんには小さなポケットがあります。'),
  choice(11,'A: Can Rina play the piano?\nB: Yes, she (     ). She plays every day.',['has','can','is','does'],1,'Canで始まる質問には、ここではYes, she can.で答える。',['hasはこのCanの質問への短い答えにならない。','canで能力を肯定する。','isはbe動詞の質問への答えで使う。','doesはDoesで始まる一般動詞の質問に対応する。'],'A：リナはピアノを弾けますか？ B：はい。毎日弾いています。'),
  choice(12,'A: (     ) is the school library?\nB: It is next to the music room.',['When','What','Who','Where'],3,'next to the music roomは場所の説明。場所を尋ねるWhereを使う。',['Whenは時を尋ねる。','Whatは物事を尋ねる。ここでは場所を直接尋ねる。','Whoは人を尋ねる。','Whereは場所を尋ねる。'],'A：学校の図書室はどこですか？ B：音楽室の隣です。'),
  choice(13,'My father (     ) breakfast at six every morning.',['eats','eating','eat','to eat'],0,'主語My fatherは3人称単数。習慣を表す現在形はeats。',['eatsは3人称単数の現在形。','eatingだけでは文の述語にならない。','eatはこの主語の現在形では語尾sが必要。','to eatだけでは文の述語にならない。'],'父は毎朝6時に朝食を食べます。'),
  choice(14,'A: Does your sister like carrots?\nB: No, she (     ).',['can not','does not','has not','is not'],1,'Doesで始まる質問への否定の答えはNo, she does not.。',['can notは能力などの否定。好みを尋ねるDoesの質問とは合わない。','does notはDoesの質問への否定。','has notはこの一般動詞の短い答えにならない。','is notはbe動詞の否定。'],'A：妹さんはニンジンが好きですか？ B：いいえ、好きではありません。'),
  choice(15,'The art club meets (     ) Wednesday afternoon.',['on','in','at','under'],0,'曜日の前にはonを使う。Wednesday afternoonも同じ。',['on＋曜日（曜日の午後も含む）。','inは月・年などに使う。','atは時刻などに使う。','underは「〜の下に」で時の説明に合わない。'],'美術部は水曜日の午後に集まります。'),
  choice(16,'A: Let us make a small kite this afternoon.\nB: (     )',['You are welcome.','Yes, I did.','See you yesterday.','That sounds fun.'],3,'作ろうという誘いにThat sounds fun.（楽しそうだね）で応じる。',['お礼への返答であり、誘いへの答えにならない。','過去の質問への答えであり、Let usの誘いに合わない。','別れの表現としても不自然で誘いに合わない。','提案を楽しそうだと受け入れている。'],'A：今日の午後、小さなたこを作ろう。 B：楽しそうだね。','conversation'),
  choice(17,'A: Thank you for carrying my books.\nB: (     )',['You are welcome.','Yes, please.','Excuse me.','I am sorry.'],0,'お礼にはYou are welcome.（どういたしまして）と応じる。',['お礼への自然な応答。','勧めを受ける表現であり、Thank youへの返答にならない。','呼びかけ・謝罪の表現であり、お礼への返答にならない。','謝る場面ではなく、お礼を受け取る場面。'],'A：本を運んでくれてありがとう。 B：どういたしまして。','conversation'),
  choice(18,'A: May I sit here?\nB: (     )',['Yes, please.','No, I do not.','You are welcome.','Thank you very much.'],0,'座ってよいかという許可の依頼に、Yes, please.（どうぞ）で応じる。',['相手に座るよう許可している。','May I ...? の許可を求める質問にdo notでは答えられない。','お礼への返答であり、着席の許可にならない。','自分が頼まれている側なのでお礼だけでは噛み合わない。'],'A：ここに座ってもいいですか？ B：はい、どうぞ。','conversation'),
  choice(19,'A: You look tired. Are you all right?\nB: (     )',['Nice to meet you.','I need some water.','Happy birthday.','You are welcome.'],1,'疲れている様子を気遣われ、水が必要だと自身の状態を伝えている。',['初対面のあいさつであり、体調を気遣う質問に合わない。','今必要なものを答える自然な応答。','誕生日の祝辞であり場面に合わない。','お礼への返答でありAre you all right?に合わない。'],'A：疲れているみたいだけど大丈夫？ B：水が欲しいです。','conversation'),
  choice(20,'A: I must go now. See you at the club tomorrow.\nB: (     )',['Nice to meet you.','Here you are.','See you then.','Yes, please.'],2,'明日会おうという別れのあいさつにSee you then.と返す。',['初対面のあいさつであり別れ際に合わない。','物を手渡す表現であり別れのあいさつに合わない。','「では、そのときに」で次回会う約束に応じている。','勧めを受ける表現でありSee youへの返答にならない。'],'A：もう行かなければ。明日クラブで会おう。 B：また明日。','conversation'),
  order(21,'私たちは昼食の前、いつも手を洗います。','We',['wash','our hands','always','before lunch'],[3,1,2,4],['1－2','1－4','3－2','3－4'],2,'We always wash our hands before lunch.','頻度を表すalwaysは一般動詞washの前。wash our handsで「手を洗う」。1番目は③always、3番目は②our hands。'),
  order(22,'私は傘を棚に置きます。','I',['put','on','the shelf','my umbrella'],[1,4,2,3],['1－2','1－3','4－2','4－3'],0,'I put my umbrella on the shelf.','put＋物＋場所で「物をある場所に置く」。1番目は①put、3番目は②on。'),
  order(23,'私の兄は今、おなかがすいていません。','My brother',['now','not','is','hungry'],[3,2,4,1],['2－1','2－4','3－1','3－4'],3,'My brother is not hungry now.','be動詞の否定はis not。hungryは「空腹の」。1番目は③is、3番目は④hungry。'),
  order(24,'あなたはどうやって学校へ行きますか。','How',['to school','do','get','you'],[2,4,3,1],['2－1','2－3','4－1','4－3'],1,'How do you get to school?','How＋do＋主語＋動詞で手段を尋ねる。1番目は②do、3番目は③get。'),
  order(25,'その本をこの机の上に置いてください。','Please',['this desk','on','the book','put'],[4,3,2,1],['3－1','3－2','4－1','4－2'],3,'Please put the book on this desk.','put＋物＋場所で「物をある場所に置く」。on this deskは「この机の上に」。1番目は④put、3番目は②on。'),
 ]
},
WRITTEN_5_R2, WRITTEN_5_R3, WRITTEN_5_R4, WRITTEN_5_R5, WRITTEN_5_R6, WRITTEN_5_R7, WRITTEN_5_R8, WRITTEN_5_R9, WRITTEN_5_R10, WRITTEN_5_R11, WRITTEN_5_R12, WRITTEN_5_R13, WRITTEN_5_R14, WRITTEN_5_R15,
READING_4, WRITTEN_4_R2, READING_4_R3, READING_4_R4, READING_4_R5, READING_4_R6, READING_4_R7, READING_4_R8, READING_4_R9, READING_4_R10, READING_4_R11, READING_4_R12, READING_4_R13, READING_4_R14, READING_4_R15,
READING_3, WRITTEN_3_R2, WRITTEN_3_R3, WRITTEN_3_R4, WRITTEN_3_R5, WRITTEN_3_R6, WRITTEN_3_R7, WRITTEN_3_R8, WRITTEN_3_R9, WRITTEN_3_R10, WRITTEN_3_R11, WRITTEN_3_R12, WRITTEN_3_R13, WRITTEN_3_R14, WRITTEN_3_R15,
READING_PRE2, WRITTEN_PRE2_R2, WRITTEN_PRE2_R3, READING_PRE2_R4, READING_PRE2_R5, READING_PRE2_R6, READING_PRE2_R7, READING_PRE2_R8, READING_PRE2_R9, READING_PRE2_R10, READING_PRE2_R11, READING_PRE2_R12, READING_PRE2_R13, READING_PRE2_R14, READING_PRE2_R15,
READING_PLUS, WRITTEN_PLUS_R2, READING_PLUS_R3, READING_PLUS_R4, READING_PLUS_R5, READING_PLUS_R6, READING_PLUS_R7, READING_PLUS_R8, READING_PLUS_R9, READING_PLUS_R10, READING_PLUS_R11, READING_PLUS_R12, READING_PLUS_R13, READING_PLUS_R14, READING_PLUS_R15,
READING_2, WRITTEN_2_R2, WRITTEN_2_R3, READING_2_R4, READING_2_R5, READING_2_R6, READING_2_R7, READING_2_R8, READING_2_R9, READING_2_R10, READING_2_R11, READING_2_R12, READING_2_R13, READING_2_R14, READING_2_R15,
READING_PRE1, WRITTEN_PRE1_R2, READING_PRE1_R3, READING_PRE1_R4, READING_PRE1_R5, READING_PRE1_R6, READING_PRE1_R7, READING_PRE1_R8, READING_PRE1_R9, READING_PRE1_R10, READING_PRE1_R11, READING_PRE1_R12, READING_PRE1_R13, READING_PRE1_R14, READING_PRE1_R15,
READING_1, WRITTEN_1_R2, READING_1_R3, READING_1_R4, READING_1_R5, READING_1_R6, READING_1_R7, READING_1_R8, READING_1_R9, READING_1_R10, READING_1_R11, READING_1_R12, READING_1_R13, READING_1_R14, READING_1_R15,
];
validateReleasedBooklets(WRITTEN_BOOKLETS);
