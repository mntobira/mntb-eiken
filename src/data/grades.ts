export type Grade = {
  id: string
  label: string
  level: string
  summary: string
  topics: string[]
  available: boolean
}

// Every grade has one independently authored focus unit, not a full mock exam.
export const GRADE_PAGES: Grade[] = [
  { id: '5', label: '5級', level: '中学初級程度', summary: '身近な単語や短い会話から、英語学習の基礎を固める。', topics: ['基本的な語彙・文法', '短い会話と語句並べかえ', '身近な場面のリスニング'], available: true },
  { id: '4', label: '4級', level: '中学中級程度', summary: '日常的な話題の文章や会話を読み取り、基礎を広げる。', topics: ['語彙・文法の確認', '日常的な文章の読解', '会話の内容理解'], available: true },
  { id: '3', label: '3級', level: '中学卒業程度', summary: '日常的な英語を理解し、自分の考えを短い英文で伝える。', topics: ['読解とリスニング', '英作文の練習', '面接での応答'], available: true },
  { id: 'pre-2', label: '準2級', level: '高校中級程度', summary: '学校や生活の話題について、情報を整理して考えを表現する。', topics: ['日常的な話題の読解', '英作文と情報整理', '会話・面接の練習'], available: true },
  { id: 'pre-2-plus', label: '準2級プラス', level: '高校上級程度', summary: '準2級から2級へ、少し長い文章の要点をつかむ力を育てる。', topics: ['文章の要点把握', '要約・意見表現', '会話と説明の聞き取り'], available: true },
  { id: '2', label: '2級', level: '高校卒業程度', summary: '社会的な話題を読み解き、根拠とともに自分の意見を伝える。', topics: ['社会的な話題の読解', '要約・意見論述', '説明や会話の理解'], available: true },
  { id: 'pre-1', label: '準1級', level: '大学中級程度', summary: '幅広い社会的な話題について、論点と根拠を捉えて表現する。', topics: ['幅広い語彙と論説の読解', '要約・論理的な意見論述', '長い説明・対話の理解'], available: true },
]

export const gradeHref = (grade: Grade) => `/grades/${grade.id}`
export const findGrade = (id: string) => GRADE_PAGES.find(grade => grade.id === id)
