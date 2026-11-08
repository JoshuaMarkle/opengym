"""Reference implementation of the OpenGym training rules.
Every example table in training-logic.html is generated from these functions."""
import math, statistics

# ---------------- tunable constants ----------------
K = dict(
    SET1_WEIGHT=0.60,          # share of the decision carried by working set 1
    UP_MADE_SHARE=0.90,        # weighted share of sets that must reach repsMin to go up
    EASY_RIR=4,                # set 1 at/above this RIR and at/above repsMax -> +2 steps
    HARD_RIR=1,                # RIR at/below this counts as "at or near failure"
    WELL_SHORT=2,              # reps under repsMin that count as well short
    DOWN_NOW=3,                # set 1 this far under repsMin at failure -> down immediately
    DOWN_SESSIONS=2,           # sessions in a row of set 1 well short at failure -> down
    BACKOFF_PCT=0.05,          # back-off sets drop by this share (at least one step)
    DOWN_PCT_BARBELL=0.10,     # barbell down move
    BREAK_DAYS=21, LONG_BREAK_DAYS=42, COMEBACK_PCT=0.90, LONG_COMEBACK_PCT=0.80, RAMP_SESSIONS=3,
    DISMISS_LIMIT=2,
    BIG_STEP_GUARD=False,      # see open question 1
    BIG_STEP_RATIO=0.15,
    # trends
    WINDOW_DAYS=56, MIN_SESSIONS=6, MIN_SPAN_DAYS=28,
    CLIMB_MIN_PCT=1.5, SLIP_MIN_PCT=3.0, SLIP_NOISE_MULT=1.5,
    SLOW_LIFT_PCT_MO=0.5,
    # projection
    PROJ_WINDOW_DAYS=84, MIN_R2=0.30, MAX_NOISE_PCT=6.0, FLAT_NOISE_PCT=2.0,
    PRIOR_WEIGHT_SESSIONS=8,
)

def round_to(x, step, mode='nearest'):
    q = x / step
    q = math.floor(q + 1e-9) if mode == 'down' else (math.ceil(q - 1e-9) if mode == 'up' else round(q))
    return round(q * step, 2)

def classify(reps, lo, hi):
    if reps > hi: return 'PAST'
    if reps == hi: return 'TOP'
    if reps >= lo: return 'IN'
    if reps >= lo - K['WELL_SHORT'] + 1: return 'SHORT'
    return 'WELL'

def weights(n):
    if n == 1: return [1.0]
    return [K['SET1_WEIGHT']] + [(1 - K['SET1_WEIGHT']) / (n - 1)] * (n - 1)

def hard(rir):  # unknown effort is treated as hard for down / back-off checks
    return rir is None or rir <= K['HARD_RIR']

def e1rm(w, reps, rir):
    r = reps + (rir if rir is not None else 0)
    return w * (1 + r / 30)

def decide(sets, lo, hi, step, equipment='barbell', prev_set1_well_short=False):
    """sets: list of (weight, reps, rir or None) working sets from the last session, in order.
    Returns dict(call, weights per set (None = unchanged), hints per set, why)."""
    n = len(sets); ws = weights(n)
    w1, r1, i1 = sets[0]
    cls = [classify(r, lo, hi) for _, r, _ in sets]
    effort_known = all(s[2] is not None for s in sets)
    made = sum(wt for wt, (_, r, _) in zip(ws, sets) if r >= lo)
    later_well = any(c == 'WELL' for c in cls[1:])
    res = dict(cls=cls, made=made, new=[None] * n, hint=[None] * n)

    # 1. back-off: set 1 past the range at failure, later sets collapse
    if cls[0] == 'PAST' and hard(i1) and later_well:
        drop = max(step, round_to(w1 * K['BACKOFF_PCT'], step))
        for j in range(1, n):
            res['new'][j] = round(sets[j][0] - drop, 2); res['hint'][j] = f"try {fmt(sets[j][0] - drop)}"
        res.update(call='BACK-OFF', why=f"Set 1 past {hi} at failure, later sets well short: drop sets 2+ by {fmt(drop)}")
        return res

    # 2. down: set 1 well short at failure
    if cls[0] == 'WELL' and hard(i1):
        if r1 <= lo - K['DOWN_NOW'] or prev_set1_well_short:
            nw = round_to(w1 * (1 - K['DOWN_PCT_BARBELL']), step, 'down') if equipment == 'barbell' else w1 - step
            nw = min(nw, w1 - step)
            res['new'] = [nw] * n
            res.update(call='DOWN', why=('Set 1 ' + str(lo - r1) + ' under the range at failure' +
                        (', 2nd session in a row' if prev_set1_well_short and r1 > lo - K['DOWN_NOW'] else '')))
            return res
        res['hint'] = [f"try {min(lo, r + 1)}" if r < lo else None for _, r, _ in sets]
        res.update(call='STAY', why='Set 1 well short at failure once: watch. Down if it happens again')
        return res

    # 3. up
    if made >= K['UP_MADE_SHARE'] - 1e-9 and not later_well:
        if not effort_known and not all(r >= hi for _, r, _ in sets):
            pass  # without effort, fall back to classic double progression (all sets at top)
        else:
            steps = 2 if (i1 is not None and i1 >= K['EASY_RIR'] and r1 >= hi) else 1
            nw = w1 + steps * step
            if K['BIG_STEP_GUARD'] and step / w1 > K['BIG_STEP_RATIO']:
                pred = 30 * (e1rm(w1, r1, i1 or 0) / nw - 1)
                if pred < lo - 1:
                    res['hint'] = [f"try {r + 1}" for _, r, _ in sets]
                    res.update(call='STAY', why=f'Big step guard: about {pred:.0f} reps predicted at {fmt(nw)}, keep adding reps')
                    return res
            res['new'] = [nw] * n
            res['hint'] = [f"try {fmt(nw)}"] * n
            res.update(call='UP +2' if steps == 2 else 'UP', why=('Set 1 at the top with 4+ in reserve' if steps == 2 else
                       ('All sets in range' if effort_known else 'No effort logged: all sets at the top of the range')))
            return res

    # 4. stay, with hints only where they change a set
    for j, (_, r, ir) in enumerate(sets):
        if r < lo:
            res['hint'][j] = f"try {min(lo, r + 1)}"
        elif r < hi and ir is not None and ir >= 2:
            res['hint'][j] = f"try {r + 1}"
    if not effort_known and made >= K['UP_MADE_SHARE'] - 1e-9:
        why = 'No effort logged and not every set at the top: stay'
        for j, (_, r, _) in enumerate(sets):
            if r < hi: res['hint'][j] = f"try {r + 1}"
    elif cls[0] == 'PAST' and not hard(i1):
        why = 'Set 1 past the range with reps left, later sets short: stay and push set 1 harder'
    elif cls[0] in ('PAST', 'TOP', 'IN'):
        why = 'Set 1 in range' + (' (past it)' if cls[0] == 'PAST' else '') + ', a later set short: stay'
    elif cls[0] == 'SHORT':
        why = 'Set 1 one rep short of the range: stay'
    else:
        why = 'Set 1 well short but with reps left: the weight is fine, push closer to failure'
    res.update(call='STAY', why=why)
    return res

def comeback(last_w, days, step):
    if days >= K['LONG_BREAK_DAYS']: p = K['LONG_COMEBACK_PCT']
    elif days >= K['BREAK_DAYS']: p = K['COMEBACK_PCT']
    else: return None
    start = round_to(last_w * p, step, 'down')
    ramp = [round_to(start + (last_w - start) * (i / K['RAMP_SESSIONS']), step) for i in range(K['RAMP_SESSIONS'] + 1)]
    return ramp

def fmt(x):
    return str(int(x)) if abs(x - round(x)) < 1e-9 else f"{x:g}"

# ---------------- trends ----------------
def theil_sen(xs, ys):
    sl = [(ys[j] - ys[i]) / (xs[j] - xs[i]) for i in range(len(xs)) for j in range(i + 1, len(xs)) if xs[j] != xs[i]]
    m = statistics.median(sl)
    b = statistics.median([y - m * x for x, y in zip(xs, ys)])
    return m, b

def trend(days, vals, pace_pct_mo, phase='build', comeback_idx=()):
    pts = [(d, v) for k, (d, v) in enumerate(zip(days, vals)) if k not in comeback_idx and d >= days[-1] - K['WINDOW_DAYS']]
    out = dict(n=len(pts))
    if len(pts) < K['MIN_SESSIONS'] or pts[-1][0] - pts[0][0] < K['MIN_SPAN_DAYS']:
        out.update(status='NOT SURE YET', change=None, noise=None); return out
    xs, ys = zip(*pts)
    m, b = theil_sen(xs, ys)
    med = statistics.median(ys)
    resid = [y - (m * x + b) for x, y in zip(xs, ys)]
    noise = 1.4826 * statistics.median([abs(r) for r in resid]) / med * 100
    change = m * K['WINDOW_DAYS'] / med * 100
    below = sum(1 for x, y in list(zip(xs, ys))[-5:] if y < med)
    climb_t = max(K['CLIMB_MIN_PCT'], noise)
    slip_t = max(K['SLIP_MIN_PCT'], K['SLIP_NOISE_MULT'] * noise) * (5 / 3 if phase == 'maintain' else 1)
    if change >= climb_t: st = 'CLIMBING'
    elif change <= -slip_t and below >= 3: st = 'SLIPPING'
    elif pace_pct_mo < K['SLOW_LIFT_PCT_MO']: st = 'STEADY'
    else: st = 'HOLDING'
    if phase == 'maintain' and st in ('HOLDING', 'STEADY'): st = 'MAINTAINED'
    out.update(status=st, change=change, noise=noise, below=below)
    return out

def r2(xs, ys):
    n = len(xs); mx = sum(xs) / n; my = sum(ys) / n
    sxx = sum((x - mx) ** 2 for x in xs); sxy = sum((x - mx) * (y - my) for x, y in zip(xs, ys)); syy = sum((y - my) ** 2 for y in ys)
    if sxx == 0 or syy == 0: return 0.0
    return sxy * sxy / (sxx * syy)

def can_project(days, vals):
    pts = [(d, v) for d, v in zip(days, vals) if d >= days[-1] - K['PROJ_WINDOW_DAYS']]
    if len(pts) < K['MIN_SESSIONS']: return False, f'{len(pts)} sessions (< {K["MIN_SESSIONS"]})'
    xs, ys = zip(*pts)
    m, b = theil_sen(xs, ys); med = statistics.median(ys)
    res = [y - (m * x + b) for x, y in zip(xs, ys)]
    mad = 1.4826 * statistics.median([abs(r) for r in res])
    keep = [(x, y) for (x, y), r in zip(pts, res) if abs(r) <= 3 * mad or mad == 0]
    dropped = len(pts) - len(keep)
    noise = mad / med * 100
    xs2, ys2 = zip(*keep)
    rr = r2(xs2, ys2)
    tag = f' ({dropped} outlier ignored)' if dropped else ''
    if noise > K['MAX_NOISE_PCT']: return False, f'wobble {noise:.1f}% (> {K["MAX_NOISE_PCT"]:g}%)'
    if rr >= K['MIN_R2']: return True, f'R² {rr:.2f}{tag}'
    if noise <= K['FLAT_NOISE_PCT']: return True, f'flat, wobble {noise:.1f}%{tag}'
    return False, f'R² {rr:.2f}, wobble {noise:.1f}%'

# ---------------- projection ----------------
TAU_WEEKS = dict(new=39, some=78, lots=156)

def project(E0, r0_wk, tau_wk, weeks):
    return E0 + r0_wk * tau_wk * (1 - math.exp(-weeks / tau_wk))

def verdict(E0, r0, tau, goal, weeks):
    if goal <= E0: return 'READY'
    exp = project(E0, r0, tau, weeks); fast = project(E0, r0 * 1.5, tau * 1.3, weeks)
    if exp >= goal: return 'LIKELY'
    if fast >= goal: return 'STRETCH'
    return 'UNLIKELY'

def eta_weeks(E0, r0, tau, goal):
    if goal <= E0: return 0
    if r0 <= 0: return None
    cap = r0 * tau
    if goal - E0 >= cap: return None
    t = -tau * math.log(1 - (goal - E0) / cap)
    return t if t <= 104 else None

# ================= v2: per-set fit zone =================
K.update(
    EPLEY=30,                # reps per +100% in the e1RM formula (Epley)
    TARGET_RIR=(0, 2),       # default effort target, asked at setup
    LAST_SET_ONLY_SHIFT=1,   # "failure on last set only": earlier sets aim this much further from failure
    UNKNOWN_RIR=0,           # effort not logged: assume a hard set
    MATCH_PENALTY=3,         # cost in steps of one extra distinct weight when matching sets
)

def e1(w, reps, rir):
    return w * (1 + (reps + rir) / K['EPLEY'])

def w_at(E, reps, rir):
    return E / (1 + (reps + rir) / K['EPLEY'])

def reps_at(E, w, rir):
    return K['EPLEY'] * (E / w - 1) - rir

def targets_for(n, target=None, last_only=False):
    lo, hi = target or K['TARGET_RIR']
    s = K['LAST_SET_ONLY_SHIFT']
    return [((lo + s, hi + s) if last_only and j < n - 1 else (lo, hi)) for j in range(n)]

def fit_set(w, r, rir, lo, hi, step, t):
    """One set on its own: strength, fit zone in lbs, ideal next weight."""
    tl, th = t
    known = rir is not None
    i = rir if known else K['UNKNOWN_RIR']
    E = e1(w, r, i)
    zone = (w_at(E, hi, th), w_at(E, lo, tl))          # lightest .. heaviest weight that lands in range at target effort
    mid_r, mid_i = (lo + hi) / 2, (tl + th) / 2
    in_zone = lo <= r <= hi and (not known or tl <= i <= th)
    top_out = r >= hi and (not known or i <= th)       # can't add reps: weight has to move
    if top_out:
        nw = w + step
        while nw < zone[0] - 1e-9: nw += step          # well past the range: jump to the zone
        kind = 'top'
    elif in_zone:
        nw, kind = w, 'keep'
    else:
        nw = round_to(w_at(E, mid_r, mid_i), step)
        a, b = math.ceil(zone[0] / step - 1e-9) * step, math.floor(zone[1] / step + 1e-9) * step
        if a <= b: nw = min(max(nw, a), b)
        kind = 'move'
    nw = round(nw, 2)
    pred = r if nw == w else reps_at(E, nw, mid_i)
    lo_ok = math.ceil(zone[0] / step - 1e-9) * step
    allowed = (min(nw, lo_ok), max(nw, math.floor(zone[1] / step + 1e-9) * step))
    if kind == 'top': allowed = (nw, max(nw, allowed[1]))
    flag = 'big step' if (nw != w and pred < lo - 0.5) else ('between steps' if lo_ok > zone[1] + 1e-9 else '')
    return dict(E=E, zone=zone, ideal=nw, kind=kind, pred=pred, allowed=allowed, flag=flag, known=known)

def group_weight(members, fits, step):
    a = max(fits[j]['allowed'][0] for j in members); b = min(fits[j]['allowed'][1] for j in members)
    if a > b + 1e-9: return None
    m = sum(fits[j]['ideal'] for j in members) / len(members)
    return round(min(max(round_to(m, step), a), b), 2)

def patterns(n):
    """Set 1 leads: it always keeps its own ideal weight. Group 0 is anchored to set 1."""
    if n == 1: return [[[0]]]
    ps = [[list(range(n))], [[0], list(range(1, n))]]
    if n > 2: ps.append([list(range(n - 1)), [n - 1]])
    ps.append([[j] for j in range(n)])
    return ps

def decide_fit(sets, lo, hi, step, target=None, last_only=False, match=True):
    """sets: [(lbs, reps, rir|None)]. Returns per-set fits, independent weights, matched weights, hints."""
    n = len(sets); ts = targets_for(n, target, last_only)
    fits = [fit_set(w, r, i, lo, hi, step, t) for (w, r, i), t in zip(sets, ts)]
    indep = [f['ideal'] for f in fits]
    best, best_cost, best_p = indep, None, None
    if match:
        for p in patterns(n):
            ws = [None] * n; ok = True
            for g in p:
                if 0 in g:   # anchored: set 1's own weight, if it suits the others in its group
                    gw = indep[0]
                    if any(not (fits[j]['allowed'][0] - 1e-9 <= gw <= fits[j]['allowed'][1] + 1e-9) for j in g): gw = None
                else:
                    gw = group_weight(g, fits, step)
                if gw is None: ok = False; break
                for j in g: ws[j] = gw
            if not ok: continue
            if any(ws[j] > ws[j - 1] + 1e-9 for j in range(1, n)): continue   # later sets never heavier
            cost = sum(abs(ws[j] - indep[j]) / step for j in range(n)) + K['MATCH_PENALTY'] * (len(p) - 1)
            if best_cost is None or cost < best_cost - 1e-9: best, best_cost, best_p = ws, cost, p
    out = []
    for j, ((w, r, i), f) in enumerate(zip(sets, fits)):
        nw = best[j]; mid_i = sum(ts[j]) / 2
        pr = reps_at(f['E'], nw, mid_i)
        if nw != w or f['kind'] != 'keep':
            aim = max(lo, min(hi, round(pr)))
        else:
            pr = r
            aim = min(hi, r + 1) if (r < hi and (i is None or i > ts[j][0])) else None
        move = 'up' if nw > w + 1e-9 else ('down' if nw < w - 1e-9 else 'keep')
        out.append(dict(w=nw, move=move, aim=aim, pred=pr))
    return dict(fits=fits, indep=indep, matched=best, pattern=best_p, out=out, targets=ts)
