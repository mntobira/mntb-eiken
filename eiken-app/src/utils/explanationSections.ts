/**
 * 小問・大問ごとに解説を区切って並べる処理（Phase 5 / A3 で explanationFormat.ts から移した）。
 *
 * ■ 中身は1文字も変えていない
 *   explanationFormat.ts の該当範囲（見出しカード〜buildInterleavedSections）をそのまま移し、
 *   explanationFormat.ts から使う関数にだけ export を付けた。
 *   移す前後で、全教科 373 問の enhanceExplanation の出力が完全に一致することを確かめている。
 *
 * ■ 外からの使い方は変わらない
 *   buildQuestionGroupParts・QuestionGroupParts は explanationFormat.ts が再エクスポートしている。
 */
import { ANS, LABEL } from './explanationSupplement';
import type { SubQuestionLike, QuestionLike } from './explanationShapes';
import { plainLine, subMarkerCandidates, splitBodyBySubQuestions, questionGroupKey, splitBodyByQuestionGroups, dedupeAgainstSteps } from './explanationMarkers';
import type { BodySegments } from './explanationMarkers';
import { GROUP_MARK, SQ_MARK, SQ_BODY_MARK, SQ_SHARED_MARK } from './explanationSlices';
import { DETAIL_TITLE, STEPS_TITLE, formatSubSteps, subsWithSteps } from './explanationSteps';

/**
 * 小問1つぶんの「見出しカード」。
 *
 * ■ 設計の意図（生徒にとっての分かりやすさ）
 * 参考書を読む生徒がまず知りたいのは、順に
 *   1. これはどの問いか（(ア) など）
 *   2. 何を問われているのか（テーマ＝一言でいうと何の問題か）
 *   3. 答えは何か（先に答えを見せてから理由を読む＝先行オーガナイザ）
 * の3つ。従来はこの3つが解説本文のあちこちに散っていたため、
 * 生徒は「今どの問いの話を読んでいるのか」を見失いやすかった。
 * ここで3つを1枚のカードに集約し、必ずこの順で提示する。
 *
 * ★内容は問題データ（label / theme / correctAnswer）をそのまま使う。
 *   要約も言い換えもしていない★
 */
export function subQuestionCard(sub: SubQuestionLike, index: number): string {
  const label = (sub.label || '').trim() || `小問${index + 1}`;
  const theme = (sub.detailedExplanation?.theme || '').trim();
  const answer = sub.correctAnswer ? String(sub.correctAnswer).trim() : '';
  const isFree = sub.type === 'descriptive';

  const rows: string[] = [];
  rows.push(
    '<div style="background-color:#FFF1F5; border-left:6px solid #D9466E; border-radius:8px; padding:8px 12px; margin-top:6px;">' +
      `<span style="display:inline-block; background-color:#D9466E; color:#FFFFFF; font-weight:bold; font-size:max(12px, 0.86em); padding:1px 12px; border-radius:999px;">${label}</span>` +
      (theme
        ? `<span style="color:#8A2E4A; font-weight:bold; margin-left:8px;">${theme}</span>`
        : '') +
      '</div>',
  );
  if (answer) {
    rows.push(`　${ANS(`${isFree ? '【解答例】' : '【解答】'}${answer}`)}`);
  }
  return rows.join('\n');
}

/** 問ごとの区切り線（画面を横断する仕切り） */
export function groupDivider(): string {
  return '<div style="border-top:2px dashed #E9688E; opacity:0.55; margin:20px 0 12px;"></div>';
}

/** 問ごとの見出し（「問1」など） */
function groupHeading(key: string): string {
  return `<div style="font-weight:bold; font-size:1.05em; color:#B03A5B; letter-spacing:0.04em; margin-bottom:2px;">問${key}</div>`;
}

/**
 * 1問（問N）ぶんの解説パーツ。
 * 画面側（採点結果のアコーディオン）でも同じ切り分けを再利用する。
 */
export interface QuestionGroupParts {
  /** 問キー（'1' など）。問番号を持たない大問では '' */
  key: string;
  /** この問に属する小問 */
  subs: SubQuestionLike[];
  /** 解法の思考手順の本体（ラベルなし・空文字なら無し） */
  steps: string;
  /** 詳しい解説の本体（ラベルなし・空文字なら無し） */
  detail: string;
}

/**
 * 1つの大問を「問N」単位に組み替える。
 *
 * ■ 目的（要件②）
 * 従来は「全問の思考手順」→「全問の詳しい解説」という並びだったため、
 * 問1の解説を読むには画面を大きく下へ送る必要があった。
 * ここで問ごとに ［思考手順 → 詳しい解説］ を隣接させ、
 * 「1問を見れば、その問題に必要な情報がその場で完結する」状態にする。
 *
 * 分割できない大問（問番号が無い／本文に境界が無い）は
 * 1グループ（key=''）として返すため、全単元で同じ呼び出し方が使える。
 */
export function buildQuestionGroupParts(
  question: QuestionLike,
  body: string,
): { lead: string; groups: QuestionGroupParts[] } {
  const subs = (question.subQuestions || []).filter(Boolean) as SubQuestionLike[];
  const keys: string[] = [];
  for (const sub of subs) {
    const key = questionGroupKey(sub.label);
    if (key && !keys.includes(key)) keys.push(key);
  }

  const stepsOf = (list: SubQuestionLike[]): string =>
    subsWithSteps(list)
      .map((sub) => formatSubSteps(sub))
      .join('\n\n');

  // 問番号が2つ以上あり、かつ本文をその境界で切れるときだけ問ごとに分ける。
  const segmented = keys.length >= 2 ? splitBodyByQuestionGroups(body, keys) : null;

  if (!segmented) {
    return {
      lead: '',
      groups: [{ key: '', subs, steps: stepsOf(subs), detail: body }],
    };
  }

  // 本文の登場順を尊重しつつ、同じ問が複数回現れる場合は連結して1つにまとめる。
  const order: string[] = [];
  const detailByKey = new Map<string, string>();
  for (const segment of segmented.segments) {
    if (!detailByKey.has(segment.key)) {
      order.push(segment.key);
      detailByKey.set(segment.key, segment.text);
    } else {
      detailByKey.set(segment.key, `${detailByKey.get(segment.key)}\n${segment.text}`);
    }
  }
  // 本文に現れなかった問（解説が別の問にまとめて書かれている等）も落とさない。
  for (const key of keys) if (!detailByKey.has(key)) order.push(key);

  const groups = order.map((key) => {
    const groupSubs = subs.filter((sub) => questionGroupKey(sub.label) === key);
    return {
      key,
      subs: groupSubs,
      steps: stepsOf(groupSubs),
      detail: detailByKey.get(key) || '',
    };
  });

  return { lead: segmented.lead, groups };
}

/**
 * 小問（(ア)/(1)/a …）ごとに ［解法の思考手順 → 詳しい解説］ を隣接させる。
 *
 * ■ なぜこの関数を足したのか（実測にもとづく）
 * 従来は「問N」形式のラベルしか問単位に分けられなかった。しかし教材データの
 * 小問ラベルは (ア)・(1)・a などが主流で、「問N」形式は少数派だったため、
 * 全174大問のうち9割で「問ごとに完結」が発動していなかった。
 * その結果、採点結果のアコーディオンを開いても解説が出てこない状態になっていた。
 * ここを小問ラベルでも切れるようにして、要件②④⑤を全単元で成立させる。
 *
 * ■ 生徒にとっての読み順（教育設計）
 *   1. どの問いか＋何を問う問題か＋答え … subQuestionCard（先に結論）
 *   2. 解法の思考手順（①②③）        … 次に、同じ手順を再現する方法
 *   3. 詳しい解説                      … 最後に、なぜそうなるかの根拠
 * 「結論 → 手順 → 根拠」の順は、すでに答え合わせを終えた生徒が
 * 「自分はどこで間違えたか」を最短で特定できる並びになっている。
 *
 * ■ 情報量は絶対に減らさない
 *   ・本文は splitBodyBySubQuestions が「行を落とさず境界で切るだけ」
 *   ・どの小問にも配れない共通部分（リード文・共通の思考手順）は
 *     SQ_SHARED_MARK を付けて必ず残し、画面側が全アコーディオンに添える
 *   ・削るのは「直前のカードと完全に重複するラベルだけの行」のみ（要件③）
 *
 * 切り分けられないときは null を返し、呼び出し側は従来表示のままにする。
 */
function buildSubQuestionSections(
  question: QuestionLike,
  body: string,
  fallbackSteps: string,
  hasAnswerBlock: boolean,
): string[] | null {
  const subs = (question.subQuestions || []).filter(Boolean) as SubQuestionLike[];
  if (subs.length < 2) return null;

  const segmented =
    splitBodyBySubQuestions(body, subs) ||
    segmentByStepsOnly(body, subs) ||
    segmentByCardOnly(body, subs);
  if (!segmented) return null;

  const subById = new Map<string, { sub: SubQuestionLike; index: number }>();
  subs.forEach((sub, index) => {
    const key = String(sub.id || sub.label || '');
    if (key && !subById.has(key)) subById.set(key, { sub, index });
  });

  const sections: string[] = [];

  // --- ① 全小問に共通する部分 ---
  // 大問全体に1本しかない思考手順と、最初の小問より前にあるリード文は、
  // どれか1つの小問に配ることができない。ここでまとめて置き、
  // 目印を付けて「どのアコーディオンにも添える共通部分」であることを示す。
  const sharedRows: string[] = [];
  const hasSubSteps = subs.some((sub) => (sub.detailedExplanation?.steps || []).length > 0);
  if (!hasSubSteps && fallbackSteps) {
    sharedRows.push(
      `${LABEL(STEPS_TITLE)}<span style="font-size:max(12px, 0.8em); color:#B03A5B; margin-left:6px;">（この大問のすべての問に共通）</span>\n${fallbackSteps}`,
    );
  }
  if (segmented.lead.trim()) {
    // 見出しは「この小問の詳しい解説」と区別できる文言にする。
    // 同じ「詳しい解説」が2つ続くと、生徒はどちらが自分の問の話か分からなくなる。
    // ★文言を変えているだけで、本文は1文字も削っていない★
    sharedRows.push(
      hasAnswerBlock
        ? `${LABEL('この大問全体の解説')}<span style="font-size:max(12px, 0.8em); color:#B03A5B; margin-left:6px;">（すべての問に共通）</span>\n${segmented.lead}`
        : segmented.lead,
    );
  }

  // ★情報欠落を防ぐための安全弁★
  // 本文に見出しが見つからなかった小問（＝解説が他の小問にまとめて書かれている等）は、
  // 下のループで自分のセクションを持てない。その小問の思考手順をここで拾わないと、
  // 従来は表示されていた手順がまるごと消えてしまう。必ず共通部分として残す。
  const matchedKeys = new Set(segmented.segments.map((segment) => segment.key));
  const orphanSteps = subs
    .filter((sub) => !matchedKeys.has(String(sub.id || sub.label || '')))
    .filter((sub) => (sub.detailedExplanation?.steps || []).length > 0)
    .map((sub) => formatSubSteps(sub));
  if (orphanSteps.length > 0) {
    // これは「他の小問の思考手順」なので、自分の問の手順と取り違えないよう
    // 見出しで明示する。手順そのものは1つも省いていない。
    sharedRows.push(
      `${LABEL('関連する問の思考手順')}<span style="font-size:max(12px, 0.8em); color:#B03A5B; margin-left:6px;">（この大問のほかの問）</span>\n${orphanSteps.join('\n\n')}`,
    );
  }

  if (sharedRows.length > 0) {
    sections.push(`${SQ_SHARED_MARK}${sharedRows.join('\n\n')}`);
  }

  // --- ② 小問ごとに ［カード → 思考手順 → 詳しい解説］ ---
  segmented.segments.forEach((segment, index) => {
    const entry = subById.get(segment.key);
    const sub = entry?.sub;
    const rows: string[] = [];

    // 目印は区切り線より前（＝この小問のセクションはここから始まる）
    rows.push(SQ_MARK(segment.key));
    if (index > 0 || sections.length > 0) rows.push(groupDivider());

    // 1. 見出しカード：どの問い／何を問う問題／答え
    if (sub) rows.push(subQuestionCard(sub, entry?.index ?? index));

    // ここから先が「採点アコーディオンの中に出す本文」
    rows.push(SQ_BODY_MARK);

    // 2. 解法の思考手順（この小問に固有のものがあるときだけ）
    //    見出しは上のカードと重複するので出さない（要件③）。
    const stepsText = sub ? formatSubSteps(sub, false) : '';
    if (stepsText.trim()) rows.push(`${LABEL(STEPS_TITLE)}\n${stepsText}`);

    // 3. 詳しい解説
    const detailSource = stripRedundantMarkerLine(segment.text, sub);
    const detail = dedupeAgainstSteps(
      detailSource,
      stepsText || (hasSubSteps ? '' : fallbackSteps),
    );
    if (detail.trim()) rows.push(`${LABEL(DETAIL_TITLE)}\n${detail}`);

    sections.push(rows.join('\n'));
  });

  return sections;
}

/**
 * 本文を小問ごとに切れない大問のための最後の手段。
 *
 * ■ どういう場合に効くか
 * 小問ごとの「解法の思考手順」（detailedExplanation.steps）は持っているのに、
 * 詳しい解説の本文がひとかたまりで書かれていて境界が無い、という大問がある。
 * この場合でも「手順は小問ごとに配れる」ので、
 *   ・共通のリード文（本文まるごと）は共通部分として全員に添える
 *   ・手順とカードは小問ごとに出す
 * という形にすれば、要件④「アコーディオンを開けばその問題の情報が出る」を満たせる。
 *
 * ★本文は1文字も削らない★
 * 本文全体を lead（＝共通部分）に置き、各小問のセグメントは空にする。
 * 画面側は必ず共通部分を添えて表示するので、生徒が読める文章量は従来と同じか増える。
 */
function segmentByStepsOnly(
  body: string,
  subs: SubQuestionLike[],
): BodySegments | null {
  const usable = subs.filter(
    (sub) =>
      String(sub.id || sub.label || '') &&
      (sub.detailedExplanation?.steps || []).length > 0,
  );
  // 「ほとんどの小問が自前の手順を持っている」ときだけ有効にする。
  // 一部しか持たない大問でこれをやると、手順の無い小問のカードが空で並んでしまう。
  if (usable.length < 2 || usable.length < subs.length) return null;

  return {
    lead: body,
    segments: usable.map((sub) => ({ key: String(sub.id || sub.label || ''), text: '' })),
  };
}

/**
 * 最後のよりどころ：本文がどうしても小問ごとに切り分けられない大問の受け皿。
 *
 * ■ どんな大問がここに来るのか（実データで確認済み）
 * 「化合物Aに含まれる金属元素の元素記号」のように、ラベルが *問いの文章そのもの* で、
 * 本文中にその文字列が現れない大問。あるいは「ア：出発／ア：到達／ア：名称」のように
 * 1つの空欄が複数の小問に分かれていて、解説は1行にまとめて書かれている大問。
 * これらは本文を機械的に分けようとすると必ず情報が欠ける。
 *
 * ■ そこでどうするか
 * 本文を1文字も切らずに丸ごと「共通部分」に置く。画面側はこの共通部分を
 * *すべての小問アコーディオンに添える* ので、どの小問を開いても
 *   ［その小問のカード（問い・ねらい・答え）］→［思考手順］→［詳しい解説］
 * が最後まで読める。無理に切って情報を失うより、複製して全部見せるほうが
 * 「1問を見ればその場で完結する」という要件を確実に満たせる。
 *
 * ★複製されるだけで、削られる情報は1文字もない★
 */
function segmentByCardOnly(body: string, subs: SubQuestionLike[]): BodySegments | null {
  const usable = subs.filter((sub) => String(sub.id || sub.label || ''));
  if (usable.length < 2) return null;
  // カードに出せる中身（ねらい or 答え）が無いと、ただの空カードが並ぶだけになる
  const informative = usable.filter(
    (sub) => (sub.detailedExplanation?.theme || '').trim() || String(sub.correctAnswer || '').trim(),
  );
  if (informative.length < usable.length) return null;

  return {
    lead: body,
    segments: usable.map((sub) => ({ key: String(sub.id || sub.label || ''), text: '' })),
  };
}

/**
 * 小問セクションの先頭行が「ラベルだけの見出し」なら取り除く。
 *
 * ★情報を失わせないための厳格な条件★
 * 取り除くのは、その行からラベル部分を取り去ると *何も残らない* 場合だけ。
 * 「(ア) 小さくなる」のように内容が続く行は、たとえラベルで始まっていても残す。
 * 直前の見出しカードに同じラベルが必ず出ているので、
 * 落ちるのは純粋な重複表示だけになる（要件③）。
 */
function stripRedundantMarkerLine(text: string, sub?: SubQuestionLike): string {
  if (!sub) return text;
  const markers = subMarkerCandidates(sub.label);
  if (markers.length === 0) return text;

  const lines = text.split('\n');
  if (lines.length === 0) return text;

  const first = plainLine(lines[0]);
  const hit = markers.find((marker) => first.startsWith(marker));
  if (!hit) return text;

  // ラベルを取り除いた残り。記号・空白しか残らないときだけ「見出しだけの行」とみなす。
  const rest = first.slice(hit.length).replace(/^[\s　:：.．、,／/─―\-]+/, '').trim();
  if (rest !== '') return text;

  return lines.slice(1).join('\n');
}

/**
 * 問ごとに ［解法の思考手順 → 詳しい解説］ を隣接させたセクション列を作る。
 * 2つのブロックは統合も削除もせず、必ず別ブロックとして残す。
 */
export function buildInterleavedSections(
  question: QuestionLike,
  body: string,
  fallbackSteps: string,
  hasAnswerBlock: boolean,
): string[] {
  const { lead, groups } = buildQuestionGroupParts(question, body);
  const sections: string[] = [];

  // 単一グループ（＝「問N」では分けられない大問）。
  // ここが全174問中の大多数を占める。まず小問（(ア)/(1)/a …）単位で
  // 「問ごとに完結」させられないかを試し、できないときだけ従来表示に戻す。
  if (groups.length <= 1) {
    const bySub = buildSubQuestionSections(question, body, fallbackSteps, hasAnswerBlock);
    if (bySub) return bySub;

    const steps = groups[0]?.steps || '';
    const stepsText = steps || fallbackSteps;
    if (stepsText) sections.push(`${LABEL(STEPS_TITLE)}\n${stepsText}`);
    const detail = dedupeAgainstSteps(groups[0]?.detail ?? body, stepsText);
    if (detail.trim()) {
      sections.push(hasAnswerBlock ? `${LABEL(DETAIL_TITLE)}\n${detail}` : detail);
    }
    return sections;
  }

  // 複数の問を含む大問：問ごとに完結させる
  //
  // ★情報欠落を防ぐための安全弁★
  // 小問ごとの思考手順を持たない大問では、思考手順は「大問全体に共通の1本」しかない。
  // これを問ごとに配り直すことはできない（どの問にも等しく効く手順のため）ので、
  // 問の並びの前に1回だけ、従来どおりの位置で必ず出す。
  // ここを省くと解説が丸ごと消えるため、絶対に落としてはならない。
  const hasGroupSteps = groups.some((group) => Boolean(group.steps));
  if (!hasGroupSteps && fallbackSteps) {
    sections.push(
      `${LABEL(STEPS_TITLE)}<span style="font-size:max(12px, 0.8em); color:#B03A5B; margin-left:6px;">（この大問のすべての問に共通）</span>\n${fallbackSteps}`,
    );
  }

  if (lead.trim()) sections.push(`${LABEL(DETAIL_TITLE)}\n${lead}`);

  const hadSectionBefore = sections.length > 0;

  groups.forEach((group, index) => {
    const rows: string[] = [];
    // 目印は区切り線より前に置く（＝この問のセクションはここから始まる）
    rows.push(GROUP_MARK(group.key));
    if (index > 0 || hadSectionBefore) rows.push(groupDivider());
    rows.push(groupHeading(group.key));
    if (group.steps) rows.push(`${LABEL(STEPS_TITLE)}\n${group.steps}`);
    // 重複除去の対象は「この問に隣接して置かれた思考手順」。
    // 共通1本の場合は、その共通手順を基準にする。
    const detail = dedupeAgainstSteps(group.detail, group.steps || (hasGroupSteps ? '' : fallbackSteps));
    if (detail.trim()) rows.push(`${LABEL(DETAIL_TITLE)}\n${detail}`);
    if (rows.length > 0) sections.push(rows.join('\n'));
  });

  return sections;
}
