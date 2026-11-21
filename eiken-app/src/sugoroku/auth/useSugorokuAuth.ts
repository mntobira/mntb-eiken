/**
 * ===================================================================
 * すごろく塾 認証・Ad-Free 連動・管理者ロール判定 React フック群
 * ===================================================================
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
  const [mode, setMode] = useState<SugorokuPortalMode>(() => {
    const search = typeof window !== 'undefined' ? window.location.search : '';
    const envPortal = (import.meta.env as Record<string, string | undefined>).VITE_SUGOROKU_PORTAL;
    return resolveSugorokuPortalMode(search, envPortal);
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const onPopState = () => {
      const envPortal = (import.meta.env as Record<string, string | undefined>).VITE_SUGOROKU_PORTAL;
      setMode(resolveSugorokuPortalMode(window.location.search, envPortal));
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  return mode;
}

/**
 * ブラウザのオンライン・オフライン状態を監視する軽量フック（校内 Wi-Fi 瞬断通知用）。
 */
export function useBrowserOnline(): boolean {
  const [online, setOnline] = useState<boolean>(() =>
    typeof navigator !== 'undefined' ? navigator.onLine !== false : true,
  );

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handleOnline = () => setOnline(true);
    const handleOffline = () => setOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return online;
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
    isSuspended: false,
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
export function useSugorokuAdminGuard(options?: {
  /** 指定管理者メール（hirokingz0927@gmail.com / mntobira@gmail.com）以外を厳格に遮断するか（既定: true） */
  strictSpecifiedEmailsOnly?: boolean;
}): {
  user: User | null;
  checking: boolean;
  allowed: boolean;
  reason: AdminAccessDecision['reason'];
  memberDoc: SugorokuMemberDoc | null;
  ownedClassIds: string[];
  recheck: () => Promise<void>;
} {
  const strictSpecifiedEmailsOnly = options?.strictSpecifiedEmailsOnly ?? true;
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
      const res = await checkCurrentUserAdminAccess(targetUser ?? auth.currentUser, {
        strictSpecifiedEmailsOnly,
      });
      setDecision(res);
    } finally {
      setChecking(false);
    }
  }, [strictSpecifiedEmailsOnly]);

  useEffect(() => {
    let alive = true;
    void consumeGoogleRedirectResult().catch(() => undefined);
    const offAuth = onAuthStateChanged(auth, (current) => {
      if (!alive) return;
      setUser(current);
      void checkCurrentUserAdminAccess(current, { strictSpecifiedEmailsOnly }).then((res) => {
        if (!alive) return;
        setDecision(res);
        setChecking(false);
      });
    });
    return () => {
      alive = false;
      offAuth();
    };
  }, [strictSpecifiedEmailsOnly]);

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
