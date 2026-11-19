# Daily Report Web App Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A Firebase web app that replaces Daily.xlsx for entering and reporting daily % PER, Lot out and monthly cost variance, filtered by date range / month / year.

**Architecture:** Single-page React app talking directly to Firestore; no custom server. Only raw inputs are stored; every average, total and percentage is computed client-side by pure functions in `src/calc/`, which carry the unit tests. Access control is enforced by Firestore security rules, tested against the emulator.

**Tech Stack:** TypeScript, React 18 + Vite, React Router, Firebase JS SDK v10 (Auth email/password, Firestore, Hosting), Vitest, @firebase/rules-unit-testing, Recharts, SheetJS (xlsx) for Excel, jsPDF + html2canvas for PDF, date-fns. Import script: Node + xlsx + firebase-admin.

**Spec:** Claude Doc "ออกแบบระบบรายงานประจำวัน (Daily Report)" https://claude.ai/artifact/HL5UqZAVzJ6bnEQrMx1Xkf (approved 2026-11-19). Source data: `Daily.xlsx` (project uploads).

## Global Constraints

- UI language Thai; keep English terms: "% PER", "Lot out", "Variance", "Standard", "Actual", "Setter", line codes.
- Years shown in A.D. (2026), dates shown DD/MM/YYYY.
- Primary device desktop; layout must still render at 400px width without horizontal page scroll.
- Roles: `admin` (everything incl. settings and users), `editor` (enter/edit all data), `viewer` (read only). All roles may read costs.
- No self sign-up; admin creates accounts.
- Every write stores `updatedBy` (uid) and `updatedAt` (server timestamp).
- Weeks: W1 = day 1–7, W2 = 8–14, W3 = 15–21, W4 = 22–end of month, used for every weekly figure.
- % PER averages ignore blank days (no 0 substitution).
- Lot out % = (patrol + fg) / sent × 100, computed from summed counts over the period; never sum or average percentages. sent = 0 → value is `null`, shown as "–".
- Variance = Standard − Actual (negative = over standard, shown red).
- Targets stored per month: `perTarget` (≥, e.g. 125) and `lotOutTarget` (≤, e.g. 0.5). Defaults when a month has none: 125 and 0.5.
- Monthly overall % PER = average of the monthly averages of lines with `includeInTotal = true`; seed = SL4, SL6, SL7, SL9, AUTO-FV, FV3, SKIN, Sensor, AUTO2.
- Out of scope: hidden sheets, per-lot detail, Standard-cost computation, notifications other than red highlighting.
- Must be deployable by 2026-12-31.

## Review Focus

1. A month where a line has no data at all → line average `null`, excluded from Setter and overall averages (not counted as 0). Test in Task 1.
2. Date range crossing months/years (e.g. 25/12/2026–05/01/2027) → each day's target is its own month's target; weekly buckets restart per month. Test in Task 1.
3. Editing a past day overwrites the same document (doc id by date+line), no duplicates. Test in Task 3.
4. Viewer tries to write via the SDK directly → rejected by rules. Test in Task 2.
5. Worker reassigned mid-month → per-person report attributes each day to whoever was recorded that day, not the line's current default. Test in Task 1.

---

## File Structure

```
src/calc/weeks.ts          week bucket of a date
src/calc/per.ts            % PER aggregations
src/calc/lotout.ts         Lot out aggregations
src/calc/cost.ts           variance
src/calc/period.ts         filter → list of dates / months
src/types.ts               shared data types
src/firebase.ts            SDK init (env config)
src/data/repo.ts           Firestore read/write functions
src/auth/AuthProvider.tsx  current user + role
src/ui/FilterBar.tsx       year / month / date-range filter
src/ui/Layout.tsx          nav by role
src/pages/Dashboard.tsx, EntryDaily.tsx, EntryCost.tsx,
          ReportPer.tsx, ReportLot.tsx, ReportCost.tsx, Settings.tsx, Login.tsx
src/export/excel.ts, src/export/pdf.ts
firestore.rules, firebase.json
scripts/import-xlsx.ts     one-off import from Daily.xlsx
tests/ mirrors src/
```

## Shared Types (`src/types.ts`, Task 1)

```ts
type Role = 'admin' | 'editor' | 'viewer';
interface AppUser { uid: string; name: string; email: string; role: Role }
interface Line { id: string; code: string; order: number; setter: string; defaultWorkerIds: string[]; includeInTotal: boolean; active: boolean }
interface Worker { id: string; name: string; active: boolean }
interface PerEntry { date: string /*YYYY-MM-DD*/; lineId: string; workerIds: string[]; per: number }
interface LotEntry { date: string; sent: number; patrol: number; fg: number }
type CostCategory = 'electric' | 'laborOT' | 'laborSub' | 'consumed';
interface CostMonth { month: string /*YYYY-MM*/; standard: Record<CostCategory, number|null>; actual: Record<CostCategory, number|null> }
interface Target { month: string; perTarget: number; lotOutTarget: number }
interface MonthlySummary { month: string; per: number|null; lotSent: number|null; lotOut: number|null } // imported history only
type Period = { kind: 'year'; year: number } | { kind: 'month'; month: string } | { kind: 'range'; from: string; to: string };
```

---

### Task 1: Project scaffold + calculation library

**Files:** Create `package.json`, `vite.config.ts`, `tsconfig.json`, `src/types.ts`, `src/calc/*.ts`, `tests/calc/*.test.ts`

**Interfaces — Produces:**
- `weekOf(date: string): 1|2|3|4`
- `datesIn(p: Period): string[]`, `monthsIn(p: Period): string[]`
- `lineAverage(entries: PerEntry[], lineId: string): number|null`
- `setterAverage(entries: PerEntry[], lines: Line[], setter: string): number|null` (avg of non-null line averages)
- `overallAverage(entries: PerEntry[], lines: Line[]): number|null` (lines with includeInTotal)
- `personAverage(entries: PerEntry[], workerId: string): number|null`
- `lotTotals(entries: LotEntry[]): { sent: number; patrol: number; fg: number; out: number; pct: number|null }`
- `lotByWeek(entries: LotEntry[], month: string): Record<1|2|3|4, ReturnType<typeof lotTotals>>`
- `variance(standard: number|null, actual: number|null): number|null`
- `targetFor(targets: Target[], month: string): Target` (defaults 125 / 0.5)

- [ ] **Step 1: Scaffold** `npm create vite@latest . -- --template react-ts`, add vitest; `npx vitest run` passes with zero tests.
- [ ] **Step 2: Write failing tests** in `tests/calc/`:
  - `weekOf('2026-11-07')===1`, `weekOf('2026-11-08')===2`, `weekOf('2026-11-21')===3`, `weekOf('2026-11-30')===4`, `weekOf('2026-12-31')===4`
  - `lineAverage` of SL2 Nov rows [153,157,144,138,144,135] → 145.1667 (±0.001); line with no rows → `null`
  - `setterAverage` for setter with lines avgs [109.5, null, 152.2] → 130.85 (matches Excel E6)
  - `overallAverage` with the 9 seeded lines using Nov values → 138.3333 (Excel F27)
  - `personAverage`: worker on SL1 days 1–3 then SL2 days 4–5 averages those 5 days only (Review Focus 5)
  - `lotTotals` Nov rows (sent 10,23,39,23,11,35,19,26,18; fg 1 on day 7 and day 11) → sent 204, out 2, pct 0.9804; all-zero sent → pct `null`
  - `lotByWeek` Nov → W1 sent 141 out 1, W2 sent 63 out 1 (corrected range 8–14)
  - `variance(26548.43, 54594.25)` → −28045.82
  - `datesIn({kind:'range',from:'2026-12-25',to:'2027-01-05'})` length 12; `monthsIn` same → ['2026-12','2027-01'] (Review Focus 2)
  - `targetFor([], '2027-01')` → {perTarget:125, lotOutTarget:0.5}
- [ ] **Step 3: Run** `npx vitest run tests/calc` → FAIL (missing modules).
- [ ] **Step 4: Implement** the functions above; pure, no Firebase imports.
- [ ] **Step 5: Run** `npx vitest run tests/calc` → PASS.
- [ ] **Step 6: Commit** `feat: scaffold and calculation library`

### Task 2: Firebase config + security rules

**Files:** Create `firebase.json`, `.firebaserc`, `firestore.rules`, `src/firebase.ts`, `.env.example`, `tests/rules/rules.test.ts`

**Interfaces — Produces:** `db`, `auth` exports from `src/firebase.ts` (config from `VITE_FIREBASE_*` env vars). Collections: `users/{uid}`, `lines/{id}`, `workers/{id}`, `perDaily/{date}_{lineId}`, `lotDaily/{date}`, `costMonthly/{YYYY-MM}`, `targets/{YYYY-MM}`, `monthlySummary/{YYYY-MM}`.

- [ ] **Step 1: Failing tests** (emulator, `@firebase/rules-unit-testing`):
  - unauthenticated read of `perDaily/x` → denied
  - viewer read `costMonthly/2026-11` → allowed; viewer write `perDaily/...` → denied (Review Focus 4)
  - editor write `perDaily/2026-11-03_sl1` with `updatedBy == auth.uid` → allowed; with another uid → denied
  - editor write `lines/x`, `targets/x`, `users/x` → denied; admin → allowed
  - user writing own `users/{uid}.role` → denied unless admin
- [ ] **Step 2: Run** `firebase emulators:exec --only firestore "npx vitest run tests/rules"` → FAIL.
- [ ] **Step 3: Write `firestore.rules`**: role read from `get(/databases/$(db)/documents/users/$(request.auth.uid)).data.role`; data collections write = editor|admin with `request.resource.data.updatedBy == request.auth.uid`; settings collections and `users` write = admin.
- [ ] **Step 4: Run** same command → PASS.
- [ ] **Step 5: Commit** `feat: firebase config and security rules`

### Task 3: Data access layer

**Files:** Create `src/data/repo.ts`, `tests/data/repo.test.ts` (emulator)

**Interfaces — Produces:**
- `listLines(): Promise<Line[]>`, `listWorkers(): Promise<Worker[]>`, `listTargets(): Promise<Target[]>`
- `getPerEntries(from: string, to: string): Promise<PerEntry[]>`, `savePerDay(date: string, rows: PerEntry[]): Promise<void>` (batch; doc id `${date}_${lineId}`; rows with `per` null delete the doc)
- `getLotEntries(from, to): Promise<LotEntry[]>`, `saveLotDay(e: LotEntry): Promise<void>`
- `getCostMonths(fromMonth, toMonth): Promise<CostMonth[]>`, `saveCostMonth(c: CostMonth)`
- `getMonthlySummaries(fromMonth, toMonth): Promise<MonthlySummary[]>`
- `saveLine`, `saveWorker`, `saveTarget`, `saveUserRole(uid, role)`
- All writes add `updatedBy`, `updatedAt: serverTimestamp()`.

- [ ] **Step 1: Failing tests:** `savePerDay` twice for same date → `getPerEntries` returns one row per line with the second value (Review Focus 3); clearing a value deletes it; `getPerEntries('2026-11-01','2026-11-30')` excludes 2026-12-01.
- [ ] **Step 2: Run** under emulator → FAIL. **Step 3: Implement.** **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `feat: firestore data access`

### Task 4: Auth, layout and filter bar

**Files:** Create `src/auth/AuthProvider.tsx`, `src/pages/Login.tsx`, `src/ui/Layout.tsx`, `src/ui/FilterBar.tsx`, `src/App.tsx`, tests in `tests/ui/`

**Interfaces — Produces:** `useAuth(): { user: AppUser|null; loading: boolean; signOut(): Promise<void> }`; `<RequireRole min="editor">`; `<FilterBar value: Period onChange: (p: Period) => void />`; `usePeriod()` keeps the period in the URL query (`?y=2026`, `?m=2026-11`, `?from=&to=`), default = current month.

- [ ] **Step 1: Failing tests** (Testing Library): FilterBar switching to "ช่วงวันที่" with from > to shows "วันที่เริ่มต้องไม่เกินวันที่สิ้นสุด" and does not call onChange; viewer sees no "กรอกข้อมูล" or "ตั้งค่า" nav items; editor sees "กรอกข้อมูล" but not "ตั้งค่า".
- [ ] **Step 2–4:** run → FAIL, implement, run → PASS. Login page: email + password, Thai error "อีเมลหรือรหัสผ่านไม่ถูกต้อง".
- [ ] **Step 5: Commit** `feat: login, role-based layout, filter bar`

### Task 5: Daily entry page (% PER + Lot out)

**Files:** Create `src/pages/EntryDaily.tsx`, `tests/ui/EntryDaily.test.tsx`

**Interfaces — Consumes:** `listLines`, `listWorkers`, `getPerEntries`, `savePerDay`, `getLotEntries`, `saveLotDay`.

- [ ] **Step 1: Failing tests:** for a date with no data, each line row pre-fills its `defaultWorkerIds`; existing data loads its recorded workers; entering "abc" or a negative in % shows "กรอกตัวเลข 0 ขึ้นไป" and disables บันทึก; patrol+fg > sent shows "Lot out มากกว่า Lot ส่งตรวจ"; บันทึก calls `savePerDay` and `saveLotDay` once each.
- [ ] **Step 2–4:** FAIL → implement (one table: line, Setter, worker picker (1–2 people), %; Lot section below; Tab moves down the % column; unsaved-changes warning on leaving) → PASS.
- [ ] **Step 5: Commit** `feat: daily entry page`

### Task 6: Monthly cost entry page

**Files:** Create `src/pages/EntryCost.tsx`, test.
- [ ] **Step 1: Failing test:** month picker loads existing values; Variance column updates live using `variance()`; save calls `saveCostMonth` with all 4 categories.
- [ ] **Step 2–5:** FAIL → implement → PASS → commit `feat: monthly cost entry`

### Task 7: Report pages

**Files:** Create `src/pages/ReportPer.tsx`, `ReportLot.tsx`, `ReportCost.tsx`, tests.

**Interfaces — Consumes:** calc functions from Task 1, repo getters, `usePeriod`.

- [ ] **Step 1: Failing tests:**
  - ReportPer month view renders a line × day grid like the Excel sheet, line avg, Setter avg, overall avg; tabs "รายไลน์ / ราย Setter / รายคน"; values below that month's target get class `below-target`.
  - Year view: one column per month; months before system start read `monthlySummary`.
  - ReportLot month view: daily row, W1–W4 and month total from `lotByWeek`/`lotTotals`; pct `null` renders "–"; year view compares with previous year's total.
  - ReportCost: Standard/Actual/Variance per month per category; negative variance red.
- [ ] **Step 2–5:** FAIL → implement → PASS → commit `feat: report pages`

### Task 8: Dashboard

**Files:** Create `src/pages/Dashboard.tsx`, test.
- [ ] **Step 1: Failing test:** with fixture data for Nov 2026 shows cards "% PER 138.3 (เป้า ≥125)", "Lot out 0.98% (เป้า ≤0.50)" marked not met, and 4 Variance figures; renders monthly % PER vs target chart and Lot out chart for the selected year.
- [ ] **Step 2–5:** FAIL → implement with Recharts → PASS → commit `feat: dashboard`

### Task 9: Settings (admin)

**Files:** Create `src/pages/Settings.tsx`, test.
- [ ] **Step 1: Failing tests:** admin can add/reorder/deactivate lines, set Setter and default workers, toggle "นับเข้าค่ารวม"; edit targets for any month; list users and change role; deactivated line disappears from entry page but its history stays in reports.
- [ ] **Step 2–5:** FAIL → implement → PASS → commit `feat: settings page`
- Creating login accounts: admin adds users in Firebase Console (Auth) then sets role here; document this in README.

### Task 10: Export Excel and PDF

**Files:** Create `src/export/excel.ts`, `src/export/pdf.ts`, tests.

**Interfaces — Produces:** `exportExcel(sheets: { name: string; rows: (string|number|null)[][] }[], filename: string): void`; `exportPdf(el: HTMLElement, filename: string): Promise<void>`.
- [ ] **Step 1: Failing test:** `exportExcel` workbook (via SheetJS write to array) has the sheet names and header row given; Thai text round-trips. Filenames: `PER_2026-11.xlsx`, `LotOut_2026.xlsx`, `Dashboard_2026-11.pdf`.
- [ ] **Step 2–4:** FAIL → implement → PASS; add buttons to FilterBar area on each report and Dashboard. PDF uses html2canvas of the page so Thai fonts render.
- [ ] **Step 5: Commit** `feat: excel and pdf export`

### Task 11: Import from Daily.xlsx

**Files:** Create `scripts/import-xlsx.ts`, `tests/scripts/import.test.ts`

**Interfaces — Produces:** `parseWorkbook(buf: Buffer): { lines: Line[]; workers: Worker[]; per: PerEntry[]; lot: LotEntry[]; cost: CostMonth[]; targets: Target[]; summaries: MonthlySummary[] }`; CLI `npx tsx scripts/import-xlsx.ts Daily.xlsx --project <id>` (firebase-admin, emulator via `FIRESTORE_EMULATOR_HOST`).
- [ ] **Step 1: Failing tests** on the real file: 24 lines with codes SL1…Laser2 and their Setters (sheet "% Per (Nov_26)."); rows with name "0" produce no worker; cell "นายสุชาติ อ.,น.ส.พนิดา พ." → 2 workers; Nov per entries day 1–6 only; lot entries 9 days, sent total 204; targets Jan–Dec 2026 from "% Per (Month)_" row 30 and 0.5 Lot out; cost Jan–Oct for 4 categories from sheets Electric/Labor-OT/Labor-Sub./Consumed. rows 25–26; summaries Jan–Oct per (128,124,…,134) and lot sent/out from "Lot out (Month)_26"; plus 2024/2025 yearly averages stored as `monthlySummary/2024`, `/2025`.
- [ ] **Step 2–4:** FAIL → implement → PASS.
- [ ] **Step 5: Verify** import into emulator, open ReportPer year 2026 → Nov overall 138.3; ReportLot year → total sent 6086, out 30.
- [ ] **Step 6: Commit** `feat: xlsx import script`

### Task 12: Deploy

- [ ] **Step 1:** `npm run build` passes; `npx vitest run` all green.
- [ ] **Step 2:** `firebase deploy --only firestore:rules,hosting` to the user's project; run import against production once.
- [ ] **Step 3:** Create first admin (user's account) by setting `users/{uid}.role = 'admin'` in console; smoke test login, entry, report, export.
- [ ] **Step 4:** README in Thai: how to add users, enter data, export. Commit `docs: setup and usage guide`.
