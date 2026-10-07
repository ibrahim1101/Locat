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

export function useInternalStorage(): StoragePreference {
  localStorage.setItem(STORAGE_MODE_KEY, "internal");
  return storagePreference();
}

export async function chooseUserStorageFolder(): Promise<StoragePreference> {
  if (!window.LocatStorage?.pickDirectory) throw new Error("Folder selection is available in the Locat Android app.");
  const result = await window.LocatStorage.pickDirectory();
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
    LocatStorage?: {
      pickDirectory(): Promise<{ uri: string; name?: string | null }>;
    };
  }
}
