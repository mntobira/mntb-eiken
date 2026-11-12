"""Build strictly separated PDFs from deliverables/listening-booklets.json:
1) ElevenLabs Audio Prompt PDFs (per grade, 8 PDFs, 3,285 audio units total)
2) ChatGPT Image Prompt PDFs (per grade with images + combined 750-prompt master PDF)
3) Listening Mock Exam Question + Answer & Full Rationale Booklets (per grade, 8 PDFs, 120 rounds / 3,465 questions)

Every cover explicitly states: 「過去問の流用禁止（完全独自作成・origin: manatobi-original）」.
Validates every generated PDF with PyMuPDF for zero U+FFFD / NUL characters.
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
)
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
import pymupdf

ROOT = Path(__file__).resolve().parents[1]
PUBLIC = ROOT / 'public'
DELIV = ROOT / 'deliverables'
PDF_DIR = DELIV / 'pdfs'
PDF_DIR.mkdir(parents=True, exist_ok=True)

BOOKLETS_DATA = json.loads((DELIV / 'listening-booklets.json').read_text('utf-8'))
AUDIO_DATA = json.loads((DELIV / 'eiken-elevenlabs-audio-prompts.json').read_text('utf-8'))
IMAGE_DATA = json.loads((DELIV / 'eiken-chatgpt-image-prompts.json').read_text('utf-8'))

pdfmetrics.registerFont(TTFont('BookletJP', str(PUBLIC / 'fonts/booklet-noto-serif-jp.ttf')))
WIDTH, HEIGHT = A4

STYLES = {
    'cover_kicker': ParagraphStyle('cover_kicker', fontName='BookletJP', fontSize=10, leading=15, textColor=colors.HexColor('#1f5f66'), spaceAfter=8),
    'cover_title': ParagraphStyle('cover_title', fontName='BookletJP', fontSize=23, leading=33, textColor=colors.HexColor('#102a43'), spaceAfter=12),
    'cover_sub': ParagraphStyle('cover_sub', fontName='BookletJP', fontSize=13, leading=20, textColor=colors.HexColor('#334e68'), spaceAfter=14),
    'ban_box': ParagraphStyle('ban_box', fontName='BookletJP', fontSize=10.5, leading=16, textColor=colors.HexColor('#7b1e1e'), wordWrap='CJK'),
    'h1': ParagraphStyle('h1', fontName='BookletJP', fontSize=15, leading=22, textColor=colors.HexColor('#102a43'), spaceBefore=6, spaceAfter=8),
    'h2': ParagraphStyle('h2', fontName='BookletJP', fontSize=11.5, leading=17, textColor=colors.HexColor('#1f5f66'), spaceBefore=5, spaceAfter=4, wordWrap='CJK'),
    'jp': ParagraphStyle('jp', fontName='BookletJP', fontSize=9.5, leading=15, spaceAfter=4, wordWrap='CJK'),
    'meta': ParagraphStyle('meta', fontName='BookletJP', fontSize=8.2, leading=12.5, textColor=colors.HexColor('#486581'), spaceAfter=3, wordWrap='CJK'),
    'en': ParagraphStyle('en', fontName='Times-Roman', fontSize=10.2, leading=14.8, spaceAfter=4),
    'mono': ParagraphStyle('mono', fontName='Courier', fontSize=8.3, leading=11.8, spaceAfter=4),
}


def p(text: str, style: str = 'jp') -> Paragraph:
    safe = escape(str(text)).replace('\n', '<br/>')
    return Paragraph(safe, STYLES[style])


def provenance_banner() -> Table:
    txt = (
        '【重要規定｜過去問の流用禁止】\n'
        '・本資料および収録問題・英語台本・選択肢・解説・図版プロンプトはすべて「まなとび英検」向けに書き起こした完全独自作成（origin: manatobi-original）です。\n'
        '・英検過去問および市販教材の本文転載・言い換え流用・固有名詞／数値のみの置換流用は一切行っていません（過去問の流用禁止）。\n'
        '・本PDFはオフライン制作用であり、公式問題・公式音源ではありません。'
    )
    tbl = Table([[p(txt, 'ban_box')]], colWidths=[WIDTH - 84])
    tbl.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor('#fff5f5')),
        ('BOX', (0, 0), (-1, -1), 1.0, colors.HexColor('#c53030')),
        ('LEFTPADDING', (0, 0), (-1, -1), 10),
        ('RIGHTPADDING', (0, 0), (-1, -1), 10),
        ('TOPPADDING', (0, 0), (-1, -1), 8),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
    ]))
    return tbl


def code_box(text: str, bg: str = '#f8fafc', border: str = '#cbd5e1', style: str = 'en') -> Table:
    tbl = Table([[p(text, style)]], colWidths=[WIDTH - 84])
    tbl.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor(bg)),
        ('BOX', (0, 0), (-1, -1), 0.6, colors.HexColor(border)),
        ('LEFTPADDING', (0, 0), (-1, -1), 8),
        ('RIGHTPADDING', (0, 0), (-1, -1), 8),
        ('TOPPADDING', (0, 0), (-1, -1), 6),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
    ]))
    return tbl


def build_pdf(path: Path, story: list, header_left: str) -> dict:
    def on_page(canvas, doc):
        canvas.saveState()
        canvas.setStrokeColor(colors.HexColor('#cbd5e1'))
        canvas.setLineWidth(0.4)
        canvas.line(42, HEIGHT - 32, WIDTH - 42, HEIGHT - 32)
        canvas.setFont('BookletJP', 7.5)
        canvas.setFillColor(colors.HexColor('#486581'))
        canvas.drawString(42, HEIGHT - 24, header_left)
        canvas.drawString(42, 22, 'まなとび英検｜完全独自作成（過去問の流用禁止）｜origin: manatobi-original')
        canvas.drawRightString(WIDTH - 42, 22, f'Page {doc.page}')
        canvas.restoreState()

    SimpleDocTemplate(
        str(path),
        pagesize=A4,
        leftMargin=42,
        rightMargin=42,
        topMargin=42,
        bottomMargin=38,
        title=header_left,
        author='まなとび英検',
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
            Spacer(1, 24),
            p('MANATOBI EIKEN — ELEVENLABS AUDIO PROMPT BOOK (SEPARATE VOLUME)', 'cover_kicker'),
            p(f'{glabel}\nElevenLabs 音声生成プロンプト・収録台本集（全15回）', 'cover_title'),
            p(f'収録音源数：{len(items)} ファイル（1回{bp["totalAudioFiles"]}音源×15回）｜目標速度：{bp["wpmRange"][0]}〜{bp["wpmRange"][1]} WPM', 'cover_sub'),
            provenance_banner(),
            Spacer(1, 14),
            p('ElevenLabs（Text to Dialogue）投入ルール', 'h1'),
            p('1. 本PDFは【音声プロンプト専用】の別冊です（ChatGPT画像プロンプト集とは別ファイルに分離しています）。'),
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
                code_box(it['elevenLabsDialogueInput'], bg='#f8fafc', border='#94a3b8', style='en'),
                Spacer(1, 5),
            ])
            story.append(block)

        out_path = PDF_DIR / f'elevenlabs_audio_prompts_{gid}.pdf'
        reports.append(build_pdf(out_path, story, f'まなとび英検｜{glabel} ElevenLabs音声プロンプト集（全15回）'))
    return reports


def build_chatgpt_image_pdfs() -> list[dict]:
    reports = []
    source_hash = IMAGE_DATA['sourceHash'][:16]
    grades_with_images = [g for g in BOOKLETS_DATA['grades'] if BOOKLETS_DATA['blueprints'][g['id']]['totalImages'] > 0]

    # 級別画像プロンプトPDF（5級・4級・3級・準1級・1級）
    for grade_obj in grades_with_images:
        gid = grade_obj['id']
        glabel = grade_obj['label']
        bp = BOOKLETS_DATA['blueprints'][gid]
        items = [it for it in IMAGE_DATA['items'] if it['grade'] == gid]

        story = [
            Spacer(1, 24),
            p('MANATOBI EIKEN — CHATGPT IMAGE PROMPT BOOK (SEPARATE VOLUME)', 'cover_kicker'),
            p(f'{glabel}\nChatGPT 画像生成プロンプト集（全15回）', 'cover_title'),
            p(f'収録図版プロンプト数：{len(items)} 枚（1回{bp["totalImages"]}枚×15回）｜白黒線画・文字完全禁止仕様', 'cover_sub'),
            provenance_banner(),
            Spacer(1, 14),
            p('ChatGPT（GPT Image）投入ルール', 'h1'),
            p('1. 本PDFは【画像プロンプト専用】の別冊です（ElevenLabs音声プロンプト集とは完全に別ファイルとして出力しています）。'),
            p('2. 準2級・準2級プラス・2級は本試験仕様どおりリスニング図版が 0 枚のため、図版が存在する5つの級（5級・4級・3級・準1級・1級、計750枚）を収録しています。'),
            p('3. 各プロンプトを投入する際は、共通スタイル参照線画1枚を添付し、生成画像に文字・数字・記号が一切入っていないことを確認して保存先パスへ格納してください。'),
            p('4. 準1級・1級 第3部（Real-Life形式）は白紙の表レイアウト枠のみを生成し、正確な英文・数値条件はアプリ／PDF側で組版重畳します。'),
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
                code_box(it['chatGptPrompt'], bg='#fffaf0', border='#dd6b20', style='mono'),
                Spacer(1, 6),
            ])
            story.append(block)

        out_path = PDF_DIR / f'chatgpt_image_prompts_{gid}.pdf'
        reports.append(build_pdf(out_path, story, f'まなとび英検｜{glabel} ChatGPT画像プロンプト集（全15回）'))

    # 全750枚 総覧インデックス＋第1回代表プロンプト集（軽量マスター確認用）
    master_story = [
        Spacer(1, 24),
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
        ('GRID', (0, 0), (-1, -1), 0.4, colors.HexColor('#cbd5e1')),
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#f1f5f9')),
        ('PADDING', (0, 0), (-1, -1), 5),
    ]))
    master_story += [t, Spacer(1, 12), p('全750件のファイルパス＆場面要旨一覧', 'h1')]
    for it in IMAGE_DATA['items']:
        master_story.append(p(f'{it["targetImagePath"]} [{it["gradeLabel"]} 第{it["round"]}回 No.{it["questionNumbers"][0]} / {it["role"]} / {it["aspectRatio"]}] — {it["sceneSummaryJa"]}', 'meta'))
    out_master = PDF_DIR / 'chatgpt_image_prompts_master_index_750.pdf'
    reports.append(build_pdf(out_master, master_story, 'まなとび英検｜全級ChatGPT画像プロンプト総覧台帳（750枚）'))
    return reports


def render_material_table(mat: dict) -> list:
    elems = [
        p(f'【印刷資料】{mat["title"]}', 'h2'),
        p(f'Situation: {mat["situation"]}', 'en'),
    ]
    if mat.get('headers') and mat.get('rows'):
        col_count = len(mat['headers'])
        col_w = (WIDTH - 96) / col_count
        t_rows = [[p(h, 'meta') for h in mat['headers']]]
        for r in mat['rows']:
            t_rows.append([p(cell, 'meta') for cell in r])
        tbl = Table(t_rows, colWidths=[col_w] * col_count, hAlign='LEFT')
        tbl.setStyle(TableStyle([
            ('GRID', (0, 0), (-1, -1), 0.4, colors.HexColor('#94a3b8')),
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#e2e8f0')),
            ('PADDING', (0, 0), (-1, -1), 4),
        ]))
        elems.append(tbl)
    if mat.get('notes'):
        for nt in mat['notes']:
            elems.append(p(f'* {nt}', 'meta'))
    elems.append(Spacer(1, 4))
    return elems


def build_question_and_explanation_booklets() -> list[dict]:
    reports = []
    for grade_obj in BOOKLETS_DATA['grades']:
        gid = grade_obj['id']
        glabel = grade_obj['label']
        bp = BOOKLETS_DATA['blueprints'][gid]
        exams = [b for b in BOOKLETS_DATA['booklets'] if b['grade'] == gid]

        story = [
            Spacer(1, 24),
            p('MANATOBI EIKEN — LISTENING MOCK EXAMS (15 ROUNDS)', 'cover_kicker'),
            p(f'{glabel}\nリスニング予想問題・正答・全肢解説冊子（全15回）', 'cover_title'),
            p(f'全15回収録（1回{bp["totalQuestions"]}問×15回＝計{bp["totalQuestions"] * 15}問）｜目安時間：{bp["minutes"]}分', 'cover_sub'),
            provenance_banner(),
            Spacer(1, 12),
            p('構成と使い方', 'h1'),
            p('・各回ごとに「問題パート（印刷選択肢・Real-Life条件表・図版場面ガイド）」に続けて「正答一覧・和訳・根拠・全選択肢解説」を収録しています。'),
            p('・音声読み上げ形式（3肢読み上げ）の設問は、本番冊子と同様に問題欄では選択肢英文を伏せ、解説欄に全選択肢の英文と正誤理由を掲載しています。'),
            p('・ElevenLabs音声プロンプト集PDFおよびChatGPT画像プロンプト集PDFは、制作工程で混同しないよう別ファイルとして出力しています。'),
            PageBreak(),
        ]

        for exam in exams:
            story.append(p(f'{glabel} リスニング予想問題 第{exam["round"]}回（テーマ：{exam["theme"]}／重点：{exam["focusSkill"]}）', 'h1'))
            story.append(p('【問題セクション】', 'h2'))
            for unit in exam['units']:
                u_elems = []
                if unit.get('material'):
                    u_elems.extend(render_material_table(unit['material']))
                elif unit.get('image'):
                    u_elems.append(p(f'［図版枠：{unit["image"]["targetPath"]}｜場面：{unit["image"]["sceneSummaryJa"]}］', 'meta'))

                for q in unit['questions']:
                    if q['choicePresentation'] == 'read-aloud':
                        u_elems.append(p(f'No.{q["questionNumber"]}　（音声で読み上げられる 1〜{len(q["choices"])} から最も適切なものを1つ選ぶ）', 'jp'))
                    else:
                        opts = '   '.join(f'{i + 1}. {c}' for i, c in enumerate(q['choices']))
                        u_elems.append(p(f'No.{q["questionNumber"]}  {q["questionPrompt"]}', 'en'))
                        u_elems.append(p(opts, 'en'))
                story.append(KeepTogether(u_elems))

            story.append(Spacer(1, 8))
            story.append(p(f'【第{exam["round"]}回 正答・スクリプト和訳・全肢解説】', 'h2'))
            for unit in exam['units']:
                q_nos = '・'.join(f'No.{q["questionNumber"]}' for q in unit['questions'])
                exp_elems = [
                    p(f'■ {q_nos}（音源ID: {unit["audioId"]}）', 'meta'),
                    p(f'【和訳】{unit["translation"]}', 'jp'),
                ]
                for q in unit['questions']:
                    exp_elems.append(p(f'No.{q["questionNumber"]} 正答：{q["answer"] + 1} ｜ 根拠英文：{q["evidence"]} ｜ 解説：{q["explanation"]}', 'jp'))
                    for idx, ch_txt in enumerate(q['choices']):
                        mark = '◎' if idx == q['answer'] else '×'
                        exp_elems.append(p(f'  {mark} {idx + 1}. {ch_txt} — {q["distractorReasons"][idx]}', 'meta'))
                exp_elems.append(Spacer(1, 4))
                story.append(KeepTogether(exp_elems))
            story.append(PageBreak())

        out_path = PDF_DIR / f'listening_booklet_{gid}_15rounds.pdf'
        reports.append(build_pdf(out_path, story, f'まなとび英検｜{glabel} リスニング問題・解答解説冊子（全15回）'))
    return reports


if __name__ == '__main__':
    audio_rep = build_elevenlabs_audio_pdfs()
    image_rep = build_chatgpt_image_pdfs()
    booklet_rep = build_question_and_explanation_booklets()
    manifest = {
        'elevenLabsAudioPromptPdfs': audio_rep,
        'chatGptImagePromptPdfs': image_rep,
        'listeningBookletPdfs': booklet_rep,
    }
    (PDF_DIR / 'pdf-generation-report.json').write_text(json.dumps(manifest, indent=2, ensure_ascii=False) + '\n', 'utf-8')
    print(f'Generated {len(audio_rep)} ElevenLabs PDFs, {len(image_rep)} ChatGPT Image PDFs, {len(booklet_rep)} Booklet PDFs.')
