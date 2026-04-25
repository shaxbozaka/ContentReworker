import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useContent } from '@/context/ContentContext';
import { apiRequest } from '@/lib/queryClient';
import { Sparkles, X, ArrowRight, Clock, Linkedin } from 'lucide-react';

// Three example hooks aligned with the new value-led archetypes from the
// generation prompt: SPECIFIC DETAIL, IN MEDIA RES, PLAIN OBSERVATION. They
// reference the example source ("The Future of Remote Work") so the user can
// see the same input → these outputs mapping when they later paste their own.
const EXAMPLE_HOOKS = [
  { text: 'We cut our office footprint by 41% — and shipped faster.', delay: '0.9s', border: '#0077b5' },
  { text: 'Three weeks before the all-hands, half the team had quit.',     delay: '1.1s', border: '#0099dd' },
  { text: 'Remote work hasn\'t changed productivity. It changed visibility.', delay: '1.3s', border: '#33aaee' },
];

export default function OnboardingTour() {
  const { user, isLoggedIn, updateUser } = useAuth();
  const { showSampleOutput } = useContent();
  const [showWelcome, setShowWelcome] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    // Show welcome for logged-in users who haven't seen onboarding
    if (isLoggedIn && user && !user.hasSeenOnboarding) {
      // Small delay for smoother UX
      const timeout = setTimeout(() => setShowWelcome(true), 500);
      return () => clearTimeout(timeout);
    }
  }, [isLoggedIn, user]);

  // Mark onboarding as complete on the server AND patch local user state so
  // the modal doesn't pop again on the next route change. (Previously only
  // the DB was updated and the React user object stayed stale → modal kept
  // re-opening every time the OnboardingTour re-mounted.)
  const markComplete = async () => {
    updateUser({ hasSeenOnboarding: true });
    try {
      await apiRequest('/api/users/onboarding-complete', { method: 'POST' });
    } catch {
      // Silent — local state already updated; server will sync on next load.
    }
  };

  const handleTryDemo = async () => {
    setIsLoading(true);
    showSampleOutput();
    await markComplete();
    setShowWelcome(false);
    setIsLoading(false);
  };

  const handleDismiss = () => {
    setShowWelcome(false);
    void markComplete();
  };

  if (!showWelcome) return null;

  const firstName = user?.name?.split(' ')[0]?.trim();
  const greeting = firstName ? `Welcome, ${firstName}!` : 'Welcome!';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="relative max-w-md w-full bg-gradient-to-br from-[#1f1f1f] to-[#171717] rounded-2xl border border-white/10 shadow-2xl overflow-hidden">
        {/* Glow effects */}
        <div className="absolute -top-20 -right-20 w-48 h-48 bg-[#0077b5]/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-20 -left-20 w-40 h-40 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

        {/* Close button */}
        <button
          onClick={handleDismiss}
          className="absolute top-4 right-4 z-20 p-2 text-white/40 hover:text-white/70 transition-colors"
          aria-label="Close onboarding"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="relative z-10 p-6 pt-8">
          <h2 className="text-lg font-semibold text-[#faf7f2] mb-4 text-center">
            {greeting}
          </h2>

          {/* Transformation illustration */}
          <div
            className="relative rounded-xl bg-white/[0.02] border border-white/5 p-4 mb-5"
            style={{
              backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.03) 1px, transparent 1px)',
              backgroundSize: '20px 20px',
            }}
          >
            {/* Speed badge — set conservative; real generation is ~10-15s. */}
            <div className="absolute -top-2.5 right-3 flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-[11px] text-amber-400 font-medium">
              <Clock className="w-3 h-3" />
              ~15s
            </div>

            {/* Input: source content card */}
            <div className="animate-fade-in">
              <div className="text-[10px] uppercase tracking-wider text-[#faf7f2]/30 mb-1.5 font-medium">Any source: blog, transcript, draft</div>
              <div className="bg-white/5 rounded-lg border border-white/10 p-3">
                <div className="text-xs font-semibold text-[#faf7f2]/70 mb-2">The Future of Remote Work</div>
                <div className="space-y-1.5">
                  <div className="h-1.5 bg-[#faf7f2]/10 rounded-full w-full" />
                  <div className="h-1.5 bg-[#faf7f2]/10 rounded-full w-11/12" />
                  <div className="h-1.5 bg-[#faf7f2]/8 rounded-full w-4/5" />
                </div>
              </div>
            </div>

            {/* Connector */}
            <div className="flex flex-col items-center py-3 gap-1">
              <div className="w-1 h-1 rounded-full bg-[#0077b5]/40 animate-pulse" style={{ animationDelay: '0ms' }} />
              <div className="w-1 h-1 rounded-full bg-[#0077b5]/60 animate-pulse" style={{ animationDelay: '150ms' }} />
              <div className="relative flex items-center gap-2 my-0.5">
                <Sparkles
                  className="w-4 h-4 text-[#0077b5] animate-pulse"
                  style={{ filter: 'drop-shadow(0 0 8px rgba(0,119,181,0.5))' }}
                />
                <span className="text-[10px] text-[#0077b5]/60 font-medium">We rework it</span>
              </div>
              <div className="w-1 h-1 rounded-full bg-[#0077b5]/60 animate-pulse" style={{ animationDelay: '300ms' }} />
              <div className="w-1 h-1 rounded-full bg-[#0077b5]/40 animate-pulse" style={{ animationDelay: '450ms' }} />
            </div>

            {/* Output: 3 hook cards */}
            <div>
              <div className="text-[10px] uppercase tracking-wider text-[#0077b5]/60 mb-1.5 font-medium">3 ways to open</div>
              <div className="space-y-1.5">
                {EXAMPLE_HOOKS.map((hook, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between bg-white/5 rounded-lg border border-white/10 p-2.5 animate-fade-in-up"
                    style={{
                      animationDelay: hook.delay,
                      borderLeftWidth: '2px',
                      borderLeftColor: hook.border,
                    }}
                  >
                    <span className="text-xs text-[#faf7f2]/70">{hook.text}</span>
                    <Linkedin className="w-3.5 h-3.5 text-[#0077b5]/20 flex-shrink-0 ml-2" />
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* CTA Button */}
          <button
            onClick={handleTryDemo}
            disabled={isLoading}
            className="w-full py-3.5 px-6 rounded-xl font-semibold text-white bg-gradient-to-r from-[#0077b5] to-[#005885] hover:from-[#0088cc] hover:to-[#006699] transition-all duration-200 flex items-center justify-center gap-2 shadow-lg shadow-[#0077b5]/20 disabled:opacity-60 animate-fade-in-up"
            style={{ animationDelay: '1.5s' }}
          >
            {isLoading ? (
              'Loading...'
            ) : (
              <>
                Try an example
                <ArrowRight className="w-5 h-5" />
              </>
            )}
          </button>

          {/* Skip link */}
          <button
            onClick={handleDismiss}
            className="w-full mt-3 text-sm text-[#faf7f2]/40 hover:text-[#faf7f2]/60 transition-colors animate-fade-in-up"
            style={{ animationDelay: '1.6s' }}
          >
            Skip — I'll paste my own
          </button>
        </div>
      </div>
    </div>
  );
}
