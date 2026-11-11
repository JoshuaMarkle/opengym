import { describe, expect, it } from 'vitest';
import { indexWords, logCounts, matches, mergeOnline, rankFoods, recentFoods, usuallyAt, wantsOnline, words } from './foodSearch';

const f = (id: string, name: string, source: 'usda' | 'custom' | 'off' = 'usda', extra = {}) => ({ id, name, source, ...extra });
const DAY = 86_400_000;

describe('food search (nutrition-plan §3.5)', () => {
  it('splits names into plain words', () => {
    expect(words('Crème fraîche, 30%')).toEqual(['creme', 'fraiche', '30']);
    expect(indexWords({ name: 'Chicken breast, roasted', detail: 'Chicken, broilers or fryers, breast' })).toContain('broilers');
  });

  it('needs every query word to start a word', () => {
    expect(matches(['chick', 'bre'], { name: 'Chicken breast' })).toBe(true);
    expect(matches(['chick', 'thigh'], { name: 'Chicken breast' })).toBe(false);
  });

  it('ranks your foods first, by log count, then short USDA names', () => {
    const foods = [
      f('u1', 'Chicken, broilers or fryers, breast, meat only, cooked, roasted'),
      f('u2', 'Chicken breast, roasted'),
      f('mine', 'Chicken breast, grilled', 'custom'),
      f('logged', 'Chicken thigh'),
    ];
    const counts = new Map([['logged', 5]]);
    expect(rankFoods('chicken', foods, counts).map((x) => x.id)).toEqual(['logged', 'mine', 'u2', 'u1']);
  });

  it('works out usually-at, recents and log counts', () => {
    const now = 100 * DAY;
    const log = [
      { foodId: 'salmon', meal: 'dinner' as const, loggedAt: now - DAY },
      { foodId: 'salmon', meal: 'dinner' as const, loggedAt: now - 2 * DAY },
      { foodId: 'salmon', meal: 'dinner' as const, loggedAt: now - 3 * DAY },
      { foodId: 'rice', meal: 'dinner' as const, loggedAt: now - 4 * DAY },
      { foodId: 'oats', meal: 'breakfast' as const, loggedAt: now - 40 * DAY },
    ];
    expect(usuallyAt(log, 'dinner', now)).toEqual(['salmon']);
    expect(usuallyAt(log, 'breakfast', now)).toEqual([]);
    expect(recentFoods(log, 2)).toEqual(['salmon', 'rice']);
    expect(logCounts(log).get('salmon')).toBe(3);
  });

  it('drops online results you already have', () => {
    expect(mergeOnline([{ barcode: '1' }], [{ barcode: '1' }, { offCode: '2' }, { offCode: '2' }])).toEqual([{ offCode: '2' }]);
  });

  it('only searches online at 2+ characters with few local results', () => {
    expect(wantsOnline('c', 0)).toBe(false);
    expect(wantsOnline('ch', 3)).toBe(true);
    expect(wantsOnline('ch', 8)).toBe(false);
  });
});
