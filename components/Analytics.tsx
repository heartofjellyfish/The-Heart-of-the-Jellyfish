'use client';

/**
 * The one place analytics is switched on. Renders nothing.
 *
 * It sits in the root layout so every route is counted, including /descent and
 * /preview-jelly, which have no instrumentation of their own — a pageview and
 * autocapture is the whole of what we want to know about them.
 *
 * The load is deferred to an idle callback rather than fired on mount. Mount is
 * the same tick as hydration, which on the front page is the tick that has to
 * get the hero painting, the carved title and the countdown on screen; handing
 * it a 250 kB script to fetch and parse as well is how a landing page loses the
 * first second it has. requestIdleCallback means the SDK arrives in the gap
 * after that, and the queue in lib/analytics.ts covers the gap.
 *
 * The 3s timeout is the fallback for Safari, which has only shipped
 * requestIdleCallback recently enough that we cannot assume it, and for a tab
 * that is busy long enough that "idle" never comes.
 */

import { useEffect } from 'react';
import { startAnalytics } from '@/lib/analytics';

export function Analytics() {
  useEffect(() => {
    const idle = window.requestIdleCallback;
    if (idle) {
      const id = idle(() => void startAnalytics(), { timeout: 3000 });
      return () => window.cancelIdleCallback?.(id);
    }
    const t = window.setTimeout(() => void startAnalytics(), 1200);
    return () => window.clearTimeout(t);
  }, []);

  return null;
}
