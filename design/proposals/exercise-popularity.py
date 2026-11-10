#!/usr/bin/env python3
"""
Exercise popularity: scores, additions, hidden list and the ranking rules.

Reads the built-in library from src/db/seedExercises.ts, applies the scores and
additions below, and writes exercise-popularity.html next to this file. Every
table and every list in the mockups comes from the data here, so change a score
and run it again:

    python3 design/proposals/exercise-popularity.py

Also writes exercise-popularity.json (name, score, hidden, group, new) so the
seed file can be updated from it when this is built.
"""
from __future__ import annotations

import html
import json
import re
from dataclasses import dataclass, field
from pathlib import Path

HERE = Path(__file__).resolve().parent
SEED = HERE.parent.parent / 'src' / 'db' / 'seedExercises.ts'

# ─────────────────────────────────────────────────────────────── rules

HIDE_AT_OR_BELOW = 3          # popularity ≤ 3 (specialist and rare) → hidden by default
CUSTOM_POPULARITY = 6         # custom exercises have no score; treat as an ordinary lift
CHIPS_MAX = 4                 # variation chips shown before "All N"
FOCUS_N = 4                   # automatic focus lifts (SPEC §13)


def focus_weight(pop: float) -> float:
    """Popularity multiplier for automatic focus lifts: 0.60 at 0, 1.00 at 10."""
    return 0.6 + 0.04 * pop


BANDS = [
    (10, 10, 'Everyone does it'),
    (8, 9, 'Staples of most programs'),
    (6, 7, 'Common'),
    (4, 5, 'Known, gym- or style-dependent'),
    (2, 3, 'Specialist · hidden by default'),
    (0, 1, 'Rare or odd · hidden by default'),
]


def band(p: int) -> str:
    for lo, hi, label in BANDS:
        if lo <= p <= hi:
            return label
    raise ValueError(p)


# ───────────────────────────────────────────── scores for the current library

SCORES: dict[str, int] = {
    # Chest
    'Bench Press': 10, 'Incline Bench Press': 7, 'DB Bench Press': 8, 'Decline Bench Press': 4,
    'Smith Machine Bench Press': 5, 'Incline DB Press': 8, 'Incline Machine Press': 6,
    'Smith Machine Incline Press': 6, 'Decline DB Press': 3, 'Machine Chest Press': 7, 'Floor Press': 2,
    'Cable Fly': 7, 'DB Fly': 6, 'Pec Deck': 7, 'Incline DB Fly': 5, 'Low-to-High Cable Fly': 5,
    'High-to-Low Cable Fly': 4, 'Push-up': 7, 'Weighted Push-up': 3, 'Dips': 7, 'Assisted Dips': 5,
    'DB Pullover': 4,
    # Back
    'Deadlift': 9, 'Sumo Deadlift': 5, 'Trap Bar Deadlift': 6, 'Deficit Deadlift': 2, 'Rack Pull': 4,
    'Pull-up': 8, 'Weighted Pull-up': 5, 'Assisted Pull-up': 7, 'Chin-up': 7, 'Weighted Chin-up': 3,
    'Lat Pulldown': 9, 'Close-Grip Lat Pulldown': 7, 'Single-Arm Lat Pulldown': 5,
    'Barbell Row': 8, 'Pendlay Row': 4, 'DB Row': 8, 'T-Bar Row': 7, 'Chest-Supported Row': 6,
    'Seated Cable Row': 8, 'Machine Row': 7, 'Single-Arm Cable Row': 5, 'Inverted Row': 4,
    'Straight-Arm Pulldown': 6, 'Cable Pullover': 4, 'Barbell Shrug': 6, 'DB Shrug': 7,
    'Back Extension': 6, 'Good Morning': 3, 'Meadows Row': 2,
    # Legs
    'Squat': 9, 'Front Squat': 5, 'Safety Bar Squat': 3, 'Pause Squat': 2, 'Box Squat': 2, 'Goblet Squat': 6,
    'Hack Squat': 7, 'Smith Machine Squat': 6, 'Pendulum Squat': 4, 'Belt Squat': 3, 'Leg Press': 9,
    'Single-Leg Press': 3, 'Romanian Deadlift': 8, 'DB Romanian Deadlift': 6, 'Stiff-Leg Deadlift': 4,
    'Single-Leg RDL': 4, 'Bulgarian Split Squat': 7, 'Split Squat': 5, 'Walking Lunge': 6, 'Reverse Lunge': 5,
    'Barbell Lunge': 3, 'Step-up': 4, 'Leg Extension': 8, 'Leg Curl': 8, 'Seated Leg Curl': 8, 'Nordic Curl': 3,
    'Hip Thrust': 7, 'Machine Hip Thrust': 5, 'Glute Bridge': 5, 'Cable Kickback': 5, 'Hip Abduction': 6,
    'Hip Adduction': 6, 'Calf Raise': 7, 'Seated Calf Raise': 6, 'Leg Press Calf Raise': 5, 'Pistol Squat': 2,
    # Shoulders
    'Overhead Press': 8, 'DB Shoulder Press': 8, 'Machine Shoulder Press': 7, 'Seated Barbell Press': 4,
    'Smith Machine Shoulder Press': 5, 'Push Press': 3, 'Arnold Press': 5, 'Landmine Press': 3,
    'Lateral Raise': 9, 'Cable Lateral Raise': 7, 'Machine Lateral Raise': 5, 'Front Raise': 5,
    'Rear Delt Fly': 6, 'Reverse Pec Deck': 7, 'Cable Rear Delt Fly': 5, 'Face Pull': 7, 'Upright Row': 4,
    'Handstand Push-up': 1,
    # Arms
    'Barbell Curl': 8, 'EZ-Bar Curl': 7, 'DB Curl': 9, 'Cable Curl': 7, 'Hammer Curl': 8, 'Cable Hammer Curl': 5,
    'Incline DB Curl': 6, 'Preacher Curl': 6, 'Machine Preacher Curl': 5, 'Concentration Curl': 4,
    'Spider Curl': 3, 'Reverse Curl': 4, 'Wrist Curl': 4, 'Triceps Pushdown': 8, 'Rope Pushdown': 8,
    'Single-Arm Pushdown': 4, 'Overhead Cable Extension': 7, 'DB Overhead Extension': 6, 'Skull Crusher': 7,
    'Close-Grip Bench Press': 5, 'JM Press': 1, 'Triceps Kickback': 4, 'Bench Dips': 4, 'Diamond Push-up': 3,
    # Core
    'Crunch': 6, 'Cable Crunch': 6, 'Machine Crunch': 5, 'Sit-up': 5, 'Decline Sit-up': 4,
    'Hanging Leg Raise': 6, 'Hanging Knee Raise': 5, 'Lying Leg Raise': 4, 'Ab Wheel Rollout': 5,
    'Russian Twist': 4, 'Pallof Press': 3, 'Cable Woodchopper': 3, 'DB Side Bend': 3, 'Dead Bug': 3,
    # Full body / other
    'Power Clean': 3, 'Hang Clean': 2, 'Clean and Jerk': 1, 'Snatch': 1, 'Thruster': 2,
    'Kettlebell Swing': 4, 'Turkish Get-up': 1,
    # Cardio presets
    'Treadmill': 9, 'Bike': 7, 'Rower': 6, 'Stair Climber': 7, 'Elliptical': 6, 'Run / Walk Outside': 7,
    'Jump Rope': 3, 'Generic Cardio': 5,
}

# Existing exercises that move into a (new or bigger) variation group.
REGROUP = {
    'Meadows Row': 'vg-row',
    'Back Extension': 'vg-back-ext',
    'Good Morning': 'vg-good-morning',
    'Reverse Curl': 'vg-reverse-curl',
    'Wrist Curl': 'vg-wrist-curl',
}

# Optional sub-area so search and the meta line can say "Forearms" / "Lower back".
AREA = {
    'Wrist Curl': 'forearms', 'Reverse Curl': 'forearms',
    'Back Extension': 'lower back', 'Good Morning': 'lower back',
}

# ───────────────────────────────────────────────────────────────── additions
# (name, muscle, equipment, type, group, score, area, section, note)

NEW = [
    # Row grips: bent-over / free-weight rows
    ('Underhand Barbell Row', 'back', 'barbell', 'weight', 'vg-row', 5, None, 'Row grips', 'Reverse grip, more lats and biceps'),
    ('Wide-Grip Barbell Row', 'back', 'barbell', 'weight', 'vg-row', 3, None, 'Row grips', 'Elbows out, upper back'),
    ('Chest-Supported T-Bar Row', 'back', 'machine', 'weight', 'vg-row', 5, None, 'Row grips', 'The plate-loaded bench version'),
    ('Seal Row', 'back', 'barbell', 'weight', 'vg-row', 3, None, 'Row grips', 'Lying on a high bench'),
    ('Smith Machine Row', 'back', 'machine', 'weight', 'vg-row', 3, None, 'Row grips', ''),
    ('Kroc Row', 'back', 'dumbbell', 'weight', 'vg-row', 2, None, 'Row grips', 'Heavy, high-rep DB row'),
    ('Yates Row', 'back', 'barbell', 'weight', 'vg-row', 2, None, 'Row grips', 'Underhand, more upright'),
    ('Helms Row', 'back', 'dumbbell', 'weight', 'vg-row', 1, None, 'Row grips', 'Chest on an incline bench; niche'),
    # Row grips: seated cable / machine rows
    ('Wide-Grip Cable Row', 'back', 'cable', 'weight', 'vg-cable-row', 6, None, 'Row grips', 'Lat bar instead of the V-handle'),
    ('Underhand Cable Row', 'back', 'cable', 'weight', 'vg-cable-row', 3, None, 'Row grips', 'Straight bar, palms up'),
    ('Rope Cable Row', 'back', 'cable', 'weight', 'vg-cable-row', 2, None, 'Row grips', 'Rope pulled to the chest'),
    ('High Row', 'back', 'machine', 'weight', 'vg-cable-row', 5, None, 'Row grips', 'Plate-loaded, pulls down and back'),
    ('Low Row', 'back', 'machine', 'weight', 'vg-cable-row', 5, None, 'Row grips', 'Plate-loaded, chest pad'),
    ('Wide-Grip Machine Row', 'back', 'machine', 'weight', 'vg-cable-row', 4, None, 'Row grips', 'Outer handles of the row machine'),
    ('Single-Arm Machine Row', 'back', 'machine', 'weight', 'vg-cable-row', 4, None, 'Row grips', ''),
    # Pulldown and pull-up grips
    ('Wide-Grip Lat Pulldown', 'back', 'cable', 'weight', 'vg-pulldown', 6, None, 'Pulldown and pull-up grips', 'Hands outside the bend'),
    ('Neutral-Grip Lat Pulldown', 'back', 'cable', 'weight', 'vg-pulldown', 6, None, 'Pulldown and pull-up grips', 'Wide neutral bar'),
    ('Reverse-Grip Lat Pulldown', 'back', 'cable', 'weight', 'vg-pulldown', 5, None, 'Pulldown and pull-up grips', 'Palms up, shoulder width'),
    ('Machine Lat Pulldown', 'back', 'machine', 'weight', 'vg-pulldown', 5, None, 'Pulldown and pull-up grips', 'Plate-loaded, iso-lateral'),
    ('Behind-the-Neck Pulldown', 'back', 'cable', 'weight', 'vg-pulldown', 1, None, 'Pulldown and pull-up grips', 'Fell out of use; hard on shoulders'),
    ('Neutral-Grip Pull-up', 'back', 'bodyweight', 'bodyweight', 'vg-pullup', 5, None, 'Pulldown and pull-up grips', 'Parallel handles'),
    ('Wide-Grip Pull-up', 'back', 'bodyweight', 'bodyweight', 'vg-pullup', 4, None, 'Pulldown and pull-up grips', ''),
    # Press and arm grips
    ('Neutral-Grip DB Press', 'chest', 'dumbbell', 'weight', 'vg-bench', 3, None, 'Press and arm grips', 'Palms facing, easier on shoulders'),
    ('Wide-Grip Bench Press', 'chest', 'barbell', 'weight', 'vg-bench', 2, None, 'Press and arm grips', ''),
    ('Reverse-Grip Bench Press', 'chest', 'barbell', 'weight', 'vg-bench', 1, None, 'Press and arm grips', 'Niche; very few lifters use it'),
    ('Bayesian Curl', 'arms', 'cable', 'weight', 'vg-curl', 5, None, 'Press and arm grips', 'Cable behind you, arm stretched'),
    ('Cross-Body Hammer Curl', 'arms', 'dumbbell', 'weight', 'vg-hammer', 4, None, 'Press and arm grips', ''),
    ('V-Bar Pushdown', 'arms', 'cable', 'weight', 'vg-pushdown', 5, None, 'Press and arm grips', ''),
    ('Reverse-Grip Pushdown', 'arms', 'cable', 'weight', 'vg-pushdown', 3, None, 'Press and arm grips', 'Palms up'),
    # Forearms
    ('Barbell Wrist Curl', 'arms', 'barbell', 'weight', 'vg-wrist-curl', 4, 'forearms', 'Forearms', 'Forearms on a bench, palms up'),
    ('Reverse Wrist Curl', 'arms', 'dumbbell', 'weight', 'vg-wrist-curl', 4, 'forearms', 'Forearms', 'Palms down, wrist extensors'),
    ('Behind-the-Back Wrist Curl', 'arms', 'barbell', 'weight', 'vg-wrist-curl', 3, 'forearms', 'Forearms', 'Standing, bar behind you'),
    ('Cable Wrist Curl', 'arms', 'cable', 'weight', 'vg-wrist-curl', 2, 'forearms', 'Forearms', ''),
    ('Reverse EZ-Bar Curl', 'arms', 'barbell', 'weight', 'vg-reverse-curl', 4, 'forearms', 'Forearms', 'Brachioradialis; easier on wrists'),
    ('DB Reverse Curl', 'arms', 'dumbbell', 'weight', 'vg-reverse-curl', 3, 'forearms', 'Forearms', ''),
    ('Cable Reverse Curl', 'arms', 'cable', 'weight', 'vg-reverse-curl', 3, 'forearms', 'Forearms', ''),
    ('Zottman Curl', 'arms', 'dumbbell', 'weight', 'vg-reverse-curl', 3, 'forearms', 'Forearms', 'Curl up, turn, lower palms down'),
    ('Farmer\'s Carry', 'arms', 'dumbbell', 'weight_time', None, 5, 'forearms', 'Forearms', 'Weight × time: a new LBS × TIME type (see H)'),
    ('Wrist Roller', 'arms', 'other', 'weight', None, 4, 'forearms', 'Forearms', 'Reps = full rolls up and down'),
    ('Hand Gripper', 'arms', 'other', 'bodyweight', None, 3, 'forearms', 'Forearms', 'Reps per hand; no weight'),
    ('DB Wrist Rotation', 'arms', 'dumbbell', 'weight', None, 1, 'forearms', 'Forearms', 'Pronation / supination; mostly rehab'),
    ('Radial Deviation', 'arms', 'dumbbell', 'weight', None, 0, 'forearms', 'Forearms', 'Rehab only'),
    # Lower back
    ('Machine Back Extension', 'back', 'machine', 'weight', 'vg-back-ext', 5, 'lower back', 'Lower back', 'Seated lower-back machine'),
    ('Roman Chair Back Extension', 'back', 'bodyweight', 'bodyweight_plus', 'vg-back-ext', 3, 'lower back', 'Lower back', 'Flat 90° bench'),
    ('Reverse Hyperextension', 'back', 'machine', 'weight', 'vg-back-ext', 3, 'lower back', 'Lower back', 'Legs swing up behind you'),
    ('Superman', 'back', 'bodyweight', 'bodyweight', 'vg-back-ext', 3, 'lower back', 'Lower back', 'On the floor'),
    ('Cable Pull-through', 'legs', 'cable', 'weight', None, 4, 'lower back', 'Lower back', 'Hip hinge with a rope'),
    ('Glute-Ham Raise', 'legs', 'bodyweight', 'bodyweight_plus', None, 3, 'lower back', 'Lower back', 'GHD; hamstrings and lower back'),
    ('Jefferson Curl', 'back', 'barbell', 'weight', None, 2, 'lower back', 'Lower back', 'Slow loaded spinal flexion'),
    ('Snatch-Grip Deadlift', 'back', 'barbell', 'weight', 'vg-deadlift', 2, 'lower back', 'Lower back', ''),
    ('Bird Dog', 'core', 'bodyweight', 'bodyweight', None, 2, 'lower back', 'Lower back', ''),
    ('Seated Good Morning', 'back', 'barbell', 'weight', 'vg-good-morning', 1, 'lower back', 'Lower back', 'Niche variation'),
]

# Considered and left out.
LEFT_OUT = [
    ('Dead Hang, Plate Pinch, Plank, Back Extension Hold', 'Timed holds. Could reuse Farmer\'s Carry\'s weight × time type later; left out for now.'),
    ('Fat Grip / Axle versions of every lift', 'An attachment, not an exercise; would double the list. Use a note or a custom exercise.'),
    ('Each grip of the hammer machine rows (high/low, wide/close)', 'High Row and Low Row cover the common machines; finer splits are custom-exercise territory.'),
]

HIDDEN_WHY = {
    'Handstand Push-up': 'Calisthenics skill; rarely logged in a gym log',
    'JM Press': 'Powerlifting accessory few people know',
    'Clean and Jerk': 'Olympic lift; most users never log it',
    'Snatch': 'Olympic lift; most users never log it',
    'Turkish Get-up': 'Kettlebell skill, logged by very few',
}

# ─────────────────────────────────────────────────────────────── the data


@dataclass
class Ex:
    name: str
    muscle: str
    equipment: str
    type: str
    group: str | None
    pop: int
    area: str | None = None
    new: bool = False
    section: str = ''
    note: str = ''
    regrouped: bool = False
    rank: int = 0

    @property
    def hidden(self) -> bool:
        return self.pop <= HIDE_AT_OR_BELOW


def parse_seed() -> list[Ex]:
    src = SEED.read_text()
    start = src.index('SEED_EXERCISES: SeedExercise[]')
    body = src[start:src.index('];', start)]
    out = []
    for m in re.finditer(r"\{ name: '([^']+)'([^}]*)\}", body):
        name, rest = m.group(1), m.group(2)

        def f(k):
            mm = re.search(k + r": '([^']+)'", rest)
            return mm.group(1) if mm else None

        if name not in SCORES:
            raise SystemExit(f'No score for {name!r}')
        grp = REGROUP.get(name, f('group'))
        out.append(Ex(name, f('muscle'), f('equipment'), f('type') or 'weight', grp, SCORES[name],
                      area=AREA.get(name), regrouped=name in REGROUP))
    missing = set(SCORES) - {e.name for e in out}
    if missing:
        raise SystemExit(f'Scored but not in the seed: {sorted(missing)}')
    return out


EXISTING = parse_seed()
ADDED = [Ex(n, m, eq, t, g, p, area=a, new=True, section=s, note=no) for (n, m, eq, t, g, p, a, s, no) in NEW]
ALL = EXISTING + ADDED
names = [e.name for e in ALL]
assert len(names) == len(set(names)), 'duplicate name'
BY_NAME = {e.name: e for e in ALL}

COMPOUND = set(re.findall(r"'([^']+)'", SEED.read_text().split('COMPOUND_NAMES = [')[1].split('];')[0]))
COMPOUND |= {e.name for e in ADDED if e.muscle in ('back', 'chest') and e.area is None and 'Pushdown' not in e.name}

RANKED = sorted(ALL, key=lambda e: (-e.pop, e.name.lower()))
for i, e in enumerate(RANKED, 1):
    e.rank = i


def group_members(g: str) -> list[Ex]:
    return sorted([e for e in ALL if e.group == g], key=lambda e: (-e.pop, e.name.lower()))


GROUPS = sorted({e.group for e in ALL if e.group}, key=lambda g: (-len(group_members(g)), g))

GROUP_TITLE = {
    'vg-row': 'Rows (free weight)', 'vg-cable-row': 'Rows (cable and machine)', 'vg-pulldown': 'Lat pulldowns',
    'vg-pullup': 'Pull-ups', 'vg-chinup': 'Chin-ups', 'vg-bench': 'Bench press', 'vg-incline': 'Incline press',
    'vg-fly': 'Flys', 'vg-dips': 'Dips', 'vg-deadlift': 'Deadlifts', 'vg-shrug': 'Shrugs', 'vg-squat': 'Squats',
    'vg-machine-squat': 'Machine squats', 'vg-leg-press': 'Leg press', 'vg-rdl': 'Romanian deadlifts',
    'vg-split-squat': 'Split squats', 'vg-lunge': 'Lunges', 'vg-leg-curl': 'Leg curls', 'vg-hip-thrust': 'Hip thrusts',
    'vg-calf': 'Calf raises', 'vg-ohp': 'Overhead press', 'vg-lateral': 'Lateral raises', 'vg-rear-delt': 'Rear delts',
    'vg-curl': 'Curls', 'vg-hammer': 'Hammer curls', 'vg-preacher': 'Preacher curls', 'vg-pushdown': 'Pushdowns',
    'vg-overhead-ext': 'Overhead extensions', 'vg-leg-raise': 'Leg raises', 'vg-back-ext': 'Back extensions',
    'vg-good-morning': 'Good mornings', 'vg-reverse-curl': 'Reverse curls', 'vg-wrist-curl': 'Wrist curls',
}


def labels(members: list[Ex]) -> dict[str, str]:
    """Port of src/lib/variations.ts variationLabels: drop words every name shares."""
    toks = [e.name.split() for e in members]
    common = set(w.lower() for w in toks[0])
    for t in toks[1:]:
        common &= {w.lower() for w in t}
    out = {}
    short = {'barbell': 'Barbell', 'dumbbell': 'DB', 'machine': 'Machine', 'cable': 'Cable', 'bodyweight': 'Bodyweight', 'other': 'Other'}
    for e, t in zip(members, toks):
        rest = [w for w in t if w.lower() not in common]
        out[e.name] = ' '.join(rest) if rest else short[e.equipment]
    return out


def visible_variations(group: str, current: str, sessions: dict[str, int], n: int = CHIPS_MAX) -> tuple[list[Ex], int]:
    """Chips: this one, then ones you've logged (most sessions first), then the most popular, up to n.
    Hidden ones only show if you've logged them. Returns (shown, how many are behind "All")."""
    members = group_members(group)
    me = BY_NAME[current]
    used = sorted([e for e in members if sessions.get(e.name) and e is not me], key=lambda e: (-sessions[e.name], -e.pop))
    shown = [me] + used[: max(n - 1, 0)]
    for e in members:
        if len(shown) >= n:
            break
        if e not in shown and not e.hidden:
            shown.append(e)
    return shown, len(members) - len(shown)


# ───────────────────────────────────────── focus-lift example (section C)

FOCUS_HISTORY = [  # sessions in the last 8 weeks
    ('Smith Machine Incline Press', 13), ('Single-Arm Cable Row', 13), ('Lat Pulldown', 12),
    ('Close-Grip Lat Pulldown', 12), ('Bench Press', 11), ('Leg Press', 11), ('Incline DB Press', 11),
    ('Hack Squat', 10), ('Squat', 9), ('Lateral Raise', 14),
]


def focus_tables():
    rows = []
    for name, s in FOCUS_HISTORY:
        e = BY_NAME[name]
        rows.append(dict(name=name, sessions=s, pop=e.pop, w=focus_weight(e.pop), score=s * focus_weight(e.pop),
                         compound=name in COMPOUND, group=e.group))
    comp = [r for r in rows if r['compound']]
    old = sorted(comp, key=lambda r: -r['sessions'])  # ties: last logged (not modelled here)
    old_pick = [r['name'] for r in old[:FOCUS_N]]
    new = sorted(comp, key=lambda r: -r['score'])
    picked, groups_used = [], set()
    for r in new:
        r['skip'] = ''
        if len(picked) >= FOCUS_N:
            continue
        if r['group'] and r['group'] in groups_used:
            r['skip'] = 'same group as ' + next(p for p in picked if BY_NAME[p].group == r['group'])
            continue
        picked.append(r['name'])
        groups_used.add(r['group'])
    return rows, new, old_pick, picked


# ────────────────────────────────────────────────────────────────── HTML

E = html.escape
MUSCLE = {'chest': 'Chest', 'back': 'Back', 'legs': 'Legs', 'shoulders': 'Shoulders', 'arms': 'Arms', 'core': 'Core', 'other': 'Other'}
TYPE_TAG = {'weight_time': 'TIME', 'bodyweight': 'BW', 'bodyweight_plus': 'BW +', 'assisted': 'ASSIST', 'cardio': 'CARDIO'}
SEARCH = '<svg width="14" height="14" viewBox="0 0 14 14"><circle cx="6" cy="6" r="4.6" fill="none" stroke="#8e8e8e" stroke-width="1.6"/><line x1="9.4" y1="9.4" x2="13" y2="13" stroke="#8e8e8e" stroke-width="1.6" stroke-linecap="round"/></svg>'
CHART = '<svg width="16" height="12" viewBox="0 0 16 12"><polyline points="1,10 5,6 8,8 14,2" fill="none" stroke="#2e8bff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>'


def meter(p: int, small=False) -> str:
    cls = 'pm sm' if small else 'pm'
    return f'<span class="{cls}" title="{p}/10">' + ''.join(f'<i class="{"on" if i < p else ""}"></i>' for i in range(10)) + '</span>'


def tag(e: Ex) -> str:
    t = TYPE_TAG.get(e.type)
    return f' <span class="tt">{t}</span>' if t else ''


def meta(e: Ex) -> str:
    parts = [MUSCLE[e.muscle]]
    if e.area:
        parts.append(e.area.capitalize())
    parts.append(e.equipment)
    return ' · '.join(parts)


def phone(header: str, body: str, extra: str = '', foot: str = '') -> str:
    return (f'<div class="phone"><div class="status"><span>9:41</span><span class="island"></span><span>●●●</span></div>'
            f'{header}<div class="body">{body}<div class="fade"></div></div>{foot}{extra}<div class="homebar"></div></div>')


def nh(left: str, title: str, right: str) -> str:
    return f'<div class="nh"><span class="l">{left}</span><span class="t">{title}</span><span class="r">{right}</span></div>'


def cap(id_: str, title: str, text: str) -> str:
    return f'<div class="cap"><b><em>{id_}</em>{title}</b><p>{text}</p></div>'


def lrow(e: Ex, right: str = '<span class="chev">›</span>', sub: str | None = None, dim=False) -> str:
    s = sub if sub is not None else meta(e)
    return (f'<div class="lr{" dim" if dim else ""}"><div><div class="n">{E(e.name)}{tag(e)}</div><div class="s">{s}</div></div>{right}</div>')


def chips(active: str) -> str:
    out = ''
    for c in ['All', 'Chest', 'Back', 'Legs', 'Shoulders', 'Arms', 'Core', 'Cardio']:
        out += f'<span class="{"on" if c == active else ""}">{c}</span>'
    return f'<div class="chips">{out}</div>'


# The person in the mockups: a back-and-arms trainee.
SESSIONS = {
    'Barbell Row': 42, 'DB Row': 12, 'Underhand Barbell Row': 3, 'Seated Cable Row': 30, 'Lat Pulldown': 44,
    'Bench Press': 51, 'Squat': 38, 'DB Curl': 26, 'Hammer Curl': 19, 'Wrist Curl': 4, 'Back Extension': 9,
    'Lateral Raise': 33, 'Romanian Deadlift': 21,
}


def screen_library() -> str:
    yours = sorted([BY_NAME[n] for n in SESSIONS], key=lambda e: -SESSIONS[e.name])[:4]
    popular = [e for e in RANKED if e not in yours and not e.hidden][:6]
    body = (f'<div class="search">{SEARCH}<span>Search {len(ALL)} exercises</span></div>{chips("All")}'
            '<div class="seg"><span class="on">Popular</span><span>A–Z</span></div>'
            '<div class="lbl">YOU DO</div>'
            + ''.join(lrow(e, '<span class="ses">' + str(SESSIONS[e.name]) + '</span>') for e in yours)
            + '<div class="lbl">MOST POPULAR</div>'
            + ''.join(lrow(e) for e in popular))
    return phone(nh('<span class="tb">‹ Settings</span>', 'Exercises', '<span class="tb big">+</span>'), body)


def screen_search() -> str:
    q = 'row'
    hits = [e for e in ALL if q in e.name.lower() and e.type != 'cardio' and 'Upright' not in e.name]
    yours = sorted([e for e in hits if e.name in SESSIONS], key=lambda e: -SESSIONS[e.name])
    rest = sorted([e for e in hits if e.name not in SESSIONS and not e.hidden], key=lambda e: (-e.pop, e.name))
    hid = sorted([e for e in hits if e.hidden and e.name not in SESSIONS], key=lambda e: (-e.pop, e.name))
    circle = '<span class="ck"></span>'
    body = (f'<div class="search on">{SEARCH}<span class="q">row</span><span class="x">✕</span></div>{chips("All")}'
            f'<div class="lbl">YOU DO</div>'
            + ''.join(lrow(e, circle, f'{MUSCLE[e.muscle]} · {SESSIONS[e.name]} sessions') for e in yours)
            + f'<div class="lbl">MOST POPULAR<span class="g">{len(rest)}</span></div>'
            + ''.join(lrow(e, circle, MUSCLE[e.muscle] + ' · ' + e.equipment) for e in rest[:7])
            + f'<div class="lbl">RARELY USED<span class="g">{len(hid)}</span></div>'
            + ''.join(lrow(e, circle, MUSCLE[e.muscle] + ' · ' + e.equipment, dim=True) for e in hid[:4]))
    return phone(nh('<span class="tb g">Cancel</span>', 'Exercises', '<span class="tb b">Done</span>'), body), len(rest), [e.name for e in hid]


def screen_arms() -> str:
    arms = [e for e in RANKED if e.muscle == 'arms' and not e.hidden]
    fore = [e for e in arms if e.area == 'forearms']
    hidden_n = sum(1 for e in ALL if e.hidden)
    body = (f'<div class="search">{SEARCH}<span>Search {len(ALL)} exercises</span></div>{chips("Arms")}'
            '<div class="seg"><span class="on">Popular</span><span>A–Z</span></div>'
            '<div class="lbl">MOST POPULAR · ARMS<span class="g">' + str(len(arms)) + '</span></div>'
            + ''.join(lrow(e) for e in arms[:3])
            + '<div class="gap">⋯</div>'
            + ''.join(lrow(e) for e in fore[:5])
            + f'<div class="foot">{hidden_n} rarely used exercises are hidden. They still show when you search, and anything you\'ve logged always shows. <span>Show hidden</span></div>')
    return phone(nh('<span class="tb">‹ Settings</span>', 'Exercises', '<span class="tb big">+</span>'), body), len(fore)


def var_chips(shown: list[Ex], more: int, current: str, lab: dict, this_tag=True) -> str:
    out = ''
    for e in shown:
        on = e.name == current
        t = '<small> · this</small>' if on and this_tag else ''
        used = '' if on or not SESSIONS.get(e.name) else ' u'
        out += f'<span class="{"on" if on else ""}{used}">{E(lab[e.name])}{t}</span>'
    if more:
        out += f'<span class="all">All {len(shown) + more} ›</span>'
    return f'<div class="vchips">{out}</div>'


def screen_exercise(current='Barbell Row') -> str:
    g = BY_NAME[current].group
    members = group_members(g)
    lab = labels(members)
    shown, more = visible_variations(g, current, SESSIONS)
    body = (f'<div class="ttl">{current}</div><div class="sub">Back · Barbell · Weight × reps</div>'
            '<div class="stats"><div><small>SESSIONS</small><b>42</b></div><div><small>BEST EST. 1RM</small><b>243</b></div><div><small>LAST</small><b>Nov 7</b></div></div>'
            f'<div class="lbl">VARIATIONS<span>Edit links</span></div>'
            + var_chips(shown, more, current, lab)
            + '<div class="note">Yours first (blue outline = you\'ve logged it), then the most popular. Each keeps its own history.</div>'
            '<div class="lbl">MORE</div>'
            '<div class="lr"><div class="n2">History, charts &amp; records</div><span class="chev">›</span></div>'
            '<div class="lr"><div class="n2">Used in</div><span class="tb sm">Pull A, Pull B</span></div>'
            '<div class="lr"><div class="n2">Merge into another exercise…</div><span class="chev">›</span></div>')
    return phone(nh('<span class="tb">‹ Exercises</span>', '', '<span class="tb">Edit</span>'), body), shown, more, members


def sheet_all(current='Barbell Row', mode='view', skip=0) -> str:
    g = BY_NAME[current].group
    members = group_members(g)
    vis = [e for e in members if not e.hidden or SESSIONS.get(e.name)]
    hid = [e for e in members if e not in vis]
    rows = ''
    for e in vis[skip:]:
        s = SESSIONS.get(e.name)
        if e.name == current:
            sub = f'<span class="bl">this · {s} sessions</span>' if mode == 'view' else '<span class="bl">doing now</span>'
        elif s:
            sub = f'<span class="bl">{s} sessions</span>'
        else:
            sub = e.equipment
        right = '<span class="chev">›</span>' if mode == 'view' else ''
        rows += f'<div class="lr sh{" cur" if e.name == current else ""}"><div><div class="n">{E(e.name)}</div><div class="s">{sub}</div></div>{right}</div>'
    rows += f'<div class="lbl">RARELY USED<span class="g">{len(hid)}</span></div>'
    rows += ''.join(f'<div class="lr sh dim"><div><div class="n">{E(e.name)}</div><div class="s">{e.equipment}</div></div></div>' for e in hid)
    title = 'Variations' if mode == 'view' else 'Switch to'
    foot = '<div class="shf"><span class="tb">Edit links</span><span class="g2">Most popular first</span></div>' if mode == 'view' else '<div class="shf"><span class="g2">Tap to switch. Each keeps its own history.</span></div>'
    return (f'<div class="scrim"></div><div class="bigsheet"><div class="grab"></div>'
            f'<div class="shh"><div><b>{title}</b><small>{GROUP_TITLE[g]} · {len(members)}</small></div><span class="xb">✕</span></div>'
            f'<div class="shb">{rows}</div>{foot}</div>')


def screen_logging(current='Barbell Row') -> str:
    g = BY_NAME[current].group
    members = group_members(g)
    lab = labels(members)
    shown, more = visible_variations(g, current, SESSIONS)
    chip = ''.join(f'<span class="{"on" if e.name == current else ("u" if SESSIONS.get(e.name) else "")}">{E(lab[e.name])}</span>' for e in shown)

    rows = ''
    for i, (pw, pr, w, r, done) in enumerate([(185, 8, 185, 8, True), (185, 8, 185, 7, False), (185, 7, 185, 7, False)], 1):
        rows += (f'<div class="tr{" done" if done else (" cur" if i == 2 else "")}"><span class="sn">{i}</span><span class="prev">{pw} × {pr}</span>'
                 f'<span class="in">{w}</span><span class="in">{r}</span><span class="chk{" on" if done else ""}">{"✓" if done else ""}</span></div>')
    body = (f'<div class="exh"><div><div class="exn">{current}</div><div class="exp">Exercise 2 of 6 ⌄</div></div>'
            f'<div class="hbtns"><span class="ib">{CHART}</span><span class="ib">•••</span></div></div>'
            f'<div class="vwrap"><div class="vars">{chip}</div><span class="all">+{more}</span></div>'
            '<div class="tbl"><div class="tr th"><span class="c">SET</span><span>PREVIOUS</span><span class="c">LBS</span><span class="c">REPS</span><span class="c">✓</span></div>'
            f'{rows}</div><div class="quick"><span class="dr">+ Drop</span><span>+ Set</span></div>')
    head = '<div class="wh"><div><div class="t">Pull A</div><div class="s">18:40 · 1 of 6 done</div></div><span class="finish">Finish</span></div>'
    foot = '<div class="nav"><div class="nb"><span class="arrow">‹</span><div><small>PREV</small>Lat Pulldown</div></div><div class="nb r"><div><small>NEXT</small>Face Pull</div><span class="arrow">›</span></div></div>'
    return head, body, foot, shown, more


def screen_focus() -> tuple[str, list]:
    rows, ranked, old_pick, picked = focus_tables()
    sess = {r['name']: r['sessions'] for r in rows}
    focus = ''.join(
        f'<div class="lr fl"><span class="ckb on">✓</span><div><div class="n">{E(n)}</div><div class="s">{sess[n]} sessions</div></div><span class="drag">≡</span></div>'
        for n in picked)
    others = [r for r in sorted(rows, key=lambda r: -r['sessions']) if r['name'] not in picked][:4]
    oth = ''.join(f'<div class="lr fl"><span class="ckb"></span><div><div class="n">{E(r["name"])}</div><div class="s">{r["sessions"]} sessions</div></div></div>' for r in others)
    body = ('<div class="tog"><div><div class="n2">Train everything</div><div class="s">Trends, milestones and goals for every lift you log</div></div><span class="sw on"><i></i></span></div>'
            '<div class="note">Picked for you: the compound lifts you log most, nudged toward common lifts, one per variation group. Drag or tick to choose your own.</div>'
            f'<div class="lbl">FOCUS · AUTOMATIC<span class="g">{len(picked)} OF 5</span></div>{focus}'
            f'<div class="lbl">OTHER EXERCISES</div>{oth}')
    return phone(nh('', 'Focus lifts', '<span class="tb b">Done</span>'), body), (rows, ranked, old_pick, picked)


# ────────────────────────────────────────────────────────────────── tables


def full_table() -> str:
    out = ['<table class="rank"><thead><tr><th class="r">#</th><th>EXERCISE</th><th>SCORE</th><th>MUSCLE</th><th>EQUIPMENT</th><th>VARIATION GROUP</th><th></th></tr></thead><tbody>']
    last_band = None
    for e in RANKED:
        b = band(e.pop)
        if b != last_band:
            lo, hi = next((lo, hi) for lo, hi, l in BANDS if l == b)
            n = sum(1 for x in ALL if lo <= x.pop <= hi)
            rng = f'{lo}' if lo == hi else f'{hi}–{lo}'
            out.append(f'<tr class="band"><td colspan="7"><b>{rng}</b> {b} <span>{n}</span></td></tr>')
            last_band = b
        flags = []
        if e.new:
            flags.append('<span class="fl new">NEW</span>')
        if e.regrouped:
            flags.append('<span class="fl mv">REGROUPED</span>')
        if e.hidden:
            flags.append('<span class="fl hid">HIDDEN</span>')
        if e.name in COMPOUND:
            flags.append('<span class="fl cp">COMPOUND</span>')
        grp = GROUP_TITLE.get(e.group, '') if e.group else ''
        area = f' <span class="ar">{e.area}</span>' if e.area else ''
        out.append(f'<tr class="{"hidrow" if e.hidden else ""}"><td class="r n">{e.rank}</td><td class="nm">{E(e.name)}{tag(e)}</td>'
                   f'<td class="sc"><b>{e.pop}</b>{meter(e.pop)}</td><td>{MUSCLE[e.muscle]}{area}</td><td>{e.equipment}</td><td class="gp">{grp}</td><td class="fls">{"".join(flags)}</td></tr>')
    out.append('</tbody></table>')
    return '\n'.join(out)


def groups_table() -> str:
    out = ['<table class="grp"><thead><tr><th>GROUP</th><th class="r">N</th><th>MEMBERS, MOST POPULAR FIRST</th></tr></thead><tbody>']
    for g in GROUPS:
        ms = group_members(g)
        cells = ' · '.join(
            f'<span class="{"hid" if e.hidden else ("new" if e.new else "")}">{E(e.name)} <b>{e.pop}</b></span>' for e in ms)
        out.append(f'<tr><td class="gt">{GROUP_TITLE[g]}<small>{g}</small></td><td class="r n">{len(ms)}</td><td class="gm">{cells}</td></tr>')
    out.append('</tbody></table>')
    return '\n'.join(out)


def new_table() -> str:
    out = []
    sections = []
    for e in ADDED:
        if e.section not in sections:
            sections.append(e.section)
    for s in sections:
        items = sorted([e for e in ADDED if e.section == s], key=lambda e: (-e.pop, e.name))
        out.append(f'<div class="nsec"><h3>{s} <span>{len(items)}</span></h3><table class="nt">')
        for e in items:
            grp = GROUP_TITLE.get(e.group, '—') if e.group else '—'
            out.append(f'<tr class="{"hidrow" if e.hidden else ""}"><td class="nm">{E(e.name)}{tag(e)}</td><td class="sc"><b>{e.pop}</b>{meter(e.pop, True)}</td>'
                       f'<td class="gp">{grp}</td><td class="nn">{E(e.note)}</td></tr>')
        out.append('</table></div>')
    return '\n'.join(out)


def hidden_table() -> str:
    hid = [e for e in RANKED if e.hidden]
    out = []
    for lo, hi, title in [(2, 3, 'Specialist · 2–3'), (0, 1, 'Rare · 0–1')]:
        part = [e for e in hid if lo <= e.pop <= hi]
        out.append(f'<div class="nsec"><h3>{title} <span>{len(part)}</span></h3><table class="nt">')
        out.extend(_hid_rows(part))
        out.append('</table></div>')
    return '\n'.join(out), len(hid)


def _hid_rows(hid):
    out = []
    for e in hid:
        why = HIDDEN_WHY.get(e.name) or e.note or ''
        flag = ' <span class="fl new">NEW</span>' if e.new else ''
        out.append(f'<tr><td class="nm">{E(e.name)}{flag}</td><td class="sc"><b>{e.pop}</b></td><td class="gp">{GROUP_TITLE.get(e.group, "—") if e.group else "—"}</td></tr>')
    return out


def focus_table(rows, ranked, old_pick, picked) -> str:
    out = ['<table class="ft"><thead><tr><th>LIFT</th><th class="r">SESSIONS<br>8 WK</th><th class="r">POP.</th><th class="r">× WEIGHT</th><th class="r">SCORE</th><th>TODAY</th><th>PROPOSED</th></tr></thead><tbody>']
    for r in ranked:
        n = r['name']
        today = '<span class="pk">focus</span>' if n in old_pick else ''
        new = '<span class="pk">focus</span>' if n in picked else (f'<span class="sk">{E(r["skip"])}</span>' if r['skip'] else '')
        out.append(f'<tr><td class="nm">{E(n)}</td><td class="r">{r["sessions"]}</td><td class="r">{r["pop"]}</td><td class="r">{r["w"]:.2f}</td>'
                   f'<td class="r"><b>{r["score"]:.2f}</b></td><td>{today}</td><td>{new}</td></tr>')
    non = [r for r in rows if not r['compound']]
    for r in non:
        out.append(f'<tr class="dimr"><td class="nm">{E(r["name"])}</td><td class="r">{r["sessions"]}</td><td class="r">{r["pop"]}</td><td class="r">—</td><td class="r">—</td><td colspan="2"><span class="sk">isolation: never automatic</span></td></tr>')
    out.append('</tbody></table>')
    return '\n'.join(out)


# ────────────────────────────────────────────────────────────────── page

CSS = r"""
:root{--accent:#2e8bff;--tip:#2ee66b;--warn:#ff8c1a;--danger:#ff3b3b;--bg:#000;--fg:#fff;--fg2:#8e8e8e;--fg3:#555;--line:#1f1f1f;--surf:#0e0e0e;--surf2:#161616;--doneTint:color-mix(in srgb,var(--accent) 14%,#000);--font:-apple-system,BlinkMacSystemFont,"SF Pro Text","Helvetica Neue",Helvetica,Arial,sans-serif}
*{box-sizing:border-box;margin:0;padding:0}
body{background:#050505;font-family:var(--font);color:var(--fg);padding:40px 24px 80px;font-variant-numeric:tabular-nums}
.board{max-width:1100px;margin:0 auto;background:#0a0a0a;border:1px solid #1c1c1c;border-radius:16px;padding:40px}
.eyebrow{font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:var(--fg2);font-weight:600}
h1{font-size:36px;font-weight:700;letter-spacing:-.02em;margin:6px 0 6px}
.lead{color:var(--fg2);font-size:15px;max-width:820px;line-height:1.55}
.lead b{color:#ddd;font-weight:600}
.toc{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-top:24px}
.toc a{display:block;border:1px solid var(--line);border-radius:10px;padding:10px 12px;background:var(--surf);text-decoration:none;color:#fff;font-size:13px;font-weight:600;line-height:1.35}
.toc a small{display:block;color:var(--fg2);font-weight:500;font-size:11px;margin-top:2px}
.toc a i{font-style:normal;color:var(--accent);font-weight:700;margin-right:4px}
.kpis{display:grid;grid-template-columns:repeat(5,1fr);gap:8px;margin-top:18px}
.kpis div{border:1px solid var(--line);border-radius:10px;padding:10px 12px}
.kpis b{display:block;font-size:22px;font-weight:700}.kpis small{font-size:11px;color:var(--fg2)}
.section{margin-top:52px;padding-top:30px;border-top:1px solid var(--line)}
.stag{display:inline-block;font-size:11px;font-weight:700;letter-spacing:.06em;color:#000;background:#fff;border-radius:6px;padding:3px 8px;margin-bottom:10px}
.section h2{font-size:24px;font-weight:700;margin-bottom:4px}
.section > p,.section .p{color:var(--fg2);font-size:14px;max-width:820px;line-height:1.55;margin-top:6px}
.section > p b,.section .p b{color:#ddd;font-weight:600}
.row{display:grid;grid-template-columns:repeat(3,1fr);gap:24px;margin-top:26px;align-items:start}
.row2{display:grid;grid-template-columns:320px 1fr;gap:28px;margin-top:26px;align-items:start}
.cap{width:300px;margin:12px auto 0}
.cap b{font-size:14px;display:block}
.cap b em{font-style:normal;color:var(--accent);margin-right:6px}
.cap p{font-size:12px;color:var(--fg2);line-height:1.5;margin-top:4px}
.cap p b{display:inline;font-size:inherit;color:#ddd;font-weight:600}
.phone{width:300px;height:620px;margin:0 auto;border-radius:44px;border:10px solid #2a2a2a;background:var(--bg);overflow:hidden;position:relative;display:flex;flex-direction:column;font-size:15px}
.status{height:34px;flex:none;display:flex;justify-content:space-between;align-items:center;padding:0 22px;font-size:12px;font-weight:600}
.island{width:84px;height:22px;background:#1a1a1a;border-radius:12px}
.body{flex:1;overflow:hidden;padding:0 16px;position:relative}
.homebar{flex:none;height:5px;width:110px;background:#fff;opacity:.85;border-radius:3px;margin:6px auto 8px;position:relative;z-index:20}
.fade{position:absolute;left:0;right:0;bottom:0;height:46px;background:linear-gradient(transparent,#000);pointer-events:none}
.nh{flex:none;display:grid;grid-template-columns:1fr auto 1fr;gap:8px;align-items:center;padding:6px 16px 10px;border-bottom:1px solid var(--line);min-height:40px}
.nh .t{font-size:16px;font-weight:700;text-align:center;white-space:nowrap}
.nh .l{justify-self:start;white-space:nowrap}.nh .r{justify-self:end;white-space:nowrap}
.tb{color:var(--accent);font-weight:600;font-size:15px}
.tb.g{color:var(--fg2);font-weight:500}.tb.b{font-weight:700}.tb.big{font-size:22px;line-height:.8}.tb.sm{font-size:13px;font-weight:500}
.search{display:flex;align-items:center;gap:8px;background:#1c1c1c;border-radius:10px;height:34px;padding:0 10px;margin-top:10px;font-size:14px;color:var(--fg2)}
.search.on{border:1.5px solid var(--accent)}.search .q{color:#fff;flex:1}.search .x{font-size:11px;background:#3a3a3a;color:#000;border-radius:50%;width:16px;height:16px;display:flex;align-items:center;justify-content:center}
.chips{display:flex;gap:6px;margin-top:10px;overflow:hidden;white-space:nowrap}
.chips span{font-size:12px;font-weight:600;border-radius:999px;padding:6px 11px;background:#161616;color:#9a9a9a;flex:none}
.chips span.on{background:#fff;color:#000}
.seg{display:flex;background:#161616;border-radius:8px;padding:2px;margin-top:10px}
.seg span{flex:1;text-align:center;font-size:12px;font-weight:600;color:var(--fg2);padding:5px 0;border-radius:6px}
.seg span.on{background:#2c2c2c;color:#fff}
.lbl{font-size:10px;font-weight:700;letter-spacing:.07em;color:var(--fg2);margin-top:14px;padding-bottom:6px;border-bottom:1px solid var(--line);display:flex;justify-content:space-between}
.lbl span{letter-spacing:0;color:var(--accent);font-weight:600;font-size:11.5px}
.lbl span.g{color:var(--fg2);letter-spacing:.07em;font-size:10px;font-weight:700}
.lr{display:flex;justify-content:space-between;align-items:center;gap:10px;min-height:46px;border-bottom:1px solid var(--line);padding:5px 0}
.lr .n{font-size:14px;font-weight:600;line-height:1.2}.lr .s{font-size:11.5px;color:var(--fg2);margin-top:2px}
.lr .n2{font-size:14px}
.lr.dim .n{color:#7a7a7a}.lr.dim .s{color:#555}
.chev{color:#555;font-size:18px}
.ses{font-size:12px;color:var(--fg2)}
.tt{font-size:8.5px;font-weight:700;border:1px solid #444;color:#9a9a9a;border-radius:4px;padding:1px 4px;vertical-align:2px;margin-left:4px;letter-spacing:.03em}
.ck{width:22px;height:22px;border-radius:50%;border:1.5px solid #444;flex:none}
.more{font-size:12.5px;color:var(--accent);font-weight:600;padding:9px 0 0}
.gap{text-align:center;color:#444;font-size:14px;padding:2px 0;border-bottom:1px solid var(--line)}
.foot{font-size:11.5px;color:var(--fg2);line-height:1.5;margin-top:12px}
.foot span{color:var(--accent);font-weight:600}
.pm{display:inline-flex;gap:2px;flex:none;vertical-align:middle}
.pm i{width:5px;height:10px;border-radius:1.5px;background:#262626}
.pm i.on{background:#8a8a8a}
.pm.sm i{width:3px;height:9px;border-radius:1px}
.pm.sm i.on{background:#7a7a7a}
.ttl{font-size:26px;font-weight:700;letter-spacing:-.02em;margin-top:10px}
.sub{font-size:12px;color:var(--fg2);margin-top:3px}
.stats{display:grid;grid-template-columns:1fr 1.3fr 1fr;border-top:1px solid var(--line);border-bottom:1px solid var(--line);margin-top:12px}
.stats div{padding:8px 0 8px 8px;border-left:1px solid var(--line)}.stats div:first-child{border-left:0;padding-left:0}
.stats small{display:block;font-size:9px;font-weight:700;letter-spacing:.06em;color:var(--fg2)}.stats b{font-size:17px}
.vchips,.vars{display:flex;gap:6px;margin-top:10px;flex-wrap:wrap}
.vchips span,.vars span{font-size:12.5px;font-weight:600;border-radius:9px;padding:7px 11px;border:1px solid #2a2a2a;color:#9a9a9a;white-space:nowrap}
.vchips span small{font-weight:500;color:var(--fg2)}
.vchips span.on,.vars span.on{border-color:var(--accent);color:#fff;background:var(--doneTint)}
.vchips span.u,.vars span.u{border-color:#2e8bff66;color:#cfcfcf}
.vchips span.all,.vars span.all{border-style:dashed;color:var(--accent);border-color:#2a2a2a}
.vwrap{display:flex;align-items:center;gap:6px;margin-top:10px}
.vwrap .vars{margin-top:0;flex:1;flex-wrap:nowrap;overflow:hidden;-webkit-mask-image:linear-gradient(90deg,#000 85%,transparent);mask-image:linear-gradient(90deg,#000 85%,transparent)}
.vwrap > span.all{font-size:12px;font-weight:600;border-radius:9px;padding:6px 9px;border:1px dashed #2a2a2a;color:var(--accent);flex:none}
.vars span{padding:6px 9px;font-size:12px}
.note{font-size:11.5px;color:var(--fg2);line-height:1.5;margin-top:8px}
.scrim{position:absolute;inset:0;background:rgba(0,0,0,.6);z-index:5}
.bigsheet{position:absolute;left:0;right:0;bottom:0;top:96px;background:#111;border-radius:16px 16px 0 0;z-index:6;display:flex;flex-direction:column}
.grab{width:36px;height:4px;background:#3a3a3a;border-radius:2px;margin:7px auto 4px;flex:none}
.shh{display:flex;justify-content:space-between;align-items:flex-start;padding:4px 16px 8px;border-bottom:1px solid var(--line);flex:none}
.shh b{font-size:16px;display:block}.shh small{font-size:11.5px;color:var(--fg2)}
.xb{width:24px;height:24px;border-radius:50%;background:#2a2a2a;color:#aaa;font-size:11px;display:flex;align-items:center;justify-content:center}
.shb{flex:1;overflow:hidden;padding:0 16px;position:relative}
.lr.sh{min-height:40px;padding:3px 0}
.lr.sh .n{font-size:13.5px}
.lr.sh.cur .n{color:var(--accent)}
.bl{color:var(--accent)}
.shf{flex:none;display:flex;justify-content:space-between;align-items:center;padding:10px 16px 26px;border-top:1px solid var(--line);font-size:12px}
.g2{color:var(--fg2);font-size:11.5px}
.wh{flex:none;display:flex;justify-content:space-between;align-items:center;padding:6px 16px 10px;border-bottom:1px solid var(--line)}
.wh .t{font-size:17px;font-weight:700}.wh .s{font-size:12px;color:var(--fg2)}
.finish{background:var(--accent);color:#fff;font-weight:600;font-size:13px;border-radius:8px;padding:6px 12px}
.exh{display:flex;justify-content:space-between;align-items:center;margin-top:14px}
.exn{font-size:20px;font-weight:700}.exp{font-size:12px;color:var(--fg2);margin-top:2px}
.hbtns{display:flex;gap:6px}
.ib{font-size:12px;font-weight:600;color:var(--accent);border:1px solid var(--line);border-radius:8px;padding:5px 9px;display:flex;align-items:center;height:28px}
.tbl{margin-top:12px;font-size:14px}
.tr{display:grid;grid-template-columns:28px 1fr 58px 44px 34px;align-items:center;height:40px;border-radius:8px;padding:0 4px;margin-bottom:3px}
.th{height:24px;font-size:10px;font-weight:700;letter-spacing:.06em;color:var(--fg2)}
.c{text-align:center}
.prev{color:var(--fg2);font-size:13px}
.tr.done{background:var(--doneTint)}
.in{background:var(--surf2);border-radius:6px;height:28px;display:flex;align-items:center;justify-content:center;font-weight:600;margin:0 3px}
.done .in{background:transparent}
.cur .in{border:1.5px solid var(--accent)}
.chk{width:26px;height:26px;border-radius:7px;border:1.5px solid #333;margin:0 auto;display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:700}
.chk.on{background:var(--accent);border-color:var(--accent);color:#fff}
.sn{font-weight:700;font-size:13px;text-align:center}
.quick{display:flex;gap:6px;margin-top:6px}
.quick span{flex:1;height:34px;border-radius:8px;border:1px dashed #333;display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:600;color:var(--accent)}
.quick span.dr{color:var(--warn)}
.nav{flex:none;display:grid;grid-template-columns:1fr 1fr;gap:8px;border-top:1px solid var(--line);padding:10px 12px 4px}
.nav .nb{height:44px;border-radius:10px;background:var(--surf2);display:flex;align-items:center;padding:0 12px;font-size:12px;font-weight:600;gap:8px;white-space:nowrap}
.nav .nb small{display:block;font-size:9px;color:var(--fg2);font-weight:600;letter-spacing:.04em}
.nav .nb.r{justify-content:flex-end;text-align:right}
.arrow{font-size:16px;color:var(--fg2)}
.tog{display:flex;justify-content:space-between;align-items:center;gap:10px;padding:12px 0 10px;border-bottom:1px solid var(--line)}
.tog .s{font-size:11px;color:var(--fg2);margin-top:2px}
.sw{width:42px;height:25px;border-radius:13px;background:#333;position:relative;flex:none}
.sw.on{background:var(--accent)}.sw i{position:absolute;top:2.5px;right:2.5px;width:20px;height:20px;border-radius:50%;background:#fff}
.lr.fl{justify-content:flex-start;gap:12px}.lr.fl > div{flex:1}
.ckb{width:22px;height:22px;border-radius:50%;border:1.5px solid #444;flex:none;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700}
.ckb.on{background:var(--accent);border-color:var(--accent)}
.drag{color:#666;font-size:18px}
/* board tables */
table{border-collapse:collapse;width:100%;font-size:12.5px;margin-top:18px}
th{font-size:10px;letter-spacing:.06em;color:var(--fg2);text-align:left;padding:7px 8px;border-bottom:1px solid #2a2a2a;font-weight:700}
td{padding:5px 8px;border-bottom:1px solid #161616;color:#cfcfcf;vertical-align:middle}
.r{text-align:right}
td.n{color:#666;width:36px}
td.nm{color:#fff;font-weight:600;white-space:nowrap}
td.sc{white-space:nowrap;width:120px}td.sc b{display:inline-block;width:20px;color:#fff}
td.gp{color:var(--fg2)}
td.fls{white-space:nowrap;text-align:right}
.ar{font-size:10.5px;color:#9ec5ff;margin-left:4px}
.fl{font-size:9px;font-weight:700;letter-spacing:.05em;border-radius:4px;padding:2px 5px;margin-left:4px}
.fl.new{background:#0f2a12;color:var(--tip)}
.fl.mv{background:#2a1d0a;color:var(--warn)}
.fl.hid{background:#222;color:#999}
.fl.cp{background:#0b1a2e;color:#7fb6ff}
tr.band td{background:#111;color:var(--fg2);font-size:11.5px;padding:9px 8px;border-bottom:1px solid #2a2a2a}
tr.band td b{color:#fff;font-size:13px;margin-right:6px}
tr.band td span{float:right;color:#666}
tr.hidrow td{opacity:.55}
.rank .pm{margin-left:4px}
.grp td{vertical-align:top;padding:8px}
.gt{color:#fff;font-weight:600;white-space:nowrap;width:190px}.gt small{display:block;color:#555;font-weight:500;font-size:10.5px;margin-top:2px}
.gm{line-height:1.75;color:#cfcfcf}.gm b{color:var(--fg2);font-weight:600}
.gm span.new{color:var(--tip)}.gm span.new b{color:#1f9c4a}
.gm span.hid{color:#666;text-decoration:line-through;text-decoration-color:#444}
.nsecs{display:grid;grid-template-columns:1fr 1fr;gap:28px;margin-top:10px}
.nsec h3{font-size:14px;margin-top:18px}.nsec h3 span{color:var(--fg2);font-weight:500;margin-left:4px}
.nsec table{margin-top:6px}
.nt td{padding:5px 6px}
.nt td.nn{color:var(--fg2);font-size:11.5px}
.nt td.gp{white-space:nowrap;font-size:11.5px}
.nt td.sc{width:90px}
.ft td.nm{width:auto}
.pk{font-size:10px;font-weight:700;letter-spacing:.05em;background:var(--accent);color:#fff;border-radius:4px;padding:2px 6px}
.sk{font-size:11px;color:var(--fg2)}
tr.dimr td{color:#666}tr.dimr td.nm{color:#888}
.rules td{padding:10px;line-height:1.5;vertical-align:top}
.rules td:first-child{color:#fff;font-weight:600;width:200px}
.rules code,.p code{font-family:ui-monospace,Menlo,monospace;font-size:11.5px;color:#9ec5ff}
.legend{display:flex;gap:14px;margin-top:12px;font-size:11.5px;color:var(--fg2);flex-wrap:wrap;align-items:center}
.qs{margin-top:14px;padding-left:18px;color:#cfcfcf;font-size:13.5px;line-height:1.6}
.qs li{margin-top:6px}.qs li b{color:#fff}
"""


def build() -> str:
    lib = screen_library()
    search, n_pop_rows, hid_hits = screen_search()
    arms, n_fore = screen_arms()
    ex_screen, shown, more, members = screen_exercise()
    ex_with_sheet = phone(nh('<span class="tb">‹ Exercises</span>', '', '<span class="tb">Edit</span>'),
                          '<div class="ttl">Barbell Row</div><div class="sub">Back · Barbell · Weight × reps</div>', extra=sheet_all())
    head, lbody, lfoot, lshown, lmore = screen_logging()
    logging = phone(head, lbody, foot=lfoot)
    logging_sheet = phone(head, lbody, foot=lfoot, extra=sheet_all(mode='switch', skip=7))
    focus_phone, (frows, franked, old_pick, picked) = screen_focus()
    hid_html, n_hidden = hidden_table()
    n_hid_old = sum(1 for e in EXISTING if e.hidden)
    n_hid_new = n_hidden - n_hid_old
    n_new = len(ADDED)
    n_groups = len(GROUPS)
    biggest = max(GROUPS, key=lambda g: len(group_members(g)))

    rules = [
        ('Score', f'Every built-in exercise has <code>popularity</code>, a whole number 0–10: how many lifters you\'d expect to have it in a log. 10 is Bench Press; 9 is Squat, Deadlift, Lat Pulldown, Leg Press. It\'s a hand-set constant in the seed, never computed from your data. Custom exercises have none and count as {CUSTOM_POPULARITY}.'),
        ('Hidden', f'Score ≤ {HIDE_AT_OR_BELOW} is hidden by default: left out of the Library and picker lists and of variation chips. It still shows (a) when you search for it, at the bottom under Rarely used, (b) whenever you\'ve logged it or it\'s in a routine, (c) in a variation group\'s All list, under Rarely used, and (d) with Show hidden in the Library. No setting needed.'),
        ('Never shown', 'The score is internal. No screen in the app shows a number, bar or label for it; it only decides order, hiding and focus-lift tie-breaks. (The bars on this board are for design work only.)'),
        ('Library and picker order', 'Popular is the default sort: <b>You do</b> first (your 4 most-logged exercises; the picker keeps "In this routine" above it), then <b>Most popular</b>: every other visible exercise, most popular first, then A–Z. A–Z is one tap away and is remembered. Muscle chips filter both; Cardio moves to the end of the chips (All, Chest, Back, Legs, Shoulders, Arms, Core, Cardio).'),
        ('Search order', 'Matches you\'ve logged first, then by score, then hidden matches dimmed under Rarely used. Typing "row" puts Barbell Row and Seated Cable Row above Yates Row and Helms Row.'),
        ('Variation chips', f'On the exercise screen and while logging: this exercise, then the variations you\'ve logged (most sessions first), then the most popular ones, up to {CHIPS_MAX} chips. The rest sit behind "All N", a sheet ranked by score with your sessions in blue. A variation you\'ve logged always gets a chip, even past {CHIPS_MAX}. Labels come from the whole group (<code>variationLabels</code>), so a chip\'s name never changes when the set of chips does.'),
        ('Focus lifts (automatic)', f'Unchanged inputs: compound lifts logged in the last 8 weeks that have a trend number. New: rank by <code>sessions × (0.6 + 0.04 × popularity)</code> instead of sessions alone, and take at most one lift per variation group. The multiplier runs 0.60–1.00, so a lift you log 1.7× as often always wins; popularity only decides close calls and ties (today a tie falls to whichever was logged last). Customised focus lifts are never touched.'),
        ('Data model', '<code>SeedExercise</code> gains <code>popularity: number</code> and optional <code>area?: \'forearms\' | \'lower back\'</code>. <code>Exercise</code> copies <code>popularity</code> at seed time (so a re-seed can update scores without touching user edits). Hidden is derived, never stored. Farmer\'s Carry needs a new type, <code>weight_time</code>: LBS and TIME columns, est. 1RM and records skip it, Progress charts the heaviest weight with time as the tiebreak. New exercises seed like any other (<code>ex-&lt;slug&gt;</code>); regrouping changes only <code>variationGroupId</code> on exercises the user hasn\'t relinked.'),
        ('Area', 'Muscles stay the seven filters. <code>area</code> only adds a word to the meta line ("Arms · Forearms · dumbbell") and to search, so "forearm" or "lower back" finds the right exercises without a new chip.'),
    ]
    rules_html = '<table class="rules"><tbody>' + ''.join(f'<tr><td>{a}</td><td>{b}</td></tr>' for a, b in rules) + '</tbody></table>'

    left_out = ''.join(f'<tr><td class="nm">{E(a)}</td><td class="nn">{E(b)}</td></tr>' for a, b in LEFT_OUT)

    return f"""<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>OpenGym — Exercise popularity</title><style>{CSS}</style></head><body><div class="board">
<div class="eyebrow">OpenGym · proposal · not approved yet</div>
<h1>Exercise popularity</h1>
<p class="lead">Every built-in exercise and variation gets a <b>popularity score from 0 to 10</b>. Lists are ranked by it by default, specialist and rare ones are hidden until you search, the score itself is never shown, variation groups can grow (rows with every grip) without flooding the screen, and the score breaks close calls when focus lifts are picked automatically. Every table and list on this page is generated by <code style="color:#9ec5ff">exercise-popularity.py</code> from <code style="color:#9ec5ff">src/db/seedExercises.ts</code>.</p>
<div class="kpis"><div><b>{len(ALL)}</b><small>exercises after this ({len(EXISTING)} today)</small></div><div><b>{n_new}</b><small>new: grips, forearms, lower back</small></div><div><b>{n_hidden}</b><small>hidden by default (score ≤ {HIDE_AT_OR_BELOW})</small></div><div><b>{n_groups}</b><small>variation groups</small></div><div><b>{len(group_members(biggest))}</b><small>in the biggest: {GROUP_TITLE[biggest].lower()}</small></div></div>
<div class="toc">
<a href="#a"><i>A</i>Ranked by default<small>Library, picker, search</small></a>
<a href="#b"><i>B</i>Variations<small>Yours + popular, then All</small></a>
<a href="#c"><i>C</i>Focus lifts<small>Popularity breaks close calls</small></a>
<a href="#d"><i>D</i>New exercises<small>Grips, forearms, lower back</small></a>
<a href="#e"><i>E</i>Hidden<small>What and why</small></a>
<a href="#f"><i>F</i>Variation groups<small>Members by score</small></a>
<a href="#g"><i>G</i>The full ranking<small>All {len(ALL)}, 10 → 0</small></a>
<a href="#h"><i>H</i>Rules and open questions<small>Data model, build notes</small></a>
</div>

<div id="a" class="section"><span class="stag">A · RANKED BY DEFAULT</span><h2>Popular first, yours above that</h2>
<p>The Library (8.1) and the exercise picker (2.5) open on <b>Popular</b> instead of A–Z. What you already do comes first, so the list is useful from day one and gets more personal as you log.</p>
<div class="row">
<div>{lib}{cap('A1', 'Library: Popular', 'A Popular / A–Z switch under the muscle chips. <b>You do</b> shows your 4 most-logged exercises. <b>Most popular</b> is everything else, most popular first. The score itself is never shown in the app; only the order uses it. Cardio is the last muscle chip.')}</div>
<div>{search}{cap('A2', 'Picker search: "row"', f'Your rows first, then {n_pop_rows} others, most popular first, then the {len(hid_hits)} hidden matches dimmed under Rarely used (first 4 shown). "In this routine" folds away while searching, as today (2.6).')}</div>
<div>{arms}{cap('A3', 'Arms filter, with forearms', f'The {n_fore} visible forearm exercises are ordinary Arms exercises tagged <b>Forearms</b> in the meta line and in search. The footer says how many are hidden and offers Show hidden, the only way to browse them without searching.')}</div>
</div></div>

<div id="b" class="section"><span class="stag">B · VARIATIONS</span><h2>Show the ones you use, rank the rest</h2>
<p>Bigger groups (free-weight rows go from 6 to {len(members)}) only work if the chips stay short. Chips show <b>this one, the ones you've logged, then the most popular</b>, up to {CHIPS_MAX}. Everything else is one tap away in a list, most popular first.</p>
<div class="row">
<div>{ex_screen}{cap('B1', 'Exercise screen (8.2)', f'Barbell Row: you’ve logged DB Row and Underhand Barbell Row (blue outline), then T-Bar Row fills the last chip as the most popular one you haven’t tried. <b>All {len(shown) + more}</b> opens B2. Edit links (8.4) is unchanged.')}</div>
<div>{ex_with_sheet}{cap('B2', 'All variations', 'Every variation in the group, most popular first (no score shown), yours marked with sessions in blue. Hidden ones sit under Rarely used so they can still be found. Tap a row to open that exercise.')}</div>
<div>{logging}{cap('B3', 'While logging (4.1)', f'The same rule for the chips over the sets: {len(lshown)} chips on one line that scrolls sideways, with <b>+{lmore}</b> pinned at the end. Tapping a chip switches as today; +{lmore} opens the same list as a switcher (B4).')}</div>
</div>
<div class="row">
<div>{logging_sheet}{cap('B4', 'Switch to…, scrolled down', 'B2 as a picker, scrolled to the end where hidden ones wait under Rarely used. Choosing an exercise switches this slot like a chip does, and it then earns a chip next time because you’ve logged it.')}</div>
<div></div><div></div>
</div></div>

<div id="c" class="section"><span class="stag">C · FOCUS LIFTS</span><h2>Popularity breaks close calls</h2>
<p>Automatic focus lifts are today the 4 most-logged compound lifts (7.5, SPEC §13). Two changes: each lift's sessions are multiplied by <b>0.6 + 0.04 × popularity</b> (0.60 for a 0, 1.00 for a 10), and a variation group gets <b>at most one</b> focus slot, so two pulldown grips can't take half of them. Example below: a lifter whose most-logged compounds are a Smith incline and a single-arm row.</p>
<div class="row2"><div>{focus_phone}{cap('C1', 'Focus lifts (7.5), automatic', 'The copy says how they were picked. Rows show sessions and the score. Ticking or dragging anything switches to your own list, as today.')}</div>
<div>{focus_table(frows, franked, old_pick, picked)}
<p class="p" style="font-size:12.5px">Today: {", ".join(old_pick)}. Proposed: {", ".join(picked)}. Bench Press gets in on a score of 10, Leg Press edges out Single-Arm Cable Row, and Close-Grip Lat Pulldown is skipped because Lat Pulldown already holds that group. Lateral Raise has the most sessions but is isolation, so it never becomes a focus lift automatically.</p>
<p class="p" style="font-size:12.5px">The same score orders <b>Other exercises</b> on this screen and the Progress list after the focus lifts. With no history yet (before the first two sessions), the picker in 7.5 lists compound lifts by score, so Bench, Squat, Deadlift and Lat Pulldown are on top.</p>
</div></div></div>

<div id="d" class="section"><span class="stag">D · NEW EXERCISES</span><h2>{n_new} additions: grips, forearms, lower back</h2>
<p>Grip versions are separate exercises in the existing groups, so each keeps its own history and appears as a chip once you log it. Forearms and lower back get real choices instead of one Wrist Curl and one Back Extension. Green = new.</p>
<div class="nsecs">{new_table()}</div>
<h3 style="font-size:14px;margin-top:26px">Considered and left out</h3>
<table class="nt">{left_out}</table>
</div>

<div id="e" class="section"><span class="stag">E · HIDDEN</span><h2>{n_hidden} exercises hidden by default</h2>
<p>Hidden means out of the way, never gone: search finds them, anything you've logged or put in a routine always shows, and they stay in their group's All list. Everything scored 3 or less is hidden: the specialist band (2–3) as well as the rare one (0–1). {n_hid_old} are existing exercises and {n_hid_new} are new, added so the people who do them don't need a custom exercise.</p>
<div class="nsecs">{hid_html}</div>
</div>

<div id="f" class="section"><span class="stag">F · VARIATION GROUPS</span><h2>{n_groups} groups, members by score</h2>
<p>Orange in G marks existing exercises that join a group: Meadows Row joins free-weight rows, and Back Extension, Good Morning, Reverse Curl and Wrist Curl each start a new group. <span style="color:var(--tip)">Green</span> = new, struck through = hidden.</p>
{groups_table()}
</div>

<div id="g" class="section"><span class="stag">G · THE FULL RANKING</span><h2>All {len(ALL)} exercises, 10 → 0</h2>
<p>Ties are A–Z. Scores are a judgement of how common each lift is in gym logs, not of how good it is; they're meant to be argued with. Change one in the script and rerun it.</p>
<div class="legend"><span class="fl new">NEW</span> added here <span class="fl mv">REGROUPED</span> joins a variation group <span class="fl hid">HIDDEN</span> score ≤ {HIDE_AT_OR_BELOW} <span class="fl cp">COMPOUND</span> can be an automatic focus lift</div>
{full_table()}
</div>

<div id="h" class="section"><span class="stag">H · RULES</span><h2>How it works</h2>
{rules_html}
<h3 style="font-size:16px;margin-top:28px">Open questions</h3>
<ol class="qs">
<li><b>One focus lift per variation group</b> is new behaviour on top of the score. It can ship separately.</li>
<li><b>Hiding at 3 or less</b> hides {n_hidden} of {len(ALL)}, including most of the new lower-back exercises (Reverse Hyperextension, Roman Chair Back Extension, Superman, Glute-Ham Raise) and Good Morning. They're one search away; raise any of them to 4 to keep it in the lists.</li>
</ol>
</div>
</div></body></html>"""


def main():
    out = HERE / 'exercise-popularity.html'
    out.write_text(build())
    data = [dict(name=e.name, popularity=e.pop, hidden=e.hidden, group=e.group, area=e.area, new=e.new, muscle=e.muscle,
                 equipment=e.equipment, type=e.type) for e in RANKED]
    (HERE / 'exercise-popularity.json').write_text(json.dumps(data, indent=1) + '\n')
    print(f'{len(ALL)} exercises ({len(ADDED)} new, {sum(e.hidden for e in ALL)} hidden) → {out.name}')


if __name__ == '__main__':
    main()
