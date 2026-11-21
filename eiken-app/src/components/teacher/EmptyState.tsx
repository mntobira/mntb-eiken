import { Plus, Sparkles, Clock, Send, BarChart3, ShieldCheck, BookOpenCheck } from 'lucide-react';

// ============================================================================
// クラス・コースがまだ1つも無いときのオンボーディング画面（塾・英語スクール中心）
// ============================================================================

export function EmptyState({
  onCreate,
  onOpenSugorokuAdmin,
  accent,
}: {
  onCreate: () => void;
  onOpenSugorokuAdmin?: () => void;
  accent: string;
}) {
  return (
    <div className="bg-white rounded-3xl border border-[#E0E1DD] shadow-sm overflow-hidden">
      {/* ヒーロー帯 */}
      <div className="bg-gradient-to-br from-[#F2FAF8] via-[#FAF8F2] to-white px-6 sm:px-8 pt-8 pb-6 border-b border-[#ECE9E1]">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-extrabold bg-white text-[#236B63] border border-[#CBECE7] shadow-xs mb-3">
          <Sparkles className="w-3.5 h-3.5 text-[#3E9C93]" />
          オンライン塾・学習塾・英語スクール対応
        </div>
        <h2 className="text-xl sm:text-2xl font-extrabold text-[#1B2631] leading-snug mb-2">
          最初のコース・クラスを開設しましょう
        </h2>
        <p className="text-sm text-[#4B5563] leading-relaxed max-w-2xl">
          目標級・1日の学習分数・週の目標日数を決めてクラスを作ると、
          <strong className="text-[#1B2631]">生徒招待リンク・6文字コード・LINE案内文</strong>
          がその場で発行されます。メールアドレスの名簿登録は不要です。
        </p>

        <div className="mt-5 flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={onCreate}
            className="inline-flex min-h-[46px] items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-extrabold text-white shadow-sm transition-transform active:scale-[0.99]"
            style={{ backgroundColor: accent }}
          >
            <Plus className="w-4 h-4" />
            新しいコース・クラスを開設する
          </button>
          {onOpenSugorokuAdmin && (
            <button
              type="button"
              onClick={onOpenSugorokuAdmin}
              className="inline-flex min-h-[46px] items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-bold bg-white border border-[#D8D5CC] text-[#1B2631] hover:bg-[#FAF8F2] transition-colors"
            >
              <BookOpenCheck className="w-4 h-4 text-[#3E9C93]" />
              4技能添削・教材PDFポータルを開く
            </button>
          )}
        </div>
      </div>

      {/* 導入3ステップ */}
      <div className="px-6 sm:px-8 py-6">
        <p className="text-xs font-extrabold tracking-wider text-[#6B7280] uppercase mb-3.5">
          運用スタートまでの3ステップ（約1分）
        </p>
        <div className="grid sm:grid-cols-3 gap-3.5 mb-5">
          <div className="rounded-2xl bg-[#FDFBF7] border border-[#E8E5DC] p-4">
            <div className="w-8 h-8 rounded-xl bg-[#E8F6F4] text-[#236B63] flex items-center justify-center font-extrabold text-sm mb-2.5">
              1
            </div>
            <p className="text-sm font-extrabold text-[#1B2631] mb-1 flex items-center gap-1.5">
              <Clock className="w-4 h-4 text-[#3E9C93]" />
              目標級・学習時間を設定
            </p>
            <p className="text-xs text-[#4B5563] leading-relaxed">
              英検2級・準2級などの対象級と「1日30分×週5日」などの学習ペース基準を設定します（後からいつでも編集可能）。
            </p>
          </div>

          <div className="rounded-2xl bg-[#FDFBF7] border border-[#E8E5DC] p-4">
            <div className="w-8 h-8 rounded-xl bg-[#E8F6F4] text-[#236B63] flex items-center justify-center font-extrabold text-sm mb-2.5">
              2
            </div>
            <p className="text-sm font-extrabold text-[#1B2631] mb-1 flex items-center gap-1.5">
              <Send className="w-4 h-4 text-[#3E9C93]" />
              LINE・URLでワンタップ招待
            </p>
            <p className="text-xs text-[#4B5563] leading-relaxed">
              自動作成される招待URLまたは6文字コードを生徒へ送信。入室した塾生は広告が自動で完全非表示になります。
            </p>
          </div>

          <div className="rounded-2xl bg-[#FDFBF7] border border-[#E8E5DC] p-4">
            <div className="w-8 h-8 rounded-xl bg-[#E8F6F4] text-[#236B63] flex items-center justify-center font-extrabold text-sm mb-2.5">
              3
            </div>
            <p className="text-sm font-extrabold text-[#1B2631] mb-1 flex items-center gap-1.5">
              <BarChart3 className="w-4 h-4 text-[#3E9C93]" />
              勉強時間・宿題を自動可視化
            </p>
            <p className="text-xs text-[#4B5563] leading-relaxed">
              誰が・どの分野（語彙/長文/リスニング/英作文/面接）を・何分勉強したかが日別で自動集計されます。
            </p>
          </div>
        </div>

        {/* プライバシー保証 */}
        <div className="flex items-start gap-2.5 rounded-2xl bg-[#F6F9FC] border border-[#DCE6F0] p-3.5 text-xs text-[#3C5A6E] leading-relaxed">
          <ShieldCheck className="w-4 h-4 mt-0.5 shrink-0 text-[#2F7C74]" />
          <div>
            <strong className="text-[#1B2631]">生徒データの安全な管理：</strong>
            生徒本人が招待リンクまたはコードから参加に同意したときのみ学習記録が共有されます。講師用の管理名（本名・管理番号）は公開ランキング等の外部画面には一切表示されません。
          </div>
        </div>
      </div>
    </div>
  );
}
