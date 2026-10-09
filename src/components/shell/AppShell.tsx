import { type ReactNode } from "react";
import { Link, useLocation } from "react-router";
import { MODULES, type LocatModule } from "@/modules/registry";
import { LocatMark, LocatWordmark } from "@/components/LocatBrand";
import { useAuth } from "@/state/auth";

/**
 * Responsive ecosystem shell: a vertical rail on desktop and a bottom nav on
 * mobile. Wraps dashboard + module pages. The Messages module renders its own
 * full-screen two-pane layout and is intentionally NOT wrapped by this shell.
 */
export function AppShell({ children, active }: { children: ReactNode; active: string }) {
  const { state } = useAuth();
  const user = state.status === "ready" ? state.user : null;
  const navItems = MODULES.filter((m) => m.primary || m.status !== "planned");
  const mobileItems = MODULES.filter((m) => m.primary).slice(0, 4);

  return (
    <div className="locat-mesh flex app-height text-foreground">
      {/* Desktop rail */}
      <aside className="hidden w-[76px] shrink-0 flex-col items-center gap-1 border-r border-border/70 bg-background/60 py-4 pt-safe md:flex lg:w-60 lg:items-stretch lg:px-3">
        <Link to="/" className="mb-4 flex items-center gap-2 px-2 lg:px-1" aria-label="Locat home">
          <LocatMark className="h-10 w-10" />
          <LocatWordmark className="hidden text-xl lg:inline" />
        </Link>
        <nav className="scroll-slim flex w-full flex-1 flex-col gap-1 overflow-y-auto" aria-label="Modules">
          {navItems.map((m) => (
            <RailLink key={m.id} module={m} active={active === m.id} />
          ))}
        </nav>
      </aside>

      {/* Content */}
      <div className="flex min-w-0 flex-1 flex-col pb-[72px] md:pb-0">
        {children}
      </div>

      {/* Mobile bottom nav */}
      <nav
        aria-label="Primary"
        className="fixed inset-x-0 bottom-0 z-40 flex items-stretch border-t border-border/70 bg-background/95 pb-safe backdrop-blur md:hidden"
      >
        {mobileItems.map((m) => {
          const isActive = active === m.id;
          const disabled = m.status === "planned";
          const Icon = m.icon;
          const inner = (
            <span className={`flex flex-1 flex-col items-center justify-center gap-0.5 py-2 text-[10px] font-medium ${isActive ? "ember-text" : "text-secondary"} ${disabled ? "opacity-40" : ""}`}>
              <Icon className="h-5 w-5" />
              {m.name}
            </span>
          );
          return disabled ? (
            <span key={m.id} className="flex flex-1" aria-disabled>{inner}</span>
          ) : (
            <Link key={m.id} to={m.route} className="flex flex-1" data-testid={`bottomnav-${m.id}`} aria-current={isActive ? "page" : undefined}>
              {inner}
            </Link>
          );
        })}
        {user?.isAdmin && (
          <Link to="/admin" className="flex flex-1" aria-label="Server administration">
            <span className="flex flex-1 flex-col items-center justify-center gap-0.5 py-2 text-[10px] font-medium text-secondary">
              <span className="font-mono-ui text-lg leading-none">⌘</span>
              Admin
            </span>
          </Link>
        )}
      </nav>
    </div>
  );
}

function RailLink({ module, active }: { module: LocatModule; active: boolean }) {
  const Icon = module.icon;
  const disabled = module.status === "planned";
  const base = "group flex items-center gap-3 rounded-2xl px-3 py-2.5 text-sm transition-colors lg:justify-start justify-center";
  const cls = active
    ? `${base} bg-primary/15 ember-text border border-primary/40`
    : `${base} border border-transparent text-secondary hover:bg-accent hover:text-foreground`;
  const content = (
    <>
      <Icon className="h-5 w-5 shrink-0" />
      <span className="hidden min-w-0 flex-1 truncate lg:inline">{module.name}</span>
      {disabled && <span className="hidden rounded-full border border-border px-1.5 py-0.5 text-[9px] uppercase tracking-wide text-secondary lg:inline">{module.milestone}</span>}
    </>
  );
  if (disabled) {
    return <span className={`${cls} cursor-not-allowed opacity-45`} aria-disabled title={`${module.name} · coming in ${module.milestone}`}>{content}</span>;
  }
  return (
    <Link to={module.route} className={cls} aria-current={active ? "page" : undefined} data-testid={`rail-${module.id}`}>
      {content}
    </Link>
  );
}

/** Reusable page header for module screens rendered inside the shell. */
export function ModuleHeader({ title, tagline, icon: Icon, actions }: { title: string; tagline?: string; icon?: LocatModule["icon"]; actions?: ReactNode }) {
  const loc = useLocation();
  return (
    <header className="flex items-center gap-3 border-b border-border/70 px-4 py-4 pt-safe sm:px-6" data-path={loc.pathname}>
      {Icon && (
        <span className="flex h-11 w-11 items-center justify-center rounded-2xl border border-primary/40 bg-primary/10 ember-text">
          <Icon className="h-5 w-5" />
        </span>
      )}
      <div className="min-w-0 flex-1">
        <h1 className="truncate text-lg font-semibold tracking-tight">{title}</h1>
        {tagline && <p className="truncate text-xs text-secondary">{tagline}</p>}
      </div>
      {actions}
    </header>
  );
}
