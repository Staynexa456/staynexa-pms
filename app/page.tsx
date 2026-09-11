"use client";

import { useEffect, useState } from "react";
import { supabase } from "../supabase";

type RoomStatus =
  | "available"
  | "occupied"
  | "cleaning"
  | "blocked"
  | "maintenance";

type Hotel = {
  id: string;
  name: string;
  address: string | null;
  phone: string | null;
  email: string | null;
};

type Room = {
  id: string;
  hotel_id: string;
  room_type_id: string | null;
  room_no: string;
  floor: number;
  status: RoomStatus;
  notes: string | null;
  roomTypeName: string;
  price: number;
};

type Reservation = {
  id: string;
  guest_id: string | null;
  room_id: string | null;
  check_in: string;
  check_out: string;
  status: string;
  adults: number | null;
  children: number | null;
  total_amount: number | null;
  paid_amount: number | null;
  special_requests: string | null;
};

type Guest = {
  id: string;
  first_name: string;
  last_name: string | null;
  phone: string | null;
};

const HOTEL_ID = "3a455cbe-ac87-4599-866e-d1da35318a22";

function money(value: number) {
  return "₹" + Number(value || 0).toLocaleString("en-IN");
}

function statusLabel(status: RoomStatus) {
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

function statusClass(status: RoomStatus) {
  switch (status) {
    case "available":
      return "bg-green-100 text-green-700 border-green-200";
    case "occupied":
      return "bg-blue-100 text-blue-700 border-blue-200";
    case "cleaning":
      return "bg-yellow-100 text-yellow-700 border-yellow-200";
    case "blocked":
      return "bg-red-100 text-red-700 border-red-200";
    case "maintenance":
      return "bg-purple-100 text-purple-700 border-purple-200";
    default:
      return "bg-gray-100 text-gray-700 border-gray-200";
  }
}

function getFirstAndLastName(fullName: string) {
  const parts = fullName.trim().split(/\s+/);

  const firstName = parts.shift() || "";
  const lastName = parts.join(" ");

  return {
    firstName,
    lastName,
  };
}

function guestDisplayName(guest: Guest) {
  return `${guest.first_name || ""} ${guest.last_name || ""}`.trim() || "Guest";
}

export default function Home() {
  const [hotel, setHotel] = useState<Hotel | null>(null);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [guests, setGuests] = useState<Guest[]>([]);

  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  const [selectedRoom, setSelectedRoom] = useState<Room | null>(null);

  const [showBlockModal, setShowBlockModal] = useState(false);
  const [showReservationModal, setShowReservationModal] = useState(false);

  const [blockReason, setBlockReason] = useState("");
  const [blockLoading, setBlockLoading] = useState(false);

  const [guestName, setGuestName] = useState("");
  const [guestPhone, setGuestPhone] = useState("");

  const [checkIn, setCheckIn] = useState("");
  const [checkOut, setCheckOut] = useState("");

  const [adults, setAdults] = useState("1");
  const [children, setChildren] = useState("0");

  const [reservationLoading, setReservationLoading] = useState(false);

  async function loadData() {
    try {
      setLoading(true);
      setMessage("");

      const hotelResult = await supabase
        .from("hotels")
        .select("id, name, address, phone, email")
        .eq("id", HOTEL_ID)
        .maybeSingle();

      if (hotelResult.error) {
        throw new Error(hotelResult.error.message);
      }

      setHotel(hotelResult.data);

      const roomResult = await supabase
        .from("rooms")
        .select(
          "id, hotel_id, room_type_id, room_number, floor, status, notes"
        )
        .eq("hotel_id", HOTEL_ID)
        .order("room_number");

      if (roomResult.error) {
        throw new Error(roomResult.error.message);
      }

      const roomTypeIds = Array.from(
        new Set(
          (roomResult.data || [])
            .map((room) => room.room_type_id)
            .filter(Boolean)
        )
      );

      let roomTypes: {
        id: string;
        name: string;
        base_price: number | null;
      }[] = [];

      if (roomTypeIds.length > 0) {
        const roomTypeResult = await supabase
          .from("room_types")
          .select("id, name, base_price")
          .in("id", roomTypeIds);

        if (!roomTypeResult.error) {
          roomTypes = roomTypeResult.data || [];
        }
      }

      const mappedRooms: Room[] = (roomResult.data || []).map((room) => {
        const roomType = roomTypes.find(
          (type) => type.id === room.room_type_id
        );

        return {
          id: room.id,
          hotel_id: room.hotel_id,
          room_type_id: room.room_type_id,
          room_no: room.room_number,
          floor: room.floor,
          status: room.status as RoomStatus,
          notes: room.notes,
          roomTypeName: roomType?.name || "Room",
          price: Number(roomType?.base_price || 0),
        };
      });

      setRooms(mappedRooms);

      const reservationResult = await supabase
        .from("reservations")
        .select(
          "id, guest_id, room_id, check_in, check_out, status, adults, children, total_amount, paid_amount, special_requests"
        )
        .eq("hotel_id", HOTEL_ID)
        .order("check_in", { ascending: true });

      if (reservationResult.error) {
        throw new Error(reservationResult.error.message);
      }

      setReservations(reservationResult.data || []);

      const guestResult = await supabase
        .from("guests")
        .select("id, first_name, last_name, phone")
        .eq("hotel_id", HOTEL_ID);

      if (!guestResult.error) {
        setGuests(guestResult.data || []);
      }
    } catch (error) {
      console.error(error);

      setMessage(
        error instanceof Error
          ? error.message
          : "Something went wrong while loading data."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  async function toggleBlock(room: Room) {
    const newStatus: RoomStatus =
      room.status === "blocked" ? "available" : "blocked";

    const question =
      newStatus === "blocked"
        ? `Do you want to block room ${room.room_no}?`
        : `Do you want to unblock room ${room.room_no}?`;

    const confirmed = window.confirm(question);

    if (!confirmed) {
      return;
    }

    setMessage("");

    const { error } = await supabase
      .from("rooms")
      .update({
        status: newStatus,
        notes:
          newStatus === "blocked"
            ? blockReason || "Room blocked from PMS"
            : null,
      })
      .eq("id", room.id);

    if (error) {
      setMessage(error.message);
      return;
    }

    setShowBlockModal(false);
    setBlockReason("");

    await loadData();
  }

  async function blockRoom() {
    if (!selectedRoom) {
      return;
    }

    setBlockLoading(true);
    setMessage("");

    const { error } = await supabase
      .from("rooms")
      .update({
        status: "blocked",
        notes: blockReason || "Room blocked",
      })
      .eq("id", selectedRoom.id);

    setBlockLoading(false);

    if (error) {
      setMessage(error.message);
      return;
    }

    setShowBlockModal(false);
    setSelectedRoom(null);
    setBlockReason("");

    await loadData();
  }

  async function createReservation() {
    if (!selectedRoom) {
      return;
    }

    if (!guestName.trim()) {
      setMessage("Please enter guest name.");
      return;
    }

    if (!checkIn || !checkOut) {
      setMessage("Please select check-in and check-out dates.");
      return;
    }

    if (checkOut <= checkIn) {
      setMessage("Check-out date must be after check-in date.");
      return;
    }

    setReservationLoading(true);
    setMessage("");

    try {
      let guestId: string | null = null;

      const existingGuest = guests.find(
        (guest) =>
          guest.phone &&
          guestPhone &&
          guest.phone.trim() === guestPhone.trim()
      );

      const { firstName, lastName } = getFirstAndLastName(guestName);

      if (existingGuest) {
        guestId = existingGuest.id;

        const { error: guestUpdateError } = await supabase
          .from("guests")
          .update({
            first_name: firstName,
            last_name: lastName || null,
            phone: guestPhone.trim() || null,
          })
          .eq("id", existingGuest.id);

        if (guestUpdateError) {
          throw new Error(guestUpdateError.message);
        }
      } else {
        const { data: newGuest, error: guestError } = await supabase
          .from("guests")
          .insert({
            hotel_id: HOTEL_ID,
            first_name: firstName,
            last_name: lastName || null,
            phone: guestPhone.trim() || null,
          })
          .select("id")
          .single();

        if (guestError) {
          throw new Error(guestError.message);
        }

        guestId = newGuest.id;
      }

      const { error: reservationError } = await supabase
        .from("reservations")
        .insert({
          hotel_id: HOTEL_ID,
          guest_id: guestId,
          room_id: selectedRoom.id,
          check_in: checkIn,
          check_out: checkOut,
          status: "confirmed",
          adults: Number(adults || 1),
          children: Number(children || 0),
          total_amount: selectedRoom.price,
          paid_amount: 0,
          special_requests: null,
        });

      if (reservationError) {
        throw new Error(reservationError.message);
      }

      setShowReservationModal(false);
      setSelectedRoom(null);

      setGuestName("");
      setGuestPhone("");
      setCheckIn("");
      setCheckOut("");
      setAdults("1");
      setChildren("0");

      await loadData();

      setMessage("Reservation created successfully.");
    } catch (error) {
      console.error(error);

      setMessage(
        error instanceof Error
          ? error.message
          : "Unable to create reservation."
      );
    } finally {
      setReservationLoading(false);
    }
  }

  const totalRooms = rooms.length;

  const availableRooms = rooms.filter(
    (room) => room.status === "available"
  ).length;

  const occupiedRooms = rooms.filter(
    (room) => room.status === "occupied"
  ).length;

  const blockedRooms = rooms.filter(
    (room) => room.status === "blocked"
  ).length;

  const dueBalance = reservations.reduce((total, reservation) => {
    const totalAmount = Number(reservation.total_amount || 0);
    const paidAmount = Number(reservation.paid_amount || 0);

    return total + Math.max(totalAmount - paidAmount, 0);
  }, 0);

  function guestNameForReservation(reservation: Reservation) {
    if (!reservation.guest_id) {
      return "Guest";
    }

    const guest = guests.find(
      (guest) => guest.id === reservation.guest_id
    );

    if (!guest) {
      return "Guest";
    }

    return guestDisplayName(guest);
  }

  function roomNumberForReservation(reservation: Reservation) {
    if (!reservation.room_id) {
      return "Unassigned";
    }

    return (
      rooms.find((room) => room.id === reservation.room_id)?.room_no ||
      "Room"
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <header className="border-b bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5">
          <div>
            <div className="text-2xl font-bold tracking-tight">
              Staynexa
            </div>

            <div className="mt-1 text-sm text-slate-500">
              {hotel?.name || "Hotel PMS"}
            </div>
          </div>

          <div className="rounded-full bg-slate-100 px-4 py-2 text-sm font-medium">
            Front Office
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-6 py-8">
        {message && (
          <div className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {message}
          </div>
        )}

        <section className="mb-8">
          <h1 className="text-3xl font-bold">Dashboard</h1>

          <p className="mt-1 text-sm text-slate-500">
            Manage rooms, reservations and front-office operations.
          </p>
        </section>

        <section className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-2xl border bg-white p-5 shadow-sm">
            <div className="text-sm text-slate-500">
              Total Rooms
            </div>

            <div className="mt-2 text-3xl font-bold">
              {totalRooms}
            </div>
          </div>

          <div className="rounded-2xl border bg-white p-5 shadow-sm">
            <div className="text-sm text-slate-500">
              Available
            </div>

            <div className="mt-2 text-3xl font-bold text-green-600">
              {availableRooms}
            </div>
          </div>

          <div className="rounded-2xl border bg-white p-5 shadow-sm">
            <div className="text-sm text-slate-500">
              Occupied
            </div>

            <div className="mt-2 text-3xl font-bold text-blue-600">
              {occupiedRooms}
            </div>
          </div>

          <div className="rounded-2xl border bg-white p-5 shadow-sm">
            <div className="text-sm text-slate-500">
              Due Balance
            </div>

            <div className="mt-2 text-3xl font-bold text-orange-600">
              {money(dueBalance)}
            </div>
          </div>
        </section>

        <section className="mb-8 rounded-2xl border bg-white shadow-sm">
          <div className="flex flex-col gap-4 border-b px-6 py-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-xl font-bold">
                Room Status
              </h2>

              <p className="mt-1 text-sm text-slate-500">
                {totalRooms} rooms · {blockedRooms} blocked
              </p>
            </div>

            <button
              onClick={loadData}
              className="rounded-lg border px-4 py-2 text-sm font-medium hover:bg-slate-50"
            >
              Refresh
            </button>
          </div>

          <div className="p-6">
            {loading ? (
              <div className="py-12 text-center text-sm text-slate-500">
                Loading rooms...
              </div>
            ) : rooms.length === 0 ? (
              <div className="rounded-xl border border-dashed p-12 text-center">
                <div className="text-lg font-semibold">
                  No rooms found
                </div>

                <div className="mt-2 text-sm text-slate-500">
                  Add rooms in Supabase and refresh this page.
                </div>
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {rooms.map((room) => (
                  <div
                    key={room.id}
                    className="rounded-2xl border p-5 transition hover:shadow-md"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-xl font-bold">
                          Room {room.room_no}
                        </div>

                        <div className="mt-1 text-sm text-slate-500">
                          Floor {room.floor}
                        </div>
                      </div>

                      <span
                        className={`rounded-full border px-3 py-1 text-xs font-semibold ${statusClass(
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
                          {room.roomTypeName}
                        </span>
                      </div>

                      <div className="flex justify-between">
                        <span className="text-slate-500">
                          Rate
                        </span>

                        <span className="font-medium">
                          {money(room.price)}
                        </span>
                      </div>
                    </div>

                    <div className="mt-5 grid grid-cols-2 gap-2">
                      <button
                        onClick={() => {
                          setSelectedRoom(room);
                          setShowReservationModal(true);
                          setMessage("");
                        }}
                        disabled={room.status === "blocked"}
                        className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        Reserve
                      </button>

                      <button
                        onClick={() => {
                          setSelectedRoom(room);
                          setBlockReason(room.notes || "");
                          setShowBlockModal(true);
                          setMessage("");
                        }}
                        className="rounded-lg border px-3 py-2 text-sm font-semibold hover:bg-slate-50"
                      >
                        {room.status === "blocked"
                          ? "Unblock"
                          : "Block Room"}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        <section className="rounded-2xl border bg-white shadow-sm">
          <div className="border-b px-6 py-5">
            <h2 className="text-xl font-bold">
              Reservations
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              Recent reservations and guest information.
            </p>
          </div>

          <div className="overflow-x-auto">
            {reservations.length === 0 ? (
              <div className="p-12 text-center text-sm text-slate-500">
                No reservations found.
              </div>
            ) : (
              <table className="w-full min-w-[800px]">
                <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
                  <tr>
                    <th className="px-6 py-4">Guest</th>
                    <th className="px-6 py-4">Room</th>
                    <th className="px-6 py-4">Check-in</th>
                    <th className="px-6 py-4">Check-out</th>
                    <th className="px-6 py-4">Status</th>
                    <th className="px-6 py-4">Balance</th>
                  </tr>
                </thead>

                <tbody className="divide-y">
                  {reservations.map((reservation) => {
                    const balance =
                      Number(reservation.total_amount || 0) -
                      Number(reservation.paid_amount || 0);

                    return (
                      <tr
                        key={reservation.id}
                        className="hover:bg-slate-50"
                      >
                        <td className="px-6 py-4 font-medium">
                          {guestNameForReservation(
                            reservation
                          )}
                        </td>

                        <td className="px-6 py-4">
                          {roomNumberForReservation(
                            reservation
                          )}
                        </td>

                        <td className="px-6 py-4 text-sm">
                          {reservation.check_in}
                        </td>

                        <td className="px-6 py-4 text-sm">
                          {reservation.check_out}
                        </td>

                        <td className="px-6 py-4">
                          <span className="rounded-full bg-yellow-100 px-3 py-1 text-xs font-semibold text-yellow-700">
                            {reservation.status}
                          </span>
                        </td>

                        <td className="px-6 py-4 font-semibold">
                          {money(Math.max(balance, 0))}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </section>
      </div>

      {showBlockModal && selectedRoom && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <h2 className="text-xl font-bold">
              {selectedRoom.status === "blocked"
                ? "Unblock Room"
                : "Block Room"}
            </h2>

            <p className="mt-2 text-sm text-slate-500">
              Room {selectedRoom.room_no}
            </p>

            {selectedRoom.status !== "blocked" && (
              <div className="mt-5">
                <label className="mb-2 block text-sm font-medium">
                  Reason
                </label>

                <textarea
                  value={blockReason}
                  onChange={(event) =>
                    setBlockReason(event.target.value)
                  }
                  placeholder="Example: Maintenance, renovation, owner use..."
                  className="min-h-[100px] w-full rounded-xl border px-4 py-3 text-sm outline-none focus:border-slate-500"
                />
              </div>
            )}

            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowBlockModal(false);
                  setSelectedRoom(null);
                  setBlockReason("");
                }}
                className="rounded-lg border px-4 py-2 text-sm font-semibold"
              >
                Cancel
              </button>

              <button
                onClick={() => {
                  if (selectedRoom.status === "blocked") {
                    toggleBlock(selectedRoom);
                  } else {
                    blockRoom();
                  }
                }}
                disabled={blockLoading}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
              >
                {blockLoading ? "Saving..." : "Continue"}
              </button>
            </div>
          </div>
        </div>
      )}

      {showReservationModal && selectedRoom && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-6 shadow-xl">
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-xl font-bold">
                  New Reservation
                </h2>

                <p className="mt-1 text-sm text-slate-500">
                  Room {selectedRoom.room_no} ·{" "}
                  {selectedRoom.roomTypeName}
                </p>
              </div>

              <button
                onClick={() => {
                  setShowReservationModal(false);
                  setSelectedRoom(null);
                }}
                className="rounded-lg px-3 py-2 text-slate-500 hover:bg-slate-100"
              >
                ✕
              </button>
            </div>

            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label className="mb-2 block text-sm font-medium">
                  Guest Name *
                </label>

                <input
                  value={guestName}
                  onChange={(event) =>
                    setGuestName(event.target.value)
                  }
                  placeholder="Enter guest full name"
                  className="w-full rounded-xl border px-4 py-3 text-sm outline-none focus:border-slate-500"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium">
                  Phone
                </label>

                <input
                  value={guestPhone}
                  onChange={(event) =>
                    setGuestPhone(event.target.value)
                  }
                  placeholder="Phone number"
                  className="w-full rounded-xl border px-4 py-3 text-sm outline-none focus:border-slate-500"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium">
                  Check-in *
                </label>

                <input
                  type="date"
                  value={checkIn}
                  onChange={(event) =>
                    setCheckIn(event.target.value)
                  }
                  className="w-full rounded-xl border px-4 py-3 text-sm outline-none focus:border-slate-500"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium">
                  Check-out *
                </label>

                <input
                  type="date"
                  value={checkOut}
                  onChange={(event) =>
                    setCheckOut(event.target.value)
                  }
                  className="w-full rounded-xl border px-4 py-3 text-sm outline-none focus:border-slate-500"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium">
                  Adults
                </label>

                <input
                  type="number"
                  min="1"
                  value={adults}
                  onChange={(event) =>
                    setAdults(event.target.value)
                  }
                  className="w-full rounded-xl border px-4 py-3 text-sm outline-none focus:border-slate-500"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium">
                  Children
                </label>

                <input
                  type="number"
                  min="0"
                  value={children}
                  onChange={(event) =>
                    setChildren(event.target.value)
                  }
                  className="w-full rounded-xl border px-4 py-3 text-sm outline-none focus:border-slate-500"
                />
              </div>
            </div>

            <div className="mt-6 rounded-xl bg-slate-50 p-4">
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">
                  Room rate
                </span>

                <span className="font-bold">
                  {money(selectedRoom.price)}
                </span>
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowReservationModal(false);
                  setSelectedRoom(null);
                }}
                className="rounded-lg border px-4 py-2 text-sm font-semibold"
              >
                Cancel
              </button>

              <button
                onClick={createReservation}
                disabled={reservationLoading}
                className="rounded-lg bg-slate-900 px-5 py-2 text-sm font-semibold text-white disabled:opacity-50"
              >
                {reservationLoading
                  ? "Creating..."
                  : "Create Reservation"}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
