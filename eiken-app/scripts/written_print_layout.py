"""Print-only layout for Eiken-style written booklets:
- Exam-style cover sheet with official Manatobi brand logo, section/score table & candidate record box
- Grade-5 choice layout (7/8 short, 5 conversation, 5 four-box ordering)
- Mark sheet (landscape A4 page 1, zero overlap even at 35 items, zebra stripes & 5-row dividers)
- Official-style side-by-side 2-column lined writing answer sheet (landscape A4 page 2 for grades 3 through Pre-1)
Only functional exam conventions are used. Zero official text, logos, or cover art.
"""
from html import escape
from pathlib import Path
import re
import pymupdf
from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import A4, landscape
from reportlab.lib.styles import ParagraphStyle
from reportlab.platypus import Paragraph
from reportlab.lib import colors
from reportlab.pdfbase import pdfmetrics

W, H = A4
LEFT = 102
RIGHT = 539
CIRCLED = '①②③④'
EN = ParagraphStyle('exam-en', fontName='Times-Roman', fontSize=12.5, leading=20)
JP = ParagraphStyle('exam-jp', fontName='BookletJP', fontSize=10.5, leading=17, wordWrap='CJK')
SMALL = ParagraphStyle('exam-note', fontName='BookletJP', fontSize=8.5, leading=13.5, wordWrap='CJK')
COVER_JP = ParagraphStyle('cover-jp', fontName='BookletJP', fontSize=9.5, leading=15.5, wordWrap='CJK')
COVER_SMALL = ParagraphStyle('cover-small', fontName='BookletJP', fontSize=8.2, leading=13, wordWrap='CJK')

GRADE_LABELS = {
 'eiken_5': ('英検5級', '5級', 'GRADE 5'),
 'eiken_4': ('英検4級', '4級', 'GRADE 4'),
 'eiken_3': ('英検3級', '3級', 'GRADE 3'),
 'eiken_pre2': ('英検準2級', '準2級', 'GRADE PRE-2'),
 'eiken_pre2plus': ('英検準2級プラス', '準2級+', 'GRADE PRE-2 PLUS'),
 'eiken_2': ('英検2級', '2級', 'GRADE 2'),
 'eiken_pre1': ('英検準1級', '準1級', 'GRADE PRE-1'),
}
SECTION_NAMES = {
 'short': '短文の語句空所補充',
 'conversation': '会話文の空所補充',
 'reorder': '日本文付き語句整序',
 'cloze': '長文の語句空所補充',
 'reading': '長文の内容一致選択',
 'email': 'ライティング（Eメール）',
 'summary': 'ライティング（英文要約）',
 'essay': 'ライティング（英作文）',
}
WRITING_BOX_LABELS = {
 'email': 'Eメール解答欄',
 'summary': '英文要約解答欄',
 'essay': '英作文解答欄',
}

def paragraph(c, text, x, top, width, style=EN, max_height=None):
 markup = escape(text).replace('(     )', '(&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;)').replace('\n', '<br/>')
 markup = re.sub(r'(^|<br/>)([AB]):', r'\1<b><i>\2 :</i></b>', markup)
 p = Paragraph(markup, style)
 _, ph = p.wrap(width, H)
 if max_height is not None and ph > max_height:
  raise ValueError(f'Print slot overflow ({ph}>{max_height}): {text}')
 p.drawOn(c, x, H - top - ph)
 return ph

def string(c, text, x, top, font='Times-Roman', size=12.5):
 c.setFont(font, size)
 c.drawString(x, H - top - size * .82, text)

LOGO_PATH = Path(__file__).resolve().parents[1] / 'public/brand/manatobi-logo-gray.png'

def build_cover_pdf(path, exam, blueprint):
 """ Crisp black-and-white examination booklet cover on A4 portrait with official Manatobi brand logo. """
 if not LOGO_PATH.exists():
  raise FileNotFoundError(f'Mandatory Manatobi logo missing: {LOGO_PATH}')
 c = canvas.Canvas(str(path), pagesize=A4, pageCompression=1, invariant=1)
 full_label, badge_label, en_grade = GRADE_LABELS[exam['grade']]
 choice_items = [q for q in exam['items'] if q['kind'] == 'choice']
 writing_items = [q for q in exam['items'] if q['kind'] == 'writing']
 is_reading_only = exam.get('scope') == 'reading'
 has_writing = len(writing_items) > 0
 mode_title = 'リーディング練習' if is_reading_only else ('一次筆記（リーディング・ライティング）' if has_writing else '一次筆記（リーディング）')

 # Top brand header with official Manatobi logo (480x152 RGBA -> 98x31 pt)
 c.drawImage(str(LOGO_PATH), 52, H - 64, width=98, height=31, mask='auto', preserveAspectRatio=True)
 c.setStrokeColor(colors.black)
 c.setFillColor(colors.black)
 string(c, f'MANATOBI ORIGINAL PRACTICE  /  {en_grade}', 160, 35, 'Times-Bold', 8.5)
 c.setFont('BookletJP', 8.8)
 c.drawRightString(W - 54, H - 56, f'マナトビ独自予想・演習冊子｜第{exam["round"]}回')
 c.setLineWidth(1.2)
 c.line(52, H - 72, W - 52, H - 72)
 c.setLineWidth(0.4)
 c.line(52, H - 75, W - 52, H - 75)

 # Hero banner frame
 banner_top = 90
 banner_h = 110
 c.setLineWidth(1.1)
 c.rect(52, H - banner_top - banner_h, W - 104, banner_h, stroke=1, fill=0)
 # Solid black grade badge on the left
 c.setFillColor(colors.black)
 c.rect(64, H - banner_top - banner_h + 14, 96, banner_h - 28, stroke=0, fill=1)
 c.setFillColor(colors.white)
 badge_size = 20 if len(badge_label) >= 4 else 25
 c.setFont('BookletJP', badge_size)
 c.drawCentredString(112, H - banner_top - 52, badge_label)
 c.setFont('Times-Bold', 9.5)
 c.drawCentredString(112, H - banner_top - 78, f'ROUND {exam["round"]:02d}')
 c.setFillColor(colors.black)

 # Title & timing summary on the right of badge
 string(c, f'{full_label}形式', 176, banner_top + 13, 'BookletJP', 13)
 string(c, mode_title, 176, banner_top + 35, 'BookletJP', 18)
 time_note = (
  f'筆記目安時間：{blueprint["minutes"]}分'
  if not is_reading_only
  else '部分演習（筆記全体の制限時間は流用しません）'
 )
 count_note = f'選択問題 {len(choice_items)}問' + (f' ＋ ライティング {len(writing_items)}題' if has_writing else '')
 c.setFillColor(colors.HexColor('#f2f2f2'))
 c.rect(176, H - banner_top - banner_h + 14, W - 240, 27, stroke=0, fill=1)
 c.setFillColor(colors.black)
 string(c, f'第{exam["round"]}回 問題冊子　｜　{time_note}　｜　{count_note}', 184, banner_top + 76, 'BookletJP', 9.3)

 # Section breakdown & self-scoring table
 tbl_top = 218
 string(c, '■ 出題構成・自己採点記録表', 54, tbl_top, 'BookletJP', 11)
 row_top = tbl_top + 20
 col_x = [52, 92, 172, 416, 464, W - 52]
 headers = ['大問', '問題番号', '出題形式・内容', '設問数', '自己採点・点検']
 header_h = 22
 c.setFillColor(colors.HexColor('#eaeaea'))
 c.rect(col_x[0], H - row_top - header_h, col_x[-1] - col_x[0], header_h, stroke=0, fill=1)
 c.setFillColor(colors.black)
 c.setLineWidth(0.7)
 c.rect(col_x[0], H - row_top - header_h, col_x[-1] - col_x[0], header_h, stroke=1, fill=0)
 for idx, htext in enumerate(headers):
  c.setFont('BookletJP', 8.8)
  c.drawCentredString((col_x[idx] + col_x[idx + 1]) / 2, H - row_top - 15, htext)
 for x in col_x[1:-1]:
  c.setLineWidth(0.4)
  c.line(x, H - row_top, x, H - row_top - header_h)

 specs = [s for s in blueprint['sections'] if (not is_reading_only or s['kind'] == 'choice')]
 cur_y = row_top + header_h
 row_h = 24
 writing_seq = 0
 for sec_no, spec in enumerate(specs, 1):
  if sec_no % 2 == 0:
   c.setFillColor(colors.HexColor('#fafafa'))
   c.rect(col_x[0], H - cur_y - row_h, col_x[-1] - col_x[0], row_h, stroke=0, fill=1)
   c.setFillColor(colors.black)
  c.setLineWidth(0.45)
  c.rect(col_x[0], H - cur_y - row_h, col_x[-1] - col_x[0], row_h, stroke=1, fill=0)
  for x in col_x[1:-1]:
   c.line(x, H - cur_y, x, H - cur_y - row_h)
  if spec['kind'] == 'choice':
   nums = [i + 1 for i, q in enumerate(choice_items) if q['section'] == spec['id']]
   num_label = f'({nums[0]})〜({nums[-1]})' if len(nums) > 1 else f'({nums[0]})'
   sec_desc = SECTION_NAMES[spec['id']]
   cnt_label = f'{len(nums)}問'
   score_label = f'      ／ {len(nums)}'
  else:
   writing_seq += 1
   w_item = [q for q in writing_items if q['section'] == spec['id']][0]
   wmin, wmax = w_item['wordRange']
   num_label = f'大問 {sec_no}'
   sec_desc = f'{SECTION_NAMES[spec["id"]]}（目安 {wmin}〜{wmax}語）'
   cnt_label = '1題'
   score_label = '□ 自己点検済'
  c.setFont('Times-Bold', 10.5)
  c.drawCentredString((col_x[0] + col_x[1]) / 2, H - cur_y - 16, str(sec_no))
  c.setFont('BookletJP', 9.2)
  c.drawCentredString((col_x[1] + col_x[2]) / 2, H - cur_y - 16, num_label)
  string(c, sec_desc, col_x[2] + 8, cur_y + 6, 'BookletJP', 9.2)
  c.setFont('BookletJP', 9.2)
  c.drawCentredString((col_x[3] + col_x[4]) / 2, H - cur_y - 16, cnt_label)
  c.drawCentredString((col_x[4] + col_x[5]) / 2, H - cur_y - 16, score_label)
  cur_y += row_h

 # Instructions box
 guide_top = cur_y + 18
 string(c, '■ 演習・印刷の手引き', 54, guide_top, 'BookletJP', 11)
 box_top = guide_top + 18
 sheet_guide = (
  '解答用紙はA4横2ページ構成です（A面：マークシート／B面：左右2列のライティング解答欄）。'
  if has_writing
  else '解答用紙はA4横マークシート（1ページ）です。'
 )
 guide_lines = '\n'.join([
  f'1. 問題冊子には正答や解説を載せていません。{sheet_guide}',
  '2. 印刷時は「白黒・実際のサイズ（100%）」を選ぶと、マーク欄や英作文罫線が本番見本に近い実寸で出力されます。',
  '3. 解き終わるまでは「解答・解説」を開かず、本番と同じ時間配分を意識して取り組んでください。',
  '4. 同じ選択問題はアプリの「分野別練習」、英作文課題はアプリの「ライティング練習」でも学習・保存できます。',
 ])
 box_h = 126
 c.setLineWidth(0.6)
 c.rect(52, H - box_top - box_h, W - 104, box_h, stroke=1, fill=0)
 paragraph(c, guide_lines, 64, box_top + 9, W - 128, COVER_JP, box_h - 14)

 # Candidate & score box
 rec_top = box_top + box_h + 14
 rec_h = 66
 c.setFillColor(colors.HexColor('#f8f8f8'))
 c.rect(52, H - rec_top - rec_h, W - 104, rec_h, stroke=1, fill=1)
 c.setFillColor(colors.black)
 string(c, '実施日：　　　　年　　月　　日', 66, rec_top + 11, 'BookletJP', 10)
 string(c, '開始〜終了：　　：　　〜　　：　　', 280, rec_top + 11, 'BookletJP', 10)
 string(c, '氏名：______________________________', 66, rec_top + 38, 'BookletJP', 10)
 string(c, f'選択問題 合計：　　　／ {len(choice_items)} 点', 330, rec_top + 38, 'BookletJP', 10.5)

 # Disclaimer note above footer
 disc_top = rec_top + rec_h + 10
 disclaimer = (
  f'※ 本冊子はマナトビが独自に執筆・編集した{full_label}形式のオリジナル教材（第{exam["round"]}回）です。'
  'リスニング・二次面接は含みません。日本英語検定協会の公式過去問・公式予想問題ではなく、CSEスコア算出や合否判定は行いません。外部機関による難度校正は未実施です。'
 )
 paragraph(c, disclaimer, 54, disc_top, W - 108, COVER_SMALL, 56)

 # Footer
 c.setLineWidth(0.4)
 c.line(52, 42, W - 52, 42)
 c.setFont('BookletJP', 8)
 c.drawString(54, 28, f'マナトビ独自教材・公式問題ではありません｜{exam["revision"]}')
 c.drawRightString(W - 54, 28, '問題 1')
 c.showPage()
 c.save()

def page_chrome(c, exam, page, section=None):
 # Subtle left vertical margin band matching examination booklet aesthetic
 c.setFillColor(colors.HexColor('#e4e4e4'))
 c.rect(50, 34, 38, H - 68, stroke=0, fill=1)
 c.setFillColor(colors.black)
 string(c, f'MANATOBI  /  GRADE 5  /  ROUND {exam["round"]:02d}', 54, 40, 'Times-Bold', 8)
 string(c, f'英検5級形式・一次筆記 第{exam["round"]}回', 345, 40, 'BookletJP', 8)
 c.setLineWidth(.4)
 c.line(50, 34, W - 56, 34)
 c.line(50, H - 34, W - 56, H - 34)
 string(c, 'マナトビ独自教材｜公式問題ではありません', 94, H - 26, 'BookletJP', 7.5)
 string(c, f'• {page} •', W / 2 - 10, H - 26, 'Times-Bold', 9)
 string(c, exam['revision'], 385, H - 26, 'Times-Roman', 7)

def section_header(c, no, text, top, height):
 c.setLineWidth(.75)
 c.setStrokeColor(colors.black)
 c.line(50, H - top, 539, H - top)
 c.line(50, H - top - height, 539, H - top - height)
 c.setFillColor(colors.HexColor('#222222'))
 c.rect(50, H - top - height, 38, height, fill=1, stroke=0)
 c.setFillColor(colors.white)
 string(c, str(no), 62, top + height / 2 - 13, 'Times-BoldItalic', 24)
 c.setFillColor(colors.black)
 paragraph(c, text, 102, top + 12, 428, JP, height - 18)

def question_number(c, number, top):
 string(c, f'({number})', 55, top, 'Times-BoldItalic', 11.5)

def choice_row(c, choices, top, columns=4):
 col_width = (RIGHT - LEFT) / columns
 for index, text in enumerate(choices):
  row = index // columns
  column = index % columns
  x = LEFT + column * col_width
  string(c, str(index + 1), x + 8, top + row * 23, 'Times-Bold', 12)
  paragraph(c, text, x + 28, top + row * 23, col_width - 33, EN, 20)

def short_question(c, number, item, top, slot):
 question_number(c, number, top)
 height = paragraph(c, item['prompt'], LEFT, top, RIGHT - LEFT, EN, 40)
 choice_row(c, item['choices'], top + height + 5)
 if height + 25 > slot:
  raise ValueError('Short question slot is too small')

def conversation_question(c, number, item, top, show_divider=False):
 question_number(c, number, top)
 height = paragraph(c, item['prompt'], LEFT, top, RIGHT - LEFT, EN, 42)
 choice_row(c, item['choices'], top + height + 5, columns=2)
 if show_divider:
  c.setStrokeColor(colors.HexColor('#999999'))
  c.setDash(1.2, 2.2)
  c.setLineWidth(0.4)
  c.line(LEFT, H - (top + height + 55), RIGHT, H - (top + height + 55))
  c.setDash()
  c.setStrokeColor(colors.black)

def reorder_question(c, number, item, top):
 question_number(c, number, top)
 paragraph(c, item['translation'], LEFT, top, RIGHT - LEFT, JP, 34)
 x = LEFT + 4
 tokens_top = top + 26
 for index, token in enumerate(item['orderTokens']):
  string(c, CIRCLED[index], x, tokens_top, 'BookletJP', 11)
  string(c, token, x + 15, tokens_top, 'Times-Roman', 12)
  x += 15 + pdfmetrics.stringWidth(token, 'Times-Roman', 12) + 18
 if x - 18 > RIGHT:
  raise ValueError(f'Ordering tokens do not fit one line: {item["id"]}')
 baseline_top = top + 56
 prefix = item['orderPrefix']
 string(c, prefix, LEFT + 20, baseline_top, 'Times-Roman', 12.5)
 start = LEFT + 24 + pdfmetrics.stringWidth(prefix, 'Times-Roman', 12.5)
 for index in range(4):
  x = start + index * 67
  c.setLineWidth(.8 if index in [0, 2] else .4)
  c.rect(x, H - baseline_top - 16, 63, 18, stroke=1, fill=0)
  if index in [0, 2]:
   string(c, f'{index + 1}番目', x + 19, baseline_top - 11, 'BookletJP', 7.5)
 string(c, item['completedSentence'][-1], start + 4 * 67 + 2, baseline_top, 'Times-Roman', 12.5)
 for index, pair in enumerate(item['choices']):
  x = LEFT + index * (RIGHT - LEFT) / 4
  string(c, str(index + 1), x + 10, top + 84, 'Times-Bold', 12.5)
  displayed = '－'.join(CIRCLED[int(value) - 1] for value in pair.split('－'))
  string(c, displayed, x + 31, top + 84, 'BookletJP', 11)
 c.setStrokeColor(colors.HexColor('#999999'))
 c.setDash(1.2, 2.2)
 c.setLineWidth(.35)
 c.line(LEFT, H - top - 107, RIGHT, H - top - 107)
 c.setDash()
 c.setStrokeColor(colors.black)

def build_questions(path, exam, cover_pdf):
 """Cover + 7/8 short questions + 5 conversations + 5 ordering questions = 5 A4 pages."""
 temp = str(path) + '.body.pdf'
 c = canvas.Canvas(temp, pagesize=A4, pageCompression=1, invariant=1)
 page_chrome(c, exam, 2)
 c.setFillColor(colors.HexColor('#f7f7f7'))
 c.setLineWidth(.5)
 c.rect(96, H - 128, 443, 66, stroke=1, fill=1)
 c.setFillColor(colors.black)
 paragraph(c, '解答上の注意\n問題冊子ではなく、別の解答用紙に答えをマークしてください。各問1つ、1〜4の番号を選びます。訂正するときは、前のマークを消しゴムできれいに消してください。', 108, 70, 419, SMALL, 55)
 section_header(c, 1, '次の(1)から(15)までの（　　　）に入れるのに最も適切なものを1, 2, 3, 4の中から一つ選び、その番号のマーク欄をぬりつぶしなさい。', 148, 84)
 for i, item in enumerate(exam['items'][:7]):
  short_question(c, i + 1, item, 256 + i * 74, 74)
 c.showPage()
 page_chrome(c, exam, 3)
 c.setFillColor(colors.HexColor('#222222'))
 c.rect(50, H - 84, 38, 24, stroke=0, fill=1)
 c.setFillColor(colors.white)
 string(c, '1', 64, 63, 'Times-BoldItalic', 14)
 c.setFillColor(colors.black)
 string(c, '短文の語句空所補充（続き）', 102, 66, 'BookletJP', 9.5)
 c.setLineWidth(.5)
 c.line(50, H - 90, 539, H - 90)
 for i, item in enumerate(exam['items'][7:15]):
  short_question(c, i + 8, item, 114 + i * 82, 82)
 c.showPage()
 page_chrome(c, exam, 4)
 section_header(c, 2, '次の(16)から(20)までの会話文を完成させるために、（　　　）に入れるのに最も適切なものを1, 2, 3, 4の中から一つ選び、その番号をマークしなさい。', 62, 82)
 for i, item in enumerate(exam['items'][15:20]):
  conversation_question(c, i + 16, item, 174 + i * 121, show_divider=(i < 4))
 c.showPage()
 page_chrome(c, exam, 5)
 section_header(c, 3, '次の(21)から(25)までの日本文の意味を表すように①から④までを並べ替えてわくの中に入れたとき、1番目と3番目にくるものの組合せを1, 2, 3, 4から選びなさい。', 62, 92)
 for i, item in enumerate(exam['items'][20:25]):
  reorder_question(c, i + 21, item, 180 + i * 119)
 c.showPage()
 c.save()
 with pymupdf.open(cover_pdf) as cover, pymupdf.open(temp) as body:
  out = pymupdf.open()
  out.insert_pdf(cover)
  out.insert_pdf(body)
  out.set_metadata({'title': f'マナトビ 英検5級形式 一次筆記 第{exam["round"]}回 問題冊子', 'author': 'マナトビ'})
  out.save(path, garbage=4, deflate=True)
  out.close()
 Path(temp).unlink()

def _build_mark_sheet_page(path, exam, blueprint):
 """Page 1 (Side A): Landscape A4 mark sheet with zebra rows, 5-question dividers, and zero text overlap."""
 c = canvas.Canvas(str(path), pagesize=landscape(A4), pageCompression=1, invariant=1)
 w, h = landscape(A4)

 def txt(text, x, y, size=10, font='BookletJP'):
  c.setFont(font, size)
  c.drawString(x, y, text)

 full_label, badge_label, _ = GRADE_LABELS[exam['grade']]
 choice_items = [q for q in exam['items'] if q['kind'] == 'choice']
 writing_items = [q for q in exam['items'] if q['kind'] == 'writing']
 total = len(choice_items)
 has_writing = len(writing_items) > 0

 c.setTitle(f'マナトビ {full_label} 一次筆記 第{exam["round"]}回 解答用紙')
 c.setAuthor('マナトビ')

 # Header
 c.setFillColor(colors.black)
 c.rect(42, h - 72, 68, 34, stroke=0, fill=1)
 c.setFillColor(colors.white)
 c.setFont('BookletJP', 15 if len(badge_label) >= 4 else 17)
 c.drawCentredString(76, h - 61, badge_label)
 c.setFillColor(colors.black)
 side_tag = '（A面：マークシート）' if has_writing else '（マークシート）'
 txt(f'{full_label}形式　一次筆記 第{exam["round"]}回　解答用紙{side_tag}', 120, h - 55, 15)
 sub_note = (
  'マナトビ独自教材｜公式の解答用紙ではありません｜2ページ目（B面・A4横）にライティング解答欄があります'
  if has_writing
  else 'マナトビ独自教材｜公式の解答用紙ではありません｜A4横・白黒・実際のサイズ（100%）で印刷'
 )
 txt(sub_note, 120, h - 73, 8.4)
 c.setLineWidth(0.6)
 c.line(42, h - 82, w - 42, h - 82)

 # Left box: candidate info + section score summary
 left_x = 42
 left_w = 342
 box_bottom = 68
 box_top = h - 96
 c.setLineWidth(0.7)
 c.rect(left_x, box_bottom, left_w, box_top - box_bottom, stroke=1, fill=0)
 txt('氏名', 58, box_top - 28, 10.5)
 c.line(96, box_top - 32, 368, box_top - 32)
 txt('実施日', 58, box_top - 60, 10)
 c.line(104, box_top - 64, 232, box_top - 64)
 txt('時間', 244, box_top - 60, 10)
 c.line(272, box_top - 64, 368, box_top - 64)

 # Mini score breakdown table inside left box
 score_title_y = box_top - 92
 txt('■ 選択問題 自己採点メモ（各1点・復習用素点）', 58, score_title_y, 9.2)
 choice_specs = [s for s in blueprint['sections'] if s['kind'] == 'choice']
 sy = score_title_y - 12
 row_sh = 22
 c.setFillColor(colors.HexColor('#efefef'))
 c.rect(58, sy - row_sh, 310, row_sh, stroke=1, fill=1)
 c.setFillColor(colors.black)
 txt('大問・分野', 66, sy - 15, 8.5)
 txt('問題番号', 228, sy - 15, 8.5)
 txt('得点', 312, sy - 15, 8.5)
 cur_sy = sy - row_sh
 for idx, spec in enumerate(choice_specs, 1):
  nums = [i + 1 for i, q in enumerate(choice_items) if q['section'] == spec['id']]
  c.setLineWidth(0.4)
  c.rect(58, cur_sy - row_sh, 310, row_sh, stroke=1, fill=0)
  txt(f'大問{idx}：{SECTION_NAMES[spec["id"]]}', 64, cur_sy - 15, 8.3)
  txt(f'({nums[0]})〜({nums[-1]})', 228, cur_sy - 15, 8.5, 'BookletJP')
  txt(f'    ／ {len(nums)}', 306, cur_sy - 15, 8.5)
  cur_sy -= row_sh

 # Total row
 c.setFillColor(colors.HexColor('#f7f7f7'))
 c.rect(58, cur_sy - 24, 310, 24, stroke=1, fill=1)
 c.setFillColor(colors.black)
 txt('選択問題 合計素点（CSE換算なし）', 64, cur_sy - 16, 8.8)
 txt(f'      ／ {total}', 302, cur_sy - 16, 9.5)
 cur_sy -= 34

 if has_writing:
  txt(f'■ ライティング（全{len(writing_items)}題）：B面（2ページ目）の2列解答欄に記入', 58, cur_sy - 6, 8.6)
  txt(f'※ 公式筆記目安時間：{blueprint["minutes"]}分（リーディング＋ライティング合計）', 58, cur_sy - 22, 8.2)
 else:
  txt(f'※ 公式筆記目安時間：{blueprint["minutes"]}分｜リスニング・英作文は含みません。', 58, cur_sy - 6, 8.4)
  txt('※ アプリの分野別練習と同じ問題番号・正答に対応しています。', 58, cur_sy - 22, 8.2)

 # Right side: Mark columns
 right_x1 = 420
 right_x2 = 614
 colw = 178
 mark_top = h - 118
 txt('選択問題 マーク欄', right_x1, h - 102, 12)
 c.setFont('BookletJP', 8.5)
 c.drawRightString(right_x2 + colw, h - 101, '1〜4から1つ選び、だ円を濃くぬりつぶします。')

 split = 15 if total <= 30 else 20
 rowh = 20.5 if split == 15 else 16.4
 header = 22

 for start, end, x in [(1, split, right_x1), (split + 1, total, right_x2)]:
  count_rows = end - start + 1
  box_h = header + count_rows * rowh
  # Header fill
  c.setFillColor(colors.HexColor('#eaeaea'))
  c.rect(x, mark_top - header, colw, header, stroke=0, fill=1)
  c.setFillColor(colors.black)
  txt('番号', x + 12, mark_top - 15, 8.5)
  for a in range(4):
   txt(str(a + 1), x + 68 + a * 26, mark_top - 15, 9.5, 'Times-Bold')

  for n in range(start, end + 1):
   row_idx = n - start
   row_bottom = mark_top - header - (row_idx + 1) * rowh
   cy = row_bottom + rowh / 2
   if row_idx % 2 == 1:
    c.setFillColor(colors.HexColor('#f6f6f6'))
    c.rect(x, row_bottom, colw, rowh, stroke=0, fill=1)
    c.setFillColor(colors.black)
   txt(f'({n})', x + 12, cy - 3.5, 9.5, 'Times-Bold')
   for a in range(4):
    cx = x + 71 + a * 26
    c.setLineWidth(0.45)
    c.ellipse(cx - 5.2, cy - 6.0, cx + 5.2, cy + 6.0, stroke=1, fill=0)
    txt(str(a + 1), cx - 2.2, cy - 2.9, 7.6, 'Times-Roman')
   c.setLineWidth(0.65 if n % 5 == 0 and n != end else 0.25)
   c.line(x, row_bottom, x + colw, row_bottom)

  c.setLineWidth(0.4)
  c.line(x + 48, mark_top - box_h, x + 48, mark_top)
  c.setLineWidth(0.75)
  c.rect(x, mark_top - box_h, colw, box_h, stroke=1, fill=0)

 # Mark example neatly placed below the mark columns
 guide_y = 84
 txt('良いぬり方：', right_x1, guide_y, 8.8)
 c.setFillColor(colors.black)
 c.ellipse(right_x1 + 60, guide_y - 3, right_x1 + 70, guide_y + 9, stroke=1, fill=1)
 txt('（例：答えが3のときは③をぬりつぶし、訂正は完全に消す）', right_x1 + 78, guide_y, 8.4)

 # Footer
 c.setLineWidth(0.4)
 c.line(42, 48, w - 42, 48)
 txt('マナトビ｜独自教材・公式問題ではありません', 42, 31, 8)
 c.setFont('Times-Roman', 7.5)
 c.drawRightString(w - 42, 31, f'{exam["revision"]}  |  Answer Sheet 1/{2 if has_writing else 1}')
 c.showPage()
 c.save()

def _build_writing_sheet_page(path, exam):
 """Page 2 (Side B, Grades 3 through Pre-1): Landscape A4 side-by-side 2-column ruled writing answer sheet,
 faithfully mirroring the current Eiken B-side structure (Left: Email/Summary, Right: Essay, 5-line markers).
 """
 c = canvas.Canvas(str(path), pagesize=landscape(A4), pageCompression=1, invariant=1)
 w, h = landscape(A4)
 full_label, badge_label, _ = GRADE_LABELS[exam['grade']]
 writing_items = [q for q in exam['items'] if q['kind'] == 'writing']
 choice_sections = len({q['section'] for q in exam['items'] if q['kind'] == 'choice'})

 def txt(text, x, y, size=10, font='BookletJP'):
  c.setFont(font, size)
  c.drawString(x, y, text)

 # Top-left badge + Side B title
 c.setFillColor(colors.black)
 c.rect(42, h - 68, 62, 32, stroke=0, fill=1)
 c.setFillColor(colors.white)
 c.setFont('BookletJP', 13.5 if len(badge_label) >= 4 else 15.5)
 c.drawCentredString(73, h - 58, badge_label)
 c.setFillColor(colors.black)
 txt(f'{full_label}形式 解答用紙（B面：ライティング）', 112, h - 50, 12.2)
 txt(f'第{exam["round"]}回　氏名：____________________', 112, h - 67, 9.0)

 # Top-right double-bordered instruction box (authentic B-side guidance)
 notice_x = 408
 notice_w = w - 48 - notice_x
 notice_top = h - 30
 notice_h = 46
 c.setLineWidth(0.7)
 c.rect(notice_x, notice_top - notice_h, notice_w, notice_h, stroke=1, fill=0)
 c.setLineWidth(0.3)
 c.rect(notice_x + 2, notice_top - notice_h + 2, notice_w - 4, notice_h - 4, stroke=1, fill=0)
 txt('・太枠に囲まれた解答欄の内側のみが自己点検・添削の対象です。', notice_x + 8, notice_top - 14, 7.5)
 txt('・文字ははっきりと分かりやすく濃く書き、訂正は消しゴムできれいに消してください。', notice_x + 8, notice_top - 26, 7.5)
 txt('・解答が英語以外の言語や課題と無関係な内容になっている場合は採点対象になりません。', notice_x + 8, notice_top - 38, 7.5)

 c.setLineWidth(0.5)
 c.line(42, h - 80, w - 48, h - 80)

 # Line counts matching official B-side proportions per grade
 line_counts = {
  'eiken_3': (10, 10),
  'eiken_pre2': (12, 14),
  'eiken_pre2plus': (12, 14),
  'eiken_2': (15, 16),
  'eiken_pre1': (16, 20),
 }[exam['grade']]

 col_gap = 24
 total_usable_w = w - 98 - col_gap
 col_widths = [total_usable_w * 0.455, total_usable_w * 0.545]
 col_xs = [42, 42 + col_widths[0] + col_gap]

 header_top = h - 92
 header_h = 38
 body_top = header_top - header_h
 body_bottom = 90
 body_h = body_top - body_bottom

 for idx, (w_item, lines, cx, cw) in enumerate(zip(writing_items, line_counts, col_xs, col_widths), 1):
  sec_no = choice_sections + idx
  wmin, wmax = w_item['wordRange']
  box_title = WRITING_BOX_LABELS[w_item['section']]

  # Column top label frame
  c.setFillColor(colors.HexColor('#f4f4f4'))
  c.setLineWidth(0.6)
  c.rect(cx, body_top, cw, header_h, stroke=1, fill=1)
  c.setFillColor(colors.black)

  # Boxed section number + title centered
  num_box_w = 20
  num_box_h = 17
  title_str = f'  {box_title}'
  title_w = pdfmetrics.stringWidth(title_str, 'BookletJP', 11.5)
  group_x = cx + (cw - (num_box_w + title_w)) / 2
  c.setFillColor(colors.white)
  c.setLineWidth(0.75)
  c.rect(group_x, header_top - 20, num_box_w, num_box_h, stroke=1, fill=1)
  c.setFillColor(colors.black)
  c.setFont('Times-Bold', 11.5)
  c.drawCentredString(group_x + num_box_w / 2, header_top - 16, str(sec_no))
  txt(title_str, group_x + num_box_w, header_top - 16, 11.5)

  c.setFont('BookletJP', 8.3)
  c.drawCentredString(cx + cw / 2, body_top + 5, f'語数の目安は {wmin}〜{wmax}語 です。　記入語数：［　　　］words')

  # Thick outer ruled frame (official style)
  c.setLineWidth(1.35)
  c.rect(cx, body_bottom, cw, body_h, stroke=1, fill=0)

  step_h = (body_h - 8) / lines
  for ln in range(1, lines + 1):
   ly = body_top - ln * step_h
   is_fifth = (ln % 5 == 0)
   c.setStrokeColor(colors.HexColor('#666666') if is_fifth else colors.HexColor('#bbbbbb'))
   c.setLineWidth(0.55 if is_fifth else 0.35)
   c.line(cx + 2, ly, cx + cw - 2, ly)
   if is_fifth or ln == lines:
    c.setFillColor(colors.HexColor('#444444'))
    c.setFont('Times-Bold' if is_fifth else 'Times-Roman', 7.5)
    c.drawString(cx + cw + 3.5, ly - 2, str(ln))
    c.setFillColor(colors.black)
  c.setStrokeColor(colors.black)

 # Self-check strip & A-side guide bar at bottom
 check_y = 56
 c.setFillColor(colors.HexColor('#f7f7f7'))
 c.setLineWidth(0.45)
 c.rect(42, check_y, w - 98, 24, stroke=1, fill=1)
 c.setFillColor(colors.black)
 txt('自己点検： □ 課題の条件にすべて答えた　 □ 構成・理由が一貫している　 □ 語彙・つづりを見直した　 □ 文法・語数目安を確認した', 50, check_y + 8, 8.1)
 c.setFont('BookletJP', 7.8)
 c.drawRightString(w - 62, check_y + 8, '※ マーク欄はA面')

 # Footer
 c.setLineWidth(0.4)
 c.line(42, 45, w - 48, 45)
 txt('マナトビ｜独自教材・公式問題ではありません', 42, 30, 8)
 c.setFont('Times-Roman', 7.5)
 c.drawRightString(w - 48, 30, f'{exam["revision"]}  |  Answer Sheet 2/2 (Side B)')
 c.showPage()
 c.save()

def build_answer_sheet(path, exam, blueprint):
 """Build 1-page mark sheet (5/4) or 2-page landscape mark + side-by-side writing sheet (3 through Pre-1)."""
 has_writing = any(q['kind'] == 'writing' for q in exam['items'])
 if not has_writing:
  _build_mark_sheet_page(path, exam, blueprint)
  return {'pages': 1, 'markSheet': 'landscape A4', 'writingSheet': None}
 temp_mark = Path(str(path) + '.mark.pdf')
 temp_write = Path(str(path) + '.write.pdf')
 _build_mark_sheet_page(temp_mark, exam, blueprint)
 _build_writing_sheet_page(temp_write, exam)
 out = pymupdf.open()
 with pymupdf.open(temp_mark) as mdoc, pymupdf.open(temp_write) as wdoc:
  out.insert_pdf(mdoc)
  out.insert_pdf(wdoc)
 out.set_metadata({'title': f'マナトビ {GRADE_LABELS[exam["grade"]][0]} 一次筆記 第{exam["round"]}回 解答用紙', 'author': 'マナトビ'})
 out.save(path, garbage=4, deflate=True)
 out.close()
 temp_mark.unlink()
 temp_write.unlink()
 return {'pages': 2, 'markSheet': 'landscape A4 (page 1 / Side A)', 'writingSheet': 'landscape A4 2-column ruled (page 2 / Side B)'}
