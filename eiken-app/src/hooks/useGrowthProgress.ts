import { useEffect, useState } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '../firebase';
import { cachedGrowth, subscribeGrowth } from '../battle/data/growthStore';
import type { GrowthProgress } from '../battle/core/growth';

/** One wallet, scoped to the current account. Never display an old account while loading. */
export function useGrowthProgress() {
  const [state, setState] = useState<{ uid: string; progress: GrowthProgress | null }>(() => ({
    uid: auth.currentUser?.uid || 'guest', progress: cachedGrowth(),
  }));
  useEffect(() => {
    let unsubscribe = () => {};
    const refresh = () => {
      unsubscribe();
      const uid = auth.currentUser?.uid || 'guest';
      setState({ uid, progress: cachedGrowth() });
      unsubscribe = subscribeGrowth(progress => setState({ uid, progress }));
    };
    refresh();
    const off = onAuthStateChanged(auth, refresh);
    return () => { off(); unsubscribe(); };
  }, []);
  return { uid: state.uid, progress: state.uid === (auth.currentUser?.uid || 'guest') ? state.progress : null };
}
