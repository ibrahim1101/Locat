import { Routes, Route } from "react-router";
import Admin from "./pages/Admin";
import Chat from "./pages/Chat";

export default function App() {
  return (
    <Routes>
      <Route path="/admin" element={<Admin />} />
      <Route path="/" element={<Chat />} />
      <Route path="*" element={<Chat />} />
    </Routes>
  );
}
