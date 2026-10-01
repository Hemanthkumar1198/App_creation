# Paisa Ledger: Implementation Guide

> Complete technical and setup documentation for the Paisa Ledger personal finance & loan management app.
> Live site: **https://hemanthkumar1198.github.io/App_creation/**
> Repository: **https://github.com/Hemanthkumar1198/App_creation**

---

## Table of contents

1. [What the app does](#1-what-the-app-does)
2. [Who can see your data (privacy)](#2-who-can-see-your-data-privacy)
3. [Technology stack](#3-technology-stack)
4. [Architecture overview](#4-architecture-overview)
5. [Project structure](#5-project-structure)
6. [Data model](#6-data-model)
7. [Authentication (login)](#7-authentication-login)
8. [Data storage & sync](#8-data-storage--sync)
9. [Security](#9-security)
10. [Financial calculations](#10-financial-calculations)
11. [Loans module (kept separate from expenses)](#11-loans-module-kept-separate-from-expenses)
12. [Pages & features](#12-pages--features)
13. [Import (Excel / CSV / PDF)](#13-import-excel--csv--pdf)
14. [Export & backup](#14-export--backup)
15. [Validation rules](#15-validation-rules)
16. [Stability & the blank-screen fix](#16-stability--the-blank-screen-fix)
17. [Deployment (GitHub Pages)](#17-deployment-github-pages)
18. [Step-by-step: enable login with Firebase](#18-step-by-step-enable-login-with-firebase)
19. [Testing](#19-testing)
20. [Local development](#20-local-development)
21. [Troubleshooting](#21-troubleshooting)
22. [Known limitations](#22-known-limitations)
23. [Everyday user guide](#23-everyday-user-guide)

---

## 1. What the app does

Paisa Ledger is a mobile-first web app (installable on a phone like an app) for tracking money in **Indian Rupees (₹)**:

| Area | Purpose |
|---|---|
| **Personal finance** | Daily income and expenses (salary, food, petrol, bills, rent, shopping…), monthly totals, savings |
| **Loans / lending** | Money you lent to people, interest, repayments, due dates, outstanding balances, overdue tracking |
| **Reports** | Daily / weekly / monthly / yearly reports and charts |
| **Import / export** | Bring data in from Excel, CSV or PDF; export to Excel, CSV, PDF or a JSON backup |
| **Login** | Google account or mobile number + OTP; each login has its own private data |

**Loans are never mixed with daily expenses.** Money lent is not an expense, and repayments received are not income. They are tracked only in the Loans module.

---

## 2. Who can see your data (privacy)

| Party | Can see your data? |
|---|---|
| **You (signed in)** | ✅ Yes: only your own records |
| **Other users of the app** | ❌ No: blocked by database security rules (tested) |
| **Anyone not signed in** | ❌ No |
| **Claude / Anthropic** | ❌ No: Claude only wrote the code. The app never sends data to Claude or Anthropic. |
| **The developer of the code** | ❌ No: the database lives in **your own** Firebase project, under **your** Google account |
| **Google (Firebase hosting provider)** | Stores the encrypted database on your behalf, as with any Google service |

Optional copies exist **only if you choose them**:
- **Download backup (.json / Excel / PDF)**: a file saved to *your* computer when *you* click the button.
- **Firestore point-in-time recovery**: an optional Firebase setting you may turn on. It is off unless you enable it.

---

## 3. Technology stack

| Layer | Technology | Why |
|---|---|---|
| UI framework | **React 18 + TypeScript** | Reliable, typed component code |
| Build tool | **Vite 6** | Fast builds; output is static files |
| Styling | **Tailwind CSS 3** | Consistent, responsive design; light & dark themes |
| Charts | **Recharts 2** | Income vs expense, trends, cash-flow charts |
| State management | **Zustand 5** | Small, predictable global store |
| Routing | **React Router 6 (HashRouter)** | Works on static hosting; direct links and back/forward work |
| Login | **Firebase Authentication** | Google sign-in and phone OTP, with secure sessions |
| Database | **Cloud Firestore** | Per-user storage, offline cache, security rules |
| Excel import/export | **ExcelJS** (lazy-loaded) | Reads and writes real `.xlsx` workbooks |
| PDF import | **pdf.js** (lazy-loaded) | Extracts text tables from PDF statements |
| PDF export | **jsPDF + jspdf-autotable** (lazy-loaded) | Clean printable reports |
| Icons | **lucide-react** | Consistent icon set |
| Tests | **Vitest** + Playwright end-to-end scripts | Calculation, import and full-flow tests |
| Hosting | **GitHub Pages** via GitHub Actions | Free HTTPS hosting |

There is **no custom server**. The browser talks directly to Firebase over HTTPS, and Firestore security rules act as the server-side authorization layer.

---

## 4. Architecture overview

```
┌──────────────────────────── Browser (phone / laptop) ────────────────────────────┐
│                                                                                   │
│  Pages (Dashboard, Transactions, Loans, Reports, Import, Settings, Search, Login)  │
│        │  read state                        │  user actions (save / delete …)     │
│        ▼                                    ▼                                     │
│  ┌──────────────┐   validated ops    ┌──────────────────┐                         │
│  │ Zustand store│ ─────────────────▶ │ Backend (commit) │                         │
│  │  useStore    │ ◀───── snapshots ─ │  cloud | local   │                         │
│  └──────────────┘                    └────────┬─────────┘                         │
│        ▲                                      │                                   │
│        │ pure functions                       │                                   │
│  lib/finance.ts · lib/loans.ts · lib/reports.ts · lib/importers.ts · lib/export.ts │
└───────────────────────────────────────────────┼───────────────────────────────────┘
                                                │ HTTPS (TLS)
                         ┌──────────────────────┴───────────────────────┐
                         │ Firebase (your project)                      │
                         │  • Authentication (Google, Phone OTP)        │
                         │  • Firestore: users/{uid}/…  + security rules│
                         └──────────────────────────────────────────────┘
```

**Key design decisions**

1. **All financial maths is in pure functions** (`src/lib/finance.ts`, `src/lib/loans.ts`), never hard-coded in the UI, and is unit-tested.
2. **Every user action becomes a list of operations** (`Op[]`) committed **atomically** (all or nothing) by the active backend.
3. **Two interchangeable backends:**
   - **Cloud** (Firestore) when Firebase is configured: login required.
   - **Device-only** (browser storage) when Firebase is not configured: no login.
4. **IDs are generated on the device**, so retrying a failed save can never create a duplicate.

---

## 5. Project structure

```
App_creation/
├── index.html                    App shell (theme applied before first paint)
├── public/
│   ├── icon.svg                  App icon
│   ├── manifest.webmanifest      "Add to Home Screen" (PWA) settings
│   └── sw.js                     Service worker: offline support, network-first
├── src/
│   ├── main.tsx                  Entry point; registers service worker
│   ├── App.tsx                   Login gate, routes, error boundaries, sheets, notifications
│   ├── types.ts                  Data types (Transaction, Loan, Repayment, Settings…)
│   ├── index.css                 Tailwind + design tokens
│   ├── lib/
│   │   ├── finance.ts            Interest formulas & rounding (pure)
│   │   ├── loans.ts              Loan engine: accrued interest, balances, status, due dates
│   │   ├── reports.ts            Period maths, totals, category breakdowns
│   │   ├── reminders.ts          Overdue / due-soon / pending / monthly summary
│   │   ├── importers.ts          CSV/XLSX/PDF parsing, column mapping, validation, duplicates
│   │   ├── export.ts             Excel / CSV / PDF / JSON export in separate sections
│   │   ├── dates.ts              Timezone-safe date helpers
│   │   ├── format.ts             ₹ formatting (Indian digit grouping), IDs
│   │   ├── categories.ts         Categories & payment methods
│   │   ├── firebase.ts           Firebase initialisation (offline cache, emulator switch)
│   │   ├── phone.ts              Indian mobile number → +91 format
│   │   ├── lazy.ts               Lazy page loading with crash recovery
│   │   ├── useSave.ts            Save helper: saving state, success/error toasts, retry
│   │   ├── finance.test.ts       20 calculation tests
│   │   └── importers.test.ts     10 import tests
│   ├── store/
│   │   ├── useStore.ts           Data + validated actions (add/edit/delete, import, restore…)
│   │   ├── backend.ts            Op types, local (device) backend
│   │   ├── cloud.ts              Firestore backend: live listeners + atomic batches
│   │   ├── useSession.ts         Login: Google, phone OTP, linking, sign-out, migration
│   │   ├── useTheme.ts           Light/dark/system theme (per device)
│   │   └── useUI.ts              Sheets, toasts, confirmation dialogs
│   ├── components/
│   │   ├── Layout.tsx            Sidebar, bottom nav, search, bell, sync status, account
│   │   ├── ErrorBoundary.tsx     Catches errors so the app never goes blank
│   │   ├── Rows.tsx              Transaction row, loan card
│   │   ├── charts/Charts.tsx     Chart components
│   │   ├── forms/                Transaction, Loan, Repayment, Mark-paid, Reminder forms
│   │   └── ui/                   Sheet (bottom sheet / dialog), toasts, confirm, cards
│   ├── pages/                    Login, Dashboard, Transactions, Loans, LoanDetail,
│   │                             Reports, Search, Import, Settings
│   └── data/sample.ts            Optional demo data
├── firestore.rules               Database security rules (paste into Firebase)
├── firebase.json                 Rules path + emulator ports (for testing)
├── .env.example                  Template for the 6 Firebase values (local dev)
├── .github/workflows/
│   ├── ci.yml                    Runs tests + build on every push
│   └── deploy.yml                Builds with Firebase values and publishes to GitHub Pages
└── docs/IMPLEMENTATION.md        This document
```

---

## 6. Data model

### 6.1 Firestore layout (cloud mode)

```
users/{uid}                          ← one document per login
   settings: { userName, reminderDays, browserNotifications, lastPaymentMethod }
   updatedAt
users/{uid}/transactions/{id}        ← personal income & expenses
users/{uid}/loans/{id}               ← money lent (repayments stored inside the loan)
users/{uid}/activity/{id}            ← append-only change history
```

`{uid}` is the unique ID Firebase gives each login. **Data from one login is never visible to another.**

### 6.2 Transaction (personal income / expense)

| Field | Type | Notes |
|---|---|---|
| `id` | string | Generated on device (UUID) |
| `type` | `'income'` \| `'expense'` | |
| `amount` | number | > 0, rounded to 2 decimals |
| `date` | `YYYY-MM-DD` | Local calendar date (no timezone drift) |
| `category` | string | Food, Shopping, Travel, Petrol/Fuel, Bills, Rent, Entertainment, Medical, Investment, Personal, Salary, Business, Freelance, Refund, Gift, Other |
| `description` | string | ≤ 200 chars |
| `paymentMethod` | string | Cash, UPI, Bank Transfer, Debit Card, Credit Card, Cheque, Other |
| `notes` | string | ≤ 1000 chars |
| `createdAt`, `updatedAt` | ISO timestamp | |
| `deletedAt` | ISO timestamp? | Set when moved to Trash (soft delete) |

### 6.3 Loan (money lent)

| Field | Type | Notes |
|---|---|---|
| `id` | string | |
| `borrowerName` | string | Required |
| `phone` | string | Optional |
| `principal` | number | Amount lent, > 0 |
| `startDate` | `YYYY-MM-DD` | Date lent |
| `dueDate` | `YYYY-MM-DD` | Must be after `startDate` |
| `durationMonths` | number | Synced with due date |
| `interestRate` | number | % per month, % per year, or ₹ amount for fixed |
| `interestType` | `'monthly'` \| `'yearly'` \| `'fixed'` | |
| `interestMethod` | `'simple'` \| `'compound'` | |
| `compounding` | monthly \| quarterly \| half-yearly \| yearly | Used for compound interest |
| `paymentFrequency` | one-time \| monthly \| quarterly \| half-yearly \| yearly | Drives next due date & instalments |
| `interestEndDate` | `YYYY-MM-DD`? | Optional manual "Interest calculation end date" |
| `closedAt` | `YYYY-MM-DD`? | Set by "Mark as Fully Repaid" |
| `repayments` | Repayment[] | See below |
| `notes`, `createdAt`, `updatedAt`, `deletedAt?` | | |

### 6.4 Repayment (inside a loan)

| Field | Type |
|---|---|
| `id`, `amount`, `date`, `paymentMethod`, `principalPortion`, `interestPortion`, `notes`, `createdAt` | `principalPortion + interestPortion = amount` |

### 6.5 Activity entry

`{ id, at, action, entity, label }`: for example *"Received ₹5,000 from Ravi"*. Entries are append-only; the security rules forbid editing or deleting them.

---

## 7. Authentication (login)

Implemented in `src/store/useSession.ts` and `src/pages/Login.tsx`.

### 7.1 Methods

| Method | How it works |
|---|---|
| **Google** | `signInWithPopup` with account chooser; falls back to a full-page redirect if the popup is blocked (common on phones) |
| **Mobile + OTP** | User enters a 10-digit Indian number → converted to `+91XXXXXXXXXX` → invisible reCAPTCHA → SMS OTP → 6-digit code verified. "Resend OTP" has a 30-second cooldown |

### 7.2 Session

- Sessions persist until you sign out, so you don't log in on every visit. Firebase refreshes tokens automatically.
- **Sign out** (Settings → Account & security) also **erases this device's offline copy** of your data and reloads the page, so nothing stays on a shared device.

### 7.3 Linking Google + phone

Google and phone logins are separate accounts unless linked. In **Settings → Account & security → Sign-in methods** you can **Link Google** or **Link number**, so either method opens the same data.

### 7.4 First login on a device that already has data

If the browser contains data from device-only mode and your account is empty, the app asks **"Move your existing data to your account?"** Choose *Upload* or *Not now*; nothing is uploaded without your confirmation.

### 7.5 Error messages

Firebase error codes are mapped to plain messages, e.g. *"Incorrect OTP"*, *"This OTP has expired"*, *"Too many attempts"*, *"This website is not authorised for sign-in yet"*.

---

## 8. Data storage & sync

Implemented in `src/store/backend.ts`, `src/store/cloud.ts`, `src/store/useStore.ts`.

### 8.1 How a save works

```
User taps Save
  → form validation (instant, on screen)
  → store action validates again (amounts, dates, outstanding limits)
  → builds operations, e.g. [put transaction, put activity entry]
  → backend.commit(ops)
       cloud: ONE Firestore writeBatch → all-or-nothing
       local: write browser storage first, then update screen
  → success toast only after the save is confirmed
```

- **Atomic:** a change and its activity-log entry are written together or not at all. Large imports are split into batches of 450 (Firestore limit 500).
- **No duplicates:** IDs are generated before saving, so a retry overwrites the same record and never creates a second one. Save buttons also disable while saving, so rapid double-taps are ignored (tested with a triple-click).
- **Offline:** Firestore keeps a durable offline copy (IndexedDB). If you're offline, the save is stored on the device and the toast says *"saved offline, will sync when you're online"*. It syncs automatically later.
- **Live sync:** the app listens to your data in real time, so a change on your phone appears on your laptop within seconds.

### 8.2 Sync indicator (top bar)

| Badge | Meaning |
|---|---|
| ☁️ **Saved** (green) | Everything is stored in your account |
| 🔄 **Saving…** (blue) | Upload in progress |
| ⛔ **Offline** (amber) | No internet; changes are kept on this device and will sync |
| 💾 **This device only** (amber) | Firebase not configured; data is stored in this browser |

### 8.3 Protection against accidental loss

| Feature | Detail |
|---|---|
| Confirmation dialogs | Before every delete |
| **Trash** | Deleted transactions & loans go to *Settings → Trash* and can be restored |
| **Undo** | Toast with *Undo* right after deleting |
| Type-to-confirm | *Erase all data* requires typing `DELETE`; replacing data with demo data requires `DEMO` |
| Activity history | Every change logged (append-only in the cloud) |
| Daily snapshot | Device-only mode keeps one automatic snapshot per day in the browser |
| Manual backup | JSON / Excel / CSV / PDF download any time |

---

## 9. Security

### 9.1 Firestore security rules (`firestore.rules`)

These rules run **on Google's servers**, not in the browser, so they can't be bypassed by modifying the app.

- A user can read or write **only** `users/{their own uid}/…`. Everything else is denied.
- **Transactions** must have: matching `id`, type `income|expense`, amount `> 0` and `≤ 1,00,00,00,00,000`, date in `YYYY-MM-DD`, text fields within length limits.
- **Loans** must have: borrower name 1–80 chars, principal `> 0`, valid dates with **due date after start date**, rate `≥ 0`, valid interest type/method, ≤ 2000 repayments.
- **User document** may only contain `settings` and `updatedAt`.
- **Activity log** is append-only: create and read only, never update or delete.

Verified with tests: another signed-in user → **403 denied**; not signed in → **403 denied**; a record with a negative amount → **403 rejected**.

### 9.2 Other security measures

| Measure | Implementation |
|---|---|
| HTTPS | GitHub Pages and Firebase serve only over TLS |
| Passwordless | No passwords stored anywhere; Google or OTP only |
| Secrets | **No secret keys in the code.** The 6 Firebase web values are *public identifiers* by design; protection comes from the rules |
| Tokens | Managed by the Firebase SDK (short-lived ID tokens, auto refresh) |
| Input validation | In forms, in the store, and again in security rules (three layers) |
| CSV injection | Exported cells starting with `= + - @` are prefixed so Excel won't run them as formulas |
| Shared devices | Sign-out wipes the offline cache |
| reCAPTCHA | Protects OTP sending from abuse |

---

## 10. Financial calculations

All in `src/lib/finance.ts` and `src/lib/loans.ts`. Every value is rounded **half-up to 2 decimals** with a float-safe `round2()` (e.g. `1.005 → 1.01`).

### 10.1 Formulas

| Function | Formula |
|---|---|
| `simpleInterest(P, R, T)` | `P × R × T / 100` |
| `monthlyInterest(P, Rm, months)` | `P × Rm × months / 100` |
| `yearlyInterest(P, Ry, months)` | `P × Ry × (months/12) / 100` |
| `compoundInterest(P, r, n)` | `P × ((1 + r/100)^n − 1)` |
| Compound with frequency | annual rate ÷ periods per year, `n = months × periods per year / 12` |
| `outstandingPrincipal` | `max(0, principal − principal repaid)` |
| `outstandingInterest` | `max(0, interest accrued − interest repaid)` |
| `remainingBalance` | outstanding principal + outstanding interest |
| `totalRepayment` | principal + interest |
| `splitRepayment` | pays **interest first**, the rest goes to principal |

### 10.2 Elapsed time

`monthsBetween(start, end)` counts whole calendar months, then adds the remaining days as a fraction of the next month.
01 Oct 2026 → 01 Jan 2027 = **exactly 3 months**; 31 Jan → 28 Feb = **1 month**.

### 10.3 Interest accrued until today (reducing balance)

```
start ── repayment 1 ── repayment 2 ── … ── end date
  segment 1      segment 2       segment 3

simple   : interest += remaining principal × rate × segment time
compound : interest += (remaining principal + unpaid interest) × ((1+i)^n − 1)
fixed    : the agreed ₹ amount once the loan has started
```

The **end date** is the earliest of: today, the manual *Interest calculation end date*, or the date the loan was marked paid.

### 10.4 Worked examples (all covered by unit tests)

| Case | Result |
|---|---|
| ₹50,000 @ 2%/month for 6 months | Interest **₹6,000**, total due **₹56,000** |
| ₹1,00,000 @ 2%/month, repaid after 3 months (01/10/2026 → 01/01/2027) | Interest **₹6,000** |
| ₹1,00,000 @ 12%/year for 6 months | Interest **₹6,000** |
| ₹1,00,000 @ 1%/month compound for 12 months | Interest **₹12,682.50** |
| ₹50,000 @ 2%/m; repay ₹22,000 (₹2,000 interest + ₹20,000 principal) after 2 months; check 2 months later | Accrued ₹3,200; remaining ₹30,000 + ₹1,200 = **₹31,200** |
| ₹60,000 @ 18%/year; ₹10,000 repaid after 3 months | First segment interest ₹2,700; then 1.5%/m on ₹52,700 |

### 10.5 Loan status

| Status | Rule |
|---|---|
| **Fully Repaid** | Nothing outstanding (or marked as paid) |
| **Overdue** | Today is after the due date and money is outstanding |
| **Partially Paid** | At least one repayment, not overdue |
| **Active** | No repayments yet, not overdue |
| *Due soon* (flag) | Next due date within the reminder window (default 7 days) |

### 10.6 Next due date

- One-time loans: the due date.
- Monthly / quarterly / half-yearly / yearly loans: the next instalment date. If the previous instalment had no repayment, it is shown as **missed** and appears as a *Pending repayment* reminder.
- Suggested instalment = total amount due ÷ number of instalments.

---

## 11. Loans module (kept separate from expenses)

| Rule | Where enforced |
|---|---|
| Current balance = **personal income − personal expenses** only | `personalBalance()` in `lib/reports.ts` |
| Money lent is **not** counted as an expense | Loans are stored in a separate collection |
| Repayments are **not** counted as income | Stored inside the loan, never as transactions |
| Dashboard shows **Personal expenses · Money lent · Outstanding loans** side by side | `pages/Dashboard.tsx` |
| Reports have separate **Personal finance** and **Lending** sections | `pages/Reports.tsx` |
| Exports have separate sheets/sections | `lib/export.ts` |

**Example (Ravi):** lent ₹20,000 on 15-Jun-2026, due 15-Dec-2026; Ravi repays ₹5,000.
→ Repaid ₹5,000 · Remaining ₹15,000 · Status **Partially Paid**. Your daily income is unchanged.

**Loan dashboard (Loans page):** Total lent · Total repaid · Interest earned (and pending) · Outstanding · counts of Active / Overdue / Fully repaid · Upcoming due dates · filters (All, Active, Overdue, Due soon, Partially paid, Fully repaid) · search by borrower, phone or amount · sort by next due, outstanding, newest or name.

**Loan details page:** borrower, phone (tap to call), principal, rate, dates, total interest, total due, amount paid, remaining, status, *Interest accrued until today* with the formula shown, a manual end-date picker, and the repayment timeline (**Date | Amount | Principal | Interest | Balance**). Buttons: **Add Repayment · Edit Loan · Mark as Fully Repaid · Send Reminder** (WhatsApp / SMS / Call / Copy, with the amount pre-filled).

---

## 12. Pages & features

| Page | Highlights |
|---|---|
| **Login** | Continue with Google · Continue with mobile number (OTP) |
| **Dashboard** | Personal balance; big **+ Cash In / − Cash Out / Add Loan** buttons; personal vs lending cards; Income-vs-Expense and monthly expense charts; lending summary with status counts; upcoming due dates; recent transactions & repayments; spending by category; getting-started card for new accounts |
| **Transactions** | Search; filter by type, category, payment method, month, date range; sort by date or amount; grouped by month with monthly totals; tap any row to edit or delete; Import and CSV export buttons |
| **Loans** | Loan dashboard (section 11) |
| **Loan details** | Section 11 |
| **Reports** | Daily / weekly / monthly / yearly with previous/next navigation; Personal finance cards (income, expenses, net savings, investments); Lending cards (lent, repaid, interest earned, outstanding); charts (income vs expense, expense by category, loan outstanding, interest earned, monthly savings); table view; export to Excel, CSV or PDF |
| **Search** | Global search across transactions, people, loans, repayments, amounts (`4500`, `₹4,500`) and dates (`01/10/2026`, `01 Oct 2026`); filters for type, loan status, category, payment method and date range |
| **Import** | Section 13 |
| **Settings** | Account & security (sign-in methods, sign out); name & theme; export & backup; reminders (window, browser notifications); Trash; activity history; demo data; erase all data |
| **Reminders (bell)** | Overdue loans, loans due soon, missed instalments, last month's expense summary |

**Quick entry:** Cash In/Out opens a bottom sheet with the amount field focused, one-tap category tiles, Today/Yesterday chips and payment-method chips (remembers your last one). An expense takes about 3 taps.

**Design:** purple/blue accent, green for income, red for expenses, violet for loans; light, dark or system theme; bottom navigation and a floating "+" button on phones, a sidebar on desktop.

---

## 13. Import (Excel / CSV / PDF)

Implemented in `src/lib/importers.ts` and `src/pages/Import.tsx`. **Nothing is saved until you press "Import N records".**

### 13.1 Steps

1. **Upload**: `.xlsx`, `.csv` or `.pdf` (≤ 15 MB, ≤ 5,000 rows).
2. **Configure:**
   - Choose the **sheet** (Excel files with several sheets).
   - **Import as:** *Income & expenses* or *Loans (money lent)*, auto-detected.
   - **Header row:** auto-detected; change if wrong.
   - **Date format:** DD/MM/YYYY (default) or MM/DD/YYYY.
   - **Column mapping:** auto-matched, adjustable per field.
   - Amounts without a type → treat as Expenses or Income; for loans, whether rates are per month or per year.
3. **Preview:** every row shows **Ready**, **Duplicate** (skipped unless you tick it) or **Needs fixing** (with the reason). Cells are editable (date, type, amount, category, description, method; for loans: name, phone, amount, dates, rate, repaid).
4. **Confirm:** selected rows are saved in atomic batches.

### 13.2 What it understands

| Input | Handling |
|---|---|
| Bank statements | *Withdrawal/Debit* → expense, *Deposit/Credit* → income; skips *Opening/Closing balance* and *Total* lines and repeated headers |
| Amounts | `₹1,00,000.50`, `Rs. 4,500`, `(250)` negative, `-300`, `1,200.00 Cr/Dr` |
| Dates | `01/10/2026`, `25-12-26`, `2026-10-01`, `15-Dec-2026`, `1 Oct 2026`, `Oct 5, 2026`, Excel date numbers; impossible dates (31/02) are rejected |
| Type column | Income/Expense, Credit/Debit, Cr/Dr, In/Out |
| Categories | Exact name, or keywords: Swiggy/Zomato → Food, HP/BPCL → Petrol/Fuel, Uber/IRCTC → Travel, Amazon/Myntra → Shopping, Apollo → Medical, SIP/Zerodha → Investment, Salary → Salary … |
| Payment method | UPI/GPay/PhonePe → UPI, NEFT/IMPS → Bank Transfer, POS/card → Debit Card, ATM/cash → Cash |
| Loans sheet | Person, Mobile, Amount Lent, Date Lent, Due Date, Interest %, Repaid, Notes. "Repaid" becomes one repayment (interest first, never more than outstanding); a missing due date defaults to 12 months and is noted |
| Duplicates | Transactions: same date + type + amount + description; loans: same borrower + amount + date lent, checked against existing data **and** within the file |
| PDF | Text is grouped into lines by position and aligned to the header columns. **Scanned (image) PDFs can't be read**, and the app says so |
| Old `.xls` | Not supported; save as `.xlsx` or `.csv` first |

The app's own Excel export can be re-imported (sheet names such as *Income* / *Daily Expenses* set the type automatically).

---

## 14. Export & backup

Implemented in `src/lib/export.ts`.

| Format | Content |
|---|---|
| **Excel (.xlsx)** | *Summary* sheet + one sheet each: **Daily Expenses · Income · Investments · Loans (Money Lent) · Loan Repayments · Outstanding Loans**, with ₹ number formats and totals |
| **CSV** | Same sections one after another (opens in Excel / Google Sheets; UTF-8 so ₹ displays correctly) |
| **PDF** | A4 landscape report with a summary table and one coloured table per section, plus page numbers (₹ printed as "Rs." because standard PDF fonts lack the ₹ glyph) |
| **JSON backup** | Complete data, restorable via *Settings → Restore backup* |

Where: **Reports** (selected period) and **Settings → Export & backup** (everything). Loan records are **never merged** into expense sections.

---

## 15. Validation rules

| Rule | Form | Store | Database rules |
|---|:-:|:-:|:-:|
| Amount > 0 and ≤ ₹1,00,00,00,00,000 | ✅ | ✅ | ✅ |
| Valid date (`YYYY-MM-DD`, real calendar date) | ✅ | ✅ | ✅ |
| Type must be income/expense; category required | ✅ | ✅ | ✅ |
| Borrower name required | ✅ | ✅ | ✅ |
| Due date after date lent | ✅ | ✅ | ✅ |
| Interest rate ≥ 0 (≤ 100% for % rates) | ✅ | ✅ | ✅ (≥ 0) |
| **Repayment ≤ outstanding on that date** | ✅ | ✅ | n/a |
| Principal portion ≤ remaining principal | ✅ | ✅ | n/a |
| Principal + interest portions = repayment amount | ✅ | ✅ | n/a |
| Repayment date not before date lent | ✅ | ✅ | n/a |
| Principal can't be edited below what's already repaid | n/a | ✅ | n/a |
| Phone number format | ✅ | n/a | length only |
| Double-submit prevention | ✅ (button disabled) | ✅ (one save at a time) | IDs make retries idempotent |

Failed saves show a red toast with the reason and a **Retry** button; successful saves show a green confirmation.

---

## 16. Stability & the blank-screen fix

**Problem reported:** clicking a menu sometimes showed a blank page until refresh.

**Root causes addressed:**
1. **No error boundary**: any runtime error unmounted the whole app. One confirmed trigger: `new Notification()` throws on Android Chrome when reminders were enabled.
2. **Stale cached code after a deploy**: the old service worker could serve outdated files.

**Fixes:**

| Fix | File |
|---|---|
| App-wide, per-page and per-form **error boundaries** with *Try again / Dashboard* buttons; they reset automatically when you navigate | `components/ErrorBoundary.tsx`, `App.tsx` |
| Pages **lazy-loaded** with a loading spinner; if a page file is missing after a new deploy, retry once and then reload once automatically | `lib/lazy.ts` |
| Notifications go through the service worker (`showNotification`) inside `try/catch`, so they can never crash the app | `App.tsx` |
| Service worker is **network-first** (always fresh code online, cached copy only offline); never touches Firebase requests | `public/sw.js` |
| Loading screens for sign-in and first data load; a failed data listener shows a banner with **Retry** instead of hanging | `App.tsx`, `useSession.ts`, `Layout.tsx` |
| `HashRouter`: direct links (e.g. `#/loans`), refresh and back/forward work on GitHub Pages | `App.tsx` |

**Verified:** 30+ consecutive menu clicks, back/forward, and opening every route directly, on mobile and desktop, with zero console errors and no blank screens.

---

## 17. Deployment (GitHub Pages)

### 17.1 Workflows

| Workflow | Trigger | Steps |
|---|---|---|
| `ci.yml` | Every push / pull request | `npm ci` → `npm test` → `npm run build` |
| `deploy.yml` | Push to `main` or manual *Run workflow* | install → test → build (with Firebase variables) → upload → deploy to Pages |

### 17.2 One-time GitHub settings (already done)

1. *Settings → Pages → Source:* **GitHub Actions** ✅
2. *Settings → General → Default branch:* **main** ✅
3. *Settings → Environments → github-pages → Deployment branches:* **No restriction** ✅

### 17.3 Updating the live site

Any change merged or pushed to `main` publishes automatically in about 1–2 minutes. To re-publish manually: *Actions → Deploy to GitHub Pages → Run workflow → main*.

---

## 18. Step-by-step: enable login with Firebase

Until this is done, the live site runs in **device-only mode** (no login, data stays in that browser).
The Firebase project belongs to **your** Google account. Nobody else has access unless you add them.

### Step 1: Create the project
1. Open **https://console.firebase.google.com** and sign in with your Google account.
2. Click **Create a project** → name it e.g. `paisa-ledger` → Google Analytics **off** → **Create**.

### Step 2: Register the web app
1. On the project home, click the **`</>` (Web)** icon.
2. Nickname: `Paisa Ledger` → **Register app** (leave "Firebase Hosting" unticked).
3. You'll see a `firebaseConfig` block like this. **Keep this page open**:
   ```js
   const firebaseConfig = {
     apiKey: "AIza…",
     authDomain: "paisa-ledger.firebaseapp.com",
     projectId: "paisa-ledger",
     storageBucket: "paisa-ledger.appspot.com",
     messagingSenderId: "1234567890",
     appId: "1:1234567890:web:abc123"
   };
   ```
   You can find it again later in *Project settings (⚙️) → General → Your apps*.

### Step 3: Turn on sign-in methods
1. Left menu: **Build → Authentication → Get started**.
2. **Sign-in method** tab:
   - **Google** → Enable → choose your support email → **Save**.
   - **Phone** → Enable → **Save**.
     - Real SMS OTP requires the **Blaze (pay-as-you-go)** plan (*⚙️ → Usage and billing*). It includes a free monthly allowance, and you can set a budget alert.
     - On the free *Spark* plan, use Google sign-in, or add **test phone numbers** (with a fixed code) under *Phone → Phone numbers for testing*.

### Step 4: Authorise your website
**Authentication → Settings → Authorised domains → Add domain** → `hemanthkumar1198.github.io` → **Add**.

### Step 5: Create the database
1. **Build → Firestore Database → Create database**.
2. Location: **asia-south1 (Mumbai)** (can't be changed later).
3. Start in **production mode** → **Create**.

### Step 6: Add the security rules
1. Firestore → **Rules** tab.
2. Delete everything there, then paste the full contents of [`firestore.rules`](../firestore.rules) from this repository.
3. Click **Publish**.

### Step 7: Give the values to GitHub
1. Open **https://github.com/Hemanthkumar1198/App_creation/settings/variables/actions**
   (*Settings → Secrets and variables → Actions → **Variables** tab*).
2. Click **New repository variable** six times:

| Name | Value (from Step 2) |
|---|---|
| `VITE_FIREBASE_API_KEY` | `apiKey` |
| `VITE_FIREBASE_AUTH_DOMAIN` | `authDomain` |
| `VITE_FIREBASE_PROJECT_ID` | `projectId` |
| `VITE_FIREBASE_STORAGE_BUCKET` | `storageBucket` |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | `messagingSenderId` |
| `VITE_FIREBASE_APP_ID` | `appId` |

Paste the values **without quotes**. They are public identifiers (not passwords); your data is protected by the Step 6 rules.

### Step 8: Publish
**Actions → Deploy to GitHub Pages → Run workflow → main**. When it's green, open the site: you'll see the **sign-in screen**.

### Step 9: First sign-in
1. Sign in with Google or your mobile number.
2. If this browser already had data, choose **Upload** to move it into your account.
3. Optional: *Settings → Account & security* → link the other sign-in method.

### Optional extras
- **Budget alert:** Google Cloud console → *Billing → Budgets & alerts* (if on Blaze).
- **Point-in-time recovery / scheduled backups:** Firestore → *Disaster recovery*. Optional, under your control, and off by default.

---

## 19. Testing

### 19.1 Unit tests (`npm test`): 30 tests

- **`finance.test.ts` (20):** rounding, simple/compound/monthly/yearly interest, month counting, both spec examples, manual end date, reducing balance after repayment, fully paid, overdue, fixed interest, mark-paid write-off, interest-first split, missed instalment, portfolio totals.
- **`importers.test.ts` (10):** CSV parsing, Indian amounts, many date formats, header detection & column mapping for bank statements and loan sheets, debit/credit/type/sign handling, duplicate detection, loan import with repayment (Ravi example), PDF row/column reconstruction.

### 19.2 End-to-end tests (Playwright + Firebase emulators)

Run against the real Firebase Auth & Firestore emulators with the production security rules. All passed:

- Login page shown when signed out → phone OTP sign-in.
- Add expense/income → success only after server acknowledgement → document present in Firestore.
- Triple-click Save → exactly one record.
- Add loan → over-repayment blocked → ₹5,000 repayment → *Partially Paid*.
- Dashboard balance excludes loans.
- Refresh keeps session & data.
- 15 menu clicks × 3 rounds, back/forward, direct routes → never blank.
- Import CSV bank statement (3 ready / 1 duplicate / 1 error), Excel loans (auto-detected), PDF expenses.
- Export Excel/CSV/PDF downloads; Excel has the 6 separate section sheets.
- Second browser, same login → same data.
- Another user → **403**, signed-out → **403**, negative amount → **403**.
- Sign out → back to login.

---

## 20. Local development

```bash
git clone https://github.com/Hemanthkumar1198/App_creation.git
cd App_creation
npm install
npm run dev          # http://localhost:5173  (device-only mode)
npm test             # unit tests
npm run build        # production build → dist/
```

To use Firebase locally, copy `.env.example` to `.env.local` and fill in the 6 values (`.env.local` is git-ignored).

Testing against emulators (no real project needed):
```bash
npx firebase-tools emulators:start --project demo-paisa --only auth,firestore
VITE_FIREBASE_API_KEY=x VITE_FIREBASE_PROJECT_ID=demo-paisa VITE_FIREBASE_APP_ID=x \
VITE_FIREBASE_EMULATOR=true npm run dev
```
OTP codes appear in the emulator output.

---

## 21. Troubleshooting

| Symptom | Fix |
|---|---|
| Site still has no login after setup | Check all 6 variables (names exact, no quotes), then re-run **Deploy to GitHub Pages** |
| *"This website is not authorised for sign-in"* | Add `hemanthkumar1198.github.io` in Authentication → Settings → Authorised domains |
| *"This sign-in method is not enabled"* | Enable Google / Phone in Authentication → Sign-in method |
| *"Phone OTP needs the Blaze plan"* | Upgrade to Blaze, use test numbers, or use Google sign-in |
| Stuck on "Loading your data…" or *Permission denied* banner | Firestore not created, or rules not published (Steps 5–6) |
| Google popup closes/blocked on phone | The app automatically switches to redirect sign-in; allow pop-ups if asked |
| Signed in with phone and data is "missing" | You may have used Google before. Sign in with that method and link both (Settings → Account & security) |
| Deploy fails: *"Branch main is not allowed to deploy…"* | Settings → Environments → github-pages → Deployment branches → **No restriction** |
| Page looks outdated after an update | Refresh once; the network-first service worker loads the newest version |
| PDF import finds no rows | It's a scanned image PDF; download the statement as Excel/CSV instead |
| `.xls` file rejected | Open in Excel/Google Sheets and save as `.xlsx` or `.csv` |

---

## 22. Known limitations

- **Phone OTP SMS** needs the Firebase **Blaze** plan (with a free allowance); Google sign-in is free.
- **Scanned PDFs** (images) can't be read without OCR; text-based PDFs work.
- **Old `.xls`** format isn't supported (use `.xlsx` / `.csv`).
- Google and phone logins are separate accounts until **linked** in Settings.
- Device-only mode (no Firebase) keeps data only in that browser; set up Firebase for multi-device storage.
- Browser notifications appear when the app is opened. There are no background push messages while the app is closed.

---

## 23. Everyday user guide

| I want to… | Do this |
|---|---|
| Add an expense | Dashboard → **− Cash Out** → amount → category → **Save** |
| Add income | Dashboard → **+ Cash In** → amount → category → **Save** |
| Edit / delete an entry | Transactions → tap the entry → edit or 🗑 (restorable from Trash) |
| Lend money to someone | **Add Loan** → name, phone, amount, date, rate, due date → **Add loan** |
| Record a repayment | Loans → borrower → **Add Repayment** (interest is taken first automatically) |
| Close a loan | Loan details → **Mark as Fully Repaid** (optionally records the final settlement) |
| Remind a borrower | Loan details → **Send Reminder** → WhatsApp / SMS / Call |
| See monthly totals | Transactions (grouped by month) or **Reports → Monthly** |
| Bring in old records | **Import data** → choose file → check mapping & preview → **Import** |
| Get a report file | Reports → **Excel / CSV / PDF** |
| Keep a personal copy | Settings → **Full backup (.json)** |
| Restore a deleted item | Settings → **Trash → Restore** |
| Use on phone like an app | Open the site → browser menu → **Add to Home Screen** |
| Switch dark/light | Moon/sun icon at the top, or Settings → Theme |
