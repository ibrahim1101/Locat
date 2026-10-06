import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { trpc, queryClient } from '@/providers/trpc';
import { useAuth } from '@/state/auth';

type InstallEvent = Event & { prompt(): Promise<void>; userChoice: Promise<{ outcome: string }> };
export function Preferences() {
  const { state } = useAuth();
  if (state.status !== 'ready') return null;
  return <ReadyPreferences initialName={state.user.displayName} initialBio={state.user.bio ?? ''} />;
}

function ReadyPreferences({ initialName, initialBio }: { initialName: string; initialBio: string }) {
  const [theme, setTheme] = useState(() => localStorage.getItem('locat-theme') ?? 'dark');
  const [install, setInstall] = useState<InstallEvent | null>(null);
  const [feedback, setFeedback] = useState('');
  const [displayName, setDisplayName] = useState(initialName);
  const [bio, setBio] = useState(initialBio);
  const updateProfile = trpc.users.updateProfile.useMutation({
    onSuccess: async () => {
      await queryClient.invalidateQueries();
      setFeedback('Profile saved. Reloading your account…');
      window.location.reload();
    },
    onError: (error) => setFeedback(error.message),
  });
  useEffect(() => {
    const media = matchMedia('(prefers-color-scheme: dark)');
    const apply = () => document.documentElement.dataset.theme = theme === 'system' ? media.matches ? 'dark' : 'light' : theme;
    apply(); localStorage.setItem('locat-theme', theme);
    media.addEventListener('change', apply);
    return () => media.removeEventListener('change', apply);
  }, [theme]);
  useEffect(() => {
    const handler = (event: Event) => { event.preventDefault(); setInstall(event as InstallEvent); };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);
  return <div className="space-y-3 rounded-xl border p-3">
    <div className="space-y-2 border-b pb-3">
      <p className="text-sm font-medium">Public profile</p>
      <Input aria-label="Display name" value={displayName} maxLength={64} onChange={(e) => setDisplayName(e.target.value)} placeholder="Display name" />
      <textarea aria-label="Bio" value={bio} maxLength={280} onChange={(e) => setBio(e.target.value)} placeholder="Bio (optional)" className="min-h-20 w-full resize-y rounded-md border bg-background p-2 text-sm" />
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs text-secondary">{bio.length}/280</span>
        <Button disabled={updateProfile.isPending || !displayName.trim()} onClick={() => updateProfile.mutate({ displayName, bio })}>{updateProfile.isPending ? 'Saving…' : 'Save profile'}</Button>
      </div>
    </div>
    <label className="flex items-center justify-between gap-4 text-sm">Appearance
      <select aria-label="Appearance" className="rounded-md border bg-background p-2" value={theme} onChange={(e) => setTheme(e.target.value)}>
        <option value="dark">Dark</option><option value="light">Light</option><option value="system">System</option>
      </select>
    </label>
    <Button variant="outline" className="w-full" onClick={() => {
      if (install) void install.prompt().then(() => install.userChoice).then(() => setInstall(null)).catch(() => setFeedback('Use your browser menu to install Locat.'));
      else setFeedback('Android: browser menu → Install app / Add to Home screen. iPhone: Safari → Share → Add to Home Screen. Load Locat online once before opening offline.');
    }}>Install Locat on this device</Button>
    {feedback && <p role="status" className="text-xs text-secondary">{feedback}</p>}
  </div>;
}
