// Real rendered pixels and JPEG export; shares CI's isolated Playwright runtime.
import { chromium } from 'playwright';
import { build } from 'esbuild';
import assert from 'node:assert/strict';
const bundle = await build({ entryPoints: ['src/lib/imageEditing.ts'], bundle: true, write: false, format: 'iife', globalName: 'LocatImageEdit' });
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage();
  await page.addScriptTag({ content: bundle.outputFiles[0].text });
  const measured = await page.evaluate(async () => {
    const input = document.createElement('canvas'); input.width = 400; input.height = 200;
    const context = input.getContext('2d'); context.fillStyle = '#ff0000'; context.fillRect(0, 0, 200, 200);
    context.fillStyle = '#0000ff'; context.fillRect(200, 0, 200, 200);
    const source = { image: input, width: 400, height: 200 };
    const pixel = (canvas, x, y) => [...canvas.getContext('2d').getImageData(x, y, 1, 1).data];
    const rotated = LocatImageEdit.renderImageEdit(source, { ...LocatImageEdit.DEFAULT_IMAGE_EDIT, turns: 1 });
    const left = LocatImageEdit.renderImageEdit(source, { ...LocatImageEdit.DEFAULT_IMAGE_EDIT, crop: 'square', x: 0 });
    const right = LocatImageEdit.renderImageEdit(source, { ...LocatImageEdit.DEFAULT_IMAGE_EDIT, crop: 'square', x: 1 });
    const file = await LocatImageEdit.editedImageFile(rotated, 'source.png');
    const bitmap = await createImageBitmap(file);
    const exported = { width: bitmap.width, height: bitmap.height, type: file.type, name: file.name, size: file.size }; bitmap.close();
    return { rotated: [rotated.width, rotated.height], top: pixel(rotated, 100, 50), bottom: pixel(rotated, 100, 350),
      left: pixel(left, 100, 100), right: pixel(right, 100, 100), original: pixel(input, 50, 100), exported };
  });
  assert.deepEqual(measured.rotated, [200, 400]);
  assert.deepEqual(measured.top, [255, 0, 0, 255]); assert.deepEqual(measured.bottom, [0, 0, 255, 255]);
  assert.deepEqual(measured.left, [255, 0, 0, 255]); assert.deepEqual(measured.right, [0, 0, 255, 255]);
  assert.deepEqual(measured.original, [255, 0, 0, 255]);
  assert.deepEqual([measured.exported.width, measured.exported.height], [200, 400]);
  assert.equal(measured.exported.type, 'image/jpeg'); assert.equal(measured.exported.name, 'source-edited.jpg');
  assert.ok(measured.exported.size > 0 && measured.exported.size <= 2_900_000);
  console.log('Real Chromium image crop, rotation and JPEG export checks passed:', measured);
} finally { await browser.close(); }
