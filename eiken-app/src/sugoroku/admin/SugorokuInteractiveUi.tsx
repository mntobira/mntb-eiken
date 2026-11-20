/**
 * すごろく塾 管理者ポータル：インタラクティブUX＆インフォグラフィック部品（エッセンシャル設計）
 * 配色は単色濃淡（--mt-brand 系のトーン）に統一し、余計な装飾色・説明文を排除。
 */

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
  type TouchEvent as ReactTouchEvent,
} from 'react';
import { Check, RefreshCw, AlertTriangle, X } from 'lucide-react';
import { SecondaryButton } from '../../components/ui';

// ===================================================================
// 1. Toast
// ===================================================================

export type ToastTone = 'default' | 'done' | 'warn';

export interface PortalToastState {
  id: number;
  message: string;
  tone: ToastTone;
}

export function usePortalToast() {
  const [toast, setToast] = useState<PortalToastState | null>(null);
  const timerRef = useRef<number | undefined>(undefined);

  const showToast = useCallback((message: string, tone: ToastTone = 'default') => {
    window.clearTimeout(timerRef.current);
    const id = Date.now() + Math.random();
    setToast({ id, message, tone });
    timerRef.current = window.setTimeout(() => setToast(null), 2600);
  }, []);

  const dismissToast = useCallback(() => {
    window.clearTimeout(timerRef.current);
    setToast(null);
  }, []);

  useEffect(() => () => window.clearTimeout(timerRef.current), []);

  return { toast, showToast, dismissToast };
}

export function SugorokuToast({
  toast,
  onDismiss,
}: {
  toast: PortalToastState | null;
  onDismiss: () => void;
}) {
  if (!toast) return null;
  return (
    <div
      key={toast.id}
      role="status"
      aria-live="polite"
      data-sugoroku-toast={toast.tone}
      className="mt-toast sg-toast"
      onClick={onDismiss}
    >
      {toast.tone === 'warn' ? (
        <AlertTriangle size={15} aria-hidden="true" />
      ) : (
        <Check size={15} aria-hidden="true" />
      )}
      <span>{toast.message}</span>
    </div>
  );
}

// ===================================================================
// 2. Pull to Refresh
// ===================================================================

const PTR_THRESHOLD = 64;
const PTR_MAX = 104;

export function PullToRefreshHost({
  onRefresh,
  refreshing,
  children,
}: {
  onRefresh: () => Promise<void> | void;
  refreshing: boolean;
  children: ReactNode;
}) {
  const [pullPx, setPullPx] = useState(0);
  const [dragging, setDragging] = useState(false);
  const startYRef = useRef<number | null>(null);

  const onTouchStart = (e: ReactTouchEvent<HTMLDivElement>) => {
    if (refreshing) return;
    const scroller = document.scrollingElement || document.documentElement;
    if (scroller && scroller.scrollTop > 4) {
      startYRef.current = null;
      return;
    }
    startYRef.current = e.touches[0]?.clientY ?? null;
  };

  const onTouchMove = (e: ReactTouchEvent<HTMLDivElement>) => {
    if (startYRef.current === null || refreshing) return;
    const curY = e.touches[0]?.clientY ?? startYRef.current;
    const dy = curY - startYRef.current;
    if (dy <= 6) {
      if (pullPx > 0) setPullPx(0);
      return;
    }
    setDragging(true);
    setPullPx(Math.min(PTR_MAX, Math.round(Math.pow(dy, 0.82) * 1.5)));
  };

  const finishPull = async () => {
    if (startYRef.current === null) return;
    startYRef.current = null;
    setDragging(false);
    const shouldTrigger = pullPx >= PTR_THRESHOLD && !refreshing;
    setPullPx(0);
    if (shouldTrigger) {
      await onRefresh();
    }
  };

  const indicatorHeight = refreshing ? 48 : pullPx;
  const ready = pullPx >= PTR_THRESHOLD;
  const deg = Math.min(240, Math.round((pullPx / PTR_THRESHOLD) * 180));

  return (
    <div
      className="sg-ptr-host"
      data-ptr-host
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={() => void finishPull()}
      onTouchCancel={() => {
        startYRef.current = null;
        setDragging(false);
        setPullPx(0);
      }}
    >
      <div
        className="sg-ptr-indicator"
        data-dragging={dragging ? 'true' : undefined}
        style={{ height: indicatorHeight }}
        aria-hidden={indicatorHeight === 0 && !refreshing}
      >
        {(indicatorHeight > 12 || refreshing) && (
          <span
            className="sg-ptr-pill"
            data-ready={ready ? 'true' : undefined}
            data-refreshing={refreshing ? 'true' : undefined}
          >
            <RefreshCw
              className="sg-ptr-wheel"
              style={!refreshing ? { transform: `rotate(${deg}deg)` } : undefined}
              aria-hidden="true"
            />
            <span>{refreshing ? '同期中' : ready ? '離して更新' : '引っ張って更新'}</span>
          </span>
        )}
      </div>
      {children}
    </div>
  );
}

// ===================================================================
// 3. Skeleton Screen
// ===================================================================

export function PortalSkeletonScreen({
  rows = 4,
  label = '読み込み中',
}: {
  rows?: number;
  label?: string;
}) {
  return (
    <div className="sg-skeleton-wrap" role="status" aria-label={label} data-sugoroku-skeleton>
      <div className="sg-skel-card" aria-hidden="true">
        <i className="sg-skel-bar" data-size="lg" style={{ width: '48%' }} />
        <i className="sg-skel-bar" style={{ width: '72%' }} />
      </div>

      {Array.from({ length: rows }, (_, i) => (
        <div
          key={i}
          className="sg-skel-card"
          aria-hidden="true"
          style={{ display: 'flex', alignItems: 'center', gap: 12 }}
        >
          <div style={{ flex: 1, display: 'grid', gap: 8 }}>
            <i className="sg-skel-bar" style={{ width: `${46 - (i % 3) * 6}%` }} />
            <i className="sg-skel-bar" style={{ width: `${68 - (i % 2) * 12}%` }} />
          </div>
          <i className="sg-skel-circle" />
        </div>
      ))}
    </div>
  );
}

// ===================================================================
// 4. Bottom Sheet
// ===================================================================

export function SugorokuBottomSheet({
  open,
  title,
  kicker,
  onClose,
  children,
}: {
  open: boolean;
  title: string;
  kicker?: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const [dragY, setDragY] = useState(0);
  const [dragging, setDragging] = useState(false);
  const startYRef = useRef<number | null>(null);

  useEffect(() => {
    if (!open) {
      setDragY(0);
      setDragging(false);
      return;
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  const onGrabStart = (e: ReactPointerEvent<HTMLDivElement>) => {
    e.currentTarget.setPointerCapture?.(e.pointerId);
    startYRef.current = e.clientY;
    setDragging(true);
  };

  const onGrabMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (startYRef.current === null) return;
    setDragY(Math.max(0, e.clientY - startYRef.current));
  };

  const onGrabEnd = () => {
    if (startYRef.current === null) return;
    startYRef.current = null;
    setDragging(false);
    if (dragY > 88) {
      setDragY(0);
      onClose();
    } else {
      setDragY(0);
    }
  };

  return (
    <div
      className="sg-sheet-backdrop"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      data-sugoroku-bottom-sheet
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="sg-sheet-panel"
        data-dragging={dragging ? 'true' : undefined}
        style={dragY > 0 ? ({ translate: `0 ${dragY}px` } as CSSProperties) : undefined}
      >
        <div
          className="sg-sheet-grabber"
          aria-hidden="true"
          onPointerDown={onGrabStart}
          onPointerMove={onGrabMove}
          onPointerUp={onGrabEnd}
          onPointerCancel={onGrabEnd}
        >
          <i />
        </div>
        <header className="sg-sheet-head">
          <div style={{ minWidth: 0 }}>
            {kicker && <span className="mt-kicker">{kicker}</span>}
            <h3>{title}</h3>
          </div>
          <SecondaryButton onClick={onClose} icon={<X size={15} aria-hidden="true" />}>
            閉じる
          </SecondaryButton>
        </header>
        <div className="sg-sheet-body">{children}</div>
      </div>
    </div>
  );
}

// ===================================================================
// 5. Swipe Action
// ===================================================================

const SWIPE_SNAP_LEFT = -152;
const SWIPE_SNAP_RIGHT = 90;

export interface SwipeActionButtonDef {
  id: string;
  label: string;
  icon: ReactNode;
  onTrigger: () => void;
}

export function SwipeableRow({
  leftAction,
  rightActions,
  children,
}: {
  leftAction?: SwipeActionButtonDef;
  rightActions: SwipeActionButtonDef[];
  children: ReactNode;
}) {
  const [offsetX, setOffsetX] = useState(0);
  const [swiping, setSwiping] = useState(false);
  const startRef = useRef<{ x: number; y: number; base: number; locked: 'x' | 'y' | null } | null>(
    null,
  );

  const onTouchStart = (e: ReactTouchEvent<HTMLDivElement>) => {
    const t = e.touches[0];
    if (!t) return;
    startRef.current = { x: t.clientX, y: t.clientY, base: offsetX, locked: null };
  };

  const onTouchMove = (e: ReactTouchEvent<HTMLDivElement>) => {
    const st = startRef.current;
    const t = e.touches[0];
    if (!st || !t) return;
    const dx = t.clientX - st.x;
    const dy = t.clientY - st.y;
    if (!st.locked) {
      if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return;
      st.locked = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y';
    }
    if (st.locked !== 'x') return;
    setSwiping(true);
    const minX = rightActions.length > 0 ? -176 : 0;
    const maxX = leftAction ? 110 : 0;
    setOffsetX(Math.max(minX, Math.min(maxX, st.base + dx)));
  };

  const onTouchEnd = () => {
    const st = startRef.current;
    startRef.current = null;
    setSwiping(false);
    if (!st || st.locked !== 'x') return;
    if (offsetX < -60 && rightActions.length > 0) {
      setOffsetX(SWIPE_SNAP_LEFT);
    } else if (offsetX > 48 && leftAction) {
      setOffsetX(SWIPE_SNAP_RIGHT);
    } else {
      setOffsetX(0);
    }
  };

  const openState = offsetX <= -36 ? 'left' : offsetX >= 36 ? 'right' : undefined;

  return (
    <li className="sg-swipe-shell" data-swipe-row data-swipe-open={openState}>
      <div className="sg-swipe-tray" data-open={openState} aria-hidden={!openState}>
        {leftAction && (
          <div className="sg-swipe-side sg-swipe-side-left">
            <button
              type="button"
              tabIndex={openState === 'right' ? 0 : -1}
              className="sg-swipe-btn"
              onClick={() => {
                setOffsetX(0);
                leftAction.onTrigger();
              }}
            >
              {leftAction.icon}
              <span>{leftAction.label}</span>
            </button>
          </div>
        )}
        {rightActions.length > 0 && (
          <div className="sg-swipe-side sg-swipe-side-right">
            {rightActions.map((act) => (
              <button
                key={act.id}
                type="button"
                tabIndex={openState === 'left' ? 0 : -1}
                className="sg-swipe-btn"
                onClick={() => {
                  setOffsetX(0);
                  act.onTrigger();
                }}
              >
                {act.icon}
                <span>{act.label}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      <div
        className="sg-swipe-front"
        data-swiping={swiping ? 'true' : undefined}
        style={offsetX !== 0 ? ({ translate: `${offsetX}px 0` } as CSSProperties) : undefined}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onTouchCancel={() => {
          startRef.current = null;
          setSwiping(false);
          setOffsetX(0);
        }}
        onClick={() => {
          if (offsetX !== 0) setOffsetX(0);
        }}
      >
        {children}
      </div>
    </li>
  );
}

// ===================================================================
// 6. Infographic（単色濃淡で落ち着いたインフォグラフィック）
// ===================================================================

export function StudyDoorsWeek({
  recentDailyLogs,
}: {
  recentDailyLogs: ReadonlyArray<{ dateKey: string; totalActiveSeconds: number }>;
}) {
  const last7 = recentDailyLogs.slice(-7);
  const openCount = last7.filter((d) => d.totalActiveSeconds > 0).length;
  return (
    <span
      className="study-doors sg-doors"
      title={`直近7日で${openCount}日学習`}
      aria-label={`直近7日で${openCount}日学習`}
    >
      {last7.map((d) => (
        <i
          key={d.dateKey}
          data-open={d.totalActiveSeconds > 0 ? '' : undefined}
          aria-hidden="true"
        />
      ))}
    </span>
  );
}

/** 虹色を避け、マナトビの紺〜ブルーグレーの単色濃淡に統一 */
const SKILL_SHADES: Record<string, string> = {
  listening: '#2458a6',
  reading: '#4973b3',
  vocab: '#6f8fc0',
  writing: '#95abcd',
  speaking: '#b5c5dd',
};

export function SkillColorOf(skill: string): string {
  return SKILL_SHADES[skill] || '#4973b3';
}

export function SkillRatioStackBar({
  items,
}: {
  items: ReadonlyArray<{ key: string; skill: string; label: string; seconds: number }>;
}) {
  const active = items.filter((it) => it.seconds > 0);
  const total = active.reduce((s, it) => s + it.seconds, 0);
  if (total <= 0) return null;

  return (
    <div className="sg-stack-bar" role="img" aria-label="分野比率">
      {active.map((it) => {
        const pct = Math.max(4, Math.round((it.seconds / total) * 100));
        return (
          <span
            key={it.key}
            className="sg-stack-seg"
            style={{
              width: `${pct}%`,
              backgroundColor: SkillColorOf(it.skill),
            }}
            title={`${it.label} ${pct}%`}
          />
        );
      })}
    </div>
  );
}
