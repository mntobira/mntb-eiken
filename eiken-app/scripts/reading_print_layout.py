"""Grade-specific reading layouts; original content only. No official artwork is copied."""
from html import escape
from pathlib import Path
from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.platypus import Paragraph
from reportlab.pdfbase import pdfmetrics
import pymupdf
from written_print_layout import reorder_question

W,H=A4
X=102;RIGHT=539;BW=RIGHT-X
LABELS={'eiken_4':'4級','eiken_3':'3級','eiken_pre2':'準2級','eiken_pre2plus':'準2級プラス','eiken_2':'2級','eiken_pre1':'準1級'}
SPLITS={'eiken_4':[8,7],'eiken_3':[7,8],'eiken_pre2':[10,5],'eiken_pre2plus':[5,5,5,2],'eiken_2':[5,5,5,2],'eiken_pre1':[8,8,2]}
FONT=ParagraphStyle('reading-en',fontName='Times-Roman',fontSize=11.5,leading=17)
JAPANESE=ParagraphStyle('reading-jp',fontName='BookletJP',fontSize=10,leading=16,wordWrap='CJK')
NOTE=ParagraphStyle('reading-small',fontName='BookletJP',fontSize=9,leading=14,wordWrap='CJK')

def para(text,style=FONT):
 text=escape(text).replace('(     )','(&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;)').replace('\n','<br/>')
 return Paragraph(text,style)

def height(text,width=BW,style=FONT):
 return para(text,style).wrap(width,H)[1]

def draw(c,text,x,top,width=BW,style=FONT):
 block=para(text,style);_,h=block.wrap(width,H)
 if top+h>H-49:raise ValueError(f'Text overflows the print page: {text[:60]}')
 block.drawOn(c,x,H-top-h);return h

def line(c,text,x,top,font='Times-Roman',size=11.5):
 c.setFont(font,size);c.drawString(x,H-top-size*.82,text)

def frame(c,exam,page):
 c.setFillGray(0);c.setStrokeGray(0);c.setLineWidth(.4)
 line(c,'MANATOBI / ORIGINAL READING',58,39,size=8)
 line(c,f'{LABELS[exam["grade"]]} 第{exam["round"]}回 リーディング',330,39,'BookletJP',8)
 c.line(56,34,W-56,34)
 line(c,'独自教材・公式問題ではありません',56,H-26,'BookletJP',7.5)
 line(c,str(page),W/2-3,H-26,size=9)
 line(c,exam['revision'],365,H-26,size=7)

def heading(c,number,label,instruction,top=62):
 c.setFillGray(.93);c.rect(56,H-top-56,36,56,fill=1,stroke=0);c.setFillGray(0)
 line(c,str(number),65,top+13,'Times-Bold',23)
 c.line(56,H-top,539,H-top);c.line(56,H-top-56,539,H-top-56)
 draw(c,label+'\n'+instruction,104,top+8,BW,JAPANESE)
 return top+72

def options_height(choices,columns):
 cw=BW/columns
 return sum(max(height(text,cw-26) for text in choices[i:i+columns])+5 for i in range(0,4,columns))

def options(c,choices,top,columns=1):
 cw=BW/columns;cursor=top
 for start in range(0,4,columns):
  rh=max(height(text,cw-26) for text in choices[start:start+columns])
  for index in range(start,start+columns):
   x=X+(index-start)*cw
   line(c,str(index+1),x+4,cursor,'Times-Bold');draw(c,choices[index],x+24,cursor,cw-26)
  cursor+=rh+5
 return cursor

def question(c,number,item,top,columns=1,show_prompt=True):
 line(c,f'({number})',62,top,'Times-BoldItalic',11.5)
 if show_prompt:top+=draw(c,item['prompt'],X,top)+5
 return options(c,item['choices'],top,columns)+12

def qheight(item,columns=1,show_prompt=True):
 return (height(item['prompt'])+5 if show_prompt else 0)+options_height(item['choices'],columns)+12

def build_reading_questions(path,exam,cover_pdf):
 FONT.fontSize=10.8 if exam['grade']=='eiken_pre1' else 11.5
 FONT.leading=15 if exam['grade']=='eiken_pre1' else 17
 temp=Path(str(path)+'.body.pdf');c=canvas.Canvas(str(temp),pagesize=A4,invariant=1,pageCompression=1)
 page=2;frame(c,exam,page);numbers={q['id']:i+1 for i,q in enumerate(exam['items'])};section_no=0;plans=[]
 def new_page():
  nonlocal page
  c.showPage();page+=1;frame(c,exam,page)
 for section in ['short','conversation','reorder','cloze','reading']:
  items=[q for q in exam['items'] if q['section']==section]
  if not items:continue
  section_no+=1
  if section!='short':new_page()
  title={'short':'短文の語句空所補充','conversation':'会話文の空所補充','reorder':'日本文付き語句整序','cloze':'長文の語句空所補充','reading':'長文の内容一致選択'}[section]
  instruction='1〜4から最も適切な答えを一つ選び、解答用紙にマークしてください。'
  top=heading(c,section_no,title,instruction)
  if section=='short':
   index=0
   for pi,count in enumerate(SPLITS[exam['grade']]):
    if pi:new_page();top=145;line(c,f'{section_no}　{title}（続き）',X,95,'BookletJP',10);c.line(56,H-126,539,H-126)
    available=H-57-top;slot=min(116,available/count)
    for item in items[index:index+count]:
     if qheight(item,4)>slot:raise ValueError(f'Short options cannot fit exam-style four columns: {item["id"]}')
     question(c,numbers[item['id']],item,top,4);top+=slot
    plans.append({'section':section,'page':page,'questions':list(range(index+1,index+count+1))});index+=count
  elif section=='conversation':
   slot=(H-58-top)/len(items)
   for item in items:
    if qheight(item,2)>slot:raise ValueError(f'Conversation slot overflow: {item["id"]}')
    question(c,numbers[item['id']],item,top,2);top+=slot
   plans.append({'section':section,'page':page,'questions':[numbers[q['id']] for q in items]})
  elif section=='reorder':
   top=174
   for item in items:reorder_question(c,numbers[item['id']],item,top);top+=119
   plans.append({'section':section,'page':page,'questions':[numbers[q['id']] for q in items]})
  else:
   groups={}
   for item in items:groups.setdefault(item['passage']['id'],[]).append(item)
   for gi,group in enumerate(groups.values()):
    if gi:new_page();top=70
    passage=group[0]['passage'];pt=passage['text'];title_top=top
    line(c,passage['title'],X,top,'Times-Italic',15);top+=29
    # Cloze: text and all choices stay on one page. Short notices/emails may also share a page.
    combined=section=='cloze' or (passage.get('format') in ['notice','email'] and exam['grade']!='eiken_4')
    columns=2 if section=='cloze' else 1
    body_height=height(pt)
    total=top+body_height+25+sum(qheight(q,columns,section!='cloze') for q in group)
    if section=='cloze' and total>H-50:raise ValueError(f'Cloze text/options exceed one page: {passage["id"]}: {total}')
    combined=combined and total<=H-50
    # Use a ruled block for notices and emails; retain the fixed grade-specific type size.
    if top+body_height>H-66:raise ValueError(f'Passage exceeds safe one-page block: {passage["id"]}')
    if passage.get('format') in ['notice','email']:
     c.setLineWidth(.45);c.rect(X-10,H-top-body_height-12,BW+20,body_height+22)
    draw(c,pt,X,top);top+=body_height+25
    if not combined:
     new_page();top=75;line(c,passage['title']+' — Questions',X,top,'Times-Italic',14);top+=35
    for item in group:
     required=qheight(item,columns,section!='cloze')
     if top+required>H-50:
      new_page();top=80;line(c,passage['title']+' — Questions (continued)',X,55,'Times-Italic',12)
     question(c,numbers[item['id']],item,top,columns,section!='cloze');top+=required
    plans.append({'section':section,'page':page,'passage':passage['id'],'questions':[numbers[q['id']] for q in group]})
 c.showPage();c.save()
 with pymupdf.open(cover_pdf) as cover,pymupdf.open(temp) as body:
  doc=pymupdf.open();doc.insert_pdf(cover);doc.insert_pdf(body)
  doc.set_metadata({'title':f'マナトビ 英検{LABELS[exam["grade"]]} リーディング 第{exam["round"]}回','author':'マナトビ'})
  doc.save(path,garbage=4,deflate=True);doc.close()
 temp.unlink()
 return {'shortQuestionPages':SPLITS[exam['grade']],'choiceColumns':{'short':4,'conversation':2,'cloze':2,'reading':1},'passagePlans':plans,'officialArtworkCopied':False}
