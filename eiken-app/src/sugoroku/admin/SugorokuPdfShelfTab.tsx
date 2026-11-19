/**
 * ===================================================================
 * すごろく塾管理者ポータル：講師用PDF教材ダイレクト棚
 * ===================================================================
 * ガチャ不要で、収録されている英検全冊子（一次筆記120冊×4分冊＝480ファイル、
 * 重点語・例文ノート16冊、大問1スピード演習8冊、ライティング実戦6冊、解法ガイド8冊等）を
 * 級別・種類別に絞り込み、ワンタップで閲覧・印刷・生徒配布用ダウンロードできる講師専用棚。
 */

import { useMemo, useState } from 'react';
import { BookOpen, Download, Eye, Search, FileText } from 'lucide-react';
import { GACHA_PRINTS, type GachaPrintDef } from '../../data/gachaPrints.generated';
import { EIKEN_GRADES } from '../../eiken/config';
import { openPdf } from '../../utils/pdfViewer';
import { savePdf } from '../../utils/pdfShare';

export type MaterialKindFilter =
  | 'all'
  | 'written'
  | 'wordbook'
  | 'drill'
  | 'writing'
  | 'guide';

export function classifyEikenMaterial(print: GachaPrintDef): Exclude<MaterialKindFilter, 'all'> | null {
  if (!print.subject.startsWith('eiken_')) return null;
  if (print.id.includes('_written_')) return 'written';
  if (print.id.startsWith('print_eiken_wordbook')) return 'wordbook';
  if (print.id.startsWith('print_eiken_drill_')) return 'drill';
  if (print.id.startsWith('print_eiken_writing_')) return 'writing';
  if (print.id.startsWith('print_eiken_guide_') || print.category === '出題傾向') return 'guide';
  return 'guide';
}

const KIND_TABS: readonly { id: MaterialKindFilter; label: string }[] = [
  { id: 'all', label: 'すべて' },
  { id: 'written', label: '一次筆記冊子（問題・解答用紙・解説）' },
  { id: 'wordbook', label: '重点語・例文ノート' },
  { id: 'drill', label: '大問1 スピード演習' },
  { id: 'writing', label: 'ライティング実戦' },
  { id: 'guide', label: '解法・時間配分ガイド' },
];

export function SugorokuPdfShelfTab() {
  // すごろく様の主戦場は「英検2級・準2級プラス・準2級」のため初期選択は「英検2級」または「全級」
  const [gradeFilter, setGradeFilter] = useState<string>('eiken_2');
  const [kindFilter, setKindFilter] = useState<MaterialKindFilter>('all');
  const [keyword, setKeyword] = useState('');
  const [downloadingFile, setDownloadingFile] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const eikenPrints = useMemo(
    () => GACHA_PRINTS.filter((p) => p.subject.startsWith('eiken_')),
    [],
  );

  const filtered = useMemo(() => {
    const q = keyword.trim().toLowerCase();
    return eikenPrints.filter((p) => {
      if (gradeFilter !== 'all' && p.subject !== gradeFilter) return false;
      const kind = classifyEikenMaterial(p);
      if (!kind) return false;
      if (kindFilter !== 'all' && kind !== kindFilter) return false;
      if (q) {
        const hay = `${p.label} ${p.description || ''} ${p.id}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [eikenPrints, gradeFilter, kindFilter, keyword]);

  const handleDownload = async (fileUrl: string, label: string) => {
    setDownloadingFile(fileUrl);
    setToast(null);
    const safeName = `${label.replace(/[\\/:*?"<>|\s]+/g, '_')}.pdf`;
    try {
      const msg = await savePdf(fileUrl, safeName, label);
      setToast(msg || `「${label}」をダウンロードしました`);
    } catch (e) {
      setToast(e instanceof Error ? e.message : 'PDFの保存に失敗しました。');
    } finally {
      setDownloadingFile(null);
    }
  };

  return (
    <section aria-label="講師用PDF教材ダイレクト棚" className="space-y-4">
      <div className="rounded-2xl border border-[#E2DDD2] bg-white p-4 sm:p-5 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
          <div>
            <h2 className="text-base sm:text-lg font-bold text-[#1B2631] flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-[#1D58A8] shrink-0" />
              講師専用 PDF教材ダイレクト棚（ガチャ不要・全冊子即時DL）
            </h2>
            <p className="text-xs sm:text-sm text-[#4B5563] mt-0.5 leading-relaxed">
              個別指導・宿題配布・無料体験授業でそのまま使える全{eikenPrints.length}冊（分冊含め450ファイル超）を直接開けます。一次筆記は「問題冊子のみ」「マーク解答用紙のみ」「解説のみ」の分冊DLにも対応しています。
            </p>
          </div>
          <span className="inline-flex self-start sm:self-center items-center rounded-full bg-[#E8F2FD] px-3 py-1 text-xs font-bold text-[#1D58A8] shrink-0">
            表示中 {filtered.length} 冊
          </span>
        </div>

        {/* 級フィルタ */}
        <div className="flex flex-wrap gap-1.5 mb-3" role="group" aria-label="級で絞り込み">
          <button
            type="button"
            onClick={() => setGradeFilter('all')}
            className={`min-h-[36px] px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors ${
              gradeFilter === 'all'
                ? 'bg-[#1B2631] text-white border-[#1B2631]'
                : 'bg-[#F8F6F1] text-[#4B5563] border-[#E2DDD2] hover:bg-white'
            }`}
          >
            全8級（{eikenPrints.length}）
          </button>
          {[...EIKEN_GRADES].reverse().map((g) => {
            const isFocus = ['eiken_2', 'eiken_pre2plus', 'eiken_pre2'].includes(g.id);
            const active = gradeFilter === g.id;
            return (
              <button
                key={g.id}
                type="button"
                onClick={() => setGradeFilter(g.id)}
                className={`min-h-[36px] px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors ${
                  active
                    ? 'bg-[#1D58A8] text-white border-[#1D58A8]'
                    : isFocus
                      ? 'bg-[#EEF5FF] text-[#1D58A8] border-[#B6D4F7] hover:bg-[#E1EEFF]'
                      : 'bg-[#F8F6F1] text-[#4B5563] border-[#E2DDD2] hover:bg-white'
                }`}
              >
                {g.label}
                {g.id === 'eiken_2' && !active ? ' ★主力' : ''}
              </button>
            );
          })}
        </div>

        {/* 種類フィルタ＋キーワード検索 */}
        <div className="flex flex-col md:flex-row gap-2.5 md:items-center justify-between">
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="教材種類で絞り込み">
            {KIND_TABS.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setKindFilter(t.id)}
                className={`min-h-[34px] px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors ${
                  kindFilter === t.id
                    ? 'bg-[#16794F] text-white'
                    : 'bg-[#F1EFE9] text-[#4B5563] hover:bg-[#E5E2D9]'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          <label className="relative flex items-center min-w-0 md:w-64">
            <Search className="w-4 h-4 text-[#6B7280] absolute left-3 pointer-events-none" />
            <input
              type="search"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              placeholder="回次・キーワード検索（例: 第3回）"
              className="w-full min-h-[38px] pl-9 pr-3 py-1.5 rounded-xl border border-[#D5D1C8] bg-[#FDFBF7] text-xs sm:text-sm text-[#1B2631] focus:outline-none focus:border-[#1D58A8]"
            />
          </label>
        </div>

        {toast && (
          <p
            role="status"
            className="mt-3 rounded-xl bg-[#EAF7F0] border border-[#B5E2C9] px-3 py-2 text-xs font-semibold text-[#16794F]"
          >
            {toast}
          </p>
        )}
      </div>

      {/* PDFカード一覧（スマホ1列 / iPad 2列 / PC 2〜3列、横はみ出しゼロ） */}
      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-[#E2DDD2] bg-white p-8 text-center text-sm text-[#6B7280]">
          条件に一致するPDF教材がありません。フィルタを変更してください。
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {filtered.map((item) => (
            <article
              key={item.id}
              className="rounded-2xl border border-[#E2DDD2] bg-white p-4 flex flex-col justify-between gap-3 min-w-0 shadow-xs"
            >
              <div className="flex items-start gap-3 min-w-0">
                <div className="w-10 h-10 rounded-xl bg-[#EEF5FF] text-[#1D58A8] flex items-center justify-center shrink-0">
                  <FileText className="w-5 h-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5 mb-1">
                    <span className="inline-block rounded-md bg-[#F1EFE9] px-2 py-0.5 text-[11px] font-bold text-[#374151]">
                      {EIKEN_GRADES.find((g) => g.id === item.subject)?.label ?? item.subject}
                    </span>
                    <span className="text-[11px] text-[#6B7280]">
                      全{item.pages}ページ・約{item.kb}KB
                    </span>
                  </div>
                  <h3 className="text-sm font-bold text-[#1B2631] leading-snug break-words">
                    {item.label}
                  </h3>
                  {item.description && (
                    <p className="text-xs text-[#6B7280] mt-1 line-clamp-2 leading-relaxed">
                      {item.description}
                    </p>
                  )}
                </div>
              </div>

              <div className="space-y-2 pt-1 border-t border-[#F1EFE9]">
                {/* メイン操作：結合版プレビュー＆DL */}
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => openPdf(item.file, item.label)}
                    className="flex-1 min-w-[110px] min-h-[38px] inline-flex items-center justify-center gap-1.5 rounded-xl bg-[#1D58A8] px-3 py-1.5 text-xs font-bold text-white hover:bg-[#164788] transition-colors"
                  >
                    <Eye className="w-3.5 h-3.5 shrink-0" />
                    プレビュー・印刷
                  </button>
                  <button
                    type="button"
                    disabled={downloadingFile === item.file}
                    onClick={() => void handleDownload(item.file, item.label)}
                    className="flex-1 min-w-[110px] min-h-[38px] inline-flex items-center justify-center gap-1.5 rounded-xl border border-[#1D58A8] bg-white px-3 py-1.5 text-xs font-bold text-[#1D58A8] hover:bg-[#EEF5FF] disabled:opacity-50 transition-colors"
                  >
                    <Download className="w-3.5 h-3.5 shrink-0" />
                    {downloadingFile === item.file ? '保存中…' : '一括PDF保存'}
                  </button>
                </div>

                {/* 一次筆記の3分冊（問題冊子／解答用紙／解説）ダイレクトボタン */}
                {item.variants && item.variants.length > 0 && (
                  <div className="grid grid-cols-3 gap-1.5">
                    {item.variants.map((v) => (
                      <button
                        key={v.file}
                        type="button"
                        onClick={() => openPdf(v.file, `${item.label}（${v.label}）`)}
                        className="min-h-[34px] px-2 py-1 rounded-lg bg-[#F8F6F1] hover:bg-[#EDE9DF] border border-[#E2DDD2] text-[11px] font-bold text-[#374151] text-center truncate"
                        title={`${v.label}（${v.pages}p）を開く`}
                      >
                        {v.label} ({v.pages}p)
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
