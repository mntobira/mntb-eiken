/**
 * F5（2026-11-04）：全文を見られる PDF（第1回の共通テスト予想問題）を、ダイアログの上からアプリ内の PDF ビューで開く。
 *   ダイアログ（showModal）は一番上の層に出るので、開いたままだと PDF ビューが下に隠れる。
 *   → いったんダイアログを閉じて PDF を開き、PDF を閉じたら（もどる・戻るボタン・Esc）同じダイアログを開き直す。
 */
import type { RefObject } from 'react';
import { printOf } from '../../battle/core/growth';
import { openPdf, pdfViewerStore } from '../../utils/pdfViewer';

export function openFullPrint(id: string, dialog?: RefObject<HTMLDialogElement | null>): void {
  const print = printOf(id);
  if (!print) return;
  const d = dialog?.current ?? null;
  d?.close();
  openPdf(print.file, print.label);
  if (!d || !pdfViewerStore.get()) return;
  const off = pdfViewerStore.subscribe((doc) => {
    if (doc) return;
    off();
    if (d.isConnected && !d.open) d.showModal();
  });
}
