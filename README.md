# Paisa Ledger 💜

A premium, mobile-first **personal finance, cashbook and loan manager** in Indian Rupees (₹).
Track money in and out, monthly spending, money you've lent, interest earned, repayments,
due dates and overall balance, with charts, reports and PDF/Excel export.

Built with React + TypeScript + Vite, Tailwind CSS, Recharts and Zustand. All data is stored
**on your device** (browser local storage). It works offline and can be installed as an app (PWA).

## Quick start

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # calculation unit tests
npm run build      # production build in dist/
```

The app opens with realistic **sample data** (salary, expenses and five loans in different
states), so you can explore it straight away. You can reset or clear it in **Settings → Data**.

To open it on your phone, deploy `dist/` to any static host. A GitHub Pages workflow is included:
in the repo, go to **Settings → Pages → Source: GitHub Actions**, then push to `main`.

## Features

| Area | What you get |
|---|---|
| **Dashboard** | Current balance, total/this-month income & expenses, money lent, outstanding, interest earned/pending, Income vs Expense and monthly expense charts, loan summary (💰 Lent · 💵 Repaid · 📈 Interest · ⏳ Outstanding), active/overdue/due-soon/paid counts, upcoming due dates, recent transactions & repayments. Large **+ Cash In**, **− Cash Out** and **+ Add Loan** buttons. |
| **Transactions** | Income/expense with amount, date, category, description, payment method and notes. Edit, delete (with confirmation and undo), search, filter by type/category/payment method/month/date range, sort by date or amount, monthly totals and a summary. |
| **Loans** | Borrower, phone, principal, start date, rate, interest type (monthly %, yearly %, fixed ₹), simple or compound (monthly/quarterly/half-yearly/yearly compounding), due date ⇄ duration, payment frequency, notes, optional *interest calculation end date*. Live preview of interest and total due. |
| **Loan details** | Every figure the spec asks for, an *"Interest accrued until today"* card with the formula, a repayment timeline (Date · Amount · Principal · Interest · Balance) and the actions **Add Repayment**, **Edit Loan**, **Mark as Paid** and **Send Reminder** (WhatsApp, SMS, call or copy). |
| **Repayments** | Amount, date, method, notes; principal/interest split is suggested automatically (interest first) or entered manually. Totals, balances and status update immediately. |
| **Reports** | Daily, weekly, monthly or yearly with previous/next navigation: income, expenses, net savings, lent, repaid, interest earned, outstanding. Charts for Income vs Expense, expense by category, loan outstanding, interest earned and monthly cash flow, plus a table view. Export to **PDF** or **Excel/CSV**. |
| **Search** | Global search across transactions, people/borrowers, loans, repayments, amounts (`4500`, `₹4,500`) and dates (`01/10/2026`, `01 Oct 2026`, `2026-10-01`). Filters for date range, type, loan status, category and payment method. |
| **Reminders** | Bell menu with overdue loans, loans due soon (configurable window), missed instalments and a monthly expense summary. Optional browser notifications. |
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
- **Current balance** = income − expenses − money lent + repayments received.

The calculations are covered by unit tests in [`src/lib/finance.test.ts`](src/lib/finance.test.ts), including both examples from the spec.

## Project structure

```
src/
  lib/          finance.ts (formulas) · loans.ts (loan engine) · reports.ts · reminders.ts · export.ts · dates.ts · format.ts
  store/        useStore.ts (persisted data + actions) · useUI.ts (sheets, toasts, confirm dialogs)
  data/         sample.ts (demo data)
  components/   Layout, forms (transaction, loan, repayment, mark-paid, reminder), charts, UI primitives
  pages/        Dashboard, Transactions, Loans, LoanDetail, Reports, Search, Settings
```
