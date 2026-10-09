import {
  MessageCircle, ShieldAlert, Radio, Lock, Users, Server, WifiOff,
  KeyRound, Workflow, Search, Calendar, Share2, Puzzle, LayoutDashboard,
  type LucideIcon,
} from "lucide-react";

export type ModuleStatus = "available" | "beta" | "planned";

export type LocatModule = {
  id: string;
  name: string;
  tagline: string;
  description: string;
  icon: LucideIcon;
  route: string;
  status: ModuleStatus;
  /** Roadmap milestone this module is scheduled for. */
  milestone: string;
  /** Show in the primary mobile bottom-nav / desktop rail. */
  primary?: boolean;
  adminOnly?: boolean;
};

/**
 * Single source of truth for the Locat ecosystem. The launcher only ever links
 * to modules whose status is "available" / "beta" — "planned" modules are shown
 * honestly as upcoming, never as working screens. As each milestone ships, flip
 * the relevant status here.
 */
export const MODULES: LocatModule[] = [
  {
    id: "dashboard", name: "Dashboard", tagline: "Ecosystem home",
    description: "Your private command center across every Locat module.",
    icon: LayoutDashboard, route: "/", status: "available", milestone: "M0", primary: true,
  },
  {
    id: "messages", name: "Messages", tagline: "End-to-end encrypted chat",
    description: "Direct and group conversations, encrypted on your device.",
    icon: MessageCircle, route: "/messages", status: "available", milestone: "M0", primary: true,
  },
  {
    id: "sentinel", name: "Sentinel", tagline: "Security incidents & alerts",
    description: "Token-authed webhooks, severity alerts and incident response for nScout & PipelineGuard.",
    icon: ShieldAlert, route: "/sentinel", status: "available", milestone: "M1", primary: true,
  },
  {
    id: "link", name: "Link", tagline: "Secure device transfer",
    description: "Pair your devices and move files, clipboard and actions between them, encrypted.",
    icon: Radio, route: "/link", status: "available", milestone: "M2",
  },
  {
    id: "vault", name: "Vault", tagline: "Encrypted file storage",
    description: "Client-side encrypted files and folders with authorized sharing.",
    icon: Lock, route: "/vault", status: "planned", milestone: "M3",
  },
  {
    id: "workspace", name: "Workspace", tagline: "Team collaboration",
    description: "Project spaces, Kanban boards, tasks and shared notes with roles.",
    icon: Users, route: "/workspace", status: "planned", milestone: "later",
  },
  {
    id: "hub", name: "Hub", tagline: "Server monitoring",
    description: "Self-hosted CPU, memory, storage and service health via a least-privilege agent.",
    icon: Server, route: "/hub", status: "planned", milestone: "later",
  },
  {
    id: "offline", name: "Offline", tagline: "LAN-only messaging",
    description: "Keep talking over the local network when the internet is down.",
    icon: WifiOff, route: "/offline", status: "planned", milestone: "later",
  },
  {
    id: "secrets", name: "Secrets", tagline: "Credential manager",
    description: "Passphrase-locked notes and credentials with key derivation and auto-lock.",
    icon: KeyRound, route: "/secrets", status: "planned", milestone: "later",
  },
  {
    id: "automate", name: "Automate", tagline: "Workflows",
    description: "Notification, backup, security-alert and task automation rules.",
    icon: Workflow, route: "/automate", status: "planned", milestone: "later",
  },
  {
    id: "search", name: "Search", tagline: "Universal search",
    description: "Authorized search across your messages, notes, files and tasks.",
    icon: Search, route: "/search", status: "planned", milestone: "later",
  },
  {
    id: "calendar", name: "Calendar", tagline: "Events & reminders",
    description: "Personal and shared events with reminders.",
    icon: Calendar, route: "/calendar", status: "planned", milestone: "later",
  },
  {
    id: "share", name: "Share", tagline: "Expiring links",
    description: "Expiring file links, access limits, QR sharing and Android share-sheet.",
    icon: Share2, route: "/share", status: "planned", milestone: "later",
  },
  {
    id: "extensions", name: "Extensions", tagline: "Integrations",
    description: "Permission-scoped module manifests with safe enable/disable.",
    icon: Puzzle, route: "/extensions", status: "planned", milestone: "later",
  },
];

export const moduleById = (id: string) => MODULES.find((m) => m.id === id);
export const availableModules = MODULES.filter((m) => m.status !== "planned");
