import { lazy, Suspense } from 'react';
import { HashRouter, Navigate, Route, Routes, useLocation } from 'react-router';
import { LogoMark } from './components/icons';
import { ToastProvider } from './components/overlays';
import { TabLayout } from './components/TabLayout';
import { DataProvider, useSettings } from './data/DataProvider';
import { StartWorkoutProvider } from './hooks/StartWorkout';
import { ExerciseForm } from './screens/exercises/ExerciseForm';
import { ExerciseScreen } from './screens/exercises/ExerciseScreen';
import { Library } from './screens/exercises/Library';
import { EditWorkout } from './screens/history/EditWorkout';
import { WorkoutDetail } from './screens/history/WorkoutDetail';
import { AddFood } from './screens/food/AddFood';
import { CopyDay } from './screens/food/CopyDay';
import { DayNutrients } from './screens/food/DayNutrients';
import { FillNutrients } from './screens/food/FillNutrients';
import { NutrientFoods } from './screens/food/NutrientFoods';
import { FoodForm } from './screens/food/FoodForm';
import { QuickAdd } from './screens/food/QuickAdd';
import { SavedMealScreen } from './screens/food/SavedMeal';
import { FoodDay } from './screens/food/FoodDay';
import { FoodWeek } from './screens/food/FoodWeek';
import { EntryItem, FoodItem } from './screens/food/FoodItem';
import { NutrientTargets } from './screens/food/NutrientTargets';
import { Scanner } from './screens/food/Scanner';
import { FoodSetup } from './screens/food/Setup';
import { Targets } from './screens/food/Targets';
import { Home } from './screens/home/Home';
import { InstallGuide } from './screens/onboarding/InstallGuide';
import { Setup } from './screens/onboarding/Setup';
import { Welcome } from './screens/onboarding/Welcome';
import { Plans } from './screens/plans/Plans';
import { PlanScreen } from './screens/plans/PlanScreen';
import { RoutineBuilder } from './screens/plans/RoutineBuilder';
import { RoutineScreen } from './screens/plans/RoutineScreen';
import { ScheduleEditor } from './screens/plans/ScheduleEditor';
import { LiftDetail } from './screens/progress/LiftDetail';
import { CardioMachine, DistanceRecords } from './screens/progress/Cardio';
import { PinnedLifts } from './screens/progress/PinnedLifts';
import { Progress } from './screens/progress/Progress';
import { GoalDetail, NewGoal } from './screens/progress/Goals';
import { LiftTrend } from './screens/progress/LiftTrend';
import { MonthReview } from './screens/progress/MonthReview';
import { ImportScreen } from './screens/settings/ImportScreen';
import { SettingPicker } from './screens/settings/SettingPicker';
import { Settings } from './screens/settings/Settings';
import { EffortSettings } from './screens/settings/EffortSettings';
import { FoodSettings } from './screens/settings/FoodSettings';
import { EffortTargetScreen, PhaseScreen, TrainingSettings } from './screens/settings/Training';
import { Summary } from './screens/workout/Summary';
import { WorkoutScreen } from './screens/workout/WorkoutScreen';

function Splash() {
  return (
    <div className="flex h-full items-center justify-center">
      <LogoMark size={64} />
    </div>
  );
}

// 0.1: the component gallery (design/DESIGN.md). Dev builds only; production never loads the chunk.
const Gallery = import.meta.env.DEV ? lazy(() => import('./screens/dev/Gallery')) : null;

const ONBOARDING = ['/welcome', '/install', '/setup', '/settings/import', '/dev/ui'];

function AppRoutes() {
  const settings = useSettings();
  const { pathname, state } = useLocation();
  // `state.onboarded` covers the moment between finishing onboarding and the live settings catching up.
  const justOnboarded = (state as { onboarded?: boolean } | null)?.onboarded === true;
  if (!settings.onboarded && !justOnboarded && !ONBOARDING.includes(pathname)) return <Navigate to="/welcome" replace />;
  return (
    <Routes>
      <Route element={<TabLayout />}>
        <Route index element={<Home />} />
        <Route path="calendar" element={<Plans />} />
        <Route path="plans" element={<Navigate to="/calendar?view=routines" replace />} />
        <Route path="history" element={<Navigate to="/calendar?view=history" replace />} />
        <Route path="food" element={<FoodDay />} />
        <Route path="food/day/:day" element={<FoodDay />} />
        <Route path="food/week/:day" element={<FoodWeek />} />
        <Route path="progress" element={<Progress />} />
        <Route path="progress/lift/:id" element={<LiftDetail />} />
        <Route path="progress/lift/:id/trend" element={<LiftTrend />} />
        <Route path="progress/goal/:id" element={<GoalDetail />} />
        <Route path="progress/month" element={<MonthReview />} />
        <Route path="progress/cardio/:id" element={<CardioMachine />} />
        <Route path="progress/cardio-records" element={<DistanceRecords />} />
        <Route path="settings" element={<Settings />} />
        <Route path="settings/effort" element={<EffortSettings />} />
        <Route path="settings/food" element={<FoodSettings />} />
        <Route path="settings/training" element={<TrainingSettings />} />
        <Route path="settings/effort-target" element={<EffortTargetScreen />} />
        <Route path="settings/:key" element={<SettingPicker />} />
      </Route>
      <Route path="settings/import" element={<ImportScreen />} />
      <Route path="food/setup" element={<FoodSetup />} />
      <Route path="food/targets" element={<Targets />} />
      <Route path="food/targets/nutrients" element={<NutrientTargets />} />
      <Route path="food/add" element={<AddFood />} />
      <Route path="food/item/:foodId" element={<FoodItem />} />
      <Route path="food/entry/:entryId" element={<EntryItem />} />
      <Route path="food/new" element={<FoodForm />} />
      <Route path="food/edit/:id" element={<FoodForm />} />
      <Route path="food/quick" element={<QuickAdd />} />
      <Route path="food/meal/:id" element={<SavedMealScreen />} />
      <Route path="food/copy-day" element={<CopyDay />} />
      <Route path="food/nutrients/:day" element={<DayNutrients />} />
      <Route path="food/nutrients/:day/:nid" element={<NutrientFoods />} />
      <Route path="food/fill/:id" element={<FillNutrients />} />
      <Route path="food/scan" element={<Scanner />} />
      <Route path="progress/pinned" element={<PinnedLifts />} />
      <Route path="settings/phase" element={<PhaseScreen />} />
      <Route path="progress/goal/new" element={<NewGoal />} />
      <Route path="history/:id" element={<WorkoutDetail />} />
      <Route path="history/:id/edit" element={<EditWorkout />} />
      <Route path="plan/:id" element={<PlanScreen />} />
      <Route path="plan/:id/schedule" element={<ScheduleEditor />} />
      <Route path="plan/:id/calendar" element={<ScheduleEditor />} />
      <Route path="routine/new" element={<RoutineBuilder key="new" />} />
      <Route path="routine/:id" element={<RoutineScreen />} />
      <Route path="routine/:id/edit" element={<RoutineBuilder />} />
      <Route path="workout" element={<WorkoutScreen />} />
      <Route path="summary/:id" element={<Summary />} />
      <Route path="exercises" element={<Library />} />
      <Route path="exercises/new" element={<ExerciseForm key="new" />} />
      <Route path="exercises/:id" element={<ExerciseScreen />} />
      <Route path="exercises/:id/edit" element={<ExerciseForm />} />
      <Route path="welcome" element={<Welcome />} />
      <Route path="install" element={<InstallGuide />} />
      <Route path="setup" element={<Setup />} />
      {Gallery && (
        <Route
          path="dev/ui"
          element={
            <Suspense fallback={null}>
              <Gallery />
            </Suspense>
          }
        />
      )}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export function App() {
  return (
    <HashRouter>
      <div className="relative mx-auto h-dvh max-w-[520px] overflow-hidden pt-safe min-[521px]:border-x min-[521px]:border-line">
        <DataProvider fallback={<Splash />}>
          <ToastProvider>
            <StartWorkoutProvider>
              <AppRoutes />
            </StartWorkoutProvider>
          </ToastProvider>
        </DataProvider>
      </div>
    </HashRouter>
  );
}
