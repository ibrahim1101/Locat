// A real OfflineAudioContext test, run in Chromium by CI; no audio hardware is needed.
import { chromium } from 'playwright';
import { build } from 'esbuild';
import assert from 'node:assert/strict';
const result = await build({ entryPoints: ['src/lib/musicEq.ts'], bundle: true, write: false, format: 'iife', globalName: 'LocatEQ' });
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage();
  await page.addScriptTag({ content: result.outputFiles[0].text });
  const measured = await page.evaluate(async () => {
    async function rms(points, bypass, frequency = 1000) {
      const context = new OfflineAudioContext(1, 48000, 48000);
      const source = context.createOscillator(); source.frequency.value = frequency;
      const filters = Array.from({ length: 31 }, () => context.createBiquadFilter());
      const preamp = context.createGain();
      LocatEQ.connectEqGraph(source, context, filters, preamp, points, 0, bypass);
      source.start();
      const buffer = await context.startRendering();
      const values = buffer.getChannelData(0).slice(24000);
      return Math.sqrt(values.reduce((sum, sample) => sum + sample * sample, 0) / values.length);
    }
    const peak = [{ type: 'peaking', frequency: 1000, gain: -12, q: 1 }];
    return {
      pure: await rms(peak, true), cut: await rms(peak, false),
      boost: await rms([{ ...peak[0], gain: 12 }], false),
      highpass: await rms([{ type: 'highpass', frequency: 1000, gain: 0, q: 0.707 }], false, 100),
      lowpass: await rms([{ type: 'lowpass', frequency: 1000, gain: 0, q: 0.707 }], false, 10000),
    };
  });
  assert.ok(measured.pure > 0.70 && measured.pure < 0.72, 'Pure bypass must preserve the oscillator signal');
  assert.ok(measured.cut < measured.pure * 0.27 && measured.cut > measured.pure * 0.23, 'A -12 dB peak must change the rendered signal');
  assert.ok(measured.boost <= measured.pure * 1.03, 'Boost headroom must keep this signal bounded');
  assert.ok(measured.highpass < measured.pure * 0.02, 'High-pass must attenuate sub-cutoff audio');
  assert.ok(measured.lowpass < measured.pure * 0.02, 'Low-pass must attenuate above-cutoff audio');
  console.log('Real Chromium audio signal checks passed:', measured);
} finally { await browser.close(); }
