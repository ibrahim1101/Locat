import { Link, useLocation } from "react-router";
import { MODULES } from "@/modules/registry";
import { useAuth } from "@/state/auth";

/**
 * Primary mobile bottom navigation used across the ecosystem. The messages
 * screen also mounts it so that a single tap on "Home" returns to the
 * Dashboard without opening a drawer or losing composer drafts (which are
 * persisted per-conversation by {@link saveDraft}).
 *
 * When `active` is omitted we fall back to pathname matching so the component
 * stays correct inside screens that render their own layout, e.g. the chat
 * sidebar which lives at `/messages`.
 */
export function MobileBottomNav({ active }: { active?: string }) {
  const location = useLocation();
  const { state } = useAuth();
  const user = state.status === "ready" ? state.user : null;
  // Primary modules are the four we expose on the bottom bar. "Dashboard" is
  // intentionally first so the Home affordance is always under the thumb.
  const items = MODULES.filter((m) => m.primary).slice(0, 4);

  function isActive(id: string, route: string): boolean {
    if (active) return active === id;
    if (route === "/") return location.pathname === "/";
    return location.pathname.startsWith(route);
  }

  return (
    <nav
      aria-label="Primary"
      data-testid="mobile-bottom-nav"
      className="fixed inset-x-0 bottom-0 z-40 flex items-stretch border-t border-border/70 bg-background/95 pb-safe backdrop-blur md:hidden"
    >
      {items.map((m) => {
        const activeTab = isActive(m.id, m.route);
        const disabled = m.status === "planned";
        const Icon = m.icon;
        const label = m.id === "dashboard" ? "Home" : m.name;
        const inner = (
          <span
            className={`flex flex-1 flex-col items-center justify-center gap-0.5 py-2 text-[10px] font-medium ${activeTab ? "ember-text" : "text-secondary"} ${disabled ? "opacity-40" : ""}`}
          >
            <Icon className="h-5 w-5" />
            {label}
          </span>
        );
        if (disabled) {
          return (
            <span key={m.id} className="flex flex-1" aria-disabled>
              {inner}
            </span>
          );
        }
        return (
          <Link
            key={m.id}
            to={m.route}
            className="flex flex-1"
            data-testid={m.id === "dashboard" ? "bottomnav-home" : `bottomnav-${m.id}`}
            aria-current={activeTab ? "page" : undefined}
          >
            {inner}
          </Link>
        );
      })}
      {user?.isAdmin && (
        <Link
          to="/admin"
          className="flex flex-1"
          aria-label="Server administration"
          data-testid="bottomnav-admin"
        >
          <span className="flex flex-1 flex-col items-center justify-center gap-0.5 py-2 text-[10px] font-medium text-secondary">
            <span className="font-mono-ui text-lg leading-none">⌘</span>
            Admin
          </span>
        </Link>
      )}
    </nav>
  );
}
