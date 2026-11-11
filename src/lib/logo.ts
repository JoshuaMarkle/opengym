/**
 * The OpenGym logo: the right half of a loaded barbell, drawn like the plate pad
 * (PlatePad.tsx) at 5× scale on a 1024 grid. A grey bar runs off the left edge,
 * then a collar and three equally thick blue plates, the last shorter.
 *
 * Single source for the in-app <LogoMark> and `npm run brand`, which writes the
 * SVGs in design/brand/logos and the icons in public/.
 */

export type LogoRect = { x: number; y: number; w: number; h: number; r: number; part: 'bar' | 'plate' };

const S = 5; // plate pad px → logo units
const plate = (x: number, w: number, h: number): LogoRect => ({ x, y: 512 - h / 2, w, h, r: 3 * S, part: 'plate' });

export const LOGO_RECTS: LogoRect[] = [
  { x: -60, y: 490, w: 818, h: 44, r: 22, part: 'bar' }, // shaft + sleeve, short overhang past the last plate
  { x: 272, y: 427, w: 7 * S, h: 34 * S, r: 10, part: 'bar' }, // collar
  plate(322, 24 * S, 124 * S), // 45
  plate(452, 24 * S, 124 * S), // 45, centered
  plate(582, 24 * S, 82 * S), // shorter plate, same thickness as the other two
];

export const LOGO_COLORS = {
  dark: { bg: '#000000', bar: '#3A3A3A' },
  light: { bg: '#FFFFFF', bar: '#C8C8C8' },
  plate: '#007AFF',
} as const;

/** The logo as an SVG document. `radius` rounds the square (224 = iOS-style app icon; 0 = full bleed). */
export function logoSvg(theme: 'dark' | 'light', radius = 0): string {
  const c = LOGO_COLORS[theme];
  const rects = LOGO_RECTS.map(
    (r) => `<rect x="${r.x}" y="${r.y}" width="${r.w}" height="${r.h}" rx="${r.r}" fill="${r.part === 'plate' ? LOGO_COLORS.plate : c.bar}"/>`,
  ).join('');
  const clip = radius ? `<clipPath id="c"><rect width="1024" height="1024" rx="${radius}"/></clipPath>` : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024">${clip}<g${radius ? ' clip-path="url(#c)"' : ''}><rect width="1024" height="1024" fill="${c.bg}"/>${rects}</g></svg>\n`;
}
