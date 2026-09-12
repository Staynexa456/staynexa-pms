// app/types.ts

export type Guest = {
  name: string;
  phone: string;
  email: string;
  address: string;
  city: string;
  state: string;
  pincode: string;
  idType?: "Aadhaar" | "PAN" | "Passport" | "Driving License" | "Voter ID";
  idNumber?: string;
};

export type Payment = {
  id: string;
  amount: number;
  method: "Cash" | "Card" | "UPI" | "Bank Transfer" | "OTA Prepaid";
  date: string; // ISO date
  reference?: string;
  note?: string;
};

export type BookingStatus =
  | "CONFIRMED"
  | "CHECKED-IN"
  | "CHECKED-OUT"
  | "PENDING DEPARTURE"
  | "BLOCKED"
  | "CANCELLED";

export type BookingSource =
  | "agoda"
  | "makemytrip"
  | "expedia"
  | "booking"
  | "goibibo"
  | "direct";

export type Booking = {
  id: string;
  otaId?: string;
  otaPin?: string;
  primaryGuest: Guest;
  additionalGuests: Guest[];
  source: BookingSource;
  roomNumber: string;
  roomType: string;
  ratePlan: string;
  checkIn: string; // YYYY-MM-DD
  checkOut: string; // YYYY-MM-DD
  bookingMadeOn: string;
  status: BookingStatus;
  amount: number; // total with tax
  tax: number; // total tax portion
  payments: Payment[];
  adults: number;
  children: number;
  infants?: number;
  notes?: string;
};

// Convenience helpers used everywhere
export const emptyGuest: Guest = {
  name: "",
  phone: "",
  email: "",
  address: "",
  city: "",
  state: "",
  pincode: "",
  idType: undefined,
  idNumber: "",
};

// Computed helpers
export function getPaid(b: Booking): number {
  return b.payments.reduce((sum, p) => sum + p.amount, 0);
}

export function getBalance(b: Booking): number {
  return Math.max(0, b.amount - getPaid(b));
}

export function getPrimaryGuestName(b: Booking): string {
  return b.primaryGuest?.name || "—";
}

export function getPrimaryGuestPhone(b: Booking): string {
  return b.primaryGuest?.phone || "—";
}
