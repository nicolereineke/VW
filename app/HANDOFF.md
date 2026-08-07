# Handoff — what's left, and exactly how to do it

This is the tactical companion to `SPEC.md` (what's built and how it works) and the build-plan
artifact from earlier in this project (store requirements, legal, costs, timeline). This doc is
just the ordered checklist of what to actually run, and why each step needs a human — specifically
because this sandbox has no npm registry access and isn't a Mac, not because of anything unclear
about how to do it.

## What's already real, right now

- Full spec (`SPEC.md`) and a working app: 6 screens, a real (in-memory) backend, 54 automated
  tests passing (47 unit + 7 e2e against an actual Chromium browser).
- Run it yourself: `npm run bootstrap && npm run build && npm run serve`, then open the printed
  URL. Run the tests: `npm test` and `npm run e2e`.
- Everything talks through one interface, `BackendService` (`src/services/backend.ts`). The steps
  below replace what's *behind* that interface — no screen code changes.

## Step 1 — Get onto a machine with real npm access

This sandbox's outbound network policy explicitly blocks `registry.npmjs.org` (confirmed via a
direct deny header, not a fluke). Every step from here needs a normal machine — your laptop is
fine. Clone the repo, `cd app`, and run `npm install` for anything below instead of the
`node_modules/@types/node` and `node_modules/playwright` symlink tricks in `package.json`'s
`bootstrap` script — those exist purely to work around this sandbox and aren't needed once real
npm access exists.

## Step 2 — Create the Firebase project

1. [console.firebase.google.com](https://console.firebase.google.com) → new project.
2. Enable **Authentication** → Email link and Phone sign-in providers (matches the onboarding flow
   already built — SPEC.md §3.1).
3. Enable **Firestore**, **Storage**, and **Cloud Messaging**.
4. Grab the web app config object (the one with `apiKey`, `projectId`, etc.) from Project Settings.

## Step 3 — Write the Firebase adapter

Create `src/services/firebaseBackend.ts` implementing `BackendService` — the same interface
`LocalBackend` already implements (`src/services/localBackend.ts` is the reference for exactly
what each method needs to do; the business logic it calls into, `src/logic/*`, doesn't change at
all). Swap one import in `src/main.ts`. Every screen, every test in `src/logic/`, and the ruling/
round/streak behavior are already correct and already tested — this step is wiring, not redesign.

Firestore collection shape is already specced in `SPEC.md` §2.2.

## Step 4 — Native projects (Capacitor)

`capacitor.config.ts` is already written and correct — it just can't be validated in this sandbox
since `@capacitor/cli` isn't installable here.

```
npm install @capacitor/core @capacitor/cli @capacitor/ios @capacitor/android
npx cap add ios       # requires an actual Mac with Xcode — no way around this one
npx cap add android   # requires Android Studio, or just the command-line SDK tools
npm run build && npx cap sync   # repeat after every change, before testing on device
```

## Step 5 — Developer accounts

- Apple Developer Program — [developer.apple.com](https://developer.apple.com) — $99/yr, identity
  verification can take a few days, start this early.
- Google Play Developer — [play.google.com/console](https://play.google.com/console) — $25 once.

## Step 6 — Store readiness checklist

Full detail (costs, legal, the Kids Category decision and why to opt out of it, Privacy Nutrition
Label / Data Safety form specifics) is in the build-plan artifact from earlier in this project. The
two items with real teeth, restated here so they don't get lost:

- **Account deletion is mandatory** if the app supports account creation (it does) — build it
  in-app, don't discover this at review time.
- **Do not enroll in Apple's Kids Category or Google Play's Families program** — this is a
  mixed-age family app, not kids-only, and those programs bring much stricter SDK/ad rules than
  needed. Use the COPPA-safe defaults instead: parental gating on purchases, no targeted ads.

## Step 7 — Beta test with real families

TestFlight (iOS) and a Closed Testing track (Play Console). Watch hardest for the one thing this
build has never had to face: logging a call with spotty signal in a moving car. Offline queueing is
explicitly out of v1 scope (`SPEC.md` §7) — confirm in beta whether that's actually tolerable before
investing in it.

## Step 8 — Submit

Budget at least one rejection round — normal, not a sign something's wrong.

## How to tell if a step broke something

`npm test` (47 unit tests) and `npm run e2e` (7 browser tests) should both stay green through every
step above. If either goes red after wiring in Firebase or Capacitor, that's the signal to stop and
fix before continuing — the whole point of building this on tests first was so that regressions
show up immediately instead of at submission time.
