# Paisa Ledger: Complete Implementation & User Guide

> Personal finance, interest calculation, notes and investment tracker (₹ INR).
>
> | | |
> |---|---|
> | **Live app** | https://hemanthkumar1198.github.io/App_creation/ |
> | **Repository** | https://github.com/Hemanthkumar1198/App_creation |
> | **Firebase project** | `paisa-ledger-cb5d7` (owned by your Google account) |
> | **Security rules** | [`firestore.rules`](../firestore.rules) |

---

## Table of contents

**Part A — Using the app**
1. [What the app does](#1-what-the-app-does)
2. [Who can see your data](#2-who-can-see-your-data)
3. [Sign in](#3-sign-in)
4. [Install on phone / computer & offline use](#4-install-on-phone--computer--offline-use)
5. [Dashboard](#5-dashboard)
6. [Transactions & Monthly books (Cash Out / Cash In)](#6-transactions--monthly-books-cash-out--cash-in)
7. [Interest Calculation (money lent)](#7-interest-calculation-money-lent)
8. [Calculation Notes (separate calculations)](#8-calculation-notes-separate-calculations)
9. [Investments & Insurance](#9-investments--insurance)
10. [Reports](#10-reports)
11. [Import (Excel / CSV / PDF)](#11-import-excel--csv--pdf)
12. [Export & backup](#12-export--backup)
13. [Search & reminders](#13-search--reminders)
14. [Settings, Trash & history](#14-settings-trash--history)
15. [Everyday quick guide](#15-everyday-quick-guide)

**Part B — How it is built**

16. [Technology stack](#16-technology-stack)
17. [Architecture](#17-architecture)
18. [Project structure](#18-project-structure)
19. [Data model](#19-data-model)
20. [Data safety: why data is never lost](#20-data-safety-why-data-is-never-lost)
21. [Security](#21-security)
22. [Financial calculations](#22-financial-calculations)
23. [Validation rules](#23-validation-rules)
24. [Stability fixes](#24-stability-fixes)
25. [Testing](#25-testing)

**Part C — Setup & maintenance**

26. [Firebase setup (already done)](#26-firebase-setup-already-done)
27. [Updating security rules](#27-updating-security-rules)
28. [Deployment (GitHub Pages)](#28-deployment-github-pages)
29. [Local development](#29-local-development)
30. [Troubleshooting](#30-troubleshooting)
31. [Known limitations](#31-known-limitations)
32. [Change log](#32-change-log)

---

# Part A — Using the app

## 1. What the app does

| Section | Menu (desktop / phone) | Purpose |
|---|---|---|
| **Dashboard** | Dashboard / Home | Balance, this month's income & spending, interest summary, shortcuts |
| **Transactions** | Transactions / Cashbook | Daily income & expenses, monthly books (Cash Out and Cash In kept separate) |
| **Interest Calculation** | Interest Calculation / Interest | Money lent to people on interest: interest received, pending, repayments |
| **Calculation Notes** | Calculation Notes / Notes | Separate calculations for one purpose (paddy harvest, construction, wedding…) |
| **Investments & Insurance** | Investments & Insurance / More → Investments | SIP, LIC, term insurance, gold, chit fund, any record with its own entries |
| **Reports** | Reports / More → Reports | Daily / weekly / monthly / yearly reports and charts |
| **Import** | Import data / More → Import | Bring in records from Excel, CSV or PDF |
| **Settings** | Settings / More → Settings | Account, install, export & backup, Trash, history |

**Everything is kept separate.** Interest-calculation money, calculation notes and investments are **never mixed** into daily income/expense totals. Cash In and Cash Out have separate books and totals.

All amounts are in Indian Rupees (₹), with Indian digit grouping (₹1,00,000) and rounding to 2 decimals.

---

## 2. Who can see your data

| Who | Access |
|---|---|
| **You (signed in)** | ✅ Only your own records |
| Other users of the app | ❌ Blocked by the database rules (tested: "permission denied") |
| Anyone not signed in | ❌ Blocked |
| Claude / Anthropic | ❌ No access. Claude wrote the code only; the app never sends data to Claude or Anthropic |
| The code's developer | ❌ No access. The database is in **your** Firebase project under **your** Google account |
| Google (Firebase) | Hosts the database for you, encrypted, like any Google service |

---

## 3. Sign in

- **Continue with Google**: free and recommended.
- **Continue with mobile number (OTP)**: real SMS needs the Firebase **Blaze** plan (pay-as-you-go with a free monthly allowance). On the free plan, use Google.
- You stay signed in until you sign out. **Sign out** (Settings → Account & security) also removes the offline copy from that device.
- **Same data with both methods:** Google and phone are separate accounts unless linked. In **Settings → Account & security → Sign-in methods**, use **Link Google** / **Link number**.
- **First sign-in on a browser that already had data:** the app offers **Upload** to move that data into your account.

---

## 4. Install on phone / computer & offline use

**Install**
- **Settings → Install app & offline → Install app on this device** (Chrome / Edge / Android), or
- Edge/Chrome desktop: the install icon in the address bar, or menu → **Apps → Install Paisa Ledger**
- Android Chrome: menu **⋮ → Install app / Add to Home screen**
- iPhone Safari: **Share → Add to Home Screen**

**Offline**
- After opening the app once online, **every page opens without internet**: all app files are downloaded at install.
- Entries added offline are saved on the device, the app shows *"saved offline, will sync"*, and they upload automatically when you're back online.
- The top bar shows the status: **Saved** (green), **Saving…** (blue), **Offline · will sync** (amber).

---

## 5. Dashboard

- **Top card: this month only.** **Cash In** and **Cash Out** are shown as two separate totals with entry counts, never added together. Tap either to open this month's Cash In / Cash Out book.
- Big buttons: **+ Cash In**, **− Cash Out**, **Add Interest Record**.
- Cards: *Money lent (total)* · *Outstanding interest records*.
- **All Cash In & Cash Out** (lower on the page): two separate columns with all-time totals and entry counts, plus every month's total (latest 6 shown, *Show all months* for more). Tap a month to open its book, or *All Cash In / All Cash Out entries* to see the full lists.
- Shortcuts to **Calculation Notes** (top calculations with totals) and **Investments & Insurance** (payments due this week / paid this year).
- Charts: Income vs Expense (6 months), monthly expenses.
- **Interest calculation summary**: Total Lent · Total Repaid · Interest Earned · Outstanding, plus counts of active / overdue / due soon / fully repaid.
- Upcoming due dates, recent transactions, recent repayments, where the money went this month.

---

## 6. Transactions & Monthly books (Cash Out / Cash In)

**Quick entry (about 3 taps):** Cash In / Cash Out → amount → category → Save. You can also set the date (Today / Yesterday chips), payment method (Cash, UPI, Bank Transfer, Debit/Credit Card, Cheque, Other), description and notes. **Save & add another** keeps the form open.

**Categories:** Food, Shopping, Travel, Petrol/Fuel, Bills, Rent, Entertainment, Medical, Investment, Personal, Gift, Other; income also has Salary, Business, Freelance, Refund.

**Monthly books** (the default tab, like a cashbook app)
- Switch between **Cash Out** and **Cash In** at the top. They are separate books with separate totals and are never netted.
- One line per month, e.g. *Sep 2026 expenses −₹4,200* or *Oct 2026 cash in +₹56,000*.
- Tap a month to see Cash Out (spent) and Cash In (received) as **separate totals**, entries **grouped by day** with daily totals, *Where the money went / came from* by category, previous/next month, export, and Cash In/Out buttons that add to that month.

**All entries** tab: search, filter by type / category / payment method / month / date range, sort by date or amount, grouped by month (tap a month header to open its book). Tap any entry to **edit** or **delete** (deleted entries go to Trash and can be restored).

---

## 7. Interest Calculation (money lent)

Records of money you lent to people on interest. These are **not** counted as expenses, and repayments are **not** counted as income.

**Add an interest record:** borrower name, mobile (optional), amount lent, date lent, interest type (**% per month**, **% per year**, or **fixed ₹**), simple or compound (monthly/quarterly/half-yearly/yearly compounding), duration ⇄ due date, payment frequency, optional *interest calculation end date*, and notes. A live preview shows the interest for the full term and the total due.

**All borrowers list** (default view; switch to *Cards* if you prefer). One row per person with amount lent & rate, **last interest received**, **next interest due**, **interest due now**, outstanding and status, plus **Interest / Repay / Edit** buttons on every row. **Add another person** sits under the list and on every record page.

**Status:** Active · Partially Paid · Fully Repaid · Overdue (plus a *Due soon* flag). Filter by status and search by name, phone or amount.

**Record page**
- Outstanding (principal + interest), progress, and **Interest accrued until today** with the formula shown (e.g. ₹50,000 × 2% × 3.67 months).
- **Receive Interest**: note an interest-only payment (amount, date, method, notes). Quick chips: *All due* and *1 month*. **The next interest is counted from that date.** Up to 12 months of interest can be received in advance.
- **Interest received** section: last received, **next interest due** (last payment + one period: monthly, or the record's payment frequency), interest due now, total received, and a history table: *Received on · For period (from → to) · Interest · Method/notes*.
- **Add Repayment**: principal and/or interest. The split is automatic (interest first) or manual, and a repayment can't exceed the outstanding amount.
- **Repayment timeline**: Date | Amount | Principal | Interest | Balance.
- **Mark as Fully Repaid** (optionally records the final settlement), **Edit**, **Send Reminder** (WhatsApp / SMS / Call / Copy, with the amount filled in), **Move to Trash**.

---

## 8. Calculation Notes (separate calculations)

For calculations that must stay apart from daily expenses, e.g. **Paddy harvest 2026**, *Borewell work*, *House construction*, *Wedding*, *Trip*.

- Create **any number** of calculations with **any name**: **+ New calculation** (on the list and inside every calculation) or the **Create another calculation** tile. Quick name chips are available.
- Inside a calculation: **Add expense** (e.g. Labour ₹4,000, Fertiliser ₹2,500) and **Add received** (e.g. Paddy sale ₹30,000). Each entry has what for, amount, date and notes, with suggestions from earlier entries. **Save & add another** is available.
- Totals: **Total spent · Received · Profit** (or *Net cost*).
- **Spent on** breakdown adds the same items together (e.g. all *Labour* = ₹5,500).
- Tap an entry to edit or remove it (a copy is kept in history). **Rename**, **Export** (CSV) or **Move to Trash** (restorable).

---

## 9. Investments & Insurance

Fully flexible records for SIP, mutual funds, LIC, term / health / vehicle insurance, PPF, FD/RD, gold, or **anything you type** (e.g. *Chit fund*, *Post office*).

- **+ New record** with any name. Pick a type or type your own; provider/insurer, policy/folio number, cover/target and notes are optional.
- **Regular amount and schedule are optional.**
  - With a regular amount (e.g. ₹5,000 monthly SIP, ₹12,000 yearly LIC): the app tracks the **next due date** (last payment + one period), overdue status and yearly commitment, and reminds you under the 🔔 bell.
  - Without one: just add entries whenever you like.
- **Add entry** (what for, amount, date, method, notes), like monthly expenses. Entries are **grouped by month with monthly totals**. **Save & add another** is available.
- Record page: total paid, paid this year, next due or number of entries, details, entries by month, Edit, Move to Trash.
- List page: **Paid this year**, **Invested (all time)**, **Premiums paid (all time)**, **Yearly commitment**, *Due in the next 30 days* with Pay buttons, and filters All / Investments / Insurance.

---

## 10. Reports

Daily / Weekly / Monthly / Yearly with previous/next navigation.
- **Personal finance**: income, expenses, net savings, investments (Investment category).
- **Lending**: lent, repaid, interest earned, outstanding (as of period end).
- Charts: Income vs Expense, Expense by category, Loan outstanding, Interest earned, Monthly savings (income − expenses), plus a table view.
- **Export Excel / CSV / PDF** for the selected period.

---

## 11. Import (Excel / CSV / PDF)

**Import data** → choose a file → check settings → preview → **Import**. **Nothing is saved until you confirm.**

1. **File:** `.xlsx`, `.csv` or text-based `.pdf` (up to 15 MB / 5,000 rows). Old `.xls` → save as `.xlsx`/CSV first. Scanned image PDFs can't be read.
2. **Settings:** sheet, *Import as* (Income & expenses / Interest records), header row (auto-detected), date format (DD/MM default), column mapping (auto-matched, adjustable), the default type for unsigned amounts, and whether rates are % per month or per year.
3. **Preview:** every row is *Ready*, *Duplicate* (skipped unless ticked) or *Needs fixing* (with the reason). Cells are editable.

**CashBook-app exports** (columns *Date, Time, Remark, Entry by, Mode, Cash In, Cash Out, Balance*) are supported:
- If the file name contains *intrest / interest / loan / lend / udhar…* (e.g. `My_intrest_savings_…CashBook.csv`), it is imported as **Interest records** automatically: **Remark → person** (name cleaned, e.g. "Devraj shetty (vivek) 09 jun in google pay" → *Devraj shetty*; the full remark is kept in notes), **Cash Out → amount lent**, **Date → date lent**.
- Options for interest records: **Interest % if not in file** (applied to every row) and **Due after (months)** (default 12).
- Other CashBook files import as income & expenses (Remark → description, Cash In/Cash Out → type and amount, Mode → payment method).

**Undo an import:** Settings → **Recent imports** → **Undo import** moves the whole batch to Trash (restorable). Use it if a file went into the wrong section.

It understands bank statements (Withdrawal/Deposit, Cr/Dr), amounts like `₹1,00,000.50`, `Rs. 4,500`, `(250)`, and dates like `01/10/2026`, `15-Dec-2026`, `1 Oct 2026` or Excel serial numbers. It guesses categories (Swiggy → Food, HP → Petrol/Fuel, Uber/IRCTC → Travel…) and payment methods (UPI/GPay → UPI, NEFT → Bank Transfer…), and skips total and balance lines.

---

## 12. Export & backup

| Format | Where | Content |
|---|---|---|
| **Excel (.xlsx)** | Settings, Reports | *Summary* + separate sheets: Daily Expenses · Income · Investments · Loans (Money Lent) · Loan Repayments · Outstanding Loans · **Calculation Notes** · **Investments & Insurance** |
| **CSV** | Settings, Reports, Transactions, Interest, each month book, each calculation | Same sections, one after another (opens in Excel) |
| **PDF** | Settings, Reports | Printable report with one table per section (₹ shown as "Rs.") |
| **Full backup (.json)** | Settings → Export & backup | Everything, restorable with **Restore backup** (current items go to Trash, never erased) |

---

## 13. Search & reminders

**Search** (top bar, or More → Search): transactions, people, interest records, repayments, amounts (`4500`, `₹4,500`) and dates (`01/10/2026`, `01 Oct 2026`), with filters for type, status, category, payment method and date range.

**🔔 Reminders:** overdue interest records, records due soon, missed instalments, **interest due from a borrower**, **SIP/premium due or overdue**, and last month's expense summary. The window is set in Settings (default 7 days). Optional browser notifications.

---

## 14. Settings, Trash & history

- **Your data is protected**: a plain summary of the guarantees.
- **Install app & offline**
- **Account & security**: sign-in methods, link Google/phone, sign out.
- **Profile & appearance**: name (used in greetings and reminders), Light/Dark/System theme.
- **Export & backup**
- **Reminders**: window, browser notifications.
- **Trash**: every deleted transaction, interest record, calculation and investment record. **Restore** any time; items are kept forever.
- **Activity history**: log of every change.
- **Data**: *Load demo data* (current data moves to Trash; type `DEMO`), *Clear: move all to Trash* (type `TRASH`).

---

## 15. Everyday quick guide

| I want to… | Do this |
|---|---|
| Add an expense | Home → **− Cash Out** → amount → category → Save |
| Add income | Home → **+ Cash In** → amount → category → Save |
| See a month's spending | Cashbook → **Monthly books → Cash Out** → tap the month |
| See a month's money received | Cashbook → Monthly books → **Cash In** → tap the month |
| Lend money on interest | Interest → **Add interest record** |
| Note interest a borrower paid | Interest → **Interest** on their row (or record page → **Receive Interest**) |
| Record principal returned | Interest → **Repay** on their row |
| Start a separate calculation (paddy…) | Notes → **+ New calculation** → Add expense / Add received |
| Track SIP / LIC / term plan / anything | More → Investments → **+ New record** → **Add entry** |
| Find something | 🔍 search at the top |
| Restore a deleted item | Settings → **Trash → Restore** |
| Keep a personal copy | Settings → **Full backup (.json)** or **Excel** |
| Use like an app | Settings → **Install app** |

---

# Part B — How it is built

## 16. Technology stack

| Layer | Technology |
|---|---|
| UI | React 18 + TypeScript, Tailwind CSS 3, lucide icons |
| Build | Vite 6 (static files) |
| Charts | Recharts 2 |
| State | Zustand 5 |
| Routing | React Router 6 (`HashRouter`: direct links, refresh, back/forward work on static hosting) |
| Login | Firebase Authentication (Google, phone OTP) |
| Database | Cloud Firestore with offline persistence (IndexedDB) and security rules |
| Excel | ExcelJS (lazy-loaded) |
| PDF import / export | pdf.js / jsPDF + autotable (lazy-loaded) |
| Offline / install | Service worker with precache manifest, web app manifest, PNG icons |
| Tests | Vitest (35 unit tests) + Playwright end-to-end runs against Firebase emulators |
| Hosting | GitHub Pages via GitHub Actions |

There is no custom server: the browser talks to Firebase over HTTPS, and the **security rules run on Google's servers**.

---

## 17. Architecture

```
Browser (phone / laptop, installable, works offline)
 ├─ Pages: Dashboard · Transactions · MonthBook · Interest (Loans) · LoanDetail · Notes · NoteDetail
 │         Investments · PlanDetail · Reports · Search · Import · Settings · More · Login
 ├─ Zustand store (useStore) ── validated actions ──► commit(ops)
 │        ▲ live snapshots                               │ one atomic batch per action
 │        │                                              │ + previous version → history
 ├─ Pure logic: finance.ts · loans.ts · plans.ts · reports.ts · importers.ts · export.ts
 └─ Service worker: precached app files, network-first
                │ HTTPS
                ▼
Firebase project paisa-ledger-cb5d7 (your Google account)
 ├─ Authentication (Google, Phone)
 └─ Firestore users/{uid}/…  ← firestore.rules (owner-only, validation, NO deletes)
```

Principles:
1. **All money maths is in pure, unit-tested functions**, never inside the UI.
2. **Every user action = one atomic batch**: the change, the activity-log entry and the previous version are saved together or not at all.
3. **IDs are created on the device**, so retries can't create duplicates; Save buttons are disabled while saving.
4. **No delete operation exists** in the code; deletes are soft (Trash).
5. **Device-only fallback:** if no Firebase config is present, the same app runs with browser storage.

---

## 18. Project structure

```
App_creation/
├── index.html                 App shell, theme before first paint, PWA meta tags
├── public/
│   ├── manifest.webmanifest   Install settings (name, icons, standalone)
│   ├── sw.js                  Service worker: precache + network-first + offline fallback
│   └── icon*.png, icon.svg    App icons (192, 512, maskable, Apple)
├── vite.config.ts             Build + precache-manifest.json generator
├── firestore.rules            Database security rules (paste into Firebase)
├── firebase.json              Rules path + emulator ports (testing)
├── src/
│   ├── firebase-config.ts     Your Firebase web config (public identifiers)
│   ├── App.tsx                Login gate, routes, error boundaries, sheets, notifications
│   ├── types.ts               Transaction, Loan, Repayment, CalcNote, NoteEntry, Plan, PlanPayment, HistoryEntry…
│   ├── lib/
│   │   ├── finance.ts         Interest formulas, rounding
│   │   ├── loans.ts           Interest engine: accrual, balances, status, due dates, interest receipts
│   │   ├── plans.ts           Investments (next due, totals) + calculation-note totals
│   │   ├── reports.ts         Periods, totals, categories
│   │   ├── reminders.ts       Bell reminders
│   │   ├── importers.ts       CSV/XLSX/PDF parsing, mapping, validation, duplicates
│   │   ├── export.ts          Excel/CSV/PDF/JSON exports (separate sections)
│   │   ├── install.ts         Install prompt
│   │   ├── lazy.ts            Lazy pages with crash recovery
│   │   ├── useSave.ts         Saving state, toasts, retry, double-submit guard
│   │   └── *.test.ts          Unit tests
│   ├── store/
│   │   ├── useStore.ts        Data + validated actions + version history
│   │   ├── backend.ts         Op types, device-only backend
│   │   ├── cloud.ts           Firestore listeners + atomic batches
│   │   ├── useSession.ts      Sign-in, linking, sign-out, data upload offer
│   │   ├── useTheme.ts, useUI.ts
│   ├── components/            Layout, ErrorBoundary, InstallCard, charts, forms, UI kit
│   └── pages/                 All screens listed in section 17
├── .github/workflows/         ci.yml (tests + build), deploy.yml (publish to Pages)
└── docs/IMPLEMENTATION.md     This guide
```

---

## 19. Data model

### 19.1 Firestore layout

```
users/{uid}                     { settings, updatedAt }
users/{uid}/transactions/{id}   daily income & expenses
users/{uid}/loans/{id}          interest records (repayments embedded)
users/{uid}/notes/{id}          calculation notes (entries embedded)
users/{uid}/plans/{id}          investments & insurance (payments/entries embedded)
users/{uid}/activity/{id}       activity log (append-only)
users/{uid}/history/{id}        previous versions of changed records (append-only)
```

### 19.2 Records

| Type | Key fields |
|---|---|
| **Transaction** | id, type (income/expense), amount, date, category, description, paymentMethod, notes, createdAt, updatedAt, deletedAt? |
| **Loan** (interest record) | id, borrowerName, phone, principal, startDate, dueDate, durationMonths, interestRate, interestType (monthly/yearly/fixed), interestMethod (simple/compound), compounding, paymentFrequency, interestEndDate?, closedAt?, repayments[], notes, timestamps, deletedAt? |
| **Repayment** | id, amount, date, paymentMethod, principalPortion, interestPortion, notes (interest-only receipts have principalPortion = 0) |
| **CalcNote** | id, name, description, entries[], timestamps, deletedAt? |
| **NoteEntry** | id, date, type (out = spent / in = received), amount, description, notes |
| **Plan** | id, name, kind (any text), provider, policyNumber, amount (0 = no fixed amount), frequency (monthly/quarterly/half-yearly/yearly/one-time = no schedule), startDate, endDate?, coverAmount?, notes, payments[], timestamps, deletedAt? |
| **PlanPayment** | id, date, amount, description (what for), paymentMethod, notes |
| **HistoryEntry** | id, at, entity (transaction/loan/note/plan), docId, before (full previous copy) |
| **ActivityEntry** | id, at, action, entity, label |

All dates are `YYYY-MM-DD` local calendar dates (no timezone drift); all amounts are rounded to 2 decimals.

---

## 20. Data safety: why data is never lost

| Protection | How |
|---|---|
| **Stored in your cloud account** | Firestore keeps multiple replicated copies; clearing the browser or changing device doesn't affect it |
| **No permanent delete anywhere** | The app has no erase function: delete = move to **Trash** (kept forever, restorable). *Clear*, *Load demo data* and *Restore backup* also move old items to Trash |
| **Server-enforced** | `firestore.rules` → `allow delete: if false` on the user document, transactions, loans, notes, plans, history and activity |
| **Version history** | Before any change (edit, delete, restore, removing an entry inside a record), the full previous version is written to `history` **in the same atomic batch**; the rules make history create-only |
| **Atomic saves** | A change and its log/history entries succeed or fail together |
| **No duplicates** | Device-generated IDs make retries idempotent; Save buttons are disabled while saving |
| **Offline-safe** | Offline changes are stored durably on the device and synced automatically |
| **Your own copies** | Full JSON backup / Excel export any time |
| **Trash & Undo** | Undo toast after delete; Trash lists everything deleted |

**What can still cause loss (outside the app):** deleting the Firebase project itself, or losing access to your Google account. Keep the Google account secure and download a backup now and then.

---

## 21. Security

- **Owner-only access**: every rule checks `request.auth.uid == uid`; everything else is denied (`match /{document=**} { allow read, write: if false; }`).
- **Server-side validation**: transactions (type, amount > 0, date format, text lengths), loans (name, principal > 0, due date after start, rate ≥ 0, valid types), notes (name, entries list), plans (name, amount ≥ 0, frequency, payments list), activity/history (append-only).
- **Verified**: another signed-in user gets 403, a signed-out request gets 403, a negative amount gets 403, deleting a transaction or history entry gets 403, and editing history gets 403.
- **HTTPS everywhere**; passwordless sign-in (no stored passwords).
- **No secrets in the code**: the Firebase web config in `src/firebase-config.ts` is a public identifier by design; protection comes from the rules.
- CSV export guards against Excel formula injection; sign-out clears the device's offline copy.

---

## 22. Financial calculations

All formulas are in `src/lib/finance.ts`, `loans.ts` and `plans.ts`, rounded half-up to 2 decimals.

| Formula | Definition |
|---|---|
| Simple interest | `P × R × T / 100` (T in months for monthly rates, years for yearly) |
| Compound interest | `P × ((1 + r)^n − 1)` with the chosen compounding |
| Outstanding principal | `max(0, principal − principal repaid)` |
| Outstanding interest | `max(0, interest accrued − interest received)` |
| Remaining balance | outstanding principal + outstanding interest |
| Elapsed time | whole calendar months + fraction of the next month (01 Oct → 01 Jan = exactly 3) |

**Interest accrued until today** is calculated per segment between repayments on the **remaining principal** (simple) or principal + unpaid interest (compound), up to today, or the manual end date, or the date the record was marked repaid.

**Interest receipts:** each interest payment starts the next interest period. *Next interest due* = last interest payment (or the date lent) + one period (monthly, or the payment frequency). *Interest per period* = interest for one period on the remaining principal. Advance interest is allowed up to 12 months.

**Investments:** *next due* = last payment + one period (or the start date before the first payment), only when a regular amount and schedule are set. *Yearly commitment* = amount × payments per year.

**Calculation notes:** spent = Σ spent entries, received = Σ received entries, profit/net = received − spent.

**Worked examples (unit-tested)**

| Case | Result |
|---|---|
| ₹50,000 @ 2%/month × 6 months | Interest ₹6,000, total ₹56,000 |
| ₹1,00,000 @ 2%/month, 3 months | ₹6,000 |
| ₹1,00,000 @ 12%/year, 6 months | ₹6,000 |
| ₹1,00,000 @ 1%/month compound, 12 months | ₹12,682.50 |
| ₹50,000 @ 2%/m; ₹1,000 interest received 01 Nov & 05 Dec | Next interest due 05 Jan |
| Paddy: spent ₹4,000 + ₹2,500.50, received ₹30,000 | Profit ₹23,499.50 |
| SIP ₹5,000 monthly, last paid 05 Sep | Next due 05 Oct; yearly ₹60,000 |

**Interest record status:** Fully Repaid (nothing outstanding or marked paid) · Overdue (past due date with a balance) · Partially Paid · Active.

---

## 23. Validation rules

| Rule | Where |
|---|---|
| Amount > 0 and ≤ ₹1,00,00,00,00,000 (investment regular amount may be empty/0) | form + store + database |
| Valid real calendar dates | form + store + database |
| Required: category, borrower name, calculation name, record name | form + store + database |
| Due date after date lent; end date after start date | form + store (+ database for loans) |
| Repayment ≤ outstanding; principal portion ≤ remaining principal; portions = total | form + store |
| Interest receipt ≤ interest due + 12 months in advance | form + store |
| Principal can't be edited below what's already repaid | store |
| Double-submit prevention | disabled buttons + one save at a time + idempotent IDs |

Errors appear as a red message with **Retry**; successes as green confirmations.

---

## 24. Stability fixes

| Issue | Fix |
|---|---|
| **"u is not a function" / blank page after clicking a menu (Edge)** | Newer Edge/Chromium returns a Promise from `window.scrollTo`; an effect returned it implicitly, so React called it as a cleanup on the next page change. All effects now use block bodies. Reproduced by simulating the new browser behaviour, and verified fixed |
| One error blanking the whole app | Error boundaries around the app, every page and every form, with *Try again* / *Dashboard* |
| Stale files after an update | Network-first service worker; lazy pages retry, then reload once automatically |
| Notifications crashing on Android | Notifications go through the service worker inside try/catch |
| Database rules not yet updated for a new section | A clear banner explains which rules to publish, and other data keeps working |

---

## 25. Testing

**Unit tests** (`npm test`): 35 tests covering interest formulas, both spec examples, reducing balance, compound interest, status, missed instalments, interest receipts and next interest due, advance-interest limit, investments next due & totals, calculation-note totals, CSV/amount/date parsing, header detection & column mapping, duplicates, loan import and PDF table reconstruction.

**End-to-end** (Playwright + Firebase Auth/Firestore emulators with the real rules), all passing:
- OTP sign-in; saves confirmed by the server; a triple-click saves one record
- Interest record, over-repayment blocked, interest receipt with history, all-borrowers list with edit
- Monthly books with separate Cash Out / Cash In; month detail by day
- Calculation notes (several, with totals and breakdown), not mixed with daily transactions
- Investments: scheduled (SIP/LIC next due) and free-form records with entries grouped by month
- Delete → Trash (still stored) → restore; version history written; deletes and history edits denied by the server
- Offline: app opens without internet (including never-visited pages); an offline entry syncs later
- Import CSV / Excel / PDF; export Excel / CSV / PDF with all section sheets
- Second device sees the same data; other users blocked; sign-out
- Navigation stress test with Edge-style `scrollTo` (no crashes)

---

# Part C — Setup & maintenance

## 26. Firebase setup (already done)

Project **`paisa-ledger-cb5d7`**:
- [x] Web app registered; config saved in `src/firebase-config.ts` (no GitHub variables needed; `VITE_FIREBASE_*` variables would override it if set)
- [x] Authentication: **Google** enabled (Phone enabled; real SMS needs Blaze)
- [x] Authorised domain: `hemanthkumar1198.github.io`
- [x] Firestore database created (production mode)
- [x] Security rules published (**re-publish whenever `firestore.rules` changes**, see below)

**Optional:** Blaze plan for phone OTP; budget alert; Firestore *point-in-time recovery* / scheduled backups (Disaster recovery).

---

## 27. Updating security rules

Needed whenever the app adds a new section (for example notes and plans) or changes validation:
1. Open https://github.com/Hemanthkumar1198/App_creation/blob/main/firestore.rules → **copy** icon (top-right).
2. Go to **Firebase console → Firestore Database → Rules** → **Ctrl + A** → **Ctrl + V** → **Publish**.

If you forget, the app shows a banner telling you which rules to publish, and existing data is unaffected.

---

## 28. Deployment (GitHub Pages)

| Workflow | Trigger | Does |
|---|---|---|
| `ci.yml` | Every push | install → test → build |
| `deploy.yml` | Push to `main` / manual run | install → test → build → publish to Pages |

One-time settings (done): Pages source = **GitHub Actions**; default branch = **main**; Environments → github-pages → Deployment branches = **No restriction**.

Every push to `main` goes live in about 1–2 minutes. Afterwards, refresh with **Ctrl + Shift + R**.

---

## 29. Local development

```bash
git clone https://github.com/Hemanthkumar1198/App_creation.git
cd App_creation
npm install
npm run dev        # http://localhost:5173 (uses the real Firebase project)
npm test           # unit tests
npm run build      # production build → dist/
```

Emulator testing (no real data touched):
```bash
npx firebase-tools emulators:start --project demo-paisa --only auth,firestore
VITE_FIREBASE_API_KEY=x VITE_FIREBASE_PROJECT_ID=demo-paisa VITE_FIREBASE_APP_ID=x \
VITE_FIREBASE_EMULATOR=true npm run dev
```

---

## 30. Troubleshooting

| Symptom | Fix |
|---|---|
| Old version still showing | **Ctrl + Shift + R**; the installed app updates on the next open |
| Banner: *"…need the updated database rules"* | Re-publish `firestore.rules` (section 27) |
| *Permission denied* | Rules incomplete: copy the whole file again and Publish |
| *This website is not authorised for sign-in* | Add `hemanthkumar1198.github.io` in Authentication → Settings → Authorised domains |
| *Phone OTP needs the Blaze plan* | Use Google sign-in, or upgrade to Blaze |
| Data "missing" after signing in | You may have used the other sign-in method; sign in with the original one and link both in Settings |
| Deleted something by mistake | Settings → Trash → Restore (or Undo right after) |
| Deploy fails: *branch not allowed* | Settings → Environments → github-pages → Deployment branches → No restriction |
| PDF import finds nothing | Scanned PDF: use the bank's Excel/CSV download |

---

## 31. Known limitations

- Phone OTP needs the Firebase Blaze plan (Google sign-in is free).
- Scanned (image) PDFs and old `.xls` files can't be imported.
- Google and phone logins are separate accounts until linked.
- Notifications appear when the app is opened (no background push while closed).
- Deleting the Firebase project or losing the Google account is outside the app's protection; keep backups.

---

## 32. Change log

| Date | Change |
|---|---|
| 01 Oct 2026 | v1: dashboard, transactions, loans with interest engine, repayments, reports, search, reminders, import/export, PWA, sample data |
| 01 Oct 2026 | v2: Google/phone login, Firestore storage, security rules, offline sync, error boundaries, loans kept separate, Excel/CSV/PDF import with preview, multi-sheet exports |
| 02 Oct 2026 | Connected Firebase project `paisa-ledger-cb5d7`; fixed Edge "u is not a function" crash |
| 02 Oct 2026 | Receive Interest with history and next due; all-borrowers list with edit; Monthly books with day-wise month view |
| 02 Oct 2026 | Data safety: no permanent deletes (server-enforced), version history; installable offline app (precache, icons, Install button); separate Cash In / Cash Out books |
| 02 Oct 2026 | Calculation Notes and Investments & Insurance; "Loans" renamed to **Interest Calculation**; phone menu Home · Cashbook · Interest · Notes · More |
| 08 Oct 2026 | Import: CashBook exports of money lent go to **Interest records** (Remark → name, Cash Out → amount); default interest % and due months; **Undo import** in Settings |
| 08 Oct 2026 | Dashboard: top card shows **this month's** Cash In and Cash Out separately; new **All Cash In & Cash Out** section with month-by-month totals |
| 02 Oct 2026 | Notes & Investments made fully flexible: unlimited records, any name/type, optional amount, entries grouped by month |
