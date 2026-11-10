"""Build the Eiken replacement for the shared Lv.15 print reward (offline tooling only)."""
from pathlib import Path
import re
import textwrap
from reportlab.pdfgen import canvas
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
import pymupdf
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
PUBLIC = ROOT / 'public'
css = (PUBLIC / 'fonts/shared.css').read_text()
face = next(block for block in css.split('@font-face') if "font-family: 'Klee One'" in block)
font = re.search(r'url\(/([^)]*)\)', face).group(1)
pdfmetrics.registerFont(TTFont('GuideJP', str(PUBLIC / font)))
output = PUBLIC / 'prints/print_level_eiken_howto.pdf'
output.parent.mkdir(exist_ok=True)
thumb = PUBLIC / 'prints/thumbs/print_level_eiken_howto.webp'
thumb.parent.mkdir(exist_ok=True)
pages = [
    ('英検リスニングの練習法', [
        ('まず、目標の級で確かめよう', 'このアプリの問題は級ごとの重点練習です。本試験1回分の模試ではありません。正答率だけで合格を判断せず、音声のどこを聞き取れたかを確かめましょう。'),
        ('1. 問いの焦点をつかむ', 'だれ・いつ・どこ・理由・次の行動のうち、何を聞かれているかを意識します。選択肢の単語が聞こえただけで決めず、会話全体の結論や条件の変更を聞きましょう。'),
        ('2. まず答えてから解説へ', '音声を聞いて答えを選び、解説で根拠の表現を確認します。間違えたときは、音が分からなかったのか、意味が分からなかったのか、判断を取り違えたのかを分けます。'),
        ('3. 原稿を見たあと、もう一度聞く', '原稿と和訳で内容を確かめたら、画面から目を離して聞き直します。短いまとまりごとに声に出す練習も有効です。聞こえるようになった表現を一つ残しましょう。'),
    ]),
    ('毎日の練習と復習', [
        ('短時間でも、同じ手順を続ける', '一日に少しずつ、聞く・答える・根拠を確かめる・聞き直す、の順で取り組みます。初めての問題を急いで増やすより、間違いの理由を一つずつ減らしましょう。'),
        ('復習では「なぜその答えか」を説明する', '復習リストから解き直し、選んだ答えの根拠を言葉にします。記憶した番号だけで正解できても、音声を理解できたとは限りません。正解以外の選択肢が違う理由も確認します。'),
        ('本番の条件は、受験する級の公式案内で確認', '級や受験方式により、設問の形式、放送回数、時間、面接の有無が異なります。本番前には受験する級の最新の公式案内・問題例で条件を確かめてください。'),
        ('このアプリの音声について', '現在の英検教材は端末の英語読み上げを使用します。声や発音、再生の対応状況は端末によって異なります。録音音源による本番と同じ再生条件を再現した模試ではありません。'),
    ]),
]
c = canvas.Canvas(str(output), pagesize=(595, 842))
c.setTitle('マナトビ 英検リスニングの練習法')
for number, (title, sections) in enumerate(pages, 1):
    c.setFillColorRGB(.17, .24, .31)
    c.setFont('GuideJP', 23)
    c.drawString(48, 774, title)
    c.setFont('GuideJP', 11)
    c.drawString(48, 744, 'マナトビ 英検版 ／ Lv.15 学習プリント')
    y = 698
    for heading, body in sections:
        c.setFont('GuideJP', 15)
        c.drawString(48, y, heading)
        y -= 28
        c.setFont('GuideJP', 11)
        for line in textwrap.wrap(body, 40):
            c.drawString(48, y, line)
            y -= 21
        y -= 28
    c.setFont('GuideJP', 9)
    c.drawString(48, 38, f'マナトビ独自の学習ガイド。公式教材ではありません。  {number} / 2')
    c.showPage()
c.save()
with pymupdf.open(output) as document:
    pix = document[0].get_pixmap(matrix=pymupdf.Matrix(.7, .7))
    Image.frombytes('RGB', [pix.width, pix.height], pix.samples).save(thumb, 'WEBP', quality=85)
print(f'{output.name}: {output.stat().st_size} bytes; thumbnail: {thumb.stat().st_size} bytes')
