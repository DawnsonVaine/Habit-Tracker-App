# Habit Tracker

A local-only iPhone habit tracker built with Expo. The owner (Dawnson) works on Windows, on two machines (PC and laptop), with no Mac and no paid Apple Developer account. Every change is tested on a physical iPhone through Expo Go.

## Working together

- **Workflow:** Claude implements → verifies (below) → Dawnson tests on the phone → Dawnson explicitly asks to "push and commit". Don't commit or push before that.
- **Two machines:** remind Dawnson to `git pull` at the start of a session if the branch might be behind; everything is pushed at the end of each session.
- **Verify every change with:**
  - `npx tsc --noEmit`
  - `npm test` (Vitest, ~90 tests, runs in about a second)
  - `npx expo export --platform ios`, then delete the generated `dist` folder
- Keep files with **LF** line endings. On Windows, don't write files with Python's `write_text` (it produces CRLF).

## Stack

Expo SDK 57, React Native 0.86, React 19.2, Expo Router (file-based, `app/`), TypeScript, Zustand `persist` with AsyncStorage, Reanimated 4, react-native-gesture-handler, react-native-reorderable-list (drag-to-reorder), expo-notifications (local reminders only), expo-file-system's new `File`/`Paths` API (backup/restore), expo-symbols (SF Symbols tab icons), Vitest.

## Layout

- `app/` — screens. `(tabs)/` holds Today (`index.tsx`), Stats and Settings; plus `habit/[id]`, `habit/new` (modal, also used for editing), `archive`, `categories`, `category-edit`.
- `store/habitStore.ts` — the single Zustand store: habits, completions, skips (rest days), challenges, categories, sortMode, lastSeenLevel.
- `utils/` — pure logic, all covered by tests: `streaks`, `goals`, `skips`, `progression` (XP and ranks), `challenges`, `categories`, `schedule`, `notifications`, `backup`, `dates`.
- `components/` — HabitCard, LevelCard, LevelStrip, ChallengeCard, CelebrationOverlay, MonthGrid, ValueChart, Heatmap, NotDueSection.
- `hooks/useTheme.ts` — the design system.
- `tests/` — the time zone is pinned to `Pacific/Auckland` and "today" is frozen to Sat 3 Oct 2026 (`tests/helpers.ts`).

## Rules that prevent real bugs

- **Never `setState` before the store has hydrated.** `persist` writes to disk on every setState, so an early write saves the empty initial state over the user's data. That was a real data-loss bug, and a test now guards it.
- **Prefer derived state.** XP, levels and challenge status are computed from history rather than stored. Store only what can't be derived.
- **Schema changes need a migration.** Bump the persist `version` in `habitStore.ts` and extend `migrate` (keep `migrateHabit` idempotent and spread `...old` so other fields carry over). If the change affects saved data, bump the backup format version in `utils/backup.ts` too and upgrade older backups on import.
- **Notifications are tagged with `data: { habitId }`.** Cancel by tag, and keep `syncReminders` (on launch) and `resetAllReminders` (on restore) working. Untagged or orphaned reminders once kept firing after being turned off.
- **Dates:** count days between dates with `Math.round`, not `Math.floor`, so daylight-saving changes don't cause off-by-one errors.
- **Progress fills:** percentage widths on absolutely positioned children resolve against the parent's content box. Use the width measured in `onLayout` instead.
- **Nested lists** inside a ScrollView need `scrollEnabled={false}`, or React Native warns about VirtualizedList nesting.
- The rank floor is Leafling 1. A user can lose XP for missed days but can never drop below the lowest rank.

## Design system ("clean and calm")

Dawnson chose this direction over "bold and gamified" and "warm and organic". Don't re-propose a restyle.

- Use the `space`, `radius` and `font` scales and the theme `colors` from `hooks/useTheme.ts`, never one-off values. Use the shared `card` surface: a soft shadow in light mode, a hairline border in dark.
- House style: no card borders, sentence-case labels (no all caps), emoji on soft tiles in the habit's colour, soft-tinted buttons rather than outlines.
- **Never put `overflow: 'hidden'` on a shadowed card.** On iOS it clips the shadow.
- Motion uses Reanimated: press squash, fill bursts on completion, steppers that fill up, bars that sweep in on charts.

## Constraints

- **Expo Go only.** The project's SDK must match whatever Expo Go on the phone has updated to. An older Expo Go can't be installed on a physical iPhone, so when Expo Go moves to a new SDK, upgrading the project is the only option. Since SDK 57, `npx expo login` and the Expo Go app must both be signed in to the same Expo account (`npx expo whoami` to check).
- **npm `ERESOLVE`:** `react-dom` must stay pinned to the same version as `react`. It's an optional web peer the app never uses, and left unpinned it resolves to a version that conflicts. If ERESOLVE comes back, check that pin first, then delete `node_modules` and `package-lock.json` and reinstall. Don't use `--force` or `--legacy-peer-deps`. Ignore Expo's advice to install `expo@latest`, which would jump a major SDK. Note that `expo install --fix` writes `package.json` before installing, so check `git diff package.json` after a failed run.
- **Local-only.** The app has no backend and no accounts. Dawnson decided against a hosted backend (Floot) for now. Don't pitch one unless they ask for sync, leaderboards or community features.

## Inspiration apps

Lock In (*Lock In Daily*), DAWG (*DAWG – Discipline & Motivation*) and Grit (*Grit: Daily Habit Tracker*). All three gamify with XP and ranks and sell commitment rather than tracking. Leaderboards, community, Apple Health, widgets and app blocking are out of reach under the constraints above. XP and ranks, challenges, categories, count and duration goals, and rest days are already built.

## Getting a standalone app (researched, not done)

- **Paid route (preferred):** the Apple Developer Program at US$99 a year, enrolled through the Apple Developer app on iPhone, then EAS Build (Expo's cloud Macs) and TestFlight or ad hoc install. No code changes needed. On hold until Dawnson can afford it.
- **Free route:** a GitHub Actions macOS runner (free because the repo is public) builds an unsigned `.ipa`, and Sideloadly signs it with a free Apple ID. Builds expire every 7 days. The blocker is that expo-notifications' config plugin always adds the `aps-environment` push entitlement, which a free account can't sign, so it would have to be stripped after `expo prebuild`.

## Ideas for later

- Calorie counter (Dawnson's idea)
- Stats by category
- Daily notes or journaling
- Silencing reminders on rest days (trade-off: reminders would only be rescheduled when the app is opened)
