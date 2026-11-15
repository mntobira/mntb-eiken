"""Build strictly separated PDFs from deliverables/listening-booklets.json:
1) ElevenLabs Audio Prompt PDFs (per grade, 8 PDFs, 3,285 audio units total) — separate production volume
2) ChatGPT Image Prompt PDFs (per grade with images + combined 750-prompt master PDF) — separate production volume
3) Authentic Eiken-style Listening Mock Exam Booklets:
   - Per-grade 15-round master booklets (`deliverables/pdfs/listening_booklet_{grade}_15rounds.pdf`)
   - Per-round split printable booklets (`deliverables/pdfs/listening_rounds/{grade}_listening_r{round:02d}_{questions|answers|explanations|full_set}.pdf`)

Strictly adheres to `listening_print_layout.py` (authentic monochrome Eiken exam booklet cover, left gray margin band,
dark Part badges, 2-col illustration boxes with zero choice text for read-aloud parts, printed 4-choice options without
spoken stems, Real-Life situation/table/Question boxes, landscape oval mark sheet, and Answer Key + Broadcast Script + Rationale).
Every cover embeds `public/brand/manatobi-logo-gray.png` and explicitly states 「過去問の流用禁止」.
"""
from pathlib import Path
from html import escape
import json
from reportlab import rl_config
rl_config.invariant = True
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.platypus import (
    SimpleDocTemplate,
    Paragraph,
    Spacer,
    Table,
    TableStyle,
    PageBreak,
    KeepTogether,
    Image as RLImage,
)
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
import pymupdf

from listening_print_layout import (
    GRADE_META,
    build_listening_cover_bytes,
    build_listening_questions_bytes,
    build_listening_mark_sheet_bytes,
    build_listening_explanations_bytes,
    check_no_line_overlaps,
)

ROOT = Path(__file__).resolve().parents[1]
PUBLIC = ROOT / 'public'
DELIV = ROOT / 'deliverables'
PDF_DIR = DELIV / 'pdfs'
ROUNDS_DIR = PDF_DIR / 'listening_rounds'
PDF_DIR.mkdir(parents=True, exist_ok=True)
ROUNDS_DIR.mkdir(parents=True, exist_ok=True)

BOOKLETS_DATA = json.loads((DELIV / 'listening-booklets.json').read_text('utf-8'))
AUDIO_DATA = json.loads((DELIV / 'eiken-elevenlabs-audio-prompts.json').read_text('utf-8'))
IMAGE_DATA = json.loads((DELIV / 'eiken-chatgpt-image-prompts.json').read_text('utf-8'))
RESOLVED_IMAGES_PATH = DELIV / 'listening_resolved_images.json'
RESOLVED_IMAGES: dict[str, str] = (
    json.loads(RESOLVED_IMAGES_PATH.read_text('utf-8')) if RESOLVED_IMAGES_PATH.exists() else {}
)

if 'BookletJP' not in pdfmetrics.getRegisteredFontNames():
    pdfmetrics.registerFont(TTFont('BookletJP', str(PUBLIC / 'fonts/booklet-noto-serif-jp.ttf')))
LOGO_PATH = PUBLIC / 'brand/manatobi-logo-gray.png'
WIDTH, HEIGHT = A4


def brand_logo() -> RLImage:
    logo = RLImage(str(LOGO_PATH), width=116, height=37)
    logo.hAlign = 'LEFT'
    return logo


STYLES = {
    'cover_kicker': ParagraphStyle('cover_kicker', fontName='Times-Bold', fontSize=9.5, leading=14, textColor=colors.HexColor('#222222'), spaceAfter=6),
    'cover_title': ParagraphStyle('cover_title', fontName='BookletJP', fontSize=20, leading=29, textColor=colors.black, spaceAfter=10),
    'cover_sub': ParagraphStyle('cover_sub', fontName='BookletJP', fontSize=11.5, leading=18, textColor=colors.HexColor('#222222'), spaceAfter=12),
    'ban_box': ParagraphStyle('ban_box', fontName='BookletJP', fontSize=9.8, leading=15.2, textColor=colors.black, wordWrap='CJK'),
    'h1': ParagraphStyle('h1', fontName='BookletJP', fontSize=14, leading=21, textColor=colors.black, spaceBefore=6, spaceAfter=7),
    'h2': ParagraphStyle('h2', fontName='BookletJP', fontSize=10.8, leading=16, textColor=colors.black, spaceBefore=5, spaceAfter=3, wordWrap='CJK'),
    'jp': ParagraphStyle('jp', fontName='BookletJP', fontSize=9.4, leading=14.8, spaceAfter=4, wordWrap='CJK'),
    'meta': ParagraphStyle('meta', fontName='BookletJP', fontSize=8.1, leading=12.4, textColor=colors.HexColor('#333333'), spaceAfter=3, wordWrap='CJK'),
    'en': ParagraphStyle('en', fontName='Times-Roman', fontSize=10.2, leading=14.8, spaceAfter=4),
    'mono': ParagraphStyle('mono', fontName='Courier', fontSize=8.2, leading=11.6, spaceAfter=4),
}


def p(text: str, style: str = 'jp') -> Paragraph:
    safe = escape(str(text)).replace('\n', '<br/>')
    return Paragraph(safe, STYLES[style])


def provenance_banner() -> Table:
    txt = (
        '【重要規定｜過去問の流用禁止】\n'
        '・本資料および収録問題・英語台本・選択肢・解説・図版プロンプトはすべて「まなとび英検」向けに書き起こした完全独自作成（origin: manatobi-original）です。\n'
        '・英検過去問および市販教材の本文転載・言い換え流用・固有名詞／数値のみの置換流用は一切行っていません（過去問の流用禁止）。\n'
        '・本PDFはオフライン制作台帳（別冊）であり、試験問題冊子PDFとはファイルを完全に分離しています。'
    )
    tbl = Table([[p(txt, 'ban_box')]], colWidths=[WIDTH - 84])
    tbl.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor('#f6f6f6')),
        ('BOX', (0, 0), (-1, -1), 0.9, colors.black),
        ('LEFTPADDING', (0, 0), (-1, -1), 10),
        ('RIGHTPADDING', (0, 0), (-1, -1), 10),
        ('TOPPADDING', (0, 0), (-1, -1), 8),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
    ]))
    return tbl


def code_box(text: str, bg: str = '#f8f8f8', border: str = '#555555', style: str = 'en') -> Table:
    tbl = Table([[p(text, style)]], colWidths=[WIDTH - 84])
    tbl.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor(bg)),
        ('BOX', (0, 0), (-1, -1), 0.55, colors.HexColor(border)),
        ('LEFTPADDING', (0, 0), (-1, -1), 8),
        ('RIGHTPADDING', (0, 0), (-1, -1), 8),
        ('TOPPADDING', (0, 0), (-1, -1), 6),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
    ]))
    return tbl


def build_prompt_pdf(path: Path, story: list, header_left: str) -> dict:
    def on_page(c, doc):
        c.saveState()
        c.setStrokeColor(colors.black)
        c.setLineWidth(0.4)
        c.line(42, HEIGHT - 32, WIDTH - 42, HEIGHT - 32)
        c.line(42, 34, WIDTH - 42, 34)
        c.setFont('BookletJP', 7.6)
        c.setFillColor(colors.black)
        c.drawString(42, HEIGHT - 24, header_left)
        c.drawString(42, 21, 'マナトビ英検｜完全独自作成（過去問の流用禁止）｜origin: manatobi-original')
        c.drawRightString(WIDTH - 42, 21, f'— {doc.page} —')
        c.restoreState()

    SimpleDocTemplate(
        str(path),
        pagesize=A4,
        leftMargin=42,
        rightMargin=42,
        topMargin=42,
        bottomMargin=40,
        title=header_left,
        author='マナトビ英検',
        pageCompression=1,
    ).build(story, onFirstPage=on_page, onLaterPages=on_page)

    with pymupdf.open(path) as doc:
        pages = len(doc)
        full_text = '\n'.join(pg.get_text() for pg in doc)
        if '\ufffd' in full_text or '\x00' in full_text:
            raise ValueError(f'Mojibake or NUL detected in {path.name}')
        if '過去問の流用禁止' not in doc[0].get_text():
            raise ValueError(f'Cover provenance rule missing in {path.name}')
    return {'file': path.name, 'pages': pages, 'bytes': path.stat().st_size}


def build_elevenlabs_audio_pdfs() -> list[dict]:
    reports = []
    source_hash = AUDIO_DATA['sourceHash'][:16]
    for grade_obj in BOOKLETS_DATA['grades']:
        gid = grade_obj['id']
        glabel = grade_obj['label']
        bp = BOOKLETS_DATA['blueprints'][gid]
        items = [it for it in AUDIO_DATA['items'] if it['grade'] == gid]

        story = [
            brand_logo(),
            Spacer(1, 14),
            p('MANATOBI EIKEN — ELEVENLABS AUDIO PROMPT BOOK (SEPARATE VOLUME)', 'cover_kicker'),
            p(f'{glabel}\nElevenLabs 音声生成プロンプト・収録台本集（全15回）', 'cover_title'),
            p(f'収録音源数：{len(items)} ファイル（1回{bp["totalAudioFiles"]}音源×15回）｜目標速度：{bp["wpmRange"][0]}〜{bp["wpmRange"][1]} WPM', 'cover_sub'),
            provenance_banner(),
            Spacer(1, 14),
            p('ElevenLabs（Text to Dialogue）投入ルール', 'h1'),
            p('1. 本PDFは【音声プロンプト専用】の別冊です（問題冊子PDFおよびChatGPT画像プロンプト集とは別ファイルに分離しています）。'),
            p('2. 固定4ボイスを割り当ててください：M1＝男性1（Man）、M2＝男性2（第3話者／1級Interviewer）、F1＝女性1（Woman／Guest）、F2＝女性2（設問ナレーション Question. / Number one...）。'),
            p('3. 1音源ファイルには「1回分の読み上げ」のみを収録してください。2回読み（5級全パート、4級全パート、3級第2・第3部）はアプリ側プレーヤーが自動リピート再生します。'),
            p('4. 日本語の見出し・音源ID・ファイルパスは読み上げさせず、枠内の英語セリフ本文のみを投入してください。'),
            p(f'原本照合ハッシュ（SHA-256先頭16桁）：{source_hash}', 'meta'),
            PageBreak(),
        ]

        current_round = None
        for it in items:
            if it['round'] != current_round:
                if current_round is not None:
                    story.append(PageBreak())
                current_round = it['round']
                story.append(p(f'{glabel} 第{current_round}回｜ElevenLabs 音声プロンプト一覧', 'h1'))

            q_str = '–'.join([str(it['questionNumbers'][0]), str(it['questionNumbers'][-1])]) if len(it['questionNumbers']) > 1 else str(it['questionNumbers'][0])
            speaker_map = ' / '.join(f'{t["roleLabel"]}={t["speaker"]}' for t in it['turns'])
            meta_line = (
                f'音源ID: {it["audioId"]} ｜ 保存先: {it["targetAudioPath"]} ｜ '
                f'対応設問: No.{q_str} ｜ 本試験読み回数: {it["readCountInExam"]}回 ｜ 話者割当: {speaker_map}'
            )
            block = KeepTogether([
                p(f'[{it["part"].upper()}-{it["unitIndex"]:02d}] No.{q_str}', 'h2'),
                p(meta_line, 'meta'),
                code_box(it['elevenLabsDialogueInput'], bg='#f9f9f9', border='#555555', style='en'),
                Spacer(1, 5),
            ])
            story.append(block)

        out_path = PDF_DIR / f'elevenlabs_audio_prompts_{gid}.pdf'
        reports.append(build_prompt_pdf(out_path, story, f'マナトビ英検｜{glabel} ElevenLabs音声プロンプト集（全15回）'))
    return reports


def build_chatgpt_image_pdfs() -> list[dict]:
    reports = []
    source_hash = IMAGE_DATA['sourceHash'][:16]
    grades_with_images = [g for g in BOOKLETS_DATA['grades'] if BOOKLETS_DATA['blueprints'][g['id']]['totalImages'] > 0]

    for grade_obj in grades_with_images:
        gid = grade_obj['id']
        glabel = grade_obj['label']
        bp = BOOKLETS_DATA['blueprints'][gid]
        items = [it for it in IMAGE_DATA['items'] if it['grade'] == gid]

        story = [
            brand_logo(),
            Spacer(1, 14),
            p('MANATOBI EIKEN — CHATGPT IMAGE PROMPT BOOK (SEPARATE VOLUME)', 'cover_kicker'),
            p(f'{glabel}\nChatGPT 画像生成プロンプト集（全15回）', 'cover_title'),
            p(f'収録図版プロンプト数：{len(items)} 枚（1回{bp["totalImages"]}枚×15回）｜白黒線画・文字完全禁止仕様', 'cover_sub'),
            provenance_banner(),
            Spacer(1, 14),
            p('ChatGPT（GPT Image）投入ルール', 'h1'),
            p('1. 本PDFは【画像プロンプト専用】の別冊です（問題冊子PDFおよびElevenLabs音声プロンプト集とは別ファイルに分離しています）。'),
            p('2. 準2級・準2級プラス・2級は本試験仕様どおりリスニング図版が 0 枚のため、図版が存在する5つの級（5級・4級・3級・準1級・1級、計750枚）を収録しています。'),
            p('3. 各プロンプトを投入する際は、共通スタイル参照線画1枚を添付し、生成画像に文字・数字・記号が一切入っていないことを確認して保存先パスへ格納してください。'),
            p('4. 準1級・1級 第3部（Real-Life形式）は問題冊子側で正確な英語条件表を組版出力しています。'),
            p(f'原本照合ハッシュ（SHA-256先頭16桁）：{source_hash}', 'meta'),
            PageBreak(),
        ]

        current_round = None
        for it in items:
            if it['round'] != current_round:
                if current_round is not None:
                    story.append(PageBreak())
                current_round = it['round']
                story.append(p(f'{glabel} 第{current_round}回｜ChatGPT 画像プロンプト一覧', 'h1'))

            q_str = ','.join(str(n) for n in it['questionNumbers'])
            meta_line = (
                f'保存先: {it["targetImagePath"]} ｜ 役割: {it["role"]} ｜ '
                f'比率: {it["aspectRatio"]} ｜ 対応設問: No.{q_str}\n'
                f'場面要旨（確認用・画像内テキスト不可）: {it["sceneSummaryJa"]}'
            )
            block = KeepTogether([
                p(f'[{it["part"].upper()}-{it["unitIndex"]:02d}] {it["targetImagePath"]}', 'h2'),
                p(meta_line, 'meta'),
                code_box(it['chatGptPrompt'], bg='#fafafa', border='#555555', style='mono'),
                Spacer(1, 6),
            ])
            story.append(block)

        out_path = PDF_DIR / f'chatgpt_image_prompts_{gid}.pdf'
        reports.append(build_prompt_pdf(out_path, story, f'マナトビ英検｜{glabel} ChatGPT画像プロンプト集（全15回）'))

    master_story = [
        brand_logo(),
        Spacer(1, 14),
        p('MANATOBI EIKEN — MASTER IMAGE PROMPT INDEX (750 ILLUSTRATIONS)', 'cover_kicker'),
        p('全級総覧 ChatGPT 画像プロンプト台帳（全750枚）', 'cover_title'),
        p('5級300枚・4級150枚・3級150枚・準1級75枚・1級75枚（準2級・準2級プラス・2級は公式仕様どおり0枚）', 'cover_sub'),
        provenance_banner(),
        Spacer(1, 14),
        p('級別ファイル内訳（全750枚）', 'h1'),
    ]
    summary_rows = [[p('級', 'h2'), p('1回あたり図版数', 'h2'), p('15回合計', 'h2'), p('別冊PDFファイル名', 'h2')]]
    for g in BOOKLETS_DATA['grades']:
        gid = g['id']
        cnt = BOOKLETS_DATA['blueprints'][gid]['totalImages']
        fname = f'chatgpt_image_prompts_{gid}.pdf' if cnt > 0 else '（図版なし仕様・0枚）'
        summary_rows.append([p(g['label']), p(f'{cnt}枚'), p(f'{cnt * 15}枚'), p(fname, 'meta')])
    t = Table(summary_rows, colWidths=[110, 90, 80, WIDTH - 364], hAlign='LEFT')
    t.setStyle(TableStyle([
        ('GRID', (0, 0), (-1, -1), 0.45, colors.HexColor('#666666')),
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#eaeaea')),
        ('PADDING', (0, 0), (-1, -1), 5),
    ]))
    master_story += [t, Spacer(1, 12), p('全750件のファイルパス＆場面要旨一覧', 'h1')]
    for it in IMAGE_DATA['items']:
        master_story.append(p(f'{it["targetImagePath"]} [{it["gradeLabel"]} 第{it["round"]}回 No.{it["questionNumbers"][0]} / {it["role"]} / {it["aspectRatio"]}] — {it["sceneSummaryJa"]}', 'meta'))
    out_master = PDF_DIR / 'chatgpt_image_prompts_master_index_750.pdf'
    reports.append(build_prompt_pdf(out_master, master_story, 'マナトビ英検｜全級ChatGPT画像プロンプト総覧台帳（750枚）'))
    return reports


def _verify_and_save_doc(doc: pymupdf.Document, out_path: Path, check_cover_logo: bool, question_page_indices: list[int], overlap_page_indices: list[int]) -> dict:
    doc.save(str(out_path), garbage=4, deflate=True)
    pages = len(doc)
    full_txt = '\n'.join(pg.get_text() for pg in doc)
    if '\ufffd' in full_txt or '\x00' in full_txt:
        raise ValueError(f'Mojibake or NUL in {out_path.name}')
    if check_cover_logo:
        if '過去問の流用禁止' not in doc[0].get_text():
            raise ValueError(f'Missing 過去問の流用禁止 on cover of {out_path.name}')
        if len(doc[0].get_images()) < 1:
            raise ValueError(f'Missing Manatobi brand logo on cover of {out_path.name}')
    for q_idx in question_page_indices:
        qt = doc[q_idx].get_text()
        if '【和訳】' in qt or '【根拠・解き方】' in qt or '正答一覧' in qt:
            raise ValueError(f'Answer/explanation leaked onto question page {q_idx + 1} of {out_path.name}')
    for ov_idx in overlap_page_indices:
        check_no_line_overlaps(doc[ov_idx], f'{out_path.name} p.{ov_idx + 1}')
    return {'file': out_path.name, 'pages': pages, 'bytes': out_path.stat().st_size}


def build_question_and_explanation_booklets() -> tuple[list[dict], list[dict]]:
    """Build:
    1) Per-round authentic Eiken booklets (`_questions.pdf`, `_answers.pdf`, `_explanations.pdf`, `_full_set.pdf`)
       for Round 1 of every grade (and merged into the 15-round master booklet for all 120 rounds).
    2) Per-grade 15-round authentic Eiken master booklets (`listening_booklet_{gid}_15rounds.pdf`)
       with hierarchical PDF bookmarks (Outline) so teachers/students can jump straight to any round's
       Question Booklet, Mark Sheet, or Script/Answer Key!
    """
    master_reports = []
    round1_sample_reports = []

    for grade_obj in BOOKLETS_DATA['grades']:
        gid = grade_obj['id']
        full_label, _, _ = GRADE_META[gid]
        bp = BOOKLETS_DATA['blueprints'][gid]
        exams = sorted([b for b in BOOKLETS_DATA['booklets'] if b['grade'] == gid], key=lambda x: x['round'])

        master_doc = pymupdf.open()
        master_toc = []
        master_q_pages: list[int] = []
        master_overlap_pages: list[int] = [0]

        # Master 15-round cover on page 1
        master_cover_bytes = build_listening_cover_bytes(
            gid, bp, is_15round_master=True, revision=f'manatobi-listening-15r-{BOOKLETS_DATA["sourceHash"][:8]}'
        )
        with pymupdf.open(stream=master_cover_bytes, filetype='pdf') as mcov:
            master_doc.insert_pdf(mcov)
        master_toc.append([1, f'{full_label} リスニング全15回 表紙', 1])

        for exam in exams:
            rnd = exam['round']
            rev = f'manatobi-original-r{rnd:02d}'
            round_cover_bytes = build_listening_cover_bytes(
                gid, bp, round_no=rnd, theme=exam['theme'], revision=rev, is_15round_master=False
            )
            q_body_bytes = build_listening_questions_bytes(gid, rnd, exam, bp, RESOLVED_IMAGES, start_page_no=2)
            a_bytes = build_listening_mark_sheet_bytes(gid, rnd, exam, bp)
            e_bytes = build_listening_explanations_bytes(gid, rnd, exam, bp)

            # Save individual Round 1 split printable set for every grade (8 grades × 4 files = 32 files)
            if rnd == 1:
                prefix = f'{gid}_listening_r{rnd:02d}'
                with pymupdf.open(stream=round_cover_bytes, filetype='pdf') as d_cov, \
                     pymupdf.open(stream=q_body_bytes, filetype='pdf') as d_qb, \
                     pymupdf.open(stream=a_bytes, filetype='pdf') as d_ans, \
                     pymupdf.open(stream=e_bytes, filetype='pdf') as d_exp:

                    # Questions PDF
                    q_doc = pymupdf.open()
                    q_doc.insert_pdf(d_cov)
                    q_doc.insert_pdf(d_qb)
                    q_doc.set_metadata({'title': f'マナトビ {full_label} リスニング 第{rnd}回 問題冊子', 'author': 'マナトビ'})
                    rep_q = _verify_and_save_doc(
                        q_doc, ROUNDS_DIR / f'{prefix}_questions.pdf',
                        check_cover_logo=True,
                        question_page_indices=list(range(1, len(q_doc))),
                        overlap_page_indices=[0],
                    )
                    q_doc.close()

                    # Mark Sheet PDF
                    a_doc = pymupdf.open()
                    a_doc.insert_pdf(d_ans)
                    a_doc.set_metadata({'title': f'マナトビ {full_label} リスニング 第{rnd}回 マークシート', 'author': 'マナトビ'})
                    rep_a = _verify_and_save_doc(
                        a_doc, ROUNDS_DIR / f'{prefix}_answers.pdf',
                        check_cover_logo=False,
                        question_page_indices=[],
                        overlap_page_indices=[0],
                    )
                    a_doc.close()

                    # Explanations PDF
                    e_doc = pymupdf.open()
                    e_doc.insert_pdf(d_exp)
                    e_doc.set_metadata({'title': f'マナトビ {full_label} リスニング 第{rnd}回 解答・放送原稿・解説', 'author': 'マナトビ'})
                    rep_e = _verify_and_save_doc(
                        e_doc, ROUNDS_DIR / f'{prefix}_explanations.pdf',
                        check_cover_logo=False,
                        question_page_indices=[],
                        overlap_page_indices=[],
                    )
                    e_doc.close()

                    # Full Set PDF for Round 1
                    f_doc = pymupdf.open()
                    f_toc = []
                    s1 = len(f_doc) + 1
                    f_doc.insert_pdf(d_cov)
                    f_doc.insert_pdf(d_qb)
                    f_toc.append([1, '問題冊子', s1])
                    q_end_idx = len(f_doc)
                    s2 = len(f_doc) + 1
                    f_doc.insert_pdf(d_ans)
                    f_toc.append([1, '解答用紙（マークシート）', s2])
                    s3 = len(f_doc) + 1
                    f_doc.insert_pdf(d_exp)
                    f_toc.append([1, '解答・放送原稿・解説', s3])
                    f_doc.set_toc(f_toc)
                    f_doc.set_metadata({'title': f'マナトビ {full_label} リスニング 第{rnd}回 フルセット', 'author': 'マナトビ'})
                    rep_f = _verify_and_save_doc(
                        f_doc, ROUNDS_DIR / f'{prefix}_full_set.pdf',
                        check_cover_logo=True,
                        question_page_indices=list(range(1, q_end_idx)),
                        overlap_page_indices=[0, q_end_idx],
                    )
                    f_doc.close()

                    round1_sample_reports.append({
                        'grade': gid,
                        'round': rnd,
                        'fullSet': rep_f,
                        'questions': rep_q,
                        'answers': rep_a,
                        'explanations': rep_e,
                    })

            # Insert this round into the 15-round master booklet with clean bookmarks
            with pymupdf.open(stream=round_cover_bytes, filetype='pdf') as d_cov, \
                 pymupdf.open(stream=q_body_bytes, filetype='pdf') as d_qb, \
                 pymupdf.open(stream=a_bytes, filetype='pdf') as d_ans, \
                 pymupdf.open(stream=e_bytes, filetype='pdf') as d_exp:

                r_start_page = len(master_doc) + 1
                master_overlap_pages.append(len(master_doc))  # round cover
                master_doc.insert_pdf(d_cov)

                q_start_idx = len(master_doc)
                master_doc.insert_pdf(d_qb)
                q_end_idx = len(master_doc)
                master_q_pages.extend(range(q_start_idx, q_end_idx))

                a_page_1based = len(master_doc) + 1
                master_overlap_pages.append(len(master_doc))  # mark sheet
                master_doc.insert_pdf(d_ans)

                e_page_1based = len(master_doc) + 1
                master_doc.insert_pdf(d_exp)

                master_toc.append([1, f'第{rnd}回（題材：{exam["theme"]}）', r_start_page])
                master_toc.append([2, f'第{rnd}回 問題冊子', r_start_page])
                master_toc.append([2, f'第{rnd}回 マークシート', a_page_1based])
                master_toc.append([2, f'第{rnd}回 解答・放送原稿・解説', e_page_1based])

        master_doc.set_toc(master_toc)
        master_doc.set_metadata({
            'title': f'マナトビ {full_label}形式 リスニングテスト 全15回（問題冊子・マークシート・放送原稿・解説）',
            'author': 'マナトビ',
        })
        out_path = PDF_DIR / f'listening_booklet_{gid}_15rounds.pdf'
        master_reports.append(
            _verify_and_save_doc(
                master_doc,
                out_path,
                check_cover_logo=True,
                question_page_indices=master_q_pages,
                overlap_page_indices=master_overlap_pages,
            )
        )
        master_doc.close()

    return master_reports, round1_sample_reports


if __name__ == '__main__':
    audio_rep = build_elevenlabs_audio_pdfs()
    image_rep = build_chatgpt_image_pdfs()
    booklet_rep, round1_rep = build_question_and_explanation_booklets()
    manifest = {
        'elevenLabsAudioPromptPdfs': audio_rep,
        'chatGptImagePromptPdfs': image_rep,
        'listeningBookletPdfs': booklet_rep,
        'listeningRound1SplitPdfs': round1_rep,
    }
    (PDF_DIR / 'pdf-generation-report.json').write_text(json.dumps(manifest, indent=2, ensure_ascii=False) + '\n', 'utf-8')
    print(
        f'Generated {len(audio_rep)} ElevenLabs PDFs, {len(image_rep)} ChatGPT Image PDFs, '
        f'{len(booklet_rep)} 15-Round Authentic Booklet PDFs, and {len(round1_rep) * 4} Round-1 Split PDFs.'
    )
