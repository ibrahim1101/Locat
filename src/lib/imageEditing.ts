export type CropPreset = "original" | "square" | "portrait" | "wide";
export type ImageEdit = { turns: number; crop: CropPreset; zoom: number; x: number; y: number };
export const DEFAULT_IMAGE_EDIT: ImageEdit = { turns: 0, crop: "original", zoom: 1, x: .5, y: .5 };
function dimensions(width: number, height: number) {
  if (![width, height].every(n => Number.isFinite(n) && n > 0 && n <= 100_000)) throw new Error("Invalid image dimensions.");
}
export function imageStageSize(width: number, height: number, turns: number) {
  dimensions(width, height);
  if (!Number.isInteger(turns) || turns < 0 || turns > 3) throw new Error("Invalid rotation.");
  const scale = Math.min(1, 1600 / Math.max(width, height));
  const baseWidth = Math.max(1, Math.round(width * scale)), baseHeight = Math.max(1, Math.round(height * scale));
  return { baseWidth, baseHeight, width: turns % 2 ? baseHeight : baseWidth, height: turns % 2 ? baseWidth : baseHeight };
}
export function imageCropRect(width: number, height: number, edit: ImageEdit) {
  dimensions(width, height);
  if (![edit.zoom, edit.x, edit.y].every(Number.isFinite) || edit.zoom < 1 || edit.zoom > 3 || edit.x < 0 || edit.x > 1 || edit.y < 0 || edit.y > 1) throw new Error("Invalid crop position.");
  const ratios: Record<CropPreset, number> = { original: width / height, square: 1, portrait: 3 / 4, wide: 16 / 9 };
  const ratio = ratios[edit.crop]; if (!ratio) throw new Error("Invalid crop preset.");
  const w = Math.min(width, height * ratio) / edit.zoom, h = w / ratio;
  return { x: Math.max(0, width - w) * edit.x, y: Math.max(0, height - h) * edit.y, width: w, height: h };
}
export function renderImageEdit(decoded: { image: CanvasImageSource; width: number; height: number }, edit: ImageEdit): HTMLCanvasElement {
  const size = imageStageSize(decoded.width, decoded.height, edit.turns);
  const stage = document.createElement("canvas"); stage.width = size.width; stage.height = size.height;
  const context = stage.getContext("2d"); if (!context) throw new Error("Image editing is unavailable on this device.");
  context.fillStyle = "#ffffff"; context.fillRect(0, 0, size.width, size.height);
  context.translate(size.width / 2, size.height / 2); context.rotate(edit.turns * Math.PI / 2);
  context.drawImage(decoded.image, -size.baseWidth / 2, -size.baseHeight / 2, size.baseWidth, size.baseHeight);
  const crop = imageCropRect(size.width, size.height, edit);
  const output = document.createElement("canvas"); output.width = Math.max(1, Math.round(crop.width)); output.height = Math.max(1, Math.round(crop.height));
  const target = output.getContext("2d"); if (!target) throw new Error("Image editing is unavailable on this device.");
  target.drawImage(stage, crop.x, crop.y, crop.width, crop.height, 0, 0, output.width, output.height);
  return output;
}
export async function editedImageFile(canvas: HTMLCanvasElement, originalName: string): Promise<File> {
  for (const quality of [.9, .82, .7]) {
    const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(b => b ? resolve(b) : reject(new Error("Could not export the edited image.")), "image/jpeg", quality));
    if (blob.size <= 2_900_000) return new File([blob], `${originalName.replace(/\.[^.]*$/, "").replace(/[\\/]/g, "_").slice(0, 200) || "image"}-edited.jpg`, { type: "image/jpeg" });
  }
  throw new Error("Edited image is too large. Choose a smaller crop.");
}
