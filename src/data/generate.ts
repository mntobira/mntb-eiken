// テンプレート型の問題生成。
// 文法が必ず正しくなる枠だけを使い、語彙を差し替えて新しい問題を作る。

import { mulberry32, shuffle } from './util'

export type GenItem = {
  lines: string[]
  choices: string[]
  answer: number
  jp: string
  exp: string
}

function pick<T>(arr: readonly T[], rand: () => number): T {
  return arr[Math.floor(rand() * arr.length)]
}

/* ---------------- 動詞の形 ---------------- */

type Verb = {
  base: string
  s: string
  ing: string
  ed: string
  obj: string
  objJp: string
  ingJp: string
  edJp: string
}

const VERBS: Verb[] = [
  { base: 'play', s: 'plays', ing: 'playing', ed: 'played', obj: 'tennis', objJp: 'テニスを', ingJp: 'テニスをしている', edJp: 'テニスをした' },
  { base: 'watch', s: 'watches', ing: 'watching', ed: 'watched', obj: 'TV', objJp: 'テレビを', ingJp: 'テレビを見ている', edJp: 'テレビを見た' },
  { base: 'clean', s: 'cleans', ing: 'cleaning', ed: 'cleaned', obj: 'my room', objJp: '自分の部屋を', ingJp: '部屋を掃除している', edJp: '部屋を掃除した' },
  { base: 'visit', s: 'visits', ing: 'visiting', ed: 'visited', obj: 'my grandmother', objJp: '祖母を', ingJp: '祖母を訪ねている', edJp: '祖母を訪ねた' },
  { base: 'study', s: 'studies', ing: 'studying', ed: 'studied', obj: 'English', objJp: '英語を', ingJp: '英語を勉強している', edJp: '英語を勉強した' },
  { base: 'cook', s: 'cooks', ing: 'cooking', ed: 'cooked', obj: 'dinner', objJp: '夕食を', ingJp: '夕食を作っている', edJp: '夕食を作った' },
  { base: 'use', s: 'uses', ing: 'using', ed: 'used', obj: 'a computer', objJp: 'コンピューターを', ingJp: 'コンピューターを使っている', edJp: 'コンピューターを使った' },
  { base: 'help', s: 'helps', ing: 'helping', ed: 'helped', obj: 'my mother', objJp: '母を', ingJp: '母を手伝っている', edJp: '母を手伝った' },
  { base: 'make', s: 'makes', ing: 'making', ed: 'made', obj: 'a cake', objJp: 'ケーキを', ingJp: 'ケーキを作っている', edJp: 'ケーキを作った' },
  { base: 'read', s: 'reads', ing: 'reading', ed: 'read', obj: 'a book', objJp: '本を', ingJp: '本を読んでいる', edJp: '本を読んだ' },
]

const SUBJ_3SG = [
  { en: 'My sister', jp: '私の姉' },
  { en: 'Ken', jp: 'ケン' },
  { en: 'My father', jp: '私の父' },
  { en: 'Emi', jp: 'エミ' },
  { en: 'My brother', jp: '私の兄' },
  { en: 'Ms. Green', jp: 'グリーン先生' },
  { en: 'Taro', jp: 'タロウ' },
  { en: 'My mother', jp: '私の母' },
]

const SUBJ_PL = [
  { en: 'Ken and I', jp: 'ケンと私' },
  { en: 'My friends', jp: '私の友達' },
  { en: 'They', jp: '彼ら' },
  { en: 'We', jp: '私たち' },
  { en: 'The students', jp: '生徒たち' },
  { en: 'My parents', jp: '私の両親' },
]

function verbForm(rand: () => number): GenItem {
  const v = pick(VERBS, rand)
  const opts = [v.base, v.s, v.ing, v.ed]
  const kind = Math.floor(rand() * 4)

  if (kind === 0) {
    const s = pick(SUBJ_3SG, rand)
    return {
      lines: [`${s.en} ( ___ ) ${v.obj} every day.`],
      choices: opts,
      answer: 1,
      jp: `${s.jp}は毎日${v.objJp}します。`,
      exp: '主語が３人称単数（he / she / 人名など）なので、動詞に -s（-es）をつけます。',
    }
  }
  if (kind === 1) {
    const s = pick(SUBJ_PL, rand)
    return {
      lines: [`${s.en} ( ___ ) ${v.obj} every day.`],
      choices: opts,
      answer: 0,
      jp: `${s.jp}は毎日${v.objJp}します。`,
      exp: '主語が複数（または I / we / you）なので、動詞は原形を使います。',
    }
  }
  if (kind === 2) {
    const s = pick(SUBJ_3SG, rand)
    return {
      lines: [`Look! ${s.en} is ( ___ ) ${v.obj} now.`],
      choices: opts,
      answer: 2,
      jp: `見て！${s.jp}は今${v.ingJp}。`,
      exp: 'now（今）があるので現在進行形「is ＋ -ing」の形にします。',
    }
  }
  const s = pick(SUBJ_3SG, rand)
  return {
    lines: [`${s.en} ( ___ ) ${v.obj} yesterday.`],
    choices: opts,
    answer: 3,
    jp: `${s.jp}は昨日${v.edJp}。`,
    exp: 'yesterday（昨日）があるので動詞は過去形にします。',
  }
}

/* ---------------- 代名詞 ---------------- */

const POSS_ITEMS = [
  { en: 'bag', jp: 'かばん' },
  { en: 'pen', jp: 'ペン' },
  { en: 'camera', jp: 'カメラ' },
  { en: 'umbrella', jp: '傘' },
  { en: 'bicycle', jp: '自転車' },
  { en: 'notebook', jp: 'ノート' },
  { en: 'cap', jp: '帽子' },
  { en: 'watch', jp: '腕時計' },
]

function pronoun(rand: () => number): GenItem {
  const it = pick(POSS_ITEMS, rand)
  if (rand() < 0.5) {
    return {
      lines: [`A : Is this your ${it.en}?`, 'B : Yes, it’s ( ___ ).'],
      choices: ['my', 'me', 'mine', 'I'],
      answer: 2,
      jp: `A：これはあなたの${it.jp}ですか。B：はい、私のです。`,
      exp: '「私のもの」を１語で表すのは所有代名詞 mine です。my は名詞の前に置きます。',
    }
  }
  return {
    lines: [`A : This is my ${it.en}.`, `B : Oh, is it ( ___ ) ${it.en}?`],
    choices: ['you', 'your', 'yours', 'yourself'],
    answer: 1,
    jp: `A：これは私の${it.jp}です。B：ああ、それはあなたの${it.jp}ですか。`,
    exp: '名詞の前には所有格 your を置きます。yours は「あなたのもの」という代名詞です。',
  }
}

/* ---------------- be動詞の一致 ---------------- */

const NP_SG = [
  { en: 'This book', jp: 'この本' },
  { en: 'My bag', jp: '私のかばん' },
  { en: 'The bus', jp: 'そのバス' },
  { en: 'That dog', jp: 'あの犬' },
  { en: 'My new bike', jp: '私の新しい自転車' },
  { en: 'This shirt', jp: 'このシャツ' },
]

const NP_PL = [
  { en: 'These books', jp: 'これらの本' },
  { en: 'My shoes', jp: '私の靴' },
  { en: 'The buses', jp: 'それらのバス' },
  { en: 'Those dogs', jp: 'あの犬たち' },
  { en: 'My new shoes', jp: '私の新しい靴' },
  { en: 'These shirts', jp: 'これらのシャツ' },
]

function beVerb(rand: () => number): GenItem {
  const plural = rand() < 0.5
  const np = plural ? pick(NP_PL, rand) : pick(NP_SG, rand)
  return {
    lines: [`${np.en} ( ___ ) very nice.`],
    choices: ['is', 'are', 'am', 'be'],
    answer: plural ? 1 : 0,
    jp: `${np.jp}はとても素敵です。`,
    exp: plural
      ? '主語が複数なので be動詞は are です。'
      : '主語が単数なので be動詞は is です。',
  }
}

/* ---------------- 前置詞（場所） ---------------- */

const PLACE = [
  { en: 'on the desk', jp: '机の上に' },
  { en: 'in the box', jp: '箱の中に' },
  { en: 'under the chair', jp: '椅子の下に' },
  { en: 'by the window', jp: '窓のそばに' },
  { en: 'behind the door', jp: 'ドアの後ろに' },
]

const THINGS = [
  { en: 'My pencil', jp: '私のえんぴつ' },
  { en: 'The cat', jp: 'その猫' },
  { en: 'Your bag', jp: 'あなたのかばん' },
  { en: 'My cap', jp: '私の帽子' },
]

const PREPS = [
  { en: 'on', jp: '～の上に' },
  { en: 'in', jp: '～の中に' },
  { en: 'under', jp: '～の下に' },
  { en: 'by', jp: '～のそばに' },
]

function preposition(rand: () => number): GenItem {
  const thing = pick(THINGS, rand)
  const place = pick(PLACE, rand)
  const prep = place.en.split(' ')[0]
  const rest = place.en.split(' ').slice(1).join(' ')

  return {
    lines: [`${thing.en} is ( ___ ) ${rest}.`],
    choices: PREPS.map((p) => p.en),
    answer: PREPS.findIndex((p) => p.en === prep),
    jp: `${thing.jp}は${place.jp}あります。`,
    exp: `場所を表す前置詞 ${prep}（${PREPS.find((p) => p.en === prep)?.jp}）を使います。`,
  }
}

/* ---------------- 疑問詞 ---------------- */

const WH = [
  { en: 'When', jp: 'いつ', hint: '時刻・日付を答える' },
  { en: 'Where', jp: 'どこで', hint: '場所を答える' },
  { en: 'Who', jp: 'だれ', hint: '人を答える' },
  { en: 'How', jp: 'どうやって・どのように', hint: '方法や様子を答える' },
]

function whQuestion(rand: () => number): GenItem {
  const target = pick(WH, rand)
  const others = WH.filter((w) => w.en !== target.en).map((w) => w.en)
  return {
    lines: [`A : ( ___ ) do you go to school?`, 'B : By bicycle.'],
    choices: [target.en, ...others],
    answer: 0,
    jp: `A：どうやって学校へ行きますか。B：自転車で。`,
    exp: `By bicycle.（自転車で）と手段を答えているので ${target.en} が正解です。`,
  }
}

/* ---------------- まとめ ---------------- */

const MAKERS = [verbForm, pronoun, beVerb, preposition, whQuestion]

/** 新しい問題を n 問生成する（毎回ちがう組み合わせ） */
export function generateReading(n: number, seed: number): GenItem[] {
  const rand = mulberry32(seed)
  const out: GenItem[] = []
  let guard = 0

  while (out.length < n && guard < n * 40) {
    guard++
    const maker = MAKERS[out.length % MAKERS.length]
    const item = maker(rand)

    // 正解が重複していないか確認してから採用
    const hasDup = new Set(item.choices).size !== item.choices.length
    if (hasDup) continue
    if (item.answer < 0 || item.answer >= item.choices.length) continue

    out.push(item)
  }
  return out
}

/** 選択肢の並び順を（同じ問題でも）固定しつつ、正解位置をばらけさせる */
export function spreadAnswer(item: GenItem, seed: number): GenItem {
  const rand = mulberry32(seed)
  const correct = item.choices[item.answer]
  const shuffled = shuffle(item.choices, rand)
  return { ...item, choices: shuffled, answer: shuffled.indexOf(correct) }
}
