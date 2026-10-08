import { isNativeShell } from "@/lib/native";
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { appearanceEvent, getAppearance, setAppearance, type Theme, type Accent } from '@/lib/appearance';

type InstallEvent = Event & { prompt(): Promise<void>; userChoice: Promise<{ outcome: string }> };
export function Preferences() {
  const [appearance, updateAppearance] = useState(getAppearance);
  const [readReceipts, setReadReceipts] = useState(() => localStorage.getItem('locat-read-receipts') !== 'off');
  const [install, setInstall] = useState<InstallEvent | null>(null);
  const [feedback, setFeedback] = useState('');
  useEffect(() => {
    const changed = () => updateAppearance(getAppearance());
    window.addEventListener(appearanceEvent, changed);
    return () => window.removeEventListener(appearanceEvent, changed);
  }, []);
  useEffect(() => {
    const handler = (event: Event) => { event.preventDefault(); setInstall(event as InstallEvent); };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);
  return <div className="space-y-3 rounded-xl border p-3">
    <label className="flex items-center justify-between gap-4 text-sm">Appearance
      <select aria-label="Appearance" className="min-h-11 rounded-md border bg-background p-2" value={appearance.theme} onChange={(e) => {
        if (!setAppearance({ ...appearance, theme: e.target.value as Theme })) setFeedback('Appearance changed for this session. Browser storage prevented saving it.');
      }}>
        <option value="dark">Dark</option><option value="light">Light</option><option value="system">System</option>
      </select>
    </label>
    <label className="flex items-center justify-between gap-4 text-sm">Accent color
      <select aria-label="Accent color" className="min-h-11 rounded-md border bg-background p-2" value={appearance.accent} onChange={e => {
        if (!setAppearance({ ...appearance, accent: e.target.value as Accent })) setFeedback('Appearance changed for this session. Browser storage prevented saving it.');
      }}>
        <option value="teal">Teal</option><option value="blue">Blue</option><option value="violet">Violet</option><option value="rose">Rose</option>
      </select>
    </label>
    <p className="text-xs text-secondary">Saved for this browser. System follows your device appearance even with Settings closed.</p>
    <label className="flex items-center justify-between gap-4 text-sm">Send read receipts
      <input type="checkbox" checked={readReceipts} onChange={(event) => {
        setReadReceipts(event.target.checked);
        localStorage.setItem('locat-read-receipts', event.target.checked ? 'on' : 'off');
      }} />
    </label>
    {!isNativeShell() && <Button variant="outline" className="w-full" onClick={() => {
      if (install) void install.prompt().then(() => install.userChoice).then(() => setInstall(null)).catch(() => setFeedback('Use your browser menu to install Locat.'));
      else setFeedback('Android: browser menu → Install app / Add to Home screen. iPhone: Safari → Share → Add to Home Screen. Load Locat online once before opening offline.');
    }}>Install Locat on this device</Button>}
    {feedback && <p role="status" className="text-xs text-secondary">{feedback}</p>}
  </div>;
}
