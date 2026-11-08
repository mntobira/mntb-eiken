import { useRef, useState } from 'react';
import { Store, Sparkles, UserRound, CalendarDays, Shirt, Award, FileText } from 'lucide-react';
import { StudyRecord, type StudyRetry } from './StudyRecord';
import { LevelRewards } from './LevelRewards';
import { type MissionDestination } from '../battle/core/growth';
import { GachaRoom } from './GachaRoom';
import { ManaRush } from './ManaRush';
import { MyCollection } from './MyCollection';
import { MyProfileCard } from './MyProfileCard';
import { MyStudyCard } from '../features/studylog/MyStudyCard';
import { StudyLogPage } from '../features/studylog/StudyLogPage';
import { useGrowthProgress } from '../hooks/useGrowthProgress';
import { BattleMissions } from '../battle/ui/BattleMissions';
import { BattleProfile } from '../battle/ui/BattleProfile';
import './growth-hub.css';
import { KineticText } from '../motion';
export type GrowthPage = 'overview' | 'gacha' | 'gacha-shop' | 'outfit' | 'prints' | 'rewards' | 'badges' | 'stats' | 'missions' | 'rush' | 'log' | 'log-new' | 'profile-edit';
export function GrowthHub({ page, onPage, onBack, onBattle, onReview, onRanking, defaultSubject, onStudy, onFoundation, onRetry, onOpenFriends }: {
  page: GrowthPage; onPage: (page: GrowthPage) => void; onBack: () => void;
  /** ミッションの行き先：演習する（教科選び）／英単語の4択・単語帳 */
  onStudy?: () => void; onFoundation?: (tab: 'words' | 'quiz') => void;
  onBattle?: () => void; onReview: () => void; onRanking?: () => void; defaultSubject?: string;
  /** 学習記録から、その大問を解きなおす（間違えた小問だけにも絞れる） */
  onRetry?: (t: StudyRetry) => void;
  /** 学習記録の「フレンド」で、フレンドがいないときの追加ボタン */
  onOpenFriends?: () => void;
}) {
  const { progress, uid } = useGrowthProgress();
  const [outfitKind, setOutfitKind] = useState('all');
  const activePage = page;
  // ★ミッションの「○○へ」★ マイページの中で済むものはここで、ほかの画面は App に任せる
  const goMission = (to: MissionDestination) => {
    if (to === 'rush') onPage('rush');
    else if (to === 'gacha') onPage('gacha');
    else if (to === 'outfit') { setOutfitKind('all'); onPage('outfit'); }
    else if (to === 'review') onReview();
    else if (to === 'study') (onStudy ?? onBack)();
    else if (to === 'vocab_quiz') onFoundation ? onFoundation('quiz') : onBack();
    else if (to === 'wordbook') onFoundation ? onFoundation('words') : onBack();
    else (onBattle ?? onBack)();
  };
  const openTab = (id: GrowthPage) => { if (id === 'outfit') setOutfitKind('all'); onPage(id); };
  // ミッションへ来る前の画面（ガチャの「コインをためる」から来たらガチャへ戻す。ホームから来たらホームへ）
  const cameFrom = useRef<GrowthPage | null>(null);
  if (activePage !== 'missions') cameFrom.current = activePage;
  const leaveMissions = () => { const from = cameFrom.current; if (from === 'gacha' || from === 'gacha-shop') onPage(from); else onBack(); };
  // ★2026-10-28 B1：ミッションもマイページの中ではなく、それだけの画面にする（上の「マイページ」見出し・5つのタブは出さない）★
  if (activePage === 'missions') return <section className="mana-hub mana-hub-missions" data-missions-page><div className="mypage-extra-scroll"><BattleMissions key={uid} standalone onBack={leaveMissions} onBattle={onBattle} onReview={onReview} onShop={()=>onPage('gacha-shop')} onRush={()=>onPage('rush')} extra={progress ? <LevelRewards progress={progress} /> : null} onGo={goMission}/></div></section>;
  // ★マナラッシュはマイページの中ではなく、それだけの画面にする（2026-10-04 ご要望）★
  if (activePage === 'rush') return <section className="mana-hub mana-hub-rush" data-rush-page><div className="mypage-extra-scroll"><ManaRush onBack={onBack} defaultSubject={defaultSubject}/></div></section>;
  // ★ガチャ・マイページは下のナビから入るので「← ホーム」は置かない（2026-10-05）★
  if (activePage === 'gacha' || activePage === 'gacha-shop') return <section className={`mana-hub mana-hub-gacha compact-gacha ${activePage === 'gacha-shop' ? 'gacha-shop-page' : ''}`} data-gacha-page={activePage}>
    <nav className="gacha-page-switch" aria-label="ガチャ内メニュー">
      <button type="button" onClick={() => onPage('gacha')} aria-current={activePage === 'gacha' ? 'page' : undefined}><Sparkles size={18} />装飾ガチャ</button>
      <button type="button" onClick={() => onPage('gacha-shop')} aria-current={activePage === 'gacha-shop' ? 'page' : undefined}><Store size={18} />ショップ</button>
    </nav>
    {activePage === 'gacha' ? <GachaRoom embedded onBack={onBack} onMissions={()=>onPage('missions')}/> : <MyCollection key={`${uid}:gacha-shop`} view="shop" gachaMode onGacha={() => onPage('gacha')} />}
  </section>;
  return <section className="mana-hub mypage-hub" data-mypage>
    <header className="mana-hub-header"><h1><KineticText text="マイページ" /></h1></header>
    {/* ショップはガチャ欄から入る独立画面。マイページには置かない。 */}
    <nav className="mypage-tabs" aria-label="マイページメニュー">{/* B9：「記録」→「カレンダー」。中身（日付を押して比べる）がひと目でわかる名前とアイコン */}{([['overview','マイページ',UserRound],['log','カレンダー',CalendarDays],['outfit','きせかえ',Shirt],['badges','称号',Award],['prints','マイPDF',FileText]] as const).map(([id,label,Icon]) => <button type="button" key={id} data-tab={id} aria-current={activePage === id || (id === 'log' && activePage === 'log-new') || (id === 'overview' && activePage === 'profile-edit') ? 'page' : undefined} onClick={()=>openTab(id)}><Icon size={16} aria-hidden="true" /><span>{label}</span></button>)}</nav>
    <div className="mypage-body">
    {page === 'overview' ? <main className="mypage-overview" data-mypage-overview>
      {/* 2026-10-28 A1/A3：とびら君・Lv・コインのカードは「今日の勉強記録」カードにまとめた（別カードはなくした） */}
      <MyStudyCard onEdit={() => onPage('profile-edit')} />
      {/* 「レベルで手に入るもの」はミッションの中へ移した（マイページをスクロールなしで1画面に収める・2026-10-05） */}
    </main> : activePage === 'outfit' || activePage === 'prints' || activePage === 'rewards' ? <MyCollection key={`${uid}:${activePage}:${outfitKind}`} view={activePage === 'outfit' || activePage === 'rewards' ? 'owned' : activePage} initialKind={activePage === 'outfit' ? outfitKind : 'all'} onGacha={()=>onPage('gacha')}/>
    : activePage === 'profile-edit' ? <main className="mypage-overview mypage-profile-edit" data-mypage-profile-edit>
      <div className="profile-standalone-head"><button type="button" onClick={() => onPage('overview')} aria-label="マイページにもどる">←</button><h2>プロフィールを編集</h2></div>
      <MyProfileCard />
    </main>
    : activePage === 'log' || activePage === 'log-new' ? <StudyLogPage key={`${uid}:log`} />
    : activePage === 'stats' ? <div className="mypage-extra-scroll"><StudyRecord embedded onReview={onReview} onRetry={onRetry}/></div>
    : <div className="mypage-extra-scroll"><BattleProfile key={`${uid}:${activePage}`} standalone initialTab={activePage as 'outfit' | 'badges' | 'stats'} onBack={()=>onPage('overview')}/></div>}
    </div>
  </section>;
}
