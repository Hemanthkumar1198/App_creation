import {
  Banknote,
  Briefcase,
  Car,
  CircleEllipsis,
  Clapperboard,
  Fuel,
  Gift,
  HeartPulse,
  Home,
  Laptop,
  LineChart,
  Plane,
  Receipt,
  RotateCcw,
  ShoppingBag,
  User,
  UtensilsCrossed,
  type LucideIcon,
} from 'lucide-react';
import type { PaymentMethod, TxType } from '../types';

export interface CategoryDef {
  name: string;
  icon: LucideIcon;
  /** Tailwind classes for the icon chip */
  tone: string;
  kinds: TxType[];
}

export const CATEGORIES: CategoryDef[] = [
  { name: 'Salary', icon: Briefcase, tone: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300', kinds: ['income'] },
  { name: 'Business', icon: Banknote, tone: 'bg-teal-100 text-teal-700 dark:bg-teal-500/15 dark:text-teal-300', kinds: ['income'] },
  { name: 'Freelance', icon: Laptop, tone: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-500/15 dark:text-cyan-300', kinds: ['income'] },
  { name: 'Refund', icon: RotateCcw, tone: 'bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300', kinds: ['income'] },
  { name: 'Food', icon: UtensilsCrossed, tone: 'bg-orange-100 text-orange-700 dark:bg-orange-500/15 dark:text-orange-300', kinds: ['expense'] },
  { name: 'Shopping', icon: ShoppingBag, tone: 'bg-pink-100 text-pink-700 dark:bg-pink-500/15 dark:text-pink-300', kinds: ['expense'] },
  { name: 'Travel', icon: Plane, tone: 'bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300', kinds: ['expense'] },
  { name: 'Petrol/Fuel', icon: Fuel, tone: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300', kinds: ['expense'] },
  { name: 'Bills', icon: Receipt, tone: 'bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300', kinds: ['expense'] },
  { name: 'Rent', icon: Home, tone: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-300', kinds: ['expense', 'income'] },
  { name: 'Entertainment', icon: Clapperboard, tone: 'bg-fuchsia-100 text-fuchsia-700 dark:bg-fuchsia-500/15 dark:text-fuchsia-300', kinds: ['expense'] },
  { name: 'Medical', icon: HeartPulse, tone: 'bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300', kinds: ['expense'] },
  { name: 'Investment', icon: LineChart, tone: 'bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300', kinds: ['expense', 'income'] },
  { name: 'Personal', icon: User, tone: 'bg-purple-100 text-purple-700 dark:bg-purple-500/15 dark:text-purple-300', kinds: ['expense', 'income'] },
  { name: 'Gift', icon: Gift, tone: 'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300', kinds: ['expense', 'income'] },
  { name: 'Other', icon: CircleEllipsis, tone: 'bg-slate-100 text-slate-700 dark:bg-slate-500/15 dark:text-slate-300', kinds: ['expense', 'income'] },
];

const FALLBACK: CategoryDef = { name: 'Other', icon: Car, tone: 'bg-slate-100 text-slate-700 dark:bg-slate-500/15 dark:text-slate-300', kinds: ['expense', 'income'] };

export function categoryDef(name: string): CategoryDef {
  return CATEGORIES.find((c) => c.name === name) ?? { ...FALLBACK, name };
}

export function categoriesFor(type: TxType): CategoryDef[] {
  return CATEGORIES.filter((c) => c.kinds.includes(type));
}

export const PAYMENT_METHODS: PaymentMethod[] = ['Cash', 'UPI', 'Bank Transfer', 'Debit Card', 'Credit Card', 'Cheque', 'Other'];
