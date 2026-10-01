import type { Loan, Transaction } from '../types';
import { formatDate, formatDateNumeric, todayISO } from './dates';
import { formatRs } from './format';
import { computeLoan, STATUS_LABEL, describeRate } from './loans';
import { live } from './reports';

function download(filename: string, content: BlobPart, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function csvCell(v: unknown): string {
  const s = v === undefined || v === null ? '' : String(v);
  // Prevent CSV/formula injection when opened in Excel.
  const safe = /^[=+\-@\t\r]/.test(s) && !/^-?\d/.test(s) ? `'${s}` : s;
  return /[",\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

export function toCSV(rows: (string | number | undefined)[][]): string {
  return rows.map((r) => r.map(csvCell).join(',')).join('\r\n');
}

/** CSV with a UTF-8 BOM so Excel shows ₹ and names correctly. */
export function downloadCSV(filename: string, rows: (string | number | undefined)[][]) {
  download(filename, '﻿' + toCSV(rows), 'text/csv;charset=utf-8');
}

export function downloadJSON(filename: string, data: unknown) {
  download(filename, JSON.stringify(data, null, 2), 'application/json');
}

export function transactionsRows(txs: Transaction[]) {
  return [
    ['Date', 'Type', 'Category', 'Description', 'Amount (INR)', 'Payment Method', 'Notes'],
    ...live(txs)
      .sort((a, b) => b.date.localeCompare(a.date))
      .map((t) => [formatDateNumeric(t.date), t.type === 'income' ? 'Income' : 'Expense', t.category, t.description, t.amount.toFixed(2), t.paymentMethod, t.notes]),
  ];
}

export function loansRows(loans: Loan[]) {
  return [
    ['Borrower', 'Phone', 'Principal', 'Start Date', 'Due Date', 'Rate', 'Expected Interest', 'Total Due', 'Interest Accrued', 'Repaid', 'Principal Repaid', 'Interest Repaid', 'Remaining Principal', 'Remaining Interest', 'Outstanding', 'Status', 'Notes'],
    ...live(loans).map((l) => {
      const s = computeLoan(l);
      return [
        l.borrowerName, l.phone, s.principal.toFixed(2), formatDateNumeric(l.startDate), formatDateNumeric(l.dueDate), describeRate(l).replace('₹', 'Rs.'),
        s.expectedInterest.toFixed(2), s.totalAmountDue.toFixed(2), s.interestAccrued.toFixed(2), s.amountRepaid.toFixed(2), s.principalRepaid.toFixed(2),
        s.interestRepaid.toFixed(2), s.remainingPrincipal.toFixed(2), s.remainingInterest.toFixed(2), s.totalOutstanding.toFixed(2), STATUS_LABEL[s.status], l.notes,
      ];
    }),
  ];
}

export function repaymentsRows(loans: Loan[]) {
  return [
    ['Borrower', 'Date', 'Amount', 'Principal', 'Interest', 'Balance After', 'Payment Method', 'Notes'],
    ...live(loans).flatMap((l) =>
      computeLoan(l, '9999-12-31').timeline.map((r) => [l.borrowerName, formatDateNumeric(r.date), r.amount.toFixed(2), r.principal.toFixed(2), r.interest.toFixed(2), r.balance.toFixed(2), r.paymentMethod, r.notes]),
    ),
  ];
}

export interface PdfReportInput {
  title: string;
  periodLabel: string;
  summary: [string, number][];
  categories: { category: string; amount: number; share: number }[];
  transactions: Transaction[];
  loans: Loan[];
}

/** Standard PDF fonts cannot render ₹ — swap it for 'Rs.'. */
const pdfText = (s: string) => s.replace(/₹/g, 'Rs.');

/** Generates a clean A4 PDF report. jsPDF is lazy-loaded to keep the initial bundle small. */
export async function downloadPDF(input: PdfReportInput) {
  const [{ jsPDF }, autoTableMod] = await Promise.all([import('jspdf'), import('jspdf-autotable')]);
  const autoTable = autoTableMod.default;
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const W = doc.internal.pageSize.getWidth();

  doc.setFillColor(97, 40, 244);
  doc.rect(0, 0, W, 78, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(20);
  doc.setFont('helvetica', 'bold');
  doc.text('Paisa Ledger', 40, 40);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  doc.text(`${input.title} · ${input.periodLabel}`, 40, 60);
  doc.text(`Generated ${formatDate(todayISO())}`, W - 40, 60, { align: 'right' });

  doc.setTextColor(20, 20, 30);
  const brand: [number, number, number] = [97, 40, 244];
  autoTable(doc, {
    startY: 100,
    head: [['Summary', 'Amount']],
    body: input.summary.map(([k, v]) => [k, formatRs(v)]),
    theme: 'striped',
    headStyles: { fillColor: brand },
    columnStyles: { 1: { halign: 'right' } },
    margin: { left: 40, right: 40 },
  });

  type WithLast = { lastAutoTable?: { finalY: number } };
  const nextY = () => ((doc as unknown as WithLast).lastAutoTable?.finalY ?? 100) + 24;

  if (input.categories.length) {
    autoTable(doc, {
      startY: nextY(),
      head: [['Expense category', 'Amount', 'Share']],
      body: input.categories.map((c) => [c.category, formatRs(c.amount), `${c.share.toFixed(1)}%`]),
      theme: 'striped',
      headStyles: { fillColor: [225, 29, 72] },
      columnStyles: { 1: { halign: 'right' }, 2: { halign: 'right' } },
      margin: { left: 40, right: 40 },
    });
  }

  const loans = live(input.loans);
  if (loans.length) {
    autoTable(doc, {
      startY: nextY(),
      head: [['Borrower', 'Principal', 'Repaid', 'Interest earned', 'Outstanding', 'Due', 'Status']],
      body: loans.map((l) => {
        const s = computeLoan(l);
        return [l.borrowerName, formatRs(s.principal), formatRs(s.amountRepaid), formatRs(s.interestRepaid), formatRs(s.totalOutstanding), formatDateNumeric(l.dueDate), STATUS_LABEL[s.status]];
      }),
      theme: 'striped',
      headStyles: { fillColor: [124, 58, 237] },
      styles: { fontSize: 8.5 },
      margin: { left: 40, right: 40 },
    });
  }

  if (input.transactions.length) {
    autoTable(doc, {
      startY: nextY(),
      head: [['Date', 'Type', 'Category', 'Description', 'Method', 'Amount']],
      body: [...input.transactions]
        .sort((a, b) => b.date.localeCompare(a.date))
        .map((t) => [formatDateNumeric(t.date), t.type === 'income' ? 'In' : 'Out', t.category, pdfText(t.description), t.paymentMethod, `${t.type === 'income' ? '+' : '-'} ${formatRs(t.amount)}`]),
      theme: 'striped',
      headStyles: { fillColor: brand },
      styles: { fontSize: 8.5 },
      columnStyles: { 5: { halign: 'right' } },
      margin: { left: 40, right: 40 },
    });
  }

  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(140, 140, 150);
    doc.text(`Page ${i} of ${pages}`, W - 40, doc.internal.pageSize.getHeight() - 20, { align: 'right' });
  }
  doc.save(`paisa-ledger-${input.periodLabel.replace(/[^\w]+/g, '-').toLowerCase()}.pdf`);
}
