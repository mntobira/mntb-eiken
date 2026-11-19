/**
 * ===================================================================
 * すごろく塾管理者ポータル：講師用PDF教材ダイレクト棚（マナトビ純正UI版）
 * ===================================================================
 * ・マナトビのガチャ/マイPDFと同じ温かなクリーム紙面・レア度バッジ（UR/SR）・3px縁影カード
 * ・KineticText 見出し ＋ CountUp 冊数表示
 * ・カードタップまたは「分冊を選ぶ」で SugorokuBottomSheet が下から立ち上がり、
 *   「問題冊子のみ」「マーク解答用紙のみ」「解答・解説のみ」「結合フル冊子」を即プレビュー・保存可能
 */

import { useMemo, useState } from 'react';
import { BookOpen, Download, Eye, FileText, Layers, Search } from 'lucide-react';
import { GACHA_PRINTS, type GachaPrintDef } from '../../data/gachaPrints.generated';
import { EIKEN_GRADES } from '../../eiken/config';
import { openPdf } from '../../utils/pdfViewer';
import { savePdf } from '../../utils/pdfShare';
import { KineticText } from '../../motion';
import { CountUp } from '../../components/ui/CountUp';
import {
  Badge,
  Card,
  PrimaryButton,
  RarityBadge,
  SecondaryButton,
} from '../../components/ui';
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
  { id: 'written', label: '一次筆記冊子（3分冊対応）' },
  { id: 'wordbook', label: '重点語・例文ノート' },
  { id: 'drill', label: '大問1 スピード演習' },
  { id: 'writing', label: 'ライティング実戦' },
  { id: 'guide', label: '解法・時間配分ガイド' },
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
        const hay = `${p.label} ${p.description || ''} ${p.id}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [eikenPrints, gradeFilter, kindFilter, keyword]);

  const handleDownload = async (fileUrl: string, label: string) => {
    setDownloadingFile(fileUrl);
    const safeName = `${label.replace(/[\\/:*?"<>|\s]+/g, '_')}.pdf`;
    try {
      const msg = await savePdf(fileUrl, safeName, label);
      onToast?.(msg || `「${label}」を保存しました`, 'done');
    } catch (e) {
      onToast?.(e instanceof Error ? e.message : 'PDFの保存に失敗しました。', 'warn');
    } finally {
      setDownloadingFile(null);
    }
  };

  return (
    <section
      aria-label="講師用PDF教材ダイレクト棚"
      className="sg-stagger"
      style={{ display: 'grid', gap: 14 }}
    >
      {/* ヘッダー＆フィルタカード */}
      <Card tone="gold">
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 10,
            marginBottom: 10,
          }}
        >
          <div style={{ minWidth: 0, flex: '1 1 240px' }}>
            <span className="mt-kicker">DIRECT PRINT LIBRARY</span>
            <h2 className="mt-h2" style={{ margin: '2px 0 4px', display: 'flex', alignItems: 'center', gap: 8 }}>
              <BookOpen size={20} aria-hidden="true" />
              <KineticText text="講師専用 PDF教材ダイレクト棚" />
            </h2>
            <p className="mt-small" style={{ margin: 0, color: 'var(--mt-ink-2)' }}>
              ガチャ不要で全{eikenPrints.length}冊（問題・マーク解答用紙・解説の分冊含め450ファイル超）を即プレビュー・印刷・配布用DLできます。
            </p>
          </div>

          <Badge>
            該当 <CountUp value={filtered.length} duration={450} /> 冊
          </Badge>
        </div>

        {/* 級選択チップ */}
        <div className="sg-chip-group" role="group" aria-label="級で絞り込み" style={{ marginBottom: 10 }}>
          <button
            type="button"
            className="sg-chip"
            aria-pressed={gradeFilter === 'all'}
            onClick={() => setGradeFilter('all')}
          >
            全8級（{eikenPrints.length}）
          </button>
          {[...EIKEN_GRADES].reverse().map((g) => (
            <button
              key={g.id}
              type="button"
              className="sg-chip"
              data-tone={g.id === 'eiken_2' ? 'accent' : undefined}
              aria-pressed={gradeFilter === g.id}
              onClick={() => setGradeFilter(g.id)}
            >
              {g.label}
              {g.id === 'eiken_2' ? ' ★主力' : ''}
            </button>
          ))}
        </div>

        {/* 種類チップ ＋ 検索欄 */}
        <div className="sg-filter-bar">
          <div className="sg-chip-group" role="group" aria-label="教材種類で絞り込み">
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

          <label
            style={{
              position: 'relative',
              display: 'flex',
              alignItems: 'center',
              flex: '1 1 220px',
              maxWidth: 320,
            }}
          >
            <Search
              size={16}
              aria-hidden="true"
              style={{ position: 'absolute', left: 12, color: 'var(--mt-ink-3)', pointerEvents: 'none' }}
            />
            <input
              type="search"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              placeholder="回次・キーワード検索（例: 第3回）"
              style={{
                width: '100%',
                minHeight: 44,
                padding: '0 12px 0 36px',
                borderRadius: 'var(--mt-r-pill)',
                border: '1.5px solid var(--mt-line-strong)',
                background: '#fff',
                font: '700 13px/1.2 var(--mt-font-body)',
                color: 'var(--mt-ink)',
              }}
            />
          </label>
        </div>
      </Card>

      {/* PDFカードグリッド */}
      {filtered.length === 0 ? (
        <Card className="slog-empty">
          条件に一致するPDF教材がありません。級または種類フィルタを切り替えてください。
        </Card>
      ) : (
        <div
          className="sg-stagger"
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 310px), 1fr))',
            gap: 10,
          }}
        >
          {filtered.map((item) => {
            const isUr = item.id.includes('_written_');
            const gradeLabel =
              EIKEN_GRADES.find((g) => g.id === item.subject)?.label ?? item.subject;
            return (
              <Card
                key={item.id}
                as="article"
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  gap: 10,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, minWidth: 0 }}>
                  <span
                    className="sc-icon"
                    aria-hidden="true"
                    style={{ width: 44, height: 44, borderRadius: 14 }}
                  >
                    <FileText size={22} />
                  </span>
                  <div style={{ flex: 1, minWidth: 0, display: 'grid', gap: 4 }}>
                    <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 6 }}>
                      <RarityBadge rarity={isUr ? 'UR' : 'SR'} />
                      <Badge>{gradeLabel}</Badge>
                      <span className="mt-small" style={{ fontSize: 12 }}>
                        {item.pages}p・{item.kb}KB
                      </span>
                    </div>
                    <h3
                      style={{
                        margin: 0,
                        font: '800 15px/1.35 var(--mt-font-display)',
                        color: 'var(--mt-ink-warm)',
                        overflowWrap: 'anywhere',
                      }}
                    >
                      {item.label}
                    </h3>
                  </div>
                </div>

                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  <PrimaryButton
                    style={{ flex: 1 }}
                    onClick={() => openPdf(item.file, item.label)}
                    icon={<Eye size={15} aria-hidden="true" />}
                  >
                    プレビュー・印刷
                  </PrimaryButton>

                  {item.variants && item.variants.length > 0 ? (
                    <SecondaryButton
                      onClick={() => setSheetPrint(item)}
                      icon={<Layers size={15} aria-hidden="true" />}
                    >
                      分冊・保存
                    </SecondaryButton>
                  ) : (
                    <SecondaryButton
                      disabled={downloadingFile === item.file}
                      onClick={() => void handleDownload(item.file, item.label)}
                      icon={<Download size={15} aria-hidden="true" />}
                    >
                      {downloadingFile === item.file ? '保存中…' : 'PDF保存'}
                    </SecondaryButton>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Bottom Sheet：冊子の分冊（問題冊子／マーク解答用紙／解答・解説）選択＆保存シート */}
      <SugorokuBottomSheet
        open={!!sheetPrint}
        kicker="BOOKLET VARIANTS"
        title={sheetPrint ? sheetPrint.label : '冊子を選択'}
        onClose={() => setSheetPrint(null)}
      >
        {sheetPrint && (
          <div style={{ display: 'grid', gap: 10 }}>
            {sheetPrint.description && (
              <p className="mt-body" style={{ margin: 0 }}>
                {sheetPrint.description}
              </p>
            )}

            <div className="slog-rows">
              <div className="slog-row">
                <span>
                  <strong>結合フル冊子（全{sheetPrint.pages}ページ）</strong>
                  <small>問題冊子＋マーク解答用紙＋全問解説の通しPDF</small>
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
                      {v.label}（{v.pages}ページ）
                    </strong>
                    <small>
                      生徒への宿題配布・授業画面共有にそのまま使える分冊PDF
                    </small>
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
          </div>
        )}
      </SugorokuBottomSheet>
    </section>
  );
}
