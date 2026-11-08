/**
 * 英文法「セットで覚える」表現の一覧（C9・2026-10-29 ご指摘）。
 *
 * ■ なぜ要るか
 *   決まった言い方（例：分詞構文の Frankly speaking）は、1問で1つしか問題にできない。
 *   generally speaking や strictly speaking は問題として出てこないので、
 *   解説で「仲間の表現」としてまとめて見せないと覚える機会がない。
 *
 * ■ 使い方（englishGrammarKit.ts の buildEgSet が呼ぶ）
 *   完成文が trigger に当てはまったら、その仲間のうち
 *   「完成文にも解説本文にもまだ出てこない」ものだけを【セットで覚える】の1行にして足す。
 *   全部すでに触れていれば何も足さない（同じことを2回書かない）。
 *
 * ■ このファイルは何も import しない（葉）。表現と訳は手で書いたもの。
 */

export interface MemorizeMember {
  /** 表示する英語（～ は語が入る所） */
  en: string;
  ja: string;
  /** 「もう出ている」かの判定。省略時は en から ～ を除いた語句をそのまま探す */
  key?: RegExp;
}

export interface MemorizeFamily {
  label: string;
  /** 完成文がこれに当てはまったら、この仲間を出す */
  trigger: RegExp;
  members: readonly MemorizeMember[];
}

export const MEMORIZE_FAMILIES: readonly MemorizeFamily[] = [
  {
    label: '慣用的な分詞構文',
    trigger: /\b(frankly|generally|strictly|roughly|honestly) speaking\b|\bjudging from\b|\bspeaking of\b|\btalking of\b/i,
    members: [
      { en: 'frankly speaking', ja: '率直に言えば' },
      { en: 'generally speaking', ja: '一般的に言えば' },
      { en: 'strictly speaking', ja: '厳密に言えば' },
      { en: 'roughly speaking', ja: 'おおざっぱに言えば' },
      { en: 'judging from ～', ja: '～から判断すると' },
      { en: 'speaking of ～', ja: '～と言えば' },
    ],
  },
  {
    label: '独立不定詞',
    trigger: /\bto tell (you )?the truth\b|\bto be (frank|honest)\b|\bso to speak\b|\bneedless to say\b|\bstrange to say\b|\bto begin with\b|\bto make matters worse\b|\bnot to (mention|speak of)\b|\bto say nothing of\b/i,
    members: [
      { en: 'to tell (you) the truth', ja: '実を言うと', key: /\bto tell (you )?the truth\b/i },
      { en: 'to be frank', ja: '率直に言うと' },
      { en: 'so to speak', ja: 'いわば' },
      { en: 'needless to say', ja: '言うまでもなく' },
      { en: 'to begin with', ja: 'まず第一に' },
      { en: 'to make matters worse', ja: 'さらに悪いことに' },
      { en: 'not to mention ～／to say nothing of ～', ja: '～は言うまでもなく', key: /\bnot to (mention|speak of)\b|\bto say nothing of\b/i },
    ],
  },
  {
    label: '動名詞を使う決まった言い方',
    trigger: /\b(cannot|can't|couldn't) help \w+ing\b|\bno use \w+ing\b|\bthere is no \w+ing\b|\bfeel like \w+ing\b|\blook(s|ed|ing)? forward to \w+ing\b|\bworth \w+ing\b|\b(am|is|are|was|were|be|been|get|got|getting) used to \w+ing\b/i,
    members: [
      { en: 'cannot help ～ing', ja: '～せずにはいられない', key: /\b(cannot|can't|couldn't) help \w+ing\b/i },
      { en: 'It is no use ～ing', ja: '～しても無駄だ', key: /\bno use \w+ing\b/i },
      { en: 'There is no ～ing', ja: '～することはできない', key: /\bthere is no \w+ing\b/i },
      { en: 'feel like ～ing', ja: '～したい気がする', key: /\bfeel like \w+ing\b/i },
      { en: 'look forward to ～ing', ja: '～するのを楽しみにする', key: /\blook(s|ed|ing)? forward to\b/i },
      { en: 'be worth ～ing', ja: '～する価値がある', key: /\bworth \w+ing\b/i },
      { en: 'be used to ～ing', ja: '～するのに慣れている', key: /\bused to \w+ing\b/i },
    ],
  },
  {
    label: 'no more than などの数量の言い方',
    trigger: /\bno (more|less) than\b|\bnot (more|less) than\b/i,
    members: [
      { en: 'no more than ～', ja: 'たった～（only）' },
      { en: 'no less than ～', ja: '～も（as many / as much as）' },
      { en: 'not more than ～', ja: 'せいぜい～（at most）' },
      { en: 'not less than ～', ja: '少なくとも～（at least）' },
    ],
  },
  {
    label: '「～するとすぐに」',
    trigger: /\bno sooner\b|\bhardly\b[^.]*\b(when|before)\b|\bscarcely\b[^.]*\b(when|before)\b/i,
    members: [
      { en: 'no sooner A than B', ja: 'A するとすぐに B', key: /\bno sooner\b/i },
      { en: 'hardly／scarcely A when／before B', ja: 'A するとすぐに B', key: /\b(hardly|scarcely)\b[^.]*\b(when|before)\b/i },
      { en: 'as soon as ～', ja: '～するとすぐに' },
      { en: 'the moment ～', ja: '～した瞬間に', key: /\bthe (moment|instant)\b/i },
    ],
  },
  {
    label: '「～する限り」',
    trigger: /\bas (long|far) as\b/i,
    members: [
      { en: 'as long as ～', ja: '～する限り（条件・時間）' },
      { en: 'as far as ～', ja: '～する限り（範囲・程度）' },
    ],
  },
  {
    label: '「～にもかかわらず」（前置詞）',
    trigger: /\bin spite of\b|\bdespite\b/i,
    members: [
      { en: 'in spite of ～', ja: '～にもかかわらず' },
      { en: 'despite ～', ja: '～にもかかわらず（of を付けない）', key: /\bdespite\b/i },
      { en: 'for all ～', ja: '～にもかかわらず', key: /\bfor all\b/i },
    ],
  },
  {
    label: '「～のために・～が原因で」（前置詞）',
    trigger: /\bbecause of\b|\bdue to\b|\bowing to\b|\bon account of\b/i,
    members: [
      { en: 'because of ～', ja: '～のために' },
      { en: 'due to ～', ja: '～が原因で' },
      { en: 'owing to ～', ja: '～のために' },
      { en: 'on account of ～', ja: '～のために' },
      { en: 'thanks to ～', ja: '～のおかげで' },
    ],
  },
  {
    label: '「～がなければ」',
    trigger: /\bbut for\b|\bif it (were|was|had) not (been )?for\b|\b(were|had) it not (been )?for\b/i,
    members: [
      { en: 'if it were not for ～／were it not for ～', ja: '（今）～がなければ', key: /\bif it (were|was) not for\b|\bwere it not for\b/i },
      { en: 'if it had not been for ～／had it not been for ～', ja: '（あのとき）～がなかったら', key: /\bif it had not been for\b|\bhad it not been for\b/i },
      { en: 'but for ～／without ～', ja: '～がなければ（今にも過去にも）', key: /\bbut for\b/i },
    ],
  },
  {
    label: 'no matter ＋疑問詞 ＝ 疑問詞-ever',
    trigger: /\bno matter (how|what|who|when|where|which)\b|\b(however|whatever|whoever|whenever|wherever)\b/i,
    members: [
      { en: 'no matter how ＝ however', ja: 'どんなに～でも', key: /\bno matter how\b|\bhowever\b/i },
      { en: 'no matter what ＝ whatever', ja: '何が（を）～でも', key: /\bno matter what\b|\bwhatever\b/i },
      { en: 'no matter who ＝ whoever', ja: '誰が（を）～でも', key: /\bno matter who\b|\bwhoever\b/i },
      { en: 'no matter when ＝ whenever', ja: 'いつ～でも', key: /\bno matter when\b|\bwhenever\b/i },
      { en: 'no matter where ＝ wherever', ja: 'どこで（へ）～でも', key: /\bno matter where\b|\bwherever\b/i },
    ],
  },
  {
    label: '部分否定（全部が～とは限らない）',
    trigger: /\bnot (always|necessarily|all|every|both|quite|entirely)\b/i,
    members: [
      { en: 'not always', ja: 'いつも～とは限らない' },
      { en: 'not necessarily', ja: '必ずしも～ではない' },
      { en: 'not all／not every', ja: 'すべてが～とは限らない', key: /\bnot (all|every)\b/i },
      { en: 'not both', ja: '両方とも～というわけではない' },
      { en: 'not quite／not entirely', ja: '完全に～というわけではない', key: /\bnot (quite|entirely)\b/i },
    ],
  },
  {
    label: '助動詞を使う決まった言い方',
    trigger: /\bhad better\b|\bwould rather\b|\b(may|might) as well\b|\bmay well\b/i,
    members: [
      { en: 'had better ～', ja: '～したほうがよい（しないと困る）' },
      { en: 'would rather ～', ja: '（どちらかと言えば）～したい' },
      { en: 'may as well ～', ja: '～したほうがましだ', key: /\b(may|might) as well\b/i },
      { en: 'may well ～', ja: '～するのももっともだ・たぶん～だろう' },
      { en: 'cannot ～ too …', ja: 'いくら～してもしすぎることはない', key: /\bcannot\b[^.]*\btoo\b/i },
    ],
  },
];

function keyOf(m: MemorizeMember): RegExp {
  if (m.key) return m.key;
  const plain = m.en.replace(/\s*～\s*/gu, ' ').trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+');
  return new RegExp(`\\b${plain}\\b`, 'i');
}

/** 完成文と解説本文から【セットで覚える】の1行を作る。当てはまらなければ空文字。 */
export function memorizeSetLine(sentence: string, commentary: string): string {
  const s = String(sentence || '');
  if (!s) return '';
  const family = MEMORIZE_FAMILIES.find((f) => f.trigger.test(s));
  if (!family) return '';
  const already = `${s}\n${commentary || ''}`;
  const rest = family.members.filter((m) => !keyOf(m).test(already));
  if (rest.length === 0) return '';
  return `【セットで覚える】${family.label}：${rest.map((m) => `${m.en}（${m.ja}）`).join('／')}`;
}
