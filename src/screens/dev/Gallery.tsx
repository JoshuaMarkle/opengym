import { useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router';
import { CheckGlyph, ChevronDown, ChevronLeft, ChevronRight, CloseIcon, Handle, PencilGlyph, PlayGlyph, WarnGlyph } from '../../components/icons';
import {
  AddButton,
  BackButton,
  BarButton,
  Button,
  Check,
  Chips,
  DoneDisc,
  DropBadge,
  EmptyState,
  FieldLabel,
  IconButton,
  LabelAction,
  LargeHeader,
  Note,
  Pill,
  PlayButton,
  Radio,
  Row,
  Screen,
  SearchField,
  SectionLabel,
  Segmented,
  StartPill,
  StatRow,
  Tag,
  TextField,
  Toggle,
  TopBar,
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
      <Controls />
      <Notices />
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
      <Spec name="FieldLabel">
        <FieldLabel className="mt-0">Routine name</FieldLabel>
      </Spec>
    </Group>
  );
}

function Rows() {
  return (
    <Group id="rows" title="§6 Rows">
      <Spec name="Row · chevron">
        <Row onClick={noop} chevron>
          <span className="flex-1 text-body-lg">Units</span>
          <span className="text-body text-fg2">lb</span>
        </Row>
        <Row>
          <span className="flex-1 text-body-lg">Effort tracking</span>
          <Toggle on label="Effort" onChange={noop} />
        </Row>
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
      <Spec name="Chips">
        <Chips
          options={['all', 'chest', 'back', 'legs', 'arms'].map((v) => ({ value: v, label: v[0].toUpperCase() + v.slice(1) }))}
          value={chip}
          onChange={setChip}
        />
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
      <Spec name="Pill · Tag · DropBadge">
        <div className="flex items-center gap-3">
          <Pill tone="accent">NEXT</Pill>
          <Pill>Rest</Pill>
          <span className="text-headline">
            Pull-up<Tag>BW</Tag>
          </span>
          <DropBadge />
        </div>
      </Spec>
      <Spec name="StatRow">
        <StatRow
          items={[
            { label: 'Best est. 1RM', value: '231 lb' },
            { label: 'Heaviest', value: '215 lb' },
            { label: 'Sessions', value: '38' },
          ]}
        />
      </Spec>
    </Group>
  );
}

function Notices() {
  return (
    <Group id="notices" title="§11 Notices">
      <Spec name="EmptyState">
        <EmptyState icon={<WarnGlyph size={22} />} title="No goals yet">
          Pick a lift and a target.
        </EmptyState>
      </Spec>
      <Spec name="Note">
        <Note className="mt-0">Each bar is one month. Tap a year to open it.</Note>
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
