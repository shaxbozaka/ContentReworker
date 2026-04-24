import { useEffect, useState } from "react";
import { Link } from "wouter";
import AppHeader from "@/components/AppHeader";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/context/AuthContext";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { ArrowRight, BadgeCheck, Check, Crown, Loader2, Sparkles, Zap } from "lucide-react";

declare global {
  interface Window {
    Paddle?: {
      Initialize: (options: Record<string, any>) => void;
      Checkout: {
        open: (options: Record<string, any>) => void;
      };
    };
    __contentReworkerPaddleToken?: string;
  }
}

let paddleScriptPromise: Promise<NonNullable<Window["Paddle"]>> | null = null;

const loadPaddle = async (): Promise<NonNullable<Window["Paddle"]>> => {
  if (window.Paddle) return window.Paddle;

  if (!paddleScriptPromise) {
    paddleScriptPromise = new Promise((resolve, reject) => {
      const existingScript = document.querySelector<HTMLScriptElement>('script[data-paddle-script="true"]');
      if (existingScript) {
        existingScript.addEventListener("load", () => {
          if (window.Paddle) resolve(window.Paddle);
          else reject(new Error("Paddle failed to load"));
        });
        existingScript.addEventListener("error", () => reject(new Error("Failed to load Paddle")));
        return;
      }

      const script = document.createElement("script");
      script.src = "https://cdn.paddle.com/paddle/v2/paddle.js";
      script.async = true;
      script.dataset.paddleScript = "true";
      script.onload = () => {
        if (window.Paddle) resolve(window.Paddle);
        else reject(new Error("Paddle failed to load"));
      };
      script.onerror = () => reject(new Error("Failed to load Paddle"));
      document.body.appendChild(script);
    });
  }

  return paddleScriptPromise;
};

const ensurePaddleInitialized = async (clientToken: string): Promise<NonNullable<Window["Paddle"]>> => {
  const Paddle = await loadPaddle();

  if (!window.__contentReworkerPaddleToken) {
    Paddle.Initialize({ token: clientToken });
    window.__contentReworkerPaddleToken = clientToken;
  } else if (window.__contentReworkerPaddleToken !== clientToken) {
    throw new Error("Paddle is already initialized with a different client token");
  }

  return Paddle;
};

const getPlans = (isAnnual: boolean) => [
  {
    name: "Free",
    price: "$0",
    period: "forever",
    description: "Try the core LinkedIn generator.",
    features: [
      "3 LinkedIn posts per day",
      "3 hook variations per post",
      "Gemini-powered generation",
      "Copy-ready LinkedIn formatting",
    ],
    cta: "Current Plan",
    highlighted: false,
    icon: Zap,
  },
  {
    name: "Pro",
    price: isAnnual ? "$15" : "$19",
    period: "/month",
    yearlyTotal: isAnnual ? "Billed $180/year" : "Billed monthly",
    savings: isAnnual ? "Save $48/year" : null,
    description: "For creators who publish consistently.",
    features: [
      "Unlimited LinkedIn posts",
      "Scheduled LinkedIn posts",
      "Content pipelines",
      "AI image generation",
      "Priority support",
    ],
    cta: isAnnual ? "Start Pro Annual" : "Start Pro",
    highlighted: true,
    icon: Crown,
    priceId: isAnnual
      ? "pri_01kpxjy05hbs20rebcqm36tmf0"
      : "pri_01kpxjxy2dypqxt85ra4fre25w",
  },
];

export default function PricingPage() {
  const { isLoggedIn, loginWithGoogle, user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState<string | null>(null);
  const [isAnnual, setIsAnnual] = useState(true);
  const isPro = user?.plan === "pro";
  const plans = getPlans(isAnnual);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  const handleUpgrade = async (priceId: string) => {
    if (!isLoggedIn) {
      toast({
        title: "Sign in required",
        description: "Please sign in to upgrade to Pro.",
      });
      loginWithGoogle();
      return;
    }

    setLoading(priceId);
    try {
      const response = await apiRequest<{ transactionId: string; clientToken: string }>("/api/billing/checkout", {
        method: "POST",
        body: JSON.stringify({ priceId }),
        headers: { "Content-Type": "application/json" },
      });

      const Paddle = await ensurePaddleInitialized(response.clientToken);
      Paddle.Checkout.open({
        transactionId: response.transactionId,
        settings: {
          displayMode: "overlay",
          variant: "one-page",
          theme: "light",
          successUrl: `${window.location.origin}/accounts?upgraded=true`,
        },
      });
    } catch (error: any) {
      if (error.message?.includes("401")) {
        toast({
          title: "Session expired",
          description: "Please sign in again to continue.",
          variant: "destructive",
        });
        return;
      }
      toast({
        title: "Error",
        description: "Failed to start checkout. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="app-page">
      <AppHeader />

      <main className="section-shell flex-1 py-10 sm:py-14">
        <section className="mx-auto max-w-3xl text-center">
          {isPro ? (
            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-bold uppercase tracking-[0.18em] text-emerald-700">
              <BadgeCheck className="h-4 w-4" />
              Pro member
            </div>
          ) : (
            <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-bold uppercase tracking-[0.18em] text-slate-600 shadow-sm">
              <Sparkles className="h-4 w-4 text-[rgb(var(--color-linkedin))]" />
              Simple pricing
            </div>
          )}

          <h1 className="heading-display mt-6 text-5xl text-slate-950 sm:text-6xl">
            Free to try.
            <br />
            Pro when it becomes a habit.
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-base font-medium leading-7 text-slate-600 sm:text-lg">
            Start with the LinkedIn generator. Upgrade for unlimited posts, scheduling, images, and content pipelines.
          </p>

          {!isPro && (
            <div className="mt-7 inline-flex rounded-lg border border-slate-200 bg-white p-1 shadow-sm">
              <button
                onClick={() => setIsAnnual(false)}
                className={`rounded-md px-4 py-2 text-sm font-bold transition ${
                  !isAnnual ? "bg-slate-950 text-white" : "text-slate-600 hover:text-slate-950"
                }`}
              >
                Monthly
              </button>
              <button
                onClick={() => setIsAnnual(true)}
                className={`rounded-md px-4 py-2 text-sm font-bold transition ${
                  isAnnual ? "bg-slate-950 text-white" : "text-slate-600 hover:text-slate-950"
                }`}
              >
                Annual · Save 20%
              </button>
            </div>
          )}
        </section>

        <section className="mx-auto mt-10 grid max-w-5xl gap-4 md:grid-cols-2">
          {plans.map((plan) => {
            const Icon = plan.icon;
            return (
              <article
                key={plan.name}
                className={`rounded-lg border p-6 shadow-sm ${
                  plan.highlighted
                    ? "border-slate-950 bg-slate-950 text-white"
                    : "border-slate-200 bg-white text-slate-950"
                }`}
              >
                <div className="mb-6 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className={`grid h-10 w-10 place-items-center rounded-lg ${
                      plan.highlighted ? "bg-lime-300 text-slate-950" : "bg-slate-100 text-slate-700"
                    }`}>
                      <Icon className="h-5 w-5" />
                    </div>
                    <div>
                      <h2 className="text-xl font-black">{plan.name}</h2>
                      <p className={`text-sm font-medium ${plan.highlighted ? "text-white/60" : "text-slate-500"}`}>
                        {plan.description}
                      </p>
                    </div>
                  </div>
                  {plan.savings && (
                    <span className="rounded-full bg-lime-300 px-3 py-1 text-xs font-black text-slate-950">
                      {plan.savings}
                    </span>
                  )}
                </div>

                <div className="mb-6">
                  <span className="text-5xl font-black tracking-tight">{plan.price}</span>
                  <span className={`ml-1 text-base font-bold ${plan.highlighted ? "text-white/60" : "text-slate-500"}`}>
                    {plan.period}
                  </span>
                  {plan.yearlyTotal && (
                    <p className={`mt-1 text-sm font-semibold ${plan.highlighted ? "text-white/50" : "text-slate-500"}`}>
                      {plan.yearlyTotal}
                    </p>
                  )}
                </div>

                {plan.priceId ? (
                  isPro ? (
                    <Button className="mb-6 h-12 w-full cursor-default bg-emerald-100 font-bold text-emerald-700 hover:bg-emerald-100" disabled>
                      <BadgeCheck className="mr-2 h-4 w-4" />
                      Your Current Plan
                    </Button>
                  ) : (
                    <Button
                      onClick={() => handleUpgrade(plan.priceId!)}
                      disabled={loading === plan.priceId}
                      className="mb-6 h-12 w-full bg-white font-black text-slate-950 hover:bg-lime-300"
                    >
                      {loading === plan.priceId && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      {plan.cta}
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                  )
                ) : (
                  <div className={`mb-6 flex h-12 items-center justify-center rounded-lg border text-sm font-bold ${
                    plan.highlighted ? "border-white/10 text-white/60" : "border-slate-200 text-slate-500"
                  }`}>
                    {isPro ? "Included before upgrade" : "Current plan"}
                  </div>
                )}

                <div className="space-y-3">
                  {plan.features.map((feature) => (
                    <div key={feature} className="flex items-start gap-3">
                      <Check className={`mt-0.5 h-4 w-4 flex-shrink-0 ${
                        plan.highlighted ? "text-lime-300" : "text-emerald-500"
                      }`} />
                      <span className={`text-sm font-semibold ${plan.highlighted ? "text-white/80" : "text-slate-700"}`}>
                        {feature}
                      </span>
                    </div>
                  ))}
                </div>
              </article>
            );
          })}
        </section>

        <section className="mx-auto mt-10 max-w-3xl rounded-lg border border-slate-200 bg-white p-6 text-center shadow-sm">
          <h2 className="text-2xl font-black text-slate-950">Not sure yet?</h2>
          <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-slate-600">
            Use the free generator first. You only need Pro when you want unlimited publishing workflow tools.
          </p>
          <Link href="/">
            <Button className="mt-5 bg-[rgb(var(--color-linkedin))] font-bold text-white hover:bg-[rgb(var(--color-linkedin-dark))]">
              Try the generator
            </Button>
          </Link>
        </section>
      </main>

      <Footer />
    </div>
  );
}
