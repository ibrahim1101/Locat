import { Routes, Route } from "react-router";
import { lazy, Suspense } from "react";
import Dashboard from "./pages/Dashboard";
import Chat from "./pages/Chat";
import Login from "./pages/Login";
import { useAuth } from "./state/auth";
import { useServerConnection } from "./state/connection";
import { ServerConnectionControl } from "./components/ServerConnectionControl";
import { useLocation } from "react-router";
import { MODULES, moduleDisabledReason } from "./modules/registry";

const Remote = lazy(() => import("./pages/Remote"));
const Performance = lazy(() => import("./pages/Performance"));
const MediaLocal = lazy(() => import("./pages/MediaLocal"));
const Admin = lazy(() => import("./pages/Admin"));
const Sentinel = lazy(() => import("./pages/Sentinel"));
const LinkPage = lazy(() => import("./pages/Link"));
const PrivateStore = lazy(() => import("./pages/PrivateStore"));
const SearchPage = lazy(() => import("./pages/Search"));
const Hub = lazy(() => import("./pages/Hub"));

export default function App() {
  const { state } = useAuth();
  const connected = useServerConnection();
  const location = useLocation();
  if (state.status !== "ready") return <><Login /><ServerConnectionControl /></>;
  const current = MODULES.find(module => location.pathname === module.route);
  const blocked = (current && moduleDisabledReason(current, connected, !!state.user.isAdmin)) || (location.pathname === "/admin" && (!connected || !state.user.isAdmin));
  return (
    <><ServerConnectionControl authenticated />{blocked ? <Dashboard /> : <Routes>
      <Route path="/search" element={<Suspense fallback={<p role="status" className="p-6">Opening Search…</p>}><SearchPage /></Suspense>} />
      <Route path="/hub" element={<Suspense fallback={<p role="status" className="p-6">Opening Hub…</p>}><Hub /></Suspense>} />
      <Route path="/vault" element={<Suspense fallback={<p role="status" className="p-6">Opening Vault…</p>}><PrivateStore module="vault" /></Suspense>} />
      <Route path="/secrets" element={<Suspense fallback={<p role="status" className="p-6">Opening Secrets…</p>}><PrivateStore module="secrets" /></Suspense>} />
      <Route path="/remote" element={<Suspense fallback={<p role="status">Opening Remote…</p>}><Remote /></Suspense>} />
      <Route path="/performance" element={<Suspense fallback={<p role="status">Opening diagnostics…</p>}><Performance /></Suspense>} />
      <Route path="/" element={<Dashboard />} />
      <Route path="/dashboard" element={<Dashboard />} />
      <Route path="/messages" element={<Chat />} />
      <Route path="/cinema" element={<Suspense fallback={<p role="status" className="p-6 text-secondary">Opening Cinema…</p>}><MediaLocal kind="cinema" /></Suspense>} />
      <Route path="/music" element={<Suspense fallback={<p role="status" className="p-6 text-secondary">Opening Music…</p>}><MediaLocal kind="music" /></Suspense>} />
      <Route
        path="/sentinel"
        element={
          <Suspense fallback={<p role="status" className="p-6 text-secondary">Opening Sentinel…</p>}>
            <Sentinel />
          </Suspense>
        }
      />
      <Route
        path="/link"
        element={
          <Suspense fallback={<p role="status" className="p-6 text-secondary">Opening Link…</p>}>
            <LinkPage />
          </Suspense>
        }
      />
      <Route
        path="/admin"
        element={
          <Suspense fallback={<p role="status" className="p-6 text-secondary">Opening server administration…</p>}>
            <Admin />
          </Suspense>
        }
      />
      <Route path="*" element={<Dashboard />} />
    </Routes>}</>
  );
}
