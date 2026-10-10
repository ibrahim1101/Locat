import { Routes, Route } from "react-router";
import { lazy, Suspense } from "react";
import Dashboard from "./pages/Dashboard";
import Chat from "./pages/Chat";

const MediaLocal = lazy(() => import("./pages/MediaLocal"));
const Admin = lazy(() => import("./pages/Admin"));
const Sentinel = lazy(() => import("./pages/Sentinel"));
const LinkPage = lazy(() => import("./pages/Link"));

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Dashboard />} />
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
    </Routes>
  );
}
