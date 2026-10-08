import { describe, expect, it } from 'vitest';
import {
  alignColumns,
  autoMap,
  buildLoanDrafts,
  buildTxDrafts,
  detectHeaderRow,
  draftsToLoans,
  cleanBorrowerName,
  groupLines,
  guessTarget,
  markTxDuplicates,
  parseAmount,
  parseCSV,
  parseDateLoose,
  TX_FIELDS,
  LOAN_FIELDS,
} from './importers';
import { CATEGORIES } from './categories';
import { computeLoan } from './loans';
import type { Transaction } from '../types';

const known = CATEGORIES.map((c) => c.name);

describe('parsers', () => {
  it('parses CSV with quotes and other delimiters', () => {
    expect(parseCSV('a,b\n"x, y","say ""hi"""\n')).toEqual([['a', 'b'], ['x, y', 'say "hi"']]);
    expect(parseCSV('Date;Amount\r\n01/10/2026;4500')).toEqual([['Date', 'Amount'], ['01/10/2026', '4500']]);
  });
  it('parses Indian amounts', () => {
    expect(parseAmount('₹1,00,000.50')?.value).toBe(100000.5);
    expect(parseAmount('Rs. 4,500')?.value).toBe(4500);
    expect(parseAmount('(250)')).toMatchObject({ value: 250, negative: true });
    expect(parseAmount('1,200.00 Cr')).toMatchObject({ value: 1200, crdr: 'cr' });
    expect(parseAmount('-300')).toMatchObject({ negative: true });
    expect(parseAmount('abc')).toBeNull();
    expect(parseAmount('')).toBeNull();
  });
  it('parses many date formats (day-first by default)', () => {
    expect(parseDateLoose('01/10/2026')).toBe('2026-10-01');
    expect(parseDateLoose('01/10/2026', 'mdy')).toBe('2026-01-10');
    expect(parseDateLoose('25-12-26')).toBe('2026-12-25');
    expect(parseDateLoose('2026-10-01')).toBe('2026-10-01');
    expect(parseDateLoose('15-Dec-2026')).toBe('2026-12-15');
    expect(parseDateLoose('1 Oct 2026')).toBe('2026-10-01');
    expect(parseDateLoose('Oct 5, 2026')).toBe('2026-10-05');
    expect(parseDateLoose('46296')).toBe('2026-10-01'); // Excel serial
    expect(parseDateLoose('31/02/2026')).toBeNull();
    expect(parseDateLoose('hello')).toBeNull();
  });
});

describe('mapping', () => {
  it('detects header row and maps bank-statement columns', () => {
    const rows = [['ABC Bank statement'], ['Txn Date', 'Narration', 'Withdrawal Amt', 'Deposit Amt', 'Closing Balance'], ['01/10/2026', 'UPI-SWIGGY', '450.00', '', '10000']];
    const h = detectHeaderRow(rows);
    expect(h).toBe(1);
    const map = autoMap(rows[h], TX_FIELDS.map((f) => f.key));
    expect(map).toMatchObject({ date: 0, description: 1, debit: 2, credit: 3 });
  });
  it('maps loan sheets and guesses the target', () => {
    const header = ['Person', 'Mobile', 'Amount Lent', 'Date Lent', 'Due Date', 'Interest %', 'Repaid'];
    const map = autoMap(header, LOAN_FIELDS.map((f) => f.key));
    expect(map).toEqual({ borrower: 0, phone: 1, principal: 2, startDate: 3, dueDate: 4, interestRate: 5, repaid: 6 });
    expect(guessTarget({ name: 'Sheet1', rows: [header] }, 0)).toBe('loans');
  });
});

describe('transaction drafts', () => {
  const opts = { dateOrder: 'dmy' as const, defaultType: 'expense' as const, knownCategories: known };
  it('builds drafts from debit/credit columns and guesses categories & methods', () => {
    const rows = [
      ['01/10/2026', 'UPI/Swiggy order', '450.00', ''],
      ['01/10/2026', 'NEFT SALARY ACME', '', '56,000.00'],
      ['', 'Closing balance', '', ''],
      ['bad', 'Petrol', '3000', ''],
    ];
    const d = buildTxDrafts(rows, { date: 0, description: 1, debit: 2, credit: 3 }, opts);
    expect(d).toHaveLength(3);
    expect(d[0]).toMatchObject({ type: 'expense', amount: 450, category: 'Food', paymentMethod: 'UPI', status: 'ok' });
    expect(d[1]).toMatchObject({ type: 'income', amount: 56000, category: 'Salary', paymentMethod: 'Bank Transfer' });
    expect(d[2].status).toBe('error');
  });
  it('uses type column / sign of amount', () => {
    const rows = [
      ['2026-10-02', 'Refund', '200', 'Income'],
      ['2026-10-02', 'Rent', '-15000', ''],
    ];
    const d = buildTxDrafts(rows, { date: 0, description: 1, amount: 2, type: 3 }, opts);
    expect(d[0].type).toBe('income');
    expect(d[1]).toMatchObject({ type: 'expense', amount: 15000, category: 'Rent' });
  });
  it('flags duplicates against existing data and within the file', () => {
    const existing = [{ id: 'x', type: 'expense', amount: 450, date: '2026-10-01', category: 'Food', description: 'UPI/Swiggy order', paymentMethod: 'UPI', notes: '', createdAt: '', updatedAt: '' }] as Transaction[];
    const rows = [
      ['01/10/2026', 'UPI/Swiggy order', '450'],
      ['02/10/2026', 'Tea', '20'],
      ['02/10/2026', 'Tea', '20'],
    ];
    const d = markTxDuplicates(buildTxDrafts(rows, { date: 0, description: 1, amount: 2 }, opts), existing);
    expect(d.map((x) => x.status)).toEqual(['duplicate', 'ok', 'duplicate']);
  });
});

describe('loan drafts', () => {
  it('creates loans with an imported repayment, never exceeding outstanding', () => {
    const rows = [
      ['Ravi', '9876543210', '20,000', '15/06/2026', '15-Dec-2026', '0', '5,000'],
      ['Sita', '', '10000', '01/09/2026', '', '', '99999'],
    ];
    const drafts = buildLoanDrafts(rows, { borrower: 0, phone: 1, principal: 2, startDate: 3, dueDate: 4, interestRate: 5, repaid: 6 }, 'dmy');
    expect(drafts.map((d) => d.status)).toEqual(['ok', 'ok']);
    expect(drafts[1].dueDate).toBe('2027-09-01');
    const loans = draftsToLoans(drafts, 'monthly');
    // The imported repayment is dated "today" (or the due date if already past), so evaluate after that.
    const ravi = computeLoan(loans[0], '2099-01-01');
    expect(ravi.amountRepaid).toBe(5000);
    expect(ravi.remainingPrincipal).toBe(15000);
    expect(['partially-paid', 'overdue']).toContain(ravi.status);
    expect(computeLoan(loans[1], '2099-01-01').amountRepaid).toBe(10000);
  });
});

describe('pdf table reconstruction', () => {
  it('groups text into rows and aligns columns to the header', () => {
    const it = (str: string, x: number, y: number, w = 30) => ({ str, x, y, w });
    const lines = groupLines([
      it('Date', 10, 700), it('Description', 80, 700, 60), it('Amount', 250, 700),
      it('01/10/2026', 10, 680, 50), it('Groceries', 80, 680, 45), it('4,500.00', 245, 680, 40),
      it('02/10/2026', 10, 660, 50), it('Petrol', 80, 660, 30), it('3,000.00', 245, 660, 40),
    ]);
    const rows = alignColumns(lines);
    expect(rows).toEqual([
      ['Date', 'Description', 'Amount'],
      ['01/10/2026', 'Groceries', '4,500.00'],
      ['02/10/2026', 'Petrol', '3,000.00'],
    ]);
  });
});

describe('CashBook-app export of money lent (Date, Remark, Cash In, Cash Out…)', () => {
  const csv = [
    '"Date","Time","Remark","Entry by","Mode","Cash In","Cash Out","Balance"',
    '"09 June 2024","10:56 pm","Ravi mamaIntrestes recieved dec 18 2025","Me","Cash",,20000,-20000',
    '"08 April 2025","2:08 pm","Suresh anna","Me","Cash",,20000,-40000',
    '"20 April 2025","7:00 pm","Kiran mava recived intrest on may","Me","Cash",,10000,-50000',
    '"03 June 2026","7:57 pm","Mohan rao (bunty) 09 jun in google pay","Me","",,30000,-80000',
    '"13 June 2026","8:06 pm","Gopal krishna jun 13 and jun 22 in gpay","Me","",,30000,-110000',
  ].join('\n');

  it('is recognised as interest records from the file name and maps Remark / Cash Out / Date', () => {
    const rows = parseCSV(csv);
    const h = detectHeaderRow(rows);
    expect(h).toBe(0);
    expect(guessTarget({ name: 'CSV', rows }, h, 'My_intrest_savings_08-10-2026_CashBook.csv')).toBe('loans');
    expect(guessTarget({ name: 'CSV', rows }, h, 'July_expenses_CashBook.csv')).toBe('transactions');
    const map = autoMap(rows[h], LOAN_FIELDS.map((f) => f.key));
    expect(map).toMatchObject({ startDate: 0, borrower: 2, principal: 6, repaid: 5 });
  });

  it('creates one interest record per row with clean names, amounts and dates', () => {
    const rows = parseCSV(csv);
    const map = autoMap(rows[0], LOAN_FIELDS.map((f) => f.key));
    const d = buildLoanDrafts(rows.slice(1), map, 'dmy', { defaultRate: 2, termMonths: 12 });
    expect(d.map((x) => x.status)).toEqual(['ok', 'ok', 'ok', 'ok', 'ok']);
    expect(d.map((x) => x.borrowerName)).toEqual(['Ravi mama', 'Suresh anna', 'Kiran mava', 'Mohan rao', 'Gopal krishna']);
    expect(d.map((x) => x.principal)).toEqual([20000, 20000, 10000, 30000, 30000]);
    expect(d[0]).toMatchObject({ startDate: '2024-06-09', dueDate: '2025-06-09', interestRate: 2 });
    expect(d[0].notes).toContain('recieved dec 18 2025'); // full remark kept in notes
  });

  it('also imports as normal transactions with Remark as description', () => {
    const rows = parseCSV(csv);
    const map = autoMap(rows[0], TX_FIELDS.map((f) => f.key));
    expect(map).toMatchObject({ date: 0, description: 2, credit: 5, debit: 6, paymentMethod: 4 });
  });

  it('cleans names from free-text remarks', () => {
    expect(cleanBorrowerName('Arun mava')).toBe('Arun mava');
    expect(cleanBorrowerName('Ramesh mava given around apr may')).toBe('Ramesh mava');
    expect(cleanBorrowerName('Ramkrishna uncl')).toBe('Ramkrishna uncl');
  });

  it("keeps dated 'Total till …' rows and uses the file's own category", () => {
    const rows = parseCSV('Date,Category,Amount,Description\n"2026-05-29","Utilities","6100.00","Total till may 31"\n"2026-05-04","Transportation","500.00","Petrol"\n"2026-05-01","Food & Dining","28.00","Milk"\n,,"6628",Total\n"2026-09-21","Utilities","211.00","Curent pill"\n');
    const map = autoMap(rows[0], TX_FIELDS.map((f) => f.key));
    const d = buildTxDrafts(rows.slice(1), map, { dateOrder: 'dmy', defaultType: 'expense', knownCategories: ['Food', 'Travel', 'Bills', 'Rent', 'Petrol/Fuel', 'Other'] });
    expect(d.map((x) => [x.amount, x.category])).toEqual([
      [6100, 'Bills'],
      [500, 'Travel'],
      [28, 'Food'],
      [211, 'Bills'],
    ]);
  });
});
