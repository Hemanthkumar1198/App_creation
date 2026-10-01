# Paisa Ledger 💜

A premium, mobile-first **personal finance, cashbook and loan manager** in Indian Rupees (₹).
Track money in and out and your monthly spending. **Money you lend to people is kept in a separate Loans
module**, so it never mixes with your daily income and expense calculations.

- 🔐 **Secure sign-in**: Google account or mobile number + OTP (Firebase Authentication)
- ☁️ **Data saved to your account** in a cloud database (Firestore). It survives cache clears, browser changes and new devices, and works offline.
- 🛡️ **Private by design**: server-side security rules mean each user can read and write only their own records
- 📥 **Import** from Excel (.xlsx), CSV and PDF with column mapping, preview, validation and duplicate detection
- 📤 **Export** to Excel, CSV and PDF with separate sections for expenses, income, investments, loans, repayments and outstanding loans

Built with React + TypeScript + Vite, Tailwind CSS, Recharts, Zustand, Firebase, ExcelJS and pdf.js.

## Quick start (developers)

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # unit tests (interest maths + importers)
npm run build      # production build in dist/
```

Without Firebase settings the app runs in **device-only mode**: no login, and data is stored in the browser.
Add the settings below to switch on login and cloud storage.

## Enable sign-in & cloud backup (one-time, about 15 minutes)

1. **Create a Firebase project** at <https://console.firebase.google.com> → *Add project*. Google Analytics is not needed.
2. **Add a web app**: Project overview → `</>` (Web) → register the app. Copy the `firebaseConfig` values.
3. **Turn on sign-in methods**: *Build → Authentication → Get started → Sign-in method*:
   - **Google**: enable it and choose a support email.
   - **Phone**: enable it. Real SMS OTP needs the *Blaze* (pay-as-you-go) plan, which includes a free monthly allowance. On the free plan you can still add *test phone numbers* there, or use Google sign-in only.
4. **Authorise your website**: *Authentication → Settings → Authorised domains → Add domain* → `hemanthkumar1198.github.io`.
5. **Create the database**: *Build → Firestore Database → Create database* → production mode → region `asia-south1` (Mumbai).
6. **Paste the security rules**: *Firestore → Rules*. Replace everything with the contents of [`firestore.rules`](firestore.rules) and click **Publish**.
   These rules let each signed-in user access only `users/{their uid}`, validate amounts, dates and types on the server, and keep the activity log append-only.
7. **Give the settings to the build**: on GitHub go to *Settings → Secrets and variables → Actions → **Variables** tab → New repository variable*, and add:

   | Variable | Value from `firebaseConfig` |
   |---|---|
   | `VITE_FIREBASE_API_KEY` | `apiKey` |
   | `VITE_FIREBASE_AUTH_DOMAIN` | `authDomain` |
   | `VITE_FIREBASE_PROJECT_ID` | `projectId` |
   | `VITE_FIREBASE_STORAGE_BUCKET` | `storageBucket` |
   | `VITE_FIREBASE_MESSAGING_SENDER_ID` | `messagingSenderId` |
   | `VITE_FIREBASE_APP_ID` | `appId` |

   These are public identifiers, not secrets. Firebase web config is meant to ship in the browser, and your data is protected by the rules from step 6. For local development, put the same values in `.env.local` (see `.env.example`). That file is git-ignored.
8. **Redeploy**: *Actions → Deploy to GitHub Pages → Run workflow*. The site now asks you to sign in.
   - The first time you sign in on a device that already has data, the app offers to **upload that data to your account**.

**Backups (recommended):** in Firestore, enable *Disaster recovery → Point-in-time recovery* and/or *scheduled backups* (Blaze plan).
You can also download a full JSON/Excel backup any time from **Settings → Export & backup**.

**Same data across sign-in methods:** Google and phone sign-ins create separate accounts unless linked.
Sign in once, then use **Settings → Account & security → Link Google / Link number**.

## Features

| Area | What you get |
|---|---|
| **Dashboard** | Personal balance (income − expenses only), with **Personal expenses / Money lent / Outstanding loans** shown side by side. Also shows this month's income & expenses, interest earned/pending, Income vs Expense and monthly expense charts, loan summary (💰 Lent · 💵 Repaid · 📈 Interest · ⏳ Outstanding), active/overdue/due-soon/paid counts, upcoming due dates, recent transactions & repayments. Large **+ Cash In**, **− Cash Out** and **+ Add Loan** buttons. |
| **Transactions** | Income/expense with amount, date, category, description, payment method and notes. Edit, delete (with confirmation and undo), search, filter by type/category/payment method/month/date range, sort by date or amount, monthly totals and a summary. |
| **Loans** | Borrower, phone, principal, start date, rate, interest type (monthly %, yearly %, fixed ₹), simple or compound (monthly/quarterly/half-yearly/yearly compounding), due date ⇄ duration, payment frequency, notes, optional *interest calculation end date*. Live preview of interest and total due. |
| **Loan details** | Every figure the spec asks for, an *"Interest accrued until today"* card with the formula, a repayment timeline (Date · Amount · Principal · Interest · Balance) and the actions **Add Repayment**, **Edit Loan**, **Mark as Paid** and **Send Reminder** (WhatsApp, SMS, call or copy). |
| **Repayments** | Amount, date, method, notes; principal/interest split is suggested automatically (interest first) or entered manually. Totals, balances and status update immediately. |
| **Reports** | Daily, weekly, monthly or yearly with previous/next navigation: income, expenses, net savings, lent, repaid, interest earned, outstanding. Charts for Income vs Expense, expense by category, loan outstanding, interest earned and monthly cash flow, plus a table view. Export to **PDF** or **Excel/CSV**. |
| **Search** | Global search across transactions, people/borrowers, loans, repayments, amounts (`4500`, `₹4,500`) and dates (`01/10/2026`, `01 Oct 2026`, `2026-10-01`). Filters for date range, type, loan status, category and payment method. |
| **Reminders** | Bell menu with overdue loans, loans due soon (configurable window), missed instalments and a monthly expense summary. Optional browser notifications. |
| **Import** | Excel (.xlsx), CSV and PDF (text-based statements). Detects the header row and maps columns automatically (incl. bank *Withdrawal/Deposit* columns). Preview with inline editing, validation of dates/amounts/types and duplicate detection. Nothing is saved until you confirm. Import as income & expenses **or** as loans. |
| **Stability** | Error boundaries on every page and form (one failure never blanks the app), lazy-loaded pages with automatic recovery after a new deploy, loading states, retry on failed saves, and an offline indicator. |
| **Data safety** | Confirmation before every delete, a trash you can restore from, undo toasts, a full activity history, a JSON backup you can download and restore, a daily automatic snapshot, CSV exports, and a typed "DELETE" confirmation before erasing everything. |

## How interest is calculated

All formulas live in [`src/lib/finance.ts`](src/lib/finance.ts) (pure, reusable functions) and
[`src/lib/loans.ts`](src/lib/loans.ts) (the loan engine). Nothing is hard-coded in the UI, and every amount is rounded to 2 decimals.

- **Simple interest:** `Interest = Principal × Rate × Time / 100`.
  Monthly rates use time in **months**, yearly rates use time in **years** (months ÷ 12).
  - ₹50,000 × 2% × 6 months = **₹6,000**, so Total Due = **₹56,000**
  - ₹1,00,000 × 2% × 3 months (01/10/2026 → 01/01/2027) = **₹6,000**
- **Elapsed time** is measured in whole calendar months plus a fractional month for the remaining days. Interest accrues until **today**, or until the manual *Interest Calculation End Date*, or until the loan is marked paid.
- **Repayments reduce the balance.** Interest is accrued period by period between repayments on the *remaining principal* (simple), or on *remaining principal + unpaid interest* (compound).
- **Compound interest:** `P × ((1 + r/n)^(n·t) − 1)` with the selected compounding frequency.
- **Fixed amount:** the agreed ₹ interest applies once the loan starts.
- **Status:** *Fully Paid* when nothing is outstanding (or the loan is marked paid), *Overdue* when past the due date with a balance, *Partially Paid* once any repayment is made, otherwise *Active*.
- **Current balance** = personal income − personal expenses. Money lent is **not** an expense and loan repayments are **not** income; both live in the Loans module.

The calculations are covered by unit tests in [`src/lib/finance.test.ts`](src/lib/finance.test.ts), including both examples from the spec.

## Project structure

```
src/
  lib/          finance.ts (formulas) · loans.ts (loan engine) · importers.ts · export.ts · reports.ts · reminders.ts · firebase.ts
  store/        useStore.ts (validated actions → atomic writes) · backend.ts / cloud.ts (device or Firestore storage)
                useSession.ts (auth: Google, phone OTP, linking, sign-out) · useUI.ts (sheets, toasts, confirm dialogs)
  data/         sample.ts (demo data)
  components/   Layout, forms (transaction, loan, repayment, mark-paid, reminder), charts, UI primitives
  pages/        Login, Dashboard, Transactions, Loans, LoanDetail, Reports, Search, Import, Settings
firestore.rules   server-side security rules (each user can only access their own data)
```

## Testing against the Firebase emulators

```bash
npx firebase-tools emulators:start --project demo-paisa --only auth,firestore
VITE_FIREBASE_API_KEY=x VITE_FIREBASE_PROJECT_ID=demo-paisa VITE_FIREBASE_APP_ID=x VITE_FIREBASE_EMULATOR=true npm run dev
```
OTP codes for test sign-ins appear in the emulator log.
