// app/data.ts

import type { Booking, BookingSource, BookingStatus, Guest } from "./types";

// ─── ROOMS ───
export const rooms: { number: string; type: string; floor: number }[] = [
  { number: "101", type: "Standard Room", floor: 1 },
  { number: "102", type: "Executive Suite", floor: 1 },
  { number: "103", type: "Deluxe Room", floor: 1 },
  { number: "104", type: "Deluxe Room", floor: 1 },
  { number: "105", type: "Deluxe Room", floor: 1 },
  { number: "106", type: "Deluxe Room", floor: 1 },
  { number: "107", type: "Deluxe Room", floor: 1 },
  { number: "108", type: "Deluxe Room", floor: 1 },
  { number: "109", type: "Deluxe Room", floor: 1 },
  { number: "110", type: "Family Room", floor: 1 },
  { number: "111", type: "Family Room", floor: 1 },
  { number: "201", type: "Deluxe Room", floor: 2 },
  { number: "202", type: "Deluxe Room", floor: 2 },
  { number: "203", type: "Superior King", floor: 2 },
  { number: "204", type: "Superior King", floor: 2 },
];

// ─── HELPERS ───
function guest(
  name: string,
  phone: string,
  email: string,
  pincode: string,
  city: string,
  state: string,
  address: string,
  idType?: Guest["idType"],
  idNumber?: string
): Guest {
  return { name, phone, email, address, city, state, pincode, idType, idNumber };
}

// ─── SEED BOOKINGS ───
export const bookings: Booking[] = [
  {
    id: "SNBOOKING_34523_9961197299",
    otaId: "0187182316",
    otaPin: "q4NU*QO",
    primaryGuest: guest("Mark Stallon S", "6361599339", "3807780@example.com", "560073", "Bengaluru", "Karnataka", "12, MG Road, Bengaluru", "Aadhaar", "XXXX-XXXX-4821"),
    additionalGuests: [],
    source: "goibibo",
    roomNumber: "101",
    roomType: "Family Room",
    ratePlan: "EP",
    checkIn: "2026-09-12",
    checkOut: "2026-09-13",
    bookingMadeOn: "2026-09-12",
    status: "CHECKED-IN",
    amount: 1648.24,
    tax: 78.49,
    payments: [{ id: "P1", amount: 1648.24, method: "OTA Prepaid", date: "2026-09-12", reference: "GIB-8827361" }],
    adults: 2,
    children: 0,
    infants: 0,
    notes: "Checked in at 01:52 PM",
  },
];

// ─── STATUS COLORS ───
export const statusColors: Record<BookingStatus, string> = {
  CONFIRMED: "bg-amber-400 text-navy",
  "CHECKED-IN": "bg-emerald-500 text-white",
  "CHECKED-OUT": "bg-rose-500 text-white",
  "PENDING DEPARTURE": "bg-rose-500 text-white",
  BLOCKED: "bg-blue-500 text-white",
  CANCELLED: "bg-gray-300 text-navy line-through",
  "ON-HOLD": "bg-purple-400 text-white",
};

// ─── STATUS LABELS ───
export const statusLabels: Record<BookingStatus, string> = {
  CONFIRMED: "CONFIRMED",
  "CHECKED-IN": "CHECKED-IN",
  "CHECKED-OUT": "CHECKED OUT",
  "PENDING DEPARTURE": "DUE OUT",
  BLOCKED: "BLOCKED",
  CANCELLED: "CANCELLED",
  "ON-HOLD": "ON HOLD",
};

// ─── SOURCE COLORS ───
export const sourceColors: Record<BookingSource, string> = {
  agoda: "bg-teal-500",
  makemytrip: "bg-amber-400",
  expedia: "bg-blue-500",
  booking: "bg-indigo-500",
  goibibo: "bg-orange-500",
  cleartrip: "bg-purple-500",
  ixigo: "bg-pink-500",
  hyperguest: "bg-cyan-500",
  direct: "bg-emerald-600",
};

// ─── INVENTORY / RATES ───
export type RoomCategory = {
  name: string;
  totalRooms: number;
  ratePlans: { code: string; label: string }[];
};

export const roomCategories: RoomCategory[] = [
  { name: "Deluxe Room", totalRooms: 8, ratePlans: [{ code: "EP", label: "EP" }, { code: "CP", label: "CP" }] },
  { name: "Superior King Room", totalRooms: 2, ratePlans: [{ code: "EP", label: "EP" }, { code: "CP", label: "CP" }] },
  { name: "Executive Suite Room", totalRooms: 1, ratePlans: [{ code: "EP", label: "EP" }, { code: "CP", label: "CP" }] },
  { name: "Family Room", totalRooms: 4, ratePlans: [{ code: "EP", label: "EP" }, { code: "CP", label: "CP" }] },
];

export const baseRates: Record<string, Record<string, number>> = {
  "Deluxe Room": { EP: 2310, CP: 3150 },
  "Superior King Room": { EP: 2415, CP: 3150 },
  "Executive Suite Room": { EP: 2625, CP: 3150 },
  "Family Room": { EP: 5250, CP: 3150 },
};

export const rateOverrides: Record<string, number> = {
  "2026-09-13_Deluxe Room_EP": 3150,
  "2026-09-14_Deluxe Room_EP": 3000,
  "2026-09-15_Deluxe Room_EP": 3000,
  "2026-09-16_Deluxe Room_EP": 2200,
  "2026-09-17_Deluxe Room_EP": 2200,
  "2026-09-13_Superior King Room_EP": 3150,
  "2026-09-14_Superior King Room_EP": 3000,
  "2026-09-15_Superior King Room_EP": 3000,
};
