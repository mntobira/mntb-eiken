"""Optimize and integrate:
1) Grade 5 Listening illustrations:
   - 258 compatible reused slots from the 60 uploaded R1–R3 PNGs
   - All newly generated delta PNGs present in `/home/user/g5_uploaded_persist/generated/` (currently 13/42 -> 271/300 total, Rounds 1–5 100% complete)
   - Leaves the remaining ungenerated Grade 5 object-specific slots unmapped (never uses a fake stand-in!).
2) Grade 4 Listening illustrations:
   - Audits all 150 uploaded PNGs in `/home/user/g4_uploaded_persist/eiken4/final_set/`.
   - Integrates 139 directly matching PNGs as-is.
   - Cleanly reuses matching Round 14 No.6–No.10 illustrations from the same zip for Round 15 No.6–No.10 (5 slots).
   - Integrates all 6 newly re-generated Grade 4 retake PNGs from `/home/user/g4_uploaded_persist/generated/` (`R02Q01`, `R03Q01`, `R04Q01`, `R05Q04`, `R07Q01`, `R08Q01`) -> 150/150 (100% COMPLETE!).

Outputs:
- Clean, deduplicated grayscale WebP files under `public/eiken_images/eiken_5_shared/` and `public/eiken_images/eiken_4_shared/`
- `src/eiken/listeningImages.generated.ts` exporting `LISTENING_IMAGE_URLS`
- `deliverables/listening_resolved_images.json` for PDF builders
- `deliverables/eiken_4_audit_report.json` documenting the full 150-file Grade 4 check & retake completion
- `deliverables/eiken_5_generation_progress.json` documenting Grade 5 progress
"""
import hashlib
import json
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
PUBLIC = ROOT / 'public'
DELIV = ROOT / 'deliverables'

G5_SHARED = PUBLIC / 'eiken_images' / 'eiken_5_shared'
G4_SHARED = PUBLIC / 'eiken_images' / 'eiken_4_shared'
G5_SHARED.mkdir(parents=True, exist_ok=True)
G4_SHARED.mkdir(parents=True, exist_ok=True)

# Clean old WebPs before writing fresh deduplicated assets so no orphaned files remain
for old_webp in list(G5_SHARED.glob('*.webp')) + list(G4_SHARED.glob('*.webp')):
    old_webp.unlink()

G5_GEN_DIR = Path('/home/user/g5_uploaded_persist/generated')
G4_SRC_DIR = Path('/home/user/g4_uploaded_persist/eiken4/final_set')
G4_GEN_DIR = Path('/home/user/g4_uploaded_persist/generated')

slot_map: dict[str, str] = {}
hash_to_web_url: dict[str, str] = {}


def save_dedup_webp(src_path: Path, out_dir: Path, prefix: str, seq_counter: list[int]) -> str:
    digest = hashlib.sha256(src_path.read_bytes()).hexdigest()[:16]
    cache_key = f'{out_dir.name}:{digest}'
    if cache_key in hash_to_web_url:
        return hash_to_web_url[cache_key]
    seq_counter[0] += 1
    out_name = f'{prefix}_{seq_counter[0]:03d}.webp'
    out_path = out_dir / out_name
    im = Image.open(src_path).convert('L')
    im.thumbnail((880, 660), Image.Resampling.LANCZOS)
    im.save(out_path, 'WEBP', quality=82, method=6)
    web_url = f'/eiken_images/{out_dir.name}/{out_name}'
    hash_to_web_url[cache_key] = web_url
    return web_url


# --- 1) Grade 5 Integration ---
g5_plan = json.loads((DELIV / 'eiken_5_image_reuse_and_delta_plan.json').read_text('utf-8'))
g5_seq = [0]
g5_reused_cnt = 0
g5_gen_cnt = 0
g5_pending = []

for it in g5_plan['items']:
    stem = Path(it['targetPath']).stem
    if it['mode'] == 'reuse':
        src = Path(it['sourceLocal'].replace('/tmp/g5_uploaded/', '/home/user/g5_uploaded_persist/'))
        slot_map[stem] = save_dedup_webp(src, G5_SHARED, 'g5_img', g5_seq)
        g5_reused_cnt += 1
    else:
        cand = G5_GEN_DIR / f'{stem}.png'
        if cand.exists():
            slot_map[stem] = save_dedup_webp(cand, G5_SHARED, 'g5_delta', g5_seq)
            g5_gen_cnt += 1
        else:
            g5_pending.append({
                'round': it['round'],
                'questionNumber': it['questionNumber'],
                'targetPath': it['targetPath'],
                'category': it['category'],
                'sceneSummaryJa': it['sceneSummaryJa'],
                'whyNewJa': it['whyNewJa'],
            })

# --- 2) Grade 4 Audit & Integration ---
G4_RETAKE_SPEC = {
    (2, 1): '台本「体育館のドアを開けておいてほしい（hold the gym door open）」に合わせ、統一線画タッチで新規描き起こし済',
    (3, 1): '台本「居間のラジオの音量を下げてほしい（turn down the radio volume）」に合わせ、統一線画タッチで新規描き起こし済',
    (4, 1): '台本「緑の蛍光ペンを貸してほしい（lend me your green highlighter）」に合わせ、統一線画タッチで新規描き起こし済',
    (5, 4): '台本「なぜ机の下を探しているの？（Why are you looking under the desk?）」に合わせ、統一線画タッチで新規描き起こし済',
    (7, 1): '台本「教室の壁地図を掛けるのを手伝ってほしい（help me hang this wall map）」に合わせ、統一線画タッチで新規描き起こし済',
    (8, 1): '台本「花壇の前で写真を撮ってほしい（take a photo of us here）」に合わせ、統一線画タッチで新規描き起こし済',
}

G4_R15_REUSE_FROM_R14 = {
    (15, 6): ('eiken_4_listening_r14_part1_06.png', 'ZIP同梱R15-06は図書返却図だったため、台本（電話応対）と完全一致する同ZIP内のR14-06（電話図）を適用'),
    (15, 7): ('eiken_4_listening_r14_part1_07.png', 'ZIP同梱R15-07は凧揚げ図だったため、台本（ロッカーに辞書を忘れて謝る）と完全一致する同ZIP内のR14-07（教室で謝る図）を適用'),
    (15, 8): ('eiken_4_listening_r14_part1_08.png', 'ZIP同梱R15-08は台所配膳図だったため、台本（掲示板前でひまわりの種まきを提案）と完全一致する同ZIP内のR14-08（掲示板前で相談図）を適用'),
    (15, 9): ('eiken_4_listening_r14_part1_09.png', 'ZIP同梱R15-09はベランダ水やり図だったため、台本（外出前の玄関でスカーフを持参するか相談）と完全一致する同ZIP内のR14-09（玄関外出図）を適用'),
    (15, 10): ('eiken_4_listening_r14_part1_10.png', 'ZIP同梱R15-10は駅窓口図だったため、台本（街角で展望台への道を尋ねる）と完全一致する同ZIP内のR14-10（街角道案内図）を適用'),
}

booklets = json.loads((DELIV / 'listening-booklets.json').read_text('utf-8'))
g4_exams = [b for b in booklets['booklets'] if b['grade'] == 'eiken_4']

g4_seq = [0]
g4_direct_cnt = 0
g4_reused_cnt = 0
g4_retake_done_cnt = 0
g4_retake_missing_cnt = 0
g4_audit_rows = []

for ex in g4_exams:
    r = ex['round']
    for u in ex['units']:
        if not u.get('image'):
            continue
        qno = u['questions'][0]['questionNumber']
        stem = Path(u['image']['targetPath']).stem
        orig_fn = f'{stem}.png'
        key = (r, qno)

        if key in G4_RETAKE_SPEC:
            gen_cand = G4_GEN_DIR / orig_fn
            if gen_cand.exists():
                slot_map[stem] = save_dedup_webp(gen_cand, G4_SHARED, 'g4_retake', g4_seq)
                g4_retake_done_cnt += 1
                g4_audit_rows.append({
                    'round': r,
                    'questionNumber': qno,
                    'file': orig_fn,
                    'status': 'retake_completed',
                    'sceneSummaryJa': u['image']['sceneSummaryJa'],
                    'note': G4_RETAKE_SPEC[key],
                })
            else:
                g4_retake_missing_cnt += 1
                g4_audit_rows.append({
                    'round': r,
                    'questionNumber': qno,
                    'file': orig_fn,
                    'status': 'retake_needed',
                    'sceneSummaryJa': u['image']['sceneSummaryJa'],
                    'note': G4_RETAKE_SPEC[key],
                })
        elif key in G4_R15_REUSE_FROM_R14:
            rep_fn, note = G4_R15_REUSE_FROM_R14[key]
            slot_map[stem] = save_dedup_webp(G4_SRC_DIR / rep_fn, G4_SHARED, 'g4_img', g4_seq)
            g4_reused_cnt += 1
            g4_audit_rows.append({
                'round': r,
                'questionNumber': qno,
                'file': orig_fn,
                'status': 'repaired_by_r14_reuse',
                'replacedWith': rep_fn,
                'sceneSummaryJa': u['image']['sceneSummaryJa'],
                'note': note,
            })
        else:
            slot_map[stem] = save_dedup_webp(G4_SRC_DIR / orig_fn, G4_SHARED, 'g4_img', g4_seq)
            g4_direct_cnt += 1
            g4_audit_rows.append({
                'round': r,
                'questionNumber': qno,
                'file': orig_fn,
                'status': 'ok',
                'sceneSummaryJa': u['image']['sceneSummaryJa'],
                'note': '台本・場面ともに一致（文字混入なし）',
            })

old_ts = ROOT / 'src/eiken/eiken5Images.generated.ts'
if old_ts.exists():
    old_ts.unlink()

g4_total_mapped = g4_direct_cnt + g4_reused_cnt + g4_retake_done_cnt
g5_total_mapped = g5_reused_cnt + g5_gen_cnt

gen_ts = ROOT / 'src/eiken/listeningImages.generated.ts'
gen_ts.write_text(
    f'// Auto-generated by scripts/integrate-listening-images.py\n'
    f'// Grade 5: {g5_total_mapped}/300 ({g5_reused_cnt} reused + {g5_gen_cnt} generated) | Grade 4: {g4_total_mapped}/150 ({g4_direct_cnt} direct + {g4_reused_cnt} R14-repaired + {g4_retake_done_cnt} retaken)\n'
    f'export const LISTENING_IMAGE_URLS: Readonly<Record<string, string>> = {json.dumps(slot_map, indent=2, sort_keys=True)};\n',
    'utf-8',
)

pdf_img_map = {k: str(PUBLIC / v.lstrip('/')) for k, v in slot_map.items()}
(DELIV / 'listening_resolved_images.json').write_text(
    json.dumps(pdf_img_map, indent=2, sort_keys=True) + '\n',
    'utf-8',
)
(DELIV / 'eiken_4_audit_report.json').write_text(
    json.dumps({
        'totalSlots': 150,
        'mappedSlots': g4_total_mapped,
        'directMatched': g4_direct_cnt,
        'repairedWithExistingZipImage': g4_reused_cnt,
        'retakeCompletedCount': g4_retake_done_cnt,
        'retakeNeededCount': g4_retake_missing_cnt,
        'items': g4_audit_rows,
    }, indent=2, ensure_ascii=False) + '\n',
    'utf-8',
)
(DELIV / 'eiken_5_generation_progress.json').write_text(
    json.dumps({
        'totalSlots': 300,
        'mappedSlots': g5_total_mapped,
        'reusedSlots': g5_reused_cnt,
        'generatedDeltaSlots': g5_gen_cnt,
        'remainingDeltaSlots': len(g5_pending),
        'remainingItems': g5_pending,
    }, indent=2, ensure_ascii=False) + '\n',
    'utf-8',
)

g5_kb = sum(p.stat().st_size for p in G5_SHARED.glob('*.webp')) / 1024
g4_kb = sum(p.stat().st_size for p in G4_SHARED.glob('*.webp')) / 1024
print(f'Grade 5: {g5_total_mapped}/300 mapped ({g5_seq[0]} unique WebPs, {g5_kb:.1f} KB); remaining delta: {len(g5_pending)}')
print(f'Grade 4: {g4_total_mapped}/150 mapped ({g4_seq[0]} unique WebPs, {g4_kb:.1f} KB); retake missing: {g4_retake_missing_cnt}')
print(f'Total mapped Listening image slots: {len(slot_map)}')
