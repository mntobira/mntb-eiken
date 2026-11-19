#!/usr/bin/env python3
"""
すごろく塾 × マナトビ英検：
『英検2級 3か月（12週間）合格モデルカリキュラム＆週次確認テストPDF』生成スクリプト（AI 5担当）

実行方法:
  cd eiken-app && python3 scripts/build-sugoroku-curriculum-pdf.py

入力データ:
  - deliverables/sugoroku/sugoroku_foundation_vocab_filter.json （sugoroku-vocab-audit.ts が生成したCEFR/パス単監査済み240語）
  - deliverables/sugoroku/vocab_cefr_audit_report.json         （語彙・大問1 CEFR監査統計）
  - deliverables/written-booklets.json                         （収録済み一次筆記 第1〜15回 メタ情報）
  - deliverables/eiken-writing-tasks.json                      （収録済みライティング課題メタ情報）
  - public/brand/manatobi-logo-gray.png                        （マナトビ公式ロゴ・グレースケール）
  - public/fonts/booklet-noto-serif-jp.ttf                     （印刷用日本語フォント）

出力ファイル（すべて deliverables/sugoroku/ 配下に分離出力・既存資産への変更ゼロ）:
  1. sugoroku_eiken2_12week_curriculum_route.pdf               （すごろく塾用・英検2級12週間学習ルート表＆指導ガイド 全6ページ）
  2. sugoroku_eiken2_weekly_vocab_tests_12w.pdf                （2級必須語彙 週次小テスト＆解答解説 全12回分・全26ページ）
  3. curriculum_route_manifest.json                            （AI 1/AI 2 の管理者画面・宿題プリセット連携用12週ルート定義JSON）
  4. pdf_layout_validation.json                                （全ページ重なりゼロ・白紙ゼロ・はみ出しゼロ機械検証レポート）
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

# Grayscale-only palette for crisp B&W laser/copier printing
C_BLACK = colors.black
C_WHITE = colors.white
C_DARK = colors.HexColor("#1f1f1f")
C_GRAY_TEXT = colors.HexColor("#444444")
C_BORDER = colors.HexColor("#2b2b2b")
C_LINE_LIGHT = colors.HexColor("#bdbdbd")
C_BG_HEAD = colors.HexColor("#e4e4e4")
C_BG_SUB = colors.HexColor("#f2f2f2")
C_BG_ZEBRA = colors.HexColor("#f9f9f9")

STYLES = {
    "cell_head": ParagraphStyle(
        "cell_head",
        fontName="SugorokuJP",
        fontSize=7.8,
        leading=10.8,
        textColor=C_BLACK,
        alignment=1,
        wordWrap="CJK",
    ),
    "cell_jp": ParagraphStyle(
        "cell_jp",
        fontName="SugorokuJP",
        fontSize=7.6,
        leading=10.8,
        textColor=C_BLACK,
        wordWrap="CJK",
    ),
    "cell_jp_sm": ParagraphStyle(
        "cell_jp_sm",
        fontName="SugorokuJP",
        fontSize=7.1,
        leading=10.0,
        textColor=C_BLACK,
        wordWrap="CJK",
    ),
    "cell_center": ParagraphStyle(
        "cell_center",
        fontName="SugorokuJP",
        fontSize=7.8,
        leading=10.8,
        textColor=C_BLACK,
        alignment=1,
        wordWrap="CJK",
    ),
    "cell_jp_xs": ParagraphStyle(
        "cell_jp_xs",
        fontName="SugorokuJP",
        fontSize=6.9,
        leading=9.2,
        textColor=C_BLACK,
        wordWrap="CJK",
    ),
    "body": ParagraphStyle(
        "body",
        fontName="SugorokuJP",
        fontSize=8.6,
        leading=13.2,
        textColor=C_BLACK,
        wordWrap="CJK",
    ),
    "body_sm": ParagraphStyle(
        "body_sm",
        fontName="SugorokuJP",
        fontSize=8.0,
        leading=12.0,
        textColor=C_BLACK,
        wordWrap="CJK",
    ),
    "quiz_word": ParagraphStyle(
        "quiz_word",
        fontName="Times-Bold",
        fontSize=10.2,
        leading=13.0,
        textColor=C_BLACK,
    ),
    "quiz_ex": ParagraphStyle(
        "quiz_ex",
        fontName="Times-Roman",
        fontSize=8.3,
        leading=11.2,
        textColor=C_DARK,
    ),
    "quiz_ans_jp": ParagraphStyle(
        "quiz_ans_jp",
        fontName="SugorokuJP",
        fontSize=8.2,
        leading=11.4,
        textColor=C_BLACK,
        wordWrap="CJK",
    ),
    "quiz_tr": ParagraphStyle(
        "quiz_tr",
        fontName="SugorokuJP",
        fontSize=7.3,
        leading=10.2,
        textColor=C_GRAY_TEXT,
        wordWrap="CJK",
    ),
}


def p(text: str, style_name: str = "cell_jp") -> Paragraph:
    markup = escape(str(text)).replace("\n", "<br/>")
    return Paragraph(markup, STYLES[style_name])


def p_bold(text: str, style_name: str = "cell_jp") -> Paragraph:
    markup = f"<b>{escape(str(text))}</b>".replace("\n", "<br/>")
    return Paragraph(markup, STYLES[style_name])


def p_rich(markup: str, style_name: str = "cell_jp") -> Paragraph:
    return Paragraph(markup, STYLES[style_name])


def draw_top_y(c: canvas.Canvas, top_pt: float) -> float:
    return H - top_pt


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
    c.setFont("SugorokuJP", 8.4)
    c.drawString(MARGIN_X + 82, H - 31, doc_title)
    c.setFont("SugorokuJP", 8.0)
    c.drawRightString(W - MARGIN_X, H - 31, section_badge)
    c.setLineWidth(0.9)
    c.line(MARGIN_X, H - 48, W - MARGIN_X, H - 48)
    c.setLineWidth(0.35)
    c.line(MARGIN_X, H - 50.5, W - MARGIN_X, H - 50.5)

    # Footer
    c.setLineWidth(0.5)
    c.line(MARGIN_X, 36, W - MARGIN_X, 36)
    c.setFont("SugorokuJP", 7.4)
    c.setFillColor(C_GRAY_TEXT)
    c.drawString(
        MARGIN_X,
        23,
        "オンライン塾「すごろく」× マナトビ英検｜独自編成カリキュラム・確認テスト（過去問の流用なし・白黒印刷最適化）",
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
                ("LEFTPADDING", (0, 0), (-1, -1), 7),
                ("RIGHTPADDING", (0, 0), (-1, -1), 7),
                ("TOPPADDING", (0, 0), (-1, -1), 4),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
            ]
        )
    )
    _, h = tbl.wrap(width, H)
    tbl.drawOn(c, x, H - top - h)
    return h


def mask_word_in_sentence(sentence: str, target_word: str) -> str:
    """Masks the target word/idiom inside the example sentence for context-supported recall."""
    clean_sent = re.sub(r"\s+", " ", sentence.strip())
    tokens = target_word.strip().split()
    if len(tokens) == 1:
        stem = target_word.strip()
        pattern = re.compile(rf"\b{re.escape(stem)}(?:s|es|ed|d|ing)?\b", re.IGNORECASE)
        if pattern.search(clean_sent):
            return pattern.sub("(               )", clean_sent, count=1)
    else:
        pattern = re.compile(re.escape(target_word.strip()), re.IGNORECASE)
        if pattern.search(clean_sent):
            return pattern.sub("(                     )", clean_sent, count=1)
    return clean_sent


def check_pdf_quality(pdf_path: Path, expected_pages: int) -> dict[str, Any]:
    """
    Automated visual/geometry inspection on every generated PDF page:
    1) Exact expected page count
    2) Non-blank page verification
    3) Strict bounding-box collision check (zero overlapping text lines, English or Japanese)
    4) Margin boundary check (zero horizontal/vertical clipping or overflow)
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
                        out_of_bounds.append((round(x0, 1), round(y0, 1), round(x1, 1), round(y1, 1), txt))

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
                    # Flag genuine text collisions (> 3.0pt horizontal and > 3.2pt vertical intersection)
                    if ix > 3.0 and iy > 3.2:
                        overlaps.append((atxt, btxt, round(ix, 1), round(iy, 1)))
            if overlaps:
                raise ValueError(
                    f"{pdf_path.name} p.{page_idx}: text overlap detected: {overlaps[0]}"
                )
            report_pages.append(
                {
                    "page": page_idx,
                    "charCount": text_len,
                    "lineCount": len(lines),
                    "overlaps": 0,
                    "outOfBounds": 0,
                }
            )

    return {
        "file": pdf_path.name,
        "sizeKB": round(pdf_path.stat().st_size / 1024, 1),
        "pages": expected_pages,
        "allPagesClean": True,
        "pageDetails": report_pages,
    }


# ---------------------------------------------------------------------------
# Curriculum Master Definition (12 Weeks mapping all 15 Written + 15 Listening + Writing + Notes + S-CBT)
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
        "dailyPace": "平日5日：単語15語＋大問1を4問＋リスニング3問（計25〜30分/日）／土曜：復習日",
        "coachingCheck": "週次単語小テスト 第1回（16/20点合格）＋ アプリ有効学習時間ログ確認",
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
        "dailyPace": "平日5日：単語15語＋読解1パッセージor短文5問＋リスニング6問（約30分/日）",
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
        "dailyPace": "平日5日：単語20語＋リーディング6問＋リスニング6問（約30分/日）",
        "coachingCheck": "週次単語小テスト 第3回 ＋ 要約の語数・パラフレーズ添削（コピー丸写し防止）",
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
        "dailyPace": "平日5日：単語20語＋筆記演習＋リスニング9問（約35分/日）",
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
        "dailyPace": "平日5日：単語25語＋筆記10問＋リスニング6問（約35分/日）",
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
        "dailyPace": "平日5日：単語25語＋筆記9問＋リスニング9問（約35〜40分/日）",
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
        "dailyPace": "春休み平日：単語25語＋筆記11問＋リスニング9問（約40分/日）",
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
        "dailyPace": "平日5日：単語20語＋筆記11問＋リスニング9問（約40分/日）",
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
        "dailyPace": "平日5日：単語20語＋筆記11問＋リスニング9問（約40分/日）",
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
        "dailyPace": "平日5日：復習単語30語＋筆記9問＋リスニング12問（約40分/日）",
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


def build_curriculum_route_pdf(audit_report: dict[str, Any]) -> Path:
    """
    Generates `sugoroku_eiken2_12week_curriculum_route.pdf` (6 crisp A4 B&W pages):
      Page 1: Cover, Program Overview, S-CBT Advantage Schedule (Feb -> Jul), Daily Pacemaker Rules
      Page 2: Weeks 1-4 Detailed Master Schedule (Phase 1: Foundation)
      Page 3: Weeks 5-8 Detailed Master Schedule (Phase 2: Practical Integration & 1st S-CBT Prep)
      Page 4: Weeks 9-12 Detailed Master Schedule (Phase 3: Full Mock & Target Mastery)
      Page 5: Pre-2 Plus Bridge Option (for students needing 4-week step-up) & Vocabulary CEFR Filter Policy
      Page 6: Student Printable 12-Week Progress & Weekly Test Score Sheet ("すごろく12週達成チェック表")
    """
    out_path = OUT_DIR / "sugoroku_eiken2_12week_curriculum_route.pdf"
    total_pages = 6
    c = canvas.Canvas(str(out_path), pagesize=A4, pageCompression=1, invariant=1)
    c.setTitle("すごろく塾用・英検2級 3か月（12週間）合格モデルカリキュラム＆学習ルート表")
    c.setAuthor("オンライン塾「すごろく」× マナトビ英検")

    doc_title = "すごろく塾専用｜英検2級 3か月（12週間）合格モデルカリキュラム"

    # ---------------- PAGE 1: Cover & Strategic Blueprint ----------------
    draw_page_chrome(c, doc_title, "全体設計・S-CBT逆算計画", 1, total_pages)

    # Hero Title Banner
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
    c.setFont("SugorokuJP", 7.1)
    c.drawString(
        MARGIN_X + 120,
        H - banner_top - 66,
        "収録対応：一次筆記 全15回（465問＋英作文）｜リスニング 全15回（450問）｜重点語ノート｜週次単語テスト12回",
    )

    cur_top = banner_top + banner_h + 14

    # Box 1: Why 12 Weeks + S-CBT Multi-Chance Strategy
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
    cur_top += h1 + 12

    # Table: Feb - Jul Milestone Timeline
    c.setFont("SugorokuJP", 9.8)
    c.drawString(MARGIN_X, H - cur_top - 10, "■ 2月開講〜7月英検2級取得 逆算マイルストーン（S-CBT＆本試験ハイブリッド計画）")
    cur_top += 18

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
                ("TOPPADDING", (0, 0), (-1, -1), 4),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
            ]
        )
    )
    _, ms_h = ms_tbl.wrap(CONTENT_W, H)
    ms_tbl.drawOn(c, MARGIN_X, H - cur_top - ms_h)
    cur_top += ms_h + 14

    # Box 2: Pacemaker Rules (Preventing 1-day cramming / last-minute neglect)
    h2 = draw_paragraph_box(
        c,
        "2. 運動部生が挫折しない「週次ペースメーカー（4日前進・2日復習・1日テスト）」運用ルール",
        [
            "【1日まとめ解き防止】月〜木の4日間は「毎日25〜35分（単語15〜20語＋リーディング1単元＋リスニング5〜10問）」に分割配信。アプリのトップ画面『今日の宿題』から1タップで開始する。",
            "【金・土は調整＆復習バッファ】部活の試合や学校行事で平日に遅れが出ても、金・土の復習日で吸収できる設計とし、未着手3日経過時は管理者画面アラートからLINE等で早めに声掛けする。",
            "【毎週の個別指導＝確認テスト＆添削フィードバック】授業冒頭5分で別冊『週次単語小テスト（20問・合格基準16点＝80%）』を実施。ライティング提出答案とS-CBT録音は講師コメント付きで返却する。",
            "【CEFR厳密フィルタ適用】C1/C2レベルの準1級難語（143語）は基礎モードから除外済み。合格に直結するB1〜B2前半のコア語彙だけに100%の労力を集中させる。",
        ],
        MARGIN_X,
        cur_top,
        CONTENT_W,
    )
    c.showPage()

    # ---------------- PAGES 2-4: 12-Week Detailed Route Tables (4 weeks per page) ----------------
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
        c.setFont("SugorokuJP", 11.2)
        c.drawString(MARGIN_X, H - top_y - 11, f"■ {phase_title}")
        c.setFont("SugorokuJP", 7.4)
        c.setFillColor(C_GRAY_TEXT)
        c.drawRightString(
            W - MARGIN_X,
            H - top_y - 11,
            "※『マナトビ英検』単元・印刷用PDFと連動",
        )
        top_y += 20

        for wk in weeks_slice:
            header_left = f"<b>Week {wk['week']:02d}</b>　｜　{escape(wk['calendarHint'])}　—　<b>目標：{escape(wk['goal'])}</b>"
            rows = [
                [p_rich(header_left, "cell_jp"), ""],
                [
                    p_rich("<b>① 語彙・熟語</b>", "cell_center"),
                    p(wk["vocabTask"], "cell_jp_sm"),
                ],
                [
                    p_rich("<b>② リーディング</b>", "cell_center"),
                    p(wk["readingTask"], "cell_jp_sm"),
                ],
                [
                    p_rich("<b>③ リスニング</b>", "cell_center"),
                    p(wk["listeningTask"], "cell_jp_sm"),
                ],
                [
                    p_rich("<b>④ 英作文・面接</b>", "cell_center"),
                    p(wk["writingSpeakingTask"], "cell_jp_sm"),
                ],
                [
                    p_rich("<b>⑤ 日割り＆確認</b>", "cell_center"),
                    p_rich(
                        f"<b>【日割り目安】</b>{escape(wk['dailyPace'])}<br/><b>【個別指導チェック】</b>{escape(wk['coachingCheck'])}",
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
                        ("TOPPADDING", (0, 0), (-1, -1), 3.0),
                        ("BOTTOMPADDING", (0, 0), (-1, -1), 3.0),
                    ]
                )
            )
            _, wh = wtbl.wrap(CONTENT_W, H)
            wtbl.drawOn(c, MARGIN_X, H - top_y - wh)
            top_y += wh + 9

        c.showPage()

    # ---------------- PAGE 5: Pre-2 Plus Step-up Option & CEFR Audit Summary ----------------
    draw_page_chrome(
        c,
        doc_title,
        "準2級プラス橋渡し運用・語彙CEFR監査基準",
        5,
        total_pages,
    )

    cur_top = 62
    c.setFillColor(C_BLACK)
    c.setFont("SugorokuJP", 12.2)
    c.drawString(MARGIN_X, H - cur_top - 12, "■ 入塾時診断に応じた「英検準2級プラス」ブリッジ活用＆語彙CEFR厳密基準")
    cur_top += 22

    h_bridge = draw_paragraph_box(
        c,
        "1. いきなり2級長文が厳しい生徒への「準2級プラス（収録済15回）」4週間ブリッジ処方",
        [
            "入塾初回の診断（2級 第1回 大問1＋リスニング第1部）で正答率が40%未満の生徒は、無理に2級評論文から始めると挫折しやすい。",
            "『マナトビ英検』には新設級「英検準2級プラス」も一次筆記15回（469項目）＋リスニング15回（450問）が完全収録されている。",
            "該当生徒には最初の4週間（1月先行期〜2月）で「準2級プラス 第1〜5回＋準2級プラス単語B1コア」を挟み、英文要約（35〜45語）と長文構造に慣らしてから本2級ルートWeek 3へ合流させることで、7月までの2級到達率を高められる。",
        ],
        MARGIN_X,
        cur_top,
        CONTENT_W,
    )
    cur_top += h_bridge + 14

    # CEFR Audit Summary Table from real audit data
    g2_d1 = audit_report["readingDaimon1Audit"]["eiken_2"]
    p2p_d1 = audit_report["readingDaimon1Audit"]["eiken_pre2plus"]
    p2_d1 = audit_report["readingDaimon1Audit"]["eiken_pre2"]
    g2_wb = audit_report["targetGradesWordbookAudit"]["eiken_2"]
    p2p_wb = audit_report["targetGradesWordbookAudit"]["eiken_pre2plus"]
    p2_wb = audit_report["targetGradesWordbookAudit"]["eiken_pre2"]

    c.setFont("SugorokuJP", 10.0)
    c.drawString(MARGIN_X, H - cur_top - 10, "■ 2. 『マナトビ英検』語彙CEFR／パス単基準 機械監査サマリー（不要な難語排除の根拠）")
    cur_top += 18

    audit_rows = [
        [
            p_rich("<b>対象級</b>", "cell_head"),
            p_rich("<b>適正CEFR目安</b>", "cell_head"),
            p_rich("<b>筆記大問1 適正帯適合率</b>", "cell_head"),
            p_rich("<b>単語帳収録数</b>", "cell_head"),
            p_rich("<b>C1/C2難語除外数</b>", "cell_head"),
            p_rich("<b>講師指導方針</b>", "cell_head"),
        ],
        [
            p_rich("<b>英検2級</b>", "cell_center"),
            p("B1〜B2前半", "cell_center"),
            p_rich(f"<b>{g2_d1['cleanRatePercent']}%</b>（全255問）", "cell_center"),
            p(f"{g2_wb['totalEntries']}語", "cell_center"),
            p(f"{g2_wb['trueLowRoiC1C2Count']}語を除外", "cell_center"),
            p("B1〜B2前半のコア語彙と熟語に集中（C1語は消去法のみで暗記不要）", "cell_jp_sm"),
        ],
        [
            p_rich("<b>準2級プラス</b>", "cell_center"),
            p("B1（橋渡し帯）", "cell_center"),
            p_rich(f"<b>{p2p_d1['cleanRatePercent']}%</b>（全255問）", "cell_center"),
            p(f"{p2p_wb['totalEntries']}語", "cell_center"),
            p(f"{p2p_wb['trueLowRoiC1C2Count']}語を除外", "cell_center"),
            p("日常から社会テーマへの抽象動詞・接続表現（B1）を重点習得", "cell_jp_sm"),
        ],
        [
            p_rich("<b>英検準2級</b>", "cell_center"),
            p("A2〜B1前半", "cell_center"),
            p_rich(f"<b>{p2_d1['cleanRatePercent']}%</b>（全225問）", "cell_center"),
            p(f"{p2_wb['totalEntries']}語", "cell_center"),
            p(f"{p2_wb['trueLowRoiC1C2Count']}語を除外", "cell_center"),
            p("高校基礎A2〜B1語彙と会話・群動詞を100%固める土台フェーズ", "cell_jp_sm"),
        ],
    ]
    atbl = Table(audit_rows, colWidths=[68, 72, 92, 58, 70, CONTENT_W - 360], hAlign="LEFT")
    atbl.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), C_BG_HEAD),
                ("BACKGROUND", (0, 2), (-1, 2), C_BG_ZEBRA),
                ("GRID", (0, 0), (-1, -1), 0.5, C_BORDER),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ("LEFTPADDING", (0, 0), (-1, -1), 4.5),
                ("RIGHTPADDING", (0, 0), (-1, -1), 4.5),
                ("TOPPADDING", (0, 0), (-1, -1), 4.5),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 4.5),
            ]
        )
    )
    _, ah = atbl.wrap(CONTENT_W, H)
    atbl.drawOn(c, MARGIN_X, H - cur_top - ah)
    cur_top += ah + 14

    # Direct PDF Booklet Index for Instructors
    h_pdfs = draw_paragraph_box(
        c,
        "3. 講師用PDF教材棚からすぐ配布できる英検2級プリント一覧（ガチャ不要・直接DL対応）",
        [
            "【一次筆記 本番形式冊子（全15回×4分冊）】print_eiken_2_written_01 〜 15（問題冊子・A4横マーク＆英作文解答用紙・全肢解説・結合版）",
            "【リスニング予想問題・スクリプト冊子（全15回）】2級 第1部（会話15問）＋第2部（説明文15問）全30問×15回＝450問完備",
            "【副教材SRプリント（4冊）】重点語・例文ノート①（1〜30語）／重点語・例文ノート②（31〜60語）／大問1スピード演習（12問）／ライティング実戦ワーク／解法＆時間配分ガイド",
            "【すごろく専用週次テスト（別冊PDF）】『英検2級 必須語彙 週次小テスト＆解答（全12回・240語）』毎回20問・80%（16点）合格基準",
        ],
        MARGIN_X,
        cur_top,
        CONTENT_W,
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

    # Student info bar
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
    zebra_cmds = [
        ("BACKGROUND", (0, r), (-1, r), C_BG_ZEBRA)
        for r in range(2, 13, 2)
    ]
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

    c.setFont("SugorokuJP", 8.0)
    c.setFillColor(C_DARK)
    c.drawString(
        MARGIN_X,
        H - cur_top - 10,
        "※ 週次単語小テストが15点以下の場合は、該当20語をアプリの単語帳＆復習モードで再演習し、次回授業冒頭で再テストを実施します。",
    )

    c.showPage()
    c.save()
    return out_path


def build_weekly_vocab_tests_pdf(weekly_tests: list[dict[str, Any]]) -> Path:
    """
    Generates `sugoroku_eiken2_weekly_vocab_tests_12w.pdf` (26 crisp A4 B&W pages):
      - Page 1: Cover, Instructor Guide, & 12-Week Test Index / Score Sheet
      - Pages 2..13 (12 pages): Printable Weekly Quiz Sheets (Week 1 to Week 12, 1 A4 page per week, 20 questions each with context sentence)
      - Pages 14..25 (12 pages): Printable Answer Key & Full Example Translation Sheets (Week 1 to Week 12, 1 A4 page per week)
      - Page 26: Complete 240-Word Alphabetical Quick-Check Checklist (3-column compact master review list)
    """
    out_path = OUT_DIR / "sugoroku_eiken2_weekly_vocab_tests_12w.pdf"
    total_pages = 26
    c = canvas.Canvas(str(out_path), pagesize=A4, pageCompression=1, invariant=1)
    c.setTitle("すごろく塾専用・英検2級 必須語彙 週次確認小テスト＆解答解説（全12回・240語）")
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
    c.setFont("SugorokuJP", 14.0)
    c.drawString(MARGIN_X + 116, H - banner_top - 28, "英検2級 必須語彙 週次確認小テスト＆解答冊子")
    c.setFont("SugorokuJP", 7.7)
    c.drawString(
        MARGIN_X + 116,
        H - banner_top - 46,
        "CEFR B1〜B2前半／『パス単2級』コア帯厳密監査済（C1過難度語ゼロ・実戦例文つき）",
    )
    c.setFillColor(C_BG_SUB)
    c.rect(MARGIN_X + 116, H - banner_top - 69, CONTENT_W - 128, 17, stroke=0, fill=1)
    c.setFillColor(C_BLACK)
    c.setFont("SugorokuJP", 7.1)
    c.drawString(
        MARGIN_X + 122,
        H - banner_top - 63,
        "構成：問題シート p.2〜13（各A4・1枚完結）｜解答・和訳シート p.14〜25｜直前60選 p.26",
    )

    cur_top = banner_top + banner_h + 12
    h_guide = draw_paragraph_box(
        c,
        "個別指導での使い方（所要時間：授業冒頭5分 → 即時採点2分）",
        [
            "各回とも「英検2級でそのまま狙われる20語・熟語」を厳選。丸暗記ではなく文脈から意味を想起できるよう、全問に短い実戦例文を添えています。",
            "合格ラインは「20問中 16問以上正解（80%）」です。15点以下の場合は不合格とし、間違えた番号にチェックを入れて当週の復習宿題に再設定します。",
            "問題ページ（p.2〜p.13）と解答解説ページ（p.14〜p.25）を完全に分離しているため、講師は対象週の1ページだけをそのまま印刷・PDF画面共有して実施できます。",
        ],
        MARGIN_X,
        cur_top,
        CONTENT_W,
    )
    cur_top += h_guide + 12

    c.setFont("SugorokuJP", 9.8)
    c.drawString(MARGIN_X, H - cur_top - 10, "■ 全12回 出題テーマ・ページ索引・得点記録表")
    cur_top += 17

    idx_rows = [
        [
            p_rich("<b>回次</b>", "cell_head"),
            p_rich("<b>フェーズ</b>", "cell_head"),
            p_rich("<b>出題テーマ（各20問・合格基準16点）</b>", "cell_head"),
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
                p("　　 / 20", "cell_center"),
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
                ("TOPPADDING", (0, 0), (-1, -1), 4.2),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 4.2),
            ]
        )
    )
    _, idx_h = idx_tbl.wrap(CONTENT_W, H)
    idx_tbl.drawOn(c, MARGIN_X, H - cur_top - idx_h)
    c.showPage()

    # ---------------- PAGES 2..13: Weekly Test Sheets (1 page per week, 20 items) ----------------
    for wt in weekly_tests:
        wk = wt["week"]
        page_no = wk + 1
        draw_page_chrome(
            c,
            doc_title,
            f"問題シート｜Week {wk:02d}（制限時間 5分）",
            page_no,
            total_pages,
        )

        cur_top = 58
        # Compact Test Header Box
        hdr_rows = [
            [
                p_rich(
                    f"<b>第{wk:02d}回　2級必須語彙テスト</b>｜{escape(wt['theme'])}",
                    "cell_jp_sm",
                ),
                p_rich("<b>合格基準：16 / 20点（80%）</b>", "cell_center"),
            ],
            [
                p("実施日：202　年　　月　　日　｜　氏名：__________________________", "cell_jp_sm"),
                p("得点：　　　 / 20点（ □ 合格 ・ □ 再テスト ）", "cell_center"),
            ],
        ]
        htbl = Table(hdr_rows, colWidths=[CONTENT_W - 156, 156], hAlign="LEFT")
        htbl.setStyle(
            TableStyle(
                [
                    ("BACKGROUND", (0, 0), (-1, 0), C_BG_HEAD),
                    ("BOX", (0, 0), (-1, -1), 0.8, C_BLACK),
                    ("INNERGRID", (0, 0), (-1, -1), 0.45, C_BORDER),
                    ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                    ("LEFTPADDING", (0, 0), (-1, -1), 6),
                    ("RIGHTPADDING", (0, 0), (-1, -1), 6),
                    ("TOPPADDING", (0, 0), (-1, -1), 3.8),
                    ("BOTTOMPADDING", (0, 0), (-1, -1), 3.8),
                ]
            )
        )
        _, hh = htbl.wrap(CONTENT_W, H)
        htbl.drawOn(c, MARGIN_X, H - cur_top - hh)
        cur_top += hh + 5

        c.setFont("SugorokuJP", 7.8)
        c.setFillColor(C_DARK)
        c.drawString(
            MARGIN_X,
            H - cur_top - 8,
            "次の英語（単熟語）の日本語の意味を書きなさい。右側の英文ヒントも参考にして文脈に合う意味を答えること。",
        )
        cur_top += 13

        q_rows = [
            [
                p_rich("<b>No.</b>", "cell_head"),
                p_rich("<b>区分</b>", "cell_head"),
                p_rich("<b>英単語・熟語 / 文脈ヒント英文</b>", "cell_head"),
                p_rich("<b>日本語の意味（解答記入欄）</b>", "cell_head"),
                p_rich("<b>採点</b>", "cell_head"),
            ]
        ]
        for item in wt["items"]:
            ex_short = re.sub(r"\s+", " ", item["exampleSentence"].strip())
            if len(ex_short) > 62:
                ex_short = ex_short[:59].rstrip() + "..."
            word_and_hint = Paragraph(
                f"<font name='Times-Bold' size='9.2'>{escape(item['word'])}</font><br/>"
                f"<font name='Times-Roman' size='7.1' color='#444444'>{escape(ex_short)}</font>",
                STYLES["cell_jp_xs"],
            )
            q_rows.append(
                [
                    p_rich(f"<b>{item['no']:02d}</b>", "cell_center"),
                    p(item["tierLabel"], "cell_center"),
                    word_and_hint,
                    p("", "cell_jp"),
                    p("□", "cell_center"),
                ]
            )

        qtbl = Table(
            q_rows,
            colWidths=[26, 44, 246, 163, CONTENT_W - 479],
            hAlign="LEFT",
        )
        q_zebra = [("BACKGROUND", (0, r), (-1, r), C_BG_ZEBRA) for r in range(2, 21, 2)]
        qtbl.setStyle(
            TableStyle(
                [
                    ("BACKGROUND", (0, 0), (-1, 0), C_BG_HEAD),
                    *q_zebra,
                    ("GRID", (0, 0), (-1, -1), 0.45, C_BORDER),
                    ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                    ("LEFTPADDING", (0, 0), (-1, -1), 4),
                    ("RIGHTPADDING", (0, 0), (-1, -1), 4),
                    ("TOPPADDING", (0, 0), (-1, -1), 1.6),
                    ("BOTTOMPADDING", (0, 0), (-1, -1), 1.6),
                ]
            )
        )
        _, qh = qtbl.wrap(CONTENT_W, H)
        qtbl.drawOn(c, MARGIN_X, H - cur_top - qh)
        c.showPage()

    # ---------------- PAGES 14..25: Weekly Answer Key & Example Translation Sheets ----------------
    for wt in weekly_tests:
        wk = wt["week"]
        page_no = wk + 13
        draw_page_chrome(
            c,
            doc_title,
            f"解答・例文解説シート｜Week {wk:02d}",
            page_no,
            total_pages,
        )

        cur_top = 58
        ans_hdr = Table(
            [
                [
                    p_rich(
                        f"<b>第{wk:02d}回　解答・実戦例文チェックシート</b>（{escape(wt['theme'])}）",
                        "cell_jp",
                    ),
                    p(f"対応問題：p.{wk + 1}", "cell_center"),
                ]
            ],
            colWidths=[CONTENT_W - 86, 86],
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
                    ("TOPPADDING", (0, 0), (-1, -1), 4),
                    ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
                ]
            )
        )
        _, ahh = ans_hdr.wrap(CONTENT_W, H)
        ans_hdr.drawOn(c, MARGIN_X, H - cur_top - ahh)
        cur_top += ahh + 5

        c.setFont("SugorokuJP", 7.6)
        c.setFillColor(C_DARK)
        c.drawString(
            MARGIN_X,
            H - cur_top - 8,
            "※ 一字一句同じ訳語でなくても、中核となる意味が合っていれば正解（○）としてください。間違えた語は右欄の例文を3回音読しましょう。",
        )
        cur_top += 13

        a_rows = [
            [
                p_rich("<b>No.</b>", "cell_head"),
                p_rich("<b>英単語・熟語</b>", "cell_head"),
                p_rich("<b>標準解答（意味）</b>", "cell_head"),
                p_rich("<b>実戦例文・和訳（コロケーション確認用）</b>", "cell_head"),
            ]
        ]
        for item in wt["items"]:
            ex_en = re.sub(r"\s+", " ", item["exampleSentence"].strip())
            if len(ex_en) > 68:
                ex_en = ex_en[:65].rstrip() + "..."
            ex_ja = re.sub(r"\s+", " ", item["exampleTranslation"].strip())
            if len(ex_ja) > 36:
                ex_ja = ex_ja[:34].rstrip() + "…"

            word_cell = Paragraph(
                f"<font name='Times-Bold' size='8.8'>{escape(item['word'])}</font><br/>"
                f"<font name='SugorokuJP' size='6.5' color='#444444'>{escape(item['tierLabel'])} / {escape(item['cefr'])}</font>",
                STYLES["cell_jp_xs"],
            )
            ex_cell = Paragraph(
                f"<font name='Times-Roman' size='7.2'>{escape(ex_en)}</font><br/>"
                f"<font name='SugorokuJP' size='6.7' color='#444444'>{escape(ex_ja)}</font>",
                STYLES["cell_jp_xs"],
            )
            a_rows.append(
                [
                    p_rich(f"<b>{item['no']:02d}</b>", "cell_center"),
                    word_cell,
                    p(item["meaning"], "cell_jp_sm"),
                    ex_cell,
                ]
            )

        atbl = Table(
            a_rows,
            colWidths=[26, 98, 122, CONTENT_W - 246],
            hAlign="LEFT",
        )
        a_zebra = [("BACKGROUND", (0, r), (-1, r), C_BG_ZEBRA) for r in range(2, 21, 2)]
        atbl.setStyle(
            TableStyle(
                [
                    ("BACKGROUND", (0, 0), (-1, 0), C_BG_HEAD),
                    *a_zebra,
                    ("GRID", (0, 0), (-1, -1), 0.45, C_BORDER),
                    ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                    ("LEFTPADDING", (0, 0), (-1, -1), 4),
                    ("RIGHTPADDING", (0, 0), (-1, -1), 4),
                    ("TOPPADDING", (0, 0), (-1, -1), 1.5),
                    ("BOTTOMPADDING", (0, 0), (-1, -1), 1.5),
                ]
            )
        )
        _, ath = atbl.wrap(CONTENT_W, H)
        atbl.drawOn(c, MARGIN_X, H - cur_top - ath)
        c.showPage()

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
    c.setFont("SugorokuJP", 7.8)
    c.setFillColor(C_DARK)
    c.drawString(
        MARGIN_X,
        H - cur_top - 25,
        "全12回（240語）の中から、特に大問1・リスニング会話・要約パラフレーズで得点差に直結する熟語＆最頻出語60個を抜粋。",
    )
    cur_top += 32

    all_items = [
        {**it, "week": wt["week"]}
        for wt in weekly_tests
        for it in wt["items"]
    ]
    idioms_first = [x for x in all_items if x["tierLabel"] == "熟語"]
    verbs_next = [x for x in all_items if x["tierLabel"] != "熟語"]
    top60 = (idioms_first + verbs_next)[:60]

    # Split 60 items into 2 side-by-side columns of 30 rows
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
            f"□ <font name='Times-Bold' size='8.1'>{escape(l_it['word'])}</font> "
            f"<font name='SugorokuJP' size='6.5' color='#555555'>(W{l_it['week']})</font>",
            STYLES["cell_jp_sm"],
        )
        r_cell = Paragraph(
            f"□ <font name='Times-Bold' size='8.1'>{escape(r_it['word'])}</font> "
            f"<font name='SugorokuJP' size='6.5' color='#555555'>(W{r_it['week']})</font>",
            STYLES["cell_jp_sm"],
        )
        summary_rows.append(
            [
                l_cell,
                p(l_mean, "cell_jp_sm"),
                r_cell,
                p(r_mean, "cell_jp_sm"),
            ]
        )

    stbl = Table(
        summary_rows,
        colWidths=[136, 119.6, 136, CONTENT_W - 391.6],
        hAlign="LEFT",
    )
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
                ("TOPPADDING", (0, 0), (-1, -1), 2.4),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 2.4),
            ]
        )
    )
    _, sth = stbl.wrap(CONTENT_W, H)
    stbl.drawOn(c, MARGIN_X, H - cur_top - sth)

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
    weekly_tests = filter_data["grade2WeeklyVocabTests12Weeks"]

    # 1. Build 12-week curriculum route PDF (6 pages)
    route_pdf = build_curriculum_route_pdf(audit_report)
    route_validation = check_pdf_quality(route_pdf, expected_pages=6)

    # 2. Build 12-week weekly vocabulary test & answer PDF (26 pages)
    vocab_pdf = build_weekly_vocab_tests_pdf(weekly_tests)
    vocab_validation = check_pdf_quality(vocab_pdf, expected_pages=26)

    # 3. Export machine-readable 12-week curriculum manifest for AI 1 / AI 2 integration
    manifest_path = OUT_DIR / "curriculum_route_manifest.json"
    manifest_path.write_text(
        json.dumps(
            {
                "schemaVersion": "1.0.0",
                "presetId": "sugoroku_eiken2_12w_standard",
                "title": "英検2級 3か月（12週間）合格モデルカリキュラム（S-CBT併用標準ルート）",
                "targetGrade": "eiken_2",
                "bridgeGrade": "eiken_pre2plus",
                "totalWeeks": 12,
                "routePdf": "deliverables/sugoroku/sugoroku_eiken2_12week_curriculum_route.pdf",
                "weeklyVocabTestsPdf": "deliverables/sugoroku/sugoroku_eiken2_weekly_vocab_tests_12w.pdf",
                "weeks": CURRICULUM_12_WEEKS,
            },
            ensure_ascii=False,
            indent=2,
        )
        + "\n",
        encoding="utf-8",
    )

    # 4. Save PDF layout validation report
    validation_path = OUT_DIR / "pdf_layout_validation.json"
    validation_path.write_text(
        json.dumps(
            {
                "status": "PASS",
                "zeroOverlapVerified": True,
                "grayscalePrintReady": True,
                "documents": [route_validation, vocab_validation],
            },
            ensure_ascii=False,
            indent=2,
        )
        + "\n",
        encoding="utf-8",
    )

    print("=== Sugoroku 12-Week Curriculum & Weekly Test PDFs Built & Verified ===")
    print(
        f"  1) {route_pdf.name}: {route_validation['pages']} pages, {route_validation['sizeKB']} KB (overlaps=0)"
    )
    print(
        f"  2) {vocab_pdf.name}: {vocab_validation['pages']} pages, {vocab_validation['sizeKB']} KB (overlaps=0)"
    )
    print(f"  3) {manifest_path.name} & {validation_path.name} written.")


if __name__ == "__main__":
    main()
