import { wordCount } from '../../eiken/writingProgress';

export type WritingTaskKind = 'email' | 'summary' | 'essay' | 'basic';

export interface FormatCheckIssue {
  code:
    | 'empty'
    | 'word_under'
    | 'word_over'
    | 'sentence_start_lowercase'
    | 'lowercase_pronoun_i'
    | 'missing_terminal_punctuation'
    | 'fullwidth_punctuation'
    | 'repeated_word'
    | 'spelling_suspect'
    | 'email_questions_shortage'
    | 'summary_verbatim_copy'
    | 'essay_signpost_hint';
  severity: 'warn' | 'info';
  message: string;
}

export interface FormatCheckResult {
  words: number;
  sentenceCount: number;
  inTargetRange: boolean;
  issues: FormatCheckIssue[];
  /** Firestore writing_submissions.formatWarnings にそのまま保存する文字列配列 */
  formatWarnings: string[];
  /** すべてクリアしているか（warn が 0 件か） */
  passedAll: boolean;
}

/**
 * 中高生・英検受験者が頻出で打ち間違える基本英単語辞書（外部APIゼロで高速検出）
 */
const COMMON_MISSPELLINGS: Readonly<Record<string, string>> = {
  becouse: 'because',
  beacuse: 'because',
  becuase: 'because',
  enviroment: 'environment',
  enviornment: 'environment',
  goverment: 'government',
  governmant: 'government',
  recieve: 'receive',
  beleive: 'believe',
  definately: 'definitely',
  definitly: 'definitely',
  occured: 'occurred',
  untill: 'until',
  studing: 'studying',
  trulye: 'truly',
  truely: 'truly',
  alot: 'a lot',
  thier: 'their',
  wich: 'which',
  whitch: 'which',
  diffrent: 'different',
  differnt: 'different',
  importent: 'important',
  conveniant: 'convenient',
  convinient: 'convenient',
  nesessary: 'necessary',
  neccessary: 'necessary',
  seperate: 'separate',
  intresting: 'interesting',
  intersting: 'interesting',
  knowlege: 'knowledge',
  oppinion: 'opinion',
  opinon: 'opinion',
  tommorow: 'tomorrow',
  tomorow: 'tomorrow',
  freind: 'friend',
  freinds: 'friends',
  childrens: 'children',
  informations: 'information',
  peoples: 'people',
  everytime: 'every time',
  nowdays: 'nowadays',
  accomodation: 'accommodation',
  oppurtunity: 'opportunity',
  oportunity: 'opportunity',
  recomend: 'recommend',
  exersise: 'exercise',
  excercise: 'exercise',
  benifit: 'benefit',
  benifits: 'benefits',
  tecnology: 'technology',
  technorogy: 'technology',
  communicaton: 'communication',
  futhermore: 'furthermore',
  howerver: 'however',
  therfore: 'therefore',
};

function findLongVerbatimOverlap(answerText: string, sourceText: string, minWords = 8): string | null {
  const norm = (s: string) =>
    (s.toLowerCase().replace(/’/g, "'").match(/[a-z]+(?:['-][a-z]+)*/g) ?? []);
  const srcWords = norm(sourceText);
  const ansWords = norm(answerText);
  if (srcWords.length < minWords || ansWords.length < minWords) return null;

  const srcPhrases = new Set<string>();
  for (let i = 0; i + minWords <= srcWords.length; i++) {
    srcPhrases.add(srcWords.slice(i, i + minWords).join(' '));
  }
  for (let i = 0; i + minWords <= ansWords.length; i++) {
    const candidate = ansWords.slice(i, i + minWords).join(' ');
    if (srcPhrases.has(candidate)) {
      return candidate;
    }
  }
  return null;
}

/**
 * 生徒の英作文に対するリアルタイム形式・スペル・課題別セルフチェックを行う。
 * 採点（内容評価）ではなく、提出前に自分で気づける減点予防に特化。
 */
export function analyzeWritingFormat(
  rawText: string,
  targetRange: [number, number] | null,
  taskKind: WritingTaskKind = 'essay',
  sourceText?: string,
): FormatCheckResult {
  const text = String(rawText ?? '');
  const trimmed = text.trim();
  const words = wordCount(trimmed);
  const issues: FormatCheckIssue[] = [];

  if (!trimmed || words === 0) {
    issues.push({
      code: 'empty',
      severity: 'warn',
      message: '英文がまだ入力されていません。',
    });
    return {
      words: 0,
      sentenceCount: 0,
      inTargetRange: false,
      issues,
      formatWarnings: issues.map(i => i.message),
      passedAll: false,
    };
  }

  const sentenceCount = (trimmed.match(/[.?!]+(?=\s|$|["'”’)])/g) ?? []).length;

  let inTargetRange = true;
  if (targetRange) {
    const [min, max] = targetRange;
    if (words < min) {
      inTargetRange = false;
      issues.push({
        code: 'word_under',
        severity: 'warn',
        message: `語数が目安（${min}〜${max}語）より ${min - words}語 少ない状態です（現在 ${words}語）。`,
      });
    } else if (words > max) {
      inTargetRange = false;
      issues.push({
        code: 'word_over',
        severity: 'warn',
        message: `語数が目安（${min}〜${max}語）を ${words - max}語 超えています（現在 ${words}語）。`,
      });
    }
  }

  // 全角句読点・全角スペース・全角英数字の混入チェック
  if (/[。、！？．，「」『』（）Ａ-Ｚａ-ｚ０-９]/.test(trimmed)) {
    issues.push({
      code: 'fullwidth_punctuation',
      severity: 'warn',
      message:
        '全角の句読点（。、！？）または全角英数字が含まれています。半角の「.」「,」「?」に直しましょう。',
    });
  }

  // 終端ピリオド・疑問符・感嘆符のチェック
  const paragraphs = trimmed
    .split(/\n+/)
    .map(p => p.trim())
    .filter(Boolean);
  const missingEnd = paragraphs.some(p => !/[.?!]["'”’)]*$/.test(p));
  if (missingEnd) {
    issues.push({
      code: 'missing_terminal_punctuation',
      severity: 'warn',
      message: '文末（または段落末）にピリオド「.」や疑問符「?」が抜けている箇所があります。',
    });
  }

  // 文頭の小文字始まり検出（段落先頭、および . ? ! の直後の単語）
  const startsWithLower = paragraphs.some(p => /^[a-z]/.test(p));
  const afterPunctLower = /[.?!]\s+([a-z][a-z']*)/.exec(trimmed);
  if (startsWithLower || afterPunctLower) {
    const sample = afterPunctLower ? `（例: "${afterPunctLower[1]}"）` : '';
    issues.push({
      code: 'sentence_start_lowercase',
      severity: 'warn',
      message: `文の先頭が小文字で始まっている箇所があります${sample}。文頭は大文字にしましょう。`,
    });
  }

  // 単独の小文字 "i" や "i'm", "i've", "i'll", "i'd" の検出
  if (/(?:^|[^A-Za-z])i(?:'(?:m|ve|ll|d))?(?=[^A-Za-z]|$)/.test(trimmed)) {
    issues.push({
      code: 'lowercase_pronoun_i',
      severity: 'warn',
      message: '一人称の「I（私）」が小文字の "i" になっています。必ず大文字の "I" にしましょう。',
    });
  }

  // 同じ単語の連続入力（例: the the, to to, is is）
  const repeatedMatch = /\b([A-Za-z]{2,})\s+\1\b/i.exec(trimmed);
  if (repeatedMatch && repeatedMatch[1].toLowerCase() !== 'had') {
    issues.push({
      code: 'repeated_word',
      severity: 'info',
      message: `同じ単語 "${repeatedMatch[1]}" が2回連続しています。入力ミスがないか確認しましょう。`,
    });
  }

  // 頻出スペル注意語の検出
  const tokens = trimmed.match(/[A-Za-z]+(?:['’-][A-Za-z]+)*/g) ?? [];
  const foundTypos = new Map<string, string>();
  for (const rawToken of tokens) {
    const lower = rawToken.toLowerCase().replace(/’/g, "'");
    const suggestion = COMMON_MISSPELLINGS[lower];
    if (suggestion && !foundTypos.has(lower)) {
      foundTypos.set(lower, suggestion);
    }
  }
  if (foundTypos.size > 0) {
    const pairs = [...foundTypos.entries()]
      .slice(0, 4)
      .map(([wrong, right]) => `"${wrong}" → "${right}"`)
      .join('、');
    issues.push({
      code: 'spelling_suspect',
      severity: 'warn',
      message: `スペル注意の語が見つかりました：${pairs}`,
    });
  }

  // Eメール返信課題：相手への質問（?）の数チェック
  if (taskKind === 'email') {
    const questionMarks = (trimmed.match(/\?/g) ?? []).length;
    if (questionMarks < 2) {
      issues.push({
        code: 'email_questions_shortage',
        severity: 'info',
        message: `Eメール課題では相手への質問が2つ求められることが多いです（現在の「?」の数：${questionMarks}個）。`,
      });
    }
  }

  // 英文要約課題：元の本文からの丸写し（8語以上の完全一致）注意チェック
  if (taskKind === 'summary' && sourceText) {
    const copied = findLongVerbatimOverlap(trimmed, sourceText, 8);
    if (copied) {
      issues.push({
        code: 'summary_verbatim_copy',
        severity: 'warn',
        message: `元の英文から8語以上そのまま抜き出している箇所があります（"${copied}..."）。英検要約では自分の言葉への言い換え（パラフレーズ）が重要です。`,
      });
    }
  }

  // 意見論述課題：理由の接続表現（First / Second 等）の案内（30語以上書いていて未含有の場合）
  if (taskKind === 'essay' && words >= 30) {
    const hasSignposts = /\b(first|firstly|second|secondly|moreover|furthermore|in addition|also)\b/i.test(
      trimmed,
    );
    if (!hasSignposts) {
      issues.push({
        code: 'essay_signpost_hint',
        severity: 'info',
        message:
          '構成ヒント：「First, ...」「Second, ...」などのつなぎ言葉を入れると、2つの理由の区切りが採点者に伝わりやすくなります。',
      });
    }
  }

  return {
    words,
    sentenceCount,
    inTargetRange,
    issues,
    formatWarnings: issues.map(i => i.message),
    passedAll: issues.length === 0,
  };
}
