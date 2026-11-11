"""Render source-derived, speaker-labelled recording scripts; never generates audio."""
from pathlib import Path
from html import escape
import json, re, unicodedata
from reportlab.lib import colors
from reportlab.lib.styles import ParagraphStyle
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak, KeepTogether
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
import pymupdf

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'deliverables'
data = json.loads((OUT / 'eiken-recording-manifest.json').read_text())
css = (ROOT / 'public/fonts/shared.css').read_text()
face = next(block for block in css.split('@font-face') if "font-family: 'Klee One'" in block)
font = re.search(r'url\(/([^)]*)\)', face).group(1)
pdfmetrics.registerFont(TTFont('JP', str(ROOT / 'public' / font)))
styles = {
 'title': ParagraphStyle('title', fontName='JP', fontSize=21, leading=30, spaceAfter=14, textColor=colors.HexColor('#235c63')),
 'heading': ParagraphStyle('heading', fontName='JP', fontSize=13, leading=19, spaceAfter=7),
 'body': ParagraphStyle('body', fontName='JP', fontSize=11, leading=17, wordWrap='CJK', spaceAfter=7),
 'meta': ParagraphStyle('meta', fontName='JP', fontSize=8, leading=12, wordWrap='CJK', textColor=colors.HexColor('#52616b'), spaceAfter=5),
}
def p(text, style='body'):
 return Paragraph(escape(str(text)).replace('\n','<br/>'), styles[style])
def footer(canvas, doc):
 canvas.saveState(); canvas.setFont('JP',8); canvas.setFillColor(colors.HexColor('#52616b'))
 canvas.drawString(40,24,'マナトビ 英検版｜現行教材の収録台本・音声は未生成')
 canvas.drawRightString(553,24,str(doc.page)); canvas.restoreState()
labels = {grade['id']:grade['label'] for grade in data['grades']}
story = [p('マナトビ 英検版\nElevenLabs収録用 台本','title'), p('現行教材版｜男女・役割・音源ID付き','heading')]
for text in [
 '対象：現在アプリに登録されている独自リスニング14問、単語420語、独自例文420文。完成音源は計854ファイル。',
 'これから作る「各級15回分の一次筆記」や、未作成の新しいリスニング問題・再編後に増える単語の台本ではありません。',
 'ユーザー指定：ElevenLabs V4でユーザー側収録。ここでは有料生成・音声クローン・新規録音を実行していません。モデル名と利用可能な話者・設定は収録時に確認してください。',
 '日本語の見出し・男女ラベル・ID・A/B・ファイル名は発音させません。英語の収録本文だけを渡し、声はツール側で割り当てます。',
 '会話は男1＝A、女1＝B。設問ナレーションは女2。独話・単語・例文は女2。現行問題に4人会話はありません。将来4人会話には男1・女1・男2・女2を明示して追加します。',
 '1つの会話音源は本文と最後のQuestionを含む1回読みで作ります。2回読みはアプリ側で繰り返し、録音へ二重に焼き込みません。選択肢は現状画面表示なので読みません。',
 '英検公式音源ではありません。アクセントは全体で統一し、正答を強調する演技やBGMは入れず、自然で明瞭な声を使用してください。',
]: story.append(p(text))
story += [p('原本照合SHA-256','meta'),p(data['sourceHash'],'meta'),PageBreak(),p('話者・収録・納品ルール','title')]
for speaker in data['speakers']: story += [p(f"{speaker['label']} / {speaker['id']}",'heading'),p(speaker['role'])]
for text in [
 '話者の切替箇所は台本の各行で指定。別々に生成した場合は各セグメントを番号順に結合します。本文の発話間は約0.35秒、本文とQuestionの間は約0.9秒を目安にし、不自然な切れ目がないか耳で確認します。',
 '完成ファイル名は各ページの指定を使用してください。対話を全部同じ声で読ませず、Questionを落とさないでください。単語だけの音源と例文音源は別ファイルです。',
 'MP3推奨。音割れ・冒頭／語尾切れ・台本外発話がないか確認し、音量を揃えます。サンプルレート等は収録側から可能な範囲で統一して納品してください。',
 '同封manifest/TSVは照合・分割用です。予定パスにファイルが存在するという意味ではありません。録音後、実音源の検査・ID索引・問題と例文プレーヤーへの接続が必要です。現在は端末TTSが残っています。',
 'AI／オンライン対戦の聞き取り本文は同じ14問を再利用するため別収録不要。別話者役の人物名が本文に登場するだけなら、実際の発話者数には数えません。',
]: story.append(p(text))
story.append(PageBreak())
for question in data['listening']:
 story += [p(f"{labels[question['grade']]}｜聞き取り",'title'),p(question['title'],'heading'),p(f"音源ID：{question['id']}",'meta'),p(f"完成ファイル：{question['filename']}",'meta')]
 used = [speaker['label'] for speaker in data['speakers'] if any(turn['speaker']==speaker['id'] for turn in question['turns'])]
 story += [p('使用する声：'+'・'.join(used),'heading'),p(question['productionNote'],'meta'),Spacer(1,10)]
 for turn in question['turns']:
  story += [KeepTogether([p(f"{turn['label']}｜{'設問ナレーション' if turn['role']=='question' else '本文'}｜{turn['id']}",'meta'),p(turn['text'])]),Spacer(1,5)]
 story += [p('この問題は完成音源を1本納品。日本語ラベル・A/Bを音声に入れない。','meta'),PageBreak()]
for grade in data['grades']:
 words = [word for word in data['words'] if word['grade']==grade['id']]
 for start in range(0,len(words),10):
  story += [p(f"{grade['label']}｜単語・例文",'title'),p(f"{start+1}〜{min(start+10,len(words))} / {len(words)}語｜すべて女2",'heading'),p('各項目は単語と例文の2ファイル。日本語訳・番号・ファイル名は読みません。','meta')]
  for index, word in enumerate(words[start:start+10],start+1):
   clip, example = word['clips']
   story += [KeepTogether([p(f"{index:02}｜女2｜単語：{clip['filename']}",'meta'),p(clip['text'],'heading'),p(f"女2｜例文：{example['filename']}",'meta'),p(example['text']),p(f"意味確認（読まない）：{word['meaning']}",'meta')]),Spacer(1,5)]
  story.append(PageBreak())
story += [p('BGM・効果音・映像の別台帳','title'),p('以下は文章を読む音源ではないため、英語台本で置き換えません。既存素材とクレジットを維持します。')]
for item in data['nonSpeech']: story += [p(f"{item['category']}：{item['path']}",'heading'),p(item['note'])]
story += [p('今後の追加収録','heading'),p('新しい問題や単語の原稿が完成した段階で、同じ話者・ID方針で差分を出します。今回のPDFだけで105回分の教材が収録できるとは扱いません。')]
output = OUT / 'manatobi_eiken_recording_scripts_current.pdf'
SimpleDocTemplate(str(output),pagesize=(595,842),leftMargin=42,rightMargin=42,topMargin=38,bottomMargin=45,title='マナトビ英検 現行教材収録台本',author='マナトビ').build(story,onFirstPage=footer,onLaterPages=footer)
with pymupdf.open(output) as doc:
 text='\n'.join(page.get_text() for page in doc)
 normalize=lambda value:re.sub(r'\s+','',unicodedata.normalize('NFKC',value))
 normalized=normalize(text)
 segments=[turn for question in data['listening'] for turn in question['turns']]+[clip for word in data['words'] for clip in word['clips']]
 missing=[segment['id'] for segment in segments if normalize(segment['text']) not in normalized]
 if missing: raise ValueError(f'Missing spoken text in PDF: {missing}')
 if any(len(page.get_text().strip())<30 for page in doc): raise ValueError('Unexpected blank page')
 doc[0].get_pixmap(matrix=pymupdf.Matrix(1,1)).save(str(OUT/'recording-cover.png'))
 report={'pages':len(doc),'spokenSegmentsChecked':len(segments),'finalFiles':data['counts']['finalSpeechFiles'],'sourceHash':data['sourceHash'],'missingText':missing,'pdfBytes':output.stat().st_size}
 (OUT/'recording-validation.json').write_text(json.dumps(report,indent=2)+'\n')
 # Keep a short listening-only volume alongside the complete source-derived pack.
 for filename, page_numbers in [
  ('manatobi_eiken_listening_scripts_current.pdf', list(range(2 + len(data['listening']))) + [len(doc)-1]),
  ('manatobi_eiken_word_example_scripts_current.pdf', [0,1] + list(range(2 + len(data['listening']), len(doc)))),
 ]:
  part=pymupdf.open()
  for number in page_numbers: part.insert_pdf(doc,from_page=number,to_page=number)
  part.save(OUT/filename,garbage=4,deflate=True); part.close()
 print(json.dumps(report))
