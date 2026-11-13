"""Build unified Primary Exam (一次試験：筆記・リーディング・ライティング ＋ リスニング) PDFs
for every (grade, round) pair present in BOTH `written-booklets.json` and `listening-booklets.json`.

For each paired round (currently all 16 rounds from PR #10: 5級 R1-2, 4級 R1-2, 3級 R1-4,
準2級 R1-2, 準2級プラス R1-2, 2級 R1-2, 準1級 R1-2), outputs:
  1) {grade}_primary_r{round:02d}_full_set.pdf     (Unified Cover + Written Q + Listening Q + Unified Answer Sheet + Written Exp + Listening Exp)
  2) {grade}_primary_r{round:02d}_questions.pdf    (Unified Cover + Written Q + Listening Q)
  3) {grade}_primary_r{round:02d}_answers.pdf      (Written Mark/Writing Sheet + Listening Mark Sheet)
  4) {grade}_primary_r{round:02d}_explanations.pdf (Written Exp + Listening Exp)

Every cover embeds `public/brand/manatobi-logo-gray.png` and explicitly states 「過去問の流用禁止」.
"""
from pathlib import Path
from html import escape
import io
import json
from reportlab import rl_config
rl_config.invariant = True
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4, landscape
from reportlab.lib.styles import ParagraphStyle
from reportlab.pdfgen import canvas as rl_canvas
from reportlab.platypus import (
    SimpleDocTemplate,
    Paragraph,
    Spacer,
    Table,
    TableStyle,
    Image as RLImage,
    KeepTogether,
)
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
import pymupdf

ROOT = Path(__file__).resolve().parents[1]
PUBLIC = ROOT / 'public'
DELIV = ROOT / 'deliverables'
BUNDLE_DIR = DELIV / 'pdfs' / 'primary_bundles'
BUNDLE_DIR.mkdir(parents=True, exist_ok=True)

WRITTEN_DATA = json.loads((DELIV / 'written-booklets.json').read_text('utf-8'))
LISTENING_DATA = json.loads((DELIV / 'listening-booklets.json').read_text('utf-8'))
RESOLVED_IMAGES_PATH = DELIV / 'listening_resolved_images.json'
RESOLVED_IMAGES: dict[str, str] = (
    json.loads(RESOLVED_IMAGES_PATH.read_text('utf-8')) if RESOLVED_IMAGES_PATH.exists() else {}
)

LOGO_PATH = PUBLIC / 'brand/manatobi-logo-gray.png'
pdfmetrics.registerFont(TTFont('BookletJP', str(PUBLIC / 'fonts/booklet-noto-serif-jp.ttf')))
WIDTH, HEIGHT = A4

STYLES = {
    'kicker': ParagraphStyle('kicker', fontName='BookletJP', fontSize=10, leading=15, textColor=colors.HexColor('#1f5f66'), spaceAfter=6),
    'title': ParagraphStyle('title', fontName='BookletJP', fontSize=23, leading=33, textColor=colors.HexColor('#102a43'), spaceAfter=10),
    'sub': ParagraphStyle('sub', fontName='BookletJP', fontSize=12.5, leading=19, textColor=colors.HexColor('#334e68'), spaceAfter=12),
    'ban': ParagraphStyle('ban', fontName='BookletJP', fontSize=10, leading=15.5, textColor=colors.HexColor('#7b1e1e'), wordWrap='CJK'),
    'h1': ParagraphStyle('h1', fontName='BookletJP', fontSize=15, leading=22, textColor=colors.HexColor('#102a43'), spaceBefore=4, spaceAfter=8),
    'h2': ParagraphStyle('h2', fontName='BookletJP', fontSize=11.2, leading=16.5, textColor=colors.HexColor('#1f5f66'), spaceBefore=5, spaceAfter=4, wordWrap='CJK'),
    'jp': ParagraphStyle('jp', fontName='BookletJP', fontSize=9.6, leading=15, spaceAfter=4, wordWrap='CJK'),
    'meta': ParagraphStyle('meta', fontName='BookletJP', fontSize=8.3, leading=12.8, textColor=colors.HexColor('#486581'), spaceAfter=3, wordWrap='CJK'),
    'en': ParagraphStyle('en', fontName='Times-Roman', fontSize=10.6, leading=15.8, spaceAfter=4),
}


def p(text: str, style: str = 'jp') -> Paragraph:
    safe = escape(str(text)).replace('\n', '<br/>')
    return Paragraph(safe, STYLES[style])


def render_story_bytes(story: list, header_left: str) -> bytes:
    buf = io.BytesIO()

    def on_page(canvas, doc):
        canvas.saveState()
        canvas.setStrokeColor(colors.HexColor('#cbd5e1'))
        canvas.setLineWidth(0.4)
        canvas.line(42, HEIGHT - 32, WIDTH - 42, HEIGHT - 32)
        canvas.setFont('BookletJP', 7.5)
        canvas.setFillColor(colors.HexColor('#486581'))
        canvas.drawString(42, HEIGHT - 24, header_left)
        canvas.drawString(42, 22, 'まなとび英検｜一次試験統合版（過去問の流用禁止）｜origin: manatobi-original')
        canvas.drawRightString(WIDTH - 42, 22, f'Listening Section p.{doc.page}')
        canvas.restoreState()

    SimpleDocTemplate(
        buf,
        pagesize=A4,
        leftMargin=42,
        rightMargin=42,
        topMargin=42,
        bottomMargin=38,
        title=header_left,
        author='まなとび英検',
        pageCompression=1,
    ).build(story, onFirstPage=on_page, onLaterPages=on_page)
    return buf.getvalue()


def build_unified_cover_bytes(glabel: str, rnd: int, w_minutes: int, w_count: int, l_minutes: int, l_count: int, l_parts: list) -> bytes:
    logo = RLImage(str(LOGO_PATH), width=132, height=42)
    logo.hAlign = 'RIGHT'

    ban_text = (
        '【重要規定｜過去問の流用禁止】\n'
        '・本冊子（一次試験：リーディング・ライティング＋リスニング統合セット）はすべて「まなとび英検」完全独自作成（origin: manatobi-original）です。\n'
        '・英検過去問および市販教材の転載・言い換え流用・固有名詞や数値のみの置換流用は一切禁止・不使用です（過去問の流用禁止）。\n'
        '・公式模試・公式問題ではなく、合否判定やCSEスコア換算を行うものではありません。'
    )
    ban_tbl = Table([[p(ban_text, 'ban')]], colWidths=[WIDTH - 84])
    ban_tbl.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor('#fff5f5')),
        ('BOX', (0, 0), (-1, -1), 1.0, colors.HexColor('#c53030')),
        ('PADDING', (0, 0), (-1, -1), 9),
    ]))

    rows = [
        [p('試験区分', 'h2'), p('目安時間', 'h2'), p('設問数・構成', 'h2')],
        [p('一次：筆記（リーディング・ライティング）'), p(f'{w_minutes}分'), p(f'全{w_count}題（語彙・文法・長文読解・英作文）')],
        [
            p('一次：リスニング'),
            p(f'{l_minutes}分'),
            p(f'全{l_count}問（' + ' ／ '.join(f'{pt["label"]} {pt["questionCount"]}問' for pt in l_parts) + '）'),
        ],
    ]
    summary_tbl = Table(rows, colWidths=[175, 70, WIDTH - 329], hAlign='LEFT')
    summary_tbl.setStyle(TableStyle([
        ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#94a3b8')),
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#f1f5f9')),
        ('PADDING', (0, 0), (-1, -1), 6),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
    ]))

    story = [
        logo,
        Spacer(1, 10),
        p('MANATOBI EIKEN — FULL PRIMARY EXAM BUNDLE (WRITTEN + LISTENING)', 'kicker'),
        p(f'{glabel}　第{rnd}回\n一次試験（筆記＋リスニング）統合予想問題セット', 'title'),
        p(f'筆記 {w_minutes}分（{w_count}題）＋ リスニング {l_minutes}分（{l_count}問）｜問題・マーク＆記述解答用紙・全肢解説収録', 'sub'),
        ban_tbl,
        Spacer(1, 14),
        p('試験構成一覧', 'h1'),
        summary_tbl,
        Spacer(1, 16),
        p('受験・印刷ガイド', 'h1'),
        p('1. 前半に「一次筆記（リーディング・語彙文法・ライティング）」、続けて「リスニング問題」を収録しています。\n'
          '2. 解答用紙には筆記マーク欄・ライティング解答欄（3級〜準1級）に加え、リスニング専用マークシートが付属しています。\n'
          '3. すべての問題を解き終えてから、後半の「筆記 解答・解説」および「リスニング スクリプト・和訳・全肢解説」を確認してください。'),
        Spacer(1, 18),
        p('受験者氏名：________________________________________　　実施日：____年____月____日', 'jp'),
    ]
    return render_story_bytes(story, f'まなとび英検｜{glabel} 第{rnd}回 一次試験（筆記＋リスニング）統合セット')


def build_listening_questions_bytes(glabel: str, rnd: int, l_exam: dict, l_bp: dict) -> bytes:
    total_q = sum(len(u['questions']) for u in l_exam['units'])
    story = [
        p(f'{glabel} 第{rnd}回　リスニング問題（全{total_q}問／目安 {l_bp["minutes"]}分）', 'h1'),
        p(f'テーマ：{l_exam["theme"]} ｜ 重点スキル：{l_exam["focusSkill"]} ｜ 過去問の流用禁止（完全独自作成）', 'meta'),
        Spacer(1, 6),
    ]
    cur_part = None
    part_labels = {pt['id']: pt['label'] for pt in l_bp['parts']}
    for unit in l_exam['units']:
        if unit['part'] != cur_part:
            cur_part = unit['part']
            story.append(p(f'■ {part_labels[cur_part]}（音声は{unit["readCount"]}回流れます）', 'h2'))
        u_elems = []
        if unit.get('material'):
            mat = unit['material']
            u_elems.append(p(f'【印刷資料】{mat["title"]}', 'jp'))
            u_elems.append(p(f'Situation: {mat["situation"]}', 'en'))
            if mat.get('headers') and mat.get('rows'):
                cw = (WIDTH - 96) / len(mat['headers'])
                t_rows = [[p(h, 'meta') for h in mat['headers']]] + [[p(c, 'meta') for c in r] for r in mat['rows']]
                tbl = Table(t_rows, colWidths=[cw] * len(mat['headers']), hAlign='LEFT')
                tbl.setStyle(TableStyle([
                    ('GRID', (0, 0), (-1, -1), 0.4, colors.HexColor('#94a3b8')),
                    ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#e2e8f0')),
                    ('PADDING', (0, 0), (-1, -1), 4),
                ]))
                u_elems.append(tbl)
            if mat.get('notes'):
                for nt in mat['notes']:
                    u_elems.append(p(f'* {nt}', 'meta'))
        elif unit.get('image'):
            img_local = RESOLVED_IMAGES.get(unit['audioId'])
            if img_local and Path(img_local).exists():
                fig = RLImage(img_local, width=168, height=126)
                fig.hAlign = 'LEFT'
                u_elems.append(fig)
                u_elems.append(Spacer(1, 3))
            else:
                u_elems.append(p(f'［イラスト枠：{unit["image"]["targetPath"]}｜場面：{unit["image"]["sceneSummaryJa"]}］', 'meta'))

        for q in unit['questions']:
            if q['choicePresentation'] == 'read-aloud':
                u_elems.append(p(f'No.{q["questionNumber"]}　（音声で読み上げられる選択肢 1〜{len(q["choices"])} から最も適切なものを1つ選ぶ）', 'jp'))
            else:
                opts = '    '.join(f'{i + 1}. {c}' for i, c in enumerate(q['choices']))
                u_elems.append(p(f'No.{q["questionNumber"]}  {q["questionPrompt"]}', 'en'))
                u_elems.append(p(opts, 'en'))
        u_elems.append(Spacer(1, 4))
        story.append(KeepTogether(u_elems))
    return render_story_bytes(story, f'まなとび英検｜{glabel} 第{rnd}回 リスニング問題')


def build_listening_mark_sheet_bytes(glabel: str, rnd: int, l_exam: dict) -> bytes:
    buf = io.BytesIO()
    lw, lh = landscape(A4)
    c = rl_canvas.Canvas(buf, pagesize=(lw, lh))
    c.setFont('BookletJP', 15)
    c.setFillColor(colors.HexColor('#102a43'))
    c.drawString(42, lh - 42, f'まなとび英検｜{glabel} 第{rnd}回　リスニング マーク解答用紙（過去問の流用禁止）')
    c.setFont('BookletJP', 9.5)
    c.setFillColor(colors.HexColor('#334e68'))
    c.drawString(42, lh - 62, '氏名：____________________________　　得点：______ / ' + str(sum(len(u['questions']) for u in l_exam['units'])))

    questions = [q for u in l_exam['units'] for q in u['questions']]
    per_col = 10
    for idx, q in enumerate(questions):
        col = idx // per_col
        row = idx % per_col
        x0 = 48 + col * 255
        y0 = lh - 108 - row * 42
        c.setStrokeColor(colors.HexColor('#cbd5e1'))
        c.setLineWidth(0.5)
        c.rect(x0 - 6, y0 - 12, 235, 32, stroke=1, fill=0)
        c.setFont('Helvetica-Bold', 10.5)
        c.setFillColor(colors.HexColor('#102a43'))
        c.drawString(x0 + 4, y0, f'No.{q["questionNumber"]:02d}')
        for opt_idx in range(len(q['choices'])):
            cx = x0 + 74 + opt_idx * 42
            cy = y0 + 4
            c.setStrokeColor(colors.HexColor('#334e68'))
            c.setLineWidth(0.9)
            c.circle(cx, cy, 9, stroke=1, fill=0)
            c.setFont('Helvetica', 9.5)
            c.drawCentredString(cx, cy - 3.2, str(opt_idx + 1))

    c.setFont('BookletJP', 8)
    c.setFillColor(colors.HexColor('#486581'))
    c.drawString(42, 24, 'まなとび英検｜完全独自作成（origin: manatobi-original・過去問の流用禁止）')
    c.showPage()
    c.save()
    return buf.getvalue()


def build_listening_explanations_bytes(glabel: str, rnd: int, l_exam: dict) -> bytes:
    questions = [q for u in l_exam['units'] for q in u['questions']]
    story = [
        p(f'{glabel} 第{rnd}回　リスニング 正答一覧・スクリプト・全肢解説', 'h1'),
        p('正答早見表', 'h2'),
    ]
    key_rows = []
    for start in range(0, len(questions), 5):
        row = [p(f'No.{questions[i]["questionNumber"]:02d}：{questions[i]["answer"] + 1}', 'jp') for i in range(start, min(start + 5, len(questions)))]
        while len(row) < 5:
            row.append(p('', 'jp'))
        key_rows.append(row)
    kt = Table(key_rows, colWidths=[(WIDTH - 84) / 5] * 5, hAlign='LEFT')
    kt.setStyle(TableStyle([
        ('GRID', (0, 0), (-1, -1), 0.4, colors.HexColor('#cbd5e1')),
        ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor('#f8fafc')),
        ('PADDING', (0, 0), (-1, -1), 4),
    ]))
    story += [kt, Spacer(1, 10)]

    for unit in l_exam['units']:
        q_nos = '・'.join(f'No.{q["questionNumber"]}' for q in unit['questions'])
        elems = [
            p(f'■ {q_nos}（音源ID: {unit["audioId"]} ／ 本試験読み回数: {unit["readCount"]}回）', 'h2'),
            p(unit['elevenLabsDialogueInput'], 'en'),
            p(f'【和訳】{unit["translation"]}', 'jp'),
        ]
        for q in unit['questions']:
            elems.append(p(f'No.{q["questionNumber"]} 正答：{q["answer"] + 1} ｜ 根拠：{q["evidence"]} ｜ 解説：{q["explanation"]}', 'jp'))
            for ci, c_txt in enumerate(q['choices']):
                mark = '◎' if ci == q['answer'] else '×'
                elems.append(p(f'  {mark} {ci + 1}. {c_txt} — {q["distractorReasons"][ci]}', 'meta'))
        elems.append(Spacer(1, 5))
        story.append(KeepTogether(elems))
    return render_story_bytes(story, f'まなとび英検｜{glabel} 第{rnd}回 リスニング解答・全肢解説')


def merge_and_verify(out_path: Path, sources: list[tuple[bytes | Path, int]], check_cover_logo: bool = False) -> dict:
    merged = pymupdf.open()
    for src, start_page in sources:
        doc = pymupdf.open(src) if isinstance(src, Path) else pymupdf.open(stream=src, filetype='pdf')
        if start_page < len(doc):
            merged.insert_pdf(doc, from_page=start_page, to_page=len(doc) - 1)
        doc.close()
    merged.save(str(out_path), garbage=4, deflate=True)
    pages = len(merged)
    full_txt = '\n'.join(pg.get_text() for pg in merged)
    if '\ufffd' in full_txt or '\x00' in full_txt:
        raise ValueError(f'Mojibake or NUL in {out_path.name}')
    if check_cover_logo:
        if '過去問の流用禁止' not in merged[0].get_text():
            raise ValueError(f'Missing provenance rule on cover of {out_path.name}')
        if len(merged[0].get_images()) < 1:
            raise ValueError(f'Missing Manatobi brand logo on cover of {out_path.name}')
    merged.close()
    return {'file': out_path.name, 'pages': pages, 'bytes': out_path.stat().st_size}


def main():
    grade_labels = {g['id']: g['label'] for g in LISTENING_DATA['grades']}
    written_map = {(b['grade'], b['round']): b for b in WRITTEN_DATA['booklets']}
    listening_map = {(b['grade'], b['round']): b for b in LISTENING_DATA['booklets']}

    paired_keys = sorted(set(written_map.keys()) & set(listening_map.keys()))
    if not paired_keys:
        raise RuntimeError('No paired (grade, round) booklets found.')

    reports = []
    for grade, rnd in paired_keys:
        w_exam = written_map[(grade, rnd)]
        l_exam = listening_map[(grade, rnd)]
        glabel = grade_labels[grade]
        w_bp = WRITTEN_DATA['blueprints'][grade]
        l_bp = LISTENING_DATA['blueprints'][grade]
        w_base = PUBLIC / 'prints' / f'print_{grade}_written_{rnd:02d}'
        w_q_pdf = Path(f'{w_base}_questions.pdf')
        w_a_pdf = Path(f'{w_base}_answers.pdf')
        w_e_pdf = Path(f'{w_base}_explanations.pdf')

        l_q_count = sum(len(u['questions']) for u in l_exam['units'])
        cover_bytes = build_unified_cover_bytes(
            glabel, rnd, w_bp['minutes'], len(w_exam['items']), l_bp['minutes'], l_q_count, l_bp['parts']
        )
        l_q_bytes = build_listening_questions_bytes(glabel, rnd, l_exam, l_bp)
        l_a_bytes = build_listening_mark_sheet_bytes(glabel, rnd, l_exam)
        l_e_bytes = build_listening_explanations_bytes(glabel, rnd, l_exam)

        bundle_prefix = f'{grade}_primary_r{rnd:02d}'

        # 1) Full all-in-one primary bundle PDF (Cover + Written Q body + Listening Q + Written Ans + Listening Ans + Written Exp + Listening Exp)
        full_out = BUNDLE_DIR / f'{bundle_prefix}_full_set.pdf'
        rep_full = merge_and_verify(
            full_out,
            [
                (cover_bytes, 0),
                (w_q_pdf, 1),   # skip single-written cover, use unified cover on p.1
                (l_q_bytes, 0),
                (w_a_pdf, 0),
                (l_a_bytes, 0),
                (w_e_pdf, 0),
                (l_e_bytes, 0),
            ],
            check_cover_logo=True,
        )

        # 2) Unified Question Booklet
        q_out = BUNDLE_DIR / f'{bundle_prefix}_questions.pdf'
        rep_q = merge_and_verify(q_out, [(cover_bytes, 0), (w_q_pdf, 1), (l_q_bytes, 0)], check_cover_logo=True)

        # 3) Unified Answer Sheet (Written mark/writing + Listening mark)
        a_out = BUNDLE_DIR / f'{bundle_prefix}_answers.pdf'
        rep_a = merge_and_verify(a_out, [(w_a_pdf, 0), (l_a_bytes, 0)], check_cover_logo=False)

        # 4) Unified Explanations Booklet
        e_out = BUNDLE_DIR / f'{bundle_prefix}_explanations.pdf'
        rep_e = merge_and_verify(e_out, [(w_e_pdf, 0), (l_e_bytes, 0)], check_cover_logo=False)

        reports.append({
            'bundleId': bundle_prefix,
            'grade': grade,
            'round': rnd,
            'fullSet': rep_full,
            'questions': rep_q,
            'answers': rep_a,
            'explanations': rep_e,
        })

    (BUNDLE_DIR / 'primary-bundles-report.json').write_text(json.dumps(reports, indent=2, ensure_ascii=False) + '\n', 'utf-8')
    print(f'Successfully built and verified {len(reports)} unified Primary Exam bundles ({len(reports) * 4} PDFs total).')


if __name__ == '__main__':
    main()
