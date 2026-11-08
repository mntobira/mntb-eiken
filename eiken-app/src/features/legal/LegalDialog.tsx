import { useEffect, useRef } from 'react';
import { PRIVACY_POLICY, TERMS, LEGAL_UPDATED, type LegalSection } from './legalText';

export type LegalDoc = 'privacy' | 'terms';

const DOCS: Record<LegalDoc, { title: string; sections: LegalSection[] }> = {
  privacy: { title: 'プライバシーポリシー', sections: PRIVACY_POLICY },
  terms: { title: '利用規約', sections: TERMS },
};

/** 利用規約・プライバシーポリシーをアプリ内で表示する（外部ブラウザに飛ばさない） */
export function LegalDialog({ doc, onClose }: { doc: LegalDoc; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (d && !d.open) d.showModal();
  }, []);
  const { title, sections } = DOCS[doc];
  return (
    <dialog ref={ref} className="legal-dialog" aria-labelledby="legal-title" onClose={onClose}>
      <header>
        <h2 id="legal-title">{title}</h2>
        <button type="button" autoFocus onClick={() => ref.current?.close()}>閉じる</button>
      </header>
      <div className="legal-body">
        <p className="legal-updated">最終更新：{LEGAL_UPDATED}</p>
        {sections.map((s) => (
          <section key={s.heading}>
            <h3>{s.heading}</h3>
            <ul>{s.body.map((line) => <li key={line}>{line}</li>)}</ul>
          </section>
        ))}
      </div>
    </dialog>
  );
}
