import { Link } from "wouter";
import { useAuth } from "@/context/AuthContext";
import {
  Calendar,
  ChevronDown,
  CreditCard,
  History,
  ImagePlus,
  LayoutGrid,
  Lightbulb,
  Linkedin,
  LogOut,
  PenLine,
  Settings,
  Sparkles,
  User,
  Zap,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export default function AppHeader() {
  const { user, isLoggedIn, loginWithGoogle, loginWithLinkedIn, logout, isLoading } = useAuth();
  const isPro = user?.plan === "pro";

  return (
    <header className="sticky top-0 z-50 border-b border-slate-200 bg-white/90 backdrop-blur-xl" role="banner">
      <div className="section-shell">
        <div className="flex h-14 items-center justify-between gap-4">
          <Link href="/">
            <span className="group flex cursor-pointer items-center">
              <span className="block text-sm font-bold tracking-tight text-slate-950 sm:text-base">
                Content Reworker
              </span>
            </span>
          </Link>

          <nav className="flex items-center gap-2" aria-label="Primary navigation">
            {isLoggedIn ? (
              <>
                <Link href="/">
                  <button className="hidden items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 hover:text-slate-950 md:flex">
                    <Sparkles className="h-4 w-4" />
                    Studio
                  </button>
                </Link>
                <Link href="/trending">
                  <button className="hidden items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 hover:text-slate-950 lg:flex">
                    <Lightbulb className="h-4 w-4" />
                    Ideas
                  </button>
                </Link>
                <Link href="/creators">
                  <button className="hidden items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 hover:text-slate-950 lg:flex">
                    <User className="h-4 w-4" />
                    Creators
                  </button>
                </Link>
              </>
            ) : (
              null
            )}

            {isLoading ? (
              <div className="h-10 w-10 animate-pulse rounded-full bg-slate-200" />
            ) : isLoggedIn ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="flex items-center gap-2 rounded-full border border-slate-200 bg-white p-1 pr-2 shadow-sm transition hover:border-slate-300">
                    {user?.avatarUrl ? (
                      <img
                        src={user.avatarUrl}
                        alt={user.name || user.username}
                        className="h-8 w-8 rounded-full object-cover"
                        onError={(event) => {
                          event.currentTarget.style.display = "none";
                          event.currentTarget.nextElementSibling?.classList.remove("hidden");
                        }}
                      />
                    ) : null}
                    <span className={`grid h-8 w-8 place-items-center rounded-full bg-slate-950 text-sm font-bold text-white ${user?.avatarUrl ? "hidden" : ""}`}>
                      {(user?.name || user?.username)?.[0]?.toUpperCase() || <User className="h-4 w-4" />}
                    </span>
                    <ChevronDown className="hidden h-4 w-4 text-slate-500 sm:block" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-60 border-slate-200 bg-white text-slate-900 shadow-xl">
                  <div className="border-b border-slate-100 px-3 py-3">
                    <p className="text-sm font-bold text-slate-950">{user?.name || user?.username}</p>
                    <p className="truncate text-xs text-slate-500">{user?.email}</p>
                    {isPro && (
                      <span className="mt-2 inline-flex items-center gap-1 rounded-full bg-lime-300 px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-slate-950">
                        <Zap className="h-3 w-3" />
                        Pro
                      </span>
                    )}
                  </div>
                  <div className="py-1">
                    <Link href="/history">
                      <DropdownMenuItem className="cursor-pointer focus:bg-slate-100">
                        <History className="mr-2 h-4 w-4 text-slate-500" />
                        History
                      </DropdownMenuItem>
                    </Link>
                    <Link href="/schedule">
                      <DropdownMenuItem className="cursor-pointer focus:bg-slate-100">
                        <Calendar className="mr-2 h-4 w-4 text-slate-500" />
                        Schedule Posts
                        {!isPro && <Sparkles className="ml-auto h-3 w-3 text-[rgb(var(--color-linkedin))]" />}
                      </DropdownMenuItem>
                    </Link>
                    {isPro && (
                      <Link href="/generate">
                        <DropdownMenuItem className="cursor-pointer focus:bg-slate-100">
                          <ImagePlus className="mr-2 h-4 w-4 text-slate-500" />
                          AI Images
                        </DropdownMenuItem>
                      </Link>
                    )}
                    <Link href="/accounts">
                      <DropdownMenuItem className="cursor-pointer focus:bg-slate-100">
                        <Settings className="mr-2 h-4 w-4 text-slate-500" />
                        Account Settings
                      </DropdownMenuItem>
                    </Link>
                    <Link href="/pricing">
                      <DropdownMenuItem className="cursor-pointer focus:bg-slate-100">
                        <CreditCard className="mr-2 h-4 w-4 text-slate-500" />
                        {isPro ? "Billing" : "Upgrade to Pro"}
                      </DropdownMenuItem>
                    </Link>
                  </div>
                  <DropdownMenuSeparator className="bg-slate-100" />
                  <DropdownMenuItem
                    onClick={() => void logout()}
                    className="cursor-pointer text-red-600 focus:bg-red-50 focus:text-red-700"
                  >
                    <LogOut className="mr-2 h-4 w-4" />
                    Sign Out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <div className="flex items-center gap-2">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button className="whitespace-nowrap rounded-lg px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 hover:text-slate-950">
                      Sign in
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56 border-slate-200 bg-white text-slate-900 shadow-xl">
                    <DropdownMenuItem onClick={loginWithLinkedIn} className="cursor-pointer focus:bg-slate-100">
                      <Linkedin className="mr-2 h-4 w-4 text-[rgb(var(--color-linkedin))]" />
                      Continue with LinkedIn
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={loginWithGoogle} className="cursor-pointer focus:bg-slate-100">
                      <User className="mr-2 h-4 w-4 text-slate-500" />
                      Continue with Google
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
                <button onClick={loginWithLinkedIn} className="btn-primary px-4 py-2">
                  Start
                </button>
              </div>
            )}
          </nav>
        </div>
      </div>
    </header>
  );
}
