import { describe, expect, it } from 'vitest';
import type { Loan, Repayment } from '../types';
import { addMonths, monthsBetween } from './dates';
import {
  compoundInterest,
  monthlyInterest,
  outstandingInterest,
  outstandingPrincipal,
  remainingBalance,
  round2,
  simpleInterest,
  splitRepayment,
  totalRepayment,
  yearlyInterest,
} from './finance';
import { computeLoan, expectedInterest, portfolio, suggestRepaymentSplit } from './loans';

const now = '2026-10-01T00:00:00.000Z';

function loan(partial: Partial<Loan> = {}): Loan {
  return {
    id: 'l1',
    borrowerName: 'Rahul',
    phone: '',
    principal: 50000,
    startDate: '2026-10-01',
    interestRate: 2,
    interestType: 'monthly',
    interestMethod: 'simple',
    compounding: 'monthly',
    dueDate: '2027-04-01',
    durationMonths: 6,
    paymentFrequency: 'one-time',
    notes: '',
    repayments: [],
    createdAt: now,
    updatedAt: now,
    ...partial,
  };
}

function rep(date: string, amount: number, principalPortion: number, interestPortion: number, id = date): Repayment {
  return { id, date, amount, principalPortion, interestPortion, paymentMethod: 'UPI', notes: '', createdAt: now };
}

describe('rounding', () => {
  it('rounds to 2 decimals without float artefacts', () => {
    expect(round2(1.005)).toBe(1.01);
    expect(round2(0.1 + 0.2)).toBe(0.3);
    expect(round2(-2.345)).toBe(-2.35);
    expect(round2(NaN)).toBe(0);
  });
});

describe('interest primitives', () => {
  it('simple interest: P × R × T / 100', () => {
    expect(simpleInterest(50000, 2, 6)).toBe(6000);
    expect(monthlyInterest(100000, 2, 3)).toBe(6000);
    expect(yearlyInterest(100000, 12, 6)).toBe(6000);
  });
  it('compound interest', () => {
    expect(compoundInterest(10000, 10, 2)).toBe(2100);
    expect(compoundInterest(100000, 1, 12)).toBe(12682.5);
  });
  it('outstanding helpers', () => {
    expect(totalRepayment(50000, 6000)).toBe(56000);
    expect(outstandingPrincipal(50000, 60000)).toBe(0);
    expect(outstandingInterest(6000, 2500)).toBe(3500);
    expect(remainingBalance(20000, 3500)).toBe(23500);
    expect(splitRepayment(10000, 3000)).toEqual({ interestPortion: 3000, principalPortion: 7000 });
  });
});

describe('dates', () => {
  it('counts calendar months exactly', () => {
    expect(monthsBetween('2026-10-01', '2027-01-01')).toBe(3);
    expect(monthsBetween('2026-10-01', '2027-04-01')).toBe(6);
    expect(monthsBetween('2026-01-31', '2026-02-28')).toBe(1);
    expect(monthsBetween('2026-10-01', '2026-10-16')).toBeCloseTo(15 / 31, 6);
    expect(addMonths('2026-01-31', 1)).toBe('2026-02-28');
  });
});

describe('loan engine', () => {
  it('spec example: ₹50,000 @ 2%/month for 6 months → ₹6,000 interest, ₹56,000 due', () => {
    const l = loan();
    expect(expectedInterest(l)).toBe(6000);
    const s = computeLoan(l, '2027-04-01');
    expect(s.expectedInterest).toBe(6000);
    expect(s.totalAmountDue).toBe(56000);
    expect(s.interestAccrued).toBe(6000);
  });

  it('spec example: ₹1,00,000 @ 2%/month repaid after 3 months → ₹6,000 interest', () => {
    const l = loan({ principal: 100000 });
    const s = computeLoan(l, '2027-01-01');
    expect(s.interestAccrued).toBe(6000);
    expect(s.totalOutstanding).toBe(106000);
    expect(s.status).toBe('active');
  });

  it('accrues nothing before the start date', () => {
    expect(computeLoan(loan(), '2026-09-15').interestAccrued).toBe(0);
  });

  it('respects a manual interest calculation end date', () => {
    const s = computeLoan(loan({ interestEndDate: '2026-12-01' }), '2027-03-01');
    expect(s.interestAccrued).toBe(2000);
    expect(s.manualEndDate).toBe(true);
  });

  it('reduces interest after a principal repayment (reducing balance)', () => {
    // 2 months on 50,000 = 2,000; repay 2,000 interest + 20,000 principal; 2 more months on 30,000 = 1,200
    const l = loan({ repayments: [rep('2026-12-01', 22000, 20000, 2000)] });
    const s = computeLoan(l, '2027-02-01');
    expect(s.interestAccrued).toBe(3200);
    expect(s.interestRepaid).toBe(2000);
    expect(s.remainingPrincipal).toBe(30000);
    expect(s.remainingInterest).toBe(1200);
    expect(s.totalOutstanding).toBe(31200);
    expect(s.status).toBe('partially-paid');
    expect(s.timeline[0].balance).toBe(30000);
  });

  it('becomes fully paid when everything is repaid', () => {
    const l = loan({ repayments: [rep('2027-01-01', 53000, 50000, 3000)] });
    const s = computeLoan(l, '2027-02-01');
    expect(s.totalOutstanding).toBe(0);
    expect(s.status).toBe('fully-paid');
    expect(s.nextDueDate).toBeNull();
  });

  it('is overdue after the due date with money outstanding', () => {
    const s = computeLoan(loan(), '2027-05-01');
    expect(s.status).toBe('overdue');
    expect(s.interestAccrued).toBe(7000);
  });

  it('yearly simple interest', () => {
    const s = computeLoan(loan({ interestType: 'yearly', interestRate: 12, principal: 100000 }), '2027-04-01');
    expect(s.interestAccrued).toBe(6000);
  });

  it('compound interest with monthly compounding', () => {
    const s = computeLoan(loan({ principal: 100000, interestRate: 1, interestMethod: 'compound' }), '2027-10-01');
    expect(s.interestAccrued).toBe(12682.5);
  });

  it('compound interest chains exactly across an interest-free repayment date', () => {
    const base = loan({ principal: 100000, interestRate: 1, interestMethod: 'compound' });
    const withZero = { ...base, repayments: [rep('2027-03-01', 0, 0, 0)] };
    expect(computeLoan(withZero, '2027-10-01').interestAccrued).toBe(12682.5);
  });

  it('fixed amount interest', () => {
    const l = loan({ interestType: 'fixed', interestRate: 5000 });
    expect(computeLoan(l, '2026-11-01').interestAccrued).toBe(5000);
    expect(computeLoan(l, '2026-11-01').totalAmountDue).toBe(55000);
  });

  it('marking as paid without settlement writes off the remainder', () => {
    const s = computeLoan(loan({ closedAt: '2026-12-01' }), '2027-01-01');
    expect(s.status).toBe('fully-paid');
    expect(s.totalOutstanding).toBe(0);
    expect(s.writtenOff).toBe(52000);
  });

  it('suggests interest-first split', () => {
    const sp = suggestRepaymentSplit(loan(), 5000, '2026-12-01');
    expect(sp.interestPortion).toBe(2000);
    expect(sp.principalPortion).toBe(3000);
  });

  it('flags a missed monthly instalment', () => {
    const l = loan({ paymentFrequency: 'monthly' });
    const s = computeLoan(l, '2026-11-15');
    expect(s.installmentMissed).toBe(true);
    expect(s.nextDueDate).toBe('2026-11-01');
    const paid = computeLoan({ ...l, repayments: [rep('2026-11-02', 1000, 0, 1000)] }, '2026-11-15');
    expect(paid.installmentMissed).toBe(false);
    expect(paid.nextDueDate).toBe('2026-12-01');
  });

  it('portfolio totals', () => {
    const p = portfolio([loan(), loan({ id: 'l2', principal: 100000, repayments: [rep('2026-11-01', 2000, 0, 2000)] })], '2026-11-01');
    expect(p.totalLent).toBe(150000);
    expect(p.interestEarned).toBe(2000);
    expect(p.interestPending).toBe(1000);
    expect(p.outstanding).toBe(151000);
  });
});
