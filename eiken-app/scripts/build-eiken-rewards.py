"""Build genuine grade-specific print rewards from the app's curated wordbook, booklets, and writing tasks.
Run from eiken-app. Offline authoring only; never runs in the deployed browser.
"""
from pathlib import Path
import json
import re
from html import escape
from reportlab.lib import colors
from reportlab.lib.styles import ParagraphStyle
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
    'title': ParagraphStyle('title', fontName='RewardJP', fontSize=18, leading=25, textColor=colors.HexColor('#235c63'), spaceAfter=8),
    'sub': ParagraphStyle('sub', fontName='RewardJP', fontSize=10.5, leading=15, textColor=colors.HexColor('#3a525a'), spaceAfter=8),
    'heading': ParagraphStyle('heading', fontName='RewardJP', fontSize=11.5, leading=16, textColor=colors.HexColor('#1e3d42'), spaceAfter=3),
    'body': ParagraphStyle('body', fontName='RewardJP', fontSize=9.8, leading=14, wordWrap='CJK'),
    'note': ParagraphStyle('note', fontName='RewardJP', fontSize=8.8, leading=13, wordWrap='CJK', textColor=colors.HexColor('#52616b')),
    'box': ParagraphStyle('box', fontName='RewardJP', fontSize=9.5, leading=14, wordWrap='CJK', backColor=colors.HexColor('#f4f8f8'), borderPadding=6, spaceAfter=6),
}


def para(text, style='body'):
    return Paragraph(escape(str(text)), styles[style])


def footer(canvas, doc):
    canvas.saveState()
    canvas.setFont('RewardJP', 8)
    canvas.setFillColor(colors.HexColor('#52616b'))
    canvas.drawString(42, 24, 'マナトビ 英検版｜独自教材・公式教材ではありません')
    canvas.drawRightString(553, 24, str(doc.page))
    canvas.restoreState()


def render_reward_pdf(item_id, title_meta, story, expected_pages):
    output = PUBLIC / f'prints/{item_id}.pdf'
    SimpleDocTemplate(
        str(output),
        pagesize=(595, 842),
        leftMargin=42,
        rightMargin=42,
        topMargin=36,
        bottomMargin=42,
        title=f'マナトビ {title_meta}',
        author='マナトビ',
    ).build(story, onFirstPage=footer, onLaterPages=footer)
    with pymupdf.open(output) as doc:
        if expected_pages is not None and len(doc) != expected_pages:
            raise ValueError(f'Unexpected pagination: {item_id}: {len(doc)} (expected {expected_pages})')
        for idx, page in enumerate(doc, 1):
            if len(page.get_text().strip()) < 45:
                raise ValueError(f'Blank or near-blank page {idx} in {item_id}')
        pix = doc[0].get_pixmap(matrix=pymupdf.Matrix(0.7, 0.7))
        image = Image.frombytes('RGB', [pix.width, pix.height], pix.samples)
        thumb = PUBLIC / f'prints/thumbs/{item_id}.webp'
        image.save(thumb, 'WEBP', quality=85)
        preview = PUBLIC / f'prints/previews/{item_id}_p1.webp'
        image.crop((0, 0, image.width, int(image.height * 0.55))).save(preview, 'WEBP', quality=85)
        return len(doc), round(output.stat().st_size / 1024), [f'/prints/previews/{item_id}_p1.webp']


words = json.loads((PUBLIC / 'data/listeningVocabulary.json').read_text())['words']
booklets = json.loads((ROOT / 'deliverables/written-booklets.json').read_text())['booklets']
writing_units = json.loads((ROOT / 'deliverables/eiken-writing-tasks.json').read_text())

labels = {
    'eiken_5': '英検5級',
    'eiken_4': '英検4級',
    'eiken_3': '英検3級',
    'eiken_pre2': '英検準2級',
    'eiken_pre2plus': '英検準2級プラス',
    'eiken_2': '英検2級',
    'eiken_pre1': '英検準1級',
}

strategy_guides = {
    'eiken_5': {
        'overview': '筆記25問（短文15・会話5・語句整序5）。主語と一般動詞／be動詞の一致、疑問詞、場所・時刻の前置詞が軸です。',
        'daimons': [
            ('大問1 短文の語句空所補充（問1〜15）', '文末の時を表す語（every day / now / on Sundays）と動詞の形をセットで確認。前置詞 at / on / in の使い分けを最初に固めよう。'),
            ('大問2 会話文の空所補充（問16〜20）', '直前の疑問文が Yes/No か疑問詞（Where / What time / Who）かを見分け、主語と時制が噛み合う応答を選ぶ。'),
            ('大問3 語句整序（問21〜25）', '日本語から「誰が・どうする」を先に置き、残りの語句をつなぐ。4枠すべてを埋めてから1番目と3番目の番号を確認。'),
        ],
        'pace': '目安配分：大問1に10分 → 大問2に6分 → 大問3に6分 → 見直し3分（計25分）。',
    },
    'eiken_4': {
        'overview': '筆記35問（短文15・会話5・語句整序5・読解10）。過去形・未来表現・比較・不定詞に加え、掲示・メール・物語/説明文の読み取りが入ります。',
        'daimons': [
            ('大問1 短文の語句空所補充（問1〜15）', '過去形・will / be going to・比較級/最上級・動名詞と不定詞の使い分けが頻出。空所の前後2語だけでなく文全体の時制を見る。'),
            ('大問2 会話文の空所補充（問16〜20）', '依頼（Could you...?）・提案（Shall we...? / Let’s...）に対する自然な受け答えを整理しておく。'),
            ('大問3 語句整序（問21〜25）', '不定詞（to＋動詞の原形）や比較（more ... than / the most ...）のまとまりを先に作ると並べ替えミスが減る。'),
            ('大問4 読解（問26〜35：掲示・Eメール・説明文）', '設問の疑問詞と固有名詞・日時を先に確認し、本文の該当段落から根拠の1文を探す。数字や曜日のひっかけに注意。'),
        ],
        'pace': '目安配分：大問1〜3に17分 → 大問4（読解3本）に15分 → 見直し3分（計35分）。',
    },
    'eiken_3': {
        'overview': 'リーディング選択30問（短文15・会話5・読解10）＋ライティング2題（Eメール返信・意見英作文）。現在完了・受動態・関係代名詞が要です。',
        'daimons': [
            ('大問1 短文の語句空所補充（問1〜15）', '熟語（look forward to / take care of 等）と現在完了（have＋過去分詞）・受動態（be＋過去分詞）を素早く判定する。'),
            ('大問2 会話文の空所補充（問16〜20）', '2往復目の流れまで読み、予定変更や理由説明につながる選択肢を選ぶ。'),
            ('大問3 読解（問21〜30：掲示・Eメール・説明文）', '段落ごとに設問が順番に並ぶことが多い。1段落読んだら1問解くリズムで進めると迷わない。'),
        ],
        'pace': 'リーディング目安：大問1・2で13分 → 大問3で17分（ライティング2題の時間をしっかり残す）。',
    },
    'eiken_pre2': {
        'overview': 'リーディング選択29問（短文15・会話5・長文空所2・読解7）＋ライティング2題。接続表現と文脈把握の比重が高まります。',
        'daimons': [
            ('大問1 短文の語句空所補充（問1〜15）', '動詞・形容詞の語彙と2〜3語の群動詞が中心。紛らわしい派生語は品詞と後ろの前置詞で見分ける。'),
            ('大問2 会話文の空所補充（問16〜20）', '職場・学校・店舗での少し丁寧なやり取りが増える。相手の困りごとに対する具体的な提案に注目。'),
            ('大問3 長文の語句空所補充（問21〜22）', '空所の1文前と1文後の因果・逆接（However / For example / As a result）を必ず確認してから選ぶ。'),
            ('大問4 読解（問23〜29：Eメール・説明文）', '本文の表現を別の易しい語に言い換えた（パラフレーズした）選択肢が正解になりやすい。'),
        ],
        'pace': 'リーディング目安：大問1・2で14分 → 大問3で5分 → 大問4で16分。',
    },
    'eiken_pre2plus': {
        'overview': 'リーディング選択31問（短文17・長文空所6・読解8）＋ライティング2題（要約・意見論述）。2級への橋渡しとして抽象語彙と論理展開を問います。',
        'daimons': [
            ('大問1 短文の語句空所補充（問1〜17）', '社会・科学・日常生活のやや抽象的な動詞・名詞が増える。前半の条件節（Although / Unless 等）との呼応を確認。'),
            ('大問2 長文の語句空所補充（問18〜23：2パッセージ計6問）', '各パッセージ3問。段落の主題文（第1文）を押さえ、対比・追加・結論の標識語を手がかりにする。'),
            ('大問3 読解（問24〜31：Eメール・説明文2本）', '原因→対策→残課題の3段構造を意識して読むと、選択肢の部分否定・言い過ぎの誤答を正確に除外できる。'),
        ],
        'pace': 'リーディング目安：大問1で12分 → 大問2で12分 → 大問3で18分。',
    },
    'eiken_2': {
        'overview': 'リーディング選択31問（短文17・長文空所6・読解8）＋ライティング2題（英文要約・意見論述）。医療・環境・技術・地域政策などの評論文が中心です。',
        'daimons': [
            ('大問1 短文の語句空所補充（問1〜17）', '1問40秒以内が目安。コロケーション（動詞＋目的語、形容詞＋前置詞）で即答できる語彙を増やす。'),
            ('大問2 長文の語句空所補充（問18〜23：2パッセージ計6問）', '空所を含む文だけでなく、直後の具体例や言い換え文が最大のヒントになる。'),
            ('大問3 読解（問24〜31：Eメール3問＋説明文5問）', '設問は原則として段落順。本文と同じ単語が並んでいても因果関係が逆転している選択肢を警戒する。'),
        ],
        'pace': 'リーディング目安：大問1で11分 → 大問2で12分 → 大問3で20分（要約・英作文に40分確保）。',
    },
    'eiken_pre1': {
        'overview': 'リーディング選択31問（短文18・長文空所6・読解7）＋ライティング2題（要約・意見論述）。学術・社会批評レベルの語彙と緻密な論旨追跡が求められます。',
        'daimons': [
            ('大問1 短文の語句空所補充（問1〜18）', '難度の高い単熟語18問。接頭辞・接尾辞のニュアンス（プラス評価／マイナス評価）と文全体の対比構造から絞る。'),
            ('大問2 長文の語句空所補充（問19〜24：2パッセージ計6問）', '主張→反論→再反論の展開が多い。筆者の立場と引用された一般論を混同しないこと。'),
            ('大問3 読解（問25〜31：説明・評論文2本計7問）', '細部一致だけでなく「筆者が例を挙げた目的」や「最終段落の含意」を問う設問は、段落全体の役割から判断する。'),
        ],
        'pace': 'リーディング目安：大問1で11分 → 大問2で13分 → 大問3で22分（ライティング2題に44分確保）。',
    },
}

for directory in ['prints', 'prints/thumbs', 'prints/previews']:
    (PUBLIC / directory).mkdir(parents=True, exist_ok=True)

items, previews = [], {}

# 1. 重点語・例文ノート Part 1（1〜30語）& Part 2（31〜60語） — 各級2冊・計14冊（5ページ・SR）
for grade, label in labels.items():
    grade_words = [word for word in words if word['level'] == grade]
    if len(grade_words) < 60:
        raise ValueError(f'Expected 60 words for {grade}, found {len(grade_words)}')
    short_grade = grade.removeprefix('eiken_')

    for part_no, start_idx in [(1, 0), (2, 30)]:
        selected = grade_words[start_idx:start_idx + 30]
        if part_no == 1:
            item_id = f'print_eiken_wordbook_{short_grade}'
            item_label = f'{label} 重点語・例文ノート①（基本1〜30語・確認テスト）'
            desc = f'{label}のアプリ単語帳から前半1〜30語を収録した例文＆書き込み確認テスト付きノート。'
        else:
            item_id = f'print_eiken_wordbook2_{short_grade}'
            item_label = f'{label} 重点語・例文ノート②（実戦31〜60語・確認テスト）'
            desc = f'{label}のアプリ単語帳から後半31〜60語を収録した例文＆書き込み確認テスト付きノート。'

        story = []
        for page in range(3):
            lo = start_idx + page * 10 + 1
            hi = start_idx + page * 10 + 10
            story += [
                para(f'{label} 重点語・例文ノート{"①" if part_no == 1 else "②"}', 'title'),
                para(f'覚える {lo}〜{hi}語｜収録30語（級別60語のうち{"前半" if part_no == 1 else "後半"}）', 'heading'),
                para('アプリの単語帳と同じ独自編成。英文を読み、意味を隠して思い出そう。全出題範囲を網羅する単語集ではありません。', 'note'),
                Spacer(1, 12),
            ]
            for index, word in enumerate(selected[page * 10:page * 10 + 10], lo):
                story += [
                    para(f'{index:02}. {word["word"]}  —  {word["meaning"]}', 'heading'),
                    para(word['exampleSentence']),
                    para(word['exampleTranslation'], 'note'),
                    Spacer(1, 7),
                ]
            story.append(PageBreak())
        story += [
            para(f'{label} 思い出すテスト（{start_idx + 1}〜{start_idx + 30}語）', 'title'),
            para('ノートを閉じ、日本語の意味を書こう。分からなかった語はアプリの4択と例文で復習。', 'note'),
            Spacer(1, 12),
        ]
        for index, word in enumerate(selected, start_idx + 1):
            story += [para(f'{index:02}. {word["word"]}   __________________________________'), Spacer(1, 4.5)]
        story += [
            PageBreak(),
            para(f'{label} テストの解答（{start_idx + 1}〜{start_idx + 30}語）', 'title'),
            para('一つの日本語訳だけに限定せず、文脈に合う意味を理解できたかを確かめよう。', 'note'),
            Spacer(1, 10),
        ]
        table = Table(
            [[para(str(index)), para(word['word']), para(word['meaning'])] for index, word in enumerate(selected, start_idx + 1)],
            colWidths=[32, 185, 281],
            hAlign='LEFT',
        )
        table.setStyle(TableStyle([
            ('VALIGN', (0, 0), (-1, -1), 'TOP'),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 3.5),
            ('TOPPADDING', (0, 0), (-1, -1), 2.5),
            ('LINEBELOW', (0, 0), (-1, -1), 0.3, colors.HexColor('#dce7e8')),
        ]))
        story.append(table)
        pages, kb, prev = render_reward_pdf(item_id, item_label, story, expected_pages=5)
        previews[item_id] = prev
        items.append(dict(
            id=item_id,
            label=item_label,
            subject=grade,
            category='単語テスト',
            file=f'/prints/{item_id}.pdf',
            thumb=f'/prints/thumbs/{item_id}.webp',
            pages=pages,
            kb=kb,
            description=desc,
        ))

# 2. 大問1 短文語彙・文法 スピード演習シート（12問・4ページ・SR） — 全7級・計7冊
for grade, label in labels.items():
    short_grade = grade.removeprefix('eiken_')
    item_id = f'print_eiken_drill_short_{short_grade}'
    item_label = f'{label} 大問1 短文語彙・文法 スピード演習（12問・解説付）'
    grade_booklets = sorted([b for b in booklets if b['grade'] == grade], key=lambda x: x['round'])
    # 第1回〜第12回の大問1から1問ずつ厳選して12問を構成（すべて検算済み原本）
    picked = []
    for idx in range(12):
        exam = grade_booklets[idx]
        shorts = [it for it in exam['items'] if it['section'] == 'short']
        picked.append((exam['round'], shorts[idx % len(shorts)]))

    story = []
    for page_idx in range(2):
        chunk = picked[page_idx * 6:(page_idx + 1) * 6]
        story += [
            para(f'{label} 大問1 スピード演習（問{page_idx * 6 + 1}〜{page_idx * 6 + 6}）', 'title'),
            para('アプリの大問別演習（第1〜12回）から厳選した12問の短期集中シートです。目標タイム：1ページ4分。', 'note'),
            Spacer(1, 8),
        ]
        for q_no, (rnd, it) in enumerate(chunk, page_idx * 6 + 1):
            choices_line = '   '.join(f'{i + 1}. {c}' for i, c in enumerate(it['choices']))
            story += [
                para(f'[{q_no:02}]（第{rnd}回より） {it["prompt"]}', 'heading'),
                para(choices_line, 'body'),
                Spacer(1, 9),
            ]
        story.append(PageBreak())

    for page_idx in range(2):
        chunk = picked[page_idx * 6:(page_idx + 1) * 6]
        story += [
            para(f'{label} 大問1 スピード演習 解答・解説（問{page_idx * 6 + 1}〜{page_idx * 6 + 6}）', 'title'),
            para('間違えた問題は、アプリの大問1（該当回）を開いて周辺問題も一緒に復習しよう。', 'note'),
            Spacer(1, 6),
        ]
        for q_no, (rnd, it) in enumerate(chunk, page_idx * 6 + 1):
            ans_no = it['answer'] + 1
            ans_text = it['choices'][it['answer']]
            story += [
                para(f'[{q_no:02}] 正解：{ans_no}（{ans_text}）｜第{rnd}回', 'heading'),
                para(f'訳：{it.get("translation", "")}', 'note'),
                para(it['explanation'], 'body'),
                Spacer(1, 6),
            ]
        if page_idx == 0:
            story.append(PageBreak())

    pages, kb, prev = render_reward_pdf(item_id, item_label, story, expected_pages=4)
    previews[item_id] = prev
    items.append(dict(
        id=item_id,
        label=item_label,
        subject=grade,
        category='演習プリント',
        file=f'/prints/{item_id}.pdf',
        thumb=f'/prints/thumbs/{item_id}.webp',
        pages=pages,
        kb=kb,
        description=f'{label}の大問1（短文空所）から頻出パターン12問を抜粋した4ページのスピード確認プリント。',
    ))

# 3. 大問別 解法＆時間配分ガイド（4ページ・SR・category: 出題傾向） — 全7級・計7冊
for grade, label in labels.items():
    short_grade = grade.removeprefix('eiken_')
    item_id = f'print_eiken_guide_{short_grade}'
    item_label = f'{label} 大問別 解法＆時間配分ガイド（例題解説つき）'
    info = strategy_guides[grade]
    exam1 = next(b for b in booklets if b['grade'] == grade and b['round'] == 1)
    sample_short = next(it for it in exam1['items'] if it['section'] == 'short')
    sample_second = next(it for it in exam1['items'] if it['section'] != 'short')

    # Page 1: 全体構成と時間配分
    story = [
        para(f'{label} 大問別 解法＆時間配分ガイド', 'title'),
        para('本番の形式に沿って「どの順番・どのペースで解くか」を1冊に整理した攻略シートです。', 'sub'),
        para('1. 出題の全体像', 'heading'),
        para(info['overview'], 'box'),
        para('2. 時間配分の目安', 'heading'),
        para(info['pace'], 'box'),
        para('3. アプリ「大問別演習（第1〜15回）」の効果的な回し方', 'heading'),
        para('① まずは大問1から順番に「第1回」を解き、ミスの原因（語彙不足／文法の見落とし／本文の根拠読み飛ばし）を特定します。', 'body'),
        Spacer(1, 4),
        para('② 苦手な大問だけ「第2回→第3回→第4回…」と縦に連続して解くと、同じ設問形式の目の動かし方が短期間で定着します。', 'body'),
        Spacer(1, 4),
        para('③ 満点3回で「達成」バッジが付きます。直前期は未達成の回と復習ノートに絞って仕上げましょう。', 'body'),
        PageBreak(),
        # Page 2: 各大問の着眼点
        para(f'{label} 各大問の着眼点チェック', 'title'),
        para('設問を解き始める前に、大問ごとの「見るべき場所」を意識しよう。', 'note'),
        Spacer(1, 8),
    ]
    for d_title, d_tip in info['daimons']:
        story += [para(d_title, 'heading'), para(d_tip, 'box'), Spacer(1, 6)]
    story += [
        PageBreak(),
        # Page 3: 実例で学ぶ正答へのプロセス
        para(f'{label} 実例で学ぶ！根拠の見つけ方', 'title'),
        para('第1回の問題を使って、正解を絞り込む手順を確認します。', 'note'),
        Spacer(1, 8),
        para('【例題A：短文空所】', 'heading'),
        para(sample_short['prompt'], 'box'),
        para('選択肢：' + ' ／ '.join(f'{i + 1}. {c}' for i, c in enumerate(sample_short['choices'])), 'body'),
        Spacer(1, 4),
        para(f'正解：{sample_short["answer"] + 1}（{sample_short["choices"][sample_short["answer"]]}）', 'heading'),
        para(sample_short['explanation'], 'body'),
        Spacer(1, 12),
        para('【例題B：応用セクション】', 'heading'),
        para((sample_second.get('passage', {}).get('title', '') + ' ' + sample_second['prompt']).strip(), 'box'),
        para('選択肢：' + ' ／ '.join(f'{i + 1}. {c}' for i, c in enumerate(sample_second['choices'])), 'body'),
        Spacer(1, 4),
        para(f'正解：{sample_second["answer"] + 1}（{sample_second["choices"][sample_second["answer"]]}）', 'heading'),
        para(sample_second['explanation'], 'body'),
        PageBreak(),
        # Page 4: 直前チェックリスト＆学習計画シート
        para(f'{label} 本番直前セルフチェック＆15回達成シート', 'title'),
        para('印刷して机の前に貼り、達成した回にチェックを入れよう。', 'note'),
        Spacer(1, 8),
        para('■ 解き方の最終確認リスト', 'heading'),
        para('□ 空所補充は、空所の前後だけでなく文末の時制・条件表現まで目を通したか', 'body'),
        para('□ 読解問題は、本文に書かれていない推測で選ばず、根拠の1文を指さし確認したか', 'body'),
        para('□ 迷った問題に印をつけ、残り3分でマークずれ・未解答がないか見直したか', 'body'),
        Spacer(1, 12),
        para('■ 第1回〜第15回 大問別クリア記録表', 'heading'),
    ]
    grid_rows = [
        [para('回'), para('第1〜5回'), para('第6〜10回'), para('第11〜15回')],
        [para('大問1'), para('□1 □2 □3 □4 □5'), para('□6 □7 □8 □9 □10'), para('□11 □12 □13 □14 □15')],
        [para('大問2'), para('□1 □2 □3 □4 □5'), para('□6 □7 □8 □9 □10'), para('□11 □12 □13 □14 □15')],
        [para('大問3〜'), para('□1 □2 □3 □4 □5'), para('□6 □7 □8 □9 □10'), para('□11 □12 □13 □14 □15')],
    ]
    t = Table(grid_rows, colWidths=[68, 145, 145, 150], hAlign='LEFT')
    t.setStyle(TableStyle([
        ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#bfd4d6')),
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#eaf3f4')),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('TOPPADDING', (0, 0), (-1, -1), 6),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
    ]))
    story.append(t)

    pages, kb, prev = render_reward_pdf(item_id, item_label, story, expected_pages=4)
    previews[item_id] = prev
    items.append(dict(
        id=item_id,
        label=item_label,
        subject=grade,
        category='出題傾向',
        file=f'/prints/{item_id}.pdf',
        thumb=f'/prints/thumbs/{item_id}.webp',
        pages=pages,
        kb=kb,
        description=f'{label}の大問構成・目標タイム・解法手順と15回達成チェック表をまとめた4ページ攻略ガイド。',
    ))

# 4. ライティング実戦ワークシート（モデル答案＆自己点検つき・4ページ・SR） — 3級〜準1級・計5冊
for unit in writing_units:
    grade = unit['grade']
    tasks = unit['writing']
    if not tasks:
        continue
    label = labels[grade]
    short_grade = grade.removeprefix('eiken_')
    item_id = f'print_eiken_writing_{short_grade}'
    item_label = f'{label} ライティング実戦ワーク（課題2題・参考解答＆点検表）'

    story = []
    for idx, task in enumerate(tasks, 1):
        # 課題ページ（下書き罫線つき）
        story += [
            para(f'{label} ライティング実戦ワーク 課題{idx}：{task["title"]}', 'title'),
            para(task['target'], 'sub'),
            para('【課題】 ' + task['instruction'], 'box'),
        ]
        if task.get('source'):
            story += [para('【元の英文】', 'heading'), para(task['source'], 'box')]
        story += [
            Spacer(1, 6),
            para('■ 下書きスペース（語数を数えながら書いてみよう）', 'heading'),
        ]
        for _ in range(9):
            story += [para('________________________________________________________________________'), Spacer(1, 6)]
        story += [
            Spacer(1, 4),
            para('■ 書いた後の自己点検チェック', 'heading'),
        ]
        for chk in task['checklist']:
            story += [para(f'□ {chk}', 'body')]
        story.append(PageBreak())

        # 参考解答＆解説ページ
        story += [
            para(f'{label} ライティング 課題{idx} 参考解答と解説', 'title'),
            para(f'課題：{task["title"]}', 'sub'),
            para('■ 参考解答（一例）', 'heading'),
            para(task['model'], 'box'),
            Spacer(1, 6),
            para('■ 構成と表現のポイント', 'heading'),
            para(task['commentary'], 'body'),
            Spacer(1, 10),
            para('■ もう一度書き直すときのヒント', 'heading'),
            para('・参考解答をそのまま丸暗記するのではなく、「主張の型（I think ... / First, ... / Second, ...）」や「質問・要約のつなぎ語」を自分の言葉に置き換えて練習しましょう。', 'body'),
            para('・アプリの「英検ライティング」画面では、語数カウントと端末保存・自己点検を使って何度でも推敲できます。', 'note'),
        ]
        if idx < len(tasks):
            story.append(PageBreak())

    pages, kb, prev = render_reward_pdf(item_id, item_label, story, expected_pages=len(tasks) * 2)
    previews[item_id] = prev
    items.append(dict(
        id=item_id,
        label=item_label,
        subject=grade,
        category='演習プリント',
        file=f'/prints/{item_id}.pdf',
        thumb=f'/prints/thumbs/{item_id}.webp',
        pages=pages,
        kb=kb,
        description=f'{label}のライティング2課題を紙に書いて練習できる罫線ワークシート＋参考解答・自己点検表（4ページ）。',
    ))

path = ROOT / 'src/data/gachaPrints.generated.ts'
source = path.read_text()
source = source[:source.index('export const GACHA_PRINTS:')]
path.write_text(
    source
    + 'export const GACHA_PRINTS: readonly GachaPrintDef[] = '
    + ('[...WRITTEN_PRINTS,' + json.dumps(items, ensure_ascii=False, indent=2)[1:])
    + ';\n'
)
(ROOT / 'src/data/gachaPreviews.generated.ts').write_text(
    '// Generated by scripts/build-eiken-rewards.py. Eiken-only previews.\n'
    'import { WRITTEN_PREVIEWS } from "./writtenPrints.generated";\n'
    'export const GACHA_PREVIEWS: Readonly<Record<string, readonly string[]>> = '
    + ('{...WRITTEN_PREVIEWS,' + json.dumps(previews, ensure_ascii=False, indent=2)[1:])
    + ';\n'
)
total_pages = sum(it['pages'] for it in items)
print(f'Generated and checked {len(items)} grade-specific supplemental rewards / {total_pages} pages, thumbnails and previews.')
