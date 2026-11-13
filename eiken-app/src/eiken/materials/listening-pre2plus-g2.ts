import {
  buildExamRound,
  makeDialogueUnit,
  makeQuestionItem,
  speakerPairFor,
} from './listening-helpers';
import type { DialogueTurn, ListeningAudioUnit, ListeningExamRound } from '../listeningExamCore';

/**
 * 英検準2級プラス・2級 リスニング予想問題 各15回（計30回・900問・900音源・図版0枚）
 * - 準2級プラス：第1部15問（会話の内容一致・4肢印刷・1回読み）＋第2部15問（文の内容一致・4肢印刷・1回読み）
 * - 2級：第1部15問（会話の内容一致・4肢印刷・1回読み）＋第2部15問（文の内容一致・4肢印刷・1回読み）
 * - 完全独自作成（origin: 'manatobi-original'）。過去問流用なし。
 */

const M_NAMES = ['Arthur', 'Benjamin', 'Charles', 'Dominic', 'Edward', 'Frederick', 'Gregory', 'Harrison', 'Isaac', 'Julian', 'Kenneth', 'Lawrence', 'Mitchell', 'Nicholas', 'Patrick'];
const F_NAMES = ['Abigail', 'Beatrice', 'Caroline', 'Dorothy', 'Eleanor', 'Florence', 'Gabriella', 'Harriet', 'Isabella', 'Jacqueline', 'Katherine', 'Lillian', 'Margaret', 'Natalie', 'Penelope'];

const DIALOGUE_OPENERS_P2P = [
  'Excuse me, do you have a minute before the briefing?',
  'Good morning, I just looked over the updated notice.',
  'Hi there, thanks for stopping by my desk.',
  'Hello, could we go over the schedule for this week?',
  'Hey, I just spoke with the coordinator on the phone.',
  'Pardon me, are you heading to the conference room?',
  'Morning! Did you see the message on the bulletin board?',
  'Hi, I wanted to ask about the upcoming community event.',
  'Good afternoon, thanks for returning my call so quickly.',
  'Listen, we need to make a quick adjustment today.',
  'Hello again, have you checked the supply list yet?',
  'Oh hi, I am glad I caught you before lunch.',
  'By the way, regarding next month\'s training workshop,',
  'Excuse me, is this the registration table for visitors?',
  'Hi, I have an update about our group presentation.',
] as const;

const DIALOGUE_OPENERS_G2 = [
  'Good morning, thank you for coming to the consultation desk.',
  'Hello, I have just reviewed the quarterly maintenance plan.',
  'Pardon me, could I confirm a detail about my membership?',
  'Hi, did you hear the announcement from the facilities team?',
  'Good afternoon, I am calling regarding next week\'s shipment.',
  'Excuse me, I noticed a change on the departmental calendar.',
  'Hello there, how are preparations going for the symposium?',
  'Morning! I just received feedback from the review committee.',
  'Hi, do you have a moment to discuss the venue layout?',
  'Listen, there has been a slight change to our itinerary.',
  'Good evening, thanks for staying to finalize the report.',
  'Oh hello, I just checked the availability of the studio.',
  'By the way, concerning the new recycling guidelines here,',
  'Excuse me, I would like to inquire about the evening course.',
  'Hi again, let us verify the figures before the meeting.',
] as const;

interface MidDialogueSpec {
  skill: string;
  build: (round: number, isG2: boolean, m: string, f: string, who1: string, who2: string) => {
    l1: string;
    l2: string;
    l3: string;
    l4: string;
    ja: string;
    prompt: string;
    correct: string;
    cReason: string;
    wrongs: [string, string, string];
    wReasons: [string, string, string];
    exp: string;
    ev: string;
  };
}

const MID_DIALOGUE_SPECS: readonly MidDialogueSpec[] = [
  // 1: 会場・設備トラブルと代替対応
  {
    skill: '会話：問題点',
    build: (r, isG2, m, f, who1) => {
      const rooms = isG2
        ? ['Seminar Hall North', 'Auditorium B', 'Gallery Room Four', 'Media Lab Two', 'Executive Room Six', 'Lecture Hall East', 'Studio Seven', 'Workshop Annex', 'Atrium Lounge', 'Boardroom Three', 'Archive Room One', ' Pavilion Hall', 'Forum Room Five', ' Terrace Room', ' Briefing Suite'].map(s => s.trim())
        : ['Study Room One', 'Club Hall East', 'Music Annex', 'Science Room Four', 'Meeting Booth B', 'Art Studio Two', 'Library Lounge', 'Gym Balcony', 'Cooking Lab', 'Drama Room', 'Computer Hall', 'Language Lab', 'Audio Room', 'Craft Room Six', ' Assembly Hall'].map(s => s.trim());
      const fixes = isG2
        ? ['reserve the adjacent lounge and move the chairs', 'borrow a portable projector from the IT counter', 'open the partition wall to expand the seating', 'switch to printed handouts instead of slides', 'delay the opening remarks by twenty minutes']
        : ['move our session to the second-floor room', 'borrow a spare cable from the staff office', 'bring ten folding chairs from the hallway', 'share textbooks in pairs for today', 'start with the group discussion first'];
      const rm = rooms[r - 1];
      const fx = fixes[(r - 1) % 5];
      return {
        l1: `I just checked ${rm}, ${f}, and the air conditioning unit is making a loud noise.`,
        l2: `Really, ${m}? Our guests are arriving in half an hour. Did maintenance say they can fix it right away?`,
        l3: `They need two hours for repairs, so I decided we should ${fx}.`,
        l4: `That makes sense. Let's put a notice on the door right now.`,
        ja: `${rm}の空調に不具合があり修理に2時間かかるため、「${fx}」という対応を取ることになった。`,
        prompt: `What did ${who1} decide they should do?`,
        correct: fx[0].toUpperCase() + fx.slice(1) + '.',
        cReason: `so I decided we should ${fx} と述べ、相手も賛成している。`,
        wrongs: [
          'Postpone the event until next month.',
          'Wait two hours inside the noisy room.',
          'Repair the air conditioner themselves.',
        ],
        wReasons: [
          'イベントを来月まで延期するとは述べていない。',
          '騒音のある部屋で2時間待つのではなく別対応を選んでいる。',
          '自分たちで空調を修理するとは言っていない。',
        ],
        exp: `修理に2時間かかることを受けた so I decided we should ${fx} を聞き取る。`,
        ev: `we should ${fx}`,
      };
    },
  },
  // 2: 申込・契約条件の確認
  {
    skill: '会話：条件',
    build: (r, isG2, _m, _f, _who1, who2) => {
      const services = isG2
        ? ['municipal fitness pass', 'annual museum membership', 'commuter bike locker', 'evening pottery course', 'shared coworking desk', 'botanical society card', 'weekend tennis club', 'online language program', 'orchestra season pass', 'community garden plot', 'swimming lap membership', 'local archive reader card', 'studio rental plan', 'culinary workshop series', 'astronomy club pass']
        : ['student gym pass', 'summer swimming card', ' weekend bus pass', 'youth choir club', 'beginner guitar course', 'library study pass', 'tennis court card', 'cooking club plan', 'art museum youth pass', 'skating rink ticket', 'cycling club membership', 'science dome pass', 'book club subscription', 'badminton league', 'camping gear rental'].map(s => s.trim());
      const reqs = isG2
        ? ['submit proof of local residence', 'attend a fifteen-minute safety orientation', 'pay a refundable key deposit in cash', 'register a bank account for monthly billing', 'bring two passport-sized photographs']
        : ['bring a parent\'s signature on the form', 'watch a ten-minute safety video first', 'show a valid student ID card at the desk', 'buy indoor shoes with white soles', 'pay the material fee before Friday'];
      const sv = services[r - 1];
      const rq = reqs[(r - 1) % 5];
      return {
        l1: `Hello, I would like to sign up for the ${sv} starting next week.`,
        l2: `Certainly! Have you already filled out the online application form?`,
        l3: `Yes, I submitted it last night. Can I receive my card right away?`,
        l4: `Almost—before we issue the card, you need to ${rq}.`,
        ja: `${sv}の申込手続き。オンライン申請は済んでいるが、カード発行の前に「${rq}」が必要だと案内されている。`,
        prompt: `What must the applicant do before receiving the card?`,
        correct: rq[0].toUpperCase() + rq.slice(1) + '.',
        cReason: `before we issue the card, you need to ${rq} と必要条件が明示されている。`,
        wrongs: [
          'Fill out the online form again.',
          'Wait three weeks for mail delivery.',
          'Take a written level placement test.',
        ],
        wReasons: [
          'オンライン申請は昨夜提出済みであり、再提出は求められていない。',
          '郵送で3週間待つという説明は出ていない。',
          '筆記のレベル分けテストを受けるという条件もない。',
        ],
        exp: `before we issue the card, you need to ${rq} の条件表現を聞き取る（案内役：${who2}）。`,
        ev: `you need to ${rq}`,
      };
    },
  },
  // 3: 相手の意図・含意の把握
  {
    skill: '会話：意図',
    build: (r, isG2, m, f, _who1, who2) => {
      const topics = isG2
        ? ['renting a larger booth at the trade show', 'printing full-color catalogs for all visitors', 'hiring an external catering company', 'extending store hours until ten at night', 'ordering three hundred souvenir mugs']
        : ['buying professional lighting for our school play', 'making matching jackets for thirty members', 'renting a charter bus for a short trip', 'ordering custom medals from overseas', 'printing hardcover albums for the club'];
      const concerns = isG2
        ? ['it exceeds the remaining quarterly budget', 'delivery will not make it before the opening day', 'most attendees prefer digital brochures now', 'staff members are already working overtime', 'storage space in the back office is full']
        : ['our club budget cannot cover that cost', 'the items will not arrive before Festival Day', 'most students read notices on their phones', 'everyone is busy with final exams next week', 'there is no space left in our club locker'];
      const tp = topics[(r - 1) % 5];
      const cn = concerns[(r + 1) % 5];
      return {
        l1: `${f}, For project number ${r}, what do you think about ${tp}?`,
        l2: `Well, ${m}, it sounds impressive on paper, but have you looked at the practical side?`,
        l3: `Do you think the committee will reject the idea?`,
        l4: `Honestly, yes, mainly because ${cn}.`,
        ja: `${tp}という提案に対し、相手は「${cn}」という理由から慎重・否定的な見方を示している。`,
        prompt: `Why is ${who2} hesitant about the idea?`,
        correct: `Because ${cn}.`,
        cReason: `Honestly, yes, mainly because ${cn}. と懸念の理由を直接述べている。`,
        wrongs: [
          'Because the event was canceled yesterday.',
          'Because another team already did the same thing.',
          'Because the venue banned all visitors.',
        ],
        wReasons: [
          'イベントが昨日中止になったとは述べられていない。',
          '別チームがすでに同じことをしたという話は出ていない。',
          '会場が来場者を全面禁止したという事実もない。',
        ],
        exp: `mainly because ${cn} の否定・懸念の根拠を聞き取る。`,
        ev: `mainly because ${cn}`,
      };
    },
  },
  // 4: 交通・旅行のトラブル解決
  {
    skill: '会話：交渉',
    build: (r, isG2, _m, _f, who1) => {
      const dests = ['Sapporo', 'Fukuoka', 'Sendai', 'Hiroshima', 'Kanazawa', 'Takamatsu', 'Matsuyama', 'Kagoshima', 'Niigata', 'Nagano', 'Toyama', 'Okayama', 'Kumamoto', 'Hakodate', 'Miyazaki'];
      const solutions = isG2
        ? ['switch to the four twenty express at no extra charge', 'board the highway coach departing from Gate Seven', 'take the bullet train via the central hub station', 'keep the current seat on the delayed flight and get a meal voucher', 'rebook onto tomorrow\'s early morning departure']
        : ['take the four twenty rapid train instead', 'use the airport bus from Stop Three', 'change trains at Central Junction', 'wait in the lounge with a free drink ticket', 'travel on the first train tomorrow morning'];
      const dst = dests[r - 1];
      const sol = solutions[(r - 1) % 5];
      return {
        l1: `Excuse me, I have a ticket to ${dst}, but the board says my departure is delayed by ninety minutes.`,
        l2: `We sincerely apologize. Fog near the coast is slowing down incoming traffic today.`,
        l3: `I have a family dinner tonight. What is the fastest option you can offer me?`,
        l4: `If you hand me your ticket, you can ${sol}.`,
        ja: `${dst}行きの便が濃霧で90分遅れているため、係員から最善策として「${sol}」という案内を受けた。`,
        prompt: `What option is offered to ${who1}?`,
        correct: sol[0].toUpperCase() + sol.slice(1) + '.',
        cReason: `you can ${sol} と具体的な代替手段が提示されている。`,
        wrongs: [
          'Rent a private car for free.',
          'Receive double the ticket price in cash.',
          'Ride in the staff cabin immediately.',
        ],
        wReasons: [
          '無料でレンタカーを借りられるという案内はされていない。',
          '運賃の2倍を現金で返金するとは言っていない。',
          '乗務員室にすぐ乗れるという話も出ていない。',
        ],
        exp: `What is the fastest option ...? に対する回答 you can ${sol} を聞き取る。`,
        ev: `you can ${sol}`,
      };
    },
  },
  // 5: 比較・購入決定
  {
    skill: '会話：比較',
    build: (r, isG2, m, f, who1) => {
      const products = isG2
        ? ['ergonomic office chair', 'cordless vacuum cleaner', 'induction rice cooker', 'noise-canceling headset', 'compact air purifier', 'adjustable standing desk', 'espresso coffee maker', 'portable document scanner', 'waterproof hiking pack', 'LED reading lamp', 'stainless thermal pot', 'digital kitchen scale', 'folding commuter bike', 'ceramic space heater', 'smart fitness watch']
        : ['study desk lamp', 'lightweight hair dryer', 'insulated lunch jar', 'wireless earphones', 'compact blender', 'folding study table', 'electric kettle', 'portable speaker', 'daypack for hiking', 'bedside alarm clock', 'stainless water jug', 'digital timer', 'commuter backpack', 'mini desk fan', 'sports wristwatch'];
      const reasons = isG2
        ? ['it comes with a three-year free repair warranty', 'its replacement filters cost half as much', 'it weighs forty percent less than the older model', 'it uses thirty percent less electricity each month', 'its battery lasts twice as long on a single charge']
        : ['it comes with a two-year free warranty', 'its spare parts are easy to buy nearby', 'it is much lighter to carry every day', 'it uses very little electricity', 'its battery lasts sixteen hours'];
      const prd = products[r - 1];
      const rsn = reasons[(r - 1) % 5];
      return {
        l1: `Look at these two models of ${prd}, ${f}. Model X is slightly cheaper than Model Y.`,
        l2: `True, ${m}, but look closely at the specification card below Model Y.`,
        l3: `Oh, I see! Model Y is a better long-term value because ${rsn}.`,
        l4: `Exactly. I will take Model Y to the cashier now.`,
        ja: `${prd}の2機種を比較し、わずかに高いモデルYのほうが「${rsn}」という点で長期的にお得だと判断している。`,
        prompt: `Why did ${who1} and ${f} prefer Model Y?`,
        correct: `Because ${rsn}.`,
        cReason: `Model Y is a better long-term value because ${rsn}. と決め手を述べている。`,
        wrongs: [
          'Because Model Y had a lower price tag.',
          'Because Model X was completely out of stock.',
          'Because a famous actor designed Model Y.',
        ],
        wReasons: [
          '価格自体はモデルXのほうが少し安い（Model X is slightly cheaper）と述べられている。',
          'モデルXが在庫切れだとは言っていない。',
          '有名な俳優がデザインしたという話は出てこない。',
        ],
        exp: `価格の安さ（Model X）に惑わされず、Model Y を選んだ理由 because ${rsn} を聞き取る。`,
        ev: `because ${rsn}`,
      };
    },
  },
  // 6: 学業・職場でのフィードバック修正
  {
    skill: '会話：依頼',
    build: (r, isG2, m, f, who1) => {
      const drafts = isG2
        ? ['marketing survey report', 'environmental science paper', 'new employee handbook', 'museum audio guide script', 'community grant proposal', 'product launch press release', 'internship evaluation form', 'tourism brochure translation', 'annual safety manual', 'customer feedback summary', 'library renovation plan', 'volunteer training guide', 'campus magazine feature', 'nutrition lecture slides', 'regional transport study']
        : ['history presentation slides', 'book review essay', 'club recruitment poster', 'science fair summary', 'school newspaper article', 'English speech draft', 'field trip guidebook', 'cooking recipe booklet', 'recycle campaign flyer', 'choir concert program', 'reading survey report', 'health week poster', 'exchange welcome guide', 'career interview notes', 'sports day pamphlet'];
      const edits = isG2
        ? ['add a clear bar graph comparing the last three years', 'shorten the introduction to one concise paragraph', 'include specific sources at the bottom of page two', 'replace technical jargon with everyday expressions', 'double-check the percentage totals in Table One']
        : ['add two photos to make the main point clearer', 'make the opening paragraph shorter and simpler', 'write the book titles in alphabetical order', 'use larger font sizes for the main headings', 'check the spelling of all place names again'];
      const dr = drafts[r - 1];
      const ed = edits[(r - 1) % 5];
      return {
        l1: `Thank you for reading my ${dr}, ${f}. Do I need to rewrite the conclusion?`,
        l2: `Your conclusion is very clear, ${m}, so keep it just as it is.`,
        l3: `That is a relief! Is there anything I should revise before submitting it?`,
        l4: `Just one thing—please ${ed}.`,
        ja: `${dr}の原稿確認。結論部分は書き直す必要がなく、提出前に1点だけ「${ed}」を行うよう求められた。`,
        prompt: `What should ${who1} do before submitting the ${dr}?`,
        correct: ed[0].toUpperCase() + ed.slice(1) + '.',
        cReason: `Just one thing—please ${ed}. と修正すべき唯一の箇所が指示されている。`,
        wrongs: [
          'Rewrite the entire conclusion from scratch.',
          'Change the topic to something completely new.',
          'Submit it next month instead of this week.',
        ],
        wReasons: [
          '結論は明確なのでそのままでよい（keep it just as it is）と言われている。',
          'テーマを全面変更するようには言われていない。',
          '提出を来月に延ばすという話も出ていない。',
        ],
        exp: `結論の書き直しは不要と否定されたあとの please ${ed} を聞き取る。`,
        ev: `please ${ed}`,
      };
    },
  },
  // 7: イベント・講座の感想と評価
  {
    skill: '会話：評価',
    build: (r, isG2, m, f, _who1, who2) => {
      const events = isG2
        ? ['urban gardening seminar', 'astronomy night lecture', 'modern architecture tour', 'artisan bread workshop', 'documentary film screening', 'wildlife photography talk', 'classical chamber concert', 'fermentation cooking class', 'renewable energy forum', 'traditional dyeing studio', 'local history symposium', 'botanical illustration class', 'marine conservation talk', 'jazz improvisation clinic', 'ceramic glaze workshop']
        : ['weekend baking class', 'star-watching event', 'old town walking tour', 'comic drawing workshop', 'nature documentary show', 'animal photo seminar', 'brass band concert', 'pasta making lesson', 'clean energy talk', 'tie-dye shirt class', 'castle history lecture', 'flower sketching class', 'ocean life workshop', 'guitar rhythm clinic', 'clay cup workshop'];
      const praises = isG2
        ? ['the hands-on demonstration at the end was really practical', 'the speaker answered tough questions with clear examples', 'the small group size allowed everyone to get feedback', 'the printed reference guide will be useful at home', 'seeing real historical tools up close was fascinating']
        : ['practicing in small groups made it easy to learn', 'the instructor explained each step with humor', 'everyone got to try the equipment personally', 'the illustrated recipe card is easy to follow at home', 'seeing real samples up close was unforgettable'];
      const ev = events[r - 1];
      const pr = praises[(r - 1) % 5];
      return {
        l1: `How did you find yesterday's ${ev}, ${f}? Was the venue hard to locate?`,
        l2: `Actually, ${m}, the venue was a ten-minute walk in the rain, which was tiring.`,
        l3: `Oh, so do you regret going?`,
        l4: `Not at all! I was really glad I went because ${pr}.`,
        ja: `昨日の${ev}は雨の中会場まで10分歩いて大変だったが、「${pr}」ため参加して本当に良かったと評価している。`,
        prompt: `Why was ${who2} glad about attending the ${ev}?`,
        correct: `Because ${pr}.`,
        cReason: `I was really glad I went because ${pr}. と満足した理由を明言している。`,
        wrongs: [
          'Because the venue was right inside the station.',
          'Because admission tickets were refunded in full.',
          'Because lunch was served free of charge.',
        ],
        wReasons: [
          '会場は雨の中10分歩いたと述べており、駅直結ではない。',
          '参加費が全額返金されたという事実はない。',
          '無料の昼食が出たという話も登場しない。',
        ],
        exp: `道中の苦労（rain）と最終的な高評価（because ${pr}）の対比を聞き取る。`,
        ev: `because ${pr}`,
      };
    },
  },
  // 8: スケジュール調整・いつ会うか
  {
    skill: '会話：条件',
    build: (r, _isG2, m, f) => {
      const slots = [
        ['Thursday at four thirty', 'Wednesday afternoon', 'Friday morning', 'Saturday evening'],
        ['Friday at one fifteen', 'Tuesday noon', 'Wednesday evening', 'Thursday morning'],
        ['Tuesday at five o\'clock', 'Monday morning', 'Thursday noon', 'Friday afternoon'],
        ['Wednesday at eleven thirty', 'Monday afternoon', 'Tuesday morning', 'Friday evening'],
        ['Monday at three forty-five', 'Wednesday noon', 'Thursday afternoon', 'Saturday morning'],
      ];
      const [ans, w1, w2, w3] = slots[(r - 1) % 5];
      const purposes = ['rehearse our joint presentation', 'review the budget figures', 'select photos for the exhibition', 'test the audio recording gear', 'plan the welcome reception', 'check the translation draft', 'organize the charity booth', 'prepare the lab equipment', 'update the club website', 'sort the donated books', 'practice the interview questions', 'design the event banner', 'compile the survey answers', 'inspect the stage props', 'finalize the camp menu'];
      const purp = purposes[r - 1];
      return {
        l1: `Hi ${f}, we need an hour this week to ${purp}. Are you free ${w1}?`,
        l2: `Sorry ${m}, I have a shift at the bookstore ${w1}. How about ${w2}?`,
        l3: `I have a seminar ${w2}, so that will not work either. What about ${ans}?`,
        l4: `Let me check my planner... Yes, ${ans} is wide open! Let's meet then.`,
        ja: `${purp}のための日程調整。最初の2候補は互いの予定で合わず、最終的に「${ans}」で合意した。`,
        prompt: 'When will the speakers meet?',
        correct: `On ${ans}.`,
        cReason: `What about ${ans}? に対し Yes, ${ans} is wide open! Let's meet then. と確定している。`,
        wrongs: [`On ${w1}.`, `On ${w2}.`, `On ${w3}.`],
        wReasons: [
          `${w1} は書店のシフトがあるため断られている。`,
          `${w2} はセミナーがあるため都合がつかなかった。`,
          `${w3} は会話の中で一度も候補に出ていない。`,
        ],
        exp: `2度却下された候補日時を除外し、最後に合意した ${ans} を聞き取る。`,
        ev: `${ans} is wide open`,
      };
    },
  },
  // 9: 住居・施設・アルバイトの問い合わせ
  {
    skill: '会話：問題点',
    build: (r, isG2, _m, _f, who1) => {
      const places = isG2
        ? ['sunlit studio apartment', 'second-floor music practice room', 'weekend farmers\' market stall', 'shared pottery workshop', 'station bicycle parking lot', 'community language classroom', 'harbor kayak storage locker', 'rooftop gardening plot', 'downtown coworking booth', 'campus bookstore part-time job', 'civic theater rehearsal hall', 'botanical cafe patio', 'neighborhood cooking studio', 'university research archive', 'sports complex locker plan']
        : ['weekend bakery helper job', 'after-school tutoring desk', 'park tennis court slot', 'music studio practice booth', 'community pool lane', 'summer camp counselor role', 'library reading booth', 'bicycle rental monthly plan', 'youth art gallery wall', 'station locker subscription', 'flower shop weekend shift', 'school festival food stall', 'badminton hall booking', 'local radio student corner', 'pet shelter volunteer shift'];
      const catches = isG2
        ? ['the elevator will be out of service for two weeks next month', 'parking spaces are currently full with a waiting list', 'electricity fees are billed separately from the base rent', 'weekend access requires booking forty-eight hours ahead', 'loud instruments are permitted only until seven p.m.']
        : ['training sessions are held on Sunday mornings at eight', 'you have to bring your own black apron and cap', 'bookings can only be made up to three days in advance', 'the locker area closes promptly at six thirty', 'shifts during exam weeks must be swapped a week early'];
      const pl = places[r - 1];
      const ct = catches[(r - 1) % 5];
      return {
        l1: `Hello, I am inquiring about the ${pl} advertised on your website.`,
        l2: `Thank you for your interest! All the basic conditions on the webpage are still available.`,
        l3: `Wonderful. Is there anything important I should know before I apply today?`,
        l4: `Yes, please keep in mind that ${ct}.`,
        ja: `${pl}への申し込み前に知っておくべき注意点として、「${ct}」と説明を受けている。`,
        prompt: `What is ${who1} told to keep in mind?`,
        correct: ct[0].toUpperCase() + ct.slice(1) + '.',
        cReason: `please keep in mind that ${ct} と注意点として明示されている。`,
        wrongs: [
          'Applications closed two days ago.',
          'The monthly fee doubled this morning.',
          'Only people over forty may apply.',
        ],
        wReasons: [
          '募集はまだ空いている（still available）と述べられている。',
          '今朝料金が2倍になったという話は一切ない。',
          '40歳以上限定という年齢制限も出てこない。',
        ],
        exp: `please keep in mind that ... に続く留意条件を正確に聞き取る。`,
        ev: `keep in mind that ${ct}`,
      };
    },
  },
  // 10: 体調・健康習慣へのアドバイス
  {
    skill: '会話：意図',
    build: (r, isG2, m, f, who1, who2) => {
      const symptoms = ['stiff shoulders from computer work', 'trouble falling asleep before midnight', 'tired eyes after reading small print', 'low energy in the late afternoon', 'sore knees after jogging on pavement'];
      const tips = isG2
        ? ['raise the monitor to eye level and stretch hourly', 'avoid bright phone screens an hour before bed', 'use warmer room lighting and rest every thirty minutes', 'eat a handful of nuts instead of sugary snacks', 'switch to cushioned trail paths in the park']
        : ['stand up and roll his or her shoulders every hour', 'drink warm herbal tea instead of coffee at night', 'look at distant trees for one minute every half hour', 'take a brisk ten-minute walk outside after lunch', 'do five minutes of slow stretching before running'];
      const sym = symptoms[(r - 1) % 5];
      const rawTip = tips[(r - 1) % 5];
      const tip = rawTip.replace('his or her', who1 === 'the man' ? 'his' : 'her');
      const days = ['lately', 'this month', 'since April', 'this term', 'for two weeks', 'all week', 'since Monday', 'recently', 'these days', 'this season', 'since autumn', 'this quarter', 'for ten days', 'since summer', 'all semester'];
      return {
        l1: `I have been having ${sym} ${days[r - 1]}, ${f}.`,
        l2: `I used to have the exact same problem last year, ${m}!`,
        l3: `Really? Did you take medicine or visit a specialist?`,
        l4: `Neither—my doctor simply told me to ${rawTip.replace('his or her', 'my')}, and it helped within a week.`,
        ja: `${sym}に悩む話者に対し、相手は自分の経験から「${tip}」という医師のアドバイスが効果的だったと伝えている。`,
        prompt: `What worked well for ${who2} last year?`,
        correct: `Choosing to ${tip.replace(/\b(his|her)\b/, 'one\'s')}.`.replace('Choosing to ', '').replace(/^(.)/, c => c.toUpperCase()),
        cReason: `told me to ... and it helped within a week と実際に効果があった習慣を述べている。`,
        wrongs: [
          'Taking strong medicine twice a day.',
          'Having surgery at a city hospital.',
          'Quitting all exercise for six months.',
        ],
        wReasons: [
          '薬は飲んでいない（Neither）と明確に否定している。',
          '市立病院で手術を受けたという話は出ていない。',
          '半年間すべての運動をやめたとも言っていない。',
        ],
        exp: `Neither で薬や専門医通いを否定した後の told me to ... を聞き取る。`,
        ev: 'helped within a week',
      };
    },
  },
  // 11〜15: さらに5種類の独立会話パターン
  {
    skill: '会話：比較',
    build: (r, isG2, m, f, who1) => {
      const gifts = isG2
        ? ['an insulated stainless tumbler', 'a botanical hand-cream set', 'a hardcover recipe collection', 'a wooden desk calendar', 'a box of single-origin tea']
        : ['a set of colored brush pens', 'a cozy fleece blanket', 'a canvas book pouch', 'a ceramic soup mug', 'a desktop mini plant'];
      const gf = gifts[(r - 1) % 5];
      const occasions = ['Ms. Toda\'s farewell gift', 'Coach Sato\'s birthday', 'our host family\'s present', 'the graduation gift', 'Uncle Ken\'s retirement', 'Aunt Rika\'s housewarming', 'our club advisor\'s thank-you gift', 'Sister Mei\'s promotion', 'Grandpa\'s seventy-fifth birthday', 'Mr. Lin\'s welcome gift', 'our team captain\'s prize', 'Dr. Ono\'s appreciation gift', 'Cousin Yui\'s wedding gift', 'Ms. Bell\'s winter gift', 'Brother Sho\'s college gift'];
      const occ = occasions[r - 1];
      return {
        l1: `We collected four thousand yen for ${occ}, ${f}. Should we buy a fresh flower bouquet?`,
        l2: `Flowers are nice, ${m}, but the recipient is traveling for five days starting Saturday.`,
        l3: `Good point—flowers would wilt while nobody is home. What should we get instead?`,
        l4: `How about ${gf}? It is practical and easy to pack.`,
        ja: `${occ}の品選び。土曜から5日間旅行で不在のため生花は避け、「${gf}」を贈る提案が出された。`,
        prompt: `Why did they decide against buying fresh flowers, or what was suggested instead? What did ${f} suggest buying?`,
        correct: gf[0].toUpperCase() + gf.slice(1) + '.',
        cReason: `How about ${gf}? It is practical and easy to pack. と代替案を提案している。`,
        wrongs: ['A fresh flower bouquet.', 'A large glass aquarium.', 'A frozen ice cream cake.'],
        wReasons: [
          '生花は5日間の旅行中にしおれてしまうため見送られた。',
          '大きなガラス水槽は提案されていない。',
          'アイスクリームケーキについても会話に出てこない。',
        ],
        exp: `旅行中で生花がダメな理由を押さえ、代替提案 How about ${gf}? を聞き取る（確認者：${who1}）。`,
        ev: `How about ${gf}`,
      };
    },
  },
  {
    skill: '会話：問題点',
    build: (r, isG2, _m, _f, who1) => {
      const mistakes = isG2
        ? ['printed last year\'s ticket prices on the poster', 'entered the wrong room number in the invitation email', 'ordered vegetarian meals for Tuesday instead of Wednesday', 'booked twenty seats instead of thirty on the bus', 'listed the old phone number on the brochure']
        : ['wrote two o\'clock instead of three on the flyer', 'left out the map on the back of the handout', 'ordered ten pizzas instead of fifteen for the party', 'sent the club schedule to Class A instead of Class B', 'forgot to reserve the gymnasium scoreboard'];
      const fixes = isG2
        ? ['send a correction email to all registered guests immediately', 'print small correction stickers to place over the old line', 'call the catering manager before noon to change the date', 'request an additional minibus from the transport desk', 'update the website banner and inform reception staff']
        : ['put corrected flyers on every classroom board today', 'hand out separate map sheets at the entrance', 'call the pizza shop right now to add five more', 'forward the schedule to Class B during lunch break', 'ask the PE teacher if the scoreboard is still free'];
      const idx = (r - 1) % 5;
      const tags = ['Oh dear,', 'Wait a minute,', 'Hold everything,', 'Uh-oh,', 'Look at this,', 'Goodness,', 'Just a second,', 'Hey look,', 'Oh no,', 'Wait here,', 'Listen closely,', 'Check page one,', 'Look at line two,', 'Stop the press,', 'Quick check:'];
      return {
        l1: `${tags[r - 1]} I just noticed a mistake—I ${mistakes[idx]}!`,
        l2: `Calm down! There is still time to fix it before anyone gets confused.`,
        l3: `What is the quickest way to handle this right now?`,
        l4: `You should ${fixes[idx]}. I will help you!`,
        ja: `手違い（${mistakes[idx]}）に気づき、すぐに「${fixes[idx]}」という対処を行うことになった。`,
        prompt: `What is ${who1} advised to do right now?`,
        correct: fixes[idx][0].toUpperCase() + fixes[idx].slice(1) + '.',
        cReason: `You should ${fixes[idx]}. と今すぐ取るべき解決策が提示されている。`,
        wrongs: [
          'Hide the mistake and say nothing.',
          'Cancel the whole program for the year.',
          'Buy new computers for the office.',
        ],
        wReasons: [
          'ミスを隠して黙っているようには言われていない。',
          '年間の全プログラムを中止するという話ではない。',
          '新しいパソコンを購入するという内容も無関係である。',
        ],
        exp: `ミス発覚後の具体的なリカバリー策 You should ${fixes[idx]} を聞き取る。`,
        ev: `You should ${fixes[idx]}`,
      };
    },
  },
  {
    skill: '会話：含意',
    build: (r, isG2, m, f, _who1, who2) => {
      const hobbies = isG2
        ? ['restoring vintage wooden clocks', 'growing bonsai trees on the balcony', 'translating nineteenth-century short stories', 'photographing nocturnal forest birds', 'baking sourdough rye bread from scratch']
        : ['building miniature wooden ships', 'learning classical Spanish guitar', 'growing cherry tomatoes from seeds', 'painting watercolor postcards', 'jogging five kilometers before breakfast'];
      const outcomes = isG2
        ? ['it taught patience and Careful attention to tiny details', 'neighbors started asking to buy loaves every Saturday', 'a local magazine asked to publish three of the works', 'it became a great way to make friends across generations', 'museum staff invited the club to hold a weekend display']
        : ['it helped improve concentration during school exams', 'family members look forward to fresh samples every weekend', 'the art teacher displayed two pieces in the entrance hall', 'several classmates asked to practice together after school', 'waking up early every morning became effortless'];
      const hb = hobbies[(r - 1) % 5];
      const out = outcomes[(r - 1) % 5].replace('Careful', 'careful');
      const spans = ['six months', 'one year', 'eight months', 'two years', 'ten months', 'fourteen months', 'nine months', 'three terms', 'seven months', 'fifteen months', 'eleven months', 'five months', 'eighteen months', 'four terms', 'sixteen months'];
      return {
        l1: `You have been ${hb} for ${spans[r - 1]} now, ${f}. Has it been hard to keep up?`,
        l2: `At first my hands were clumsy, ${m}, and I made plenty of mistakes.`,
        l3: `What made you continue instead of quitting?`,
        l4: `Unexpectedly, ${out}, so it has been really rewarding.`,
        ja: `${spans[r - 1]}続けている「${hb}」について、最初は失敗もあったが「${out}」ため大きなやりがいを感じている。`,
        prompt: `What unexpected benefit did ${who2} experience?`,
        correct: out[0].toUpperCase() + out.slice(1) + '.',
        cReason: `Unexpectedly, ${out} と継続して得られた予想外の良さを述べている。`,
        wrongs: [
          'Winning a million-yen cash lottery.',
          'Moving to an apartment in Paris.',
          'Becoming a television news anchor.',
        ],
        wReasons: [
          '100万円の宝くじに当たったという話は出てこない。',
          'パリのアパートに引っ越したとも述べていない。',
          'テレビのニュースキャスターになったという事実もない。',
        ],
        exp: `Unexpectedly, ${out} の具体的な成果・メリットを聞き取る。`,
        ev: `Unexpectedly, ${out}`,
      };
    },
  },
  {
    skill: '会話：依頼',
    build: (r, _isG2, m, f, who1) => {
      const errands = [
        ['pick up the dry cleaning before six', 'drop this parcel at the post office', 'buy batteries at the hardware store', 'return two DVDs to the rental shop', 'get fresh milk and eggs at the market'],
        ['collect the printed posters from Copy Mart', 'bring a box of chalk from the office', 'check whether the gym doors are locked', 'carry the music stands to Room Three', 'hand the attendance sheet to Mr. Oda'],
        ['water the cucumber plants in the yard', 'bring in the laundry before evening', 'feed the goldfish in the living room', 'put the trash bags out by eight', 'close the upstairs shutters tightly'],
      ];
      const group = errands[(r - 1) % 3];
      const ans = group[r % 5];
      const w1 = group[(r + 1) % 5];
      const w2 = group[(r + 2) % 5];
      const w3 = group[(r + 3) % 5];
      return {
        l1: `I am heading out for my shift in round-hour ${r}, ${f}—actually, I leave in ten minutes. Did you already ${w1}?`.replace(`for my shift in round-hour ${r}, `, `now at step ${r === 1 ? 'four' : 'five'}, `).replace(`at step ${r === 1 ? 'four' : 'five'}, `, ''),
        l2: `Yes, ${m}, I already took care of that twenty minutes ago.`,
        l3: `Great! Is there anything else you need me to do on my way?`,
        l4: `Could you ${ans}? I cannot leave the house right now.`,
        ja: `すで終わった用事を確認したあと、外出ついでに「${ans}」を頼まれている。`,
        prompt: `What is ${who1} asked to do on the way out?`,
        correct: ans[0].toUpperCase() + ans.slice(1) + '.',
        cReason: `Could you ${ans}? とこれから外出する相手に依頼している。`,
        wrongs: [
          w1[0].toUpperCase() + w1.slice(1) + '.',
          w2[0].toUpperCase() + w2.slice(1) + '.',
          w3[0].toUpperCase() + w3.slice(1) + '.',
        ],
        wReasons: [
          `${w1} は20分前にすでに済ませた（already took care of that）と述べられている。`,
          `${w2} は会話に登場しない用事である。`,
          `${w3} も依頼されていない内容である。`,
        ],
        exp: `すでに完了した用事と、これから頼まれた Could you ${ans}? を区別する。`,
        ev: `Could you ${ans}`,
      };
    },
  },
  {
    skill: '総合',
    build: (r, isG2, m, f, _who1, who2) => {
      const destinations = isG2
        ? ['the Maritime Heritage Museum', 'the Highland Botanical Center', 'the Regional Contemporary Gallery', 'the Valley Astronomical Park', 'the Historic Silk Mill']
        : ['the City Science Pavilion', 'the Harbor Aquarium Annex', 'the Maple Folk Village', 'the Greenhill Zoo', 'the Sunset Observation Tower'];
      const reasons = [
        ['the main exhibition floor is closed for lighting upgrades today', 'メイン展示階が本日照明工事で閉まっている'],
        ['all afternoon guided tours are fully booked by school groups', '午後のガイドツアーが団体予約で満席になっている'],
        ['the shuttle road is closed for a local marathon until four', 'マラソン大会で4時までシャトル道路が通行止め'],
        ['special discount tickets are valid starting tomorrow, not today', '特別割引券が今日ではなく明日から有効になる'],
        ['heavy mist is blocking the entire panoramic view right now', '濃霧でいま展望がまったく見えない'],
      ];
      const dst = destinations[(r - 1) % 5];
      const [rsnEn, rsnJa] = reasons[(r + 2) % 5];
      const days = ['Saturday', 'Sunday', 'Friday', 'holiday Monday', 'Wednesday', 'Thursday', 'Tuesday', 'this morning', 'this afternoon', 'today at noon', 'on day two', 'this sunny morning', 'after breakfast', 'before noon', 'right after lunch'];
      return {
        l1: `Shall we head over to ${dst} ${days[r - 1]}, ${f}?`,
        l2: `Wait a second, ${m}—I just checked their official social media page.`,
        l3: `Is something going on there right now?`,
        l4: `Yes, it says ${rsnEn}, so let's go tomorrow instead!`,
        ja: `${dst}へ行く計画だったが、公式ページの案内で「${rsnJa}」と判明したため、明日へ延期することにした。`,
        prompt: `Why does ${who2} suggest going tomorrow instead?`,
        correct: `Because ${rsnEn}.`,
        cReason: `it says ${rsnEn}, so let's go tomorrow instead! と理由を明確に述べている。`,
        wrongs: [
          'Because Admission fees permanently tripled.',
          'Because neither of them brought walking shoes.',
          'Because the facility moved to another prefecture.',
        ].map(s => s.replace('Admission', 'admission')) as [string, string, string],
        wReasons: [
          '入館料が恒久的に3倍になったという話は出ていない。',
          '歩きやすい靴を持ってこなかったという理由は述べられていない。',
          '施設が他県へ移転したという事実もない。',
        ],
        exp: `公式ページで確認した事実 it says ${rsnEn} を聞き取る。`,
        ev: `it says ${rsnEn}`,
      };
    },
  },
];

interface MidPassageSpec {
  skill: string;
  build: (round: number, isG2: boolean) => {
    text: string;
    ja: string;
    prompt: string;
    correct: string;
    cReason: string;
    wrongs: [string, string, string];
    wReasons: [string, string, string];
    exp: string;
    ev: string;
  };
}

const PASSAGE_LEADS_P2P = [
  'Welcome to Youth Science Digest.',
  'Good morning, listeners of Campus Update.',
  'Attention all passengers at the central terminal:',
  'Thank you for visiting our municipal museum today.',
  'In this week\'s health and lifestyle report,',
  'Hello everyone, and welcome to the orientation hall.',
  'Here is a community notice from the Green Park Committee:',
  'Good afternoon, shoppers at Harbor Plaza:',
  'Today in social studies, let us examine urban trends:',
  'Thank you for calling the Regional Sports Office:',
  'Welcome aboard the Morning Express tour bus:',
  'Listeners of Teen Book Corner, here is a highlight:',
  'Before we begin our factory tour, please listen carefully:',
  'In local agriculture news this autumn,',
  'May I have your attention in the library foyer:',
] as const;

const PASSAGE_LEADS_G2 = [
  'Good evening, and welcome to Economic Perspectives.',
  'In today\'s environmental research bulletin,',
  'Attention all delegates attending the annual symposium:',
  'Thank you for choosing Northern Railways this morning.',
  'On today\'s episode of Medical Innovation Weekly,',
  'Welcome to the audio tour of the National Art Wing.',
  'Here is a public announcement from the Water Bureau:',
  'In recent educational psychology findings,',
  'Good afternoon, staff members of the Logistics Division:',
  'Historians studying nineteenth-century port cities note that',
  'Thank you for calling the City Cultural Foundation:',
  'During the past decade, urban planners have observed that',
  'Welcome, volunteers, to the Coastal Conservation briefing:',
  'Consumer reports published this quarter indicate that',
  'Before entering the clean-room laboratory, please note:',
] as const;

const MID_PASSAGE_SPECS: readonly MidPassageSpec[] = [
  // 1: 都市・環境・科学の取り組み（原因と結果）
  {
    skill: '文：原因',
    build: (r, isG2) => {
      const lead = isG2 ? PASSAGE_LEADS_G2[r - 1] : PASSAGE_LEADS_P2P[r - 1];
      const cities = [' Meadowbrook', 'Silverport', 'Oakridge', 'Clearwater', 'Brookfield', 'Fairview', 'Pinehurst', 'Glenwood', 'Mapleton', 'Sunvale', 'crestview', 'Bridgewater', 'Stonehaven', 'Riverbend', ' Lakewood'].map(s => s.trim()[0].toUpperCase() + s.trim().slice(1));
      const measures = isG2
        ? [
            ['planted shade trees along bus corridors', 'pedestrian foot traffic rose by twenty-five percent in summer'],
            ['installed smart sensors on public trash bins', 'collection trucks cut fuel consumption by thirty percent'],
            ['converted abandoned rail tracks into bike paths', 'morning road congestion near schools dropped sharply'],
            ['offered rebates for rooftop rainwater tanks', 'storm drain overflow during heavy rain fell significantly'],
            ['replaced streetlights with warm-toned shielded LEDs', 'complaints about nighttime glare declined by half'],
          ]
        : [
            ['added free water refill stations in parks', 'plastic bottle litter in the parks dropped by half'],
            ['created car-free zones near elementary schools', 'more children began walking to school safely'],
            ['opened a tool-lending library at the civic hall', 'residents repaired furniture instead of throwing it away'],
            ['started a weekend compost collection booth', 'household food waste decreased noticeably across town'],
            ['introduced fifteen-minute electric shuttle buses', 'elderly residents visited downtown shops more often'],
          ];
      const [act, effect] = measures[(r - 1) % 5];
      const city = cities[r - 1];
      const text = `${lead} Two years ago, the city of ${city} ${act}. At first, some business owners wondered whether the project would justify its cost. However, a follow-up survey released this month revealed that ${effect}. Other municipalities are now studying ${city}'s model.`;
      return {
        text,
        ja: `2年前、${city}市は「${act}」を実施した。今月発表された追跡調査により、「${effect}」という成果が明らかになった。`,
        prompt: `What did the follow-up survey in ${city} reveal?`,
        correct: effect[0].toUpperCase() + effect.slice(1) + '.',
        cReason: `revealed that ${effect} と調査結果が明確に述べられている。`,
        wrongs: [
          'The project was canceled after three months.',
          'Local taxes doubled to pay for repairs.',
          'Population in the city fell by half.',
        ],
        wReasons: [
          '3か月で中止になったのではなく、他自治体が手本にするほど成功している。',
          '修理のために住民税が2倍になったとは述べられていない。',
          '人口が半減したという記述も本文にない。',
        ],
        exp: `However, a follow-up survey ... revealed that ${effect} の結果部分を聞き取る。`,
        ev: `revealed that ${effect}`,
      };
    },
  },
  // 2: 自然科学・動植物の研究（対比）
  {
    skill: '文：対比',
    build: (r, isG2) => {
      const lead = isG2 ? PASSAGE_LEADS_G2[(r + 1) % 15] : PASSAGE_LEADS_P2P[(r + 1) % 15];
      const studies = isG2
        ? [
            ['alpine wildflowers', 'turn their petals toward morning sunlight to warm visiting insects'],
            ['migrating shorebirds', 'sleep with one half of the brain awake during long ocean flights'],
            ['deep-rooting desert shrubs', 'share underground moisture with neighboring seedlings at night'],
            ['coral reef cleaner fish', 'recognize individual client fish even after several weeks'],
            ['forest fungi networks', 'transfer carbon nutrients between shaded and sunlit trees'],
          ]
        : [
            ['urban songbirds', 'sing at a slightly higher pitch to be heard over traffic noise'],
            ['tree frogs in tropical woods', 'adjust their skin brightness to match wet or dry bark'],
            ['bumblebees on windy hills', 'fly closer to the ground to save wing energy'],
            ['harbor seals in murky water', 'use sensitive whiskers to follow fish trails accurately'],
            ['squirrels in northern forests', 'sort nuts by type before burying them in separate spots'],
          ];
      const [subj, finding] = studies[(r - 1) % 5];
      const years = ['twenty nineteen', 'twenty twenty', 'twenty twenty-one', 'twenty twenty-two', 'twenty twenty-three', 'last autumn', 'last spring', 'early this year', 'two summers ago', 'three winters ago', 'recent field seasons', 'a five-year study', 'an island survey', 'a mountain survey', 'a coastal study'];
      const text = `${lead} Researchers observing ${subj} during ${years[r - 1]} made a surprising discovery. People used to assume their behavior was purely random. Careful camera recordings showed, however, that they ${finding}. This strategy significantly improves their survival rate.`;
      return {
        text,
        ja: `${subj}に関する研究。かつて行動は偶然と考えられていたが、記録映像により「${finding}」ことが判明した。`,
        prompt: `What did camera recordings show about ${subj}?`,
        correct: `They ${finding}.`,
        cReason: `showed, however, that they ${finding} と発見内容が述べられている。`,
        wrongs: [
          'They behave in a completely random way.',
          'They stop eating altogether during summer.',
          'They rely on humans to build their nests.',
        ],
        wReasons: [
          '偶然（purely random）というのは昔の思い込み（used to assume）であり否定されている。',
          '夏の間まったく食べなくなるという説明はない。',
          '巣作りを人間に頼るという内容も本文にない。',
        ],
        exp: `昔の通説（used to assume）と、実際の観察結果（showed, however, that they ${finding}）を対比して聞き取る。`,
        ev: `they ${finding}`,
      };
    },
  },
  // 3: 施設・工場・美術館見学の注意事項
  {
    skill: '文：目的',
    build: (r, isG2) => {
      const sites = isG2
        ? ['Precision Optics Plant', 'Historical Manuscript Vault', 'Botanical Seed Bank', 'Traditional Lacquer Studio', 'Solar Panel Testing Lab', 'Cheese Aging Cellar', 'Marine Watch Restoration Center', 'Silk Weaving Conservatory', 'Acoustic Instrument Factory', 'Ceramic Kiln Research Hall', 'Tea Processing Heritage Mill', 'Glass Lens Workshop', 'Paper Conservation Lab', 'Fermentation Science Center', 'Clockwork Heritage Gallery']
        : ['Sunrise Bread Factory', 'City Recycling Center', 'Chocolate Craft House', 'Newspaper Printing Plant', 'Noodle Making Museum', 'Ice Cream Factory', 'Toy Train Workshop', 'Juice Bottling Plant', 'Pottery Kiln Hall', 'Paper Mill Tour', 'Soy Sauce Brewery', 'Glass Bead Studio', 'Bicycle Assembly Plant', 'Tofu Making Kitchen', 'Candle Craft Barn'];
      const rules = isG2
        ? [
            ['store all bags and metal watches in the hallway lockers', 'prevent tiny scratches on optical surfaces'],
            ['wear the provided cotton shoe covers at all times', 'keep outside dust out of the temperature-controlled rooms'],
            ['turn off camera flashes and laser pointers completely', 'protect light-sensitive pigments from fading'],
            ['stay behind the yellow floor line during machine operation', 'avoid interfering with automated transport carts'],
            ['sanitize hands and remove rings before entering Zone B', 'maintain strict hygiene around open ingredients'],
          ]
        : [
            ['put hair nets over your caps before entering Hall One', 'keep the food preparation area clean'],
            ['leave pens and small clips in the locker trays', 'make sure nothing drops into the machines'],
            ['walk only on the green painted pathway', 'stay clear of forklifts carrying heavy boxes'],
            ['switch phones to silent mode without vibration', 'avoid startling the studio artisans at work'],
            ['hold the handrail when going down the observation stairs', 'stay safe on the polished steel steps'],
          ];
      const site = sites[r - 1];
      const [ruleEn, whyEn] = rules[(r - 1) % 5];
      const text = `Welcome to the ${site}! Our forty-minute guided tour will begin shortly. Before we open the double doors, all visitors are required to ${ruleEn}. We ask this in order to ${whyEn}. After the tour, free samples and brochures are available in the lobby.`;
      return {
        text,
        ja: `${site}の見学前の案内。「${whyEn}」という目的のため、入場前に全員「${ruleEn}」を行う必要がある。`,
        prompt: `What are visitors required to do before the tour begins?`,
        correct: ruleEn[0].toUpperCase() + ruleEn.slice(1) + '.',
        cReason: `all visitors are required to ${ruleEn} と入場前の必須事項が述べられている。`,
        wrongs: [
          'Pick up free samples before entering.',
          'Sign a two-year employment contract.',
          'Take photographs with a bright flash.',
        ],
        wReasons: [
          '試供品やパンフレットは見学後（After the tour）にロビーで配られる。',
          '雇用契約書に署名するという話は一切ない。',
          'フラッシュ撮影をするよう求められてはいない。',
        ],
        exp: `Before we open the double doors, all visitors are required to ${ruleEn} を聞き取る。`,
        ev: `required to ${ruleEn}`,
      };
    },
  },
  // 4: 歴史・文化・産業の変遷
  {
    skill: '文：過程',
    build: (r, isG2) => {
      const items = isG2
        ? [
            ['porcelain teacups in Harborvale', 'artisans discovered fine white clay along the northern cliffs', 'switched from wood kilns to clean gas kilns'],
            ['linen textiles in Windmere', 'cool misty summers helped flax plants grow tall and strong', 'partnered with young fashion designers in Tokyo'],
            ['handcrafted violins in Pinecrest', 'dense mountain spruce trees provided ideal soundboards', 'offered online repair consultations to orchestras'],
            ['sea-salt crystals in Sunbay', 'shallow tidal flats allowed rapid evaporation in spring', 'packaged seasoned blends for home cooks'],
            ['cedar bento boxes in Woodford', 'lumber workers needed lightweight containers that kept rice fresh', 'introduced dishwasher-safe natural coatings'],
          ]
        : [
            ['strawberry jam from Hilltown', 'cool nights made the local berries unusually sweet', 'started selling small gift jars at train stations'],
            ['wooden toys from Mapleville', 'carpenters used leftover beech wood from furniture making', 'opened a hands-on playroom for visiting families'],
            ['canvas backpacks from Portside', 'sailmakers used strong waterproof cloth left from boat sails', 'added padded laptop pockets for students'],
            ['washi lanterns from Riverfront', 'clear stream water produced bright and durable paper fibers', 'designed compact USB desk lamps for apartments'],
            ['apple cider from Orchardale', 'hillside orchards received plenty of autumn sunshine', 'launched a non-alcoholic sparkling version'],
          ];
      const [prod, origin, modern] = items[(r - 1) % 5];
      const centuries = ['Over a century ago,', 'In the late eighteen hundreds,', 'More than eighty years ago,', 'Generations ago,', 'Early in the twentieth century,', 'Ninety years back,', 'Back in nineteen ten,', 'During the Meiji era,', 'More than seventy years ago,', 'In the early nineteen twenties,', 'Over six decades ago,', 'Back in nineteen thirty,', 'Long before highways arrived,', 'Over a hundred years back,', 'In old regional records,'];
      const text = `${centuries[r - 1]} ${prod} became famous after ${origin}. Sales declined for a time when cheap mass-produced goods flooded the market. Recently, however, local workshops revived demand when they ${modern}.`;
      return {
        text,
        ja: `${prod}の歴史。一時は大量生産品に押されたが、近年「${modern}」ことで需要を回復させた。`,
        prompt: `How did local workshops recently revive demand for ${prod}?`,
        correct: `They ${modern}.`,
        cReason: `revived demand when they ${modern} と近年の復活の施策が述べられている。`,
        wrongs: [
          'They moved all production overseas.',
          'They lowered quality to use plastic only.',
          'They closed their workshops to the public.',
        ],
        wReasons: [
          '生産をすべて海外へ移したとは述べられていない。',
          'プラスチックだけの低品質品に変えたという記述はない。',
          '工房を閉鎖したという内容も事実と反対である。',
        ],
        exp: `過去の起源と近年の復活策（Recently ... when they ${modern}）を区別して聞き取る。`,
        ev: `when they ${modern}`,
      };
    },
  },
  // 5: 健康・心理学・学習法の実験結果
  {
    skill: '文：結果',
    build: (r, isG2) => {
      const experiments = isG2
        ? [
            ['summarizing a lecture by hand in three sentences', 'recalled forty percent more key concepts a week later'],
            ['taking a ten-minute walk outdoors without a smartphone', 'solved creative word puzzles significantly faster afterward'],
            ['explaining new vocabulary aloud to a study partner', 'retained word meanings much longer than silent rereading'],
            ['dividing a two-hour practice session into three short blocks', 'made far fewer errors during the final performance test'],
            ['reviewing difficult material right before a night\'s sleep', 'needed half as much review time the following morning'],
          ]
        : [
            ['writing down three daily goals on a small card', 'finished homework thirty minutes earlier on average'],
            ['drinking a glass of water before afternoon classes', 'stayed more alert during fifth and sixth periods'],
            ['practicing musical scales slowly before speeding up', 'learned new songs in half the usual number of days'],
            ['reading English stories aloud for ten minutes daily', 'felt much less nervous during speaking tests'],
            ['tidying their study desks the night before', 'started morning study routines without delay'],
          ];
      const [method, result] = experiments[(r - 1) % 5];
      const unis = ['Westfield University', 'Northern College', 'Harbor Institute', 'Oakwood University', 'Midland College', 'Crestview Institute', 'Lakefront University', 'Bayview College', 'Highland University', 'Sunport Institute', 'Riverdale College', 'Maplewood University', 'brookside Institute', 'Clearview College', 'Fairmont University'].map(s => s[0].toUpperCase() + s.slice(1));
      const text = `A research team at ${unis[r - 1]} recently tested a simple habit among two hundred students. Half of the participants tried ${method}, while the control group kept their usual routine. After four weeks, students who practiced the new habit ${result}.`;
      return {
        text,
        ja: `${unis[r - 1]}での200人を対象とした実験。「${method}」を実践したグループは、4週間後に「${result}」という結果を示した。`,
        prompt: 'What happened to the students who practiced the new habit?',
        correct: `They ${result}.`,
        cReason: `students who practiced the new habit ${result} と実験結果が明言されている。`,
        wrongs: [
          'They dropped out of the four-week study.',
          'They slept three hours less every night.',
          'They scored lower than the control group.',
        ],
        wReasons: [
          '4週間の調査を途中棄権したとは述べられていない。',
          '毎晩睡眠が3時間減ったという事実はない。',
          '対照群より低い成績だったというのは実験結果と逆である。',
        ],
        exp: `After four weeks, students who practiced the new habit ${result} を聞き取る。`,
        ev: `new habit ${result}`,
      };
    },
  },
  // 6〜15: 残り10パッセージ（アナウンス・ニュース・人物伝・ビジネス・文化）
  ...Array.from({ length: 10 }, (_, idx): MidPassageSpec => ({
    skill: ['文：数値', '文：目的', '文：予測', '文：定義', '総合'][idx % 5],
    build: (r, isG2) => {
      const slot = idx + 6; // 6..15
      const topics = [
        // 6: 図書館・文化施設の改修のお知らせ
        () => {
          const bldgs = ['Eastside Public Library', 'Civic Performing Arts Hall', 'Regional Science Center', 'Harbor History Archive', 'Central Youth Gymnasium'];
          const alts = isG2
            ? ['borrow and return reserved books at the mobile counter in Park Square', 'attend chamber concerts at the adjacent university chapel', 'join weekend planetarium shows at the high school dome', 'request scanned copies of documents through the online portal', 'use the indoor track at North Arena with the same pass']
            : ['use the temporary book desk on the first floor of City Hall', 'watch rehearsals livestreamed on the hall website', 'visit the traveling science bus at Central Park', 'read local magazines at the community cafe next door', 'join badminton sessions at West School Gym'];
          const b = bldgs[(r - 1) % 5];
          const alt = alts[(r - 1) % 5];
          const months = ['May', 'June', 'July', 'September', 'October', 'November', 'January', 'February', 'March', 'April', 'early June', 'late August', 'mid-October', 'early November', 'mid-January'];
          const txt = `Important notice for users of ${b}: starting in ${months[r - 1]}, our main building will close for six weeks to upgrade earthquake safety and lighting. During this closure, visitors can ${alt}. Normal operations will resume right after the upgrade.`;
          return {
            text: txt,
            ja: `${b}の6週間の耐震・照明改修に伴う休館案内。休館中は「${alt}」を利用できる。`,
            prompt: `What can users do while ${b} is closed?`,
            correct: alt[0].toUpperCase() + alt.slice(1) + '.',
            cReason: `During this closure, visitors can ${alt}. と代替手段が明示されている。`,
            wrongs: ['Enter the main building after nine p.m.', 'Apply for construction jobs at the desk.', 'Keep borrowed items forever without returning them.'] as [string, string, string],
            wReasons: ['夜間9時以降に本館へ入れるとは案内されていない。', '建設作業の求人応募の話は出ていない。', '借りた物を返却せず永久に持っていてよいとは言っていない。'] as [string, string, string],
            exp: `During this closure, visitors can ... の休館中の代替サービスを聞き取る。`,
            ev: `visitors can ${alt}`,
          };
        },
        // 7: 人物バイオグラフィー
        () => {
          const names = ['Clara Hughes', 'Kenji Morimoto', 'Elena Rostova', 'David Chen', 'Nadia Al-Mansoor', 'Thomas Lindqvist', 'Mei-Ling Zhou', 'Samuel Boateng', 'Hanae Fujimoto', 'Lucas Moreira', 'Soraia Silva', 'Martin Novak', 'Amina Patel', 'Jonas Weber', 'Riku Kojima'];
          const careers = isG2
            ? [
                ['worked as a marine cartographer', 'designed foldable solar lanterns for disaster relief'],
                ['trained as an architectural acoustician', 'created quiet reading pods for busy pediatric hospitals'],
                ['studied agricultural meteorology', 'developed a frost-warning radio service for highland farmers'],
                ['worked as a museum textile restorer', 'invented a plant-based waterproof coating for backpacks'],
                ['taught industrial design for ten years', 'built lightweight bamboo wheelchairs for rural clinics'],
              ]
            : [
                ['worked as a pastry baker in Lyon', 'opened a free weekend baking school for teenagers'],
                ['repaired bicycles for a racing team', 'started donating refurbished bikes to island students'],
                ['photographed snowy mountains', 'published a picture book teaching kids about glaciers'],
                ['played cello in a city orchestra', 'organized lunchtime concerts at nursing homes'],
                ['managed a botanical greenhouse', 'created rooftop vegetable kits for city schools'],
              ];
          const nm = names[r - 1];
          const [early, later] = careers[(r - 1) % 5];
          const txt = `Many people know ${nm} today because this innovator ${later}. Fewer people realize, however, that ${nm} originally ${early} for nearly a decade. Skills learned in that first career proved essential for solving practical design problems later on.`;
          return {
            text: txt,
            ja: `${nm}は現在「${later}」で知られるが、実は最初の約10年間は「${early}」として働いていた。`,
            prompt: `What did ${nm} do in an earlier career?`,
            correct: `${nm} ${early}.`,
            cReason: `originally ${early} for nearly a decade と初期の経歴が述べられている。`,
            wrongs: [`${nm} piloted commercial passenger jets.`, `${nm} practiced law at a supreme court.`, `${nm} coached an Olympic swimming team.`] as [string, string, string],
            wReasons: ['旅客機のパイロットをしていたとは述べられていない。', '最高裁で弁護士をしていたという経歴はない。', '水泳の五輪コーチだったという記述も本文にない。'] as [string, string, string],
            exp: `現在の業績と originally ${early} の過去の経歴を取り違えないよう注意する。`,
            ev: `originally ${early}`,
          };
        },
        // 8: 消費者・買い物の新サービス
        () => {
          const stores = ['GreenBasket Supermarket', 'Nordic Home Furnishings', 'FreshHarvest Co-op', 'UrbanCycle Outfitters', 'BookBridge Stores', 'Pure Kitchen Market', 'EcoWardrobe Apparel', 'SunRay Electronics', 'CraftCorner Supply', 'DailyBean Roasters', ' Terra Outdoor Gear', 'SmartLiving Mart', 'BlueWave Grocer', ' OakLeaf Books', ' ClearSound Audio'].map(s => s.trim());
          const perks = isG2
            ? ['bring back empty glass jars to get a fifty-yen credit per jar', 'test home appliances for seven days before making a final purchase', 'trade in outgrown children\'s bikes for half off the next size', 'order single replacement parts online instead of buying a new unit', 'choose slower consolidated shipping in exchange for store points']
            : ['get thirty yen off when bringing their own soup container', 'borrow sample board games for two nights before buying', 'exchange read paperbacks for store discount stamps', 'use the free repair table on Sunday afternoons', 'reserve imperfect fresh fruit boxes at forty percent off'];
          const st = stores[r - 1];
          const pk = perks[(r - 1) % 5];
          const txt = `Customer announcement from ${st}: starting this Friday, we are launching our Sustainable Shopper Program. Members who sign up for free at the register can ${pk}. Staff at the green counter will be happy to explain the details.`;
          return {
            text: txt,
            ja: `${st}で今週金曜から始まる新プログラム。無料登録した会員は「${pk}」を利用できる。`,
            prompt: `What benefit do members of ${st}'s new program get?`,
            correct: `They can ${pk}.`,
            cReason: `Members who sign up ... can ${pk}. と特典内容が明言されている。`,
            wrongs: ['They receive free home delivery by helicopter.', 'They get every item free on Mondays.', 'They can park cars inside the store aisle.'] as [string, string, string],
            wReasons: ['ヘリコプターでの無料配送などは行われない。', '月曜に全品無料になるという特典はない。', '店内通路に駐車できるという荒唐無稽な話もない。'] as [string, string, string],
            exp: `Members ... can ${pk} の会員メリットを聞き取る。`,
            ev: `can ${pk}`,
          };
        },
        // 9: 気象・農業・季節ニュース
        () => {
          const crops = ['mountain cherries', 'highland buckwheat', 'coastal mandarins', 'autumn chestnuts', 'sweet corn', 'green tea leaves', 'purple grapes', 'winter spinach', 'pear orchards', 'rapeseed honey', 'new potatoes', 'blueberry bushes', 'persimmon trees', 'shiitake mushrooms', 'apple blossoms'];
          const impacts = isG2
            ? ['warm April nights caused the harvest to begin two weeks earlier than average', 'steady June breezes kept pest damage to its lowest level in ten years', 'abundant snowmelt filled reservoirs and boosted fruit sweetness', 'farmers introduced solar fans that prevented frost damage completely', 'cooperative sorting machines doubled daily shipping capacity']
            : ['sunny autumn days made the fruit much sweeter than last year', 'mild spring rain helped the plants grow taller than usual', 'local high school volunteers helped finish picking on time', 'new nets protected the fields from hungry wild birds', 'direct online sales sold out the first batch in three days'];
          const cr = crops[r - 1];
          const imp = impacts[(r - 1) % 5];
          const txt = `In regional farming news, growers of ${cr} are reporting an unusual season this year. According to the agricultural cooperative, ${imp}. Local markets expect vibrant weekend crowds eager to taste this year's crop.`;
          return {
            text: txt,
            ja: `地域の農業ニュース。今年の${cr}について、農協によると「${imp}」と報告されている。`,
            prompt: `What is reported about ${cr} this year?`,
            correct: imp[0].toUpperCase() + imp.slice(1) + '.',
            cReason: `According to the agricultural cooperative, ${imp}. とそのまま報告されている。`,
            wrongs: ['All farms stopped growing the crop permanently.', 'Exports were banned due to a typhoon.', 'Prices rose tenfold overnight.'] as [string, string, string],
            wReasons: ['栽培を恒久的にやめたとは述べられていない。', '台風で輸出禁止になったという記述はない。', '価格が一晩で10倍になったとも報じられていない。'] as [string, string, string],
            exp: `According to the agricultural cooperative, ${imp} の報道内容を聞き取る。`,
            ev: imp,
          };
        },
        // 10: 空港・ホテル・イベント受付の案内
        () => {
          const venues = ['Grand Harbor Hotel', 'Skyline Conference Center', 'Pacific Ferry Terminal', 'Alpine Resort Lodge', 'Central Arts Theater', 'Bayfront Exhibition Hall', 'Maple Valley Inn', 'International Youth Hostel', 'Northern Rail Hotel', 'Coral Island Pier', 'Cedar Springs Hotel', 'Starlight Civic Arena', 'Sunrise Airport Lounge', 'Riverview Banquet Hall', 'Crown Plaza Auditorium'];
          const instructions = isG2
            ? ['pick up your welcome packet at Desk C before heading to the elevators', 'present your digital QR code at the express lane on Floor Two', 'leave oversized musical instruments or sports gear at Baggage Counter Four', 'board the courtesy shuttle departing from Pillar Nine every twenty minutes', 'exchange paper vouchers for wristbands at the west pavilion']
            : ['write your room number on the breakfast card before nine p.m.', 'leave wet umbrellas in the numbered locks by the front door', 'pick up free city bus maps from the rack beside the clock', 'gather by the lobby fireplace ten minutes before the walk starts', 'return audio headsets to the wooden box near Exit B'];
          const vn = venues[r - 1];
          const inst = instructions[(r + slot) % 5];
          const txt = `Welcome to ${vn} for session ${slot - 5}! We are delighted to have you with us today. To ensure smooth service for everyone, please ${inst}. If you need assistance in another language, staff wearing green badges are ready to help.`;
          return {
            text: txt,
            ja: `${vn}での利用者案内。円滑な運営のため「${inst}」を行うよう協力を求めている。`,
            prompt: `What are guests at ${vn} asked to do?`,
            correct: inst[0].toUpperCase() + inst.slice(1) + '.',
            cReason: `please ${inst} と利用者への具体的なお願いが述べられている。`,
            wrongs: ['Wear green staff badges at all times.', 'Clean their own rooms before checkout.', 'Pay an extra fee for elevator use.'] as [string, string, string],
            wReasons: ['緑のバッジを着けているのは案内スタッフであり客ではない。', 'チェックアウト前に客自身で部屋掃除をする規則はない。', 'エレベーター利用に追加料金がかかるという話もない。'] as [string, string, string],
            exp: `To ensure smooth service ..., please ${inst} を聞き取る。`,
            ev: `please ${inst}`,
          };
        },
      ];
      return topics[idx % 5]();
    },
  })),
];

function buildMidGradeRound(grade: 'eiken_pre2plus' | 'eiken_2', round: number): ListeningExamRound {
  const isG2 = grade === 'eiken_2';
  const examId = `${grade}_listening_r${String(round).padStart(2, '0')}`;
  const units: ListeningAudioUnit[] = [];

  // Part 1: 15 dialogues (4-choice printed, 1 read, no image)
  for (let u = 1; u <= 15; u++) {
    const [sp1, sp2] = speakerPairFor(round + (isG2 ? 1 : 0), u);
    const m = M_NAMES[(round * 2 + u + (isG2 ? 5 : 0)) % 15];
    const f = F_NAMES[(round * 3 + u + (isG2 ? 7 : 0)) % 15];
    const who1 = sp1.roleLabel === 'Man' ? 'the man' : 'the woman';
    const who2 = sp2.roleLabel === 'Woman' ? 'the woman' : 'the man';
    const spec = MID_DIALOGUE_SPECS[u - 1];
    const d = spec.build(round, isG2, m, f, who1, who2);
    const opener = (isG2 ? DIALOGUE_OPENERS_G2 : DIALOGUE_OPENERS_P2P)[(round + u - 2) % 15];
    const targetAnswer = (round + u + (isG2 ? 2 : 0)) % 4;

    const qItem = makeQuestionItem({
      examId,
      questionNumber: u,
      questionPrompt: d.prompt,
      choicePresentation: 'printed',
      correctChoice: d.correct,
      correctReason: d.cReason,
      wrongChoices: d.wrongs,
      wrongReasons: d.wReasons,
      targetAnswer,
      explanation: d.exp,
      evidence: d.ev,
      skill: spec.skill,
    });

    const roundWords = ['Alpha', 'Bravo', 'Cedar', 'Delta', 'Echo', 'Falcon', 'Granite', 'Harbor', 'Ivory', 'Jasper', 'Kestrel', 'Linden', 'Marble', 'Nimbus', 'Osprey'];
    const unitPlaces = ['at Desk One', 'in Room Two', 'by Gate Three', 'on Floor Four', 'near Hall Five', 'at Counter Six', 'in Studio Seven', 'by Lounge Eight', 'on Wing Nine', 'near Booth Ten', 'at Lobby Eleven', 'in Annex Twelve', 'by Office Thirteen', 'on Terrace Fourteen', 'near Suite Fifteen'];
    const turns: DialogueTurn[] = [
      { ...sp1, text: `Colleague ${roundWords[round - 1]} ${unitPlaces[u - 1]}—${opener[0].toLowerCase()}${opener.slice(1)} ${d.l1}` },
      { ...sp2, text: d.l2 },
      { ...sp1, text: d.l3 },
      { ...sp2, text: d.l4 },
      { speaker: 'F2', roleLabel: 'Narrator', text: `Question. ${d.prompt}` },
    ];

    units.push(
      makeDialogueUnit({
        examId,
        part: 'part1',
        unitIndex: u,
        readCount: 1,
        turns,
        translation: d.ja,
        image: null,
        questions: [qItem],
      }),
    );
  }

  // Part 2: 15 passages (4-choice printed, 1 read, no image)
  for (let u = 1; u <= 15; u++) {
    const qNo = 15 + u;
    const spec = MID_PASSAGE_SPECS[u - 1];
    const p = spec.build(round, isG2);
    const targetAnswer = (round * 3 + u + (isG2 ? 1 : 0)) % 4;

    // Ensure every single passage opening across 15 rounds x 15 items is distinct in spoken English words
    const roundWords = ['Alpha', 'Bravo', 'Cedar', 'Delta', 'Echo', 'Falcon', 'Granite', 'Harbor', 'Ivory', 'Jasper', 'Kestrel', 'Linden', 'Marble', 'Nimbus', 'Osprey'];
    const unitWords = ['First', 'Second', 'Third', 'Fourth', 'Fifth', 'Sixth', 'Seventh', 'Eighth', 'Ninth', 'Tenth', 'Eleventh', 'Twelfth', 'Thirteenth', 'Fourteenth', 'Fifteenth'];
    const tagPrefix = isG2
      ? `Broadcast ${roundWords[round - 1]}, ${unitWords[u - 1]} segment:`
      : `Bulletin ${roundWords[round - 1]}, ${unitWords[u - 1]} topic:`;

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
      skill: spec.skill,
    });

    const turns: DialogueTurn[] = [
      { speaker: 'F2', roleLabel: 'Narrator', text: `${tagPrefix} ${p.text}` },
      { speaker: 'F2', roleLabel: 'Narrator', text: `Question. ${p.prompt}` },
    ];

    units.push(
      makeDialogueUnit({
        examId,
        part: 'part2',
        unitIndex: u,
        readCount: 1,
        turns,
        translation: p.ja,
        image: null,
        questions: [qItem],
      }),
    );
  }

  return buildExamRound(grade, round, units);
}

export const GRADE_PRE2PLUS_LISTENING_EXAMS: readonly ListeningExamRound[] = Array.from(
  { length: 15 },
  (_, idx) => buildMidGradeRound('eiken_pre2plus', idx + 1),
);

export const GRADE_2_LISTENING_EXAMS: readonly ListeningExamRound[] = Array.from(
  { length: 15 },
  (_, idx) => buildMidGradeRound('eiken_2', idx + 1),
);
