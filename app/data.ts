// app/data.ts
// Static data: status labels, colors, legend items

// ═══════════════════════════════════════════════
// BOOKING STATUS LABELS
// ═══════════════════════════════════════════════

export const statusLabels: Record<string, string> = {
  'CONFIRMED': 'Confirmed',
  'CHECKED-IN': 'Checked In',
  'CHECKED-OUT': 'Checked Out',
  'PENDING DEPARTURE': 'Pending Departure',
  'BLOCKED': 'Blocked',
  'CANCELLED': 'Cancelled',
  'ON-HOLD': 'On Hold',
};

// ═══════════════════════════════════════════════
// BOOKING STATUS COLORS
// ═══════════════════════════════════════════════

export const statusColors: Record<string, string> = {
  'CONFIRMED': 'bg-amber-100 text-amber-800',
  'CHECKED-IN': 'bg-emerald-100 text-emerald-800',
  'CHECKED-OUT': 'bg-rose-100 text-rose-800',
  'PENDING DEPARTURE': 'bg-rose-100 text-rose-800',
  'BLOCKED': 'bg-blue-100 text-blue-800',
  'CANCELLED': 'bg-gray-200 text-gray-600',
  'ON-HOLD': 'bg-purple-100 text-purple-800',
};

// ═══════════════════════════════════════════════
// LEGEND ITEMS
// ═══════════════════════════════════════════════

export const legendItems = [
  { label: 'Confirmed', color: 'bg-amber-400' },
  { label: 'Checked-in', color: 'bg-emerald-500' },
  { label: 'Checked-out / Due out', color: 'bg-rose-500' },
  { label: 'Blocked', color: 'bg-blue-500' },
  { label: 'Cancelled', color: 'bg-gray-300' },
  { label: 'On hold', color: 'bg-purple-400' },
];

// ═══════════════════════════════════════════════
// STATUS BAR CLASSES
// ═══════════════════════════════════════════════

export const statusBarClass: Record<string, string> = {
  'CONFIRMED': 'bar-confirmed',
  'CHECKED-IN': 'bar-checkedin',
  'CHECKED-OUT': 'bar-checkedout',
  'PENDING DEPARTURE': 'bar-checkedout',
  'BLOCKED': 'bar-blocked',
  'CANCELLED': 'bar-cancelled',
  'ON-HOLD': 'bar-onhold',
};

// ═══════════════════════════════════════════════
// DATE RANGE FILTERS
// ═══════════════════════════════════════════════

export type DateRangeFilter =
  | 'All'
  | 'Today'
  | 'This Week'
  | 'Next 7 Days'
  | 'Next 14 Days'
  | 'This Month';

export const RANGE_OPTIONS: DateRangeFilter[] = [
  'All',
  'Today',
  'This Week',
  'Next 7 Days',
  'Next 14 Days',
  'This Month',
];