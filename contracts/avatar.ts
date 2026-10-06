import { z } from "zod";

// Embedded thumbnails only: no remote URLs, SVG or executable content.
export const avatarSchema = z.string().max(40_000).regex(/^data:image\/jpeg;base64,[A-Za-z0-9+/]+={0,2}$/)
  .refine(value => {
    try {
      const bytes = Uint8Array.from(atob(value.split(",")[1]), c => c.charCodeAt(0));
      return bytes.length <= 30_000 && bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255
        && bytes.at(-2) === 255 && bytes.at(-1) === 217;
    } catch { return false; }
  }, "Use a JPEG profile thumbnail smaller than 30 KB.");
