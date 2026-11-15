"""Build unified Primary Exam (一次試験：筆記・リーディング・ライティング ＋ リスニング) PDFs
for every (grade, round) pair present in BOTH `written-booklets.json` and `listening-booklets.json`
(with `scope != 'reading'` so only full primary written exams are paired).

Uses `listening_print_layout.py` so the Unified Cover, Written Question Pages, Listening Question Pages,
Written Mark/Writing Answer Sheets, Listening Mark Sheet, and Written + Listening Explanations all share
the exact same authentic monochrome Eiken test booklet aesthetic!

Outputs per paired (grade, round) in `deliverables/pdfs/primary_bundles/`:
  1) {grade}_primary_r{round:02d}_full_set.pdf     (Unified Cover + Written Q + Listening Q + Written Ans + Listening Ans + Written Exp + Listening Exp)
  2) {grade}_primary_r{round:02d}_questions.pdf    (Unified Cover + Written Q + Listening Q)
  3) {grade}_primary_r{round:02d}_answers.pdf      (Written Mark/Writing Sheet + Listening Mark Sheet)
  4) {grade}_primary_r{round:02d}_explanations.pdf (Written Exp + Listening Exp)

Every cover embeds `public/brand/manatobi-logo-gray.png` and explicitly states 「過去問の流用禁止」.
"""
from pathlib import Path
import json
import pymupdf

from listening_print_layout import (
    GRADE_META,
    build_unified_primary_cover_bytes,
    build_listening_questions_bytes,
    build_listening_mark_sheet_bytes,
    build_listening_explanations_bytes,
    check_no_line_overlaps,
)

ROOT = Path(__file__).resolve().parents[1]
PUBLIC = ROOT / 'public'
DELIV = ROOT / 'deliverables'
BUNDLE_DIR = DELIV / 'pdfs' / 'primary_bundles'
BUNDLE_DIR.mkdir(parents=True, exist_ok=True)

WRITTEN_DATA = json.loads((DELIV / 'written-booklets.json').read_text('utf-8'))
LISTENING_DATA = json.loads((DELIV / 'listening-booklets.json').read_text('utf-8'))
RESOLVED_IMAGES_PATH = DELIV / 'listening_resolved_images.json'
RESOLVED_IMAGES: dict[str, str] = (
    json.loads(RESOLVED_IMAGES_PATH.read_text('utf-8')) if RESOLVED_IMAGES_PATH.exists() else {}
)


def merge_and_verify(
    out_path: Path,
    sources: list[tuple[bytes | Path, int]],
    toc_entries: list[tuple[str, int]] | None = None,
    check_cover_logo: bool = False,
    overlap_indices: list[int] | None = None,
    question_page_end: int = 0,
) -> dict:
    merged = pymupdf.open()
    toc = []
    for idx_s, (src, start_page) in enumerate(sources):
        doc = pymupdf.open(src) if isinstance(src, Path) else pymupdf.open(stream=src, filetype='pdf')
        if start_page < len(doc):
            if toc_entries and idx_s < len(toc_entries) and toc_entries[idx_s][0]:
                toc.append([1, toc_entries[idx_s][0], len(merged) + 1])
            merged.insert_pdf(doc, from_page=start_page, to_page=len(doc) - 1)
        doc.close()

    if toc:
        merged.set_toc(toc)
    merged.save(str(out_path), garbage=4, deflate=True)
    pages = len(merged)
    full_txt = '\n'.join(pg.get_text() for pg in merged)
    if '\ufffd' in full_txt or '\x00' in full_txt:
        raise ValueError(f'Mojibake or NUL in {out_path.name}')
    if check_cover_logo:
        if '過去問の流用禁止' not in merged[0].get_text():
            raise ValueError(f'Missing provenance rule on cover of {out_path.name}')
        if len(merged[0].get_images()) < 1:
            raise ValueError(f'Missing Manatobi brand logo on cover of {out_path.name}')
    for q_idx in range(1, question_page_end):
        qt = merged[q_idx].get_text()
        if '【和訳】' in qt or '【根拠・解き方】' in qt or '【参考解答' in qt:
            raise ValueError(f'Answer/explanation leaked onto question page {q_idx + 1} of {out_path.name}')
    for ov_i in (overlap_indices or []):
        if 0 <= ov_i < len(merged):
            check_no_line_overlaps(merged[ov_i], f'{out_path.name} p.{ov_i + 1}')
    merged.close()
    return {'file': out_path.name, 'pages': pages, 'bytes': out_path.stat().st_size}


def main():
    # Pair only full primary written booklets (exclude reading-only scope if any)
    written_map = {
        (b['grade'], b['round']): b
        for b in WRITTEN_DATA['booklets']
        if b.get('scope') != 'reading'
    }
    listening_map = {(b['grade'], b['round']): b for b in LISTENING_DATA['booklets']}

    paired_keys = sorted(set(written_map.keys()) & set(listening_map.keys()))
    if not paired_keys:
        raise RuntimeError('No paired (grade, round) booklets found.')

    reports = []
    for grade, rnd in paired_keys:
        w_exam = written_map[(grade, rnd)]
        l_exam = listening_map[(grade, rnd)]
        full_label, _, _ = GRADE_META[grade]
        w_bp = WRITTEN_DATA['blueprints'][grade]
        l_bp = LISTENING_DATA['blueprints'][grade]
        w_base = PUBLIC / 'prints' / f'print_{grade}_written_{rnd:02d}'
        w_q_pdf = Path(f'{w_base}_questions.pdf')
        w_a_pdf = Path(f'{w_base}_answers.pdf')
        w_e_pdf = Path(f'{w_base}_explanations.pdf')
        if not w_q_pdf.exists():
            continue

        with pymupdf.open(w_q_pdf) as wqd:
            w_q_total_pages = len(wqd)
        with pymupdf.open(w_a_pdf) as wad:
            w_a_pages = len(wad)

        # Listening question pages continue page numbering seamlessly right after Written question pages!
        cover_bytes = build_unified_primary_cover_bytes(grade, rnd, w_exam, w_bp, l_exam, l_bp)
        l_q_bytes = build_listening_questions_bytes(
            grade, rnd, l_exam, l_bp, RESOLVED_IMAGES, start_page_no=w_q_total_pages + 1
        )
        l_a_bytes = build_listening_mark_sheet_bytes(grade, rnd, l_exam, l_bp)
        l_e_bytes = build_listening_explanations_bytes(grade, rnd, l_exam, l_bp)

        with pymupdf.open(stream=l_q_bytes, filetype='pdf') as lqd:
            l_q_pages = len(lqd)

        total_q_pages = w_q_total_pages + l_q_pages  # 1 (cover) + (w_q_total_pages - 1) + l_q_pages
        bundle_prefix = f'{grade}_primary_r{rnd:02d}'

        # 1) Full all-in-one primary bundle PDF
        full_out = BUNDLE_DIR / f'{bundle_prefix}_full_set.pdf'
        ans_start_idx = total_q_pages
        l_ans_idx = total_q_pages + w_a_pages
        rep_full = merge_and_verify(
            full_out,
            [
                (cover_bytes, 0),
                (w_q_pdf, 1),   # skip single-written cover, use unified primary cover on p.1
                (l_q_bytes, 0),
                (w_a_pdf, 0),
                (l_a_bytes, 0),
                (w_e_pdf, 0),
                (l_e_bytes, 0),
            ],
            toc_entries=[
                (f'{full_label} 第{rnd}回 一次試験 表紙・筆記問題', 0),
                ('', 0),
                ('リスニング問題', 0),
                ('筆記 解答用紙', 0),
                ('リスニング 解答用紙（マークシート）', 0),
                ('筆記 解答・解説', 0),
                ('リスニング 解答・放送原稿・解説', 0),
            ],
            check_cover_logo=True,
            overlap_indices=[0, ans_start_idx, l_ans_idx],
            question_page_end=total_q_pages,
        )

        # 2) Unified Question Booklet
        q_out = BUNDLE_DIR / f'{bundle_prefix}_questions.pdf'
        rep_q = merge_and_verify(
            q_out,
            [(cover_bytes, 0), (w_q_pdf, 1), (l_q_bytes, 0)],
            toc_entries=[(f'{full_label} 第{rnd}回 一次筆記問題', 0), ('', 0), ('リスニング問題', 0)],
            check_cover_logo=True,
            overlap_indices=[0],
            question_page_end=total_q_pages,
        )

        # 3) Unified Answer Sheet (Written mark/writing + Listening mark)
        a_out = BUNDLE_DIR / f'{bundle_prefix}_answers.pdf'
        rep_a = merge_and_verify(
            a_out,
            [(w_a_pdf, 0), (l_a_bytes, 0)],
            toc_entries=[('筆記 解答用紙', 0), ('リスニング マークシート', 0)],
            check_cover_logo=False,
            overlap_indices=list(range(w_a_pages + 1)),
        )

        # 4) Unified Explanations Booklet
        e_out = BUNDLE_DIR / f'{bundle_prefix}_explanations.pdf'
        rep_e = merge_and_verify(
            e_out,
            [(w_e_pdf, 0), (l_e_bytes, 0)],
            toc_entries=[('筆記 解答・解説', 0), ('リスニング 解答・放送原稿・解説', 0)],
            check_cover_logo=False,
        )

        reports.append({
            'bundleId': bundle_prefix,
            'grade': grade,
            'round': rnd,
            'fullSet': rep_full,
            'questions': rep_q,
            'answers': rep_a,
            'explanations': rep_e,
        })

    (BUNDLE_DIR / 'primary-bundles-report.json').write_text(json.dumps(reports, indent=2, ensure_ascii=False) + '\n', 'utf-8')
    print(f'Successfully built and verified {len(reports)} unified Primary Exam bundles ({len(reports) * 4} PDFs total).')


if __name__ == '__main__':
    main()
