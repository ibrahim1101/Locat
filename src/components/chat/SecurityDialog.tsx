import { kvGet, kvSet } from "@/lib/localdb";
import { Button } from "@/components/ui/button";
import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { keyFingerprintB64 } from "@/lib/crypto";
import { useAuth } from "@/state/auth";
import type { ConversationSummary } from "@contracts/types";

/**
 * Safety-number style panel: both sides can compare these fingerprints
 * in person (or another channel) to verify nobody tampered with the
 * public-key directory.
 */
export function SecurityDialog({
  conversation,
  open,
  onOpenChange,
  onVerified,
}: {
  conversation: ConversationSummary | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onVerified: () => void;
}) {
  const { state } = useAuth();
  const [changed, setChanged] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [fps, setFps] = useState<{ label: string; fp: string }[]>([]);

  useEffect(() => {
    if (!open || !conversation || state.status !== "ready") return;
    void (async () => {
      const mine = { label: `You (@${state.user.username})`, key: state.keys.publicKeyB64 };
      const others = conversation.members
        .filter((m) => m.id !== state.user.id)
        .map((m) => ({ label: `${m.displayName} (@${m.username})`, key: m.publicKey }));
      const out = [];
      for (const e of [mine, ...others]) {
        out.push({ label: e.label, fp: await keyFingerprintB64(e.key) });
      }
      setFps(out);
      let changedKey = false;
      for (const member of conversation.members.filter((m) => m.id !== state.user.id)) {
        const pin = await kvGet<string>(state.user.id, `contact-key-${member.id}`);
        if (pin && pin !== member.publicKey) changedKey = true;
      }
      setChanged(changedKey);
    })();
  }, [open, conversation, state]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="surface-2 border sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="tracking-tight">Encryption keys</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-secondary">
          Messages in this conversation are end-to-end encrypted. Compare these key fingerprints
          with the other person on a trusted channel to verify the connection.
        </p>
        {changed && <p role="alert" className="text-sm text-destructive">A contact's encryption key changed. Verify the fingerprints through another trusted channel before accepting.</p>}
        <div className="space-y-3">
          {fps.map((f) => (
            <div key={f.label} className="rounded-md border bg-background p-3">
              <p className="micro-label mb-1 normal-case tracking-normal">{f.label}</p>
              <p className="font-mono-ui break-all text-sm tracking-wider text-primary">
                {f.fp.match(/.{1,4}/g)?.join(" ")}
              </p>
            </div>
          ))}
        </div>
        <Button onClick={() => {
          if (!conversation || state.status !== "ready") return;
          void Promise.all(conversation.members.filter((m) => m.id !== state.user.id).map((m) => kvSet(state.user.id, `contact-key-${m.id}`, m.publicKey)))
            .then(() => { setChanged(false); setFeedback("These contact keys are now trusted on this device."); onVerified(); })
            .catch(() => setFeedback("Could not save verification."));
        }}>I compared and trust these keys</Button>
        {feedback && <p role="status" className="text-xs">{feedback}</p>}
        <p className="micro-label normal-case tracking-normal">
          The relay never sees these private keys — only encrypted envelopes.
        </p>
      </DialogContent>
    </Dialog>
  );
}
