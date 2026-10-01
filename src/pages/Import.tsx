import clsx from 'clsx';
import { AlertTriangle, ArrowLeft, CheckCircle2, Copy, FileSpreadsheet, FileUp, HandCoins, Loader2, ReceiptText, Upload } from 'lucide-react';
import { useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { PageHeader, Segmented } from '../components/ui/common';
import { CATEGORIES, PAYMENT_METHODS } from '../lib/categories';
import { formatINR } from '../lib/format';
import {
  autoMap,
  buildLoanDrafts,
  buildTxDrafts,
  detectHeaderRow,
  draftsToLoans,
  draftsToTransactions,
  guessTarget,
  LOAN_FIELDS,
  markLoanDuplicates,
  markTxDuplicates,
  parseCSV,
  parsePdf,
  parseXlsx,
  typeFromSheetName,
  TX_FIELDS,
  validateLoanDraft,
  validateTxDraft,
  type ImportTarget,
  type LoanDraft,
  type LoanField,
  type RawTable,
  type TxDraft,
  type TxField,
} from '../lib/importers';
import { useSave } from '../lib/useSave';
import { useStore } from '../store/useStore';
import type { PaymentMethod, TxType } from '../types';

const PAGE = 50;
const MAX_ROWS = 5000;

type Step = 'upload' | 'map' | 'done';

function StatusPill({ status, issues }: { status: TxDraft['status']; issues: string[] }) {
  const cls =
    status === 'ok'
      ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300'
      : status === 'duplicate'
        ? 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300'
        : 'bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300';
  const Icon = status === 'ok' ? CheckCircle2 : status === 'duplicate' ? Copy : AlertTriangle;
  return (
    <span title={issues.join('\n')} className={clsx('inline-flex max-w-[160px] items-center gap-1 truncate rounded-full px-2 py-0.5 text-[11px] font-semibold', cls)}>
      <Icon size={11} className="shrink-0" /> <span className="truncate">{status === 'ok' ? 'Ready' : issues[0] ?? status}</span>
    </span>
  );
}

export default function ImportData() {
  const txsAll = useStore((s) => s.transactions);
  const loansAll = useStore((s) => s.loans);
  const importRecords = useStore((s) => s.importRecords);
  const { saving, run } = useSave();
  const fileRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState<Step>('upload');
  const [fileName, setFileName] = useState('');
  const [tables, setTables] = useState<RawTable[]>([]);
  const [sheet, setSheet] = useState(0);
  const [headerRow, setHeaderRow] = useState(0);
  const [target, setTarget] = useState<ImportTarget>('transactions');
  const [txMap, setTxMap] = useState<Partial<Record<TxField, number>>>({});
  const [loanMap, setLoanMap] = useState<Partial<Record<LoanField, number>>>({});
  const [dateOrder, setDateOrder] = useState<'dmy' | 'mdy'>('dmy');
  const [defaultType, setDefaultType] = useState<TxType>('expense');
  const [rateUnit, setRateUnit] = useState<'monthly' | 'yearly'>('monthly');
  const [txEdits, setTxEdits] = useState<Record<number, Partial<TxDraft>>>({});
  const [loanEdits, setLoanEdits] = useState<Record<number, Partial<LoanDraft>>>({});
  const [excluded, setExcluded] = useState<Record<number, boolean>>({});
  const [page, setPage] = useState(0);
  const [parsing, setParsing] = useState(false);
  const [error, setError] = useState('');
  const [doneCount, setDoneCount] = useState<{ n: number; target: ImportTarget } | null>(null);

  const table = tables[sheet];
  const headers = useMemo(() => (table?.rows[headerRow] ?? []).map((h, i) => h || `Column ${i + 1}`), [table, headerRow]);
  const dataRows = useMemo(() => table?.rows.slice(headerRow + 1) ?? [], [table, headerRow]);

  const resetDerived = () => {
    setTxEdits({});
    setLoanEdits({});
    setExcluded({});
    setPage(0);
  };

  const configure = (ts: RawTable[], idx: number) => {
    const t = ts[idx];
    const h = detectHeaderRow(t.rows);
    const tgt = guessTarget(t, h);
    setSheet(idx);
    setHeaderRow(h);
    setTarget(tgt);
    setTxMap(autoMap(t.rows[h] ?? [], TX_FIELDS.map((f) => f.key)));
    setLoanMap(autoMap(t.rows[h] ?? [], LOAN_FIELDS.map((f) => f.key)));
    setDefaultType(typeFromSheetName(t.name) ?? 'expense');
    resetDerived();
  };

  const onFile = async (file: File) => {
    setError('');
    setParsing(true);
    try {
      if (file.size > 15 * 1024 * 1024) throw new Error('File is larger than 15 MB. Please split it into smaller files.');
      const name = file.name.toLowerCase();
      let ts: RawTable[];
      if (name.endsWith('.csv') || name.endsWith('.txt') || file.type === 'text/csv') ts = [{ name: 'CSV', rows: parseCSV(await file.text()) }];
      else if (name.endsWith('.xlsx') || name.endsWith('.xlsm')) ts = await parseXlsx(file);
      else if (name.endsWith('.pdf')) {
        ts = await parsePdf(file);
        if (!ts.length || ts[0].rows.length < 2) throw new Error('No readable text was found in this PDF (it may be a scanned image). Please export the statement as Excel or CSV instead.');
      } else if (name.endsWith('.xls')) throw new Error('Old .xls files are not supported. Open it in Excel/Google Sheets and save as .xlsx or .csv.');
      else throw new Error('Unsupported file. Please choose an Excel (.xlsx), CSV or PDF file.');
      ts = ts.filter((t) => t.rows.some((r) => r.some((c) => c))).map((t) => ({ ...t, rows: t.rows.slice(0, MAX_ROWS) }));
      if (!ts.length) throw new Error('The file looks empty.');
      setTables(ts);
      setFileName(file.name);
      // Prefer the sheet with the most rows for the first view.
      const first = ts.reduce((bi, t, i) => (t.rows.length > ts[bi].rows.length ? i : bi), 0);
      configure(ts, first);
      setStep('map');
    } catch (e) {
      console.error(e);
      setError((e as Error).message || 'Could not read this file.');
    } finally {
      setParsing(false);
    }
  };

  const txDrafts = useMemo(() => {
    if (target !== 'transactions' || !table) return [];
    const base = buildTxDrafts(dataRows, txMap, { dateOrder, defaultType, knownCategories: CATEGORIES.map((c) => c.name) });
    const edited = base.map((d) => (txEdits[d.row] ? validateTxDraft({ ...d, ...txEdits[d.row] }) : d));
    return markTxDuplicates(edited, txsAll);
  }, [target, table, dataRows, txMap, dateOrder, defaultType, txEdits, txsAll]);

  const loanDrafts = useMemo(() => {
    if (target !== 'loans' || !table) return [];
    const base = buildLoanDrafts(dataRows, loanMap, dateOrder);
    const edited = base.map((d) => (loanEdits[d.row] ? validateLoanDraft({ ...d, ...loanEdits[d.row] }) : d));
    return markLoanDuplicates(edited, loansAll);
  }, [target, table, dataRows, loanMap, dateOrder, loanEdits, loansAll]);

  const drafts: (TxDraft | LoanDraft)[] = target === 'transactions' ? txDrafts : loanDrafts;
  const isIncluded = (d: { row: number; status: string }) => d.status !== 'error' && (excluded[d.row] ?? d.status === 'duplicate') === false;
  const selected = drafts.filter(isIncluded);
  const counts = {
    ok: drafts.filter((d) => d.status === 'ok').length,
    dup: drafts.filter((d) => d.status === 'duplicate').length,
    err: drafts.filter((d) => d.status === 'error').length,
  };
  const selectedTotal = selected.reduce((a, d) => a + ('amount' in d ? d.amount : d.principal), 0);
  const pages = Math.max(1, Math.ceil(drafts.length / PAGE));
  const visible = drafts.slice(page * PAGE, page * PAGE + PAGE);

  const hasAmount = target === 'transactions' ? txMap.amount !== undefined || txMap.debit !== undefined || txMap.credit !== undefined : loanMap.principal !== undefined;
  const hasRequired = target === 'transactions' ? txMap.date !== undefined && hasAmount : loanMap.borrower !== undefined && loanMap.principal !== undefined && loanMap.startDate !== undefined;

  const confirmImport = async () => {
    const label = `Imported ${selected.length} ${target === 'transactions' ? 'transactions' : 'loans'} from ${fileName}`;
    const ok = await run(
      () =>
        target === 'transactions'
          ? importRecords(draftsToTransactions(selected as TxDraft[]), [], label)
          : importRecords([], draftsToLoans(selected as LoanDraft[], rateUnit), label),
      `${selected.length} records imported`,
    );
    if (ok) {
      setDoneCount({ n: selected.length, target });
      setStep('done');
    }
  };

  const setTx = (row: number, patch: Partial<TxDraft>) => setTxEdits((e) => ({ ...e, [row]: { ...e[row], ...patch } }));
  const setLoan = (row: number, patch: Partial<LoanDraft>) => setLoanEdits((e) => ({ ...e, [row]: { ...e[row], ...patch } }));

  if (step === 'done' && doneCount) {
    return (
      <div className="card mx-auto max-w-lg p-8 text-center">
        <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-emerald-100 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-300">
          <CheckCircle2 size={28} />
        </div>
        <h2 className="text-xl font-bold">Import complete</h2>
        <p className="mt-1 text-slate-500 dark:text-slate-400">
          {doneCount.n} {doneCount.target === 'transactions' ? 'transactions' : 'loans'} were saved.
        </p>
        <div className="mt-6 flex justify-center gap-2">
          <button
            className="btn-secondary"
            onClick={() => {
              setStep('upload');
              setTables([]);
              setDoneCount(null);
            }}
          >
            Import another file
          </button>
          <Link to={doneCount.target === 'transactions' ? '/transactions' : '/loans'} className="btn-primary">
            View {doneCount.target === 'transactions' ? 'transactions' : 'loans'}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="Import data"
        subtitle="Bring in records from Excel, CSV or PDF — you'll review everything before it's saved"
        actions={
          step === 'map' && (
            <button className="btn-secondary" onClick={() => setStep('upload')}>
              <ArrowLeft size={16} /> Choose another file
            </button>
          )
        }
      />

      {step === 'upload' && (
        <div className="card card-pad">
          <button
            onClick={() => fileRef.current?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              const f = e.dataTransfer.files?.[0];
              if (f) onFile(f);
            }}
            className="flex w-full flex-col items-center rounded-2xl border-2 border-dashed border-slate-300 px-6 py-12 text-center transition hover:border-brand-400 hover:bg-brand-50/40 dark:border-white/15 dark:hover:bg-brand-500/5"
            disabled={parsing}
          >
            {parsing ? <Loader2 size={32} className="animate-spin text-brand-500" /> : <FileUp size={32} className="text-brand-500" />}
            <span className="mt-3 font-bold">{parsing ? 'Reading file…' : 'Choose a file or drop it here'}</span>
            <span className="mt-1 text-sm text-slate-500 dark:text-slate-400">Excel (.xlsx), CSV or PDF · bank statements, expense sheets, loan lists</span>
          </button>
          <input
            ref={fileRef}
            type="file"
            className="hidden"
            accept=".xlsx,.xlsm,.csv,.txt,.pdf,application/pdf,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) onFile(f);
              e.target.value = '';
            }}
          />
          {error && <p className="mt-4 rounded-xl bg-rose-50 p-3 text-sm font-medium text-rose-700 dark:bg-rose-500/10 dark:text-rose-300">{error}</p>}
          <div className="mt-5 grid gap-3 text-sm sm:grid-cols-3">
            {[
              ['1. Upload', 'We read the rows and detect the columns automatically.'],
              ['2. Map & review', 'Check the column mapping, fix any rows and skip duplicates.'],
              ['3. Confirm', 'Only the rows you approve are saved — expenses and loans stay separate.'],
            ].map(([t, d]) => (
              <div key={t} className="rounded-2xl bg-slate-50 p-3 dark:bg-white/5">
                <div className="font-semibold">{t}</div>
                <div className="text-slate-500 dark:text-slate-400">{d}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {step === 'map' && table && (
        <>
          <div className="card card-pad space-y-4">
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <FileSpreadsheet size={16} className="text-brand-500" />
              <span className="font-semibold">{fileName}</span>
              {tables.length > 1 && (
                <select className="input w-auto py-1.5" value={sheet} onChange={(e) => configure(tables, Number(e.target.value))} aria-label="Sheet">
                  {tables.map((t, i) => (
                    <option key={i} value={i}>
                      Sheet: {t.name} ({t.rows.length} rows)
                    </option>
                  ))}
                </select>
              )}
            </div>

            <div className="grid gap-4 lg:grid-cols-3">
              <div>
                <span className="label">Import as</span>
                <Segmented
                  className="w-full"
                  value={target}
                  onChange={(v) => {
                    setTarget(v);
                    resetDerived();
                  }}
                  options={[
                    { value: 'transactions', label: <span className="flex items-center justify-center gap-1.5"><ReceiptText size={14} /> Income & expenses</span> },
                    { value: 'loans', label: <span className="flex items-center justify-center gap-1.5"><HandCoins size={14} /> Loans (money lent)</span> },
                  ]}
                />
              </div>
              <div>
                <label className="label" htmlFor="hdr">Header row</label>
                <select
                  id="hdr"
                  className="input"
                  value={headerRow}
                  onChange={(e) => {
                    const h = Number(e.target.value);
                    setHeaderRow(h);
                    setTxMap(autoMap(table.rows[h] ?? [], TX_FIELDS.map((f) => f.key)));
                    setLoanMap(autoMap(table.rows[h] ?? [], LOAN_FIELDS.map((f) => f.key)));
                    resetDerived();
                  }}
                >
                  {table.rows.slice(0, 30).map((r, i) => (
                    <option key={i} value={i}>
                      Row {i + 1}: {r.filter(Boolean).slice(0, 4).join(' · ').slice(0, 60) || '(empty)'}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <span className="label">Dates in file are</span>
                <Segmented
                  className="w-full"
                  value={dateOrder}
                  onChange={(v) => {
                    setDateOrder(v);
                    resetDerived();
                  }}
                  options={[
                    { value: 'dmy', label: 'DD/MM/YYYY' },
                    { value: 'mdy', label: 'MM/DD/YYYY' },
                  ]}
                />
              </div>
            </div>

            <div>
              <span className="label">Column mapping</span>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {(target === 'transactions' ? TX_FIELDS : LOAN_FIELDS).map((f) => {
                  const map = (target === 'transactions' ? txMap : loanMap) as Record<string, number | undefined>;
                  return (
                    <label key={f.key} className="flex items-center gap-2 rounded-xl border border-slate-200 p-2 pl-3 text-sm dark:border-white/10">
                      <span className="min-w-0 flex-1 truncate font-medium" title={'hint' in f ? (f.hint as string) : undefined}>
                        {f.label}
                      </span>
                      <select
                        className={clsx('input w-[52%] py-1.5 text-xs', map[f.key] === undefined && 'text-slate-400')}
                        value={map[f.key] ?? ''}
                        onChange={(e) => {
                          const v = e.target.value === '' ? undefined : Number(e.target.value);
                          if (target === 'transactions') setTxMap((m) => ({ ...m, [f.key]: v }));
                          else setLoanMap((m) => ({ ...m, [f.key]: v }));
                          resetDerived();
                        }}
                      >
                        <option value="">— not in file —</option>
                        {headers.map((h, i) => (
                          <option key={i} value={i}>
                            {h}
                          </option>
                        ))}
                      </select>
                    </label>
                  );
                })}
              </div>
              {!hasRequired && (
                <p className="mt-2 text-sm font-medium text-amber-600">
                  {target === 'transactions' ? 'Map the date and an amount (or debit/credit) column to continue.' : 'Map borrower, amount lent and date lent to continue.'}
                </p>
              )}
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              {target === 'transactions' ? (
                <div>
                  <span className="label">Amounts without a type are</span>
                  <Segmented
                    className="w-full"
                    value={defaultType}
                    onChange={(v) => {
                      setDefaultType(v);
                      resetDerived();
                    }}
                    options={[
                      { value: 'expense', label: 'Expenses' },
                      { value: 'income', label: 'Income' },
                    ]}
                  />
                </div>
              ) : (
                <div>
                  <span className="label">Interest rates in file are</span>
                  <Segmented
                    className="w-full"
                    value={rateUnit}
                    onChange={setRateUnit}
                    options={[
                      { value: 'monthly', label: '% per month' },
                      { value: 'yearly', label: '% per year' },
                    ]}
                  />
                </div>
              )}
            </div>
          </div>

          {hasRequired && (
            <div className="card overflow-hidden">
              <div className="flex flex-wrap items-center justify-between gap-3 px-4 pt-4 sm:px-5">
                <div>
                  <h2 className="font-bold">Preview</h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    <span className="text-emerald-600">{counts.ok} ready</span> · <span className="text-amber-600">{counts.dup} possible duplicates (skipped unless ticked)</span> ·{' '}
                    <span className="text-rose-600">{counts.err} need fixing</span> — edit cells to correct them.
                  </p>
                </div>
                <div className="flex gap-2">
                  <button className="btn-ghost py-1.5 text-xs" onClick={() => setExcluded(Object.fromEntries(drafts.map((d) => [d.row, false])))}>
                    Select all
                  </button>
                  <button className="btn-ghost py-1.5 text-xs" onClick={() => setExcluded(Object.fromEntries(drafts.map((d) => [d.row, true])))}>
                    Select none
                  </button>
                </div>
              </div>
              <div className="mt-3 overflow-x-auto">
                {target === 'transactions' ? (
                  <table className="w-full min-w-[900px] text-sm">
                    <thead>
                      <tr className="border-y border-slate-100 bg-slate-50/70 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 dark:border-white/5 dark:bg-white/[0.02]">
                        <th className="w-10 px-3 py-2" />
                        <th className="px-2 py-2">Date</th>
                        <th className="px-2 py-2">Type</th>
                        <th className="px-2 py-2">Amount</th>
                        <th className="px-2 py-2">Category</th>
                        <th className="px-2 py-2">Description</th>
                        <th className="px-2 py-2">Method</th>
                        <th className="px-3 py-2">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50 dark:divide-white/[0.03]">
                      {(visible as TxDraft[]).map((d) => (
                        <tr key={d.row} className={clsx(!isIncluded(d) && 'opacity-50')}>
                          <td className="px-3 py-1.5">
                            <input type="checkbox" className="h-4 w-4 accent-brand-600" disabled={d.status === 'error'} checked={isIncluded(d)} onChange={(e) => setExcluded((x) => ({ ...x, [d.row]: !e.target.checked }))} aria-label={`Include row ${d.row + 1}`} />
                          </td>
                          <td className="px-2 py-1.5">
                            <input type="date" className="input px-2 py-1 text-xs" value={d.date} onChange={(e) => setTx(d.row, { date: e.target.value })} />
                          </td>
                          <td className="px-2 py-1.5">
                            <select className={clsx('input px-2 py-1 text-xs', d.type === 'income' ? 'text-emerald-600' : 'text-rose-600')} value={d.type} onChange={(e) => setTx(d.row, { type: e.target.value as TxType })}>
                              <option value="income">Income</option>
                              <option value="expense">Expense</option>
                            </select>
                          </td>
                          <td className="px-2 py-1.5">
                            <input type="number" min="0" step="0.01" className="input num w-28 px-2 py-1 text-xs" value={d.amount || ''} onChange={(e) => setTx(d.row, { amount: parseFloat(e.target.value) || 0 })} />
                          </td>
                          <td className="px-2 py-1.5">
                            <select className="input px-2 py-1 text-xs" value={d.category} onChange={(e) => setTx(d.row, { category: e.target.value })}>
                              {CATEGORIES.map((c) => (
                                <option key={c.name}>{c.name}</option>
                              ))}
                            </select>
                          </td>
                          <td className="px-2 py-1.5">
                            <input className="input min-w-[180px] px-2 py-1 text-xs" value={d.description} onChange={(e) => setTx(d.row, { description: e.target.value })} />
                          </td>
                          <td className="px-2 py-1.5">
                            <select className="input px-2 py-1 text-xs" value={d.paymentMethod} onChange={(e) => setTx(d.row, { paymentMethod: e.target.value as PaymentMethod })}>
                              {PAYMENT_METHODS.map((m) => (
                                <option key={m}>{m}</option>
                              ))}
                            </select>
                          </td>
                          <td className="px-3 py-1.5">
                            <StatusPill status={d.status} issues={d.issues} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <table className="w-full min-w-[900px] text-sm">
                    <thead>
                      <tr className="border-y border-slate-100 bg-slate-50/70 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 dark:border-white/5 dark:bg-white/[0.02]">
                        <th className="w-10 px-3 py-2" />
                        <th className="px-2 py-2">Borrower</th>
                        <th className="px-2 py-2">Mobile</th>
                        <th className="px-2 py-2">Amount lent</th>
                        <th className="px-2 py-2">Date lent</th>
                        <th className="px-2 py-2">Due date</th>
                        <th className="px-2 py-2">Rate %</th>
                        <th className="px-2 py-2">Repaid</th>
                        <th className="px-3 py-2">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50 dark:divide-white/[0.03]">
                      {(visible as LoanDraft[]).map((d) => (
                        <tr key={d.row} className={clsx(!isIncluded(d) && 'opacity-50')}>
                          <td className="px-3 py-1.5">
                            <input type="checkbox" className="h-4 w-4 accent-brand-600" disabled={d.status === 'error'} checked={isIncluded(d)} onChange={(e) => setExcluded((x) => ({ ...x, [d.row]: !e.target.checked }))} aria-label={`Include row ${d.row + 1}`} />
                          </td>
                          <td className="px-2 py-1.5">
                            <input className="input min-w-[130px] px-2 py-1 text-xs" value={d.borrowerName} onChange={(e) => setLoan(d.row, { borrowerName: e.target.value })} />
                          </td>
                          <td className="px-2 py-1.5">
                            <input className="input w-32 px-2 py-1 text-xs" value={d.phone} onChange={(e) => setLoan(d.row, { phone: e.target.value })} />
                          </td>
                          <td className="px-2 py-1.5">
                            <input type="number" min="0" className="input num w-28 px-2 py-1 text-xs" value={d.principal || ''} onChange={(e) => setLoan(d.row, { principal: parseFloat(e.target.value) || 0 })} />
                          </td>
                          <td className="px-2 py-1.5">
                            <input type="date" className="input px-2 py-1 text-xs" value={d.startDate} onChange={(e) => setLoan(d.row, { startDate: e.target.value })} />
                          </td>
                          <td className="px-2 py-1.5">
                            <input type="date" className="input px-2 py-1 text-xs" value={d.dueDate} onChange={(e) => setLoan(d.row, { dueDate: e.target.value })} />
                          </td>
                          <td className="px-2 py-1.5">
                            <input type="number" min="0" step="0.01" className="input num w-20 px-2 py-1 text-xs" value={d.interestRate} onChange={(e) => setLoan(d.row, { interestRate: parseFloat(e.target.value) || 0 })} />
                          </td>
                          <td className="px-2 py-1.5">
                            <input type="number" min="0" className="input num w-24 px-2 py-1 text-xs" value={d.repaid || ''} onChange={(e) => setLoan(d.row, { repaid: parseFloat(e.target.value) || 0 })} />
                          </td>
                          <td className="px-3 py-1.5">
                            <StatusPill status={d.status} issues={d.issues} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
              {drafts.length === 0 && <p className="px-5 py-8 text-center text-sm text-slate-500">No data rows found below the header row. Try choosing a different header row.</p>}
              {pages > 1 && (
                <div className="flex items-center justify-center gap-2 px-4 py-3 text-sm">
                  <button className="btn-ghost py-1" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>
                    ‹ Prev
                  </button>
                  <span>
                    Page {page + 1} / {pages}
                  </span>
                  <button className="btn-ghost py-1" disabled={page >= pages - 1} onClick={() => setPage((p) => p + 1)}>
                    Next ›
                  </button>
                </div>
              )}
              <div className="sticky bottom-0 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 bg-white px-4 py-3 dark:border-white/5 dark:bg-ink-850 sm:px-5">
                <span className="text-sm">
                  <b>{selected.length}</b> {target === 'transactions' ? 'transactions' : 'loans'} selected · {formatINR(selectedTotal)}
                </span>
                <button className="btn-primary" disabled={!selected.length || saving} onClick={confirmImport}>
                  {saving ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />} Import {selected.length} records
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
