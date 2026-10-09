import { useState, type ImgHTMLAttributes } from "react";

/**
 * Official Locat artwork, supplied by the project owner.
 * Keep the exact approved image in public/locat-official-logo.png.
 * A neutral monogram is used until that asset is committed, never the retired ghost mark.
 */
export function LocatMark({ className = "h-10 w-10", ...props }: Omit<ImgHTMLAttributes<HTMLImageElement>, "src" | "alt">) {
  const [failed, setFailed] = useState(false);
  if (failed) {
    return <span className={`inline-flex shrink-0 items-center justify-center rounded-xl bg-[#1a1c21] text-[#e8e9ed] font-bold ${className}`} aria-label="Locat">L</span>;
  }
  return <img src="/locat-official-logo.png" alt="" aria-hidden="true" decoding="async" className={`locat-official-mark shrink-0 object-contain ${className}`} onError={() => setFailed(true)} {...props} />;
}

export function LocatWordmark({ className = "" }: { className?: string }) {
  return <span className={`locat-wordmark ${className}`}>Locat</span>;
}
