import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronDown, Compass, Eye, GraduationCap, Pencil, Save, School } from 'lucide-react';
import { auth } from '../firebase';
import { MOTTO_MAX, normalizeMotto, parsePublicStudyProfile, readOwnPublicStudyProfile, savePublicStudyProfile } from '../utils/publicStudyProfile';
import { BIO_MAX, GRADE_OPTIONS, normalizeBio, normalizeGrade, buildWeek, dayKey } from '../utils/publicProfileCore';
import { collectProfileStats } from '../features/profile/profileStats';
import { PublicProfileView } from '../features/profile/PublicProfileView';
import { syncRankingNickname } from '../utils/leaderboard';
import { ensureFriendProfile } from '../utils/friends';
import { profileKey } from '../utils/userStorageKeys';
import { checkNickname, checkPublicText, NICKNAME_MAX } from '../features/safety/nicknameFilter';
import { readStudyTime } from '../utils/studyTime';
import { GOAL_OPTIONS, TARGET_SCHOOL_MAX, normalizeTargetSchool, readGoal, writeGoal, type GoalId } from '../utils/vocabGoal';
import { requireLocalStorage, setItemOrThrow } from '../utils/safeLocalStorage';
import { logRejection } from '../utils/reportError';
import './profile-settings.css';

/**
 * マイページの「プロフィール」（2026-10-21）
 *   以前は 設定 ＞ 基本設定 ＞「アカウント・プロフィール」にあった中身をマイページへ移した。
 *   とびら君のアイコンとレベルはマイページ上部に出ているので、ここには載せない（重複させない）。
 *   スマホでも1画面に収めるため、公開トグルの長い説明文は省いた（公開の仕組みはランキング画面の「について」に記載）。
 */
export function MyProfileCard() {
  const uid = auth.currentUser?.uid || 'guest';
  const [studySeconds] = useState(() => readStudyTime(uid).total);
  const [name, setName] = useState('');
  const [grade, setGrade] = useState('');
  const [stream, setStream] = useState('science');
  const [targetSchool, setTargetSchool] = useState('');
  const [motto, setMotto] = useState('');
  const [bio, setBio] = useState('');
  const [showPreview, setShowPreview] = useState(false);
  const [showBio, setShowBio] = useState(false);
  const [goal, setGoal] = useState<GoalId>(readGoal);
  const [profilePublic, setProfilePublic] = useState(false);
  const [wasPublic, setWasPublic] = useState(false);
  const [publicationReady, setPublicationReady] = useState(!auth.currentUser);
  const [message, setMessage] = useState<{ text: string; error?: boolean } | null>(null);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    let alive = true;
    if (auth.currentUser) void readOwnPublicStudyProfile().then(p => {
      if (alive) { setProfilePublic(!!p); setWasPublic(!!p); setPublicationReady(true); }
    }).catch(() => { if (alive) setMessage({ text: '公開設定を確認できません。公開機能には新版のFirestoreルールの反映が必要です。', error: true }); });
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    try {
      const ls = requireLocalStorage();
      const raw = ls.getItem(profileKey(uid));
      if (raw) {
        const d = JSON.parse(raw);
        setName(d.name || ''); setGrade(d.grade || ''); setStream(d.stream || 'science');
        setTargetSchool(typeof d.targetSchool === 'string' ? d.targetSchool : '');
        setMotto(typeof d.motto === 'string' ? d.motto : '');
        setBio(typeof d.bio === 'string' ? d.bio : '');
      } else {
        setName(auth.currentUser?.displayName || (auth.currentUser ? 'ユーザー' : 'ゲスト'));
        setGrade('高校生');
      }
    } catch (error) { console.error('プロフィール取得エラー:', error); }
  }, [uid]);

  const nameCheck = checkNickname(name);
  const schoolCheck = checkPublicText(targetSchool, TARGET_SCHOOL_MAX);
  const mottoCheck = checkPublicText(motto, MOTTO_MAX);
  // 自己紹介：改行はそのまま、連絡先・使えない語は行ごとに調べる
  const bioCheck = bio.split('\n').map(line => checkPublicText(line, BIO_MAX)).find(c => !c.ok) ?? { ok: true as const, message: '' };
  const publicGrade = normalizeGrade(grade);
  const edit = <T,>(set: (v: T) => void) => (v: T) => { set(v); setDirty(true); setMessage(null); };

  const save = async () => {
    if (!nameCheck.ok || !schoolCheck.ok || !mottoCheck.ok || !bioCheck.ok) return;
    setSaving(true); setMessage(null);
    try {
      // 公開設定の保存に失敗しても、名前・学年などは保存する
      let publishFailed: string | null = null;
      if (auth.currentUser && (profilePublic || wasPublic)) {
        try { await savePublicStudyProfile(profilePublic, { targetSchool, motto, nickname: name.trim(), grade: publicGrade, bio }); setWasPublic(profilePublic); }
        catch (e) {
          const code = (e as { code?: string })?.code || '';
          console.error('公開設定の保存エラー:', e);
          publishFailed = code === 'permission-denied'
            ? '公開だけ保存できませんでした（サーバー側の公開設定が未更新です）。ほかは保存しました。'
            : code === 'unavailable' || !navigator.onLine
              ? 'オフラインのため、公開だけ保存できませんでした。ほかは保存しました。'
              : '公開だけ保存できませんでした。ほかは保存しました。少し時間をおいてもう一度保存してください。';
        }
      }
      setItemOrThrow(profileKey(uid), JSON.stringify({
        name: name.trim(), grade: grade.trim(), stream, profilePublic: publishFailed ? wasPublic : profilePublic,
        targetSchool: normalizeTargetSchool(targetSchool), motto: normalizeMotto(motto), bio: normalizeBio(bio), iconUrl: auth.currentUser?.photoURL || '',
      }));
      writeGoal(goal);
      // 名前を変えたら、ランキング・フレンド検索の表示名もその場で最新化する
      if (auth.currentUser) {
        void syncRankingNickname().catch(logRejection('ranking.syncNickname'));
        void ensureFriendProfile().catch(logRejection('friends.ensureProfile'));
      }
      if (publishFailed) { setProfilePublic(wasPublic); setMessage({ text: publishFailed, error: true }); return; }
      setDirty(false);
      setMessage({ text: '保存しました' });
    } catch (error) {
      console.error('保存エラー:', error);
      setMessage({ text: '保存できませんでした。もう一度お試しください。', error: true });
    } finally { setSaving(false); }
  };

  return <section className="ps-card mt-card mypage-profile" aria-label="プロフィール" data-mypage-profile>
    <div className="mypage-profile-top ps-fields">
      <label className="ps-name">
        <span className="ps-field-label">名前</span>
        <input value={name} maxLength={NICKNAME_MAX} onChange={e => edit(setName)(e.target.value)} placeholder="ニックネーム" aria-invalid={!!name.trim() && !nameCheck.ok} aria-describedby={name.trim() && !nameCheck.ok ? 'nickname-help' : undefined} />
        <Pencil size={16} aria-hidden="true" />
      </label>
    </div>
    {name.trim() && !nameCheck.ok && <p id="nickname-help" role="alert" className="ps-help" data-error>{nameCheck.message}</p>}
    <div className="ps-fields">
      <label className="ps-select"><GraduationCap size={15} aria-hidden="true" /><span className="ps-field-label">学年</span>
        {/* 公開するので自由入力をやめ、決まった選択肢から選ぶ（2026-10-26） */}
        <select value={publicGrade || (grade.trim() ? grade : '')} onChange={e => edit(setGrade)(e.target.value)}>
          {/* 以前の自由入力の値（例：高校生）は選択肢に残して消さない。公開ページには載せない */}
          {!publicGrade && grade.trim() && <option value={grade}>{grade}（公開されません）</option>}
          {GRADE_OPTIONS.map(g => <option key={g || 'none'} value={g}>{g || '学年（選ぶ）'}</option>)}
        </select><ChevronDown size={16} aria-hidden="true" />
      </label>
      <label className="ps-select"><Compass size={15} aria-hidden="true" /><span className="ps-field-label">文理</span>
        <select value={stream} onChange={e => edit(setStream)(e.target.value)}>
          <option value="science">理系</option><option value="humanities">文系</option><option value="other">その他</option>
        </select><ChevronDown size={16} aria-hidden="true" />
      </label>
      <label className="ps-select" data-target-school><School size={15} aria-hidden="true" /><span className="ps-field-label">志望校</span>
        <input value={targetSchool} maxLength={TARGET_SCHOOL_MAX} onChange={e => edit(setTargetSchool)(e.target.value)} placeholder="志望校" aria-invalid={!schoolCheck.ok || undefined} /><Pencil size={15} aria-hidden="true" />
      </label>
      <label className="ps-select" data-target-goal><GraduationCap size={15} aria-hidden="true" /><span className="ps-field-label" aria-label="目標レベル（単語帳の範囲）">目標</span>
        <select value={goal} onChange={e => edit(setGoal)(e.target.value as GoalId)}>
          {GOAL_OPTIONS.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
        </select><ChevronDown size={16} aria-hidden="true" />
      </label>
      <label className="ps-select" data-motto><Compass size={15} aria-hidden="true" /><span className="ps-field-label" aria-label="志（ひとこと）">志</span>
        <input value={motto} maxLength={MOTTO_MAX} onChange={e => edit(setMotto)(e.target.value)} placeholder="志（例：医者になって地元を支える）" aria-invalid={!mottoCheck.ok || undefined} /><Pencil size={15} aria-hidden="true" />
      </label>
      {/* 自己紹介：入力欄と同じ見た目のボタン。押すと既存と同じ窓で書く（マイページを1画面のまま保つ） */}
      <button type="button" className="ps-select mypage-profile-bio" onClick={() => setShowBio(true)} data-profile-bio aria-invalid={!bioCheck.ok || undefined}>
        <span className="ps-field-label">自己紹介</span><span className="mypage-profile-bio-text">{bio.trim() ? bio.trim().split('\n')[0] : '書く（任意）'}</span><ChevronDown size={16} aria-hidden="true" />
      </button>
    </div>
    {!schoolCheck.ok && <p role="alert" className="ps-help" data-error>{schoolCheck.message?.replace('名前', '志望校')}</p>}
    {!mottoCheck.ok && <p role="alert" className="ps-help" data-error>{mottoCheck.message?.replace('名前', '志')}</p>}
    {!bioCheck.ok && <p role="alert" className="ps-help" data-error>{bioCheck.message?.replace('名前', '自己紹介')}</p>}
    {/* C4：非公開のときは、マイページの「編集」と同じ赤い印をここにも付ける（なぜ赤いのかが分かるように） */}
    <div className="ps-toggle-row mypage-profile-public" data-not-public={(!!auth.currentUser && !profilePublic) || undefined}>
      <div className="ps-toggle-text"><p>{!!auth.currentUser && !profilePublic && <i className="mypage-public-dot" aria-hidden="true" />}プロフィールを公開</p><small>{profilePublic ? 'ほかの人に見えます' : 'いまは非公開です（オンにして保存すると公開されます）'}</small></div>
      <button type="button" role="switch" aria-checked={profilePublic} aria-label="プロフィールを公開（名前・学年・志望校・志・自己紹介・学習の記録を他の人に表示）" className="ps-switch"
        onClick={() => { if (auth.currentUser && publicationReady) { setProfilePublic(p => !p); setDirty(true); setMessage(null); } else setMessage({ text: 'Googleログインと公開設定の確認が必要です。', error: true }); }}><span /></button>
      {/* 公開の行に並べる（マイページを1画面に収めたまま、見え方を確かめられる） */}
      <button type="button" className="mypage-profile-preview" onClick={() => setShowPreview(true)} data-profile-preview-open aria-label="ほかの人からの見え方を確かめる">
        <Eye size={16} aria-hidden="true" />見え方
      </button>
    </div>
    <button type="button" className="mypage-profile-save" onClick={() => void save()} disabled={saving || !dirty || !nameCheck.ok || !schoolCheck.ok || !mottoCheck.ok || !bioCheck.ok} data-mypage-save>
        {message && !message.error && !dirty ? <Check size={16} aria-hidden="true" /> : <Save size={16} aria-hidden="true" />}{saving ? '保存中…' : message && !message.error && !dirty ? '保存済み' : '保存'}
      </button>
    {message && <p className="ps-help" role={message.error ? 'alert' : 'status'} data-error={message.error || undefined}>{message.text}</p>}
    {showBio && <BioDialog value={bio} onChange={v => edit(setBio)(v)} error={bioCheck.ok ? '' : (bioCheck.message || '').replace('名前', '自己紹介')} onClose={() => setShowBio(false)} />}
    {showPreview && <PreviewDialog onClose={() => setShowPreview(false)} profilePublic={profilePublic}
      draft={{ name: name.trim(), grade: publicGrade, targetSchool, motto, bio, studySeconds, uid }} />}
  </section>;
}

/** 「ほかの人からの見え方」：いま入力している内容と端末の記録で、公開ページと同じ表示を出す */
function PreviewDialog({ onClose, profilePublic, draft }: {
  onClose: () => void; profilePublic: boolean;
  draft: { name: string; grade: string; targetSchool: string; motto: string; bio: string; studySeconds: number; uid: string };
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => { const d = ref.current; if (d && !d.open) d.showModal(); }, []);
  const stats = collectProfileStats();
  const now = Date.now();
  const profile = parsePublicStudyProfile({
    public: true, targetSchool: normalizeTargetSchool(draft.targetSchool), studySeconds: Math.min(315360000, draft.studySeconds),
    motto: normalizeMotto(draft.motto), nickname: draft.name, grade: draft.grade, bio: normalizeBio(draft.bio),
    week: buildWeek(readStudyTime(draft.uid).days, now), weekEnd: dayKey(now),
    streak: stats.streak, solved: stats.solved, badges: stats.badges, title: stats.title,
    lookPose: stats.look?.pose, lookFrame: stats.look?.frame, lookHat: stats.look?.hat, lookGlasses: stats.look?.glasses,
  });
  return createPortal(<dialog ref={ref} className="game-details-dialog mt-dialog" aria-labelledby="profile-preview-title" data-profile-preview
    onClose={onClose} onCancel={e => { e.preventDefault(); onClose(); }} onClick={e => { if (e.target === ref.current) onClose(); }}>
    <header><h2 id="profile-preview-title">ほかの人からの見え方</h2><button type="button" autoFocus onClick={onClose}>閉じる</button></header>
    <div className="game-details-body">
      {!profilePublic && <p className="ps-help" data-error>いまは非公開です（「プロフィールを公開」をオンにして保存すると見えます）。</p>}
      {profile && <PublicProfileView profile={profile} isPreview now={now} />}
    </div>
  </dialog>, document.body);
}

/** 自己紹介を書く窓（既存の窓と同じ見た目）。閉じるとカードに戻り、「保存」で保存する */
function BioDialog({ value, onChange, error, onClose }: { value: string; onChange: (v: string) => void; error: string; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => { const d = ref.current; if (d && !d.open) d.showModal(); }, []);
  return createPortal(<dialog ref={ref} className="game-details-dialog mt-dialog" aria-labelledby="profile-bio-title" data-profile-bio-dialog
    onClose={onClose} onCancel={e => { e.preventDefault(); onClose(); }} onClick={e => { if (e.target === ref.current) onClose(); }}>
    <header><h2 id="profile-bio-title">自己紹介（{[...value].length}/{BIO_MAX}）</h2><button type="button" onClick={onClose}>閉じる</button></header>
    <div className="game-details-body mypage-bio-body">
      <textarea value={value} maxLength={BIO_MAX} rows={5} autoFocus onChange={e => onChange(e.target.value)} aria-label="自己紹介"
        placeholder="例）共通テストでリスニング40点→80点が目標。毎朝15分やってます。" aria-invalid={!!error || undefined} />
      {error ? <p role="alert" className="ps-help" data-error>{error}</p>
        : <p className="ps-help">公開すると、ほかの人のプロフィール画面に表示されます。URL・メールアドレス・SNSのID・学校名など、あなたが特定される内容は書かないでください。</p>}
      <button type="button" className="mypage-profile-save" onClick={onClose}>OK（あとで「保存」を押す）</button>
    </div>
  </dialog>, document.body);
}
