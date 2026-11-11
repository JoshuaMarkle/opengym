// Helps the barcode decoder with colored labels (nutrition-plan §3.9). Decoders look at
// brightness, and black bars on a dark red (or blue, green) label are barely darker than the
// label: both read as dark grey. The brightest channel keeps the label bright (red stays high on
// red) while black bars stay low; stretching the result to full range then fixes a dim frame.

/**
 * Rewrites RGBA pixels in place as grey: each pixel's brightest channel, then the levels
 * stretched so the darkest 2 % go black and the brightest 2 % white. A flat frame (no contrast
 * to stretch) is only made grey.
 */
export function enhanceForBarcode(px: Uint8ClampedArray): void {
  const n = px.length >> 2;
  if (!n) return;
  const hist = new Uint32Array(256);
  for (let i = 0; i < px.length; i += 4) {
    const v = Math.max(px[i], px[i + 1], px[i + 2]);
    px[i] = v;
    hist[v]++;
  }
  const cut = Math.floor(n * 0.02);
  let lo = 0;
  for (let seen = 0; lo < 255 && seen + hist[lo] <= cut; lo++) seen += hist[lo];
  let hi = 255;
  for (let seen = 0; hi > 0 && seen + hist[hi] <= cut; hi--) seen += hist[hi];
  const span = hi - lo;
  const lut = new Uint8ClampedArray(256);
  for (let v = 0; v < 256; v++) lut[v] = span < 8 ? v : ((v - lo) * 255) / span;
  for (let i = 0; i < px.length; i += 4) {
    const g = lut[px[i]];
    px[i] = px[i + 1] = px[i + 2] = g;
  }
}
