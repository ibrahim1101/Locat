/** Adapted from ibrahim1101/locat-ui (Emergent design kit).
 * Presentation-only avatar. No mock adapter, session or network dependencies.
 */
export type TitaniumAvatarUser = {
  id: string | number;
  displayName: string;
  avatarUrl?: string | null;
  online?: boolean;
};

function hueForId(id: string | number): number {
  const input = String(id);
  let hash = 0;
  for (const char of input) hash = (Math.imul(hash, 31) + char.charCodeAt(0)) | 0;
  return Math.abs(hash % 360);
}

export function TitaniumAvatar({
  user, size = 40, showPresence = false,
}: {
  user: TitaniumAvatarUser;
  size?: number;
  showPresence?: boolean;
}) {
  const hue = hueForId(user.id);
  const initials = user.displayName.trim().split(/\s+/).slice(0, 2)
    .map(part => part[0]?.toUpperCase() ?? "").join("");
  return (
    <span className="relative inline-block shrink-0" style={{ width: size, height: size }}>
      <span className="flex h-full w-full items-center justify-center overflow-hidden rounded-full font-medium uppercase"
        style={{ backgroundColor: `hsl(${hue} 45% 16%)`, color: `hsl(${hue} 80% 72%)`, fontSize: size * 0.34 }}>
        {user.avatarUrl ? <img src={user.avatarUrl} alt="" className="h-full w-full rounded-full object-cover" /> : initials}
      </span>
      {showPresence && <span aria-label={user.online ? "Online" : "Offline"}
        className={`absolute bottom-0 right-0 rounded-full ring-2 ring-background ${user.online ? "bg-steel" : "bg-[hsl(0_0%_26%)]"}`}
        style={{ width: Math.max(10, size * 0.28), height: Math.max(10, size * 0.28) }} />}
    </span>
  );
}
