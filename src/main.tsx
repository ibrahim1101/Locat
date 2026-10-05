import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router";
import { TRPCProvider } from "./providers/trpc";
import { AuthProvider } from "./state/auth";
import App from "./App";
import "./index.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <TRPCProvider><AuthProvider><App /></AuthProvider></TRPCProvider>
    </BrowserRouter>
  </StrictMode>,
);
