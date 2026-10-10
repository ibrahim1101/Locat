import React from "react";
import { NavLink, useLocation } from "react-router-dom";
import { Film, Music2, Settings2, LayoutGrid, PlugZap } from "lucide-react";

const items = [
  { to: "/", label: "Hub", icon: LayoutGrid, testid: "nav-hub" },
  { to: "/cinema", label: "Cinema", icon: Film, testid: "nav-cinema" },
  { to: "/music", label: "Music", icon: Music2, testid: "nav-music" },
  { to: "/music/eq", label: "Audio & EQ", icon: Settings2, testid: "nav-eq" },
  { to: "/integration", label: "Integration", icon: PlugZap, testid: "nav-integration" },
];

export function AppShell({ children, rightSlot = null, bottomSlot = null }) {
  const loc = useLocation();
  return (
    <div data-testid="locat-shell" className="min-h-screen flex flex-col relative overflow-x-hidden">
      <div className="locat-grid-bg absolute inset-0 pointer-events-none opacity-50" />
      <header className="relative z-10 border-b border-white/[0.06] bg-[rgba(9,10,15,0.85)] backdrop-blur">
        <div className="max-w-[1400px] mx-auto px-6 h-16 flex items-center gap-6">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-blue-500/80 to-emerald-400/70 shadow-[0_0_24px_rgba(59,130,246,0.35)]" />
            <div className="leading-tight">
              <div className="font-display text-base font-semibold tracking-tight text-white">Locat Media Hub</div>
              <div className="font-mono text-[10px] uppercase tracking-wider text-zinc-500">
                integration module · milestone a + b
              </div>
            </div>
          </div>
          <nav className="hidden md:flex items-center gap-1 ml-6" data-testid="locat-nav">
            {items.map((it) => {
              const Active =
                it.to === "/" ? loc.pathname === "/" :
                loc.pathname === it.to || loc.pathname.startsWith(it.to + "/");
              return (
                <NavLink
                  key={it.to}
                  to={it.to}
                  data-testid={it.testid}
                  className={`font-mono text-xs px-3 py-2 rounded-md inline-flex items-center gap-2 transition ${
                    Active
                      ? "bg-white/[0.06] text-white"
                      : "text-zinc-400 hover:text-white hover:bg-white/[0.04]"
                  }`}
                >
                  <it.icon size={14} />{it.label}
                </NavLink>
              );
            })}
          </nav>
          <div className="ml-auto flex items-center gap-3">{rightSlot}</div>
        </div>
      </header>
      <main className="relative z-10 flex-1 w-full max-w-[1400px] mx-auto px-6 py-10">
        <div className="animate-rise">{children}</div>
      </main>
      {bottomSlot && (
        <div className="sticky bottom-0 z-20">{bottomSlot}</div>
      )}
    </div>
  );
}
