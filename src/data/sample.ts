import type { Loan, Repayment, Transaction, TxType, PaymentMethod } from '../types';
import { addDays, addMonths, startOfMonth, todayISO } from '../lib/dates';
import { uid } from '../lib/format';

/**
 * Realistic sample data. Transactions span the last six months relative to today
 * so charts are populated whenever the app is opened.
 */
export function buildSampleData(today = todayISO()): { transactions: Transaction[]; loans: Loan[] } {
  const now = new Date().toISOString();
  const tx = (type: TxType, amount: number, date: string, category: string, description: string, paymentMethod: PaymentMethod, notes = ''): Transaction => ({
    id: uid(), type, amount, date, category, description, paymentMethod, notes, createdAt: now, updatedAt: now,
  });

  const thisMonth = startOfMonth(today);
  const transactions: Transaction[] = [
    tx('income', 150000, addMonths(thisMonth, -12), 'Other', 'Opening balance', 'Bank Transfer', 'Savings carried forward'),
  ];
  for (let m = 5; m >= 0; m--) {
    const month = addMonths(thisMonth, -m);
    const d = (day: number) => {
      const iso = addDays(month, day - 1);
      return iso > today ? today : iso;
    };
    const wiggle = (base: number, i: number) => Math.round(base * (0.85 + ((m * 7 + i * 3) % 6) * 0.06));
    transactions.push(
      tx('income', 56000, d(1), 'Salary', 'Monthly salary', 'Bank Transfer', 'Credited by employer'),
      tx('expense', 15000, d(2), 'Rent', 'House rent', 'UPI'),
      tx('expense', wiggle(4500, 1), d(5), 'Food', 'Groceries — BigBasket', 'UPI'),
      tx('expense', wiggle(3000, 2), d(8), 'Petrol/Fuel', 'Petrol — HP pump', 'Debit Card'),
      tx('expense', wiggle(1850, 3), d(10), 'Bills', 'Electricity + broadband', 'UPI'),
    );
    if (m !== 0 || today >= d(12)) {
      transactions.push(tx('expense', wiggle(5000, 4), d(12), 'Shopping', 'Clothes — Myntra', 'Credit Card'));
      transactions.push(tx('expense', wiggle(1200, 5), d(14), 'Food', 'Dinner with friends', 'UPI'));
    }
    if (m % 2 === 0) transactions.push(tx('expense', wiggle(800, 6), d(18), 'Entertainment', 'Movie + OTT subscriptions', 'Credit Card'));
    if (m % 3 === 1) transactions.push(tx('income', 12000, d(20), 'Freelance', 'Website project', 'UPI', 'Client: Kumar Traders'));
    if (m === 3) transactions.push(tx('expense', 2400, d(22), 'Medical', 'Pharmacy + consultation', 'Cash'));
    if (m === 2) transactions.push(tx('expense', 9800, d(24), 'Travel', 'Train tickets — Goa trip', 'UPI'));
    if (m % 2 === 1) transactions.push(tx('expense', 5000, d(25), 'Investment', 'SIP — Index fund', 'Bank Transfer'));
  }

  const r = (date: string, amount: number, principalPortion: number, interestPortion: number, paymentMethod: PaymentMethod = 'UPI', notes = ''): Repayment => ({
    id: uid(), date, amount, principalPortion, interestPortion, paymentMethod, notes, createdAt: now,
  });
  const loan = (l: Omit<Loan, 'id' | 'createdAt' | 'updatedAt' | 'compounding' | 'notes' | 'repayments'> & Partial<Loan>): Loan => ({
    id: uid(), createdAt: now, updatedAt: now, compounding: 'monthly', notes: '', repayments: [], ...l,
  });

  const loans: Loan[] = [
    loan({
      borrowerName: 'Rahul',
      phone: '9876543210',
      principal: 50000,
      startDate: '2026-10-01',
      interestRate: 2,
      interestType: 'monthly',
      interestMethod: 'simple',
      dueDate: '2027-04-01',
      durationMonths: 6,
      paymentFrequency: 'one-time',
      notes: 'For bike purchase. Agreed to repay with interest in 6 months.',
    }),
  ];

  // Older loans relative to today so balances, interest and statuses are visible immediately.
  const priyaStart = addMonths(today, -5);
  loans.push(
    loan({
      borrowerName: 'Priya Sharma',
      phone: '9123456780',
      principal: 100000,
      startDate: priyaStart,
      interestRate: 1.5,
      interestType: 'monthly',
      interestMethod: 'simple',
      dueDate: addMonths(priyaStart, 12),
      durationMonths: 12,
      paymentFrequency: 'monthly',
      notes: 'Business working capital. Pays interest monthly.',
      repayments: [1, 2, 3, 4].map((k) => r(addMonths(priyaStart, k), 1500, 0, 1500, 'UPI', `Interest for month ${k}`)),
    }),
  );
  loans[1].repayments.push(r(addMonths(priyaStart, 4), 20000, 20000, 0, 'Bank Transfer', 'Part principal'));

  const amitStart = addMonths(today, -9);
  loans.push(
    loan({
      borrowerName: 'Amit Verma',
      phone: '9988776655',
      principal: 60000,
      startDate: amitStart,
      interestRate: 18,
      interestType: 'yearly',
      interestMethod: 'simple',
      dueDate: addMonths(amitStart, 6),
      durationMonths: 6,
      paymentFrequency: 'one-time',
      notes: 'Medical emergency. Follow up — overdue.',
      repayments: [r(addMonths(amitStart, 3), 10000, 7300, 2700, 'Cash')],
    }),
  );

  const snehaStart = addMonths(today, -8);
  loans.push(
    loan({
      borrowerName: 'Sneha Iyer',
      phone: '9012345678',
      principal: 40000,
      startDate: snehaStart,
      interestRate: 2500,
      interestType: 'fixed',
      interestMethod: 'simple',
      dueDate: addMonths(snehaStart, 4),
      durationMonths: 4,
      paymentFrequency: 'one-time',
      notes: 'Fixed ₹2,500 interest agreed.',
      repayments: [r(addMonths(snehaStart, 2), 20000, 20000, 0), r(addMonths(snehaStart, 4), 22500, 20000, 2500, 'Bank Transfer', 'Final settlement')],
    }),
  );

  const vikramStart = addMonths(today, -2);
  loans.push(
    loan({
      borrowerName: 'Vikram Singh',
      phone: '9090909090',
      principal: 25000,
      startDate: vikramStart,
      interestRate: 1,
      interestType: 'monthly',
      interestMethod: 'compound',
      dueDate: addDays(today, 5),
      durationMonths: 2,
      paymentFrequency: 'one-time',
      notes: 'Short-term. Compound monthly.',
    }),
  );

  return { transactions, loans };
}
