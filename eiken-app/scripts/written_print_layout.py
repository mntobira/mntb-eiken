"""Print-only layout, checked against Eiken grade-5 2026-2 paper and sample answer sheet.
Only functional format is referenced. No official text, logos, images or cover art are used.
"""
from html import escape
from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import A4, landscape
from reportlab.lib.styles import ParagraphStyle
from reportlab.platypus import Paragraph
from reportlab.lib import colors
from reportlab.pdfbase import pdfmetrics
import re

W,H=A4
LEFT=102
RIGHT=539
CIRCLED='①②③④'
EN=ParagraphStyle('exam-en',fontName='Times-Roman',fontSize=12.5,leading=20)
JP=ParagraphStyle('exam-jp',fontName='BookletJP',fontSize=10.5,leading=17,wordWrap='CJK')
SMALL=ParagraphStyle('exam-note',fontName='BookletJP',fontSize=8.5,leading=13,wordWrap='CJK')

def paragraph(c,text,x,top,width,style=EN,max_height=None):
 markup=escape(text).replace('(     )','(&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;)').replace('\n','<br/>')
 markup=re.sub(r'(^|<br/>)([AB]):',r'\1<b><i>\2:</i></b>',markup)
 p=Paragraph(markup,style);pw,ph=p.wrap(width,H)
 if max_height is not None and ph>max_height:raise ValueError(f'Print slot overflow ({ph}>{max_height}): {text}')
 p.drawOn(c,x,H-top-ph)
 return ph

def string(c,text,x,top,font='Times-Roman',size=12.5):
 c.setFont(font,size);c.drawString(x,H-top-size*.82,text)

def page_chrome(c,exam,page,section=None):
 c.setFillColor(colors.black)
 string(c,'MANATOBI  /  GRADE 5  /  ORIGINAL',58,40,'Times-Roman',8)
 string(c,f'英検5級形式・筆記練習 第{exam["round"]}回',340,40,'BookletJP',8)
 c.setLineWidth(.4);c.line(56,34,W-56,34)
 string(c,'マナトビ独自教材｜公式問題ではありません',56,H-26,'BookletJP',7.5)
 string(c,str(page),W/2-3,H-26,'Times-Roman',9)
 string(c,exam['revision'],380,H-26,'Times-Roman',7)

def section_header(c,no,text,top,height):
 c.setLineWidth(.7);c.setStrokeColor(colors.black)
 c.line(56,H-top,539,H-top);c.line(56,H-top-height,539,H-top-height)
 c.setFillColor(colors.HexColor('#eeeeee'));c.rect(56,H-top-height,37,height,fill=1,stroke=0);c.setFillColor(colors.black)
 string(c,str(no),66,top+height/2-13,'Times-Bold',26)
 paragraph(c,text,110,top+13,414,JP,height-20)

def question_number(c,number,top):
 string(c,f'({number})',62,top,'Times-BoldItalic',12)

def choice_row(c,choices,top,columns=4):
 col_width=(RIGHT-LEFT)/columns
 for index,text in enumerate(choices):
  row=index//columns;column=index%columns;x=LEFT+column*col_width
  string(c,str(index+1),x+10,top+row*23,'Times-Bold',12.5)
  paragraph(c,text,x+32,top+row*23,col_width-37,EN,20)

def short_question(c,number,item,top,slot):
 question_number(c,number,top)
 height=paragraph(c,item['prompt'],LEFT,top,RIGHT-LEFT,EN,40)
 choice_row(c,item['choices'],top+height+5)
 if height+25>slot:raise ValueError('Short question slot is too small')

def conversation_question(c,number,item,top):
 question_number(c,number,top)
 height=paragraph(c,item['prompt'],LEFT,top,RIGHT-LEFT,EN,40)
 choice_row(c,item['choices'],top+height+5,columns=2)

def reorder_question(c,number,item,top):
 question_number(c,number,top)
 paragraph(c,item['translation'],LEFT,top,RIGHT-LEFT,JP,34)
 # All four chunks stay on ONE line, before the sentence (same solving sequence as the exam).
 x=LEFT+4;tokens_top=top+26
 for index,token in enumerate(item['orderTokens']):
  string(c,CIRCLED[index],x,tokens_top,'BookletJP',11)
  string(c,token,x+15,tokens_top,'Times-Roman',12)
  x+=15+pdfmetrics.stringWidth(token,'Times-Roman',12)+18
 if x-18>RIGHT:raise ValueError('Ordering tokens do not fit one line')
 # Four actual writing boxes; first and third explicitly named, instead of four underscores.
 baseline_top=top+56
 prefix=item['orderPrefix'];string(c,prefix,LEFT+20,baseline_top,'Times-Roman',12.5)
 start=LEFT+24+pdfmetrics.stringWidth(prefix,'Times-Roman',12.5)
 for index in range(4):
  x=start+index*67
  c.setLineWidth(.7 if index in [0,2] else .4);c.rect(x,H-baseline_top-16,63,18,stroke=1,fill=0)
  if index in [0,2]:string(c,f'{index+1}番目',x+19,baseline_top-11,'BookletJP',7.5)
 string(c,item['completedSentence'][-1],start+4*67+2,baseline_top,'Times-Roman',12.5)
 # Response numbers are Arabic 1..4; pairs use circled chunk numbers, not response numbers.
 for index,pair in enumerate(item['choices']):
  x=LEFT+index*(RIGHT-LEFT)/4
  string(c,str(index+1),x+10,top+84,'Times-Bold',12.5)
  displayed='－'.join(CIRCLED[int(value)-1] for value in pair.split('－'))
  string(c,displayed,x+31,top+84,'BookletJP',11)
 c.setStrokeColor(colors.HexColor('#bbbbbb'));c.setDash(1,2);c.setLineWidth(.3)
 c.line(LEFT,H-top-107,RIGHT,H-top-107);c.setDash();c.setStrokeColor(colors.black)

def build_questions(path,exam,cover_pdf):
 """Cover + 7/8 short questions + 5 conversations + 5 ordering questions = 5 A4 pages."""
 import pymupdf
 temp=str(path)+'.body.pdf';c=canvas.Canvas(temp,pagesize=A4,pageCompression=1,invariant=1)
 page_chrome(c,exam,2)
 c.setLineWidth(.5);c.rect(65,H-128,465,66)
 paragraph(c,'答えのぬり方\n問題冊子ではなく、別の解答用紙に答えをぬってください。各問1つ、1〜4の番号を選びます。訂正するときは、前のマークをきれいに消してください。',80,70,435,SMALL,55)
 section_header(c,1,'(1)〜(15)：空所に入る最も適切な語句を、1〜4から1つ選び、その番号を解答用紙にマークしてください。',148,88)
 for i,item in enumerate(exam['items'][:7]):short_question(c,i+1,item,258+i*74,74)
 c.showPage();page_chrome(c,exam,3)
 string(c,'1　短文の語句空所補充（続き）',102,98,'BookletJP',10)
 c.setLineWidth(.5);c.line(56,H-137,539,H-137)
 for i,item in enumerate(exam['items'][7:15]):short_question(c,i+8,item,154+i*79,79)
 c.showPage();page_chrome(c,exam,4)
 section_header(c,2,'(16)〜(20)：会話の空所に入る最も適切な文や語句を、1〜4から1つ選び、その番号を解答用紙にマークしてください。',62,86)
 for i,item in enumerate(exam['items'][15:20]):conversation_question(c,i+16,item,179+i*120)
 c.showPage();page_chrome(c,exam,5)
 section_header(c,3,'(21)〜(25)：日本語に合うように①〜④を並べ替え、四つのわくに入れます。1番目と3番目の語句番号の組を、1〜4から1つ選んでマークしてください。',62,96)
 for i,item in enumerate(exam['items'][20:25]):reorder_question(c,i+21,item,184+i*119)
 c.showPage();c.save()
 with pymupdf.open(cover_pdf) as cover,pymupdf.open(temp) as body:
  out=pymupdf.open();out.insert_pdf(cover);out.insert_pdf(body)
  out.set_metadata({'title':f'マナトビ 英検5級形式 筆記 第{exam["round"]}回 問題冊子','author':'マナトビ'})
  out.save(path,garbage=4,deflate=True);out.close()
 from pathlib import Path
 Path(temp).unlink()

def build_answer_sheet(path,exam):
 """Practice mark sheet: 1–15 and 16–25 columns, vertical ovals; no fake registration fields."""
 # Landscape like the actual sheet; intentionally excludes unneeded listening/personal-ID areas.
 c=canvas.Canvas(str(path),pagesize=landscape(A4),pageCompression=1,invariant=1)
 w,h=landscape(A4)
 def txt(text,x,y,size=10,font='BookletJP'):
  c.setFont(font,size);c.drawString(x,y,text)
 label={'eiken_5':'5級','eiken_4':'4級','eiken_3':'3級','eiken_pre2':'準2級','eiken_pre2plus':'準2級プラス','eiken_2':'2級','eiken_pre1':'準1級'}[exam['grade']]
 total=len(exam['items'])
 c.setTitle(f'マナトビ 英検{label} リーディング 第{exam["round"]}回 解答用紙');c.setAuthor('マナトビ')
 txt(f'{label}形式　リーディング',42,h-57,20);txt(f'第{exam["round"]}回　解答用紙',42,h-86,15)
 txt('マナトビ独自教材・公式の解答用紙ではありません',42,h-111,9)
 c.setLineWidth(.7);c.rect(42,83,325,365)
 txt('氏名',58,416,11);c.line(100,410,345,410)
 txt('実施日',58,363,11);c.line(113,357,345,357)
 txt('開始時刻',58,310,11);c.line(126,304,220,304)
 txt('終了時刻',58,267,11);c.line(126,261,220,261)
 txt(f'リーディング 全{total}問',58,219,12)
 txt('リスニング・ライティングは含みません。',58,189,9)
 txt('この用紙はアプリと同じ問題を解く練習用です。',58,170,9)
 txt('A4・横向き・白黒・実際のサイズで印刷。',58,139,9)
 txt(f'正解数：　　　　／{total}　（公式得点ではありません）',58,105,9)
 txt('リーディング解答欄（筆記）',448,h-57,17)
 txt('答えは一つ。選んだ番号のだ円をぬりつぶします。',448,h-83,9)
 c.setStrokeColor(colors.black)
 split=15 if total<=30 else 20
 for start,end,x in [(1,split,448),(split+1,total,630)]:
  top=469;rowh=21 if split==15 else 17;colw=150;header=24
  c.setLineWidth(.6);c.rect(x,top-header-(end-start+1)*rowh,colw,header+(end-start+1)*rowh)
  txt('問題番号',x+4,top-16,8)
  for a in range(4):txt(str(a+1),x+65+a*21,top-16,10,'Times-Roman')
  for n in range(start,end+1):
   cy=top-header-(n-start+.5)*rowh
   txt(f'({n})',x+12,cy-4,10,'Times-Roman')
   for a in range(4):
    cx=x+68+a*21;c.setLineWidth(.45);c.ellipse(cx-4.5,cy-7,cx+4.5,cy+7,stroke=1,fill=0)
    txt(str(a+1),cx-2.1,cy-3.2,8,'Times-Roman')
   c.setLineWidth(.25);c.line(x,cy-rowh/2,x+colw,cy-rowh/2)
   c.line(x+49,cy-rowh/2,x+49,cy+rowh/2)
 txt('正しいぬり方',630,188,9);c.ellipse(638,159,647,173,stroke=1,fill=1)
 txt('例：答えが3のときは、③をぬります。',448,104,9)
 txt('筆記全体の時間を、この部分だけの制限時間とはしません。',448,83,8)
 c.setLineWidth(.4);c.line(42,51,w-42,51)
 txt('マナトビ｜独自教材・公式問題ではありません',42,32,8)
 txt(exam['revision'],w-202,32,7,'Times-Roman')
 c.showPage();c.save()
