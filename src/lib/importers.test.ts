import { describe, expect, it } from 'vitest';
import {
  alignColumns,
  autoMap,
  buildLoanDrafts,
  buildTxDrafts,
  detectHeaderRow,
  draftsToLoans,
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
    const ravi = computeLoan(loans[0], '2026-10-01');
    expect(ravi.amountRepaid).toBe(5000);
    expect(ravi.remainingPrincipal).toBe(15000);
    expect(ravi.status).toBe('partially-paid');
    expect(computeLoan(loans[1], '2026-10-01').amountRepaid).toBe(10000);
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
