import { avatarHue, initials } from "@/lib/format";

export function Avatar({
  name,
  id,
  size = 40,
  online,
}: {
  name: string;
  id: number;
  size?: number;
  online?: boolean;
}) {
  const hue = avatarHue(id);
  return (
    <span className="relative inline-block shrink-0" style={{ width: size, height: size }}>
      <span
        className="flex h-full w-full items-center justify-center rounded-full font-medium uppercase"
        style={{
          backgroundColor: `hsl(${hue} 45% 16%)`,
          color: `hsl(${hue} 80% 72%)`,
          fontSize: size * 0.34,
        }}
      >
        {initials(name)}
      </span>
      {online !== undefined && (
        <span
          className={`absolute bottom-0 right-0 rounded-full ring-2 ring-background ${
            online ? "bg-primary" : "bg-[hsl(0_0%_26%)]"
          }`}
          style={{ width: size * 0.28, height: size * 0.28 }}
        />
      )}
    </span>
  );
}

/** Overlapping avatar stack with ring borders (group conversations). */
export function AvatarStack({
  members,
  size = 40,
}: {
  members: { id: number; displayName: string }[];
  size?: number;
}) {
  const shown = members.slice(0, 3);
  return (
    <span className="relative flex shrink-0" style={{ width: size + (shown.length - 1) * 12, height: size }}>
      {shown.map((m, i) => (
        <span
          key={m.id}
          className="absolute rounded-full ring-2 ring-background"
          style={{ left: i * 12, zIndex: shown.length - i }}
        >
          <Avatar name={m.displayName} id={m.id} size={size} />
        </span>
      ))}
    </span>
  );
}
