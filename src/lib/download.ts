import { saveToSelectedFolder } from "./storagePreference";

async function blobBase64(blob: Blob): Promise<string> {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let text = "";
  for (let i = 0; i < bytes.length; i += 0x8000)
    text += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(text);
}

export type DownloadDestination = "selected-folder" | "browser";

type DownloadLink = {
  href: string;
  download: string;
  click(): void;
  remove(): void;
};

export type DownloadDependencies = {
  saveSelected: typeof saveToSelectedFolder;
  createObjectURL(blob: Blob): string;
  revokeObjectURL(url: string): void;
  createLink(): DownloadLink;
  appendLink(link: DownloadLink): void;
  schedule(callback: () => void, delayMs: number): unknown;
  isNativeShell(): boolean;
};

const activeDownloads = new Map<string, Promise<DownloadDestination>>();

function notifyDownload(filename: string, status: "saving" | "saved" | "failed", detail?: string): void {
  if (typeof window !== "undefined")
    window.dispatchEvent(new CustomEvent("locat:download-status", { detail: { filename, status, detail } }));
}

function browserDependencies(): DownloadDependencies {
  return {
    saveSelected: saveToSelectedFolder,
    isNativeShell: () => typeof window !== "undefined" && Boolean((window.Capacitor as { isNativePlatform?: () => boolean } | undefined)?.isNativePlatform?.()),
    createObjectURL: (blob) => URL.createObjectURL(blob),
    revokeObjectURL: (url) => URL.revokeObjectURL(url),
    createLink: () => document.createElement("a"),
    appendLink: (link) => document.body.append(link as HTMLAnchorElement),
    schedule: (callback, delayMs) => setTimeout(callback, delayMs),
  };
}

/** Save to the Android folder when selected, otherwise use the browser download manager. */
export function downloadBlob(
  blob: Blob,
  filename: string,
  overrides: Partial<DownloadDependencies> = {},
): Promise<DownloadDestination> {
  // Coalesce overlapping requests for the same attachment; do not suppress later intentional saves.
  const key = filename + "\\0" + blob.size + "\\0" + blob.type;
  const existing = activeDownloads.get(key);
  if (existing) return existing;

  const operation = (async (): Promise<DownloadDestination> => {
    notifyDownload(filename, "saving");
    try {
      const dependencies = { ...browserDependencies(), ...overrides };
      let destination: DownloadDestination;
      try {
        if (await dependencies.saveSelected(filename, blob.type, await blobBase64(blob))) {
          destination = "selected-folder";
        } else if (dependencies.isNativeShell()) {
          throw new Error("Android native downloads are not available in this build. Select an Android folder in Settings & backups. No file was saved.");
        } else {
          const url = dependencies.createObjectURL(blob);
          const link = dependencies.createLink();
          link.href = url;
          link.download = filename;
          dependencies.appendLink(link);
          link.click();
          link.remove();
          dependencies.schedule(() => dependencies.revokeObjectURL(url), 60_000);
          destination = "browser";
        }
      } catch (error) {
        if (error instanceof Error && error.message.startsWith("Android native downloads")) throw error;
        throw new Error("Locat could not save the attachment. Open Settings & backups, choose the folder again, then retry. No file was saved.");
      }
      notifyDownload(filename, "saved", destination);
      return destination;
    } catch (error) {
      notifyDownload(filename, "failed", error instanceof Error ? error.message : "Download failed");
      throw error;
    }
  })();
  activeDownloads.set(key, operation);
  void operation.finally(() => {
    if (activeDownloads.get(key) === operation) activeDownloads.delete(key);
  }).catch(() => undefined);
  return operation;
}
