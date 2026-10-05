import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';

type InstallEvent = Event & { prompt(): Promise<void>; userChoice: Promise<{ outcome: string }> };
export function Preferences() {
  const [theme, setTheme] = useState(() => localStorage.getItem('locat-theme') ?? 'dark');
  const [install, setInstall] = useState<InstallEvent | null>(null);
  const [feedback, setFeedback] = useState('');
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
