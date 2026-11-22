import { type ClassroomDoc } from '../../utils/classroomCore';

// ===================================================================
// 塾・教室ルーム作成モーダル（級ごと分割なし・1つの招待コードで全級一括管理）
// ===================================================================

interface CreateClassModalProps {
  schoolName: string;
  className: string;
  subject: ClassroomDoc['subject'];
  creating: boolean;
  accent: string;
  onChangeSchool: (value: string) => void;
  onChangeClass: (value: string) => void;
  onChangeSubject: (value: ClassroomDoc['subject']) => void;
  onClose: () => void;
  onSubmit: () => void;
}

export function CreateClassModal(props: CreateClassModalProps) {
  const canSubmit = props.schoolName.trim().length > 0 && !props.creating;

  const handleCreateSubmit = () => {
    if (!props.className.trim()) {
      props.onChangeClass('全級一括ルーム（英検5級〜1級）');
    }
    if (!props.subject || !props.subject.startsWith('eiken_')) {
      props.onChangeSubject('eiken_2');
    }
    props.onSubmit();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 px-4 py-6"
      onClick={props.onClose}
    >
      <div
        className="w-full max-w-md bg-white rounded-2xl border border-[#E0E1DD] p-5"
        onClick={(event) => event.stopPropagation()}
      >
        <h2 className="text-lg font-bold text-[#1B2631] mb-1">塾・教室ルームを作る（全級一括）</h2>
        <p className="text-xs text-[#6B7280] mb-4 leading-relaxed">
          英検の級ごとにルームを分ける必要はありません。1つ作れば共通の6文字招待コードが発行され、5級〜1級どの級を学習している生徒もまとめて一括管理・宿題配信・添削できます。
        </p>

        <label className="block mb-3">
          <span className="block text-xs font-bold text-[#4B5563] mb-1">塾名・教室名</span>
          <input
            value={props.schoolName}
            onChange={(event) => props.onChangeSchool(event.target.value)}
            maxLength={40}
            placeholder="例）すごろく学習塾 本校"
            className="w-full px-3 py-2 rounded-xl border border-[#C9D2DA] text-sm text-[#1B2631] focus:outline-none focus:border-[#6FA8C5]"
          />
          <span className="block text-xs text-[#9BA3AE] mt-1">
            生徒が招待コードを入れた際にもこの塾名が表示されます。
          </span>
        </label>

        <label className="block mb-5">
          <span className="block text-xs font-bold text-[#4B5563] mb-1">
            ルーム名（任意・空欄なら「全級一括ルーム」になります）
          </span>
          <input
            value={props.className}
            onChange={(event) => props.onChangeClass(event.target.value)}
            maxLength={40}
            placeholder="例）英検対策 全学年一括"
            className="w-full px-3 py-2 rounded-xl border border-[#C9D2DA] text-sm text-[#1B2631] focus:outline-none focus:border-[#6FA8C5]"
          />
        </label>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={props.onClose}
            className="flex-1 px-4 py-2.5 rounded-xl text-sm border border-[#E0E1DD] text-[#4B5563] hover:bg-[#FAF8F2] transition-colors"
          >
            やめる
          </button>
          <button
            type="button"
            onClick={handleCreateSubmit}
            disabled={!canSubmit}
            className="flex-1 px-4 py-2.5 rounded-xl text-sm font-bold text-white transition-transform active:scale-95 disabled:opacity-50"
            style={{ backgroundColor: props.accent }}
          >
            {props.creating ? '開設中…' : '招待コードを発行して作る'}
          </button>
        </div>
      </div>
    </div>
  );
}
