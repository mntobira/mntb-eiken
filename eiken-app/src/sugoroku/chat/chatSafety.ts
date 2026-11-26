/**
 * ============================================================================
 * クラス内 1対1 トーク アプリ内安全性ガード（青少年保護・個人連絡先漏洩防止・暴言抑止）
 * ============================================================================
 *
 * ■ 教育現場（学習塾・中高生指導）で最重要となるアプリ内安全基準
 * 1. 個人連絡先・外部SNSへの私的誘導ブロック（密室トラブル・規約違反防止）：
 *    携帯電話番号（070/080/090等）・個人メールアドレス・LINE ID / Instagram / Discord /
 *    TikTok / X(Twitter) / カカオ等の外部SNSアカウント交換を含むメッセージを送信前に検知・遮断。
 * 2. 重大な暴言・脅迫・自傷誘発表現のブロック：
 *    英検学習の英単語（skill / studied / diet / sixth 等）を誤検知しないホワイトリストを維持しつつ、
 *    全角半角・カタカナ・伏せ字を正規化した上で深刻な暴言・脅迫語を遮断する。
 */

const SAFE_ENGLISH_STUDY_WORDS = [
  'skill',
  'skills',
  'skilled',
  'studied',
  'studies',
  'diet',
  'diets',
  'died',
  'diesel',
  'soldier',
  'soldiers',
  'essex',
  'sussex',
  'sixth',
  'document',
  'class',
  'classes',
  'classic',
  'assignment',
  'assignments',
  'assess',
  'assessment',
  'pass',
  'passage',
  'passages',
  'passenger',
  'glass',
  'grass',
  'mass',
  'embassy',
  'associate',
  'assume',
  'assure',
  'assist',
  'assistant',
  'assistance',
  'title',
  'titles',
  'analysis',
  'therapist',
  'grape',
  'grapes',
  'scrape',
  'drape',
  'たいまつ',
  'ころすけ',
  'しんでん',
  'かたわら',
  'ばかり',
] as const;

const SEVERE_ABUSE_WORDS = [
  '死ね',
  '殺す',
  '殺せ',
  '自殺しろ',
  '消えろカス',
  'きえろかす',
  'しねばいい',
  'ころしてやる',
  'れいぷ',
  'レイプ',
  '覚醒剤',
  'かくせいざい',
  'ちんこ',
  'まんこ',
  'やりまん',
] as const;

// 日本の携帯・固定電話番号（ハイフン・スペース・全角数字対応）
const JP_PHONE_RE =
  /(?:^|[^\d])0[5789]0[\s\-‐－ー]?\d{4}[\s\-‐－ー]?\d{4}(?:[^\d]|$)/;

// メールアドレス
const EMAIL_RE = /[a-z0-9._%+-]{2,}@[a-z0-9.-]+\.[a-z]{2,}/i;

// 外部個人SNSへの誘導・ID交換パターン（「LINE報告不要」などの一般文脈と誤爆しないよう ID/追加/交換/DM 等と組で検知）
const EXTERNAL_SNS_SOLICIT_RE =
  /(?:line|ライン|らいん|insta(?:gram)?|インスタ|カカオ|kakao|discord|ディスコ|tiktok|ティックトック)\s*(?:の?\s*(?:id|ｉｄ|アイディー|アカウント|垢|qr|コード)|交換|追加して|教えて|つながろ|繋がろ|dmして|ｄｍして)/i;

// 外部招待URL直貼り（LINE友だち追加URL・Discord招待URL・オープンチャットURL）
const EXTERNAL_INVITE_URL_RE =
  /https?:\/\/(?:line\.me\/ti\/|lin\.ee\/|discord\.gg\/|discord\.com\/invite\/|t\.me\/)/i;

export type ChatSafetyViolation = 'personal_contact' | 'external_sns' | 'severe_abuse';

export interface ChatSafetyResult {
  ok: boolean;
  violation?: ChatSafetyViolation;
  message?: string;
}

function normalizeJaText(raw: string): string {
  let s = (raw || '').normalize('NFKC').toLowerCase();
  for (const allow of SAFE_ENGLISH_STUDY_WORDS) {
    s = s.split(allow.toLowerCase()).join(' ');
  }
  // カタカナ → ひらがな
  s = s.replace(/[\u30a1-\u30f6]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0x60));
  return s;
}

/**
 * 1対1クラスチャットの送信前セーフティ検証
 */
export function checkClassChatSafety(rawText: string): ChatSafetyResult {
  const normalizedNfkc = (rawText || '').normalize('NFKC');
  if (!normalizedNfkc.trim()) {
    return { ok: true };
  }

  if (JP_PHONE_RE.test(normalizedNfkc) || EMAIL_RE.test(normalizedNfkc)) {
    return {
      ok: false,
      violation: 'personal_contact',
      message:
        '安全保護のため、電話番号やメールアドレスなどの個人連絡先はチャットに送信できません。連絡はこのアプリ内のトークをご利用ください。',
    };
  }

  if (
    EXTERNAL_INVITE_URL_RE.test(normalizedNfkc) ||
    EXTERNAL_SNS_SOLICIT_RE.test(normalizedNfkc)
  ) {
    return {
      ok: false,
      violation: 'external_sns',
      message:
        '青少年保護・安全ガイドラインにより、個人のLINE・Instagram・Discord等の外部SNSアカウント交換や招待リンクは送信できません。',
    };
  }

  const norm = normalizeJaText(normalizedNfkc);
  const compact = norm.replace(/[\s\p{P}\p{S}ー〜~_]/gu, '');
  for (const w of SEVERE_ABUSE_WORDS) {
    const nw = normalizeJaText(w).replace(/[\s\p{P}\p{S}ー〜~_]/gu, '');
    if (nw && compact.includes(nw)) {
      return {
        ok: false,
        violation: 'severe_abuse',
        message:
          '相手を傷つける強い表現や不適切な語句が含まれているため送信できません。表現を見直してください。',
      };
    }
  }

  return { ok: true };
}
