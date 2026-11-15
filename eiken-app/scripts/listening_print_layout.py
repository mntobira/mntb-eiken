"""Authentic Eiken-style monochrome print layout engine for Listening & Unified Primary Exam booklets.
Mirrors the exact visual grammar of `written_print_layout.py` and `reading_print_layout.py`
and strictly follows `spec/build/spec_data.py` & `docs/WRITTEN_AUTHORING_GUIDE.md`:

1. Cover Page (`build_listening_cover_bytes` / `build_unified_primary_cover_bytes`):
   - Top-left official Manatobi brand logo (`public/brand/manatobi-logo-gray.png`, 98x31 pt)
   - Double horizontal rule, framed hero banner with solid black grade badge (`5級`..`1級` + `第N回`)
   - Structured `■ 出題構成・自己採点記録表` table (with part name, No. range, format/presentation, read count, question count, self-score)
   - `■ 演習・印刷の手引き` box, candidate name/date/score box, and explicit originality / non-affiliation notice (`過去問の流用禁止` / `origin: manatobi-original`)

2. Inner Listening Question Pages (`build_listening_questions_bytes`):
   - Authentic left vertical gray margin band (`BAND_X = 50, BAND_W = 38`, `#e4e4e4`)
   - Solid dark `#222222` section badge (`第1部`..`第4部` / `1`..`4` in `Times-BoldItalic`) + Japanese official-style part directions + rule
   - Official Eiken per-part presentation rules (NO spoken question stems printed on booklet except Real-Life `Question:`):
     * Illustration + 3-choice read-aloud parts (5級 第1部・第3部, 4級 第1部, 3級 第1部):
       2-column framed grid (`No. 1`..`No. 10` / `No. 16`..`No. 25`) with monochrome line-art illustration and NO choice text printed
     * Textless 3-choice read-aloud part (準2級 第1部):
       2-column clean `No. 1`..`No. 10` listening memo slots (`1      2      3` spoken-only indicator, zero English text printed)
     * Printed 4-choice single-question parts (5級 第2部, 4級 第2・3部, 3級 第2・3部, 準2級 第2・3部, 準2級プラス 第1・2部, 2級 第1・2部, 準1級 第1部, 1級 第1部):
       `No. X` in left margin band + `1  ...  2  ...  3  ...  4  ...` (2-column when short, 1-column when longer) + dotted horizontal rules
     * Printed 4-choice 2-question passage/interview parts (準1級 第2部 `(A)`..`(F)`, 1級 第2部 `(A)`..`(E)`, 1級 第4部):
       Grouped block with `(A)` sub-label, `No. X` and `No. Y` printed 4 choices, separated cleanly per passage
     * Real-Life parts (準1級 第3部 `(G)`..`(K)`, 1級 第3部 `(F)`..`(J)`):
       Framed Real-Life situation/schedule/tariff box (`Situation:` + crisp monochrome table + notes + `☆ Question:`) + printed `1`..`4` choices

3. Listening Mark Sheet (`build_listening_mark_sheet_bytes`):
   - Landscape A4 matching `written_print_layout._build_mark_sheet_page`:
     solid black grade badge, left candidate/part-score box, right oval mark columns (`1 2 3` for 3-choice parts, `1 2 3 4` for 4-choice parts), zebra stripes, 5-question heavy dividers, zero line overlaps.

4. Listening Script & Answer/Explanation Pages (`build_listening_explanations_bytes`):
   - Matching `build-written-pdfs.py` monochrome explanation booklet:
     5-column Answer Key & Review Checklist table (`□ No.01：正答 X`), followed by per-unit header bar, full English audio script (`M1` / `F1` / `M2` / `F2`), natural Japanese translation (`【和訳】`), evidence & explanation (`【根拠・解き方】`), and per-choice rationale (`★` / `　`).
"""
from __future__ import annotations

from html import escape
from pathlib import Path
import io
import re
import pymupdf
from PIL import Image as PILImage
from reportlab import rl_config
rl_config.invariant = True
from reportlab.pdfgen import canvas
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4, landscape
from reportlab.lib.styles import ParagraphStyle
from reportlab.platypus import (
    SimpleDocTemplate,
    Paragraph,
    Spacer,
    Table,
    TableStyle,
    PageBreak,
    KeepTogether,
)
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont

ROOT = Path(__file__).resolve().parents[1]
PUBLIC = ROOT / 'public'
LOGO_PATH = PUBLIC / 'brand/manatobi-logo-gray.png'
FONT_PATH = PUBLIC / 'fonts/booklet-noto-serif-jp.ttf'

if 'BookletJP' not in pdfmetrics.getRegisteredFontNames():
    pdfmetrics.registerFont(TTFont('BookletJP', str(FONT_PATH)))

W, H = A4
BAND_X = 50
BAND_W = 38
X = 102
RIGHT = 543
BW = RIGHT - X

GRADE_META = {
    'eiken_5': ('英検5級', '5級', 'Grade 5'),
    'eiken_4': ('英検4級', '4級', 'Grade 4'),
    'eiken_3': ('英検3級', '3級', 'Grade 3'),
    'eiken_pre2': ('英検準2級', '準2級', 'Grade Pre-2'),
    'eiken_pre2plus': ('英検準2級プラス', '準2級+', 'Grade Pre-2 Plus'),
    'eiken_2': ('英検2級', '2級', 'Grade 2'),
    'eiken_pre1': ('英検準1級', '準1級', 'Grade Pre-1'),
    'eiken_1': ('英検1級', '1級', 'Grade 1'),
}

WRITTEN_SECTION_NAMES = {
    'short': '短文の語句空所補充',
    'conversation': '会話文の空所補充',
    'reorder': '日本文付き語句整序',
    'cloze': '長文の語句空所補充',
    'reading': '長文の内容一致選択',
    'email': 'ライティング（Eメール）',
    'summary': 'ライティング（英文要約）',
    'essay': 'ライティング（英作文）',
}

EN_CHOICE = ParagraphStyle('listen-en', fontName='Times-Roman', fontSize=10.8, leading=15.0)
EN_CHOICE_COMPACT = ParagraphStyle('listen-en-compact', fontName='Times-Roman', fontSize=10.0, leading=13.8)
EN_MAT_BODY = ParagraphStyle('listen-mat-en', fontName='Times-Roman', fontSize=9.6, leading=13.2)
EN_MAT_BOLD = ParagraphStyle('listen-mat-bold', fontName='Times-Bold', fontSize=9.8, leading=13.4)
EN_MAT_CELL = ParagraphStyle('listen-mat-cell', fontName='Times-Roman', fontSize=8.8, leading=11.8)
EN_MAT_HDR = ParagraphStyle('listen-mat-hdr', fontName='Times-Bold', fontSize=8.8, leading=11.8)
JP_INST = ParagraphStyle('listen-inst-jp', fontName='BookletJP', fontSize=9.4, leading=14.6, wordWrap='CJK')
JP_SMALL = ParagraphStyle('listen-small-jp', fontName='BookletJP', fontSize=8.3, leading=13.0, wordWrap='CJK')
COVER_JP = ParagraphStyle('listen-cover-jp', fontName='BookletJP', fontSize=9.0, leading=14.4, wordWrap='CJK')
COVER_SMALL = ParagraphStyle('listen-cover-small', fontName='BookletJP', fontSize=7.9, leading=12.2, wordWrap='CJK')

EXP_STYLES = {
    'title': ParagraphStyle('exp_title', fontName='BookletJP', fontSize=16.5, leading=24, spaceAfter=6),
    'heading': ParagraphStyle('exp_heading', fontName='BookletJP', fontSize=11.5, leading=17.5, spaceAfter=5, wordWrap='CJK'),
    'band_left': ParagraphStyle('exp_band_left', fontName='BookletJP', fontSize=10.0, leading=14.5, wordWrap='CJK'),
    'band_right': ParagraphStyle('exp_band_right', fontName='BookletJP', fontSize=10.0, leading=14.5, alignment=2, wordWrap='CJK'),
    'jp': ParagraphStyle('exp_jp', fontName='BookletJP', fontSize=9.4, leading=14.8, spaceAfter=3.5, wordWrap='CJK'),
    'note': ParagraphStyle('exp_note', fontName='BookletJP', fontSize=8.5, leading=13.2, spaceAfter=2.5, wordWrap='CJK'),
    'cell': ParagraphStyle('exp_cell', fontName='BookletJP', fontSize=8.9, leading=13.0, wordWrap='CJK'),
    'en_script': ParagraphStyle('exp_en_script', fontName='Times-Roman', fontSize=10.2, leading=14.8, spaceAfter=4),
}


def _line(c: canvas.Canvas, text: str, x: float, top: float, font: str = 'Times-Roman', size: float = 11.0):
    c.setFont(font, size)
    c.drawString(x, H - top - size * 0.82, text)


def _para(text: str, style: ParagraphStyle) -> Paragraph:
    safe = escape(str(text)).replace('\n', '<br/>')
    safe = re.sub(
        r'(^|<br/>)(Man|Woman|Narrator|Interviewer|Guest|M1|M2|F1|F2):',
        r'\1<b>\2:</b>',
        safe,
    )
    return Paragraph(safe, style)


def _p_height(text: str, width: float, style: ParagraphStyle) -> float:
    return _para(text, style).wrap(width, H)[1]


def _draw_para(c: canvas.Canvas, text: str, x: float, top: float, width: float, style: ParagraphStyle, max_h: float | None = None) -> float:
    p = _para(text, style)
    _, ph = p.wrap(width, H)
    if max_h is not None and ph > max_h + 1.0:
        raise ValueError(f'Paragraph overflow ({ph:.1f} > {max_h:.1f}): {text[:80]}')
    if top + ph > H - 40:
        raise ValueError(f'Page bottom overflow ({top + ph:.1f} > {H - 40:.1f}): {text[:80]}')
    p.drawOn(c, x, H - top - ph)
    return ph


def _draw_dotted_rule(c: canvas.Canvas, x1: float, x2: float, top: float):
    c.saveState()
    c.setStrokeColor(colors.HexColor('#888888'))
    c.setDash(1.2, 2.2)
    c.setLineWidth(0.45)
    c.line(x1, H - top, x2, H - top)
    c.restoreState()


def part_instruction_ja(grade: str, part_spec: dict, first_no: int, last_no: int, read_count: int) -> str:
    pid = part_spec['id']
    pres = part_spec['choicePresentation']
    q_per_audio = part_spec['questionsPerAudio']
    read_str = '2回ずつ' if read_count == 2 else '1回だけ'

    if pres == 'read-aloud':
        if grade == 'eiken_5' and pid == 'part3':
            return (
                f'これから（No. {first_no}）〜（No. {last_no}）について、イラストの内容を表す英文が1から3まで3つ読まれます。'
                f'イラストに最もよく合うものを一つ選び、その番号のマーク欄をぬりつぶしなさい。英文は{read_str}読まれます。'
            )
        has_img = grade in ('eiken_5', 'eiken_4', 'eiken_3')
        prefix = 'イラストを参考にしながら対話を聞き、' if has_img else '対話を聞き、'
        return (
            f'{prefix}その最後の発話に対する応答として最も適切なものを、放送される1, 2, 3の中から一つ選び、'
            f'その番号のマーク欄をぬりつぶしなさい。（No. {first_no}）〜（No. {last_no}）の放送は{read_str}読まれます。'
        )

    if 'Real-Life' in part_spec['label']:
        return (
            f'（No. {first_no}）〜（No. {last_no}）では、まず問題冊子に印刷された状況（Situation）と質問（Question）を読み、'
            f'それから音声を聞いて、1, 2, 3, 4の中から最も適切なものを一つ選びなさい。放送は{read_str}読まれます。'
        )

    if 'インタビュー' in part_spec['label']:
        return (
            f'これからインタビューが放送されます。その内容について（No. {first_no}）と（No. {last_no}）の質問に最も適切なものを'
            f'1, 2, 3, 4の中からそれぞれ一つ選びなさい。放送は{read_str}読まれます。'
        )

    if q_per_audio == 2:
        return (
            f'これからいくつかの英文が放送されます。それぞれの英文について2つずつ質問があります。（No. {first_no}）〜（No. {last_no}）の'
            f'質問に対する答えとして最も適切なものを1, 2, 3, 4の中から一つ選びなさい。放送は{read_str}読まれます。'
        )

    if '会話' in part_spec['label']:
        return (
            f'対話とそれに続く質問を聞き、（No. {first_no}）〜（No. {last_no}）の答えとして最も適切なものを1, 2, 3, 4の中から'
            f'一つ選び、その番号のマーク欄をぬりつぶしなさい。放送は{read_str}読まれます。'
        )

    return (
        f'英文とそれに続く質問を聞き、（No. {first_no}）〜（No. {last_no}）の答えとして最も適切なものを1, 2, 3, 4の中から'
        f'一つ選び、その番号のマーク欄をぬりつぶしなさい。放送は{read_str}読まれます。'
    )


def check_no_line_overlaps(pdf_page, page_label: str):
    """Ensure zero unintentional bounding-box collisions between distinct text lines."""
    lines = []
    for block in pdf_page.get_text('dict')['blocks']:
        for ln in block.get('lines', []):
            txt = ''.join(sp['text'] for sp in ln['spans']).strip()
            if not txt:
                continue
            x0, y0, x1, y1 = ln['bbox']
            lines.append((x0, y0, x1, y1, txt))
    for i in range(len(lines)):
        ax0, ay0, ax1, ay1, atxt = lines[i]
        for j in range(i + 1, len(lines)):
            bx0, by0, bx1, by1, btxt = lines[j]
            ix = min(ax1, bx1) - max(ax0, bx0)
            iy = min(ay1, by1) - max(ay0, by0)
            if ix > 3.0 and iy > 3.5:
                raise ValueError(f'Overlapping text on {page_label}: "{atxt}" vs "{btxt}"')


# ==============================================================================
# 1. AUTHENTIC EIKEN COVER PAGES (Listening Single-Round / 15-Round / Unified Primary)
# ==============================================================================

def build_listening_cover_bytes(
    grade: str,
    bp: dict,
    round_no: int | None = None,
    theme: str | None = None,
    revision: str = 'manatobi-original-v1',
    is_15round_master: bool = False,
) -> bytes:
    """Crisp B&W Eiken examination booklet cover matching `written_print_layout.build_cover_pdf`."""
    if not LOGO_PATH.exists():
        raise FileNotFoundError(f'Mandatory Manatobi logo missing: {LOGO_PATH}')
    buf = io.BytesIO()
    c = canvas.Canvas(buf, pagesize=A4, pageCompression=1, invariant=1)
    full_label, badge_label, _ = GRADE_META[grade]
    total_q = bp['totalQuestions']
    minutes = bp['minutes']

    # Top brand header with Manatobi logo
    c.drawImage(str(LOGO_PATH), 52, H - 64, width=98, height=31, mask='auto', preserveAspectRatio=True)
    c.setStrokeColor(colors.black)
    c.setFillColor(colors.black)
    _line(c, f'{full_label}形式　予想演習プリント', 160, 35, 'BookletJP', 9.2)
    c.setFont('BookletJP', 8.8)
    right_tag = '全15回収録　リスニング冊子' if is_15round_master else f'第{round_no}回　リスニング問題冊子'
    c.drawRightString(W - 54, H - 56, right_tag)
    c.setLineWidth(1.2)
    c.line(52, H - 72, W - 52, H - 72)
    c.setLineWidth(0.4)
    c.line(52, H - 75, W - 52, H - 75)

    # Hero banner frame
    banner_top = 90
    banner_h = 108
    c.setLineWidth(1.1)
    c.rect(52, H - banner_top - banner_h, W - 104, banner_h, stroke=1, fill=0)
    c.setFillColor(colors.black)
    c.rect(64, H - banner_top - banner_h + 14, 96, banner_h - 28, stroke=0, fill=1)
    c.setFillColor(colors.white)
    badge_size = 19 if len(badge_label) >= 4 else 24
    c.setFont('BookletJP', badge_size)
    c.drawCentredString(112, H - banner_top - 50, badge_label)
    c.setFont('BookletJP', 9.0)
    sub_badge = '全15回' if is_15round_master else f'第{round_no}回'
    c.drawCentredString(112, H - banner_top - 76, sub_badge)
    c.setFillColor(colors.black)

    _line(c, f'{full_label}形式', 176, banner_top + 13, 'BookletJP', 12.8)
    main_title = 'リスニングテスト（全15回 問題・解答解説）' if is_15round_master else '一次試験（リスニングテスト）'
    _line(c, main_title, 176, banner_top + 35, 'BookletJP', 16.5 if is_15round_master else 18.0)

    c.setFillColor(colors.HexColor('#f2f2f2'))
    c.rect(176, H - banner_top - banner_h + 14, W - 240, 27, stroke=0, fill=1)
    c.setFillColor(colors.black)
    if is_15round_master:
        summary_bar = f'全15回（計{total_q * 15}問）　｜　1回 {total_q}問・目安 約{minutes}分　｜　マークシート・台本解説付'
    else:
        theme_part = f'　｜　題材：{theme}' if theme else ''
        summary_bar = f'第{round_no}回　｜　放送目安：約{minutes}分　｜　全{total_q}問{theme_part}'
    _line(c, summary_bar, 184, banner_top + 74, 'BookletJP', 8.7)

    # Section breakdown & self-scoring table
    tbl_top = 214
    _line(c, '■ リスニング出題構成・自己採点記録表', 54, tbl_top, 'BookletJP', 10.8)
    row_top = tbl_top + 19
    col_x = [52, 96, 174, 366, 422, 468, W - 52]
    headers = ['部', '問題番号', '出題形式・選択肢提示', '放送回数', '設問数', '自己採点']
    header_h = 22
    c.setFillColor(colors.HexColor('#eaeaea'))
    c.rect(col_x[0], H - row_top - header_h, col_x[-1] - col_x[0], header_h, stroke=0, fill=1)
    c.setFillColor(colors.black)
    c.setLineWidth(0.7)
    c.rect(col_x[0], H - row_top - header_h, col_x[-1] - col_x[0], header_h, stroke=1, fill=0)
    for idx, htext in enumerate(headers):
        c.setFont('BookletJP', 8.5)
        c.drawCentredString((col_x[idx] + col_x[idx + 1]) / 2, H - row_top - 15, htext)
    for x in col_x[1:-1]:
        c.setLineWidth(0.4)
        c.line(x, H - row_top, x, H - row_top - header_h)

    cur_y = row_top + header_h
    row_h = 24
    q_cursor = 1
    for p_idx, pspec in enumerate(bp['parts'], 1):
        if p_idx % 2 == 0:
            c.setFillColor(colors.HexColor('#fafafa'))
            c.rect(col_x[0], H - cur_y - row_h, col_x[-1] - col_x[0], row_h, stroke=0, fill=1)
            c.setFillColor(colors.black)
        c.setLineWidth(0.45)
        c.rect(col_x[0], H - cur_y - row_h, col_x[-1] - col_x[0], row_h, stroke=1, fill=0)
        for x in col_x[1:-1]:
            c.line(x, H - cur_y, x, H - cur_y - row_h)

        q_cnt = pspec['questionCount']
        q_start = q_cursor
        q_end = q_cursor + q_cnt - 1
        q_cursor = q_end + 1
        pres_jp = '3肢・音声読上' if pspec['choicePresentation'] == 'read-aloud' else '4肢・紙面印刷'
        clean_name = re.sub(r'^第\d+部\s*', '', pspec['label'])
        rc_str = f'{pspec["readCount"]}回'

        c.setFont('BookletJP', 9.2)
        c.drawCentredString((col_x[0] + col_x[1]) / 2, H - cur_y - 16, f'第{p_idx}部')
        c.setFont('Times-Roman', 9.4)
        c.drawCentredString((col_x[1] + col_x[2]) / 2, H - cur_y - 16, f'No. {q_start}-{q_end}')
        _line(c, f'{clean_name}（{pres_jp}）', col_x[2] + 7, cur_y + 6, 'BookletJP', 8.8)
        c.setFont('BookletJP', 9.0)
        c.drawCentredString((col_x[3] + col_x[4]) / 2, H - cur_y - 16, rc_str)
        c.drawCentredString((col_x[4] + col_x[5]) / 2, H - cur_y - 16, f'{q_cnt}問')
        c.drawCentredString((col_x[5] + col_x[6]) / 2, H - cur_y - 16, f'    ／ {q_cnt}')
        cur_y += row_h

    #注意事項 / 手引き box
    guide_top = cur_y + 18
    _line(c, '■ リスニング受験・印刷上の注意', 54, guide_top, 'BookletJP', 10.8)
    box_top = guide_top + 18
    if is_15round_master:
        guide_lines = '\n'.join([
            '1. 本冊子は実際の英検問題冊子の紙面構成に準拠した白黒印刷用フォーマット（A4原寸100%推奨）です。',
            '2. 各回は「問題ページ（本番同様に設問音声や読み上げ3肢の英文は非表示）」→「解答マークシート」→「正答・放送原稿・全肢解説」の順に収録しています。',
            '3. 音声はWebアプリの「通し模試 ＞ リスニング模試」または「分野別練習」で第1回〜第15回を選択して再生できます。',
            '4. ElevenLabs音声プロンプト集PDFおよびChatGPT画像プロンプト集PDFは、制作工程の混同防止のため別冊ファイルに分離しています。',
        ])
    else:
        guide_lines = '\n'.join([
            '1. 問題冊子には正答・放送原稿・解説を載せていません。別のマークシート（A4横）に1つだけ濃くぬりつぶしてください。',
            '2. 本番同様、読み上げ形式の部では選択肢の英文は印刷されていません。また印刷選択肢の部でも質問文（Question）は音声のみで流れます。',
            '3. 印刷時は「白黒・実際のサイズ（100%）」を選び、解き終わるまでは「解答・解説」を開かないでください。',
            '4. 音声はマナトビ英検アプリの「通し模試（リスニング）」で該当級・回を選んで再生できます。',
        ])
    box_h = 122
    c.setLineWidth(0.6)
    c.rect(52, H - box_top - box_h, W - 104, box_h, stroke=1, fill=0)
    _draw_para(c, guide_lines, 64, box_top + 8, W - 128, COVER_JP, box_h - 12)

    # Candidate & score box
    rec_top = box_top + box_h + 14
    rec_h = 62
    c.setFillColor(colors.HexColor('#f8f8f8'))
    c.rect(52, H - rec_top - rec_h, W - 104, rec_h, stroke=1, fill=1)
    c.setFillColor(colors.black)
    _line(c, '実施日：　　　　年　　月　　日', 66, rec_top + 10, 'BookletJP', 9.8)
    _line(c, f'放送目安時間：約 {minutes} 分', 310, rec_top + 10, 'BookletJP', 9.8)
    _line(c, '氏名：______________________________', 66, rec_top + 36, 'BookletJP', 9.8)
    score_str = f'第1回〜第15回 記録用（1回 {total_q} 点）' if is_15round_master else f'リスニング 合計：　　　／ {total_q} 点'
    _line(c, score_str, 310, rec_top + 36, 'BookletJP', 10.0)

    # Provenance & non-affiliation notice (MUST contain 過去問の流用禁止)
    disc_top = rec_top + rec_h + 10
    disclaimer = (
        f'※【重要規定｜過去問の流用禁止】本冊子の収録問題・放送台本・選択肢・図版・解説はすべてマナトビが独自に執筆・制作した'
        f'{full_label}形式の完全オリジナル教材（origin: manatobi-original）です。英検の過去問や市販教材の転載・改変・固有名詞置換等の流用は一切行っていません（過去問の流用禁止）。'
        f'日本英語検定協会の公式問題・公式音源ではなく、CSEスコア算出や合否判定は行いません。'
    )
    _draw_para(c, disclaimer, 54, disc_top, W - 108, COVER_SMALL, 66)

    # Footer
    c.setLineWidth(0.4)
    c.line(52, 40, W - 52, 40)
    c.setFont('BookletJP', 7.8)
    c.drawString(54, 26, f'マナトビ独自教材（過去問の流用禁止・公式問題ではありません）｜{revision}')
    c.drawRightString(W - 54, 26, '表紙 1')
    c.showPage()
    c.save()
    return buf.getvalue()


def build_unified_primary_cover_bytes(
    grade: str,
    rnd: int,
    w_exam: dict,
    w_bp: dict,
    l_exam: dict,
    l_bp: dict,
) -> bytes:
    """Authentic Eiken B&W Primary Exam cover combining Written (Reading + Writing) and Listening."""
    if not LOGO_PATH.exists():
        raise FileNotFoundError(f'Mandatory Manatobi logo missing: {LOGO_PATH}')
    buf = io.BytesIO()
    c = canvas.Canvas(buf, pagesize=A4, pageCompression=1, invariant=1)
    full_label, badge_label, _ = GRADE_META[grade]

    w_choices = [q for q in w_exam['items'] if q['kind'] == 'choice']
    w_writings = [q for q in w_exam['items'] if q['kind'] == 'writing']
    has_writing = len(w_writings) > 0
    l_total = sum(len(u['questions']) for u in l_exam['units'])
    w_min = w_bp['minutes']
    l_min = l_bp['minutes']

    # Top header with logo
    c.drawImage(str(LOGO_PATH), 52, H - 64, width=98, height=31, mask='auto', preserveAspectRatio=True)
    c.setStrokeColor(colors.black)
    c.setFillColor(colors.black)
    _line(c, f'{full_label}形式　一次試験 予想演習プリント', 160, 35, 'BookletJP', 9.2)
    c.setFont('BookletJP', 8.8)
    c.drawRightString(W - 54, H - 56, f'第{rnd}回　一次試験 問題冊子')
    c.setLineWidth(1.2)
    c.line(52, H - 72, W - 52, H - 72)
    c.setLineWidth(0.4)
    c.line(52, H - 75, W - 52, H - 75)

    # Hero banner
    banner_top = 88
    banner_h = 104
    c.setLineWidth(1.1)
    c.rect(52, H - banner_top - banner_h, W - 104, banner_h, stroke=1, fill=0)
    c.setFillColor(colors.black)
    c.rect(64, H - banner_top - banner_h + 13, 96, banner_h - 26, stroke=0, fill=1)
    c.setFillColor(colors.white)
    c.setFont('BookletJP', 19 if len(badge_label) >= 4 else 24)
    c.drawCentredString(112, H - banner_top - 48, badge_label)
    c.setFont('BookletJP', 9.0)
    c.drawCentredString(112, H - banner_top - 74, f'第{rnd}回')
    c.setFillColor(colors.black)

    _line(c, f'{full_label}形式　一次試験（フルセット）', 176, banner_top + 12, 'BookletJP', 12.2)
    mode_str = '筆記（リーディング・ライティング）＋ リスニング' if has_writing else '筆記（リーディング）＋ リスニング'
    _line(c, mode_str, 176, banner_top + 34, 'BookletJP', 14.5)

    c.setFillColor(colors.HexColor('#f2f2f2'))
    c.rect(176, H - banner_top - banner_h + 13, W - 240, 26, stroke=0, fill=1)
    c.setFillColor(colors.black)
    w_cnt_str = f'筆記選択{len(w_choices)}問' + (f'＋英作文{len(w_writings)}題' if has_writing else '')
    _line(c, f'筆記目安 {w_min}分（{w_cnt_str}） ＋ リスニング約{l_min}分（{l_total}問）', 184, banner_top + 71, 'BookletJP', 8.7)

    # Combined Breakdown Table
    tbl_top = 206
    _line(c, '■ 一次試験 出題構成・自己採点記録表', 54, tbl_top, 'BookletJP', 10.6)
    row_top = tbl_top + 18
    col_x = [52, 114, 192, 412, 462, W - 52]
    headers = ['区分・大問', '問題番号', '出題形式・内容', '設問数', '自己採点']
    header_h = 20
    c.setFillColor(colors.HexColor('#eaeaea'))
    c.rect(col_x[0], H - row_top - header_h, col_x[-1] - col_x[0], header_h, stroke=0, fill=1)
    c.setFillColor(colors.black)
    c.setLineWidth(0.7)
    c.rect(col_x[0], H - row_top - header_h, col_x[-1] - col_x[0], header_h, stroke=1, fill=0)
    for idx, htext in enumerate(headers):
        c.setFont('BookletJP', 8.3)
        c.drawCentredString((col_x[idx] + col_x[idx + 1]) / 2, H - row_top - 14, htext)
    for x in col_x[1:-1]:
        c.setLineWidth(0.4)
        c.line(x, H - row_top, x, H - row_top - header_h)

    rows_data = []
    for sec_no, spec in enumerate(w_bp['sections'], 1):
        if spec['kind'] == 'choice':
            nums = [i + 1 for i, q in enumerate(w_choices) if q['section'] == spec['id']]
            rows_data.append((
                f'筆記 大問{sec_no}',
                f'({nums[0]})〜({nums[-1]})',
                WRITTEN_SECTION_NAMES[spec['id']],
                f'{len(nums)}問',
                f'    ／ {len(nums)}',
            ))
        else:
            w_item = [q for q in w_writings if q['section'] == spec['id']][0]
            wmin, wmax = w_item['wordRange']
            rows_data.append((
                f'筆記 大問{sec_no}',
                f'大問 {sec_no}',
                f'{WRITTEN_SECTION_NAMES[spec["id"]]}（{wmin}〜{wmax}語）',
                '1題',
                '□ 点検済',
            ))

    q_cur = 1
    for p_idx, pspec in enumerate(l_bp['parts'], 1):
        q_cnt = pspec['questionCount']
        q_s, q_e = q_cur, q_cur + q_cnt - 1
        q_cur = q_e + 1
        pres_jp = '3肢読上' if pspec['choicePresentation'] == 'read-aloud' else '4肢印刷'
        clean_name = re.sub(r'^第\d+部\s*', '', pspec['label'])
        rows_data.append((
            f'リス第{p_idx}部',
            f'No.{q_s}〜{q_e}',
            f'{clean_name}（{pres_jp}・{pspec["readCount"]}回読）',
            f'{q_cnt}問',
            f'    ／ {q_cnt}',
        ))

    row_h = 20.5 if len(rows_data) <= 8 else 18.5
    cur_y = row_top + header_h
    for r_idx, (c0, c1, c2, c3, c4) in enumerate(rows_data):
        if r_idx % 2 == 1:
            c.setFillColor(colors.HexColor('#fafafa'))
            c.rect(col_x[0], H - cur_y - row_h, col_x[-1] - col_x[0], row_h, stroke=0, fill=1)
            c.setFillColor(colors.black)
        c.setLineWidth(0.42)
        c.rect(col_x[0], H - cur_y - row_h, col_x[-1] - col_x[0], row_h, stroke=1, fill=0)
        for x in col_x[1:-1]:
            c.line(x, H - cur_y, x, H - cur_y - row_h)
        ty = H - cur_y - row_h * 0.68
        c.setFont('BookletJP', 8.4)
        c.drawCentredString((col_x[0] + col_x[1]) / 2, ty, c0)
        c.drawCentredString((col_x[1] + col_x[2]) / 2, ty, c1)
        c.drawString(col_x[2] + 6, ty, c2)
        c.drawCentredString((col_x[3] + col_x[4]) / 2, ty, c3)
        c.drawCentredString((col_x[4] + col_x[5]) / 2, ty, c4)
        cur_y += row_h

    # Instructions
    guide_top = cur_y + 14
    _line(c, '■ 一次試験 受験・印刷の手引き', 54, guide_top, 'BookletJP', 10.4)
    box_top = guide_top + 16
    guide_lines = '\n'.join([
        f'1. 前半に「一次筆記（{w_min}分）」、続けて後半に「リスニングテスト（約{l_min}分）」の問題冊子を収録しています。',
        '2. 解答用紙（A4横）には、筆記マーク欄・ライティング解答欄（3級〜準1級）とリスニング専用マークシートが付属します。',
        '3. 印刷時は「白黒・実際のサイズ（100%）」を選び、すべて解き終えてから解答・放送原稿・解説冊子を確認してください。',
    ])
    box_h = 92
    c.setLineWidth(0.6)
    c.rect(52, H - box_top - box_h, W - 104, box_h, stroke=1, fill=0)
    _draw_para(c, guide_lines, 64, box_top + 7, W - 128, COVER_JP, box_h - 10)

    # Candidate box
    rec_top = box_top + box_h + 11
    rec_h = 54
    c.setFillColor(colors.HexColor('#f8f8f8'))
    c.rect(52, H - rec_top - rec_h, W - 104, rec_h, stroke=1, fill=1)
    c.setFillColor(colors.black)
    _line(c, '実施日：　　　年　　月　　日　　氏名：___________________________', 64, rec_top + 8, 'BookletJP', 9.3)
    _line(c, f'筆記選択：　　／ {len(w_choices)} 点　　リスニング：　　／ {l_total} 点', 64, rec_top + 31, 'BookletJP', 9.5)

    # Provenance notice
    disc_top = rec_top + rec_h + 8
    disclaimer = (
        f'※【重要規定｜過去問の流用禁止】本冊子はマナトビが独自に執筆・制作した{full_label}形式（第{rnd}回）の完全オリジナル一次試験教材'
        f'（origin: manatobi-original）です。英検過去問および市販問題集の転載・改変・固有名詞や数値置換による流用は一切行っていません（過去問の流用禁止）。'
        f'公式問題・公式音源ではなく、CSEスコア算出や合否判定は行いません。'
    )
    _draw_para(c, disclaimer, 54, disc_top, W - 108, COVER_SMALL, 62)

    c.setLineWidth(0.4)
    c.line(52, 38, W - 52, 38)
    c.setFont('BookletJP', 7.8)
    c.drawString(54, 24, f'マナトビ独自教材（過去問の流用禁止・公式問題ではありません）｜{w_exam["revision"]}')
    c.drawRightString(W - 54, 24, '問題 1')
    c.showPage()
    c.save()
    return buf.getvalue()


# ==============================================================================
# 2. AUTHENTIC EIKEN INNER LISTENING QUESTION PAGES
# ==============================================================================

def _listening_frame(c: canvas.Canvas, grade: str, rnd: int, page_no: int, revision: str = 'manatobi-original'):
    """Left gray vertical margin band + top/bottom hairline rules matching official Eiken & reading_print_layout."""
    full_label, _, en_grade = GRADE_META[grade]
    c.setFillColor(colors.HexColor('#e4e4e4'))
    c.rect(BAND_X, 34, BAND_W, H - 68, stroke=0, fill=1)
    c.setFillColor(colors.black)
    c.setStrokeColor(colors.black)
    c.setLineWidth(0.4)
    _line(c, en_grade, 52, 39, 'Times-Bold', 7.6)
    c.setFont('BookletJP', 8.0)
    c.drawRightString(RIGHT, H - 46, f'マナトビ｜{full_label}形式 第{rnd}回 リスニングテスト')
    c.line(BAND_X, 34, RIGHT, 34)
    c.line(BAND_X, H - 34, RIGHT, H - 34)
    c.setFont('BookletJP', 7.0)
    c.drawString(94, 20, '独自教材（過去問流用禁止・公式問題ではありません）')
    c.setFont('Times-Roman', 9.0)
    c.drawCentredString(W / 2 + 22, 20, f'— {page_no} —')
    c.setFont('Times-Roman', 6.8)
    c.drawRightString(RIGHT, 20, revision)


def _listening_part_heading(c: canvas.Canvas, part_idx: int, part_title: str, inst_text: str, top: float = 52) -> float:
    """Dark `#222222` badge in left band + bold part title + Japanese directions + horizontal rule."""
    clean_title = re.sub(r'^第\d+部\s*', '', part_title)
    header_line = f'リスニングテスト 第{part_idx}部（{clean_title}）'
    inst_h = _p_height(inst_text, BW - 4, JP_INST)
    h_box = max(50, 19 + inst_h + 10)

    badge_h = 34
    c.setFillColor(colors.HexColor('#222222'))
    c.rect(46, H - top - badge_h - 2, 42, badge_h, fill=1, stroke=0)
    c.setFillColor(colors.white)
    c.setFont('BookletJP', 7.2)
    c.drawCentredString(67, H - top - 11, 'Part')
    c.setFont('Times-BoldItalic', 18)
    c.drawCentredString(67, H - top - 30, str(part_idx))

    c.setFillColor(colors.black)
    c.setStrokeColor(colors.black)
    _line(c, header_line, X + 2, top + 2, 'BookletJP', 10.2)
    _draw_para(c, inst_text, X + 2, top + 20, BW - 4, JP_INST)
    c.setLineWidth(0.75)
    c.line(BAND_X, H - top - h_box, RIGHT, H - top - h_box)
    return top + h_box + 10


def _listening_continuation_bar(c: canvas.Canvas, part_idx: int, note_text: str, top: float = 52) -> float:
    c.setFillColor(colors.HexColor('#222222'))
    c.rect(46, H - top - 22, 40, 22, fill=1, stroke=0)
    c.setFillColor(colors.white)
    c.setFont('Times-BoldItalic', 12.5)
    c.drawCentredString(66, H - top - 16, f'P.{part_idx}')
    c.setFillColor(colors.black)
    _line(c, note_text, X + 2, top + 4, 'BookletJP', 9.0)
    c.setLineWidth(0.55)
    c.line(BAND_X, H - top - 27, RIGHT, H - top - 27)
    return top + 37


def _draw_illustration_box(
    c: canvas.Canvas,
    q_no: int,
    img_path: str | None,
    box_x: float,
    top: float,
    box_w: float,
    box_h: float,
):
    """Official Eiken 2-column illustration card: `No. X` header + crisp B&W line art, zero choice text."""
    c.saveState()
    c.setStrokeColor(colors.HexColor('#333333'))
    c.setLineWidth(0.65)
    c.rect(box_x, H - top - box_h, box_w, box_h, stroke=1, fill=0)

    # Top-left No. badge strip
    hdr_h = 19
    c.setFillColor(colors.HexColor('#f3f3f3'))
    c.rect(box_x + 0.5, H - top - hdr_h, box_w - 1.0, hdr_h - 0.5, stroke=0, fill=1)
    c.setLineWidth(0.4)
    c.line(box_x, H - top - hdr_h, box_x + box_w, H - top - hdr_h)
    c.setFillColor(colors.black)
    c.setFont('Times-Bold', 10.5)
    c.drawString(box_x + 8, H - top - 13.8, f'No. {q_no}')

    # Spoken-choices subtle indicator on right (1  2  3) as memo bubbles without words
    c.setFont('Times-Roman', 8.2)
    c.setFillColor(colors.HexColor('#555555'))
    c.drawRightString(box_x + box_w - 8, H - top - 13.5, '( 1 · 2 · 3 )')

    # Image area
    pad = 5
    avail_w = box_w - pad * 2
    avail_h = box_h - hdr_h - pad * 2
    img_bottom_y = H - top - box_h + pad

    if img_path and Path(img_path).exists():
        with PILImage.open(img_path) as im:
            iw, ih = im.size
        scale = min(avail_w / max(1, iw), avail_h / max(1, ih))
        dw, dh = iw * scale, ih * scale
        dx = box_x + pad + (avail_w - dw) / 2
        dy = img_bottom_y + (avail_h - dh) / 2
        c.drawImage(img_path, dx, dy, width=dw, height=dh, preserveAspectRatio=True, mask='auto')
    else:
        # Clean monochrome exam frame when illustration is pending, without leaking scene answers
        c.setStrokeColor(colors.HexColor('#bbbbbb'))
        c.setDash(2, 2)
        c.rect(box_x + 12, img_bottom_y + 6, avail_w - 24, avail_h - 12, stroke=1, fill=0)
        c.setDash()
        c.setFillColor(colors.HexColor('#666666'))
        c.setFont('BookletJP', 8.2)
        c.drawCentredString(box_x + box_w / 2, img_bottom_y + avail_h / 2 - 3, '［イラストを参考に放送を聞く］')
    c.restoreState()


def _render_illustration_part(
    c: canvas.Canvas,
    units: list[dict],
    resolved_images: dict[str, str],
    top: float,
    new_page_fn,
    part_idx: int,
    part_label: str,
):
    """Render 10 illustration items in an authentic 2-column × 5-row grid on ONE page (or 2 pages if needed)."""
    col_gap = 14
    card_w = (BW - col_gap) / 2
    rows_total = (len(units) + 1) // 2
    avail_h = (H - 46) - top
    row_gap = 7
    # If 5 rows fit cleanly (each >= 112pt), keep all 10 on one page just like official Eiken Grade 5/4/3!
    ideal_card_h = (avail_h - (rows_total - 1) * row_gap) / max(1, rows_total)

    if ideal_card_h >= 114:
        card_h = min(132, ideal_card_h)
        for idx, unit in enumerate(units):
            r = idx // 2
            col = idx % 2
            bx = X + col * (card_w + col_gap)
            by = top + r * (card_h + row_gap)
            q_no = unit['questions'][0]['questionNumber']
            img_p = resolved_images.get(unit['audioId'])
            _draw_illustration_box(c, q_no, img_p, bx, by, card_w, card_h)
        return top + rows_total * (card_h + row_gap)
    else:
        # Split 6 + 4 across pages with generous height
        card_h = 152
        cur_top = top
        for r_start in range(0, len(units), 2):
            if cur_top + card_h > H - 46:
                new_page_fn()
                cur_top = _listening_continuation_bar(
                    c, part_idx, f'第{part_idx}部（{re.sub(r"^第\\d+部\\s*", "", part_label)}・続き）'
                )
            for col in range(2):
                u_idx = r_start + col
                if u_idx >= len(units):
                    break
                unit = units[u_idx]
                bx = X + col * (card_w + col_gap)
                q_no = unit['questions'][0]['questionNumber']
                img_p = resolved_images.get(unit['audioId'])
                _draw_illustration_box(c, q_no, img_p, bx, cur_top, card_w, card_h)
            cur_top += card_h + 10
        return cur_top


def _render_textless_readaloud_part(c: canvas.Canvas, units: list[dict], top: float) -> float:
    """Official Eiken Grade Pre-2 Part 1: 10 spoken-only 3-choice items (`No. 1`..`No. 10`) in a crisp 2-col layout + MEMO."""
    note_box_h = 34
    c.setFillColor(colors.HexColor('#f6f6f6'))
    c.setLineWidth(0.5)
    c.rect(X, H - top - note_box_h, BW, note_box_h, stroke=1, fill=1)
    c.setFillColor(colors.black)
    _draw_para(
        c,
        '※ 第1部（No. 1〜No. 10）は問題冊子に選択肢の英文は印刷されていません。放送される対話と応答の選択肢（1, 2, 3）を聞いて解答用紙にマークしなさい。右の欄は聞き取りメモとして使えます。',
        X + 8,
        top + 4,
        BW - 16,
        JP_SMALL,
    )
    top += note_box_h + 14

    col_gap = 18
    col_w = (BW - col_gap) / 2
    per_col = (len(units) + 1) // 2
    row_h = 38

    for idx, unit in enumerate(units):
        q_no = unit['questions'][0]['questionNumber']
        col = idx // per_col
        row = idx % per_col
        bx = X + col * (col_w + col_gap)
        by = top + row * row_h

        c.setStrokeColor(colors.HexColor('#555555'))
        c.setLineWidth(0.5)
        c.rect(bx, H - by - 30, col_w, 30, stroke=1, fill=0)
        c.setFillColor(colors.black)
        c.setFont('Times-Bold', 11.0)
        c.drawString(bx + 10, H - by - 19, f'No. {q_no}')

        for opt in range(1, 4):
            ox = bx + 84 + (opt - 1) * 40
            c.setFont('Times-Bold', 10.0)
            c.setFillColor(colors.HexColor('#333333'))
            c.drawString(ox, H - by - 19, str(opt))
            c.setStrokeColor(colors.HexColor('#aaaaaa'))
            c.circle(ox + 3, H - by - 15.5, 7.5, stroke=1, fill=0)
        c.setFillColor(colors.black)

    top += per_col * row_h + 18
    # Official MEMO tag at bottom of Pre-2 Part 1 page
    tag_y = H - top - 18
    c.setFillColor(colors.HexColor('#222222'))
    c.rect(46, tag_y, 68, 18, stroke=0, fill=1)
    c.setFillColor(colors.white)
    c.setFont('Times-Bold', 10.5)
    c.drawCentredString(80, tag_y + 5, 'M E M O')
    c.setFillColor(colors.black)
    return top + 28


def _choice_columns_for(choices: list[str], style: ParagraphStyle) -> int:
    """Use 2-column layout when all 4 choices fit on single lines in 2 columns; otherwise 1-column."""
    half_w = BW / 2 - 26
    if all(_p_height(ch, half_w, style) <= style.leading + 2.0 for ch in choices):
        return 2
    return 1


def _options_block_height(choices: list[str], cols: int, style: ParagraphStyle, row_gap: float = 3.5) -> float:
    cw = BW / cols
    total = 0.0
    for start in range(0, len(choices), cols):
        rh = max(_p_height(ch, cw - 24, style) for ch in choices[start:start + cols])
        total += rh + row_gap
    return total


def _draw_printed_question(
    c: canvas.Canvas,
    q_no: int,
    choices: list[str],
    top: float,
    style: ParagraphStyle = EN_CHOICE,
    sub_tag: str | None = None,
    row_gap: float = 3.5,
) -> float:
    """Draw `No. X` in the left gray band + `1 .. 4` printed choices (NO spoken stem printed!)."""
    if sub_tag:
        c.setFont('Times-Bold', 9.5)
        c.drawString(52, H - top - 9, sub_tag)
        _line(c, f'No. {q_no}', 52, top + 12, 'Times-Bold', 10.2)
    else:
        _line(c, f'No. {q_no}', 52, top, 'Times-Bold', 10.6)

    cols = _choice_columns_for(choices, style)
    cw = BW / cols
    cursor = top
    for start in range(0, len(choices), cols):
        rh = max(_p_height(ch, cw - 24, style) for ch in choices[start:start + cols])
        for idx in range(start, min(start + cols, len(choices))):
            cx = X + (idx - start) * cw
            _line(c, str(idx + 1), cx + 2, cursor, 'Times-Bold', style.fontSize)
            _draw_para(c, choices[idx], cx + 18, cursor, cw - 24, style)
        cursor += rh + row_gap
    return max(cursor, top + (26 if sub_tag else 16))


def _reallife_unit_height(unit: dict, style_choice: ParagraphStyle) -> float:
    mat = unit['material']
    q = unit['questions'][0]
    inner_w = BW - 20
    sit_h = _p_height(f'Situation: {mat["situation"]}', inner_w, EN_MAT_BODY)
    q_txt = mat.get('questionText') or q['questionPrompt']
    qt_h = _p_height(f'Question: {q_txt}', inner_w, EN_MAT_BOLD)

    tbl_h = 0.0
    if mat.get('headers') and mat.get('rows'):
        col_cnt = len(mat['headers'])
        cw = inner_w / col_cnt
        hdr_h = max(_p_height(h, cw - 8, EN_MAT_HDR) for h in mat['headers']) + 7
        rows_h = sum(max(_p_height(cell, cw - 8, EN_MAT_CELL) for cell in r) + 6 for r in mat['rows'])
        tbl_h = hdr_h + rows_h + 6

    notes_h = sum(_p_height(f'* {nt}', inner_w, EN_MAT_CELL) + 2 for nt in mat.get('notes', []))
    box_h = 22 + sit_h + 6 + tbl_h + notes_h + qt_h + 14
    cols = _choice_columns_for(q['choices'], style_choice)
    ch_h = _options_block_height(q['choices'], cols, style_choice, 3.0)
    return box_h + 7 + ch_h + 10


def _draw_reallife_unit(c: canvas.Canvas, unit: dict, letter_tag: str, top: float, style_choice: ParagraphStyle) -> float:
    """Official Eiken Pre-1 / Grade 1 Part 3 Real-Life item: `(G)` + `No. 25` + framed Situation/Table/Question + 4 choices."""
    mat = unit['material']
    q = unit['questions'][0]
    q_no = q['questionNumber']
    inner_w = BW - 20

    # Left margin label `(G)` + `No. 25`
    c.setFont('Times-Bold', 10.5)
    c.drawCentredString(BAND_X + BAND_W / 2, H - top - 11, f'({letter_tag})')
    c.setFont('Times-Bold', 10.2)
    c.drawCentredString(BAND_X + BAND_W / 2, H - top - 25, f'No. {q_no}')

    # Measure box height accurately
    sit_str = f'Situation: {mat["situation"]}'
    q_txt = mat.get('questionText') or q['questionPrompt']
    q_str = f'Question: {q_txt}'
    sit_h = _p_height(sit_str, inner_w, EN_MAT_BODY)
    qt_h = _p_height(q_str, inner_w, EN_MAT_BOLD)

    tbl_obj = None
    tbl_h = 0.0
    if mat.get('headers') and mat.get('rows'):
        col_cnt = len(mat['headers'])
        cw = inner_w / col_cnt
        t_rows = [[_para(h, EN_MAT_HDR) for h in mat['headers']]]
        for r in mat['rows']:
            t_rows.append([_para(cell, EN_MAT_CELL) for cell in r])
        tbl_obj = Table(t_rows, colWidths=[cw] * col_cnt)
        tbl_obj.setStyle(TableStyle([
            ('GRID', (0, 0), (-1, -1), 0.45, colors.HexColor('#333333')),
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#eaeaea')),
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
            ('LEFTPADDING', (0, 0), (-1, -1), 4),
            ('RIGHTPADDING', (0, 0), (-1, -1), 4),
            ('TOPPADDING', (0, 0), (-1, -1), 2.5),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 2.5),
        ]))
        _, tbl_h = tbl_obj.wrap(inner_w, H)

    notes = mat.get('notes', [])
    notes_h = sum(_p_height(f'* {nt}', inner_w, EN_MAT_CELL) + 2 for nt in notes)
    title_h = 18
    box_h = title_h + 5 + sit_h + 5 + (tbl_h + 5 if tbl_obj else 0) + (notes_h + 3 if notes else 0) + qt_h + 8

    # Outer crisp black frame
    c.setFillColor(colors.white)
    c.setStrokeColor(colors.black)
    c.setLineWidth(0.75)
    c.rect(X, H - top - box_h, BW, box_h, stroke=1, fill=1)

    # Title header strip inside Real-Life card
    c.setFillColor(colors.HexColor('#f2f2f2'))
    c.rect(X + 0.5, H - top - title_h, BW - 1.0, title_h - 0.5, stroke=0, fill=1)
    c.setLineWidth(0.45)
    c.line(X, H - top - title_h, X + BW, H - top - title_h)
    c.setFillColor(colors.black)
    c.setFont('Times-Bold', 9.8)
    c.drawCentredString(X + BW / 2, H - top - 13, mat['title'])

    cur = top + title_h + 5
    cur += _draw_para(c, sit_str, X + 10, cur, inner_w, EN_MAT_BODY) + 5
    if tbl_obj is not None:
        tbl_obj.drawOn(c, X + 10, H - cur - tbl_h)
        cur += tbl_h + 5
    for nt in notes:
        cur += _draw_para(c, f'* {nt}', X + 10, cur, inner_w, EN_MAT_CELL) + 2
    if notes:
        cur += 2
    _draw_para(c, q_str, X + 10, cur, inner_w, EN_MAT_BOLD)

    after_box = top + box_h + 6
    cols = _choice_columns_for(q['choices'], style_choice)
    cw = BW / cols
    c_cur = after_box
    for start in range(0, len(q['choices']), cols):
        rh = max(_p_height(ch, cw - 24, style_choice) for ch in q['choices'][start:start + cols])
        for idx in range(start, min(start + cols, len(q['choices']))):
            cx = X + (idx - start) * cw
            _line(c, str(idx + 1), cx + 2, c_cur, 'Times-Bold', style_choice.fontSize)
            _draw_para(c, q['choices'][idx], cx + 18, c_cur, cw - 24, style_choice)
        c_cur += rh + 3.0
    return c_cur + 8


def build_listening_questions_bytes(
    grade: str,
    rnd: int,
    l_exam: dict,
    l_bp: dict,
    resolved_images: dict[str, str],
    start_page_no: int = 2,
) -> bytes:
    """Render all Listening parts for one round on authentic Eiken question pages."""
    buf = io.BytesIO()
    c = canvas.Canvas(buf, pagesize=A4, pageCompression=1, invariant=1)
    page_no = start_page_no
    revision = f'manatobi-original-r{rnd:02d}'

    choice_style = EN_CHOICE_COMPACT if grade in ('eiken_pre1', 'eiken_1') else EN_CHOICE

    def next_page():
        nonlocal page_no
        c.showPage()
        page_no += 1
        _listening_frame(c, grade, rnd, page_no, revision)

    _listening_frame(c, grade, rnd, page_no, revision)
    top = 52.0

    # Track passage/Real-Life letter codes (`A`, `B`, ...) for Pre-1 and Grade 1 just like official Eiken!
    letter_ord = ord('A')

    for p_idx, pspec in enumerate(l_bp['parts'], 1):
        pid = pspec['id']
        p_units = [u for u in l_exam['units'] if u['part'] == pid]
        if not p_units:
            continue

        if p_idx > 1:
            next_page()
            top = 52.0

        first_no = p_units[0]['questions'][0]['questionNumber']
        last_no = p_units[-1]['questions'][-1]['questionNumber']
        inst = part_instruction_ja(grade, pspec, first_no, last_no, pspec['readCount'])
        top = _listening_part_heading(c, p_idx, pspec['label'], inst, top=top)

        # Case 1: Read-aloud with illustrations (5級 Part 1 & 3, 4級 Part 1, 3級 Part 1)
        if pspec['choicePresentation'] == 'read-aloud' and any(u.get('image') for u in p_units):
            top = _render_illustration_part(c, p_units, resolved_images, top, next_page, p_idx, pspec['label'])

        # Case 2: Read-aloud without illustrations (準2級 Part 1)
        elif pspec['choicePresentation'] == 'read-aloud':
            top = _render_textless_readaloud_part(c, p_units, top)

        # Case 3: Real-Life printed materials + choices (準1級 Part 3, 1級 Part 3)
        elif any(u.get('material') for u in p_units):
            for u_i, unit in enumerate(p_units):
                needed = _reallife_unit_height(unit, choice_style)
                if top + needed > H - 44:
                    next_page()
                    top = _listening_continuation_bar(
                        c, p_idx, f'第{p_idx}部（Real-Life形式・続き）'
                    )
                l_tag = chr(letter_ord)
                letter_ord += 1
                top = _draw_reallife_unit(c, unit, l_tag, top, choice_style)
                if u_i < len(p_units) - 1 and top + 20 < H - 44:
                    _draw_dotted_rule(c, BAND_X + 6, RIGHT, top - 3)
                    top += 5

        # Case 4: Multi-question audio passages / interviews (準1級 Part 2, 1級 Part 2 & Part 4)
        elif pspec['questionsPerAudio'] >= 2:
            for u_i, unit in enumerate(p_units):
                qs = unit['questions']
                group_h = sum(
                    _options_block_height(q['choices'], _choice_columns_for(q['choices'], choice_style), choice_style) + 12
                    for q in qs
                ) + 8
                if top + group_h > H - 44:
                    next_page()
                    top = _listening_continuation_bar(
                        c, p_idx, f'第{p_idx}部（{re.sub(r"^第\\d+部\\s*", "", pspec["label"])}・続き）'
                    )
                sub_tag = f'({chr(letter_ord)})' if len(p_units) > 1 else None
                if len(p_units) > 1:
                    letter_ord += 1
                for q_i, q in enumerate(qs):
                    top = _draw_printed_question(
                        c,
                        q['questionNumber'],
                        q['choices'],
                        top,
                        style=choice_style,
                        sub_tag=(sub_tag if q_i == 0 else None),
                    )
                    top += 6
                if u_i < len(p_units) - 1 and top + 18 < H - 44:
                    c.setStrokeColor(colors.HexColor('#666666'))
                    c.setLineWidth(0.5)
                    c.line(BAND_X + 6, H - (top + 1), RIGHT, H - (top + 1))
                    c.setStrokeColor(colors.black)
                    top += 10

        # Case 5: Standard printed 4-choice 1-question-per-audio parts
        else:
            for u_i, unit in enumerate(p_units):
                q = unit['questions'][0]
                cols = _choice_columns_for(q['choices'], choice_style)
                needed = _options_block_height(q['choices'], cols, choice_style) + 14
                if top + needed > H - 44:
                    next_page()
                    top = _listening_continuation_bar(
                        c, p_idx, f'第{p_idx}部（{re.sub(r"^第\\d+部\\s*", "", pspec["label"])}・続き）'
                    )
                top = _draw_printed_question(c, q['questionNumber'], q['choices'], top, style=choice_style)
                top += 5
                if u_i < len(p_units) - 1 and top + 18 < H - 44:
                    _draw_dotted_rule(c, X - 6, RIGHT, top)
                    top += 7

    c.showPage()
    c.save()
    return buf.getvalue()


# ==============================================================================
# 3. AUTHENTIC EIKEN LANDSCAPE LISTENING MARK SHEET
# ==============================================================================

def build_listening_mark_sheet_bytes(grade: str, rnd: int, l_exam: dict, l_bp: dict) -> bytes:
    """Landscape A4 Listening mark sheet matching `written_print_layout._build_mark_sheet_page`:
    3 ovals (`1 2 3`) for 3-choice read-aloud parts and 4 ovals (`1 2 3 4`) for 4-choice parts.
    """
    buf = io.BytesIO()
    lw, lh = landscape(A4)
    c = canvas.Canvas(buf, pagesize=(lw, lh), pageCompression=1, invariant=1)
    full_label, badge_label, _ = GRADE_META[grade]
    questions = [q for u in l_exam['units'] for q in u['questions']]
    total = len(questions)

    def txt(text: str, x: float, y: float, size: float = 10.0, font: str = 'BookletJP'):
        c.setFont(font, size)
        c.drawString(x, y, text)

    c.setTitle(f'マナトビ {full_label} リスニング 第{rnd}回 マークシート')
    c.setAuthor('マナトビ')

    # Header with black grade badge
    c.setFillColor(colors.black)
    c.rect(42, lh - 72, 68, 34, stroke=0, fill=1)
    c.setFillColor(colors.white)
    c.setFont('BookletJP', 15 if len(badge_label) >= 4 else 17)
    c.drawCentredString(76, lh - 61, badge_label)
    c.setFillColor(colors.black)
    txt(f'{full_label}形式　リスニングテスト 第{rnd}回　解答用紙（マークシート）', 120, lh - 55, 14.5)
    txt('マナトビ独自教材（過去問の流用禁止・公式の解答用紙ではありません）｜A4横・白黒・実際のサイズ（100%）で印刷', 120, lh - 73, 8.2)
    c.setLineWidth(0.6)
    c.line(42, lh - 82, lw - 42, lh - 82)

    # Left box: candidate info + part-by-part self-score summary
    left_x = 42
    left_w = 342
    box_bottom = 68
    box_top = lh - 96
    c.setLineWidth(0.7)
    c.rect(left_x, box_bottom, left_w, box_top - box_bottom, stroke=1, fill=0)
    txt('氏名', 58, box_top - 28, 10.5)
    c.line(96, box_top - 32, 368, box_top - 32)
    txt('実施日', 58, box_top - 60, 10.0)
    c.line(104, box_top - 64, 232, box_top - 64)
    txt('放送目安', 240, box_top - 60, 9.2)
    txt(f'約 {l_bp["minutes"]} 分', 292, box_top - 60, 9.8)

    score_title_y = box_top - 92
    txt('■ リスニング 部別 自己採点メモ（各1点・復習用素点）', 58, score_title_y, 9.2)
    sy = score_title_y - 12
    row_sh = 22
    c.setFillColor(colors.HexColor('#efefef'))
    c.rect(58, sy - row_sh, 310, row_sh, stroke=1, fill=1)
    c.setFillColor(colors.black)
    txt('部・出題形式', 66, sy - 15, 8.4)
    txt('問題番号', 228, sy - 15, 8.4)
    txt('得点', 312, sy - 15, 8.4)

    cur_sy = sy - row_sh
    q_cur = 1
    for idx, pspec in enumerate(l_bp['parts'], 1):
        cnt = pspec['questionCount']
        qs_no, qe_no = q_cur, q_cur + cnt - 1
        q_cur = qe_no + 1
        clean_name = re.sub(r'^第\d+部\s*', '', pspec['label'])
        c.setLineWidth(0.4)
        c.rect(58, cur_sy - row_sh, 310, row_sh, stroke=1, fill=0)
        txt(f'第{idx}部：{clean_name[:12]}', 64, cur_sy - 15, 8.2)
        txt(f'No.{qs_no}〜{qe_no}', 226, cur_sy - 15, 8.3, 'BookletJP')
        txt(f'    ／ {cnt}', 306, cur_sy - 15, 8.5)
        cur_sy -= row_sh

    c.setFillColor(colors.HexColor('#f7f7f7'))
    c.rect(58, cur_sy - 24, 310, 24, stroke=1, fill=1)
    c.setFillColor(colors.black)
    txt('リスニング 合計素点（CSE換算なし）', 64, cur_sy - 16, 8.8)
    txt(f'      ／ {total}', 302, cur_sy - 16, 9.5)
    cur_sy -= 36

    has_3choice = any(len(q['choices']) == 3 for q in questions)
    if has_3choice:
        txt('※ 3肢読み上げの部は 1〜3 のだ円、4肢印刷の部は 1〜4 のだ円です。', 58, cur_sy - 4, 8.2)
        txt('※ アプリの「通し模試（リスニング）」の音声と完全連動しています。', 58, cur_sy - 20, 8.2)
    else:
        txt('※ 全問 1〜4 から最も適切なものを1つ選び、だ円を濃くぬりつぶします。', 58, cur_sy - 4, 8.2)
        txt('※ アプリの「通し模試（リスニング）」の音声と完全連動しています。', 58, cur_sy - 20, 8.2)

    # Right side: Two balanced oval mark columns (1..15, 16..total)
    right_x1 = 420
    right_x2 = 614
    colw = 178
    mark_top = lh - 118
    txt('リスニング マーク欄', right_x1, lh - 102, 12.0)
    c.setFont('BookletJP', 8.4)
    c.drawRightString(right_x2 + colw, lh - 101, '各問1つ選び、だ円を濃くぬりつぶします。')

    split = 15
    rowh = 20.5
    header = 22

    for start, end, x in [(1, min(split, total), right_x1), (split + 1, total, right_x2)]:
        if start > end:
            continue
        count_rows = end - start + 1
        box_h = header + count_rows * rowh
        c.setFillColor(colors.HexColor('#eaeaea'))
        c.rect(x, mark_top - header, colw, header, stroke=0, fill=1)
        c.setFillColor(colors.black)
        txt('番号', x + 10, mark_top - 15, 8.5)
        for a in range(4):
            txt(str(a + 1), x + 68 + a * 26, mark_top - 15, 9.5, 'Times-Bold')

        for n in range(start, end + 1):
            row_idx = n - start
            row_bottom = mark_top - header - (row_idx + 1) * rowh
            cy = row_bottom + rowh / 2
            q_obj = questions[n - 1]
            n_opts = len(q_obj['choices'])

            if row_idx % 2 == 1:
                c.setFillColor(colors.HexColor('#f6f6f6'))
                c.rect(x, row_bottom, colw, rowh, stroke=0, fill=1)
                c.setFillColor(colors.black)
            txt(f'No.{n}', x + 8, cy - 3.5, 9.0, 'Times-Bold')
            for a in range(n_opts):
                cx = x + 71 + a * 26
                c.setLineWidth(0.45)
                c.ellipse(cx - 5.2, cy - 6.0, cx + 5.2, cy + 6.0, stroke=1, fill=0)
                txt(str(a + 1), cx - 2.2, cy - 2.9, 7.6, 'Times-Roman')
            c.setLineWidth(0.65 if n % 5 == 0 and n != end else 0.25)
            c.line(x, row_bottom, x + colw, row_bottom)

        c.setLineWidth(0.4)
        c.line(x + 50, mark_top - box_h, x + 50, mark_top)
        c.setLineWidth(0.75)
        c.rect(x, mark_top - box_h, colw, box_h, stroke=1, fill=0)

    guide_y = 84
    txt('良いぬり方：', right_x1, guide_y, 8.8)
    c.setFillColor(colors.black)
    c.ellipse(right_x1 + 60, guide_y - 3, right_x1 + 70, guide_y + 9, stroke=1, fill=1)
    txt('（例：答えが2のときは②を濃くぬりつぶし、訂正は消しゴムで完全に消す）', right_x1 + 78, guide_y, 8.2)

    c.setLineWidth(0.4)
    c.line(42, 48, lw - 42, 48)
    txt('マナトビ｜独自作成教材（過去問の流用禁止・公式問題ではありません）', 42, 31, 8.0)
    c.setFont('BookletJP', 7.8)
    c.drawRightString(lw - 42, 31, f'manatobi-original-r{rnd:02d}　｜　リスニング解答用紙 1/1')
    c.showPage()
    c.save()
    return buf.getvalue()


# ==============================================================================
# 4. AUTHENTIC MONOCHROME LISTENING ANSWER KEY, SCRIPT & EXPLANATION PAGES
# ==============================================================================

def _exp_p(text: str, style_key: str = 'jp') -> Paragraph:
    safe = escape(str(text)).replace('\n', '<br/>')
    if style_key == 'en_script':
        safe = re.sub(
            r'(^|<br/>)(Man|Woman|Narrator|Interviewer|Guest|M1|M2|F1|F2):',
            r'\1<b>\2:</b>',
            safe,
        )
    return Paragraph(safe, EXP_STYLES[style_key])


def _exp_header_bar(left_text: str, right_text: str, body_w: float) -> Table:
    t = Table(
        [[_exp_p(left_text, 'band_left'), _exp_p(right_text, 'band_right')]],
        colWidths=[body_w * 0.68, body_w * 0.32],
        hAlign='LEFT',
    )
    t.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor('#efefef')),
        ('BOX', (0, 0), (-1, -1), 0.5, colors.black),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('LEFTPADDING', (0, 0), (-1, -1), 7),
        ('RIGHTPADDING', (0, 0), (-1, -1), 7),
        ('TOPPADDING', (0, 0), (-1, -1), 3.5),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 3.5),
    ]))
    return t


def build_listening_explanations_bytes(grade: str, rnd: int, l_exam: dict, l_bp: dict) -> bytes:
    """Monochrome Eiken-style Answer Key + Broadcast Script + Japanese Translation + Full Rationale."""
    buf = io.BytesIO()
    full_label, _, _ = GRADE_META[grade]
    body_w = W - 96
    questions = [q for u in l_exam['units'] for q in u['questions']]
    part_names = {pt['id']: pt['label'] for pt in l_bp['parts']}

    story = [
        _exp_p(f'{full_label}形式 リスニング 第{rnd}回　解答・放送原稿・解説', 'title'),
        _exp_p(
            f'解き終わってから確認してください。各1点（全{len(questions)}点満点の復習用素点）です。'
            f'間違えた問題は放送原稿（スクリプト）と根拠英文を確認し、アプリで音声を聞き直しましょう。公式CSEスコア・合否へは換算しません。',
            'note',
        ),
        Spacer(1, 6),
        _exp_p('■ リスニング 正答一覧・復習チェック表（間違えた問題は □ にチェック）', 'heading'),
    ]

    keyrows = []
    for start in range(0, len(questions), 5):
        row_cells = []
        for n in range(start, start + 5):
            if n < len(questions):
                q_obj = questions[n]
                row_cells.append(_exp_p(f'□ No.{q_obj["questionNumber"]:02d}：正答 {q_obj["answer"] + 1}', 'cell'))
            else:
                row_cells.append(_exp_p('', 'cell'))
        keyrows.append(row_cells)

    key_table = Table(keyrows, colWidths=[body_w / 5] * 5, hAlign='LEFT')
    key_table.setStyle(TableStyle([
        ('GRID', (0, 0), (-1, -1), 0.45, colors.HexColor('#666666')),
        ('ROWBACKGROUNDS', (0, 0), (-1, -1), [colors.white, colors.HexColor('#f8f8f8')]),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('LEFTPADDING', (0, 0), (-1, -1), 6),
        ('RIGHTPADDING', (0, 0), (-1, -1), 4),
        ('TOPPADDING', (0, 0), (-1, -1), 4.5),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 4.5),
    ]))
    story += [key_table, Spacer(1, 12)]

    for unit in l_exam['units']:
        qs = unit['questions']
        p_label = part_names.get(unit['part'], unit['part'])
        if len(qs) == 1:
            q0 = qs[0]
            left_hdr = f'No.{q0["questionNumber"]:02d}　{p_label}（{unit["readCount"]}回読み）'
            right_hdr = f'No.{q0["questionNumber"]:02d} 正答 {q0["answer"] + 1}'
        else:
            nos = '・'.join(f'No.{q["questionNumber"]:02d}' for q in qs)
            ans_s = ' ／ '.join(f'No.{q["questionNumber"]}: {q["answer"] + 1}' for q in qs)
            left_hdr = f'{nos}　{p_label}（{unit["readCount"]}回読み）'
            right_hdr = f'正答 {ans_s}'

        block = [
            _exp_header_bar(left_hdr, right_hdr, body_w),
            Spacer(1, 4),
            _exp_p(unit['elevenLabsDialogueInput'], 'en_script'),
            _exp_p('【和訳】' + unit['translation'], 'jp'),
        ]
        for q in qs:
            prefix = f'［No.{q["questionNumber"]}］' if len(qs) > 1 else ''
            block.append(_exp_p(f'{prefix}【根拠・解き方】根拠英文："{q["evidence"]}" ／ {q["explanation"]}', 'jp'))
            for ci, c_txt in enumerate(q['choices']):
                mark = '★ ' if ci == q['answer'] else '　 '
                block.append(_exp_p(f'{mark}{ci + 1}. {c_txt}：{q["distractorReasons"][ci]}', 'note'))
        block.append(Spacer(1, 9))
        story.append(KeepTogether(block))

    def footer(c: canvas.Canvas, doc):
        c.saveState()
        c.setFillColor(colors.black)
        c.setStrokeColor(colors.black)
        c.setLineWidth(0.4)
        c.line(48, H - 36, W - 48, H - 36)
        c.line(48, 38, W - 48, 38)
        c.setFont('BookletJP', 8.0)
        c.drawString(48, H - 28, f'マナトビ｜{full_label}形式 第{rnd}回 リスニング｜解答・放送原稿・解説')
        c.drawString(48, 25, f'独自教材（過去問の流用禁止・公式問題ではありません）｜manatobi-original-r{rnd:02d}')
        c.drawRightString(W - 48, 25, f'リス解説 {doc.page}')
        c.restoreState()

    SimpleDocTemplate(
        buf,
        pagesize=A4,
        leftMargin=48,
        rightMargin=48,
        topMargin=50,
        bottomMargin=46,
        title=f'マナトビ {full_label} 第{rnd}回 リスニング解答・解説',
        author='マナトビ',
        pageCompression=1,
    ).build(story, onFirstPage=footer, onLaterPages=footer)
    return buf.getvalue()
