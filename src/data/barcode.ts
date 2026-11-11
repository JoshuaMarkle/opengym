// Barcode decoding for the scanner (nutrition-plan §3.9): the browser's BarcodeDetector where it
// exists (Chrome on Android), else ZXing compiled to WebAssembly, loaded the first time you scan.
// The .wasm file is bundled with the app (no CDN) and cached by the service worker for offline.

import { validBarcode } from '../lib/nutrition';

/** Reads one frame; resolves to a valid EAN / UPC code or null. */
export type Decode = (video: HTMLVideoElement) => Promise<string | null>;

const FORMATS = ['ean_13', 'ean_8', 'upc_a', 'upc_e'];

interface NativeDetector {
  detect(source: CanvasImageSource): Promise<{ rawValue: string }[]>;
}
type NativeDetectorClass = (new (o: { formats: string[] }) => NativeDetector) & { getSupportedFormats?: () => Promise<string[]> };

async function nativeDecoder(): Promise<Decode | undefined> {
  const D = (globalThis as { BarcodeDetector?: NativeDetectorClass }).BarcodeDetector;
  if (!D) return undefined;
  const supported = (await D.getSupportedFormats?.().catch(() => [])) ?? [];
  const formats = FORMATS.filter((f) => supported.includes(f));
  if (!formats.length) return undefined;
  const d = new D({ formats });
  return async (video) => {
    const r = await d.detect(video).catch(() => []);
    return r.map((x) => x.rawValue).find(validBarcode) ?? null;
  };
}

async function zxingDecoder(): Promise<Decode> {
  const [{ prepareZXingModule, readBarcodes }, { default: wasmUrl }] = await Promise.all([import('zxing-wasm/reader'), import('zxing-wasm/reader/zxing_reader.wasm?url')]);
  await prepareZXingModule({ overrides: { locateFile: (path: string, prefix: string) => (path.endsWith('.wasm') ? wasmUrl : prefix + path) }, fireImmediately: true });
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  return async (video) => {
    const w = video.videoWidth;
    const h = video.videoHeight;
    if (!w || !h) return null;
    // A centered band is enough for a 1D code, and much faster than the whole frame.
    const bw = Math.round(w * 0.8);
    const bh = Math.round(h * 0.4);
    canvas.width = bw;
    canvas.height = bh;
    ctx.drawImage(video, (w - bw) / 2, (h - bh) / 2, bw, bh, 0, 0, bw, bh);
    const r = await readBarcodes(ctx.getImageData(0, 0, bw, bh), { formats: ['EAN-13', 'EAN-8', 'UPC-A', 'UPC-E'], tryHarder: true, maxNumberOfSymbols: 1 }).catch(() => []);
    return r.map((x) => x.text).find(validBarcode) ?? null;
  };
}

let decoder: Promise<Decode> | undefined;

/** The decoder for this browser, created once. */
export function getDecoder(): Promise<Decode> {
  decoder ??= nativeDecoder().then((n) => n ?? zxingDecoder());
  decoder.catch(() => (decoder = undefined));
  return decoder;
}
