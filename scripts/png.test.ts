import { deflateSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import { decodePng, diffImages, encodePng, type Image } from './png.ts';

const solid = (width: number, height: number, rgba: number[]): Image => {
  const data = new Uint8Array(width * height * 4);
  for (let i = 0; i < width * height; i++) data.set(rgba, i * 4);
  return { width, height, data };
};

describe('png', () => {
  it('round-trips RGBA', () => {
    const img = solid(3, 2, [10, 20, 30, 255]);
    img.data.set([200, 100, 50, 128], 4 * 4);
    const back = decodePng(encodePng(img));
    expect(back.width).toBe(3);
    expect(back.height).toBe(2);
    expect([...back.data]).toEqual([...img.data]);
  });

  it('undoes every scanline filter on an RGB image', () => {
    // 2×5 RGB, one row per filter type (0 none, 1 sub, 2 up, 3 average, 4 paeth).
    const w = 2;
    const px = [
      [1, 2, 3, 4, 5, 6],
      [7, 8, 9, 10, 11, 12],
      [13, 14, 15, 16, 17, 18],
      [19, 20, 21, 22, 23, 24],
      [25, 26, 27, 28, 29, 30],
    ];
    const paeth = (a: number, b: number, c: number) => {
      const p = a + b - c;
      const [pa, pb, pc] = [Math.abs(p - a), Math.abs(p - b), Math.abs(p - c)];
      return pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
    };
    const rows = px.map((row, y) => {
      const prev = y ? px[y - 1] : [0, 0, 0, 0, 0, 0];
      const enc = row.map((v, x) => {
        const a = x >= 3 ? row[x - 3] : 0;
        const c = x >= 3 ? prev[x - 3] : 0;
        const pred = [0, a, prev[x], (a + prev[x]) >> 1, paeth(a, prev[x], c)][y];
        return (v - pred) & 255;
      });
      return [y, ...enc];
    });
    const ihdr = Buffer.alloc(13);
    ihdr.writeUInt32BE(w, 0);
    ihdr.writeUInt32BE(5, 4);
    ihdr.set([8, 2, 0, 0, 0], 8);
    const chunk = (type: string, body: Buffer) => {
      const h = Buffer.alloc(8);
      h.writeUInt32BE(body.length, 0);
      h.write(type, 4, 'latin1');
      return Buffer.concat([h, body, Buffer.alloc(4)]); // CRC isn't checked
    };
    const file = Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(Buffer.from(rows.flat()))), chunk('IEND', Buffer.alloc(0))]);
    const img = decodePng(file);
    const rgb = [...img.data].filter((_, i) => i % 4 !== 3);
    expect(rgb).toEqual(px.flat());
  });

  it('counts changed pixels past the tolerance', () => {
    const a = solid(4, 4, [0, 0, 0, 255]);
    const b = solid(4, 4, [0, 0, 0, 255]);
    b.data.set([5, 5, 5, 255], 0); // noise, under tolerance
    b.data.set([255, 255, 255, 255], 4 * 5);
    const d = diffImages(a, b);
    expect(d.changed).toBe(1);
    expect(d.ratio).toBe(1 / 16);
    expect(d.sizeChanged).toBe(false);
    expect([...d.image.data.subarray(20, 24)]).toEqual([255, 32, 80, 255]);
  });

  it('skips ignored regions', () => {
    const a = solid(4, 4, [0, 0, 0, 255]);
    const b = solid(4, 4, [255, 255, 255, 255]);
    const d = diffImages(a, b, 8, [{ x: 0, y: 0, w: 2, h: 4 }]);
    expect(d.changed).toBe(8);
    expect([...d.image.data.subarray(0, 4)]).toEqual([24, 64, 140, 255]);
  });

  it('treats a size change as fully changed', () => {
    const d = diffImages(solid(2, 2, [0, 0, 0, 255]), solid(2, 3, [0, 0, 0, 255]));
    expect(d.sizeChanged).toBe(true);
    expect(d.ratio).toBe(1);
    expect(d.changed).toBe(2); // the new row has no counterpart
  });
});
