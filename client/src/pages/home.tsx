import AppHeader from "@/components/AppHeader";
import ContentRepurposer from "@/components/ContentRepurposer";
import OnboardingTour from "@/components/OnboardingTour";
import { useAuth } from "@/context/AuthContext";

export default function Home() {
  const { isLoggedIn } = useAuth();

  return (
    <div className="app-page">
      <AppHeader />

      <main className="section-shell flex-1 py-8 sm:py-10" role="main" aria-label="Content repurposing application">
        <section className="mx-auto max-w-3xl text-center">
          <h1 className="heading-display text-4xl text-slate-950 sm:text-6xl">
            Paste an article.
            <br />
            Get a LinkedIn post.
          </h1>

          <p className="mx-auto mt-4 max-w-2xl text-base font-medium leading-7 text-slate-600 sm:text-lg">
            Drop in source content. We turn it into a clean LinkedIn draft with hook options.
          </p>
        </section>

        <section className="mx-auto mt-6 max-w-3xl">
          <ContentRepurposer />
        </section>
      </main>

      {isLoggedIn && <OnboardingTour />}
    </div>
  );
}
