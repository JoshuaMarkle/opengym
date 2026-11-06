import { useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { Sheet, SheetOption, useToast } from '../../components/overlays';
import { BarButton, Button, cx, EmptyState, Note, Screen, Segmented, StatRow, TopBar } from '../../components/ui';
import { useData } from '../../data/DataProvider';
import { importWorkouts, markOnboarded, type ImportDecision } from '../../data/backup';
import type { Units } from '../../db/types';
import { fmtMonthShortYear } from '../../lib/dates';
import { ImportError, parseImportCsv, type ParsedImport } from '../../lib/importParser';
import { matchExerciseName, type MatchConfidence } from '../../lib/match';
import { ExercisePicker } from '../exercises/ExercisePicker';

interface Row {
  name: string;
  exerciseId?: string;
  confidence: MatchConfidence;
  /** You picked this yourself, so it no longer needs a look. */
  reviewed: boolean;
}

const SOURCE: Record<ParsedImport['source'], string> = { strong: 'Strong', hevy: 'Hevy', opengym: 'OpenGym CSV' };

/** 9.5: import a Strong / Hevy CSV. Adds to history; nothing is replaced. */
export function ImportScreen() {
  const navigate = useNavigate();
  const toast = useToast();
  const { exercises, exerciseMap, settings } = useData();
  const fileRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState('');
  const [parsed, setParsed] = useState<ParsedImport | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [units, setUnits] = useState<Units>(settings.units);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState<string | null>(null);
  const [picking, setPicking] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const leave = () => (window.history.length > 1 ? navigate(-1) : navigate(settings.onboarded ? '/settings' : '/welcome'));

  const onFile = async (file: File) => {
    setError('');
    try {
      const p = parseImportCsv(await file.text());
      if (!p.workouts.length) throw new ImportError('No workouts with sets found in that file.');
      const library = exercises.map((e) => ({ id: e.id, name: e.name, equipment: e.equipment }));
      setRows(p.exerciseNames.map((name) => ({ name, ...matchExerciseName(name, library), reviewed: false })));
      setParsed(p);
      setFileName(file.name);
      if (p.units) setUnits(p.units);
    } catch (e) {
      setParsed(null);
      setError(e instanceof ImportError ? e.message : "Couldn't read that file. Is it a CSV export?");
    }
  };

  const matched = rows.filter((r) => r.confidence === 'sure' || r.reviewed);
  const needs = rows.filter((r) => r.confidence !== 'sure' && !r.reviewed);
  const first = useMemo(() => (parsed ? Math.min(...parsed.workouts.map((w) => w.startedAt)) : undefined), [parsed]);
  const setsTotal = useMemo(() => parsed?.workouts.reduce((n, w) => n + w.exercises.reduce((m, e) => m + e.sets.length, 0), 0) ?? 0, [parsed]);

  const run = async () => {
    if (!parsed) return;
    setBusy(true);
    try {
      const decisions = new Map<string, ImportDecision>();
      for (const r of rows) decisions.set(r.name, r.exerciseId ? { exerciseId: r.exerciseId } : { createName: r.name });
      const res = await importWorkouts(parsed, decisions, units);
      if (!settings.onboarded) await markOnboarded();
      toast({
        message: `Added ${res.added} ${res.added === 1 ? 'workout' : 'workouts'}${res.skipped ? ` · ${res.skipped} already here` : ''}`,
        duration: 6000,
      });
      navigate(settings.onboarded ? '/history' : '/', { replace: true, state: { onboarded: true } });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Import failed.');
    } finally {
      setBusy(false);
    }
  };

  const update = (name: string, patch: Partial<Row>) => setRows((rs) => rs.map((r) => (r.name === name ? { ...r, ...patch } : r)));
  const editRow = rows.find((r) => r.name === editing);

  const row = (r: Row) => {
    const target = r.exerciseId ? exerciseMap.get(r.exerciseId)?.name : undefined;
    const unsure = r.confidence === 'unsure' && !r.reviewed;
    return (
      <button key={r.name} type="button" onClick={() => setEditing(r.name)} className="flex min-h-[48px] w-full items-center gap-2 border-b border-line py-1.5 text-left text-[14.5px] active:bg-surface/60">
        <span className="min-w-0 flex-1 truncate">{r.name}</span>
        <span className="flex-none text-fg3">→</span>
        <span className={cx('min-w-0 max-w-[48%] flex-none truncate text-right font-semibold', target ? (unsure ? 'text-warn' : 'text-fg') : 'text-accent')}>
          {target ?? '+ New exercise'}
          {unsure && ' ?'}
        </span>
      </button>
    );
  };

  return (
    <Screen
      header={
        <TopBar
          left={
            <BarButton kind="muted" onClick={leave}>
              Cancel
            </BarButton>
          }
          title="Import"
          right={
            <BarButton kind="bold" disabled={!parsed || busy} onClick={() => void run()}>
              Import
            </BarButton>
          }
        />
      }
    >
      <input
        ref={fileRef}
        type="file"
        accept=".csv,text/csv,text/comma-separated-values,text/plain"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = '';
          if (f) void onFile(f);
        }}
      />
      {!parsed ? (
        <div className="pt-12">
          <EmptyState icon="⇪" title="Import from Strong or Hevy">
            Export a CSV from the other app, then pick the file here. Your workouts are added to History; nothing is replaced.
          </EmptyState>
          {error && <p className="mt-4 text-center text-[14px] font-semibold text-danger">{error}</p>}
          <Button className="mx-auto mt-6 max-w-[280px]" onClick={() => fileRef.current?.click()}>
            Choose CSV file
          </Button>
          <div className="mt-8 border-t border-line pt-3 text-[13px] leading-relaxed text-fg2">
            <p>
              <b className="text-fg">Strong:</b> Settings → Export Strong Data.
            </p>
            <p className="mt-1">
              <b className="text-fg">Hevy:</b> Settings → Export &amp; Import Data → Export Workouts.
            </p>
          </div>
        </div>
      ) : (
        <>
          <button type="button" onClick={() => fileRef.current?.click()} className="mt-3 flex w-full items-center justify-between text-left">
            <span className="min-w-0">
              <b className="block truncate text-[17px]">{fileName}</b>
              <span className="text-[13px] text-fg2">
                {SOURCE[parsed.source]} export · {setsTotal} sets
                {parsed.skippedRows ? ` · ${parsed.skippedRows} cardio/timed rows skipped` : ''}
              </span>
            </span>
            <span className="flex-none text-[14px] font-semibold text-accent">Change</span>
          </button>
          <StatRow
            className="mt-3"
            items={[
              { label: 'Workouts', value: parsed.workouts.length },
              { label: 'Exercises', value: rows.length },
              { label: 'From', value: first ? fmtMonthShortYear(first) : '—' },
            ]}
          />

          <div className="mt-4 flex items-center justify-between gap-3">
            <span className="text-[14px] text-fg2">Weights in the file are in</span>
            {parsed.units ? (
              <span className="text-[15px] font-semibold">{parsed.units === 'kg' ? 'kg' : 'lbs'}</span>
            ) : (
              <Segmented
                className="w-[140px]"
                options={[
                  { value: 'lb' as Units, label: 'lbs' },
                  { value: 'kg' as Units, label: 'kg' },
                ]}
                value={units}
                onChange={setUnits}
              />
            )}
          </div>

          <div className="mt-5 flex justify-between border-b border-line pb-1.5 text-[11px] font-bold tracking-[0.06em] text-fg2 uppercase">
            <span>Matched</span>
            <span className="font-semibold tracking-normal normal-case">
              {matched.length} of {rows.length}
            </span>
          </div>
          {matched.map(row)}
          {needs.length > 0 && (
            <>
              <div className="mt-5 flex justify-between border-b border-line pb-1.5 text-[11px] font-bold tracking-[0.06em] text-warn uppercase">
                <span>Needs a look</span>
                <span className="font-semibold tracking-normal">{needs.length}</span>
              </div>
              {needs.map(row)}
            </>
          )}
          <Note>Tap any row to change the match. Imported workouts are added to your history; nothing is replaced. Workouts already here are skipped.</Note>
          {error && <p className="mt-3 text-[14px] font-semibold text-danger">{error}</p>}
          <Button className="mt-5" disabled={busy} onClick={() => void run()}>
            {busy ? 'Importing…' : `Import ${parsed.workouts.length} workouts`}
          </Button>
        </>
      )}

      <Sheet open={!!editRow} onClose={() => setEditing(null)} title={editRow?.name} subtitle="Which exercise is this in OpenGym?">
        {editRow && (
          <>
            {editRow.exerciseId && editRow.confidence !== 'new' && (
              <SheetOption
                onClick={() => {
                  update(editRow.name, { reviewed: true });
                  setEditing(null);
                }}
                detail="looks right"
              >
                {exerciseMap.get(editRow.exerciseId)?.name}
              </SheetOption>
            )}
            <SheetOption
              onClick={() => {
                setPicking(editRow.name);
                setEditing(null);
              }}
            >
              Pick another exercise…
            </SheetOption>
            <SheetOption
              tone="accent"
              onClick={() => {
                update(editRow.name, { exerciseId: undefined, confidence: 'new', reviewed: true });
                setEditing(null);
              }}
            >
              + New exercise "{editRow.name}"
            </SheetOption>
          </>
        )}
      </Sheet>
      <ExercisePicker
        open={!!picking}
        mode="single"
        title={picking ?? 'Match'}
        onCancel={() => setPicking(null)}
        onPick={(id) => {
          if (picking) update(picking, { exerciseId: id, confidence: 'sure', reviewed: true });
          setPicking(null);
        }}
      />
    </Screen>
  );
}
