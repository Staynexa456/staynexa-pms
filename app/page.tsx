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

      if (hotelError) throw hotelError;

      if (!hotels || hotels.length === 0) {
        throw new Error("No hotel found in the hotels table.");
      }

      const currentHotelId = hotels[0].id;
      setHotelId(currentHotelId);

      const [
        roomTypesResult,
        roomsResult,
        guestsResult,
        reservationsResult,
      ] = await Promise.all([
        supabase
          .from("room_types")
          .select(
            "id, hotel_id, name, description, max_guests, base_price"
          )
          .eq("hotel_id", currentHotelId),

        supabase
          .from("rooms")
          .select(
            "id, hotel_id, room_type_id, room_number, floor, status, notes"
          )
          .eq("hotel_id", currentHotelId)
          .order("room_number"),

        supabase
          .from("guests")
          .select(
            "id, hotel_id, first_name, last_name, phone, email"
          )
          .eq("hotel_id", currentHotelId)
          .order("created_at", { ascending: false }),

        supabase
          .from("reservations")
          .select(
            "id, hotel_id, guest_id, room_id, reservation_number, check_in, check_out, adults, children, status, room_rate, discount, tax, total_amount, paid_amount, due_amount, source, special_requests"
          )
          .eq("hotel_id", currentHotelId)
          .order("check_in", { ascending: false }),
      ]);

      if (roomTypesResult.error) throw roomTypesResult.error;
      if (roomsResult.error) throw roomsResult.error;
      if (guestsResult.error) throw guestsResult.error;
      if (reservationsResult.error) {
        throw reservationsResult.error;
      }

      const loadedRoomTypes = (roomTypesResult.data ||
        []) as RoomType[];

      const loadedGuests = (guestsResult.data ||
        []) as Guest[];

      const loadedRooms: Room[] = (
        roomsResult.data || []
      ).map((room: any) => {
        const roomType = loadedRoomTypes.find(
          (type) => type.id === room.room_type_id
        );

        return {
          id: room.id,
          hotel_id: room.hotel_id,
          room_type_id: room.room_type_id,
          room_no: room.room_number,
          floor: Number(room.floor || 0),
          status: room.status as RoomStatus,
          notes: room.notes,
          roomTypeName: roomType?.name || "Room",
          price: Number(roomType?.base_price || 0),
        };
      });

      const loadedReservations: Reservation[] = (
        reservationsResult.data || []
      ).map((reservation: any) => {
        const guest = loadedGuests.find(
          (item) => item.id === reservation.guest_id
        );

        const room = loadedRooms.find(
          (item) => item.id === reservation.room_id
        );

        return {
          ...reservation,
          adults: Number(reservation.adults || 0),
          children: Number(reservation.children || 0),
          room_rate: Number(reservation.room_rate || 0),
          discount: Number(reservation.discount || 0),
          tax: Number(reservation.tax || 0),
          total_amount: Number(
            reservation.total_amount || 0
          ),
          paid_amount: Number(
            reservation.paid_amount || 0
          ),
          due_amount: Number(
            reservation.due_amount || 0
          ),
          guestName: guest
            ? `${guest.first_name} ${guest.last_name || ""}`.trim()
            : "Guest",
          guestPhone: guest?.phone || "",
          roomNo: room?.room_no || "—",
        };
      });

      setRoomTypes(loadedRoomTypes);
      setGuests(loadedGuests);
      setRooms(loadedRooms);
      setReservations(loadedReservations);
    } catch (err: any) {
      console.error(err);

      setError(
        err?.message ||
          "Unable to load data from Supabase."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  async function toggleBlock(room: Room) {
    if (
      room.status !== "available" &&
      room.status !== "blocked"
    ) {
      alert("Only available rooms can be blocked.");
      return;
    }

    const newStatus: RoomStatus =
      room.status === "blocked"
        ? "available"
        : "blocked";

    const confirmed = window.confirm(
      room.status === "blocked"
        ? `Do you want to UNBLOCK Room ${room.room_no}?`
        : `Do you want to BLOCK Room ${room.room_no}?`
    );

    if (!confirmed) return;

    try {
      const { error: updateError } = await supabase
        .from("rooms")
        .update({ status: newStatus })
        .eq("id", room.id);

      if (updateError) throw updateError;

      setRooms((current) =>
        current.map((item) =>
          item.id === room.id
            ? { ...item, status: newStatus }
            : item
        )
      );
    } catch (err: any) {
      alert(
        err?.message || "Unable to update room status."
      );
    }
  }

  async function checkInGuest(
    reservation: Reservation
  ) {
    const confirmed = window.confirm(
      `Do you want to continue to CHECK-IN ${reservation.guestName}?`
    );

    if (!confirmed) return;

    try {
      setSaving(true);

      const { error: reservationError } =
        await supabase
          .from("reservations")
          .update({
            status: "checked-in",
          })
          .eq("id", reservation.id);

      if (reservationError) throw reservationError;

      const { error: roomError } = await supabase
        .from("rooms")
        .update({
          status: "occupied",
        })
        .eq("id", reservation.room_id);

      if (roomError) throw roomError;

      await loadData();
    } catch (err: any) {
      alert(
        err?.message || "Unable to check in guest."
      );
    } finally {
      setSaving(false);
    }
  }

  async function checkOutGuest(
    reservation: Reservation
  ) {
    const due = Number(reservation.due_amount || 0);

    let confirmed = false;

    if (due > 0) {
      confirmed = window.confirm(
        `This guest has ${money(
          due
        )} due.\n\nDo you want to continue to CHECK-OUT?`
      );
    } else {
      confirmed = window.confirm(
        `Do you want to continue to CHECK-OUT ${reservation.guestName}?`
      );
    }

    if (!confirmed) return;

    try {
      setSaving(true);

      const { error: reservationError } =
        await supabase
          .from("reservations")
          .update({
            status: "checked-out",
          })
          .eq("id", reservation.id);

      if (reservationError) throw reservationError;

      const { error: roomError } = await supabase
        .from("rooms")
        .update({
          status: "cleaning",
        })
        .eq("id", reservation.room_id);

      if (roomError) throw roomError;

      await loadData();
    } catch (err: any) {
      alert(
        err?.message || "Unable to check out guest."
      );
    } finally {
      setSaving(false);
    }
  }

  async function createReservation() {
    if (!hotelId) {
      alert("Hotel information is not loaded.");
      return;
    }

    if (
      !guestName.trim() ||
      !guestPhone.trim() ||
      !selectedRoom ||
      !checkIn ||
      !checkOut
    ) {
      alert("Please fill all required fields.");
      return;
    }

    if (new Date(checkOut) <= new Date(checkIn)) {
      alert("Check-out date must be after check-in date.");
      return;
    }

    const room = rooms.find(
      (item) => item.id === selectedRoom
    );

    if (!room) {
      alert("Please select a valid room.");
      return;
    }

    try {
      setSaving(true);

      const nameParts = guestName
        .trim()
        .split(" ")
        .filter(Boolean);

      const firstName = nameParts[0] || "";
      const lastName = nameParts.slice(1).join(" ");

      const existingGuest = guests.find(
        (guest) =>
          guest.phone.trim() === guestPhone.trim()
      );

      let guestId = existingGuest?.id;

      if (!guestId) {
        const { data: newGuest, error: guestError } =
          await supabase
            .from("guests")
            .insert({
              hotel_id: hotelId,
              first_name: firstName,
              last_name: lastName,
              phone: guestPhone.trim(),
              email: guestEmail.trim() || null,
            })
            .select(
              "id, hotel_id, first_name, last_name, phone, email"
            )
            .single();

        if (guestError) throw guestError;

        guestId = newGuest.id;
      }

      const nights = Math.max(
        1,
        Math.ceil(
          (new Date(checkOut).getTime() -
            new Date(checkIn).getTime()) /
            (1000 * 60 * 60 * 24)
        )
      );

      const roomRate = Number(room.price || 0);
      const totalAmount = roomRate * nights;
      const paidAmount = 0;
      const dueAmount = totalAmount;

      const reservationNumber = `STX-${Date.now()}`;

      const { error: reservationError } =
        await supabase
          .from("reservations")
          .insert({
            hotel_id: hotelId,
            guest_id: guestId,
            room_id: room.id,
            reservation_number: reservationNumber,
            check_in: checkIn,
            check_out: checkOut,
            adults: Number(adults) || 1,
            children: Number(children) || 0,
            status: "confirmed",
            room_rate: roomRate,
            discount: 0,
            tax: 0,
            total_amount: totalAmount,
            paid_amount: paidAmount,
            due_amount: dueAmount,
            source: "Direct",
            special_requests: null,
          });

      if (reservationError) {
        throw reservationError;
      }

      const { error: roomError } = await supabase
        .from("rooms")
        .update({
          status: "occupied",
        })
        .eq("id", room.id);

      if (roomError) throw roomError;

      setGuestName("");
      setGuestPhone("");
      setGuestEmail("");
      setSelectedRoom("");
      setCheckIn("");
      setCheckOut("");
      setAdults("1");
      setChildren("0");
      setShowReservation(false);

      await loadData();

      alert("Reservation created successfully.");
    } catch (err: any) {
      console.error(err);

      alert(
        err?.message ||
          "Unable to create reservation."
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <aside className="fixed left-0 top-0 hidden h-screen w-64 border-r bg-white lg:block">
        <div className="border-b px-6 py-5">
          <div className="text-xl font-bold tracking-tight">
            Staynexa
          </div>

          <div className="text-xs text-slate-500">
            Hotel PMS
          </div>
        </div>

        <nav className="space-y-1 p-4">
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
          ].map((item) => (
            <button
              key={item}
              onClick={() => setActiveTab(item)}
              className={`w-full rounded-lg px-4 py-3 text-left text-sm font-medium transition ${
                activeTab === item
                  ? "bg-slate-900 text-white"
                  : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              {item}
            </button>
          ))}
        </nav>
      </aside>

      <section className="lg:ml-64">
        <header className="sticky top-0 z-20 flex items-center justify-between border-b bg-white/95 px-4 py-4 backdrop-blur md:px-8">
          <div>
            <h1 className="text-xl font-semibold">
              {activeTab}
            </h1>

            <p className="text-sm text-slate-500">
              Visthara Elite Hotel
            </p>
          </div>

          <button
            onClick={() => setShowReservation(true)}
            className="rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-700"
          >
            + New Reservation
          </button>
        </header>

        <div className="p-4 md:p-8">
          {loading && (
            <div className="rounded-xl border bg-white p-8 text-center">
              <div className="text-lg font-semibold">
                Loading Staynexa...
              </div>

              <p className="mt-2 text-sm text-slate-500">
                Connecting to your hotel database.
              </p>
            </div>
          )}

          {!loading && error && (
            <div className="rounded-xl border border-red-200 bg-red-50 p-6">
              <h2 className="font-semibold text-red-700">
                Database connection error
              </h2>

              <p className="mt-2 text-sm text-red-600">
                {error}
              </p>

              <button
                onClick={loadData}
                className="mt-4 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white"
              >
                Try Again
              </button>
            </div>
          )}

          {!loading && !error && (
            <>
              {activeTab === "Dashboard" && (
                <>
                  <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                    <Stat
                      title="Total Rooms"
                      value={rooms.length}
                      description="All hotel rooms"
                    />

                    <Stat
                      title="Available"
                      value={availableRooms.length}
                      description="Ready for booking"
                    />

                    <Stat
                      title="Occupied"
                      value={occupiedRooms.length}
                      description="Currently occupied"
                    />

                    <Stat
                      title="Due Balance"
                      value={money(totalDue)}
                      description="Outstanding amount"
                    />
                  </div>

                  <div className="mt-8 rounded-xl border bg-white">
                    <div className="flex items-center justify-between border-b px-5 py-4">
                      <div>
                        <h2 className="font-semibold">
                          Room Status
                        </h2>

                        <p className="text-sm text-slate-500">
                          Manage rooms from the front office
                        </p>
                      </div>

                      <span className="text-sm text-slate-500">
                        {blockedRooms.length} blocked
                      </span>
                    </div>

                    {rooms.length === 0 ? (
                      <div className="p-8 text-center text-sm text-slate-500">
                        No rooms found.
                      </div>
                    ) : (
                      <div className="grid gap-4 p-5 sm:grid-cols-2 xl:grid-cols-4">
                        {rooms.map((room) => (
                          <div
                            key={room.id}
                            className="rounded-xl border p-4 transition hover:shadow-sm"
                          >
                            <div className="flex items-center justify-between gap-2">
                              <div>
                                <div className="text-lg font-bold">
                                  Room {room.room_no}
                                </div>

                                <div className="text-sm text-slate-500">
                                  {room.roomTypeName} · Floor{" "}
                                  {room.floor}
                                </div>
                              </div>

                              <span
                                className={`rounded-full px-2.5 py-1 text-xs font-semibold ${roomStatusColor(
                                  room.status
                                )}`}
                              >
                                {statusLabel[
                                  room.status
                                ] || room.status}
                              </span>
                            </div>

                            <div className="mt-4 flex items-center justify-between gap-2">
                              <span className="text-sm font-medium">
                                {money(room.price)} / night
                              </span>

                              {(room.status === "available" ||
                                room.status === "blocked") && (
                                <button
                                  onClick={() =>
                                    toggleBlock(room)
                                  }
                                  className="rounded-md border px-3 py-1.5 text-xs font-medium hover:bg-slate-50"
                                >
                                  {room.status === "blocked"
                                    ? "Unblock"
                                    : "Block Room"}
                                </button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="mt-8 rounded-xl border bg-white">
                    <div className="border-b px-5 py-4">
                      <h2 className="font-semibold">
                        Reservations
                      </h2>

                      <p className="text-sm text-slate-500">
                        Live reservations from Supabase
                      </p>
                    </div>

                    {reservations.length === 0 ? (
                      <div className="p-8 text-center text-sm text-slate-500">
                        No reservations found.
                      </div>
                    ) : (
                      <div className="divide-y">
                        {reservations.map(
                          (reservation) => (
                            <div
                              key={reservation.id}
                              className={`border-l-4 p-5 ${reservationColor(
                                reservation.status
                              )}`}
                            >
                              <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                                <div>
                                  <div className="font-semibold">
                                    {reservation.guestName}
                                  </div>

                                  <div className="mt-1 text-sm text-slate-500">
                                    Room{" "}
                                    {reservation.roomNo} ·{" "}
                                    {reservation.guestPhone}
                                  </div>

                                  <div className="mt-2 text-xs text-slate-500">
                                    {reservation.check_in} →{" "}
                                    {reservation.check_out}
                                  </div>

                                  <div className="mt-2 text-xs text-slate-400">
                                    Booking #
                                    {
                                      reservation.reservation_number
                                    }
                                  </div>
                                </div>

                                <div className="flex flex-wrap items-center gap-2">
                                  <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold shadow-sm">
                                    {statusLabel[
                                      reservation.status
                                    ] ||
                                      reservation.status}
                                  </span>

                                  <span className="text-sm font-semibold">
                                    Due{" "}
                                    {money(
                                      reservation.due_amount
                                    )}
                                  </span>

                                  {reservation.status ===
                                    "confirmed" && (
                                    <button
                                      disabled={saving}
                                      onClick={() =>
                                        checkInGuest(
                                          reservation
                                        )
                                      }
                                      className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
                                    >
                                      Check-In
                                    </button>
                                  )}

                                  {reservation.status ===
                                    "checked-in" && (
                                    <button
                                      disabled={saving}
                                      onClick={() =>
                                        checkOutGuest(
                                          reservation
                                        )
                                      }
                                      className="rounded-lg bg-red-600 px-3 py-2 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-50"
                                    >
                                      Check-Out
                                    </button>
                                  )}
                                </div>
                              </div>
                            </div>
                          )
                        )}
                      </div>
                    )}
                  </div>
                </>
              )}

              {activeTab === "Rooms" && (
                <div className="rounded-xl border bg-white">
                  <div className="border-b px-5 py-4">
                    <h2 className="font-semibold">
                      Rooms
                    </h2>

                    <p className="text-sm text-slate-500">
                      All rooms from your hotel database
                    </p>
                  </div>

                  <div className="grid gap-4 p-5 sm:grid-cols-2 xl:grid-cols-4">
                    {rooms.map((room) => (
                      <div
                        key={room.id}
                        className="rounded-xl border p-4"
                      >
                        <div className="font-bold">
                          Room {room.room_no}
                        </div>

                        <div className="text-sm text-slate-500">
                          {room.roomTypeName} · Floor{" "}
                          {room.floor}
                        </div>

                        <div
                          className={`mt-3 inline-block rounded-full px-3 py-1 text-xs font-semibold ${roomStatusColor(
                            room.status
                          )}`}
                        >
                          {statusLabel[
                            room.status
                          ] || room.status}
                        </div>

                        <div className="mt-3 text-sm font-medium">
                          {money(room.price)} / night
                        </div>

                        {(room.status === "available" ||
                          room.status === "blocked") && (
                          <button
                            onClick={() =>
                              toggleBlock(room)
                            }
                            className="mt-4 w-full rounded-lg border px-3 py-2 text-sm font-medium hover:bg-slate-50"
                          >
                            {room.status === "blocked"
                              ? "Unblock Room"
                              : "Block Room"}
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {activeTab === "Reservations" && (
                <div className="rounded-xl border bg-white">
                  <div className="border-b px-5 py-4">
                    <h2 className="font-semibold">
                      All Reservations
                    </h2>
                  </div>

                  <div className="divide-y">
                    {reservations.map(
                      (reservation) => (
                        <div
                          key={reservation.id}
                          className="p-5"
                        >
                          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                            <div>
                              <div className="font-semibold">
                                {reservation.guestName}
                              </div>

                              <div className="text-sm text-slate-500">
                                Room{" "}
                                {reservation.roomNo} ·{" "}
                                {reservation.guestPhone}
                              </div>

                              <div className="text-sm text-slate-500">
                                {reservation.check_in} →{" "}
                                {reservation.check_out}
                              </div>
                            </div>

                            <div>
                              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold">
                                {statusLabel[
                                  reservation.status
                                ] ||
                                  reservation.status}
                              </span>

                              <div className="mt-2 text-sm">
                                Due:{" "}
                                <strong>
                                  {money(
                                    reservation.due_amount
                                  )}
                                </strong>
                              </div>
                            </div>
                          </div>
                        </div>
                      )
                    )}
                  </div>
                </div>
              )}

              {activeTab === "Guests" && (
                <div className="rounded-xl border bg-white">
                  <div className="border-b px-5 py-4">
                    <h2 className="font-semibold">
                      Guests
                    </h2>

                    <p className="text-sm text-slate-500">
                      Guest records from Supabase
                    </p>
                  </div>

                  <div className="divide-y">
                    {guests.map((guest) => (
                      <div
                        key={guest.id}
                        className="p-5"
                      >
                        <div className="font-semibold">
                          {guest.first_name}{" "}
                          {guest.last_name}
                        </div>

                        <div className="mt-1 text-sm text-slate-500">
                          {guest.phone}
                          {guest.email
                            ? ` · ${guest.email}`
                            : ""}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {activeTab === "Calendar" && (
                <div className="rounded-xl border bg-white p-8">
                  <h2 className="text-xl font-semibold">
                    Reservation Calendar
                  </h2>

                  <p className="mt-2 text-slate-500">
                    Calendar module will be built next using
                    your live reservations.
                  </p>
                </div>
              )}

              {activeTab === "Check-In" && (
                <div className="rounded-xl border bg-white p-6">
                  <h2 className="text-xl font-semibold">
                    Check-In
                  </h2>

                  <div className="mt-5 space-y-3">
                    {reservations
                      .filter(
                        (r) => r.status === "confirmed"
                      )
                      .map((reservation) => (
                        <div
                          key={reservation.id}
                          className="flex flex-col gap-3 rounded-xl border p-4 md:flex-row md:items-center md:justify-between"
                        >
                          <div>
                            <div className="font-semibold">
                              {reservation.guestName}
                            </div>

                            <div className="text-sm text-slate-500">
                              Room {reservation.roomNo}
                            </div>
                          </div>

                          <button
                            onClick={() =>
                              checkInGuest(
                                reservation
                              )
                            }
                            className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white"
                          >
                            Check-In
                          </button>
                        </div>
                      ))}
                  </div>
                </div>
              )}

              {activeTab === "Check-Out" && (
                <div className="rounded-xl border bg-white p-6">
                  <h2 className="text-xl font-semibold">
                    Check-Out
                  </h2>

                  <div className="mt-5 space-y-3">
                    {reservations
                      .filter(
                        (r) =>
                          r.status === "checked-in"
                      )
                      .map((reservation) => (
                        <div
                          key={reservation.id}
                          className="flex flex-col gap-3 rounded-xl border p-4 md:flex-row md:items-center md:justify-between"
                        >
                          <div>
                            <div className="font-semibold">
                              {reservation.guestName}
                            </div>

                            <div className="text-sm text-slate-500">
                              Room {reservation.roomNo}
                            </div>

                            <div className="text-sm font-semibold">
                              Due{" "}
                              {money(
                                reservation.due_amount
                              )}
                            </div>
                          </div>

                          <button
                            onClick={() =>
                              checkOutGuest(
                                reservation
                              )
                            }
                            className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white"
                          >
                            Check-Out
                          </button>
                        </div>
                      ))}
                  </div>
                </div>
              )}

              {activeTab === "Housekeeping" && (
                <Placeholder
                  title="Housekeeping"
                  text="Housekeeping management will be connected to the housekeeping_tasks table next."
                />
              )}

              {activeTab === "Reports" && (
                <Placeholder
                  title="Reports"
                  text="Reports and revenue analytics will be built next."
                />
              )}
            </>
          )}
        </div>
      </section>

      {showReservation && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold">
                  New Reservation
                </h2>

                <p className="text-sm text-slate-500">
                  Enter guest and booking details
                </p>
              </div>

              <button
                onClick={() =>
                  setShowReservation(false)
                }
                className="rounded-lg px-3 py-2 text-slate-500 hover:bg-slate-100"
              >
                ✕
              </button>
            </div>

            <div className="mt-6 space-y-4">
              <Input
                label="Guest Name *"
                value={guestName}
                onChange={setGuestName}
                placeholder="Enter guest name"
              />

              <Input
                label="Phone *"
                value={guestPhone}
                onChange={setGuestPhone}
                placeholder="Enter phone number"
              />

              <Input
                label="Email"
                value={guestEmail}
                onChange={setGuestEmail}
                placeholder="Enter email"
              />

              <div>
                <label className="mb-1.5 block text-sm font-medium">
                  Room *
                </label>

                <select
                  value={selectedRoom}
                  onChange={(e) =>
                    setSelectedRoom(e.target.value)
                  }
                  className="w-full rounded-lg border px-3 py-2.5 outline-none focus:ring-2 focus:ring-slate-300"
                >
                  <option value="">
                    Select room
                  </option>

                  {availableRooms.map((room) => (
                    <option
                      key={room.id}
                      value={room.id}
                    >
                      Room {room.room_no} —{" "}
                      {room.roomTypeName} —{" "}
                      {money(room.price)}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <Input
                  label="Check-in *"
                  type="date"
                  value={checkIn}
                  onChange={setCheckIn}
                />

                <Input
                  label="Check-out *"
                  type="date"
                  value={checkOut}
                  onChange={setCheckOut}
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <Input
                  label="Adults"
                  type="number"
                  value={adults}
                  onChange={setAdults}
                />

                <Input
                  label="Children"
                  type="number"
                  value={children}
                  onChange={setChildren}
                />
              </div>

              <button
                disabled={saving}
                onClick={createReservation}
                className="w-full rounded-lg bg-slate-900 py-3 font-semibold text-white hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {saving
                  ? "Saving..."
                  : "Create Reservation"}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

function Stat({
  title,
  value,
  description,
}: {
  title: string;
  value: string | number;
  description: string;
}) {
  return (
    <div className="rounded-xl border bg-white p-5">
      <div className="text-sm font-medium text-slate-500">
        {title}
      </div>

      <div className="mt-2 text-3xl font-bold tracking-tight">
        {value}
      </div>

      <div className="mt-1 text-xs text-slate-400">
        {description}
      </div>
    </div>
  );
}

function Input({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: string;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-sm font-medium">
        {label}
      </label>

      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-lg border px-3 py-2.5 outline-none focus:ring-2 focus:ring-slate-300"
      />
    </div>
  );
}

function Placeholder({
  title,
  text,
}: {
  title: string;
  text: string;
}) {
  return (
    <div className="rounded-xl border bg-white p-8">
      <h2 className="text-xl font-semibold">{title}</h2>

      <p className="mt-2 text-slate-500">{text}</p>
    </div>
  );
}
```

### Now do this

1. GitHub → **`app` → `page.tsx`**
2. Click **✏️ Edit**
3. **Ctrl+A** inside the editor.
4. Delete everything.
5. Paste the **entire code above**.
6. Click **Commit changes**.

**Do not edit anything else.**

Once committed, Vercel should automatically build it. Tell me **DONE** after the GitHub commit is finished.
