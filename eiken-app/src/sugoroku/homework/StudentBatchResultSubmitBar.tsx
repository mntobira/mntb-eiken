import { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Loader2, MessageSquareText, Send, Sparkles } from 'lucide-react';
import { auth } from '../../firebase';
import { subjectOfChapterId } from '../../data/subjects';
import {
  jukuClassForSubject,
  submitAnswerReason,
  subscribeJukuMemberships,
} from '../../utils/classAssignments';
import { REASON_MAX } from '../../utils/classAssignmentsCore';
import { pushStudyData } from '../../utils/studySync';
import { ensureStudentJukuMemberships } from '../shared/studentClassSession';

export interface BatchSubmitItemSummary {
  problemId: string;
  subQuestionId: string;
  displayNo: number;
  correct: boolean;
}

export interface StudentBatchResultSubmitBarProps {
  chapterId: string;
  chapterTitle: string;
  items: readonly BatchSubmitItemSummary[];
}

/**
 * 筆記（語彙・文法・読解）の結果画面で、塾クラス在籍生徒が
 * 1タップで「今回の全問演習結果（正誤・復習記録）＋ 振り返り・選んだ理由メモ」を先生へ一括提出できるパネル。
 *
 * 通常は `studySync` が最大60秒デバウンスで送るため、授業中に解き終わった直後だと
 * 先生の管理画面にまだ反映されていないことがある。このボタンを押すと即時クラウド同期（`pushStudyData(true)`）と
 * 各設問への理由・振り返り一括送信（`eiken_answer_reasons`）を同時に完了させる。
 */
export function StudentBatchResultSubmitBar({
  chapterId,
  chapterTitle,
  items,
}: StudentBatchResultSubmitBarProps) {
  const uid = auth.currentUser?.uid || '';
  const subject = useMemo(() => subjectOfChapterId(chapterId), [chapterId]);
  const [tick, setTick] = useState(0);

  useEffect(() => subscribeJukuMemberships(() => setTick((n) => n + 1)), []);
  useEffect(() => {
    if (!uid) return;
    void ensureStudentJukuMemberships(uid);
  }, [uid]);

  const room = useMemo(
    () => (uid && subject ? jukuClassForSubject(uid, subject) : null),
    [uid, subject, tick],
  );

  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [submittedAt, setSubmittedAt] = useState<number | null>(null);
  const [error, setError] = useState('');

  if (!uid || !room || items.length === 0) return null;

  const correctCount = items.filter((i) => i.correct).length;
  const wrongItems = items.filter((i) => !i.correct);

  const handleBatchSubmit = async () => {
    setBusy(true);
    setError('');
    try {
      // 1. 設問ごとの解答済み・誤答復習データを即時 Firestore へ同期（60秒デバウンスを待たない）
      await pushStudyData(true);

      // 2. 生徒が振り返りメモ（または「迷った問題」）を書いている場合は、誤答問題（全問正解なら先頭問題）に紐づけて理由も一括送信
      const cleanNote = note.trim().slice(0, REASON_MAX);
      if (cleanNote) {
        const targets = wrongItems.length > 0 ? wrongItems.slice(0, 5) : items.slice(0, 1);
        await Promise.all(
          targets.map((item, idx) =>
            submitAnswerReason(
              {
                classId: room.classId,
                teacherUid: room.teacherUid,
                chapterId,
                questionId: item.subQuestionId || item.problemId,
              },
              idx === 0 ? cleanNote : `（一括振り返り）${cleanNote}`.slice(0, REASON_MAX),
              item.correct,
              item.displayNo,
            ),
          ),
        );
      } else if (wrongItems.length > 0) {
        // メモ未入力でも「どの番号を間違えて一括提出したか」が先生の提出タイムラインに即出るよう先頭誤答を記録可能にする場合は任意だが、
        // 空文字送信エラーを避けるため定型サマリーを1件記録する
        const wrongNos = wrongItems.map((w) => `問${w.displayNo}`).join('・');
        const autoSummary = `【一括提出】${chapterTitle}（${correctCount}/${items.length}問正解・要復習: ${wrongNos}）`.slice(
          0,
          REASON_MAX,
        );
        const firstWrong = wrongItems[0];
        await submitAnswerReason(
          {
            classId: room.classId,
            teacherUid: room.teacherUid,
            chapterId,
            questionId: firstWrong.subQuestionId || firstWrong.problemId,
          },
          autoSummary,
          false,
          firstWrong.displayNo,
        );
      } else {
        const firstItem = items[0];
        const autoSummary = `【一括提出】${chapterTitle}（${correctCount}/${items.length}問 満点クリア！）`.slice(
          0,
          REASON_MAX,
        );
        await submitAnswerReason(
          {
            classId: room.classId,
            teacherUid: room.teacherUid,
            chapterId,
            questionId: firstItem.subQuestionId || firstItem.problemId,
          },
          autoSummary,
          true,
          firstItem.displayNo,
        );
      }

      setSubmittedAt(Date.now());
    } catch (e) {
      setError(e instanceof Error ? e.message : '先生への一括提出に失敗しました。');
    } finally {
      setBusy(false);
    }
  };

  return (
    <section
      className="ewr-juku-batch-bar"
      data-testid="student-batch-result-submit"
      aria-label="塾の先生へ今回の演習結果を一括提出"
    >
      <div className="ewr-juku-batch-head">
        <span className="ewr-juku-batch-badge">
          <Sparkles size={13} aria-hidden="true" />
          塾クラス連携：{room.className}
        </span>
        <span className="ewr-juku-batch-meta">
          今回 <b>{correctCount}/{items.length}問正解</b>
          {wrongItems.length > 0
            ? `（誤答: ${wrongItems.map((w) => `問${w.displayNo}`).join('・')}）`
            : '（全問正解！）'}
        </span>
      </div>

      <div className="ewr-juku-batch-row">
        <div className="ewr-juku-batch-input-wrap">
          <MessageSquareText size={15} className="ewr-juku-batch-icon" aria-hidden="true" />
          <input
            type="text"
            value={note}
            maxLength={REASON_MAX}
            onChange={(e) => setNote(e.target.value.slice(0, REASON_MAX))}
            placeholder="任意：迷った選択肢の理由・先生への質問メモ（例：問3の熟語が分からなかった）"
            aria-label="先生への振り返り・質問メモ"
            className="ewr-juku-batch-input"
          />
        </div>

        <button
          type="button"
          onClick={() => void handleBatchSubmit()}
          disabled={busy}
          className="ewr-juku-batch-btn"
          data-submitted={submittedAt ? 'true' : undefined}
        >
          {busy ? (
            <Loader2 size={15} className="animate-spin" aria-hidden="true" />
          ) : submittedAt ? (
            <CheckCircle2 size={15} aria-hidden="true" />
          ) : (
            <Send size={15} aria-hidden="true" />
          )}
          <span>{submittedAt ? '提出済み（再送信）' : '先生へ結果を一括提出'}</span>
        </button>
      </div>

      {submittedAt && !error && (
        <p className="ewr-juku-batch-ok" role="status">
          「{room.className}」の先生へ解いた問題番号と正誤を一括提出しました！先生の画面にすぐ反映されます。
        </p>
      )}
      {error && (
        <p className="ewr-juku-batch-err" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}
