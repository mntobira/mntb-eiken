"""Build genuine grade-specific print rewards from the app's curated wordbook.
Run from eiken-app. Offline authoring only; never runs in the deployed browser.
"""
from pathlib import Path
import json
import re
from html import escape
from reportlab.lib import colors
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.enums import TA_CENTER
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
import pymupdf
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
PUBLIC = ROOT / 'public'
css = (PUBLIC / 'fonts/shared.css').read_text()
face = next(block for block in css.split('@font-face') if "font-family: 'Klee One'" in block)
font = re.search(r'url\(/([^)]*)\)', face).group(1)
pdfmetrics.registerFont(TTFont('RewardJP', str(PUBLIC / font)))
styles = {
 'title': ParagraphStyle('title', fontName='RewardJP', fontSize=20, leading=28, textColor=colors.HexColor('#235c63'), spaceAfter=12),
 'heading': ParagraphStyle('heading', fontName='RewardJP', fontSize=12, leading=17, spaceAfter=4),
 'body': ParagraphStyle('body', fontName='RewardJP', fontSize=10, leading=14, wordWrap='CJK'),
 'note': ParagraphStyle('note', fontName='RewardJP', fontSize=9, leading=13, wordWrap='CJK', textColor=colors.HexColor('#52616b')),
}
def para(text, style='body'):
 return Paragraph(escape(text), styles[style])
def footer(canvas, doc):
 canvas.saveState(); canvas.setFont('RewardJP', 8); canvas.setFillColor(colors.HexColor('#52616b'))
 canvas.drawString(42, 24, 'マナトビ 英検版｜独自教材・公式教材ではありません')
 canvas.drawRightString(553, 24, str(doc.page)); canvas.restoreState()

words = json.loads((PUBLIC / 'data/listeningVocabulary.json').read_text())['words']
labels = {'eiken_5':'英検5級','eiken_4':'英検4級','eiken_3':'英検3級','eiken_pre2':'英検準2級','eiken_pre2plus':'英検準2級プラス','eiken_2':'英検2級','eiken_pre1':'英検準1級'}
for directory in ['prints', 'prints/thumbs', 'prints/previews']:
 (PUBLIC / directory).mkdir(parents=True, exist_ok=True)
items, previews = [], {}
for grade, label in labels.items():
 selected = [word for word in words if word['level'] == grade][:30] # 基礎30語ノート。追加語はアプリで学ぶ。
 item_id = f'print_eiken_wordbook_{grade.removeprefix("eiken_")}'
 output = PUBLIC / f'prints/{item_id}.pdf'
 story = []
 for page in range(3):
  story += [para(f'{label} 重点語・例文ノート', 'title'), para(f'覚える {page * 10 + 1}〜{page * 10 + 10}語｜全30語', 'heading'), para('アプリの単語帳と同じ独自編成。英文を読み、意味を隠して思い出そう。全出題範囲を網羅する単語集ではありません。', 'note'), Spacer(1, 14)]
  for index, word in enumerate(selected[page * 10:page * 10 + 10], page * 10 + 1):
   story += [para(f'{index:02}. {word["word"]}  —  {word["meaning"]}', 'heading'), para(word['exampleSentence']), para(word['exampleTranslation'], 'note'), Spacer(1, 8)]
  story.append(PageBreak())
 story += [para(f'{label} 思い出すテスト', 'title'), para('単語帳を閉じ、日本語の意味を書こう。分からなかった語はアプリの4択と例文で復習。', 'note'), Spacer(1, 15)]
 for index, word in enumerate(selected, 1):
  story += [para(f'{index:02}. {word["word"]}   __________________________________'), Spacer(1, 5)]
 story += [PageBreak(), para(f'{label} テストの解答', 'title'), para('一つの日本語訳だけに限定せず、文脈に合う意味を理解できたかを確かめよう。', 'note'), Spacer(1, 12)]
 table = Table([[para(str(index)), para(word['word']), para(word['meaning'])] for index, word in enumerate(selected, 1)], colWidths=[28, 185, 285], hAlign='LEFT')
 table.setStyle(TableStyle([('VALIGN',(0,0),(-1,-1),'TOP'),('BOTTOMPADDING',(0,0),(-1,-1),4),('TOPPADDING',(0,0),(-1,-1),3),('LINEBELOW',(0,0),(-1,-1),.3,colors.HexColor('#dce7e8'))]))
 story.append(table)
 SimpleDocTemplate(str(output), pagesize=(595,842), leftMargin=42, rightMargin=42, topMargin=38, bottomMargin=45, title=f'マナトビ {label} 重点語・例文ノート', author='マナトビ').build(story, onFirstPage=footer, onLaterPages=footer)
 with pymupdf.open(output) as doc:
  if len(doc) != 5: raise ValueError(f'Unexpected pagination: {item_id}: {len(doc)}')
  for page in doc:
   if len(page.get_text().strip()) < 50: raise ValueError(f'Blank page in {item_id}')
  pix = doc[0].get_pixmap(matrix=pymupdf.Matrix(.7,.7))
  image = Image.frombytes('RGB', [pix.width,pix.height],pix.samples)
  thumb = PUBLIC / f'prints/thumbs/{item_id}.webp'; image.save(thumb, 'WEBP', quality=85)
  preview = PUBLIC / f'prints/previews/{item_id}_p1.webp'
  image.crop((0,0,image.width,int(image.height*.55))).save(preview,'WEBP',quality=85)
  previews[item_id] = [f'/prints/previews/{item_id}_p1.webp']
  items.append(dict(id=item_id,label=f'{label} 重点語・例文ノート（30語・確認テスト）',subject=grade,category='単語テスト',file=f'/prints/{item_id}.pdf',thumb=f'/prints/thumbs/{item_id}.webp',pages=len(doc),kb=round(output.stat().st_size/1024)))
path = ROOT / 'src/data/gachaPrints.generated.ts'
source = path.read_text(); source = source[:source.index('export const GACHA_PRINTS:')]
path.write_text(source + 'export const GACHA_PRINTS: readonly GachaPrintDef[] = ' + ('[...WRITTEN_PRINTS,' + json.dumps(items, ensure_ascii=False, indent=2)[1:]) + ';\n')
(ROOT / 'src/data/gachaPreviews.generated.ts').write_text('// Generated by scripts/build-eiken-rewards.py. Eiken-only previews.\nimport { WRITTEN_PREVIEWS } from "./writtenPrints.generated";\nexport const GACHA_PREVIEWS: Readonly<Record<string, readonly string[]>> = ' + ('{...WRITTEN_PREVIEWS,' + json.dumps(previews,ensure_ascii=False,indent=2)[1:]) + ';\n')
print('Generated and checked 7 grade-specific rewards / 35 pages, thumbnails and previews.')
