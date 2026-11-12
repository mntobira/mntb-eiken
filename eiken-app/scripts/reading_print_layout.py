"""Grade-specific primary written layouts (Grades 4 through Pre-1):
- Choice sections: 4-col short blanks, 2-col conversations, 4-box ordering, 2-col cloze, 1-col reading
- Distinct visual framing for Notices (header band + border), Emails (header divider + border), Articles
- Bold-underlined cloze numbers in passages
- Dedicated Writing task pages (Email reply / Summary / Opinion essay) with planning memo box
Original content only. Zero official artwork or past-paper text.
"""
from html import escape
from pathlib import Path
import re
import pymupdf
from reportlab.pdfgen import canvas
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.platypus import Paragraph
from written_print_layout import reorder_question, SECTION_NAMES

W, H = A4
X = 102
RIGHT = 539
BW = RIGHT - X
FULL_X = 62
FULL_W = RIGHT - FULL_X
LABELS = {
 'eiken_4': '英検4級',
 'eiken_3': '英検3級',
 'eiken_pre2': '英検準2級',
 'eiken_pre2plus': '英検準2級プラス',
 'eiken_2': '英検2級',
 'eiken_pre1': '英検準1級',
}
SPLITS = {
 'eiken_4': [8, 7],
 'eiken_3': [7, 8],
 'eiken_pre2': [8, 7],
 'eiken_pre2plus': [5, 5, 5, 2],
 'eiken_2': [5, 5, 5, 2],
 'eiken_pre1': [6, 6, 6],
}
FONT = ParagraphStyle('reading-en', fontName='Times-Roman', fontSize=11.5, leading=17)
WRITING_EN = ParagraphStyle('writing-en', fontName='Times-Roman', fontSize=11.5, leading=17.5)
TOPIC_EN = ParagraphStyle('topic-en', fontName='Times-Bold', fontSize=12, leading=18)
JAPANESE = ParagraphStyle('reading-jp', fontName='BookletJP', fontSize=10, leading=16, wordWrap='CJK')
NOTE = ParagraphStyle('reading-small', fontName='BookletJP', fontSize=8.8, leading=14, wordWrap='CJK')

def format_markup(text, highlight_cloze=False):
 markup = escape(text).replace('(     )', '(&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;)').replace('\n', '<br/>')
 markup = re.sub(r'(^|<br/>)([AB]):', r'\1<b><i>\2:</i></b>', markup)
 # Support optional __underlined text__ in email writing prompts
 markup = re.sub(r'__([^_]+)__', r'<u>\1</u>', markup)
 if highlight_cloze:
  markup = re.sub(r'\((\d{2})\)', r'<u><b>(\1)</b></u>', markup)
 return markup

def para(text, style=FONT, highlight_cloze=False):
 return Paragraph(format_markup(text, highlight_cloze=highlight_cloze), style)

def height(text, width=BW, style=FONT, highlight_cloze=False):
 return para(text, style, highlight_cloze=highlight_cloze).wrap(width, H)[1]

def draw(c, text, x, top, width=BW, style=FONT, highlight_cloze=False):
 block = para(text, style, highlight_cloze=highlight_cloze)
 _, h = block.wrap(width, H)
 if top + h > H - 48:
  raise ValueError(f'Text overflows the print page ({top + h:.1f}>{H - 48:.1f}): {text[:60]}')
 block.drawOn(c, x, H - top - h)
 return h

def line(c, text, x, top, font='Times-Roman', size=11.5):
 c.setFont(font, size)
 c.drawString(x, H - top - size * .82, text)

def frame(c, exam, page):
 c.setFillGray(0)
 c.setStrokeGray(0)
 c.setLineWidth(.4)
 kind_en = 'ORIGINAL READING' if exam.get('scope') == 'reading' else 'ORIGINAL WRITTEN PRACTICE'
 kind_jp = 'リーディング' if exam.get('scope') == 'reading' else '一次筆記'
 line(c, f'MANATOBI / {kind_en}', 58, 39, 'Times-Bold', 8)
 c.setFont('BookletJP', 8)
 c.drawRightString(RIGHT, H - 46, f'{LABELS[exam["grade"]]}形式 第{exam["round"]}回 {kind_jp}')
 c.line(56, 34, W - 56, 34)
 c.line(56, H - 34, W - 56, H - 34)
 line(c, 'マナトビ独自教材・公式問題ではありません', 56, H - 26, 'BookletJP', 7.5)
 line(c, str(page), W / 2 - 3, H - 26, 'Times-Bold', 9)
 c.setFont('Times-Roman', 7)
 c.drawRightString(RIGHT, 20, exam['revision'])

def heading(c, number, label, instruction, top=58):
 h_box = 58
 c.setFillColor(colors.HexColor('#e9e9e9'))
 c.rect(56, H - top - h_box, 36, h_box, fill=1, stroke=0)
 c.setFillColor(colors.black)
 line(c, str(number), 65, top + 14, 'Times-Bold', 23)
 c.setLineWidth(.7)
 c.line(56, H - top, 539, H - top)
 c.line(56, H - top - h_box, 539, H - top - h_box)
 draw(c, label + '\n' + instruction, 104, top + 7, BW, JAPANESE)
 return top + h_box + 16

def options_height(choices, columns):
 cw = BW / columns
 return sum(max(height(text, cw - 26) for text in choices[i:i + columns]) + 5 for i in range(0, 4, columns))

def options(c, choices, top, columns=1):
 cw = BW / columns
 cursor = top
 for start in range(0, 4, columns):
  rh = max(height(text, cw - 26) for text in choices[start:start + columns])
  for index in range(start, start + columns):
   x = X + (index - start) * cw
   line(c, str(index + 1), x + 4, cursor, 'Times-Bold')
   draw(c, choices[index], x + 24, cursor, cw - 26)
  cursor += rh + 5
 return cursor

def question(c, number, item, top, columns=1, show_prompt=True):
 line(c, f'({number})', 62, top, 'Times-BoldItalic', 11.5)
 if show_prompt:
  top += draw(c, item['prompt'], X, top) + 5
 return options(c, item['choices'], top, columns) + 12

def qheight(item, columns=1, show_prompt=True):
 return (height(item['prompt']) + 5 if show_prompt else 0) + options_height(item['choices'], columns) + 12

def draw_passage_block(c, passage, top, is_cloze=False):
 """Render notice, email, or article with authentic black-and-white print styling."""
 fmt = passage.get('format', 'article')
 pt = passage['text']
 if fmt == 'notice':
  body_h = height(pt, BW - 16, highlight_cloze=is_cloze)
  band_h = 26
  total_h = band_h + body_h + 22
  if top + total_h > H - 64:
   raise ValueError(f'Notice exceeds safe one-page block: {passage["id"]}')
  c.setFillColor(colors.HexColor('#efefef'))
  c.rect(X - 10, H - top - band_h, BW + 20, band_h, stroke=0, fill=1)
  c.setFillColor(colors.black)
  c.setLineWidth(0.6)
  c.rect(X - 10, H - top - total_h, BW + 20, total_h, stroke=1, fill=0)
  c.line(X - 10, H - top - band_h, X + BW + 10, H - top - band_h)
  c.setFont('Times-Bold', 13)
  c.drawCentredString(X + BW / 2, H - top - 18, passage['title'])
  draw(c, pt, X - 2, top + band_h + 10, BW - 16, highlight_cloze=is_cloze)
  return top + total_h + 18
 elif fmt == 'email':
  # Split header lines (From:/To:/Subject:/Date:) from body if present
  raw_lines = pt.split('\n')
  hdr_lines = []
  idx = 0
  while idx < len(raw_lines) and re.match(r'^(From|To|Subject|Date):', raw_lines[idx].strip()):
   hdr_lines.append(raw_lines[idx])
   idx += 1
  while idx < len(raw_lines) and not raw_lines[idx].strip():
   idx += 1
  body_text = '\n'.join(raw_lines[idx:]) if hdr_lines else pt
  hdr_text = '\n'.join(hdr_lines)
  hdr_h = height(hdr_text, BW - 16) + 12 if hdr_text else 0
  body_h = height(body_text, BW - 16, highlight_cloze=is_cloze)
  title_h = 22
  box_h = hdr_h + body_h + 22
  if top + title_h + box_h > H - 64:
   raise ValueError(f'Email exceeds safe one-page block: {passage["id"]}')
  line(c, passage['title'], X, top, 'Times-BoldItalic', 13.5)
  box_top = top + title_h
  c.setLineWidth(0.55)
  c.rect(X - 10, H - box_top - box_h, BW + 20, box_h, stroke=1, fill=0)
  if hdr_text:
   c.setFillColor(colors.HexColor('#f6f6f6'))
   c.rect(X - 9.5, H - box_top - hdr_h - 4, BW + 19, hdr_h + 4, stroke=0, fill=1)
   c.setFillColor(colors.black)
   draw(c, hdr_text, X - 2, box_top + 6, BW - 16)
   c.setLineWidth(0.4)
   c.line(X - 10, H - box_top - hdr_h - 4, X + BW + 10, H - box_top - hdr_h - 4)
   draw(c, body_text, X - 2, box_top + hdr_h + 12, BW - 16, highlight_cloze=is_cloze)
  else:
   draw(c, body_text, X - 2, box_top + 10, BW - 16, highlight_cloze=is_cloze)
  return box_top + box_h + 18
 else:
  line(c, passage['title'], X, top, 'Times-BoldItalic', 14.5)
  c.setLineWidth(0.35)
  c.line(X, H - top - 19, RIGHT, H - top - 19)
  top += 24
  body_h = height(pt, BW, highlight_cloze=is_cloze)
  if top + body_h > H - 48:
   raise ValueError(f'Passage exceeds safe one-page block: {passage["id"]}')
  draw(c, pt, X, top, BW, highlight_cloze=is_cloze)
  return top + body_h + 20

def draw_writing_page(c, section_no, item):
 """Render a dedicated Writing task page (email / summary / essay) with authentic box + planning space."""
 wmin, wmax = item['wordRange']
 title = SECTION_NAMES[item['section']]
 top = heading(
  c,
  section_no,
  title,
  f'解答は解答用紙（2ページ目）の指定された枠内に英語で書きなさい。（目安語数：{wmin}〜{wmax}語）',
  top=58,
 )
 # Prompt instructions (split Japanese instruction vs English TOPIC/POINTS if separated by \n\nTOPIC or similar)
 prompt_text = item['prompt']
 if '\nTOPIC:' in prompt_text:
  jp_inst, topic_part = prompt_text.split('\nTOPIC:', 1)
  top += draw(c, jp_inst.strip(), FULL_X, top, FULL_W, JAPANESE) + 14
  topic_lines = ('TOPIC:' + topic_part).strip()
  th = height(topic_lines, FULL_W - 28, WRITING_EN)
  box_h = th + 24
  c.setFillColor(colors.HexColor('#f5f5f5'))
  c.setLineWidth(0.85)
  c.rect(FULL_X, H - top - box_h, FULL_W, box_h, stroke=1, fill=1)
  c.setFillColor(colors.black)
  draw(c, topic_lines, FULL_X + 14, top + 12, FULL_W - 28, WRITING_EN)
  top += box_h + 18
 else:
  top += draw(c, prompt_text, FULL_X, top, FULL_W, JAPANESE) + 14

 if item.get('passage'):
  pas = item['passage']
  pas_text = pas['text']
  ph = height(pas_text, FULL_W - 28, WRITING_EN)
  hdr_h = 24
  box_h = hdr_h + ph + 20
  c.setFillColor(colors.HexColor('#efefef'))
  c.rect(FULL_X, H - top - hdr_h, FULL_W, hdr_h, stroke=0, fill=1)
  c.setFillColor(colors.black)
  c.setLineWidth(0.65)
  c.rect(FULL_X, H - top - box_h, FULL_W, box_h, stroke=1, fill=0)
  c.line(FULL_X, H - top - hdr_h, FULL_X + FULL_W, H - top - hdr_h)
  line(c, pas['title'], FULL_X + 12, top + 6, 'Times-BoldItalic', 11.5)
  draw(c, pas_text, FULL_X + 14, top + hdr_h + 10, FULL_W - 28, WRITING_EN)
  top += box_h + 18

 # Planning / Draft memo box in remaining space if >= 95pt available
 avail = (H - 58) - top
 if avail >= 95:
  memo_h = min(220, avail - 8)
  c.setStrokeColor(colors.HexColor('#888888'))
  c.setLineWidth(0.5)
  c.setDash(3, 2)
  c.rect(FULL_X, H - top - memo_h, FULL_W, memo_h, stroke=1, fill=0)
  c.setDash()
  c.setFillColor(colors.HexColor('#444444'))
  line(c, '構成メモ・下書き欄（MEMO / PLANNING NOTES — 採点対象外・本番解答は解答用紙へ）', FULL_X + 10, top + 8, 'BookletJP', 8.2)
  y_line = top + 34
  c.setStrokeColor(colors.HexColor('#dddddd'))
  c.setLineWidth(0.35)
  while y_line + 14 < top + memo_h:
   c.line(FULL_X + 12, H - y_line, FULL_X + FULL_W - 12, H - y_line)
   y_line += 22
  c.setStrokeColor(colors.black)
  c.setFillColor(colors.black)

def build_reading_questions(path, exam, cover_pdf):
 FONT.fontSize = 10.8 if exam['grade'] == 'eiken_pre1' else 11.5
 FONT.leading = 15.2 if exam['grade'] == 'eiken_pre1' else 17
 WRITING_EN.fontSize = 10.8 if exam['grade'] == 'eiken_pre1' else 11.5
 WRITING_EN.leading = 16 if exam['grade'] == 'eiken_pre1' else 17.5

 temp = Path(str(path) + '.body.pdf')
 c = canvas.Canvas(str(temp), pagesize=A4, invariant=1, pageCompression=1)
 page = 2
 frame(c, exam, page)
 choice_items = [q for q in exam['items'] if q['kind'] == 'choice']
 numbers = {q['id']: i + 1 for i, q in enumerate(choice_items)}
 section_no = 0
 plans = []

 def new_page():
  nonlocal page
  c.showPage()
  page += 1
  frame(c, exam, page)

 for section in ['short', 'conversation', 'reorder', 'cloze', 'reading']:
  items = [q for q in choice_items if q['section'] == section]
  if not items:
   continue
  section_no += 1
  if section != 'short':
   new_page()
  title = SECTION_NAMES[section]
  instruction = (
   '日本語の意味に合うように①〜④を並べ替え、1番目と3番目の語句番号の組を1〜4から1つ選びなさい。'
   if section == 'reorder'
   else '1〜4から最も適切な答えを1つ選び、その番号を解答用紙にマークしなさい。'
  )
  top = heading(c, section_no, title, instruction)
  if section == 'short':
   index = 0
   for pi, count in enumerate(SPLITS[exam['grade']]):
    if pi:
     new_page()
     top = 104
     line(c, f'{section_no}　{title}（続き）', X, 64, 'BookletJP', 10)
     c.setLineWidth(.5)
     c.line(56, H - 88, 539, H - 88)
    available = H - 56 - top
    slot = min(116, available / count)
    for item in items[index:index + count]:
     cols = 4 if qheight(item, 4) <= slot else 2
     if qheight(item, cols) > slot:
      raise ValueError(f'Short options cannot fit slot ({cols} cols): {item["id"]}')
     question(c, numbers[item['id']], item, top, cols)
     top += slot
    plans.append({'section': section, 'page': page, 'questions': list(range(index + 1, index + count + 1))})
    index += count
  elif section == 'conversation':
   slot = (H - 56 - top) / len(items)
   for item in items:
    if qheight(item, 2) > slot:
     raise ValueError(f'Conversation slot overflow: {item["id"]}')
    question(c, numbers[item['id']], item, top, 2)
    top += slot
   plans.append({'section': section, 'page': page, 'questions': [numbers[q['id']] for q in items]})
  elif section == 'reorder':
   top = 172
   for item in items:
    reorder_question(c, numbers[item['id']], item, top)
    top += 119
   plans.append({'section': section, 'page': page, 'questions': [numbers[q['id']] for q in items]})
  else:
   groups = {}
   for item in items:
    groups.setdefault(item['passage']['id'], []).append(item)
   for gi, group in enumerate(groups.values()):
    if gi:
     new_page()
     top = 66
    passage = group[0]['passage']
    columns = 2 if section == 'cloze' else 1
    # Trial height estimation to decide single-page vs split passage/questions
    sim_c = canvas.Canvas('/dev/null', pagesize=A4)
    after_passage_top = draw_passage_block(sim_c, passage, top, is_cloze=(section == 'cloze'))
    q_total = sum(qheight(q, columns, section != 'cloze') for q in group)
    combined_allowed = section == 'cloze' or (passage.get('format') in ['notice', 'email'] and exam['grade'] != 'eiken_4')
    if section == 'cloze' and after_passage_top + q_total > H - 48:
     raise ValueError(f'Cloze text/options exceed one page: {passage["id"]}: {after_passage_top + q_total}')
    combined = combined_allowed and (after_passage_top + q_total <= H - 48)

    top = draw_passage_block(c, passage, top, is_cloze=(section == 'cloze'))
    if not combined:
     new_page()
     top = 68
     line(c, passage['title'] + ' — Questions', X, top, 'Times-BoldItalic', 13.5)
     c.setLineWidth(0.35)
     c.line(X, H - top - 19, RIGHT, H - top - 19)
     top += 30
    for item in group:
     required = qheight(item, columns, section != 'cloze')
     if top + required > H - 48:
      new_page()
      top = 80
      line(c, passage['title'] + ' — Questions (continued)', X, 54, 'Times-Italic', 11.5)
     question(c, numbers[item['id']], item, top, columns, section != 'cloze')
     top += required
    plans.append({'section': section, 'page': page, 'passage': passage['id'], 'questions': [numbers[q['id']] for q in group]})

 # Writing sections (email / summary / essay)
 for w_item in [q for q in exam['items'] if q['kind'] == 'writing']:
  section_no += 1
  new_page()
  draw_writing_page(c, section_no, w_item)
  plans.append({'section': w_item['section'], 'page': page, 'writingId': w_item['id']})

 c.showPage()
 c.save()
 kind_title = 'リーディング' if exam.get('scope') == 'reading' else '一次筆記'
 with pymupdf.open(cover_pdf) as cover, pymupdf.open(temp) as body:
  doc = pymupdf.open()
  doc.insert_pdf(cover)
  doc.insert_pdf(body)
  doc.set_metadata({'title': f'マナトビ {LABELS[exam["grade"]]} {kind_title} 第{exam["round"]}回 問題冊子', 'author': 'マナトビ'})
  doc.save(path, garbage=4, deflate=True)
  doc.close()
 temp.unlink()
 return {
  'shortQuestionPages': SPLITS[exam['grade']],
  'choiceColumns': {'short': 4, 'conversation': 2, 'cloze': 2, 'reading': 1},
  'passagePlans': plans,
  'officialArtworkCopied': False,
 }
