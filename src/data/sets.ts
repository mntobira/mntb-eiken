import { S1, S2, S3 } from './reading'
import { L1, L2, L3 } from './listening'
import { mulberry32, shuffle } from './util'
import { generateReading } from './generate'

export type Sec = 'R1' | 'R2' | 'R3' | 'L1' | 'L2' | 'L3'

export const SEC_LABEL: Record<Sec, string> = {
  R1: '大問1',
  R2: '大問2',
  R3: '大問3',
  L1: 'リスニング 第1部',
  L2: 'リスニング 第2部',
  L3: 'リスニング 第3部',
}

export const SEC_GUIDE: Record<Sec, string> = {
  R1: '短文の（　）に入る最も適切な語句を 1〜4 から選ぶ',
  R2: '会話文の（　）に入る最も適切なものを 1〜4 から選ぶ',
  R3: '日本文に合うように語句を並べかえ、1番目と3番目の組合せを選ぶ',
  L1: '英文を聞いて、その応答として最も適切なものを 1〜3 から選ぶ',
  L2: '対話と質問を聞いて、答えとして最も適切なものを 1〜4 から選ぶ',
  L3: '3つの英文から、イラストの内容を最もよく表すものを選ぶ',
}

export const SEC_COUNT: Record<Sec, number> = { R1: 4, R2: 4, R3: 4, L1: 3, L2: 4, L3: 3 }

export function isListening(sec: Sec): boolean {
  return sec === 'L1' || sec === 'L2' || sec === 'L3'
}

export type QuizItem = {
  id: string
  sec: Sec
  no: number
  lines: string[]
  question?: string
  scene?: string
  sceneJp?: string
  jp?: string
  prefix?: string
  chunks?: string[]
  suffix?: string
  choices: string[]
  answer: number
  jpFull: string
  exp: string
  /** 読み上げ用テキスト（リスニング） */
  audio?: string[]
}

let seq = 0
const nextId = () => `q${++seq}`

function hash(str: string): number {
  let h = 2166136261
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

/** 正解の位置が偏らないよう、選択肢を決まった順に並べ替える */
function arrange(correct: string, wrong: string[], seed: string) {
  const all = shuffle([correct, ...wrong], mulberry32(hash(seed)))
  return { choices: all, answer: all.indexOf(correct) }
}

function mkS1(raw: (typeof S1)[number]): QuizItem {
  const { choices, answer } = arrange(raw.answer, raw.wrong, raw.lines.join('|'))
  return {
    id: nextId(),
    sec: 'R1',
    no: 0,
    lines: raw.lines,
    choices,
    answer,
    jpFull: raw.jp,
    exp: raw.exp,
  }
}

function mkS2(raw: (typeof S2)[number]): QuizItem {
  const { choices, answer } = arrange(raw.answer, raw.wrong, raw.lines.join('|'))
  return {
    id: nextId(),
    sec: 'R2',
    no: 0,
    lines: raw.lines,
    choices,
    answer,
    jpFull: raw.jp,
    exp: raw.exp,
  }
}

const MARKS = ['①', '②', '③', '④']

/** 語句並べかえ：正解の「1番目─3番目」を作り、紛らわしい誤答を3つ作る */
function orderChoices(order: number[]) {
  const pair = (a: number, b: number) => `${MARKS[a - 1]}─${MARKS[b - 1]}`
  const correct = pair(order[0], order[2])

  const wrongSet = new Set<string>()
  const candidates = [
    pair(order[0], order[1]),
    pair(order[1], order[2]),
    pair(order[2], order[0]),
    pair(order[1], order[3]),
    pair(order[3], order[0]),
    pair(order[2], order[3]),
    pair(order[3], order[1]),
    pair(order[0], order[3]),
  ]
  for (const c of candidates) {
    if (c !== correct) wrongSet.add(c)
  }
  // 4つの語から作れる全組合せで補完
  if (wrongSet.size < 3) {
    for (let a = 1; a <= 4; a++) {
      for (let b = 1; b <= 4; b++) {
        if (a !== b) wrongSet.add(pair(a, b))
      }
    }
  }
  const wrong = [...wrongSet].filter((c) => c !== correct).slice(0, 3)
  const all = shuffle([correct, ...wrong], mulberry32(order[0] * 31 + order[2] * 7 + 5))
  return { choices: all, answer: all.indexOf(correct) }
}

function mkS3(raw: (typeof S3)[number]): QuizItem {
  const { choices, answer } = orderChoices(raw.order)
  return {
    id: nextId(),
    sec: 'R3',
    no: 0,
    lines: [],
    jp: raw.jp,
    prefix: raw.prefix,
    chunks: raw.chunks,
    suffix: raw.suffix,
    choices,
    answer,
    jpFull: raw.full,
    exp: raw.exp,
  }
}

function mkL1(raw: (typeof L1)[number]): QuizItem {
  return {
    id: nextId(),
    sec: 'L1',
    no: 0,
    lines: [],
    choices: raw.choices,
    answer: raw.answer,
    jpFull: raw.jp,
    exp: raw.exp,
    audio: raw.lines,
  }
}

function mkL2(raw: (typeof L2)[number]): QuizItem {
  return {
    id: nextId(),
    sec: 'L2',
    no: 0,
    lines: [],
    question: raw.question,
    choices: raw.choices,
    answer: raw.answer,
    jpFull: raw.jp,
    exp: raw.exp,
    audio: [...raw.lines, raw.question],
  }
}

function mkL3(raw: (typeof L3)[number]): QuizItem {
  return {
    id: nextId(),
    sec: 'L3',
    no: 0,
    lines: [],
    scene: raw.scene,
    sceneJp: raw.sceneJp,
    choices: raw.choices,
    answer: raw.answer,
    jpFull: raw.jp,
    exp: raw.exp,
    audio: raw.choices,
  }
}

export type QuizSet = {
  id: string
  round: string
  date: string
  note: string
  reading: QuizItem[]
  listening: QuizItem[]
}

function buildSet(
  id: string,
  round: string,
  date: string,
  readingOffset: number,
  listeningMode: 'real' | 'drill',
  listeningSeed: number,
  note: string,
): QuizSet {
  const rand = mulberry32(listeningSeed)
  const reading: QuizItem[] = []
  const listening: QuizItem[] = []

  for (const raw of S1.slice(readingOffset * 15, readingOffset * 15 + 15)) reading.push(mkS1(raw))
  for (const raw of S2.slice(readingOffset * 5, readingOffset * 5 + 5)) reading.push(mkS2(raw))
  for (const raw of S3.slice(readingOffset * 5, readingOffset * 5 + 5)) reading.push(mkS3(raw))
  reading.forEach((it, i) => (it.no = i + 1))

  if (listeningMode === 'real') {
    // 2026年度第2回：公式のリスニング原稿・解答どおりに出題
    for (const raw of L1.slice(0, 10)) listening.push(mkL1(raw))
    for (const raw of L2.slice(0, 5)) listening.push(mkL2(raw))
    for (const raw of L3.slice(0, 10)) listening.push(mkL3(raw))
  } else {
    for (const raw of shuffle(L1.slice(10), rand).slice(0, 10)) listening.push(mkL1(raw))
    for (const raw of shuffle(L2.slice(5), rand).slice(0, 5)) listening.push(mkL2(raw))
    for (const raw of shuffle(L3.slice(10), rand).slice(0, 10)) listening.push(mkL3(raw))
  }
  listening.forEach((it, i) => (it.no = i + 1))

  return { id, round, date, note, reading, listening }
}

seq = 0
export const SETS: QuizSet[] = [
  buildSet(
    '2026-2',
    '2026年度 第2回',
    '2026年10月4日（日）実施',
    0,
    'real',
    20261004,
    '一次試験のリーディング25問・リスニング25問を、公式の解答どおりに収録しています。',
  ),
  buildSet(
    '2026-1',
    '2026年度 第1回',
    '2026年5月31日（日）実施',
    1,
    'drill',
    20260531,
    '2026年度第1回のリーディング過去問と、同形式のリスニング演習を収録しています。',
  ),
  buildSet(
    '2025-3',
    '2025年度 第3回',
    '2026年1月25日（日）実施',
    2,
    'drill',
    20260125,
    '2025年度第3回のリーディング過去問と、同形式のリスニング演習を収録しています。',
  ),
]

export function getSet(id: string): QuizSet | undefined {
  return SETS.find((s) => s.id === id)
}

/** ランダム演習：各回から問題をシャッフルして1セット作る */
export function buildRandom(seed: number, sections: Sec[]): QuizItem[] {
  const rand = mulberry32(seed)
  const items: QuizItem[] = []

  for (const sec of sections) {
    if (sec === 'R1') {
      const pool = SETS.flatMap((s) => s.reading.filter((i) => i.sec === 'R1'))
      items.push(...shuffle(pool, rand).slice(0, 8))
    } else if (sec === 'R2') {
      const pool = SETS.flatMap((s) => s.reading.filter((i) => i.sec === 'R2'))
      items.push(...shuffle(pool, rand).slice(0, 5))
    } else if (sec === 'R3') {
      const pool = SETS.flatMap((s) => s.reading.filter((i) => i.sec === 'R3'))
      items.push(...shuffle(pool, rand).slice(0, 5))
    } else if (sec === 'L1') {
      const pool = SETS.flatMap((s) => s.listening.filter((i) => i.sec === 'L1'))
      items.push(...shuffle(pool, rand).slice(0, 6))
    } else if (sec === 'L2') {
      const pool = SETS.flatMap((s) => s.listening.filter((i) => i.sec === 'L2'))
      items.push(...shuffle(pool, rand).slice(0, 5))
    } else {
      const pool = SETS.flatMap((s) => s.listening.filter((i) => i.sec === 'L3'))
      items.push(...shuffle(pool, rand).slice(0, 6))
    }
  }

  const out = shuffle(items, rand)
  out.forEach((it, i) => (it.no = i + 1))
  return out
}

/* ------------------------------------------------------------------ *
 * 自動生成モード：テンプレート＋過去問プールから新しい問題を作る
 * ------------------------------------------------------------------ */

function genId(seed: number) {
  return `gen-${seed.toString(36)}`
}

/** 毎回ちがう25問（リーディング15＋リスニング10）を作る */
export function buildGeneratedSet(seed: number): QuizSet {
  const rand = mulberry32(seed)
  const reading: QuizItem[] = []

  // 生成問題（テンプレート）10問
  generateReading(10, seed).forEach((g) => {
    reading.push({
      id: nextId(),
      sec: 'R1',
      no: 0,
      lines: g.lines,
      choices: g.choices,
      answer: g.answer,
      jpFull: g.jp,
      exp: g.exp,
    })
  })

  // 過去問プールから会話文3問・語句並べかえ2問
  shuffle(S2, rand)
    .slice(0, 3)
    .forEach((raw) => reading.push(mkS2(raw)))
  shuffle(S3, rand)
    .slice(0, 2)
    .forEach((raw) => reading.push(mkS3(raw)))

  const readingOut = shuffle(reading, rand)
  readingOut.forEach((it, i) => (it.no = i + 1))

  const listening: QuizItem[] = []
  shuffle(L1, rand).slice(0, 5).forEach((raw) => listening.push(mkL1(raw)))
  shuffle(L2, rand).slice(0, 3).forEach((raw) => listening.push(mkL2(raw)))
  shuffle(L3, rand).slice(0, 5).forEach((raw) => listening.push(mkL3(raw)))
  const listeningOut = shuffle(listening, rand)
  listeningOut.forEach((it, i) => (it.no = i + 1))

  return {
    id: genId(seed),
    round: '自動生成',
    date: 'オリジナル問題',
    note: '過去問の出題形式をもとに、テンプレートと問題プールから毎回ちがう問題を作成しています。',
    reading: readingOut,
    listening: listeningOut,
  }
}

/** gen-xxxx 形式のIDから生成セットを復元する */
export function getGeneratedSet(id: string): QuizSet | undefined {
  const m = /^gen-([0-9a-z]+)$/.exec(id)
  if (!m) return undefined
  const seed = parseInt(m[1], 36)
  if (!Number.isFinite(seed)) return undefined
  return buildGeneratedSet(seed)
}
