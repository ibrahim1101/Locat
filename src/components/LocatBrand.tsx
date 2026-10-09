import type { SVGProps } from "react";

/** Original cat-inspired Locat mark. Vector geometry is authored for this project. */
export function LocatMark({ className = "h-10 w-10", ...props }: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 96 96" fill="none" className={className} aria-hidden="true" {...props}>
      <defs>
        <linearGradient id="locat-metal" x1="12" y1="8" x2="82" y2="88" gradientUnits="userSpaceOnUse">
          <stop stopColor="#FFFFFF" /><stop offset=".36" stopColor="#C9CED5" /><stop offset=".7" stopColor="#737B87" /><stop offset="1" stopColor="#E5E9EE" />
        </linearGradient>
      </defs>
      <path d="M32 46C19 40 17 25 24 13L37 21C46 14 56 15 65 20L76 13C82 28 79 41 71 47C68 50 65 54 65 59C65 64 69 67 74 69" fill="url(#locat-metal)" />
      <circle cx="42" cy="32" r="2.5" fill="#101217" /><circle cx="61" cy="32" r="2.5" fill="#101217" />
      <path d="M28 37L13 33M27 43L11 44M71 38L84 34M71 43L87 44" stroke="url(#locat-metal)" strokeWidth="2.3" strokeLinecap="round" />
      <path d="M33 48C21 51 17 63 23 73C29 83 49 86 64 78C69 75 71 70 69 66C62 72 52 70 48 64C43 57 46 52 49 49" fill="url(#locat-metal)" />
      <path d="M26 77C43 91 68 88 83 76" stroke="url(#locat-metal)" strokeWidth="7" strokeLinecap="round" />
    </svg>
  );
}

export function LocatWordmark({ className = "" }: { className?: string }) {
  return <span className={`locat-wordmark ${className}`}>Locat</span>;
}
