const STORAGE_MODE_KEY = "locat-storage-mode";
const STORAGE_TREE_KEY = "locat-storage-tree";

export type StorageMode = "internal" | "user-folder";

export type StoragePreference = {
  mode: StorageMode;
  treeUri: string | null;
  label: string | null;
};

export function storagePreference(): StoragePreference {
  const mode = localStorage.getItem(STORAGE_MODE_KEY) === "user-folder" ? "user-folder" : "internal";
  const treeUri = localStorage.getItem(STORAGE_TREE_KEY);
  return { mode: mode === "user-folder" && treeUri ? mode : "internal", treeUri, label: treeUri ? displayTreeUri(treeUri) : null };
}

export function selectInternalStorage(): StoragePreference {
  localStorage.setItem(STORAGE_MODE_KEY, "internal");
  return storagePreference();
}

export async function chooseUserStorageFolder(): Promise<StoragePreference> {
  const plugin = androidStoragePlugin();
  if (!plugin?.pickDirectory) throw new Error("Android folder picker is unavailable in this build. Update Locat to a build with the native storage plugin.");
  const result = await plugin.pickDirectory();
  if (!result?.uri) throw new Error("No storage folder was selected.");
  localStorage.setItem(STORAGE_TREE_KEY, result.uri);
  localStorage.setItem(STORAGE_MODE_KEY, "user-folder");
  return { mode: "user-folder", treeUri: result.uri, label: result.name || displayTreeUri(result.uri) };
}

export function displayTreeUri(uri: string): string {
  try {
    const decoded = decodeURIComponent(uri);
    const part = decoded.split("/").pop()?.split(":").pop();
    return part || "Selected Android folder";
  } catch {
    return "Selected Android folder";
  }
}

declare global {
  interface Window {
    Capacitor?: { Plugins?: { LocatStorage?: Window["LocatStorage"] } };
    LocatStorage?: {
      pickDirectory(): Promise<{ uri: string; name?: string | null }>;
      writeFile(options: { treeUri: string; name: string; mime: string; dataB64: string }): Promise<{ uri: string; name?: string | null }>;
    };
  }
}

function androidStoragePlugin() {
  // Capacitor registers native plugins under window.Capacitor.Plugins, not directly on window.
  return window.Capacitor?.Plugins?.LocatStorage ?? window.LocatStorage;
}

export async function saveToSelectedFolder(name: string, mime: string, dataB64: string): Promise<boolean> {
  const pref = storagePreference();
  if (pref.mode !== "user-folder") return false;
  const plugin = androidStoragePlugin();
  if (!pref.treeUri || !plugin?.writeFile)
    throw new Error("The selected Android folder is unavailable. Choose it again.");
  await plugin.writeFile({ treeUri: pref.treeUri, name, mime: mime || "application/octet-stream", dataB64 });
  return true;
}
