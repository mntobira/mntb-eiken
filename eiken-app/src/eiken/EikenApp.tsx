import React, { useEffect, useState } from 'react';
import { onAuthStateChanged, signInWithPopup, signOut } from 'firebase/auth';
import { Home } from '../components/Home';
import { ChapterSelection } from '../components/ChapterSelection';
import { Quiz } from '../components/Quiz';
import { Explanation } from '../components/Explanation';
import { StudyHub } from '../components/StudyHub';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { ThemeProvider } from '../contexts/ThemeContext';
import { AppWallpaper } from '../components/AppWallpaper';
import { auth, provider, FIREBASE_CONFIGURED } from '../firebase';
import { EIKEN_GRADES, type EikenGrade } from './config';
import { findChapterById } from '../data/allChapters';
import { eikenStorage } from './storage';
import { pullStudyData, installStudySyncFlush, resetStudySyncState } from '../utils/studySync';
import { quizAnswersKey, quizExplKey, quizIndexKey, quizRunKey, quizStepKey } from '../utils/quizStorageKeys';
import type { ChapterRunState } from '../utils/quizRunState';
import { stopSpeech } from '../utils/listeningSpeech';
import { pauseAllAudio } from '../utils/audioElements';
import { useIsMobile } from '../hooks/useMediaQuery';
import { applyReviewFocus } from '../utils/reviewFocus';
import type { Chapter } from '../types/curriculum';
import type { ReviewRequest } from '../utils/reviewTarget';
import './eiken.css';

type Screen = 'home' | 'grades' | 'sets' | 'quiz' | 'result' | 'review' | 'settings' | 'about';
export function EikenApp() {
  const [grade, setGrade] = useState<EikenGrade>(() => {
    try { const stored = eikenStorage.getItem('selected_grade'); return EIKEN_GRADES.some(item => item.id === stored && item.available) ? stored as EikenGrade : 'eiken_3'; } catch { return 'eiken_3'; }
  });
  const [screen, setScreen] = useState<Screen>('home');
  const [chapterId, setChapterId] = useState<string | null>(null);
  const [practiceChapter, setPracticeChapter] = useState<Chapter | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [result, setResult] = useState<ChapterRunState | undefined>();
  const [user, setUser] = useState(auth.currentUser);
  const [message, setMessage] = useState('');
  const [range, setRange] = useState<{ startIndex: number; endIndex: number } | null>(null);
  const mobile = useIsMobile();
  const label = EIKEN_GRADES.find(item => item.id === grade)!.label;
  useEffect(() => {
    if (!FIREBASE_CONFIGURED) return;
    const dispose = installStudySyncFlush();
    const unsubscribe = onAuthStateChanged(auth, current => {
      setUser(current);
      resetStudySyncState();
      if (current) void pullStudyData().then(result => { if (!result.synced) setMessage('同期できませんでした。端末の記録は保持しています。英検版Firebaseのルールと接続を確認してください。'); }).catch(() => setMessage('同期できませんでした。端末の記録は保持しています。'));
    });
    return () => { unsubscribe(); dispose(); };
  }, []);
  function navigate(next: Screen) { stopSpeech(); pauseAllAudio(null); setScreen(next); setMessage(''); window.scrollTo(0, 0); }
  function chooseGrade(next: EikenGrade) {
    setGrade(next);
    try { eikenStorage.setItem('selected_grade', next); } catch { setMessage('この端末では設定を保存できません。'); }
    navigate('sets');
  }
  function start(id: string, index = 0, resume = false, selectedRange: { startIndex: number; endIndex: number } | null = null, focused?: Chapter) {
    const chapter = focused || findChapterById(id);
    if (!chapter || !id.startsWith('eiken_')) return;
    if (!resume) {
      try {
        for (const key of [quizAnswersKey(id, 'practice'), quizExplKey(id, 'practice'), quizRunKey(id, 'practice'), quizStepKey(id, 'practice')]) eikenStorage.removeItem(key);
        eikenStorage.setItem(quizIndexKey(id, 'practice'), String(index));
      } catch { setMessage('進行状況を保存できません。'); }
    }
    setChapterId(id); setPracticeChapter(chapter); setRange(selectedRange); setAnswers({}); setResult(undefined); navigate('quiz');
  }
  function retryReview(target: ReviewRequest) {
    if (!target.chapterId) return;
    const source = findChapterById(target.chapterId);
    if (!source) return;
    const problems = source.practiceProblems.filter(p => p.id === target.questionId || p.subQuestions.some(sq => sq.id === target.subQuestionId || target.subQuestionIds?.includes(sq.id)));
    if (!problems.length) { setMessage('対応する英検問題が見つかりませんでした。'); return; }
    start(source.id, 0, false, null, { ...source, practiceProblems: problems });
  }
  const chapter = practiceChapter || (chapterId ? findChapterById(chapterId) : null);
  const back = () => navigate('home');
  let content: React.ReactNode;
  if (screen === 'home') content = <Home onStart={() => navigate('grades')} onPractice={() => navigate('grades')} onIntro={() => navigate('about')} onNoteList={() => navigate('review')} onChangeSubject={() => navigate('grades')} subject={grade} subjectLabel={label} isGuest={!user} />;
  else if (screen === 'grades') content = <main className="listening-home ls-subjects eiken-grades"><div className="lh-container"><header className="lh-header"><button onClick={back}>ホームへ</button><img src="/brand/manatobi-logo-gray.png" alt="マナトビ" width="160" /></header><section className="ls-subjects-title"><h1>英検の級を選択</h1><p>級を選び、分野別練習を始めます。</p></section><div className="eiken-grade-grid">{EIKEN_GRADES.map(item => <button className="ls-subject-main" data-eiken-grade={item.id} key={item.id} onClick={() => chooseGrade(item.id)} disabled={!item.available}><strong>{item.label}</strong><small>{item.available ? '第1〜15回 分野別練習＋リスニング' : '教材準備中'}</small><span aria-hidden="true">→</span></button>)}</div><p>各級の分野別練習です。本試験1回分の通し模試ではありません。</p></div></main>;
  else if (screen === 'sets') content = <ChapterSelection key={grade} mode="practice" subject={grade} onSelectChapter={start} onBack={() => navigate('grades')} backLabel="級を選ぶ" />;
  else if (screen === 'quiz' && chapter) content = <Quiz key={`${chapter.id}:${JSON.stringify(range)}:${chapter.practiceProblems.map(q => q.id).join()}`} mode="practice" chapter={chapter} isGuest={!user} isMobileView={mobile} onBack={() => navigate('sets')} questionRange={range} onFinish={(chosen, state) => { setAnswers(chosen); setResult(state); navigate('result'); }} />;
  else if (screen === 'result' && chapter) content = <Explanation mode="practice" chapter={chapter} answers={answers} resultTotalScore={result?.totalScore} resultTotalCorrect={result?.totalCorrect} resultTotalJudgeable={result?.totalJudgeable} resultTotalTimeSec={result?.totalTimeSec} isGuest={!user} isMobileView={mobile} questionRange={range} onBack={() => navigate('sets')} onHome={back} onRetryWrong={targets => {
    const filtered = applyReviewFocus(chapter.practiceProblems, chapter.id, { chapterId: chapter.id, targets });
    start(chapter.id, 0, false, null, { ...chapter, practiceProblems: filtered });
  }} />;
  else if (screen === 'review') content = <StudyHub isGuest={!user} onBack={back} onSelectNote={() => setMessage('この版では記述ノートの詳細表示は準備中です。')} onPractice={() => navigate('grades')} onReview={retryReview} onRetry={retryReview} />;
  else content = <main className="eiken-info"><button onClick={back}>ホームへ</button><h1>{screen === 'settings' ? '英検版の設定' : '英検リスニングの使い方'}</h1><p>級を選ぶ → 問題セット → 音声を聞く → 解答 → 解説と復習。</p><p>音声はブラウザ読み上げです。録音音源や本試験と同じ出題数・再生制限を再現した模試ではありません。</p><p>現在の保存先：{FIREBASE_CONFIGURED ? '英検専用Firebaseとこの端末' : 'この端末のみ（クラウド未接続）'}</p><p>大学入試版のアカウントや学習記録は引き継ぎません。公式教材ではありません。</p>{FIREBASE_CONFIGURED ? <button onClick={async () => { try { if (user) await signOut(auth); else await signInWithPopup(auth, provider); } catch { setMessage('認証できませんでした。英検版の許可ドメインと設定を確認してください。'); } }}>{user ? 'ログアウト' : '英検版にGoogleでログイン'}</button> : <p>ログイン・クラウド同期は英検専用Firebaseの設定後に有効になります。</p>}</main>;
  return <ThemeProvider><div className="eiken-shell"><nav className="eiken-app-nav" aria-label="英検版のメニュー"><button onClick={back}>マナトビ 英検リスニング</button><button onClick={() => navigate('grades')}>級を選ぶ</button><button onClick={() => navigate('review')}>復習・記録</button><button onClick={() => navigate('settings')}>設定</button></nav>{message && <p className="eiken-message" role="status">{message}</p>}<ErrorBoundary label="英検版" onReset={back}>{content}</ErrorBoundary><AppWallpaper /></div></ThemeProvider>;
}
