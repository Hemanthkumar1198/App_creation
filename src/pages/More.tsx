import { BarChart3, ChevronRight, FileUp, Search, Settings, TrendingUp } from 'lucide-react';
import { Link } from 'react-router-dom';
import { InstallCard } from '../components/InstallCard';
import { PageHeader } from '../components/ui/common';

const LINKS = [
  { to: '/investments', label: 'Investments & Insurance', desc: 'SIP, LIC, term insurance, premiums', icon: TrendingUp, cls: 'bg-emerald-100 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-300' },
  { to: '/reports', label: 'Reports', desc: 'Daily, weekly, monthly, yearly + export', icon: BarChart3, cls: 'bg-brand-100 text-brand-600 dark:bg-brand-500/15 dark:text-brand-300' },
  { to: '/import', label: 'Import data', desc: 'From Excel, CSV or PDF', icon: FileUp, cls: 'bg-sky-100 text-sky-600 dark:bg-sky-500/15 dark:text-sky-300' },
  { to: '/search', label: 'Search', desc: 'Find any entry, person or amount', icon: Search, cls: 'bg-amber-100 text-amber-600 dark:bg-amber-500/15 dark:text-amber-300' },
  { to: '/settings', label: 'Settings', desc: 'Account, backup, Trash, reminders', icon: Settings, cls: 'bg-slate-100 text-slate-600 dark:bg-white/10 dark:text-slate-300' },
];

/** Phone menu for sections that don't fit in the bottom bar. */
export default function More() {
  return (
    <div className="space-y-4">
      <PageHeader title="More" />
      <div className="card divide-y divide-slate-100 overflow-hidden dark:divide-white/5">
        {LINKS.map((l) => (
          <Link key={l.to} to={l.to} className="flex items-center gap-3 px-4 py-3.5 hover:bg-slate-50 dark:hover:bg-white/5">
            <span className={`grid h-11 w-11 place-items-center rounded-2xl ${l.cls}`}>
              <l.icon size={20} />
            </span>
            <div className="min-w-0 flex-1">
              <div className="font-semibold">{l.label}</div>
              <div className="text-xs text-slate-500 dark:text-slate-400">{l.desc}</div>
            </div>
            <ChevronRight size={18} className="text-slate-400" />
          </Link>
        ))}
      </div>
      <div className="card card-pad">
        <h2 className="mb-3 font-bold">Install app</h2>
        <InstallCard />
      </div>
    </div>
  );
}
