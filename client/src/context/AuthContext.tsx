import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { useToast } from "@/hooks/use-toast";

interface User {
  id: number;
  username: string;
  email?: string;
  name?: string;
  avatarUrl?: string;
  plan?: string;
  subscriptionStatus?: string;
  hasSeenOnboarding?: boolean;
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isLoggedIn: boolean;
  login: (username: string, password: string) => Promise<boolean>;
  register: (username: string, password: string) => Promise<boolean>;
  loginWithGoogle: () => void;
  loginWithLinkedIn: () => void;
  logout: () => Promise<void>;
  // Locally patch the user object + persisted localStorage. Use after a
  // mutation that already succeeded server-side so React state matches the
  // database without an extra /api/auth/me round trip.
  updateUser: (patch: Partial<User>) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const persistUser = (user: User) => {
  localStorage.setItem("userId", user.id.toString());
  localStorage.setItem("username", user.username);

  if (user.email) localStorage.setItem("email", user.email);
  else localStorage.removeItem("email");

  if (user.name) localStorage.setItem("name", user.name);
  else localStorage.removeItem("name");

  if (user.avatarUrl) localStorage.setItem("avatarUrl", user.avatarUrl);
  else localStorage.removeItem("avatarUrl");

  if (user.plan) localStorage.setItem("plan", user.plan);
  else localStorage.removeItem("plan");

  if (user.subscriptionStatus) localStorage.setItem("subscriptionStatus", user.subscriptionStatus);
  else localStorage.removeItem("subscriptionStatus");

  if (user.hasSeenOnboarding !== undefined) {
    localStorage.setItem("hasSeenOnboarding", user.hasSeenOnboarding.toString());
  } else {
    localStorage.removeItem("hasSeenOnboarding");
  }
};

const clearStoredUser = () => {
  localStorage.removeItem("userId");
  localStorage.removeItem("username");
  localStorage.removeItem("email");
  localStorage.removeItem("name");
  localStorage.removeItem("avatarUrl");
  localStorage.removeItem("plan");
  localStorage.removeItem("subscriptionStatus");
  localStorage.removeItem("hasSeenOnboarding");
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  // Listen for OAuth popup messages
  useEffect(() => {
    const handleOAuthMessage = (event: MessageEvent) => {
      // Verify origin for security
      if (event.origin !== window.location.origin) return;

      if (event.data?.type === 'oauth-success' && event.data?.user) {
        const userData = event.data.user;
        persistUser(userData);
        setUser(userData);
        toast({
          title: "Welcome!",
          description: `Signed in as ${userData.name || userData.username}`
        });
      } else if (event.data?.type === 'oauth-error') {
        toast({
          title: "Authentication failed",
          description: event.data.error || "Could not complete sign in",
          variant: "destructive"
        });
      }
    };

    window.addEventListener('message', handleOAuthMessage);
    return () => window.removeEventListener('message', handleOAuthMessage);
  }, [toast]);

  // Check for existing session on mount and handle OAuth redirects
  useEffect(() => {
    const checkAuthState = async () => {
      const urlParams = new URLSearchParams(window.location.search);
      const loggedIn = urlParams.get('loggedIn');
      const error = urlParams.get('error');

      if (error) {
        toast({
          title: "Authentication failed",
          description: decodeURIComponent(error.replace(/\+/g, ' ')),
          variant: "destructive"
        });
        // Clean URL
        window.history.replaceState({}, '', window.location.pathname);
      }

      if (loggedIn === 'true') {
        const userDataParam = urlParams.get('userData');
        if (userDataParam) {
          try {
            const userData = JSON.parse(decodeURIComponent(userDataParam));
            persistUser(userData);
            setUser(userData);
            toast({
              title: "Welcome!",
              description: `Signed in as ${userData.name || userData.username}`
            });
          } catch {
            // Failed to parse user data
          }
        }
        // Clean URL
        window.history.replaceState({}, '', window.location.pathname);
      }

      try {
        const response = await fetch('/api/auth/me', { credentials: 'include' });
        if (!response.ok) {
          clearStoredUser();
          setUser(null);
          setIsLoading(false);
          return;
        }

        const data = await response.json();
        if (data.user) {
          persistUser(data.user);
          setUser(data.user);
        } else {
          clearStoredUser();
          setUser(null);
        }
      } catch {
        clearStoredUser();
        setUser(null);
      }

      setIsLoading(false);
    };

    checkAuthState();
  }, []);

  const login = async (username: string, password: string): Promise<boolean> => {
    try {
      const response = await fetch("/api/users/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ username, password })
      });

      const data = await response.json();

      if (!response.ok) {
        toast({
          title: "Login failed",
          description: data.message || "Invalid credentials",
          variant: "destructive"
        });
        return false;
      }

      persistUser(data.user);
      setUser(data.user);

      toast({
        title: "Welcome back!",
        description: `Logged in as ${data.user.username}`
      });

      return true;
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to connect to server",
        variant: "destructive"
      });
      return false;
    }
  };

  const register = async (username: string, password: string): Promise<boolean> => {
    try {
      const response = await fetch("/api/users/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ username, password })
      });

      const data = await response.json();

      if (!response.ok) {
        toast({
          title: "Registration failed",
          description: data.message || "Could not create account",
          variant: "destructive"
        });
        return false;
      }

      persistUser(data.user);
      setUser(data.user);

      toast({
        title: "Account created!",
        description: `Welcome, ${data.user.username}`
      });

      return true;
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to connect to server",
        variant: "destructive"
      });
      return false;
    }
  };

  const loginWithGoogle = () => {
    // Open popup IMMEDIATELY on click (before async), then navigate
    const width = 500;
    const height = 600;
    const left = window.screenX + (window.outerWidth - width) / 2;
    const top = window.screenY + (window.outerHeight - height) / 2;

    const popup = window.open(
      'about:blank',
      'google-auth',
      `width=${width},height=${height},left=${left},top=${top},toolbar=no,menubar=no,scrollbars=yes`
    );

    if (!popup) {
      toast({
        title: "Popup blocked",
        description: "Please allow popups for this site",
        variant: "destructive"
      });
      return;
    }

    // Show loading state in popup
    popup.document.write('<html><body style="background:#0f0f0f;color:#faf7f2;font-family:system-ui;display:flex;align-items:center;justify-content:center;height:100vh;margin:0"><p>Loading...</p></body></html>');

    fetch('/api/auth/google')
      .then(res => res.json())
      .then(data => {
        if (data.authUrl) {
          popup.location.href = data.authUrl;
        } else {
          popup.close();
          toast({
            title: "Google Sign In unavailable",
            description: data.error || "Could not get auth URL",
            variant: "destructive"
          });
        }
      })
      .catch(() => {
        popup.close();
        toast({
          title: "Error",
          description: "Could not start Google Sign In",
          variant: "destructive"
        });
      });
  };

  const loginWithLinkedIn = () => {
    // Open popup IMMEDIATELY on click (before async), then navigate
    const width = 500;
    const height = 600;
    const left = window.screenX + (window.outerWidth - width) / 2;
    const top = window.screenY + (window.outerHeight - height) / 2;

    const popup = window.open(
      'about:blank',
      'linkedin-auth',
      `width=${width},height=${height},left=${left},top=${top},toolbar=no,menubar=no,scrollbars=yes`
    );

    if (!popup) {
      toast({
        title: "Popup blocked",
        description: "Please allow popups for this site",
        variant: "destructive"
      });
      return;
    }

    // Show loading state in popup
    popup.document.write('<html><body style="background:#0f0f0f;color:#faf7f2;font-family:system-ui;display:flex;align-items:center;justify-content:center;height:100vh;margin:0"><p>Loading...</p></body></html>');

    fetch('/api/auth/linkedin/login')
      .then(res => res.json())
      .then(data => {
        if (data.authUrl) {
          popup.location.href = data.authUrl;
        } else {
          popup.close();
          toast({
            title: "LinkedIn Sign In unavailable",
            description: data.error || "Could not get auth URL",
            variant: "destructive"
          });
        }
      })
      .catch(() => {
        popup.close();
        toast({
          title: "Error",
          description: "Could not start LinkedIn Sign In",
          variant: "destructive"
        });
      });
  };

  const logout = async () => {
    try {
      const response = await fetch("/api/users/logout", {
        method: "POST",
        credentials: "include",
      });

      if (!response.ok) {
        throw new Error("Failed to log out");
      }

      clearStoredUser();
      setUser(null);

      toast({
        title: "Logged out",
        description: "You have been logged out"
      });
    } catch {
      toast({
        title: "Logout failed",
        description: "Could not end your session. Please try again.",
        variant: "destructive"
      });
    }
  };

  const updateUser = (patch: Partial<User>) => {
    setUser((prev) => {
      if (!prev) return prev;
      const next = { ...prev, ...patch };
      persistUser(next);
      return next;
    });
  };

  return (
    <AuthContext.Provider value={{
      user,
      isLoading,
      isLoggedIn: !!user,
      login,
      register,
      loginWithGoogle,
      loginWithLinkedIn,
      logout,
      updateUser,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
