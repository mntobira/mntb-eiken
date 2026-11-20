/**
 * すごろく塾 管理者ポータル：教材PDF棚（エッセンシャル設計 ＆ AI 5 塾専用冊子スイート統合）
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
  | 'sugoroku_pack'
  | 'written'
  | 'wordbook'
  | 'drill'
  | 'writing'
  | 'guide';

/**
 * AI 5（`src/sugoroku/curriculum/index.ts` v4）が生成・配置した
 * すごろく専用白黒印刷PDF 6冊フルスイート（計89ページ）の共通カタログ定義。
 * `/sugoroku/*.pdf` が `public/` 配下に実在するため、そのまま即座にプレビュー・印刷・保存できる。
 */
export const SUGOROKU_DEDICATED_PDFS: readonly GachaPrintDef[] = [
  {
    id: 'sugoroku_pdf_eiken2_placement_diagnostic_6p',
    subject: 'eiken_2',
    category: '完全版',
    label: '入塾初回15分 英検2級スタートライン診断テスト＆A/B/C処方箋シート（全25問）',
    file: '/sugoroku/sugoroku_eiken2_placement_diagnostic_test.pdf',
    thumb: '/prints/thumbs/print_eiken_guide_2.webp',
    pages: 6,
    kb: 280,
  },
  {
    id: 'sugoroku_pdf_eiken2_route_12w',
    subject: 'eiken_2',
    category: '完全版',
    label: '英検2級 3か月（12週間）合格モデルカリキュラム＆学習ルート表',
    file: '/sugoroku/sugoroku_eiken2_12week_curriculum_route.pdf',
    thumb: '/prints/thumbs/print_eiken_guide_2.webp',
    pages: 6,
    kb: 320,
  },
  {
    id: 'sugoroku_pdf_eiken2_weekly_vocab_12w',
    subject: 'eiken_2',
    category: '単語テスト',
    label: '英検2級 必須語彙 週次確認小テスト［Form A］＆解答冊子（全12回・240語）',
    file: '/sugoroku/sugoroku_eiken2_weekly_vocab_tests_12w.pdf',
    thumb: '/prints/thumbs/print_eiken_wordbook_2.webp',
    pages: 26,
    kb: 640,
  },
  {
    id: 'sugoroku_pdf_eiken2_weekly_vocab_retest_form_b_12w',
    subject: 'eiken_2',
    category: '単語テスト',
    label: '英検2級 週次語彙テスト『再テスト専用［Form B］』＆解答冊子（全12回）',
    file: '/sugoroku/sugoroku_eiken2_weekly_vocab_retests_formB_12w.pdf',
    thumb: '/prints/thumbs/print_eiken_wordbook2_2.webp',
    pages: 25,
    kb: 620,
  },
  {
    id: 'sugoroku_pdf_pre2plus_bridge_8stages',
    subject: 'eiken_pre2plus',
    category: '完全版',
    label: '準2級・準2級プラス 段階ブリッジ学習ルート＆基礎確認小テスト（全8回・160語）',
    file: '/sugoroku/sugoroku_pre2plus_bridge_4week_pack.pdf',
    thumb: '/prints/thumbs/print_eiken_guide_pre2plus.webp',
    pages: 18,
    kb: 480,
  },
  {
    id: 'sugoroku_pdf_eiken2_scbt_handbook_8p',
    subject: 'eiken_2',
    category: '出題傾向',
    label: '英検2級 S-CBT面接・新形式要約・英作文＆大問1消去法 実践ハンドブック',
    file: '/sugoroku/sugoroku_eiken2_scbt_writing_speaking_handbook.pdf',
    thumb: '/prints/thumbs/print_eiken_writing_2.webp',
    pages: 8,
    kb: 380,
  },
];

export function classifyEikenMaterial(
  print: GachaPrintDef,
): Exclude<MaterialKindFilter, 'all'> | null {
  if (!print.subject.startsWith('eiken_')) return null;
  if (print.id.startsWith('sugoroku_pdf_')) {
    return 'sugoroku_pack';
  }
  if (print.id.includes('_written_')) return 'written';
  if (print.id.startsWith('print_eiken_wordbook')) return 'wordbook';
  if (print.id.startsWith('print_eiken_drill_')) return 'drill';
  if (print.id.startsWith('print_eiken_writing_')) return 'writing';
  if (print.id.startsWith('print_eiken_guide_') || print.category === '出題傾向') return 'guide';
  return 'guide';
}

const KIND_TABS: readonly { id: MaterialKindFilter; label: string }[] = [
  { id: 'all', label: 'すべて' },
  { id: 'sugoroku_pack', label: '塾専用冊子' },
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
    () => [
      ...SUGOROKU_DEDICATED_PDFS,
      ...GACHA_PRINTS.filter((p) => p.subject.startsWith('eiken_')),
    ],
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
        const hay = `${p.label} ${p.id} ${p.category}`.toLowerCase();
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
      className="sg-stagger"
      style={{ display: 'grid', gap: 12 }}
    >
      {/* フィルタバー */}
      <div style={{ display: 'grid', gap: 8 }}>
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
            const isSugorokuPack = item.id.startsWith('sugoroku_pdf_');
            return (
              <article key={item.id} className="sg-pdf-card">
                <div style={{ display: 'grid', gap: 4 }}>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 6,
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <span className="sg-grade-tag">{gradeLabel}</span>
                      {isSugorokuPack && <span className="sg-grade-tag">塾専用</span>}
                    </div>
                    <span
                      style={{
                        font: '600 12px/1 var(--mt-font-body)',
                        color: 'var(--mt-ink-3)',
                      }}
                    >
                      {item.pages}p
                    </span>
                  </div>
                  <h3 className="sg-pdf-title">{item.label}</h3>
                </div>

                <div style={{ display: 'flex', gap: 6 }}>
                  <PrimaryButton
                    style={{ flex: 1 }}
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
