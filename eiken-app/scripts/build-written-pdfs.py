"""Offline print production: validated app original -> question/answer/explanation PDFs.
Run npm run generate:booklets. Never runs in the browser or modifies Firebase.
"""
from pathlib import Path
from html import escape
import hashlib
import json
import re
from reportlab import rl_config
rl_config.invariant = True
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak, KeepTogether
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
import pymupdf
from PIL import Image
from written_print_layout import build_cover_pdf, build_questions, build_answer_sheet, CIRCLED, SECTION_NAMES
from reading_print_layout import build_reading_questions

ROOT = Path(__file__).resolve().parents[1]
PUBLIC = ROOT / 'public'
DATA = json.loads((ROOT / 'deliverables/written-booklets.json').read_text())
# Print font: Noto Serif JP, OFL; Times for the English exam-style body.
pdfmetrics.registerFont(TTFont('BookletJP', str(PUBLIC / 'fonts/booklet-noto-serif-jp.ttf')))
WIDTH, HEIGHT = A4
BODY_W = WIDTH - 96

STYLES = {
 'title': ParagraphStyle('title', fontName='BookletJP', fontSize=18, leading=26, spaceAfter=8),
 'heading': ParagraphStyle('heading', fontName='BookletJP', fontSize=12.5, leading=19, spaceAfter=6, wordWrap='CJK'),
 'band_left': ParagraphStyle('band_left', fontName='BookletJP', fontSize=10.5, leading=15, wordWrap='CJK'),
 'band_right': ParagraphStyle('band_right', fontName='BookletJP', fontSize=10.5, leading=15, alignment=2, wordWrap='CJK'),
 'jp': ParagraphStyle('jp', fontName='BookletJP', fontSize=10, leading=16, spaceAfter=4, wordWrap='CJK'),
 'note': ParagraphStyle('note', fontName='BookletJP', fontSize=8.8, leading=14, spaceAfter=3, wordWrap='CJK'),
 'cell': ParagraphStyle('cell', fontName='BookletJP', fontSize=9.2, leading=13.5, wordWrap='CJK'),
 'en': ParagraphStyle('en', fontName='Times-Roman', fontSize=11.5, leading=17.5, spaceAfter=5),
 'en_model': ParagraphStyle('en_model', fontName='Times-Roman', fontSize=11, leading=17, spaceAfter=4),
}

def p(text, style='jp'):
 markup = escape(str(text))
 markup = re.sub(r'\(\s{3,}\)', '(&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;)', markup)
 markup = markup.replace('\n', '<br/>')
 markup = re.sub(r'__([^_]+)__', r'<u>\1</u>', markup)
 return Paragraph(markup, STYLES[style])

def count_words(text):
 return len(re.findall(r"[A-Za-z]+(?:['’-][A-Za-z]+)*", text))

def build_doc(path, story, label, part, exam):
 def footer(c, doc):
  c.saveState()
  c.setFillColor(colors.black)
  c.setStrokeColor(colors.black)
  c.setLineWidth(.4)
  c.line(48, HEIGHT - 36, WIDTH - 48, HEIGHT - 36)
  c.line(48, 38, WIDTH - 48, 38)
  c.setFont('BookletJP', 8)
  c.drawString(48, HEIGHT - 28, f'マナトビ｜{label} 第{exam["round"]}回｜{part}')
  c.drawString(48, 25, '独自教材・公式問題ではありません｜' + exam['revision'])
  c.drawRightString(WIDTH - 48, 25, f'{part} {doc.page}')
  c.restoreState()

 SimpleDocTemplate(
  str(path),
  pagesize=A4,
  leftMargin=48,
  rightMargin=48,
  topMargin=50,
  bottomMargin=46,
  title=f'マナトビ {label} 第{exam["round"]}回 {part}',
  author='マナトビ',
  pageCompression=1,
 ).build(story, onFirstPage=footer, onLaterPages=footer)

def question_header_bar(left_text, right_text):
 t = Table([[p(left_text, 'band_left'), p(right_text, 'band_right')]], colWidths=[BODY_W * 0.68, BODY_W * 0.32], hAlign='LEFT')
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

def boxed_block(title_text, body_text, body_style='jp'):
 t = Table([[p(title_text, 'band_left')], [p(body_text, body_style)]], colWidths=[BODY_W], hAlign='LEFT')
 t.setStyle(TableStyle([
  ('BACKGROUND', (0, 0), (0, 0), colors.HexColor('#f3f3f3')),
  ('BOX', (0, 0), (-1, -1), 0.55, colors.black),
  ('LINEBELOW', (0, 0), (0, 0), 0.4, colors.black),
  ('LEFTPADDING', (0, 0), (-1, -1), 8),
  ('RIGHTPADDING', (0, 0), (-1, -1), 8),
  ('TOPPADDING', (0, 0), (-1, -1), 5),
  ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
 ]))
 return t

def check_no_line_overlaps(pdf_page, page_label):
 """Reject vertical/horizontal collisions between distinct text lines (e.g. mark table vs caption)."""
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
   # Ignore intentionally adjacent circled numbers inside ovals vs row text if X doesn't overlap
   ix = min(ax1, bx1) - max(ax0, bx0)
   iy = min(ay1, by1) - max(ay0, by0)
   if ix > 3.0 and iy > 3.5:
    raise ValueError(f'Overlapping text on {page_label}: "{atxt}" vs "{btxt}"')

items = []
previews = {}
reports = []
labels = {
 'eiken_5': '英検5級',
 'eiken_4': '英検4級',
 'eiken_3': '英検3級',
 'eiken_pre2': '英検準2級',
 'eiken_pre2plus': '英検準2級プラス',
 'eiken_2': '英検2級',
 'eiken_pre1': '英検準1級',
}

for directory in ['prints', 'prints/thumbs', 'prints/previews']:
 (PUBLIC / directory).mkdir(exist_ok=True, parents=True)

for exam in DATA['booklets']:
 label = labels[exam['grade']]
 blueprint = DATA['blueprints'][exam['grade']]
 item_id = 'print_' + exam['id']
 base = PUBLIC / 'prints' / item_id
 all_items = exam['items']
 choice_questions = [q for q in all_items if q['kind'] == 'choice']
 writing_tasks = [q for q in all_items if q['kind'] == 'writing']
 has_writing = len(writing_tasks) > 0
 is_reading_only = exam.get('scope') == 'reading'
 scope_label = 'リーディング' if is_reading_only else '一次筆記'

 # 1. Cover + Question Booklet
 cover = ROOT / 'deliverables' / f'{item_id}_cover.pdf'
 build_cover_pdf(cover, exam, blueprint)
 qpath = Path(str(base) + '_questions.pdf')
 layout = build_reading_questions(qpath, exam, cover) if exam['grade'] != 'eiken_5' else None
 if exam['grade'] == 'eiken_5':
  build_questions(qpath, exam, cover)
 cover.unlink()

 # 2. Answer Sheet (1p mark sheet for 5/4; 2p mark + lined writing sheet for 3..Pre-1)
 apath = Path(str(base) + '_answers.pdf')
 answer_sheet_meta = build_answer_sheet(apath, exam, blueprint)

 # 3. Answer Key & Detailed Explanations Booklet
 story = [
  p(f'{label}形式 {scope_label} 第{exam["round"]}回　解答・解説', 'title'),
  p(
   f'解き終わってから確認してください。選択問題は各1点（全{len(choice_questions)}点満点の復習用素点）です。'
   + (f' ライティング全{len(writing_tasks)}題は巻末の模範解答・4観点チェックリストで自己点検できます。' if has_writing else '')
   + ' 公式得点・CSEスコア・合否へは換算しません。',
   'note',
  ),
  Spacer(1, 8),
  p('■ 選択問題 正答一覧・復習チェック表（間違えた問題は □ にチェックしてアプリで解き直しましょう）', 'heading'),
 ]
 keyrows = []
 for start in range(0, len(choice_questions), 5):
  row_cells = []
  for n in range(start, start + 5):
   if n < len(choice_questions):
    row_cells.append(p(f'□ 問{n + 1:02d}：正答 {choice_questions[n]["answer"] + 1}', 'cell'))
   else:
    row_cells.append(p('', 'cell'))
  keyrows.append(row_cells)
 key_table = Table(keyrows, colWidths=[BODY_W / 5] * 5, hAlign='LEFT')
 key_table.setStyle(TableStyle([
  ('GRID', (0, 0), (-1, -1), 0.45, colors.HexColor('#666666')),
  ('ROWBACKGROUNDS', (0, 0), (-1, -1), [colors.white, colors.HexColor('#f8f8f8')]),
  ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
  ('LEFTPADDING', (0, 0), (-1, -1), 6),
  ('RIGHTPADDING', (0, 0), (-1, -1), 4),
  ('TOPPADDING', (0, 0), (-1, -1), 5),
  ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
 ]))
 story += [key_table, Spacer(1, 14)]

 choice_section_count = len({q['section'] for q in choice_questions})
 if has_writing:
  story.append(p('■ ライティング課題 概要（詳しい模範解答・和訳・解説は本冊子の後半に掲載）', 'heading'))
  w_rows = [[p('大問', 'cell'), p('出題形式', 'cell'), p('目安語数', 'cell'), p('自己点検の4観点', 'cell')]]
  for wi, wq in enumerate(writing_tasks, 1):
   wmin, wmax = wq['wordRange']
   w_rows.append([
    p(f'大問{choice_section_count + wi}', 'cell'),
    p(SECTION_NAMES[wq['section']], 'cell'),
    p(f'{wmin}〜{wmax}語', 'cell'),
    p('内容・構成・語彙・文法（巻末チェックリスト参照）', 'cell'),
   ])
  wt = Table(w_rows, colWidths=[64, 150, 76, BODY_W - 290], hAlign='LEFT')
  wt.setStyle(TableStyle([
   ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#eaeaea')),
   ('GRID', (0, 0), (-1, -1), 0.45, colors.HexColor('#666666')),
   ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
   ('LEFTPADDING', (0, 0), (-1, -1), 6),
   ('RIGHTPADDING', (0, 0), (-1, -1), 6),
   ('TOPPADDING', (0, 0), (-1, -1), 4),
   ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
  ]))
  story.append(wt)

 story.append(PageBreak())
 translated = set()
 for number, q in enumerate(choice_questions, 1):
  if q.get('passage') and q['passage']['id'] not in translated:
   translated.add(q['passage']['id'])
   story += [
    PageBreak(),
    boxed_block(f'【長文の全文和訳】 {q["passage"]["title"]}', q['passage']['translation'], 'jp'),
    Spacer(1, 12),
   ]
  sec_label = SECTION_NAMES[q['section']]
  block = [
   question_header_bar(f'問{number:02d}　{sec_label}', f'問{number:02d} 正答 {q["answer"] + 1}'),
   Spacer(1, 4),
   p(q.get('completedSentence') or q['prompt'], 'jp' if q['section'] == 'cloze' else 'en'),
   p('【訳】' + q['translation']),
   p('【解き方】' + q['explanation']),
  ]
  for n, text in enumerate(q['choices']):
   mark = '★ ' if n == q['answer'] else '　 '
   block.append(p(f'{mark}{n + 1}. {text}：{q["distractorReasons"][n]}', 'note'))
  block.append(Spacer(1, 10))
  story.append(KeepTogether(block))

 # Writing model answers & rubrics
 for wi, wq in enumerate(writing_tasks, 1):
  sec_no = choice_section_count + wi
  wmin, wmax = wq['wordRange']
  wc = count_words(wq['model'])
  story.append(PageBreak())
  story.append(question_header_bar(f'大問{sec_no}　{SECTION_NAMES[wq["section"]]}', f'目安 {wmin}〜{wmax}語'))
  story.append(Spacer(1, 8))
  story.append(p('【課題・条件】\n' + wq['prompt'], 'jp'))
  if wq.get('passage'):
   story += [
    Spacer(1, 6),
    boxed_block(f'【元の英文と和訳】 {wq["passage"]["title"]}', wq['passage']['text'] + '\n\n［和訳］\n' + wq['passage']['translation'], 'note'),
   ]
  story += [
   Spacer(1, 8),
   boxed_block(f'【参考解答（{wc}語）】', wq['model'], 'en_model'),
   Spacer(1, 6),
   KeepTogether([
    p('【参考解答の和訳】\n' + wq['translation'], 'jp'),
    Spacer(1, 4),
    p('【構成・表現の解説】\n' + wq['explanation'], 'jp'),
    Spacer(1, 6),
    boxed_block('【自己点検チェックリスト（4観点）】', '\n'.join(f'□ {r}' for r in wq['rubric']), 'jp'),
   ]),
  ]

 epath = Path(str(base) + '_explanations.pdf')
 build_doc(epath, story, label, '解説', exam)

 # 4. Combine into full pack with PDF bookmarks
 pack = Path(str(base) + '.pdf')
 combined = pymupdf.open()
 toc = []
 parts = []
 for name, path in [('問題冊子', qpath), ('解答用紙', apath), ('解答・解説', epath)]:
  with pymupdf.open(path) as doc:
   start = len(combined) + 1
   toc.append([1, name, start])
   combined.insert_pdf(doc)
   parts.append(dict(label=name, file='/prints/' + path.name, pages=len(doc), start=start, end=len(combined)))
 combined.set_toc(toc)
 combined.set_metadata({
  'title': f'マナトビ {label} 第{exam["round"]}回 {scope_label}セット',
  'author': 'マナトビ',
  'subject': exam['id'] + ' / ' + DATA['sourceHash'],
 })
 combined.save(pack, garbage=4, deflate=True)
 combined.close()

 # 5. Automated QA checks on final rendered PDF
 with pymupdf.open(pack) as doc:
  text = '\n'.join(page.get_text() for page in doc)
  if '\ufffd' in text or re.search(r'\(\d+\)■\(\d+\)', text) or 'IIIIIII' in text:
   raise ValueError('Replacement or corrupted glyph character in PDF')
  normalize = lambda value: (
   re.sub(r'\s+', '', value)
   .replace('\xad', '')
   .replace('ﬁ', 'fi')
   .replace('ﬂ', 'fl')
   .replace('ﬀ', 'ff')
   .replace('ﬃ', 'ffi')
   .replace('ﬄ', 'ffl')
   .replace('’', "'")
   .replace('‘', "'")
  )
  q_end = parts[0]['end']
  a_start = parts[1]['start'] - 1
  a_end = parts[1]['end']
  e_start = parts[2]['start'] - 1

  question_texts = [normalize(page.get_text()) for page in doc[:q_end]]
  explanation_texts = [normalize(page.get_text()) for page in doc[e_start:]]
  question_pages = []

  for n, q in enumerate(choice_questions, 1):
   qpages = [
    (index, question_texts[index])
    for index, pdfpage in enumerate(doc[:q_end])
    if index > 0 and any(
     span['text'].strip() == f'({n})'
     for block in pdfpage.get_text('dict')['blocks']
     for ln in block.get('lines', [])
     for span in ln['spans']
    )
   ]
   if len(qpages) != 1:
    raise ValueError(f'Question split or missing in {exam["id"]}: ({n}) found on {[p[0]+1 for p in qpages]}')
   page_txt = qpages[0][1]
   question_pages.append(qpages[0][0] + 1)
   required = [q['translation'], q['orderPrefix'], *q['orderTokens']] if q['section'] == 'reorder' else ([] if q['section'] == 'cloze' else [q['prompt']])
   if q['section'] == 'reorder':
    required += [f'{no + 1}' + '－'.join(CIRCLED[int(v) - 1] for v in choice.split('－')) for no, choice in enumerate(q['choices'])]
   else:
    required += [f'{no + 1}{choice}' for no, choice in enumerate(q['choices'])]
   if any(normalize(value) not in page_txt for value in required):
    raise ValueError(f'Question or choices incomplete in {exam["id"]}: {n}')

   epages = [ep for ep in explanation_texts if f'問{n:02d}正答{q["answer"] + 1}' in ep]
   req_exp = [q['translation'], q['explanation'], q.get('completedSentence') or q['prompt'], *q['distractorReasons']]
   if len(epages) != 1 or any(normalize(value) not in epages[0] for value in req_exp):
    raise ValueError(f'Explanation split or incomplete in {exam["id"]}: {n}')

  # Writing checks: core prompt/passage content in question booklet, model answers ONLY in explanations
  full_q_text = ''.join(question_texts)
  full_e_text = ''.join(explanation_texts)
  for wq in writing_tasks:
   wmin, wmax = wq['wordRange']
   if f'{wmin}〜{wmax}語' not in full_q_text and f'{wmin}語〜{wmax}語' not in full_q_text:
    raise ValueError(f'Writing word-range missing from question booklet: {wq["id"]}')
   if wq['section'] == 'essay':
    raw_p = wq['prompt']
    topic_core = raw_p
    for m_tag in ('\nQUESTION:', '\nTOPIC:'):
     if m_tag in raw_p:
      topic_core = raw_p.split(m_tag, 1)[1].split('\nPOINTS:', 1)[0].strip()
      break
    if normalize(topic_core) not in full_q_text:
     raise ValueError(f'Essay topic missing from question booklet: {wq["id"]}')
    if '\nPOINTS:' in raw_p:
     pts = [ln.lstrip('•-* ').strip() for ln in raw_p.split('\nPOINTS:', 1)[1].splitlines() if ln.strip()]
     if any(normalize(pt) not in full_q_text for pt in pts):
      raise ValueError(f'Essay POINTS missing from question booklet: {wq["id"]}')
   elif wq['section'] == 'email':
    if 'Bestwishes,' not in full_q_text or 'Thankyouforyoure-mail.' not in full_q_text:
     raise ValueError(f'Email reply frame missing from question booklet: {wq["id"]}')
   if normalize(wq['model']) in full_q_text:
    raise ValueError(f'Writing model answer leaked into question booklet: {wq["id"]}')
   for req_w in [wq['model'], wq['translation'], wq['explanation'], *wq['rubric']]:
    if normalize(req_w) not in full_e_text:
     raise ValueError(f'Writing explanation/rubric incomplete: {wq["id"]} :: {normalize(req_w)[:120]}')

  for passage in {q['passage']['id']: q['passage'] for q in all_items if q.get('passage')}.values():
   clean_lines = [ln.strip() for ln in passage['text'].replace('__', '').splitlines() if ln.strip()]
   norm_title_alnum = re.sub(r'[^a-z0-9]+', '', passage['title'].lower())
   if passage.get('format') == 'notice':
    clean_lines = [ln for idx_l, ln in enumerate(clean_lines) if not (idx_l <= 2 and norm_title_alnum and re.sub(r'[^a-z0-9]+', '', ln.lower()) == norm_title_alnum)]
   if any(normalize(ln) not in full_q_text for ln in clean_lines) or normalize(passage['translation']) not in full_e_text:
    raise ValueError(f'Passage/translation missing: {passage["id"]}')

  if any(re.search(r'問\d+正答', page) or '【訳】' in page or '【解き方】' in page or '【参考解答' in page for page in question_texts):
   raise ValueError(f'Answer leaked into question booklet: {exam["id"]}')

  # Check cover page MUST contain embedded Manatobi brand logo image
  if len(doc[0].get_images()) < 1:
   raise ValueError(f'Cover page missing mandatory Manatobi brand logo in {exam["id"]}')

  # Check answer sheet page count
  expected_ans_pages = 2 if has_writing else 1
  if parts[1]['pages'] != expected_ans_pages:
   raise ValueError(f'Unexpected answer sheet page count for {exam["id"]}: {parts[1]["pages"]}')

  # Margin & blank-page & overlap checks across EVERY page
  for p_idx, page in enumerate(doc):
   for block in page.get_text('dict')['blocks']:
    for ln in block.get('lines', []):
     for span in ln['spans']:
      x0, y0, x1, y1 = span['bbox']
      if x0 < 35 or x1 > page.rect.width - 35 or y0 < 12 or y1 > page.rect.height - 12:
       raise ValueError(f'Text outside safe area on {exam["id"]} p.{p_idx + 1}: {span["text"]} ({span["bbox"]})')
   if not page.get_text().strip():
    raise ValueError(f'Blank page in {exam["id"]} p.{p_idx + 1}')
   # Strictly check zero text-line overlaps on cover and answer sheets (and writing pages)
   if p_idx == 0 or (a_start <= p_idx < a_end):
    check_no_line_overlaps(page, f'{exam["id"]} p.{p_idx + 1}')

  # Pixel review assets: Cover, Question p.2, Answer Sheet p.1, Explanations p.2 (first detail page)
  preview_indices = [0, 1, a_start, min(len(doc) - 1, e_start + 1)]
  previewpaths = []
  for no in preview_indices:
   pix = doc[no].get_pixmap(matrix=pymupdf.Matrix(1, 1), colorspace=pymupdf.csGRAY)
   image = Image.frombytes('L', [pix.width, pix.height], pix.samples)
   target = PUBLIC / f'prints/previews/{item_id}_p{no + 1}.webp'
   image.save(target, 'WEBP', quality=90)
   previewpaths.append('/prints/previews/' + target.name)
   if no == 0:
    image.resize((298, 421)).save(PUBLIC / f'prints/thumbs/{item_id}.webp', 'WEBP', quality=90)

  desc_scope = (
   f'一次筆記1回分（選択{len(choice_questions)}問＋ライティング{len(writing_tasks)}題・目安{blueprint["minutes"]}分）。問題冊子・マーク＆英作文解答用紙・詳しい解説と参考解答を分離して印刷できます。リスニングは含みません。同じ原本をアプリの分野別・ライティング練習で利用できます。外部難度校正は未実施。'
   if has_writing
   else f'一次筆記1回分（全{len(choice_questions)}問・目安{blueprint["minutes"]}分）。問題冊子・マーク解答用紙・詳しい解説を分離して印刷できます。リスニング・英作文は含みません。同じ原本をアプリの分野別練習で利用できます。外部難度校正は未実施。'
  )
  label_detail = f'{len(choice_questions)}問＋英作文{len(writing_tasks)}題' if has_writing else f'{len(choice_questions)}問'
  items.append(dict(
   id=item_id,
   label=f'{label} {scope_label} 第{exam["round"]}回（{label_detail}・問題／解答用紙／解説）',
   subject=exam['grade'],
   category='演習プリント',
   file='/prints/' + pack.name,
   thumb=f'/prints/thumbs/{item_id}.webp',
   pages=len(doc),
   kb=round(pack.stat().st_size / 1024),
   description=desc_scope,
   variants=parts,
  ))
  previews[item_id] = previewpaths
  reports.append(dict(
   id=exam['id'],
   round=exam['round'],
   grade=exam['grade'],
   sourceHash=DATA['sourceHash'],
   pdfSha256=hashlib.sha256(pack.read_bytes()).hexdigest(),
   pages=len(doc),
   parts=parts,
   questionPages=question_pages,
   writingCount=len(writing_tasks),
   answerSheet=answer_sheet_meta,
   layout=layout or {
    'reference': 'https://www.eiken.or.jp/eiken/exam/kakomon/2026-2-1ji_5kyu.pdf',
    'answerReference': 'https://www.eiken.or.jp/eiken/schedule/pdf/5q-hon.pdf',
    'shortQuestionPages': [7, 8],
    'conversationQuestionPages': [5],
    'reorderQuestionPages': [5],
    'choiceColumns': {'short': 4, 'conversation': 2, 'reorder': 4},
    'orderingChunkNumbers': 'circled',
    'orderingAnswerBoxes': 4,
    'orderingMarkedPositions': [1, 3],
    'answerSheet': 'landscape A4; 1–15 / 16–25; vertical ovals',
    'officialArtworkCopied': False,
   },
   checks={
    'allPromptsChoicesTranslationsAndExplanations': True,
    'writingPromptsModelsAndRubrics': True,
    'noSplitQuestions': True,
    'noAnswerLeak': True,
    'safeMargins': True,
    'noLineOverlaps': True,
    'grayscalePreviews': True,
   },
   answers=[dict(id=q['id'], number=n + 1, answer=q['answer'] + 1, explanation=q['explanation']) for n, q in enumerate(choice_questions)],
  ))

(ROOT / 'src/data/writtenPrints.generated.ts').write_text(
 '// Generated by scripts/build-written-pdfs.py; validated original only.\n'
 'import type { GachaPrintDef } from "./gachaPrints.generated";\n'
 'export const WRITTEN_PRINTS: readonly GachaPrintDef[] = '
 + json.dumps(items, ensure_ascii=False, indent=2)
 + ';\nexport const WRITTEN_PREVIEWS: Readonly<Record<string, readonly string[]>> = '
 + json.dumps(previews, ensure_ascii=False, indent=2)
 + ';\n'
)
(ROOT / 'deliverables/written-pdf-validation.json').write_text(json.dumps(reports, ensure_ascii=False, indent=2) + '\n')
print(json.dumps([dict(id=r['id'], pages=r['pages'], parts=r['parts']) for r in reports], ensure_ascii=False, indent=2))
