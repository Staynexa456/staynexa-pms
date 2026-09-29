// app/lib/roles.ts

export type UserRole = "owner" | "admin" | "manager" | "receptionist" | "housekeeping";

export type Permission =
  | "view_dashboard"
  | "manage_bookings"
  | "checkin_checkout"
  | "manage_rates"
  | "manage_rooms"
  | "manage_housekeeping"
  | "manage_users"
  | "manage_hotel"
  | "view_reports"
  | "manage_settings"
  | "manage_payments"
  | "manage_channel";

// ═══════════════════════════════════════════════
// ROLE LABELS
// ═══════════════════════════════════════════════
export const ROLE_LABELS: Record<UserRole, { label: string; icon: string; color: string; desc: string }> = {
  owner: {
    label: "Owner",
    icon: "👑",
    color: "purple",
    desc: "Full access to everything",
  },
  admin: {
    label: "Admin",
    icon: "🛡️",
    color: "blue",
    desc: "Full access except removing owner",
  },
  manager: {
    label: "Manager",
    icon: "💼",
    color: "teal",
    desc: "Bookings, rates, reports, housekeeping",
  },
  receptionist: {
    label: "Receptionist",
    icon: "🛎️",
    color: "amber",
    desc: "Bookings, check-in/out, guests, payments",
  },
  housekeeping: {
    label: "Housekeeping",
    icon: "🧹",
    color: "green",
    desc: "Room cleaning status only",
  },
};

// ═══════════════════════════════════════════════
// PERMISSIONS MATRIX
// ═══════════════════════════════════════════════
export const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  owner: [
    "view_dashboard",
    "manage_bookings",
    "checkin_checkout",
    "manage_rates",
    "manage_rooms",
    "manage_housekeeping",
    "manage_users",
    "manage_hotel",
    "view_reports",
    "manage_settings",
    "manage_payments",
    "manage_channel",
  ],
  admin: [
    "view_dashboard",
    "manage_bookings",
    "checkin_checkout",
    "manage_rates",
    "manage_rooms",
    "manage_housekeeping",
    "manage_users",
    "manage_hotel",
    "view_reports",
    "manage_settings",
    "manage_payments",
    "manage_channel",
  ],
  manager: [
    "view_dashboard",
    "manage_bookings",
    "checkin_checkout",
    "manage_rates",
    "manage_rooms",
    "manage_housekeeping",
    "view_reports",
    "manage_payments",
    "manage_channel",
  ],
  receptionist: [
    "view_dashboard",
    "manage_bookings",
    "checkin_checkout",
    "manage_housekeeping",
    "manage_payments",
  ],
  housekeeping: [
    "manage_housekeeping",
  ],
};

// ═══════════════════════════════════════════════
// PERMISSION CHECK
// ═══════════════════════════════════════════════
export function hasPermission(role: UserRole | null | undefined, permission: Permission): boolean {
  if (!role) return false;
  const perms = ROLE_PERMISSIONS[role];
  if (!perms) return false;
  return perms.includes(permission);
}

export function hasAnyPermission(role: UserRole | null | undefined, permissions: Permission[]): boolean {
  return permissions.some((p) => hasPermission(role, p));
}

// ═══════════════════════════════════════════════
// USER TYPE
// ═══════════════════════════════════════════════
export type HotelUser = {
  id: string;
  hotel_id: string;
  user_id: string | null;
  email: string;
  name: string | null;
  phone: string | null;
  role: UserRole;
  status: "active" | "pending" | "revoked";
  invite_token?: string | null;
  invite_expires_at?: string | null;
  last_login_at?: string | null;
  created_at: string;
  updated_at: string;
};
