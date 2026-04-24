// Umami analytics event tracking
// https://umami.is/docs/track-events

declare global {
  interface Window {
    umami?: {
      track: (eventName: string, eventData?: Record<string, string | number | boolean>) => void;
    };
  }
}

export const trackEvent = (
  eventName: string,
  eventData?: Record<string, string | number | boolean>
) => {
  try {
    if (typeof window !== 'undefined' && window.umami) {
      window.umami.track(eventName, eventData);
    }
  } catch (e) {
    // Silently fail - analytics should never break the app
  }
};

// Pre-defined events for consistency
export const analytics = {
  // Content generation
  contentGenerated: (platform: string, hookCount: number) =>
    trackEvent('content_generated', { platform, hook_count: hookCount }),

  // Hook interactions
  hookSelected: (hookIndex: number, hookType: string) =>
    trackEvent('hook_selected', { hook_index: hookIndex, hook_type: hookType }),

  hookFeedback: (hookIndex: number, feedback: 'up' | 'down') =>
    trackEvent('hook_feedback', { hook_index: hookIndex, feedback }),

  // Content actions
  contentCopied: (platform: string) =>
    trackEvent('content_copied', { platform }),

  contentPosted: (platform: string) =>
    trackEvent('content_posted', { platform }),

  // Auth events
  signedIn: (method: 'google' | 'linkedin' | 'email') =>
    trackEvent('signed_in', { method }),

  signedUp: (method: 'google' | 'linkedin' | 'email') =>
    trackEvent('signed_up', { method }),

  // Upgrade events
  upgradeClicked: (source: string) =>
    trackEvent('upgrade_clicked', { source }),

  checkoutStarted: (plan: string, interval: 'monthly' | 'annual') =>
    trackEvent('checkout_started', { plan, interval }),

  // Feature usage
  featureUsed: (feature: string) =>
    trackEvent('feature_used', { feature }),
};
