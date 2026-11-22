/**
 * すごろく塾 管理者ポータル：複数講師（owner / staff）管理シート（エッセンシャル設計）
 * オーナー講師が他の講師（Googleメールアドレス）を追加・解除できる最小UI。
 */

import { useState } from 'react';
import { Copy, Plus, Trash2 } from 'lucide-react';
import { PrimaryButton, SecondaryButton } from '../../components/ui';
import type { SugorokuStaffInviteDoc } from '../shared/types';
import { isValidStaffEmail, normalizeStaffEmail } from './firestoreAdminService';
import { SugorokuBottomSheet, type ToastTone } from './SugorokuInteractiveUi';

interface SugorokuStaffSheetProps {
  open: boolean;
  onClose: () => void;
  viewerRole: 'owner' | 'staff';
  ownerName: string;
  ownerEmail?: string;
  staffInvites: SugorokuStaffInviteDoc[];
  onInviteStaff: (params: { email: string; staffName: string }) => Promise<void> | void;
  onRevokeStaff: (invite: SugorokuStaffInviteDoc) => Promise<void> | void;
  onToast?: (message: string, tone?: ToastTone) => void;
}

export function SugorokuStaffSheet({
  open,
  onClose,
  viewerRole,
  ownerName,
  ownerEmail,
  staffInvites,
  onInviteStaff,
  onRevokeStaff,
  onToast,
}: SugorokuStaffSheetProps) {
  const [staffName, setStaffName] = useState('');
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);

  const canManage = viewerRole === 'owner';

  const handleAdd = async () => {
    const normalized = normalizeStaffEmail(email);
    if (!isValidStaffEmail(normalized)) {
      onToast?.('メールアドレスを確認してください', 'warn');
      return;
    }
    if (
      ownerEmail &&
      normalizeStaffEmail(ownerEmail) === normalized
    ) {
      onToast?.('代表アカウントは登録済みです', 'warn');
      return;
    }
    if (staffInvites.some((inv) => inv.email === normalized && inv.status !== 'revoked')) {
      onToast?.('すでに追加されています', 'warn');
      return;
    }

    setBusy(true);
    try {
      await onInviteStaff({
        email: normalized,
        staffName: staffName.trim() || normalized.split('@')[0],
      });
      setStaffName('');
      setEmail('');
      onToast?.('講師を追加しました', 'done');
    } catch (e) {
      onToast?.(e instanceof Error ? e.message : '追加に失敗しました', 'warn');
    } finally {
      setBusy(false);
    }
  };

  const handleCopyPortalUrl = async () => {
    const url =
      typeof window !== 'undefined'
        ? `${window.location.origin}/?portal=admin`
        : '/?portal=admin';
    try {
      await navigator.clipboard.writeText(url);
      onToast?.('管理画面URLをコピーしました', 'done');
    } catch {
      onToast?.('コピーできませんでした', 'warn');
    }
  };

  return (
    <SugorokuBottomSheet open={open} title="講師メンバー" onClose={onClose}>
      <div className="sg-grid-14">
        {/* 登録済み講師一覧 */}
        <div className="slog-rows">
          <div className="slog-row">
            <span>
              <strong>{ownerName}</strong>
              {ownerEmail && <small>{ownerEmail}</small>}
            </span>
            <span className="sg-grade-tag">代表</span>
          </div>

          {staffInvites.map((inv) => (
            <div key={inv.id} className="slog-row">
              <span>
                <strong>{inv.staffName}</strong>
                <small>{inv.email}</small>
              </span>

              <span className="sg-grade-tag">
                {inv.status === 'active' ? '参加中' : '招待中'}
              </span>

              {canManage && (
                <button
                  type="button"
                  className="sg-icon-btn"
                  aria-label={`${inv.staffName}を解除`}
                  title="権限を解除"
                  disabled={busy}
                  onClick={async () => {
                    setBusy(true);
                    try {
                      await onRevokeStaff(inv);
                      onToast?.(`${inv.staffName}を解除しました`, 'done');
                    } finally {
                      setBusy(false);
                    }
                  }}
                >
                  <Trash2 size={14} />
                </button>
              )}
            </div>
          ))}
        </div>

        {/* オーナーのみ：新規講師追加フォーム */}
        {canManage && (
          <div className="slog-form sg-staff-add-form">
            <div className="row">
              <label className="f">
                <span>講師名</span>
                <input
                  type="text"
                  placeholder="例: 藤沢 卓登"
                  value={staffName}
                  onChange={(e) => setStaffName(e.target.value)}
                />
              </label>

              <label className="f">
                <span>Googleメール</span>
                <input
                  type="email"
                  placeholder="example@gmail.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </label>
            </div>

            <div className="sg-flex-gap-8">
              <SecondaryButton
                onClick={() => void handleCopyPortalUrl()}
                icon={<Copy size={14} aria-hidden="true" />}
              >
                管理URLコピー
              </SecondaryButton>

              <PrimaryButton
                className="sg-flex-1"
                disabled={busy || !email.trim()}
                onClick={() => void handleAdd()}
                icon={<Plus size={15} aria-hidden="true" />}
              >
                講師を追加
              </PrimaryButton>
            </div>
          </div>
        )}
      </div>
    </SugorokuBottomSheet>
  );
}
