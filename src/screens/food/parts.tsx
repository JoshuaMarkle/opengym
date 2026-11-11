import type { ReactNode } from 'react';
import { CheckGlyph, PlusGlyph } from '../../components/icons';
import { Sheet, SheetOption } from '../../components/overlays';
import { Check, Disc, InfoRow, InfoTable, cx } from '../../components/ui';
import type { LogAmount } from '../../data/food';
import type { Food, MealId } from '../../db/types';
import { amountLabel, fmtAmount, fmtInt, GROUPS, MEALS, NUTRIENTS, pctOfTarget, type DayTargets, type NutrientId, type Nutrients } from '../../lib/nutrition';

/** "P 62  C 0  F 7": each letter 700 in its macro color, numbers fg2 (design §2, board C1). */
export function InlineMacros({ n, className = '' }: { n: Nutrients; className?: string }) {
  const part = (k: 'p' | 'c' | 'f', color: string) => (
    <span className="whitespace-nowrap">
      <b className={color}>{k.toUpperCase()}</b> <span className="text-fg2">{n[k] != null ? fmtInt(n[k]!) : '—'}</span>
    </span>
  );
  return (
    <span className={cx('inline-flex gap-2', className)}>
      {part('p', 'text-accent')}
      {part('c', 'text-cyan')}
      {part('f', 'text-gold')}
    </span>
  );
}

/**
 * A food in a list (board C1 / D5): dense two-line row, the name, then "amount · kcal · P C F"
 * in Caption, and an L disc at the end: grey with a blue + to log in one tap, action blue with a
 * check once logged (tap it to take it back off).
 */
export function FoodRow({ title, detail, totals, added, onOpen, onDisc, discLabel }: { title: ReactNode; detail?: string; totals: Nutrients; added: boolean; onOpen?: () => void; onDisc: () => void; discLabel: string }) {
  const text = (
    <span className="min-w-0 flex-1">
      <b className="block truncate text-body font-semibold">{title}</b>
      <span className="mt-0.5 flex min-w-0 items-center gap-1 text-caption text-fg2">
        <span className="truncate">{[detail, `${fmtInt(totals.kcal ?? 0)} kcal`].filter(Boolean).join(' · ')} ·</span>
        <InlineMacros n={totals} className="flex-none" />
      </span>
    </span>
  );
  return (
    <div className="flex min-h-13 items-center gap-3 border-b border-line py-2">
      {onOpen ? (
        <button type="button" onClick={onOpen} className="flex min-w-0 flex-1 items-center text-left active:opacity-60">
          {text}
        </button>
      ) : (
        text
      )}
      <Disc size="l" tone={added ? 'action' : 'grey'} faceClassName={added ? '' : 'text-accent'} onClick={onDisc} label={discLabel} className="-mr-1.5">
        {added ? <CheckGlyph size={14} /> : <PlusGlyph size={14} />}
      </Disc>
    </div>
  );
}

/** The amount a + disc logs, as text: "1 medium · 118 g", "200 g". */
export function quickLabel(food: Food, a: LogAmount): string {
  return amountLabel(a.grams, a.unit, food.basis, food.servings, a.serving);
}

/** Where a food's numbers come from, for the meta line. */
export function sourceLabel(f: Pick<Food, 'source' | 'brand' | 'copiedFrom'>): string {
  if (f.source === 'custom') return f.copiedFrom ? 'Your copy' : 'Your food';
  if (f.source === 'off') return ['Open Food Facts', f.brand].filter(Boolean).join(' · ');
  return 'USDA';
}

/** design §14 sheet: pick one of the four meals. */
export function MealSheet({ open, value, onPick, onClose }: { open: boolean; value: MealId; onPick: (m: MealId) => void; onClose: () => void }) {
  return (
    <Sheet open={open} onClose={onClose} title="Meal">
      {MEALS.map((m) => (
        <SheetOption
          key={m.id}
          onClick={() => {
            onPick(m.id);
            onClose();
          }}
          detail={<Check on={m.id === value} />}
        >
          {m.label}
        </SheetOption>
      ))}
    </Sheet>
  );
}

/**
 * The nutrient table (F1, design §7 info table): every catalog nutrient for this amount, grouped,
 * with % of your own daily target. Missing values are "—", never 0; borrowed ones (Fill in missing
 * nutrients) start with "~".
 */
export function NutrientTable({ totals, estimated = [], targets }: { totals: Nutrients; estimated?: NutrientId[]; targets: DayTargets }) {
  const row = (id: NutrientId) => {
    const def = NUTRIENTS.find((n) => n.id === id)!;
    const v = totals[id];
    const pct = pctOfTarget(id, v, targets);
    const amount = v == null ? '—' : `${estimated.includes(id) ? '~' : ''}${id === 'kcal' ? fmtInt(v) : fmtAmount(v)} ${def.unit}`;
    return (
      <InfoRow
        key={id}
        sub={def.sub}
        label={
          def.sub ? (
            <>
              {def.name} <span className={v == null ? 'text-fg2' : 'text-fg'}>{amount}</span>
            </>
          ) : (
            <>
              <b>{def.name}</b> <span className={v == null ? 'text-fg2' : ''}>{amount}</span>
            </>
          )
        }
        value={pct != null ? `${pct}%` : '—'}
      />
    );
  };
  // Fat, carbs, protein: the order a nutrition label reads (board F1).
  const main = (['lipids', 'carbs', 'protein'] as const).flatMap((g) => NUTRIENTS.filter((n) => n.group === g).map((n) => n.id));
  return (
    <>
      <InfoTable title="Nutrients" note="% of your target">
        {main.map(row)}
      </InfoTable>
      {GROUPS.filter((g) => g.id === 'vitamins' || g.id === 'minerals' || g.id === 'general').map((g) => (
        <InfoTable key={g.id} title={g.id === 'general' ? 'Other' : g.label}>
          {NUTRIENTS.filter((n) => n.group === g.id && n.id !== 'kcal').map((n) => row(n.id))}
        </InfoTable>
      ))}
    </>
  );
}
