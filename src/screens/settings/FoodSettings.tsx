// Settings › Food (nutrition-plan §3.8, §3.9). Screen 10.31.

import { useLiveQuery } from 'dexie-react-hooks';
import { useNavigate } from 'react-router';
import { BackButton, InfoRow, Note, Row, Screen, SectionLabel, TopBar } from '../../components/ui';
import { updateFoodSettings } from '../../data/food';
import { ensureFoodDb, useFoodDb } from '../../data/foodDb';
import { useDayTargets, useFoodSettings } from '../../data/useFood';
import { db } from '../../db/db';
import { fmtInt, foodDayKey } from '../../lib/nutrition';
import { ToggleRow } from './Training';

/**
 * 10.31 Settings › Food: targets, and where foods come from. "Look up foods online" turns Open Food
 * Facts search and barcode lookups on or off; the built-in USDA database always works offline.
 */
export function FoodSettings() {
  const navigate = useNavigate();
  const fs = useFoodSettings();
  const targets = useDayTargets(foodDayKey(Date.now()));
  const dbState = useFoodDb();
  const counts = useLiveQuery(async () => ({ usda: await db.foods.where('source').equals('usda').count(), mine: await db.foods.filter((f) => !!f.mine && !f.deletedAt).count() }), [dbState.status]);
  const builtIn =
    dbState.status === 'loading'
      ? `Loading · ${Math.round((dbState.done / Math.max(dbState.total, 1)) * 100)}%`
      : dbState.status === 'error'
        ? 'Didn’t load'
        : counts
          ? `${fmtInt(counts.usda)} foods`
          : '';
  return (
    <Screen header={<TopBar left={<BackButton label="Settings" onClick={() => navigate(-1)} />} title="Food" />}>
      <SectionLabel>Targets</SectionLabel>
      <Row chevron onClick={() => navigate(fs.setUp ? '/food/targets' : '/food/setup')}>
        <span className="flex-1 text-body-lg">Targets</span>
        <span className="text-callout tabular-nums text-fg2">{!fs.setUp ? 'Not set up' : targets?.kcal ? `${fmtInt(targets.kcal)} kcal` : 'Just log'}</span>
      </Row>
      <Row chevron onClick={() => navigate('/food/targets/nutrients')}>
        <span className="flex-1 text-body-lg">Nutrient targets</span>
      </Row>

      <SectionLabel>Where foods come from</SectionLabel>
      <ToggleRow
        label="Look up foods online"
        detail="Search Open Food Facts for packaged foods and look up barcodes. Requests carry only the search or the barcode."
        on={fs.online}
        onChange={(v) => void updateFoodSettings({ online: v })}
      />
      <InfoRow label="Built-in foods (USDA)" value={builtIn} />
      <InfoRow label="Your foods" value={counts ? fmtInt(counts.mine) : ''} />
      {dbState.status === 'error' && (
        <Row onClick={() => void ensureFoodDb()}>
          <span className="flex-1 text-body-lg font-semibold text-accent">Try loading again</span>
        </Row>
      )}
      <Note className="mt-3">The built-in foods come from USDA FoodData Central and work offline, with full vitamins and minerals. Open Food Facts adds packaged foods by name or barcode; what you log or star from it is kept on this phone.</Note>
    </Screen>
  );
}
