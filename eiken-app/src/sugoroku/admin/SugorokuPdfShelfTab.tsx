/**
 * すごろく塾 管理者ポータル：教材PDF棚（エッセンシャル設計）
 */

import { useMemo, useState } from 'react';
import { Download, Eye, Layers, Search } from 'lucide-react';
import { GACHA_PRINTS, type GachaPrintDef } from '../../data/gachaPrints.generated';
import { EIKEN_GRADES } from '../../eiken/config';
import { openPdf } from '../../utils/pdfViewer';
import { savePdf } from '../../utils/pdfShare';
import { Card, PrimaryButton, SecondaryButton } from '../../components/ui';
import { SugorokuBottomSheet, type ToastTone } from './SugorokuInteractiveUi';

export type MaterialKindFilter =
  | 'all'
  | 'written'
  | 'wordbook'
  | 'drill'
  | 'writing'
  | 'guide';

export function classifyEikenMaterial(
  print: GachaPrintDef,
): Exclude<MaterialKindFilter, 'all'> | null {
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
  { id: 'written', label: '一次筆記' },
  { id: 'wordbook', label: '単語' },
  { id: 'drill', label: '大問1' },
  { id: 'writing', label: '英作文' },
  { id: 'guide', label: 'ガイド' },
];

export function SugorokuPdfShelfTab({
  onToast,
}: {
  onToast?: (message: string, tone?: ToastTone) => void;
}) {
  const [gradeFilter, setGradeFilter] = useState<string>('eiken_2');
  const [kindFilter, setKindFilter] = useState<MaterialKindFilter>('all');
  const [keyword, setKeyword] = useState('');
  const [downloadingFile, setDownloadingFile] = useState<string | null>(null);
  const [sheetPrint, setSheetPrint] = useState<GachaPrintDef | null>(null);

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
        const hay = `${p.label} ${p.id}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [eikenPrints, gradeFilter, kindFilter, keyword]);

  const handleDownload = async (fileUrl: string, label: string) => {
    setDownloadingFile(fileUrl);
    const safeName = `${label.replace(/[\\/:*?"<>|\s]+/g, '_')}.pdf`;
    try {
      await savePdf(fileUrl, safeName, label);
      onToast?.('PDFを保存しました', 'done');
    } catch {
      onToast?.('保存に失敗しました', 'warn');
    } finally {
      setDownloadingFile(null);
    }
  };

  return (
    <section
      aria-label="教材PDF"
      className="sg-stagger sg-grid-12"
    >
      {/* フィルタバー */}
      <div className="sg-grid-8">
        <div className="sg-chip-group" role="group" aria-label="級">
          <button
            type="button"
            className="sg-chip"
            aria-pressed={gradeFilter === 'all'}
            onClick={() => setGradeFilter('all')}
          >
            全級
          </button>
          {[...EIKEN_GRADES].reverse().map((g) => (
            <button
              key={g.id}
              type="button"
              className="sg-chip"
              aria-pressed={gradeFilter === g.id}
              onClick={() => setGradeFilter(g.id)}
            >
              {g.label.replace('英検', '')}
            </button>
          ))}
        </div>

        <div className="sg-toolbar">
          <div className="sg-chip-group" role="group" aria-label="種類">
            {KIND_TABS.map((t) => (
              <button
                key={t.id}
                type="button"
                className="sg-chip"
                aria-pressed={kindFilter === t.id}
                onClick={() => setKindFilter(t.id)}
              >
                {t.label}
              </button>
            ))}
          </div>

          <label className="sg-search">
            <Search size={15} aria-hidden="true" />
            <input
              type="search"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              placeholder="検索"
            />
          </label>
        </div>
      </div>

      {/* PDF一覧 */}
      {filtered.length === 0 ? (
        <Card className="slog-empty">該当するPDFがありません</Card>
      ) : (
        <div className="sg-pdf-grid sg-stagger">
          {filtered.map((item) => {
            const gradeLabel =
              EIKEN_GRADES.find((g) => g.id === item.subject)?.label.replace('英検', '') ??
              item.subject;
            return (
              <article key={item.id} className="sg-pdf-card">
                <div className="sg-grid-4">
                  <div className="sg-pdf-head-row">
                    <span className="sg-grade-tag">{gradeLabel}</span>
                    <span className="sg-pdf-pages">
                      {item.pages}p
                    </span>
                  </div>
                  <h3 className="sg-pdf-title">{item.label}</h3>
                </div>

                <div className="sg-flex-gap-6">
                  <PrimaryButton
                    className="sg-flex-1"
                    onClick={() => openPdf(item.file, item.label)}
                    icon={<Eye size={14} aria-hidden="true" />}
                  >
                    開く
                  </PrimaryButton>

                  {item.variants && item.variants.length > 0 ? (
                    <SecondaryButton
                      onClick={() => setSheetPrint(item)}
                      icon={<Layers size={14} aria-hidden="true" />}
                    >
                      分冊
                    </SecondaryButton>
                  ) : (
                    <SecondaryButton
                      disabled={downloadingFile === item.file}
                      onClick={() => void handleDownload(item.file, item.label)}
                      icon={<Download size={14} aria-hidden="true" />}
                    >
                      保存
                    </SecondaryButton>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}

      {/* 分冊ボトムシート */}
      <SugorokuBottomSheet
        open={!!sheetPrint}
        title={sheetPrint ? sheetPrint.label : '分冊'}
        onClose={() => setSheetPrint(null)}
      >
        {sheetPrint && (
          <div className="slog-rows">
            <div className="slog-row">
              <span>
                <strong>全ページ結合（{sheetPrint.pages}p）</strong>
              </span>
              <div className="slog-row-actions">
                <SecondaryButton
                  onClick={() => {
                    const target = sheetPrint;
                    setSheetPrint(null);
                    openPdf(target.file, target.label);
                  }}
                >
                  開く
                </SecondaryButton>
                <PrimaryButton
                  disabled={downloadingFile === sheetPrint.file}
                  onClick={() => void handleDownload(sheetPrint.file, sheetPrint.label)}
                >
                  保存
                </PrimaryButton>
              </div>
            </div>

            {(sheetPrint.variants ?? []).map((v) => (
              <div key={v.file} className="slog-row">
                <span>
                  <strong>
                    {v.label}（{v.pages}p）
                  </strong>
                </span>
                <div className="slog-row-actions">
                  <SecondaryButton
                    onClick={() => {
                      const title = `${sheetPrint.label}（${v.label}）`;
                      setSheetPrint(null);
                      openPdf(v.file, title);
                    }}
                  >
                    開く
                  </SecondaryButton>
                  <PrimaryButton
                    disabled={downloadingFile === v.file}
                    onClick={() =>
                      void handleDownload(v.file, `${sheetPrint.label}_${v.label}`)
                    }
                  >
                    保存
                  </PrimaryButton>
                </div>
              </div>
            ))}
          </div>
        )}
      </SugorokuBottomSheet>
    </section>
  );
}
