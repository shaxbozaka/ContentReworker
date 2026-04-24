import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import NotFound from "@/pages/not-found";
import Home from "@/pages/home";
import TrendingPage from "@/pages/trending";
import PrivacyPolicy from "@/pages/privacy-policy";
import TermsOfService from "@/pages/terms-of-service";
import RefundPolicy from "@/pages/refund-policy";
import LinkedInApiTester from "@/pages/linkedin-api-tester";
import AccountsPage from "@/pages/accounts";
import HistoryPage from "@/pages/history";
import PricingPage from "@/pages/pricing";
import GeneratePage from "@/pages/generate";
import CreatorsPage from "@/pages/creators";
import SchedulePage from "@/pages/schedule";
import PipelinesPage from "@/pages/pipelines";
import BlogToTwitterPage from "@/pages/seo/blog-to-twitter";
import LinkedInPostGeneratorPage from "@/pages/seo/linkedin-post-generator";
import YouTubeToBlogPage from "@/pages/seo/youtube-to-blog";
import { ContentProvider } from "./context/ContentContext";
import { AuthProvider } from "./context/AuthContext";

function Router() {
  return (
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
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <ContentProvider>
          <Router />
          <Toaster />
        </ContentProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
