"use client";

import { useMemo, useState } from "react";

type RoomStatus = "Available" | "Occupied" | "Cleaning" | "Blocked";

type Room = {
  id: number;
  number: string;
  type: string;
  floor: number;
  price: number;
  status: RoomStatus;
};

type Reservation = {
  id: number;
  guest: string;
  phone: string;
  room: string;
  checkIn: string;
  checkOut: string;
  status: "Confirmed" | "Checked-in" | "Checked-out";
  amount: number;
  paid: number;
};

const initialRooms: Room[] = [
  {
    id: 1,
    number: "101",
    type: "Deluxe",
    floor: 1,
    price: 2500,
    status: "Available",
  },
  {
    id: 2,
    number: "102",
    type: "Deluxe",
    floor: 1,
    price: 2500,
    status: "Occupied",
  },
  {
    id: 3,
    number: "103",
    type: "Standard",
    floor: 1,
    price: 1800,
    status: "Cleaning",
  },
  {
    id: 4,
    number: "104",
    type: "Suite",
    floor: 1,
    price: 4000,
    status: "Available",
  },
  {
    id: 5,
    number: "201",
    type: "Deluxe",
    floor: 2,
    price: 2500,
    status: "Available",
  },
  {
    id: 6,
    number: "202",
    type: "Standard",
    floor: 2,
    price: 1800,
    status: "Blocked",
  },
  {
    id: 7,
    number: "203",
    type: "Suite",
    floor: 2,
    price: 4000,
    status: "Occupied",
  },
  {
    id: 8,
    number: "204",
    type: "Deluxe",
    floor: 2,
    price: 2500,
    status: "Available",
  },
];

const initialReservations: Reservation[] = [
  {
    id: 1,
    guest: "Rahul Sharma",
    phone: "9876543210",
    room: "102",
    checkIn: "2026-09-11",
    checkOut: "2026-09-13",
    status: "Checked-in",
    amount: 5000,
    paid: 3000,
  },
  {
    id: 2,
    guest: "Priya Patel",
    phone: "9876501234",
    room: "201",
    checkIn: "2026-09-12",
    checkOut: "2026-09-14",
    status: "Confirmed",
    amount: 5000,
    paid: 0,
  },
  {
    id: 3,
    guest: "Amit Kumar",
    phone: "9988776655",
    room: "203",
    checkIn: "2026-09-10",
    checkOut: "2026-09-12",
    status: "Checked-in",
    amount: 8000,
    paid: 8000,
  },
];

function statusColor(status: RoomStatus) {
  switch (status) {
    case "Available":
      return "bg-emerald-100 text-emerald-700";
    case "Occupied":
      return "bg-blue-100 text-blue-700";
    case "Cleaning":
      return "bg-amber-100 text-amber-700";
    case "Blocked":
      return "bg-red-100 text-red-700";
  }
}

function reservationColor(status: Reservation["status"]) {
  switch (status) {
    case "Checked-in":
      return "border-emerald-400 bg-emerald-50";
    case "Checked-out":
      return "border-red-400 bg-red-50";
    case "Confirmed":
      return "border-yellow-400 bg-yellow-50";
  }
}

export default function Home() {
  const [rooms, setRooms] = useState<Room[]>(initialRooms);

  const [reservations, setReservations] =
    useState<Reservation[]>(initialReservations);

  const [activeTab, setActiveTab] = useState("Dashboard");

  const [showReservation, setShowReservation] =
    useState(false);

  const [guestName, setGuestName] = useState("");
  const [guestPhone, setGuestPhone] = useState("");
  const [selectedRoom, setSelectedRoom] = useState("");
  const [checkIn, setCheckIn] = useState("");
  const [checkOut, setCheckOut] = useState("");

  const availableRooms = rooms.filter(
    (room) => room.status === "Available"
  );

  const occupiedRooms = rooms.filter(
    (room) => room.status === "Occupied"
  );

  const blockedRooms = rooms.filter(
    (room) => room.status === "Blocked"
  );

  const totalDue = useMemo(
    () =>
      reservations.reduce(
        (total, reservation) =>
          total +
          Math.max(
            reservation.amount - reservation.paid,
            0
          ),
        0
      ),
    [reservations]
  );

  function toggleBlock(roomId: number) {
    setRooms((current) =>
      current.map((room) => {
        if (room.id !== roomId) return room;

        if (room.status === "Blocked") {
          return {
            ...room,
            status: "Available",
          };
        }

        if (room.status === "Available") {
          return {
            ...room,
            status: "Blocked",
          };
        }

        alert("Only available rooms can be blocked.");

        return room;
      })
    );
  }

  function checkInGuest(reservationId: number) {
    const reservation = reservations.find(
      (r) => r.id === reservationId
    );

    if (!reservation) return;

    const confirmCheckIn = window.confirm(
      `Do you want to continue to CHECK-IN ${reservation.guest}?`
    );

    if (!confirmCheckIn) return;

    setReservations((current) =>
      current.map((r) =>
        r.id === reservationId
          ? {
              ...r,
              status: "Checked-in",
            }
          : r
      )
    );

    setRooms((current) =>
      current.map((room) =>
        room.number === reservation.room
          ? {
              ...room,
              status: "Occupied",
            }
          : room
      )
    );
  }

  function checkOutGuest(reservationId: number) {
    const reservation = reservations.find(
      (r) => r.id === reservationId
    );

    if (!reservation) return;

    const due =
      reservation.amount - reservation.paid;

    if (due > 0) {
      const continueCheckout = window.confirm(
        `This guest has ₹${due.toLocaleString()} due.\n\nDo you want to continue to CHECK-OUT?`
      );

      if (!continueCheckout) return;
    } else {
      const confirmCheckout = window.confirm(
        `Do you want to continue to CHECK-OUT ${reservation.guest}?`
      );

      if (!confirmCheckout) return;
    }

    setReservations((current) =>
      current.map((r) =>
        r.id === reservationId
          ? {
              ...r,
              status: "Checked-out",
            }
          : r
      )
    );

    setRooms((current) =>
      current.map((room) =>
        room.number === reservation.room
          ? {
              ...room,
              status: "Cleaning",
            }
          : room
      )
    );
  }

  function createReservation() {
    if (
      !guestName ||
      !guestPhone ||
      !selectedRoom ||
      !checkIn ||
      !checkOut
    ) {
      alert("Please fill all fields.");
      return;
    }

    const room = rooms.find(
      (r) => r.number === selectedRoom
    );

    if (!room) return;

    const newReservation: Reservation = {
      id: Date.now(),
      guest: guestName,
      phone: guestPhone,
      room: selectedRoom,
      checkIn,
      checkOut,
      status: "Confirmed",
      amount: room.price,
      paid: 0,
    };

    setReservations((current) => [
      ...current,
      newReservation,
    ]);

    setRooms((current) =>
      current.map((r) =>
        r.number === selectedRoom
          ? {
              ...r,
              status: "Occupied",
            }
          : r
      )
    );

    setGuestName("");
    setGuestPhone("");
    setSelectedRoom("");
    setCheckIn("");
    setCheckOut("");

    setShowReservation(false);
  }

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">

      {/* SIDEBAR */}

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

      {/* MAIN */}

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

          {activeTab === "Dashboard" && (

            <>

              {/* STATS */}

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
                  value={`₹${totalDue.toLocaleString()}`}
                  description="Outstanding amount"
                />

              </div>

              {/* ROOM STATUS */}

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

                <div className="grid gap-4 p-5 sm:grid-cols-2 xl:grid-cols-4">

                  {rooms.map((room) => (

                    <div
                      key={room.id}
                      className="rounded-xl border p-4 transition hover:shadow-sm"
                    >

                      <div className="flex items-center justify-between">

                        <div>

                          <div className="text-lg font-bold">
                            Room {room.number}
                          </div>

                          <div className="text-sm text-slate-500">
                            {room.type} · Floor {room.floor}
                          </div>

                        </div>

                        <span
                          className={`rounded-full px-2.5 py-1 text-xs font-semibold ${statusColor(
                            room.status
                          )}`}
                        >
                          {room.status}
                        </span>

                      </div>

                      <div className="mt-4 flex items-center justify-between">

                        <span className="text-sm font-medium">
                          ₹{room.price.toLocaleString()} / night
                        </span>

                        {(
                          room.status === "Available" ||
                          room.status === "Blocked"
                        ) && (

                          <button
                            onClick={() =>
                              toggleBlock(room.id)
                            }
                            className="rounded-md border px-3 py-1.5 text-xs font-medium hover:bg-slate-50"
                          >
                            {room.status === "Blocked"
                              ? "Unblock"
                              : "Block Room"}
                          </button>

                        )}

                      </div>

                    </div>

                  ))}

                </div>

              </div>

              {/* RESERVATIONS */}

              <div className="mt-8 rounded-xl border bg-white">

                <div className="border-b px-5 py-4">

                  <h2 className="font-semibold">
                    Today&apos;s Reservations
                  </h2>

                </div>

                <div className="divide-y">

                  {reservations.map((reservation) => (

                    <div
                      key={reservation.id}
                      className={`border-l-4 p-5 ${reservationColor(
                        reservation.status
                      )}`}
                    >

                      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">

                        <div>

                          <div className="font-semibold">
                            {reservation.guest}
                          </div>

                          <div className="mt-1 text-sm text-slate-500">
                            Room {reservation.room} ·{" "}
                            {reservation.phone}
                          </div>

                          <div className="mt-2 text-xs text-slate-500">
                            {reservation.checkIn} →{" "}
                            {reservation.checkOut}
                          </div>

                        </div>

                        <div className="flex flex-wrap items-center gap-2">

                          <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold shadow-sm">
                            {reservation.status}
                          </span>

                          <span className="text-sm font-semibold">
                            Due ₹
                            {Math.max(
                              reservation.amount -
                                reservation.paid,
                              0
                            ).toLocaleString()}
                          </span>

                          {reservation.status ===
                            "Confirmed" && (

                            <button
                              onClick={() =>
                                checkInGuest(
                                  reservation.id
                                )
                              }
                              className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-700"
                            >
                              Check-In
                            </button>

                          )}

                          {reservation.status ===
                            "Checked-in" && (

                            <button
                              onClick={() =>
                                checkOutGuest(
                                  reservation.id
                                )
                              }
                              className="rounded-lg bg-red-600 px-3 py-2 text-xs font-semibold text-white hover:bg-red-700"
                            >
                              Check-Out
                            </button>

                          )}

                        </div>

                      </div>

                    </div>

                  ))}

                </div>

              </div>

            </>

          )}

          {activeTab !== "Dashboard" && (

            <div className="rounded-xl border bg-white p-8">

              <h2 className="text-xl font-semibold">
                {activeTab}
              </h2>

              <p className="mt-2 text-slate-500">
                This module will be connected in the next
                development step.
              </p>

              {activeTab === "Rooms" && (

                <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">

                  {rooms.map((room) => (

                    <div
                      key={room.id}
                      className="rounded-xl border p-4"
                    >

                      <div className="font-bold">
                        Room {room.number}
                      </div>

                      <div className="text-sm text-slate-500">
                        {room.type}
                      </div>

                      <div
                        className={`mt-3 inline-block rounded-full px-3 py-1 text-xs font-semibold ${statusColor(
                          room.status
                        )}`}
                      >
                        {room.status}
                      </div>

                    </div>

                  ))}

                </div>

              )}

            </div>

          )}

        </div>

      </section>

      {/* NEW RESERVATION MODAL */}

      {showReservation && (

        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">

          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl">

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
                label="Guest Name"
                value={guestName}
                onChange={setGuestName}
                placeholder="Enter guest name"
              />

              <Input
                label="Phone"
                value={guestPhone}
                onChange={setGuestPhone}
                placeholder="Enter phone number"
              />

              <div>

                <label className="mb-1.5 block text-sm font-medium">
                  Room
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
                      value={room.number}
                    >
                      Room {room.number} — {room.type} — ₹
                      {room.price}
                    </option>

                  ))}

                </select>

              </div>

              <div className="grid gap-4 sm:grid-cols-2">

                <Input
                  label="Check-in"
                  type="date"
                  value={checkIn}
                  onChange={setCheckIn}
                />

                <Input
                  label="Check-out"
                  type="date"
                  value={checkOut}
                  onChange={setCheckOut}
                />

              </div>

              <button
                onClick={createReservation}
                className="w-full rounded-lg bg-slate-900 py-3 font-semibold text-white hover:bg-slate-700"
              >
                Create Reservation
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