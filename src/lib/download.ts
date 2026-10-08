import { saveToSelectedFolder } from "./storagePreference";

async function blobBase64(blob: Blob): Promise<string> {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let text = "";
  for (let i = 0; i < bytes.length; i += 0x8000)
    text += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(text);
}

export type DownloadDestination = "selected-folder" | "browser";

/** Save to the Android folder when selected, otherwise use the browser download manager. */
export async function downloadBlob(blob: Blob, filename: string): Promise<DownloadDestination> {
  try {
    if (await saveToSelectedFolder(filename, blob.type, await blobBase64(blob)))
      return "selected-folder";
  } catch {
    throw new Error(
      "Locat could not write to the selected Android folder. Open Settings & backups, choose the folder again, then retry. No browser copy was created.",
    );
  }
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
  return "browser";
}
