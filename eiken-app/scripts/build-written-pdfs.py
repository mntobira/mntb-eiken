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
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak, KeepTogether, Flowable
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
import pymupdf
from PIL import Image
from written_print_layout import build_questions, build_answer_sheet, CIRCLED

ROOT = Path(__file__).resolve().parents[1]
PUBLIC = ROOT / 'public'
DATA = json.loads((ROOT / 'deliverables/written-booklets.json').read_text())
# Print font: Noto Serif JP, OFL; Times for the English exam-style body.
pdfmetrics.registerFont(TTFont('BookletJP', str(PUBLIC / 'fonts/booklet-noto-serif-jp.ttf')))
WIDTH, HEIGHT = A4
STYLES = {
 'title': ParagraphStyle('title',fontName='BookletJP',fontSize=27,leading=40,spaceAfter=18),
 'heading': ParagraphStyle('heading',fontName='BookletJP',fontSize=17,leading=25,spaceAfter=14),
 'jp': ParagraphStyle('jp',fontName='BookletJP',fontSize=10.5,leading=17,spaceAfter=5,wordWrap='CJK'),
 'note': ParagraphStyle('note',fontName='BookletJP',fontSize=9,leading=14,spaceAfter=6,wordWrap='CJK'),
 'en': ParagraphStyle('en',fontName='Times-Roman',fontSize=12.5,leading=20,spaceAfter=8),
 'option': ParagraphStyle('option',fontName='Times-Roman',fontSize=11.5,leading=18,spaceAfter=0),
}
def p(text, style='jp'):
 return Paragraph(escape(str(text)).replace('(     )','(&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;)').replace('\n','<br/>'),STYLES[style])

def line_table(rows, widths):
 t=Table(rows,colWidths=widths,hAlign='LEFT')
 t.setStyle(TableStyle([('VALIGN',(0,0),(-1,-1),'TOP'),('LEFTPADDING',(0,0),(-1,-1),0),('RIGHTPADDING',(0,0),(-1,-1),12),('TOPPADDING',(0,0),(-1,-1),4),('BOTTOMPADDING',(0,0),(-1,-1),4)]))
 return t

class AnswerRow(Flowable):
 def __init__(self, number):
  Flowable.__init__(self);self.number=number;self.width=480;self.height=21
 def draw(self):
  c=self.canv;c.setFont('Helvetica',11);c.drawString(8,6,f'{self.number:02}')
  for n in range(4):
   x=75+n*58;c.circle(x,10,7,stroke=1,fill=0);c.setFont('Helvetica',9);c.drawCentredString(x,7,str(n+1))
  c.setStrokeColor(colors.HexColor('#bbbbbb'));c.setLineWidth(.3);c.line(0,0,340,0)

def build(path, story, label, part, exam):
 def footer(c,doc):
  c.saveState();c.setFillColor(colors.black);c.setStrokeColor(colors.black);c.setLineWidth(.4)
  c.line(48,HEIGHT-36,WIDTH-48,HEIGHT-36);c.setFont('BookletJP',8)
  c.drawString(48,HEIGHT-28,f'マナトビ｜{label} 第{exam["round"]}回｜{part}')
  c.drawString(48,27,'独自教材・公式問題ではありません｜'+exam['revision'])
  c.drawRightString(WIDTH-48,27,f'{part} {doc.page}');c.restoreState()
 SimpleDocTemplate(str(path),pagesize=A4,leftMargin=48,rightMargin=48,topMargin=54,bottomMargin=48,title=f'マナトビ {label} 第{exam["round"]}回 {part}',author='マナトビ',pageCompression=1).build(story,onFirstPage=footer,onLaterPages=footer)

items=[];previews={};reports=[]
labels={'eiken_5':'英検5級','eiken_4':'英検4級','eiken_3':'英検3級','eiken_pre2':'英検準2級','eiken_pre2plus':'英検準2級プラス','eiken_2':'英検2級','eiken_pre1':'英検準1級'}
section_names={'short':'短文の語句空所補充','conversation':'会話文の空所補充','reorder':'語句整序','reading':'読解','cloze':'長文の語句空所補充','email':'Eメール','summary':'要約','essay':'英作文'}
for directory in ['prints','prints/thumbs','prints/previews']:
 (PUBLIC/directory).mkdir(exist_ok=True,parents=True)
for exam in DATA['booklets']:
 # Only release layouts actually reviewed; do not silently render unseen higher-grade formats.
 if exam['grade']!='eiken_5': raise ValueError('Higher-grade reading/writing print layout needs separate review before release')
 label=labels[exam['grade']];item_id='print_'+exam['id'];base=PUBLIC/'prints'/item_id
 questions=exam['items'];minutes=DATA['blueprints'][exam['grade']]['minutes']
 story=[Spacer(1,44),p('MANATOBI / ORIGINAL PRACTICE','en'),p(f'{label}\n筆記トレーニング','title'),p(f'第{exam["round"]}回　問題冊子','heading'),p(f'目安 {minutes}分 ／ 全{len(questions)}問','heading'),Spacer(1,16)]
 rows=[[p('大問'),p('問題番号'),p('内容')]]
 for n,spec in enumerate(DATA['blueprints'][exam['grade']]['sections'],1):
  numbers=[i+1 for i,q in enumerate(questions) if q['section']==spec['id']]
  rows.append([p(str(n)),p(f'{numbers[0]}〜{numbers[-1]}'),p(section_names[spec['id']])])
 story += [line_table(rows,[50,100,WIDTH-246]),Spacer(1,22),p('使い方','heading'),p('・解答用紙に答えを記入してください。問題冊子には正答を載せていません。\n・問題・解説はA4縦、解答用紙はA4横。白黒・片面・実際のサイズ（100%）で印刷します。\n・解き終わるまでは、別冊の解答・解説を開かないでください。\n・同じ問題をアプリの分野別練習でも解けます。'),Spacer(1,12),p('この冊子は独自作成した5級形式の筆記練習1回分です。リスニング・面接は含みません。公式模試・公式教材ではなく、合否やCSEスコアを算出するものではありません。専門家による外部難度校正は未実施です。','note'),p('氏名：________________________________','jp')]
 cover=ROOT/'deliverables'/f'{item_id}_cover.pdf'
 build(cover,story,label,'問題',exam)
 qpath=Path(str(base)+'_questions.pdf');build_questions(qpath,exam,cover);cover.unlink()
 apath=Path(str(base)+'_answers.pdf');build_answer_sheet(apath,exam)
 story=[p(f'{label} 第{exam["round"]}回　解答・解説','heading'),p('問題を解き終わってから確認してください。各問1点として、25点満点の復習用素点で確認できます。公式得点・合否・CSEスコアへの換算はできません。','note')]
 keyrows=[]
 for start in range(0,len(questions),5):
  keyrows.append([p(f'問{n+1:02}：{questions[n]["answer"]+1}') for n in range(start,min(start+5,len(questions)))])
 story += [line_table(keyrows,[(WIDTH-96)/5]*5),PageBreak()]
 for number,q in enumerate(questions,1):
  if number in [4,7,10,13,16,19,22,24]: story.append(PageBreak())
  block=[p(f'問{number:02}　正答 {q["answer"]+1}','heading')]
  block += [p(q.get('completedSentence') or q['prompt'],'en'),p('【訳】'+q['translation']),p('【解き方】'+q['explanation'])]
  block += [p(f'{n+1}. {text}：{q["distractorReasons"][n]}','note') for n,text in enumerate(q['choices'])]
  block += [Spacer(1,12)]
  story.append(KeepTogether(block))
 epath=Path(str(base)+'_explanations.pdf');build(epath,story,label,'解説',exam)
 pack=Path(str(base)+'.pdf');combined=pymupdf.open();toc=[];parts=[]
 for name,path in [('問題冊子',qpath),('解答用紙',apath),('解答・解説',epath)]:
  with pymupdf.open(path) as doc:
   start=len(combined)+1;toc.append([1,name,start]);combined.insert_pdf(doc)
   parts.append(dict(label=name,file='/prints/'+path.name,pages=len(doc),start=start,end=len(combined)))
 combined.set_toc(toc);combined.set_metadata({'title':f'マナトビ {label} 第{exam["round"]}回 筆記セット','author':'マナトビ','subject':exam['id']+' / '+DATA['sourceHash']})
 combined.save(pack,garbage=4,deflate=True);combined.close()
 with pymupdf.open(pack) as doc:
  text='\n'.join(page.get_text() for page in doc)
  if '\ufffd' in text:raise ValueError('Replacement character in PDF')
  normalize=lambda value: re.sub(r'\s+','',value)
  question_texts=[normalize(page.get_text()) for page in doc[:parts[0]['end']]]
  explanation_texts=[normalize(page.get_text()) for page in doc[parts[2]['start']:]]
  question_pages=[]
  for n,q in enumerate(questions,1):
   qpages=[(index,question_texts[index]) for index,pdfpage in enumerate(doc[:parts[0]['end']]) if any(span['text'].strip()==f'({n})' for block in pdfpage.get_text('dict')['blocks'] for line in block.get('lines',[]) for span in line['spans'])]
   if len(qpages)!=1:raise ValueError(f'Question split or missing: {n}')
   page=qpages[0][1];question_pages.append(qpages[0][0]+1)
   required=[q['translation'],q['orderPrefix'],*q['orderTokens']] if q['section']=='reorder' else [q['prompt']]
   if q['section']=='reorder':
    required += [f'{no+1}'+ '－'.join(CIRCLED[int(v)-1] for v in choice.split('－')) for no,choice in enumerate(q['choices'])]
   else:required += [f'{no+1}{choice}' for no,choice in enumerate(q['choices'])]
   if any(normalize(value) not in page for value in required):raise ValueError(f'Question or choices incomplete: {n}')
   epages=[page for page in explanation_texts if f'問{n:02}正答' in page]
   required=[q['translation'],q['explanation'],q.get('completedSentence') or q['prompt'],*q['distractorReasons'],f'問{n:02} 正答 {q["answer"]+1}']
   if len(epages)!=1 or any(normalize(value) not in epages[0] for value in required):raise ValueError(f'Explanation split or incomplete: {n}')
  if any(re.search(r'問\d+正答',page) or '【訳】' in page or '【解き方】' in page for page in question_texts):raise ValueError('Answer leaked into question booklet')
  for page in doc:
   for block in page.get_text('dict')['blocks']:
    for line in block.get('lines',[]):
     for span in line['spans']:
      x0,y0,x1,y1=span['bbox']
      if x0<35 or x1>page.rect.width-35 or y0<12 or y1>page.rect.height-12:raise ValueError(f'Text outside safe area: {span["text"]}')
   if not page.get_text().strip():raise ValueError('Blank page')
  # Pixel review assets: whole page, grayscale, including a real question page and solutions.
  previewpaths=[]
  for no in [0,1,parts[2]['start']]:
   pix=doc[no].get_pixmap(matrix=pymupdf.Matrix(1,1),colorspace=pymupdf.csGRAY)
   image=Image.frombytes('L',[pix.width,pix.height],pix.samples)
   target=PUBLIC/f'prints/previews/{item_id}_p{no+1}.webp';image.save(target,'WEBP',quality=90)
   previewpaths.append('/prints/previews/'+target.name)
   if no==0:image.resize((298,421)).save(PUBLIC/f'prints/thumbs/{item_id}.webp','WEBP',quality=90)
  items.append(dict(id=item_id,label=f'{label} 筆記 第{exam["round"]}回（25問・問題／解答用紙／解説）',subject=exam['grade'],category='演習プリント',file='/prints/'+pack.name,thumb=f'/prints/thumbs/{item_id}.webp',pages=len(doc),kb=round(pack.stat().st_size/1024),description='筆記1回分。問題・解答用紙・解説を分離して印刷できます。リスニングは含みません。同じ25問をアプリの分野別練習で利用できます。外部難度校正は未実施。',variants=parts))
  previews[item_id]=previewpaths
  reports.append(dict(id=exam['id'],sourceHash=DATA['sourceHash'],pdfSha256=hashlib.sha256(pack.read_bytes()).hexdigest(),pages=len(doc),parts=parts,questionPages=question_pages,layout={'reference':'https://www.eiken.or.jp/eiken/exam/kakomon/2026-2-1ji_5kyu.pdf','answerReference':'https://www.eiken.or.jp/eiken/schedule/pdf/5q-hon.pdf','shortQuestionPages':[7,8],'conversationQuestionPages':[5],'reorderQuestionPages':[5],'choiceColumns':{'short':4,'conversation':2,'reorder':4},'orderingChunkNumbers':'circled','orderingAnswerBoxes':4,'orderingMarkedPositions':[1,3],'answerSheet':'landscape A4; 1–15 / 16–25; vertical ovals','officialArtworkCopied':False},checks={'allPromptsChoicesTranslationsAndExplanations':True,'noSplitQuestions':True,'noAnswerLeak':True,'safeMargins':True,'grayscalePreviews':True},answers=[dict(id=q['id'],number=n+1,answer=q['answer']+1,explanation=q['explanation']) for n,q in enumerate(questions)]))
(ROOT/'src/data/writtenPrints.generated.ts').write_text('// Generated by scripts/build-written-pdfs.py; validated original only.\nimport type { GachaPrintDef } from "./gachaPrints.generated";\nexport const WRITTEN_PRINTS: readonly GachaPrintDef[] = '+json.dumps(items,ensure_ascii=False,indent=2)+';\nexport const WRITTEN_PREVIEWS: Readonly<Record<string, readonly string[]>> = '+json.dumps(previews,ensure_ascii=False,indent=2)+';\n')
(ROOT/'deliverables/written-pdf-validation.json').write_text(json.dumps(reports,ensure_ascii=False,indent=2)+'\n')
print(json.dumps([dict(id=r['id'],pages=r['pages'],parts=r['parts']) for r in reports],ensure_ascii=False,indent=2))
