/**
 * Just enough PNG for `npm run screens`: decode the 8-bit, non-interlaced files Chrome writes,
 * compare two images pixel by pixel, and encode the diff picture. No dependencies.
 */
import { crc32, deflateSync, inflateSync } from 'node:zlib';

/** A rectangle in image pixels. */
export type Rect = { x: number; y: number; w: number; h: number };

export type Image = { width: number; height: number; /** RGBA, 4 bytes a pixel */ data: Uint8Array };

const SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
const CHANNELS: Record<number, number> = { 0: 1, 2: 3, 4: 2, 6: 4 }; // gray, RGB, gray+alpha, RGBA

export function decodePng(buf: Uint8Array): Image {
  const b = Buffer.from(buf.buffer, buf.byteOffset, buf.byteLength);
  if (!b.subarray(0, 8).equals(SIGNATURE)) throw new Error('Not a PNG');
  let width = 0;
  let height = 0;
  let channels = 0;
  const idat: Buffer[] = [];
  for (let at = 8; at < b.length; ) {
    const len = b.readUInt32BE(at);
    const type = b.toString('latin1', at + 4, at + 8);
    const body = b.subarray(at + 8, at + 8 + len);
    if (type === 'IHDR') {
      width = body.readUInt32BE(0);
      height = body.readUInt32BE(4);
      const depth = body[8];
      const color = body[9];
      if (depth !== 8 || !(color in CHANNELS) || body[12] !== 0) throw new Error(`Unsupported PNG (depth ${depth}, color ${color}, interlace ${body[12]})`);
      channels = CHANNELS[color];
    } else if (type === 'IDAT') idat.push(body);
    else if (type === 'IEND') break;
    at += 12 + len;
  }
  const raw = inflateSync(Buffer.concat(idat));
  const stride = width * channels;
  const px = new Uint8Array(stride * height);
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)];
    const src = y * (stride + 1) + 1;
    const row = y * stride;
    for (let x = 0; x < stride; x++) {
      const a = x >= channels ? px[row + x - channels] : 0;
      const up = y ? px[row - stride + x] : 0;
      const ul = y && x >= channels ? px[row - stride + x - channels] : 0;
      let v = raw[src + x];
      if (filter === 1) v += a;
      else if (filter === 2) v += up;
      else if (filter === 3) v += (a + up) >> 1;
      else if (filter === 4) {
        const p = a + up - ul;
        const pa = Math.abs(p - a);
        const pb = Math.abs(p - up);
        const pc = Math.abs(p - ul);
        v += pa <= pb && pa <= pc ? a : pb <= pc ? up : ul;
      }
      px[row + x] = v & 255;
    }
  }
  const data = new Uint8Array(width * height * 4);
  for (let i = 0, j = 0; i < width * height; i++, j += channels) {
    const gray = channels < 3;
    data[i * 4] = px[j];
    data[i * 4 + 1] = px[j + (gray ? 0 : 1)];
    data[i * 4 + 2] = px[j + (gray ? 0 : 2)];
    data[i * 4 + 3] = channels === 4 ? px[j + 3] : channels === 2 ? px[j + 1] : 255;
  }
  return { width, height, data };
}

export function encodePng({ width, height, data }: Image): Buffer {
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y++) raw.set(data.subarray(y * width * 4, (y + 1) * width * 4), y * (width * 4 + 1) + 1);
  const chunk = (type: string, body: Buffer) => {
    const head = Buffer.alloc(8);
    head.writeUInt32BE(body.length, 0);
    head.write(type, 4, 'latin1');
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(Buffer.concat([head.subarray(4), body])), 0);
    return Buffer.concat([head, body, crc]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr.set([8, 6, 0, 0, 0], 8);
  return Buffer.concat([SIGNATURE, chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}

export type Diff = {
  /** Pixels whose largest channel difference is over the tolerance. */
  changed: number;
  /** changed / all pixels (1 when the sizes differ). */
  ratio: number;
  sizeChanged: boolean;
  /** The new image dimmed to gray, changed pixels in red. */
  image: Image;
};

/**
 * `tolerance`: per-channel difference (0–255) still counted as the same pixel, to absorb antialiasing noise.
 * `ignore`: regions that may differ (running clocks); drawn blue in the diff picture.
 */
export function diffImages(before: Image, after: Image, tolerance = 8, ignore: Rect[] = []): Diff {
  const { width, height } = after;
  const out = new Uint8Array(width * height * 4);
  const masked = new Uint8Array(width * height);
  for (const r of ignore)
    for (let y = Math.max(0, Math.floor(r.y)); y < Math.min(height, Math.ceil(r.y + r.h)); y++)
      for (let x = Math.max(0, Math.floor(r.x)); x < Math.min(width, Math.ceil(r.x + r.w)); x++) masked[y * width + x] = 1;
  const sizeChanged = before.width !== width || before.height !== height;
  let changed = 0;
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      if (masked[y * width + x]) {
        out.set([24, 64, 140, 255], i);
        continue;
      }
      const j = (y * before.width + x) * 4;
      let d = 255;
      if (x < before.width && y < before.height) d = Math.max(Math.abs(before.data[j] - after.data[i]), Math.abs(before.data[j + 1] - after.data[i + 1]), Math.abs(before.data[j + 2] - after.data[i + 2]), Math.abs(before.data[j + 3] - after.data[i + 3]));
      if (d > tolerance) {
        changed++;
        out.set([255, 32, 80, 255], i);
      } else {
        const l = Math.round(48 + (0.299 * after.data[i] + 0.587 * after.data[i + 1] + 0.114 * after.data[i + 2]) * 0.35);
        out.set([l, l, l, 255], i);
      }
    }
  return { changed, ratio: sizeChanged ? 1 : changed / (width * height), sizeChanged, image: { width, height, data: out } };
}
