"""Merge Written (Reading/Vocabulary/Writing) + Listening booklets into unified
Primary Exam (一次試験 通し問題冊子 & 通し解答・全肢解説冊子) PDFs.

Inputs:
  - deliverables/written-booklets.json   (exported by scripts/export-written-booklets.ts)
  - deliverables/listening-booklets.json (exported by scripts/export-listening-booklets.ts)

Automatically pairs every (grade, round) present in BOTH manifests, so once the
Reading branch is merged and `npm run generate:combined-pdfs` is executed, all
available grades x 15 rounds are rendered into unified full-exam PDFs without code changes.
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

WRITTEN_DATA = json.loads((DELIV / 'written-booklets.json').read_text('utf-8'))
LISTENING_DATA = json.loads((DELIV / 'listening-booklets.json').read_text('utf-8'))

pdfmetrics.registerFont(TTFont('BookletJP', str(PUBLIC / 'fonts/booklet-noto-serif-jp.ttf')))
WIDTH, HEIGHT = A4

STYLES = {
    'kicker': ParagraphStyle('kicker', fontName='BookletJP', fontSize=10, leading=15, textColor=colors.HexColor('#1f5f66'), spaceAfter=8),
    'title': ParagraphStyle('title', fontName='BookletJP', fontSize=23, leading=33, textColor=colors.HexColor('#102a43'), spaceAfter=12),
    'sub': ParagraphStyle('sub', fontName='BookletJP', fontSize=13, leading=20, textColor=colors.HexColor('#334e68'), spaceAfter=14),
    'ban': ParagraphStyle('ban', fontName='BookletJP', fontSize=10.2, leading=15.5, textColor=colors.HexColor('#7b1e1e'), wordWrap='CJK'),
    'h1': ParagraphStyle('h1', fontName='BookletJP', fontSize=15, leading=22, textColor=colors.HexColor('#102a43'), spaceBefore=6, spaceAfter=8),
    'h2': ParagraphStyle('h2', fontName='BookletJP', fontSize=11.5, leading=17, textColor=colors.HexColor('#1f5f66'), spaceBefore=5, spaceAfter=4, wordWrap='CJK'),
    'jp': ParagraphStyle('jp', fontName='BookletJP', fontSize=9.6, leading=15.2, spaceAfter=4, wordWrap='CJK'),
    'meta': ParagraphStyle('meta', fontName='BookletJP', fontSize=8.3, leading=12.8, textColor=colors.HexColor('#486581'), spaceAfter=3, wordWrap='CJK'),
    'en': ParagraphStyle('en', fontName='Times-Roman', fontSize=10.8, leading=16, spaceAfter=5),
}

SECTION_LABELS = {
    'short': '短文の語句空所補充',
    'conversation': '会話文の文空所補充',
    'reorder': '日本文付き短文の語句整序',
    'reading': '長文の内容一致選択',
    'cloze': '長文の語句空所補充',
    'email': '英文Eメール作成',
    'summary': '英文要約',
    'essay': '英作文（意見論述）',
}


def p(text: str, style: str = 'jp') -> Paragraph:
    safe = escape(str(text)).replace('(     )', '(&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;)').replace('\n', '<br/>')
    return Paragraph(safe, STYLES[style])


def provenance_banner() -> Table:
    txt = (
        '【重要規定｜過去問の流用禁止】\n'
        '・本冊子（一次試験：リーディング・筆記＋リスニング統合セット）はすべて完全独自作成（origin: manatobi-original）です。\n'
        '・英検過去問および他社教材の転載・言い換え流用・固有名詞／数値のみの置換流用は一切禁止・不使用です（過去問の流用禁止）。'
    )
    tbl = Table([[p(txt, 'ban')]], colWidths=[WIDTH - 84])
    tbl.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor('#fff5f5')),
        ('BOX', (0, 0), (-1, -1), 1.0, colors.HexColor('#c53030')),
        ('PADDING', (0, 0), (-1, -1), 9),
    ]))
    return tbl


def save_verified_pdf(path: Path, story: list, header: str) -> dict:
    def on_page(canvas, doc):
        canvas.saveState()
        canvas.setStrokeColor(colors.HexColor('#cbd5e1'))
        canvas.setLineWidth(0.4)
        canvas.line(42, HEIGHT - 32, WIDTH - 42, HEIGHT - 32)
        canvas.setFont('BookletJP', 7.5)
        canvas.setFillColor(colors.HexColor('#486581'))
        canvas.drawString(42, HEIGHT - 24, header)
        canvas.drawString(42, 22, 'まなとび英検｜一次試験統合版（過去問の流用禁止）｜origin: manatobi-original')
        canvas.drawRightString(WIDTH - 42, 22, f'Page {doc.page}')
        canvas.restoreState()

    SimpleDocTemplate(
        str(path),
        pagesize=A4,
        leftMargin=42,
        rightMargin=42,
        topMargin=42,
        bottomMargin=38,
        title=header,
        author='まなとび英検',
        pageCompression=1,
    ).build(story, onFirstPage=on_page, onLaterPages=on_page)

    with pymupdf.open(path) as doc:
        txt = '\n'.join(pg.get_text() for pg in doc)
        if '\ufffd' in txt or '\x00' in txt:
            raise ValueError(f'Mojibake or NUL in {path.name}')
        if '過去問の流用禁止' not in doc[0].get_text():
            raise ValueError(f'Cover provenance missing in {path.name}')
        return {'file': path.name, 'pages': len(doc), 'bytes': path.stat().st_size}


def main():
    grade_labels = {g['id']: g['label'] for g in LISTENING_DATA['grades']}
    written_map = {(b['grade'], b['round']): b for b in WRITTEN_DATA['booklets']}
    listening_map = {(b['grade'], b['round']): b for b in LISTENING_DATA['booklets']}

    paired_keys = sorted(set(written_map.keys()) & set(listening_map.keys()))
    if not paired_keys:
        raise RuntimeError('No matching (grade, round) pairs found between written and listening manifests.')

    reports = []
    for grade, rnd in paired_keys:
        w_exam = written_map[(grade, rnd)]
        l_exam = listening_map[(grade, rnd)]
        glabel = grade_labels[grade]
        w_bp = WRITTEN_DATA['blueprints'][grade]
        l_bp = LISTENING_DATA['blueprints'][grade]
        w_items = w_exam['items']
        l_q_count = sum(len(u['questions']) for u in l_exam['units'])

        # 1. 一次試験統合「問題冊子」
        q_story = [
            Spacer(1, 24),
            p('MANATOBI EIKEN — UNIFIED PRIMARY EXAM QUESTION BOOKLET', 'kicker'),
            p(f'{glabel} 第{rnd}回\n一次試験（筆記・リーディング＋リスニング）問題冊子', 'title'),
            p(
                f'筆記目安 {w_bp["minutes"]}分（{len(w_items)}題）＋ リスニング目安 {l_bp["minutes"]}分（{l_q_count}問）｜合計 {len(w_items) + l_q_count} 題',
                'sub',
            ),
            provenance_banner(),
            Spacer(1, 14),
            p('実施手順', 'h1'),
            p('・前半に「筆記（語彙・文法・読解・英作文）」、後半に「リスニング（第1部〜最終部）」を1冊に統合しています。'),
            p('・別冊の「一次試験 統合解答・全肢解説冊子」は解き終わってから開いてください。'),
            PageBreak(),
            p(f'【第1部：筆記（リーディング・語彙文法）】全{len(w_items)}題（目安 {w_bp["minutes"]}分）', 'h1'),
        ]

        current_sec = None
        for idx, item in enumerate(w_items, 1):
            if item['section'] != current_sec:
                current_sec = item['section']
                q_story.append(p(f'■ {SECTION_LABELS.get(current_sec, current_sec)}', 'h2'))
            block = []
            if item.get('japanese'):
                block.append(p(f'({idx}) 日本語：{item["japanese"]}', 'jp'))
            if item.get('passage'):
                block.append(p(item['passage'], 'en'))
            block.append(p(f'({idx})  {item["prompt"]}', 'en'))
            if item.get('choices'):
                opts = '    '.join(f'{i + 1}. {c}' for i, c in enumerate(item['choices']))
                block.append(p(opts, 'en'))
            block.append(Spacer(1, 4))
            q_story.append(KeepTogether(block))

        q_story.append(PageBreak())
        q_story.append(p(f'【第2部：リスニング】全{l_q_count}問（目安 {l_bp["minutes"]}分）', 'h1'))
        for unit in l_exam['units']:
            u_block = []
            if unit.get('material'):
                mat = unit['material']
                u_block.append(p(f'［資料］{mat["title"]} — {mat["situation"]}', 'en'))
                if mat.get('headers') and mat.get('rows'):
                    col_w = (WIDTH - 96) / len(mat['headers'])
                    t_rows = [[p(h, 'meta') for h in mat['headers']]] + [[p(c, 'meta') for c in r] for r in mat['rows']]
                    tbl = Table(t_rows, colWidths=[col_w] * len(mat['headers']), hAlign='LEFT')
                    tbl.setStyle(TableStyle([
                        ('GRID', (0, 0), (-1, -1), 0.4, colors.HexColor('#94a3b8')),
                        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#e2e8f0')),
                        ('PADDING', (0, 0), (-1, -1), 4),
                    ]))
                    u_block.append(tbl)
            elif unit.get('image'):
                u_block.append(p(f'［イラスト枠：{unit["image"]["targetPath"]}｜場面：{unit["image"]["sceneSummaryJa"]}］', 'meta'))

            for q in unit['questions']:
                if q['choicePresentation'] == 'read-aloud':
                    u_block.append(p(f'No.{q["questionNumber"]}　（音声で読み上げられる 1〜{len(q["choices"])} から1つ選ぶ）', 'jp'))
                else:
                    opts = '    '.join(f'{i + 1}. {c}' for i, c in enumerate(q['choices']))
                    u_block.append(p(f'No.{q["questionNumber"]}  {q["questionPrompt"]}', 'en'))
                    u_block.append(p(opts, 'en'))
            u_block.append(Spacer(1, 3))
            q_story.append(KeepTogether(u_block))

        q_out = PDF_DIR / f'combined_primary_{grade}_r{rnd:02d}_questions.pdf'
        reports.append(save_verified_pdf(q_out, q_story, f'まなとび英検｜{glabel} 第{rnd}回 一次試験（筆記＋リスニング）統合問題冊子'))

        # 2. 一次試験統合「解答・全肢解説冊子」
        e_story = [
            Spacer(1, 24),
            p('MANATOBI EIKEN — UNIFIED PRIMARY EXAM ANSWER & RATIONALE BOOKLET', 'kicker'),
            p(f'{glabel} 第{rnd}回\n一次試験（筆記＋リスニング）解答・全肢解説冊子', 'title'),
            p(f'筆記 {len(w_items)}題 ＋ リスニング {l_q_count}問｜全問和訳・根拠・全選択肢解説付き', 'sub'),
            provenance_banner(),
            PageBreak(),
            p(f'【筆記パート 正答・和訳・全肢解説】（全{len(w_items)}題）', 'h1'),
        ]
        for idx, item in enumerate(w_items, 1):
            ans_str = str(item['answer'] + 1) if 'answer' in item else 'モデル解答参照'
            b = [
                p(f'筆記 ({idx})　正答：{ans_str}', 'h2'),
                p(item.get('completedSentence') or item['prompt'], 'en'),
            ]
            if item.get('translation'):
                b.append(p(f'【和訳】{item["translation"]}', 'jp'))
            if item.get('explanation'):
                b.append(p(f'【解説】{item["explanation"]}', 'jp'))
            if item.get('choices') and item.get('distractorReasons'):
                for ci, c_txt in enumerate(item['choices']):
                    mark = '◎' if ci == item.get('answer') else '×'
                    b.append(p(f'  {mark} {ci + 1}. {c_txt} — {item["distractorReasons"][ci]}', 'meta'))
            b.append(Spacer(1, 4))
            e_story.append(KeepTogether(b))

        e_story.append(PageBreak())
        e_story.append(p(f'【リスニングパート 正答・スクリプト・和訳・全肢解説】（全{l_q_count}問）', 'h1'))
        for unit in l_exam['units']:
            q_nos = '・'.join(f'No.{q["questionNumber"]}' for q in unit['questions'])
            b = [
                p(f'■ リスニング {q_nos}（音源ID: {unit["audioId"]}）', 'h2'),
                p(unit['elevenLabsDialogueInput'], 'en'),
                p(f'【和訳】{unit["translation"]}', 'jp'),
            ]
            for q in unit['questions']:
                b.append(p(f'No.{q["questionNumber"]} 正答：{q["answer"] + 1} ｜ 根拠：{q["evidence"]} ｜ {q["explanation"]}', 'jp'))
                for ci, c_txt in enumerate(q['choices']):
                    mark = '◎' if ci == q['answer'] else '×'
                    b.append(p(f'  {mark} {ci + 1}. {c_txt} — {q["distractorReasons"][ci]}', 'meta'))
            b.append(Spacer(1, 4))
            e_story.append(KeepTogether(b))

        e_out = PDF_DIR / f'combined_primary_{grade}_r{rnd:02d}_explanations.pdf'
        reports.append(save_verified_pdf(e_out, e_story, f'まなとび英検｜{glabel} 第{rnd}回 一次試験（筆記＋リスニング）統合解答解説冊子'))

    (PDF_DIR / 'combined-pdf-report.json').write_text(json.dumps(reports, indent=2, ensure_ascii=False) + '\n', 'utf-8')
    print(f'Generated {len(reports)} combined primary-exam PDF(s) for {len(paired_keys)} paired round(s).')


if __name__ == '__main__':
    main()
