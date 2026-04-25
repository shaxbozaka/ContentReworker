import { lazy, Suspense } from "react";
import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import Seo from "@/components/Seo";
import { ContentProvider } from "./context/ContentContext";
import { AuthProvider } from "./context/AuthContext";

// Home loaded eagerly — it is the most-hit landing page and lazy-loading it
// would just add a flash of the suspense fallback for first-time visitors.
import Home from "@/pages/home";

// Every other route lazy-loads as its own chunk; Vite emits one bundle per
// dynamic import so first paint only ships what the landing page needs.
const NotFound = lazy(() => import("@/pages/not-found"));
const TrendingPage = lazy(() => import("@/pages/trending"));
const PrivacyPolicy = lazy(() => import("@/pages/privacy-policy"));
const TermsOfService = lazy(() => import("@/pages/terms-of-service"));
const RefundPolicy = lazy(() => import("@/pages/refund-policy"));
const LinkedInApiTester = lazy(() => import("@/pages/linkedin-api-tester"));
const AccountsPage = lazy(() => import("@/pages/accounts"));
const HistoryPage = lazy(() => import("@/pages/history"));
const PricingPage = lazy(() => import("@/pages/pricing"));
const GeneratePage = lazy(() => import("@/pages/generate"));
const CreatorsPage = lazy(() => import("@/pages/creators"));
const SchedulePage = lazy(() => import("@/pages/schedule"));
const PipelinesPage = lazy(() => import("@/pages/pipelines"));
const BlogToTwitterPage = lazy(() => import("@/pages/seo/blog-to-twitter"));
const LinkedInPostGeneratorPage = lazy(() => import("@/pages/seo/linkedin-post-generator"));
const YouTubeToBlogPage = lazy(() => import("@/pages/seo/youtube-to-blog"));

function Router() {
  return (
    <Suspense fallback={null}>
      <Switch>
        <Route path="/" component={Home} />
        <Route path="/trending" component={TrendingPage} />
        <Route path="/privacy-policy" component={PrivacyPolicy} />
        <Route path="/terms-of-service" component={TermsOfService} />
        <Route path="/refund-policy" component={RefundPolicy} />
        <Route path="/linkedin-api-tester" component={LinkedInApiTester} />
        <Route path="/accounts" component={AccountsPage} />
        <Route path="/history" component={HistoryPage} />
        <Route path="/pricing" component={PricingPage} />
        <Route path="/generate" component={GeneratePage} />
        <Route path="/creators" component={CreatorsPage} />
        <Route path="/schedule" component={SchedulePage} />
        <Route path="/pipelines" component={PipelinesPage} />
        <Route path="/blog-to-twitter" component={BlogToTwitterPage} />
        <Route path="/linkedin-post-generator" component={LinkedInPostGeneratorPage} />
        <Route path="/youtube-to-social" component={YouTubeToBlogPage} />
        <Route component={NotFound} />
      </Switch>
    </Suspense>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <ContentProvider>
          <Seo />
          <Router />
          <Toaster />
        </ContentProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
