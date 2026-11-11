// Barcode decoding for the scanner (nutrition-plan §3.9): the browser's BarcodeDetector where it
// exists (Chrome on Android), else ZXing compiled to WebAssembly, loaded the first time you scan.
// The .wasm file is bundled with the app (no CDN) and cached by the service worker for offline.
// Each frame is read as it is, then again enhanced (enhanceForBarcode) when that finds nothing:
// black bars on a dark colored label read far better from the brightest channel.

import { enhanceForBarcode } from '../lib/barcodeImage';
import { validBarcode } from '../lib/nutrition';

/** Reads one frame; resolves to a valid EAN / UPC code or null. */
export type Decode = (video: HTMLVideoElement) => Promise<string | null>;

const FORMATS = ['ean_13', 'ean_8', 'upc_a', 'upc_e'];

interface NativeDetector {
  detect(source: CanvasImageSource | ImageData): Promise<{ rawValue: string }[]>;
}

/**
 * Grabs a centered band of the frame (a 1D code fits in it, and it's much faster than the
 * whole frame) as pixels, or null before the video has a size.
 */
function bandGrabber() {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  return (video: HTMLVideoElement): ImageData | null => {
    const w = video.videoWidth;
    const h = video.videoHeight;
    if (!w || !h) return null;
    const bw = Math.round(w * 0.85);
    const bh = Math.round(h * 0.45);
    if (canvas.width !== bw) canvas.width = bw;
    if (canvas.height !== bh) canvas.height = bh;
    ctx.drawImage(video, (w - bw) / 2, (h - bh) / 2, bw, bh, 0, 0, bw, bh);
    return ctx.getImageData(0, 0, bw, bh);
  };
}
type NativeDetectorClass = (new (o: { formats: string[] }) => NativeDetector) & { getSupportedFormats?: () => Promise<string[]> };

async function nativeDecoder(): Promise<Decode | undefined> {
  const D = (globalThis as { BarcodeDetector?: NativeDetectorClass }).BarcodeDetector;
  if (!D) return undefined;
  const supported = (await D.getSupportedFormats?.().catch(() => [])) ?? [];
  const formats = FORMATS.filter((f) => supported.includes(f));
  if (!formats.length) return undefined;
  const d = new D({ formats });
  const grab = bandGrabber();
  const read = async (src: HTMLVideoElement | ImageData) => (await d.detect(src).catch(() => [])).map((x) => x.rawValue).find(validBarcode) ?? null;
  return async (video) => {
    const hit = await read(video);
    if (hit) return hit;
    const band = grab(video);
    if (!band) return null;
    enhanceForBarcode(band.data);
    return read(band);
  };
}

async function zxingDecoder(): Promise<Decode> {
  const [{ prepareZXingModule, readBarcodes }, { default: wasmUrl }] = await Promise.all([import('zxing-wasm/reader'), import('zxing-wasm/reader/zxing_reader.wasm?url')]);
  await prepareZXingModule({ overrides: { locateFile: (path: string, prefix: string) => (path.endsWith('.wasm') ? wasmUrl : prefix + path) }, fireImmediately: true });
  const grab = bandGrabber();
  const read = async (img: ImageData) =>
    (await readBarcodes(img, { formats: ['EAN-13', 'EAN-8', 'UPC-A', 'UPC-E'], tryHarder: true, maxNumberOfSymbols: 1 }).catch(() => [])).map((x) => x.text).find(validBarcode) ?? null;
  return async (video) => {
    const band = grab(video);
    if (!band) return null;
    const hit = await read(band);
    if (hit) return hit;
    enhanceForBarcode(band.data);
    return read(band);
  };
}

let decoder: Promise<Decode> | undefined;

/** The decoder for this browser, created once. */
export function getDecoder(): Promise<Decode> {
  decoder ??= nativeDecoder().then((n) => n ?? zxingDecoder());
  decoder.catch(() => (decoder = undefined));
  return decoder;
}
