import { useEffect, useState } from "react";
import { CheckCircle2, Download, AlertCircle, X } from "lucide-react";

type DownloadStatus = "saving" | "saved" | "failed";
type DownloadEvent = { filename: string; status: DownloadStatus; detail?: string };
type DownloadNotice = DownloadEvent & { id: number };

export function DownloadStatusHost() {
  const [notice, setNotice] = useState<DownloadNotice | null>(null);

  useEffect(() => {
    let nextId = 0;
    let dismissTimer: ReturnType<typeof setTimeout> | undefined;
    const onStatus = (event: Event) => {
      const detail = (event as CustomEvent<DownloadEvent>).detail;
      if (!detail || !["saving", "saved", "failed"].includes(detail.status)) return;
      if (dismissTimer) clearTimeout(dismissTimer);
      const id = ++nextId;
      setNotice({ ...detail, id });
      if (detail.status !== "saving") {
        dismissTimer = setTimeout(() => setNotice(current => current?.id === id ? null : current), 6000);
      }
    };
    window.addEventListener("locat:download-status", onStatus);
    return () => {
      window.removeEventListener("locat:download-status", onStatus);
      if (dismissTimer) clearTimeout(dismissTimer);
    };
  }, []);

  if (!notice) return null;
  const saving = notice.status === "saving";
  const failed = notice.status === "failed";
  return (
    <div role="status" aria-live="polite" data-testid="download-status"
      className="pointer-events-none fixed inset-x-3 bottom-5 z-[90] flex justify-center">
      <div className="pointer-events-auto flex w-full max-w-md items-center gap-3 rounded-2xl border border-border/60 bg-card p-3 text-foreground shadow-xl">
        {saving ? <Download className="h-5 w-5 shrink-0" aria-hidden="true" /> :
          failed ? <AlertCircle className="h-5 w-5 shrink-0 text-destructive" aria-hidden="true" /> :
          <CheckCircle2 className="h-5 w-5 shrink-0" aria-hidden="true" />}
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">{saving ? "Saving attachment…" : failed ? "Download failed" : "Attachment saved"}</p>
          <p className="truncate text-xs text-secondary" title={notice.filename}>{notice.filename}</p>
          {failed && notice.detail && <p className="text-xs text-secondary">{notice.detail}</p>}
        </div>
        <button type="button" aria-label="Dismiss download status"
          className="rounded-lg p-2 text-secondary hover:bg-accent" onClick={() => setNotice(null)}>
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
