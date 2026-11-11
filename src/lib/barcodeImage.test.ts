import { describe, expect, it } from 'vitest';
import { enhanceForBarcode } from './barcodeImage';

const rgba = (...colors: [number, number, number][]) => new Uint8ClampedArray(colors.flatMap(([r, g, b]) => [r, g, b, 255]));
const grey = (px: Uint8ClampedArray) => Array.from({ length: px.length / 4 }, (_, i) => px[i * 4]);

describe('enhanceForBarcode', () => {
  it('pulls black bars apart from a dark red label', () => {
    // Half dark red label, half near-black bars: luminance differs by ~25, the result by 255.
    const px = rgba(...Array.from({ length: 100 }, (_, i): [number, number, number] => (i % 2 ? [110, 20, 25] : [18, 12, 12])));
    enhanceForBarcode(px);
    const g = grey(px);
    expect(g[1]).toBe(255);
    expect(g[0]).toBe(0);
    expect(px[1]).toBe(px[0]);
    expect(px[2]).toBe(px[0]);
    expect(px[3]).toBe(255);
  });

  it('leaves a flat frame as plain grey', () => {
    const px = rgba([90, 40, 40], [92, 40, 40], [91, 30, 30]);
    enhanceForBarcode(px);
    expect(grey(px)).toEqual([90, 92, 91]);
  });

  it('handles an empty frame', () => {
    expect(() => enhanceForBarcode(new Uint8ClampedArray())).not.toThrow();
  });
});
