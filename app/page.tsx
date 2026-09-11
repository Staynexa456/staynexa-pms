```tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "../supabase";

type RoomStatus =
  | "available"
  | "occupied"
  | "cleaning"
  | "blocked"
  | "maintenance";

type Room = {
  id: string;
  hotel_id: string;
  room_type_id: string | null;
  room_no: string;
  floor: number;
  status: RoomStatus;
  notes?: string | null;
  roomTypeName: string;
  price: number;
};

type Guest = {
  id: string;
  hotel_id: string;
  first_name: string;
  last_name: string;
  phone: string;
  email?: string | null;
};

type Reservation = {
  id: string;
  hotel_id: string;
  guest_id: string;
  room_id: string;
  reservation_number: string;
  check_in: string;
  check_out: string;
  adults: number;
  children: number;
  status: string;
  room_rate: number;
  discount: number;
  tax: number;
  total_amount: number;
  paid_amount: number;
  due_amount: number;
  source?: string | null;
  special_requests?: string | null;
  guestName: string;
  guestPhone: string;
  roomNo: string;
};

type RoomType = {
  id: string;
  hotel_id: string;
  name: string;
  description?: string | null;
  max_guests: number;
  base_price: number;
};

const statusLabel: Record<string, string> = {
  available: "Available",
  occupied: "Occupied",
  cleaning: "Cleaning",
  blocked: "Blocked",
  maintenance: "Maintenance",
  confirmed: "Confirmed",
  "checked-in": "Checked-in",
  "checked-out": "Checked-out",
};

function roomStatusColor(status: RoomStatus) {
  switch (status) {
    case "available":
      return "bg-emerald-100 text-emerald-700";
    case "occupied":
      return "bg-blue-100 text-blue-700";
    case "cleaning":
      return "bg-amber-100 text-amber-700";
    case "blocked":
      return "bg-red-100 text-red-700";
    case "maintenance":
      return "bg-purple-100 text-purple-700";
    default:
      return "bg-slate-100 text-slate-700";
  }
}

function reservationColor(status: string) {
  switch (status) {
    case "checked-in":
      return "border-emerald-400 bg-emerald-50";
    case "checked-out":
      return "border-red-400 bg-red-50";
    case "confirmed":
      return "border-yellow-400 bg-yellow-50";
    default:
      return "border-slate-300 bg-white";
  }
}

function money(value: number) {
  return `₹${Number(value || 0).toLocaleString("en-IN")}`;
}

export default function Home() {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [roomTypes, setRoomTypes] = useState<RoomType[]>([]);
  const [guests, setGuests] = useState<Guest[]>([]);
  const [reservations, setReservations] = useState<Reservation[]>([]);

  const [hotelId, setHotelId] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState("Dashboard");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [showReservation, setShowReservation] = useState(false);

  const [guestName, setGuestName] = useState("");
  const [guestPhone, setGuestPhone] = useState("");
  const [guestEmail, setGuestEmail] = useState("");
  const [selectedRoom, setSelectedRoom] = useState("");
  const [checkIn, setCheckIn] = useState("");
  const [checkOut, setCheckOut] = useState("");
  const [adults, setAdults] = useState("1");
  const [children, setChildren] = useState("0");

  const availableRooms = rooms.filter(
    (room) => room.status === "available"
  );

  const occupiedRooms = rooms.filter(
    (room) => room.status === "occupied"
  );

  const blockedRooms = rooms.filter(
    (room) => room.status === "blocked"
  );

  const totalDue = useMemo(
    () =>
      reservations.reduce(
        (total, reservation) =>
          total + Number(reservation.due_amount || 0),
        0
      ),
    [reservations]
  );

  async function loadData() {
    try {
      setLoading(true);
      setError("");

      const { data: hotels, error: hotelError } = await supabase
        .from("hotels")
        .select("id")
        .limit(1);
```
