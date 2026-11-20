import { useEffect, useState } from 'react';
import { ArrowLeft, Mic, PenLine, School } from 'lucide-react';
import { auth } from '../../firebase';
import { fetchMyClassrooms } from '../../utils/classroom';
import type { ClassroomDoc } from '../../utils/classroomCore';
import { TeacherSpeakingReviewTab } from '../speaking-scbt/TeacherSpeakingReviewTab';
import { TeacherWritingReviewTab } from '../writing-review/TeacherWritingReviewTab';
import { SUGOROKU_DEMO_CLASS_ID } from '../writing-review/writingStore';
import '../writing-review/writing-review.css';
import '../speaking-scbt/speaking-scbt.css';

export interface SugorokuReviewHubProps {
  initialTab?: 'writing' | 'speaking';
  onBack: () => void;
}

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
      .catch(() => undefined);
  }, []);

  const activeRoom = classrooms.find(r => r.id === selectedClassId);

  return (
    <main className="srh-main" data-sugoroku-review-hub>
      <div className="srh-container">
        <header className="twr-row-between">
          <div className="twr-row-wrap">
            <button type="button" className="scbt-back-btn" onClick={onBack}>
              <ArrowLeft size={17} aria-hidden="true" />
              戻る
            </button>
            <div>
              <div className="srh-subhead">
                <School size={14} aria-hidden="true" />
                オンライン個別指導「すごろく」講師用ポータル（4技能添削・音声レビュー）
              </div>
              <h1 className="srh-title">
                ライティング添削 ＆ S-CBTスピーキング音声確認
              </h1>
            </div>
          </div>

          <div className="twr-row-wrap">
            <select
              aria-label="対象クラス選択"
              className="scbt-input"
              value={selectedClassId}
              onChange={e => {
                const next = e.target.value;
                setSelectedClassId(next);
                setDemoMode(next === SUGOROKU_DEMO_CLASS_ID);
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

        <div role="tablist" aria-label="添削種別の切り替え" className="srh-tablist">
          <button
            type="button"
            role="tab"
            className="srh-tab-btn"
            aria-selected={tab === 'writing'}
            onClick={() => setTab('writing')}
          >
            <PenLine size={16} aria-hidden="true" />
            ライティング添削・A4シート出力
          </button>
          <button
            type="button"
            role="tab"
            className="srh-tab-btn"
            aria-selected={tab === 'speaking'}
            onClick={() => setTab('speaking')}
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
