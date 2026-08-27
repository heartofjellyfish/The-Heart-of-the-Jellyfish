'use client';

/**
 * The one place analytics is switched on. Renders nothing.
 *
 * Two tags, one callback: PostHog (what people did — lib/analytics.ts) and
 * Quantcast Measure (who they are — lib/quantcast.ts). Both are third-party
 * script loads with no bearing on the first paint, so they share one deferral
 * rather than each inventing their own.
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
import { startQuantcast } from '@/lib/quantcast';

export function Analytics() {
  useEffect(() => {
    const start = () => {
      void startAnalytics();
      startQuantcast();
    };
    const idle = window.requestIdleCallback;
    if (idle) {
      const id = idle(start, { timeout: 3000 });
      return () => window.cancelIdleCallback?.(id);
    }
    const t = window.setTimeout(start, 1200);
    return () => window.clearTimeout(t);
  }, []);

  return null;
}
