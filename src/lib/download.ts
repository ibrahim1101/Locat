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

function browserDependencies(): DownloadDependencies {
  return {
    saveSelected: saveToSelectedFolder,
    isNativeShell: () => typeof window !== "undefined" && Boolean(window.Capacitor?.isNativePlatform?.()),
    createObjectURL: (blob) => URL.createObjectURL(blob),
    revokeObjectURL: (url) => URL.revokeObjectURL(url),
    createLink: () => document.createElement("a"),
    appendLink: (link) => document.body.append(link as HTMLAnchorElement),
    schedule: (callback, delayMs) => setTimeout(callback, delayMs),
  };
}

/** Save to the Android folder when selected, otherwise use the browser download manager. */
export async function downloadBlob(
  blob: Blob,
  filename: string,
  overrides: Partial<DownloadDependencies> = {},
): Promise<DownloadDestination> {
  const dependencies = { ...browserDependencies(), ...overrides };
  try {
    if (await dependencies.saveSelected(filename, blob.type, await blobBase64(blob)))
      return "selected-folder";
  } catch {
    throw new Error(
      "Locat could not write to the selected Android folder. Open Settings & backups, choose the folder again, then retry. No browser copy was created.",
    );
  }
  if (dependencies.isNativeShell()) {
    throw new Error("Android native downloads are not available in this build. Open Settings & backups and select a folder with the LocatStorage plugin, or download from a desktop browser. No file was saved.");
  }
  const url = dependencies.createObjectURL(blob);
  const link = dependencies.createLink();
  link.href = url;
  link.download = filename;
  dependencies.appendLink(link);
  link.click();
  link.remove();
  dependencies.schedule(() => dependencies.revokeObjectURL(url), 60_000);
  return "browser";
}
