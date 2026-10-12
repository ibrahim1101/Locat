import { DEFAULT_IMAGE_EDIT, renderImageEdit, type ImageEdit } from "./imageEditing";
export type PhotoStroke = { color: string; size: number; points: { x: number; y: number }[] };
export type PhotoText = { text: string; color: string; size: number; x: number; y: number };
export type PhotoEdit = { geometry: ImageEdit; brightness: number; contrast: number; saturation: number; grayscale: number; blur: number; flipX: boolean; flipY: boolean; strokes: PhotoStroke[]; texts: PhotoText[] };
export function defaultPhotoEdit(): PhotoEdit { return { geometry: { ...DEFAULT_IMAGE_EDIT }, brightness: 100, contrast: 100, saturation: 100, grayscale: 0, blur: 0, flipX: false, flipY: false, strokes: [], texts: [] }; }
export function photoFilter(edit: PhotoEdit): string {
  if (![edit.brightness, edit.contrast, edit.saturation].every(value => Number.isFinite(value) && value >= 0 && value <= 200) || !Number.isFinite(edit.grayscale) || edit.grayscale < 0 || edit.grayscale > 100 || !Number.isFinite(edit.blur) || edit.blur < 0 || edit.blur > 10) throw new Error("Invalid photo adjustment.");
  return `brightness(${edit.brightness}%) contrast(${edit.contrast}%) saturate(${edit.saturation}%) grayscale(${edit.grayscale}%) blur(${edit.blur}px)`;
}
export function renderPhotoEdit(source: { image: CanvasImageSource; width: number; height: number }, edit: PhotoEdit): HTMLCanvasElement {
  const cropped = renderImageEdit(source, edit.geometry), output = document.createElement("canvas"); output.width = cropped.width; output.height = cropped.height;
  const context = output.getContext("2d"); if (!context) throw new Error("Photo editing is unavailable.");
  const filter = photoFilter(edit);
  if (!("filter" in context) && filter !== photoFilter(defaultPhotoEdit())) throw new Error("Color filters are unavailable in this browser.");
  context.fillStyle = "#ffffff"; context.fillRect(0, 0, output.width, output.height);
  context.filter = filter; context.save(); context.translate(edit.flipX ? output.width : 0, edit.flipY ? output.height : 0); context.scale(edit.flipX ? -1 : 1, edit.flipY ? -1 : 1); context.drawImage(cropped, 0, 0); context.restore(); context.filter = "none";
  for (const stroke of edit.strokes.slice(0, 100)) { context.beginPath(); context.strokeStyle = stroke.color; context.lineWidth = stroke.size / 100 * output.width; context.lineCap = "round"; context.lineJoin = "round"; stroke.points.slice(0, 1000).forEach((point, index) => { if (!index) context.moveTo(point.x * output.width, point.y * output.height); else context.lineTo(point.x * output.width, point.y * output.height); }); context.stroke(); }
  for (const text of edit.texts.slice(0, 30)) { context.fillStyle = text.color; context.font = `${text.size / 100 * output.width}px sans-serif`; context.fillText(text.text.slice(0, 200), text.x * output.width, text.y * output.height); }
  return output;
}
