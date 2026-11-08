export type OriginalQuestion = {
  skill: string
  prompt: string
  choices: [string, string, string, string]
  answer: number
  evidence: string
  reasons: [string, string, string, string]
}
export type ReadingBlock = { title: string; text: string; questions: [OriginalQuestion, OriginalQuestion] }
export type ListeningBlock = { title: string; script: string[]; question: OriginalQuestion }
export type WritingTask = { id: string; title: string; instruction: string; source?: string; target: string; model: string; commentary: string; checklist: string[] }
export type OriginalUnit = {
  grade: string
  theme: string
  focus: string
  minutes: number
  vocabulary: [OriginalQuestion, OriginalQuestion]
  readings: [ReadingBlock, ReadingBlock]
  listenings: [ListeningBlock, ListeningBlock]
  writing: WritingTask[]
}
export const mc = (skill: string, prompt: string, choices: OriginalQuestion['choices'], answer: number, evidence: string, reasons: OriginalQuestion['reasons']): OriginalQuestion => ({ skill, prompt, choices, answer, evidence, reasons })
export const AUTHORING_POLICY = {
  origin: 'independently-authored' as const,
  version: '2026-11-original-01',
  prohibited: ['past-paper reuse', 'paraphrase of past-paper text', 'name or number substitution in existing questions'],
  scope: '重点演習。公式の問題数・全出題形式を再現する模試ではありません。',
  review: '執筆時の根拠・誤答理由の確認と機械検証を実施。外部専門家による校閲・受験者データによる難度検証は未実施。',
}
