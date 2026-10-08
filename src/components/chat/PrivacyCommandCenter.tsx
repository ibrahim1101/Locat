import { ArrowLeft, Activity, Fingerprint, KeyRound, LockKeyhole, ShieldCheck, Smartphone } from "lucide-react";
import { DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const tiles = [
  {
    title: "Encryption",
    description: "Messages are encrypted on your device before delivery. Compare keys with contacts to verify their identity.",
    status: "Available",
    Icon: LockKeyhole,
  },
  {
    title: "Identity",
    description: "Open any conversation and select its shield icon to compare contact-key fingerprints.",
    status: "Available in chats",
    Icon: Fingerprint,
  },
  {
    title: "Recovery Key",
    description: "Secure account recovery is not available yet. Keep your existing identity-key backup safe.",
    status: "Coming later",
    Icon: KeyRound,
  },
  {
    title: "Link Device",
    description: "Device pairing is not available yet. Signing in on another device ends the existing session.",
    status: "Coming later",
    Icon: Smartphone,
  },
] as const;

/** A read-only overview: never imply that unreleased security features work. */
export function PrivacyCommandCenter({ onBack }: { onBack: () => void }) {
  return (
    <div className="space-y-5">
      <div className="flex items-start gap-3">
        <button
          type="button"
          onClick={onBack}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border bg-background/70 text-secondary hover:bg-accent hover:text-foreground"
          aria-label="Back to settings"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold tracking-wide text-muted-foreground">Locat</p>
          <DialogHeader className="text-left">
            <DialogTitle className="text-xl tracking-tight">Privacy Command Center</DialogTitle>
            <DialogDescription>Understand the protections available for your account and conversations.</DialogDescription>
          </DialogHeader>
        </div>
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-primary/30 bg-primary/10" aria-hidden="true">
          <ShieldCheck className="h-5 w-5 text-primary" />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {tiles.map(({ title, description, status, Icon }) => (
          <section key={title} className="titanium-panel flex min-h-44 min-w-0 flex-col rounded-2xl p-3 sm:p-4" aria-label={title}>
            <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl border border-border/80 bg-background/80" aria-hidden="true">
              <Icon className="h-5 w-5 text-foreground" />
            </div>
            <h3 className="text-sm font-semibold tracking-tight">{title}</h3>
            <p className="mt-1 flex-1 text-xs leading-relaxed text-muted-foreground">{description}</p>
            <p className="mt-3 border-t border-border/70 pt-2 text-[11px] font-medium text-secondary">{status}</p>
          </section>
        ))}
      </div>

      <section className="smoked-glass rounded-2xl p-4" aria-labelledby="locat-security-activity">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border bg-background/70" aria-hidden="true">
            <Activity className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h3 id="locat-security-activity" className="text-sm font-semibold">Security activity</h3>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              Unexpected contact-key changes are flagged when you open that conversation's fingerprint verification. A central activity log is not available yet.
            </p>
          </div>
        </div>
      </section>

      <p className="rounded-xl border border-border/70 bg-background/60 p-3 text-xs leading-relaxed text-muted-foreground">
        Privacy note: end-to-end encryption protects message contents in transit, but chat history stored on this device is not encrypted at rest. The server handles account and delivery metadata. Keep encrypted backups of important conversations.
      </p>
    </div>
  );
}
