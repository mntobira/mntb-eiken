import { useEffect, useState } from 'react';
import { ArrowLeft, Mic, PenLine, School } from 'lucide-react';
import { auth } from '../../firebase';
import { fetchMyClassrooms } from '../../utils/classroom';
import type { ClassroomDoc } from '../../utils/classroomCore';
import { TeacherSpeakingReviewTab } from '../speaking-scbt/TeacherSpeakingReviewTab';
import { TeacherWritingReviewTab } from '../writing-review/TeacherWritingReviewTab';
import { SUGOROKU_DEMO_CLASS_ID } from '../writing-review/writingStore';

export interface SugorokuReviewHubProps {
  initialTab?: 'writing' | 'speaking';
  onBack: () => void;
}

/**
 * AI 3 提供：ライティング添削 ＆ S-CBTスピーキング音声確認の統合講師ビュー。
 * - AI 1 の `SugorokuAdminApp.tsx` からは `<TeacherWritingReviewTab />` / `<TeacherSpeakingReviewTab />` を直接差し込めるほか、
 *   このハブ画面自体も `?portal=review` やライティング・スピーキング画面から直接開いて動作確認・実運用できる。
 */
export function SugorokuReviewHub({
  initialTab = 'writing',
  onBack,
}: SugorokuReviewHubProps) {
  const [tab, setTab] = useState<'writing' | 'speaking'>(initialTab);
  const [classrooms, setClassrooms] = useState<ClassroomDoc[]>([]);
  const [selectedClassId, setSelectedClassId] = useState<string>(SUGOROKU_DEMO_CLASS_ID);
  const [demoMode, setDemoMode] = useState<boolean>(true);

  useEffect(() => {
    setTab(initialTab);
  }, [initialTab]);

  useEffect(() => {
    const uid = auth.currentUser?.uid;
    if (!uid) return;
    void fetchMyClassrooms()
      .then(rooms => {
        setClassrooms(rooms);
        if (rooms.length > 0) {
          setSelectedClassId(rooms[0].id);
          setDemoMode(false);
        }
      })
      .catch(() => {
        // クラウド未接続時はデモクラス表示を維持
      });
  }, []);

  const activeRoom = classrooms.find(r => r.id === selectedClassId);

  return (
    <main
      style={{
        minHeight: '100%',
        background: '#faf8f1',
        color: '#1f2d3a',
        padding: '16px 20px 96px',
        overflowY: 'auto',
      }}
      data-sugoroku-review-hub
    >
      <div style={{ maxWidth: '1120px', margin: '0 auto', display: 'grid', gap: '16px' }}>
        <header
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: '12px',
            flexWrap: 'wrap',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={onBack}
              style={{
                minHeight: '40px',
                padding: '6px 13px',
                borderRadius: '12px',
                border: '1px solid #b8cec9',
                background: '#fffdf8',
                fontWeight: 700,
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                cursor: 'pointer',
              }}
            >
              <ArrowLeft size={17} aria-hidden="true" />
              戻る
            </button>
            <div>
              <div
                style={{
                  fontSize: '12px',
                  fontWeight: 800,
                  color: '#1f5c51',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '5px',
                }}
              >
                <School size={14} aria-hidden="true" />
                オンライン個別指導「すごろく」講師用ポータル（4技能添削・音声レビュー）
              </div>
              <h1 style={{ margin: '2px 0 0', fontSize: '21px', fontWeight: 800 }}>
                ライティング添削 ＆ S-CBTスピーキング音声確認
              </h1>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <select
              aria-label="対象クラス選択"
              value={selectedClassId}
              onChange={e => {
                const next = e.target.value;
                setSelectedClassId(next);
                setDemoMode(next === SUGOROKU_DEMO_CLASS_ID);
              }}
              style={{
                minHeight: '40px',
                borderRadius: '10px',
                border: '1px solid #b8cec9',
                padding: '6px 12px',
                background: '#fff',
                fontWeight: 700,
                fontSize: '13px',
              }}
            >
              <option value={SUGOROKU_DEMO_CLASS_ID}>
                すごろく試作デモクラス（サンプル＆この端末の提出）
              </option>
              {classrooms.map(room => (
                <option key={room.id} value={room.id}>
                  {room.schoolName ? `${room.schoolName} / ` : ''}
                  {room.className}
                </option>
              ))}
            </select>
          </div>
        </header>

        {/* タブ切替 */}
        <div
          role="tablist"
          aria-label="添削種別の切り替え"
          style={{
            display: 'flex',
            gap: '8px',
            background: '#efeae0',
            padding: '5px',
            borderRadius: '14px',
            width: 'fit-content',
            maxWidth: '100%',
            flexWrap: 'wrap',
          }}
        >
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'writing'}
            onClick={() => setTab('writing')}
            style={{
              minHeight: '40px',
              padding: '7px 16px',
              borderRadius: '10px',
              border: 'none',
              background: tab === 'writing' ? '#ffffff' : 'transparent',
              color: tab === 'writing' ? '#1f4e47' : '#4b5563',
              fontWeight: 800,
              fontSize: '14px',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '7px',
              cursor: 'pointer',
            }}
          >
            <PenLine size={16} aria-hidden="true" />
            ライティング添削・A4シート出力
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'speaking'}
            onClick={() => setTab('speaking')}
            style={{
              minHeight: '40px',
              padding: '7px 16px',
              borderRadius: '10px',
              border: 'none',
              background: tab === 'speaking' ? '#ffffff' : 'transparent',
              color: tab === 'speaking' ? '#1f4e47' : '#4b5563',
              fontWeight: 800,
              fontSize: '14px',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '7px',
              cursor: 'pointer',
            }}
          >
            <Mic size={16} aria-hidden="true" />
            S-CBT スピーキング録音確認
          </button>
        </div>

        {tab === 'writing' ? (
          <TeacherWritingReviewTab
            classId={selectedClassId}
            classNameLabel={activeRoom?.className}
            reviewerUid={auth.currentUser?.uid}
            reviewerName={auth.currentUser?.displayName || 'すごろく英検担当講師'}
            demoMode={demoMode}
          />
        ) : (
          <TeacherSpeakingReviewTab
            classId={selectedClassId}
            classNameLabel={activeRoom?.className}
            reviewerUid={auth.currentUser?.uid}
            reviewerName={auth.currentUser?.displayName || 'すごろく英検担当講師'}
            demoMode={demoMode}
          />
        )}
      </div>
    </main>
  );
}
