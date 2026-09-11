```tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "../supabase";

type Hotel = {
  id: string;
  name: string;
  address: string | null;
  phone: string | null;
  email: string | null;
};

type RoomType = {
  id: string;
  name: string;
  base_price: number;
};

type Room = {
  id: string;
  hotel_id: string;
  room_type_id: string | null;
  room_number: string;
  floor: number | null;
  status: string;
  notes: string | null;
  room_type?: RoomType | null;
};

type Guest = {
  id: string;
  hotel_id: string;
  first_name: string;
  last_name: string;
  phone: string | null;
};

type Reservation = {
  id: string;
  hotel_id: string;
  room_id: string;
  guest_id: string;
  check_in: string;
  check_out: string;
  adults: number;
  children: number;
  status: string;
  total_amount: number;
  paid_amount: number;
  special_requests: string | null;
  guest?: Guest | null;
  room?: Room | null;
};

const HOTEL_ID = "3a455cbe-ac87-4599-866e-d1da35318a22";

function getGuestName(guest: Guest | null | undefined) {
  if (!guest) return "Unknown Guest";

  return `${guest.first_name || ""} ${guest.last_name || ""}`.trim() || "Guest";
}

function formatDate(date: string) {
  if (!date) return "-";

  return new Date(date).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatCurrency(value: number) {
  return `₹${Number(value || 0).toLocaleString("en-IN")}`;
}

export default function Home() {
  const [hotel, setHotel] = useState<Hotel | null>(null);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [guests, setGuests] = useState<Guest[]>([]);
  const [reservations, setReservations] = useState<Reservation[]>([]);

  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const [showReservationModal, setShowReservationModal] = useState(false);
  const [showBlockModal, setShowBlockModal] = useState(false);
  const [selectedRoom, setSelectedRoom] = useState<Room | null>(null);

  const [guestFirstName, setGuestFirstName] = useState("");
  const [guestLastName, setGuestLastName] = useState("");
  const [guestPhone, setGuestPhone] = useState("");

  const [checkIn, setCheckIn] = useState("");
  const [checkOut, setCheckOut] = useState("");
  const [adults, setAdults] = useState(1);
  const [children, setChildren] = useState(0);
  const [specialRequests, setSpecialRequests] = useState("");

  const [blockReason, setBlockReason] = useState("");
  const [blockStart, setBlockStart] = useState("");
  const [blockEnd, setBlockEnd] = useState("");

  const [saving, setSaving] = useState(false);

  async function loadData() {
    setLoading(true);
    setError("");

    try {
      const [
        hotelResult,
        roomsResult,
        guestsResult,
        reservationsResult,
      ] = await Promise.all([
        supabase
          .from("hotels")
          .select("id, name, address, phone, email")
          .eq("id", HOTEL_ID)
          .single(),

        supabase
          .from("rooms")
          .select(
            "id, hotel_id, room_type_id, room_number, floor, status, notes, room_type:room_types(id, name, base_price)"
          )
          .eq("hotel_id", HOTEL_ID)
          .order("room_number"),

        supabase
          .from("guests")
          .select("id, hotel_id, first_name, last_name, phone")
          .eq("hotel_id", HOTEL_ID)
          .order("first_name"),

        supabase
          .from("reservations")
          .select(
            `
              id,
              hotel_id,
              room_id,
              guest_id,
              check_in,
              check_out,
              adults,
              children,
              status,
              total_amount,
              paid_amount,
              special_requests,
              guest:guests(
                id,
                hotel_id,
                first_name,
                last_name,
                phone
              ),
              room:rooms(
                id,
                hotel_id,
                room_type_id,
                room_number,
                floor,
                status,
                notes
              )
            `
          )
          .eq("hotel_id", HOTEL_ID)
          .order("check_in", { ascending: false }),
      ]);

      if (hotelResult.error) throw hotelResult.error;
      if (roomsResult.error) throw roomsResult.error;
      if (guestsResult.error) throw guestsResult.error;
      if (reservationsResult.error) throw reservationsResult.error;

      setHotel(hotelResult.data);
      setRooms((roomsResult.data || []) as unknown as Room[]);
      setGuests(guestsResult.data || []);
      setReservations((reservationsResult.data || []) as unknown as Reservation[]);
    } catch (err: any) {
      setError(err?.message || "Unable to load hotel data.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  const totalRooms = rooms.length;

  const availableRooms = rooms.filter(
    (room) => room.status === "available"
  ).length;

  const occupiedRooms = rooms.filter(
    (room) => room.status === "occupied"
  ).length;

  const blockedRooms = rooms.filter(
    (room) =>
      room.status === "blocked" || room.status === "maintenance"
  ).length;

  const dueBalance = useMemo(() => {
    return reservations.reduce((total, reservation) => {
      const balance =
        Number(reservation.total_amount || 0) -
        Number(reservation.paid_amount || 0);

      return total + Math.max(balance, 0);
    }, 0);
  }, [reservations]);

  function openReservation(room: Room) {
    setSelectedRoom(room);
    setGuestFirstName("");
    setGuestLastName("");
    setGuestPhone("");
    setCheckIn("");
    setCheckOut("");
    setAdults(1);
    setChildren(0);
    setSpecialRequests("");
    setMessage("");
    setError("");
    setShowReservationModal(true);
  }

  function openBlock(room: Room) {
    setSelectedRoom(room);
    setBlockReason("");
    setBlockStart("");
    setBlockEnd("");
    setMessage("");
    setError("");
    setShowBlockModal(true);
  }

  async function createReservation() {
    if (!selectedRoom) return;

    if (!guestFirstName.trim()) {
      setError("Please enter guest first name.");
      return;
    }

    if (!guestLastName.trim()) {
      setError("Please enter guest last name.");
      return;
    }

    if (!checkIn || !checkOut) {
      setError("Please select check-in and check-out dates.");
      return;
    }

    if (new Date(checkOut) <= new Date(checkIn)) {
      setError("Check-out must be after check-in.");
      return;
    }

    setSaving(true);
    setError("");
    setMessage("");

    try {
      let guest: Guest | null = null;

      if (guestPhone.trim()) {
        const existingGuest = await supabase
          .from("guests")
          .select("id, hotel_id, first_name, last_name, phone")
          .eq("hotel_id", HOTEL_ID)
          .eq("phone", guestPhone.trim())
          .maybeSingle();

        if (existingGuest.error) {
          throw existingGuest.error;
        }

        guest = existingGuest.data;
      }

      if (!guest) {
        const newGuest = await supabase
          .from("guests")
          .insert({
            hotel_id: HOTEL_ID,
            first_name: guestFirstName.trim(),
            last_name: guestLastName.trim(),
            phone: guestPhone.trim() || null,
          })
          .select("id, hotel_id, first_name, last_name, phone")
          .single();

        if (newGuest.error) {
          throw newGuest.error;
        }

        guest = newGuest.data;
      } else {
        const updatedGuest = await supabase
          .from("guests")
          .update({
            first_name: guestFirstName.trim(),
            last_name: guestLastName.trim(),
            phone: guestPhone.trim() || null,
          })
          .eq("id", guest.id)
          .select("id, hotel_id, first_name, last_name, phone")
          .single();

        if (updatedGuest.error) {
          throw updatedGuest.error;
        }

        guest = updatedGuest.data;
      }

      const rate = Number(
        selectedRoom.room_type?.base_price || 0
      );

      const checkInDate = new Date(checkIn);
      const checkOutDate = new Date(checkOut);

      const nights = Math.max(
        1,
        Math.ceil(
          (checkOutDate.getTime() - checkInDate.getTime()) /
            (1000 * 60 * 60 * 24)
        )
      );

      const totalAmount = rate * nights;

      const reservationInsert = await supabase
        .from("reservations")
        .insert({
          hotel_id: HOTEL_ID,
          room_id: selectedRoom.id,
          guest_id: guest.id,
          check_in: checkIn,
          check_out: checkOut,
          adults,
          children,
          status: "confirmed",
          total_amount: totalAmount,
          paid_amount: 0,
          special_requests: specialRequests.trim() || null,
        })
        .select()
        .single();

      if (reservationInsert.error) {
        throw reservationInsert.error;
      }

      setShowReservationModal(false);
      setSelectedRoom(null);

      setMessage(
        `Reservation created successfully for Room ${selectedRoom.room_number}.`
      );

      await loadData();
    } catch (err: any) {
      setError(err?.message || "Unable to create reservation.");
    } finally {
      setSaving(false);
    }
  }

  async function blockRoom() {
    if (!selectedRoom) return;

    if (!blockStart || !blockEnd) {
      setError("Please select block start and end dates.");
      return;
    }

    if (new Date(blockEnd) <= new Date(blockStart)) {
      setError("Block end date must be after start date.");
      return;
    }

    setSaving(true);
    setError("");
    setMessage("");

    try {
      const blockResult = await supabase
        .from("room_blocks")
        .insert({
          hotel_id: HOTEL_ID,
          room_id: selectedRoom.id,
          start_date: blockStart,
          end_date: blockEnd,
          reason: blockReason.trim() || "Room blocked",
        });

      if (blockResult.error) {
        throw blockResult.error;
      }

      const roomResult = await supabase
        .from("rooms")
        .update({
          status: "blocked",
        })
        .eq("id", selectedRoom.id);

      if (roomResult.error) {
        throw roomResult.error;
      }

      setShowBlockModal(false);
      setSelectedRoom(null);

      setMessage(
        `Room ${selectedRoom.room_number} has been blocked successfully.`
      );

      await loadData();
    } catch (err: any) {
      setError(err?.message || "Unable to block room.");
    } finally {
      setSaving(false);
    }
  }

  async function refreshData() {
    setMessage("");
    setError("");
    await loadData();
    setMessage("Data refreshed successfully.");
  }

  function statusLabel(status: string) {
    switch (status) {
      case "available":
        return "Available";
      case "occupied":
        return "Occupied";
      case "cleaning":
        return "Cleaning";
      case "blocked":
        return "Blocked";
      case "maintenance":
        return "Maintenance";
      default:
        return status;
    }
  }

  function statusClass(status: string) {
    switch (status) {
      case "available":
        return "bg-green-100 text-green-700";
      case "occupied":
        return "bg-red-100 text-red-700";
      case "cleaning":
        return "bg-yellow-100 text-yellow-700";
      case "blocked":
        return "bg-gray-200 text-gray-700";
      case "maintenance":
        return "bg-orange-100 text-orange-700";
      default:
        return "bg-gray-100 text-gray-700";
    }
  }

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <div className="flex min-h-screen">
        {/* SIDEBAR */}
        <aside className="hidden w-64 border-r border-slate-200 bg-white lg:block">
          <div className="border-b border-slate-200 p-6">
            <div className="text-2xl font-bold text-slate-900">
              Staynexa
            </div>

            <div className="mt-1 text-sm text-slate-500">
              Hotel PMS
            </div>
          </div>

          <nav className="p-4">
            {[
              "Dashboard",
              "Reservations",
              "Calendar",
              "Guests",
              "Rooms",
              "Check-In",
              "Check-Out",
              "Housekeeping",
              "Reports",
            ].map((item, index) => (
              <button
                key={item}
                className={`mb-1 w-full rounded-lg px-4 py-3 text-left text-sm font-medium transition ${
                  index === 0
                    ? "bg-slate-900 text-white"
                    : "text-slate-600 hover:bg-slate-100"
                }`}
              >
                {item}
              </button>
            ))}
          </nav>
        </aside>

        {/* MAIN */}
        <section className="flex-1">
          {/* HEADER */}
          <header className="border-b border-slate-200 bg-white">
            <div className="flex items-center justify-between px-5 py-5 lg:px-8">
              <div>
                <h1 className="text-2xl font-bold">
                  {hotel?.name || "Staynexa"}
                </h1>

                <p className="mt-1 text-sm text-slate-500">
                  Front Office
                </p>
              </div>

              <button
                onClick={refreshData}
                className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold hover:bg-slate-50"
              >
                Refresh
              </button>
            </div>
          </header>

          <div className="p-5 lg:p-8">
            {/* ALERTS */}
            {error && (
              <div className="mb-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                <strong>Error:</strong> {error}
              </div>
            )}

            {message && (
              <div className="mb-5 rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-700">
                {message}
              </div>
            )}

            {/* DASHBOARD TITLE */}
            <div className="mb-6">
              <h2 className="text-xl font-bold">
                Dashboard
              </h2>

              <p className="mt-1 text-sm text-slate-500">
                Manage rooms, reservations and front-office operations.
              </p>
            </div>

            {/* STAT CARDS */}
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="text-sm text-slate-500">
                  Total Rooms
                </div>

                <div className="mt-2 text-3xl font-bold">
                  {totalRooms}
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="text-sm text-slate-500">
                  Available
                </div>

                <div className="mt-2 text-3xl font-bold text-green-600">
                  {availableRooms}
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="text-sm text-slate-500">
                  Occupied
                </div>

                <div className="mt-2 text-3xl font-bold text-red-600">
                  {occupiedRooms}
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="text-sm text-slate-500">
                  Due Balance
                </div>

                <div className="mt-2 text-3xl font-bold">
                  {formatCurrency(dueBalance)}
                </div>
              </div>
            </div>

            {/* ROOM STATUS */}
            <section className="mt-8">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold">
                    Room Status
                  </h2>

                  <p className="text-sm text-slate-500">
                    {totalRooms} rooms · {blockedRooms} blocked
                  </p>
                </div>
              </div>

              {loading ? (
                <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-slate-500">
                  Loading rooms...
                </div>
              ) : rooms.length === 0 ? (
                <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-slate-500">
                  No rooms found.
                </div>
              ) : (
                <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
                  {rooms.map((room) => (
                    <div
                      key={room.id}
                      className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="text-lg font-bold">
                            Room {room.room_number}
                          </div>

                          <div className="text-sm text-slate-500">
                            Floor {room.floor ?? "-"}
                          </div>
                        </div>

                        <span
                          className={`rounded-full px-3 py-1 text-xs font-semibold ${statusClass(
                            room.status
                          )}`}
                        >
                          {statusLabel(room.status)}
                        </span>
                      </div>

                      <div className="mt-5 space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-slate-500">
                            Type
                          </span>

                          <span className="font-medium">
                            {room.room_type?.name || "Not assigned"}
                          </span>
                        </div>

                        <div className="flex justify-between">
                          <span className="text-slate-500">
                            Rate
                          </span>

                          <span className="font-semibold">
                            {formatCurrency(
                              Number(
                                room.room_type?.base_price || 0
                              )
                            )}
                          </span>
                        </div>
                      </div>

                      <div className="mt-5 flex gap-2">
                        <button
                          onClick={() => openReservation(room)}
                          disabled={room.status !== "available"}
                          className="flex-1 rounded-lg bg-slate-900 px-3 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
                        >
                          Reserve
                        </button>

                        <button
                          onClick={() => openBlock(room)}
                          disabled={
                            room.status === "occupied"
                          }
                          className="flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm font-semibold hover:bg-slate-50 disabled:cursor-not-allowed disabled:bg-slate-100"
                        >
                          Block Room
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* RESERVATIONS */}
            <section className="mt-8">
              <div className="mb-4">
                <h2 className="text-xl font-bold">
                  Reservations
                </h2>

                <p className="text-sm text-slate-500">
                  Recent reservations and guest information.
                </p>
              </div>

              <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                {reservations.length === 0 ? (
                  <div className="p-8 text-center text-slate-500">
                    No reservations found.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[900px] text-sm">
                      <thead className="border-b border-slate-200 bg-slate-50">
                        <tr>
                          <th className="px-5 py-4 text-left font-semibold">
                            Guest
                          </th>

                          <th className="px-5 py-4 text-left font-semibold">
                            Room
                          </th>

                          <th className="px-5 py-4 text-left font-semibold">
                            Check-In
                          </th>

                          <th className="px-5 py-4 text-left font-semibold">
                            Check-Out
                          </th>

                          <th className="px-5 py-4 text-left font-semibold">
                            Status
                          </th>

                          <th className="px-5 py-4 text-right font-semibold">
                            Balance
                          </th>
                        </tr>
                      </thead>

                      <tbody>
                        {reservations.map((reservation) => {
                          const balance =
                            Number(reservation.total_amount || 0) -
                            Number(reservation.paid_amount || 0);

                          return (
                            <tr
                              key={reservation.id}
                              className="border-b border-slate-100 last:border-0"
                            >
                              <td className="px-5 py-4">
                                <div className="font-semibold">
                                  {getGuestName(
                                    reservation.guest
                                  )}
                                </div>

                                <div className="text-xs text-slate-500">
                                  {reservation.guest?.phone || "-"}
                                </div>
                              </td>

                              <td className="px-5 py-4">
                                Room{" "}
                                {reservation.room?.room_number ||
                                  "-"}
                              </td>

                              <td className="px-5 py-4">
                                {formatDate(
                                  reservation.check_in
                                )}
                              </td>

                              <td className="px-5 py-4">
                                {formatDate(
                                  reservation.check_out
                                )}
                              </td>

                              <td className="px-5 py-4">
                                <span className="rounded-full bg-yellow-100 px-3 py-1 text-xs font-semibold text-yellow-700">
                                  {reservation.status}
                                </span>
                              </td>

                              <td className="px-5 py-4 text-right font-semibold">
                                {formatCurrency(
                                  Math.max(balance, 0)
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </section>
          </div>
        </section>
      </div>

      {/* RESERVATION MODAL */}
      {showReservationModal && selectedRoom && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 p-6">
              <div>
                <h2 className="text-xl font-bold">
                  Create Reservation
                </h2>

                <p className="mt-1 text-sm text-slate-500">
                  Room {selectedRoom.room_number} ·{" "}
                  {selectedRoom.room_type?.name || "Room"}
                </p>
              </div>

              <button
                onClick={() => setShowReservationModal(false)}
                className="rounded-lg px-3 py-2 text-xl text-slate-500 hover:bg-slate-100"
              >
                ×
              </button>
            </div>

            <div className="space-y-5 p-6">
              <div>
                <h3 className="mb-3 font-semibold">
                  Guest Details
                </h3>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-sm font-medium">
                      First Name
                    </label>

                    <input
                      value={guestFirstName}
                      onChange={(e) =>
                        setGuestFirstName(e.target.value)
                      }
                      placeholder="First name"
                      className="w-full rounded-lg border border-slate-300 px-3 py-2.5 outline-none focus:border-slate-900"
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-sm font-medium">
                      Last Name
                    </label>

                    <input
                      value={guestLastName}
                      onChange={(e) =>
                        setGuestLastName(e.target.value)
                      }
                      placeholder="Last name"
                      className="w-full rounded-lg border border-slate-300 px-3 py-2.5 outline-none focus:border-slate-900"
                    />
                  </div>
                </div>

                <div className="mt-4">
                  <label className="mb-1 block text-sm font-medium">
                    Phone
                  </label>

                  <input
                    value={guestPhone}
                    onChange={(e) =>
                      setGuestPhone(e.target.value)
                    }
                    placeholder="Phone number"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2.5 outline-none focus:border-slate-900"
                  />
                </div>
              </div>

              <div>
                <h3 className="mb-3 font-semibold">
                  Stay Details
                </h3>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-sm font-medium">
                      Check-In
                    </label>

                    <input
                      type="date"
                      value={checkIn}
                      onChange={(e) =>
                        setCheckIn(e.target.value)
                      }
                      className="w-full rounded-lg border border-slate-300 px-3 py-2.5 outline-none focus:border-slate-900"
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-sm font-medium">
                      Check-Out
                    </label>

                    <input
                      type="date"
                      value={checkOut}
                      onChange={(e) =>
                        setCheckOut(e.target.value)
                      }
                      className="w-full rounded-lg border border-slate-300 px-3 py-2.5 outline-none focus:border-slate-900"
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-sm font-medium">
                      Adults
                    </label>

                    <input
                      type="number"
                      min="1"
                      value={adults}
                      onChange={(e) =>
                        setAdults(Number(e.target.value))
                      }
                      className="w-full rounded-lg border border-slate-300 px-3 py-2.5 outline-none focus:border-slate-900"
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-sm font-medium">
                      Children
                    </label>

                    <input
                      type="number"
                      min="0"
                      value={children}
                      onChange={(e) =>
                        setChildren(Number(e.target.value))
                      }
                      className="w-full rounded-lg border border-slate-300 px-3 py-2.5 outline-none focus:border-slate-900"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium">
                  Special Requests
                </label>

                <textarea
                  value={specialRequests}
                  onChange={(e) =>
                    setSpecialRequests(e.target.value)
                  }
                  placeholder="Any special requests..."
                  rows={3}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2.5 outline-none focus:border-slate-900"
                />
              </div>

              <div className="rounded-xl bg-slate-50 p-4">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">
                    Room Rate
                  </span>

                  <span className="font-semibold">
                    {formatCurrency(
                      Number(
                        selectedRoom.room_type?.base_price || 0
                      )
                    )}
                  </span>
                </div>

                <div className="mt-2 flex justify-between text-sm">
                  <span className="text-slate-500">
                    Guest
                  </span>

                  <span className="font-semibold">
                    {guestFirstName || guestLastName
                      ? `${guestFirstName} ${guestLastName}`.trim()
                      : "-"}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 border-t border-slate-200 p-6">
              <button
                onClick={() =>
                  setShowReservationModal(false)
                }
                className="rounded-lg border border-slate-300 px-5 py-2.5 text-sm font-semibold hover:bg-slate-50"
              >
                Cancel
              </button>

              <button
                onClick={createReservation}
                disabled={saving}
                className="rounded-lg bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400"
              >
                {saving ? "Creating..." : "Create Reservation"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* BLOCK ROOM MODAL */}
      {showBlockModal && selectedRoom && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 p-6">
              <div>
                <h2 className="text-xl font-bold">
                  Block Room {selectedRoom.room_number}
                </h2>

                <p className="mt-1 text-sm text-slate-500">
                  Prevent this room from being reserved.
                </p>
              </div>

              <button
                onClick={() => setShowBlockModal(false)}
                className="rounded-lg px-3 py-2 text-xl text-slate-500 hover:bg-slate-100"
              >
                ×
              </button>
            </div>

            <div className="space-y-4 p-6">
              <div>
                <label className="mb-1 block text-sm font-medium">
                  Start Date
                </label>

                <input
                  type="date"
                  value={blockStart}
                  onChange={(e) =>
                    setBlockStart(e.target.value)
                  }
                  className="w-full rounded-lg border border-slate-300 px-3 py-2.5 outline-none focus:border-slate-900"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium">
                  End Date
                </label>

                <input
                  type="date"
                  value={blockEnd}
                  onChange={(e) =>
                    setBlockEnd(e.target.value)
                  }
                  className="w-full rounded-lg border border-slate-300 px-3 py-2.5 outline-none focus:border-slate-900"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium">
                  Reason
                </label>

                <textarea
                  value={blockReason}
                  onChange={(e) =>
                    setBlockReason(e.target.value)
                  }
                  placeholder="Maintenance, owner use, renovation, etc."
                  rows={3}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2.5 outline-none focus:border-slate-900"
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 border-t border-slate-200 p-6">
              <button
                onClick={() => setShowBlockModal(false)}
                className="rounded-lg border border-slate-300 px-5 py-2.5 text-sm font-semibold hover:bg-slate-50"
              >
                Cancel
              </button>

              <button
                onClick={blockRoom}
                disabled={saving}
                className="rounded-lg bg-red-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:bg-red-300"
              >
                {saving ? "Blocking..." : "Block Room"}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
```
