import { avatarSchema } from "@contracts/avatar";
import { decodeBrowserImage } from "./browserImage";

export async function prepareProfilePicture(file: File): Promise<string> {
  if (!["image/jpeg", "image/png", "image/webp", "image/gif", "image/avif"].includes(file.type))
    throw new Error("Choose a JPEG, PNG, WebP, GIF or AVIF image.");
  if (file.size > 10 * 1024 * 1024) throw new Error("Choose an image smaller than 10 MB.");
  const bitmap = await decodeBrowserImage(file);
  try {
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 128;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Image editing is unavailable in this browser.");
    const edge = Math.min(bitmap.width, bitmap.height);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, 128, 128);
    ctx.drawImage(bitmap.image, (bitmap.width - edge) / 2, (bitmap.height - edge) / 2, edge, edge, 0, 0, 128, 128);
    // Only this re-encoded thumbnail is uploaded; original metadata is discarded.
    return avatarSchema.parse(canvas.toDataURL("image/jpeg", 0.82));
  } finally { bitmap.close(); }
}
