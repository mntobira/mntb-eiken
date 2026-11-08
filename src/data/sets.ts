import { FOUNDATION_UNITS } from './original-foundation'
import { INTERMEDIATE_UNITS } from './original-intermediate'
import { BRIDGE_UNIT } from './original-bridge'
import { UPPER_UNIT } from './original-upper'
import { ADVANCED_UNIT } from './original-advanced'
import { AUTHORING_POLICY, type OriginalQuestion, type OriginalUnit, type WritingTask } from './original-types'
import { findGrade } from './grades'

export type Sec = 'R1' | 'R2' | 'R3' | 'L1' | 'L2' | 'L3'
export const SEC_LABEL: Record<Sec, string> = { R1: '語彙・文法', R2: '読解', R3: '語句整序', L1: '応答', L2: '聞き取り', L3: '図版理解' }
export const SEC_GUIDE: Record<Sec, string> = {
  R1: '文脈に合う語句を一つ選びます。', R2: '独自の本文を読み、本文の根拠に合う答えを一つ選びます。',
  R3: '語句を並べかえます。', L1: '応答を選びます。', L2: '音声を聞き、話者の意図や内容に合う答えを一つ選びます。', L3: '図版に合う文を選びます。',
}
export const SEC_COUNT: Record<Sec, number> = { R1: 4, R2: 4, R3: 4, L1: 4, L2: 4, L3: 4 }
export const isListening = (sec: Sec) => sec.startsWith('L')

export type QuizItem = {
  id: string; sec: Sec; no: number; lines: string[]; choices: string[]; answer: number; jpFull: string; exp: string
  question?: string; audio?: string[]; passage?: string; passageTitle?: string; skill: string; evidence: string; reasons: string[]
  scene?: string; sceneJp?: string; jp?: string; prefix?: string; chunks?: string[]; suffix?: string
}
export type QuizSet = {
  id: string; grade: string; gradeLabel: string; round: string; date: string; note: string
  reading: QuizItem[]; listening: QuizItem[]; writing: WritingTask[]; minutes: number; unit: OriginalUnit
  provenance: typeof AUTHORING_POLICY
}
export const UNITS = [...FOUNDATION_UNITS, ...INTERMEDIATE_UNITS, BRIDGE_UNIT, UPPER_UNIT, ADVANCED_UNIT]

function buildOriginalSet(unit: OriginalUnit): QuizSet {
  const id = `original-${unit.grade}-01`
  let readingNo = 0
  const item = (raw: OriginalQuestion, sec: Sec, no: number): QuizItem => ({
    ...raw, id: `${id}-${sec}-${no}`, sec, no, lines: sec === 'R1' ? [raw.prompt] : [],
    choices: [...raw.choices], jpFull: `根拠：${raw.evidence}`, exp: raw.reasons.map((reason, i) => `${i + 1}: ${reason}`).join('\n'),
  })
  const reading = unit.vocabulary.map(raw => item(raw, 'R1', ++readingNo))
  for (const block of unit.readings) for (const raw of block.questions) reading.push({
    ...item(raw, 'R2', ++readingNo), passage: block.text, passageTitle: block.title, question: raw.prompt,
  })
  const listening = unit.listenings.map((block, i) => ({ ...item(block.question, 'L2', i + 1), question: block.question.prompt, audio: [...block.script], passageTitle: block.title }))
  return {
    id, grade: unit.grade, gradeLabel: findGrade(unit.grade)?.label ?? unit.grade, round: `オリジナル重点演習 01｜${unit.theme}`,
    date: '独立執筆・初版', note: AUTHORING_POLICY.scope, reading, listening, writing: unit.writing,
    minutes: unit.minutes, unit, provenance: AUTHORING_POLICY,
  }
}
export const SETS = UNITS.map(buildOriginalSet)
export const getSet = (id: string) => SETS.find(set => set.id === id)
export const getGradeSet = (grade: string) => SETS.find(set => set.grade === grade)
// Legacy pools and template-based substitutions have no runtime entry point.
