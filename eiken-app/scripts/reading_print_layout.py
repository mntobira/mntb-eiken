"""Grade-specific primary written layouts (Grades 4 through Pre-1):
- Authentic left margin column band, dark section badges, and 2A/2B & 3A/3B/3C sub-badges
- Choice sections: 4-col short blanks, 2-col conversations with dotted rules, 4-box ordering, 2/4-col cloze, 1-col reading
- Distinct visual framing for Notices (outer frame + centered title), Emails (outer frame + dotted header divider), Articles
- Parenthesized bold-italic cloze numbers `(  18  )` in passages + horizontal rule above cloze options
- Dedicated Writing task pages mirroring 2024-2026 official layout:
  * Email (Grade 3 / Pre-2): dark caution banner, bulleted rules, sender email box, reply preview frame (`Hi, Name!` / `Thank you for your e-mail.` / `Best wishes,`), and `MEMO` tag
  * Summary (Pre-2 Plus / Grade 2 / Pre-1): dark caution banner, bulleted rules, indented 3-paragraph passage, and `MEMO` tag
  * Essay (Grade 3 / Pre-2 / Pre-2 Plus -> `QUESTION`; Grade 2 / Pre-1 -> `TOPIC` + `POINTS` bullets) + `MEMO` tag
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
BAND_X = 50
BAND_W = 38
X = 102
RIGHT = 539
BW = RIGHT - X
FULL_X = 98
FULL_W = RIGHT - FULL_X
LABELS = {
 'eiken_4': '英検4級',
 'eiken_3': '英検3級',
 'eiken_pre2': '英検準2級',
 'eiken_pre2plus': '英検準2級プラス',
 'eiken_2': '英検2級',
 'eiken_pre1': '英検準1級',
}
EN_GRADES = {
 'eiken_4': 'Grade 4',
 'eiken_3': 'Grade 3',
 'eiken_pre2': 'Grade Pre-2',
 'eiken_pre2plus': 'Grade Pre-2 Plus',
 'eiken_2': 'Grade 2',
 'eiken_pre1': 'Grade Pre-1',
}
SPLITS = {
 'eiken_4': [8, 7],
 'eiken_3': [7, 8],
 'eiken_pre2': [8, 7],
 'eiken_pre2plus': [6, 6, 5],
 'eiken_2': [6, 6, 5],
 'eiken_pre1': [6, 6, 6],
}
FONT = ParagraphStyle('reading-en', fontName='Times-Roman', fontSize=11.5, leading=17)
WRITING_EN = ParagraphStyle('writing-en', fontName='Times-Roman', fontSize=11.5, leading=17.5)
WRITING_INDENT_EN = ParagraphStyle('writing-indent-en', fontName='Times-Roman', fontSize=11.5, leading=18, firstLineIndent=18, spaceAfter=5)
TOPIC_ITALIC = ParagraphStyle('topic-italic', fontName='Times-BoldItalic', fontSize=12.5, leading=18.5)
JAPANESE = ParagraphStyle('reading-jp', fontName='BookletJP', fontSize=9.8, leading=15.5, wordWrap='CJK')
BULLET_JP = ParagraphStyle('bullet-jp', fontName='BookletJP', fontSize=9.3, leading=14.8, leftIndent=12, firstLineIndent=-12, spaceAfter=2.5, wordWrap='CJK')
BANNER_WHITE = ParagraphStyle('banner-white', fontName='BookletJP', fontSize=8.2, leading=13, textColor=colors.white, wordWrap='CJK')
NOTE = ParagraphStyle('reading-small', fontName='BookletJP', fontSize=8.8, leading=14, wordWrap='CJK')

def format_markup(text, highlight_cloze=False):
 markup = escape(text).replace('(     )', '(&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;)').replace('\n', '<br/>')
 markup = re.sub(r'(^|<br/>)([AB]):', r'\1<b><i>\2 :</i></b>', markup)
 # Support __underlined text__ in email writing prompts
 markup = re.sub(r'__([^_]+)__', r'<u>\1</u>', markup)
 if highlight_cloze:
  markup = re.sub(r'\((\d{2})\)', r'(&nbsp;&nbsp;<b><i>\1</i></b>&nbsp;&nbsp;)', markup)
 return markup

def para(text, style=FONT, highlight_cloze=False):
 return Paragraph(format_markup(text, highlight_cloze=highlight_cloze), style)

def height(text, width=BW, style=FONT, highlight_cloze=False):
 return para(text, style, highlight_cloze=highlight_cloze).wrap(width, H)[1]

def draw(c, text, x, top, width=BW, style=FONT, highlight_cloze=False):
 block = para(text, style, highlight_cloze=highlight_cloze)
 _, h = block.wrap(width, H)
 if top + h > H - 46:
  raise ValueError(f'Text overflows the print page ({top + h:.1f}>{H - 46:.1f}): {text[:60]}')
 block.drawOn(c, x, H - top - h)
 return h

def line(c, text, x, top, font='Times-Roman', size=11.5):
 c.setFont(font, size)
 c.drawString(x, H - top - size * .82, text)

def draw_dotted_rule(c, x1, x2, top):
 c.saveState()
 c.setStrokeColor(colors.HexColor('#888888'))
 c.setDash(1.2, 2.2)
 c.setLineWidth(0.45)
 c.line(x1, H - top, x2, H - top)
 c.restoreState()

def draw_memo_tag(c, top):
 """Official-style dark MEMO badge anchored across the left margin column."""
 tag_y = H - top - 18
 c.saveState()
 c.setFillColor(colors.HexColor('#222222'))
 c.rect(44, tag_y, 68, 18, stroke=0, fill=1)
 c.setFillColor(colors.white)
 c.setFont('Times-Bold', 10.5)
 c.drawCentredString(78, tag_y + 5, 'M E M O')
 c.restoreState()
 return top + 24

def frame(c, exam, page):
 # Subtle left vertical margin column band
 c.setFillColor(colors.HexColor('#e4e4e4'))
 c.rect(BAND_X, 34, BAND_W, H - 68, stroke=0, fill=1)
 c.setFillColor(colors.black)
 c.setStrokeColor(colors.black)
 c.setLineWidth(.4)
 kind_jp = 'リーディング' if exam.get('scope') == 'reading' else '一次筆記'
 line(c, f'{EN_GRADES[exam["grade"]]}  /  MANATOBI ORIGINAL', 52, 39, 'Times-Bold', 8)
 c.setFont('BookletJP', 8)
 c.drawRightString(RIGHT, H - 46, f'{LABELS[exam["grade"]]}形式 第{exam["round"]}回 {kind_jp}')
 c.line(BAND_X, 34, W - 56, 34)
 c.line(BAND_X, H - 34, W - 56, H - 34)
 line(c, 'マナトビ独自教材・公式問題ではありません', 94, H - 26, 'BookletJP', 7.5)
 line(c, f'• {page} •', W / 2 - 10, H - 26, 'Times-Bold', 9)
 c.setFont('Times-Roman', 7)
 c.drawRightString(RIGHT, 20, exam['revision'])

def heading(c, number, label, instruction, top=52, sub_letter=None):
 text_str = (f'{label}\n{instruction}' if label else instruction).strip()
 th = height(text_str, BW - 4, JAPANESE)
 h_box = max(46, th + 10)
 # Dark section badge on the left column
 badge_h = 32
 c.setFillColor(colors.HexColor('#222222'))
 c.rect(46, H - top - badge_h - 3, 42, badge_h, fill=1, stroke=0)
 c.setFillColor(colors.white)
 line(c, str(number), 60, top + 7, 'Times-BoldItalic', 20)
 if sub_letter:
  # Overlapping white sub-badge (`A` / `B` / `C`) matching authentic exam section headers
  c.setFillColor(colors.white)
  c.setStrokeColor(colors.HexColor('#444444'))
  c.setLineWidth(1.2)
  c.rect(74, H - top - badge_h - 11, 20, 18, fill=1, stroke=1)
  c.setFillColor(colors.black)
  line(c, sub_letter, 79.5, top + 23.5, 'Times-BoldItalic', 12)
 c.setFillColor(colors.black)
 c.setStrokeColor(colors.black)
 c.setLineWidth(.75)
 c.line(BAND_X, H - top - h_box, RIGHT, H - top - h_box)
 draw(c, text_str, X + 2, top + 5, BW - 4, JAPANESE)
 return top + h_box + 11

def compact_continuation_bar(c, section_no, sub_letter, note_text, top=54):
 c.setFillColor(colors.HexColor('#222222'))
 c.rect(46, H - top - 22, 38, 22, fill=1, stroke=0)
 c.setFillColor(colors.white)
 label = f'{section_no}{sub_letter}' if sub_letter else str(section_no)
 c.setFont('Times-BoldItalic', 13)
 c.drawCentredString(65, H - top - 16, label)
 c.setFillColor(colors.black)
 line(c, note_text, X, top + 4, 'BookletJP', 9.2)
 c.setLineWidth(0.55)
 c.line(BAND_X, H - top - 28, RIGHT, H - top - 28)
 return top + 40

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
   draw(c, choices[index], x + 22, cursor, cw - 26)
  cursor += rh + 5
 return cursor

def question(c, number, item, top, columns=1, show_prompt=True):
 line(c, f'({number})', 55, top, 'Times-BoldItalic', 11.5)
 if show_prompt:
  top += draw(c, item['prompt'], X, top) + 5
 return options(c, item['choices'], top, columns) + 11

def qheight(item, columns=1, show_prompt=True):
 return (height(item['prompt']) + 5 if show_prompt else 0) + options_height(item['choices'], columns) + 11

def best_cloze_columns(item):
 if qheight(item, 4, False) <= 34:
  return 4
 if qheight(item, 2, False) <= 60:
  return 2
 return 1

def draw_passage_block(c, passage, top, is_cloze=False):
 """Render notice, email, or article with authentic black-and-white examination styling."""
 fmt = passage.get('format', 'article')
 pt = passage['text']
 if fmt == 'notice':
  body_h = height(pt, BW - 24, highlight_cloze=is_cloze)
  title_band_h = 30
  total_h = title_band_h + body_h + 22
  if top + total_h > H - 60:
   raise ValueError(f'Notice exceeds safe one-page block: {passage["id"]}')
  c.setFillColor(colors.white)
  c.setLineWidth(1.0)
  c.rect(X - 10, H - top - total_h, BW + 20, total_h, stroke=1, fill=1)
  c.setFillColor(colors.black)
  c.setFont('Times-Bold', 13.5)
  c.drawCentredString(X + BW / 2, H - top - 22, passage['title'])
  draw_dotted_rule(c, X + 4, X + BW - 4, top + title_band_h)
  draw(c, pt, X + 2, top + title_band_h + 9, BW - 24, highlight_cloze=is_cloze)
  return top + total_h + 16
 elif fmt == 'email':
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
  hdr_h = height(hdr_text, BW - 24) + 10 if hdr_text else 0
  body_h = height(body_text, BW - 24, highlight_cloze=is_cloze)
  box_h = hdr_h + body_h + 22
  if top + box_h > H - 60:
   raise ValueError(f'Email exceeds safe one-page block: {passage["id"]}')
  c.setFillColor(colors.white)
  c.setLineWidth(0.75)
  c.rect(X - 10, H - top - box_h, BW + 20, box_h, stroke=1, fill=1)
  c.setFillColor(colors.black)
  if hdr_text:
   draw(c, hdr_text, X + 2, top + 8, BW - 24)
   draw_dotted_rule(c, X - 2, X + BW + 2, top + hdr_h + 4)
   draw(c, body_text, X + 2, top + hdr_h + 12, BW - 24, highlight_cloze=is_cloze)
  else:
   draw(c, body_text, X + 2, top + 10, BW - 24, highlight_cloze=is_cloze)
  return top + box_h + 16
 else:
  c.setFont('Times-Italic', 14.5)
  c.drawCentredString(X + BW / 2, H - top - 12, passage['title'])
  top += 20
  body_h = height(pt, BW, highlight_cloze=is_cloze)
  if top + body_h > H - 48:
   raise ValueError(f'Passage exceeds safe one-page block: {passage["id"]}')
  draw(c, pt, X, top, BW, highlight_cloze=is_cloze)
  if is_cloze:
   c.setLineWidth(0.65)
   c.line(BAND_X + 6, H - (top + body_h + 8), RIGHT, H - (top + body_h + 8))
   return top + body_h + 15
  return top + body_h + 16

def extract_sender_name(email_title, email_text):
 m = re.search(r'from\s+([A-Za-z]+)', email_title, re.I)
 if m:
  return m.group(1)
 lines = [ln.strip() for ln in email_text.strip().splitlines() if ln.strip()]
 if lines and re.match(r'^[A-Za-z]+$', lines[-1]):
  return lines[-1]
 return 'Friend'

def draw_caution_banner(c, text, top):
 bh = height(text, FULL_W - 22, BANNER_WHITE) + 12
 c.setFillColor(colors.HexColor('#222222'))
 c.roundRect(FULL_X, H - top - bh, FULL_W, bh, 6, stroke=0, fill=1)
 c.setFillColor(colors.white)
 draw(c, text, FULL_X + 11, top + 6, FULL_W - 22, BANNER_WHITE)
 c.setFillColor(colors.black)
 return top + bh + 10

def draw_writing_page(c, exam, section_no, first_writing_no, second_writing_no, item):
 """Render a dedicated Writing task page mirroring 2024-2026 Eiken official structure."""
 grade = exam['grade']
 wmin, wmax = item['wordRange']
 sec = item['section']
 title = SECTION_NAMES[sec]

 # Top section title bar
 c.setFillColor(colors.HexColor('#222222'))
 c.rect(46, H - 52 - 32, 42, 32, fill=1, stroke=0)
 c.setFillColor(colors.white)
 line(c, str(section_no), 60, 58, 'Times-BoldItalic', 21)
 c.setFillColor(colors.black)
 line(c, title, FULL_X, 58, 'BookletJP', 15.5)
 top = 92

 banner_msg = (
  f'● ライティング課題は2つ（大問 {first_writing_no} と 大問 {second_writing_no}）あります。筆記目安時間内に両方の課題に解答してください。\n'
  f'● この問題の解答は、解答用紙B面（2ページ目）の「{section_no}」の解答欄に英語で記入してください。'
 )
 top = draw_caution_banner(c, banner_msg, top)

 if sec == 'email':
  pas = item['passage']
  sender = extract_sender_name(pas['title'], pas['text'])
  if grade == 'eiken_3':
   has_qmark_in_underline = bool(re.search(r'__[^_]*\?[^_]*__', pas['text']))
   if has_qmark_in_underline:
    task_bullet = f'● あなたが書く返信メールの中で、友達（{sender}）からの2つの質問（下線部）に対応する内容を、あなた自身で自由に考えて答えなさい。'
   else:
    task_bullet = f'● あなたが書く返信メールの中で、友達（{sender}）のEメール文中の下線部について、あなたがもっと知りたい具体的な質問を2つしなさい。'
   bullets = [
    f'● あなたは、外国人の友達（{sender}）から以下のEメールを受け取りました。Eメールを読み、それに対する返信メールを英文で書きなさい。',
    task_bullet,
    f'● あなたが書く返信メールの英文の語数の目安は、{wmin}語〜{wmax}語です。',
    '● 解答は、解答用紙B面のEメール解答欄に書きなさい。解答欄の外に書かれたものは採点されません。',
    '● 下の返信枠の Best wishes, の後にあなたの名前を書く必要はありません。',
   ]
  else:
   bullets = [
    f'● あなたは、外国人の知り合い（{sender}）から、Eメールで質問を受け取りました。この質問にわかりやすく答える返信メールを英文で書きなさい。',
    f'● あなたが書く返信メールの中で、{sender} のEメール文中の下線部について、より理解を深めるために特徴や詳細を問う具体的な質問を2つしなさい。',
    f'● あなたが書く返信メールの英文の語数の目安は、{wmin}語〜{wmax}語です。',
    '● 解答は、解答用紙B面のEメール解答欄に書きなさい。解答欄の外に書かれたものは採点されません。',
    '● 下の返信枠の Best wishes, の後にあなたの名前を書く必要はありません。',
   ]
  for b in bullets:
   top += draw(c, b, FULL_X, top, FULL_W, BULLET_JP) + 2
  top += 6

  # Double-bordered incoming email frame
  email_text = pas['text']
  eh = height(email_text, FULL_W - 30, WRITING_EN)
  ebox_h = eh + 22
  c.setLineWidth(0.75)
  c.rect(FULL_X - 4, H - top - ebox_h, FULL_W + 8, ebox_h, stroke=1, fill=0)
  c.setLineWidth(0.35)
  c.rect(FULL_X - 1.5, H - top - ebox_h + 2.5, FULL_W + 3, ebox_h - 5, stroke=1, fill=0)
  draw(c, email_text, FULL_X + 10, top + 10, FULL_W - 30, WRITING_EN)
  top += ebox_h + 12

  # Double-bordered reply preview frame (`Hi, Name!` / `Thank you for your e-mail.` / inner answer note / `Best wishes,`)
  reply_h = 104
  c.setLineWidth(0.75)
  c.rect(FULL_X + 4, H - top - reply_h, FULL_W, reply_h, stroke=1, fill=0)
  c.setLineWidth(0.35)
  c.rect(FULL_X + 6.5, H - top - reply_h + 2.5, FULL_W - 5, reply_h - 5, stroke=1, fill=0)
  line(c, f'Hi, {sender}!', FULL_X + 18, top + 9, 'Times-Roman', 11.5)
  line(c, 'Thank you for your e-mail.', FULL_X + 18, top + 27, 'Times-Roman', 11.5)
  c.setLineWidth(0.45)
  c.rect(FULL_X + 20, H - top - 79, FULL_W - 32, 32, stroke=1, fill=0)
  c.setFont('BookletJP', 8.8)
  c.drawCentredString(FULL_X + 4 + FULL_W / 2, H - top - 61, f'解答は、解答用紙B面にある「{section_no} Eメール解答欄」に書きなさい。')
  c.drawCentredString(FULL_X + 4 + FULL_W / 2, H - top - 74, 'なお、解答欄の外に書かれたものは採点されません。')
  line(c, 'Best wishes,', FULL_X + 18, top + 84, 'Times-Roman', 11.5)
  top += reply_h + 14
  draw_memo_tag(c, top)

 elif sec == 'summary':
  bullets = [
   f'● 以下の英文を読んで、その内容を {wmin}〜{wmax}語の英語で要約し、解答欄に記入しなさい。',
   f'● 解答は、解答用紙B面にある「{section_no} 英文要約解答欄」に書きなさい。なお、解答欄の外に書かれたものは採点されません。',
   '● 本文に書かれていない自分の意見は加えず、英文の内容をよく読んでから自分の言葉でまとめなさい。',
  ]
  for b in bullets:
   top += draw(c, b, FULL_X, top, FULL_W, BULLET_JP) + 2
  top += 12

  for para_text in item['passage']['text'].split('\n\n'):
   if para_text.strip():
    top += draw(c, para_text.strip(), FULL_X, top, FULL_W, WRITING_INDENT_EN) + 5
  top += 14
  draw_memo_tag(c, top)

 else:
  # Opinion Essay (`QUESTION` for Grade 3 / Pre-2 / Pre-2 Plus; `TOPIC` + `POINTS` for Grade 2 / Pre-1)
  raw_prompt = item['prompt']
  topic_line = raw_prompt
  points_list = []
  marker_found = None
  for marker in ('\nQUESTION:', '\nTOPIC:'):
   if marker in raw_prompt:
    marker_found = marker
    break
  if marker_found:
   _, after_topic = raw_prompt.split(marker_found, 1)
   if '\nPOINTS:' in after_topic:
    t_part, p_part = after_topic.split('\nPOINTS:', 1)
    topic_line = t_part.strip()
    points_list = [ln.lstrip('•-* ').strip() for ln in p_part.strip().splitlines() if ln.strip()]
   else:
    topic_line = after_topic.strip()

  uses_question_label = grade in ('eiken_3', 'eiken_pre2', 'eiken_pre2plus')
  keyword = 'QUESTION' if uses_question_label else 'TOPIC'
  bullets = [
   f'● 以下の {keyword} について、あなたの考え（意見）とその理由を2つ英文で書きなさい。',
  ]
  if points_list:
   if grade == 'eiken_pre1':
    bullets.append('● POINTS は理由を書く際の観点です。4つのうちから2つを選び、序論・本論（2つ）・結論の構成で書きなさい。')
   else:
    bullets.append('● POINTS は理由を書く際の参考となる観点を示したものです。これら以外の観点から理由を書いてもかまいません。')
  bullets += [
   f'● 語数の目安は {wmin}語〜{wmax}語です。',
   f'● 解答は、解答用紙B面にある「{section_no} 英作文解答欄」に書きなさい。なお、解答欄の外に書かれたものは採点されません。',
   f'● 解答が {keyword} に対応していないと判断された場合は採点対象になりません。内容をよく読んでから答えてください。',
  ]
  for b in bullets:
   top += draw(c, b, FULL_X, top, FULL_W, BULLET_JP) + 2
  top += 14

  line(c, keyword, FULL_X, top, 'Times-Bold', 12)
  top += 18
  top += draw(c, topic_line, FULL_X, top, FULL_W, TOPIC_ITALIC) + 16

  if points_list:
   line(c, 'POINTS', FULL_X, top, 'Times-Bold', 11.5)
   top += 18
   for pt_item in points_list:
    line(c, '●', FULL_X + 2, top + 1, 'BookletJP', 9.5)
    top += draw(c, pt_item, FULL_X + 18, top, FULL_W - 18, TOPIC_ITALIC) + 4
   top += 12

  draw_memo_tag(c, top)

def build_reading_questions(path, exam, cover_pdf):
 FONT.fontSize = 10.6 if exam['grade'] == 'eiken_pre1' else 11.4
 FONT.leading = 14.8 if exam['grade'] == 'eiken_pre1' else 16.8
 WRITING_EN.fontSize = 10.8 if exam['grade'] == 'eiken_pre1' else 11.3
 WRITING_EN.leading = 15.8 if exam['grade'] == 'eiken_pre1' else 17.0
 WRITING_INDENT_EN.fontSize = WRITING_EN.fontSize
 WRITING_INDENT_EN.leading = WRITING_EN.leading + 0.5

 temp = Path(str(path) + '.body.pdf')
 c = canvas.Canvas(str(temp), pagesize=A4, invariant=1, pageCompression=1)
 page = 2
 frame(c, exam, page)
 choice_items = [q for q in exam['items'] if q['kind'] == 'choice']
 writing_items = [q for q in exam['items'] if q['kind'] == 'writing']
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
  first_n = numbers[items[0]['id']]
  last_n = numbers[items[-1]['id']]

  if section == 'short':
   top = heading(
    c,
    section_no,
    '',
    f'次の({first_n})から({last_n})までの（　　　）に入れるのに最も適切なものを1, 2, 3, 4の中から一つ選び、その番号のマーク欄をぬりつぶしなさい。',
   )
   index = 0
   for pi, count in enumerate(SPLITS[exam['grade']]):
    if pi:
     new_page()
     top = compact_continuation_bar(c, section_no, None, f'{SECTION_NAMES[section]}（続き）')
    available = H - 52 - top
    slot = min(116, available / count)
    for item in items[index:index + count]:
     cols = 4 if qheight(item, 4) <= slot else 2
     if qheight(item, cols) > slot:
      cols = 1
     if qheight(item, cols) > slot:
      raise ValueError(f'Short options cannot fit slot ({cols} cols): {item["id"]}')
     question(c, numbers[item['id']], item, top, cols)
     top += slot
    plans.append({'section': section, 'page': page, 'questions': list(range(index + 1, index + count + 1))})
    index += count

  elif section == 'conversation':
   top = heading(
    c,
    section_no,
    '',
    f'次の({first_n})から({last_n})までの会話文を完成させるために、（　　　）に入れるのに最も適切なものを1, 2, 3, 4の中から一つ選び、その番号のマーク欄をぬりつぶしなさい。',
   )
   slot = (H - 52 - top) / len(items)
   for idx_conv, item in enumerate(items):
    cols = 2 if qheight(item, 2) <= slot - 4 else 1
    if qheight(item, cols) > slot:
     raise ValueError(f'Conversation slot overflow: {item["id"]}')
    used_end = question(c, numbers[item['id']], item, top, cols)
    if idx_conv < len(items) - 1:
     rule_y = top + slot - 6
     if used_end - 4 < rule_y:
      draw_dotted_rule(c, X - 8, RIGHT, rule_y)
    top += slot
   plans.append({'section': section, 'page': page, 'questions': [numbers[q['id']] for q in items]})

  elif section == 'reorder':
   top = heading(
    c,
    section_no,
    '',
    f'次の({first_n})から({last_n})までの日本文の意味を表すように①から④までを並べ替えてわくの中に入れたとき、1番目と3番目にくるものの組合せを1, 2, 3, 4から選びなさい。',
   )
   top = max(top + 6, 172)
   for item in items:
    reorder_question(c, numbers[item['id']], item, top)
    top += 119
   plans.append({'section': section, 'page': page, 'questions': [numbers[q['id']] for q in items]})

  else:
   groups = []
   seen_map = {}
   for item in items:
    pid = item['passage']['id']
    if pid not in seen_map:
     seen_map[pid] = []
     groups.append(seen_map[pid])
    seen_map[pid].append(item)

   multi_group = len(groups) > 1
   for gi, group in enumerate(groups):
    if gi > 0:
     new_page()
    passage = group[0]['passage']
    sub_letter = chr(ord('A') + gi) if multi_group else None
    g_first = numbers[group[0]['id']]
    g_last = numbers[group[-1]['id']]
    range_str = f'({g_first})と({g_last})' if len(group) == 2 else f'({g_first})から({g_last})まで'

    if section == 'cloze':
     inst = f'次の英文を読み、その文意にそって{range_str}の（　　　）に入れるのに最も適切なものを1, 2, 3, 4の中から一つ選び、その番号のマーク欄をぬりつぶしなさい。'
    else:
     fmt = passage.get('format', 'article')
     genre_jp = '掲示の内容' if fmt == 'notice' else ('Eメールの内容' if fmt == 'email' else '英文の内容')
     inst = f'次の{genre_jp}に関して、{range_str}の質問に対する答えとして最も適切なもの、または文を完成させるのに最も適切なものを1, 2, 3, 4の中から一つ選びなさい。'

    top = heading(c, section_no, '', inst, top=52, sub_letter=sub_letter)

    sim_c = canvas.Canvas('/dev/null', pagesize=A4)
    after_passage_top = draw_passage_block(sim_c, passage, top, is_cloze=(section == 'cloze'))
    if section == 'cloze':
     q_total = sum(qheight(q, best_cloze_columns(q), False) for q in group)
    else:
     q_total = sum(qheight(q, 1, True) + (8 if idx_q < len(group) - 1 else 0) for idx_q, q in enumerate(group))

    combined_allowed = section == 'cloze' or (passage.get('format') in ['notice', 'email'] and exam['grade'] != 'eiken_4')
    if section == 'cloze' and after_passage_top + q_total > H - 46:
     raise ValueError(f'Cloze text/options exceed one page: {passage["id"]}: {after_passage_top + q_total}')
    combined = combined_allowed and (after_passage_top + q_total <= H - 46)

    top = draw_passage_block(c, passage, top, is_cloze=(section == 'cloze'))
    if not combined:
     new_page()
     top = compact_continuation_bar(c, section_no, sub_letter, f'{passage["title"]} — Questions ({g_first})–({g_last})')

    for idx_q, item in enumerate(group):
     cols = best_cloze_columns(item) if section == 'cloze' else 1
     required = qheight(item, cols, section != 'cloze')
     if top + required > H - 46:
      new_page()
      top = compact_continuation_bar(c, section_no, sub_letter, f'{passage["title"]} — Questions (continued)')
     top = question(c, numbers[item['id']], item, top, cols, section != 'cloze')
     if section == 'reading' and idx_q < len(group) - 1 and top + 24 < H - 46:
      draw_dotted_rule(c, BAND_X + 6, RIGHT, top - 3)
      top += 7

    plans.append({'section': section, 'page': page, 'passage': passage['id'], 'questions': [numbers[q['id']] for q in group]})

 # Writing sections (email / summary / essay)
 if writing_items:
  first_w_no = section_no + 1
  second_w_no = section_no + len(writing_items)
  for w_item in writing_items:
   section_no += 1
   new_page()
   draw_writing_page(c, exam, section_no, first_w_no, second_w_no, w_item)
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
