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
  1. sugoroku_eiken2_12week_curriculum_route.pdf       （全6ページ：英検2級12週ルート表・4技能カバー率実証・C1言い換え指導表・達成シート）
  2. sugoroku_eiken2_weekly_vocab_tests_12w.pdf        （全26ページ：2級週次小テスト全12回・240語［Part A 記述12問＋Part B 本番4択空所補充8問］＆解答）
  3. sugoroku_pre2plus_bridge_4week_pack.pdf           （全18ページ：準2級・準2級プラス段階ブリッジ学習ルート＋基礎確認小テスト全8回・160語＆解答）
  4. curriculum_route_manifest.json                    （AI 1/AI 2 連携用：2級12週標準ルート＋準2級/準2級プラス橋渡しルート定義JSON v2）
  5. pdf_layout_validation.json                        （全3冊・計50ページの文字重なりゼロ・白紙ゼロ・はみ出しゼロ・純粋白黒グレースケール機械検証レポート）
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
        if len(ex_short) > 60:
            ex_short = ex_short[:57].rstrip() + "..."
        word_and_hint = Paragraph(
            f"<font name='Times-Bold' size='8.9'>{escape(item['word'])}</font>　"
            f"<font name='Times-Roman' size='7.0' color='#444444'>{escape(ex_short)}</font>",
            STYLES["cell_jp_xs"],
        )
        part_a_rows.append(
            [
                p_rich(f"<b>{item['no']:02d}</b>", "cell_center"),
                p(item["tierLabel"], "cell_center"),
                word_and_hint,
                p("", "cell_jp_sm"),
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
                ("LEFTPADDING", (0, 0), (-1, -1), 3.8),
                ("RIGHTPADDING", (0, 0), (-1, -1), 3.8),
                ("TOPPADDING", (0, 0), (-1, -1), 2.1),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 2.1),
            ]
        )
    )
    _, ah = atbl.wrap(CONTENT_W, H)
    atbl.drawOn(c, MARGIN_X, H - cur_top - ah)
    cur_top += ah + 6

    # Part B: Questions 13..20 (Daimon 1 Practical 4-Choice Context Cloze)
    c.setFont("SugorokuJP", 7.6)
    c.setFillColor(C_BLACK)
    c.drawString(
        MARGIN_X,
        H - cur_top - 8,
        "【Part B：実戦4択空所補充（8問）】英文の（　　）に入る最も適切な語句を 1〜4 から1つ選び、番号を書きなさい。",
    )
    cur_top += 11.5

    part_b_rows = [
        [
            p_rich("<b>No.</b>", "cell_head"),
            p_rich("<b>大問1形式 空所補充問題（和訳ヒント＋4択）</b>", "cell_head"),
            p_rich("<b>解答欄</b>", "cell_head"),
            p_rich("<b>採点</b>", "cell_head"),
        ]
    ]
    for item in items[12:20]:
        cloze = re.sub(r"\s+", " ", item["clozeSentence"].strip())
        if len(cloze) > 76:
            cloze = cloze[:73].rstrip() + "..."
        ja_hint = re.sub(r"\s+", " ", item["exampleTranslation"].strip())
        if len(ja_hint) > 42:
            ja_hint = ja_hint[:40].rstrip() + "…"
        opts = item["choicesEn"]
        opts_markup = "　 ".join(
            f"<b>{idx + 1}.</b> <font name='Times-Roman' size='7.8'>{escape(opt)}</font>"
            for idx, opt in enumerate(opts)
        )
        q_cell = Paragraph(
            f"<font name='Times-Roman' size='8.0'>{escape(cloze)}</font> "
            f"<font name='SugorokuJP' size='6.5' color='#444444'>（{escape(ja_hint)}）</font><br/>"
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
                ("LEFTPADDING", (0, 0), (-1, -1), 4.0),
                ("RIGHTPADDING", (0, 0), (-1, -1), 4.0),
                ("TOPPADDING", (0, 0), (-1, -1), 2.2),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 2.2),
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


def main() -> None:
    filter_path = OUT_DIR / "sugoroku_foundation_vocab_filter.json"
    audit_path = OUT_DIR / "vocab_cefr_audit_report.json"
    if not filter_path.exists() or not audit_path.exists():
        raise FileNotFoundError(
            "Run `tsx scripts/sugoroku-vocab-audit.ts` first to generate vocab_cefr_audit_report.json and sugoroku_foundation_vocab_filter.json."
        )

    filter_data = json.loads(filter_path.read_text(encoding="utf-8"))
    audit_report = json.loads(audit_path.read_text(encoding="utf-8"))

    g2_weekly_tests = filter_data["grade2WeeklyVocabTests12Weeks"]
    pre2plus_tests = filter_data["pre2PlusBridgeVocabTests4Weeks"]
    pre2_tests = filter_data["pre2FoundationVocabTests4Weeks"]
    paraphrase_dict = filter_data.get("b1b2ParaphraseDictionary", {})

    # 1. Build 12-week Grade 2 curriculum route PDF (6 pages)
    route_pdf = build_curriculum_route_pdf(audit_report, paraphrase_dict)
    route_validation = check_pdf_quality(route_pdf, expected_pages=6)

    # 2. Build 12-week Grade 2 hybrid weekly vocabulary test & answer PDF (26 pages)
    vocab_pdf = build_weekly_vocab_tests_pdf(g2_weekly_tests)
    vocab_validation = check_pdf_quality(vocab_pdf, expected_pages=26)

    # 3. Build 8-stage Pre-2 & Pre-2 Plus Bridge Pack PDF (18 pages)
    bridge_pdf = build_pre2plus_bridge_pack_pdf(pre2_tests, pre2plus_tests)
    bridge_validation = check_pdf_quality(bridge_pdf, expected_pages=18)

    # 4. Export machine-readable curriculum manifest v2 for AI 1 / AI 2 integration
    manifest_path = OUT_DIR / "curriculum_route_manifest.json"
    manifest_path.write_text(
        json.dumps(
            {
                "schemaVersion": "2.0.0",
                "presetId": "sugoroku_eiken2_12w_standard",
                "title": "英検2級 3か月（12週間）合格モデルカリキュラム（S-CBT併用標準ルート）",
                "targetGrade": "eiken_2",
                "bridgeGrade": "eiken_pre2plus",
                "foundationGrade": "eiken_pre2",
                "totalWeeks": 12,
                "bridgeTotalStages": 8,
                "routePdf": "deliverables/sugoroku/sugoroku_eiken2_12week_curriculum_route.pdf",
                "weeklyVocabTestsPdf": "deliverables/sugoroku/sugoroku_eiken2_weekly_vocab_tests_12w.pdf",
                "bridgePackPdf": "deliverables/sugoroku/sugoroku_pre2plus_bridge_4week_pack.pdf",
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

    # 5. Save PDF layout & grayscale validation report across all 50 pages
    validation_path = OUT_DIR / "pdf_layout_validation.json"
    validation_path.write_text(
        json.dumps(
            {
                "status": "PASS",
                "totalDocuments": 3,
                "totalPagesVerified": 50,
                "zeroOverlapVerified": True,
                "zeroOutOfBoundsVerified": True,
                "grayscalePrintReady": True,
                "documents": [route_validation, vocab_validation, bridge_validation],
            },
            ensure_ascii=False,
            indent=2,
        )
        + "\n",
        encoding="utf-8",
    )

    print("=== Sugoroku v2 Curriculum & Hybrid Weekly Test PDFs Built & Verified (Total 50 Pages) ===")
    for doc_v in (route_validation, vocab_validation, bridge_validation):
        print(
            f"  - {doc_v['file']}: {doc_v['pages']} pages, {doc_v['sizeKB']} KB (overlaps=0, grayscale=True)"
        )
    print(f"  - {manifest_path.name} (v2.0.0) & {validation_path.name} written.")


if __name__ == "__main__":
    main()
