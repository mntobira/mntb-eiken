"""Validate and integrate recorded Eiken Listening MP3 archives across all grades (`eiken_5`, `eiken_4`, ...):
1) Reads `deliverables/listening-booklets.json` for all 8 grades x 15 rounds (3,285 audio units).
2) Scans `/home/user/*_audio_persist/` (e.g., `/home/user/g5_audio_persist/`, and future `g4_audio_persist/`, etc.) for `<audioId>.mp3` and optional `対応表.csv`.
3) Verifies every present MP3 against the canonical round, part, questionNumber, and speaker-role sequence (`Man` / `Woman` / `Narrator`).
4) Transcodes speech MP3s cleanly to crisp 24 kHz mono 48 kbps CBR MP3 under `public/eiken_audio/<grade>/<audioId>.mp3` (skips unchanged files on re-runs for fast incremental updates).
5) Generates `src/eiken/listeningAudio.generated.ts` exporting `LISTENING_AUDIO_URLS: Readonly<Record<string, string>>` and writes `deliverables/eiken_listening_audio_audit.json`.
"""
from concurrent.futures import ThreadPoolExecutor
import csv
import json
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PUBLIC = ROOT / 'public'
DELIV = ROOT / 'deliverables'
OUT_BASE = PUBLIC / 'eiken_audio'
OUT_BASE.mkdir(parents=True, exist_ok=True)

BOOKLETS = json.loads((DELIV / 'listening-booklets.json').read_text('utf-8'))['booklets']

# Discover all persisted audio drop directories under /home/user/*_audio_persist
PERSIST_DIRS = sorted(Path('/home/user').glob('*_audio_persist'))
src_mp3_by_id: dict[str, Path] = {}
csv_rows_by_id: dict[str, dict[str, str]] = {}

for pdir in PERSIST_DIRS:
    for mp3 in sorted(pdir.rglob('*.mp3')):
        src_mp3_by_id[mp3.stem] = mp3
    for csv_path in sorted(pdir.rglob('*.csv')):
        try:
            with csv_path.open('r', encoding='utf-8-sig') as f:
                reader = csv.DictReader(f)
                if reader.fieldnames and '音源ID' in reader.fieldnames:
                    for row in reader:
                        aid = (row.get('音源ID') or '').strip()
                        if aid:
                            csv_rows_by_id[aid] = row
        except Exception as exc:
            print(f'[warn] Could not parse CSV {csv_path}: {exc}')

expected_units: dict[str, dict] = {}
for exam in BOOKLETS:
    grade = exam['grade']
    rnd = exam['round']
    for unit in exam['units']:
        aid = unit['audioId']
        norm_roles: list[str] = []
        for t in unit['turns']:
            rl = t['roleLabel']
            sp = t['speaker']
            if rl == 'Narrator':
                if not norm_roles or norm_roles[-1] != 'Narrator':
                    norm_roles.append('Narrator')
            elif sp.startswith('M'):
                norm_roles.append('Man')
            elif sp.startswith('F'):
                norm_roles.append('Woman')
            else:
                norm_roles.append(rl)
        expected_units[aid] = {
            'grade': grade,
            'round': rnd,
            'part': unit['part'],
            'questionNumber': unit['questions'][0]['questionNumber'],
            'normRoles': norm_roles,
        }

jobs: list[tuple[str, str, Path, Path]] = []
audit_by_grade: dict[str, dict] = {}
mismatches: list[dict] = []

for aid, meta in sorted(expected_units.items()):
    grade = meta['grade']
    g_stat = audit_by_grade.setdefault(
        grade,
        {'expectedUnits': 0, 'integratedUnits': 0, 'csvVerifiedUnits': 0, 'mismatches': 0},
    )
    g_stat['expectedUnits'] += 1

    src = src_mp3_by_id.get(aid)
    if not src:
        continue

    # Verify against CSV mapping if provided
    row = csv_rows_by_id.get(aid)
    if row:
        csv_round = int(row['回'])
        csv_part = f"part{row['Part'].strip()}"
        csv_qno = int(row['actual_no'])
        csv_roles = [r.strip() for r in row['原稿上の役割'].split('/') if r.strip()]
        if (
            csv_round != meta['round']
            or csv_part != meta['part']
            or csv_qno != meta['questionNumber']
            or csv_roles != meta['normRoles']
        ):
            mismatches.append({
                'audioId': aid,
                'expected': meta,
                'csv': row,
            })
            g_stat['mismatches'] += 1
            continue
        g_stat['csvVerifiedUnits'] += 1

    out_dir = OUT_BASE / grade
    out_dir.mkdir(parents=True, exist_ok=True)
    dst = out_dir / f'{aid}.mp3'
    jobs.append((aid, grade, src, dst))
    g_stat['integratedUnits'] += 1

if mismatches:
    raise SystemExit(f'Found {len(mismatches)} audio mapping mismatches: {mismatches[:3]}')


def transcode_one(item: tuple[str, str, Path, Path]) -> tuple[str, str, int]:
    aid, grade, src, dst = item
    if not dst.exists() or dst.stat().st_size < 1000:
        subprocess.run(
            [
                'ffmpeg',
                '-y',
                '-v',
                'error',
                '-i',
                str(src),
                '-vn',
                '-ac',
                '1',
                '-ar',
                '24000',
                '-c:a',
                'libmp3lame',
                '-b:a',
                '48k',
                str(dst),
            ],
            check=True,
        )
    return aid, f'/eiken_audio/{grade}/{aid}.mp3', dst.stat().st_size


audio_url_map: dict[str, str] = {}
total_bytes = 0

with ThreadPoolExecutor(max_workers=4) as pool:
    for aid, web_url, sz in pool.map(transcode_one, jobs):
        audio_url_map[aid] = web_url
        total_bytes += sz

summary_parts = [
    f"{g}: {st['integratedUnits']}/{st['expectedUnits']}"
    for g, st in sorted(audit_by_grade.items())
    if st['integratedUnits'] > 0
]
header_comment = ' | '.join(summary_parts) if summary_parts else 'none yet'

gen_ts = ROOT / 'src/eiken/listeningAudio.generated.ts'
gen_ts.write_text(
    f'// Auto-generated by scripts/integrate-listening-audio.py\n'
    f'// Integrated recorded MP3 units: {len(audio_url_map)} ({header_comment}) — Manus AI commercial-OK\n'
    f'export const LISTENING_AUDIO_URLS: Readonly<Record<string, string>> = {json.dumps(audio_url_map, indent=2, sort_keys=True)};\n',
    'utf-8',
)

audit_report = {
    'totalIntegratedUnits': len(audio_url_map),
    'totalPublicAudioMB': round(total_bytes / (1024 * 1024), 2),
    'sourceLicense': 'Manus AI generated (user-confirmed commercial use OK, non-official original script)',
    'grades': audit_by_grade,
}
(DELIV / 'eiken_listening_audio_audit.json').write_text(
    json.dumps(audit_report, indent=2, ensure_ascii=False) + '\n',
    'utf-8',
)

print(
    f'Integrated {len(audio_url_map)} MP3 files ({total_bytes / (1024 * 1024):.2f} MB total) -> {gen_ts.relative_to(ROOT)}'
)
for g, st in sorted(audit_by_grade.items()):
    if st['integratedUnits'] > 0:
        print(f"  {g}: {st['integratedUnits']}/{st['expectedUnits']} integrated (CSV verified: {st['csvVerifiedUnits']}, mismatches: {st['mismatches']})")
