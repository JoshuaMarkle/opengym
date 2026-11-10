import { useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router';
import {
  ArrowGlyph,
  CalendarIcon,
  ChartIcon,
  CheckGlyph,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ClipboardIcon,
  CloseIcon,
  Handle,
  KeyboardGlyph,
  ListIcon,
  MinusGlyph,
  MoreGlyph,
  PencilGlyph,
  PlayGlyph,
  PlusGlyph,
  SearchGlyph,
  TargetGlyph,
  TrendDown,
  TrendUp,
  WarnGlyph,
} from '../../components/icons';
import {
  AddButton,
  AddRow,
  AttentionNote,
  BackButton,
  Badge,
  BarButton,
  BarChip,
  Button,
  CalendarLegend,
  ChangedOutline,
  Check,
  Chips,
  ChoiceTile,
  CompactSegmented,
  ConfirmedBar,
  CountRing,
  Dash,
  DataHeader,
  DataRow,
  DayCell,
  DayCode,
  DayDisc,
  DayDots,
  DeleteDisc,
  DetailTitle,
  Disc,
  DiscFace,
  DoneDisc,
  DragHandle,
  DropBadge,
  EditRow,
  EmptyState,
  Fab,
  FieldLabel,
  FolderChevron,
  FolderLabel,
  FolderMenuButton,
  GoalBar,
  IconButton,
  IconSegmented,
  InfoRow,
  InfoSubRow,
  InfoTable,
  InlineBar,
  InlineInput,
  LabelAction,
  LabeledBar,
  LargeHeader,
  LiveDot,
  LiveStatus,
  MoreLabel,
  NavCard,
  Note,
  OfferBar,
  PickerBox,
  Pill,
  PlanTable,
  PlayButton,
  Radio,
  Ring,
  Row,
  RowText,
  Screen,
  SearchField,
  SectionLabel,
  SegmentBar,
  Segmented,
  StartPill,
  StatRow,
  StatusPill,
  Stepper,
  Tag,
  TargetBar,
  TextButton,
  TextField,
  Toggle,
  TopBar,
  ValueBox,
  VariationChip,
  Weekday,
  WorkoutBar,
} from '../../components/ui';

/**
 * 0.1 Component gallery (dev only, `#/dev/ui`): every shared component with its variants,
 * so the real thing can be compared with design/proposals/design-system.html.
 */
export default function Gallery() {
  const navigate = useNavigate();
  return (
    <Screen header={<TopBar left={<BackButton label="Home" onClick={() => navigate('/')} />} title="Components" />}>
      <Tokens />
      <Headers />
      <Rows />
      <Buttons />
      <Tables />
      <Progress />
      <Controls />
      <Notices />
      <Calendars />
      <Glyphs />
    </Screen>
  );
}

function Group({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section id={id} className="mt-8">
      <div className="text-title3">{title}</div>
      {children}
    </section>
  );
}

function Spec({ name, children }: { name: string; children: ReactNode }) {
  return (
    <div className="mt-4">
      <div className="text-caption text-fg3">{name}</div>
      <div className="mt-1.5">{children}</div>
    </div>
  );
}

const noop = () => {};

function Tokens() {
  const type: [string, string][] = [
    ['text-hero', 'Hero 40'],
    ['text-display', 'Display 34'],
    ['text-title1', 'Title 1 · 30'],
    ['text-title2', 'Title 2 · 22'],
    ['text-title3', 'Title 3 · 19'],
    ['text-headline', 'Headline 17'],
    ['text-body-lg', 'Body large 17'],
    ['text-input', 'Input 16 · 185'],
    ['text-body', 'Body 15'],
    ['text-callout', 'Callout 14'],
    ['text-footnote', 'Footnote 13'],
    ['text-caption', 'Caption 12'],
    ['text-caps', 'Caps 11'],
    ['text-micro', 'Micro 10'],
  ];
  const colors = ['bg-bg', 'bg-raised', 'bg-surface', 'bg-surface-2', 'bg-key-fn', 'bg-line', 'bg-line-strong', 'bg-fg', 'bg-fg2', 'bg-fg3', 'bg-accent', 'bg-tip', 'bg-warn', 'bg-danger', 'bg-done', 'bg-edit', 'bg-accent-soft', 'bg-effort'];
  const radii = ['rounded-xs', 'rounded-sm', 'rounded-md', 'rounded-lg', 'rounded-xl', 'rounded-full'];
  return (
    <Group id="tokens" title="§1–§4 Tokens">
      <Spec name="Type scale">
        {type.map(([cls, label]) => (
          <div key={cls} className="flex items-baseline justify-between gap-3 border-b border-line py-1">
            <span className={cls}>{label}</span>
            <span className="text-caption text-fg3">{cls}</span>
          </div>
        ))}
      </Spec>
      <Spec name="Colors">
        <div className="grid grid-cols-6 gap-2">
          {colors.map((c) => (
            <div key={c} className="text-micro font-semibold text-fg2">
              <div className={`h-8 rounded-sm border border-line-strong ${c}`} />
              <div className="mt-1 truncate">{c.slice(3)}</div>
            </div>
          ))}
        </div>
      </Spec>
      <Spec name="Radii">
        <div className="flex gap-2">
          {radii.map((r) => (
            <div key={r} className="text-micro font-semibold text-fg2">
              <div className={`h-11 w-11 border border-accent bg-accent-soft ${r}`} />
              <div className="mt-1">{r.slice(8)}</div>
            </div>
          ))}
        </div>
      </Spec>
    </Group>
  );
}

function Headers() {
  return (
    <Group id="headers" title="§5 Headers">
      <Spec name="LargeHeader">
        <div className="-mx-4">
          <LargeHeader title="Progress" subtitle="Thursday, Nov 5" right={<IconButton label="Range" onClick={noop}>3M</IconButton>} />
        </div>
      </Spec>
      <Spec name="TopBar · BarButton plain / bold / muted">
        <div className="-mx-4">
          <TopBar left={<BarButton kind="muted">Cancel</BarButton>} title="New routine" right={<BarButton kind="bold">Done</BarButton>} />
        </div>
      </Spec>
      <Spec name="SectionLabel · tones · LabelAction">
        <SectionLabel action={<LabelAction onClick={noop}>Calendar</LabelAction>}>This week</SectionLabel>
        <SectionLabel tone="warn">Missed</SectionLabel>
        <SectionLabel tone="accent">Superset · 3 rounds</SectionLabel>
      </Spec>
      <Spec name="DetailTitle">
        <DetailTitle title="Push Day" meta="6 exercises · last done Nov 3" />
      </Spec>
      <Spec name="WorkoutBar · past date">
        <div className="-mx-4">
          <WorkoutBar name="Push Day" meta="12:04 · 3 of 6" backLabel="All" onBack={noop} onOptions={noop} onFinish={noop} />
          <WorkoutBar name="Pull Day" meta="Bench press" pastDate="Nov 4" backLabel="All" onBack={noop} onOptions={noop} onFinish={noop} />
        </div>
      </Spec>
      <Spec name="FieldLabel">
        <FieldLabel className="mt-0">Routine name</FieldLabel>
      </Spec>
    </Group>
  );
}

function Rows() {
  return (
    <Group id="rows" title="§6 Rows">
      <Spec name="Row single · chevron">
        <Row onClick={noop} chevron>
          <span className="flex-1 text-body-lg">Units</span>
          <span className="text-body text-fg2">lb</span>
        </Row>
        <Row>
          <span className="flex-1 text-body-lg">Effort tracking</span>
          <Toggle on label="Effort" onChange={noop} />
        </Row>
      </Spec>
      <Spec name="Row two · RowText · badge">
        <Row variant="two" onClick={noop}>
          <RowText title="Push Day" subtitle="6 exercises · Nov 3" badge={<Badge variant="next">Next</Badge>} />
          <PlayButton primary label="Start" onClick={noop} />
        </Row>
      </Spec>
      <Spec name="Row dense · RowText dense">
        <Row variant="dense" onClick={noop} chevron>
          <RowText dense title="Bench press" subtitle="3 × 5 · 185 lb" />
        </Row>
      </Spec>
      <Spec name="Folder row closed / open · FolderMenuButton">
        <Row>
          <FolderChevron open={false} />
          <span className="flex-1">
            <FolderLabel label="Strength" count={4} open={false} />
          </span>
        </Row>
        <Row>
          <FolderChevron open />
          <span className="flex-1">
            <FolderLabel label="Hypertrophy" count={3} open note="active" />
          </span>
          <FolderMenuButton label="Folder options" onClick={noop} />
        </Row>
      </Spec>
      <Spec name="EditRow · DeleteDisc · DragHandle · lifted">
        <EditRow leading={<DeleteDisc label="Delete" onClick={noop} />} trailing={<DragHandle label="Reorder" />}>
          <RowText dense title="Bench press" />
        </EditRow>
        <EditRow lifted leading={<DeleteDisc label="Delete" onClick={noop} />} trailing={<DragHandle label="Reorder" />}>
          <RowText dense title="Overhead press" />
        </EditRow>
      </Spec>
      <Spec name="AddRow">
        <AddRow onClick={noop}>Add routine</AddRow>
      </Spec>
    </Group>
  );
}

function Buttons() {
  return (
    <Group id="buttons" title="§9 Buttons">
      <Spec name="Button primary / secondary / danger / disabled">
        <div className="flex flex-col gap-2">
          <Button>Start workout</Button>
          <div className="grid grid-cols-2 gap-2">
            <Button kind="secondary">Discard</Button>
            <Button kind="danger">Delete</Button>
          </div>
          <Button disabled>Save</Button>
        </div>
      </Spec>
      <Spec name="StartPill · PlayButton · DoneDisc">
        <div className="flex items-center gap-4">
          <StartPill label="Start" onClick={noop} />
          <PlayButton primary label="Start" onClick={noop} />
          <PlayButton label="Start" onClick={noop} />
          <DoneDisc />
        </div>
      </Spec>
      <Spec name="Button compact (Finish only)">
        <Button size="compact">Finish</Button>
      </Spec>
      <Spec name="Disc S / L × action, grey, success, warn, danger">
        <div className="flex items-center">
          {(['action', 'grey', 'success', 'warn', 'danger'] as const).map((t) => (
            <Disc key={t} size="s" tone={t} label={t} onClick={noop}>
              <CheckGlyph size={12} />
            </Disc>
          ))}
        </div>
        <div className="flex items-center">
          {(['action', 'grey', 'success', 'warn', 'danger'] as const).map((t) => (
            <Disc key={t} tone={t} label={t} onClick={noop}>
              <CheckGlyph size={14} />
            </Disc>
          ))}
          <Disc tone="grey" label="disabled" disabled onClick={noop}>
            <PlayGlyph size={12} />
          </Disc>
        </div>
      </Spec>
      <Spec name="DiscFace (a mark, not a button)">
        <div className="flex items-center gap-3">
          <DiscFace size="s">1</DiscFace>
          <DiscFace size="s" tone="grey">
            <CheckGlyph size={12} />
          </DiscFace>
        </div>
      </Spec>
      <Spec name="TextButton accent / muted / danger / small">
        <div className="flex gap-4">
          <TextButton>Undo</TextButton>
          <TextButton tone="muted">Skip</TextButton>
          <TextButton tone="danger">Delete</TextButton>
          <TextButton small>Change</TextButton>
        </div>
      </Spec>
      <Spec name="NavCard left / right action / compact">
        <div className="grid grid-cols-2 gap-2">
          <NavCard small="Previous" side="left" onClick={noop}>
            Bench press
          </NavCard>
          <NavCard small="Next" side="right" tone="action" align="right" onClick={noop}>
            Rows
          </NavCard>
          <NavCard small="Previous" side="left" compact onClick={noop}>
            Squat
          </NavCard>
        </div>
      </Spec>
      <Spec name="Fab">
        <div className="flex justify-end">
          <Fab label="Keyboard" onClick={noop}>
            <KeyboardGlyph size={20} />
          </Fab>
        </div>
      </Spec>
      <Spec name="AddButton accent / warn">
        <div className="grid grid-cols-2 gap-2">
          <AddButton tone="warn">+ Drop</AddButton>
          <AddButton>+ Set</AddButton>
        </div>
      </Spec>
      <Spec name="IconButton off / on">
        <div className="flex gap-2">
          <IconButton label="Range" onClick={noop}>
            3M <ChevronDown size={9} />
          </IconButton>
          <IconButton label="W/D" active onClick={noop}>
            W/D
          </IconButton>
        </div>
      </Spec>
    </Group>
  );
}

function Controls() {
  const [seg, setSeg] = useState('lifts');
  const [chip, setChip] = useState('all');
  const [text, setText] = useState('Push Day');
  const [q, setQ] = useState('');
  const [on, setOn] = useState(true);
  const [icon, setIcon] = useState('cal');
  const [mode, setMode] = useState<'n' | 'p'>('n');
  const [field, setField] = useState<'w' | 'r'>('w');
  const [val, setVal] = useState('185');
  return (
    <Group id="controls" title="§10 Controls">
      <Spec name="Segmented">
        <Segmented
          options={[
            { value: 'lifts', label: 'Lifts' },
            { value: 'goals', label: 'Goals' },
            { value: 'cardio', label: 'Cardio' },
          ]}
          value={seg}
          onChange={setSeg}
        />
      </Spec>
      <Spec name="IconSegmented">
        <IconSegmented
          label="View"
          options={[
            { value: 'cal', label: <CalendarIcon size={18} />, ariaLabel: 'Calendar' },
            { value: 'plan', label: <ClipboardIcon size={18} />, ariaLabel: 'Routines' },
            { value: 'list', label: <ListIcon size={18} />, ariaLabel: 'List' },
          ]}
          value={icon}
          onChange={setIcon}
        />
      </Spec>
      <Spec name="CompactSegmented neutral / action">
        <div className="flex gap-3">
          <CompactSegmented label="Mode" options={[{ value: 'n', label: '123' }, { value: 'p', label: 'Plates' }]} value={mode} onChange={setMode} />
          <CompactSegmented label="Field" tone="action" options={[{ value: 'w', label: 'Weight' }, { value: 'r', label: 'Reps' }]} value={field} onChange={setField} />
        </div>
      </Spec>
      <Spec name="Chips">
        <Chips
          options={['all', 'chest', 'back', 'legs', 'arms'].map((v) => ({ value: v, label: v[0].toUpperCase() + v.slice(1) }))}
          value={chip}
          onChange={setChip}
        />
      </Spec>
      <Spec name="VariationChip current / history / other / more">
        <div className="flex flex-wrap gap-1.5">
          <VariationChip state="current" onClick={noop}>
            Barbell
          </VariationChip>
          <VariationChip state="history" onClick={noop}>
            Dumbbell
          </VariationChip>
          <VariationChip state="other" onClick={noop}>
            Machine
          </VariationChip>
          <VariationChip state="more" onClick={noop}>
            <MoreLabel>All 6</MoreLabel>
          </VariationChip>
        </div>
      </Spec>
      <Spec name="ChoiceTile off / on">
        <div className="grid grid-cols-3 gap-2">
          <ChoiceTile on label="Estimate" value="No date" onClick={noop} />
          <ChoiceTile on={false} label="Likely" value="Feb 1" onClick={noop} />
          <ChoiceTile on={false} label="Pick" value="Custom…" onClick={noop} />
        </div>
      </Spec>
      <Spec name="ValueBox · PickerBox · InlineInput · Stepper">
        <div className="grid grid-cols-2 gap-3">
          <ValueBox value={val} onChange={setVal} unit="lb" label="Weight" />
          <div className="mt-1.5">
            <PickerBox label="Bar" onClick={noop}>
              45 lb
            </PickerBox>
          </div>
        </div>
        <div className="mt-2 flex items-center justify-between">
          <InlineInput value={val} onChange={setVal} unit="lb" label="Inline" />
          <Stepper label="Rest" onDown={noop} onUp={noop}>
            2:00
          </Stepper>
        </div>
      </Spec>
      <Spec name="TextField · SearchField">
        <TextField value={text} onChange={setText} label="Routine name" />
        <SearchField value={q} onChange={setQ} placeholder="Search exercises" />
      </Spec>
      <Spec name="Toggle · Radio · Check">
        <div className="flex items-center gap-4">
          <Toggle on={on} onChange={setOn} label="Toggle" />
          <Toggle on={false} onChange={noop} label="Toggle off" />
          <Radio on />
          <Radio on={false} />
          <Check on />
          <Check on={false} />
        </div>
      </Spec>
      <Spec name="Badge next / tag / muted / d / success">
        <div className="flex items-center gap-3">
          <Badge variant="next">Next</Badge>
          <Badge variant="tag">BW</Badge>
          <Badge variant="muted">Rest</Badge>
          <Badge variant="d">D</Badge>
          <Badge variant="success">Done</Badge>
        </div>
      </Spec>
      <Spec name="StatusPill up / down / same / new · BarChip">
        <div className="flex items-center gap-3">
          <StatusPill tone="up">+5 lb</StatusPill>
          <StatusPill tone="down">−5 lb</StatusPill>
          <StatusPill tone="same">Same</StatusPill>
          <StatusPill tone="new">New</StatusPill>
          <BarChip label="Bar 45" onPress={noop} />
        </div>
      </Spec>
      <Spec name="Pill · Tag · DropBadge">
        <div className="flex items-center gap-3">
          <Pill tone="accent">NEXT</Pill>
          <Pill>Rest</Pill>
          <span className="text-headline">
            Pull-up<Tag>BW</Tag>
          </span>
          <DropBadge />
          <DropBadge small />
        </div>
      </Spec>
    </Group>
  );
}

function Notices() {
  return (
    <Group id="notices" title="§11 Notices">
      <Spec name="OfferBar up / down / no actions">
        <OfferBar title="Use suggested weights?" tone="tip" trend="up" reason="All sets topped out 8 at 2 RIR" onWhy={noop} onDismiss={noop} onAccept={noop} />
        <OfferBar title="Use suggested weights?" tone="warn" trend="down" reason="Set 2 fell under 6 at failure" onWhy={noop} onDismiss={noop} onAccept={noop} />
        <OfferBar title="Weights set for you" tone="tip" reason="185 × 3 from last session" onWhy={noop} />
      </Spec>
      <Spec name="OfferBar question (no hairline) · kicker">
        <OfferBar title="Back after 3 weeks?" tone="warn" reason="Bench press was last logged Oct 12" onDismiss={noop} line={false} />
        <OfferBar kicker="Tip" onDismiss={noop}>
          Long-press a set to add a drop set.
        </OfferBar>
      </Spec>
      <Spec name="ConfirmedBar tip / warn">
        <ConfirmedBar onUndo={noop}>Using the suggested weights</ConfirmedBar>
        <ConfirmedBar tone="warn" onUndo={noop}>
          Using the suggested weights
        </ConfirmedBar>
      </Spec>
      <Spec name="AttentionNote">
        <AttentionNote
          className="mt-0"
          lead="Missed Tuesday."
          actions={
            <>
              <TextButton>Move it</TextButton>
              <TextButton tone="muted">Skip</TextButton>
            </>
          }
        >
          Push Day is still next.
        </AttentionNote>
      </Spec>
      <Spec name="LiveDot · LiveStatus">
        <LiveDot />
        <LiveStatus title="Push Day" timer="24:10" where="Bench press" detail="set 3 of 4" steps={['done', 'done', 'current', 'todo', 'todo']} onResume={noop} />
      </Spec>
      <Spec name="EmptyState">
        <EmptyState icon={<TargetGlyph />} title="No goals yet">
          Pick a lift and a target.
        </EmptyState>
      </Spec>
      <Spec name="Note">
        <Note className="mt-0">Each bar is one month. Tap a year to open it.</Note>
      </Spec>
    </Group>
  );
}

function Tables() {
  const cols = 'grid-cols-[46px_44px_1fr_60px]';
  return (
    <Group id="tables" title="§7 Tables">
      <Spec name="PlanTable with previous">
        <PlanTable
          showPrev
          weightLabel="LBS"
          rows={[
            { id: 'w', label: 'W', prev: '95 × 8', weight: '95', reps: '8' },
            { id: '1', label: '1', prev: '185 × 5', weight: '190', reps: '5' },
            { id: '2', label: '2', prev: <Dash />, weight: <Dash />, reps: '5–8' },
          ]}
        />
      </Spec>
      <Spec name="InfoTable · InfoRow strong / tones · InfoSubRow">
        <InfoTable title="Volume" note="last 4 weeks" className="mt-0">
          <InfoRow label="Sets" value="64" strong />
          <InfoSubRow label="Chest" value="18" />
          <InfoRow label="Trend" value="+4%" tone="tip" />
          <InfoRow label="Missed" value="2" tone="warn" />
        </InfoTable>
      </Spec>
      <Spec name="DataHeader · DataRow · highlight · InlineBar recent">
        <DataHeader cols={cols}>
          <span>Reps</span>
          <span className="text-right">lb</span>
          <span>Vs. heaviest</span>
          <span className="text-right">Date</span>
        </DataHeader>
        <DataRow cols={cols}>
          <span className="font-bold">1 RM</span>
          <span className="text-right font-bold">225</span>
          <InlineBar frac={1} />
          <span className="text-right text-caption text-fg2">Oct 2 '26</span>
        </DataRow>
        <DataRow cols={cols} highlight>
          <span className="font-bold">5 RM</span>
          <span className="text-right font-bold">195</span>
          <InlineBar frac={0.7} recent />
          <span className="text-right text-caption font-bold text-accent">Nov 3 '26</span>
        </DataRow>
      </Spec>
      <Spec name="StatRow">
        <StatRow
          items={[
            { label: 'Best est. 1RM', value: '231 lb' },
            { label: 'Heaviest', value: '215 lb', detail: '× 3' },
            { label: 'Sessions', value: '38' },
          ]}
        />
      </Spec>
    </Group>
  );
}

function Progress() {
  return (
    <Group id="progress" title="§8 Progress">
      <Spec name="TargetBar fg / tip / warn / accent">
        <div className="flex flex-col gap-2">
          {(['fg', 'tip', 'warn', 'accent'] as const).map((t, i) => (
            <TargetBar key={t} tone={t} frac={0.3 + i * 0.2} />
          ))}
        </div>
      </Spec>
      <Spec name="LabeledBar">
        <LabeledBar frac={0.6} />
      </Spec>
      <Spec name="GoalBar ahead / behind with marker">
        <div className="flex flex-col gap-4">
          <GoalBar frac={0.55} marker={0.45} markerLabel="today" />
          <GoalBar frac={0.35} marker={0.5} behind markerLabel="today" />
        </div>
      </Spec>
      <Spec name="SegmentBar">
        <SegmentBar steps={['done', 'done', 'current', 'todo']} />
      </Spec>
      <Spec name="Ring s / row / m · CountRing partial / complete">
        <div className="flex items-center gap-4">
          <Ring size="s" progress={0.6} />
          <Ring size="row" progress={0.3} />
          <Ring size="m" progress={0.75}>
            <span className="text-title2">75%</span>
          </Ring>
          <CountRing done={2} total={4} />
          <CountRing done={4} total={4} />
        </div>
      </Spec>
    </Group>
  );
}

function Calendars() {
  return (
    <Group id="calendars" title="§12 Calendars">
      <Spec name="Weekday · DayDisc done / past / planned / rest / missed / moved / paused / empty">
        <div className="grid grid-cols-8 gap-1 text-center">
          {(['done', 'past', 'planned', 'rest', 'missed', 'moved', 'paused', 'empty'] as const).map((st, i) => (
            <div key={st} className="flex flex-col items-center gap-1">
              <Weekday today={i === 2}>{'MTWTFSSM'[i]}</Weekday>
              <DayDisc state={st}>{st === 'done' ? <CheckGlyph size={12} /> : st === 'moved' ? <ArrowGlyph size={11} /> : 'P'}</DayDisc>
              <span className="text-micro text-fg3">{st}</span>
            </div>
          ))}
        </div>
      </Spec>
      <Spec name="DayDisc today / today live / today done / changed">
        <div className="flex gap-4">
          <DayDisc state="planned" today>
            P
          </DayDisc>
          <DayDisc state="planned" today live>
            P
          </DayDisc>
          <DayDisc state="done" today>
            <CheckGlyph size={12} />
          </DayDisc>
          <DayDisc state="planned" changed>
            L
          </DayDisc>
        </div>
      </Spec>
      <Spec name="DayCell · DayDots · DayCode · selected / today / live / missed / changed">
        <div className="grid grid-cols-7 gap-1">
          <DayCell number={3} marks={<DayDots count={1} />} />
          <DayCell number={4} marks={<DayDots count={2} selected />} selected />
          <DayCell number={5} today marks={<DayCode>P</DayCode>} />
          <DayCell number={6} today live marks={<DayCode>L</DayCode>} />
          <DayCell number={7} missed marks={<DayCode>P</DayCode>} />
          <DayCell number={8} changed marks={<DayCode>L</DayCode>} />
          <DayCell number={9} tone="fg3" />
        </div>
      </Spec>
      <Spec name="ChangedOutline · CalendarLegend">
        <div className="relative h-8.5 w-8.5">
          <ChangedOutline round />
        </div>
        <CalendarLegend
          items={[
            { label: 'Workout', mark: 'workout' },
            { label: 'Done', mark: 'done' },
            { label: 'Missed', mark: 'missed' },
            { label: 'Changed', mark: 'changed' },
            { label: 'Today', mark: 'today' },
          ]}
        />
      </Spec>
    </Group>
  );
}

function Glyphs() {
  const glyphs: [string, ReactNode][] = [
    ['ChevronLeft', <ChevronLeft size={17} />],
    ['ChevronRight', <ChevronRight size={13} />],
    ['ChevronDown', <ChevronDown size={12} />],
    ['CheckGlyph', <CheckGlyph size={14} />],
    ['PlayGlyph', <PlayGlyph size={12} />],
    ['CloseIcon', <CloseIcon size={11} />],
    ['PencilGlyph', <PencilGlyph size={18} />],
    ['WarnGlyph', <WarnGlyph size={14} className="text-warn" />],
    ['Handle', <Handle />],
    ['MoreGlyph', <MoreGlyph size={16} />],
    ['TrendUp', <TrendUp size={10} className="text-tip" />],
    ['TrendDown', <TrendDown size={10} className="text-warn" />],
    ['PlusGlyph', <PlusGlyph size={12} />],
    ['MinusGlyph', <MinusGlyph size={12} />],
    ['ArrowGlyph', <ArrowGlyph size={12} />],
    ['SearchGlyph', <SearchGlyph size={14} />],
    ['TargetGlyph', <TargetGlyph />],
    ['KeyboardGlyph', <KeyboardGlyph size={20} />],
    ['ChartIcon', <ChartIcon size={18} />],
    ['CalendarIcon', <CalendarIcon size={18} />],
    ['ClipboardIcon', <ClipboardIcon size={18} />],
    ['ListIcon', <ListIcon size={18} />],
  ];
  return (
    <Group id="glyphs" title="§3 Glyphs">
      <div className="mt-3 grid grid-cols-4 gap-2">
        {glyphs.map(([name, g]) => (
          <div key={name} className="flex flex-col items-center gap-1.5 border-b border-line py-2">
            <span className="flex h-6 items-center text-fg">{g}</span>
            <span className="text-micro font-semibold text-fg2">{name}</span>
          </div>
        ))}
      </div>
    </Group>
  );
}
