import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { useLocation } from "wouter";
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

interface User {
  id: number;
  username: string;
}

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

interface UsersResponse {
  users: User[];
}

interface ConnectionsResponse {
  connections: SocialConnection[];
}

export default function UserManagement() {
  const [location, setLocation] = useLocation();
  const [activeTab, setActiveTab] = useState("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);
  const [showDisconnectDialog, setShowDisconnectDialog] = useState(false);
  const [connectionToDelete, setConnectionToDelete] = useState<number | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Parse URL query parameters
  useEffect(() => {
    const url = new URL(window.location.href);
    const linkedInConnected = url.searchParams.get("linkedInConnected");
    const error = url.searchParams.get("error");
    const userId = url.searchParams.get("userId");

    if (linkedInConnected === "true" && userId) {
      setSelectedUserId(parseInt(userId));
      toast({
        title: "LinkedIn Connected",
        description: "Your LinkedIn account has been successfully connected.",
      });
    } else if (error) {
      toast({
        title: "Connection Error",
        description: decodeURIComponent(error),
        variant: "destructive",
      });
    }

    // Clean up URL parameters
    if (linkedInConnected || error) {
      const cleanUrl = new URL(window.location.href);
      cleanUrl.searchParams.delete("linkedInConnected");
      cleanUrl.searchParams.delete("error");
      cleanUrl.searchParams.delete("userId");
      window.history.replaceState({}, document.title, cleanUrl.toString());
    }
  }, [toast]);

  // Get all users
  const {
    data: usersData,
    isLoading: isLoadingUsers,
    error: usersError,
  } = useQuery<UsersResponse>({
    queryKey: ["/api/users"],
    retry: false,
  });

  // Get social connections for the selected user
  const {
    data: connectionsData,
    isLoading: isLoadingConnections,
    error: connectionsError,
  } = useQuery<ConnectionsResponse>({
    queryKey: ["/api/users", selectedUserId, "social-connections"],
    enabled: !!selectedUserId,
    queryFn: async () => {
      return apiRequest<ConnectionsResponse>(`/api/users/${selectedUserId}/social-connections`);
    },
  });

  type RegisterResponse = {
    user: {
      id: number;
      username: string;
    }
  };

  type LoginResponse = {
    user: {
      id: number;
      username: string;
    }
  };

  // Register a new user
  const register = useMutation<
    RegisterResponse,
    Error,
    { username: string; password: string }
  >({
    mutationFn: async (userData) => {
      return apiRequest<RegisterResponse>("/api/users/register", {
        method: "POST",
        body: JSON.stringify(userData),
        headers: {
          "Content-Type": "application/json"
        }
      });
    },
    onSuccess: (data) => {
      toast({
        title: "Success",
        description: "User registered successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      setUsername("");
      setPassword("");
      setActiveTab("users");
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to register user.",
        variant: "destructive",
      });
    },
  });

  // Login
  const login = useMutation<
    LoginResponse,
    Error,
    { username: string; password: string }
  >({
    mutationFn: async (userData) => {
      return apiRequest<LoginResponse>("/api/users/login", {
        method: "POST",
        body: JSON.stringify(userData),
        headers: {
          "Content-Type": "application/json"
        }
      });
    },
    onSuccess: (data) => {
      toast({
        title: "Success",
        description: "Logged in successfully.",
      });

      // Store user ID in local storage
      localStorage.setItem("userId", data.user.id.toString());
      
      // Select the logged-in user
      setSelectedUserId(data.user.id);
      setActiveTab("users");
      
      // Clear form
      setUsername("");
      setPassword("");
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Invalid username or password.",
        variant: "destructive",
      });
    },
  });

  type LinkedInAuthResponse = {
    authUrl: string;
  };

  type DisconnectResponse = {
    success: boolean;
  };

  // Connect to LinkedIn
  const connectLinkedIn = async (userId: number) => {
    try {
      const response = await apiRequest<LinkedInAuthResponse>(`/api/auth/linkedin/user?userId=${userId}`);
      if (response.authUrl) {
        window.location.href = response.authUrl;
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to generate LinkedIn authorization URL.",
        variant: "destructive",
      });
    }
  };

  // Disconnect LinkedIn connection
  const disconnectLinkedIn = useMutation<
    DisconnectResponse,
    Error,
    number
  >({
    mutationFn: async (connectionId: number) => {
      return apiRequest<DisconnectResponse>(`/api/social-connections/${connectionId}`, {
        method: "DELETE",
      });
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "LinkedIn account disconnected successfully.",
      });
      queryClient.invalidateQueries({ 
        queryKey: ["/api/users", selectedUserId, "social-connections"] 
      });
      setShowDisconnectDialog(false);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to disconnect LinkedIn account.",
        variant: "destructive",
      });
      setShowDisconnectDialog(false);
    },
  });

  // Handle registration form submission
  const handleRegister = (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !password) {
      toast({
        title: "Error",
        description: "Username and password are required.",
        variant: "destructive",
      });
      return;
    }
    
    register.mutate({ username, password });
  };

  // Handle login form submission
  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !password) {
      toast({
        title: "Error",
        description: "Username and password are required.",
        variant: "destructive",
      });
      return;
    }
    
    login.mutate({ username, password });
  };

  // Handle user selection
  const handleSelectUser = (userId: number) => {
    setSelectedUserId(userId);
    localStorage.setItem("userId", userId.toString());
  };

  // Get saved user ID from localStorage
  useEffect(() => {
    const savedUserId = localStorage.getItem("userId");
    if (savedUserId && usersData?.users) {
      const user = usersData.users.find((u: User) => u.id === parseInt(savedUserId));
      if (user) {
        setSelectedUserId(parseInt(savedUserId));
        setActiveTab("users");
      }
    }
  }, [usersData]);

  // Prepare LinkedIn connections data
  const linkedInConnections = connectionsData?.connections
    ? connectionsData.connections.filter((conn: SocialConnection) => conn.provider === "linkedin")
    : [];

  return (
    <>
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid grid-cols-3 mb-8">
          <TabsTrigger value="login">Login</TabsTrigger>
          <TabsTrigger value="register">Register</TabsTrigger>
          <TabsTrigger value="users">Manage Users</TabsTrigger>
        </TabsList>

        <TabsContent value="login" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Login</CardTitle>
              <CardDescription>
                Log in to manage your LinkedIn connections
              </CardDescription>
            </CardHeader>
            <form onSubmit={handleLogin}>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="login-username">Username</Label>
                  <Input
                    id="login-username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="login-password">Password</Label>
                  <Input
                    id="login-password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                </div>
              </CardContent>
              <CardFooter>
                <Button
                  type="submit"
                  disabled={login.isPending}
                  className="w-full"
                >
                  {login.isPending ? "Logging in..." : "Log In"}
                </Button>
              </CardFooter>
            </form>
          </Card>
        </TabsContent>

        <TabsContent value="register" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Register</CardTitle>
              <CardDescription>
                Create a new account to manage your LinkedIn connections
              </CardDescription>
            </CardHeader>
            <form onSubmit={handleRegister}>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="register-username">Username</Label>
                  <Input
                    id="register-username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="register-password">Password</Label>
                  <Input
                    id="register-password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                </div>
              </CardContent>
              <CardFooter>
                <Button
                  type="submit"
                  disabled={register.isPending}
                  className="w-full"
                >
                  {register.isPending ? "Registering..." : "Register"}
                </Button>
              </CardFooter>
            </form>
          </Card>
        </TabsContent>

        <TabsContent value="users" className="space-y-8">
          {isLoadingUsers ? (
            <div className="text-center py-8">Loading users...</div>
          ) : usersError ? (
            <div className="text-center py-8 text-red-500">
              Error loading users
            </div>
          ) : (
            <>
              <Card>
                <CardHeader>
                  <CardTitle>User Accounts</CardTitle>
                  <CardDescription>
                    Select a user to manage their LinkedIn connections
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-4">
                    {usersData?.users && usersData.users.length > 0 ? (
                      usersData.users.map((user: User) => (
                        <div
                          key={user.id}
                          className={`p-4 border rounded-lg cursor-pointer transition-colors ${
                            selectedUserId === user.id
                              ? "border-primary bg-primary/5"
                              : "border-gray-200 hover:border-primary/50"
                          }`}
                          onClick={() => handleSelectUser(user.id)}
                        >
                          <div className="font-medium">{user.username}</div>
                          <div className="text-sm text-gray-500">ID: {user.id}</div>
                        </div>
                      ))
                    ) : (
                      <div className="text-center py-4 text-gray-500">
                        No users found. Please register a new user.
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              {selectedUserId && (
                <Card>
                  <CardHeader>
                    <CardTitle>LinkedIn Connections</CardTitle>
                    <CardDescription>
                      Manage LinkedIn connections for the selected user
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {isLoadingConnections ? (
                      <div className="text-center py-4">
                        Loading connections...
                      </div>
                    ) : connectionsError ? (
                      <div className="text-center py-4 text-red-500">
                        Error loading connections
                      </div>
                    ) : linkedInConnections.length > 0 ? (
                      <div className="space-y-4">
                        {linkedInConnections.map((connection: SocialConnection) => (
                          <div
                            key={connection.id}
                            className="p-4 border rounded-lg"
                          >
                            <div className="flex justify-between items-start">
                              <div>
                                <div className="font-medium">
                                  {connection.profileData.firstName}{" "}
                                  {connection.profileData.lastName}
                                </div>
                                <div className="text-sm text-gray-500">
                                  LinkedIn ID: {connection.profileData.id}
                                </div>
                              </div>
                              <Button
                                variant="destructive"
                                size="sm"
                                onClick={() => {
                                  setConnectionToDelete(connection.id);
                                  setShowDisconnectDialog(true);
                                }}
                              >
                                Disconnect
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-4">
                        <p className="text-gray-500 mb-4">
                          No LinkedIn connections for this user.
                        </p>
                        <Button
                          onClick={() => connectLinkedIn(selectedUserId)}
                        >
                          Connect LinkedIn Account
                        </Button>
                      </div>
                    )}
                  </CardContent>
                  {linkedInConnections.length > 0 && (
                    <CardFooter>
                      <Button
                        onClick={() => connectLinkedIn(selectedUserId)}
                        className="w-full"
                      >
                        Connect Another LinkedIn Account
                      </Button>
                    </CardFooter>
                  )}
                </Card>
              )}
            </>
          )}
        </TabsContent>
      </Tabs>

      {/* Disconnect confirmation dialog */}
      <AlertDialog 
        open={showDisconnectDialog} 
        onOpenChange={setShowDisconnectDialog}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Disconnect LinkedIn Account</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to disconnect this LinkedIn account? This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => {
              if (connectionToDelete) {
                disconnectLinkedIn.mutate(connectionToDelete);
              }
            }}>
              Disconnect
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}