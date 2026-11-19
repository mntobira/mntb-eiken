/**
 * すごろく塾 認証・Ad-Free 連動・管理者ロール判定 React フック群
 */

import { useCallback, useEffect, useState } from 'react';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { auth } from '../../firebase';
import { useAdFree } from '../../ads/adFree';
import { subscribeJukuMemberships } from '../../utils/classAssignments';
import type { SugorokuMemberDoc } from '../shared/types';
import {
  resolveSugorokuPortalMode,
  type AdminAccessDecision,
  type SugorokuPortalMode,
} from './sugorokuAuthCore';
import {
  checkCurrentUserAdminAccess,
  consumeGoogleRedirectResult,
  refreshSugorokuEnrollmentAndAdFree,
  type SugorokuEnrollmentStatus,
} from './sugorokuAuthService';

/**
 * 現在のポータルモード（standard / juku / admin）を返すフック。
 */
export function useSugorokuPortalMode(): SugorokuPortalMode {
  const [mode] = useState<SugorokuPortalMode>(() => {
    const search = typeof window !== 'undefined' ? window.location.search : '';
    const envPortal = (import.meta.env as Record<string, string | undefined>).VITE_SUGOROKU_PORTAL;
    return resolveSugorokuPortalMode(search, envPortal);
  });
  return mode;
}

/**
 * アプリ常駐フック：
 *   - リダイレクトログイン復帰結果（consumeGoogleRedirectResult）の受け取り
 *   - sugoroku_members/{uid} および塾クラス（plan==='juku'）在籍状況の同期
 *   - 既存の useJukuAdFree / adFree ストアと完全連動して塾生の広告を 100% 非表示（Ad-Free）にする
 */
export function useSugorokuAuthState(): {
  user: User | null;
  loading: boolean;
  status: SugorokuEnrollmentStatus;
  adFree: boolean;
  refresh: () => Promise<SugorokuEnrollmentStatus>;
} {
  const [user, setUser] = useState<User | null>(() => auth.currentUser);
  const [loading, setLoading] = useState<boolean>(true);
  const [status, setStatus] = useState<SugorokuEnrollmentStatus>({
    uid: auth.currentUser?.uid || '',
    isEnrolledInJuku: false,
    adFreeApplied: false,
    memberDoc: null,
    jukuMemberships: [],
    allMemberships: [],
  });
  const adFree = useAdFree();

  const refresh = useCallback(async (targetUser?: User | null) => {
    const next = await refreshSugorokuEnrollmentAndAdFree(targetUser ?? auth.currentUser);
    setStatus(next);
    return next;
  }, []);

  useEffect(() => {
    let alive = true;

    void consumeGoogleRedirectResult()
      .then((redirectUser) => {
        if (alive && redirectUser) {
          setUser(redirectUser);
          return refresh(redirectUser);
        }
        return undefined;
      })
      .catch(() => undefined);

    const offJuku = subscribeJukuMemberships(() => {
      if (alive && auth.currentUser) {
        void refresh(auth.currentUser);
      }
    });

    const offAuth = onAuthStateChanged(auth, (current) => {
      if (!alive) return;
      setUser(current);
      void refresh(current).finally(() => {
        if (alive) setLoading(false);
      });
    });

    return () => {
      alive = false;
      offJuku();
      offAuth();
    };
  }, [refresh]);

  return {
    user,
    loading,
    status,
    adFree,
    refresh: () => refresh(auth.currentUser),
  };
}

/**
 * 管理者ポータル（SugorokuAdminApp）向けの認可状態フック。
 * AI 1 の管理者ポータルや設定画面の入り口からそのまま利用できる。
 */
export function useSugorokuAdminGuard(): {
  user: User | null;
  checking: boolean;
  allowed: boolean;
  reason: AdminAccessDecision['reason'];
  memberDoc: SugorokuMemberDoc | null;
  ownedClassIds: string[];
  recheck: () => Promise<void>;
} {
  const [user, setUser] = useState<User | null>(() => auth.currentUser);
  const [checking, setChecking] = useState<boolean>(true);
  const [decision, setDecision] = useState<{
    allowed: boolean;
    reason: AdminAccessDecision['reason'];
    memberDoc: SugorokuMemberDoc | null;
    ownedClassIds: string[];
  }>({
    allowed: false,
    reason: 'unauthenticated',
    memberDoc: null,
    ownedClassIds: [],
  });

  const recheck = useCallback(async (targetUser?: User | null) => {
    setChecking(true);
    try {
      const res = await checkCurrentUserAdminAccess(targetUser ?? auth.currentUser);
      setDecision(res);
    } finally {
      setChecking(false);
    }
  }, []);

  useEffect(() => {
    let alive = true;
    const offAuth = onAuthStateChanged(auth, (current) => {
      if (!alive) return;
      setUser(current);
      void checkCurrentUserAdminAccess(current).then((res) => {
        if (!alive) return;
        setDecision(res);
        setChecking(false);
      });
    });
    return () => {
      alive = false;
      offAuth();
    };
  }, []);

  return {
    user,
    checking,
    allowed: decision.allowed,
    reason: decision.reason,
    memberDoc: decision.memberDoc,
    ownedClassIds: decision.ownedClassIds,
    recheck: () => recheck(auth.currentUser),
  };
}
