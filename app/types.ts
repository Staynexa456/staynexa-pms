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
  date: string;
  reference?: string;
  note?: string;
};

export type BookingStatus =
  | "CONFIRMED"
  | "CHECKED-IN"
  | "CHECKED-OUT"
  | "PENDING DEPARTURE"
  | "BLOCKED"
  | "CANCELLED"
  | "ON-HOLD";

export type BookingSource =
  | "agoda"
  | "makemytrip"
  | "expedia"
  | "booking"
  | "goibibo"
  | "cleartrip"
  | "ixigo"
  | "hyperguest"
  | "direct";

export type Booking = {
  id: string;
  bookingRef?: string;
  otaId?: string;
  otaPin?: string;
  roomId?: string;
  // ... rest of your existing fields
};

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

export function getPaid(b: Booking): number {
  if (!b || !b.payments || !Array.isArray(b.payments)) return 0;
  return b.payments.reduce((sum, p) => sum + (p?.amount || 0), 0);
}

export function getBalance(b: Booking): number {
  if (!b) return 0;
  return Math.max(0, (b.amount || 0) - getPaid(b));
}
export function getPrimaryGuestName(b: Booking): string {
  return b.primaryGuest?.name || "—";
}

export function getPrimaryGuestPhone(b: Booking): string {
  return b.primaryGuest?.phone || "—";
}
