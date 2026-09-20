import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Outlet, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import { Loader2 } from "lucide-react";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import Index from "./pages/Index";
import Discover from "./pages/Discover";
import Create from "./pages/Create";
import Messages from "./pages/Messages";
import Profile from "./pages/Profile";
import NearMe from "./pages/NearMe";
import LiveRoom from "./pages/LiveRoom";
import Auth from "./pages/Auth";
import Groups from "./pages/Groups";
import GroupChat from "./pages/GroupChat";
import NotFound from "./pages/NotFound";
import RedBusket from "./pages/RedBusket";
import AdminRevenue from "./pages/AdminRevenue";
import AdminPayfast from "./pages/AdminPayfast";
import AdminRoute from "./components/AdminRoute";
import Install from "./pages/Install";
import AppShell, { type ShellChrome, type ShellWidth } from "./components/layout/AppShell";

const queryClient = new QueryClient();

const FullPageLoader = () => (
  <div className="min-h-dvh flex items-center justify-center bg-background">
    <Loader2 className="h-6 w-6 animate-spin text-primary" />
  </div>
);

/** Auth gate as a layout route, so it isn't repeated on every line below. */
const AuthLayout = () => {
  const { user, loading } = useAuth();
  if (loading) return <FullPageLoader />;
  if (!user) return <Navigate to="/auth" replace />;
  return <Outlet />;
};

const PublicOnly = ({ children }: { children: JSX.Element }) => {
  const { user, loading } = useAuth();
  if (loading) return <FullPageLoader />;
  if (user) return <Navigate to="/" replace />;
  return children;
};

/** The shell lives here rather than inside each page — per-page opt-in is how
 *  Index and Install ended up with their own divergent copies of the layout. */
const Shell = ({ width, chrome }: { width?: ShellWidth; chrome?: ShellChrome }) => (
  <AppShell width={width} chrome={chrome}>
    <Outlet />
  </AppShell>
);

const AppRoutes = () => (
  <Routes>
    {/* Standalone: full-bleed by design */}
    <Route path="/auth" element={<PublicOnly><Auth /></PublicOnly>} />
    <Route path="/auth/callback" element={<Auth />} />

    {/* Public, but inside the shell (no primary nav) */}
    <Route element={<Shell width="form" chrome="minimal" />}>
      <Route path="/install" element={<Install />} />
      <Route path="/download" element={<Install />} />
    </Route>

    <Route element={<AuthLayout />}>
      <Route element={<Shell width="feed" />}>
        <Route path="/" element={<Index />} />
      </Route>

      {/* Compose form and conversation list both want a narrow measure — a grid of
          chat rows reads worse than one focused column at every width. */}
      <Route element={<Shell width="form" />}>
        <Route path="/create" element={<Create />} />
        <Route path="/messages" element={<Messages />} />
      </Route>

      <Route element={<Shell width="wide" />}>
        <Route path="/discover" element={<Discover />} />
        <Route path="/near-me" element={<NearMe />} />
        <Route path="/groups" element={<Groups />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="/profile/:userId" element={<Profile />} />
        <Route path="/wallet" element={<RedBusket />} />
        <Route element={<AdminRoute />}>
          <Route path="/admin/revenue" element={<AdminRevenue />} />
          <Route path="/admin/payfast" element={<AdminPayfast />} />
        </Route>
      </Route>

      {/* Chat keeps the desktop rail but drops the top bar and mobile tabs */}
      <Route element={<Shell width="full" chrome="chat" />}>
        <Route path="/groups/:id" element={<GroupChat />} />
      </Route>

      {/* Immersive, deliberately outside the shell */}
      <Route path="/live/:id" element={<LiveRoom />} />
    </Route>

    <Route path="*" element={<NotFound />} />
  </Routes>
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <ErrorBoundary>
            <AppRoutes />
          </ErrorBoundary>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
