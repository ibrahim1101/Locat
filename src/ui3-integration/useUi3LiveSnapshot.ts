import { useMemo } from "react";
import { nativeServerUrl } from "../lib/native";
import { useAuth } from "../state/auth";
import { useServerConnection } from "../state/connection";
import { projectUi3ModuleAvailability, projectUi3SessionUser } from "./projections";

/**
 * First live integration seam for UI 3.0.
 *
 * Must be called beneath Locat's existing AuthProvider and ConnectionProvider.
 * Never exposes identity keys, passwords, bearer tokens or preview fixtures.
 * This hook is read-only: the existing app remains the active UI until the
 * authenticated UI 3.0 host has been imported and explicitly enabled.
 */
export function useUi3LiveSnapshot() {
  const { state } = useAuth();
  const connected = useServerConnection();
  const origin = nativeServerUrl();

  return useMemo(() => {
    const user = state.status === "ready"
      ? projectUi3SessionUser(state.user, origin)
      : null;
    return {
      authStatus: state.status,
      user,
      connected,
      modules: projectUi3ModuleAvailability(connected, user?.isAdmin ?? false),
      readyForAuthenticatedShell: state.status === "ready",
    };
  }, [state, connected, origin]);
}
