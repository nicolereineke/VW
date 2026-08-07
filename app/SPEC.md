# Punch Buggy — Technical Specification v1.0

Status: living document. This is the source of truth for implementation. Every feature is built
against a section of this spec, and every section stays in sync with what's actually shipped —
if the two disagree, this document is wrong and gets fixed, not silently ignored.

Source material: the game rules come from *Punch Buggy: The (Previously) Unwritten Rules of the
World's Most (Violent) Fun Family Game* by Nicole Reineke. The interactive prototype at repo root
(`/index.html`) is the validated reference for exact screen behavior — where this spec and the
prototype ever disagree on a UI detail, the prototype wins unless this doc explicitly overrides it
with a reason.

---

## 1. Product summary

A rivalry and personal-collection game built around real VW Beetle spotting. Two modes run
simultaneously from the same action, never as separate app states:

- **Rivalry mode** — two households compete under a shared ruleset, racing to a target score
  (default 21) in timed rounds.
- **Collector mode** — every player, regardless of rivalry status, builds a personal Bug-Dex
  (every color × body style combination they've called), a lifetime point total, a day streak, and
  an optional spot on a global weekly/annual leaderboard.

A user with no rivalry sees a solo home screen, not an empty scoreboard. A user in a rivalry sees
both the scoreboard and their personal stats — the two never gate each other.

---

## 2. Data model

### 2.1 Entities

**User**
| Field | Type | Notes |
|---|---|---|
| id | string (uuid) | |
| displayName | string | Set during onboarding |
| authMethod | `'email' \| 'phone'` | |
| authIdentifier | string | Email address or E.164 phone number |
| createdAt | timestamp | |
| lifetimePoints | number | Every call this user logs, any team, any mode |
| currentStreak | number | Consecutive calendar days with ≥1 call logged by this user |
| longestStreak | number | High-water mark |
| lastStreakDate | date (nullable) | Last calendar date the streak was extended; drives real day-based streak logic (the prototype's session-based approximation is replaced here — see §4.4) |
| bugDex | `Set<string>` | Keys of form `"{color}\|{bodyStyle}"` |
| globalWeeklyPoints | number | Photo-verified calls only, resets weekly |
| globalAnnualPoints | number | Photo-verified calls only, resets yearly |
| activeRivalryId | string (nullable, FK → Rivalry) | |
| activeTeamId | string (nullable, FK → Team) | |

**Team**
| Field | Type | Notes |
|---|---|---|
| id | string | |
| rivalryId | string (FK) | |
| label | string | e.g. "Team Reineke" |
| colorRole | `'primary' \| 'secondary'` | Maps to the two rivalry accent colors |
| inviteCode | string, unique | Format `BUG-XXXX`; joining adds a member to this existing team |
| createdAt | timestamp | |

**TeamMembership**
| Field | Type | Notes |
|---|---|---|
| userId | string (FK) | |
| teamId | string (FK) | |
| points | number | This team's tally for this member, resets when a round is won (see §4.2) |
| joinedAt | timestamp | |

**Rivalry**
| Field | Type | Notes |
|---|---|---|
| id | string | |
| inviteCode | string, unique | Format `RIVAL-XXXX`; joining creates the second team |
| roundTarget | number | Default 21 |
| rulesConvertibleMultiplier | boolean | Default true (2×) |
| rulesThingMultiplier | boolean | Default true (10×) |
| rulesInteriorMode | boolean | Default false |
| rulesBusEligible | boolean | Always false, not user-editable — "buses just don't count" |
| status | `'pending' \| 'active'` | `pending` until a second team joins |
| createdAt | timestamp | |

**Round**
| Field | Type | Notes |
|---|---|---|
| id | string | |
| rivalryId | string (FK) | |
| teamScores | `Record<teamId, number>` | |
| target | number | Copied from rivalry at round start, immune to mid-round rule changes |
| winnerTeamId | string (nullable) | |
| startedAt / endedAt | timestamp | |

**Trip**
| Field | Type | Notes |
|---|---|---|
| id | string | |
| userId | string (FK) | |
| teamId | string (FK, nullable for solo) | |
| startedAt / endedAt | timestamp (endedAt nullable while active) | |

**Call**
| Field | Type | Notes |
|---|---|---|
| id | string | |
| tripId | string (FK) | |
| roundId | string (FK, nullable for solo) | |
| userId | string (FK) | Who logged it |
| teamId | string (FK, nullable) | |
| colors | string[] | Official factory color names, §4.1 |
| bodyStyle | `'Beetle' \| 'Convertible' \| 'New Beetle' \| 'Thing'` | Bus is never a valid value here |
| interiorColors | string[] | Only used when `rulesInteriorMode` is on |
| points | number | Computed at log time, immutable after |
| photoUrl | string (nullable) | |
| disputed | boolean | |
| createdAt | timestamp | |

**Ruling**
| Field | Type | Notes |
|---|---|---|
| id | string | |
| rivalryId | string (FK) | |
| question | string | |
| sourceCallId | string (nullable FK) | Set when raised via a call dispute |
| votes | `Record<teamId, 'yes' \| 'no' \| null>` | |
| resolvedVerdict | string (nullable) | |
| resolvedAt | timestamp (nullable) | |
| createdAt | timestamp | |

### 2.2 Firestore collection mapping

Firestore is a document store, not relational — the entities above map to top-level collections
with denormalized reads where it saves round trips:

```
/users/{userId}
/rivalries/{rivalryId}
/rivalries/{rivalryId}/teams/{teamId}
/rivalries/{rivalryId}/teams/{teamId}/members/{userId}   (TeamMembership)
/rivalries/{rivalryId}/rounds/{roundId}
/rivalries/{rivalryId}/rulings/{rulingId}
/trips/{tripId}
/trips/{tripId}/calls/{callId}
/leaderboard/{period}_{periodKey}/entries/{userId}        (materialized, see §5.4)
```

---

## 3. Screens

Each screen below is the functional spec; exact visual treatment (colors, type, spacing) is defined
by the design tokens in §6 and validated against the prototype.

### 3.1 Onboarding
Four steps, timed from the first tap. See §4.5 for the full behavioral spec — this is the one
screen where speed is an explicit, testable acceptance criterion (< 60s nothing-to-playing).

1. **Welcome** — wordmark, one-line pitch, single CTA. Timer starts on tap.
2. **Register** — name + email-or-phone (single screen, not two), optional collapsed invite-code
   field.
3. **Verify** — 6-digit OTP, auto-submits at 6 digits, no separate button.
4. **Done** — confirmation + elapsed time, single CTA that lands the user directly in an
   already-started Trip.

### 3.2 Score / My Collection
Branches on whether the user has an active rivalry (`user.activeRivalryId != null`):

- **Has a rivalry:** head-to-head score, round progress bars toward the target, weekly activity
  chart, per-member "Top Spotters" for both teams, Big Moments feed (dispute-able, §3.7), and the
  always-present "Your Collection" section (Bug-Dex + Global Leaderboard entry points).
- **No rivalry:** a solo card (lifetime points, streak) and a single "Start a Rivalry" CTA, directly
  above the same "Your Collection" section. No scoreboard is rendered.

### 3.3 Trip
Start/End trip. While active: streak chip, team switcher (rivalry mode only), the primary "Punch
Buggy" action opening the Log a Call sheet, and a running list of this trip's calls.

### 3.4 Log a Call (sheet)
Color chips (multi-select, official factory colors only, §4.1), body style (single-select,
Beetle/Convertible/New Beetle/Thing — Bus disabled), optional interior chips (rivalry's Interior
Mode only), optional photo attach (never required). Submitting computes points per §4.2, updates
the round/rivalry score, the user's Bug-Dex and lifetime points, and — if photographed — the global
leaderboard.

### 3.5 Team
Roster for the user's active team, per-member points, "Invite a member" (adds to this team via
`BUG-` code).

### 3.6 History
Past trips and past completed rounds (a round's result is permanent once a team crosses the
target).

### 3.7 Rules
Round target stepper, the three toggleable multiplier/mode rules, Open Rulings (both house-rule
questions and call disputes, resolved by both teams voting — see §4.3), Ruling Log, and "Invite a
team to this rivalry" (`RIVAL-` code, only shown once a rivalry exists).

---

## 4. Core business rules

### 4.1 Official colors
Fourteen official 1973 VW factory paint names are the only valid exterior colors: Texas Yellow,
Kasan Red, Marina Blue, Pastel White, Kansas Beige, Bright Orange, Biscay Blue, Sumatra Green,
Phoenix Red, Ravenna Green, Amber, Bahia Red, Saturn Yellow, Olympic Blue. A call must name every
color visible on the car (multi-select).

### 4.2 Scoring
```
basePoints =
  bodyStyle === 'Convertible' ? (rivalry.rulesConvertibleMultiplier ? 2 : 1) :
  bodyStyle === 'Thing'       ? (rivalry.rulesThingMultiplier ? 10 : 1) :
  1
```
Bus is never a loggable body style — "buses just don't count" is not a toggle.

### 4.3 Rulings and disputes
A ruling — whether raised as a free-form house-rule question or as a dispute against a specific
call — is resolved identically: each team casts exactly one vote (yes/no).
- Both `yes` → verdict stands, call/rule confirmed.
- Both `no` → verdict does not stand.
- Split → **no forced verdict.** Resolves as "no consensus — each team's own call stands," directly
  reflecting the source rules' own "House Rules Override Other Rules" principle. This is a resolved
  state, not a stuck one — it still leaves Open Rulings and enters the Ruling Log.

### 4.4 Streaks
A streak extends **at most once per calendar day**, the first time a user logs a call that day
(compare `lastStreakDate` to the device's local date at call time, not to app-session state — this
corrects the prototype's session-based approximation, which reset on page reload). If a full
calendar day passes with zero calls logged, the streak resets to 0 the next time the user opens the
app (evaluated client-side against `lastStreakDate`, no server cron needed for v1).

### 4.5 Onboarding speed
Acceptance criterion: a user with no prior account reaches a playable state (an active trip, ready
to log a call) in under 60 seconds of interaction time, excluding OTP delivery latency. This is
enforced by design (3 screens, single-field-per-concept, auto-advancing OTP, no permission prompts
inside the flow — see §4.6) and verified by an automated timer in the e2e test suite (§8), not just
asserted in copy.

### 4.6 Permission timing
Camera and push-notification permission requests never occur during onboarding. They fire the first
time the corresponding feature is actually used — the first tap on "Attach a photo," and after the
user's first logged call for notifications — each preceded by an in-app priming screen explaining
the specific reason before the OS prompt appears.

### 4.7 Invite redemption
- A `BUG-` code adds the redeeming user as a new member of an existing team.
- A `RIVAL-` code creates (or joins, if pending) the second team in a rivalry, with the redeeming
  user as its first member. The rivalry transitions `pending → active` once both teams have ≥1
  member.
- No code entered → the user starts solo (`activeRivalryId = null`), with Collector mode as their
  home screen per §3.2.

### 4.8 Round resolution
The moment any team's score crosses `round.target`, the round ends immediately (checked after every
call submission, not on a polling interval). All `TeamMembership.points` for both teams reset to 0
for the next round. Bug-Dex, lifetime points, streak, and global leaderboard standing are
**never** affected by a round ending — they are permanent, per-user records that outlive any single
round.

---

## 5. Backend service contract

Defined as a TypeScript interface (`src/services/backend.ts`) with two implementations: a local
in-memory adapter (used for all development and the full automated test suite) and a Firebase
adapter (wired in once a real project exists — see the handoff doc). No screen or business-logic
code ever imports Firebase directly; everything goes through this interface.

```ts
interface BackendService {
  // auth
  requestOtp(identifier: string, method: 'email' | 'phone'): Promise<void>;
  verifyOtp(identifier: string, code: string): Promise<User>;
  deleteAccount(userId: string): Promise<void>;

  // rivalry / team
  createRivalry(userId: string, teamLabel: string): Promise<Rivalry>;
  redeemInviteCode(userId: string, code: string, name: string): Promise<{ rivalry: Rivalry; team: Team }>;

  // trips & calls
  startTrip(userId: string, teamId: string | null): Promise<Trip>;
  endTrip(tripId: string): Promise<void>;
  logCall(input: LogCallInput): Promise<Call>;

  // rulings
  proposeRuling(rivalryId: string, question: string, sourceCallId?: string): Promise<Ruling>;
  castVote(rulingId: string, teamId: string, vote: 'yes' | 'no'): Promise<Ruling>;

  // leaderboard (reads only; writes happen via logCall + a materializing Cloud Function)
  getLeaderboard(period: 'weekly' | 'annual'): Promise<LeaderboardEntry[]>;

  // realtime subscriptions
  subscribeToRivalry(rivalryId: string, cb: (r: Rivalry) => void): Unsubscribe;
  subscribeToRound(roundId: string, cb: (r: Round) => void): Unsubscribe;
}
```

---

## 5.1 Implementation stack (revised)

Originally specced as Vite + React. Revised after confirming this build environment has no npm
registry access (outbound network policy explicitly denies it) — nothing installable from npm is
usable here. Actual stack, using only what's available with zero install step:

- **Language:** TypeScript, compiled with the system `tsc` to native ES2022 modules (no bundler;
  the browser loads modules directly, and Capacitor consumes plain static output either way).
- **UI:** vanilla DOM, structured as small typed render functions per screen/component — no
  framework dependency to fight the sandbox for.
- **Unit tests:** Node's built-in test runner (`node --test`), zero install required.
- **E2E tests:** Playwright, pre-installed in this environment.
- **Serving:** the globally available `http-server` / `serve` for local runs.

If a future session has npm access (e.g. running locally on a real machine), migrating this to
Vite + React is a mechanical follow-up, not a rewrite — the logic layer (§4, §5) has zero UI
dependencies either way.

## 6. Design tokens

Colors, type scale, and the Beetle icon system are not re-derived here — they're pulled directly
from `/index.html`'s `:root` custom properties and the `beetleIcon()` helper, extracted verbatim
into `src/theme/` during scaffolding (§ implementation task 2) rather than redesigned.

---

## 7. V1 scope

**In scope:**
Everything in §3. Real auth (email/phone OTP), real photo upload, real push notifications for big
moments and round results, real multi-device sync within a rivalry.

**Explicitly out of scope for v1** (tracked as the post-launch backlog from the journey audit):
- Offline call queueing (calls require connectivity to submit in v1; a clear inline error explains
  why rather than failing silently — full offline-first sync is a v2 investment)
- Account settings screen beyond delete-account
- Per-rivalry notification granularity (all-or-nothing push in v1)
- Multiple simultaneous rivalries per user
- Empty states for History/Team beyond "no trips yet" / "no members yet" text

---

## 8. Acceptance criteria & test coverage

| Area | Verified by |
|---|---|
| Scoring math (§4.2) | Unit tests, `src/logic/scoring.test.ts` |
| Ruling resolution incl. split-decision (§4.3) | Unit tests, `src/logic/rulings.test.ts` |
| Streak day-boundary logic (§4.4) | Unit tests with mocked clock, `src/logic/streak.test.ts` |
| Bug-Dex new-find detection | Unit tests, `src/logic/bugdex.test.ts` |
| Invite code redemption (§4.7) | Unit tests, `src/logic/invite.test.ts` |
| Round resolution + reset (§4.8) | Unit tests, `src/logic/round.test.ts` |
| Onboarding under 60s (§4.5) | Playwright e2e with a real timer assertion |
| Core loop: onboard → log a call → see score update | Playwright e2e |
| Round win and loss screens both render correctly | Playwright e2e |
