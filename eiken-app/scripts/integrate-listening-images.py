"""Optimize and integrate Listening illustrations across all 5 image-bearing grades:
1) Grade 5 (268/300) & Grade 4 (144/150):
   - Preserves existing verified WebP mappings when raw upload dirs are absent, or rebuilds if present.
2) Grade 3 (150/150 — 100% complete):
   - Converts all 150 conversational Part 1 illustrations (4:3) from `eiken_3_listening_all_150_images` ZIP
     into optimized grayscale WebP under `public/eiken_images/eiken_3_shared/`.
3) Grade Pre-1 (75/75 — 100% complete) & Grade 1 (75/75 — 100% complete):
   - Combines `eiken_pre1_listening_images_70_partial.zip` (R01–R14, 70 PNGs) +
     `eiken_pre1_listening_r15_part3_71-75.zip` (R15, 5 PNGs) for Pre-1, and
     `eiken_1_listening_images_75.zip` (R01–R15, 75 PNGs) for Grade 1.
   - Extracts the crisp monochrome Real-Life header icon banner above/from the blank layout grid
     (so the app HTML table and PDF table render exact English text/numbers with the thematic illustration
     header and zero redundant empty 5x4 boxes), saving optimized grayscale WebPs under
     `public/eiken_images/eiken_pre1_shared/` and `public/eiken_images/eiken_1_shared/`.

Outputs:
- `src/eiken/listeningImages.generated.ts` exporting `LISTENING_IMAGE_URLS`
- `deliverables/listening_resolved_images.json` for PDF builders
"""
import hashlib
import io
import json
import re
import zipfile
from pathlib import Path
import numpy as np
from PIL import Image, ImageOps

ROOT = Path(__file__).resolve().parents[1]
PUBLIC = ROOT / 'public'
DELIV = ROOT / 'deliverables'
UP = Path('/home/user/uploaded_files')

G5_SHARED = PUBLIC / 'eiken_images' / 'eiken_5_shared'
G4_SHARED = PUBLIC / 'eiken_images' / 'eiken_4_shared'
G3_SHARED = PUBLIC / 'eiken_images' / 'eiken_3_shared'
PRE1_SHARED = PUBLIC / 'eiken_images' / 'eiken_pre1_shared'
G1_SHARED = PUBLIC / 'eiken_images' / 'eiken_1_shared'
for d in (G5_SHARED, G4_SHARED, G3_SHARED, PRE1_SHARED, G1_SHARED):
    d.mkdir(parents=True, exist_ok=True)

slot_map: dict[str, str] = {}
hash_to_web_url: dict[str, str] = {}


def load_existing_g5_g4() -> tuple[int, int]:
    gen_ts = ROOT / 'src/eiken/listeningImages.generated.ts'
    if not gen_ts.exists():
        return 0, 0
    txt = gen_ts.read_text('utf-8')
    m = re.search(r'=\s*(\{[\s\S]*\})\s*;', txt)
    if not m:
        return 0, 0
    prev: dict[str, str] = json.loads(m.group(1))
    g5_cnt = 0
    g4_cnt = 0
    for k, v in prev.items():
        if k.startswith('eiken_5_') or k.startswith('eiken_4_'):
            local_p = PUBLIC / v.lstrip('/')
            if local_p.exists():
                slot_map[k] = v
                if k.startswith('eiken_5_'):
                    g5_cnt += 1
                else:
                    g4_cnt += 1
    return g5_cnt, g4_cnt


def save_webp_bytes(
    im: Image.Image,
    raw_key_bytes: bytes,
    out_dir: Path,
    prefix: str,
    seq_counter: list[int],
    max_box: tuple[int, int],
) -> str:
    digest = hashlib.sha256(raw_key_bytes).hexdigest()[:16]
    cache_key = f'{out_dir.name}:{digest}'
    if cache_key in hash_to_web_url:
        return hash_to_web_url[cache_key]
    seq_counter[0] += 1
    out_name = f'{prefix}_{seq_counter[0]:03d}.webp'
    out_path = out_dir / out_name
    gray = im.convert('L')
    gray.thumbnail(max_box, Image.Resampling.LANCZOS)
    gray.save(out_path, 'WEBP', quality=82, method=6)
    web_url = f'/eiken_images/{out_dir.name}/{out_name}'
    hash_to_web_url[cache_key] = web_url
    return web_url


def extract_clean_banner(im: Image.Image) -> Image.Image:
    """Extract the monochrome Real-Life header illustration banner without the empty lower blank grid."""
    gray = np.array(im.convert('L'))
    h, w = gray.shape
    dark_row = (gray < 150).mean(axis=1)
    ys = np.where(dark_row > 0.76)[0]
    lines: list[list[int]] = []
    for y in ys:
        if not lines or int(y) - lines[-1][-1] > 25:
            lines.append([int(y)])
        else:
            lines[-1].append(int(y))
    line_tops = [seg[0] for seg in lines]
    line_bots = [seg[-1] for seg in lines]

    if not line_tops:
        crop = gray[: int(h * 0.28), :].copy()
    else:
        first_top = line_tops[0]
        above_ink = int((gray[: max(1, first_top - 8), :] < 180).sum())
        if above_ink > 3500 and first_top >= 110:
            crop = gray[: first_top - 8, :].copy()
        elif len(line_tops) >= 2:
            y0 = line_bots[0] + 6
            y1 = line_tops[1] - 6
            band = gray[y0:y1, :].copy()
            _, bw = band.shape
            v_dark = (band < 165).mean(axis=0)
            v_cols = np.where(v_dark > 0.85)[0]
            for c in v_cols:
                band[:, max(0, int(c) - 5) : min(bw, int(c) + 6)] = 255
            crop = band
        else:
            crop = gray[: min(h, 480), :].copy()

    pil_c = Image.fromarray(crop)
    inv = ImageOps.invert(pil_c).point(lambda p: 255 if p > 35 else 0)
    bbox = inv.getbbox()
    if bbox:
        pad = 20
        pil_c = pil_c.crop((
            max(0, bbox[0] - pad),
            max(0, bbox[1] - pad),
            min(pil_c.width, bbox[2] + pad),
            min(pil_c.height, bbox[3] + pad),
        ))
    return pil_c


def find_zip(candidates: list[str]) -> Path:
    for name in candidates:
        p = UP / name
        if p.exists():
            return p
    raise FileNotFoundError(f'None of {candidates} found in {UP}')


def load_zip_png_map(*zip_paths: Path) -> dict[str, bytes]:
    out: dict[str, bytes] = {}
    for zp in zip_paths:
        with zipfile.ZipFile(zp) as zf:
            for name in zf.namelist():
                if name.endswith('/') or not name.lower().endswith('.png'):
                    continue
                out[Path(name).stem] = zf.read(name)
    return out


# 1) Preserve Grade 5 & Grade 4 verified mappings
g5_cnt, g4_cnt = load_existing_g5_g4()

booklets = json.loads((DELIV / 'listening-booklets.json').read_text('utf-8'))

# 2) Grade 3 (150/150 support illustrations, 4:3)
for old_w in G3_SHARED.glob('*.webp'):
    old_w.unlink()
g3_zip = find_zip([
    'eiken_3_listening_all_150_images (3).zip',
    'eiken_3_listening_all_150_images (2).zip',
    'eiken_3_listening_all_150_images.zip',
])
g3_raw_map = load_zip_png_map(g3_zip)
g3_seq = [0]
g3_cnt = 0
for ex in [b for b in booklets['booklets'] if b['grade'] == 'eiken_3']:
    for u in ex['units']:
        if not u.get('image'):
            continue
        stem = Path(u['image']['targetPath']).stem
        raw = g3_raw_map[stem]
        im = Image.open(io.BytesIO(raw))
        slot_map[u['audioId']] = save_webp_bytes(im, raw, G3_SHARED, 'g3_img', g3_seq, (880, 660))
        g3_cnt += 1

# 3) Grade Pre-1 (75/75 Real-Life header illustrations)
for old_w in PRE1_SHARED.glob('*.webp'):
    old_w.unlink()
pre1_zip_a = find_zip(['eiken_pre1_listening_images_70_partial.zip'])
pre1_zip_b = find_zip(['eiken_pre1_listening_r15_part3_71-75.zip'])
pre1_raw_map = load_zip_png_map(pre1_zip_a, pre1_zip_b)
pre1_seq = [0]
pre1_cnt = 0
for ex in [b for b in booklets['booklets'] if b['grade'] == 'eiken_pre1']:
    for u in ex['units']:
        if not u.get('image'):
            continue
        stem = Path(u['image']['targetPath']).stem
        raw = pre1_raw_map[stem]
        banner = extract_clean_banner(Image.open(io.BytesIO(raw)))
        buf = io.BytesIO()
        banner.save(buf, 'PNG')
        slot_map[u['audioId']] = save_webp_bytes(banner, buf.getvalue(), PRE1_SHARED, 'pre1_img', pre1_seq, (960, 240))
        pre1_cnt += 1

# 4) Grade 1 (75/75 Real-Life header illustrations)
for old_w in G1_SHARED.glob('*.webp'):
    old_w.unlink()
g1_zip = find_zip(['eiken_1_listening_images_75.zip'])
g1_raw_map = load_zip_png_map(g1_zip)
g1_seq = [0]
g1_cnt = 0
for ex in [b for b in booklets['booklets'] if b['grade'] == 'eiken_1']:
    for u in ex['units']:
        if not u.get('image'):
            continue
        stem = Path(u['image']['targetPath']).stem
        raw = g1_raw_map[stem]
        banner = extract_clean_banner(Image.open(io.BytesIO(raw)))
        buf = io.BytesIO()
        banner.save(buf, 'PNG')
        slot_map[u['audioId']] = save_webp_bytes(banner, buf.getvalue(), G1_SHARED, 'g1_img', g1_seq, (960, 240))
        g1_cnt += 1

gen_ts = ROOT / 'src/eiken/listeningImages.generated.ts'
gen_ts.write_text(
    '// Auto-generated by scripts/integrate-listening-images.py\n'
    f'// Grade 5: {g5_cnt}/300 | Grade 4: {g4_cnt}/150 | Grade 3: {g3_cnt}/150 | Pre-1: {pre1_cnt}/75 | Grade 1: {g1_cnt}/75 (Total: {len(slot_map)}/750)\n'
    f'export const LISTENING_IMAGE_URLS: Readonly<Record<string, string>> = {json.dumps(slot_map, indent=2, sort_keys=True)};\n',
    'utf-8',
)

pdf_img_map = {k: str(PUBLIC / v.lstrip('/')) for k, v in slot_map.items()}
(DELIV / 'listening_resolved_images.json').write_text(
    json.dumps(pdf_img_map, indent=2, sort_keys=True) + '\n',
    'utf-8',
)

for label, cnt, total, folder in [
    ('Grade 5', g5_cnt, 300, G5_SHARED),
    ('Grade 4', g4_cnt, 150, G4_SHARED),
    ('Grade 3', g3_cnt, 150, G3_SHARED),
    ('Grade Pre-1', pre1_cnt, 75, PRE1_SHARED),
    ('Grade 1', g1_cnt, 75, G1_SHARED),
]:
    kb = sum(p.stat().st_size for p in folder.glob('*.webp')) / 1024
    files_n = len(list(folder.glob('*.webp')))
    print(f'{label}: {cnt}/{total} mapped ({files_n} WebP files, {kb:.1f} KB)')
print(f'Total mapped Listening image slots: {len(slot_map)}/750')
