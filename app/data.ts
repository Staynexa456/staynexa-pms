// app/data.ts

export type Booking = {
  id: string;
  otaId?: string;
  otaPin?: string;
  guest: string;
  phone: string;
  email?: string;
  source: "agoda" | "makemytrip" | "expedia" | "booking" | "goibibo" | "direct";
  roomNumber: string;
  roomType: string;
  ratePlan: string;
  checkIn: string;
  checkOut: string;
  bookingMadeOn: string;
  status:
    | "CONFIRMED"
    | "CHECKED-IN"
    | "CHECKED-OUT"
    | "PENDING DEPARTURE"
    | "BLOCKED"
    | "CANCELLED";
  amount: number;
  paid: number;
  tax: number;
  adults: number;
  children: number;
  infants?: number;
  notes?: string;
  guestList?: string[];
};

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

export const bookings: Booking[] = [
  {
    id: "SNBOOKING_34523_9961197299",
    otaId: "0187182316",
    otaPin: "q4NU*QO",
    guest: "Mark Stallon S",
    phone: "6361599339",
    email: "3807780@example.com",
    source: "goibibo",
    roomNumber: "101",
    roomType: "Family Room",
    ratePlan: "EP",
    checkIn: "2026-09-12",
    checkOut: "2026-09-13",
    bookingMadeOn: "2026-09-12",
    status: "CHECKED-IN",
    amount: 1648.24,
    paid: 1648.24,
    tax: 78.49,
    adults: 2,
    children: 0,
    infants: 0,
    guestList: ["Mark Stallon S"],
  },
  {
    id: "SNBOOKING_34523_9961197300",
    guest: "Vinay Verma",
    phone: "91 9886143941",
    email: "vinay@example.com",
    source: "agoda",
    roomNumber: "102",
    roomType: "Executive Suite",
    ratePlan: "EP",
    checkIn: "2026-09-13",
    checkOut: "2026-09-16",
    bookingMadeOn: "2026-09-11",
    status: "CONFIRMED",
    amount: 1842.75,
    paid: 0,
    tax: 88,
    adults: 2,
    children: 0,
    guestList: ["Vinay Verma"],
  },
  {
    id: "SNBOOKING_34523_9961197301",
    guest: "Tamil Selvan",
    phone: "NA",
    email: "tamil@example.com",
    source: "makemytrip",
    roomNumber: "103",
    roomType: "Deluxe Room",
    ratePlan: "CP",
    checkIn: "2026-09-13",
    checkOut: "2026-09-14",
    bookingMadeOn: "2026-09-12",
    status: "CONFIRMED",
    amount: 2050.91,
    paid: 0,
    tax: 100,
    adults: 2,
    children: 0,
    guestList: ["Tamil Selvan"],
  },
  {
    id: "SNBOOKING_34523_9961197302",
    guest: "Ankit Kumar",
    phone: "11111111111",
    source: "expedia",
    roomNumber: "105",
    roomType: "Deluxe Room",
    ratePlan: "EP",
    checkIn: "2026-09-14",
    checkOut: "2026-09-18",
    bookingMadeOn: "2026-09-12",
    status: "CONFIRMED",
    amount: 7607.25,
    paid: 0,
    tax: 380,
    adults: 2,
    children: 1,
  },
  {
    id: "SNBOOKING_34523_9961197303",
    guest: "Mir Ali Moheeb",
    phone: "NA",
    source: "makemytrip",
    roomNumber: "107",
    roomType: "Deluxe Room",
    ratePlan: "CP",
    checkIn: "2026-09-13",
    checkOut: "2026-09-19",
    bookingMadeOn: "2026-09-10",
    status: "CHECKED-IN",
    amount: 20212.5,
    paid: 15000,
    tax: 1010,
    adults: 2,
    children: 0,
  },
  {
    id: "SNBOOKING_34523_9961197304",
    guest: "Saikiran D",
    phone: "918098014393",
    source: "agoda",
    roomNumber: "108",
    roomType: "Deluxe Room",
    ratePlan: "EP",
    checkIn: "2026-09-13",
    checkOut: "2026-09-15",
    bookingMadeOn: "2026-09-12",
    status: "PENDING DEPARTURE",
    amount: 5118.75,
    paid: 5118.75,
    tax: 255,
    adults: 2,
    children: 0,
  },
  {
    id: "SNBOOKING_34523_9961197305",
    guest: "Jasmine Jestin",
    phone: "NA",
    source: "booking",
    roomNumber: "110",
    roomType: "Family Room",
    ratePlan: "CP",
    checkIn: "2026-09-15",
    checkOut: "2026-09-18",
    bookingMadeOn: "2026-09-13",
    status: "CONFIRMED",
    amount: 8400,
    paid: 0,
    tax: 420,
    adults: 3,
    children: 2,
  },
  {
    id: "SNBOOKING_34523_9961197306",
    guest: "Naveen Kumar",
    phone: "9845678910",
    source: "direct",
    roomNumber: "201",
    roomType: "Deluxe Room",
    ratePlan: "EP",
    checkIn: "2026-09-14",
    checkOut: "2026-09-17",
    bookingMadeOn: "2026-09-13",
    status: "CHECKED-IN",
    amount: 4500,
    paid: 4500,
    tax: 225,
    adults: 1,
    children: 0,
  },
  {
    id: "SNBOOKING_34523_9961197307",
    guest: "Priyanshu Sahu",
    phone: "9876543210",
    source: "agoda",
    roomNumber: "202",
    roomType: "Deluxe Room",
    ratePlan: "CP",
    checkIn: "2026-09-16",
    checkOut: "2026-09-20",
    bookingMadeOn: "2026-09-13",
    status: "CONFIRMED",
    amount: 6800,
    paid: 0,
    tax: 340,
    adults: 2,
    children: 0,
  },
  {
    id: "SNBOOKING_34523_9961197308",
    guest: "Divyashree Shetty",
    phone: "NA",
    source: "makemytrip",
    roomNumber: "203",
    roomType: "Superior King",
    ratePlan: "EP",
    checkIn: "2026-09-15",
    checkOut: "2026-09-19",
    bookingMadeOn: "2026-09-12",
    status: "CONFIRMED",
    amount: 9200,
    paid: 0,
    tax: 460,
    adults: 2,
    children: 0,
  },
  {
    id: "SNBOOKING_34523_9961197309",
    guest: "Akash Shetty",
    phone: "9988776655",
    source: "direct",
    roomNumber: "106",
    roomType: "Deluxe Room",
    ratePlan: "CP",
    checkIn: "2026-09-12",
    checkOut: "2026-09-17",
    bookingMadeOn: "2026-09-10",
    status: "CHECKED-IN",
    amount: 5500,
    paid: 3000,
    tax: 275,
    adults: 2,
    children: 1,
  },
  {
    id: "BLK-2001",
    guest: "Blocked — Maintenance",
    phone: "NA",
    source: "direct",
    roomNumber: "104",
    roomType: "Deluxe Room",
    ratePlan: "—",
    checkIn: "2026-09-14",
    checkOut: "2026-09-17",
    bookingMadeOn: "2026-09-13",
    status: "BLOCKED",
    amount: 0,
    paid: 0,
    tax: 0,
    adults: 0,
    children: 0,
    notes: "AC servicing",
  },
  {
    id: "BLK-2002",
    guest: "Blocked — Hold",
    phone: "NA",
    source: "direct",
    roomNumber: "111",
    roomType: "Family Room",
    ratePlan: "—",
    checkIn: "2026-09-16",
    checkOut: "2026-09-18",
    bookingMadeOn: "2026-09-13",
    status: "BLOCKED",
    amount: 0,
    paid: 0,
    tax: 0,
    adults: 0,
    children: 0,
    notes: "Waiting for confirmation",
  },
  {
    id: "SNBOOKING_34523_9961197310",
    guest: "Ramesh B",
    phone: "9900112233",
    source: "direct",
    roomNumber: "109",
    roomType: "Deluxe Room",
    ratePlan: "EP",
    checkIn: "2026-09-12",
    checkOut: "2026-09-14",
    bookingMadeOn: "2026-09-11",
    status: "CHECKED-OUT",
    amount: 3200,
    paid: 3200,
    tax: 160,
    adults: 1,
    children: 0,
  },
];

export const statusColors: Record<Booking["status"], string> = {
  CONFIRMED: "bg-amber-400 text-navy",
  "CHECKED-IN": "bg-emerald-500 text-white",
  "CHECKED-OUT": "bg-rose-500 text-white",
  "PENDING DEPARTURE": "bg-rose-500 text-white",
  BLOCKED: "bg-blue-500 text-white",
  CANCELLED: "bg-gray-300 text-navy line-through",
};

export const statusLabels: Record<Booking["status"], string> = {
  CONFIRMED: "CONFIRMED",
  "CHECKED-IN": "CHECKED-IN",
  "CHECKED-OUT": "CHECKED OUT",
  "PENDING DEPARTURE": "DUE OUT",
  BLOCKED: "BLOCKED",
  CANCELLED: "CANCELLED",
};

export const sourceColors: Record<Booking["source"], string> = {
  agoda: "bg-teal-500",
  makemytrip: "bg-amber-400",
  expedia: "bg-blue-500",
  booking: "bg-indigo-500",
  goibibo: "bg-orange-500",
  direct: "bg-emerald-600",
};

// ─── INVENTORY / RATES ───

export type RoomCategory = {
  name: string;
  totalRooms: number;
  ratePlans: { code: string; label: string }[];
};

export const roomCategories: RoomCategory[] = [
  {
    name: "Deluxe Room",
    totalRooms: 8,
    ratePlans: [
      { code: "EP", label: "EP" },
      { code: "CP", label: "CP" },
    ],
  },
  {
    name: "Superior King Room",
    totalRooms: 2,
    ratePlans: [
      { code: "EP", label: "EP" },
      { code: "CP", label: "CP" },
    ],
  },
  {
    name: "Executive Suite Room",
    totalRooms: 1,
    ratePlans: [
      { code: "EP", label: "EP" },
      { code: "CP", label: "CP" },
    ],
  },
  {
    name: "Family Room",
    totalRooms: 4,
    ratePlans: [
      { code: "EP", label: "EP" },
      { code: "CP", label: "CP" },
    ],
  },
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
