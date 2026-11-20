#!/usr/bin/env python3
"""
すごろく塾 × マナトビ英検：
『英検2級 3か月（12週間）合格モデルカリキュラム＆週次確認テストPDF ＋ 準2級・準2級プラス段階ブリッジ冊子』生成スクリプト v2（AI 5担当）

実行方法:
  cd eiken-app && python3 scripts/build-sugoroku-curriculum-pdf.py

入力データ:
  - deliverables/sugoroku/sugoroku_foundation_vocab_filter.json （sugoroku-vocab-audit.ts v2 が生成した厳選400語・4択＆穴埋めデータ）
  - deliverables/sugoroku/vocab_cefr_audit_report.json         （語彙・大問1・長文173本文・リスニング1,350音源 CEFR監査統計 v2）
  - public/brand/manatobi-logo-gray.png                        （マナトビ公式ロゴ・グレースケール）
  - public/fonts/booklet-noto-serif-jp.ttf                     （印刷用日本語フォント）

出力ファイル（すべて deliverables/sugoroku/ 配下に分離出力・既存資産への変更ゼロ）:
  1. sugoroku_eiken2_12week_curriculum_route.pdf              （全6ページ：英検2級12週ルート表・4技能カバー率実証・C1言い換え指導表・達成シート）
  2. sugoroku_eiken2_weekly_vocab_tests_12w.pdf               （全26ページ：2級週次小テスト［本試験 Form A］全12回・240語 Part B全文表示＆品詞一致4択）
  3. sugoroku_eiken2_weekly_vocab_retests_formB_12w.pdf       （全25ページ：15点以下不合格者用『再テスト別フォーム Form B』全12回・Part A/B入れ替え＆新4択）
  4. sugoroku_pre2plus_bridge_4week_pack.pdf                  （全18ページ：準2級・準2級プラス段階ブリッジ学習ルート＋基礎確認小テスト全8回・160語＆解答）
  5. sugoroku_eiken2_scbt_writing_speaking_handbook.pdf       （全8ページ：S-CBT面接・英文要約・意見英作文 実践テンプレート＆大問1 C1難問消去法ハンドブック）
  6. curriculum_route_manifest.json                           （AI 1/AI 2 連携用ルート定義JSON v3.0.0）
  7. pdf_layout_validation.json                               （全5冊・計83ページの文字重なりゼロ・白紙ゼロ・はみ出しゼロ・純粋白黒機械検証レポート）
"""

from __future__ import annotations

from html import escape
import json
from pathlib import Path
import re
from typing import Any

import pymupdf
from reportlab import rl_config

rl_config.invariant = True

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfgen import canvas
from reportlab.platypus import Paragraph, Table, TableStyle

ROOT = Path(__file__).resolve().parents[1]
PUBLIC = ROOT / "public"
OUT_DIR = ROOT / "deliverables" / "sugoroku"
OUT_DIR.mkdir(parents=True, exist_ok=True)

LOGO_PATH = PUBLIC / "brand" / "manatobi-logo-gray.png"
FONT_PATH = PUBLIC / "fonts" / "booklet-noto-serif-jp.ttf"

if not LOGO_PATH.exists():
    raise FileNotFoundError(f"Mandatory Manatobi logo not found: {LOGO_PATH}")
if not FONT_PATH.exists():
    raise FileNotFoundError(f"Mandatory JP font not found: {FONT_PATH}")

pdfmetrics.registerFont(TTFont("SugorokuJP", str(FONT_PATH)))

W, H = A4  # 595.27 x 841.89 pt
MARGIN_X = 42.0
CONTENT_W = W - MARGIN_X * 2  # ~511.27 pt

# Pure grayscale palette for crisp B&W laser/copier printing
C_BLACK = colors.black
C_WHITE = colors.white
C_DARK = colors.HexColor("#1f1f1f")
C_GRAY_TEXT = colors.HexColor("#444444")
C_BORDER = colors.HexColor("#2b2b2b")
C_BG_HEAD = colors.HexColor("#e4e4e4")
C_BG_SUB = colors.HexColor("#f2f2f2")
C_BG_ZEBRA = colors.HexColor("#f9f9f9")

STYLES = {
    "cell_head": ParagraphStyle(
        "cell_head",
        fontName="SugorokuJP",
        fontSize=7.6,
        leading=10.4,
        textColor=C_BLACK,
        alignment=1,
        wordWrap="CJK",
    ),
    "cell_jp": ParagraphStyle(
        "cell_jp",
        fontName="SugorokuJP",
        fontSize=7.5,
        leading=10.5,
        textColor=C_BLACK,
        wordWrap="CJK",
    ),
    "cell_jp_sm": ParagraphStyle(
        "cell_jp_sm",
        fontName="SugorokuJP",
        fontSize=7.0,
        leading=9.6,
        textColor=C_BLACK,
        wordWrap="CJK",
    ),
    "cell_center": ParagraphStyle(
        "cell_center",
        fontName="SugorokuJP",
        fontSize=7.4,
        leading=10.2,
        textColor=C_BLACK,
        alignment=1,
        wordWrap="CJK",
    ),
    "cell_jp_xs": ParagraphStyle(
        "cell_jp_xs",
        fontName="SugorokuJP",
        fontSize=6.7,
        leading=8.9,
        textColor=C_BLACK,
        wordWrap="CJK",
    ),
    "body_sm": ParagraphStyle(
        "body_sm",
        fontName="SugorokuJP",
        fontSize=7.8,
        leading=11.5,
        textColor=C_BLACK,
        wordWrap="CJK",
    ),
    "body_xs": ParagraphStyle(
        "body_xs",
        fontName="SugorokuJP",
        fontSize=7.2,
        leading=10.4,
        textColor=C_BLACK,
        wordWrap="CJK",
    ),
}


def p(text: str, style_name: str = "cell_jp") -> Paragraph:
    markup = escape(str(text)).replace("\n", "<br/>")
    return Paragraph(markup, STYLES[style_name])


def p_rich(markup: str, style_name: str = "cell_jp") -> Paragraph:
    return Paragraph(markup, STYLES[style_name])


def draw_page_chrome(
    c: canvas.Canvas,
    doc_title: str,
    section_badge: str,
    page_no: int,
    total_pages: int,
) -> None:
    """Consistent B&W header & footer with official Manatobi logo and zero overlap."""
    c.saveState()
    c.drawImage(
        str(LOGO_PATH),
        MARGIN_X,
        H - 44,
        width=74,
        height=23,
        mask="auto",
        preserveAspectRatio=True,
    )
    c.setFillColor(C_BLACK)
    c.setStrokeColor(C_BLACK)
    c.setFont("SugorokuJP", 8.2)
    c.drawString(MARGIN_X + 82, H - 31, doc_title)
    c.setFont("SugorokuJP", 7.8)
    c.drawRightString(W - MARGIN_X, H - 31, section_badge)
    c.setLineWidth(0.9)
    c.line(MARGIN_X, H - 48, W - MARGIN_X, H - 48)
    c.setLineWidth(0.35)
    c.line(MARGIN_X, H - 50.5, W - MARGIN_X, H - 50.5)

    # Footer
    c.setLineWidth(0.5)
    c.line(MARGIN_X, 36, W - MARGIN_X, 36)
    c.setFont("SugorokuJP", 7.3)
    c.setFillColor(C_GRAY_TEXT)
    c.drawString(
        MARGIN_X,
        23,
        "オンライン塾「すごろく」× マナトビ英検｜独自編成カリキュラム・確認テスト（過去問流用なし・白黒印刷最適化）",
    )
    c.setFillColor(C_BLACK)
    c.setFont("SugorokuJP", 8.0)
    c.drawRightString(W - MARGIN_X, 23, f"{page_no} / {total_pages}")
    c.restoreState()


def draw_paragraph_box(
    c: canvas.Canvas,
    title: str,
    bullets: list[str],
    x: float,
    top: float,
    width: float,
    style_name: str = "body_sm",
) -> float:
    """Draws a crisp bordered B&W info box and returns its total rendered height."""
    rows = [[p_rich(f"<b>{escape(title)}</b>", "cell_jp")]]
    body_html = "<br/>".join(f"・{escape(b)}" for b in bullets)
    rows.append([Paragraph(body_html, STYLES[style_name])])
    tbl = Table(rows, colWidths=[width], hAlign="LEFT")
    tbl.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (0, 0), C_BG_HEAD),
                ("BACKGROUND", (0, 1), (0, 1), C_WHITE),
                ("BOX", (0, 0), (-1, -1), 0.7, C_BLACK),
                ("LINEBELOW", (0, 0), (0, 0), 0.5, C_BLACK),
                ("LEFTPADDING", (0, 0), (-1, -1), 6.5),
                ("RIGHTPADDING", (0, 0), (-1, -1), 6.5),
                ("TOPPADDING", (0, 0), (-1, -1), 3.5),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 4.2),
            ]
        )
    )
    _, h = tbl.wrap(width, H)
    tbl.drawOn(c, x, H - top - h)
    return h


def check_pdf_quality(pdf_path: Path, expected_pages: int) -> dict[str, Any]:
    """
    Automated visual/geometry & grayscale inspection on every generated PDF page:
    1) Exact expected page count
    2) Non-blank page verification
    3) Strict bounding-box collision check (zero overlapping text lines, English or Japanese)
    4) Margin boundary check (zero horizontal/vertical clipping or overflow)
    5) Pixel-level pure grayscale check (R == G == B across rendered raster samples)
    """
    report_pages = []
    with pymupdf.open(pdf_path) as doc:
        if len(doc) != expected_pages:
            raise ValueError(
                f"{pdf_path.name}: expected {expected_pages} pages, got {len(doc)}"
            )
        for page_idx, page in enumerate(doc, 1):
            text_len = len(page.get_text().strip())
            if text_len < 60:
                raise ValueError(
                    f"{pdf_path.name} p.{page_idx}: blank or near-blank page ({text_len} chars)"
                )
            lines = []
            out_of_bounds = []
            for block in page.get_text("dict")["blocks"]:
                for ln in block.get("lines", []):
                    txt = "".join(sp["text"] for sp in ln["spans"]).strip()
                    if not txt:
                        continue
                    x0, y0, x1, y1 = ln["bbox"]
                    lines.append((x0, y0, x1, y1, txt))
                    if x0 < 18 or x1 > W - 18 or y0 < 10 or y1 > H - 10:
                        out_of_bounds.append(
                            (round(x0, 1), round(y0, 1), round(x1, 1), round(y1, 1), txt)
                        )

            if out_of_bounds:
                raise ValueError(
                    f"{pdf_path.name} p.{page_idx}: text outside safe page bounds: {out_of_bounds[0]}"
                )

            overlaps = []
            for i in range(len(lines)):
                ax0, ay0, ax1, ay1, atxt = lines[i]
                for j in range(i + 1, len(lines)):
                    bx0, by0, bx1, by1, btxt = lines[j]
                    ix = min(ax1, bx1) - max(ax0, bx0)
                    iy = min(ay1, by1) - max(ay0, by0)
                    if ix > 3.0 and iy > 3.2:
                        overlaps.append((atxt, btxt, round(ix, 1), round(iy, 1)))
            if overlaps:
                raise ValueError(
                    f"{pdf_path.name} p.{page_idx}: text overlap detected: {overlaps[0]}"
                )

            # Verify pure grayscale pixels (no stray RGB color)
            pix = page.get_pixmap(dpi=72, alpha=False)
            raw = pix.samples
            non_gray = 0
            for k in range(0, len(raw), 39):  # fast stride sample across entire page
                r_c, g_c, b_c = raw[k], raw[k + 1], raw[k + 2]
                if abs(r_c - g_c) > 2 or abs(g_c - b_c) > 2:
                    non_gray += 1
            if non_gray > 0:
                raise ValueError(
                    f"{pdf_path.name} p.{page_idx}: found {non_gray} non-grayscale colored pixels"
                )

            report_pages.append(
                {
                    "page": page_idx,
                    "charCount": text_len,
                    "lineCount": len(lines),
                    "overlaps": 0,
                    "outOfBounds": 0,
                    "pureGrayscale": True,
                }
            )

    return {
        "file": pdf_path.name,
        "sizeKB": round(pdf_path.stat().st_size / 1024, 1),
        "pages": expected_pages,
        "allPagesClean": True,
        "pureGrayscaleVerified": True,
        "pageDetails": report_pages,
    }


# ---------------------------------------------------------------------------
# 1) Grade 2 Standard 12-Week Curriculum Master Definition
# ---------------------------------------------------------------------------
CURRICULUM_12_WEEKS = [
    {
        "week": 1,
        "phase": "Phase 1：基礎固め＆型習得（Week 1〜4）",
        "calendarHint": "2月第1週（開講オリエンテーション）",
        "goal": "2級出題形式の全体把握・大問1（短文語彙）とリスニング第1部の毎日ペース確立",
        "vocabTask": "2級単語 出る度A No.1〜75 ＋ 重点語・例文ノート①（前半1〜15語）",
        "readingTask": "一次筆記 第1回（大問1 短文17問＋大問2 長文空所6問）［print_eiken_2_written_01］",
        "listeningTask": "リスニング 第1回（第1部 会話15問：音声1回読み→スクリプト音読）［r01_part1］",
        "writingSpeakingTask": "ライティング基礎（意見論述の型：主張→理由2つ→結論 80〜100語）",
        "dailyPace": "平日4日：単語15語＋大問1を4問＋リスニング3問（計25〜30分/日）／金土：復習調整日",
        "coachingCheck": "週次単語小テスト 第1回（記述12＋4択8＝計20問・16点合格）＋ 有効学習時間確認",
        "chapterIds": [
            "eiken_2_written_01_short",
            "eiken_2_written_01_cloze",
            "eiken_2_listening_r01_part1",
        ],
        "pdfBooklets": ["print_eiken_2_written_01", "print_eiken_wordbook_2", "print_eiken_strategy_2"],
    },
    {
        "week": 2,
        "phase": "Phase 1：基礎固め＆型習得（Week 1〜4）",
        "calendarHint": "2月第2週",
        "goal": "Eメール・説明文読解（大問3）の段落追跡法 ＋ リスニング第2部（説明文）の導入",
        "vocabTask": "2級単語 出る度A No.76〜150 ＋ 重点語・例文ノート①（後半16〜30語）",
        "readingTask": "一次筆記 第1回（大問3 長文読解8問）＋ 第2回（大問1 短文17問）",
        "listeningTask": "リスニング 第1回（第2部 15問）＋ 第2回（第1部 15問）",
        "writingSpeakingTask": "筆記 第1回 意見論述（essay）提出 → 講師添削シート返却",
        "dailyPace": "平日4日：単語15語＋読解1パッセージor短文5問＋リスニング6問（約30分/日）",
        "coachingCheck": "週次単語小テスト 第2回（16/20点合格）＋ 筆記第1回ライティング添削指導",
        "chapterIds": [
            "eiken_2_written_01_reading",
            "eiken_2_written_02_short",
            "eiken_2_listening_r01_part2",
            "eiken_2_listening_r02_part1",
        ],
        "pdfBooklets": ["print_eiken_2_written_01", "print_eiken_2_written_02", "print_eiken_wordbook_2"],
    },
    {
        "week": 3,
        "phase": "Phase 1：基礎固め＆型習得（Week 1〜4）",
        "calendarHint": "2月第3週",
        "goal": "新形式「英文要約（45〜55語）」の3段落要約フレーム習得 ＋ 大問1スピード化",
        "vocabTask": "2級単語 出る度A No.151〜225 ＋ 必須熟語 No.1〜40",
        "readingTask": "一次筆記 第2回（大問2 空所6問＋大問3 読解8問）＋ 第3回（大問1 短文17問）",
        "listeningTask": "リスニング 第2回（第2部 15問）＋ 第3回（第1部 15問）",
        "writingSpeakingTask": "筆記 第1回 英文要約（summary：45〜55語）提出 ＋ S-CBT音読練習開始",
        "dailyPace": "平日4日：単語20語＋リーディング6問＋リスニング6問（約30分/日）",
        "coachingCheck": "週次単語小テスト 第3回 ＋ 要約の語数・パラフレーズ添削（本文丸写し防止）",
        "chapterIds": [
            "eiken_2_written_02_cloze",
            "eiken_2_written_02_reading",
            "eiken_2_written_03_short",
            "eiken_2_listening_r02_part2",
            "eiken_2_listening_r03_part1",
        ],
        "pdfBooklets": ["print_eiken_2_written_02", "print_eiken_2_written_03", "print_eiken_writing_2"],
    },
    {
        "week": 4,
        "phase": "Phase 1：基礎固め＆型習得（Week 1〜4）",
        "calendarHint": "2月第4週（1か月目到達確認・S-CBT申込案内）",
        "goal": "出る度A一巡完了 ＆ 第3回通し演習で現在地スコア診断（4月S-CBT受験枠の予約）",
        "vocabTask": "2級単語 出る度A No.226〜300完遂 ＋ 重点語・例文ノート②（31〜60語）",
        "readingTask": "一次筆記 第3回（大問2・大問3）＋ 大問1スピード演習シート（12問・目標8分）",
        "listeningTask": "リスニング 第3回（第2部 15問）＋ 第4回（第1部・第2部 計30問）",
        "writingSpeakingTask": "筆記 第2回 ライティング2題（要約＋意見論述）提出・添削返却",
        "dailyPace": "平日4日：単語20語＋筆記演習＋リスニング9問（約35分/日）",
        "coachingCheck": "週次単語小テスト 第4回 ＋ Phase 1総復習（正答率60%未満の大問を特定）",
        "chapterIds": [
            "eiken_2_written_03_cloze",
            "eiken_2_written_03_reading",
            "eiken_2_listening_r03_part2",
            "eiken_2_listening_r04_part1",
            "eiken_2_listening_r04_part2",
        ],
        "pdfBooklets": ["print_eiken_2_written_03", "print_eiken_wordbook2_2", "print_eiken_drill_short_2"],
    },
    {
        "week": 5,
        "phase": "Phase 2：実戦演習＆4技能統合（Week 5〜8）",
        "calendarHint": "3月第1週",
        "goal": "出る度B重要語への拡張 ＋ 医療・環境・技術評論文の因果関係把握",
        "vocabTask": "2級単語 出る度B No.1〜80 ＋ 必須熟語 No.41〜90",
        "readingTask": "一次筆記 第4回（全31問：短文17・空所6・読解8）＋ 第5回（大問1 短文17問）",
        "listeningTask": "リスニング 第5回（全30問）",
        "writingSpeakingTask": "筆記 第3回 英文要約（summary）提出 ＋ S-CBT模擬セット①（音読＋No.1〜2録音）",
        "dailyPace": "平日4日：単語25語＋筆記10問＋リスニング8問（約35分/日）",
        "coachingCheck": "週次単語小テスト 第5回 ＋ S-CBTスピーキング録音①の講師聴取フィードバック",
        "chapterIds": [
            "eiken_2_written_04_short",
            "eiken_2_written_04_cloze",
            "eiken_2_written_04_reading",
            "eiken_2_written_05_short",
            "eiken_2_listening_r05_part1",
            "eiken_2_listening_r05_part2",
        ],
        "pdfBooklets": ["print_eiken_2_written_04", "print_eiken_2_written_05"],
    },
    {
        "week": 6,
        "phase": "Phase 2：実戦演習＆4技能統合（Week 5〜8）",
        "calendarHint": "3月第2週",
        "goal": "時間配分厳守トレーニング（大問1を11分・大問2を12分・大問3を20分）",
        "vocabTask": "2級単語 出る度B No.81〜160 ＋ 必須熟語 No.91〜140",
        "readingTask": "一次筆記 第5回（大問2・大問3）＋ 第6回（全31問）",
        "listeningTask": "リスニング 第6回（全30問）＋ 第7回（第1部 15問）",
        "writingSpeakingTask": "筆記 第3回 意見論述（essay）提出 ＋ S-CBT模擬セット①（No.3〜4意見質問録音）",
        "dailyPace": "平日4日：単語25語＋筆記10問＋リスニング10問（約35〜40分/日）",
        "coachingCheck": "週次単語小テスト 第6回 ＋ リーディング時間超過パートのフォーム矯正",
        "chapterIds": [
            "eiken_2_written_05_cloze",
            "eiken_2_written_05_reading",
            "eiken_2_written_06_short",
            "eiken_2_written_06_cloze",
            "eiken_2_written_06_reading",
            "eiken_2_listening_r06_part1",
            "eiken_2_listening_r06_part2",
            "eiken_2_listening_r07_part1",
        ],
        "pdfBooklets": ["print_eiken_2_written_05", "print_eiken_2_written_06"],
    },
    {
        "week": 7,
        "phase": "Phase 2：実戦演習＆4技能統合（Week 5〜8）",
        "calendarHint": "3月第3週（春休み集中期①）",
        "goal": "部活遠征・春休み期間でも途切れない日割り演習 ＋ ライティング実戦ワーク完成",
        "vocabTask": "2級単語 出る度B No.161〜240完遂 ＋ 必須熟語 No.141〜190",
        "readingTask": "一次筆記 第7回（全31問）＋ 第8回（大問1・大問2 計23問）",
        "listeningTask": "リスニング 第7回（第2部 15問）＋ 第8回（全30問）",
        "writingSpeakingTask": "ライティング実戦ワークPDF（独自課題2題：要約18分＋意見論述22分計測）提出",
        "dailyPace": "春休み平日：単語25語＋筆記11問＋リスニング10問（約40分/日）",
        "coachingCheck": "週次単語小テスト 第7回 ＋ 3日未学習アラートゼロ維持・ライティング4観点採点",
        "chapterIds": [
            "eiken_2_written_07_short",
            "eiken_2_written_07_cloze",
            "eiken_2_written_07_reading",
            "eiken_2_written_08_short",
            "eiken_2_written_08_cloze",
            "eiken_2_listening_r07_part2",
            "eiken_2_listening_r08_part1",
            "eiken_2_listening_r08_part2",
        ],
        "pdfBooklets": ["print_eiken_2_written_07", "print_eiken_2_written_08", "print_eiken_writing_2"],
    },
    {
        "week": 8,
        "phase": "Phase 2：実戦演習＆4技能統合（Week 5〜8）",
        "calendarHint": "3月第4週（春休み集中期②・中間模試判定）",
        "goal": "中間フル模試（85分筆記＋25分リスニング＋S-CBT面接通し）で合格圏（65%以上）到達確認",
        "vocabTask": "Week 1〜7 間違えた単語の総復習 ＋ 必須熟語 No.191〜240",
        "readingTask": "一次筆記 第8回（大問3）＋ 第9回（本番想定通し31問）",
        "listeningTask": "リスニング 第9回（本番想定25分通し30問）",
        "writingSpeakingTask": "S-CBTスピーキング模擬セット②（マイク確認〜音読〜No.1〜4完全通し録音）",
        "dailyPace": "模試演習日（110分通し）＋ 平日4日で全誤答の根拠言語化＆音読復習",
        "coachingCheck": "週次単語小テスト 第8回 ＋ ★第1回S-CBT受験（4月枠）に向けた弱点処方箋作成",
        "chapterIds": [
            "eiken_2_written_08_reading",
            "eiken_2_written_09_short",
            "eiken_2_written_09_cloze",
            "eiken_2_written_09_reading",
            "eiken_2_listening_r09_part1",
            "eiken_2_listening_r09_part2",
        ],
        "pdfBooklets": ["print_eiken_2_written_08", "print_eiken_2_written_09"],
    },
    {
        "week": 9,
        "phase": "Phase 3：本番模試演習＆得点最大化（Week 9〜12）",
        "calendarHint": "4月第1週（★S-CBT第1回チャレンジ期）",
        "goal": "リスニング先読みリズム（設問選択肢の10秒縦読み）完成 ＋ 記述の減点ゼロ化",
        "vocabTask": "基礎重視フィルタ承認 出る度C厳選語① ＋ 必須熟語 No.241〜280完遂",
        "readingTask": "一次筆記 第10回（全31問）＋ 第11回（大問1・大問2 計23問）",
        "listeningTask": "リスニング 第10回（全30問）＋ 第11回（第1部 15問）",
        "writingSpeakingTask": "アプリ基礎ライティング（因果関係を保った要約）時間内提出＋自己点検チェック",
        "dailyPace": "平日4日：単語20語＋筆記11問＋リスニング10問（約40分/日）",
        "coachingCheck": "週次単語小テスト 第9回 ＋ S-CBT第1回受験生は手応え振り返り＆第2回対策調整",
        "chapterIds": [
            "eiken_2_written_10_short",
            "eiken_2_written_10_cloze",
            "eiken_2_written_10_reading",
            "eiken_2_written_11_short",
            "eiken_2_written_11_cloze",
            "eiken_2_listening_r10_part1",
            "eiken_2_listening_r10_part2",
            "eiken_2_listening_r11_part1",
        ],
        "pdfBooklets": ["print_eiken_2_written_10", "print_eiken_2_written_11"],
    },
    {
        "week": 10,
        "phase": "Phase 3：本番模試演習＆得点最大化（Week 9〜12）",
        "calendarHint": "4月第2週",
        "goal": "選択肢の言い換え（パラフレーズ）見抜き訓練 ＋ 意見論述の汎用理由ストック確立",
        "vocabTask": "基礎重視フィルタ承認 出る度C厳選語② ＋ 頻出コロケーション総復習",
        "readingTask": "一次筆記 第11回（大問3）＋ 第12回（全31問）＋ 第13回（大問1 短文17問）",
        "listeningTask": "リスニング 第11回（第2部 15問）＋ 第12回（全30問）",
        "writingSpeakingTask": "アプリ基礎ライティング（効率と利用しやすさを論じる）提出 → 添削シートPDF返却",
        "dailyPace": "平日4日：単語20語＋筆記11問＋リスニング10問（約40分/日）",
        "coachingCheck": "週次単語小テスト 第10回 ＋ スピーキングNo.3/No.4「賛成・反対の即答テンプレ」確認",
        "chapterIds": [
            "eiken_2_written_11_reading",
            "eiken_2_written_12_short",
            "eiken_2_written_12_cloze",
            "eiken_2_written_12_reading",
            "eiken_2_written_13_short",
            "eiken_2_listening_r11_part2",
            "eiken_2_listening_r12_part1",
            "eiken_2_listening_r12_part2",
        ],
        "pdfBooklets": ["print_eiken_2_written_11", "print_eiken_2_written_12", "print_eiken_2_written_13"],
    },
    {
        "week": 11,
        "phase": "Phase 3：本番模試演習＆得点最大化（Week 9〜12）",
        "calendarHint": "4月第3週",
        "goal": "本番同様マークシート＆ライティング横型解答用紙での時間内完答（素点70%以上安定）",
        "vocabTask": "12週小テスト総復習（Week 1〜10の誤答語ピックアップ反復）",
        "readingTask": "一次筆記 第13回（大問2・大問3）＋ 第14回（全31問・印刷冊子通し）",
        "listeningTask": "リスニング 第13回（全30問）＋ 第14回（全30問）",
        "writingSpeakingTask": "筆記 第2回・第3回ライティングのリライト（添削指摘箇所の完全再現清書）＋ S-CBT録音総仕上げ",
        "dailyPace": "平日4日：復習単語30語＋筆記11問＋リスニング12問（約40分/日）",
        "coachingCheck": "週次単語小テスト 第11回 ＋ 保護者・担任共有用「学習時間・正答率成長レポート」出力",
        "chapterIds": [
            "eiken_2_written_13_cloze",
            "eiken_2_written_13_reading",
            "eiken_2_written_14_short",
            "eiken_2_written_14_cloze",
            "eiken_2_written_14_reading",
            "eiken_2_listening_r13_part1",
            "eiken_2_listening_r13_part2",
            "eiken_2_listening_r14_part1",
            "eiken_2_listening_r14_part2",
        ],
        "pdfBooklets": ["print_eiken_2_written_13", "print_eiken_2_written_14"],
    },
    {
        "week": 12,
        "phase": "Phase 3：本番模試演習＆得点最大化（Week 9〜12）",
        "calendarHint": "4月第4週〜5月（★S-CBT本命受験 ＆ 第1回本試験直前）",
        "goal": "全15回コンプリート達成・本番シミュレーション完遂 → 7月までの英検2級確実合格へ接続",
        "vocabTask": "2級必須240語ファイナルチェック ＋ アプリ忘却曲線「復習リスト」完全ゼロ化",
        "readingTask": "一次筆記 第15回（最終卒業模試 全31問）＋ 弱点大問ピンポイント解き直し",
        "listeningTask": "リスニング 第15回（最終卒業模試 全30問）＋ 0.75x/1.0x 聞き取り最終確認",
        "writingSpeakingTask": "本番時間配分（要約18分＋英作文22分＋見直し3分）最終演習 ＆ S-CBT本番直前メンタリング",
        "dailyPace": "直前調整：新出難語（C1）には一切手を出さず、既習B1〜B2語彙と頻出型の精度100%に集中",
        "coachingCheck": "週次単語小テスト 第12回（最終回）＋ S-CBT 5月・6月予備枠／第1回本試験の戦略確定",
        "chapterIds": [
            "eiken_2_written_15_short",
            "eiken_2_written_15_cloze",
            "eiken_2_written_15_reading",
            "eiken_2_listening_r15_part1",
            "eiken_2_listening_r15_part2",
        ],
        "pdfBooklets": ["print_eiken_2_written_15"],
    },
]

# ---------------------------------------------------------------------------
# 2) Pre-2 & Pre-2 Plus 8-Stage Step-Up Bridge Curriculum (for diagnostic <40% students)
# ---------------------------------------------------------------------------
BRIDGE_8_STAGES = [
    {
        "stage": 1,
        "gradeId": "eiken_pre2",
        "gradeLabel": "英検準2級（土台期）",
        "weekLabel": "準2級 Week 1",
        "goal": "中学〜高1基礎の会話・日常動詞（A2〜B1前半）を固め、英語アレルギーを払拭する",
        "vocabTask": "準2級 出る度A（基礎動詞・名詞）＋ 基礎確認小テスト Stage 01（20語）",
        "readingListeningTask": "準2級 一次筆記 第1回（大問1・大問2）＋ リスニング 第1回（第1部 会話応答10問）",
        "writingTask": "準2級 Eメール返信と意見英作文（50〜60語）の3文構成テンプレ練習",
        "chapterIds": ["eiken_pre2_written_01_short", "eiken_pre2_written_01_cloze", "eiken_pre2_listening_r01_part1"],
        "pdfBooklets": ["print_eiken_pre2_written_01", "print_eiken_wordbook_pre2"],
    },
    {
        "stage": 2,
        "gradeId": "eiken_pre2",
        "gradeLabel": "英検準2級（土台期）",
        "weekLabel": "準2級 Week 2",
        "goal": "準2級の説明文（大問3）とリスニング第2部・第3部で「主語と動詞を見失わない」訓練",
        "vocabTask": "準2級 出る度A/B（日常形容詞・副詞）＋ 基礎確認小テスト Stage 02（20語）",
        "readingListeningTask": "準2級 一次筆記 第1回（大問3）＋ 第2回（大問1）＋ リスニング 第1回（第2部・第3部）",
        "writingTask": "準2級 筆記第1回 ライティング提出 → 語順・時制ミス添削",
        "chapterIds": ["eiken_pre2_written_01_reading", "eiken_pre2_written_02_short", "eiken_pre2_listening_r01_part2"],
        "pdfBooklets": ["print_eiken_pre2_written_01", "print_eiken_pre2_written_02"],
    },
    {
        "stage": 3,
        "gradeId": "eiken_pre2",
        "gradeLabel": "英検準2級（土台期）",
        "weekLabel": "準2級 Week 3",
        "goal": "接続詞（although / however / therefore）と会話群動詞を習得し、段落の展開を追う",
        "vocabTask": "準2級 出る度B・必須熟語① ＋ 基礎確認小テスト Stage 03（20語）",
        "readingListeningTask": "準2級 一次筆記 第2回（大問2・大問3）＋ リスニング 第2回（全30問）",
        "writingTask": "準2級 筆記第2回 ライティング提出 ＋ S-CBT音読パッセージ声出し練習",
        "chapterIds": ["eiken_pre2_written_02_cloze", "eiken_pre2_written_02_reading", "eiken_pre2_listening_r02_part1"],
        "pdfBooklets": ["print_eiken_pre2_written_02", "print_eiken_writing_pre2"],
    },
    {
        "stage": 4,
        "gradeId": "eiken_pre2",
        "gradeLabel": "英検準2級（土台期）",
        "weekLabel": "準2級 Week 4（昇格判定）",
        "goal": "準2級 第3回通し演習で正答率65%以上クリア → 『準2級プラス』橋渡しへ昇格",
        "vocabTask": "準2級 総整理＆頻出熟語② ＋ 基礎確認小テスト Stage 04（20語）",
        "readingListeningTask": "準2級 一次筆記 第3回（通し37問）＋ リスニング 第3回（通し30問）",
        "writingTask": "準2級 第3回英作文完成 ＋ 準2級プラス「英文要約」への導入ガイダンス",
        "chapterIds": ["eiken_pre2_written_03_short", "eiken_pre2_written_03_reading", "eiken_pre2_listening_r03_part1"],
        "pdfBooklets": ["print_eiken_pre2_written_03"],
    },
    {
        "stage": 5,
        "gradeId": "eiken_pre2plus",
        "gradeLabel": "準2級プラス（橋渡し）",
        "weekLabel": "準2プラス Week 1",
        "goal": "日常話題から社会・科学テーマへの橋渡し語彙（CEFR B1中核）と短文空所に慣れる",
        "vocabTask": "準2級プラス 出る度A①（社会基礎動詞・名詞）＋ ブリッジ小テスト Stage 05（20語）",
        "readingListeningTask": "準2級プラス 一次筆記 第1回（大問1 短文17問＋大問2 空所6問）＋ リスニング 第1回 第1部",
        "writingTask": "準2級プラス 新形式「英文要約（35〜45語）」の骨格抜き出し練習",
        "chapterIds": [
            "eiken_pre2plus_written_01_short",
            "eiken_pre2plus_written_01_cloze",
            "eiken_pre2plus_listening_r01_part1",
        ],
        "pdfBooklets": ["print_eiken_pre2plus_written_01", "print_eiken_wordbook_pre2plus"],
    },
    {
        "stage": 6,
        "gradeId": "eiken_pre2plus",
        "gradeLabel": "準2級プラス（橋渡し）",
        "weekLabel": "準2プラス Week 2",
        "goal": "準2級プラス長文（大問3）で2級と同じ「評論文の対比・因果構造」をつかむ",
        "vocabTask": "準2級プラス 出る度A②（因果・変化・評価語彙）＋ ブリッジ小テスト Stage 06（20語）",
        "readingListeningTask": "準2級プラス 一次筆記 第1回（大問3）＋ 第2回（大問1・大問2）＋ リスニング 第1回 第2部",
        "writingTask": "準2級プラス 第1回 要約＆意見論述（70〜85語）提出 → 添削フィードバック",
        "chapterIds": [
            "eiken_pre2plus_written_01_reading",
            "eiken_pre2plus_written_02_short",
            "eiken_pre2plus_listening_r01_part2",
        ],
        "pdfBooklets": ["print_eiken_pre2plus_written_01", "print_eiken_pre2plus_written_02"],
    },
    {
        "stage": 7,
        "gradeId": "eiken_pre2plus",
        "gradeLabel": "準2級プラス（橋渡し）",
        "weekLabel": "準2プラス Week 3",
        "goal": "B1後半の抽象名詞・群動詞を定着させ、2級リスニングの語数・速度に耳を慣らす",
        "vocabTask": "準2級プラス 出る度B・必須熟語① ＋ ブリッジ小テスト Stage 07（20語）",
        "readingListeningTask": "準2級プラス 一次筆記 第2回（大問3）＋ 第3回（全31問）＋ リスニング 第2回（全30問）",
        "writingTask": "準2級プラス 第2回 要約（35〜45語）時間内作成 ＋ S-CBT面接イラスト描写練習",
        "chapterIds": [
            "eiken_pre2plus_written_02_reading",
            "eiken_pre2plus_written_03_short",
            "eiken_pre2plus_listening_r02_part1",
            "eiken_pre2plus_listening_r02_part2",
        ],
        "pdfBooklets": ["print_eiken_pre2plus_written_03", "print_eiken_writing_pre2plus"],
    },
    {
        "stage": 8,
        "gradeId": "eiken_pre2plus",
        "gradeLabel": "準2級プラス（橋渡し）",
        "weekLabel": "準2プラス Week 4（2級合流）",
        "goal": "準2級プラス卒業模試（正答率65%突破）→ 英検2級12週標準ルート Week 3へスムーズ合流！",
        "vocabTask": "準2級プラス 2級直結総仕上げ ＋ ブリッジ小テスト Stage 08（20語）",
        "readingListeningTask": "準2級プラス 一次筆記 第4回（通し31問）＋ リスニング 第3回（通し30問）",
        "writingTask": "2級語数（要約45〜55語・英作文80〜100語）への拡張トライアル提出",
        "chapterIds": [
            "eiken_pre2plus_written_04_short",
            "eiken_pre2plus_written_04_reading",
            "eiken_pre2plus_listening_r03_part1",
            "eiken_pre2plus_listening_r03_part2",
        ],
        "pdfBooklets": ["print_eiken_pre2plus_written_04"],
    },
]


# ---------------------------------------------------------------------------
# Shared Quiz Page Renderer (Hybrid Part A Recall 12Q + Part B 4-Choice Cloze 8Q)
# ---------------------------------------------------------------------------
def draw_hybrid_quiz_sheet(
    c: canvas.Canvas,
    doc_title: str,
    badge_right: str,
    page_no: int,
    total_pages: int,
    quiz_heading: str,
    theme_text: str,
    items: list[dict[str, Any]],
) -> None:
    """
    Renders a single crisp A4 B&W Weekly Quiz page with:
      - Part A (No.01..12): Meaning Recall with short authentic context sentence
      - Part B (No.13..20): Eiken Daimon-1 style 4-Choice Context Cloze (choose the word/idiom fitting the blank)
    """
    draw_page_chrome(c, doc_title, badge_right, page_no, total_pages)
    cur_top = 56

    hdr_rows = [
        [
            p_rich(f"<b>{escape(quiz_heading)}</b>｜{escape(theme_text)}", "cell_jp_sm"),
            p_rich("<b>合格基準：16 / 20点（80%）</b>", "cell_center"),
        ],
        [
            p("実施日：202　年　　月　　日　｜　氏名：__________________________", "cell_jp_sm"),
            p("得点： ＿＿ / 20点（ □合格 ・ □再試 ）", "cell_center"),
        ],
    ]
    htbl = Table(hdr_rows, colWidths=[CONTENT_W - 156, 156], hAlign="LEFT")
    htbl.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), C_BG_HEAD),
                ("BOX", (0, 0), (-1, -1), 0.75, C_BLACK),
                ("INNERGRID", (0, 0), (-1, -1), 0.45, C_BORDER),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ("LEFTPADDING", (0, 0), (-1, -1), 5.5),
                ("RIGHTPADDING", (0, 0), (-1, -1), 5.5),
                ("TOPPADDING", (0, 0), (-1, -1), 3.0),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 3.0),
            ]
        )
    )
    _, hh = htbl.wrap(CONTENT_W, H)
    htbl.drawOn(c, MARGIN_X, H - cur_top - hh)
    cur_top += hh + 4

    # Part A: Questions 1..12 (Meaning Recall with Context)
    c.setFont("SugorokuJP", 7.6)
    c.setFillColor(C_BLACK)
    c.drawString(
        MARGIN_X,
        H - cur_top - 8,
        "【Part A：意味記述（12問）】次の英単語・熟語の日本語の意味を書きなさい（右の例文ヒントも参考にすること）。",
    )
    cur_top += 11.5

    part_a_rows = [
        [
            p_rich("<b>No.</b>", "cell_head"),
            p_rich("<b>区分</b>", "cell_head"),
            p_rich("<b>英単語・熟語 ／ 文脈ヒント英文</b>", "cell_head"),
            p_rich("<b>日本語の意味（記入欄）</b>", "cell_head"),
            p_rich("<b>採点</b>", "cell_head"),
        ]
    ]
    for item in items[:12]:
        ex_short = re.sub(r"\s+", " ", item["exampleSentence"].strip())
        if len(ex_short) > 64:
            ex_short = ex_short[:61].rstrip() + "..."
        word_and_hint = Paragraph(
            f"<font name='Times-Bold' size='8.7'>{escape(item['word'])}</font>　"
            f"<font name='Times-Roman' size='6.8' color='#444444'>{escape(ex_short)}</font>",
            STYLES["cell_jp_xs"],
        )
        part_a_rows.append(
            [
                p_rich(f"<b>{item['no']:02d}</b>", "cell_center"),
                p(item["tierLabel"], "cell_center"),
                word_and_hint,
                p("", "cell_jp_xs"),
                p("□", "cell_center"),
            ]
        )

    atbl = Table(part_a_rows, colWidths=[24, 42, 258, 157, CONTENT_W - 481], hAlign="LEFT")
    a_zebra = [("BACKGROUND", (0, r), (-1, r), C_BG_ZEBRA) for r in range(2, 13, 2)]
    atbl.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), C_BG_HEAD),
                *a_zebra,
                ("GRID", (0, 0), (-1, -1), 0.45, C_BORDER),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ("LEFTPADDING", (0, 0), (-1, -1), 3.6),
                ("RIGHTPADDING", (0, 0), (-1, -1), 3.6),
                ("TOPPADDING", (0, 0), (-1, -1), 1.4),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 1.4),
            ]
        )
    )
    _, ah = atbl.wrap(CONTENT_W, H)
    atbl.drawOn(c, MARGIN_X, H - cur_top - ah)
    cur_top += ah + 4.5

    # Part B: Questions 13..20 (Daimon 1 Practical 4-Choice Context Cloze — ZERO sentence truncation!)
    c.setFont("SugorokuJP", 7.4)
    c.setFillColor(C_BLACK)
    c.drawString(
        MARGIN_X,
        H - cur_top - 7.5,
        "【Part B：実戦4択空所補充（8問）】英文の（　　）に入る最も適切な語句を 1〜4 から1つ選び、番号を書きなさい。",
    )
    cur_top += 10.5

    part_b_rows = [
        [
            p_rich("<b>No.</b>", "cell_head"),
            p_rich("<b>大問1形式 空所補充問題（全文掲載・品詞一致4択）</b>", "cell_head"),
            p_rich("<b>解答欄</b>", "cell_head"),
            p_rich("<b>採点</b>", "cell_head"),
        ]
    ]
    for item in items[12:20]:
        cloze = re.sub(r"\s+", " ", item["clozeSentence"].strip())
        ja_hint = re.sub(r"\s+", " ", item["exampleTranslation"].strip())
        if len(ja_hint) > 52:
            ja_hint = ja_hint[:50].rstrip() + "…"
        opts = item["choicesEn"]
        opts_markup = "　 ".join(
            f"<b>{idx + 1}.</b> <font name='Times-Roman' size='7.5'>{escape(opt)}</font>"
            for idx, opt in enumerate(opts)
        )
        q_cell = Paragraph(
            f"<font name='Times-Roman' size='7.6'>{escape(cloze)}</font> "
            f"<font name='SugorokuJP' size='6.2' color='#444444'>（{escape(ja_hint)}）</font><br/>"
            f"{opts_markup}",
            STYLES["cell_jp_xs"],
        )
        part_b_rows.append(
            [
                p_rich(f"<b>{item['no']:02d}</b>", "cell_center"),
                q_cell,
                p("（ ＿ ）", "cell_center"),
                p("□", "cell_center"),
            ]
        )

    btbl = Table(part_b_rows, colWidths=[24, CONTENT_W - 98, 44, 30], hAlign="LEFT")
    b_zebra = [("BACKGROUND", (0, r), (-1, r), C_BG_ZEBRA) for r in range(2, 9, 2)]
    btbl.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), C_BG_HEAD),
                *b_zebra,
                ("GRID", (0, 0), (-1, -1), 0.45, C_BORDER),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ("LEFTPADDING", (0, 0), (-1, -1), 3.8),
                ("RIGHTPADDING", (0, 0), (-1, -1), 3.8),
                ("TOPPADDING", (0, 0), (-1, -1), 1.4),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 1.4),
            ]
        )
    )
    _, bh = btbl.wrap(CONTENT_W, H)
    btbl.drawOn(c, MARGIN_X, H - cur_top - bh)
    c.showPage()


def draw_hybrid_answer_sheet(
    c: canvas.Canvas,
    doc_title: str,
    badge_right: str,
    page_no: int,
    total_pages: int,
    ans_heading: str,
    quiz_page_ref: str,
    items: list[dict[str, Any]],
) -> None:
    """Renders the matching 1-page Answer Key for both Part A (01..12) and Part B (13..20)."""
    draw_page_chrome(c, doc_title, badge_right, page_no, total_pages)
    cur_top = 56

    ans_hdr = Table(
        [
            [
                p_rich(f"<b>{escape(ans_heading)}</b>", "cell_jp_sm"),
                p(f"対応問題：{quiz_page_ref}", "cell_center"),
            ]
        ],
        colWidths=[CONTENT_W - 92, 92],
        hAlign="LEFT",
    )
    ans_hdr.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, -1), C_BG_HEAD),
                ("BOX", (0, 0), (-1, -1), 0.75, C_BLACK),
                ("INNERGRID", (0, 0), (-1, -1), 0.4, C_BORDER),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ("LEFTPADDING", (0, 0), (-1, -1), 6),
                ("RIGHTPADDING", (0, 0), (-1, -1), 6),
                ("TOPPADDING", (0, 0), (-1, -1), 3.6),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 3.6),
            ]
        )
    )
    _, ahh = ans_hdr.wrap(CONTENT_W, H)
    ans_hdr.drawOn(c, MARGIN_X, H - cur_top - ahh)
    cur_top += ahh + 4

    c.setFont("SugorokuJP", 7.4)
    c.setFillColor(C_DARK)
    c.drawString(
        MARGIN_X,
        H - cur_top - 8,
        "※ Part A（01〜12）は中核の意味が合っていれば○。Part B（13〜20）は正解番号と語義の両方を確認し、誤答文は3回音読すること。",
    )
    cur_top += 12

    a_rows = [
        [
            p_rich("<b>No.</b>", "cell_head"),
            p_rich("<b>形式・正答</b>", "cell_head"),
            p_rich("<b>対象単熟語・CEFR</b>", "cell_head"),
            p_rich("<b>標準和訳（意味）</b>", "cell_head"),
            p_rich("<b>完成英文・和訳（音読復習用）</b>", "cell_head"),
        ]
    ]
    for item in items:
        is_part_b = item["no"] >= 13
        ans_badge = (
            f"<b>4択：{item['answerIndexEn'] + 1}</b>"
            if is_part_b
            else "記述"
        )
        ex_en = re.sub(r"\s+", " ", item["exampleSentence"].strip())
        if len(ex_en) > 64:
            ex_en = ex_en[:61].rstrip() + "..."
        ex_ja = re.sub(r"\s+", " ", item["exampleTranslation"].strip())
        if len(ex_ja) > 34:
            ex_ja = ex_ja[:32].rstrip() + "…"

        word_cell = Paragraph(
            f"<font name='Times-Bold' size='8.5'>{escape(item['word'])}</font><br/>"
            f"<font name='SugorokuJP' size='6.3' color='#444444'>{escape(item['tierLabel'])} / {escape(item['cefr'])}</font>",
            STYLES["cell_jp_xs"],
        )
        ex_cell = Paragraph(
            f"<font name='Times-Roman' size='7.0'>{escape(ex_en)}</font><br/>"
            f"<font name='SugorokuJP' size='6.5' color='#444444'>{escape(ex_ja)}</font>",
            STYLES["cell_jp_xs"],
        )
        a_rows.append(
            [
                p_rich(f"<b>{item['no']:02d}</b>", "cell_center"),
                p_rich(ans_badge, "cell_center"),
                word_cell,
                p(item["meaning"], "cell_jp_sm"),
                ex_cell,
            ]
        )

    atbl = Table(
        a_rows,
        colWidths=[24, 46, 94, 108, CONTENT_W - 272],
        hAlign="LEFT",
    )
    a_zebra = [("BACKGROUND", (0, r), (-1, r), C_BG_ZEBRA) for r in range(2, 21, 2)]
    atbl.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), C_BG_HEAD),
                *a_zebra,
                ("LINEABOVE", (0, 13), (-1, 13), 0.9, C_BLACK),
                ("GRID", (0, 0), (-1, -1), 0.45, C_BORDER),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ("LEFTPADDING", (0, 0), (-1, -1), 3.6),
                ("RIGHTPADDING", (0, 0), (-1, -1), 3.6),
                ("TOPPADDING", (0, 0), (-1, -1), 1.4),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 1.4),
            ]
        )
    )
    _, ath = atbl.wrap(CONTENT_W, H)
    atbl.drawOn(c, MARGIN_X, H - cur_top - ath)
    c.showPage()


# ---------------------------------------------------------------------------
# PDF 1: Grade 2 12-Week Curriculum Route & 4-Skill CEFR Proof (6 Pages)
# ---------------------------------------------------------------------------
def build_curriculum_route_pdf(
    audit_report: dict[str, Any],
    paraphrase_dict: dict[str, str],
) -> Path:
    out_path = OUT_DIR / "sugoroku_eiken2_12week_curriculum_route.pdf"
    total_pages = 6
    c = canvas.Canvas(str(out_path), pagesize=A4, pageCompression=1, invariant=1)
    c.setTitle("すごろく塾用・英検2級 3か月（12週間）合格モデルカリキュラム＆学習ルート表（v2）")
    c.setAuthor("オンライン塾「すごろく」× マナトビ英検")

    doc_title = "すごろく塾専用｜英検2級 3か月（12週間）合格モデルカリキュラム"

    # ---------------- PAGE 1: Cover & Strategic Blueprint ----------------
    draw_page_chrome(c, doc_title, "全体設計・S-CBT逆算計画", 1, total_pages)

    banner_top = 62
    banner_h = 82
    c.setStrokeColor(C_BLACK)
    c.setLineWidth(1.1)
    c.rect(MARGIN_X, H - banner_top - banner_h, CONTENT_W, banner_h, stroke=1, fill=0)
    c.setFillColor(C_BLACK)
    c.rect(MARGIN_X + 10, H - banner_top - banner_h + 11, 92, banner_h - 22, stroke=0, fill=1)
    c.setFillColor(C_WHITE)
    c.setFont("SugorokuJP", 17)
    c.drawCentredString(MARGIN_X + 56, H - banner_top - 36, "英検2級")
    c.setFont("SugorokuJP", 9.0)
    c.drawCentredString(MARGIN_X + 56, H - banner_top - 56, "12週間標準ルート")

    c.setFillColor(C_BLACK)
    c.setFont("SugorokuJP", 14.5)
    c.drawString(MARGIN_X + 114, H - banner_top - 28, "運動部生のための「3か月最短合格」学習ルート表")
    c.setFont("SugorokuJP", 8.0)
    c.drawString(
        MARGIN_X + 114,
        H - banner_top - 47,
        "総合型選抜の学力証明 ＋ 私大一般選抜（英語換算・出願資格）を7月までに確保する",
    )
    c.setFillColor(C_BG_SUB)
    c.rect(MARGIN_X + 114, H - banner_top - 72, CONTENT_W - 126, 18, stroke=0, fill=1)
    c.setFillColor(C_BLACK)
    c.setFont("SugorokuJP", 7.0)
    c.drawString(
        MARGIN_X + 120,
        H - banner_top - 66,
        "完全対応：一次筆記 全15回｜リスニング 全15回｜重点語ノート｜週次テスト12回｜準2級プラス橋渡し冊子",
    )

    cur_top = banner_top + banner_h + 13

    h1 = draw_paragraph_box(
        c,
        "1. なぜ「2月開始×12週間ルート×英検S-CBT活用」で合格率が最大化するのか",
        [
            "総合型選抜の出願（9月〜）に間に合わせるには「遅くとも高3の7月までに英検2級取得」が必須条件となる。",
            "従来の本会場試験（年3回）では第1回（5月末〜6月一次・7月二次）の1回勝負になるが、原則毎週土日実施・1日で4技能受験できる「英検S-CBT」を併用すれば、4月・5月・6月と最大3〜4回の受験チャンスを確保できる。",
            "本ルートは『マナトビ英検』の全15回予想問題とCEFR B1〜B2厳選語彙を12週間に日割り配分し、1日30〜40分のスマホ/iPad演習と週1〜2回の個別指導で迷わず完走できるペースメーカー設計としている。",
        ],
        MARGIN_X,
        cur_top,
        CONTENT_W,
    )
    cur_top += h1 + 11

    c.setFont("SugorokuJP", 9.6)
    c.drawString(MARGIN_X, H - cur_top - 10, "■ 2月開講〜7月英検2級取得 逆算マイルストーン（S-CBT＆本試験ハイブリッド計画）")
    cur_top += 17

    ms_rows = [
        [
            p_rich("<b>時期</b>", "cell_head"),
            p_rich("<b>カリキュラム段階</b>", "cell_head"),
            p_rich("<b>到達目標・主要アクション</b>", "cell_head"),
            p_rich("<b>受験・検定マイルストーン</b>", "cell_head"),
        ],
        [
            p("2月（Week 1〜4）", "cell_center"),
            p("Phase 1：基礎固め", "cell_center"),
            p("出る度A 300語完遂・筆記R1〜R3・リスニングR1〜R4・要約と英作文の基本型習得", "cell_jp_sm"),
            p("4月実施分 S-CBT申込（2月下旬〜）", "cell_jp_sm"),
        ],
        [
            p("3月（Week 5〜8）", "cell_center"),
            p("Phase 2：実戦統合", "cell_center"),
            p("出る度B 240語＋熟語・筆記R4〜R9・リスニングR5〜R9・S-CBT録音演習①②", "cell_jp_sm"),
            p("Week 8 中間通し模試（素点65%目標）", "cell_jp_sm"),
        ],
        [
            p("4月（Week 9〜12）", "cell_center"),
            p("Phase 3：得点最大化", "cell_center"),
            p("筆記R10〜R15完遂・リスニングR10〜R15完遂・添削リライト・弱点分野集中補強", "cell_jp_sm"),
            p("★第1回 S-CBT受験（4月下旬：1回目挑戦）", "cell_jp_sm"),
        ],
        [
            p("5月〜6月", "cell_center"),
            p("スコア奪取・保険確保", "cell_center"),
            p("第1回S-CBT結果分析→弱点技能のみピンポイント復習（CSEスコア引上げ）", "cell_jp_sm"),
            p("★第2回 S-CBT（5月）＋ 第1回本試験（5月末〜）", "cell_jp_sm"),
        ],
        [
            p("7月", "cell_center"),
            p("総合型出願接続", "cell_center"),
            p("英検2級合格証確保 → 志望理由書・探究活動深化＋私大一般もう1科目へ比重移行", "cell_jp_sm"),
            p("★予備 S-CBT（6〜7月）／本試験二次面接", "cell_jp_sm"),
        ],
    ]
    ms_tbl = Table(ms_rows, colWidths=[82, 86, 215, 128.27], hAlign="LEFT")
    ms_tbl.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), C_BG_HEAD),
                ("BACKGROUND", (0, 2), (-1, 2), C_BG_ZEBRA),
                ("BACKGROUND", (0, 4), (-1, 4), C_BG_ZEBRA),
                ("GRID", (0, 0), (-1, -1), 0.5, C_BORDER),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ("LEFTPADDING", (0, 0), (-1, -1), 5),
                ("RIGHTPADDING", (0, 0), (-1, -1), 5),
                ("TOPPADDING", (0, 0), (-1, -1), 3.8),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 3.8),
            ]
        )
    )
    _, ms_h = ms_tbl.wrap(CONTENT_W, H)
    ms_tbl.drawOn(c, MARGIN_X, H - cur_top - ms_h)
    cur_top += ms_h + 12

    draw_paragraph_box(
        c,
        "2. 運動部生が挫折しない「週次ペースメーカー（4日前進・2日復習・1日テスト）」運用ルール",
        [
            "【1日まとめ解き防止】月〜木の4日間は「毎日25〜35分（単語15〜20語＋リーディング1単元＋リスニング5〜10問）」に分割配信。アプリのトップ画面『今日の宿題』から1タップで開始する。",
            "【金・土は調整＆復習バッファ】部活の遠征・試合で平日に遅れが出ても金・土で吸収できる設計とし、未着手3日経過時は管理者画面アラートからLINE等で声掛けする。",
            "【授業冒頭5分＝記述＋4択ハイブリッド確認テスト】別冊『週次単語小テスト（Part A 記述12問＋Part B 本番4択8問＝20問・16点合格）』で意味記憶と文脈運用力を同時チェックする。",
            "【段階別ブリッジ対応】初回診断40%未満の生徒には別冊『準2級・準2級プラス 段階ブリッジ冊子（全8回・160語）』を先行処方し、基礎を固めてから本ルートWeek 3へ合流させる。",
        ],
        MARGIN_X,
        cur_top,
        CONTENT_W,
    )
    c.showPage()

    # ---------------- PAGES 2-4: 12-Week Detailed Route Tables ----------------
    for chunk_idx in range(3):
        page_no = chunk_idx + 2
        weeks_slice = CURRICULUM_12_WEEKS[chunk_idx * 4 : (chunk_idx + 1) * 4]
        phase_title = weeks_slice[0]["phase"]
        w_start, w_end = weeks_slice[0]["week"], weeks_slice[-1]["week"]

        draw_page_chrome(
            c,
            doc_title,
            f"週次カリキュラム詳細（Week {w_start}〜Week {w_end}）",
            page_no,
            total_pages,
        )

        top_y = 60
        c.setFillColor(C_BLACK)
        c.setFont("SugorokuJP", 11.0)
        c.drawString(MARGIN_X, H - top_y - 11, f"■ {phase_title}")
        c.setFont("SugorokuJP", 7.3)
        c.setFillColor(C_GRAY_TEXT)
        c.drawRightString(W - MARGIN_X, H - top_y - 11, "※『マナトビ英検』単元ID・印刷用PDFと連動")
        top_y += 19

        for wk in weeks_slice:
            header_left = (
                f"<b>Week {wk['week']:02d}</b>　｜　{escape(wk['calendarHint'])}　—　"
                f"<b>目標：{escape(wk['goal'])}</b>"
            )
            rows = [
                [p_rich(header_left, "cell_jp"), ""],
                [p_rich("<b>① 語彙・熟語</b>", "cell_center"), p(wk["vocabTask"], "cell_jp_sm")],
                [p_rich("<b>② リーディング</b>", "cell_center"), p(wk["readingTask"], "cell_jp_sm")],
                [p_rich("<b>③ リスニング</b>", "cell_center"), p(wk["listeningTask"], "cell_jp_sm")],
                [p_rich("<b>④ 英作文・面接</b>", "cell_center"), p(wk["writingSpeakingTask"], "cell_jp_sm")],
                [
                    p_rich("<b>⑤ 日割り＆確認</b>", "cell_center"),
                    p_rich(
                        f"<b>【日割り目安】</b>{escape(wk['dailyPace'])}<br/>"
                        f"<b>【個別指導チェック】</b>{escape(wk['coachingCheck'])}",
                        "cell_jp_sm",
                    ),
                ],
            ]
            wtbl = Table(rows, colWidths=[76, CONTENT_W - 76], hAlign="LEFT")
            wtbl.setStyle(
                TableStyle(
                    [
                        ("SPAN", (0, 0), (1, 0)),
                        ("BACKGROUND", (0, 0), (1, 0), C_BG_HEAD),
                        ("BACKGROUND", (0, 1), (0, -1), C_BG_SUB),
                        ("BACKGROUND", (1, 5), (1, 5), C_BG_ZEBRA),
                        ("BOX", (0, 0), (-1, -1), 0.75, C_BLACK),
                        ("INNERGRID", (0, 0), (-1, -1), 0.4, C_BORDER),
                        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                        ("LEFTPADDING", (0, 0), (-1, -1), 5.5),
                        ("RIGHTPADDING", (0, 0), (-1, -1), 5.5),
                        ("TOPPADDING", (0, 0), (-1, -1), 2.8),
                        ("BOTTOMPADDING", (0, 0), (-1, -1), 2.8),
                    ]
                )
            )
            _, wh = wtbl.wrap(CONTENT_W, H)
            wtbl.drawOn(c, MARGIN_X, H - top_y - wh)
            top_y += wh + 8.5

        c.showPage()

    # ---------------- PAGE 5: 4-Skill CEFR Audit Proof & C1->B1/B2 Paraphrase Guide ----------------
    draw_page_chrome(
        c,
        doc_title,
        "4技能CEFR監査実証・C1言い換え指導基準",
        5,
        total_pages,
    )

    cur_top = 58
    c.setFillColor(C_BLACK)
    c.setFont("SugorokuJP", 10.2)
    c.drawString(
        MARGIN_X,
        H - cur_top - 11,
        "■ 全4技能・全収録データのCEFR語彙監査結果（B1〜B2集中で合格できる実証データ）",
    )
    cur_top += 18

    g2_d1 = audit_report["readingDaimon1Audit"]["eiken_2"]
    p2p_d1 = audit_report["readingDaimon1Audit"]["eiken_pre2plus"]
    p2_d1 = audit_report["readingDaimon1Audit"]["eiken_pre2"]
    g2_rc = audit_report["readingPassageLexicalCoverage"]["eiken_2"]
    p2p_rc = audit_report["readingPassageLexicalCoverage"]["eiken_pre2plus"]
    p2_rc = audit_report["readingPassageLexicalCoverage"]["eiken_pre2"]
    g2_lc = audit_report["listeningScriptLexicalCoverage"]["eiken_2"]
    p2p_lc = audit_report["listeningScriptLexicalCoverage"]["eiken_pre2plus"]
    p2_lc = audit_report["listeningScriptLexicalCoverage"]["eiken_pre2"]
    g2_wb = audit_report["targetGradesWordbookAudit"]["eiken_2"]
    p2p_wb = audit_report["targetGradesWordbookAudit"]["eiken_pre2plus"]
    p2_wb = audit_report["targetGradesWordbookAudit"]["eiken_pre2"]

    cov_rows = [
        [
            p_rich("<b>対象級</b>", "cell_head"),
            p_rich("<b>適正CEFR</b>", "cell_head"),
            p_rich("<b>大問1適正率</b>", "cell_head"),
            p_rich("<b>長文A1-B2カバー率<br/>(独力読解基準95%)</b>", "cell_head"),
            p_rich("<b>聴解A1-B2カバー率<br/>(全1,350音源)</b>", "cell_head"),
            p_rich("<b>単語帳C1除外数</b>", "cell_head"),
            p_rich("<b>指導上の結論</b>", "cell_head"),
        ],
        [
            p_rich("<b>英検2級</b>", "cell_center"),
            p("B1〜B2前半", "cell_center"),
            p_rich(f"<b>{g2_d1['cleanRatePercent']}%</b>", "cell_center"),
            p_rich(f"<b>{g2_rc['cumulativeCoveragePercent']['upToB2']}%</b> (63本文)", "cell_center"),
            p_rich(f"<b>{g2_lc['cumulativeCoveragePercent']['upToB2']}%</b> (450問)", "cell_center"),
            p(f"{g2_wb['trueLowRoiC1C2Count']}語を除外", "cell_center"),
            p("B1〜B2前半で長文95%超・聴解98%超を読解可能", "cell_jp_xs"),
        ],
        [
            p_rich("<b>準2級プラス</b>", "cell_center"),
            p("B1（橋渡し）", "cell_center"),
            p_rich(f"<b>{p2p_d1['cleanRatePercent']}%</b>", "cell_center"),
            p_rich(f"<b>{p2p_rc['cumulativeCoveragePercent']['upToB2']}%</b> (62本文)", "cell_center"),
            p_rich(f"<b>{p2p_lc['cumulativeCoveragePercent']['upToB2']}%</b> (450問)", "cell_center"),
            p(f"{p2p_wb['trueLowRoiC1C2Count']}語を除外", "cell_center"),
            p("2級直前のB1抽象動詞・要約入門に最適", "cell_jp_xs"),
        ],
        [
            p_rich("<b>英検準2級</b>", "cell_center"),
            p("A2〜B1前半", "cell_center"),
            p_rich(f"<b>{p2_d1['cleanRatePercent']}%</b>", "cell_center"),
            p_rich(f"<b>{p2_rc['cumulativeCoveragePercent']['upToB2']}%</b> (48本文)", "cell_center"),
            p_rich(f"<b>{p2_lc['cumulativeCoveragePercent']['upToB2']}%</b> (450問)", "cell_center"),
            p(f"{p2_wb['trueLowRoiC1C2Count']}語を除外", "cell_center"),
            p("高校基礎A2〜B1語彙と会話表現の土台固め", "cell_jp_xs"),
        ],
    ]
    ctbl_audit = Table(cov_rows, colWidths=[58, 56, 54, 86, 84, 64, CONTENT_W - 402], hAlign="LEFT")
    ctbl_audit.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), C_BG_HEAD),
                ("BACKGROUND", (0, 2), (-1, 2), C_BG_ZEBRA),
                ("GRID", (0, 0), (-1, -1), 0.45, C_BORDER),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ("LEFTPADDING", (0, 0), (-1, -1), 3.5),
                ("RIGHTPADDING", (0, 0), (-1, -1), 3.5),
                ("TOPPADDING", (0, 0), (-1, -1), 3.5),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 3.5),
            ]
        )
    )
    _, cah = ctbl_audit.wrap(CONTENT_W, H)
    ctbl_audit.drawOn(c, MARGIN_X, H - cur_top - cah)
    cur_top += cah + 11

    # Paraphrase Coaching Table (C1 -> B1/B2)
    c.setFont("SugorokuJP", 9.4)
    c.drawString(
        MARGIN_X,
        H - cur_top - 9,
        "■ 講師用：演習中にC1難語が出た際の「B1/B2平易パラフレーズ指導表」（難語暗記を禁止し英作文表現へ転換）",
    )
    cur_top += 15

    para_items = list(paraphrase_dict.items())[:12]
    half = 6
    para_rows = [
        [
            p_rich("<b>C1難語（暗記不要）</b>", "cell_head"),
            p_rich("<b>定着させるB1/B2言い換え表現</b>", "cell_head"),
            p_rich("<b>C1難語（暗記不要）</b>", "cell_head"),
            p_rich("<b>定着させるB1/B2言い換え表現</b>", "cell_head"),
        ]
    ]
    for idx in range(half):
        lw, lp = para_items[idx]
        rw, rp = para_items[idx + half]
        para_rows.append(
            [
                Paragraph(f"<font name='Times-Bold' size='8.0'>{escape(lw)}</font>", STYLES["cell_center"]),
                p(lp, "cell_jp_xs"),
                Paragraph(f"<font name='Times-Bold' size='8.0'>{escape(rw)}</font>", STYLES["cell_center"]),
                p(rp, "cell_jp_xs"),
            ]
        )
    ptbl = Table(para_rows, colWidths=[72, 183.6, 72, CONTENT_W - 327.6], hAlign="LEFT")
    p_zebra = [("BACKGROUND", (0, r), (-1, r), C_BG_ZEBRA) for r in range(2, 7, 2)]
    ptbl.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), C_BG_HEAD),
                *p_zebra,
                ("GRID", (0, 0), (-1, -1), 0.45, C_BORDER),
                ("LINEAFTER", (1, 0), (1, -1), 0.9, C_BLACK),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ("LEFTPADDING", (0, 0), (-1, -1), 4),
                ("RIGHTPADDING", (0, 0), (-1, -1), 4),
                ("TOPPADDING", (0, 0), (-1, -1), 2.8),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 2.8),
            ]
        )
    )
    _, ph = ptbl.wrap(CONTENT_W, H)
    ptbl.drawOn(c, MARGIN_X, H - cur_top - ph)
    cur_top += ph + 11

    draw_paragraph_box(
        c,
        "すごろく塾 配布プリント＆段階別ブリッジ冊子 活用ガイド（ガチャ不要・講師棚から直接DL）",
        [
            "① 本書『英検2級 12週間合格モデルカリキュラム（全6頁）』：入塾面談・S-CBT出願計画・生徒進捗チェックシートとして使用。",
            "② 別冊『英検2級 必須語彙 週次確認小テスト＆解答（全12回・240語／全26頁）』：毎回の個別指導冒頭5分で実施（記述12問＋本番4択8問）。",
            "③ 別冊『準2級・準2級プラス 段階ブリッジ学習ルート＆基礎小テスト（全8回・160語／全18頁）』：2級初回診断40%未満の生徒の先行4〜8週補強に使用。",
            "④ 『マナトビ英検』収録冊子：一次筆記 全15回×4分冊（問題・A4横解答用紙・全肢解説・結合版）＋SR重点語ノート・ライティング実戦ワーク完備。",
        ],
        MARGIN_X,
        cur_top,
        CONTENT_W,
        style_name="body_xs",
    )
    c.showPage()

    # ---------------- PAGE 6: Printable Student 12-Week Progress Sheet ----------------
    draw_page_chrome(
        c,
        doc_title,
        "生徒配布・面談記録用シート（コピー配布可）",
        6,
        total_pages,
    )

    cur_top = 60
    c.setFillColor(C_BLACK)
    c.setFont("SugorokuJP", 13.0)
    c.drawString(MARGIN_X, H - cur_top - 13, "英検2級 12週間すごろく達成チェック＆週次テスト記録シート")
    cur_top += 22

    info_rows = [
        [
            p_rich("<b>生徒氏名</b>：", "cell_jp"),
            p_rich("<b>志望大学・学部</b>：", "cell_jp"),
            p_rich("<b>S-CBT目標受験日</b>：　　月　　日", "cell_jp"),
            p_rich("<b>担当講師</b>：", "cell_jp"),
        ]
    ]
    itbl = Table(info_rows, colWidths=[125, 155, 130, CONTENT_W - 410], hAlign="LEFT")
    itbl.setStyle(
        TableStyle(
            [
                ("BOX", (0, 0), (-1, -1), 0.7, C_BLACK),
                ("INNERGRID", (0, 0), (-1, -1), 0.4, C_BORDER),
                ("TOPPADDING", (0, 0), (-1, -1), 6),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
                ("LEFTPADDING", (0, 0), (-1, -1), 6),
            ]
        )
    )
    _, ih = itbl.wrap(CONTENT_W, H)
    itbl.drawOn(c, MARGIN_X, H - cur_top - ih)
    cur_top += ih + 10

    check_rows = [
        [
            p_rich("<b>週</b>", "cell_head"),
            p_rich("<b>実施期間</b>", "cell_head"),
            p_rich("<b>主要課題（筆記・リスニング・W/S）</b>", "cell_head"),
            p_rich("<b>アプリ学習時間</b>", "cell_head"),
            p_rich("<b>単語小テスト<br/>(合格16/20)</b>", "cell_head"),
            p_rich("<b>ライティング/<br/>録音提出</b>", "cell_head"),
            p_rich("<b>講師サイン・一言</b>", "cell_head"),
        ]
    ]
    short_tasks = [
        "筆記R1(大問1・2)／リスR1-P1／英作文型",
        "筆記R1(大問3)・R2(大問1)／リスR1-P2・R2-P1",
        "筆記R2(大問2・3)・R3(大問1)／要約R1提出",
        "筆記R3完・大問1演習／リスR3-P2・R4／W添削",
        "筆記R4完・R5(大問1)／リスR5／S-CBT録音①",
        "筆記R5完・R6完／リスR6・R7-P1／S-CBT後半",
        "筆記R7完・R8(大問1・2)／リスR7-P2・R8／実戦W",
        "★中間模試：筆記R9通し＋リスR9通し＋録音②",
        "筆記R10完・R11(大問1・2)／リスR10・R11-P1",
        "筆記R11完・R12完・R13(大問1)／リスR11-P2・R12",
        "筆記R13完・R14通し／リスR13・R14／添削清書",
        "★卒業模試：筆記R15通し＋リスR15＋最終総点検",
    ]
    for idx in range(12):
        check_rows.append(
            [
                p_rich(f"<b>W{idx + 1:02d}</b>", "cell_center"),
                p("　/　〜　/　", "cell_center"),
                p(short_tasks[idx], "cell_jp_sm"),
                p("　　時間　　分", "cell_center"),
                p("　　 / 20点", "cell_center"),
                p("□ 済", "cell_center"),
                p("", "cell_jp_sm"),
            ]
        )

    ctbl = Table(
        check_rows,
        colWidths=[32, 62, 168, 66, 58, 46, CONTENT_W - 432],
        hAlign="LEFT",
    )
    zebra_cmds = [("BACKGROUND", (0, r), (-1, r), C_BG_ZEBRA) for r in range(2, 13, 2)]
    ctbl.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), C_BG_HEAD),
                *zebra_cmds,
                ("GRID", (0, 0), (-1, -1), 0.5, C_BORDER),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ("LEFTPADDING", (0, 0), (-1, -1), 4),
                ("RIGHTPADDING", (0, 0), (-1, -1), 4),
                ("TOPPADDING", (0, 0), (-1, -1), 7.2),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 7.2),
            ]
        )
    )
    _, ch = ctbl.wrap(CONTENT_W, H)
    ctbl.drawOn(c, MARGIN_X, H - cur_top - ch)
    cur_top += ch + 10

    c.setFont("SugorokuJP", 7.8)
    c.setFillColor(C_DARK)
    c.drawString(
        MARGIN_X,
        H - cur_top - 10,
        "※ 週次単語小テストが15点以下の場合は、該当20語をアプリの単語帳＆復習モードで再演習し、次回授業冒頭で再テストを実施します。",
    )

    c.showPage()
    c.save()
    return out_path


# ---------------------------------------------------------------------------
# PDF 2: Grade 2 Weekly Vocab Tests (Hybrid Recall + 4-Choice Cloze, 26 Pages)
# ---------------------------------------------------------------------------
def build_weekly_vocab_tests_pdf(weekly_tests: list[dict[str, Any]]) -> Path:
    out_path = OUT_DIR / "sugoroku_eiken2_weekly_vocab_tests_12w.pdf"
    total_pages = 26
    c = canvas.Canvas(str(out_path), pagesize=A4, pageCompression=1, invariant=1)
    c.setTitle("すごろく塾専用・英検2級 必須語彙 週次確認小テスト＆解答解説（全12回・240語 ハイブリッド版）")
    c.setAuthor("オンライン塾「すごろく」× マナトビ英検")

    doc_title = "すごろく塾専用｜英検2級 必須語彙 週次小テスト＆解答（全12回）"

    # ---------------- PAGE 1: Cover & Test Index ----------------
    draw_page_chrome(c, doc_title, "表紙・全12回出題一覧", 1, total_pages)

    banner_top = 62
    banner_h = 78
    c.setStrokeColor(C_BLACK)
    c.setLineWidth(1.1)
    c.rect(MARGIN_X, H - banner_top - banner_h, CONTENT_W, banner_h, stroke=1, fill=0)
    c.setFillColor(C_BLACK)
    c.rect(MARGIN_X + 10, H - banner_top - banner_h + 10, 94, banner_h - 20, stroke=0, fill=1)
    c.setFillColor(C_WHITE)
    c.setFont("SugorokuJP", 15.5)
    c.drawCentredString(MARGIN_X + 57, H - banner_top - 34, "週次単語")
    c.setFont("SugorokuJP", 9.0)
    c.drawCentredString(MARGIN_X + 57, H - banner_top - 54, "全12回・240語")

    c.setFillColor(C_BLACK)
    c.setFont("SugorokuJP", 13.8)
    c.drawString(MARGIN_X + 116, H - banner_top - 28, "英検2級 必須語彙 週次確認小テスト＆解答冊子")
    c.setFont("SugorokuJP", 7.6)
    c.drawString(
        MARGIN_X + 116,
        H - banner_top - 46,
        "Part A 意味記述（12問）＋ Part B 本番大問1形式4択空所補充（8問）ハイブリッド構成",
    )
    c.setFillColor(C_BG_SUB)
    c.rect(MARGIN_X + 116, H - banner_top - 69, CONTENT_W - 128, 17, stroke=0, fill=1)
    c.setFillColor(C_BLACK)
    c.setFont("SugorokuJP", 7.0)
    c.drawString(
        MARGIN_X + 122,
        H - banner_top - 63,
        "構成：問題シート p.2〜13（各A4・1枚完結）｜解答・例文和訳シート p.14〜25｜直前60選 p.26",
    )

    cur_top = banner_top + banner_h + 12
    h_guide = draw_paragraph_box(
        c,
        "個別指導での使い方（所要時間：授業冒頭5分 → 即時採点2分）",
        [
            "【ハイブリッド出題の狙い】Part A（No.01〜12）で「見て即座に意味が出るか（受容語彙力）」を測り、Part B（No.13〜20）で「英検大問1と同じ4択空所補充で正しく選べるか（文脈運用力）」を同時に鍛えます。",
            "【合格ライン】20問中 16問以上正解（80%）で合格。15点以下の場合は不合格とし、間違えた語句を当週の復習宿題に再設定します。",
            "【印刷・画面共有分離】問題ページ（p.2〜p.13）と解答ページ（p.14〜p.25）を分離しているため、対象週の1ページだけをそのまま配布・画面共有できます。",
        ],
        MARGIN_X,
        cur_top,
        CONTENT_W,
    )
    cur_top += h_guide + 11

    c.setFont("SugorokuJP", 9.6)
    c.drawString(MARGIN_X, H - cur_top - 10, "■ 全12回 出題テーマ・ページ索引・得点記録表")
    cur_top += 16

    idx_rows = [
        [
            p_rich("<b>回次</b>", "cell_head"),
            p_rich("<b>フェーズ</b>", "cell_head"),
            p_rich("<b>出題テーマ（各20問：記述12＋4択8）</b>", "cell_head"),
            p_rich("<b>問題頁</b>", "cell_head"),
            p_rich("<b>解答頁</b>", "cell_head"),
            p_rich("<b>得点記録</b>", "cell_head"),
        ]
    ]
    for wt in weekly_tests:
        wk = wt["week"]
        idx_rows.append(
            [
                p_rich(f"<b>第{wk:02d}回</b>", "cell_center"),
                p(wt["phase"].split("：")[1], "cell_center"),
                p(wt["theme"], "cell_jp_sm"),
                p(f"p.{wk + 1}", "cell_center"),
                p(f"p.{wk + 13}", "cell_center"),
                p("＿＿ / 20", "cell_center"),
            ]
        )
    idx_tbl = Table(idx_rows, colWidths=[44, 72, 249, 44, 44, CONTENT_W - 453], hAlign="LEFT")
    idx_zebra = [("BACKGROUND", (0, r), (-1, r), C_BG_ZEBRA) for r in range(2, 13, 2)]
    idx_tbl.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), C_BG_HEAD),
                *idx_zebra,
                ("GRID", (0, 0), (-1, -1), 0.5, C_BORDER),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ("LEFTPADDING", (0, 0), (-1, -1), 4.5),
                ("RIGHTPADDING", (0, 0), (-1, -1), 4.5),
                ("TOPPADDING", (0, 0), (-1, -1), 4.0),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 4.0),
            ]
        )
    )
    _, idx_h = idx_tbl.wrap(CONTENT_W, H)
    idx_tbl.drawOn(c, MARGIN_X, H - cur_top - idx_h)
    c.showPage()

    # ---------------- PAGES 2..13: Hybrid Quiz Sheets ----------------
    for wt in weekly_tests:
        wk = wt["week"]
        draw_hybrid_quiz_sheet(
            c=c,
            doc_title=doc_title,
            badge_right=f"問題シート｜Week {wk:02d}（制限時間 5分）",
            page_no=wk + 1,
            total_pages=total_pages,
            quiz_heading=f"第{wk:02d}回　2級必須語彙テスト",
            theme_text=wt["theme"],
            items=wt["items"],
        )

    # ---------------- PAGES 14..25: Hybrid Answer Key Sheets ----------------
    for wt in weekly_tests:
        wk = wt["week"]
        draw_hybrid_answer_sheet(
            c=c,
            doc_title=doc_title,
            badge_right=f"解答・例文解説シート｜Week {wk:02d}",
            page_no=wk + 13,
            total_pages=total_pages,
            ans_heading=f"第{wk:02d}回　解答・実戦例文チェックシート（{wt['theme']}）",
            quiz_page_ref=f"p.{wk + 1}",
            items=wt["items"],
        )

    # ---------------- PAGE 26: Final Exam-Eve Top-60 Idioms & Verbs Quick Check ----------------
    draw_page_chrome(
        c,
        doc_title,
        "巻末付録｜直前ファイナル総点検60",
        26,
        total_pages,
    )

    cur_top = 58
    c.setFillColor(C_BLACK)
    c.setFont("SugorokuJP", 11.8)
    c.drawString(MARGIN_X, H - cur_top - 12, "■ S-CBT・本試験会場にも持参できる「直前ファイナル総点検 60選」")
    c.setFont("SugorokuJP", 7.6)
    c.setFillColor(C_DARK)
    c.drawString(
        MARGIN_X,
        H - cur_top - 25,
        "全12回（240語）の中から、特に大問1・リスニング会話・要約パラフレーズで得点差に直結する熟語＆最頻出語60個を抜粋。",
    )
    cur_top += 32

    all_items = [{**it, "week": wt["week"]} for wt in weekly_tests for it in wt["items"]]
    idioms_first = [x for x in all_items if x["tierLabel"] == "熟語"]
    verbs_next = [x for x in all_items if x["tierLabel"] != "熟語"]
    top60 = (idioms_first + verbs_next)[:60]

    left30 = top60[:30]
    right30 = top60[30:60]
    summary_rows = [
        [
            p_rich("<b>□ 英熟語・重要語（1〜30）</b>", "cell_head"),
            p_rich("<b>意味</b>", "cell_head"),
            p_rich("<b>□ 重要語彙（31〜60）</b>", "cell_head"),
            p_rich("<b>意味</b>", "cell_head"),
        ]
    ]
    for i in range(30):
        l_it = left30[i]
        r_it = right30[i]
        l_mean = l_it["meaning"][:13] + ("…" if len(l_it["meaning"]) > 13 else "")
        r_mean = r_it["meaning"][:13] + ("…" if len(r_it["meaning"]) > 13 else "")
        l_cell = Paragraph(
            f"□ <font name='Times-Bold' size='8.0'>{escape(l_it['word'])}</font> "
            f"<font name='SugorokuJP' size='6.4' color='#555555'>(W{l_it['week']})</font>",
            STYLES["cell_jp_sm"],
        )
        r_cell = Paragraph(
            f"□ <font name='Times-Bold' size='8.0'>{escape(r_it['word'])}</font> "
            f"<font name='SugorokuJP' size='6.4' color='#555555'>(W{r_it['week']})</font>",
            STYLES["cell_jp_sm"],
        )
        summary_rows.append([l_cell, p(l_mean, "cell_jp_sm"), r_cell, p(r_mean, "cell_jp_sm")])

    stbl = Table(summary_rows, colWidths=[136, 119.6, 136, CONTENT_W - 391.6], hAlign="LEFT")
    s_zebra = [("BACKGROUND", (0, r), (-1, r), C_BG_ZEBRA) for r in range(2, 31, 2)]
    stbl.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), C_BG_HEAD),
                *s_zebra,
                ("GRID", (0, 0), (-1, -1), 0.4, C_BORDER),
                ("LINEAFTER", (1, 0), (1, -1), 0.9, C_BLACK),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ("LEFTPADDING", (0, 0), (-1, -1), 4),
                ("RIGHTPADDING", (0, 0), (-1, -1), 4),
                ("TOPPADDING", (0, 0), (-1, -1), 2.3),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 2.3),
            ]
        )
    )
    _, sth = stbl.wrap(CONTENT_W, H)
    stbl.drawOn(c, MARGIN_X, H - cur_top - sth)

    c.showPage()
    c.save()
    return out_path


# ---------------------------------------------------------------------------
# PDF 3: Pre-2 & Pre-2 Plus Step-Up Bridge Route & 8 Weekly Quizzes (18 Pages)
# ---------------------------------------------------------------------------
def build_pre2plus_bridge_pack_pdf(
    pre2_tests: list[dict[str, Any]],
    pre2plus_tests: list[dict[str, Any]],
) -> Path:
    """
    Generates `sugoroku_pre2plus_bridge_4week_pack.pdf` (18 crisp A4 B&W pages):
      - Page 1: Cover, Diagnostic Placement Criteria (<40% vs 40-55% vs >=55%), & 8-Stage Test Index
      - Page 2: Detailed 8-Stage Step-Up Curriculum Route (Stage 1..4 Pre-2 Foundation + Stage 5..8 Pre-2 Plus Bridge -> Grade 2 Week 3 Merge)
      - Pages 3..10 (8 pages): Printable Hybrid Quiz Sheets (Stage 01..08, 20 questions each = 160 words)
      - Pages 11..18 (8 pages): Printable Answer Key & Example Translation Sheets (Stage 01..08)
    """
    out_path = OUT_DIR / "sugoroku_pre2plus_bridge_4week_pack.pdf"
    total_pages = 18
    c = canvas.Canvas(str(out_path), pagesize=A4, pageCompression=1, invariant=1)
    c.setTitle("すごろく塾専用・準2級＆準2級プラス 段階ブリッジ学習ルート＆基礎確認小テスト（全8回・160語）")
    c.setAuthor("オンライン塾「すごろく」× マナトビ英検")

    doc_title = "すごろく塾専用｜準2級・準2級プラス 段階ブリッジ冊子（全8回）"

    combined_8_tests = []
    for idx, t in enumerate(pre2_tests, 1):
        combined_8_tests.append(
            {
                "stage": idx,
                "gradeBadge": "英検準2級（土台）",
                "heading": f"Stage {idx:02d}（準2級 Week {t['week']}）基礎語彙テスト",
                "theme": t["theme"],
                "items": t["items"],
            }
        )
    for idx, t in enumerate(pre2plus_tests, 5):
        combined_8_tests.append(
            {
                "stage": idx,
                "gradeBadge": "準2級プラス（橋渡し）",
                "heading": f"Stage {idx:02d}（準2プラス Week {t['week']}）橋渡し語彙テスト",
                "theme": t["theme"],
                "items": t["items"],
            }
        )

    # ---------------- PAGE 1: Cover & Placement Diagnostic Rules ----------------
    draw_page_chrome(c, doc_title, "表紙・入塾時振り分け基準", 1, total_pages)

    banner_top = 62
    banner_h = 78
    c.setStrokeColor(C_BLACK)
    c.setLineWidth(1.1)
    c.rect(MARGIN_X, H - banner_top - banner_h, CONTENT_W, banner_h, stroke=1, fill=0)
    c.setFillColor(C_BLACK)
    c.rect(MARGIN_X + 10, H - banner_top - banner_h + 10, 96, banner_h - 20, stroke=0, fill=1)
    c.setFillColor(C_WHITE)
    c.setFont("SugorokuJP", 14.2)
    c.drawCentredString(MARGIN_X + 58, H - banner_top - 33, "段階ブリッジ")
    c.setFont("SugorokuJP", 8.6)
    c.drawCentredString(MARGIN_X + 58, H - banner_top - 53, "全8回・160語")

    c.setFillColor(C_BLACK)
    c.setFont("SugorokuJP", 13.4)
    c.drawString(MARGIN_X + 118, H - banner_top - 28, "準2級・準2級プラス 段階ブリッジルート＆小テスト集")
    c.setFont("SugorokuJP", 7.6)
    c.drawString(
        MARGIN_X + 118,
        H - banner_top - 46,
        "英語が苦手な運動部生を無理なく「英検2級 標準12週ルート」へ引き上げる先行ステップアップ教材",
    )
    c.setFillColor(C_BG_SUB)
    c.rect(MARGIN_X + 118, H - banner_top - 69, CONTENT_W - 130, 17, stroke=0, fill=1)
    c.setFillColor(C_BLACK)
    c.setFont("SugorokuJP", 7.0)
    c.drawString(
        MARGIN_X + 124,
        H - banner_top - 63,
        "構成：段階ルート表 p.2 ｜ 問題シート Stage 01〜08（p.3〜10） ｜ 解答・例文シート（p.11〜18）",
    )

    cur_top = banner_top + banner_h + 12
    h_diag = draw_paragraph_box(
        c,
        "入塾初回診断による「開始ステージ振り分け基準」（いきなり2級で挫折させない処方箋）",
        [
            "【A判定：2級第1回診断 55%以上】→ 本冊子は不要。『英検2級 12週間標準ルート』Week 1 からそのまま開始。",
            "【B判定：2級第1回診断 40%〜54%（準2級は概ね合格相当）】→ 本冊子の後半『Stage 05〜08（準2級プラス 4週間橋渡し）』を先行実施し、要約と社会テーマ語彙（B1）に慣らしてから2級 Week 3 へ合流。",
            "【C判定：2級第1回診断 40%未満（中学〜高1英語に抜けあり）】→ 本冊子の前半『Stage 01〜04（準2級土台4週）』→『Stage 05〜08（準2級プラス4週）』の計8週間で基礎を作ってから2級へ進む。",
        ],
        MARGIN_X,
        cur_top,
        CONTENT_W,
    )
    cur_top += h_diag + 12

    c.setFont("SugorokuJP", 9.6)
    c.drawString(MARGIN_X, H - cur_top - 10, "■ 全8回（準2級4回＋準2級プラス4回＝計160語）出題テーマ・索引・得点記録表")
    cur_top += 16

    idx_rows = [
        [
            p_rich("<b>Stage</b>", "cell_head"),
            p_rich("<b>対象級</b>", "cell_head"),
            p_rich("<b>出題テーマ（各20問：記述12＋4択8・16点合格）</b>", "cell_head"),
            p_rich("<b>問題頁</b>", "cell_head"),
            p_rich("<b>解答頁</b>", "cell_head"),
            p_rich("<b>得点記録</b>", "cell_head"),
        ]
    ]
    for st in combined_8_tests:
        s_no = st["stage"]
        idx_rows.append(
            [
                p_rich(f"<b>Stage {s_no:02d}</b>", "cell_center"),
                p(st["gradeBadge"], "cell_center"),
                p(st["theme"], "cell_jp_sm"),
                p(f"p.{s_no + 2}", "cell_center"),
                p(f"p.{s_no + 10}", "cell_center"),
                p("＿＿ / 20", "cell_center"),
            ]
        )
    itbl = Table(idx_rows, colWidths=[48, 86, 231, 44, 44, CONTENT_W - 453], hAlign="LEFT")
    i_zebra = [("BACKGROUND", (0, r), (-1, r), C_BG_ZEBRA) for r in range(2, 9, 2)]
    itbl.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), C_BG_HEAD),
                *i_zebra,
                ("LINEABOVE", (0, 5), (-1, 5), 0.9, C_BLACK),
                ("GRID", (0, 0), (-1, -1), 0.5, C_BORDER),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ("LEFTPADDING", (0, 0), (-1, -1), 4.5),
                ("RIGHTPADDING", (0, 0), (-1, -1), 4.5),
                ("TOPPADDING", (0, 0), (-1, -1), 4.8),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 4.8),
            ]
        )
    )
    _, ih = itbl.wrap(CONTENT_W, H)
    itbl.drawOn(c, MARGIN_X, H - cur_top - ih)
    c.showPage()

    # ---------------- PAGE 2: 8-Stage Step-Up Master Schedule ----------------
    draw_page_chrome(c, doc_title, "段階ブリッジ8週間カリキュラム表", 2, total_pages)
    cur_top = 58
    c.setFillColor(C_BLACK)
    c.setFont("SugorokuJP", 11.2)
    c.drawString(
        MARGIN_X,
        H - cur_top - 11,
        "■ 準2級（Stage 01〜04）→ 準2級プラス（Stage 05〜08）→ 2級合流 ステップアップ計画表",
    )
    cur_top += 18

    st_rows = [
        [
            p_rich("<b>段階</b>", "cell_head"),
            p_rich("<b>週目安</b>", "cell_head"),
            p_rich("<b>週目標・語彙小テスト</b>", "cell_head"),
            p_rich("<b>アプリ＆PDF演習（筆記・リスニング・英作文）</b>", "cell_head"),
        ]
    ]
    for st in BRIDGE_8_STAGES:
        goal_vocab = Paragraph(
            f"<b>【目標】</b>{escape(st['goal'])}<br/><b>【語彙】</b>{escape(st['vocabTask'])}",
            STYLES["cell_jp_xs"],
        )
        rlw_cell = Paragraph(
            f"<b>【R/L】</b>{escape(st['readingListeningTask'])}<br/><b>【W/S】</b>{escape(st['writingTask'])}",
            STYLES["cell_jp_xs"],
        )
        st_rows.append(
            [
                p_rich(f"<b>Stage {st['stage']:02d}</b>", "cell_center"),
                p(st["weekLabel"], "cell_center"),
                goal_vocab,
                rlw_cell,
            ]
        )

    st_tbl = Table(st_rows, colWidths=[44, 68, 196, CONTENT_W - 308], hAlign="LEFT")
    st_zebra = [("BACKGROUND", (0, r), (-1, r), C_BG_ZEBRA) for r in range(2, 9, 2)]
    st_tbl.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), C_BG_HEAD),
                *st_zebra,
                ("LINEABOVE", (0, 5), (-1, 5), 1.0, C_BLACK),
                ("GRID", (0, 0), (-1, -1), 0.45, C_BORDER),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ("LEFTPADDING", (0, 0), (-1, -1), 4.5),
                ("RIGHTPADDING", (0, 0), (-1, -1), 4.5),
                ("TOPPADDING", (0, 0), (-1, -1), 4.0),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 4.0),
            ]
        )
    )
    _, sth = st_tbl.wrap(CONTENT_W, H)
    st_tbl.drawOn(c, MARGIN_X, H - cur_top - sth)
    cur_top += sth + 10

    draw_paragraph_box(
        c,
        "2級標準ルートへの合流チェックポイント（Stage 04 / Stage 08 終了時）",
        [
            "Stage 04 終了時：準2級 一次筆記 第3回で正答率65%以上＆小テスト16点以上なら、Stage 05（準2級プラス）へ昇格。",
            "Stage 08 終了時：準2級プラス 一次筆記 第4回で正答率65%以上を達成したら、『英検2級 12週間標準ルート』の Week 3（要約＆大問1スピード化）へ合流する（すでに要約の型を習得済みのためWeek 1〜2を短縮可能）。",
        ],
        MARGIN_X,
        cur_top,
        CONTENT_W,
        style_name="body_xs",
    )
    c.showPage()

    # ---------------- PAGES 3..10: 8 Quiz Sheets ----------------
    for st in combined_8_tests:
        s_no = st["stage"]
        draw_hybrid_quiz_sheet(
            c=c,
            doc_title=doc_title,
            badge_right=f"問題シート｜Stage {s_no:02d}（制限時間 5分）",
            page_no=s_no + 2,
            total_pages=total_pages,
            quiz_heading=st["heading"],
            theme_text=st["theme"],
            items=st["items"],
        )

    # ---------------- PAGES 11..18: 8 Answer Key Sheets ----------------
    for st in combined_8_tests:
        s_no = st["stage"]
        draw_hybrid_answer_sheet(
            c=c,
            doc_title=doc_title,
            badge_right=f"解答・例文解説シート｜Stage {s_no:02d}",
            page_no=s_no + 10,
            total_pages=total_pages,
            ans_heading=f"{st['heading']}　解答・例文チェックシート",
            quiz_page_ref=f"p.{s_no + 2}",
            items=st["items"],
        )

    c.save()
    return out_path


# ---------------------------------------------------------------------------
# PDF 4: Grade 2 Weekly Vocab Retests [Form B] (Make-Up Exam Pack, 25 Pages)
# ---------------------------------------------------------------------------
def build_weekly_vocab_retests_form_b_pdf(retests_form_b: list[dict[str, Any]]) -> Path:
    """
    Generates `sugoroku_eiken2_weekly_vocab_retests_formB_12w.pdf` (25 crisp A4 B&W pages):
      - Page 1: Cover, Make-Up Exam Protocol (anti-rote-memorization design), & 12-Week Form B Index
      - Pages 2..13 (12 pages): Form B Quiz Sheets (former Part B items rotated to Part A Recall, former Part A items rotated to Part B 4-Choice Cloze with new POS-aligned distractors)
      - Pages 14..25 (12 pages): Form B Answer Key & Full Example Translation Sheets
    """
    out_path = OUT_DIR / "sugoroku_eiken2_weekly_vocab_retests_formB_12w.pdf"
    total_pages = 25
    c = canvas.Canvas(str(out_path), pagesize=A4, pageCompression=1, invariant=1)
    c.setTitle("すごろく塾専用・英検2級 週次語彙テスト『再テスト別フォーム［Form B］』＆解答冊子（全12回）")
    c.setAuthor("オンライン塾「すごろく」× マナトビ英検")

    doc_title = "すごろく塾専用｜英検2級 週次小テスト 再試別フォーム［Form B］"

    # ---------------- PAGE 1: Cover & Retest Protocol ----------------
    draw_page_chrome(c, doc_title, "表紙・再テスト運用基準", 1, total_pages)

    banner_top = 62
    banner_h = 78
    c.setStrokeColor(C_BLACK)
    c.setLineWidth(1.1)
    c.rect(MARGIN_X, H - banner_top - banner_h, CONTENT_W, banner_h, stroke=1, fill=0)
    c.setFillColor(C_BLACK)
    c.rect(MARGIN_X + 10, H - banner_top - banner_h + 10, 96, banner_h - 20, stroke=0, fill=1)
    c.setFillColor(C_WHITE)
    c.setFont("SugorokuJP", 14.5)
    c.drawCentredString(MARGIN_X + 58, H - banner_top - 33, "再試 Form B")
    c.setFont("SugorokuJP", 8.5)
    c.drawCentredString(MARGIN_X + 58, H - banner_top - 53, "番号暗記防止設計")

    c.setFillColor(C_BLACK)
    c.setFont("SugorokuJP", 13.6)
    c.drawString(MARGIN_X + 118, H - banner_top - 28, "英検2級 週次語彙テスト『再テスト専用 別フォーム冊子』")
    c.setFont("SugorokuJP", 7.5)
    c.drawString(
        MARGIN_X + 118,
        H - banner_top - 46,
        "本試験（Form A）15点以下の生徒専用｜同一20語を「記述⇔4択入れ替え＋別選択肢」で真の定着を判定",
    )
    c.setFillColor(C_BG_SUB)
    c.rect(MARGIN_X + 118, H - banner_top - 69, CONTENT_W - 130, 17, stroke=0, fill=1)
    c.setFillColor(C_BLACK)
    c.setFont("SugorokuJP", 7.0)
    c.drawString(
        MARGIN_X + 124,
        H - banner_top - 63,
        "構成：再試問題シート p.2〜13（Week 01〜12） ｜ 再試解答・音読シート p.14〜25（合格基準 16/20点）",
    )

    cur_top = banner_top + banner_h + 12
    h_proto = draw_paragraph_box(
        c,
        "なぜ同一プリントの再テストではなく「Form B（別フォーム）」を使うのか（個別指導の質保証）",
        [
            "【番号・順番の丸暗記を完全防止】同じ問題用紙で再テストを行うと、生徒は「13番は3、14番は2…」と記号の位置だけを直前に覚えてクリアしてしまい、本番の大問1で得点できません。",
            "【記述⇔4択のクロス出題】Form Bでは、Form Aで「4択」だった8語を「意味記述（Part A）」へ、Form Aで「意味記述」だった上位8語を「本番4択空所補充（Part B）」へ総入れ替えしています。",
            "【品詞一致の新ディストラクタ】4択の誤答選択肢もすべて同品詞の別単語に差し替え済みのため、20語の意味と文脈用法を本当に理解していないと16点（80%）に届かない設計です。",
        ],
        MARGIN_X,
        cur_top,
        CONTENT_W,
    )
    cur_top += h_proto + 11

    c.setFont("SugorokuJP", 9.6)
    c.drawString(MARGIN_X, H - cur_top - 10, "■ 再テスト［Form B］全12回 ページ索引・再試結果記録表")
    cur_top += 16

    idx_rows = [
        [
            p_rich("<b>回次</b>", "cell_head"),
            p_rich("<b>フェーズ</b>", "cell_head"),
            p_rich("<b>再テスト対象範囲（Form Aと同一20語・出題形式シャッフル）</b>", "cell_head"),
            p_rich("<b>問題頁</b>", "cell_head"),
            p_rich("<b>解答頁</b>", "cell_head"),
            p_rich("<b>再試得点</b>", "cell_head"),
        ]
    ]
    for wt in retests_form_b:
        wk = wt["week"]
        idx_rows.append(
            [
                p_rich(f"<b>第{wk:02d}回 B</b>", "cell_center"),
                p(wt["phase"].split("：")[1], "cell_center"),
                p(wt["theme"], "cell_jp_sm"),
                p(f"p.{wk + 1}", "cell_center"),
                p(f"p.{wk + 13}", "cell_center"),
                p("＿＿ / 20", "cell_center"),
            ]
        )
    idx_tbl = Table(idx_rows, colWidths=[50, 70, 243, 44, 44, CONTENT_W - 451], hAlign="LEFT")
    idx_zebra = [("BACKGROUND", (0, r), (-1, r), C_BG_ZEBRA) for r in range(2, 13, 2)]
    idx_tbl.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), C_BG_HEAD),
                *idx_zebra,
                ("GRID", (0, 0), (-1, -1), 0.5, C_BORDER),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ("LEFTPADDING", (0, 0), (-1, -1), 4.5),
                ("RIGHTPADDING", (0, 0), (-1, -1), 4.5),
                ("TOPPADDING", (0, 0), (-1, -1), 4.0),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 4.0),
            ]
        )
    )
    _, idx_h = idx_tbl.wrap(CONTENT_W, H)
    idx_tbl.drawOn(c, MARGIN_X, H - cur_top - idx_h)
    c.showPage()

    for wt in retests_form_b:
        wk = wt["week"]
        draw_hybrid_quiz_sheet(
            c=c,
            doc_title=doc_title,
            badge_right=f"再テスト問題［Form B］｜Week {wk:02d}",
            page_no=wk + 1,
            total_pages=total_pages,
            quiz_heading=f"第{wk:02d}回［再試 Form B］",
            theme_text=wt["theme"].replace("［再試Form B］", ""),
            items=wt["items"],
        )

    for wt in retests_form_b:
        wk = wt["week"]
        draw_hybrid_answer_sheet(
            c=c,
            doc_title=doc_title,
            badge_right=f"再テスト解答［Form B］｜Week {wk:02d}",
            page_no=wk + 13,
            total_pages=total_pages,
            ans_heading=f"第{wk:02d}回［再試 Form B］解答・音読復習シート",
            quiz_page_ref=f"p.{wk + 1}",
            items=wt["items"],
        )

    c.save()
    return out_path


# ---------------------------------------------------------------------------
# PDF 5: Grade 2 S-CBT Speaking, Writing Summary/Essay & Daimon-1 Strategy Handbook (8 Pages)
# ---------------------------------------------------------------------------
def build_scbt_writing_speaking_handbook_pdf(audit_report: dict[str, Any]) -> Path:
    """
    Generates `sugoroku_eiken2_scbt_writing_speaking_handbook.pdf` (8 crisp A4 B&W pages):
      - Page 1: Cover & S-CBT 1-Day 4-Skill Time Allocation & Test-Day Checklist (Headset/Typing/Handwriting choice)
      - Page 2: S-CBT Speaking Complete Formula (Reading Aloud + No.1 Passage + No.2 3-Frame Story + No.3/No.4 Opinion Bank)
      - Page 3: New-Format English Summary (45-55 words) 3-Step Blueprint & Paraphrase Rules + Self-Grading Rubric
      - Page 4: Opinion Essay (80-100 words) Universal 6-Reason Matrix (Cost/Health/Environment/Efficiency/Safety/Education)
      - Pages 5..8 (4 pages): Complete Instructor Coaching Reference for ALL 45 C1/C2-Answer Questions in Grade 2 Daimon 1
    """
    out_path = OUT_DIR / "sugoroku_eiken2_scbt_writing_speaking_handbook.pdf"
    total_pages = 8
    c = canvas.Canvas(str(out_path), pagesize=A4, pageCompression=1, invariant=1)
    c.setTitle("すごろく塾専用・英検2級 S-CBT面接・英文要約・英作文＆大問1難問消去法 実践ハンドブック")
    c.setAuthor("オンライン塾「すごろく」× マナトビ英検")

    doc_title = "すごろく塾専用｜英検2級 S-CBT・英作文・難問攻略冊子"

    # ---------------- PAGE 1: S-CBT Test-Day Strategy & Time Allocation ----------------
    draw_page_chrome(c, doc_title, "S-CBT本番攻略・時間配分", 1, total_pages)

    banner_top = 62
    banner_h = 78
    c.setStrokeColor(C_BLACK)
    c.setLineWidth(1.1)
    c.rect(MARGIN_X, H - banner_top - banner_h, CONTENT_W, banner_h, stroke=1, fill=0)
    c.setFillColor(C_BLACK)
    c.rect(MARGIN_X + 10, H - banner_top - banner_h + 10, 96, banner_h - 20, stroke=0, fill=1)
    c.setFillColor(C_WHITE)
    c.setFont("SugorokuJP", 14.2)
    c.drawCentredString(MARGIN_X + 58, H - banner_top - 33, "S-CBT攻略")
    c.setFont("SugorokuJP", 8.5)
    c.drawCentredString(MARGIN_X + 58, H - banner_top - 53, "4技能即戦力ガイド")

    c.setFillColor(C_BLACK)
    c.setFont("SugorokuJP", 13.0)
    c.drawString(MARGIN_X + 118, H - banner_top - 28, "英検2級 S-CBT面接・新形式要約・英作文 実践ハンドブック")
    c.setFont("SugorokuJP", 7.4)
    c.drawString(
        MARGIN_X + 118,
        H - banner_top - 46,
        "生徒の直前暗記カード 兼 講師の個別指導・添削・大問1難問フォロー用リファレンス（全8ページ）",
    )
    c.setFillColor(C_BG_SUB)
    c.rect(MARGIN_X + 118, H - banner_top - 69, CONTENT_W - 130, 17, stroke=0, fill=1)
    c.setFillColor(C_BLACK)
    c.setFont("SugorokuJP", 6.8)
    c.drawString(
        MARGIN_X + 124,
        H - banner_top - 63,
        "収録：S-CBT時間配分 p.1｜面接No.1〜4型 p.2｜英文要約45-55語 p.3｜英作文万能理由 p.4｜大問1難問全解説 p.5-8",
    )

    cur_top = banner_top + banner_h + 12
    c.setFont("SugorokuJP", 9.6)
    c.drawString(MARGIN_X, H - cur_top - 10, "■ 1. 英検S-CBT（2級）当日の試験順序と「絶対崩さない85分時間配分」")
    cur_top += 16

    scbt_rows = [
        [
            p_rich("<b>実施順・パート</b>", "cell_head"),
            p_rich("<b>制限時間</b>", "cell_head"),
            p_rich("<b>目標時間・戦術ポイント（運動部生が本番で焦らない鉄則）</b>", "cell_head"),
        ],
        [
            p_rich("<b>① スピーキング</b><br/>（吹込式録音）", "cell_center"),
            p("約15分", "cell_center"),
            p("最初に実施！周囲の受験生の声が入らないようマイク位置を口元2〜3cmに固定。沈黙5秒を作らず、詰まったら Well, let me see... でつなぐ。", "cell_jp_sm"),
        ],
        [
            p_rich("<b>② リスニング</b><br/>（ヘッドホン）", "cell_center"),
            p("約25分", "cell_center"),
            p("第1部（会話15問）＋第2部（説明文15問）。前の問題の音声が終わったら即座に次の4択を縦読みし、「何が問われるか」を予測して待つ。", "cell_jp_sm"),
        ],
        [
            p_rich("<b>③ ライティング</b><br/>（筆記85分の冒頭）", "cell_center"),
            p_rich("<b>先に40分</b><br/>(要約18+英作22)", "cell_center"),
            p("★最重要鉄則：筆記85分が始まったら、大問1より先にライティング2題（大問4要約・大問5意見論述）を40分で書き切る！CSE配点が最も高く確実に稼げる。", "cell_jp_sm"),
        ],
        [
            p_rich("<b>④ リーディング</b><br/>（残り45分で完答）", "cell_center"),
            p_rich("<b>残り45分</b><br/>(11+12+20+2)", "cell_center"),
            p("大問1（短文17問）＝11分［知らないC1単語は5秒で消去法！］→ 大問2（空所6問）＝12分 → 大問3（読解8問）＝20分 → 見直し2分。", "cell_jp_sm"),
        ],
    ]
    stbl = Table(scbt_rows, colWidths=[88, 72, CONTENT_W - 160], hAlign="LEFT")
    stbl.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), C_BG_HEAD),
                ("BACKGROUND", (0, 2), (-1, 2), C_BG_ZEBRA),
                ("BACKGROUND", (0, 4), (-1, 4), C_BG_ZEBRA),
                ("GRID", (0, 0), (-1, -1), 0.5, C_BORDER),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ("LEFTPADDING", (0, 0), (-1, -1), 5),
                ("RIGHTPADDING", (0, 0), (-1, -1), 5),
                ("TOPPADDING", (0, 0), (-1, -1), 4.5),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 4.5),
            ]
        )
    )
    _, sh = stbl.wrap(CONTENT_W, H)
    stbl.drawOn(c, MARGIN_X, H - cur_top - sh)
    cur_top += sh + 12

    draw_paragraph_box(
        c,
        "2. S-CBT出願時の「手書き（筆記型）」vs「タイピング（入力型）」選択基準（申込時に選択必須）",
        [
            "【タイピング型を推奨する生徒】PCキーボードで1分間に英単語25語以上打てる生徒。語数カウントが画面に自動表示され、消しゴム修正のタイムロスがゼロになるため、英文要約（45〜55語調整）で圧倒的に有利。",
            "【手書き型を推奨する生徒】普段スマホのフリック入力のみでローマ字タイピングに不慣れな生徒。無理にタイピング型を選ぶとスペルミスと時間切れを招くため、迷わず『筆記（手書き）型』を選び、『マナトビ英検』A4横解答用紙PDFで練習する。",
        ],
        MARGIN_X,
        cur_top,
        CONTENT_W,
    )
    c.showPage()

    # ---------------- PAGE 2: S-CBT Speaking Complete Template ----------------
    draw_page_chrome(c, doc_title, "S-CBTスピーキング完全型（No.1〜4）", 2, total_pages)
    cur_top = 58
    c.setFont("SugorokuJP", 11.2)
    c.drawString(MARGIN_X, H - cur_top - 11, "■ S-CBTスピーキング（録音式面接）減点ゼロの黄金テンプレート")
    cur_top += 18

    spk_rows = [
        [
            p_rich("<b>設問</b>", "cell_head"),
            p_rich("<b>準備・録音秒数</b>", "cell_head"),
            p_rich("<b>そのまま使える応答フレーム＆高得点ルール</b>", "cell_head"),
        ],
        [
            p_rich("<b>音読</b>", "cell_center"),
            p_rich("黙読20秒<br/>音読制限なし", "cell_center"),
            p("タイトルも忘れずに読む！ピリオドとコンマでしっかり息継ぎし、知らない単語もローマ字読みで堂々と発音する（小声・飛ばし読み厳禁）。", "cell_jp_xs"),
        ],
        [
            p_rich("<b>No.1</b><br/>本文質問", "cell_center"),
            p_rich("画面に本文あり<br/>録音 約20秒", "cell_center"),
            p_rich("How / Why の見分けが命！<br/>・<b>Why〜?</b> → <b>Because + S + V ...</b>（本文の so / therefore の前、または by -ing 箇所を主語代名詞に変えて抜く）<br/>・<b>How〜?</b> → <b>By ~ing ...</b>（本文の by ~ing または in this way の直前文をそのまま活用）", "cell_jp_xs"),
        ],
        [
            p_rich("<b>No.2</b><br/>3コマ展開", "cell_center"),
            p_rich("準備20秒<br/>録音40秒", "cell_center"),
            p_rich("【鉄則：すべて過去形（〜ed / was ~ing）＋ 吹き出し・矢印を全言語化】<br/>・1コマ目：リード文に続け <b>One day, [主語] was ~ing ... [吹き出しの間接話法: thinking of ~ing / asked S to V].</b><br/>・2コマ目：<b>A few days later / Then, [主語] ~ed ... However, [トラブル・変化].</b><br/>・3コマ目：<b>Finally / In the end, [主語] ~ed ..., and [主語] looked happy / pleased.</b>", "cell_jp_xs"),
        ],
        [
            p_rich("<b>No.3</b><br/>意見質問①", "cell_center"),
            p_rich("準備10秒<br/>録音35秒", "cell_center"),
            p_rich("Some people say that ~. What do you think about that?<br/>・賛成：<b>I agree with the idea. First, it is convenient [good for health / eco-friendly] for many people. For example, S + V. So I think it is a good idea.</b>（必ず2〜3文で完結させる！）", "cell_jp_xs"),
        ],
        [
            p_rich("<b>No.4</b><br/>意見質問②", "cell_center"),
            p_rich("準備10秒<br/>録音35秒", "cell_center"),
            p_rich("Yes / No で立場を明確にしてから2文追加！<br/>・<b>Yes, I think so. Nowadays, more and more people use technology [care about costs]. Also, it helps students learn more effectively.</b>", "cell_jp_xs"),
        ],
    ]
    spktbl = Table(spk_rows, colWidths=[56, 68, CONTENT_W - 124], hAlign="LEFT")
    spktbl.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), C_BG_HEAD),
                ("BACKGROUND", (0, 2), (-1, 2), C_BG_ZEBRA),
                ("BACKGROUND", (0, 4), (-1, 4), C_BG_ZEBRA),
                ("GRID", (0, 0), (-1, -1), 0.45, C_BORDER),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ("LEFTPADDING", (0, 0), (-1, -1), 5),
                ("RIGHTPADDING", (0, 0), (-1, -1), 5),
                ("TOPPADDING", (0, 0), (-1, -1), 4.5),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 4.5),
            ]
        )
    )
    _, spkh = spktbl.wrap(CONTENT_W, H)
    spktbl.drawOn(c, MARGIN_X, H - cur_top - spkh)
    cur_top += spkh + 10

    draw_paragraph_box(
        c,
        "講師によるS-CBT録音チェック 3大観点（アプリ音声提出時のフィードバック基準）",
        [
            "① 語尾の子音・三単現・過去形（-ed）が聞こえる声量か（ボソボソ話しは自動採点・採点官ともに減点対象）。",
            "② No.2（イラスト3コマ）で現在形と過去形が混在していないか、登場人物を代名詞（he / she / they）に正しく置き換えているか。",
            "③ No.3 / No.4 で1文だけで終わっていないか（必ず「主張1文＋理由・具体例2文＝計25〜35語」を35秒以内に話し切る）。",
        ],
        MARGIN_X,
        cur_top,
        CONTENT_W,
        style_name="body_xs",
    )
    c.showPage()

    # ---------------- PAGE 3: New-Format English Summary (45-55 words) ----------------
    draw_page_chrome(c, doc_title, "新形式ライティング①：要約（45〜55語）", 3, total_pages)
    cur_top = 58
    c.setFont("SugorokuJP", 11.2)
    c.drawString(MARGIN_X, H - cur_top - 11, "■ 大問4：英文要約（目安45〜55語・目標18分）満点奪取の3文フレーム")
    cur_top += 18

    h_sum_box = draw_paragraph_box(
        c,
        "2級英文要約の採点4観点（各4点＝16点満点）と絶対NG事項",
        [
            "【語数厳守】目安は45〜55語。44語以下や60語超は減点リスクが高いため、必ず「47〜53語」に収める。",
            "【丸写し厳禁】本文の1文を5語以上そのままコピーすると語彙・文法点が大幅減点される。必ず主語や動詞をB1表現に言い換える。",
            "【具体例の切り捨て】for example / such as A, B, and C は具体名を捨てて「various services / health problems」のように上位語でまとめる。",
        ],
        MARGIN_X,
        cur_top,
        CONTENT_W,
        style_name="body_xs",
    )
    cur_top += h_sum_box + 10

    sum_rows = [
        [
            p_rich("<b>段落</b>", "cell_head"),
            p_rich("<b>原文の典型役割</b>", "cell_head"),
            p_rich("<b>要約文（1段落＝1文×3文＝計48〜52語）の黄金骨格</b>", "cell_head"),
        ],
        [
            p_rich("<b>第1文</b><br/>(約14〜17語)", "cell_center"),
            p_rich("第1段落：背景・導入<br/>（話題の提示）", "cell_center"),
            p_rich("<b>Recently [Nowadays], more people / companies are choosing [using] [テーマ] to [目的].</b><br/>※ 原文の第1段落の最終文（主題文）を核にし、時制と主語をコンパクトに圧縮する。", "cell_jp_xs"),
        ],
        [
            p_rich("<b>第2文</b><br/>(約16〜19語)", "cell_center"),
            p_rich("第2段落：メリット<br/>（プラス側面）", "cell_center"),
            p_rich("<b>This has several benefits [advantages], such as [利点①名詞句] and [利点②動名詞句].</b><br/>※ 原文の First / Moreover の2つの利点を and で1文に統合する（具体例はカット）。", "cell_jp_xs"),
        ],
        [
            p_rich("<b>第3文</b><br/>(約16〜18語)", "cell_center"),
            p_rich("第3段落：課題・注意点<br/>（マイナス側面）", "cell_center"),
            p_rich("<b>However, there are concerns [problems] about [課題①] and [課題②] that must be solved.</b><br/>※ 原文の However / On the other hand 以降の懸念点を2点とも漏らさず拾うのが内容満点の鍵！", "cell_jp_xs"),
        ],
    ]
    sumtbl = Table(sum_rows, colWidths=[64, 96, CONTENT_W - 160], hAlign="LEFT")
    sumtbl.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), C_BG_HEAD),
                ("BACKGROUND", (0, 2), (-1, 2), C_BG_ZEBRA),
                ("GRID", (0, 0), (-1, -1), 0.45, C_BORDER),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ("LEFTPADDING", (0, 0), (-1, -1), 5),
                ("RIGHTPADDING", (0, 0), (-1, -1), 5),
                ("TOPPADDING", (0, 0), (-1, -1), 5.0),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 5.0),
            ]
        )
    )
    _, sumh = sumtbl.wrap(CONTENT_W, H)
    sumtbl.drawOn(c, MARGIN_X, H - cur_top - sumh)
    cur_top += sumh + 12

    c.setFont("SugorokuJP", 9.4)
    c.drawString(MARGIN_X, H - cur_top - 9, "■ 要約で毎回使える「原文→要約パラフレーズ変換ペア10選」")
    cur_top += 15
    p10_rows = [
        [p_rich("<b>原文の表現</b>", "cell_head"), p_rich("<b>要約での言い換え</b>", "cell_head"), p_rich("<b>原文の表現</b>", "cell_head"), p_rich("<b>要約での言い換え</b>", "cell_head")],
        [p("a growing number of ~", "cell_center"), p("more ~ / increasing ~", "cell_center"), p("for example, A and B", "cell_center"), p("such as various [上位語]", "cell_center")],
        [p("have a good effect on ~", "cell_center"), p("benefit ~ / improve ~", "cell_center"), p("spend a lot of money", "cell_center"), p("be costly / expensive", "cell_center")],
        [p("make it easier for A to V", "cell_center"), p("help A (to) V", "cell_center"), p("do harm to nature", "cell_center"), p("damage the environment", "cell_center")],
        [p("some experts point out ~", "cell_center"), p("however, some worry ~", "cell_center"), p("in addition / furthermore", "cell_center"), p("also / and（1文に圧縮）", "cell_center")],
        [p("take ~ into consideration", "cell_center"), p("consider ~ carefully", "cell_center"), p("becoming popular", "cell_center"), p("gaining popularity", "cell_center")],
    ]
    p10tbl = Table(p10_rows, colWidths=[122, 133.6, 122, CONTENT_W - 377.6], hAlign="LEFT")
    p10tbl.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), C_BG_HEAD),
                ("BACKGROUND", (0, 2), (-1, 2), C_BG_ZEBRA),
                ("BACKGROUND", (0, 4), (-1, 4), C_BG_ZEBRA),
                ("GRID", (0, 0), (-1, -1), 0.45, C_BORDER),
                ("LINEAFTER", (1, 0), (1, -1), 0.9, C_BLACK),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ("TOPPADDING", (0, 0), (-1, -1), 3.5),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 3.5),
            ]
        )
    )
    _, p10h = p10tbl.wrap(CONTENT_W, H)
    p10tbl.drawOn(c, MARGIN_X, H - cur_top - p10h)
    c.showPage()

    # ---------------- PAGE 4: Opinion Essay (80-100 words) Universal Reason Bank ----------------
    draw_page_chrome(c, doc_title, "ライティング②：意見論述 万能理由表", 4, total_pages)
    cur_top = 58
    c.setFont("SugorokuJP", 11.2)
    c.drawString(MARGIN_X, H - cur_top - 11, "■ 大問5：意見論述（80〜100語・目標22分）どんなTOPICも即答できる6大理由バンク")
    cur_top += 18

    h_es_box = draw_paragraph_box(
        c,
        "88〜95語でピタリと収まる「4段落・7文構成テンプレート」（骨格だけで約34語確保！）",
        [
            "【導入（約16語）】I agree [disagree] with the idea that [TOPICのthat節]. I have two reasons to support my opinion.",
            "【理由①（約28語）】First, [理由①の核1文]. For example, if [具体条件], [良い結果・具体例].",
            "【理由②（約28語）】Second, [理由②の核1文]. In addition, this helps people [生徒/地域/企業] + V原形 ...",
            "【結論（約16語）】For these reasons, I strongly believe that [TOPICの主語 + should (not) V ...].",
        ],
        MARGIN_X,
        cur_top,
        CONTENT_W,
        style_name="body_xs",
    )
    cur_top += h_es_box + 10

    c.setFont("SugorokuJP", 9.6)
    c.drawString(MARGIN_X, H - cur_top - 10, "■ 2級頻出テーマ別・そのまま使えるB1英語「万能理由フレーズ6選」")
    cur_top += 16

    reason_rows = [
        [p_rich("<b>汎用軸</b>", "cell_head"), p_rich("<b>対応しやすい出題テーマ</b>", "cell_head"), p_rich("<b>暗記して使い回せるB1英語フレーズ（スペルミスゼロ表現）</b>", "cell_head")],
        [
            p_rich("<b>① 時間・効率</b>", "cell_center"),
            p("オンライン授業・キャッシュレス・AI・在宅勤務", "cell_jp_xs"),
            p_rich("<b>It saves a lot of time and effort.</b> People can access information anytime and anywhere with their smartphones.", "cell_jp_xs"),
        ],
        [
            p_rich("<b>② 費用・経済</b>", "cell_center"),
            p("公共施設・観光誘致・リサイクル・補助金", "cell_jp_xs"),
            p_rich("<b>It helps reduce costs in the long run.</b> Also, attracting more visitors will boost the local economy.", "cell_jp_xs"),
        ],
        [
            p_rich("<b>③ 環境・資源</b>", "cell_center"),
            p("レジ袋・再生可能エネルギー・食品ロス・EV", "cell_jp_xs"),
            p_rich("<b>It is effective for protecting the environment.</b> Reducing waste and carbon emissions is essential for a sustainable society.", "cell_jp_xs"),
        ],
        [
            p_rich("<b>④ 健康・ストレス</b>", "cell_center"),
            p("部活・睡眠・運動習慣・カフェイン・公園整備", "cell_jp_xs"),
            p_rich("<b>It is good for both physical and mental health.</b> Regular exercise and enough rest help students relieve stress.", "cell_jp_xs"),
        ],
        [
            p_rich("<b>⑤ 安全・防犯</b>", "cell_center"),
            p("防犯カメラ・自転車ヘルメット・SNS規制", "cell_jp_xs"),
            p_rich("<b>It plays an important role in ensuring public safety.</b> Strict rules can prevent serious accidents and crimes.", "cell_jp_xs"),
        ],
        [
            p_rich("<b>⑥ 視野・協力</b>", "cell_center"),
            p("留学・ボランティア・地域交流・読書", "cell_jp_xs"),
            p_rich("<b>It gives young people a great opportunity to broaden their horizons</b> and learn how to cooperate with others.", "cell_jp_xs"),
        ],
    ]
    rtbl = Table(reason_rows, colWidths=[72, 128, CONTENT_W - 200], hAlign="LEFT")
    rzebra = [("BACKGROUND", (0, r), (-1, r), C_BG_ZEBRA) for r in range(2, 7, 2)]
    rtbl.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), C_BG_HEAD),
                *rzebra,
                ("GRID", (0, 0), (-1, -1), 0.45, C_BORDER),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ("LEFTPADDING", (0, 0), (-1, -1), 5),
                ("RIGHTPADDING", (0, 0), (-1, -1), 5),
                ("TOPPADDING", (0, 0), (-1, -1), 5.0),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 5.0),
            ]
        )
    )
    _, rh = rtbl.wrap(CONTENT_W, H)
    rtbl.drawOn(c, MARGIN_X, H - cur_top - rh)
    c.showPage()

    # ---------------- PAGES 5..8: Complete Coaching Guide for All 45 C1-Answer Daimon-1 Items ----------------
    flagged_g2 = [
        q
        for q in audit_report["readingDaimon1Audit"]["eiken_2"]["flaggedQuestions"]
        if q.get("exceedsTargetBand")
    ]
    chunk_sizes = [12, 11, 11, len(flagged_g2) - 34]
    cursor = 0
    for idx_p, sz in enumerate(chunk_sizes):
        p_no = 5 + idx_p
        sub_q = flagged_g2[cursor : cursor + sz]
        cursor += sz
        draw_page_chrome(
            c,
            doc_title,
            f"講師用｜大問1難問フォロー（{idx_p + 1}/4）",
            p_no,
            total_pages,
        )
        cur_top = 56
        c.setFont("SugorokuJP", 9.6)
        c.drawString(
            MARGIN_X,
            H - cur_top - 10,
            f"■ 講師用リファレンス：2級筆記（第1〜15回）大問1 C1難語設問の消去法＆言い換え全覧（{idx_p + 1}/4）",
        )
        c.setFont("SugorokuJP", 7.1)
        c.setFillColor(C_DARK)
        c.drawString(
            MARGIN_X,
            H - cur_top - 22,
            "※ 下記設問は本番2級の上位識別枠（C1帯）。生徒が間違えても難語暗記は課さず、右欄の「B1/B2言い換え・消去法」のみ30秒で指導すること。",
        )
        cur_top += 28

        d1_rows = [
            [
                p_rich("<b>回・問</b>", "cell_head"),
                p_rich("<b>正解語（CEFR）</b>", "cell_head"),
                p_rich("<b>設問文脈（抜粋）</b>", "cell_head"),
                p_rich("<b>個別指導での30秒フォロー（B1/B2言い換え・消去法）</b>", "cell_head"),
            ]
        ]
        for fq in sub_q:
            pr_clean = re.sub(r"\s+", " ", fq["prompt"].strip())
            if len(pr_clean) > 74:
                pr_clean = pr_clean[:71].rstrip() + "..."
            hint = fq.get("b1b2ParaphraseHint")
            coach_msg = (
                f"<b>言い換え：</b>{escape(hint)}<br/>暗記不要（他のB1誤答3肢の不一致から消去法で対応）"
                if hint
                else "C1識別枠のため<b>暗記不要</b>。前後の因果・対比と既知B1選択肢の消去法のみ確認。"
            )
            ans_cell = Paragraph(
                f"<font name='Times-Bold' size='8.3'>{escape(fq['answerChoice'])}</font><br/>"
                f"<font name='SugorokuJP' size='6.3' color='#444444'>{escape(fq['answerCefr'])}</font>",
                STYLES["cell_center"],
            )
            d1_rows.append(
                [
                    p_rich(f"<b>R{fq['round']:02d}</b><br/>({fq['questionNumber']})", "cell_center"),
                    ans_cell,
                    Paragraph(f"<font name='Times-Roman' size='7.1'>{escape(pr_clean)}</font>", STYLES["cell_jp_xs"]),
                    Paragraph(coach_msg, STYLES["cell_jp_xs"]),
                ]
            )

        d1_tbl = Table(d1_rows, colWidths=[38, 78, 186, CONTENT_W - 302], hAlign="LEFT")
        d1_zebra = [("BACKGROUND", (0, r), (-1, r), C_BG_ZEBRA) for r in range(2, len(d1_rows), 2)]
        d1_tbl.setStyle(
            TableStyle(
                [
                    ("BACKGROUND", (0, 0), (-1, 0), C_BG_HEAD),
                    *d1_zebra,
                    ("GRID", (0, 0), (-1, -1), 0.45, C_BORDER),
                    ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                    ("LEFTPADDING", (0, 0), (-1, -1), 4),
                    ("RIGHTPADDING", (0, 0), (-1, -1), 4),
                    ("TOPPADDING", (0, 0), (-1, -1), 3.2),
                    ("BOTTOMPADDING", (0, 0), (-1, -1), 3.2),
                ]
            )
        )
        _, d1h = d1_tbl.wrap(CONTENT_W, H)
        d1_tbl.drawOn(c, MARGIN_X, H - cur_top - d1h)
        c.showPage()

    c.save()
    return out_path


# ---------------------------------------------------------------------------
# PDF 6: Entry Placement 15-Min Diagnostic Test & A/B/C Prescription (6 Pages)
# ---------------------------------------------------------------------------
def build_placement_diagnostic_pdf(diag_test: dict[str, Any]) -> Path:
    """
    Generates `sugoroku_eiken2_placement_diagnostic_test.pdf` (6 crisp A4 B&W pages):
      - Page 1: Cover, 15-Minute Diagnostic Administration Guide, & A/B/C Placement Rubric Table
      - Page 2: Student Sheet 1 — Part A Meaning Recall (Q01..Q12: 4 Pre-2 + 4 Pre-2 Plus + 4 Grade 2)
      - Page 3: Student Sheet 2 — Part B 4-Choice Sentence Cloze (Q13..Q25: 13 items, zero truncation)
      - Page 4: Answer Key & Layer-by-Layer Scoring Tally Sheet (Q01..Q25)
      - Page 5: Coach Counseling & Parent/Student Route Agreement Prescription Sheet
      - Page 6: First-Week Launch Checklist (4-Day Advance + 2-Day Buffer Schedule Setup)
    """
    out_path = OUT_DIR / "sugoroku_eiken2_placement_diagnostic_test.pdf"
    total_pages = 6
    c = canvas.Canvas(str(out_path), pagesize=A4, pageCompression=1, invariant=1)
    c.setTitle("すごろく塾専用・入塾初回15分 英検2級スタートライン診断テスト＆A/B/C処方箋シート")
    c.setAuthor("オンライン塾「すごろく」× マナトビ英検")

    doc_title = "すごろく塾専用｜初回15分 2級スタート診断テスト"
    items: list[dict[str, Any]] = diag_test["items"]

    # ---------------- PAGE 1: Cover & Placement Rubric ----------------
    draw_page_chrome(c, doc_title, "表紙・A/B/C判定基準", 1, total_pages)

    banner_top = 62
    banner_h = 78
    c.setStrokeColor(C_BLACK)
    c.setLineWidth(1.1)
    c.rect(MARGIN_X, H - banner_top - banner_h, CONTENT_W, banner_h, stroke=1, fill=0)
    c.setFillColor(C_BLACK)
    c.rect(MARGIN_X + 10, H - banner_top - banner_h + 10, 96, banner_h - 20, stroke=0, fill=1)
    c.setFillColor(C_WHITE)
    c.setFont("SugorokuJP", 14.0)
    c.drawCentredString(MARGIN_X + 58, H - banner_top - 33, "初回診断25問")
    c.setFont("SugorokuJP", 8.5)
    c.drawCentredString(MARGIN_X + 58, H - banner_top - 53, "所要時間 15分")

    c.setFillColor(C_BLACK)
    c.setFont("SugorokuJP", 13.4)
    c.drawString(MARGIN_X + 118, H - banner_top - 28, "英検2級 スタートライン診断テスト＆A/B/C処方箋シート")
    c.setFont("SugorokuJP", 7.5)
    c.drawString(
        MARGIN_X + 118,
        H - banner_top - 46,
        "準2級基礎（8問）＋ 準2級プラス橋渡し（8問）＋ 2級コア（9問）の3層構造で最適開始ステージを客観判定",
    )
    c.setFillColor(C_BG_SUB)
    c.rect(MARGIN_X + 118, H - banner_top - 69, CONTENT_W - 130, 17, stroke=0, fill=1)
    c.setFillColor(C_BLACK)
    c.setFont("SugorokuJP", 7.0)
    c.drawString(
        MARGIN_X + 124,
        H - banner_top - 63,
        "構成：p.2〜3 生徒用問題用紙（全25問） ｜ p.4 解答・層別集計表 ｜ p.5 三者面談用処方箋 ｜ p.6 初週スタート設計シート",
    )

    cur_top = banner_top + banner_h + 12
    h_purpose = draw_paragraph_box(
        c,
        "なぜ入塾初日に「3層混合25問（15分）」を実施するのか（西様・藤沢様方針：途中離脱ゼロの入口設計）",
        [
            "【つまずきの階層を15分で特定】「英検2級を取りたい高校生」でも、実際には①準2級の日常語彙（A2〜B1前半）が抜けている層、②準2級は読めるが抽象語彙（準2級プラス：B1中核）で止まる層、③すぐ2級に入れる層の3タイプに分かれます。",
            "【納得感ある段階ブリッジ提案】本テストは3階層を均等に含むため、「いきなり2級で挫折させる」のではなく、得点根拠を示して『準2級プラス4週ブリッジ』や『準2級土台8週パック』を提案でき、生徒・保護者の納得度が飛躍的に高まります。",
            "【実施ルール】辞書・スマホ参照なし、制限時間15分厳守。分からない問題は当てずっぽうで塗らず「空欄または△印」にさせると、未知語が正確に浮かび上がります。",
        ],
        MARGIN_X,
        cur_top,
        CONTENT_W,
    )
    cur_top += h_purpose + 12

    c.setFont("SugorokuJP", 9.6)
    c.drawString(MARGIN_X, H - cur_top - 10, "■ 得点・正答率による開始カリキュラム自動振り分け基準（A / B / C 3段階）")
    cur_top += 16

    rubric_rows = [
        [
            p_rich("<b>判定区分</b>", "cell_head"),
            p_rich("<b>得点目安（25点満点）</b>", "cell_head"),
            p_rich("<b>推奨スタート地点・使用冊子</b>", "cell_head"),
            p_rich("<b>2級標準ルート合流・受験目標</b>", "cell_head"),
        ],
        [
            p_rich("<b>A判定</b><br/>2級標準直行", "cell_center"),
            p_rich("<b>14〜25点</b><br/>（正答率 55%以上）", "cell_center"),
            p(
                "『英検2級 12週間標準ルート』Week 1 から開始\n・配布：12週ルート表PDF ＋ 2級週次小テストForm A",
                "cell_jp_sm",
            ),
            p("そのまま12週間で完走\n→ 4月 S-CBT第1回で合格圏突破を狙う", "cell_jp_sm"),
        ],
        [
            p_rich("<b>B判定</b><br/>準2プラス橋渡し", "cell_center"),
            p_rich("<b>10〜13点</b><br/>（正答率 40〜54%）", "cell_center"),
            p(
                "『段階ブリッジ冊子』Stage 05〜08（準2級プラス・4週間）を先行処方\n・35〜45語要約とB1社会語彙を先に固める",
                "cell_jp_sm",
            ),
            p("5週目から『2級12週ルート Week 3』へ合流\n→ 5〜6月 S-CBT／本試験で確実合格", "cell_jp_sm"),
        ],
        [
            p_rich("<b>C判定</b><br/>準2級土台先行", "cell_center"),
            p_rich("<b>0〜9点</b><br/>（正答率 39%以下）", "cell_center"),
            p(
                "『段階ブリッジ冊子』Stage 01〜08（準2級4週＋準2プラス4週＝計8週間）\n・A2〜B1前半の動詞・会話表現から無理なく再構築",
                "cell_jp_sm",
            ),
            p("9週目から『2級12週ルート Week 3』へ合流\n→ 夏までのS-CBT複数回受験で逆転合格", "cell_jp_sm"),
        ],
    ]
    rub_tbl = Table(rubric_rows, colWidths=[72, 86, 198, CONTENT_W - 356], hAlign="LEFT")
    rub_tbl.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), C_BG_HEAD),
                ("BACKGROUND", (0, 2), (-1, 2), C_BG_ZEBRA),
                ("GRID", (0, 0), (-1, -1), 0.5, C_BORDER),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ("LEFTPADDING", (0, 0), (-1, -1), 5),
                ("RIGHTPADDING", (0, 0), (-1, -1), 5),
                ("TOPPADDING", (0, 0), (-1, -1), 5),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
            ]
        )
    )
    _, rth = rub_tbl.wrap(CONTENT_W, H)
    rub_tbl.drawOn(c, MARGIN_X, H - cur_top - rth)
    cur_top += rth + 14

    layer_rows = [
        [
            p_rich("<b>出題セクション</b>", "cell_head"),
            p_rich("<b>設問番号</b>", "cell_head"),
            p_rich("<b>出題形式</b>", "cell_head"),
            p_rich("<b>測定する英語力（CEFR帯）</b>", "cell_head"),
        ],
        [
            p("準2級 基礎層（計8問）", "cell_center"),
            p("Q01〜04 / Q13〜16", "cell_center"),
            p("意味記述4問＋空所4択4問", "cell_center"),
            p("高1〜高2前半の日常動詞・形容詞・基本文脈把握（CEFR A2〜B1前半）", "cell_jp_sm"),
        ],
        [
            p("準2級プラス 橋渡し層（計8問）", "cell_center"),
            p("Q05〜08 / Q17〜20", "cell_center"),
            p("意味記述4問＋空所4択4問", "cell_center"),
            p("社会・科学テーマへの橋渡し抽象語彙・因果関係把握（CEFR B1中核）", "cell_jp_sm"),
        ],
        [
            p("英検2級 コア層（計9問）", "cell_center"),
            p("Q09〜12 / Q21〜25", "cell_center"),
            p("意味記述4問＋空所4択5問", "cell_center"),
            p("2級『パス単』出る度A/B中核語彙・必須熟語の運用力（CEFR B1後半〜B2前半）", "cell_jp_sm"),
        ],
    ]
    ltbl = Table(layer_rows, colWidths=[116, 86, 104, CONTENT_W - 306], hAlign="LEFT")
    ltbl.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), C_BG_HEAD),
                ("BACKGROUND", (0, 2), (-1, 2), C_BG_ZEBRA),
                ("GRID", (0, 0), (-1, -1), 0.45, C_BORDER),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ("LEFTPADDING", (0, 0), (-1, -1), 4.5),
                ("RIGHTPADDING", (0, 0), (-1, -1), 4.5),
                ("TOPPADDING", (0, 0), (-1, -1), 4.0),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 4.0),
            ]
        )
    )
    _, lth = ltbl.wrap(CONTENT_W, H)
    ltbl.drawOn(c, MARGIN_X, H - cur_top - lth)
    c.showPage()

    # ---------------- PAGE 2: Student Sheet 1 — Part A Meaning Recall (Q01..Q12) ----------------
    draw_page_chrome(c, doc_title, "問題①｜Part A 記述（Q01〜12）", 2, total_pages)
    cur_top = 58

    meta_tbl = Table(
        [
            [
                p_rich("<b>実施日：</b>2026年 ＿＿月 ＿＿日", "cell_jp_sm"),
                p_rich("<b>生徒氏名：</b>＿＿＿＿＿＿＿＿＿＿＿＿", "cell_jp_sm"),
                p_rich("<b>学年・部活：</b>高＿＿・＿＿＿＿＿＿部", "cell_jp_sm"),
                p_rich("<b>Part A 得点：</b>＿＿ / 12", "cell_center"),
            ]
        ],
        colWidths=[126, 150, 140, CONTENT_W - 416],
        hAlign="LEFT",
    )
    meta_tbl.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, -1), C_BG_SUB),
                ("BOX", (0, 0), (-1, -1), 0.7, C_BLACK),
                ("INNERGRID", (0, 0), (-1, -1), 0.4, C_BORDER),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ("LEFTPADDING", (0, 0), (-1, -1), 5),
                ("RIGHTPADDING", (0, 0), (-1, -1), 5),
                ("TOPPADDING", (0, 0), (-1, -1), 4),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
            ]
        )
    )
    _, mh = meta_tbl.wrap(CONTENT_W, H)
    meta_tbl.drawOn(c, MARGIN_X, H - cur_top - mh)
    cur_top += mh + 8

    c.setFont("SugorokuJP", 8.2)
    c.drawString(
        MARGIN_X,
        H - cur_top - 9,
        "【Part A：意味確認（Q01〜Q12）】太字の英単語の日本語の意味を書きなさい（右の例文をヒントにして構いません）。",
    )
    cur_top += 14

    pa_rows = [
        [
            p_rich("<b>No.</b>", "cell_head"),
            p_rich("<b>測定階層</b>", "cell_head"),
            p_rich("<b>対象英単語 ＆ 文脈ヒント例文</b>", "cell_head"),
            p_rich("<b>日本語の意味（記述欄）</b>", "cell_head"),
            p_rich("<b>採点</b>", "cell_head"),
        ]
    ]
    for item in items[:12]:
        word_ex = Paragraph(
            f"<font name='Times-Bold' size='9.2'>{escape(item['word'])}</font><br/>"
            f"<font name='Times-Roman' size='7.4' color='#333333'>{escape(item['exampleSentence'])}</font>",
            STYLES["cell_jp_sm"],
        )
        pa_rows.append(
            [
                p_rich(f"<b>{item['no']:02d}</b>", "cell_center"),
                p(item["tierLabel"].split("（")[0], "cell_center"),
                word_ex,
                p("", "cell_jp_sm"),
                p("□", "cell_center"),
            ]
        )

    pa_tbl = Table(pa_rows, colWidths=[26, 74, 240, CONTENT_W - 372, 32], hAlign="LEFT")
    pa_zebra = [("BACKGROUND", (0, r), (-1, r), C_BG_ZEBRA) for r in range(2, 13, 2)]
    pa_tbl.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), C_BG_HEAD),
                *pa_zebra,
                ("LINEABOVE", (0, 5), (-1, 5), 0.9, C_BLACK),
                ("LINEABOVE", (0, 9), (-1, 9), 0.9, C_BLACK),
                ("GRID", (0, 0), (-1, -1), 0.45, C_BORDER),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ("LEFTPADDING", (0, 0), (-1, -1), 4.5),
                ("RIGHTPADDING", (0, 0), (-1, -1), 4.5),
                ("TOPPADDING", (0, 0), (-1, -1), 6.2),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 6.2),
            ]
        )
    )
    _, pah = pa_tbl.wrap(CONTENT_W, H)
    pa_tbl.drawOn(c, MARGIN_X, H - cur_top - pah)
    cur_top += pah + 10

    draw_paragraph_box(
        c,
        "受験のポイント（次ページ Part B へ続く — 合計制限時間 15分）",
        [
            "漢字が思い出せない場合はひらがなで書いて構いません。全く見たことがない単語は無理に埋めず空欄のまま次ページへ進みましょう。",
        ],
        MARGIN_X,
        cur_top,
        CONTENT_W,
        style_name="body_xs",
    )
    c.showPage()

    # ---------------- PAGE 3: Student Sheet 2 — Part B 4-Choice Cloze (Q13..Q25) ----------------
    draw_page_chrome(c, doc_title, "問題②｜Part B 4択（Q13〜25）", 3, total_pages)
    cur_top = 56

    c.setFont("SugorokuJP", 8.0)
    c.drawString(
        MARGIN_X,
        H - cur_top - 9,
        "【Part B：本番大問1形式 空所補充4択（Q13〜Q25）】空所 ( _____ ) に入る最も適切なものを 1〜4 から1つ選び番号を書きなさい。",
    )
    cur_top += 13

    pb_rows = [
        [
            p_rich("<b>No.</b>", "cell_head"),
            p_rich("<b>英文空所補充問題（全文掲載・品詞一致4択）</b>", "cell_head"),
            p_rich("<b>解答欄</b>", "cell_head"),
            p_rich("<b>採点</b>", "cell_head"),
        ]
    ]
    for item in items[12:25]:
        cloze = re.sub(r"\s+", " ", item["clozeSentence"].strip())
        opts_markup = "　 ".join(
            f"<font name='SugorokuJP' size='6.4'><b>{i + 1}.</b></font> "
            f"<font name='Times-Roman' size='7.4'>{escape(ch)}</font>"
            for i, ch in enumerate(item["choicesEn"])
        )
        q_cell = Paragraph(
            f"<font name='Times-Roman' size='7.5'>{escape(cloze)}</font> "
            f"<font name='SugorokuJP' size='6.0' color='#444444'>［{escape(item['tierLabel'].split('（')[0])}］</font><br/>"
            f"{opts_markup}",
            STYLES["cell_jp_xs"],
        )
        pb_rows.append(
            [
                p_rich(f"<b>{item['no']:02d}</b>", "cell_center"),
                q_cell,
                p("（ ＿ ）", "cell_center"),
                p("□", "cell_center"),
            ]
        )

    pb_tbl = Table(pb_rows, colWidths=[26, CONTENT_W - 102, 46, 30], hAlign="LEFT")
    pb_zebra = [("BACKGROUND", (0, r), (-1, r), C_BG_ZEBRA) for r in range(2, len(pb_rows), 2)]
    pb_tbl.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), C_BG_HEAD),
                *pb_zebra,
                ("LINEABOVE", (0, 5), (-1, 5), 0.85, C_BLACK),
                ("LINEABOVE", (0, 9), (-1, 9), 0.85, C_BLACK),
                ("GRID", (0, 0), (-1, -1), 0.45, C_BORDER),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ("LEFTPADDING", (0, 0), (-1, -1), 3.8),
                ("RIGHTPADDING", (0, 0), (-1, -1), 3.8),
                ("TOPPADDING", (0, 0), (-1, -1), 2.3),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 2.3),
            ]
        )
    )
    _, pbh = pb_tbl.wrap(CONTENT_W, H)
    pb_tbl.drawOn(c, MARGIN_X, H - cur_top - pbh)
    cur_top += pbh + 6

    tot_box = Table(
        [
            [
                p_rich("<b>Part A 得点：</b>＿＿ / 12", "cell_center"),
                p_rich("<b>Part B 得点：</b>＿＿ / 13", "cell_center"),
                p_rich("<b>総合得点：</b>＿＿ / 25 点（＿＿ %）", "cell_center"),
                p_rich("<b>判定： A ・ B ・ C</b>", "cell_center"),
            ]
        ],
        colWidths=[110, 110, 165, CONTENT_W - 385],
        hAlign="LEFT",
    )
    tot_box.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, -1), C_BG_SUB),
                ("BOX", (0, 0), (-1, -1), 0.8, C_BLACK),
                ("INNERGRID", (0, 0), (-1, -1), 0.45, C_BORDER),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ("TOPPADDING", (0, 0), (-1, -1), 3.5),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 3.5),
            ]
        )
    )
    _, tbh = tot_box.wrap(CONTENT_W, H)
    tot_box.drawOn(c, MARGIN_X, H - cur_top - tbh)
    c.showPage()

    # ---------------- PAGE 4: Answer Key & Layer Tally Sheet (Q01..Q25) ----------------
    draw_page_chrome(c, doc_title, "解答＆3層別集計表（p.2〜3）", 4, total_pages)
    cur_top = 54

    ak_rows = [
        [
            p_rich("<b>No.</b>", "cell_head"),
            p_rich("<b>測定階層</b>", "cell_head"),
            p_rich("<b>正答</b>", "cell_head"),
            p_rich("<b>対象単熟語</b>", "cell_head"),
            p_rich("<b>標準和訳</b>", "cell_head"),
            p_rich("<b>完成英文・和訳</b>", "cell_head"),
        ]
    ]
    for item in items:
        is_part_b = item["no"] >= 13
        ans_str = f"<b>4択：{item['answerIndexEn'] + 1}</b>" if is_part_b else "記述"
        ex_en = re.sub(r"\s+", " ", item["exampleSentence"].strip())
        ak_rows.append(
            [
                p_rich(f"<b>{item['no']:02d}</b>", "cell_center"),
                p(item["tierLabel"].split("（")[0], "cell_center"),
                p_rich(ans_str, "cell_center"),
                Paragraph(f"<font name='Times-Bold' size='8.0'>{escape(item['word'])}</font>", STYLES["cell_jp_xs"]),
                p(item["meaning"], "cell_jp_xs"),
                Paragraph(
                    f"<font name='Times-Roman' size='6.6'>{escape(ex_en)}</font> "
                    f"<font name='SugorokuJP' size='6.1' color='#444444'>（{escape(item['exampleTranslation'])}）</font>",
                    STYLES["cell_jp_xs"],
                ),
            ]
        )

    ak_tbl = Table(ak_rows, colWidths=[22, 62, 42, 76, 86, CONTENT_W - 288], hAlign="LEFT")
    ak_zebra = [("BACKGROUND", (0, r), (-1, r), C_BG_ZEBRA) for r in range(2, 26, 2)]
    ak_tbl.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), C_BG_HEAD),
                *ak_zebra,
                ("LINEABOVE", (0, 13), (-1, 13), 0.9, C_BLACK),
                ("GRID", (0, 0), (-1, -1), 0.4, C_BORDER),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ("LEFTPADDING", (0, 0), (-1, -1), 3.0),
                ("RIGHTPADDING", (0, 0), (-1, -1), 3.0),
                ("TOPPADDING", (0, 0), (-1, -1), 1.3),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 1.3),
            ]
        )
    )
    _, akh = ak_tbl.wrap(CONTENT_W, H)
    ak_tbl.drawOn(c, MARGIN_X, H - cur_top - akh)
    c.showPage()

    # ---------------- PAGE 5: Coach & Parent Route Prescription Sheet ----------------
    draw_page_chrome(c, doc_title, "三者面談用｜処方箋シート", 5, total_pages)
    cur_top = 58

    c.setFont("SugorokuJP", 11.2)
    c.drawString(MARGIN_X, H - cur_top - 12, "英検2級 短期合格に向けた現在地診断カルテ＆学習ルート合意書")
    cur_top += 20

    tally_rows = [
        [
            p_rich("<b>診断レイヤー</b>", "cell_head"),
            p_rich("<b>対象設問</b>", "cell_head"),
            p_rich("<b>生徒得点</b>", "cell_head"),
            p_rich("<b>層別診断コメント（○を付ける）</b>", "cell_head"),
        ],
        [
            p("① 準2級基礎（A2〜B1前半）", "cell_jp_sm"),
            p("Q01〜04, Q13〜16", "cell_center"),
            p("＿＿ / 8 点", "cell_center"),
            p("□ 6点以上（土台十分） ／ □ 5点以下（高1基礎動詞・会話表現の穴埋めが必要）", "cell_jp_sm"),
        ],
        [
            p("② 準2級プラス橋渡し（B1）", "cell_jp_sm"),
            p("Q05〜08, Q17〜20", "cell_center"),
            p("＿＿ / 8 点", "cell_center"),
            p("□ 5点以上（評論文導入OK） ／ □ 4点以下（準2プラス4週ブリッジを強く推奨）", "cell_jp_sm"),
        ],
        [
            p("③ 英検2級コア（B1後半〜B2）", "cell_jp_sm"),
            p("Q09〜12, Q21〜25", "cell_center"),
            p("＿＿ / 9 点", "cell_center"),
            p("□ 4点以上（2級Week 1即開始可） ／ □ 3点以下（出る度A最優先で段階構築）", "cell_jp_sm"),
        ],
        [
            p_rich("<b>総合スコア・正答率</b>", "cell_center"),
            p("全25問（15分）", "cell_center"),
            p_rich("<b>＿＿ / 25 点</b>", "cell_center"),
            p_rich("<b>正答率： ＿＿＿ %　→　決定ルート：［ □ A判定 ／ □ B判定 ／ □ C判定 ］</b>", "cell_jp_sm"),
        ],
    ]
    ttbl = Table(tally_rows, colWidths=[126, 86, 68, CONTENT_W - 280], hAlign="LEFT")
    ttbl.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), C_BG_HEAD),
                ("BACKGROUND", (0, 4), (-1, 4), C_BG_SUB),
                ("GRID", (0, 0), (-1, -1), 0.5, C_BORDER),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ("LEFTPADDING", (0, 0), (-1, -1), 5),
                ("RIGHTPADDING", (0, 0), (-1, -1), 5),
                ("TOPPADDING", (0, 0), (-1, -1), 5.5),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 5.5),
            ]
        )
    )
    _, tth = ttbl.wrap(CONTENT_W, H)
    ttbl.drawOn(c, MARGIN_X, H - cur_top - tth)
    cur_top += tth + 14

    h_script = draw_paragraph_box(
        c,
        "講師用カウンセリング伝達トーク例（部活生・保護者の不安を解消する3ポイント）",
        [
            "1. 『C1難語は捨ててOK』：マナトビ英検の2級本文はA1〜B2語彙だけで95.1%、リスニングは98.4%カバーできることが実証済みです。準1級レベルの難語暗記でパンクさせず、出る度A・Bのコア語彙と要約・英作文の型で確実に合格点を取ります。",
            "2. 『部活と両立できる4日進行＋2日調整』：週7日ぎっしり宿題を出すのではなく、平日4日（1日25〜35分）で進め、試合や遠征がある週末2日を復習・予備日に充てるペースメーカー設計で完走させます。",
            "3. 『S-CBTの複数回チャンス活用』：紙の本試験1発勝負ではなく、4月〜7月のS-CBT（毎週実施）をマイルストーンに据え、1回目でスコア感覚を掴み2回目で確実に仕留める戦略を採ります。",
        ],
        MARGIN_X,
        cur_top,
        CONTENT_W,
    )
    cur_top += h_script + 14

    plan_rows = [
        [
            p_rich("<b>合意事項</b>", "cell_head"),
            p_rich("<b>個別設定内容（初回面談で記入）</b>", "cell_head"),
        ],
        [
            p("開始カリキュラム＆初週教材", "cell_jp_sm"),
            p("□ 2級12週標準 Week 1　／　□ 準2プラス橋渡し Stage 05　／　□ 準2級土台 Stage 01", "cell_jp_sm"),
        ],
        [
            p("毎週の学習進行曜日（4日＋予備2日）", "cell_jp_sm"),
            p("進行4日：［ 月 ・ 火 ・ 水 ・ 木 ・ 金 ・ 土 ・ 日 ］ ／ 調整予備日：［ ＿＿ ・ ＿＿ ］", "cell_jp_sm"),
        ],
        [
            p("1日の固定スキマ時間枠（30分）", "cell_jp_sm"),
            p("例：通学電車15分（単語・リスニング）＋ 帰宅後または就寝前15分（筆記演習）→ ＿＿＿＿＿＿＿＿＿＿", "cell_jp_sm"),
        ],
        [
            p("S-CBT 第1回／第2回 受験目標月", "cell_jp_sm"),
            p("第1回チャレンジ予定：2026年 ＿＿月 ＿＿日頃 ／ 本命合格ターゲット：2026年 ＿＿月 ＿＿日頃", "cell_jp_sm"),
        ],
        [
            p("担当講師メモ・サイン", "cell_jp_sm"),
            p("担当講師：＿＿＿＿＿＿＿＿＿＿　　生徒確認サイン：＿＿＿＿＿＿＿＿＿＿", "cell_jp_sm"),
        ],
    ]
    ptbl = Table(plan_rows, colWidths=[148, CONTENT_W - 148], hAlign="LEFT")
    ptbl.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), C_BG_HEAD),
                ("BACKGROUND", (0, 2), (-1, 2), C_BG_ZEBRA),
                ("BACKGROUND", (0, 4), (-1, 4), C_BG_ZEBRA),
                ("GRID", (0, 0), (-1, -1), 0.5, C_BORDER),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ("LEFTPADDING", (0, 0), (-1, -1), 5),
                ("RIGHTPADDING", (0, 0), (-1, -1), 5),
                ("TOPPADDING", (0, 0), (-1, -1), 6.5),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 6.5),
            ]
        )
    )
    _, pth = ptbl.wrap(CONTENT_W, H)
    ptbl.drawOn(c, MARGIN_X, H - cur_top - pth)
    c.showPage()

    # ---------------- PAGE 6: First-Week Launch Checklist ----------------
    draw_page_chrome(c, doc_title, "初週1週間ルーティン定着表", 6, total_pages)
    cur_top = 58

    c.setFont("SugorokuJP", 11.0)
    c.drawString(MARGIN_X, H - cur_top - 12, "入塾1週目「4日進行＋2日調整＋指導日小テスト」スタートアップ記録表")
    cur_top += 20

    wk1_rows = [
        [
            p_rich("<b>Day</b>", "cell_head"),
            p_rich("<b>位置づけ</b>", "cell_head"),
            p_rich("<b>アプリ＆冊子でやること（目安25〜30分）</b>", "cell_head"),
            p_rich("<b>有効時間</b>", "cell_head"),
            p_rich("<b>達成</b>", "cell_head"),
        ],
        [
            p_rich("<b>Day 1</b>", "cell_center"),
            p("進行日①", "cell_center"),
            p("週次対象単語 No.01〜05（声に出して例文音読）＋ 大問1 短文空所 5問 ＋ リスニング第1部 4問", "cell_jp_sm"),
            p("＿＿ 分", "cell_center"),
            p("□", "cell_center"),
        ],
        [
            p_rich("<b>Day 2</b>", "cell_center"),
            p("進行日②", "cell_center"),
            p("週次対象単語 No.06〜10 ＋ 大問1 短文空所 6問 ＋ リスニング第1部 4問（スクリプト確認）", "cell_jp_sm"),
            p("＿＿ 分", "cell_center"),
            p("□", "cell_center"),
        ],
        [
            p_rich("<b>Day 3</b>", "cell_center"),
            p("進行日③", "cell_center"),
            p("週次対象単語 No.11〜15 ＋ 大問1 残り6問 ＋ リスニング第1部 4問", "cell_jp_sm"),
            p("＿＿ 分", "cell_center"),
            p("□", "cell_center"),
        ],
        [
            p_rich("<b>Day 4</b>", "cell_center"),
            p("進行日④", "cell_center"),
            p("週次対象単語 No.16〜20 ＋ 大問2 長文空所 6問（またはブリッジ読解）＋ リスニング残り3問", "cell_jp_sm"),
            p("＿＿ 分", "cell_center"),
            p("□", "cell_center"),
        ],
        [
            p_rich("<b>Day 5</b>", "cell_center"),
            p("調整予備①", "cell_center"),
            p("部活延長・試合等で遅れた分のキャッチアップ ／ アプリ「復習リスト」の赤チェック単語潰し", "cell_jp_sm"),
            p("＿＿ 分", "cell_center"),
            p("□", "cell_center"),
        ],
        [
            p_rich("<b>Day 6</b>", "cell_center"),
            p("調整予備②", "cell_center"),
            p("翌日の個別指導に向けた「週次20語セルフレビュー」＋ ライティング型確認（80〜100語または要約）", "cell_jp_sm"),
            p("＿＿ 分", "cell_center"),
            p("□", "cell_center"),
        ],
        [
            p_rich("<b>Day 7</b>", "cell_center"),
            p("個別指導日", "cell_center"),
            p("冒頭5分：週次確認小テスト（16/20点合格！15点以下は次回Form B再試）＋ 1週間の時間ログ振り返り", "cell_jp_sm"),
            p("指導内", "cell_center"),
            p("□", "cell_center"),
        ],
    ]
    w1_tbl = Table(wk1_rows, colWidths=[44, 62, CONTENT_W - 196, 56, 34], hAlign="LEFT")
    w1_zebra = [("BACKGROUND", (0, r), (-1, r), C_BG_ZEBRA) for r in range(2, 8, 2)]
    w1_tbl.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), C_BG_HEAD),
                *w1_zebra,
                ("GRID", (0, 0), (-1, -1), 0.5, C_BORDER),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ("LEFTPADDING", (0, 0), (-1, -1), 4.5),
                ("RIGHTPADDING", (0, 0), (-1, -1), 4.5),
                ("TOPPADDING", (0, 0), (-1, -1), 6.0),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 6.0),
            ]
        )
    )
    _, w1h = w1_tbl.wrap(CONTENT_W, H)
    w1_tbl.drawOn(c, MARGIN_X, H - cur_top - w1h)
    cur_top += w1h + 14

    draw_paragraph_box(
        c,
        "マナトビ英検アプリ連携チェックリスト（初回ログイン時に講師と一緒に確認）",
        [
            "□ すごろくクラス招待コードで入室完了（広告が自動非表示になり、講師画面とリアルタイム連携されます）",
            "□ ホーム画面に「今週の宿題（1日あたりの目標問数）」が表示されていることを確認",
            "□ 音声再生ボタン（1.0x / 0.75x 速度切替）と S-CBT スピーキング録音マイクのテスト完了",
            "□ 3日以上アプリを開かないと担当講師に「学習ストップ通知」が届くルールを共有済み（1日5分でも単語に触れよう！）",
        ],
        MARGIN_X,
        cur_top,
        CONTENT_W,
    )
    c.showPage()

    c.save()
    return out_path


def main() -> None:
    filter_path = OUT_DIR / "sugoroku_foundation_vocab_filter.json"
    audit_path = OUT_DIR / "vocab_cefr_audit_report.json"
    if not filter_path.exists() or not audit_path.exists():
        raise FileNotFoundError(
            "Run `tsx scripts/sugoroku-vocab-audit.ts` first to generate vocab_cefr_audit_report.json and sugoroku_foundation_vocab_filter.json."
        )

    filter_data = json.loads(filter_path.read_text(encoding="utf-8"))
    audit_report = json.loads(audit_path.read_text(encoding="utf-8"))

    diag_test_25 = filter_data["entryPlacementDiagnosticTest25"]
    g2_weekly_tests = filter_data["grade2WeeklyVocabTests12Weeks"]
    g2_retests_form_b = filter_data["grade2WeeklyVocabRetestsFormB12Weeks"]
    pre2plus_tests = filter_data["pre2PlusBridgeVocabTests4Weeks"]
    pre2_tests = filter_data["pre2FoundationVocabTests4Weeks"]
    paraphrase_dict = filter_data.get("b1b2ParaphraseDictionary", {})

    # 0. Build 15-min Entry Placement Diagnostic Test & Prescription PDF (6 pages)
    diag_pdf = build_placement_diagnostic_pdf(diag_test_25)
    diag_validation = check_pdf_quality(diag_pdf, expected_pages=6)

    # 1. Build 12-week Grade 2 curriculum route PDF (6 pages)
    route_pdf = build_curriculum_route_pdf(audit_report, paraphrase_dict)
    route_validation = check_pdf_quality(route_pdf, expected_pages=6)

    # 2. Build 12-week Grade 2 hybrid weekly vocabulary test [Form A] PDF (26 pages)
    vocab_pdf = build_weekly_vocab_tests_pdf(g2_weekly_tests)
    vocab_validation = check_pdf_quality(vocab_pdf, expected_pages=26)

    # 3. Build 12-week Grade 2 make-up weekly vocabulary retest [Form B] PDF (25 pages)
    retest_pdf = build_weekly_vocab_retests_form_b_pdf(g2_retests_form_b)
    retest_validation = check_pdf_quality(retest_pdf, expected_pages=25)

    # 4. Build 8-stage Pre-2 & Pre-2 Plus Bridge Pack PDF (18 pages)
    bridge_pdf = build_pre2plus_bridge_pack_pdf(pre2_tests, pre2plus_tests)
    bridge_validation = check_pdf_quality(bridge_pdf, expected_pages=18)

    # 5. Build Grade 2 S-CBT Speaking/Writing & Daimon-1 C1 Coaching Handbook PDF (8 pages)
    handbook_pdf = build_scbt_writing_speaking_handbook_pdf(audit_report)
    handbook_validation = check_pdf_quality(handbook_pdf, expected_pages=8)

    all_validations = [
        diag_validation,
        route_validation,
        vocab_validation,
        retest_validation,
        bridge_validation,
        handbook_validation,
    ]
    total_verified_pages = sum(v["pages"] for v in all_validations)

    # 6. Export machine-readable curriculum manifest v4.0.0 for AI 1 / AI 2 integration
    manifest_path = OUT_DIR / "curriculum_route_manifest.json"
    manifest_path.write_text(
        json.dumps(
            {
                "schemaVersion": "4.0.0",
                "presetId": "sugoroku_eiken2_12w_standard",
                "title": "英検2級 3か月（12週間）合格モデルカリキュラム（S-CBT併用標準ルート）",
                "targetGrade": "eiken_2",
                "bridgeGrade": "eiken_pre2plus",
                "foundationGrade": "eiken_pre2",
                "totalWeeks": 12,
                "bridgeTotalStages": 8,
                "placementDiagnosticPdf": "deliverables/sugoroku/sugoroku_eiken2_placement_diagnostic_test.pdf",
                "routePdf": "deliverables/sugoroku/sugoroku_eiken2_12week_curriculum_route.pdf",
                "weeklyVocabTestsPdf": "deliverables/sugoroku/sugoroku_eiken2_weekly_vocab_tests_12w.pdf",
                "weeklyVocabRetestsFormBPdf": "deliverables/sugoroku/sugoroku_eiken2_weekly_vocab_retests_formB_12w.pdf",
                "bridgePackPdf": "deliverables/sugoroku/sugoroku_pre2plus_bridge_4week_pack.pdf",
                "scbtWritingSpeakingHandbookPdf": "deliverables/sugoroku/sugoroku_eiken2_scbt_writing_speaking_handbook.pdf",
                "placementRules": {
                    "grade2StandardMinScorePercent": 55,
                    "pre2PlusBridge4WeeksScoreRangePercent": [40, 54],
                    "pre2Foundation8WeeksMaxScorePercent": 39,
                    "mergeIntoGrade2WeekAfterBridge": 3,
                },
                "weeks": CURRICULUM_12_WEEKS,
                "bridgeStages": BRIDGE_8_STAGES,
            },
            ensure_ascii=False,
            indent=2,
        )
        + "\n",
        encoding="utf-8",
    )

    # 7. Save PDF layout & grayscale validation report across all 6 PDFs (89 pages)
    validation_path = OUT_DIR / "pdf_layout_validation.json"
    validation_path.write_text(
        json.dumps(
            {
                "status": "PASS",
                "totalDocuments": len(all_validations),
                "totalPagesVerified": total_verified_pages,
                "zeroOverlapVerified": True,
                "zeroOutOfBoundsVerified": True,
                "grayscalePrintReady": True,
                "documents": all_validations,
            },
            ensure_ascii=False,
            indent=2,
        )
        + "\n",
        encoding="utf-8",
    )

    print(
        f"=== Sugoroku v4 Full PDF Suite Built & Verified ({len(all_validations)} PDFs, {total_verified_pages} Pages) ==="
    )
    for doc_v in all_validations:
        print(
            f"  - {doc_v['file']}: {doc_v['pages']} pages, {doc_v['sizeKB']} KB (overlaps=0, grayscale=True)"
        )
    print(f"  - {manifest_path.name} (v4.0.0) & {validation_path.name} written.")


if __name__ == "__main__":
    main()
