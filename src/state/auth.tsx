import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { trpc, queryClient } from "@/providers/trpc";
import {
  generateIdentity,
  b64encode,
  importPublicKey,
  wrapPrivateKeyForBackup,
  unwrapPrivateKeyBackup,
  type IdentityKeys,
} from "@/lib/crypto";
import { stopDeviceNotifications } from "@/lib/notifications";
import { loadIdentity, saveIdentity } from "@/lib/localdb";

export type SessionUser = {
  id: number;
  username: string;
  displayName: string;
  bio: string | null;
  avatar?: string | null;
  publicKey: string;
  isAdmin?: boolean;
};

type AuthState =
  | { status: "loading" }
  | { status: "signedOut" }
  | { status: "needsKeyRestore"; user: SessionUser }
  | { status: "ready"; user: SessionUser; keys: IdentityKeys };

type AuthContextValue = {
  state: AuthState;
  login: (username: string, password: string) => Promise<void>;
  register: (username: string, displayName: string, password: string) => Promise<void>;
  restoreKeys: (password: string) => Promise<void>;
  resetIdentity: (password: string) => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ status: "loading" });
  const me = trpc.auth.me.useQuery(undefined, { retry: false, enabled: state.status === "loading" });
  const loginMut = trpc.auth.login.useMutation();
  const registerMut = trpc.auth.register.useMutation();
  const rotateMut = trpc.auth.rotateKeys.useMutation();
  const logoutMut = trpc.auth.logout.useMutation();
  const keyBackup = trpc.auth.keyBackup.useQuery(undefined, {
    enabled: false,
    retry: false,
  });

  // Cookies are shared between tabs: a login/logout elsewhere must retire old
  // queries and encryption state here before this tab can send as another account.
  useEffect(() => {
    const changed = (event: StorageEvent) => {
      if (event.key === "locat-auth-change") {
        queryClient.clear();
        window.location.reload();
      }
    };
    window.addEventListener("storage", changed);
    return () => window.removeEventListener("storage", changed);
  }, []);
  const notifyOtherTabs = useCallback(() => {
    try { localStorage.setItem("locat-auth-change", crypto.randomUUID()); } catch { /* unavailable storage */ }
  }, []);

  // bootstrap: cookie session → local identity keys
  useEffect(() => {
    if (state.status !== "loading" || me.isLoading) return;
    if (!me.data) {
      if (!navigator.onLine) {
        const cached = localStorage.getItem("locat-offline-account");
        if (cached) {
          void (async () => {
            try {
              const user = JSON.parse(cached) as SessionUser;
              const keys = await loadIdentity(user.id);
              if (keys) setState({ status: "ready", user, keys: { ...keys, publicKeyB64: user.publicKey } });
              else setState({ status: "signedOut" });
            } catch { setState({ status: "signedOut" }); }
          })();
          return;
        }
      }
      // Synchronize the external authentication query with the provider state.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setState({ status: "signedOut" });
      return;
    }
    const user = me.data as SessionUser;
    let cancelled = false;
    void (async () => {
      const id = await loadIdentity(user.id);
      if (cancelled) return;
      if (id && b64encode(await crypto.subtle.exportKey("spki", id.publicKey)) === user.publicKey) {
        localStorage.setItem("locat-offline-account", JSON.stringify(user));
        setState({ status: "ready", user, keys: { ...id, publicKeyB64: user.publicKey } });
      } else {
        setState({ status: "needsKeyRestore", user });
      }
    })().catch(() => { if (!cancelled) setState({ status: "needsKeyRestore", user }); });
    return () => { cancelled = true; };
  }, [me.isLoading, me.isError, me.data, state.status]);

  const finishWithKeys = useCallback(async (user: SessionUser, keys: IdentityKeys) => {
    await stopDeviceNotifications().catch(() => {});
    await queryClient.cancelQueries();
    queryClient.clear();
    await saveIdentity(user.id, { privateKey: keys.privateKey, publicKey: keys.publicKey });
    localStorage.setItem("locat-offline-account", JSON.stringify(user));
    setState({ status: "ready", user, keys });
    notifyOtherTabs();
  }, [notifyOtherTabs]);

  const login = useCallback(
    async (username: string, password: string) => {
      const res = await loginMut.mutateAsync({ username, password });
      const user = res.user as SessionUser;
      // new device: unwrap the password-protected backup from the server
      const privateKey = await unwrapPrivateKeyBackup(
        res.keys.encryptedPrivateKey,
        res.keys.keySalt,
        password,
      );
      const publicKey = await importPublicKey(res.keys.publicKey);
      await finishWithKeys(user, { privateKey, publicKey, publicKeyB64: res.keys.publicKey });
    },
    [loginMut, finishWithKeys],
  );

  const register = useCallback(
    async (username: string, displayName: string, password: string) => {
      const keys = await generateIdentity();
      const backup = await wrapPrivateKeyForBackup(keys, password);
      const res = await registerMut.mutateAsync({
        username,
        displayName,
        password,
        keys: {
          publicKey: keys.publicKeyB64,
          encryptedPrivateKey: backup.encryptedPrivateKey,
          keySalt: backup.keySalt,
        },
      });
      await finishWithKeys(res.user as SessionUser, keys);
    },
    [registerMut, finishWithKeys],
  );

  /** Restore identity keys on this device from the encrypted server backup. */
  const restoreKeys = useCallback(
    async (password: string) => {
      if (state.status !== "needsKeyRestore") return;
      const res = await keyBackup.refetch();
      if (!res.data) throw new Error("No key backup available on the server");
      const privateKey = await unwrapPrivateKeyBackup(
        res.data.encryptedPrivateKey,
        res.data.keySalt,
        password,
      );
      const publicKey = await importPublicKey(res.data.publicKey);
      await finishWithKeys(state.user, {
        privateKey,
        publicKey,
        publicKeyB64: res.data.publicKey,
      });
    },
    [state, keyBackup, finishWithKeys],
  );

  /**
   * Generate a fresh identity when the backup can't be decrypted.
   * Already-archived local messages stay readable (they're stored decrypted);
   * new messages use the new key pair.
   */
  const resetIdentity = useCallback(
    async (password: string) => {
      if (state.status !== "needsKeyRestore") return;
      const keys = await generateIdentity();
      const backup = await wrapPrivateKeyForBackup(keys, password);
      await rotateMut.mutateAsync({
        publicKey: keys.publicKeyB64,
        encryptedPrivateKey: backup.encryptedPrivateKey,
        keySalt: backup.keySalt,
      });
      await finishWithKeys({...state.user,publicKey:keys.publicKeyB64}, keys);
    },
    [state, rotateMut, finishWithKeys],
  );

  const logout = useCallback(async () => {
    await logoutMut.mutateAsync();
    await stopDeviceNotifications().catch(() => {});
    localStorage.removeItem("locat-offline-account");
    setState({ status: "signedOut" });
    await queryClient.cancelQueries();
    queryClient.clear();
    notifyOtherTabs();
  }, [logoutMut, notifyOtherTabs]);

  const value = useMemo(
    () => ({ state, login, register, restoreKeys, resetIdentity, logout }),
    [state, login, register, restoreKeys, resetIdentity, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
