/** TOEIC Part 5 第8回の解説の追加項目（着眼点・ポイント・TOEICでのコツ・手がかり）。並びは第8回の問1〜問30と同じ。空の要素は「追加なし」 */
import type { ToeicP5Note } from './toeicPart5NoteTypes';

export const NOTES_08: ToeicP5Note[] = [
  { // 1 his
    h: '空所の直後の team を見る。チームの持ち主は、頼んでいる主語の Mr. Patel 本人。',
    r: '名詞の前の代名詞は所有格。持ち主が男性1人なら his。him（目的格）や himself は名詞の前に置けない。',
    tip: 'asked ＿ team の型では、空所の直後が名詞なので所有格に決まる。主語の性別と数で1つに絞る。',
    cues: [{ p: 'team' }] },
  { // 2 arrangements
    h: '空所の前の making final と、後ろの for the product launch event を見る。making の目的語の位置。',
    r: '形容詞の後ろで動詞の目的語になるのは名詞。make arrangements for 〜 は「〜の準備をする」。',
    tip: '催しの準備の文では make arrangements、make preparations など make と組む名詞が使われる。',
    cues: [{ p: 'final' }, { p: 'making', w: 'making' }] },
  { // 3 ended
    h: '文頭の Last year と、and の後ろの moved を見る。2つの動詞の時制はそろえる。',
    r: 'and で並べる動詞は同じ時制にする。過去を表す語句があれば両方とも過去形。',
    tip: '時の語句が文頭にある場合も多い。and の後ろの動詞の形も、時制を決める手がかりになる。',
    cues: [{ p: 'Last year' }, { p: 'moved' }] },
  { // 4 at
    h: '空所の直後の 10:30 A.M. を見る。日付や曜日ではなく、時刻だけが書かれている。',
    r: '時刻の前は at、日付・曜日の前は on、月・年の前は in。後ろの語の種類で前置詞が決まる。',
    tip: '時の前置詞は、後ろに数字と A.M.／P.M. があれば at を選べばよい。',
    cues: [{ p: '10:30 A.M.' }] },
  { // 5 memorable
    h: '空所の前の冠詞 a と、後ろの名詞 speech を見る。名詞を説明する語が入る位置。',
    r: '冠詞と名詞の間は形容詞の位置。memory（名詞）や memorize（動詞）は置けない。',
    tip: '-able／-ible で終わる語は形容詞のことが多い。品詞を語尾で見分けて形容詞を選ぶ。',
    cues: [{ p: 'speech' }] },
  { // 6 issue
    h: '空所の前の the next と、後ろの of the magazine を見る。定期購読者が受け取るものを考える。',
    r: '名詞の語彙問題は、同じ文の別の語（subscribers、magazine）と自然につながる名詞を選ぶ。',
    tip: '雑誌や新聞の文では issue、edition、subscription などの語が使われる。「号」は issue。',
    cues: [{ p: 'Subscribers', w: '定期購読者' }, { p: 'magazine', w: '雑誌' }] },
  { // 7 which
    h: '先行詞 The magazine が物であることと、空所の前のカンマ、後ろの was を見る。',
    r: 'カンマの後ろで説明を加える関係代名詞は、物なら which、人なら who。この使い方で that は使わない。',
    tip: '主語と述語の間にカンマで挟まれた説明が入る型では、関係代名詞が節の主語になっていることが多い。',
    cues: [{ p: 'The magazine' }, { p: 'was', w: 'was' }] },
  { // 8 hire
    h: '空所の後ろの a new advertising agency と、to handle its online campaigns を見る。',
    r: '動詞の語彙問題は、目的語と目的（to 以下）の両方に合うものを選ぶ。人や会社を雇うのは hire。',
    tip: '仕事を任せる相手が目的語なら hire、employ、appoint などの動詞が候補になる。',
    cues: [{ p: 'a new advertising agency', w: '代理店' }] },
  { // 9 will be published
    h: "主語の The interview が掲載する側かされる側かを考え、tomorrow's edition で時を決める。",
    r: '主語が動作を受ける側で、時がこれから先なら未来の受動態（will be＋過去分詞）。',
    tip: '新聞・雑誌の文では be published、be featured など受動態で「載る」を表すことが多い。',
    cues: [{ p: 'The interview', w: 'インタビュー' }] },
  { // 10 steadily
    h: '空所の前の have increased と、後ろの since it was featured を見る。増え方を表す語が入る。',
    r: '動詞の後ろで、その動作の様子を表すのは副詞。増減の動詞には steadily、sharply などが合う。',
    tip: '完了形の動詞の直後の空所は副詞の位置。形容詞 steady ではなく steadily を選ぶ。',
    cues: [{ p: 'increased' }] },
  { // 11 Even though
    h: '空所の後ろが節であることを確かめ、「よく書けていた」と「修正を求めた」の関係を見る。',
    r: 'even though は「〜にもかかわらず」と事実を受けて逆の内容を続ける接続詞。後ろに節を取る。',
    tip: '前半が良い評価で後半がそれと逆の行動なら、譲歩の接続詞を候補にする。despite は名詞を取る。',
    cues: [{ p: 'was well written', w: 'よく書けていた' }, { p: 'asked for several changes', w: '修正を求めた' }] },
  { // 12 fluent
    h: '空所の後ろの in three languages と、後半の ideal for the overseas sales position を見る。',
    r: 'be fluent in ＋言語 は「〜が流ちょうだ」。形容詞は組む前置詞と一緒に覚える。',
    tip: '求人や人物紹介で言語の話が出たら、fluent、proficient など語学力を表す形容詞を探す。',
    cues: [{ p: 'in three languages', w: '3か国語' }, { p: 'overseas sales position', w: '海外営業' }] },
  { // 13 another
    h: '空所の後ろの one を見る。前半の this conference room とは別の、もう1つの部屋を表したい。',
    r: 'another は「もう1つの・別の」で単数名詞や one の前に置く。other は複数名詞の前、the other は残りの1つ。',
    tip: 'another、other、the other が並んだら、後ろが単数か複数か、残りが決まっているかで見分ける。',
    cues: [{ p: 'one', o: 1, w: 'one' }] },
  { // 14 on
    h: '空所の後ろの television を見る。放送が流れた媒体を表す前置詞を考える。',
    r: 'テレビ・ラジオ・電話・インターネットなどの媒体は on で表す（on television、on the radio）。',
    tip: 'broadcast や appear の後ろの媒体には on を当てる。in television とは言わない。',
    cues: [{ p: 'television' }] },
  { // 15 statement
    h: "空所の前の The CEO's と、後ろの about the merger、was posted を見る。CEOが出したものを考える。",
    r: '名詞の語彙問題は、発した人（CEO）と話題（合併）と掲載先の3つに合う名詞を選ぶ。',
    tip: '広報の文では statement、announcement、press release などが使われる。誰が出したかで選ぶ。',
    cues: [{ p: "The CEO's", w: 'CEO' }, { p: 'merger', w: '合併' }] },
  { // 16 ensuring
    h: '空所の前の前置詞 for と、後ろの that 節を見る。前置詞の後ろで that 節を目的語に取る形。',
    r: 'be responsible for の for は前置詞なので、続く動詞は -ing 形（動名詞）にする。「〜する責任がある」の意味。',
    tip: 'responsible for の後ろが動詞なら -ing を選ぶ。to ensure は前置詞の後ろに置けない。',
    cues: [{ p: 'responsible for', w: 'for' }] },
  { // 17 do away with
    h: '空所の後ろの its old logo と、and introduce a completely new design を見る。古いロゴをどうするか。',
    r: 'do away with は「〜を廃止する・やめる」。3語で1つの他動詞のように目的語を取る。',
    tip: 'and の後ろに「新しい物を導入する」が来れば、前半は古い物を「やめる・廃止する」と予想できる。',
    cues: [{ p: 'introduce a completely new design', w: '新しいデザインを導入' }, { p: 'its old logo', w: '古いロゴ' }] },
  { // 18 exhibitors
    h: '空所の前の More than 200 と、後ろの set up booths を見る。ブースを出すのは人か物か。',
    r: '数字の後ろの名詞は複数形。主語の名詞は、述語の動作をする者として意味が通るものを選ぶ。',
    tip: 'exhibit／exhibition／exhibitor の並びでは、語尾で物・催し・人を見分ける。-or は人。',
    cues: [{ p: 'More than 200', w: '数字' }, { p: 'set up booths', w: 'ブースを出す' }] },
  { // 19 warmly
    h: '空所の後ろの received と、by both readers and critics を見る。受け入れられ方を表す副詞。',
    r: '副詞の語彙問題は、修飾する動詞と組んで自然な意味かで選ぶ。be warmly received は「好評を得る」。',
    tip: '書籍や映画の評判の文では warmly received、well received など受け入れられ方を表す組が使われる。',
    cues: [{ p: 'both readers and critics', w: '読者にも批評家にも' }, { p: 'received', w: '受け入れられた' }] },
  { // 20 fewer
    h: '空所の後ろの visitors と、さらに後ろの than を見る。数えられる名詞の数を比べている。',
    r: '比較級で「より少ない」を表すとき、可算名詞には fewer、不可算名詞には less を使う。どちらも than と組む。',
    tip: 'fewer と less が並んだら、後ろの名詞に -s があるかを見る。複数形なら fewer を選ぶ。',
    cues: [{ p: 'than' }, { p: 'visitors' }] },
  { // 21 expand
    h: '空所の後ろの its business と、into overseas markets を見る。事業を海外市場へどうするか。',
    r: 'expand A into B は「AをBに拡大する」。動詞は目的語と前置詞の組（into 〜）で語法が決まる。',
    tip: '事業の文では expand、extend、enter が並ぶことがある。into 〜 と組んで目的語を取るかで選ぶ。',
    cues: [{ p: 'its business', w: '事業' }, { p: 'into overseas markets', w: '海外市場' }] },
  { // 22 substantial
    h: '空所の前の reported と、後ろの名詞 growth を見る。名詞を説明する語が入る位置。',
    r: '名詞を修飾するのは形容詞。substance（名詞）から -tial を付けると形容詞 substantial になる。',
    tip: '業績の文では substantial growth、significant increase など増減の大きさを表す組が使われる。',
    cues: [{ p: 'growth' }] },
  { // 23 whose
    h: '空所の後ろの novel won the award を見る。名詞と動詞がそろっていて、主語も目的語も欠けていない。',
    r: '関係詞の後ろに「冠詞の無い名詞＋動詞」が続き、先行詞がその名詞の持ち主なら whose を使う。',
    tip: '関係詞の直後に名詞が来ていれば whose を候補に入れ、「その作家の小説」のように読めるかを確かめる。',
    cues: [{ p: 'novel' }, { p: 'won' }] },
  { // 24 promotion
    h: '後半の exceeded its sales goals three years in a row を見る。成果を上げた人が得るものを考える。',
    r: '名詞の語彙問題は、after 以下の理由から結果を考える。成果への見返りは promotion（昇進）。',
    tip: '人事の文では promotion、raise、bonus などが使われる。received の目的語として自然かを確かめる。',
    cues: [{ p: 'exceeded its sales goals', w: '目標を上回った' }, { p: 'three years in a row', w: '3年連続' }] },
  { // 25 if
    h: '前半の will be moved indoors と、後半の it rains on Sunday の関係を見る。雨は条件になっている。',
    r: 'if は条件を表す接続詞。条件の if 節では、未来のことでも現在形（rains）を使う。',
    tip: '屋外の催しの案内では「雨の場合は…」と if で条件を示す。in case と意味の違いを確かめる。',
    cues: [{ p: 'it rains on Sunday', w: '日曜日に雨が降ったら' }] },
  { // 26 has
    h: '主語の The number of subscribers を見る。中心の語は The number で、数そのものを表している。',
    r: 'a number of 〜（多くの〜）は複数として扱う。一方 the number of 〜 は「数」そのものが主語なので、動詞は単数に合わせる。',
    tip: 'The number of と A number of は冠詞1つで扱いが変わる。主語の先頭の冠詞を見落とさない。',
    cues: [{ p: 'The number of', w: 'the number of' }] },
  { // 27 personally
    h: '空所の後ろの thanked each employee を見る。CEOがどのようにお礼を言ったかを表す副詞。',
    r: '副詞の語彙問題は、主語と動詞の組み合わせで意味が通るかを確かめる。personally は「自ら・本人が」。',
    tip: 'each employee のように一人ひとりを対象にする文では、personally や individually が意味に合いやすい。',
    cues: [{ p: 'thanked', w: 'thank' }] },
  { // 28 circulation
    h: '空所の前の a と、後ろの of about 80,000 copies を見る。雑誌の部数を表す名詞を考える。',
    r: '冠詞の後ろは名詞。a circulation of 〜 copies は「〜部の発行部数」を表す。',
    tip: '出版の文で copies と数字があれば、circulation や print run など部数を表す名詞を探す。',
    cues: [{ p: 'copies', w: 'copies' }] },
  { // 29 for
    h: '空所の後ろの more than twenty years と、動詞の has worked を見る。働いてきた期間の長さ。',
    r: '期間の長さは for で表す。現在完了と組むと「〜の間ずっと」になる。since は起点の時点を取る。',
    tip: 'for と since で迷ったら、後ろが期間の長さか、始まりの時点かを見れば決まる。',
    cues: [{ p: 'more than twenty years' }] },
  { // 30 candid
    h: '空所の後ろの look at the daily lives of factory workers を見る。ドキュメンタリーの描き方を考える。',
    r: '形容詞の語彙問題は、修飾する名詞と組んで自然かで選ぶ。a candid look at 〜 は「〜のありのままの姿」。',
    tip: '映像や記事の紹介では a candid look、an in-depth look、a close look など look と組む形容詞が使われる。',
    cues: [{ p: 'look at', w: 'look at' }] },
];
