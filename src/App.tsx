import { Routes, Route } from "react-router";
import { lazy, Suspense } from "react";
import Chat from "./pages/Chat";

const Admin = lazy(() => import("./pages/Admin"));

export default function App() {
  return (
    <Routes>
      <Route path="/admin" element={<Suspense fallback={<p role="status" className="p-6 text-secondary">Opening server administration…</p>}><Admin /></Suspense>} />
      <Route path="/" element={<Chat />} />
      <Route path="*" element={<Chat />} />
    </Routes>
  );
}
