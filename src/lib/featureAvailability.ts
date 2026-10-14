/**
 * UI-independent module access policy.
 * Shared by the existing launcher and future Locat UI integrations.
 * This is a presentation availability hint, NOT an authorization boundary.
 * Backend and feature services must enforce all real permissions.
 */
export type FeatureAvailabilityStatus = "available" | "beta" | "planned";

export type FeatureAccess = {
  status: FeatureAvailabilityStatus;
  adminOnly?: boolean;
  requiresServer?: boolean;
};

export type FeatureContext = {
  connected: boolean;
  isAdmin: boolean;
};

export type FeatureAvailability =
  | { enabled: true; status: "available" | "beta"; reason: null }
  | { enabled: false; status: FeatureAvailabilityStatus; reason: string };

export function evaluateFeatureAvailability(
  feature: FeatureAccess,
  context: FeatureContext,
): FeatureAvailability {
  if (feature.status === "planned") {
    return { enabled: false, status: feature.status, reason: "Not implemented yet" };
  }
  if (feature.adminOnly && !context.isAdmin) {
    return { enabled: false, status: feature.status, reason: "Administrator access required" };
  }
  if (feature.requiresServer && !context.connected) {
    return { enabled: false, status: feature.status, reason: "Connect to server" };
  }
  return { enabled: true, status: feature.status, reason: null };
}
