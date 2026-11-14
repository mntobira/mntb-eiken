"""Build the Revised Grade 5 ChatGPT Image Prompt PDF:
- Audits all 300 Grade 5 Listening image slots across Rounds 1–15 against the 60 uploaded R1–R3 illustrations.
- Reuses 258 compatible illustrations across Rounds 1–15 (every Part 3 scene + generic Part 1 scenes + matching object scenes).
- Extracts ONLY the 42 non-reusable object-specific Part 1 slots (where the English script names a specific object on the counter / low table / art desk / bench that differs from the uploaded illustrations) and outputs their exact ChatGPT (GPT Image) prompts + full reuse mapping ledger.
"""
import json
from pathlib import Path
from html import escape
from reportlab import rl_config
rl_config.invariant = True
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak, KeepTogether, Image as RLImage
)
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
import pymupdf

ROOT = Path(__file__).resolve().parents[1]
PUBLIC = ROOT / 'public'
DELIV = ROOT / 'deliverables'
PDF_DIR = DELIV / 'pdfs'
PDF_DIR.mkdir(parents=True, exist_ok=True)
LOGO_PATH = PUBLIC / 'brand/manatobi-logo-gray.png'

pdfmetrics.registerFont(TTFont('BookletJP', str(PUBLIC / 'fonts/booklet-noto-serif-jp.ttf')))
WIDTH, HEIGHT = A4

STYLE_HEADER = """Create a simple black-and-white line drawing for a Japanese English-test app. Match the attached reference image's line weight, character proportions and shading style exactly.

STYLE
- Monochrome line art only. White fill. Shading with hatching and thin parallel lines. No grey wash, no gradients, no blur, no gloss.
- Uniform line width, like a 2.5px pen. All outlines closed.
- Characters: 5 to 6 heads tall, simplified symbolic faces (dot eyes, small line mouth). Not resembling any real person.
- Plain white background. Draw only the objects the scene needs.
- ABSOLUTELY NO TEXT, NUMBERS, LETTERS OR SYMBOLS anywhere in the image. Signs, price tags, book covers, screens and labels must be BLANK.
- One situation per image. The main action is centred and fills 60% or more of the frame. No borders, no frames, no captions.

NEGATIVE
- no colour, no photo, no 3D render, no anime style, no chibi, no watermark, no signature, no extra limbs, no text of any kind

ASPECT RATIO: 4:3
"""

NON_REUSABLE = {
    # Slot 4 (No.4): Store counter pointing at specific item
    (2, 4): ('store', 'Two junior high school students at a small stationery shop counter pointing at a rectangular eraser on a small tray on the counter, blank shelves behind them.', '文房具店のカウンターの上の消しゴムを指さして値段を尋ねている場面', '台本が green eraser（消しゴム）を指さすため（既存図はノート冊子）'),
    (3, 4): ('store', 'Two junior high school students at a small stationery shop counter pointing at a wooden straight ruler on the counter, blank shelves behind them.', '文房具店のカウンターの上の木製ものさしを指さして値段を尋ねている場面', '台本が wooden ruler（木のものさし）を指さすため'),
    (4, 4): ('store', 'Two junior high school students at a small shop counter pointing at a zippered canvas pencil case on the counter, blank shelves behind them.', '店のカウンターの上のファスナー付きペンケース（筆箱）を指さして値段を尋ねている場面', '台本が canvas pencil case（ペンケース）を指さすため'),
    (5, 4): ('store', 'Two junior high school students at a small shop counter pointing at a blank grid wall calendar (purely empty grid squares, NO numbers or letters) on the counter.', '店のカウンターの上の無地カレンダーを指さして値段を尋ねている場面', '台本が wall calendar（カレンダー）を指さすため'),
    (6, 4): ('store', 'Two junior high school students at a small bookshop counter pointing at a single blank picture postcard showing a tiny mountain-and-cloud line sketch (NO text) on the counter.', '書店のカウンターの上の絵はがきを指さして値段を尋ねている場面', '台本が picture postcard（絵はがき）を指さすため'),
    (7, 4): ('store', 'Two junior high school students at a small gift shop counter pointing at a cute small animal-shaped charm keychain resting on the counter.', 'ギフト店のカウンターの上のキーホルダーを指さして値段を尋ねている場面', '台本が cute key chain（キーホルダー）を指さすため'),
    (9, 4): ('store', 'Two junior high school students at a small shop counter pointing at an open flat box containing a neat row of six pens on the counter (NO labels).', '店のカウンターの上のカラーペンセットの箱を指さして値段を尋ねている場面', '台本が set of colored pens（色ペンセット）を指さすため'),
    (12, 4): ('store', 'Two junior high school students at a craft store counter pointing at a small nozzle-tip bottle of craft glue standing on the counter (completely blank bottle, NO label or text).', '工作店のカウンターの上の液体のりボトルを指さして値段を尋ねている場面', '台本が bottle of glue（のりのボトル）を指さすため'),
    (13, 4): ('store', 'Two junior high school students at a bookstore counter pointing at a flat sticker sheet with simple cat, dog, and rabbit outlines on the counter (NO text).', '書店のカウンターの上の動物シールシートを指さして値段を尋ねている場面', '台本が animal sticker sheet（動物シール）を指さすため'),
    (15, 4): ('store', 'Two junior high school students at a stationery counter pointing at a thin L-shaped clear plastic file folder resting on the counter (NO text).', '店のカウンターの上のクリアファイルを指さして値段を尋ねている場面', '台本が plastic file folder（クリアファイル）を指さすため'),

    # Slot 5 (No.5): Living room low table ("There is a <item> here. Whose <item> is this?")
    (1, 5): ('living', 'A boy and a girl standing behind a low table in front of a living-room sofa, looking down at a visor baseball cap resting in the center of the low table.', 'リビングのローテーブルの上の帽子（キャップ）を見ている場面', '台本が brown cap（キャップ帽）のため（既存図は財布／スマホ／本）'),
    (2, 5): ('living', 'A boy and a girl standing behind a low table in front of a living-room sofa, looking down at a wristwatch with a blank round dial (NO numbers) resting on the low table.', 'リビングのローテーブルの上の腕時計を見ている場面', '台本が silver watch（腕時計）のため'),
    (4, 5): ('living', 'A boy and a girl standing behind a low table in front of a living-room sofa, looking down at a folded knitted scarf with fringe resting on the low table.', 'リビングのローテーブルの上のニットマフラーを見ている場面', '台本が woolen scarf（マフラー）のため'),
    (5, 5): ('living', 'A boy and a girl standing behind a low table in front of a living-room sofa, looking down at a sports tennis bag with a racket handle sticking out resting on the low table.', 'リビングのローテーブルの上のテニスバッグを見ている場面', '台本が tennis bag（テニスバッグ）のため'),
    (6, 5): ('living', 'A boy and a girl standing behind a low table in front of a living-room sofa, looking down at a neatly folded compact umbrella with a wrist strap resting on the low table.', 'リビングのローテーブルの上の折りたたみ傘を見ている場面', '台本が folding umbrella（折りたたみ傘）のため'),
    (7, 5): ('living', 'A boy and a girl standing behind a low table in front of a living-room sofa, looking down at a compact padded camera case with a shoulder strap resting on the low table.', 'リビングのローテーブルの上のカメラケースを見ている場面', '台本が camera case（カメラケース）のため'),
    (8, 5): ('living', 'A boy and a girl standing behind a low table in front of a living-room sofa, looking down at a wide-brimmed woven straw hat with a ribbon resting on the low table.', 'リビングのローテーブルの上の麦わら帽子を見ている場面', '台本が straw hat（麦わら帽子）のため'),
    (9, 5): ('living', 'A boy and a girl standing behind a low table in front of a living-room sofa, looking down at a contoured hard violin case with a handle resting on the low table.', 'リビングのローテーブルの上のバイオリンケースを見ている場面', '台本が violin case（バイオリンケース）のため'),
    (10, 5): ('living', 'A boy and a girl standing behind a low table in front of a living-room sofa, looking down at a neatly folded long-sleeve knit sweater resting on the low table.', 'リビングのローテーブルの上のたたんだセーターを見ている場面', '台本が warm sweater（セーター）のため'),
    (11, 5): ('living', 'A boy and a girl standing behind a low table in front of a living-room sofa, looking down at a woven picnic lunch basket with a hinged lid resting on the low table.', 'リビングのローテーブルの上のランチバスケットを見ている場面', '台本が lunch basket（お弁当バスケット）のため'),
    (13, 5): ('living', 'A boy and a girl standing behind a low table in front of a living-room sofa, looking down at a pair of knitted winter mittens placed side by side on the low table.', 'リビングのローテーブルの上のミトン手袋を見ている場面', '台本が pair of mittens（ミトン手袋）のため'),
    (14, 5): ('living', 'A boy and a girl standing behind a low table in front of a living-room sofa, looking down at a cylindrical sports water bottle standing in the center of the low table (NO text).', 'リビングのローテーブルの上の水筒を見ている場面', '台本が water bottle（水筒）のため'),
    (15, 5): ('living', 'A boy and a girl standing behind a low table in front of a living-room sofa, looking down at a pair of eyeglasses resting open on the low table.', 'リビングのローテーブルの上のメガネを見ている場面', '台本が pair of glasses（眼鏡）のため'),

    # Slot 9 (No.9): Art room table ("How many <item> do we need?")
    (3, 9): ('art', 'A boy and a girl at a school art-room worktable counting three pairs of craft scissors placed beside a lump of modeling clay on the table.', '美術室の机の上の工作ばさみを見て数を話している場面', '台本が pairs of scissors（はさみ）の数を尋ねるため'),
    (4, 9): ('art', 'A boy and a girl standing beside a school art-room worktable pointing at round wooden art stools arranged around the table.', '美術室の机の周りの木製スツール（丸椅子）を見て数を話している場面', '台本が wooden stools（木製椅子）の数を尋ねるため'),
    (5, 9): ('art', 'A boy and a girl at a school art-room worktable looking at neatly folded small hand towels stacked on the corner of the table.', '美術室の机の上の手拭きタオルを見て数を話している場面', '台本が clean hand towels（手拭きタオル）の数を尋ねるため'),
    (6, 9): ('art', 'A boy and a girl at a school art-room worktable pointing at blank plastic paint bottles (NO labels or text) and paint palettes on the table.', '美術室の机の上の絵の具ボトルを見て数を話している場面', '台本が bottles of paint（絵の具ボトル）の数を尋ねるため'),
    (7, 9): ('art', 'A boy and a girl at a school art-room worktable pointing at plain white paper cups stacked on the table beside paintbrushes.', '美術室の机の上の水入れ用コップを見て数を話している場面', '台本が paper cups for water（紙コップ）の数を尋ねるため'),
    (8, 9): ('art', 'A boy and a girl at a school art-room worktable pointing at several rectangular block erasers lined up on the table beside drawing paper (NO text on erasers).', '美術室の机の上の消しゴムを見て数を話している場面', '台本が pink erasers（消しゴム）の数を尋ねるため'),
    (10, 9): ('art', 'A boy and a girl at a school art-room worktable pointing at circular rolls of craft masking tape resting on the table.', '美術室の机の上のテープのロールを見て数を話している場面', '台本が rolls of tape（テープ）の数を尋ねるため'),
    (12, 9): ('art', 'A boy and a girl at a school art-room worktable pointing at small cylindrical glue sticks standing upright on the table (completely blank tubes, NO text).', '美術室の机の上のスティックのりを見て数を話している場面', '台本が glue sticks（スティックのり）の数を尋ねるため'),
    (13, 9): ('art', 'A boy and a girl at a school art-room worktable pointing at shallow rectangular craft trays and blank square origami sheets on the table.', '美術室の机の上の工作トレイと折り紙を見て数を話している場面', '台本が plastic trays（トレイ）の数を尋ねるため'),
    (14, 9): ('art', 'A boy and a girl at a school art-room worktable pointing at capped felt-tip markers lined up neatly on the table beside a blank map sheet (NO text).', '美術室の机の上のマーカーペンを見て数を話している場面', '台本が black markers（マーカーペン）の数を尋ねるため'),

    # Slot 10 (No.10): Park bench handing item ("Here is a <item> for you.")
    (3, 10): ('bench', 'A boy and a girl at a wooden park bench under a tree; one student is kindly handing a cup of juice with a drinking straw to the other student.', '公園のベンチでストロー付きコップのジュースを手渡している場面', '台本が cup of orange juice（コップのジュース）を手渡すため'),
    (4, 10): ('bench', 'A boy and a girl at a wooden park bench under a tree; one student is kindly handing a neatly folded warm knit sweater to the other student.', '公園のベンチでたたんだセーターを手渡している場面', '台本が warm sweater（セーター）を手渡すため'),
    (6, 10): ('bench', 'A boy and a girl at a wooden park bench under a tree; one student is kindly offering a small twist-wrapped candy piece (NO text) in their palm to the other student.', '公園のベンチで小さなキャンディを手渡している場面', '台本が lemon candy（キャンディ）を手渡すため'),
    (8, 10): ('bench', 'A boy and a girl at a wooden park bench under a tree; one student is kindly handing a small square piece of chocolate on a plain napkin (NO text) to the other student.', '公園のベンチで小さなチョコレートを手渡している場面', '台本が small chocolate（チョコレート）を手渡すため'),
    (9, 10): ('bench', 'A boy and a girl at a wooden park bench under a tree; one student is kindly handing a warm mug cup of tea (with tiny steam lines, NO text) to the other student.', '公園のベンチで温かいお茶のマグカップを手渡している場面', '台本が hot tea（温かいお茶）を手渡すため'),
    (10, 10): ('bench', 'A boy and a girl at a wooden park bench under a tree; one student is kindly handing a clean pair of work gloves to the other student.', '公園のベンチで手袋（軍手）を手渡している場面', '台本が pair of clean gloves（手袋）を手渡すため'),
    (12, 10): ('bench', 'A boy and a girl at a wooden park bench under a tree; one student is kindly handing a small blank pump bottle of hand soap (NO label or text) to the other student.', '公園のベンチでハンドソープの小ボトルを手渡している場面', '台本が hand soap（ハンドソープ）を手渡すため'),
    (13, 10): ('bench', 'A boy and a girl at a wooden park bench under a tree; one student is kindly handing an open plain white folding hand fan (sensu, NO text) to the other student.', '公園のベンチで扇子を手渡している場面', '台本が folding fan（扇子）を手渡すため'),
    (14, 10): ('bench', 'A boy and a girl at a wooden park bench under a tree; one student is kindly handing a small woven basket filled with bunches of grapes to the other student.', '公園のベンチでブドウが入った小かごを手渡している場面', '台本が basket of grapes（ブドウのかご）を手渡すため'),
}

# Build full 300-slot resolution map for Grade 5 (which uploaded file or generated file each slot uses)
ZIP3 = sorted(Path('/tmp/g5_uploaded/zip3').glob('*.png'))
ZIP4 = sorted(Path('/tmp/g5_uploaded/zip4').glob('*.png'))
ZIP5 = sorted(Path('/tmp/g5_uploaded/zip5').glob('*.png'))

# Map the 10 canonical Part 3 scenes (by sceneSummaryJa substring) to their 3 uploaded variants [vA, vB, vC]
PART3_VARIANTS = {
    '犬と走っており': [str(ZIP3[10]), str(ZIP4[19]), str(ZIP5[18])],
    'リンゴを切っており': [str(ZIP3[11]), str(ZIP4[10]), str(ZIP5[19])],
    '黒板を消しており': [str(ZIP3[12]), str(ZIP4[11]), str(ZIP5[10])],
    '大きな地図を見ており': [str(ZIP3[13]), str(ZIP4[12]), str(ZIP5[11])],
    'セーターを編んでおり': [str(ZIP3[14]), str(ZIP4[13]), str(ZIP5[12])],
    '切符をかばんから探しており': [str(ZIP3[15]), str(ZIP4[14]), str(ZIP5[13])],
    'トングでパンをトレイにのせており': [str(ZIP3[16]), str(ZIP4[15]), str(ZIP5[14])],
    '靴ひもを結んでおり': [str(ZIP3[17]), str(ZIP4[16]), str(ZIP5[15])],
    'バスケットボールをシュートしており': [str(ZIP3[18]), str(ZIP4[17]), str(ZIP5[16])],
    'フルートを吹いており': [str(ZIP3[19]), str(ZIP4[18]), str(ZIP5[17])],
}

# Generic Part 1 variants [vA, vB, vC] (accounting for zip5_02 & zip5_03 order swap!)
PART1_GENERIC_VARIANTS = {
    1: [str(ZIP3[0]), str(ZIP4[0]), str(ZIP5[0])],   # Locker hallway
    2: [str(ZIP3[1]), str(ZIP4[1]), str(ZIP5[2])],   # Bus stop (zip5[2] is bus stop!)
    3: [str(ZIP3[2]), str(ZIP4[2]), str(ZIP5[1])],   # Schoolyard sports (zip5[1] is schoolyard!)
    6: [str(ZIP5[5]), str(ZIP3[5]), str(ZIP4[5])],   # Kitchen table prep (prefer zip5[5] empty plates first!)
    7: [str(ZIP3[6]), str(ZIP4[6]), str(ZIP5[6])],   # Classroom wall calendar
    8: [str(ZIP3[7]), str(ZIP4[7]), str(ZIP5[7])],   # Entrance with books & bikes
}

BOOKLETS = json.loads((DELIV / 'listening-booklets.json').read_text('utf-8'))
g5_exams = [b for b in BOOKLETS['booklets'] if b['grade'] == 'eiken_5']

plan_items = []
for ex in g5_exams:
    r = ex['round']
    for u in ex['units']:
        if not u.get('image'):
            continue
        qno = u['questions'][0]['questionNumber']
        target_path = u['image']['targetPath']
        sc = u['image']['sceneSummaryJa']

        if u['part'] == 'part3':
            matched = None
            for key, arr in PART3_VARIANTS.items():
                if key in sc:
                    matched = arr[(r - 1) % 3]
                    break
            assert matched is not None, f'Unmatched Part 3 scene: {sc}'
            plan_items.append({
                'round': r, 'part': 'part3', 'questionNumber': qno, 'targetPath': target_path,
                'mode': 'reuse', 'sourceLocal': matched,
                'reason': '第3部共通10場面（既存3年分イラストを回次ローテーションで完全一致流用）',
            })
        else:
            # Part 1 (qno 1..10)
            if (r, qno) in NON_REUSABLE:
                cat, scene_en, scene_ja, why_ja = NON_REUSABLE[(r, qno)]
                full_prompt = STYLE_HEADER + '\nSCENE SPECIFICATION (SUPPORT)\n' + scene_en + '\nDo NOT visually reveal the spoken answer. Keep background minimal and clean.'
                plan_items.append({
                    'round': r, 'part': 'part1', 'questionNumber': qno, 'targetPath': target_path,
                    'mode': 'generate', 'category': cat,
                    'sceneSummaryJa': scene_ja, 'whyNewJa': why_ja, 'chatGptPrompt': full_prompt,
                })
            elif qno in PART1_GENERIC_VARIANTS:
                src = PART1_GENERIC_VARIANTS[qno][(r - 1) % 3]
                plan_items.append({
                    'round': r, 'part': 'part1', 'questionNumber': qno, 'targetPath': target_path,
                    'mode': 'reuse', 'sourceLocal': src,
                    'reason': '汎用状況イラストとして全回矛盾なく流用可能',
                })
            elif qno == 4:
                # R1, R8, R10, R11, R14 (notebook / sketchbook / dictionary / letter paper / memo pad)
                src = [str(ZIP3[3]), str(ZIP4[3]), str(ZIP5[3])][(r - 1) % 3]
                plan_items.append({
                    'round': r, 'part': 'part1', 'questionNumber': qno, 'targetPath': target_path,
                    'mode': 'reuse', 'sourceLocal': src,
                    'reason': '冊子・ノート・紙類を指さす既存カウンター図と完全一致のため流用',
                })
            elif qno == 5:
                # R3(dictionary), R12(sketch notebook) -> zip5[4] shows a book/notebook on the low table!
                plan_items.append({
                    'round': r, 'part': 'part1', 'questionNumber': qno, 'targetPath': target_path,
                    'mode': 'reuse', 'sourceLocal': str(ZIP5[4]),
                    'reason': 'ローテーブル上の本・ノートを見る既存イラスト（3年目No.5）と完全一致のため流用',
                })
            elif qno == 9:
                # R1(white paper -> zip3[8]), R2(boxes of crayons -> zip4[8]), R9(paintbrushes -> zip3[8]), R11(paper -> zip5[8]), R15(colored pencils -> zip5[8])
                src_map = {1: str(ZIP3[8]), 2: str(ZIP4[8]), 9: str(ZIP3[8]), 11: str(ZIP5[8]), 15: str(ZIP5[8])}
                plan_items.append({
                    'round': r, 'part': 'part1', 'questionNumber': qno, 'targetPath': target_path,
                    'mode': 'reuse', 'sourceLocal': src_map[r],
                    'reason': '画用紙・クレヨン箱・筆・色鉛筆を描く既存美術室イラストと完全一致のため流用',
                })
            elif qno == 10:
                # R2 & R7 (bottle -> zip3[9]); R1, R5, R11, R15 (towel / wipe / napkin -> zip4[9] or zip5[9])
                src_map = {
                    1: str(ZIP4[9]), 2: str(ZIP3[9]), 5: str(ZIP5[9]),
                    7: str(ZIP3[9]), 11: str(ZIP4[9]), 15: str(ZIP5[9]),
                }
                plan_items.append({
                    'round': r, 'part': 'part1', 'questionNumber': qno, 'targetPath': target_path,
                    'mode': 'reuse', 'sourceLocal': src_map[r],
                    'reason': 'ボトル／たたんだタオル・シートを手渡す既存ベンチ図と完全一致のため流用',
                })
            else:
                raise AssertionError(f'Unhandled slot R{r} Q{qno}')

assert len(plan_items) == 300
gen_items = [x for x in plan_items if x['mode'] == 'generate']
reuse_items = [x for x in plan_items if x['mode'] == 'reuse']
print(f'Plan verified: {len(reuse_items)} reused + {len(gen_items)} newly needed = {len(plan_items)} total.')

(DELIV / 'eiken_5_image_reuse_and_delta_plan.json').write_text(
    json.dumps({'totalSlots': 300, 'reusedCount': len(reuse_items), 'newPromptCount': len(gen_items), 'items': plan_items}, indent=2, ensure_ascii=False) + '\n',
    'utf-8'
)

# Render Revised Grade 5 ChatGPT Image Prompt PDF (Delta-Only Edition)
STYLES = {
    'kicker': ParagraphStyle('kicker', fontName='BookletJP', fontSize=10, leading=15, textColor=colors.HexColor('#1f5f66'), spaceAfter=6),
    'title': ParagraphStyle('title', fontName='BookletJP', fontSize=22, leading=31, textColor=colors.HexColor('#102a43'), spaceAfter=10),
    'sub': ParagraphStyle('sub', fontName='BookletJP', fontSize=12, leading=18, textColor=colors.HexColor('#334e68'), spaceAfter=12),
    'ban': ParagraphStyle('ban', fontName='BookletJP', fontSize=10, leading=15.5, textColor=colors.HexColor('#7b1e1e'), wordWrap='CJK'),
    'h1': ParagraphStyle('h1', fontName='BookletJP', fontSize=14.5, leading=21, textColor=colors.HexColor('#102a43'), spaceBefore=6, spaceAfter=6),
    'h2': ParagraphStyle('h2', fontName='BookletJP', fontSize=11, leading=16, textColor=colors.HexColor('#1f5f66'), spaceBefore=4, spaceAfter=3, wordWrap='CJK'),
    'jp': ParagraphStyle('jp', fontName='BookletJP', fontSize=9.3, leading=14.5, spaceAfter=3, wordWrap='CJK'),
    'meta': ParagraphStyle('meta', fontName='BookletJP', fontSize=8.1, leading=12.2, textColor=colors.HexColor('#486581'), spaceAfter=2, wordWrap='CJK'),
    'mono': ParagraphStyle('mono', fontName='Courier', fontSize=8.1, leading=11.4, spaceAfter=3),
}

def p(txt: str, st: str = 'jp') -> Paragraph:
    return Paragraph(escape(str(txt)).replace('\n', '<br/>'), STYLES[st])

logo = RLImage(str(LOGO_PATH), width=132, height=42)
logo.hAlign = 'RIGHT'

ban_tbl = Table([[p(
    '【重要規定｜過去問の流用禁止 ＆ 既存3年分イラスト流用による差分改訂版】\n'
    '・本資料は「英検5級 ChatGPT画像生成プロンプト集」の【改訂・差分専用版】です（ElevenLabs音声プロンプト集とは別ファイル）。\n'
    '・全15回（300図版枠）のうち、ご提供いただいた3年分（60枚）の既存白黒線画で矛盾なく対応できる 258枠（86.0%）は既存図を流用し、英文中の具体的な持ち物・商品が異なり流用できない 42枠（14.0%）のみを厳選収録しています。\n'
    '・収録問題・プロンプトはすべて「まなとび英検」完全独自作成（origin: manatobi-original・過去問の流用禁止）です。',
    'ban'
)]], colWidths=[WIDTH - 84])
ban_tbl.setStyle(TableStyle([
    ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor('#fff5f5')),
    ('BOX', (0, 0), (-1, -1), 1.0, colors.HexColor('#c53030')),
    ('PADDING', (0, 0), (-1, -1), 9),
]))

summary_rows = [
    [p('区分', 'h2'), p('対象パート・設問', 'h2'), p('枠数', 'h2'), p('扱い（流用／新規作成）', 'h2')],
    [p('第3部 全10場面'), p('第1回〜第15回 No.16〜No.25'), p('150枠'), p('既存3年分イラスト（30枚）を完全一致でローテーション流用（追加作成 0枚）')],
    [p('第1部 汎用6場面'), p('各回 No.1, 2, 3, 6, 7, 8'), p('90枠'), p('廊下・バス停・校庭・台所・カレンダー・施設入口の既存図を流用（追加作成 0枚）')],
    [p('第1部 物一致枠'), p('No.4, 5, 9, 10 のうち既存図と物が一致する回'), p('18枠'), p('ノート／本／画用紙・クレヨン／ボトル・タオル手渡し図を流用（追加作成 0枚）')],
    [p('第1部 個別物差分'), p('No.4(10枠), No.5(13枠), No.9(10枠), No.10(9枠)'), p('42枠'), p('【本冊収録】台本固有のアイテム（消しゴム・傘・麦わら帽子等）を個別描画')],
]
sum_tbl = Table(summary_rows, colWidths=[88, 128, 48, WIDTH - 84 - 264], hAlign='LEFT')
sum_tbl.setStyle(TableStyle([
    ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#cbd5e1')),
    ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#f1f5f9')),
    ('BACKGROUND', (0, 4), (-1, 4), colors.HexColor('#fffaf0')),
    ('PADDING', (0, 0), (-1, -1), 5),
]))

story = [
    logo,
    Spacer(1, 10),
    p('MANATOBI EIKEN — GRADE 5 REVISED CHATGPT IMAGE PROMPTS (42 NON-REUSABLE SLOTS ONLY)', 'kicker'),
    p('英検5級 ChatGPT 画像生成プロンプト集【改訂版・追加必須42枚のみ】', 'title'),
    p('全300枠中 258枠は作成済み3年分イラストを流用 ｜ 残り42枠（個別アイテム差分）のプロンプトのみ収録', 'sub'),
    ban_tbl,
    Spacer(1, 12),
    p('流用判定サマリー（全15回＝300枠）', 'h1'),
    sum_tbl,
    Spacer(1, 10),
    p('※本改訂版の42枚についても、当環境にてスタイル統一の白黒線画（文字ゼロ検証済み）を生成しアプリ＆問題PDFへ組み込みます。手元で差し替えたい場合の台帳としてもそのままお使いいただけます。', 'meta'),
    PageBreak(),
]

for idx, it in enumerate(gen_items, 1):
    box = Table([[p(it['chatGptPrompt'], 'mono')]], colWidths=[WIDTH - 84])
    box.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor('#fffaf0')),
        ('BOX', (0, 0), (-1, -1), 0.6, colors.HexColor('#dd6b20')),
        ('PADDING', (0, 0), (-1, -1), 6),
    ]))
    story.append(KeepTogether([
        p(f'[{idx:02d}/42] 第{it["round"]}回 第1部 No.{it["questionNumber"]} ｜ {it["targetPath"]}', 'h2'),
        p(f'新規作成理由：{it["whyNewJa"]}\n場面要旨：{it["sceneSummaryJa"]}', 'meta'),
        box,
        Spacer(1, 5),
    ]))

story.append(PageBreak())
story.append(p('【付録】既存イラスト流用マッピング一覧（258枠）', 'h1'))
for it in reuse_items:
    story.append(p(f'第{it["round"]:02d}回 {it["part"].upper()} No.{it["questionNumber"]:02d} ({it["targetPath"]}) ← 流用：{Path(it["sourceLocal"]).name}（{it["reason"]}）', 'meta'))

out_pdf = PDF_DIR / 'chatgpt_image_prompts_eiken_5_revised_delta42.pdf'

def on_page(canvas, doc):
    canvas.saveState()
    canvas.setStrokeColor(colors.HexColor('#cbd5e1'))
    canvas.setLineWidth(0.4)
    canvas.line(42, HEIGHT - 32, WIDTH - 42, HEIGHT - 32)
    canvas.setFont('BookletJP', 7.5)
    canvas.setFillColor(colors.HexColor('#486581'))
    canvas.drawString(42, HEIGHT - 24, 'まなとび英検｜英検5級 ChatGPT画像プロンプト集【改訂・差分42枚版】')
    canvas.drawString(42, 22, 'まなとび英検｜完全独自作成（過去問の流用禁止）｜origin: manatobi-original')
    canvas.drawRightString(WIDTH - 42, 22, f'Page {doc.page}')
    canvas.restoreState()

SimpleDocTemplate(str(out_pdf), pagesize=A4, leftMargin=42, rightMargin=42, topMargin=42, bottomMargin=38, pageCompression=1).build(
    story, onFirstPage=on_page, onLaterPages=on_page
)

with pymupdf.open(out_pdf) as doc:
    txt = '\n'.join(pg.get_text() for pg in doc)
    assert '\ufffd' not in txt and '過去問の流用禁止' in doc[0].get_text()
    print(f'Built {out_pdf.name}: {len(doc)} pages, {out_pdf.stat().st_size} bytes')
