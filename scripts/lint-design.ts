/**
 * `npm run lint:design`: checks src/ against the design system (design/DESIGN.md).
 *
 * Fails on:
 *   text      an arbitrary `text-[…]` value (use the type scale: text-body, text-caps, …)
 *   radius    an arbitrary `rounded-[…]` value (rounded-xs · sm · md · lg · xl · full)
 *   tracking  an arbitrary `tracking-[…]` value (tracking comes with the type utilities)
 *   height    an arbitrary `h-[…]` / `min-h-[…]` px height that isn't on the §4 list
 *   hex       a hex color in .ts / .tsx (every color is a --og-* variable in src/index.css)
 *   symbol    a typed ✓ → ▲ ▼ › ‹ ••• ▶ ≡ ▾ ⌄ ◎ in code (draw it with a glyph from icons.tsx)
 *   disc      a `rounded-full` square between 20 and 40 px that isn't 24 or 34 (Disc S / L)
 *
 * Comments are ignored. Only the exceptions in ALLOW below pass, each with its reason.
 *
 *   npm run lint:design            every issue, then a count per rule
 *   npm run lint:design -- --files a count per file
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';

const root = new URL('..', import.meta.url).pathname;
const SRC = join(root, 'src');

type Rule = 'text' | 'radius' | 'tracking' | 'height' | 'hex' | 'symbol' | 'disc';

/** Heights from design §4 (px). */
const HEIGHTS = new Set([16, 24, 32, 34, 36, 40, 44, 46, 48, 50, 52, 60]);
/** Disc sizes from design §9. */
const DISCS = new Set([24, 34]);

/** Files that may hold hex colors at all. */
const HEX_FILES = ['src/lib/logo.ts'];

/**
 * The only exceptions. `file` is a path under the repo root; `match` is tested against the
 * offending line; `rule` limits the entry to one rule.
 */
const ALLOW: { file: string; rule: Rule; match: RegExp; reason: string }[] = [
  // design §7: "The effort (RIR / RPE) view is kept exactly as built … the one place a half-pixel size (10.5) stays."
  { file: 'src/components/Effort.tsx', rule: 'text', match: /text-\[10\.5px\]/, reason: 'effort badge: "1.5R" has to fit a 16 px pill (design §7)' },
  // design §2 "Keypad": 23 / 19 are keypad-only sizes.
  { file: 'src/components/Keypad.tsx', rule: 'text', match: /text-\[(23|19)px\]/, reason: 'keypad digits 23/500 and function keys 19/600 (design §2, §13)' },
  { file: 'src/components/Effort.tsx', rule: 'text', match: /text-\[(23|19)px\]/, reason: 'effort pad uses the keypad sizes (design §2, §13)' },
  // design §13: the plate pad's bar drawing is a picture of a bar, sized to scale.
  { file: 'src/components/PlatePad.tsx', rule: 'radius', match: /rounded-(\w+-)?\[[123]px\]/, reason: 'bar and plate drawing (design §4: 2–3 px only inside drawings)' },
  { file: 'src/components/PlatePad.tsx', rule: 'height', match: /h-\[/, reason: 'bar and plate drawing, sized to scale' },
  // Round controls that aren't discs: their sizes are their own spec lines in design §10.
  { file: 'src/components/ui.tsx', rule: 'disc', match: /h-\[27px\] w-\[27px\]/, reason: 'toggle knob 27 in a 51 × 31 track (design §10)' },
  { file: 'src/components/ui.tsx', rule: 'disc', match: /h-\[22px\] w-\[22px\]/, reason: 'radio 22 (design §10)' },
  // Browser chrome, not UI: the <meta name="theme-color"> value must be a literal.
  { file: 'src/data/DataProvider.tsx', rule: 'hex', match: /theme-color/, reason: 'theme-color meta tag needs a literal color' },
  // Prose inside strings: "A → B" in the routine-change alert and an app's menu path.
  { file: 'src/lib/routineDiff.ts', rule: 'symbol', match: /→/, reason: 'prose in the "Update the routine?" alert message (5.2)' },
  { file: 'src/screens/settings/ImportScreen.tsx', rule: 'symbol', match: /Settings → Export/, reason: 'a menu path in another app, written as prose' },
];

// ───────────────────────────── scan

function walk(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = join(dir, e.name);
    if (e.isDirectory()) return walk(p);
    return /\.tsx?$/.test(e.name) && !/\.test\.tsx?$/.test(e.name) ? [p] : [];
  });
}

/** Blank out comments, keeping line breaks so line numbers hold. Strings are left alone. */
function stripComments(src: string): string {
  let out = '';
  let i = 0;
  let quote: string | null = null;
  while (i < src.length) {
    const c = src[i];
    const n = src[i + 1];
    if (quote) {
      out += c;
      if (c === '\\') {
        out += n ?? '';
        i += 2;
        continue;
      }
      if (c === quote) quote = null;
      i++;
      continue;
    }
    if (c === '"' || c === "'" || c === '`') {
      quote = c;
      out += c;
      i++;
      continue;
    }
    if (c === '/' && n === '/') {
      while (i < src.length && src[i] !== '\n') i++;
      continue;
    }
    if (c === '/' && n === '*') {
      i += 2;
      while (i < src.length && !(src[i] === '*' && src[i + 1] === '/')) {
        if (src[i] === '\n') out += '\n';
        i++;
      }
      i += 2;
      continue;
    }
    out += c;
    i++;
  }
  return out;
}

/** Template literals aren't nested JSX here, but JSX text can hold an apostrophe; reset quotes per line in JSX text. */
function codeLines(src: string): string[] {
  // A lone apostrophe in JSX text ("don't") would open a fake string and hide later comments,
  // so strip per line first (cheap and good enough for this codebase), then as a whole.
  return stripComments(src.split('\n').map((l) => (/^\s*(\/\/|\*|\/\*)/.test(l) ? '' : l)).join('\n')).split('\n');
}

const px = (v: string) => (/^\d+(\.\d+)?px$/.test(v) ? Number.parseFloat(v) : null);
const spacing = (v: string) => (/^\d+(\.5)?$/.test(v) ? Number.parseFloat(v) * 4 : null);

type Issue = { file: string; line: number; rule: Rule; msg: string; text: string };

function lintFile(path: string): Issue[] {
  const file = relative(root, path);
  const lines = codeLines(readFileSync(path, 'utf8'));
  const issues: Issue[] = [];
  const add = (i: number, rule: Rule, msg: string) => {
    const text = lines[i];
    if (ALLOW.some((a) => a.file === file && a.rule === rule && a.match.test(text))) return;
    issues.push({ file, line: i + 1, rule, msg, text: text.trim() });
  };
  lines.forEach((l, i) => {
    for (const m of l.matchAll(/(?<![\w-])(?:[\w-]+:)*text-\[([^\]]+)\]/g)) add(i, 'text', `text-[${m[1]}]: use a type utility`);
    for (const m of l.matchAll(/(?<![\w-])(?:[\w-]+:)*rounded(?:-[trblse]{1,2})?-\[([^\]]+)\]/g)) add(i, 'radius', `rounded-[${m[1]}]: use rounded-xs/sm/md/lg/xl/full`);
    for (const m of l.matchAll(/(?<![\w-])(?:[\w-]+:)*tracking-\[([^\]]+)\]/g)) add(i, 'tracking', `tracking-[${m[1]}]: tracking comes with the type utilities`);
    for (const m of l.matchAll(/(?<![\w-])(?:[\w-]+:)*(min-h|h)-\[([^\]]+)\]/g)) {
      const v = px(m[2]);
      if (v !== null && !HEIGHTS.has(v)) add(i, 'height', `${m[1]}-[${m[2]}]: not a §4 height (${[...HEIGHTS].join(' ')})`);
    }
    if (!HEX_FILES.includes(file)) for (const m of l.matchAll(/#[0-9a-fA-F]{6}\b|#[0-9a-fA-F]{3}\b(?![\w-])/g)) add(i, 'hex', `${m[0]}: use a --og-* variable`);
    for (const m of l.matchAll(/✓|→|▲|▼|›|‹|•••|▶|≡|▾|⌄|◎/g)) add(i, 'symbol', `typed ${m[0]}: draw it with a glyph from icons.tsx`);
    for (const cls of l.matchAll(/(["'`])([^"'`]*\brounded-full\b[^"'`]*)\1/g)) {
      const c = cls[2];
      const h = c.match(/(?<![\w-])h-(?:\[(\d+(?:\.\d+)?px)\]|(\d+(?:\.5)?))(?![\w.-])/);
      const w = c.match(/(?<![\w-])w-(?:\[(\d+(?:\.\d+)?px)\]|(\d+(?:\.5)?))(?![\w.-])/);
      if (!h || !w) continue;
      const hv = h[1] ? px(h[1]) : spacing(h[2]);
      const wv = w[1] ? px(w[1]) : spacing(w[2]);
      if (hv !== null && hv === wv && hv >= 20 && hv <= 40 && !DISCS.has(hv)) add(i, 'disc', `round ${hv} px disc: use Disc size s (24) or l (34)`);
    }
  });
  return issues;
}

const issues = walk(SRC).flatMap(lintFile);
const byFile = process.argv.includes('--files');

if (byFile) {
  const counts = new Map<string, number>();
  for (const it of issues) counts.set(it.file, (counts.get(it.file) ?? 0) + 1);
  for (const [f, n] of [...counts].sort((a, b) => b[1] - a[1])) console.log(`${String(n).padStart(5)}  ${f}`);
} else {
  for (const it of issues) console.log(`${it.file}:${it.line}  ${it.rule.padEnd(8)} ${it.msg}`);
}

const perRule = new Map<Rule, number>();
for (const it of issues) perRule.set(it.rule, (perRule.get(it.rule) ?? 0) + 1);
console.log(
  issues.length
    ? `\nlint:design: ${issues.length} issue${issues.length === 1 ? '' : 's'} (${[...perRule].map(([r, n]) => `${r} ${n}`).join(', ')}); ${ALLOW.length} allowlisted exceptions`
    : `lint:design: 0 issues; ${ALLOW.length} allowlisted exceptions`,
);
process.exit(issues.length ? 1 : 0);
