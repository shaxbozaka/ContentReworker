import { useState, useEffect } from "react";
import { useLocation, Link } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import AppHeader from "@/components/AppHeader";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import {
  User,
  Link as LinkIcon,
  LogOut,
  Trash2,
  Check,
  AlertCircle,
  Clock,
  Sparkles,
} from "lucide-react";
import { FaLinkedin, FaXTwitter, FaInstagram } from "react-icons/fa6";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface LinkedInProfile {
  id: string;
  firstName: string;
  lastName: string;
}

interface SocialConnection {
  id: number;
  userId: number;
  provider: string;
  profileData: LinkedInProfile;
  tokenExpiresAt: string;
}

interface ConnectionsResponse {
  connections: SocialConnection[];
}

export default function AccountsPage() {
  const [, navigate] = useLocation();
  const { user, isLoggedIn, isLoading: isAuthLoading, logout } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showDisconnectDialog, setShowDisconnectDialog] = useState(false);
  const [connectionToDelete, setConnectionToDelete] = useState<number | null>(null);

  // Parse URL query parameters for OAuth callbacks
  useEffect(() => {
    const url = new URL(window.location.href);
    const linkedInConnected = url.searchParams.get("linkedInConnected");
    const twitterConnected = url.searchParams.get("twitterConnected");
    const error = url.searchParams.get("error");

    if (linkedInConnected === "true") {
      toast({
        title: "LinkedIn Connected",
        description: "Your LinkedIn account has been successfully connected.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/users", user?.id, "social-connections"] });
    } else if (twitterConnected === "true") {
      toast({
        title: "X Connected",
        description: "Your X account has been successfully connected.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/users", user?.id, "social-connections"] });
    } else if (error) {
      toast({
        title: "Connection Error",
        description: decodeURIComponent(error),
        variant: "destructive",
      });
    }

    // Clean up URL parameters
    if (linkedInConnected || twitterConnected || error) {
      const cleanUrl = new URL(window.location.href);
      cleanUrl.searchParams.delete("linkedInConnected");
      cleanUrl.searchParams.delete("twitterConnected");
      cleanUrl.searchParams.delete("error");
      cleanUrl.searchParams.delete("userId");
      window.history.replaceState({}, document.title, cleanUrl.toString());
    }
  }, [toast, queryClient, user?.id]);

  // Get social connections for the logged-in user
  const {
    data: connectionsData,
    isLoading: isLoadingConnections,
  } = useQuery<ConnectionsResponse>({
    queryKey: ["/api/users", user?.id, "social-connections"],
    enabled: !!user?.id,
    queryFn: async () => {
      return apiRequest<ConnectionsResponse>(`/api/users/${user?.id}/social-connections`);
    },
  });

  // Connect to LinkedIn
  const connectLinkedIn = async () => {
    if (!user?.id) return;
    try {
      const response = await apiRequest<{ authUrl?: string; url?: string }>(`/api/social/linkedin/auth`);
      const redirectUrl = response.url || response.authUrl;
      if (redirectUrl) {
        window.location.href = redirectUrl;
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to connect LinkedIn. Please try again.",
        variant: "destructive",
      });
    }
  };

  // Connect to Twitter/X
  const connectTwitter = async () => {
    if (!user?.id) return;
    try {
      const response = await apiRequest<{ authUrl: string; error?: string }>(`/api/auth/twitter`);
      if (response.authUrl) {
        window.location.href = response.authUrl;
      } else if (response.error) {
        toast({
          title: "Error",
          description: response.error,
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to connect X. Please try again.",
        variant: "destructive",
      });
    }
  };

  // Disconnect LinkedIn
  const disconnectLinkedIn = useMutation({
    mutationFn: async (connectionId: number) => {
      return apiRequest(`/api/social-connections/${connectionId}`, { method: "DELETE" });
    },
    onSuccess: () => {
      toast({
        title: "Disconnected",
        description: "LinkedIn account has been disconnected.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/users", user?.id, "social-connections"] });
      setShowDisconnectDialog(false);
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to disconnect LinkedIn.",
        variant: "destructive",
      });
      setShowDisconnectDialog(false);
    },
  });

  // Get LinkedIn connection
  const linkedInConnection = connectionsData?.connections?.find(
    (conn) => conn.provider === "linkedin"
  );

  // Get Twitter connection
  const twitterConnection = connectionsData?.connections?.find(
    (conn) => conn.provider === "twitter"
  );

  // Check if token is expiring soon (within 7 days)
  const isTokenExpiringSoon = linkedInConnection?.tokenExpiresAt
    ? new Date(linkedInConnection.tokenExpiresAt) < new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
    : false;

  // If not logged in and not loading, redirect to home
  if (!isAuthLoading && !isLoggedIn) {
    return (
      <div className="min-h-screen flex flex-col bg-[#0f0f0f]">
        <AppHeader />
        <main className="flex-1 flex items-center justify-center py-16">
          <div className="text-center max-w-md mx-auto px-4">
            <div className="w-20 h-20 bg-blue-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
              <User className="w-10 h-10 text-blue-400" />
            </div>
            <h1 className="text-3xl font-extrabold text-white mb-3 tracking-tight">Sign in required</h1>
            <p className="text-white/70 mb-8 text-lg">
              Sign in with Google to access your account settings.
            </p>
            <Button onClick={() => navigate("/")} className="bg-white text-black hover:bg-white/90 px-8 py-3 text-base font-semibold">
              Go to Home
            </Button>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-[#0f0f0f]">
      <AppHeader />

      <main className="flex-1 py-8">
        <div className="max-w-2xl mx-auto px-4">
          <h1 className="text-3xl font-extrabold text-white mb-8 tracking-tight">Account Settings</h1>

          {/* Profile Section */}
          <section className="bg-white/[0.03] border border-white/10 rounded-xl p-6 mb-6">
            <div className="flex items-center gap-4">
              {user?.avatarUrl ? (
                <img
                  src={user.avatarUrl}
                  alt={user.name || "Profile"}
                  className="w-16 h-16 rounded-full border-2 border-white/10"
                  onError={(e) => { e.currentTarget.style.display = 'none'; e.currentTarget.nextElementSibling?.classList.remove('hidden'); }}
                />
              ) : null}
              <div className={`w-16 h-16 rounded-full bg-blue-600 flex items-center justify-center text-white text-xl font-semibold ${user?.avatarUrl ? 'hidden' : ''}`}>
                {(user?.name || user?.username)?.[0]?.toUpperCase() || "U"}
              </div>
              <div className="flex-1">
                <h2 className="text-lg font-semibold text-white">
                  {user?.name || user?.username || "User"}
                </h2>
                {user?.email && (
                  <p className="text-white/70 text-sm">{user.email}</p>
                )}
                <div className="flex items-center gap-1 mt-1">
                  <div className="w-4 h-4 flex items-center justify-center">
                    <svg viewBox="0 0 24 24" className="w-4 h-4">
                      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                    </svg>
                  </div>
                  <span className="text-xs text-white/40">Signed in with Google</span>
                </div>
              </div>
            </div>
          </section>

          {/* Connected Accounts Section */}
          <section className="bg-white/[0.03] border border-white/10 rounded-xl p-6 mb-6">
            <div className="flex items-center gap-2 mb-1">
              <LinkIcon className="w-5 h-5 text-white/70" />
              <h2 className="text-lg font-semibold text-white">Connected Accounts</h2>
            </div>
            <p className="text-white/70 text-sm mb-5">
              Connect your social accounts for one-click posting
            </p>

            {/* LinkedIn Card */}
            <div
              className={`rounded-xl border p-4 mb-3 ${
                linkedInConnection
                  ? isTokenExpiringSoon
                    ? "border-yellow-500/30 bg-yellow-500/10"
                    : "border-green-500/30 bg-green-500/10"
                  : "border-white/10 bg-white/[0.02]"
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-[#0A66C2] rounded-lg flex items-center justify-center">
                    <FaLinkedin className="text-white w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-white">LinkedIn</span>
                      {linkedInConnection && (
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                            isTokenExpiringSoon
                              ? "bg-yellow-500/20 text-yellow-400"
                              : "bg-green-500/20 text-green-400"
                          }`}
                        >
                          {isTokenExpiringSoon ? (
                            <>
                              <Clock className="w-3 h-3" /> Expires Soon
                            </>
                          ) : (
                            <>
                              <Check className="w-3 h-3" /> Connected
                            </>
                          )}
                        </span>
                      )}
                    </div>
                    {linkedInConnection ? (
                      <p className="text-sm text-white/60">
                        Connected as {linkedInConnection.profileData.firstName}{" "}
                        {linkedInConnection.profileData.lastName}
                      </p>
                    ) : (
                      <p className="text-sm text-white/70">
                        Post directly to LinkedIn from your repurposed content
                      </p>
                    )}
                  </div>
                </div>
                <div>
                  {linkedInConnection ? (
                    isTokenExpiringSoon ? (
                      <Button
                        onClick={connectLinkedIn}
                        size="sm"
                        className="bg-yellow-600 hover:bg-yellow-700 text-white"
                      >
                        Reconnect
                      </Button>
                    ) : (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setConnectionToDelete(linkedInConnection.id);
                          setShowDisconnectDialog(true);
                        }}
                        className="text-white/70 hover:text-red-400 hover:bg-red-500/10"
                      >
                        Disconnect
                      </Button>
                    )
                  ) : (
                    <Button
                      onClick={connectLinkedIn}
                      size="sm"
                      className="bg-[#0A66C2] hover:bg-[#004182] text-white"
                    >
                      Connect
                    </Button>
                  )}
                </div>
              </div>
            </div>

            {/* Twitter/X Connection */}
            <div className={`rounded-xl border p-4 mb-3 ${twitterConnection ? 'border-white/10 bg-white/[0.02]' : 'border-white/10 bg-white/[0.02]'}`}>
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${twitterConnection ? 'bg-white' : 'bg-white/10'}`}>
                    <FaXTwitter className={`w-5 h-5 ${twitterConnection ? 'text-black' : 'text-white/60'}`} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-white">Twitter / X</span>
                      {twitterConnection && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-500/20 text-green-400">
                          <Check className="w-3 h-3" />
                          Connected
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-white/70">
                      {twitterConnection
                        ? `@${(twitterConnection.profileData as any)?.username || 'connected'}`
                        : 'Post threads and updates directly'}
                    </p>
                  </div>
                </div>
                <div>
                  {twitterConnection ? (
                    <Button
                      onClick={() => {
                        setConnectionToDelete(twitterConnection.id);
                        setShowDisconnectDialog(true);
                      }}
                      variant="ghost"
                      size="sm"
                      className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  ) : (
                    <Button
                      onClick={connectTwitter}
                      size="sm"
                      className="bg-white hover:bg-white/90 text-black"
                    >
                      Connect
                    </Button>
                  )}
                </div>
              </div>
            </div>

            {/* Instagram Coming Soon */}
            <div className="rounded-xl border border-dashed border-white/20 bg-white/[0.02] p-4">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-white/10 rounded-lg flex items-center justify-center">
                    <FaInstagram className="text-white/40 w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-white/70">Instagram</span>
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-white/10 text-white/70">
                        Coming Soon
                      </span>
                    </div>
                    <p className="text-sm text-white/40">
                      Share captions and posts
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Usage Stats Section */}
          <section className="bg-gradient-to-r from-blue-500/10 to-purple-500/10 border border-white/10 rounded-xl p-6 mb-6">
            <div className="flex items-center gap-2 mb-3">
              <Sparkles className="w-5 h-5 text-blue-400" />
              <h2 className="text-lg font-semibold text-white">Your Plan</h2>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-white/10 rounded-lg p-4 text-center">
                <p className={`text-3xl font-bold ${user?.plan === 'pro' ? 'text-blue-400' : 'text-white'}`}>
                  {user?.plan === 'pro' ? 'Pro' : 'Free'}
                </p>
                <p className="text-sm text-white/60">Current Plan</p>
                {user?.plan === 'pro' && (
                  <span className="inline-block mt-1 px-2 py-0.5 bg-green-500/20 text-green-400 text-xs rounded-full">
                    Active
                  </span>
                )}
              </div>
              <div className="bg-white/10 rounded-lg p-4 text-center">
                <p className="text-3xl font-bold text-white">
                  {user?.plan === 'pro' ? 'Unlimited' : '3/day'}
                </p>
                <p className="text-sm text-white/60">Transformations</p>
              </div>
            </div>
            {user?.plan !== 'pro' && (
              <Link href="/pricing">
                <Button className="w-full mt-4 bg-blue-600 hover:bg-blue-700">
                  Upgrade to Pro
                </Button>
              </Link>
            )}
          </section>

          {/* Account Actions Section */}
          <section className="bg-white/[0.03] border border-white/10 rounded-xl p-6">
            <h2 className="text-lg font-semibold text-white mb-4">Account Actions</h2>

            <Button
              variant="outline"
              onClick={() => void logout()}
              className="w-full justify-start border-white/10 text-white/70 hover:bg-white/10 hover:text-white mb-3"
            >
              <LogOut className="w-4 h-4 mr-2" />
              Sign Out
            </Button>

            <div className="border-t border-white/10 pt-4 mt-4">
              <button className="flex items-center gap-2 text-sm text-red-400 hover:text-red-300 transition-colors">
                <Trash2 className="w-4 h-4" />
                Delete Account
              </button>
              <p className="text-xs text-white/40 mt-1">
                This will permanently delete your account and all connected services.
              </p>
            </div>
          </section>
        </div>
      </main>

      <Footer />

      {/* Disconnect confirmation dialog */}
      <AlertDialog open={showDisconnectDialog} onOpenChange={setShowDisconnectDialog}>
        <AlertDialogContent className="bg-[#141414] border-white/10">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-white">Disconnect Account?</AlertDialogTitle>
            <AlertDialogDescription className="text-white/60">
              You won't be able to post directly until you reconnect.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-white/10 text-white/70 hover:bg-white/10 hover:text-white">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (connectionToDelete) {
                  disconnectLinkedIn.mutate(connectionToDelete);
                }
              }}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              Disconnect
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
