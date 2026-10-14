import type { SessionUser } from "../state/auth";
import { MODULES, moduleDisabledReason } from "../modules/registry";

/**
 * Read-only projections for the Locat UI 3.0 integration.
 * These are intentionally separate from preview fixtures and never handle keys,
 * plaintext messages, tokens or mutable authentication state.
 */
export type Ui3SessionUser = {
  id: string;
  username: string;
  displayName: string;
  lcCode: string;
  avatarUrl?: string;
  isAdmin: boolean;
  serverOrigin: string;
};

export function projectUi3SessionUser(user: SessionUser, serverOrigin: string): Ui3SessionUser {
  return {
    id: String(user.id),
    username: user.username,
    displayName: user.displayName,
    lcCode: user.lcCode,
    ...(user.avatar ? { avatarUrl: user.avatar } : {}),
    isAdmin: user.isAdmin === true,
    serverOrigin,
  };
}

export type Ui3ModuleAvailability = {
  id: string;
  route: string;
  status: "available" | "beta" | "planned";
  availability: "available" | "beta" | "planned" | "disabled";
  reason?: string;
};

/** Compute UI 3.0 module availability from Locat's real module registry. */
export function projectUi3ModuleAvailability(connected: boolean, isAdmin: boolean): Ui3ModuleAvailability[] {
  return MODULES.map((module) => {
    const reason = moduleDisabledReason(module, connected, isAdmin);
    return {
      id: module.id,
      route: module.route,
      status: module.status,
      availability: reason ? (module.status === "planned" ? "planned" : "disabled") : module.status,
      ...(reason ? { reason } : {}),
    };
  });
}
