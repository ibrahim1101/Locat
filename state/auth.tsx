import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { trpc } from "@/providers/trpc";
import {
  generateIdentity,
  importPublicKey,
  wrapPrivateKeyForBackup,
  unwrapPrivateKeyBackup,
  type IdentityKeys,
} from "@/lib/crypto";
import { loadIdentity, saveIdentity } from "@/lib/localdb";

export type SessionUser = {
  id: number;
  username: string;
  displayName: string;
  publicKey: string;
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
  const me = trpc.auth.me.useQuery(undefined, { retry: false });
  const loginMut = trpc.auth.login.useMutation();
  const registerMut = trpc.auth.register.useMutation();
  const rotateMut = trpc.auth.rotateKeys.useMutation();
  const logoutMut = trpc.auth.logout.useMutation();
  const keyBackup = trpc.auth.keyBackup.useQuery(undefined, {
    enabled: false,
    retry: false,
  });

  // bootstrap: cookie session → local identity keys
  useEffect(() => {
    if (me.isLoading) return;
    if (!me.data) {
      setState({ status: "signedOut" });
      return;
    }
    const user = me.data as SessionUser;
    void (async () => {
      const id = await loadIdentity(user.id);
      if (id) {
        setState({ status: "ready", user, keys: { ...id, publicKeyB64: user.publicKey } });
      } else {
        setState({ status: "needsKeyRestore", user });
      }
    })();
  }, [me.isLoading, me.data]);

  const finishWithKeys = useCallback(async (user: SessionUser, keys: IdentityKeys) => {
    await saveIdentity(user.id, { privateKey: keys.privateKey, publicKey: keys.publicKey });
    setState({ status: "ready", user, keys });
  }, []);

  const login = useCallback(
    async (username: string, password: string) => {
      const res = await loginMut.mutateAsync({ username, password });
      const user = res.user as SessionUser;
      const local = await loadIdentity(user.id);
      if (local) {
        await finishWithKeys(user, { ...local, publicKeyB64: user.publicKey });
        return;
      }
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
      await finishWithKeys(state.user, keys);
    },
    [state, rotateMut, finishWithKeys],
  );

  const logout = useCallback(async () => {
    try {
      await logoutMut.mutateAsync();
    } finally {
      setState({ status: "signedOut" });
    }
  }, [logoutMut]);

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
